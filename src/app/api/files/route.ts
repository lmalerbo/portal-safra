import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const raw = readFileSync(join(process.cwd(), 'data', 'files.json'), 'utf-8')
    const files = JSON.parse(raw)
    return NextResponse.json({ files })
  } catch {
    return NextResponse.json({ files: [] })
  }
}
