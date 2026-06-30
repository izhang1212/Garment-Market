import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import PriceChart from '../components/PriceChart'

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--field)', borderTopColor: 'transparent' }}
      />
      <p className="eyebrow">Loading market data…</p>
    </div>
  )
}

function HotDrops({ trending }) {
  const rowRef = useRef()
  const scroll = dir => rowRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' })

  return (
    <div className="container-gm" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow mb-2">TRENDING NOW</p>
          <p className="display-lg">hot drops.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '0.25rem' }}>
          <button onClick={() => scroll(-1)} className="btn btn-ghost" style={{ padding: '0.6rem 0.9rem' }}>←</button>
          <button onClick={() => scroll(1)}  className="btn btn-ghost" style={{ padding: '0.6rem 0.9rem' }}>→</button>
        </div>
      </div>
      <div className="carousel-row" ref={rowRef}>
        {trending.map(item => (
          <Link
            key={item.sku}
            to={`/items/${encodeURIComponent(item.sku)}`}
            className="carousel-card"
          >
            <div
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                background: 'var(--muted)',
                borderRadius: 'var(--radius)',
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                marginBottom: '0.25rem',
              }}
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '0.5rem' }}
                />
              ) : (
                <span className="eyebrow">—</span>
              )}
            </div>
            <p className="eyebrow truncate">{item.brand}</p>
            <p className="product-name line-clamp-2" style={{ fontSize: '0.85rem' }}>{item.name}</p>
            <div className="product-price">
              <span className="product-price-val">${item.last_price.toFixed(0)}</span>
              <span
                className="eyebrow"
                style={{ color: item.delta_pct >= 0 ? 'var(--field)' : 'var(--down)' }}
              >
                {item.delta_pct >= 0 ? '+' : ''}{item.delta_pct}%
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function fmtPct(n) {
  if (n == null) return '—'
  return (n * 100).toFixed(0) + '%'
}
function fmtDollar(n) {
  if (n == null) return '—'
  return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2)
}

