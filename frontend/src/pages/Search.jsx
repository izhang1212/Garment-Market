import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

// ── Constants ──────────────────────────────────────────────────────────────────

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

const CLOTHING_TYPES = ['sneakers', 'streetwear', 'accessories', 'collectibles']

const SIZING_BY_TYPE = {
  sneakers: [
    { label: 'SIZING · SNEAKERS (US)', key: 'shoe_us', options: ['6', '7', '8', '9', '10', '11', '12', '13', '14'] },
    { label: 'SIZING · SNEAKERS (EU)', key: 'shoe_eu', options: ['39', '40', '41', '42', '43', '44', '45', '46'] },
    { label: 'SIZING · SNEAKERS (CM)', key: 'shoe_cm', options: ['24', '25', '26', '27', '28', '29', '30'] },
  ],
  streetwear: [
    { label: 'SIZING · TOPS',                key: 'top_size',   options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
    { label: 'SIZING · TOPS (ASIA)',          key: 'top_asia',   options: ['SS', 'S', 'M', 'L', 'LL', '3L'] },
    { label: 'SIZING · BOTTOMS',             key: 'pant_size',  options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
    { label: 'SIZING · BOTTOMS (WAIST IN)',  key: 'pant_waist', options: ['28', '30', '32', '34', '36', '38', '40'] },
    { label: 'SIZING · BOTTOMS (ASIA)',      key: 'pant_asia',  options: ['S', 'M', 'L', 'LL', '3L'] },
    { label: 'SIZING · OUTERWEAR',           key: 'outer_size', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
    { label: 'SIZING · OUTERWEAR (EU)',      key: 'outer_eu',   options: ['44', '46', '48', '50', '52', '54', '56'] },
    { label: 'SIZING · OUTERWEAR (ASIA)',    key: 'outer_asia', options: ['SS', 'S', 'M', 'L', 'LL', '3L'] },
  ],
  accessories: [
    { label: 'SIZING · HEADWEAR', key: 'hat_size',   options: ['one size', 'S/M', 'L/XL'] },
    { label: 'SIZING · FITTED',   key: 'hat_fitted', options: ['7', '7 1/8', '7 1/4', '7 3/8', '7 1/2', '7 5/8'] },
  ],
  collectibles: [],
}

const PRICE_MAX_CAP = 2000

// ── Checkbox row ──────────────────────────────────────────────────────────────

function CheckOption({ label, checked, onChange }) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        cursor: 'pointer', padding: '0.5rem 0.65rem',
        border: '1px solid',
        borderColor: checked ? 'var(--field)' : 'var(--border)',
        borderRadius: 'var(--radius)',
        background: checked
          ? 'color-mix(in oklab, var(--field) 10%, transparent)'
          : 'var(--card)',
        transition: 'background .15s, border-color .15s',
      }}
    >
      <span
        style={{
          width: '1rem', height: '1rem', flexShrink: 0,
          borderRadius: '4px',
          border: `1.5px solid ${checked ? 'var(--field)' : 'var(--muted-foreground)'}`,
          background: checked ? 'var(--field)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--primary-foreground)',
          fontSize: '0.65rem', fontWeight: 700,
          transition: 'background .15s, border-color .15s',
        }}
      >
        {checked ? '✓' : ''}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.78rem',
        letterSpacing: '0.04em',
        color: 'var(--foreground)',
      }}>
        {label}
      </span>
    </label>
  )
}

// ── Price range slider ────────────────────────────────────────────────────────

