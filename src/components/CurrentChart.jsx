import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false })
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload

  return (
    <div style={{
      background: '#111827',
      border: '1px solid #2d3f5a',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 13,
      color: '#e2e8f0',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      minWidth: 160,
    }}>
      <div style={{ color: '#64748b', marginBottom: 6 }}>{fmtTime(label)}</div>
      <div>
        Current:&nbsp;
        <span style={{ color: '#22d3ee', fontWeight: 700, fontFamily: 'monospace' }}>
          {d?.currentMa ?? '-'} mA
        </span>
      </div>
      {d?.currentTargetMa != null && (
        <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
          Target:&nbsp;<span style={{ color: '#a78bfa' }}>{d.currentTargetMa} mA</span>
        </div>
      )}
      {d?.currentMode && (
        <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
          Mode:&nbsp;{d.currentMode}
        </div>
      )}
    </div>
  )
}

export default function CurrentChart({ data, height = 280 }) {
  if (data.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: '#334155',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 12h3l2-5 4 10 2-5h5" />
        </svg>
        <span style={{ fontSize: 14 }}>Waiting for current data...</span>
      </div>
    )
  }

  const values = data.map((d) => d.currentMa).filter((v) => v != null)
  const min = Math.max(0, Math.min(...values) - 50)
  const max = Math.max(...values, min + 100) + 50
  const xTicks =
    data.length >= 2
      ? [data[0].time, data[data.length - 1].time]
      : [data[0].time]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#1a2234" vertical={false} />
        <XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          ticks={xTicks}
          tickFormatter={fmtTime}
          tick={{ fill: '#475569', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: '#1e293b' }}
        />
        <YAxis
          domain={[min, max]}
          tick={{ fill: '#475569', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: '#1e293b' }}
          width={48}
          unit="mA"
        />
        <Tooltip content={<ChartTooltip />} />
        <Line
          type="monotone"
          dataKey="currentMa"
          stroke="#22d3ee"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, fill: '#22d3ee', stroke: '#0e7490', strokeWidth: 2 }}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
