'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface ProjectFile {
  name: string
  size: number
  downloadUrl: string
  farmCode: string
  farmName: string
  lineType: '1L' | '2L'
  updatedAt: string
  dwgName?: string
  dwgUrl?: string
  dwgSize?: number
  mapaName?: string
  mapaUrl?: string
}

interface BlocoFile {
  cods: string[]
  farmNames: string[]
  lineType: '1L' | '2L'
  name: string
  size: number
  downloadUrl: string
  updatedAt: string
  dwgName?: string
  dwgUrl?: string
  dwgSize?: number
  mapas: { cod: string; farmName: string; name: string; url: string }[]
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
const ASSET_NAME_RE = /^(\d+)_(.+)_Exp(1L|2L)\.(zip|dwg)$/i
// Projeto Personalizado (bloco de 2+ fazendas que compartilham o mesmo arquivo de
// exportação): nome sem fazenda no meio, ex "10471+10476_Exp1L.dwg" — o mesmo
// arquivo é enviado duplicado para o release de cada fazenda do bloco.
const BLOCO_NAME_RE = /^(\d+(?:\+\d+)+)_Exp(1L|2L)\.(zip|dwg)$/i
// Mapa em PDF da fazenda (um por fazenda, nao por linha), ex "10738_SAO.PEDRO.9_Exp.Mapa.pdf"
const MAPA_NAME_RE = /^(\d+)_(.+)_Exp\.Mapa\.pdf$/i
const DWG_STORAGE_KEY = 'portal-safra-dwg'

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

function parseReleases(releases: any[]): { files: ProjectFile[]; blocoFiles: BlocoFile[] } {
  const fileMap = new Map<string, ProjectFile>()
  const blocoMap = new Map<string, BlocoFile>()
  const realNames = new Map<string, string>()
  const mapaMap = new Map<string, { name: string; url: string }>()

  for (const release of releases) {
    for (const asset of release.assets ?? []) {
      const m0 = asset.name.match(MAPA_NAME_RE)
      if (m0) {
        const [, farmCode] = m0
        mapaMap.set(farmCode, { name: asset.name, url: asset.browser_download_url })
        continue
      }

      const m1 = asset.name.match(ASSET_NAME_RE)
      if (m1) {
        const [, farmCode, rawName, lineTypeRaw, ext] = m1
        const lineType = lineTypeRaw.toUpperCase() as '1L' | '2L'
        const farmName = rawName.replace(/\./g, ' ')
        realNames.set(farmCode, farmName)
        const key = `${farmCode}_${lineType}`
        const entry: ProjectFile = fileMap.get(key) ?? {
          name: '',
          size: 0,
          downloadUrl: '',
          farmCode,
          farmName,
          lineType,
          updatedAt: asset.updated_at,
        }
        if (ext.toLowerCase() === 'zip') {
          entry.name = asset.name
          entry.size = asset.size
          entry.downloadUrl = asset.browser_download_url
        } else {
          entry.dwgName = asset.name
          entry.dwgUrl = asset.browser_download_url
          entry.dwgSize = asset.size
        }
        if (asset.updated_at > entry.updatedAt) entry.updatedAt = asset.updated_at
        fileMap.set(key, entry)
        continue
      }

      const m2 = asset.name.match(BLOCO_NAME_RE)
      if (m2) {
        const [, codsRaw, lineTypeRaw, ext] = m2
        const cods = codsRaw.split('+')
        const lineType = lineTypeRaw.toUpperCase() as '1L' | '2L'
        const key = `${codsRaw}_${lineType}`
        const entry: BlocoFile = blocoMap.get(key) ?? {
          cods,
          farmNames: [],
          mapas: [],
          lineType,
          name: '',
          size: 0,
          downloadUrl: '',
          updatedAt: asset.updated_at,
        }
        if (ext.toLowerCase() === 'zip') {
          entry.name = asset.name
          entry.size = asset.size
          entry.downloadUrl = asset.browser_download_url
        } else {
          entry.dwgName = asset.name
          entry.dwgUrl = asset.browser_download_url
          entry.dwgSize = asset.size
        }
        if (asset.updated_at > entry.updatedAt) entry.updatedAt = asset.updated_at
        blocoMap.set(key, entry)
      }
    }
  }

  const files = [...fileMap.values()]
    .filter((f) => f.downloadUrl)
    .map((f) => {
      const mapa = mapaMap.get(f.farmCode)
      return mapa ? { ...f, mapaName: mapa.name, mapaUrl: mapa.url } : f
    })
  const blocoFiles = [...blocoMap.values()]
    .filter((b) => b.downloadUrl)
    .map((b) => ({
      ...b,
      farmNames: b.cods.map((c) => realNames.get(c) ?? c),
      mapas: b.cods
        .filter((c) => mapaMap.has(c))
        .map((c) => ({ cod: c, farmName: realNames.get(c) ?? c, ...mapaMap.get(c)! })),
    }))
  return { files, blocoFiles }
}

export default function Home() {
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [blocoFiles, setBlocoFiles] = useState<BlocoFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lineFilter, setLineFilter] = useState<'all' | '1L' | '2L'>('all')
  const [showDwg, setShowDwg] = useState(false)
  const footerTaps = useRef({ count: 0, timer: null as ReturnType<typeof setTimeout> | null })

