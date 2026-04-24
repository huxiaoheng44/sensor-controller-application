import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts'

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false })
}

// Build contiguous blocking zones from the data array
function getBlockingRanges(data) {
  const ranges = []
  let start = null
  for (const d of data) {
    if (d.objectBlocking && start === null) {
      start = d.time
    } else if (!d.objectBlocking && start !== null) {
      ranges.push({ x1: start, x2: d.time })
      start = null
    }
  }
  if (start !== null) {
    ranges.push({ x1: start, x2: data[data.length - 1].time })
  }
  return ranges
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
        Dist:&nbsp;
        <span style={{ color: '#22d3ee', fontWeight: 700, fontFamily: 'monospace' }}>
          {d?.distance ?? '—'} cm
        </span>
        {d?.diff != null && (
          <span style={{
            marginLeft: 8,
            color: d.diff > 0 ? '#f97316' : '#94a3b8',
            fontSize: 11,
            fontFamily: 'monospace',
          }}>
            Δ{d.diff > 0 ? '+' : ''}{d.diff}
          </span>
        )}
      </div>

      {d?.baseline != null && (
        <div style={{ color: '#94a3b8', marginTop: 2 }}>
          Baseline:&nbsp;<span style={{ color: '#f59e0b' }}>{d.baseline} cm</span>
        </div>
      )}

      {d?.objectBlocking && (
        <>
          <div style={{ color: '#f97316', marginTop: 4, fontWeight: 600 }}>
            ▌ Object Blocking
          </div>
          {d.minDistance != null && (
            <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
              Min:&nbsp;<span style={{ color: '#fb923c' }}>{d.minDistance} cm</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function DistanceChart({ data, eventTimes = [] }) {
  const xTicks =
    data.length >= 2
      ? [data[0].time, data[data.length - 1].time]
      : data.length === 1
      ? [data[0].time]
      : []

  if (data.length === 0) {
    return (
      <div style={{
        height: 280,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: '#334155',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 12h2m2-7.071L7.757 6.686M12 2v2m4.243 1.929L17.314 6.686M22 12h-2m-2.757 4.243L15.314 17.314M12 22v-2m-4.243-2.757L5.686 15.314" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span style={{ fontSize: 14 }}>Waiting for ESP32 data...</span>
      </div>
    )
  }

  const baseline = data[data.length - 1]?.baseline
  const distances = data.map((d) => d.distance).filter((v) => v != null)
  const minD = Math.max(0, Math.min(...distances) - 15)
  const maxD = Math.max(
    ...distances,
    baseline != null ? baseline + 20 : 0,
    minD + 30
  )

  const blockingRanges = getBlockingRanges(data)

  // Event lines: only those within the current time window
  const windowStart = data[0].time
  const windowEnd   = data[data.length - 1].time
  const visibleEvents = eventTimes.filter((t) => t >= windowStart && t <= windowEnd)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 12, right: 24, left: 0, bottom: 4 }}>
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
          domain={[minD, maxD]}
          tick={{ fill: '#475569', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: '#1e293b' }}
          width={48}
          unit="cm"
        />

        <Tooltip content={<ChartTooltip />} />

        {/* Blocking zones — orange shaded areas */}
        {blockingRanges.map((r, i) => (
          <ReferenceArea
            key={`block-${i}`}
            x1={r.x1}
            x2={r.x2}
            fill="#f9731620"
            stroke="#f9731640"
            strokeWidth={1}
          />
        ))}

        {/* Baseline reference line */}
        {baseline != null && (
          <ReferenceLine
            y={baseline}
            stroke="#f59e0b"
            strokeDasharray="7 4"
            strokeWidth={1.5}
            label={{
              value: `Baseline ${baseline}cm`,
              position: 'insideTopRight',
              fill: '#f59e0b',
              fontSize: 11,
              dx: -4,
              dy: 4,
            }}
          />
        )}

        {/* Count events — vertical red dashed lines */}
        {visibleEvents.map((t) => (
          <ReferenceLine
            key={`evt-${t}`}
            x={t}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            label={{
              value: '+1',
              position: 'insideTopRight',
              fill: '#ef4444',
              fontSize: 10,
              dy: -2,
            }}
          />
        ))}

        <Line
          type="monotone"
          dataKey="distance"
          stroke="#22d3ee"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, fill: '#22d3ee', stroke: '#0e7490', strokeWidth: 2 }}
          isAnimationActive={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
