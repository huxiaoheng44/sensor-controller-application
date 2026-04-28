import { useState, useEffect, useCallback } from 'react'

const DEFAULTS = {
  running:        true,
  sampleHz:       8,
  enterThreshold: 20.0,
  exitThreshold:  40.0,
  stableSamples:  3,
  debounceMs:     500,
}

export function useDeviceConfig(latestData, calibration, publish) {
  const [config, setConfig] = useState(DEFAULTS)

  // Mirror values reported by ESP32
  useEffect(() => {
    if (!latestData) return
    setConfig((prev) => ({
      ...prev,
      sampleHz:       latestData.sampleHz       ?? prev.sampleHz,
      enterThreshold: latestData.enterThreshold  ?? prev.enterThreshold,
      exitThreshold:  latestData.exitThreshold   ?? prev.exitThreshold,
      stableSamples:  latestData.stableSamples   ?? prev.stableSamples,
    }))
  }, [
    latestData?.sampleHz,
    latestData?.enterThreshold,
    latestData?.exitThreshold,
    latestData?.stableSamples,
  ])

  const sendConfig = useCallback(
    (next) => { setConfig(next); publish(next) },
    [publish]
  )

  return { config, sendConfig }
}
