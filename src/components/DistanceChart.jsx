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

function fmtAxisTime(ts) {
  const d = new Date(ts)
  return d.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function niceYTicks(minVal, maxVal, approxCount = 5) {
  const range = maxVal - minVal || 1
  const rawStep = range / (approxCount - 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const normalized = rawStep / magnitude
  const step = ([1, 2, 5, 10].find((s) => s >= normalized) ?? 10) * magnitude
  const niceMin = Math.floor(minVal / step) * step
  const niceMax = Math.ceil(maxVal / step) * step
  const ticks = []
  for (let v = niceMin; v <= niceMax + step * 0.001; v += step) {
    ticks.push(Math.round(v * 100) / 100)
  }
  return ticks
}

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
      background: '#ffffff',
      border: '1px solid #E2E8F0',
      borderRadius: 14,
      padding: '10px 14px',
      fontSize: 13,
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#0F172A',
      boxShadow: '0 20px 25px rgba(15,23,42,0.1)',
      minWidth: 160,
    }}>
      <div style={{ color: '#64748B', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{fmtTime(label)}</div>

      <div>
        {d?.valueLabel ?? 'Dist'}:&nbsp;
        <span style={{ color: '#0052FF', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>
          {d?.chartValue ?? '—'} {d?.valueUnit ?? 'cm'}
        </span>
      </div>

      {d?.objectBlocking && (
        <>
          <div style={{ color: '#f97316', marginTop: 4, fontWeight: 600 }}>
            ▌ Object Blocking
          </div>
          {d.minDistance != null && (
            <div style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
              Min:&nbsp;<span style={{ color: '#fb923c' }}>{d.minDistance} cm</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function DistanceChart({
  data,
  eventTimes = [],
  height = 280,
  enterThreshold,
  exitThreshold,
  domainStart,
  domainEnd,
  valueKey = 'distance',
  valueUnit = 'cm',
  valueLabel = 'Dist',
  showThresholds = true,
}) {
  const chartData = data.map((point) => ({
    ...point,
    chartValue: point[valueKey],
    valueUnit,
    valueLabel,
  }))
  const xDomain = [
    typeof domainStart === 'number' ? domainStart : chartData[0]?.time,
    typeof domainEnd === 'number' ? domainEnd : chartData[chartData.length - 1]?.time,
  ]
  const xTicks =
    xDomain[0] != null && xDomain[1] != null && xDomain[0] !== xDomain[1]
      ? xDomain
      : chartData.length === 1
      ? [chartData[0].time]
      : []

  if (chartData.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: '#64748B',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 12h2m2-7.071L7.757 6.686M12 2v2m4.243 1.929L17.314 6.686M22 12h-2m-2.757 4.243L15.314 17.314M12 22v-2m-4.243-2.757L5.686 15.314" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span style={{ fontSize: 14 }}>Waiting for ESP32 data...</span>
      </div>
    )
  }

  const distances = chartData.map((d) => d.chartValue).filter((v) => v != null)
  if (distances.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#64748B',
        fontSize: 14,
      }}>
        No chart values in this range.
      </div>
    )
  }
  const rawMin = Math.min(...distances)
  const rawMax = Math.max(...distances)
  const padding = showThresholds ? 10 : Math.max((rawMax - rawMin) * 0.15, 0.1)
  const minD = Math.max(0, rawMin - padding)
  const maxD = Math.max(
    rawMax + padding,
    showThresholds && exitThreshold != null ? exitThreshold + 10 : 0,
    minD + (showThresholds ? 50 : 1),
  )

  const yTicks = niceYTicks(minD, maxD)
  const yDomainMin = yTicks[0]
  const yDomainMax = yTicks[yTicks.length - 1]

  const blockingRanges = getBlockingRanges(chartData)

  const windowStart = xDomain[0] ?? chartData[0].time
  const windowEnd   = xDomain[1] ?? chartData[chartData.length - 1].time
  const visibleEvents = eventTimes.filter((t) => t >= windowStart && t <= windowEnd)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 12, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" vertical={false} />

        <XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={xDomain[0] != null && xDomain[1] != null ? xDomain : ['dataMin', 'dataMax']}
          ticks={xTicks}
          tickFormatter={fmtAxisTime}
          tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={{ stroke: '#E2E8F0' }}
        />
        <YAxis
          domain={[yDomainMin, yDomainMax]}
          ticks={yTicks}
          tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
          tickLine={false}
          axisLine={{ stroke: '#E2E8F0' }}
          width={48}
          unit={valueUnit}
        />

        <Tooltip content={<ChartTooltip />} />

        {/* Blocking zones */}
        {blockingRanges.map((r, i) => (
          <ReferenceArea
            key={`block-${i}`}
            x1={r.x1}
            x2={r.x2}
            fill="#f9731618"
            stroke="#f9731630"
            strokeWidth={1}
          />
        ))}

        {/* Enter threshold — object detected below this */}
        {showThresholds && enterThreshold != null && (
          <ReferenceLine
            y={enterThreshold}
            stroke="#f97316"
            strokeDasharray="7 4"
            strokeWidth={1.5}
            label={{
              value: `Enter ${enterThreshold}${valueUnit}`,
              position: 'insideTopRight',
              fill: '#f97316',
              fontSize: 11,
              dx: -4,
              dy: 4,
            }}
          />
        )}

        {/* Exit threshold — count triggers when rising above this */}
        {showThresholds && exitThreshold != null && (
          <ReferenceLine
            y={exitThreshold}
            stroke="#22c55e"
            strokeDasharray="7 4"
            strokeWidth={1.5}
            label={{
              value: `Exit ${exitThreshold}${valueUnit}`,
              position: 'insideTopRight',
              fill: '#22c55e',
              fontSize: 11,
              dx: -4,
              dy: 4,
            }}
          />
        )}

        {/* Count events */}
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
          dataKey="chartValue"
          stroke="#0052FF"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 5, fill: '#0052FF', stroke: '#ffffff', strokeWidth: 3 }}
          isAnimationActive={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
