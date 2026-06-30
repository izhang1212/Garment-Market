const MODEL_META = {
  ev_model:           { num: '01', method: 'simulate', name: 'expected value' },
  avellaneda_stoikov: { num: '02', method: 'derive',   name: 'avellaneda–stoikov' },
}

const MONO  = "'JetBrains Mono', monospace"
const GREEN = 'var(--field)'
const RED   = 'oklch(0.55 0.18 24)'
const MUTED = 'var(--muted-foreground)'

const fmt = n => (typeof n === 'number' ? n.toFixed(2) : '—')
const pct = f => (typeof f === 'number' ? `${(f * 100).toFixed(1)}%` : '—')

// ── Section header (label left, subtitle right) ───────────────────────────────

function SectionHeader({ label, sub }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: '0.75rem',
    }}>
      <span style={{ fontFamily: MONO, fontSize: '0.63rem', letterSpacing: '0.1em', color: MUTED }}>{label}</span>
      {sub && <span style={{ fontFamily: MONO, fontSize: '0.63rem', color: MUTED }}>{sub}</span>}
    </div>
  )
}

// ── Verdict section ───────────────────────────────────────────────────────────

function VerdictSection({ action, signals, bidGate, askGate, decision }) {
  const regime    = signals?.regime  ?? {}
  const kalman    = signals?.kalman  ?? {}
  const z         = signals?.z_score ?? {}
  const isMeanRev = ['mean_reverting', 'slow_reverting'].includes(regime.label)
  const velPct    = kalman.velocity_pct_per_day ?? 0

  const verbMap = { quote_both_sides: 'quote', buy_only: 'buy', sell_only: 'sell', hold: 'hold' }
  const nounMap = { quote_both_sides: 'both sides.', buy_only: 'bid only.', sell_only: 'ask only.', hold: '.' }
  const verb = verbMap[action] ?? 'hold'
  const noun = nounMap[action] ?? '.'

  const reasons = []
  if (action === 'hold') {
    if (!bidGate?.kelly_passes || !askGate?.kelly_passes)
      reasons.push('Kelly fraction below minimum threshold on one or both sides.')
    if (!bidGate?.primary_passes || !askGate?.primary_passes)
      reasons.push(isMeanRev
        ? `Z-score ${z.value >= 0 ? '+' : ''}${(z.value ?? 0).toFixed(2)}σ blocks both sides (${z.label}).`
        : `Velocity ${velPct >= 0 ? '+' : ''}${velPct.toFixed(2)}%/day blocks both sides.`)
  } else {
    if (!bidGate?.kelly_passes)
      reasons.push('Bid suppressed: Kelly fraction below minimum.')
    else if (!bidGate?.primary_passes)
      reasons.push(isMeanRev
        ? `Bid suppressed: market expensive at ${(z.value ?? 0).toFixed(2)}σ above Kalman FV.`
        : `Bid suppressed: price declining at ${Math.abs(velPct).toFixed(2)}%/day.`)
    if (!askGate?.kelly_passes)
      reasons.push('Ask suppressed: Kelly fraction below minimum.')
    else if (!askGate?.primary_passes)
      reasons.push(isMeanRev
        ? `Ask suppressed: market cheap at ${Math.abs(z.value ?? 0).toFixed(2)}σ below Kalman FV.`
        : `Ask suppressed: price rising at ${Math.abs(velPct).toFixed(2)}%/day.`)
    if (!reasons.length)
      reasons.push('Both bid and ask cleared the Kelly sizing gate and the regime-selected signal gate.')
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto',
      gap: '1.5rem', alignItems: 'center',
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '1.5rem',
      marginBottom: '1rem',
    }}>
      {/* Left: verdict text */}
      <div>
        <p className="eyebrow mb-3">VERDICT</p>
        <p style={{ fontWeight: 700, fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '0.6rem' }}>
          {verb} <span style={{ color: GREEN }}>{noun}</span>
        </p>
        <p style={{ color: MUTED, fontSize: '0.875rem', lineHeight: 1.65 }}>
          {reasons.join('  ')}
        </p>
      </div>

      {/* Right: bid / ask price boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', minWidth: '240px' }}>
        {[
          { label: 'BID', value: decision?.recommended_bid, active: bidGate?.actionable },
          { label: 'ASK', value: decision?.recommended_ask, active: askGate?.actionable },
        ].map(({ label, value, active }) => (
          <div key={label} style={{
            background: 'var(--background)',
            border: `1px solid ${active ? GREEN : RED}`,
            borderRadius: 'calc(var(--radius) - 2px)',
            padding: '1rem 1.25rem',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: MONO, fontSize: '0.6rem', letterSpacing: '0.1em', color: MUTED, marginBottom: '0.4rem' }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: '1.45rem', letterSpacing: '-0.03em', color: active ? GREEN : RED }}>
              ${fmt(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pipeline trace strip (L1–L5) ─────────────────────────────────────────────

function PipelineTrace({ signals, decision, sourceModel }) {
  const kalman  = signals?.kalman  ?? {}
  const z       = signals?.z_score ?? {}
  const regime  = signals?.regime  ?? {}
  const bidGate = decision?.bid_gate ?? {}
  const askGate = decision?.ask_gate ?? {}

  const velPct = kalman.velocity_pct_per_day
  const velStr = typeof velPct === 'number'
    ? `${velPct >= 0 ? '+' : ''}${velPct.toFixed(2)}%/day`
    : '—'
  const zStr = typeof z.value === 'number'
    ? `${z.value >= 0 ? '+' : ''}${z.value.toFixed(2)}σ`
    : '—'
  const hlStr = regime.half_life_days != null
    ? `t½ ${Number(regime.half_life_days).toFixed(1)}d`
    : 't½ none'
  const regimeGate = regime.primary_signal === 'z_score' ? '→ z-score gate' : '→ velocity gate'
  const actionLabel = {
    quote_both_sides: 'quote both',
    buy_only:         'buy only',
    sell_only:        'sell only',
    hold:             'hold',
  }[decision?.action ?? 'hold'] ?? 'hold'
  const modelLabel = sourceModel === 'ev_model' ? 'using ev quote' : 'using a-s quote'

  const layers = [
    {
      id: 'L1', label: 'KALMAN',
      question: 'fair value + velocity',
      primary: `μ $${fmt(kalman.fair_value)}`,
      secondary: `v ${velStr}`,
    },
    {
      id: 'L2', label: 'Z-SCORE',
      question: 'last print rich or cheap?',
      primary: zStr,
      secondary: z.label ?? '—',
    },
    {
      id: 'L3', label: 'OU REGIME',
      question: 'reverting or trending?',
      primary: (regime.label ?? '—').replace('_', '-'),
      secondary: `${hlStr} ${regimeGate}`,
    },
    {
      id: 'L4', label: 'KELLY',
      question: 'edge vs opportunity cost',
      primary: `bid ${pct(bidGate.kelly_fraction)} · ask ${pct(askGate.kelly_fraction)}`,
      secondary: 'min 1% to quote',
    },
    {
      id: 'L5', label: 'DECISION',
      question: 'ship, half, or hold',
      primary: actionLabel,
      secondary: modelLabel,
    },
  ]

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <SectionHeader label="PIPELINE TRACE" />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden',
      }}>
        {layers.map(({ id, label, question, primary, secondary }, i) => (
          <div key={id} style={{
            padding: '1rem 1.125rem',
            borderRight: i < layers.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ fontFamily: MONO, fontSize: '0.6rem', letterSpacing: '0.08em', color: GREEN, marginBottom: '0.2rem' }}>
              {id} · {label}
            </div>
            <div style={{ fontFamily: MONO, fontSize: '0.63rem', color: MUTED, marginBottom: '0.75rem' }}>
              {question}
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.02em', marginBottom: '0.2rem' }}>
              {primary}
            </div>
            <div style={{ fontFamily: MONO, fontSize: '0.63rem', color: MUTED }}>
              {secondary}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Model comparison cards ────────────────────────────────────────────────────

function ModelQuoteCard({ modelKey, model, selectedKey }) {
  const meta       = MODEL_META[modelKey] ?? MODEL_META.avellaneda_stoikov
  const isSelected = modelKey === selectedKey

  return (
    <div style={{
      border: `2px solid ${isSelected ? GREEN : 'var(--border)'}`,
      borderRadius: 'var(--radius)', overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{ padding: '0.875rem 1.125rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontFamily: MONO, fontSize: '0.63rem', color: MUTED }}>{meta.num} · {meta.method}</span>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>{meta.name}</div>
        </div>
        <span style={{
          fontFamily: MONO, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
          padding: '0.25rem 0.65rem', borderRadius: '999px',
          background: isSelected ? GREEN : 'transparent',
          border: `1px solid ${isSelected ? 'transparent' : 'var(--border)'}`,
          color: isSelected ? '#fff' : MUTED,
        }}>
          {isSelected ? 'SELECTED' : 'RUNNER-UP'}
        </span>
      </div>

      {/* BID / ASK / TOTAL EV — 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '0.875rem 1.125rem', gap: '0.5rem' }}>
        {[
          { label: 'BID',      value: `$${fmt(model?.bid)}`,      sub: `p ${fmt(model?.bid_fill_probability)} · ev +$${fmt(model?.bid_ev)}` },
          { label: 'ASK',      value: `$${fmt(model?.ask)}`,      sub: `p ${fmt(model?.ask_fill_probability)} · ev +$${fmt(model?.ask_ev)}` },
          { label: 'TOTAL EV', value: `$${fmt(model?.total_ev)}`, sub: `spread $${fmt(model?.spread)}`, green: true },
        ].map(({ label, value, sub, green }) => (
          <div key={label}>
            <div style={{ fontFamily: MONO, fontSize: '0.6rem', letterSpacing: '0.1em', color: MUTED, marginBottom: '0.3rem' }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.02em', color: green ? GREEN : 'var(--foreground)', marginBottom: '0.2rem' }}>{value}</div>
            <div style={{ fontFamily: MONO, fontSize: '0.6rem', color: MUTED }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Per-side gate trace ───────────────────────────────────────────────────────

function GateTable({ decision }) {
  const signals   = decision?.signals ?? {}
  const bidGate   = decision?.bid_gate ?? {}
  const askGate   = decision?.ask_gate ?? {}
  const regime    = signals.regime ?? {}
  const z         = signals.z_score ?? {}
  const kalman    = signals.kalman  ?? {}
  const isMeanRev = ['mean_reverting', 'slow_reverting'].includes(regime.label)

  const zStr = typeof z.value === 'number'
    ? `z ${z.value >= 0 ? '+' : ''}${z.value.toFixed(2)}σ · ${z.label}`
    : '—'
  const velPct = kalman.velocity_pct_per_day
  const velStr = typeof velPct === 'number'
    ? `${velPct >= 0 ? '+' : ''}${velPct.toFixed(2)}%/day`
    : '—'

  const COL  = { gridTemplateColumns: '1fr 1fr 1fr' }
  const HDR  = { fontFamily: MONO, fontSize: '0.6rem', letterSpacing: '0.1em', color: MUTED }
  const CELL = { fontFamily: MONO, fontSize: '0.68rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.75rem 0.5rem' }

  const regimeSub = `regime = ${(regime.label ?? '—').replace('_', '-')} → primary gate = ${regime.primary_signal ?? '—'}`

  return (
    <div>
      <SectionHeader label="PER-SIDE GATE TRACE" sub={regimeSub} />
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{
          display: 'grid', ...COL,
          background: 'color-mix(in oklab, var(--card) 40%, var(--border))',
          borderBottom: '1px solid var(--border)',
          padding: '0.5rem 1rem',
        }}>
          <span style={{ ...HDR }}>GATE</span>
          <span style={{ ...HDR, textAlign: 'center' }}>BID · BUY</span>
          <span style={{ ...HDR, textAlign: 'center' }}>ASK · SELL</span>
        </div>

        {/* Kelly row */}
        <div style={{ display: 'grid', ...COL, alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '0.75rem 1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.15rem' }}>kelly fraction</div>
            <div style={{ fontFamily: MONO, fontSize: '0.6rem', color: MUTED }}>edge ≥ 1% of capital</div>
          </div>
          {[bidGate, askGate].map((gate, i) => (
            <div key={i} style={{ ...CELL, color: gate.kelly_passes ? GREEN : RED }}>
              <span>{gate.kelly_passes ? '✓' : '✗'}</span>
              <span>{pct(gate.kelly_fraction)} capital</span>
            </div>
          ))}
        </div>

        {/* Primary signal row */}
        <div style={{ display: 'grid', ...COL, alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '0.75rem 1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.15rem' }}>
              {isMeanRev ? 'z-score gate' : 'velocity gate'}
            </div>
            <div style={{ fontFamily: MONO, fontSize: '0.6rem', color: MUTED }}>
              {isMeanRev ? 'block bid if expensive · block ask if cheap' : 'block bid if falling · block ask if rising'}
            </div>
          </div>
          {[bidGate, askGate].map((gate, i) => (
            <div key={i} style={{ ...CELL, color: gate.primary_passes ? GREEN : RED }}>
              <span>{gate.primary_passes ? '✓' : '✗'}</span>
              <span>{isMeanRev ? zStr : velStr}</span>
            </div>
          ))}
        </div>

        {/* Result row */}
        <div style={{ display: 'grid', ...COL, alignItems: 'center' }}>
          <div style={{ padding: '0.75rem 1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.15rem' }}>result</div>
            <div style={{ fontFamily: MONO, fontSize: '0.6rem', color: MUTED }}>both gates must pass</div>
          </div>
          {[
            { gate: bidGate, label: 'QUOTE BID' },
            { gate: askGate, label: 'QUOTE ASK' },
          ].map(({ gate, label }, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 0.5rem' }}>
              <span style={{
                fontFamily: MONO, fontSize: '0.65rem', fontWeight: 700,
                color: gate.actionable ? GREEN : RED,
                background: gate.actionable
                  ? 'color-mix(in oklab, var(--field) 12%, transparent)'
                  : 'color-mix(in oklab, oklch(0.55 0.18 24) 10%, transparent)',
                border: `1px solid ${gate.actionable ? GREEN : RED}`,
                borderRadius: '0.25rem',
                padding: '0.2rem 0.55rem',
              }}>
                {gate.actionable ? `✓ ${label}` : '✗ BLOCKED'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function DecisionPanel({ decision, ev, asModel }) {
  const action      = decision?.action ?? 'hold'
  const sourceModel = decision?.source_model ?? 'avellaneda_stoikov'
  const signals     = decision?.signals ?? {}
  const bidGate     = decision?.bid_gate ?? {}
  const askGate     = decision?.ask_gate ?? {}

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p className="eyebrow mb-2">DECISION ENGINE · 5-LAYER PIPELINE</p>
          <h2 className="display-lg">decision.</h2>
        </div>
        <span style={{ fontFamily: MONO, fontSize: '0.72rem', color: MUTED, paddingBottom: '0.25rem' }}>
          each layer answers one question, then hands off.
        </span>
      </div>
      <div style={{ height: '2px', background: GREEN, marginBottom: '1.75rem' }} />

      <div className="surface">
        <div className="surface-pad">

          {/* 1 — Verdict */}
          <VerdictSection
            action={action} signals={signals}
            bidGate={bidGate} askGate={askGate}
            decision={decision}
          />

          {/* 2 — Pipeline trace */}
          <PipelineTrace signals={signals} decision={decision} sourceModel={sourceModel} />

          {/* 3 — Model comparison */}
          <div style={{ marginBottom: '1.5rem' }}>
            <SectionHeader
              label="MODEL COMPARISON"
              sub="same fill-prob decay · pick higher total edge"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <ModelQuoteCard modelKey="ev_model"           model={ev}      selectedKey={sourceModel} />
              <ModelQuoteCard modelKey="avellaneda_stoikov" model={asModel} selectedKey={sourceModel} />
            </div>
          </div>

          {/* 4 — Per-side gate trace */}
          <GateTable decision={decision} />

        </div>
      </div>
    </div>
  )
}
