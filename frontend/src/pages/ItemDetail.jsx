import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ComposedChart, Line, Area,
  XAxis, YAxis,
  CartesianGrid,
  ReferenceLine, ReferenceDot,
  ResponsiveContainer,
} from 'recharts'
import PriceChart from '../components/PriceChart'
import DecisionPanel from '../components/DecisionPanel'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function f(n, d = 2) {
  return n != null ? Number(n).toFixed(d) : '—'
}

// ── Dark code block ────────────────────────────────────────────────────────────

function Code({ label, lines }) {
  return (
    <div style={{
      background: 'var(--ink)', color: 'var(--bone)',
      borderRadius: 'var(--radius)',
      padding: '1.1rem 1.375rem',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.84rem',
      lineHeight: 1.8,
      marginBottom: '0.75rem',
    }}>
      {label && (
        <span style={{
          display: 'block', fontSize: '0.66rem', letterSpacing: '0.17em',
          textTransform: 'uppercase',
          color: 'oklch(0.68 0.008 90)',
          marginBottom: '0.7rem',
        }}>
          {label}
        </span>
      )}
      {lines.map((line, i) => {
        const isObj = typeof line === 'object' && line !== null
        return (
          <div key={i} style={{ color: isObj && line.green ? 'oklch(0.75 0.14 145)' : 'var(--bone)' }}>
            {isObj ? line.text : line}
          </div>
        )
      })}
    </div>
  )
}

// ── Step container ─────────────────────────────────────────────────────────────

