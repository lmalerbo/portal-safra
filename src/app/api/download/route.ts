import { NextRequest, NextResponse } from 'next/server'
import { createReadStream, existsSync, statSync } from 'fs'
import { join, basename } from 'path'
import { Readable } from 'stream'

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('file') ?? ''
  const safe = basename(name)

  if (!safe.toLowerCase().endsWith('.zip') || safe !== name) {
    return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 })
  }

  const filePath = join(process.env.FILES_PATH!, safe)
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
  }

  const { size } = statSync(filePath)
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safe}"`,
      'Content-Length': String(size),
    },
  })
}
