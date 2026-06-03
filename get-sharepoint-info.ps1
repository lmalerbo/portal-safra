# Script para descobrir o ID do site SharePoint
# Execute: powershell -ExecutionPolicy Bypass -File get-sharepoint-info.ps1

$envFile = Join-Path $PSScriptRoot ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "ERRO: .env.local nao encontrado!" -ForegroundColor Red
    exit 1
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+)$') {
        $vars[$matches[1]] = $matches[2].Trim()
    }
}

$tenantId     = $vars['AZURE_TENANT_ID']
$clientId     = $vars['AZURE_CLIENT_ID']
$clientSecret = $vars['AZURE_CLIENT_SECRET']

Write-Host "`nObtendo token de acesso Azure..." -ForegroundColor Cyan

$tokenResp = Invoke-RestMethod -Method Post `
    -Uri "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token" `
    -Body @{
        grant_type    = "client_credentials"
        client_id     = $clientId
        client_secret = $clientSecret
        scope         = "https://graph.microsoft.com/.default"
    }

$headers = @{ Authorization = "Bearer $($tokenResp.access_token)" }
Write-Host "Token OK!" -ForegroundColor Green

Write-Host "`nListando sites SharePoint acessiveis..." -ForegroundColor Cyan

try {
    $sites = Invoke-RestMethod -Uri "https://graph.microsoft.com/v1.0/sites?search=*" -Headers $headers
    Write-Host "`n===== SITES ENCONTRADOS =====" -ForegroundColor Green
    foreach ($site in $sites.value) {
        Write-Host "`n  Nome : $($site.displayName)"
        Write-Host "  URL  : $($site.webUrl)"
        Write-Host "  ID   : " -NoNewline
        Write-Host $site.id -ForegroundColor Yellow
    }
} catch {
    Write-Host "Nao foi possivel listar sites automaticamente." -ForegroundColor Yellow
    Write-Host "Informe a URL do site SharePoint onde os arquivos estao:"
    $siteUrl = Read-Host "URL (ex: https://empresa.sharepoint.com/sites/projetos)"

    $uri  = [Uri]$siteUrl
    $host = $uri.Host
    $path = $uri.AbsolutePath
    $site = Invoke-RestMethod -Uri "https://graph.microsoft.com/v1.0/sites/${host}:${path}" -Headers $headers

    Write-Host "`n  Nome : $($site.displayName)"
    Write-Host "  ID   : " -NoNewline
    Write-Host $site.id -ForegroundColor Yellow
}

Write-Host "`n==============================" -ForegroundColor Green
Write-Host "Copie o ID acima e cole no .env.local em SHAREPOINT_SITE_ID=" -ForegroundColor Cyan
Write-Host ""
Read-Host "Pressione Enter para sair"
