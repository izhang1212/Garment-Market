import { useState, useEffect } from 'react'

function Formula({ label, lines }) {
  return (
    <div className="formula">
      <span className="formula-label">{label}</span>
      {lines.map((line, i) => (
        <div key={i} className="formula-accent">{line}</div>
      ))}
    </div>
  )
}

export default function About() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => null)
  }, [])

  return (
    <div>
      <div className="container-gm" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>

        {/* Header */}
        <div style={{ paddingBottom: '2.5rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border)' }}>
          <p className="eyebrow mb-3">Garment Market</p>
          <h1 className="display-xl">about.</h1>
        </div>

        {/* Inspiration */}
        <div style={{ marginBottom: '3.5rem' }}>
          <p className="eyebrow mb-2">INSPIRATION</p>
          <h2 className="display-lg mb-3">why this project.</h2>
          <div style={{ height: '2px', background: 'var(--field)', marginBottom: '1.75rem' }} />
          <div className="surface surface-pad" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <p className="leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              fashion resale markets behave structurally like financial exchanges:
            </p>
            <ul style={{ paddingLeft: '1.4rem', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--muted-foreground)' }}>
              <li className="leading-relaxed">
                buyers post bids, sellers post asks, and items are transacted when the two sides meet an agreed price
              </li>
              <li className="leading-relaxed">
                the prices of these items are driven by supply, demand, hype, and scarcity — the same forces that govern equity markets
              </li>
            </ul>
            <p className="leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              this project treats every item (sneakers, streetwear pieces, accessories) as a{' '}
              <strong style={{ color: 'var(--foreground)' }}>tradeable asset,</strong>{' '}
              and uses historical transaction data to generate optimal bid and ask quotes.
            </p>
          </div>
        </div>

        {/* Math */}
        <div style={{ marginBottom: '2rem' }}>
          <p className="eyebrow mb-2">THE MATH</p>
          <h2 className="display-lg mb-3">the models.</h2>
          <div style={{ height: '2px', background: 'var(--field)', marginBottom: '1.75rem' }} />
        </div>

        {/* Shared inputs */}
        <div className="surface surface-pad mb-5">
          <p className="eyebrow mb-3">SHARED INPUTS · ADAPTIVE ESTIMATION</p>
          <h2 className="display-lg mb-4" style={{ letterSpacing: '-0.03em' }}>
            same signal.{' '}
            <span style={{ color: 'var(--field)' }}>two engines.</span>
          </h2>
          <p className="leading-relaxed mb-5" style={{ color: 'var(--muted-foreground)' }}>
            both models consume identical inputs derived from the same transaction history of an item.
            fair value is computed adaptively; a Kalman filter is used when the item has enough recent
            sales and a recency-weighted mean is used otherwise. volatility is always recency-weighted.
          </p>

          {/* Estimation methods */}
          <p className="eyebrow mb-2">ESTIMATION METHODS</p>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.25rem 1.5rem',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.85rem',
            lineHeight: 1.85,
            marginBottom: '1.5rem',
          }}>

            {/* Adaptive FV */}
            <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '0.2rem' }}>
              fair value · adaptive
            </div>
            <div style={{ marginBottom: '0.25rem' }}>
              μ = <span style={{ color: 'var(--field)' }}>Kalman level</span>
              <span style={{ color: 'var(--muted-foreground)' }}>, if ≥5 sales in last 90 days</span>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              μ = <span style={{ color: 'var(--field)' }}>(Σ wᵢ · xᵢ) / Σ wᵢ</span>
              <span style={{ color: 'var(--muted-foreground)' }}>, otherwise (recency-weighted mean)</span>
            </div>

            {/* Volatility */}
            <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '0.2rem' }}>
              volatility · recency-weighted
            </div>
            <div style={{ marginBottom: '1rem' }}>
              σ = √( (Σ wᵢ · (xᵢ − μ)²) / Σ wᵢ )
              <span style={{ color: 'var(--muted-foreground)' }}>, where μ is the recency-weighted mean</span>
            </div>

            {/* Weight */}
            <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '0.2rem' }}>
              exponential decay weight · older sales discounted
            </div>
            <div style={{ marginBottom: '1rem' }}>
              wᵢ = e^(−λ · tᵢ)
              <span style={{ color: 'var(--muted-foreground)' }}>, where λ = 0.08 day⁻¹, tᵢ = age of sale i in days</span>
            </div>

            {/* Liquidity + aggressiveness */}
            <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '0.2rem' }}>
              liquidity &amp; aggressiveness
            </div>
            <div style={{ marginBottom: '0.25rem' }}>
              κ = N_trades / T_window
              <span style={{ color: 'var(--muted-foreground)' }}>,  (poisson arrival rate)</span>
            </div>
            <div>
              α = max(√κ, 1)
              <span style={{ color: 'var(--muted-foreground)' }}>, (spread aggressiveness — wider spread for thin markets)</span>
            </div>

          </div>

          {/* Constants */}
          <p className="eyebrow mb-2">FIXED PARAMETERS</p>
          <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              { label: 'Q · INVENTORY',  value: 'INVENTORY' },
              { label: 'T · HORIZON',    value: 'TRADE WINDOW' },
              { label: 'Λ · DECAY RATE', value: '0.08 / DAY' },
            ].map(({ label, value }) => (
              <div key={label} className="stat-cell" style={{ textAlign: 'left', padding: '0.85rem 0.9rem' }}>
                <span className="stat-label" style={{ fontSize: '0.6rem', whiteSpace: 'nowrap' }}>{label}</span>
                <span className="stat-value-sm" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Model cards */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">

          {/* EV Model */}
          <div className="model-card">
            <div>
              <span className="delta-chip" style={{ marginTop: 0 }}>MODEL 01</span>
            </div>
            <h2 className="font-bold text-xl" style={{ letterSpacing: '-0.02em' }}>
              expected value model —{' '}
              <span style={{ color: 'var(--field)' }}>simulate</span>
            </h2>
            <p className="leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              the ev model simulates the profitability of quoting at different spreads. for each
              candidate spread, it computes a fill probability (the likelihood that a buyer or
              seller at that price actually transacts) and then calculates expected profit on both sides.
            </p>
            <Formula
              label="Expected Value"
              lines={[
                'EV_bid = P(fill | bid) × (FV − bid)',
                'EV_ask = P(fill | ask) × (ask − FV)',
                'Total EV = EV_bid + EV_ask',
              ]}
            />
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              sweeps a grid of spread multipliers, picks the quote that maximises total ev. highly
              responsive to fill-rate assumptions and easily tuned aggressive/conservative.
            </p>
          </div>

          {/* A-S Model */}
          <div className="model-card">
            <div>
              <span className="delta-chip" style={{ marginTop: 0 }}>MODEL 02</span>
            </div>
            <h2 className="font-bold text-xl" style={{ letterSpacing: '-0.02em' }}>
              avellaneda–stoikov —{' '}
              <span style={{ color: 'var(--field)' }}>derive</span>
            </h2>
            <p className="leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              the avellaneda-stoikov model derives optimal quotes analytically from a stochastic control framework.
              it solves the hamilton–jacobi–bellman equation for a market maker with inventory risk,
              yielding closed-form expressions for the reservation price and optimal spread.
            </p>
            <Formula
              label="Reservation Price & Spread"
              lines={[
                'r = FV − q · γ · σ² · T',
                'δ* = γσ²T + (2/γ) · ln(1 + γ/κ)',
                'P(fill | side) = e^(−κ · δ / 2)',
              ]}
            />
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              γ is risk aversion, σ² is price variance, T is the trading horizon, q is inventory.
              spread widens under high volatility and thin liquidity, automatically penalising risk.
            </p>
          </div>
        </div>

        {/* Decision Engine — 5-layer pipeline */}
        <div className="surface surface-pad" style={{ padding: 'clamp(2rem, 4vw, 3.5rem)' }}>

          {/* Header — centred */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p className="eyebrow mb-4">decision engine</p>
            <h3
              className="display-lg mb-5"
              style={{ letterSpacing: '-0.03em', fontSize: 'clamp(1.75rem, 3.8vw, 3rem)' }}
            >
              how they work together.
            </h3>
            <p
              className="leading-relaxed"
              style={{ color: 'var(--muted-foreground)', maxWidth: '52rem', margin: '0 auto' }}
            >
              both models produce quotes independently. a five-layer pipeline then decides
              whether each side is actually worth posting, filtering out quotes where the edge
              is too thin or the market isn't set up right. 
            </p>
          </div>

          {/* Pipeline strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            marginBottom: '1.5rem',
          }}>
            {[
              {
                id: 'L1', tag: 'KALMAN',
                q: 'is price trending up or down?',
                body: 'runs a constant-velocity filter over all transactions to extract the velocity ($/day). if the item has ≥5 sales in the last 90 days, the Kalman level also becomes the fair value used in every downstream step.',
              },
              {
                id: 'L2', tag: 'Z-SCORE',
                q: 'is the last sale an anomaly?',
                body: 'compares the most recent transaction to the adaptive fair value. a sale far above or below it is flagged — it may signal an opportunity, or just noise to ignore.',
              },
              {
                id: 'L3', tag: 'OU REGIME',
                q: 'reverting or trending?',
                body: 'determines whether this item historically snaps back to its fair value or keeps moving in one direction. this decides which signal to trust as the primary filter.',
              },
              {
                id: 'L4', tag: 'KELLY',
                q: 'is the edge big enough?',
                body: "sizes the opportunity relative to its cost. if the profit edge barely covers the cost of tying up capital, the quote doesn't clear this gate.",
              },
              {
                id: 'L5', tag: 'DECISION',
                q: 'bid, ask, both, or hold?',
                body: 'each side must clear two independent gates. both pass → actionable. one fails → that side is suppressed. the result comes with a full trace of what passed and what blocked.',
              },
            ].map(({ id, tag, q, body }, i, arr) => (
              <div key={id} style={{
                padding: '1.1rem 1.1rem 1.25rem',
                borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                background: i === arr.length - 1
                  ? 'color-mix(in oklab, var(--field) 5%, var(--card))'
                  : 'var(--card)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.6rem',
                  letterSpacing: '0.08em',
                  color: 'var(--field)',
                }}>
                  {id} · {tag}
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.63rem',
                  color: 'var(--muted-foreground)',
                  lineHeight: 1.45,
                }}>
                  {q}
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  lineHeight: 1.6,
                  color: 'var(--foreground)',
                  marginTop: '0.15rem',
                }}>
                  {body}
                </div>
              </div>
            ))}
          </div>

          {/* Gate logic — two columns */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}>
            {[
              {
                label: 'GATE 1 · EDGE SIZE',
                desc: "the profit opportunity must clear a minimum threshold after accounting for the cost of capital. a quote that barely breaks even isn't worth posting.",
                note: 'Kelly criterion, half-sized · 2% opportunity cost floor',
              },
              {
                label: 'GATE 2 · MARKET CONDITION',
                desc: 'a regime-appropriate signal confirms the move makes sense. reverting items check if price is stretched; trending items check the direction of momentum.',
                note: 'z-score gate for mean-reverting · velocity gate for trending',
              },
            ].map(({ label, desc, note }) => (
              <div key={label} style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'calc(var(--radius) - 2px)',
                padding: '1rem 1.25rem',
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.6rem',
                  letterSpacing: '0.1em',
                  color: 'var(--muted-foreground)',
                  marginBottom: '0.5rem',
                }}>
                  {label}
                </div>
                <p style={{ fontSize: '0.83rem', lineHeight: 1.6, color: 'var(--foreground)', marginBottom: '0.75rem' }}>
                  {desc}
                </p>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.68rem',
                  color: 'var(--muted-foreground)',
                }}>
                  {note}
                </div>
              </div>
            ))}
          </div>

          {/* Stat strip */}
          <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { label: 'PIPELINE LAYERS',   value: '5' },
              { label: 'SIDES EVALUATED',   value: 'independently' },
              { label: 'GATES',          value: '2' },
              { label: 'OUTPUTS',           value: 'buy · sell · both · hold' },
            ].map(({ label, value }) => (
              <div key={label} className="stat-cell" style={{ textAlign: 'left' }}>
                <span className="stat-label">{label}</span>
                <span className="stat-value-sm">{value}</span>
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  )
}
