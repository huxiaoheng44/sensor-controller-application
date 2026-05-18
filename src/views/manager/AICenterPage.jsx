import { useAlerts } from '../../hooks/useAlerts'
import { useActivityLog } from '../../hooks/useActivityLog'
import './AICenterPage.css'

function formatHHMM(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

const ACCURACY_ROWS = [
  { label: 'Jam Detection',   pct: 91, delta: '+7%'  },
  { label: 'Idle Detection',  pct: 88, delta: '+3%'  },
  { label: 'Error Detection', pct: 76, delta: '+12%' },
]

const MODEL_INFO = [
  { label: 'Model Type',   value: 'Rule-based + Heuristic' },
  { label: 'Input',        value: 'Distance + Timing'      },
  { label: 'Latency',      value: '< 50ms'                 },
  { label: 'Last Updated', value: 'This session'           },
]

const MOCK_EVENTS = [
  { id: 'm1', time: '10:31', event: 'Throughput unstable',    dot: 'warn',    badge: { cls: 'warning', label: 'WARNING' }, fb: null },
  { id: 'm2', time: '10:33', event: 'Current spike detected', dot: 'warn',    badge: { cls: 'warning', label: 'WARNING' }, fb: null },
  { id: 'm3', time: '10:34', event: 'Possible jam detected',  dot: 'jam',     badge: { cls: 'jam',     label: 'JAM'     }, fb: null },
  { id: 'm4', time: '10:35', event: 'Operator confirmed jam', dot: 'ok',      badge: null,                                 fb: '✓ Confirmed' },
  { id: 'm5', time: '10:36', event: 'AI confidence updated',  dot: 'neutral', badge: null,                                 fb: null },
]

function dotClassForPred(pred) {
  if (pred === 'JAM')     return 'jam'
  if (pred === 'ERROR')   return 'danger'
  if (pred === 'WARNING') return 'warn'
  return 'neutral'
}

function badgeForPred(pred) {
  if (pred === 'JAM')     return { cls: 'jam',     label: 'JAM'     }
  if (pred === 'ERROR')   return { cls: 'error',   label: 'ERROR'   }
  if (pred === 'WARNING') return { cls: 'warning', label: 'WARNING' }
  return null
}

export default function AICenterPage() {
  const { alerts } = useAlerts()
  const { entries } = useActivityLog()

  const totalFeedback = alerts.filter(a => a.state !== 'pending').length
  const confirmed     = alerts.filter(a => a.state === 'confirmed').length
  const corrections   = alerts.filter(a => a.state === 'wrong').length
  const pending       = alerts.filter(a => a.state === 'pending').length

  // Use real values or fall back to mock
  const displayTotal       = totalFeedback > 0 ? totalFeedback : 142
  const displayConfirmed   = totalFeedback > 0 ? confirmed     : 124
  const displayCorrections = totalFeedback > 0 ? corrections   : 18

  // Real timeline entries, fall back to mock if empty
  const timelineItems = entries.length > 0
    ? entries.slice(0, 20).map(e => ({
        id:    e.id,
        time:  formatHHMM(e.time),
        event: e.event,
        dot:   dotClassForPred(e.aiPrediction),
        badge: badgeForPred(e.aiPrediction),
        fb:    e.operatorFeedback
               ? (e.operatorFeedback.type === 'confirm' ? '✓ Confirmed' : `✗ ${e.operatorFeedback.label}`)
               : null,
      }))
    : MOCK_EVENTS

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
