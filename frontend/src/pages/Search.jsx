import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const SUGGESTED = [
  'dunk low panda',
  'new balance 550',
  'samba og',
  'jordan 1 lost & found',
  'yeezy 350 bone',
  'travis scott low',
]

const BRANDS = [
  'nike', 'adidas', 'jordan', 'new balance',
  'yeezy', 'asics', 'carhartt wip', 'supreme',
]

function ChevronRight() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={2}
      style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function ResultCard({ item, onClick }) {
  return (
    <button onClick={() => onClick(item.sku)} className="product-card">
      <div className="flex items-center gap-4">
        <div
          style={{
            width: '4rem', height: '4rem',
            background: 'var(--muted)',
            borderRadius: 'var(--radius)',
            display: 'grid', placeItems: 'center',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '0.375rem' }}
            />
          ) : (
            <span className="eyebrow">—</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="eyebrow truncate">
            {item.brand}{item.category ? ` · ${item.category}` : ''}
          </p>
          <p className="product-name mt-0.5 line-clamp-2">{item.name || item.sku}</p>
          <p className="product-sku mt-1">{item.sku}</p>
        </div>
        <ChevronRight />
      </div>
    </button>
  )
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  const [query,       setQuery]       = useState(initialQuery)
  const [results,     setResults]     = useState([])
  const [page,        setPage]        = useState(1)
  const [hasMore,     setHasMore]     = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searched,    setSearched]    = useState(false)
  const [stats,       setStats]       = useState(null)
  const [trending,    setTrending]    = useState([])

  const navigate = useNavigate()
  const inputRef = useRef()

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => null)
    fetch('/api/items/trending?limit=6').then(r => r.json()).then(setTrending).catch(() => [])
    if (initialQuery) { setSearched(true); doSearch(1, false, initialQuery) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const doSearch = (pageNum, append = false, overrideQuery = null) => {
    const setter = append ? setLoadingMore : setLoading
    setter(true)
    const q = (overrideQuery ?? query).trim().toLowerCase()
    fetch(`/api/search?q=${encodeURIComponent(q)}&page=${pageNum}`)
      .then(r => r.json())
      .then(data => {
        const incoming = (data.results || []).filter(
          item => item.name?.trim() && item.sku?.trim()
        )
        setResults(prev => append ? [...prev, ...incoming] : incoming)
        setHasMore(data.has_more ?? false)
        setPage(pageNum)
      })
      .catch(() => { if (!append) setResults([]) })
      .finally(() => setter(false))
  }

  const handleSubmit = () => {
    const q = query.trim().toLowerCase()
    if (!q) return
    setSearchParams({ q })
    setSearched(true)
    doSearch(1, false)
  }

  const handleChipClick = (chip) => {
    setQuery(chip)
    setSearchParams({ q: chip })
    setSearched(true)
    const q = chip.trim().toLowerCase()
    const setter = setLoading
    setter(true)
    fetch(`/api/search?q=${encodeURIComponent(q)}&page=1`)
      .then(r => r.json())
      .then(data => {
        const incoming = (data.results || []).filter(item => item.name?.trim() && item.sku?.trim())
        setResults(incoming)
        setHasMore(data.has_more ?? false)
        setPage(1)
      })
      .catch(() => setResults([]))
      .finally(() => setter(false))
  }

  const handleItemClick = sku => {
    if (!sku?.trim()) return
    navigate(`/items/${encodeURIComponent(sku.trim())}`)
  }

  const showDefault = !searched && results.length === 0

  return (
    <div>
      <div className="container-gm" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>

        {/* Big centered title */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p className="eyebrow mb-4">UNIVERSE · 950K+ ACTIVE SKUS</p>
          <h1 className="display-xl">search.</h1>
        </div>

        {/* Search bar with GM / prefix */}
        <div style={{ maxWidth: '52rem', margin: '0 auto 1.5rem' }}>
          <div className="search-shell">
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.85rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: 'var(--field)',
                padding: '0 0.5rem 0 1rem',
                flexShrink: 0,
              }}
            >
              GM /
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              placeholder="dunk low panda, DD1391-100, samba og..."
              className="search-input"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="btn btn-field"
              style={{ flexShrink: 0 }}
            >
              {loading ? (
                <div
                  className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'var(--primary-foreground)', borderTopColor: 'transparent' }}
                />
              ) : 'Search'}
            </button>
          </div>

          {/* Suggested chips */}
          {showDefault && (
            <div className="flex flex-wrap gap-2 mt-3">
              {SUGGESTED.map(chip => (
                <button
                  key={chip}
                  onClick={() => handleChipClick(chip)}
                  className="chip"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        {searched && (
          <div style={{ maxWidth: '52rem', margin: '0 auto' }}>
            {!loading && results.length === 0 && (
              <div className="surface surface-pad flex flex-col items-center py-16 gap-2">
                <p className="eyebrow">No results</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  No results found for &ldquo;{query}&rdquo;.
                </p>
              </div>
            )}
            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((item, i) => (
                  <ResultCard key={`${item.sku}-${i}`} item={item} onClick={handleItemClick} />
                ))}
                {hasMore && (
                  <button
                    onClick={() => doSearch(page + 1, true)}
                    disabled={loadingMore}
                    className="btn btn-ghost w-full mt-2"
                  >
                    {loadingMore ? (
                      <div
                        className="w-4 h-4 rounded-full border-2 animate-spin"
                        style={{ borderColor: 'var(--foreground)', borderTopColor: 'transparent' }}
                      />
                    ) : 'Show 10 more'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Default view: trending + brands */}
        {showDefault && (
          <div style={{ maxWidth: '52rem', margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'start' }}>

              {/* Trending list */}
              {trending.length > 0 && (
                <div>
                  <p className="eyebrow mb-2">MOVERS · 24H</p>
                  <p className="display-lg mb-4">trending.</p>
                  <div className="surface" style={{ overflow: 'hidden' }}>
                    {trending.map((item, i) => (
                      <button
                        key={item.sku}
                        onClick={() => handleItemClick(item.sku)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          borderBottom: i < trending.length - 1 ? '1px solid var(--border)' : 'none',
                          padding: '0.9rem 1.25rem',
                          cursor: 'pointer',
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr auto auto',
                          gap: '1rem',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '0.72rem',
                            letterSpacing: '0.08em',
                            color: 'var(--muted-foreground)',
                            width: '1.5rem',
                          }}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            color: 'var(--foreground)',
                          }}
                        >
                          {item.name}
                        </span>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: item.delta_pct >= 0 ? 'var(--field)' : 'var(--down)',
                            minWidth: '4rem',
                            textAlign: 'right',
                          }}
                        >
                          {item.delta_pct >= 0 ? '+' : ''}{item.delta_pct}%
                        </span>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '0.78rem',
                            color: 'var(--muted-foreground)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          analyse →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Brands */}
              <div>
                <p className="eyebrow mb-2">BROWSE</p>
                <p className="display-lg mb-4">brands.</p>
                <div className="surface surface-pad">
                  <div className="flex flex-wrap gap-2 mb-5">
                    {BRANDS.map(brand => (
                      <button
                        key={brand}
                        onClick={() => handleChipClick(brand)}
                        className="chip"
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                  <div className="stat-strip" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div className="stat-cell">
                      <span className="stat-label">Indexed</span>
                      <span className="stat-value">{stats ? stats.item_count.toLocaleString() : '—'}</span>
                    </div>
                    <div className="stat-cell">
                      <span className="stat-label">Updated</span>
                      <span className="stat-value">12s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