function Step({ n, title, last, children }) {
  return (
    <div style={{
      borderBottom: last ? 'none' : '1px dashed var(--border)',
      paddingBottom: last ? 0 : '1.75rem',
      marginBottom: last ? 0 : '1.75rem',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '5.5rem 1fr',
        gap: '0.875rem',
        alignItems: 'start',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--field)',
          paddingTop: '0.05rem',
          letterSpacing: '0.04em',
        }}>
          step {String(n).padStart(2, '0')}
        </span>
        <div>
          <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.85rem', letterSpacing: '-0.01em' }}>
            {title}
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Fill-probability curve ─────────────────────────────────────────────────────

function FillProbChart({ fv, vol, bid, ask }) {
  const pts = 120
  const half = vol * 3.5
  const step = (half * 2) / pts
  const bandLow  = Math.min(bid, ask)
  const bandHigh = Math.max(bid, ask)

  // Build base grid, then inject exact bid/ask points so boundaries are crisp
  const gridPrices = Array.from({ length: pts + 1 }, (_, i) => fv - half + i * step)
  const allPrices  = [...new Set([...gridPrices, bid, ask].map(p => Math.round(p * 100) / 100))].sort((a, b) => a - b)

  const data = allPrices.map(price => {
    const p      = Math.exp(-Math.abs(price - fv) / vol)
    const inBand = price >= bandLow && price <= bandHigh
    return { price, p, pBand: inBand ? p : null }
  })

  const pBid = Math.exp(-Math.abs(bid - fv) / vol)
  const pAsk = Math.exp(-Math.abs(ask - fv) / vol)
  const MONO = "'JetBrains Mono', monospace"
  const GREEN = 'oklch(0.42 0.11 145)'
  const MUTED = 'var(--muted-foreground)'

  return (
    <div className="surface" style={{ padding: '1.1rem', marginBottom: '0.75rem' }}>
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={data} margin={{ top: 28, right: 24, left: -4, bottom: 28 }}>
          <defs>
            <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor={GREEN} stopOpacity={0.18} />
              <stop offset="100%" stopColor={GREEN} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="price"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={[Math.round(fv - half), Math.round(fv + half)]}
            tick={{ fontSize: 10, fill: MUTED, fontFamily: MONO }}
            tickFormatter={v => `$${v}`}
          />
          <YAxis
            domain={[0, 1.12]}
            tick={{ fontSize: 10, fill: MUTED, fontFamily: MONO }}
            tickFormatter={v => v.toFixed(1)}
            width={40}
          />

          {/* Shaded band: only between bid and ask */}
          <Area
            dataKey="pBand"
            stroke="none"
            fill="url(#bandGrad)"
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />

          {/* Full curve as a line (no fill) */}
          <Line
            dataKey="p"
            stroke={GREEN}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />

          {/* FV dashed vertical */}
          <ReferenceLine
            x={fv}
            stroke={MUTED}
            strokeDasharray="4 4"
            label={{ value: `μ = $${Math.round(fv)}`, position: 'top', fill: MUTED, fontSize: 10, fontFamily: MONO }}
          />

          {/* Bid drop line + price label */}
          <ReferenceLine
            x={bid}
            stroke={GREEN}
            strokeDasharray="3 3"
            strokeWidth={1.5}
            label={{ value: `bid  $${f(bid)}`, position: 'bottom', fill: MUTED, fontSize: 10, fontFamily: MONO }}
          />

          {/* Ask drop line + price label */}
          <ReferenceLine
            x={ask}
            stroke={GREEN}
            strokeDasharray="3 3"
            strokeWidth={1.5}
            label={{ value: `ask  $${f(ask)}`, position: 'bottom', fill: MUTED, fontSize: 10, fontFamily: MONO }}
          />

          {/* Dots at bid and ask on the curve */}
          <ReferenceDot x={bid} y={pBid} r={5} fill={GREEN} stroke="var(--card)" strokeWidth={2} />
          <ReferenceDot x={ask} y={pAsk} r={5} fill={GREEN} stroke="var(--card)" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── EV walkthrough ─────────────────────────────────────────────────────────────

function EVWalkthrough({ model: ev, inventory }) {
  const {
    fair_value: fv, volatility: vol, reservation_price: r,
    bid, ask,
    bid_fill_probability: pBid, ask_fill_probability: pAsk,
    bid_ev: evBid, ask_ev: evAsk,
  } = ev

  const ALPHA       = ev.inventory_alpha   ?? 0.01   // fraction of FV
  const penaltyUnit = ev.inventory_penalty ?? (ALPHA * fv)  // $/unit
  const Q           = inventory ?? 0
  const alphaPct    = (ALPHA * 100).toFixed(0)

  return (
    <div>
      <Step n={1} title="center quotes on the reservation price">
        <Code
          label="INVENTORY-ADJUSTED CENTER"
          lines={[
            'r = μ − (α · μ) · q',
            `penalty/unit = α · μ = ${alphaPct}% · ${f(fv)} = ${f(penaltyUnit)}`,
            { text: `r = ${f(fv)} − ${f(penaltyUnit)} · ${Q} = ${f(r)}`, green: true },
          ]}
        />
        <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', lineHeight: 1.65 }}>
          α = {alphaPct}% of fair value per unit held — scales with item price so a
          ${f(fv)} item costs ${f(penaltyUnit)} per unit of inventory.{' '}
          {Q === 0 ? 'No inventory — r equals μ exactly.' : 'Positive inventory pushes r below μ, biasing us to sell.'}
        </p>
      </Step>

      <Step n={2} title="price the fill-probability curve">
        <Code
          label="EXPONENTIAL DECAY AROUND μ"
          lines={['P(fill) = exp( −a · |quote − μ| / σ )']}
        />
        <FillProbChart fv={fv} vol={vol} bid={bid} ask={ask} />
        <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', lineHeight: 1.65 }}>
          σ = {f(vol)}. Every dollar away from μ reduces fill probability by e^(−1/σ) ≈ {f(Math.exp(-1 / vol), 3)}.
        </p>
      </Step>

      <Step n={3} title="independent bid · ask sweep">
        <Code
          label="ASYMMETRIC OPTIMISATION"
          lines={[
            'bid = r − m_bid · σ/2    →    argmax  EV_bid(m_bid)',
            'ask = r + m_ask · σ/2    →    argmax  EV_ask(m_ask)',
            { text: 'total EV★ = EV_bid★ + EV_ask★', green: true },
          ]}
        />
        {(() => {
          const bidC = ev.bid_candidates ?? []
          const askC = ev.ask_candidates ?? []
          const MID  = Math.floor((bidC.length || 5) / 2)
          if (!bidC.length && !askC.length) return null

          const SEP = '2px solid var(--border)'

          const TH = ({ children, sepLeft, sepRight, right }) => (
            <th style={{
              padding: '0.4rem 0.7rem',
              textAlign: right ? 'right' : 'left',
              color: 'var(--muted-foreground)', fontWeight: 400,
              letterSpacing: '0.06em', fontSize: '0.62rem', whiteSpace: 'nowrap',
              borderLeft:  sepLeft  ? SEP : undefined,
              borderRight: sepRight ? SEP : undefined,
            }}>{children}</th>
          )

          const TD = ({ children, isOpt, green, sepLeft, sepRight, right }) => (
            <td style={{
              padding: '0.4rem 0.7rem',
              textAlign: right ? 'right' : 'left',
              fontWeight: isOpt ? 700 : 400,
              color: (isOpt && green) ? 'var(--field)' : 'inherit',
              borderLeft:  sepLeft  ? SEP : undefined,
              borderRight: sepRight ? SEP : undefined,
            }}>{children}</td>
          )

          return (
            <div style={{ overflowX: 'auto', marginBottom: '0.75rem' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.74rem',
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* BID group */}
                    <TH>M_BID</TH>
                    <TH right>BID</TH>
                    <TH right>P(BID)</TH>
                    <TH right sepRight>EV_BID</TH>
                    {/* ASK group */}
                    <TH sepLeft>M_ASK</TH>
                    <TH right>ASK</TH>
                    <TH right>P(ASK)</TH>
                    <TH right sepRight>EV_ASK</TH>
                    {/* Total */}
                    <TH sepLeft right>TOTAL EV</TH>
                  </tr>
                </thead>
                <tbody>
                  {bidC.map((b, i) => {
                    const a      = askC[i] ?? {}
                    const isOpt  = i === MID
                    const bg     = isOpt ? 'color-mix(in oklab, var(--field) 8%, transparent)' : ''
                    const totalEV = (b.ev_bid ?? 0) + (a.ev_ask ?? 0)
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: bg }}>
                        <TD isOpt={isOpt}>{f(b.multiplier, 2)}×</TD>
                        <TD isOpt={isOpt} right>${f(b.bid)}</TD>
                        <TD isOpt={isOpt} right>{f(b.fill_prob, 3)}</TD>
                        <TD isOpt={isOpt} right sepRight>${f(b.ev_bid)}</TD>
                        <TD isOpt={isOpt} sepLeft>{f(a.multiplier, 2)}×</TD>
                        <TD isOpt={isOpt} right>${f(a.ask)}</TD>
                        <TD isOpt={isOpt} right>{f(a.fill_prob, 3)}</TD>
                        <TD isOpt={isOpt} right sepRight>${f(a.ev_ask)}</TD>
                        <TD isOpt={isOpt} green sepLeft right>${f(totalEV)}</TD>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })()}
      </Step>

      <Step n={4} title="ship the highest-ev quote" last>
        <div className="ba-grid">
          <div className="ba-cell">
            <span className="ba-label">BID · p(fill) {f(pBid, 3)} · ev +${f(evBid)}</span>
            <span className="ba-value ba-bid">${f(bid)}</span>
          </div>
          <div className="ba-cell">
            <span className="ba-label">ASK · p(fill) {f(pAsk, 3)} · ev +${f(evAsk)}</span>
            <span className="ba-value ba-ask">${f(ask)}</span>
          </div>
        </div>
      </Step>
    </div>
  )
}

// ── A-S walkthrough ────────────────────────────────────────────────────────────

function ASWalkthrough({ model: as_, inventory }) {
  const {
    fair_value: fv, volatility: vol,
    risk_aversion: gamma, time_horizon: T, liquidity: kappa,
    reservation_price: r, spread,
    bid, ask,
    bid_fill_probability: pBid, ask_fill_probability: pAsk,
    bid_ev: evBid, ask_ev: evAsk,
    risk_term, liq_term,
    n_trades, t_window_days,
  } = as_

  const Q = inventory ?? 0

  const halfSpread = f(spread / 2)

  return (
    <div>
      <Step n={1} title="estimate κ · liquidity from arrivals">
        <Code
          label="POISSON MLE"
          lines={[
            'κ = N_trades / T_window',
            { text: `κ = ${n_trades ?? '?'} trades / ${f(t_window_days, 1)} days = ${f(kappa, 4)} /day`, green: true },
          ]}
        />
        <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', lineHeight: 1.65 }}>
          κ is the Poisson arrival rate — how many orders land per day. A thin market (low κ) forces a wider spread in step 3.
        </p>
      </Step>

      <Step n={2} title="derive r · reservation price">
        <Code
          label="INVENTORY-AWARE CENTER"
          lines={[
            'r = μ − q · γ · σ² · T',
            `r = ${f(fv)} − ${Q} · ${f(gamma, 4)} · ${f(vol)}² · ${f(T, 1)}`,
            { text: `r = ${f(fv)} − ${f(Q * gamma * vol * vol * T)} = ${f(r)}`, green: true },
          ]}
        />
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.75rem',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '0.6rem 1rem',
          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.84rem',
          marginTop: '0.5rem',
        }}>
          <span style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>RESERVATION PRICE</span>
          <span style={{ fontWeight: 700, color: 'var(--field)' }}>${f(r)}</span>
        </div>
      </Step>

      <Step n={3} title="derive δ* · optimal spread (risk + liquidity)">
        <Code
          label="TWO-TERM DECOMPOSITION"
          lines={[
            'δ* = γσ²T + (2/γ) · ln(1 + γ/κ)',
            `risk  = ${f(gamma, 4)} · ${f(vol)}² · ${f(T, 1)} = ${f(risk_term)}`,
            `liq   = (2/${f(gamma, 4)}) · ln(1 + ${f(gamma, 4)}/${f(kappa, 4)}) = ${f(liq_term)}`,
            { text: `δ* = ${f(risk_term)} + ${f(liq_term)} = ${f(spread)}`, green: true },
          ]}
        />
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
          <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.7rem 1rem' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.66rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.3rem' }}>RISK TERM</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.95rem' }}>{f(risk_term)}</div>
          </div>
          <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.7rem 1rem' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.66rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.3rem' }}>LIQUIDITY TERM</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.95rem' }}>{f(liq_term)}</div>
          </div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.75rem',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '0.6rem 1rem',
          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.84rem',
          marginTop: '0.75rem',
        }}>
          <span style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>OPTIMAL SPREAD δ*</span>
          <span style={{ fontWeight: 700, color: 'var(--field)' }}>{f(spread)}</span>
        </div>
      </Step>

      <Step n={4} title="center the spread on r → bid / ask" last>
        <Code
          label=""
          lines={[
            `bid = r − δ*/2 = ${f(r)} − ${halfSpread} = ${f(bid)}`,
            { text: `ask = r + δ*/2 = ${f(r)} + ${halfSpread} = ${f(ask)}`, green: true },
          ]}
        />
        <div className="ba-grid">
          <div className="ba-cell">
            <span className="ba-label">BID · r − δ*/2</span>
            <span className="ba-value ba-bid">${f(bid)}</span>
          </div>
          <div className="ba-cell">
            <span className="ba-label">ASK · r + δ*/2</span>
            <span className="ba-value ba-ask">${f(ask)}</span>
          </div>
        </div>
      </Step>
    </div>
  )
}

