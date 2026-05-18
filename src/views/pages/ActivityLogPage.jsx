import { useState, useMemo } from 'react'
import { useActivityLog } from '../../hooks/useActivityLog'
import './ActivityLogPage.css'

const LINES = ['All Lines', 'Line 1', 'Line 2']
const EVENT_TYPES = ['All Events', 'Machine Blocked', 'Machine Error', 'Machine Stopped', 'Sensor Warning']

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ActivityLogPage() {
  const { entries, clearLog } = useActivityLog()
  const [filterLine, setFilterLine] = useState('All Lines')
  const [filterEvent, setFilterEvent] = useState('All Events')

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterLine !== 'All Lines' && e.machine !== filterLine) return false
      if (filterEvent !== 'All Events' && e.event !== filterEvent) return false
      return true
    })
  }, [entries, filterLine, filterEvent])

  return (
    <div className="alog">
      <div className="alog-header">
        <h1 className="alog-title">Activity Log</h1>
        <div className="alog-filters">
          <select className="alog-select" value={filterLine} onChange={e => setFilterLine(e.target.value)}>
            {LINES.map(l => <option key={l}>{l}</option>)}
          </select>
          <select className="alog-select" value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
            {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          {entries.length > 0 && (
            <button className="alog-clear-btn" onClick={() => { if (confirm('Clear all activity log?')) clearLog() }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="alog-body">
        {filtered.length === 0 ? (
          <div className="alog-empty">
            <p>No entries{filterLine !== 'All Lines' || filterEvent !== 'All Events' ? ' matching filters' : ' yet'}</p>
          </div>
        ) : (
          <table className="alog-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Date</th>
                <th>Machine</th>
                <th>Event</th>
                <th>AI Prediction</th>
                <th>Operator Feedback</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr key={entry.id}>
                  <td className="alog-td-time">{formatTime(entry.time)}</td>
                  <td className="alog-td-date">{formatDate(entry.time)}</td>
                  <td>{entry.machine}</td>
                  <td className="alog-td-event">{entry.event}</td>
                  <td>
                    <span className={`alog-pred alog-pred--${(entry.aiPrediction || '').toLowerCase()}`}>
                      {entry.aiPrediction ?? '—'}
                    </span>
                  </td>
                  <td>
                    {entry.operatorFeedback ? (
                      <span className={`alog-feedback alog-feedback--${entry.operatorFeedback.type}`}>
                        {entry.operatorFeedback.label}
                      </span>
                    ) : (
                      <span className="alog-pending">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
