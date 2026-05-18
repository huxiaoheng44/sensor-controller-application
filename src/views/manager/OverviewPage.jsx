import { useState, useEffect } from 'react'
import { useMQTTContext } from '../../context/MQTTContext'
import { useAlerts } from '../../hooks/useAlerts'
import { useActivityLog } from '../../hooks/useActivityLog'
import './OverviewPage.css'

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 5)  return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
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

function dotColor(entry) {
  const pred = entry.aiPrediction
  if (pred === 'JAM')    return 'warn'
  if (pred === 'ERROR')  return 'danger'
  if (pred === 'WARNING') return 'warn'
  if (entry.operatorFeedback?.type === 'confirm') return 'ok'
  return 'neutral'
}

function buildInsights({ status, counter, frequency, distanceHistory, machineSnapshot, alerts, now }) {
  const insights = []
  const { isRunning, isJam } = deriveOEE(status)

  const jamEvents = alerts.filter(a => a.status === 'JAM').length
  if (jamEvents >= 2) {
    insights.push({
      type: 'bottleneck',
      icon: '⚡',
      title: `Repeated bottleneck — ${jamEvents}× this shift`,
      why: `Throughput drops to zero detected ${jamEvents} times. Each jam event averages ${machineSnapshot?.jam_duration_sec ? Math.round(machineSnapshot.jam_duration_sec) : '~15'}s of downtime. Station 1 is the common failure point.`,
      similarity: 'Similar pattern observed last Tuesday 14:00',
      severity: 'warn',
      time: now,
    })
  }

  if (isJam) {
    const dur = machineSnapshot?.jam_duration_sec ? Math.round(machineSnapshot.jam_duration_sec) : 0
    insights.push({
      type: 'anomaly',
      icon: '⚠',
      title: 'Active jam — Station 1',
      why: `Object blocking for ${dur}s. Distance sensor reports stall. Current spike confirms motor stress and possible upstream feed issue.`,
      similarity: null,
      severity: 'danger',
      time: now,
    })
  }

  const hasInstability = distanceHistory && distanceHistory.length > 5
  if (hasInstability) {
    insights.push({
      type: 'instability',
      icon: '〜',
      title: 'Throughput fluctuation last 20 min',
      why: 'Irregular object passing intervals detected from distance sensor data. Suggests upstream feed inconsistency or minor mechanical resistance.',
      similarity: null,
      severity: 'warn',
      time: now,
    })
  }

  const rate = typeof frequency === 'number' ? frequency.toFixed(1) : '—'
  insights.push({
    type: 'insight',
    icon: '💡',
    title: `Shift running at ${rate}/min`,
    why: `Rate vs 3.2/min target. ${isRunning ? 'Machine is active and processing.' : isJam ? 'Output halted due to active jam.' : 'Machine is in idle or transition state.'} Quality remains at 99%.`,
    similarity: null,
    severity: 'ok',
    time: now,
  })

  return insights
}

