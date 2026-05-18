// src/stores/activityLog.js
const STORAGE_KEY = 'factory-monitor:activity-log:v1'
const MAX_ENTRIES = 200

function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] } }
function save(log) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(log)) } catch {} }

let log = load()
const listeners = new Set()

function notify() { listeners.forEach(fn => fn([...log])) }
export function subscribeLog(fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function getLog() { return [...log] }

export function addEntry(entry) {
  log = [entry, ...log].slice(0, MAX_ENTRIES)
  save(log)
  notify()
}

export function updateEntry(id, updates) {
  log = log.map(e => e.id === id ? { ...e, ...updates } : e)
  save(log)
  notify()
}

export function clearLog() { log = []; save(log); notify() }
