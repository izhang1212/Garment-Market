import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

const GREEN      = '#2B5A27'   // approximates oklch(0.42 0.11 145)
const GRID       = '#C5BFB5'   // approximates oklch(0.80 0.008 80) — border
const AXIS_COLOR = '#5E5A53'   // approximates oklch(0.42 0.008 60) — muted-foreground

function formatDate(isoStr) {
  const d = new Date(isoStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'oklch(0.97 0.008 90)', border: '1px solid oklch(0.80 0.008 80)', borderRadius: '0.25rem', padding: '0.5rem 0.75rem' }}>
      <p className="text-xs mb-1" style={{ color: AXIS_COLOR }}>{label}</p>
      <p className="font-bold text-sm" style={{ color: GREEN }}>
        ${Number(payload[0].value).toFixed(2)}
      </p>
      {payload[0].payload.source && (
        <p className="text-xs capitalize mt-0.5" style={{ color: AXIS_COLOR }}>
          {payload[0].payload.source}
        </p>
      )}
    </div>
  )
}

function buildTickRenderer(totalCount) {
  return function CustomTick({ x, y, index, payload }) {
    const isFirst = index === 0
    const isLast  = index === totalCount - 1
    return (
      <g transform={`translate(${x},${y})`}>
        {/* Tick mark for every point */}
        <line
          x1={0} y1={0} x2={0} y2={isFirst || isLast ? 6 : 4}
          stroke={AXIS_COLOR}
          strokeWidth={1}
          opacity={isFirst || isLast ? 0.9 : 0.4}
        />
        {/* Date label only for first and last */}
        {isFirst && (
          <text x={4} dy={16} textAnchor="start" fill={AXIS_COLOR} fontSize={11}>
            {payload.value}
          </text>
        )}
        {isLast && (
          <text x={-4} dy={16} textAnchor="end" fill={AXIS_COLOR} fontSize={11}>
            {payload.value}
          </text>
        )}
      </g>
    )
  }
}

export default function PriceChart({ transactions, height = 300 }) {
  const data = transactions.map(t => ({
    date:   formatDate(t.transacted_at),
    price:  t.price,
    source: t.source,
  }))

  const prices = transactions.map(t => t.price)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const pad  = (maxP - minP) * 0.12 || 5

  const CustomTick = buildTickRenderer(data.length)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 20 }}>
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={GREEN} stopOpacity={0.12} />
            <stop offset="95%" stopColor={GREEN} stopOpacity={0}    />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />

        <XAxis
          dataKey="date"
          axisLine={{ stroke: GRID }}
          tickLine={false}
          interval={0}
          tick={<CustomTick />}
        />
        <YAxis
          domain={[minP - pad, maxP + pad]}
          tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `$${Math.round(v)}`}
          width={56}
        />

        <Tooltip content={<CustomTooltip />} />

        <Area
          type="linear"
          dataKey="price"
          stroke={GREEN}
          strokeWidth={1.5}
          fill="url(#priceGradient)"
          dot={false}
          activeDot={{ r: 3, fill: GREEN, stroke: 'oklch(0.94 0.012 90)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