  useEffect(() => {
    fetchAllReleases()
      .then((releases) => {
        const { files, blocoFiles } = parseReleases(releases)
        setFiles(files)
        setBlocoFiles(blocoFiles)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setShowDwg(localStorage.getItem(DWG_STORAGE_KEY) === '1')
  }, [])

  // Toque 5x no rodapé em até 1.5s para alternar o modo técnico (mostra .dwg)
  const handleFooterTap = () => {
    const taps = footerTaps.current
    taps.count += 1
    if (taps.timer) clearTimeout(taps.timer)
    taps.timer = setTimeout(() => {
      taps.count = 0
    }, 1500)
    if (taps.count >= 5) {
      taps.count = 0
      setShowDwg((prev) => {
        const next = !prev
        localStorage.setItem(DWG_STORAGE_KEY, next ? '1' : '0')
        return next
      })
    }
  }

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

  const blocoResults = useMemo(() => {
    if (!search) return []
    const q = search.toLowerCase()
    return blocoFiles
      .filter((b) => b.cods.some((c, i) => c.includes(q) || b.farmNames[i].toLowerCase().includes(q)))
      .sort((a, b) => a.lineType.localeCompare(b.lineType))
  }, [blocoFiles, search])

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

            <div className="relative">
              <input
                type="text"
                autoFocus
                inputMode="search"
                placeholder="Buscar por nome ou código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-base border border-gray-200 rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpar busca"
                  title="Limpar busca"
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

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
                    {results.length === 0 && blocoResults.length === 0 ? (
                      'Nenhum projeto encontrado'
                    ) : (
                      <>
                        <span className="font-semibold text-gray-800">{results.length + blocoResults.length}</span>{' '}
                        arquivo{results.length + blocoResults.length !== 1 ? 's' : ''} encontrado
                        {results.length + blocoResults.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </p>

                  {selected.size > 1 && (
                    <button
                      type="button"
                      onClick={downloadAll}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
                  <div className="flex gap-1.5 mb-3 md:hidden">
                    {(['all', '1L', '2L'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setLineFilter(v)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                          lineFilter === v
                            ? 'bg-gray-700 text-white border-gray-700'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        {v === 'all' ? 'Todos' : v}
                      </button>
                    ))}
                  </div>
                )}

                {results.length === 0 && blocoResults.length === 0 ? (
                  <div className="bg-gray-50 rounded-2xl border border-gray-100 py-16 text-center text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <p className="text-sm">Nenhum projeto disponível para essa busca.</p>
                    <a
                      href={`https://wa.me/5516996427394?text=${encodeURIComponent(
                        `Olá! Gostaria de solicitar a disponibilização do projeto de colheita para a fazenda "${search}", que ainda não está disponível no Portal Safra.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-green-700 hover:text-green-800 underline"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-1.888-.95-3.13-1.696-4.378-3.85-.27-.448.27-.421.772-1.401.099-.198.05-.371-.075-.521-.123-.151-.6-1.443-.823-1.992-.218-.535-.44-.46-.6-.47-.149-.01-.32-.01-.494-.01-.174 0-.457.065-.697.315-.24.249-.916.892-.916 2.18 0 1.282 1.038 2.522 1.183 2.696.149.173 2.04 3.116 4.948 4.245 2.91 1.129 2.91.752 3.435.706.525-.049 1.692-.692 1.93-1.36.24-.668.24-1.242.166-1.36-.074-.123-.273-.198-.572-.348z" />
                        <path d="M12 0C5.376 0 0 5.376 0 12c0 2.12.554 4.108 1.52 5.84L0 24l6.32-1.49A11.93 11.93 0 0012 24c6.624 0 12-5.376 12-12S18.624 0 12 0zm0 21.81c-2.063 0-4.025-.59-5.71-1.643l-.41-.255-4.227 1 .997-4.116-.27-.43A9.78 9.78 0 012.19 12c0-5.413 4.397-9.81 9.81-9.81 5.413 0 9.81 4.397 9.81 9.81 0 5.413-4.397 9.81-9.81 9.81z" />
                      </svg>
                      Solicitar este projeto pelo WhatsApp
                    </a>
                  </div>
                ) : (
                  <>
                    {results.length > 0 && (
                      <>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1 mb-2">Padrão</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Coluna 1L */}
                          <div className={`space-y-2 ${lineFilter === '2L' ? 'hidden md:block' : ''}`}>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">1 Linha</p>
                            {oneLine.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-6">Nenhum projeto de 1 Linha</p>
                            ) : (
                              oneLine.map((file) => (
                                <FileCard
                                  key={file.name}
                                  file={file}
                                  checked={selected.has(fileKey(file))}
                                  onToggle={() => toggleSelect(fileKey(file))}
                                  showDwg={showDwg}
                                />
                              ))
                            )}
                          </div>

                          {/* Coluna 2L */}
                          <div className={`space-y-2 ${lineFilter === '1L' ? 'hidden md:block' : ''}`}>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">2 Linha</p>
                            {twoLine.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-6">Nenhum projeto de 2 Linha</p>
                            ) : (
                              twoLine.map((file) => (
                                <FileCard
                                  key={file.name}
                                  file={file}
                                  checked={selected.has(fileKey(file))}
                                  onToggle={() => toggleSelect(fileKey(file))}
                                  showDwg={showDwg}
                                />
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {blocoResults.length > 0 && (
                      <div className={results.length > 0 ? 'mt-6' : ''}>
                        <p className="text-xs font-medium text-amber-600 uppercase tracking-wide px-1 mb-2">
                          Personalizado
                        </p>
                        <div className="space-y-2">
                          {blocoResults.map((bloco) => (
                            <BlocoCard
                              key={`${bloco.cods.join('+')}_${bloco.lineType}`}
                              bloco={bloco}
                              showDwg={showDwg}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <footer
        onClick={handleFooterTap}
        className="text-center py-4 text-xs text-gray-400 border-t border-gray-100 select-none"
      >
        Portal Safra — Projetos de Colheita
      </footer>
    </div>
  )
}

function FileCard({
  file,
  checked,
  onToggle,
  showDwg,
}: {
  file: ProjectFile
  checked: boolean
  onToggle: () => void
  showDwg: boolean
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
        {file.mapaUrl && (
          <p className="text-xs text-indigo-600 font-medium mt-0.5 flex items-center gap-2">
            <span>🗺️ Mapa</span>
            <a href={file.mapaUrl} target="_blank" rel="noreferrer" className="underline hover:text-indigo-800">
              Ver
            </a>
            <a
              href={file.mapaUrl}
              download={file.mapaName}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-indigo-800"
            >
              Baixar
            </a>
          </p>
        )}
      </div>

      {/* Download DWG (modo tecnico) */}
      {showDwg && file.dwgUrl && (
        <a
          href={file.dwgUrl}
          target="_blank"
          rel="noreferrer"
          download={file.dwgName}
          className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 rounded-lg transition-colors text-[10px] font-bold"
          title="Download DWG"
        >
          DWG
        </a>
      )}

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

function BlocoCard({ bloco, showDwg }: { bloco: BlocoFile; showDwg: boolean }) {
  return (
    <div className="bg-amber-50 rounded-xl border border-amber-200 px-3 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              bloco.lineType === '1L' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}
          >
            {bloco.lineType}
          </span>
          <span className="text-xs font-medium text-amber-700">🔗 Projeto Personalizado</span>
        </div>
        <p className="font-medium text-gray-800 text-sm leading-snug">
          {bloco.cods.map((c, i) => `${c} ${bloco.farmNames[i]}`).join(' + ')}
        </p>
        <p className="text-xs text-gray-400">
          {formatSize(bloco.size)} · atualizado em {formatDate(bloco.updatedAt)}
        </p>
        {bloco.mapas.map((mapa) => (
          <p key={mapa.cod} className="text-xs text-indigo-600 font-medium mt-0.5 flex items-center gap-2">
            <span>🗺️ Mapa {mapa.cod}</span>
            <a href={mapa.url} target="_blank" rel="noreferrer" className="underline hover:text-indigo-800">
              Ver
            </a>
            <a
              href={mapa.url}
              download={mapa.name}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-indigo-800"
            >
              Baixar
            </a>
          </p>
        ))}
      </div>

      {/* Download DWG (modo tecnico) */}
      {showDwg && bloco.dwgUrl && (
        <a
          href={bloco.dwgUrl}
          target="_blank"
          rel="noreferrer"
          download={bloco.dwgName}
          className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 rounded-lg transition-colors text-[10px] font-bold"
          title="Download DWG"
        >
          DWG
        </a>
      )}

      {/* Download */}
      <a
        href={bloco.downloadUrl}
        target="_blank"
        rel="noreferrer"
        download={bloco.name}
        className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg transition-colors"
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