function PriceRangeFilter({ min, max, onChange }) {
  const trackRef = useRef(null)
  const draggingRef = useRef(null)
  const [loInput, setLoInput] = useState(String(min))
  const [hiInput, setHiInput] = useState(String(max === 0 ? PRICE_MAX_CAP : max))

  const hi = max === 0 ? PRICE_MAX_CAP : max

  useEffect(() => { setLoInput(String(min)) }, [min])
  useEffect(() => { setHiInput(String(max === 0 ? PRICE_MAX_CAP : max)) }, [max])

  const pct = v => ((v) / PRICE_MAX_CAP) * 100

  const valueFromClientX = useCallback(clientX => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return Math.round((ratio * PRICE_MAX_CAP) / 10) * 10
  }, [])

  useEffect(() => {
    const move = e => {
      if (!draggingRef.current) return
      const cx = e.touches ? e.touches[0].clientX : e.clientX
      const v = valueFromClientX(cx)
      if (draggingRef.current === 'lo') onChange(Math.min(v, hi - 10), hi === PRICE_MAX_CAP ? 0 : hi)
      else {
        const newHi = Math.max(v, min + 10)
        onChange(min, newHi >= PRICE_MAX_CAP ? 0 : newHi)
      }
    }
    const up = () => { draggingRef.current = null }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
    }
  }, [min, hi, onChange, valueFromClientX])

  const commitLo = () => {
    const n = Math.max(0, Math.min(Number(loInput) || 0, hi - 10))
    onChange(n, max)
    setLoInput(String(n))
  }
  const commitHi = () => {
    const n = Math.min(PRICE_MAX_CAP, Math.max(Number(hiInput) || PRICE_MAX_CAP, min + 10))
    onChange(min, n >= PRICE_MAX_CAP ? 0 : n)
    setHiInput(String(n))
  }

  const inp = {
    width: '100%', background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '0.55rem 0.7rem',
    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem',
    color: 'var(--foreground)', outline: 'none',
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.4rem' }}>
        <div>
          <p style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--muted-foreground)', marginBottom: '0.3rem',
          }}>MIN $</p>
          <input
            value={loInput}
            onChange={e => setLoInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={commitLo}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
            style={inp}
          />
        </div>
        <div>
          <p style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--muted-foreground)', marginBottom: '0.3rem',
          }}>MAX $</p>
          <input
            value={hiInput}
            onChange={e => setHiInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={commitHi}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
            style={inp}
          />
        </div>
      </div>

      <div
        ref={trackRef}
        style={{ position: 'relative', height: '2.25rem', userSelect: 'none', touchAction: 'none' }}
      >
        {/* base track */}
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          height: '4px', transform: 'translateY(-50%)',
          background: 'var(--border)', borderRadius: '999px',
        }} />
        {/* selected range */}
        <div style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          left: `${pct(min)}%`, right: `${100 - pct(hi)}%`,
          height: '4px', background: 'var(--field)', borderRadius: '999px',
        }} />
        {/* handles */}
        {[['lo', min], ['hi', hi]].map(([h, v]) => (
          <div
            key={h}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={PRICE_MAX_CAP}
            aria-valuenow={v}
            onMouseDown={e => { e.preventDefault(); draggingRef.current = h }}
            onTouchStart={() => { draggingRef.current = h }}
            style={{
              position: 'absolute', top: '50%', left: `${pct(v)}%`,
              transform: 'translate(-50%, -50%)',
              width: '1.1rem', height: '1.1rem', borderRadius: '999px',
              background: 'var(--background)', border: '2px solid var(--field)',
              cursor: 'grab', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              zIndex: 1,
            }}
          />
        ))}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem',
        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem',
        letterSpacing: '0.12em', color: 'var(--muted-foreground)',
      }}>
        <span>$0</span>
        <span>${PRICE_MAX_CAP}+</span>
      </div>
    </div>
  )
}

// ── Filter section wrapper ─────────────────────────────────────────────────────

function FilterSection({ label, children }) {
  return (
    <div style={{ padding: '1.25rem 0', borderBottom: '1px solid var(--border)' }}>
      <p style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase',
        color: 'var(--muted-foreground)', marginBottom: '0.75rem',
      }}>
        {label}
      </p>
      {children}
    </div>
  )
}

// ── Filter panel ──────────────────────────────────────────────────────────────