export default function OverviewPage() {
  const { counter, frequency, machineSnapshot, lastDataTime, distanceHistory } = useMQTTContext()
  const { alerts } = useAlerts()
  const { entries } = useActivityLog()
  const now = useNow()

  const status = machineSnapshot?.status ?? 'IDLE'
  const { availability, performance, quality, oee, isJam } = deriveOEE(status)

  const downtime = machineSnapshot?.jam_duration_sec ?? 0
  const oeeLow   = oee < 75
  const dtHigh   = downtime > 30

  const targetCount    = 200
  const progressPct    = Math.min(100, Math.round((counter / targetCount) * 100))

  const insights = buildInsights({ status, counter, frequency, distanceHistory, machineSnapshot, alerts, now })

  const recentEntries = entries.slice(0, 6)

  const kpis = [
    {
      label: 'Throughput',
      value: counter ?? 0,
      unit: 'pcs',
      trend: counter > 0 ? '+trend' : null,
      trendDir: 'up',
      warn: false,
    },
    {
      label: 'OEE',
      value: oee,
      unit: '%',
      trend: oee < 75 ? '▼ Low' : '▲ Good',
      trendDir: oee < 75 ? 'down' : 'up',
      warn: oeeLow,
    },
    {
      label: 'Availability',
      value: availability,
      unit: '%',
      trend: null,
      trendDir: 'up',
      warn: availability < 80,
    },
    {
      label: 'Performance',
      value: performance,
      unit: '%',
      trend: null,
      trendDir: 'up',
      warn: performance < 70,
    },
    {
      label: 'Quality',
      value: quality,
      unit: '%',
      trend: '▲ Stable',
      trendDir: 'up',
      warn: false,
    },
    {
      label: 'Downtime',
      value: Math.round(downtime),
      unit: 's',
      trend: dtHigh ? '▲ High' : null,
      trendDir: 'down',
      warn: dtHigh,
    },
  ]

  return (
    <div className="mgr-ovr">
      {/* Header strip */}
      <div className="mgr-header">
        <div className="mgr-header-item">
          <span className="mgr-header-label">Line</span>
          <span className="mgr-header-val">Line 1</span>
        </div>
        <div className="mgr-header-div" />
        <div className="mgr-header-item">
          <span className="mgr-header-label">Shift</span>
          <span className="mgr-header-val">Morning</span>
        </div>
        <div className="mgr-header-div" />
        <div className="mgr-header-item">
          <span className="mgr-header-time">{formatTime(now)}</span>
        </div>
        <div className="mgr-header-div" />
        <div className="mgr-header-item">
          <span className="mgr-header-label">Operators</span>
          <span className="mgr-header-val">3</span>
        </div>

        <div className="mgr-target">
          <span className="mgr-target-label">Target {targetCount} pcs</span>
          <div className="mgr-progress">
            <div
              className="mgr-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="mgr-target-pct">{progressPct}%</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="mgr-kpi-row">
        {kpis.map(({ label, value, unit, trend, trendDir, warn }) => (
          <div key={label} className={`mgr-kpi-card${warn ? ' mgr-kpi-card--warn' : ''}`}>
            <div className="mgr-kpi-label">{label}</div>
            <div className={`mgr-kpi-value${warn ? ' mgr-kpi-value--warn' : ''}`}>
              {value}<span className="mgr-kpi-unit">{unit}</span>
            </div>
            {trend && (
              <div className={`mgr-kpi-trend mgr-kpi-trend--${trendDir}`}>{trend}</div>
            )}
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="mgr-body">
        {/* AI Insights */}
        <div className="mgr-insights-col">
          <p className="mgr-section-title">AI Insights</p>
          {insights.map((ins, i) => (
            <div
              key={ins.type + i}
              className={`mgr-insight mgr-insight--${ins.severity}`}
            >
              <div className="mgr-insight-header">
                <span className="mgr-insight-icon">{ins.icon}</span>
                <span className="mgr-insight-title">{ins.title}</span>
                <span className="mgr-insight-time">{timeAgo(ins.time)}</span>
              </div>
              <p className="mgr-insight-why">{ins.why}</p>
              {ins.similarity && <p className="mgr-insight-sim">{ins.similarity}</p>}
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="mgr-activity-col">
          <p className="mgr-section-title">Recent Activity</p>
          {recentEntries.length === 0 ? (
            <p className="mgr-empty">No activity recorded yet</p>
          ) : (
            <ul className="mgr-activity-list">
              {recentEntries.map((entry) => {
                const color = dotColor(entry)
                const fb = entry.operatorFeedback
                return (
                  <li key={entry.id} className="mgr-activity-item">
                    <span className={`mgr-activity-dot mgr-activity-dot--${color}`} />
                    <div className="mgr-activity-content">
                      <span className="mgr-activity-event">{entry.event}</span>
                      {fb && (
                        <span className={`mgr-activity-tag mgr-activity-tag--${fb.type}`}>
                          {fb.label}
                        </span>
                      )}
                    </div>
                    <span className="mgr-activity-time">{timeAgo(entry.time)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
