const MODEL_META = {
  ev_model:           { num: '01', method: 'simulate', name: 'expected value' },
  avellaneda_stoikov: { num: '02', method: 'derive',   name: 'avellaneda–stoikov' },
}

const MONO = "'JetBrains Mono', monospace"

const fmt = n => (typeof n === 'number' ? n.toFixed(2) : '—')

function getVerdict(action, evActionable, asActionable) {
  if (action === 'hold' || (!evActionable && !asActionable)) {
    return {
      verb: 'hold.',
      noun: '',
      desc: 'Neither model produced a quote with sufficient expected edge on either side. Sit on your hands.',
    }
  }

  const sideVerb = action === 'buy_only' ? 'buy' : action === 'sell_only' ? 'sell' : 'buy/sell'
  const sideDesc = action === 'buy_only'
    ? 'The bid side clears the threshold. Ask-side edge is insufficient — stand pat on the ask.'
    : action === 'sell_only'
    ? 'The ask side clears the threshold. Bid-side edge is insufficient — stand pat on the bid.'
    : 'Both sides clear the fill threshold.'

  if (evActionable && asActionable) {
    return {
      verb: sideVerb,
      noun: 'using both.',
      desc: `${sideDesc} Both models agree — either quote is actionable.`,
    }
  } else if (evActionable) {
    return {
      verb: sideVerb,
      noun: 'using ev quote.',
      desc: `${sideDesc} The EV model clears the threshold; A–S does not. Ship the EV quote.`,
    }
  } else {
    return {
      verb: sideVerb,
      noun: 'using a–s quote.',
      desc: `${sideDesc} The A–S model clears the threshold; EV does not. Ship the A–S quote.`,
    }
  }
}

