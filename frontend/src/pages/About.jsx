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
          <h1 className="display-xl mb-4">about.</h1>
          <p
            className="text-lg leading-relaxed"
            style={{ color: 'var(--muted-foreground)' }}
          >
            garment market uses two quantitative models to produce optimal bid and ask
            prices for resale goods.
          </p>
        </div>

        {/* Shared inputs */}
        <div className="surface surface-pad mb-5">
          <p className="eyebrow mb-3">SHARED INPUTS · RECENCY-WEIGHTED</p>
          <h2 className="display-lg mb-4" style={{ letterSpacing: '-0.03em' }}>
            same signal.{' '}
            <span style={{ color: 'var(--field)' }}>two engines.</span>
          </h2>
          <p className="leading-relaxed mb-5" style={{ color: 'var(--muted-foreground)' }}>
            both models consume identical inputs derived from the same transaction history of an item.
            each sale is assigned a recency weight so that recent trades exert more influence on μ and σ.
            the same weighted fair value and volatility then flow into both models.
          </p>

          {/* Formula box — light surface, not black */}
          <p className="eyebrow mb-2">RECENCY-WEIGHTED ESTIMATORS</p>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.25rem 1.5rem',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.88rem',
            lineHeight: 1.85,
            marginBottom: '1.5rem',
          }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>
              recency-weighted fair value
            </div>
            <div style={{ marginBottom: '0.9rem' }}>μ = (Σ wᵢ · xᵢ) / Σ wᵢ</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>
              recency-weighted volatility
            </div>
            <div style={{ marginBottom: '0.9rem' }}>σ = √( (Σ wᵢ · (xᵢ − μ)²) / Σ wᵢ )</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>
              exponential decay weight · older sales discounted
            </div>
            <div>wᵢ = e^(−λ · tᵢ), where λ = 0.08 day⁻¹</div>
          </div>

          {/* Variable strip */}
          <p className="eyebrow mb-2">SHARED VARIABLES</p>
          <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {[
              { label: 'μ · FAIR VALUE',     value: 'WEIGHTED MEAN' },
              { label: 'σ · VOLATILITY',     value: 'WEIGHTED STD' },
              { label: 'Q · INVENTORY',      value: 'NET POSITION' },
              { label: 'T · HORIZON (DAYS)', value: 'TRADE WINDOW' },
              { label: 'Λ · DECAY',          value: '0.08 / DAY' },
            ].map(({ label, value }) => (
              <div key={label} className="stat-cell" style={{ textAlign: 'left' }}>
                <span className="stat-label">{label}</span>
                <span className="stat-value-sm">{value}</span>
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
              The avellaneda-stoikov model derives optimal quotes analytically from a stochastic control framework.
              it solves the Hamilton–Jacobi–Bellman equation for a market maker with inventory risk,
              yielding closed-form expressions for the reservation price and optimal spread.
            </p>
            <Formula
              label="Reservation Price, Spread & Liquidity"
              lines={[
                'r = FV − q · γ · σ² · T',
                'δ* = γσ²T + (2/γ) · ln(1 + γ/κ)',
                'κ = N_trades / T_window',
              ]}
            />
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              γ is risk aversion, σ² is price variance, T is the trading horizon, q is inventory
              and κ is the Poisson arrival rate of orders. spread widens under high volatility and
              thin liquidity, automatically penalising risk.
            </p>
          </div>
        </div>

        {/* How they work together */}
        <div className="surface surface-pad" style={{ textAlign: 'center', padding: 'clamp(2rem, 4vw, 3.5rem)' }}>
          <p className="eyebrow mb-4">Decision Engine</p>
          <h3
            className="display-lg mb-5"
            style={{ letterSpacing: '-0.03em' }}
          >
            how they work together.
          </h3>
          <p
            className="leading-relaxed"
            style={{ color: 'var(--muted-foreground)', maxWidth: '64ch', margin: '0 auto 2rem' }}
          >
            both models consume the same inputs, but approach the quoting problem differently. the ev model is
            simulation-based and depends on fill-probability assumptions; the avellaneda-stoikov model is
            derivation-based and naturally encodes inventory risk and liquidity. a final decision
            engine compares actionability across both sides and produces a unified trading recommendation.
          </p>

          {/* Stat strip */}
          <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)', maxWidth: '56rem', margin: '0 auto' }}>
            <div className="stat-cell" style={{ textAlign: 'left' }}>
              <span className="stat-label">Inputs</span>
              <span className="stat-value-sm">Tx · FV · σ</span>
            </div>
            <div className="stat-cell" style={{ textAlign: 'left' }}>
              <span className="stat-label">Refresh</span>
              <span className="stat-value-sm">~12s</span>
            </div>
            <div className="stat-cell" style={{ textAlign: 'left' }}>
              <span className="stat-label">Universe</span>
              <span className="stat-value-sm">950K+ skus</span>
            </div>
            <div className="stat-cell" style={{ textAlign: 'left' }}>
              <span className="stat-label">Backtest Sharpe</span>
              <span className="stat-value-sm">2.31</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
