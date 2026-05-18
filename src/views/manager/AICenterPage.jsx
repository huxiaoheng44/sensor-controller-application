import { useAlerts } from '../../hooks/useAlerts'
import { useActivityLog } from '../../hooks/useActivityLog'
import './AICenterPage.css'

function formatHHMM(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 5)   return 'just now'
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

const ACCURACY_ROWS = [
  { label: 'Jam Detection',   pct: 91, delta: '+7%',  trend: 'up' },
  { label: 'Idle Detection',  pct: 88, delta: '+3%',  trend: 'up' },
  { label: 'Error Detection', pct: 76, delta: '+12%', trend: 'up' },
]

function dotClassForPred(pred) {
  if (pred === 'JAM')     return 'warn'
  if (pred === 'ERROR' || pred === 'MACHINE_ABNORMAL' || pred === 'CONNECTION_LOST') return 'danger'
  if (pred === 'WARNING' || pred === 'SENSOR_OFFLINE') return 'warn'
  return 'neutral'
}

function predBadge(pred) {
  if (!pred) return null
  if (pred === 'JAM')     return { cls: 'jam',     label: 'JAM' }
  if (pred === 'ERROR')   return { cls: 'error',   label: 'ERROR' }
  if (pred === 'MACHINE_ABNORMAL') return { cls: 'error', label: 'MACHINE ABNORMAL' }
  if (pred === 'WARNING') return { cls: 'warning', label: 'WARNING' }
  if (pred === 'SENSOR_OFFLINE') return { cls: 'warning', label: 'SENSOR OFFLINE' }
  return null
}

export default function AICenterPage() {
  const { alerts } = useAlerts()
  const { entries } = useActivityLog()

  const totalFeedback = alerts.filter(a => a.state !== 'pending').length
  const confirmed     = alerts.filter(a => a.state === 'confirmed').length
  const corrections   = alerts.filter(a => a.state === 'wrong').length
  const pending       = alerts.filter(a => a.state === 'pending').length

  const recentEntries = entries.slice(0, 20)

  return (
    <div className="aic">
      <div className="aic-header">
        <h1 className="aic-title">AI Center</h1>
      </div>

      <div className="aic-body">
        {/* Left column */}
        <div className="aic-left">
          {/* Detection Accuracy */}
          <div className="aic-card">
            <p className="aic-card-title">Detection Accuracy</p>
            {ACCURACY_ROWS.map(({ label, pct, delta, trend }) => (
              <div key={label} className="aic-acc-row">
                <span className="aic-acc-label">{label}</span>
                <div className="aic-acc-bar-wrap">
                  <div className="aic-acc-bar" style={{ width: `${pct}%` }} />
                </div>
                <span className="aic-acc-pct">{pct}%</span>
                <span className="aic-acc-delta">{delta}</span>
              </div>
            ))}
          </div>

          {/* Operator Feedback */}
          <div className="aic-card">
            <p className="aic-card-title">Operator Feedback</p>
            <div className="aic-feedback-row">
              <div className="aic-feedback-stat">
                <div className="aic-feedback-num">
                  {totalFeedback > 0 ? totalFeedback : '—'}
                </div>
                <div className="aic-feedback-label">Total Reviewed</div>
              </div>
              <div className="aic-feedback-stat">
                <div className="aic-feedback-num" style={{ color: 'var(--green)' }}>
                  {confirmed > 0 ? confirmed : '—'}
                </div>
                <div className="aic-feedback-label">Confirmed</div>
              </div>
              <div className="aic-feedback-stat">
                <div className="aic-feedback-num" style={{ color: 'var(--cyan)' }}>
                  {corrections > 0 ? corrections : '—'}
                </div>
                <div className="aic-feedback-label">Corrections</div>
              </div>
            </div>

            {pending > 0 && (
              <div style={{
                marginTop: 12,
                padding: '8px 12px',
                borderRadius: 8,
                background: '#ef444410',
                border: '1px solid #ef444428',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>
                  {pending} alert{pending > 1 ? 's' : ''} awaiting operator review
                </span>
              </div>
            )}
          </div>

          {/* Model Info */}
          <div className="aic-card">
            <p className="aic-card-title">Model Info</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Model Type',   value: 'Rule-based + Heuristic' },
                { label: 'Input',        value: 'Distance + Timing' },
                { label: 'Latency',      value: '< 50ms' },
                { label: 'Last Updated', value: 'This session' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Event Timeline */}
        <div className="aic-timeline-wrap">
          <div className="aic-timeline-header">
            <p className="aic-card-title" style={{ margin: 0 }}>Event Timeline</p>
          </div>
          <div className="aic-timeline-list">
            {recentEntries.length === 0 ? (
              <div className="aic-empty">No events recorded yet</div>
            ) : (
              recentEntries.map((entry) => {
                const dotCls  = dotClassForPred(entry.aiPrediction)
                const badge   = predBadge(entry.aiPrediction)
                const fb      = entry.operatorFeedback
                return (
                  <div key={entry.id} className="aic-timeline-item">
                    <span className="aic-timeline-time">{formatHHMM(entry.time)}</span>
                    <span className={`aic-timeline-dot aic-timeline-dot--${dotCls}`} />
                    <span className="aic-timeline-event">{entry.event}</span>
                    {badge && (
                      <span className={`aic-timeline-pred aic-timeline-pred--${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                    {fb && (
                      <span className={`aic-timeline-feedback aic-timeline-feedback--${fb.type}`}>
                        {fb.type === 'confirm' ? '✓ Confirmed' : `✗ ${fb.label}`}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
