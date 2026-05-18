import { useState } from 'react'
import { useAlerts } from '../../hooks/useAlerts'
import { WRONG_REASONS } from '../../stores/alerts'
import './AlertsPage.css'

function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  return `${Math.floor(min / 60)} hr ago`
}

const STATUS_COLORS = {
  JAM: '#f97316',
  ERROR: '#ef4444',
  MACHINE_ABNORMAL: '#ef4444',
  WARNING: '#f59e0b',
  SENSOR_OFFLINE: '#f59e0b',
  MACHINE_OFF: '#64748b',
  OFF: '#64748b',
}

function AlertCard({ alert, onConfirm, onWrong }) {
  const [mode, setMode] = useState(null) // null | 'wrong-form'
  const [reason, setReason] = useState(WRONG_REASONS[0])
  const [desc, setDesc] = useState('')
  const [done, setDone] = useState(null) // null | 'confirmed' | 'wrong'

  if (done === 'confirmed') {
    return (
      <div className="al-card al-card--done">
        <span className="al-done-icon">✓</span>
        <span className="al-done-text">Feedback recorded</span>
      </div>
    )
  }

  if (done === 'wrong') {
    return (
      <div className="al-card al-card--done al-card--wrong-done">
        <span className="al-done-icon">✓</span>
        <span className="al-done-text">Thanks — AI model updated</span>
      </div>
    )
  }

  const color = STATUS_COLORS[alert.status] ?? '#475569'

  return (
    <div className="al-card" style={{ '--alert-color': color }}>
      <div className="al-card-header">
        <div className="al-card-meta">
          <span className="al-card-status" style={{ color }}>{alert.status}</span>
          <span className="al-card-conf">·  {alert.confidence} confidence · {alert.source}</span>
          {alert.jamDuration > 0 && (
            <span className="al-card-dur">· {alert.jamDuration}s</span>
          )}
        </div>
        <span className="al-card-time">{timeAgo(alert.time)}</span>
      </div>

      <p className="al-card-question">{alert.question}</p>

      {alert.warnings?.length > 0 && (
        <ul className="al-card-warnings">
          {alert.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      {mode === null && (
        <div className="al-card-actions">
          <button
            className="al-btn al-btn--confirm"
            onClick={() => { onConfirm(alert.id); setDone('confirmed') }}
          >
            ✓ Confirm
          </button>
          <button
            className="al-btn al-btn--wrong"
            onClick={() => setMode('wrong-form')}
          >
            ✗ Wrong
          </button>
        </div>
      )}

      {mode === 'wrong-form' && (
        <div className="al-wrong-form">
          <p className="al-wrong-title">What happened?</p>
          <div className="al-reasons">
            {WRONG_REASONS.map(r => (
              <label key={r} className={`al-reason ${reason === r ? 'al-reason--selected' : ''}`}>
                <input
                  type="radio"
                  name={`reason-${alert.id}`}
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                {r}
              </label>
            ))}
          </div>
          <textarea
            className="al-desc"
            placeholder="Describe issue (optional)"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            rows={3}
          />
          <div className="al-card-actions">
            <button className="al-btn al-btn--cancel" onClick={() => setMode(null)}>
              Cancel
            </button>
            <button
              className="al-btn al-btn--submit"
              onClick={() => {
                onWrong(alert.id, { reason, description: desc })
                setDone('wrong')
              }}
            >
              Submit Feedback
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AlertsPage() {
  const { alerts, confirmAlert, wrongAlert } = useAlerts()
  const pending = alerts.filter(a => a.state === 'pending')
  const resolved = alerts.filter(a => a.state !== 'pending')

  return (
    <div className="al">
      <div className="al-header">
        <h1 className="al-title">AI Alerts</h1>
        {pending.length > 0 && (
          <span className="al-pending-badge">{pending.length} pending</span>
        )}
      </div>

      <div className="al-body">
        {pending.length === 0 && (
          <div className="al-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="al-empty-icon">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p>No pending alerts</p>
            <p className="al-empty-sub">The AI will notify you when anomalies are detected.</p>
          </div>
        )}

        {pending.length > 0 && (
          <section className="al-section">
            <h2 className="al-section-title">Pending</h2>
            {pending.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onConfirm={confirmAlert}
                onWrong={wrongAlert}
              />
            ))}
          </section>
        )}

        {resolved.length > 0 && (
          <section className="al-section">
            <h2 className="al-section-title">Resolved</h2>
            {resolved.slice(0, 10).map(alert => (
              <div key={alert.id} className="al-card al-card--resolved">
                <div className="al-card-header">
                  <span className="al-card-question al-card-question--sm">{alert.question}</span>
                  <span className={`al-resolved-tag al-resolved-tag--${alert.state}`}>
                    {alert.state === 'confirmed' ? 'Confirmed' : `Wrong → ${alert.feedback?.reason}`}
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