// ── Walk-the-Math section ──────────────────────────────────────────────────────

function WalkMathSection({ data, inventory }) {
  const [tab, setTab] = useState('ev')
  const ev  = data.ev_model
  const as_ = data.as_model
  const bestMult = ev?.spread_multiplier != null ? f(ev.spread_multiplier, 1) : '—'
  const bestEV   = ev?.total_ev   != null ? f(ev.total_ev) : '—'

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p className="eyebrow mb-2">PICK A MODEL</p>
          <h2 className="display-lg">walk the math.</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '0.25rem' }}>
          {[
            { key: 'ev', label: '01 · EXPECTED VALUE' },
            { key: 'as', label: '02 · AVELLANEDA-STOIKOV' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                padding: '0.55rem 0.95rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                background: tab === key ? 'var(--ink)' : 'transparent',
                color: tab === key ? 'var(--bone)' : 'var(--muted-foreground)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Green rule */}
      <div style={{ height: '2px', background: 'var(--field)', marginBottom: '1.75rem' }} />

      {/* Content card */}
      <div className="surface surface-pad">
        {/* Badge + subtitle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span className="delta-chip" style={{ marginTop: 0 }}>
            {tab === 'ev' ? 'MODEL 01 · SIMULATE' : 'MODEL 02 · DERIVE'}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.73rem', color: 'var(--muted-foreground)' }}>
            {tab === 'ev'
              ? `best total ev → mult ${bestMult} · $${bestEV}`
              : 'closed-form hjb solution · no sweep'
            }
          </span>
        </div>

        {/* Model title */}
        <h3 className="font-bold text-xl mb-3" style={{ letterSpacing: '-0.02em' }}>
          {tab === 'ev'
            ? <>expected value — <span style={{ color: 'var(--field)' }}>sweep &amp; pick</span></>
            : <>avellaneda–stoikov — <span style={{ color: 'var(--field)' }}>derive &amp; ship</span></>
          }
        </h3>

        {/* Intro */}
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: '1.5rem' }}>
          {tab === 'ev'
            ? 'Walks a grid of candidate spreads, prices the fill-probability decay on each side, and picks the spread with the highest combined expected profit.'
            : 'Solves the inventory-aware market-making problem analytically. Estimate Poisson arrival rate κ from history, plug into closed-form reservation price and optimal spread, read off bid/ask.'
          }
        </p>

        {/* Dashed rule */}
        <div style={{ borderTop: '1px dashed var(--border)', marginBottom: '1.75rem' }} />

        {/* Steps */}
        {tab === 'ev' && ev && <EVWalkthrough model={ev} inventory={inventory} />}
        {tab === 'as' && as_ && <ASWalkthrough model={as_} inventory={inventory} />}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function ItemDetail() {
  const { sku }          = useParams()
  const navigate         = useNavigate()
  const [searchParams]   = useSearchParams()
  const size             = searchParams.get('size') || 'all'
  const inventory        = parseInt(searchParams.get('inventory') || '0', 10)
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [txPage,  setTxPage]  = useState(1)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ size, inventory: String(inventory) })
    fetch(`/api/items/${encodeURIComponent(sku)}/detail?${params}`)
      .then(r => {
        if (!r.ok) return r.json().then(e => { throw new Error(e.detail || 'Failed to load') })
        return r.json()
      })
      .then(d => { setData(d); setTxPage(1) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [sku, size, inventory])

  return (
    <div className="container-gm" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>

      {/* Back */}
      <button onClick={() => navigate(-1)} className="btn btn-ghost mb-8" style={{ gap: '0.4rem' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Loading */}
      {loading && (
        <div className="surface surface-pad flex flex-col items-center justify-center gap-4 py-24">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--field)', borderTopColor: 'transparent' }}
          />
          <div className="text-center">
            <p className="eyebrow">Fetching market data…</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Running both models — this takes a few seconds.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="surface surface-pad flex flex-col items-center justify-center gap-3 py-24">
          <p className="eyebrow">Error</p>
          <p className="font-semibold text-lg">Could not analyse this item</p>
          <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)', maxWidth: '36rem' }}>
            {error}
          </p>
          <button onClick={() => navigate(-1)} className="btn btn-ghost mt-4">Go back</button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && (
        <div className="space-y-5">

          {/* Item header card */}
          <div className="quote-card">
            <div className="quote-card-header">
              <div className="flex items-center gap-4">
                <div className="quote-thumb">
                  {data.item?.image_url ? (
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
                    {data.item?.brand}{data.item?.category ? ` · ${data.item.category}` : ''}
                  </p>
                  <h1 className="font-bold text-2xl" style={{ letterSpacing: '-0.02em' }}>
                    {data.item?.name || sku}
                  </h1>
                  <p className="font-mono text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {sku}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="eyebrow mb-1">Fair Value</p>
                <p className="quote-fv">
                  ${(data.ev_model?.fair_value ?? data.as_model?.fair_value ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="ba-grid">
              <div className="ba-cell">
                <span className="ba-label">Recommended Bid</span>
                <span className="ba-value ba-bid">${(data.decision?.recommended_bid ?? 0).toFixed(2)}</span>
              </div>
              <div className="ba-cell">
                <span className="ba-label">Recommended Ask</span>
                <span className="ba-value ba-ask">${(data.decision?.recommended_ask ?? 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Price chart */}
          {data.transactions?.length > 0 && (
            <div className="surface surface-pad">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold" style={{ letterSpacing: '-0.01em' }}>Transaction History</h2>
                <span className="chip">{data.transactions.length} records</span>
              </div>
              <div className="chart-frame">
                <PriceChart transactions={data.transactions} height={240} />
              </div>
            </div>
          )}

          {/* Walk the math */}
          <WalkMathSection data={data} inventory={inventory} />

          {/* Justification */}
          {data.decision && (
            <DecisionPanel
              decision={data.decision}
              ev={data.ev_model}
              asModel={data.as_model}
            />
          )}

          {/* Transaction feed */}
          {data.transactions?.length > 0 && (() => {
            const TX_PER_PAGE = 20
            const sorted = [...data.transactions].sort(
              (a, b) => new Date(b.transacted_at) - new Date(a.transacted_at)
            )
            const totalPages = Math.ceil(sorted.length / TX_PER_PAGE)
            const page = Math.min(txPage, totalPages)
            const slice = sorted.slice((page - 1) * TX_PER_PAGE, page * TX_PER_PAGE)

            return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold" style={{ letterSpacing: '-0.01em' }}>Recent Transactions</h2>
                  <span className="eyebrow">{sorted.length} records</span>
                </div>
                <div className="feed">
                  {slice.map((t, i) => (
                    <div key={i} className="feed-row">
                      <span className={t.source === 'stockx' ? 'feed-side-bid' : 'feed-side-ask'}>
                        {(t.source || 'UNK').toUpperCase().slice(0, 3)}
                      </span>
                      <span style={{ color: 'var(--muted-foreground)' }}>{formatDate(t.transacted_at)}</span>
                      <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>${Number(t.price).toFixed(2)}</span>
                      <span style={{ color: 'var(--muted-foreground)' }}>—</span>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: '0.75rem', padding: '0.6rem 0',
                    borderTop: '1px solid var(--border)',
                  }}>
                    <button
                      onClick={() => setTxPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="btn btn-ghost"
                      style={{ padding: '0.4rem 0.9rem', fontSize: '0.72rem' }}
                    >
                      ← prev
                    </button>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.7rem', letterSpacing: '0.1em',
                      color: 'var(--muted-foreground)',
                    }}>
                      page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setTxPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="btn btn-ghost"
                      style={{ padding: '0.4rem 0.9rem', fontSize: '0.72rem' }}
                    >
                      next →
                    </button>
                  </div>
                )}
              </div>
            )
          })()}

        </div>
      )}
    </div>
  )
}
