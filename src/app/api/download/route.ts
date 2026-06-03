import { NextRequest, NextResponse } from 'next/server'
import { fetchSharePointFile } from '@/lib/sharepoint'

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')
  if (!path) {
    return NextResponse.json({ error: 'path obrigatório' }, { status: 400 })
  }

  try {
    const spRes = await fetchSharePointFile(path)
    if (!spRes.ok) {
      return NextResponse.json({ error: 'Arquivo não encontrado no SharePoint' }, { status: 404 })
    }

    const filename = path.split('/').pop() ?? 'arquivo.zip'
    const headers = new Headers({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    })
    const contentLength = spRes.headers.get('Content-Length')
    if (contentLength) headers.set('Content-Length', contentLength)

    return new NextResponse(spRes.body, { headers })
  } catch (error) {
    console.error('[/api/download]', error)
    return NextResponse.json({ error: 'Erro ao baixar arquivo' }, { status: 500 })
  }
}
