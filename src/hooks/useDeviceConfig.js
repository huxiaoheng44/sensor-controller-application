import { useState, useEffect, useCallback } from 'react'

const DEFAULTS = {
  running:        true,
  sampleHz:       20,
  enterThreshold: 20.0,
  exitThreshold:  40.0,
  heartbeatSec:   10,
  clearThreshold: 40.0,
  jamTimeoutSec: 30,
  jamEscalateTimeoutSec: 120,
  distanceOfflineTimeoutSec: 10,
  voltageOffThreshold: 1.0,
  voltageIdleThreshold: 12.0,
  voltageErrorThreshold: 28.5,
  voltageSmoothingWindow: 8,
  voltageOfflineTimeoutSec: 10,
  preferSensor: 'distance',
}

export function useDeviceConfig(statusData, publish, updateRuntimeConfig) {
  const [config, setConfig] = useState(() => ({
    ...DEFAULTS,
    ...(statusData ?? {}),
  }))

  // Mirror low-frequency config status reported by ESP32.
  useEffect(() => {
    if (!statusData) return
    const next = (prev) => ({
      ...prev,
      running:        typeof statusData.running === 'boolean' ? statusData.running : prev.running,
      sampleHz:       statusData.sampleHz       ?? prev.sampleHz,
      enterThreshold: statusData.enterThreshold  ?? prev.enterThreshold,
      exitThreshold:  statusData.exitThreshold   ?? prev.exitThreshold,
      heartbeatSec:   statusData.heartbeatSec    ?? prev.heartbeatSec,
      clearThreshold: statusData.clearThreshold ?? prev.clearThreshold,
      jamTimeoutSec: statusData.jamTimeoutSec ?? prev.jamTimeoutSec,
      jamEscalateTimeoutSec: statusData.jamEscalateTimeoutSec ?? prev.jamEscalateTimeoutSec,
      distanceOfflineTimeoutSec: statusData.distanceOfflineTimeoutSec ?? prev.distanceOfflineTimeoutSec,
      voltageOffThreshold: statusData.voltageOffThreshold ?? prev.voltageOffThreshold,
      voltageIdleThreshold: statusData.voltageIdleThreshold ?? prev.voltageIdleThreshold,
      voltageErrorThreshold: statusData.voltageErrorThreshold ?? prev.voltageErrorThreshold,
      voltageSmoothingWindow: statusData.voltageSmoothingWindow ?? prev.voltageSmoothingWindow,
      voltageOfflineTimeoutSec: statusData.voltageOfflineTimeoutSec ?? prev.voltageOfflineTimeoutSec,
      preferSensor: statusData.preferSensor ?? prev.preferSensor,
    })
    setConfig((prev) => {
      const updated = next(prev)
      updateRuntimeConfig?.(updated)
      return updated
    })
  }, [
    statusData?.running,
    statusData?.sampleHz,
    statusData?.enterThreshold,
    statusData?.exitThreshold,
    statusData?.heartbeatSec,
    statusData?.clearThreshold,
    statusData?.jamTimeoutSec,
    statusData?.jamEscalateTimeoutSec,
    statusData?.distanceOfflineTimeoutSec,
    statusData?.voltageOffThreshold,
    statusData?.voltageIdleThreshold,
    statusData?.voltageErrorThreshold,
    statusData?.voltageSmoothingWindow,
    statusData?.voltageOfflineTimeoutSec,
    statusData?.preferSensor,
    updateRuntimeConfig,
  ])

  const sendConfig = useCallback(
    (next) => {
      setConfig(next)
      updateRuntimeConfig?.(next)
      publish(next)
    },
    [publish, updateRuntimeConfig]
  )

  return { config, sendConfig }
}