function ModelQuoteCard({ modelKey, model, selectedKey }) {
  const meta       = MODEL_META[modelKey] ?? MODEL_META.avellaneda_stoikov
  const isSelected = modelKey === selectedKey

  return (
    <div style={{
      border: `2px solid ${isSelected ? 'var(--field)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Body */}
      <div style={{ padding: '1rem 1.25rem 1.25rem', flex: 1 }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontFamily: MONO, fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
            {meta.num} · {meta.method}
          </span>
          <span style={{
            fontFamily: MONO,
            fontSize: '0.63rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            padding: '0.28rem 0.7rem',
            borderRadius: '999px',
            background: isSelected ? 'var(--field)' : 'transparent',
            border: `1px solid ${isSelected ? 'transparent' : 'var(--border)'}`,
            color: isSelected ? '#fff' : 'var(--muted-foreground)',
          }}>
            {isSelected ? 'SELECTED' : 'RUNNER-UP'}
          </span>
        </div>

        {/* Model name */}
        <h4 style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em', marginBottom: '0.875rem' }}>
          {meta.name}
        </h4>

        {/* Bid / Ask mini cells */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {[
            { label: 'BID', value: model?.bid, p: model?.bid_fill_probability, ev: model?.bid_ev, green: true  },
            { label: 'ASK', value: model?.ask, p: model?.ask_fill_probability, ev: model?.ask_ev, green: false },
          ].map(({ label, value, p, ev, green }) => (
            <div key={label} style={{
              background: 'color-mix(in oklab, var(--card) 60%, var(--border))',
              border: '1px solid var(--border)',
              borderRadius: 'calc(var(--radius) - 2px)',
              padding: '0.625rem 0.75rem',
            }}>
              <span style={{ fontFamily: MONO, fontSize: '0.63rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.25rem' }}>
                {label}
              </span>
              <span style={{ fontWeight: 700, fontSize: '1.35rem', letterSpacing: '-0.03em', color: green ? 'var(--field)' : 'var(--foreground)', display: 'block', marginBottom: '0.2rem' }}>
                ${fmt(value)}
              </span>
              <span style={{ fontFamily: MONO, fontSize: '0.68rem', color: 'var(--muted-foreground)' }}>
                p {fmt(p)} · ev +${fmt(ev)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer: spread + total ev — light background */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        padding: '0.875rem 1.25rem',
        gap: '0.5rem',
      }}>
        {[
          { label: 'SPREAD',   value: `$${fmt(model?.spread)}`,   green: false },
          { label: 'TOTAL EV', value: `$${fmt(model?.total_ev)}`, green: true  },
        ].map(({ label, value, green }) => (
          <div key={label}>
            <div style={{ fontFamily: MONO, fontSize: '0.63rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.3rem' }}>
              {label}
            </div>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: '1.1rem', color: green ? 'var(--field)' : 'var(--foreground)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DecisionPanel({ decision, ev, asModel }) {
  const action       = decision?.action ?? 'hold'
  const sourceModel  = decision?.source_model ?? 'avellaneda_stoikov'
  const evActionable = (ev?.total_ev ?? 0) > 0
  const asActionable = (asModel?.total_ev ?? 0) > 0
  const verdict      = getVerdict(action, evActionable, asActionable)

  const MIN_FILL = 0.05
  const actionRows = [
    { label: '01 · EV · BID',    price: ev?.bid,      evVal: ev?.bid_ev,      ok: (ev?.bid_fill_probability ?? 0) >= MIN_FILL && (ev?.bid_ev ?? 0) > 0 },
    { label: '01 · EV · ASK',    price: ev?.ask,      evVal: ev?.ask_ev,      ok: (ev?.ask_fill_probability ?? 0) >= MIN_FILL && (ev?.ask_ev ?? 0) > 0 },
    { label: '02 · A–S · BID',   price: asModel?.bid, evVal: asModel?.bid_ev, ok: (asModel?.bid_fill_probability ?? 0) >= MIN_FILL && (asModel?.bid_ev ?? 0) > 0 },
    { label: '02 · A–S · ASK',   price: asModel?.ask, evVal: asModel?.ask_ev, ok: (asModel?.ask_fill_probability ?? 0) >= MIN_FILL && (asModel?.ask_ev ?? 0) > 0 },
  ]

  return (
    <div>
      {/* Title — matches "walk the math." header style */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p className="eyebrow mb-2">DECISION ENGINE · min fill threshold · 5% per side</p>
          <h2 className="display-lg">decision.</h2>
        </div>
      </div>
      <div style={{ height: '2px', background: 'var(--field)', marginBottom: '1.75rem' }} />

      <div className="surface">
        <div className="surface-pad">

          {/* Description */}
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: '1.5rem' }}>
            Both quotes are re-scored against the same fill-probability decay so they're apples-to-apples.
            The engine picks the higher total expected edge — unless neither side clears the actionability
            threshold, in which case it holds.
          </p>

          {/* Side-by-side model cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <ModelQuoteCard modelKey="ev_model"           model={ev}      selectedKey={sourceModel} />
            <ModelQuoteCard modelKey="avellaneda_stoikov" model={asModel} selectedKey={sourceModel} />
          </div>

          {/* Verdict */}
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.25rem 1.5rem',
          }}>
            <p className="eyebrow mb-3">VERDICT</p>
            <p style={{ fontWeight: 700, fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: '0.75rem' }}>
              {verdict.verb}{verdict.noun ? ' ' : ''}
              {verdict.noun && <span style={{ color: 'var(--field)' }}>{verdict.noun}</span>}
            </p>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '1.25rem' }}>
              {verdict.desc}
            </p>

            {/* Actionability table — 2 model rows × BID/ASK columns */}
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 'calc(var(--radius) - 2px)',
              overflow: 'hidden',
              marginLeft: '0.25rem',
              marginRight: '0.25rem',
            }}>
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                background: 'color-mix(in oklab, var(--card) 40%, var(--border))',
                borderBottom: '1px solid var(--border)',
                padding: '0.45rem 0.875rem',
              }}>
                {['ACTIONABILITY', 'BID', 'ASK'].map((h, i) => (
                  <span key={h} style={{
                    fontFamily: MONO,
                    fontSize: '0.63rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--muted-foreground)',
                    textAlign: i === 0 ? 'left' : 'center',
                  }}>{h}</span>
                ))}
              </div>

              {/* Rows */}
              {[
                {
                  label: '01 · EXPECTED VALUE',
                  bid: { price: ev?.bid, evVal: ev?.bid_ev, ok: (ev?.bid_fill_probability ?? 0) >= MIN_FILL && (ev?.bid_ev ?? 0) > 0 },
                  ask: { price: ev?.ask, evVal: ev?.ask_ev, ok: (ev?.ask_fill_probability ?? 0) >= MIN_FILL && (ev?.ask_ev ?? 0) > 0 },
                },
                {
                  label: '02 · AVELLANEDA–STOIKOV',
                  bid: { price: asModel?.bid, evVal: asModel?.bid_ev, ok: (asModel?.bid_fill_probability ?? 0) >= MIN_FILL && (asModel?.bid_ev ?? 0) > 0 },
                  ask: { price: asModel?.ask, evVal: asModel?.ask_ev, ok: (asModel?.ask_fill_probability ?? 0) >= MIN_FILL && (asModel?.ask_ev ?? 0) > 0 },
                },
              ].map(({ label, bid, ask }, i, arr) => (
                <div key={label} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  alignItems: 'center',
                  padding: '0.7rem 0.875rem',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  gap: '0.5rem',
                }}>
                  {/* Model label */}
                  <span style={{ fontFamily: MONO, fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
                    {label}
                  </span>

                  {/* BID cell */}
                  {[bid, ask].map((side, si) => (
                    <div key={si} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                      <span style={{ fontFamily: MONO, fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        ${fmt(side.price)}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: 'var(--muted-foreground)' }}>
                        ev +${fmt(side.evVal)}
                      </span>
                      <span style={{
                        fontFamily: MONO,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: side.ok ? 'var(--field)' : 'var(--muted-foreground)',
                        background: side.ok ? 'color-mix(in oklab, var(--field) 12%, transparent)' : 'transparent',
                        border: `1px solid ${side.ok ? 'var(--field)' : 'var(--border)'}`,
                        borderRadius: '0.25rem',
                        padding: '0.15rem 0.45rem',
                        marginTop: '0.1rem',
                      }}>
                        {side.ok ? '✓ actionable' : '✗ below threshold'}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
