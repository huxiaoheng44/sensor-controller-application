import { useState, useEffect } from 'react'
import { subscribeLog, getLog, clearLog } from '../stores/activityLog'

export function useActivityLog() {
  const [entries, setEntries] = useState(getLog)
  useEffect(() => subscribeLog(setEntries), [])
  return { entries, clearLog }
}
