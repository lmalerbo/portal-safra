import { NextResponse } from 'next/server'
import { listProjectFiles } from '@/lib/sharepoint'

export const revalidate = 0

export async function GET() {
  try {
    const files = listProjectFiles()
    return NextResponse.json({ files })
  } catch (err) {
    console.error('[/api/files]', err)
    return NextResponse.json(
      { error: 'Não foi possível ler a pasta de projetos. Verifique FILES_PATH no .env.local.' },
      { status: 500 }
    )
  }
}