function FilterPanel({ open, onClose, onApply, initialFilters }) {
  const [types, setTypes]         = useState(new Set(initialFilters.types))
  const [sizes, setSizes]         = useState({ ...initialFilters.sizes })
  const [brands, setBrands]       = useState(new Set(initialFilters.brands))
  const [priceMin, setPriceMin]   = useState(initialFilters.priceMin)
  const [priceMax, setPriceMax]   = useState(initialFilters.priceMax)

  // Sync draft when panel opens
  useEffect(() => {
    if (open) {
      setTypes(new Set(initialFilters.types))
      setSizes({ ...initialFilters.sizes })
      setBrands(new Set(initialFilters.brands))
      setPriceMin(initialFilters.priceMin)
      setPriceMax(initialFilters.priceMax)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleType = t => setTypes(prev => {
    const next = new Set(prev)
    if (next.has(t)) {
      next.delete(t)
      // clear sizes for this type
      setSizes(s => {
        const n = { ...s }
        const groups = SIZING_BY_TYPE[t] || []
        groups.forEach(g => delete n[g.key])
        return n
      })
    } else { next.add(t) }
    return next
  })

  const toggleSize = (key, opt) => setSizes(prev => {
    const cur = prev[key] || ''
    return { ...prev, [key]: cur === opt ? '' : opt }
  })

  const toggleBrand = b => setBrands(prev => {
    const next = new Set(prev)
    if (next.has(b)) next.delete(b); else next.add(b)
    return next
  })

  const clearAll = () => {
    setTypes(new Set())
    setSizes({})
    setBrands(new Set())
    setPriceMin(0)
    setPriceMax(0)
  }

  const activeTypes = Array.from(types)
  const sizingGroups = activeTypes.flatMap(t => SIZING_BY_TYPE[t] || [])

  const totalSelected = types.size + Object.values(sizes).filter(Boolean).length
    + brands.size + (priceMin > 0 || priceMax > 0 ? 1 : 0)

  const handleApply = () => {
    // Extract first selected size from any group
    const sizeVal = Object.values(sizes).find(v => v) || 'all'
    onApply({
      types: Array.from(types),
      sizes,
      brands: Array.from(brands),
      priceMin,
      priceMax,
      size: sizeVal,
    })
    onClose()
  }

  const panelStyle = {
    position: 'fixed', top: 0, left: 0, bottom: 0,
    width: 'min(420px, 92vw)', background: 'var(--background)',
    borderRight: '1px solid var(--border)', zIndex: 90,
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 0 60px rgba(0,0,0,0.3)',
    transform: open ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
            zIndex: 80,
          }}
        />
      )}

      {/* Panel */}
      <aside style={panelStyle}>
        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.4rem 1.5rem', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div>
            <p style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem',
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: 'var(--muted-foreground)', marginBottom: '0.25rem',
            }}>REFINE</p>
            <h2 style={{ fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.04em', lineHeight: 1 }}>
              filters<span style={{ color: 'var(--field)' }}>.</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close filters"
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '0.5rem 0.6rem',
              color: 'var(--foreground)', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </header>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem' }}>

          {/* Clothing type */}
          <FilterSection label="CLOTHING TYPE">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {CLOTHING_TYPES.map(t => (
                <CheckOption
                  key={t}
                  label={t}
                  checked={types.has(t)}
                  onChange={() => toggleType(t)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Sizing — dynamic based on selected types */}
          <FilterSection label="SIZING">
            {sizingGroups.length === 0 ? (
              <p style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.72rem', color: 'var(--muted-foreground)',
                padding: '0.75rem 0.85rem', border: '1px dashed var(--border)',
                borderRadius: 'var(--radius)', lineHeight: 1.5,
              }}>
                select a clothing type to load size charts.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {sizingGroups.map(group => (
                  <div key={group.key}>
                    <p style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.62rem', letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'var(--muted-foreground)',
                      marginBottom: '0.5rem',
                    }}>
                      {group.label}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {group.options.map(opt => {
                        const sel = sizes[group.key] === opt
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleSize(group.key, opt)}
                            style={{
                              padding: '0.35rem 0.7rem',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '0.75rem', letterSpacing: '0.04em',
                              border: '1px solid',
                              borderColor: sel ? 'var(--field)' : 'var(--border)',
                              borderRadius: 'var(--radius)',
                              background: sel
                                ? 'color-mix(in oklab, var(--field) 10%, transparent)'
                                : 'var(--card)',
                              color: sel ? 'var(--field)' : 'var(--foreground)',
                              cursor: 'pointer',
                              fontWeight: sel ? 700 : 400,
                              transition: 'background .15s, border-color .15s',
                            }}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FilterSection>

          {/* Brand */}
          <FilterSection label="BRAND">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {BRANDS.map(b => (
                <CheckOption
                  key={b}
                  label={b}
                  checked={brands.has(b)}
                  onChange={() => toggleBrand(b)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Price range */}
          <FilterSection label="PRICE RANGE">
            <PriceRangeFilter
              min={priceMin}
              max={priceMax}
              onChange={(lo, hi) => { setPriceMin(lo); setPriceMax(hi) }}
            />
          </FilterSection>

        </div>

        {/* Footer */}
        <footer style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem',
          padding: '1rem 1.5rem', borderTop: '1px solid var(--border)',
          background: 'var(--card)', flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={clearAll}
            style={{
              padding: '0.85rem 1rem', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
              letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600,
              color: 'var(--foreground)', cursor: 'pointer',
            }}
          >
            CLEAR
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{
              padding: '0.85rem 1rem', background: 'var(--field)',
              color: 'var(--primary-foreground)', border: 'none',
              borderRadius: 'var(--radius)',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
              letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            APPLY{totalSelected > 0 ? ` · ${totalSelected}` : ''}
          </button>
        </footer>
      </aside>
    </>
  )
}

// ── Result card ────────────────────────────────────────────────────────────────

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

function MetaTag({ label, value }) {
  if (!value) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.6rem',
      border: '1px solid var(--border)',
      borderRadius: '999px',
      background: 'var(--card)',
    }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.62rem', letterSpacing: '0.1em',
        color: 'var(--muted-foreground)', textTransform: 'lowercase',
      }}>
        {label} ·
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em',
        color: 'var(--foreground)', textTransform: 'lowercase',
      }}>
        {value}
      </span>
    </span>
  )
}

function ResultCard({ item, onClick, appliedSize = 'all' }) {
  const displaySize = (item.size && item.size !== 'all') ? item.size : appliedSize

  return (
    <button onClick={() => onClick(item.sku)} className="product-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>

        {/* Thumbnail */}
        <div style={{
          width: '5rem', height: '5rem', flexShrink: 0,
          background: 'var(--muted)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          display: 'grid', placeItems: 'center',
          overflow: 'hidden',
        }}>
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '0.4rem' }}
            />
          ) : (
            <span className="eyebrow">—</span>
          )}
        </div>

        {/* Text block */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <p className="product-name" style={{ lineHeight: 1.2 }}>{item.name || item.sku}</p>
          <p className="product-sku">{item.sku}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
            <MetaTag label="type"  value={item.category} />
            <MetaTag label="brand" value={item.brand} />
            <MetaTag label="size"  value={displaySize} />
          </div>
        </div>

        <ChevronRight />
      </div>
    </button>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()

  const initialQuery     = searchParams.get('q') || ''
  const initialInventory = parseInt(searchParams.get('inventory') || '0', 10)
  const initialSize      = searchParams.get('size') || 'all'
  const initialCategory  = searchParams.get('category') || ''
  const initialBrand     = searchParams.get('brand') || ''
  const initialPriceMin  = parseFloat(searchParams.get('price_min') || '0')
  const initialPriceMax  = parseFloat(searchParams.get('price_max') || '0')

  const [query,       setQuery]       = useState(initialQuery)
  const [inventory,   setInventory]   = useState(initialInventory)
  const [results,     setResults]     = useState([])
  const [page,        setPage]        = useState(1)
  const [hasMore,     setHasMore]     = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searched,    setSearched]    = useState(false)
  const [stats,       setStats]       = useState(null)
  const [trending,    setTrending]    = useState([])
  const [filterOpen,  setFilterOpen]  = useState(false)

  // Applied filter state (from URL)
  const [appliedTypes,    setAppliedTypes]    = useState(initialCategory ? initialCategory.split(',') : [])
  const [appliedSizes,    setAppliedSizes]    = useState({})
  const [appliedBrands,   setAppliedBrands]   = useState(initialBrand ? initialBrand.split(',') : [])
  const [appliedPriceMin, setAppliedPriceMin] = useState(initialPriceMin)
  const [appliedPriceMax, setAppliedPriceMax] = useState(initialPriceMax)
  const [appliedSize,     setAppliedSize]     = useState(initialSize)

  const navigate  = useNavigate()
  const inputRef  = useRef()

  const totalApplied = appliedTypes.length + appliedBrands.length
    + (appliedSize !== 'all' ? 1 : 0) + (appliedPriceMin > 0 || appliedPriceMax > 0 ? 1 : 0)

  const buildSearchURL = (q, pg, { size = 'all', category = '', brand = '', priceMin = 0, priceMax = 0 } = {}) => {
    const p = new URLSearchParams({ q: encodeURIComponent(q), page: pg })
    if (size && size !== 'all') p.set('size', size)
    if (category) p.set('category', category)
    if (brand) p.set('brand', brand)
    if (priceMin > 0) p.set('price_min', String(priceMin))
    if (priceMax > 0) p.set('price_max', String(priceMax))
    return `/api/search?${p}`
  }

  const doSearch = (pageNum, append = false, overrideQuery = null, filters = null) => {
    const setter = append ? setLoadingMore : setLoading
    setter(true)
    const q = (overrideQuery ?? query).trim().toLowerCase()
    const f = filters ?? {
      size: appliedSize, category: appliedTypes.join(','),
      brand: appliedBrands.join(','), priceMin: appliedPriceMin, priceMax: appliedPriceMax,
    }
    fetch(buildSearchURL(q, pageNum, f))
      .then(r => r.json())
      .then(data => {
        const incoming = (data.results || []).filter(item => item.name?.trim() && item.sku?.trim())
        setResults(prev => append ? [...prev, ...incoming] : incoming)
        setHasMore(data.has_more ?? false)
        setPage(pageNum)
      })
      .catch(() => { if (!append) setResults([]) })
      .finally(() => setter(false))
  }

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => null)
    fetch('/api/items/trending?limit=6').then(r => r.json()).then(setTrending).catch(() => [])
    if (initialQuery) {
      setSearched(true)
      doSearch(1, false, initialQuery, {
        size: initialSize, category: initialCategory,
        brand: initialBrand, priceMin: initialPriceMin, priceMax: initialPriceMax,
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = () => {
    const q = query.trim().toLowerCase()
    if (!q) {
      setSearched(false)
      setResults([])
      setHasMore(false)
      setSearchParams({})
      return
    }
    const params = { q }
    if (inventory > 0) params.inventory = String(inventory)
    if (appliedSize !== 'all') params.size = appliedSize
    if (appliedTypes.length) params.category = appliedTypes.join(',')
    if (appliedBrands.length) params.brand = appliedBrands.join(',')
    if (appliedPriceMin > 0) params.price_min = String(appliedPriceMin)
    if (appliedPriceMax > 0) params.price_max = String(appliedPriceMax)
    setSearchParams(params)
    setSearched(true)
    doSearch(1, false)
  }

  const handleChipClick = chip => {
    setQuery(chip)
    setSearched(true)
    setSearchParams({ q: chip })
    setLoading(true)
    const q = chip.trim().toLowerCase()
    fetch(buildSearchURL(q, 1, {
      size: appliedSize, category: appliedTypes.join(','),
      brand: appliedBrands.join(','), priceMin: appliedPriceMin, priceMax: appliedPriceMax,
    }))
      .then(r => r.json())
      .then(data => {
        const incoming = (data.results || []).filter(item => item.name?.trim() && item.sku?.trim())
        setResults(incoming)
        setHasMore(data.has_more ?? false)
        setPage(1)
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }

  const handleItemClick = sku => {
    if (!sku?.trim()) return
    const params = new URLSearchParams()
    if (appliedSize !== 'all') params.set('size', appliedSize)
    if (inventory > 0) params.set('inventory', String(inventory))
    const qs = params.toString()
    navigate(`/items/${encodeURIComponent(sku.trim())}${qs ? `?${qs}` : ''}`)
  }

  const handleApplyFilters = ({ types, sizes, brands, priceMin, priceMax, size }) => {
    setAppliedTypes(types)
    setAppliedSizes(sizes)
    setAppliedBrands(brands)
    setAppliedPriceMin(priceMin)
    setAppliedPriceMax(priceMax)
    setAppliedSize(size)

    // Keep URL in sync so back-navigation restores the correct filter state
    if (query.trim()) {
      const params = { q: query.trim().toLowerCase() }
      if (inventory > 0)    params.inventory  = String(inventory)
      if (size !== 'all')   params.size       = size
      if (types.length)     params.category   = types.join(',')
      if (brands.length)    params.brand      = brands.join(',')
      if (priceMin > 0)     params.price_min  = String(priceMin)
      if (priceMax > 0)     params.price_max  = String(priceMax)
      setSearchParams(params)
    }

    const filters = {
      size, category: types.join(','),
      brand: brands.join(','), priceMin, priceMax,
    }
    if (searched && query.trim()) {
      doSearch(1, false, null, filters)
    }
  }

  const initialFilters = {
    types: appliedTypes,
    sizes: appliedSizes,
    brands: appliedBrands,
    priceMin: appliedPriceMin,
    priceMax: appliedPriceMax,
  }

  const showDefault = !searched && results.length === 0

  return (
    <div>
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={handleApplyFilters}
        initialFilters={initialFilters}
      />

      <div className="container-gm" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>

        {/* Big centered title */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p className="eyebrow mb-4">UNIVERSE · 950K+ ACTIVE SKUS</p>
          <h1 className="display-xl">search.</h1>
        </div>

        {/* Search bar */}
        <div style={{ maxWidth: '52rem', margin: '0 auto 1.5rem' }}>
          <div className="search-shell">

            {/* Filter button */}
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0 1.1rem',
                background: 'transparent',
                border: 'none', borderRight: '1px solid var(--border)',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: totalApplied > 0 ? 'var(--field)' : 'var(--foreground)',
                cursor: 'pointer', fontWeight: 600, flexShrink: 0,
                alignSelf: 'stretch',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
                <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
                <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
                <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
              </svg>
              FILTER
              {totalApplied > 0 && (
                <span style={{
                  background: 'var(--field)', color: 'var(--primary-foreground)',
                  borderRadius: '999px', padding: '0.1rem 0.45rem',
                  fontSize: '0.62rem', fontWeight: 700,
                }}>
                  {totalApplied}
                </span>
              )}
            </button>

            {/* GM / prefix */}
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.85rem', fontWeight: 600,
              letterSpacing: '0.08em', color: 'var(--field)',
              padding: '0 0.5rem 0 1rem', flexShrink: 0,
            }}>
              GM /
            </span>

            {/* Query input */}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              placeholder="dunk low panda, DD1391-100, samba og..."
              className="search-input"
            />

            {/* Inventory input */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              borderLeft: '1px solid var(--border)', flexShrink: 0,
              padding: '0 0.5rem 0 0.75rem',
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
                fontWeight: 600, letterSpacing: '0.08em',
                color: 'var(--muted-foreground)', whiteSpace: 'nowrap',
              }}>Q ·</span>
              <input
                type="number"
                min={0}
                value={inventory}
                onChange={e => setInventory(Math.max(0, parseInt(e.target.value, 10) || 0))}
                style={{
                  width: '3rem', background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem',
                  fontWeight: 600,
                  color: inventory > 0 ? 'var(--field)' : 'var(--muted-foreground)',
                  padding: '0.4rem 0.2rem', textAlign: 'center',
                }}
              />
            </div>

            {/* Search button */}
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
                <button key={chip} onClick={() => handleChipClick(chip)} className="chip">
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
                  <ResultCard key={`${item.sku}-${i}`} item={item} onClick={handleItemClick} appliedSize={appliedSize} />
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
                          width: '100%', textAlign: 'left',
                          background: 'none', border: 'none',
                          borderBottom: i < trending.length - 1 ? '1px solid var(--border)' : 'none',
                          padding: '0.9rem 1.25rem', cursor: 'pointer',
                          display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
                          gap: '1rem', alignItems: 'center',
                        }}
                      >
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
                          letterSpacing: '0.08em', color: 'var(--muted-foreground)', width: '1.5rem',
                        }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                          fontSize: '0.88rem', color: 'var(--foreground)',
                        }}>
                          {item.name}
                        </span>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem',
                          fontWeight: 600,
                          color: item.delta_pct >= 0 ? 'var(--field)' : 'var(--down)',
                          minWidth: '4rem', textAlign: 'right',
                        }}>
                          {item.delta_pct >= 0 ? '+' : ''}{item.delta_pct}%
                        </span>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem',
                          color: 'var(--muted-foreground)', whiteSpace: 'nowrap',
                        }}>
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
                      <button key={brand} onClick={() => handleChipClick(brand)} className="chip">
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
