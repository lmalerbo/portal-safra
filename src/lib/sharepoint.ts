// ROPC (Resource Owner Password Credentials) — autentica como usuário M365
// Permissão necessária no app registration: SharePoint > user_impersonation (delegada, sem admin consent)
// A conta de serviço (SP_USERNAME) precisa ter acesso de leitura ao site SharePoint

export interface SharePointFile {
  name: string
  serverRelativeUrl: string
  size: number
  farmCode: string
  farmName: string
  lineType: '1L' | '2L'
}

// Pattern: 10019_MORADA DA PRATA 3_Exp1L.zip
function parseFileName(name: string): Omit<SharePointFile, 'name' | 'serverRelativeUrl' | 'size'> | null {
  const match = name.match(/^(\d+)_(.+?)_Exp([12])L\.zip$/i)
  if (!match) return null
  return {
    farmCode: match[1],
    farmName: match[2],
    lineType: `${match[3]}L` as '1L' | '2L',
  }
}

let tokenCache: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.value

  const tenantId  = process.env.SP_TENANT_ID!
  const clientId  = process.env.SP_CLIENT_ID!
  const clientSecret = process.env.SP_CLIENT_SECRET!
  const username  = process.env.SP_USERNAME!
  const password  = process.env.SP_PASSWORD!
  const spOrigin  = new URL(process.env.SP_SITE_URL!).origin // https://uspedracombr.sharepoint.com

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'password',
        client_id:     clientId,
        client_secret: clientSecret,
        scope:         `${spOrigin}/user_impersonation`,
        username,
        password,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => res.text())
    throw new Error(`ROPC auth error ${res.status}: ${JSON.stringify(err)}`)
  }

  const { access_token, expires_in } = await res.json()
  tokenCache = { value: access_token, expiresAt: Date.now() + (expires_in - 60) * 1000 }
  return access_token
}

export async function listSharePointFiles(): Promise<SharePointFile[]> {
  const token      = await getAccessToken()
  const siteUrl    = process.env.SP_SITE_URL!
  const folderPath = process.env.SP_FOLDER_PATH!

  const encodedPath = folderPath.replace(/ /g, '%20')
  const apiUrl = `${siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodedPath}')/Files` +
    `?$select=Name,Length,ServerRelativeUrl&$orderby=Name&$top=500`

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json;odata=verbose',
    },
  })

  if (!res.ok) throw new Error(`SP REST ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const files: SharePointFile[] = []

  for (const item of data.d?.results ?? []) {
    if (!item.Name?.toLowerCase().endsWith('.zip')) continue
    const parsed = parseFileName(item.Name)
    if (!parsed) continue
    files.push({
      name:              item.Name,
      serverRelativeUrl: item.ServerRelativeUrl,
      size:              parseInt(item.Length ?? '0', 10),
      ...parsed,
    })
  }

  return files.sort((a, b) => a.farmName.localeCompare(b.farmName, 'pt-BR'))
}

export async function fetchSharePointFile(serverRelativeUrl: string): Promise<Response> {
  const token   = await getAccessToken()
  const siteUrl = process.env.SP_SITE_URL!
  const encoded = serverRelativeUrl.replace(/ /g, '%20')

  return fetch(`${siteUrl}/_api/web/GetFileByServerRelativeUrl('${encoded}')/$value`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}
