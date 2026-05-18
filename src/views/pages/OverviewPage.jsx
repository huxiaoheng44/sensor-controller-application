import { useState, useEffect } from 'react'
import { useMQTTContext } from '../../context/MQTTContext'
import { useActivityLog } from '../../hooks/useActivityLog'
import './OverviewPage.css'

const LINES = ['Line 1', 'Line 2', 'Line 3']

function getShift(date = new Date()) {
  const h = date.getHours()
  if (h >= 6 && h < 14) return 'Morning'
  if (h >= 14 && h < 22) return 'Afternoon'
  return 'Night'
}

function timeAgo(ts) {
  if (!ts) return null
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec} sec ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  return `${Math.floor(min / 60)} hr ago`
}

function StatusBadge({ status }) {
  const map = {
    RUNNING: ['Running', '#22c55e'],
    IDLE: ['Idle', '#94a3b8'],
    JAM: ['Blocked', '#f97316'],
    ERROR: ['Error', '#ef4444'],
    WARNING: ['Warning', '#f59e0b'],
    MACHINE_ABNORMAL: ['Machine Abnormal', '#ef4444'],
    MACHINE_OFF: ['Machine Off', '#64748b'],
    CONNECTION_LOST: ['Connection Lost', '#ef4444'],
    SENSOR_OFFLINE: ['Sensor Offline', '#f59e0b'],
    OFF: ['Machine Off', '#64748b'],
  }
  const [label, color] = map[status] ?? ['Waiting', '#475569']
  return (
    <span className="op-status-badge" style={{ '--badge-color': color }}>
      <span className="op-status-dot" />
      {label}
    </span>
  )
}

export default function OverviewPage({ onNavigate }) {
  const { connected, machineSnapshot, lastDataTime, counter, frequency } = useMQTTContext()
  const { entries } = useActivityLog()
  const [line, setLine] = useState('Line 1')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const shift = getShift(now)
  const lastUpdateText = lastDataTime ? `Updated ${timeAgo(lastDataTime)}` : 'No data yet'
  const status = machineSnapshot?.status ?? null
  const recentEntries = entries.slice(0, 8)

  return (
    <div className="op">
      {/* Top bar */}
      <div className="op-topbar">
        <div className="op-topbar-group">
          <span className="op-topbar-label">Line</span>
          <select className="op-select" value={line} onChange={e => setLine(e.target.value)}>
            {LINES.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div className="op-topbar-group">
          <span className="op-topbar-label">Shift</span>
          <span className="op-topbar-value">{shift}</span>
        </div>
        <div className="op-topbar-group op-topbar-time">
          {now.toLocaleTimeString('en-US', { hour12: false })}
        </div>
        <div className="op-topbar-group op-topbar-update">
          <span className={`op-update-dot ${connected ? 'op-update-dot--online' : ''}`} />
          {lastUpdateText}
        </div>
      </div>

      <div className="op-body">
        {/* Machine status card */}
        <section className="op-section">
          <h2 className="op-section-title">Machine Status</h2>
          <div className="op-status-card">
            <div className="op-status-left">
              <StatusBadge status={status} />
              <span className="op-status-line">{line}</span>
            </div>
            <div className="op-status-metrics">
              <div className="op-metric">
                <span className="op-metric-num">{machineSnapshot?.item_count ?? counter ?? '—'}</span>
                <span className="op-metric-label">Items Today</span>
              </div>
              <div className="op-metric-divider" />
              <div className="op-metric">
                <span className="op-metric-num">{frequency != null ? frequency.toFixed(1) : '—'}</span>
                <span className="op-metric-label">/ min</span>
              </div>
              {machineSnapshot?.jam_duration_sec > 0 && (
                <>
                  <div className="op-metric-divider" />
                  <div className="op-metric">
                    <span className="op-metric-num op-metric-num--warn">{machineSnapshot.jam_duration_sec}s</span>
                    <span className="op-metric-label">Blocked</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Activity feed */}
        <section className="op-section">
          <div className="op-section-header">
            <h2 className="op-section-title">Recent Activity</h2>
            <button className="op-text-btn" onClick={() => onNavigate?.('log')}>View all →</button>
          </div>
          {recentEntries.length === 0 ? (
            <p className="op-empty">No activity yet. Waiting for sensor data…</p>
          ) : (
            <ul className="op-feed">
              {recentEntries.map(entry => (
                <li key={entry.id} className="op-feed-item">
                  <span className={`op-feed-dot op-feed-dot--${severityOf(entry.aiPrediction)}`} />
                  <div className="op-feed-content">
                    <span className="op-feed-event">{entry.event}</span>
                    {entry.operatorFeedback && (
                      <span className={`op-feed-tag op-feed-tag--${entry.operatorFeedback.type}`}>
                        {entry.operatorFeedback.label}
                      </span>
                    )}
                  </div>
                  <span className="op-feed-time">{timeAgo(entry.time)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function severityOf(status) {
  if (status === 'ERROR' || status === 'MACHINE_ABNORMAL' || status === 'CONNECTION_LOST') return 'danger'
  if (status === 'JAM' || status === 'WARNING' || status === 'SENSOR_OFFLINE') return 'warn'
  if (status === 'RUNNING') return 'ok'
  return 'neutral'
}
