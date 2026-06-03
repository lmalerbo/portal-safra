import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync } from 'fs'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const { files } = await request.json()
    if (!Array.isArray(files)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }
    writeFileSync(join(process.cwd(), 'data', 'files.json'), JSON.stringify(files, null, 2))
    return NextResponse.json({ ok: true, count: files.length })
  } catch {
    return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 })
  }
}
