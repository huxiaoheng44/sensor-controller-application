import { useState, useEffect } from 'react'
import { useMQTTContext } from '../context/MQTTContext'
import { subscribeAlerts, getAlerts, processSnapshot, confirmAlert, wrongAlert } from '../stores/alerts'

export function useAlerts() {
  const { machineSnapshot } = useMQTTContext()
  const [alerts, setAlerts] = useState(getAlerts)

  useEffect(() => subscribeAlerts(setAlerts), [])
  useEffect(() => { processSnapshot(machineSnapshot) }, [machineSnapshot])

  const pendingCount = alerts.filter(a => a.state === 'pending').length
  return { alerts, pendingCount, confirmAlert, wrongAlert }
}
