'use client'

import { useEffect, useMemo, useState } from 'react'

interface ProjectFile {
  name: string
  size: number
  downloadUrl: string
  farmCode: string
  farmName: string
  lineType: '1L' | '2L'
  updatedAt: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function fileKey(f: ProjectFile): string {
  return `${f.farmCode}_${f.lineType}`
}

const RELEASES_REPO = 'lmalerbo/Expo_safra'
const ASSET_NAME_RE = /^(\d+)_(.+)_Exp(1L|2L)\.zip$/i

function parseLinkHeader(header: string | null): Record<string, string> {
  const links: Record<string, string> = {}
  if (!header) return links
  for (const part of header.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/)
    if (match) links[match[2]] = match[1]
  }
  return links
}

async function fetchAllReleases(): Promise<any[]> {
  const releases: any[] = []
  let url: string | undefined = `https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=100`
  while (url) {
    const res: Response = await fetch(url)
    if (!res.ok) throw new Error(`Falha ao buscar releases (${res.status})`)
    releases.push(...(await res.json()))
    url = parseLinkHeader(res.headers.get('Link')).next
  }
  return releases
}

function releasesToFiles(releases: any[]): ProjectFile[] {
  const files: ProjectFile[] = []
  for (const release of releases) {
    for (const asset of release.assets ?? []) {
      const match = asset.name.match(ASSET_NAME_RE)
      if (!match) continue
      const [, farmCode, rawName, lineType] = match
      files.push({
        name: asset.name,
        size: asset.size,
        downloadUrl: asset.browser_download_url,
        farmCode,
        farmName: rawName.replace(/\./g, ' '),
        lineType: lineType.toUpperCase() as '1L' | '2L',
        updatedAt: asset.updated_at,
      })
    }
  }
  return files
}

