import { useState, useEffect } from 'react'
import { useMQTTContext } from '../../context/MQTTContext'
import { useAlerts } from '../../hooks/useAlerts'
import './OverviewPage.css'

const LINES = ['Line 1', 'Line 2', 'Line 3', 'Line 4']

const MOCK_LINE_DATA = {
  'Line 2': { shift: 'Morning',   operators: 2, target: 180, oee: 74, availability: 88, performance: 84, quality: 99, counter: 167, frequency: 3.8, downtime:  8 },
  'Line 3': { shift: 'Afternoon', operators: 4, target: 220, oee: 81, availability: 92, performance: 88, quality: 99, counter: 195, frequency: 4.1, downtime:  3 },
  'Line 4': { shift: 'Night',     operators: 2, target: 160, oee: 62, availability: 78, performance: 79, quality: 98, counter:  89, frequency: 2.9, downtime: 45 },
}

function deriveOEE(status) {
  const isRunning = ['RUNNING', 'OBJECT_ENTERING', 'OBJECT_PASSING'].includes(status)
  const isJam     = status === 'JAM'
  const avail = isRunning ? 91 : isJam ? 72 : 85
  const perf  = isRunning ? 86 : isJam ? 60 : 80
  const qual  = 99
  return {
    availability: avail,
    performance:  perf,
    quality:      qual,
    oee:          Math.round(avail * perf * qual / 10000),
    isRunning,
    isJam,
  }
}

function Sparkline({ data, color = '#0052FF', height = 32 }) {
  if (!data || data.length < 2) {
    const pts = Array.from({ length: 8 }, (_, i) => i)
    return <SparklinePath pts={pts.map(i => 12 + Math.sin(i * 0.9) * 4)} color={color} height={height} />
  }
  return <SparklinePath pts={data.slice(-20).map(Number)} color={color} height={height} />
}

function SparklinePath({ pts, color, height }) {
  const w = 100, h = height
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const points = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mgr-sparkline" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function buildInsights({ status, counter, machineSnapshot, alerts }) {
  const { isRunning, isJam } = deriveOEE(status)
  const jamEvents = alerts.filter(a => a.status === 'JAM').length
const avgJamSec = machineSnapshot?.jam_duration_sec ? Math.round(machineSnapshot.jam_duration_sec) : 4

  const hero = {
    type: 'REPEATED BOTTLENECK',
    badge: jamEvents > 0 ? `${jamEvents} events today` : '3 events today',
    badgeColor: 'blue',
    title: isJam
      ? `Packaging jam\nactive now`
      : jamEvents >= 2
        ? `Packaging jam\nblocks Station 1`
        : `Packaging jam\nrecurring`,
    desc: isJam
      ? `Object blocking for ${avgJamSec}s · motor stress · upstream feed paused`
      : jamEvents >= 2
        ? `Consistent across afternoon shift · avg ${avgJamSec}s · same root cause as yesterday`
        : `3 occurrences today · avg ${avgJamSec}s · same root cause as yesterday`,
    severity: 'hero',
  }

  return [hero, {
    type: 'RECURRING MACHINE ISSUES',
    badge: `${Math.max(1, jamEvents + 1)} incidents`,
    badgeColor: 'neutral',
    title: 'Feed irregularity',
    desc: 'Material supply gaps · upstream Conveyor C1',
    severity: 'warn', trendDir: 'flat',
  }, {
    type: 'ANOMALY TREND',
    badge: '+23%', badgeColor: 'blue',
    title: 'Micro-stops rising',
    desc: 'Afternoon shift · 14:00 – 16:00',
    severity: 'warn', trendDir: 'up',
  }, {
    type: 'PRODUCTION INSTABILITY',
    badge: isRunning ? null : '-12%', badgeColor: 'red',
    title: isRunning ? 'Line C speed loss' : 'Output halted',
    desc: isRunning ? `Sustained 2h · below target throughput` : `Output stopped · jam duration ${avgJamSec}s`,
    severity: isRunning ? 'warn' : 'danger', trendDir: 'down',
  }, {
    type: 'AI OPERATIONAL INSIGHT',
    badge: counter > 50 ? '+8%' : '-9%',
    badgeColor: counter > 50 ? 'green' : 'red',
    title: counter > 50 ? 'Morning leads' : 'Afternoon underperforms',
    desc: counter > 50 ? `Output ${counter} pcs · above prior shift` : `Output 9% below morning · downtime 2.3×`,
    severity: 'ok', trendDir: counter > 50 ? 'up' : 'down',
  }]
}

