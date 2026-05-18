import { createContext, useContext } from 'react'
import { useMQTT } from '../hooks/useMQTT'
import { useDeviceConfig } from '../hooks/useDeviceConfig'

const MQTTContext = createContext(null)

export function MQTTProvider({ children }) {
  const mqtt = useMQTT()
  const { config, sendConfig } = useDeviceConfig(
    mqtt.statusData,
    mqtt.publish,
    mqtt.updateRuntimeConfig,
  )
  return (
    <MQTTContext.Provider value={{ ...mqtt, config, sendConfig }}>
      {children}
    </MQTTContext.Provider>
  )
}

export function useMQTTContext() {
  const ctx = useContext(MQTTContext)
  if (!ctx) throw new Error('useMQTTContext must be used within MQTTProvider')
  return ctx
}
