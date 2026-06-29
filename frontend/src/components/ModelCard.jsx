const fmt  = n => (typeof n === 'number' ? n.toFixed(2) : String(n ?? '—'))
const fmtP = n => (typeof n === 'number' ? `${(n * 100).toFixed(1)}%` : '—')
const fmtE = n => (typeof n === 'number' ? n.toFixed(4) : '—')

function Row({ label, value, mono }) {
  return (
    <div
      className="flex items-center justify-between py-2"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      <span className={`text-sm font-medium${mono ? ' font-mono' : ''}`}>{value}</span>
    </div>
  )
}

export default function ModelCard({ title, subtitle, data }) {
  const isAS = subtitle === 'derive'

  return (
    <div className="model-card">
      {/* Header */}
      <div>
        <p className="eyebrow mb-1">{subtitle}</p>
        <h3 className="font-bold text-lg" style={{ letterSpacing: '-0.02em' }}>{title}</h3>
      </div>

      {/* Key stats 2×2 */}
      <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="stat-cell">
          <span className="stat-label">Fair Value</span>
          <span className="stat-value-sm" style={{ color: 'var(--field)' }}>
            ${fmt(data.fair_value)}
          </span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Spread</span>
          <span className="stat-value-sm">${fmt(data.spread)}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Bid</span>
          <span className="stat-value-sm">${fmt(data.bid)}</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Ask</span>
          <span className="stat-value-sm">${fmt(data.ask)}</span>
        </div>
      </div>

      {/* Secondary rows */}
      <div>
        <Row label="Reservation Price"  value={`$${fmt(data.reservation_price)}`} />
        <Row label="Volatility"         value={`$${fmt(data.volatility)}`} />
        {isAS && data.liquidity_rate !== undefined && (
          <Row label="Liquidity (κ)"    value={fmt(data.liquidity_rate)} mono />
        )}
        {!isAS && data.spread_multiplier !== undefined && (
          <Row label="Spread Multiplier" value={`${fmt(data.spread_multiplier)}×`} mono />
        )}
        <Row label="Bid Fill Prob."     value={fmtP(data.bid_fill_probability)} />
        <Row label="Ask Fill Prob."     value={fmtP(data.ask_fill_probability)} />
        <Row label="Bid EV"             value={fmtE(data.bid_ev)} mono />
        <Row label="Ask EV"             value={fmtE(data.ask_ev)} mono />
        <div className="flex items-center justify-between py-2">
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Total EV</span>
          <span
            className="text-sm font-medium font-mono"
            style={{ color: 'var(--field)' }}
          >
            {fmtE(data.total_ev)}
          </span>
        </div>
      </div>
    </div>
  )
}