export default function Home() {
  const [data,     setData]     = useState(null)
  const [stats,    setStats]    = useState(null)
  const [trending, setTrending] = useState([])
  const [feed,     setFeed]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const fetchAll = useCallback(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch('/api/items/popular').then(r => {
        if (!r.ok) throw new Error('No items with sufficient data. Run the backend with a KicksDB key first.')
        return r.json()
      }),
      fetch('/api/stats').then(r => r.json()).catch(() => null),
      fetch('/api/items/trending?limit=6').then(r => r.json()).catch(() => []),
      fetch('/api/items/recent-feed?limit=8').then(r => r.json()).catch(() => []),
    ])
      .then(([popular, statsData, trendingData, feedData]) => {
        setData(popular)
        setStats(statsData)
        setTrending(trendingData || [])
        setFeed(feedData || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const prices = data?.transactions?.map(t => t.price) ?? []
  const ev = data?.ev_model ?? {}

  return (
    <div>
      {/* Hero */}
      <div className="container-gm" style={{ paddingTop: '4rem', paddingBottom: '3rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3rem', alignItems: 'start' }}>
          {/* Left: title + description + buttons */}
          <div>
            <p className="eyebrow mb-4">LIVE MARKET · EST. 2026</p>
            <h1 className="display-xl mb-5" style={{ lineHeight: 1 }}>
              <span style={{ color: 'var(--ink)' }}>garment</span>{' '}
              <span style={{ color: 'var(--field)' }}>market</span>
              <span style={{ color: 'var(--ink)' }}>.</span>
            </h1>
            <p
              className="text-lg leading-relaxed mb-6"
              style={{ color: 'var(--muted-foreground)' }}
            >
              algorithmic market-making for streetwear.
              live bid and ask prices from avellaneda–stoikov and ev models.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link to="/about"  className="btn btn-ghost">READ METHODOLOGY</Link>
              <Link to="/search" className="btn btn-field">OPEN MARKET →</Link>
            </div>
          </div>

          {/* Right: stats */}
          <div style={{ display: 'grid', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', minWidth: '220px' }}>
            <div className="stat-cell">
              <span className="stat-label">Universe</span>
              <span className="stat-value">950K+</span>
            </div>
            {stats && (
              <div className="stat-cell">
                <span className="stat-label">Transactions</span>
                <span className="stat-value">{stats.transaction_count.toLocaleString()}</span>
              </div>
            )}
            {stats && (
              <div className="stat-cell">
                <span className="stat-label">Total Volume</span>
                <span className="stat-value">${(stats.total_volume / 1000).toFixed(1)}K</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Featured quote card */}
      <div className="container-gm" style={{ paddingBottom: '4rem' }}>
        {loading && <Spinner />}

        {!loading && error && (
          <div className="surface surface-pad flex flex-col items-center py-16 gap-2">
            <p className="eyebrow">Unavailable</p>
            <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)', maxWidth: '36rem' }}>
              {error}
            </p>
          </div>
        )}

        {!loading && !error && data && (
          <div className="quote-card">
            {/* Card header */}
            <div className="quote-card-header">
              <div className="flex items-center gap-4">
                <div className="quote-thumb">
                  {data.item.image_url ? (
                    <img
                      src={data.item.image_url}
                      alt={data.item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '0.5rem' }}
                    />
                  ) : (
                    <span className="eyebrow">—</span>
                  )}
                </div>
                <div>
                  <p className="eyebrow mb-1">
                    {data.item.brand}
                    {data.item.category ? ` · ${data.item.category}` : ''}
                    {data.item.size ? ` · Size ${data.item.size}` : ''}
                  </p>
                  <h2 className="font-semibold text-xl leading-tight" style={{ letterSpacing: '-0.01em' }}>
                    {data.item.name}
                  </h2>
                  <p className="font-mono text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {data.item.sku}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="eyebrow mb-1">Fair Value</p>
                <p className="quote-fv">${data.fair_value.toFixed(2)}</p>
              </div>
            </div>

            {/* Bid / Ask */}
            <div className="ba-grid">
              <div className="ba-cell">
                <span className="ba-label">Bid</span>
                <span className="ba-value ba-bid">${(ev.bid ?? data.decision?.recommended_bid ?? 0).toFixed(2)}</span>
                {ev.bid_fill_probability != null && (
                  <p className="ba-meta">
                    p(fill) {fmtPct(ev.bid_fill_probability)} · ev {fmtDollar(ev.bid_ev)}
                  </p>
                )}
              </div>
              <div className="ba-cell">
                <span className="ba-label">Ask</span>
                <span className="ba-value ba-ask">${(ev.ask ?? data.decision?.recommended_ask ?? 0).toFixed(2)}</span>
                {ev.ask_fill_probability != null && (
                  <p className="ba-meta">
                    p(fill) {fmtPct(ev.ask_fill_probability)} · ev {fmtDollar(ev.ask_ev)}
                  </p>
                )}
              </div>
            </div>

            {/* Chart */}
            <div className="chart-frame">
              <PriceChart transactions={data.transactions} height={280} />
            </div>

            {/* 4-stat strip */}
            <div className="stat-strip">
              <div className="stat-cell">
                <span className="stat-label">SKU</span>
                <span className="stat-value-sm font-mono">{data.item.sku}</span>
              </div>
              <div className="stat-cell">
                <span className="stat-label">Data Points</span>
                <span className="stat-value">{data.transactions.length}</span>
              </div>
              <div className="stat-cell">
                <span className="stat-label">Price Range</span>
                <span className="stat-value-sm">
                  {prices.length
                    ? `$${Math.min(...prices).toFixed(0)} – $${Math.max(...prices).toFixed(0)}`
                    : '—'}
                </span>
              </div>
              <div className="stat-cell">
                <span className="stat-label">Volatility Σ</span>
                <span className="stat-value-sm">
                  {ev.volatility != null ? `$${ev.volatility.toFixed(2)}` : '—'}
                </span>
              </div>
            </div>

            {/* Analyse CTA */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border)' }}>
              <Link
                to={`/items/${encodeURIComponent(data.item.sku)}`}
                className="btn btn-field"
                style={{ fontSize: '0.72rem', letterSpacing: '0.12em', padding: '0.5rem 1.1rem' }}
              >
                ANALYSE →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Hot drops carousel */}
      {trending.length > 0 && (
        <HotDrops trending={trending} />
      )}

      {/* Live quotes + Today */}
      {(feed.length > 0 || stats) && (
        <div className="container-gm" style={{ paddingBottom: '5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'stretch' }}>

            {/* Live quotes feed */}
            {feed.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <p className="eyebrow mb-2">RECENT FEED</p>
                <p className="display-lg mb-4">live quotes.</p>
                <div className="feed" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {feed.map((row, i) => (
                    <div
                      key={i}
                      className="feed-row"
                      style={{ flex: 1, alignItems: 'center' }}
                    >
                      <span
                        className="feed-side-bid"
                        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.1em' }}
                      >
                        {row.source?.toUpperCase() || 'TX'}
                      </span>
                      <span className="truncate" style={{ fontSize: '0.82rem', color: 'var(--foreground)' }}>
                        {row.name || row.sku}
                      </span>
                      <span style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace" }}>
                        {row.sku}
                      </span>
                      <span className="font-bold" style={{ color: 'var(--field)' }}>
                        ${row.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Today stats panel */}
            {stats && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <p className="eyebrow mb-2">MARKET PULSE</p>
                <p className="display-lg mb-4">today.</p>
                <div className="surface" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {[
                    {
                      label: 'TOTAL VOLUME',
                      value: `$${(stats.total_volume / 1000).toFixed(1)}K`,
                      chip: 'ALL-TIME',
                    },
                    {
                      label: 'TRANSACTIONS',
                      value: stats.transaction_count.toLocaleString(),
                      chip: stats.transactions_24h > 0 ? `+${stats.transactions_24h} TODAY` : 'INDEXED',
                    },
                    {
                      label: 'UNIVERSE',
                      value: '950K+',
                      chip: 'VIA KICKSDB',
                    },
                    {
                      label: 'DATA REFRESH',
                      value: '~12s',
                      chip: 'LIVE',
                    },
                  ].map((row, i, arr) => (
                    <div
                      key={row.label}
                      style={{
                        flex: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        padding: '1rem 1.5rem',
                        borderBottom: i < arr.length - 1 ? '1px dashed var(--border)' : 'none',
                      }}
                    >
                      <span className="eyebrow" style={{ alignSelf: 'flex-end', paddingBottom: '0.1rem' }}>{row.label}</span>
                      <div style={{ textAlign: 'right' }}>
                        <p className="stat-value" style={{ lineHeight: 1.1 }}>{row.value}</p>
                        <span className="delta-chip">{row.chip}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
