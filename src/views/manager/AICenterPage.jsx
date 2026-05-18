import { useAlerts } from '../../hooks/useAlerts'
import { useActivityLog } from '../../hooks/useActivityLog'
import './AICenterPage.css'

function formatHHMM(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

const ACCURACY_ROWS = [
  { label: 'Jam Detection', pct: 91, delta: '+7%', trend: 'up' },
  { label: 'Idle Detection', pct: 88, delta: '+3%', trend: 'up' },
  { label: 'Error Detection', pct: 76, delta: '+12%', trend: 'up' },
]

function dotClassForPred(pred) {
  if (pred === 'JAM') return 'warn'
  if (pred === 'ERROR' || pred === 'MACHINE_ABNORMAL' || pred === 'CONNECTION_LOST') return 'danger'
  if (pred === 'WARNING' || pred === 'SENSOR_OFFLINE') return 'warn'
  return 'neutral'
}

function predBadge(pred) {
  if (!pred) return null
  if (pred === 'JAM') return { cls: 'jam', label: 'JAM' }
  if (pred === 'ERROR') return { cls: 'error', label: 'ERROR' }
  if (pred === 'MACHINE_ABNORMAL') return { cls: 'error', label: 'MACHINE ABNORMAL' }
  if (pred === 'WARNING') return { cls: 'warning', label: 'WARNING' }
  if (pred === 'SENSOR_OFFLINE') return { cls: 'warning', label: 'SENSOR OFFLINE' }
  return null
}

export default function AICenterPage() {
  const { alerts } = useAlerts()
  const { entries } = useActivityLog()

  const totalFeedback = alerts.filter(a => a.state !== 'pending').length
  const confirmed = alerts.filter(a => a.state === 'confirmed').length
  const corrections = alerts.filter(a => a.state === 'wrong').length
  const pending = alerts.filter(a => a.state === 'pending').length

  const recentEntries = entries.slice(0, 20)

  return (
    <div className="aic">
      <div className="aic-header">
        <h1 className="aic-title">AI Center</h1>
      </div>

      <div className="aic-body">
        {/* ── Left column ── */}
        <div className="aic-left">

          {/* Detection Accuracy */}
          <div className="aic-card">
            <p className="aic-card-label">Detection Accuracy</p>
            <div className="aic-acc-list">
              {ACCURACY_ROWS.map(({ label, pct, delta }) => (
                <div key={label} className="aic-acc-row">
                  <span className="aic-acc-name">{label}</span>
                  <div className="aic-acc-track">
                    <div className="aic-acc-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="aic-acc-pct">{pct}%</span>
                  <span className="aic-acc-delta">{delta}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Operator Feedback */}
          <div className="aic-card">
            <p className="aic-card-label">Operator Feedback</p>
            <div className="aic-fb-stats">
              <div className="aic-fb-stat">
                <span className="aic-fb-bar aic-fb-bar--total" />
                <span className="aic-fb-num">{displayTotal}</span>
                <span className="aic-fb-label">Total<br />Reviewed</span>
              </div>
              <div className="aic-fb-stat">
                <span className="aic-fb-bar aic-fb-bar--confirmed" />
                <span className="aic-fb-num aic-fb-num--green">{displayConfirmed}</span>
                <span className="aic-fb-label">Confirmed</span>
              </div>
              <div className="aic-fb-stat">
                <span className="aic-fb-bar aic-fb-bar--corrections" />
                <span className="aic-fb-num aic-fb-num--blue">{displayCorrections}</span>
                <span className="aic-fb-label">Corrections</span>
              </div>
            </div>
            {pending > 0 && (
              <div className="aic-pending-alert">
                <span className="aic-pending-dot" />
                <span className="aic-pending-text">
                  {pending} alert{pending > 1 ? 's' : ''} awaiting operator review
                </span>
              </div>
            )}
          </div>

          {/* Model Info */}
          <div className="aic-card">
            <p className="aic-card-label">Model Info</p>
            <div className="aic-model-rows">
              {MODEL_INFO.map(({ label, value }) => (
                <div key={label} className="aic-model-row">
                  <span className="aic-model-key">{label}</span>
                  <span className="aic-model-val">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Event Timeline ── */}
        <div className="aic-timeline">
          <div className="aic-timeline-head">
            <p className="aic-card-label" style={{ margin: 0 }}>Event Timeline</p>
          </div>
          <div className="aic-timeline-list">
            {timelineItems.map(item => (
              <div key={item.id} className="aic-tl-row">
                <span className="aic-tl-time">{item.time}</span>
                <span className={`aic-tl-dot aic-tl-dot--${item.dot}`} />
                <span className="aic-tl-event">{item.event}</span>
                <div className="aic-tl-right">
                  {item.fb && (
                    <span className={`aic-tl-fb${item.fb.startsWith('✓') ? ' aic-tl-fb--ok' : ' aic-tl-fb--wrong'}`}>
                      {item.fb}
                    </span>
                  )}
                  {item.badge && (
                    <span className={`aic-tl-badge aic-tl-badge--${item.badge.cls}`}>
                      {item.badge.label}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
