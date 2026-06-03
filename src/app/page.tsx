'use client'

import { useEffect, useMemo, useState } from 'react'

interface ProjectFile {
  name: string
  size: number
  downloadUrl: string
  farmCode: string
  farmName: string
  lineType: '1L' | '2L'
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}


export default function Home() {
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFarms, setSelectedFarms] = useState<Set<string>>(new Set())
  const [lineType, setLineType] = useState<'all' | '1L' | '2L'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/files.json')
      .then((r) => r.json())
      .then((data) => {
        setFiles(Array.isArray(data) ? data : data.files ?? [])
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const farms = useMemo(() => {
    const map = new Map<string, string>()
    files.forEach((f) => map.set(f.farmCode, f.farmName))
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [files])

  const filteredFarms = useMemo(() => {
    if (!search) return farms
    const q = search.toLowerCase()
    return farms.filter(([code, name]) =>
      name.toLowerCase().includes(q) || code.includes(q)
    )
  }, [farms, search])

  const results = useMemo(() => {
    return files.filter((f) => {
      if (selectedFarms.size > 0 && !selectedFarms.has(f.farmCode)) return false
      if (lineType !== 'all' && f.lineType !== lineType) return false
      return true
    })
  }, [files, selectedFarms, lineType])


  const toggleFarm = (code: string) =>
    setSelectedFarms((prev) => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })

  const selectAllVisible = () =>
    setSelectedFarms((prev) => new Set([...prev, ...filteredFarms.map(([c]) => c)]))

  const clearAll = () => setSelectedFarms(new Set())

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-green-700 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
            <svg className="w-6 h-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold leading-tight">Portal Safra</h1>
            <p className="text-green-200 text-xs">Projetos de Colheita</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        {loading && (
          <div className="flex items-center justify-center py-24 gap-3 text-gray-500">
            <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
            <span>Carregando projetos...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 flex gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col md:flex-row gap-6">
            {/* Sidebar filtros */}
            <aside className="w-full md:w-72 flex-shrink-0">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sticky top-4">
                <h2 className="font-semibold text-gray-800 mb-5 text-sm uppercase tracking-wide">Filtros</h2>

                {/* Tipo de Linha */}
                <div className="mb-6">
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Tipo de Linha</p>
                  <div className="flex gap-2">
                    {(['all', '1L', '2L'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setLineType(v)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                          lineType === v
                            ? v === '1L'
                              ? 'bg-green-600 text-white border-green-600'
                              : v === '2L'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-gray-700 text-white border-gray-700'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {v === 'all' ? 'Todos' : v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fazendas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fazendas</p>
                    <div className="flex gap-2 text-xs">
                      <button onClick={selectAllVisible} className="text-green-600 hover:text-green-800 font-medium">
                        Todas
                      </button>
                      <span className="text-gray-300">|</span>
                      <button onClick={clearAll} className="text-gray-400 hover:text-gray-600">
                        Limpar
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Buscar por nome ou código..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                  />

                  <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                    {filteredFarms.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">Nenhuma fazenda encontrada</p>
                    )}
                    {filteredFarms.map(([code, name]) => (
                      <label key={code} className="flex items-start gap-2.5 cursor-pointer group py-1">
                        <input
                          type="checkbox"
                          checked={selectedFarms.has(code)}
                          onChange={() => toggleFarm(code)}
                          className="mt-0.5 accent-green-600 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700 leading-tight group-hover:text-gray-900">
                          {name}
                        </span>
                      </label>
                    ))}
                  </div>

                  {selectedFarms.size > 0 && (
                    <p className="text-xs text-green-600 mt-3 font-medium">
                      {selectedFarms.size} fazenda{selectedFarms.size !== 1 ? 's' : ''} selecionada{selectedFarms.size !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            </aside>

            {/* Resultados */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                  {results.length === 0 ? (
                    'Nenhum arquivo encontrado'
                  ) : (
                    <>
                      <span className="font-semibold text-gray-800">{results.length}</span>{' '}
                      arquivo{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                    </>
                  )}
                </p>
              </div>

              {results.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <p className="text-sm">
                    {files.length === 0
                      ? 'Nenhum projeto disponível no SharePoint.'
                      : 'Selecione uma fazenda nos filtros para ver os projetos.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((file) => (
                    <div
                      key={file.serverRelativeUrl}
                      className="bg-white rounded-xl border border-gray-100 px-4 py-3.5 flex items-center gap-4 hover:border-green-200 hover:shadow-sm transition-all"
                    >
                      {/* Ícone ZIP */}
                      <div className="w-9 h-9 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              file.lineType === '1L'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {file.lineType}
                          </span>
                          <span className="text-xs text-gray-400">{file.farmCode}</span>
                        </div>
                        <p className="font-medium text-gray-800 text-sm truncate">{file.farmName}</p>
                        <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
                      </div>

                      {/* Download */}
                      <a
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        download={file.name}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-xs text-gray-400 border-t border-gray-100">
        Portal Safra — Projetos de Colheita
      </footer>
    </div>
  )
}
