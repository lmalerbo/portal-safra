import { readdirSync, statSync } from 'fs'
import { join } from 'path'

export interface ProjectFile {
  name: string
  size: number
  farmCode: string
  farmName: string
  lineType: '1L' | '2L'
}

function parseFileName(name: string): Omit<ProjectFile, 'name' | 'size'> | null {
  const m = name.match(/^(\d+)_(.+?)_Exp([12])L\.zip$/i)
  if (!m) return null
  return { farmCode: m[1], farmName: m[2], lineType: `${m[3]}L` as '1L' | '2L' }
}

export function listProjectFiles(): ProjectFile[] {
  const dir = process.env.FILES_PATH!
  const files: ProjectFile[] = []

  for (const name of readdirSync(dir)) {
    if (!name.toLowerCase().endsWith('.zip')) continue
    const parsed = parseFileName(name)
    if (!parsed) continue
    const { size } = statSync(join(dir, name))
    files.push({ name, size, ...parsed })
  }

  return files.sort((a, b) => a.farmName.localeCompare(b.farmName, 'pt-BR'))
}
