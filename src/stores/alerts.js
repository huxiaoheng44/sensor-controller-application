// src/stores/alerts.js
const ALERT_STATUSES = new Set(['JAM', 'ERROR', 'WARNING', 'MACHINE_ABNORMAL', 'MACHINE_OFF', 'SENSOR_OFFLINE'])
const ALERT_QUESTIONS = {
  JAM: 'Packaging jam detected?',
  ERROR: 'Machine error detected?',
  WARNING: 'Unexpected sensor behavior?',
  MACHINE_ABNORMAL: 'Machine abnormal condition detected?',
  MACHINE_OFF: 'Machine stopped unexpectedly?',
  SENSOR_OFFLINE: 'Sensor offline?',
}
const WRONG_REASONS = ['No material', 'Cleaning', 'Maintenance', 'Sensor issue', 'Unknown']
const ACK_SUPPRESSION_MS = 5 * 60 * 1000

let alerts = []
let acknowledgedUntilByStatus = {}
const listeners = new Set()

function notify() { listeners.forEach(fn => fn([...alerts])) }
export function subscribeAlerts(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function getAlerts() { return [...alerts] }

export function processSnapshot(snapshot) {
  if (!snapshot?.status) return
  const status = String(snapshot.status).toUpperCase()
  const { confidence, source, jam_duration_sec, warnings } = snapshot
  if (!ALERT_STATUSES.has(status)) return
  if ((acknowledgedUntilByStatus[status] ?? 0) > Date.now()) return
  // Deduplicate: don't add if latest pending alert has same status
  const latestPending = alerts.find(a => a.state === 'pending')
  if (latestPending?.status === status) return
  const id = Date.now() + Math.random()
  alerts = [{
    id, time: Date.now(), status,
    question: ALERT_QUESTIONS[status] ?? 'Anomaly detected?',
    confidence, source, jamDuration: jam_duration_sec ?? 0,
    warnings: warnings ?? [],
    state: 'pending', feedback: null,
  }, ...alerts].slice(0, 100)
  notify()
  // Also add to activity log
  import('./activityLog.js').then(m => m.addEntry({
    id, time: Date.now(), machine: 'Line 1',
    event: formatEvent(status), aiPrediction: status, operatorFeedback: null,
  }))
}

export function confirmAlert(id) {
  const alert = alerts.find(a => a.id === id)
  if (alert?.status) {
    acknowledgedUntilByStatus = {
      ...acknowledgedUntilByStatus,
      [alert.status]: Date.now() + ACK_SUPPRESSION_MS,
    }
  }
  alerts = alerts.map(a => a.id === id ? { ...a, state: 'confirmed' } : a)
  notify()
  import('./activityLog.js').then(m => m.updateEntry(id, { operatorFeedback: { type: 'confirm', label: 'Confirmed' } }))
}

export function wrongAlert(id, feedback) {
  const alert = alerts.find(a => a.id === id)
  if (alert?.status) {
    acknowledgedUntilByStatus = {
      ...acknowledgedUntilByStatus,
      [alert.status]: Date.now() + ACK_SUPPRESSION_MS,
    }
  }
  alerts = alerts.map(a => a.id === id ? { ...a, state: 'wrong', feedback } : a)
  notify()
  import('./activityLog.js').then(m => m.updateEntry(id, { operatorFeedback: { type: 'wrong', label: `Wrong → ${feedback.reason}` } }))
}

export { WRONG_REASONS }

function formatEvent(status) {
  return {
    JAM: 'Machine Blocked',
    ERROR: 'Machine Error',
    WARNING: 'Sensor Warning',
    MACHINE_ABNORMAL: 'Machine Abnormal',
    MACHINE_OFF: 'Machine Stopped',
    SENSOR_OFFLINE: 'Sensor Offline',
  }[status] ?? status
}