export default function Home() {
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lineFilter, setLineFilter] = useState<'all' | '1L' | '2L'>('all')

  useEffect(() => {
    fetchAllReleases()
      .then((releases) => setFiles(releasesToFiles(releases)))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const results = useMemo(() => {
    if (!search) return files
    const q = search.toLowerCase()
    return files.filter(
      (f) => f.farmName.toLowerCase().includes(q) || f.farmCode.includes(q)
    )
  }, [files, search])

  const oneLine = useMemo(
    () => results.filter((f) => f.lineType === '1L').sort((a, b) => a.farmName.localeCompare(b.farmName, 'pt-BR')),
    [results]
  )
  const twoLine = useMemo(
    () => results.filter((f) => f.lineType === '2L').sort((a, b) => a.farmName.localeCompare(b.farmName, 'pt-BR')),
    [results]
  )

  const toggleSelect = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const downloadAll = () => {
    const toDownload = files.filter((f) => selected.has(fileKey(f)))
    for (const f of toDownload) {
      const a = document.createElement('a')
      a.href = f.downloadUrl
      a.download = f.name
      a.target = '_blank'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }

  const farmsSummary = useMemo(() => {
    const farms = new Map<string, { name: string; updatedAt: string }>()
    for (const f of files) {
      const current = farms.get(f.farmCode)
      if (!current || f.updatedAt > current.updatedAt) {
        farms.set(f.farmCode, { name: f.farmName, updatedAt: f.updatedAt })
      }
    }
    const list = [...farms.values()]
    const lastUpdated = list.reduce(
      (max, f) => (f.updatedAt > max ? f.updatedAt : max),
      list[0]?.updatedAt ?? ''
    )
    const recent = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
    return { total: list.length, lastUpdated, recent }
  }, [files])

  const showResults = search.length > 0

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-green-700 text-white shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
            <svg className="w-5 h-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-bold leading-tight">Portal Safra</h1>
            <p className="text-green-200 text-xs">Projetos de Colheita</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-3 sm:px-4 py-4 sm:py-10">
        <div className="w-full max-w-3xl">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-center text-base sm:text-lg font-semibold text-gray-800 mb-1">
              Buscar projeto de colheita
            </h2>
            <p className="text-center text-xs sm:text-sm text-gray-400 mb-4 sm:mb-5">
              Pesquise pelo nome ou código da fazenda
            </p>

            <input
              type="text"
              autoFocus
              inputMode="search"
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-base border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
            />

            {!loading && !error && files.length > 0 && (
              <p className="text-center text-xs text-gray-400 mt-3">
                <span className="font-medium text-gray-500">{farmsSummary.total}</span> fazenda
                {farmsSummary.total !== 1 ? 's' : ''} disponíve
                {farmsSummary.total !== 1 ? 'is' : 'l'} · atualizado em{' '}
                {formatDate(farmsSummary.lastUpdated)}
              </p>
            )}

            {!loading && !error && !showResults && farmsSummary.recent.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide text-center mb-2">
                  Atualizados recentemente
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {farmsSummary.recent.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => setSearch(f.name)}
                      className="text-xs font-medium text-gray-600 bg-gray-50 hover:bg-green-50 hover:text-green-700 border border-gray-200 hover:border-green-200 rounded-full px-3 py-1.5 transition-colors"
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-10 gap-3 text-gray-500">
                <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                <span>Carregando projetos...</span>
              </div>
            )}

            {error && (
              <div className="mt-5 bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 flex gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {!loading && !error && showResults && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-5 mb-3">
                  <p className="text-sm text-gray-500">
                    {results.length === 0 ? (
                      'Nenhum projeto encontrado'
                    ) : (
                      <>
                        <span className="font-semibold text-gray-800">{results.length}</span>{' '}
                        arquivo{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </p>

                  {selected.size > 1 && (
                    <button
                      type="button"
                      onClick={downloadAll}
                      className="hidden sm:inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Baixar selecionados ({selected.size})
                    </button>
                  )}
                </div>

                {/* Filtro de linha (mobile) */}
                {results.length > 0 && (
                  <div className="flex gap-2 mb-3 md:hidden">
                    {(['all', '1L', '2L'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setLineFilter(v)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                          lineFilter === v
                            ? 'bg-gray-700 text-white border-gray-700'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        {v === 'all' ? 'Todos' : v === '1L' ? 'Linha 1' : 'Linha 2'}
                      </button>
                    ))}
                  </div>
                )}

                {results.length === 0 ? (
                  <div className="bg-gray-50 rounded-2xl border border-gray-100 py-16 text-center text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <p className="text-sm">Nenhum projeto disponível para essa busca.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Coluna 1L */}
                    <div className={`space-y-2 ${lineFilter === '2L' ? 'hidden md:block' : ''}`}>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">Linha 1</p>
                      {oneLine.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-6">Nenhum projeto de Linha 1</p>
                      ) : (
                        oneLine.map((file) => (
                          <FileCard
                            key={file.name}
                            file={file}
                            checked={selected.has(fileKey(file))}
                            onToggle={() => toggleSelect(fileKey(file))}
                          />
                        ))
                      )}
                    </div>

                    {/* Coluna 2L */}
                    <div className={`space-y-2 ${lineFilter === '1L' ? 'hidden md:block' : ''}`}>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">Linha 2</p>
                      {twoLine.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-6">Nenhum projeto de Linha 2</p>
                      ) : (
                        twoLine.map((file) => (
                          <FileCard
                            key={file.name}
                            file={file}
                            checked={selected.has(fileKey(file))}
                            onToggle={() => toggleSelect(fileKey(file))}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Barra fixa de download em lote (mobile) */}
      {selected.size > 1 && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 p-3 bg-white border-t border-gray-200 shadow-lg">
          <button
            type="button"
            onClick={downloadAll}
            className="w-full inline-flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-medium px-4 py-3 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Baixar selecionados ({selected.size})
          </button>
        </div>
      )}

      <footer className={`text-center py-4 text-xs text-gray-400 border-t border-gray-100 ${selected.size > 1 ? 'pb-20 sm:pb-4' : ''}`}>
        Portal Safra — Projetos de Colheita
      </footer>
    </div>
  )
}

function FileCard({
  file,
  checked,
  onToggle,
}: {
  file: ProjectFile
  checked: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={`bg-white rounded-xl border px-3 py-3 flex items-center gap-3 transition-all ${
        checked ? 'border-green-300 ring-1 ring-green-200' : 'border-gray-100 hover:border-green-200 hover:shadow-sm'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        title={`Selecionar ${file.farmName} ${file.lineType}`}
        aria-label={`Selecionar ${file.farmName} ${file.lineType}`}
        className="w-5 h-5 accent-green-600 cursor-pointer flex-shrink-0"
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              file.lineType === '1L' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}
          >
            {file.lineType}
          </span>
          <span className="text-xs text-gray-400">{file.farmCode}</span>
        </div>
        <p className="font-medium text-gray-800 text-sm leading-snug">{file.farmName}</p>
        <p className="text-xs text-gray-400">
          {formatSize(file.size)} · atualizado em {formatDate(file.updatedAt)}
        </p>
      </div>

      {/* Download */}
      <a
        href={file.downloadUrl}
        target="_blank"
        rel="noreferrer"
        download={file.name}
        className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-lg transition-colors"
        title="Download"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </a>
    </div>
  )
}
