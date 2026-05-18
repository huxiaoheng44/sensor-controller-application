// src/stores/alerts.js
const ALERT_STATUSES = new Set(['JAM', 'ERROR', 'WARNING', 'MACHINE_OFF'])
const ALERT_QUESTIONS = {
  JAM: 'Packaging jam detected?',
  ERROR: 'Machine error detected?',
  WARNING: 'Unexpected sensor behavior?',
  MACHINE_OFF: 'Machine stopped unexpectedly?',
}
const WRONG_REASONS = ['No material', 'Cleaning', 'Maintenance', 'Sensor issue', 'Unknown']

let alerts = []
const listeners = new Set()

function notify() { listeners.forEach(fn => fn([...alerts])) }
export function subscribeAlerts(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function getAlerts() { return [...alerts] }

export function processSnapshot(snapshot) {
  if (!snapshot?.status) return
  const { status, confidence, source, jam_duration_sec, warnings } = snapshot
  if (!ALERT_STATUSES.has(status)) return
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
  alerts = alerts.map(a => a.id === id ? { ...a, state: 'confirmed' } : a)
  notify()
  import('./activityLog.js').then(m => m.updateEntry(id, { operatorFeedback: { type: 'confirm', label: 'Confirmed' } }))
}

export function wrongAlert(id, feedback) {
  alerts = alerts.map(a => a.id === id ? { ...a, state: 'wrong', feedback } : a)
  notify()
  import('./activityLog.js').then(m => m.updateEntry(id, { operatorFeedback: { type: 'wrong', label: `Wrong → ${feedback.reason}` } }))
}

export { WRONG_REASONS }

function formatEvent(status) {
  return { JAM: 'Machine Blocked', ERROR: 'Machine Error', WARNING: 'Sensor Warning', MACHINE_OFF: 'Machine Stopped' }[status] ?? status
}