export default function OverviewPage() {
  const { counter, frequency, machineSnapshot, distanceHistory } = useMQTTContext()
  const { alerts } = useAlerts()
  const [selectedLine, setSelectedLine] = useState('Line 1')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const currentTime = new Date(now).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit',
  })

  const isLine1  = selectedLine === 'Line 1'
  const mockData = MOCK_LINE_DATA[selectedLine]

  const status = machineSnapshot?.status ?? 'IDLE'
  const { availability: realAvail, performance: realPerf, quality: realQual, oee: realOEE, isJam } = deriveOEE(status)
  const realDowntime = machineSnapshot?.jam_duration_sec ?? 0

  const kv = isLine1
    ? { oee: realOEE, availability: realAvail, performance: realPerf, quality: realQual,
        counterVal: counter ?? 0, freqVal: frequency, downtime: realDowntime,
        shift: 'Morning', operators: 3, target: 200 }
    : { ...mockData, counterVal: mockData.counter, freqVal: mockData.frequency }

const oeeLow = kv.oee < 75
  const dtHigh = kv.downtime > 30

  const kpis = [
    { label: 'Throughput',   value: kv.counterVal,           unit: 'pcs', sub: kv.counterVal > 0 ? '↑ vs target' : '— no data',              warn: false  },
    { label: 'OEE',          value: kv.oee,                  unit: '%',   sub: oeeLow ? '↓ below target' : '↑ on target',                     warn: oeeLow },
    { label: 'Availability', value: kv.availability,         unit: '%',   sub: 'Target 95',                                                    warn: kv.availability < 80 },
    { label: 'Performance',  value: kv.performance,          unit: '%',   sub: `${typeof kv.freqVal === 'number' ? kv.freqVal.toFixed(1) : '—'} u/min`, warn: kv.performance < 70 },
    { label: 'Quality',      value: kv.quality,              unit: '%',   sub: '↑ stable today',                                               warn: false  },
    { label: 'Downtime',     value: Math.round(kv.downtime), unit: 's',   sub: (isLine1 && isJam) ? '↑ 1 active jam' : '↓ 1 incident',        warn: dtHigh },
  ]

  const insights = buildInsights({ status, counter: kv.counterVal, machineSnapshot, alerts })
  const [hero, ...rest] = insights
  const smallCards = rest.slice(0, 4)

  return (
    <div className="ov">
      {/* Header */}
      <div className="ov-header">
        <h1 className="ov-title">Overview</h1>
        <div className="ov-header-right">
          <div className="ov-line-selector">
            {LINES.map(line => (
              <button
                key={line}
                className={`ov-line-btn${selectedLine === line ? ' ov-line-btn--active' : ''}`}
                onClick={() => setSelectedLine(line)}
              >
                {line}
              </button>
            ))}
          </div>
          <div className="ov-infobar-sep" />
          <div className="ov-meta-item">
            <span className="ov-meta-label">Shift</span>
            <span className="ov-meta-val">{kv.shift}</span>
          </div>
          <div className="ov-infobar-sep" />
          <div className="ov-meta-item">
            <span className="ov-meta-label">Current Time</span>
            <span className="ov-meta-val ov-meta-val--mono">{currentTime}</span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="ov-kpi-row">
        {kpis.map(({ label, value, unit, sub, warn }) => (
          <div key={label} className={`ov-kpi${warn ? ' ov-kpi--warn' : ''}`}>
            <span className="ov-kpi-label">{label}</span>
            <div className="ov-kpi-value">
              {value}<span className="ov-kpi-unit">{unit}</span>
            </div>
            <span className={`ov-kpi-sub${warn ? ' ov-kpi-sub--warn' : ''}`}>{sub}</span>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="ov-body">
        <h2 className="ov-section-title">AI Insights</h2>
        <div className="ov-insights-grid">
          <div className="ov-hero">
            <div className="ov-hero-top">
              <span className="ov-tag">{hero.type}</span>
              {hero.badge && <span className={`ov-badge ov-badge--${hero.badgeColor}`}>{hero.badge}</span>}
            </div>
            <h3 className="ov-hero-title">
              {hero.title.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
            </h3>
            <p className="ov-hero-desc">{hero.desc}</p>
            <div className="ov-hero-chart">
              <Sparkline data={distanceHistory} color="rgba(255,255,255,0.5)" height={48} />
            </div>
          </div>

          {smallCards.map((card, i) => (
            <div key={i} className={`ov-card ov-card--${card.severity}`}>
              <div className="ov-card-top">
                <span className="ov-tag ov-tag--dark">{card.type}</span>
                {card.badge && <span className={`ov-badge ov-badge--${card.badgeColor}`}>{card.badge}</span>}
              </div>
              <h4 className="ov-card-title">{card.title}</h4>
              <p className="ov-card-desc">{card.desc}</p>
              <div className="ov-card-chart">
                <Sparkline
                  data={distanceHistory}
                  color={card.trendDir === 'up' ? '#0052FF' : card.trendDir === 'down' ? '#EF4444' : '#94A3B8'}
                  height={32}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
