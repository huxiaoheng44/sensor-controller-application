import { useState, useEffect, useRef, useCallback } from 'react'
import mqtt from 'mqtt'

const BROKER_URL       = 'ws://broker.emqx.io:8083/mqtt'
const TOPIC_DISTANCE        = 'factory/line1/distance'
const TOPIC_CONFIG          = 'factory/line1/config'
const TOPIC_CONFIG_ACK      = 'factory/line1/config/ack'
const TOPIC_HEALTH          = 'factory/line1/health'
const TOPIC_VOLTAGE         = 'factory/line1/voltage'
const TOPIC_VOLTAGE_CONFIG  = 'factory/line1/voltage/config'
const TOPIC_DISTANCE_CONFIG = 'factory/line1/distance/config'
const TOPIC_DERIVED_MACHINE_STATUS  = 'factory/line1/derived/machine_status'
const TOPIC_DERIVED_DISTANCE_STATUS = 'factory/line1/derived/distance_status'
const TOPIC_DERIVED_VOLTAGE_STATUS  = 'factory/line1/derived/voltage_status'
const TOPIC_DERIVED_ITEM_COUNT      = 'factory/line1/derived/item_count'

const WINDOW_MS = 60_000
const HISTORY_MS = 24 * 60 * 60 * 1000
const HEALTH_OK_MS = 10_000
const HEALTH_STALE_MS = 30_000
const SENSOR_STALE_MS = 30_000
const STORAGE_KEY = 'esp-factory-monitor:mqtt-state:v1'

const DEFAULT_SENSOR_ACTIVITY = {
  distance: { lastSeen: null, source: null },
  current: { lastSeen: null, source: null },
}

const DEFAULT_CONFIG = {
  running: true,
  sampleHz: 20,
  enterThreshold: 20.0,
  exitThreshold: 40.0,
  heartbeatSec: 10,
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

function coerceFiniteNumber(...values) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function coerceBoolean(...values) {
  for (const value of values) {
    if (typeof value === 'boolean') return value
  }
  return null
}

function coerceString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function normalizeStatus(value) {
  return coerceString(value)?.toUpperCase() ?? null
}

function getBridgeConfigPayload(config) {
  const enterThreshold = coerceFiniteNumber(config.enterThreshold, DEFAULT_CONFIG.enterThreshold)
  const exitThreshold = coerceFiniteNumber(config.exitThreshold, DEFAULT_CONFIG.exitThreshold)

  return {
    distance: {
      enter_threshold: enterThreshold,
      exit_threshold: exitThreshold,
      clear_threshold: coerceFiniteNumber(config.clearThreshold, exitThreshold, DEFAULT_CONFIG.clearThreshold),
      jam_timeout_sec: coerceFiniteNumber(config.jamTimeoutSec, DEFAULT_CONFIG.jamTimeoutSec),
      jam_escalate_timeout_sec: coerceFiniteNumber(config.jamEscalateTimeoutSec, DEFAULT_CONFIG.jamEscalateTimeoutSec),
      offline_timeout_sec: coerceFiniteNumber(config.distanceOfflineTimeoutSec, DEFAULT_CONFIG.distanceOfflineTimeoutSec),
    },
    voltage: {
      off_threshold: coerceFiniteNumber(config.voltageOffThreshold, DEFAULT_CONFIG.voltageOffThreshold),
      idle_threshold: coerceFiniteNumber(config.voltageIdleThreshold, DEFAULT_CONFIG.voltageIdleThreshold),
      error_threshold: coerceFiniteNumber(config.voltageErrorThreshold, DEFAULT_CONFIG.voltageErrorThreshold),
      smoothing_window: coerceFiniteNumber(config.voltageSmoothingWindow, DEFAULT_CONFIG.voltageSmoothingWindow),
      offline_timeout_sec: coerceFiniteNumber(config.voltageOfflineTimeoutSec, DEFAULT_CONFIG.voltageOfflineTimeoutSec),
    },
    fusion: {
      prefer_sensor: coerceString(config.preferSensor, DEFAULT_CONFIG.preferSensor),
    },
  }
}

function getDistanceDeviceConfigPayload(config) {
  return {
    running: coerceBoolean(config.running, DEFAULT_CONFIG.running),
    sampleHz: coerceFiniteNumber(config.sampleHz, DEFAULT_CONFIG.sampleHz),
    heartbeatSec: coerceFiniteNumber(config.heartbeatSec, DEFAULT_CONFIG.heartbeatSec),
  }
}

function getLocalTimestampFields(date) {
  return {
    localTime: date.toLocaleString(undefined, { hour12: false }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffsetMinutes: -date.getTimezoneOffset(),
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStoredState() {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    if (!isPlainObject(parsed)) return {}

    const now = Date.now()
    const distanceHistory = Array.isArray(parsed.distanceHistory)
      ? parsed.distanceHistory.filter((item) => (
          isPlainObject(item) &&
          typeof item.time === 'number' &&
          now - item.time <= HISTORY_MS
        ))
      : []
    const currentSnapshotHistory = Array.isArray(parsed.currentSnapshotHistory)
      ? parsed.currentSnapshotHistory.filter((item) => (
          isPlainObject(item) &&
          typeof item.time === 'number' &&
          now - item.time <= HISTORY_MS
        ))
      : []
    const eventTimes = Array.isArray(parsed.eventTimes)
      ? parsed.eventTimes.filter((time) => typeof time === 'number' && now - time <= HISTORY_MS)
      : []

    return {
      distanceHistory,
      currentSnapshotHistory,
      eventTimes,
      mqttLog: Array.isArray(parsed.mqttLog)
        ? parsed.mqttLog.filter((item) => (
            isPlainObject(item) &&
            typeof item.time === 'number' &&
            typeof item.topic === 'string'
          ))
        : [],
      latestData: isPlainObject(parsed.latestData) ? parsed.latestData : null,
      currentSnapshot: isPlainObject(parsed.currentSnapshot) ? parsed.currentSnapshot : null,
      counter: typeof parsed.counter === 'number' && parsed.counter >= 0 ? parsed.counter : 0,
      lastDataTime: typeof parsed.lastDataTime === 'number' ? parsed.lastDataTime : null,
      sensorActivity: isPlainObject(parsed.sensorActivity)
        ? {
            distance: isPlainObject(parsed.sensorActivity.distance)
              ? { ...DEFAULT_SENSOR_ACTIVITY.distance, ...parsed.sensorActivity.distance }
              : DEFAULT_SENSOR_ACTIVITY.distance,
            current: isPlainObject(parsed.sensorActivity.current)
              ? { ...DEFAULT_SENSOR_ACTIVITY.current, ...parsed.sensorActivity.current }
              : DEFAULT_SENSOR_ACTIVITY.current,
          }
        : DEFAULT_SENSOR_ACTIVITY,
    }
  } catch (err) {
    console.warn('Failed to restore local dashboard state:', err)
    return {}
  }
}

export function useMQTT() {
  const [storedInitial] = useState(() => readStoredState())
  const [connected, setConnected]         = useState(false)
  const [connecting, setConnecting]       = useState(true)
  const [distanceHistory, setDistanceHistory] = useState(storedInitial.distanceHistory ?? [])
  const [currentSnapshotHistory, setCurrentSnapshotHistory] = useState(storedInitial.currentSnapshotHistory ?? [])
  const [latestData, setLatestData]       = useState(storedInitial.latestData ?? null)
  const [currentSnapshot, setCurrentSnapshot] = useState(storedInitial.currentSnapshot ?? null)
  const [statusData, setStatusData]       = useState(null)
  const [configAck, setConfigAck]         = useState(null)
  const [counter, setCounter]             = useState(storedInitial.counter ?? 0)
  const [eventTimes, setEventTimes]       = useState(storedInitial.eventTimes ?? [])
  const [mqttLog, setMqttLog]             = useState(storedInitial.mqttLog ?? [])
  const [lastDataTime, setLastDataTime]   = useState(storedInitial.lastDataTime ?? null)

  const [deviceHealth, setDeviceHealth] = useState({
    lastHeartbeat: null,
    onlineFlag: null,
    source: 'none',
    rssi: null,
    freeHeap: null,
    uptimeSec: null,
    fwVersion: null,
    reason: null,
  })
  const [sensorActivity, setSensorActivity] = useState(storedInitial.sensorActivity ?? DEFAULT_SENSOR_ACTIVITY)

  const [machineStatus, setMachineStatus] = useState('unknown')
  const [machineSnapshot, setMachineSnapshot] = useState(null)

  const clientRef      = useRef(null)
  const configRef      = useRef(DEFAULT_CONFIG)
  const counterRef     = useRef(storedInitial.counter ?? 0)
  const lastItemCountRef = useRef(storedInitial.counter ?? 0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        distanceHistory,
        currentSnapshotHistory,
        latestData,
        currentSnapshot,
        counter,
        eventTimes,
        mqttLog,
        lastDataTime,
        sensorActivity,
      }))
    } catch (err) {
      console.warn('Failed to persist local dashboard state:', err)
    }
  }, [distanceHistory, currentSnapshotHistory, latestData, currentSnapshot, counter, eventTimes, mqttLog, lastDataTime, sensorActivity])

  useEffect(() => {
    const clientId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `manager-ui-${crypto.randomUUID()}`
      : `manager-ui-${Math.random().toString(36).slice(2, 9)}`

    const client = mqtt.connect(BROKER_URL, {
      clientId,
      clean: true,
      connectTimeout: 10_000,
      reconnectPeriod: 4_000,
      keepalive: 30,
    })

    clientRef.current = client

    client.on('connect', () => {
      setConnected(true)
      setConnecting(false)
      client.subscribe(
        [
          TOPIC_DERIVED_MACHINE_STATUS,
          TOPIC_DERIVED_DISTANCE_STATUS,
          TOPIC_DERIVED_VOLTAGE_STATUS,
          TOPIC_DERIVED_ITEM_COUNT,
          TOPIC_CONFIG_ACK,
          TOPIC_DISTANCE,
          TOPIC_VOLTAGE,
          TOPIC_HEALTH,
        ],
        { qos: 0 },
        (err) => { if (err) console.error('Subscribe error:', err) }
      )
    })

    client.on('reconnect', () => { setConnected(false); setConnecting(true) })
    client.on('close',     () => { setConnected(false); setConnecting(false) })
    client.on('error',     (err) => { console.error('MQTT error:', err); setConnected(false) })

    client.on('message', (topic, payload) => {
      const now = Date.now()
      const raw = payload.toString()
      let data = raw
      try {
        data = JSON.parse(raw)
      } catch {
        data = raw
      }

      setMqttLog((prev) => ([
        ...prev,
        {
          time: now,
          isoTime: new Date(now).toISOString(),
          ...getLocalTimestampFields(new Date(now)),
          topic,
          payload: raw,
          parsed: data,
        },
      ]))

      const markHeartbeat = (source, patch = {}) => {
        setDeviceHealth((prev) => ({
          ...prev,
          ...patch,
          source,
          lastHeartbeat: now,
        }))
      }

      const markSensor = (sensorId, source) => {
        setSensorActivity((prev) => ({
          ...prev,
          [sensorId]: {
            lastSeen: now,
            source,
          },
        }))
      }

      const patchHealthFromSnapshot = (source, sourceData) => {
        if (!isPlainObject(sourceData)) return
        const patch = {}
        if (typeof sourceData.online === 'boolean') patch.onlineFlag = sourceData.online
        if (typeof sourceData.uptime === 'number') patch.uptimeSec = sourceData.uptime
        if (typeof sourceData.uptimeSec === 'number') patch.uptimeSec = sourceData.uptimeSec
        if (typeof sourceData.reason === 'string') patch.reason = sourceData.reason
        markHeartbeat(source, patch)
      }

      const buildDistancePoint = (sourceData, statusPatch = {}) => ({
        time: now,
        distance: typeof sourceData === 'number'
          ? sourceData
          : coerceFiniteNumber(sourceData?.distance, sourceData?.distanceCm, sourceData?.last_distance, sourceData?.cm),
        detected: false,
        objectBlocking: coerceBoolean(statusPatch.objectBlocking, statusPatch.blocking) ?? false,
        diff: null,
        minDistance: null,
        ...statusPatch,
      })

      const readVoltage = (sourceData) => {
        if (typeof sourceData === 'number') return sourceData
        if (!isPlainObject(sourceData)) return null
        if (typeof sourceData.voltage === 'number') return sourceData.voltage
        if (typeof sourceData.voltageV === 'number') return sourceData.voltageV
        if (typeof sourceData.last_voltage === 'number') return sourceData.last_voltage
        if (typeof sourceData.average_voltage === 'number') return sourceData.average_voltage
        if (typeof sourceData.v === 'number') return sourceData.v
        return null
      }

      const readItemCount = (sourceData) => {
        if (!isPlainObject(sourceData)) return null
        return coerceFiniteNumber(
          sourceData.count,
          sourceData.item_count,
          sourceData.total,
          sourceData.value,
        )
      }

      const patchConfigFromBridge = (sourceData) => {
        if (!isPlainObject(sourceData)) return
        const distance = isPlainObject(sourceData.distance) ? sourceData.distance : {}
        const voltage = isPlainObject(sourceData.voltage) ? sourceData.voltage : {}
        const fusion = isPlainObject(sourceData.fusion) ? sourceData.fusion : {}
        const next = {
          ...configRef.current,
          enterThreshold: coerceFiniteNumber(distance.enter_threshold, sourceData.enter_threshold, configRef.current.enterThreshold),
          exitThreshold: coerceFiniteNumber(distance.exit_threshold, sourceData.exit_threshold, configRef.current.exitThreshold),
          clearThreshold: coerceFiniteNumber(distance.clear_threshold, sourceData.clear_threshold, configRef.current.clearThreshold),
          jamTimeoutSec: coerceFiniteNumber(distance.jam_timeout_sec, sourceData.jam_timeout_sec, configRef.current.jamTimeoutSec),
          jamEscalateTimeoutSec: coerceFiniteNumber(distance.jam_escalate_timeout_sec, sourceData.jam_escalate_timeout_sec, configRef.current.jamEscalateTimeoutSec),
          distanceOfflineTimeoutSec: coerceFiniteNumber(distance.offline_timeout_sec, sourceData.distance_offline_timeout_sec, configRef.current.distanceOfflineTimeoutSec),
          voltageOffThreshold: coerceFiniteNumber(voltage.off_threshold, configRef.current.voltageOffThreshold),
          voltageIdleThreshold: coerceFiniteNumber(voltage.idle_threshold, configRef.current.voltageIdleThreshold),
          voltageErrorThreshold: coerceFiniteNumber(voltage.error_threshold, configRef.current.voltageErrorThreshold),
          voltageSmoothingWindow: coerceFiniteNumber(voltage.smoothing_window, configRef.current.voltageSmoothingWindow),
          voltageOfflineTimeoutSec: coerceFiniteNumber(voltage.offline_timeout_sec, configRef.current.voltageOfflineTimeoutSec),
          preferSensor: coerceString(fusion.prefer_sensor, configRef.current.preferSensor),
        }
        configRef.current = next
        setStatusData(next)
      }

      try {
        if (topic === TOPIC_DERIVED_MACHINE_STATUS) {
          if (isPlainObject(data)) {
            const status = normalizeStatus(data.status) ?? normalizeStatus(data.machine_status) ?? normalizeStatus(data.state) ?? 'UNKNOWN'
            const itemCount = readItemCount(data)
            setMachineStatus(status)
            setMachineSnapshot({
              ...data,
              status,
              receivedAt: now,
            })
            if (itemCount != null) {
              const normalized = Math.max(0, Math.floor(itemCount))
              const previous = lastItemCountRef.current
              counterRef.current = normalized
              lastItemCountRef.current = normalized
              setCounter(normalized)
              if (normalized > previous) {
                setEventTimes((prev) => {
                  const cutoff = now - HISTORY_MS
                  return [...prev.filter((t) => t > cutoff), now]
                })
              }
            }
            setLatestData((prev) => ({
              ...(isPlainObject(prev) ? prev : {}),
              objectBlocking: status === 'JAM',
              machineStatus: status,
              distanceState: normalizeStatus(data.distance_status),
              voltageState: normalizeStatus(data.voltage_status),
              jamDurationSec: coerceFiniteNumber(data.jam_duration_sec),
            }))
            setLastDataTime(now)
            const patch = {}
            const onlineFlag = coerceBoolean(data.online, data.is_online)
            const reason = coerceString(data.reason, data.message)
            if (onlineFlag != null) patch.onlineFlag = onlineFlag
            if (reason != null) patch.reason = reason
            markHeartbeat('derived/machine_status', patch)
          }

        } else if (topic === TOPIC_DERIVED_ITEM_COUNT) {
          markHeartbeat('derived/item_count')
          const nextCount = readItemCount(data)
          if (nextCount != null) {
            const normalized = Math.max(0, Math.floor(nextCount))
            const previous = lastItemCountRef.current
            counterRef.current = normalized
            lastItemCountRef.current = normalized
            setCounter(normalized)
            if (normalized > previous) {
              setEventTimes((prev) => {
                const cutoff = now - HISTORY_MS
                return [...prev.filter((t) => t > cutoff), now]
              })
            }
          }
          setLastDataTime(now)

        } else if (topic === TOPIC_DERIVED_DISTANCE_STATUS) {
          markHeartbeat('derived/distance_status')
          markSensor('distance', 'derived/distance_status')
          setLastDataTime(now)
          if (isPlainObject(data)) {
            const point = buildDistancePoint(data, {
              objectBlocking: coerceBoolean(data.object_blocking, data.objectBlocking, data.blocking, data.jammed) ?? normalizeStatus(data.status) === 'JAM',
              distanceState: normalizeStatus(data.status) ?? normalizeStatus(data.state),
              normalizedStatus: normalizeStatus(data.normalized_status),
              jammed: coerceBoolean(data.jammed, data.is_jammed),
              offline: coerceBoolean(data.offline, data.is_offline),
              stateDurationSec: coerceFiniteNumber(data.state_duration_sec),
            })
            setLatestData((prev) => ({
              ...(isPlainObject(prev) ? prev : {}),
              ...point,
              ts: data.ts,
            }))
            if (point.distance != null) {
              setDistanceHistory((prev) => {
                const cutoff  = now - HISTORY_MS
                const trimmed = prev.filter((p) => p.time > cutoff)
                return [...trimmed, point]
              })
            }
          }

        } else if (topic === TOPIC_DERIVED_VOLTAGE_STATUS) {
          markHeartbeat('derived/voltage_status')
          markSensor('current', 'derived/voltage_status')
          setLastDataTime(now)
          if (isPlainObject(data)) {
            const voltage = readVoltage(data)
            const status = normalizeStatus(data.status) ?? normalizeStatus(data.state) ?? normalizeStatus(data.machine_status)
            setCurrentSnapshot({
              ...data,
              receivedAt: now,
              voltage,
              voltageStatus: status,
            })
            if (voltage != null) {
              setCurrentSnapshotHistory((prev) => {
                const cutoff = now - HISTORY_MS
                const trimmed = prev.filter((p) => p.time > cutoff)
                return [
                  ...trimmed,
                  {
                    time: now,
                    voltage,
                    detected: false,
                    objectBlocking: false,
                    diff: null,
                    minDistance: null,
                    online: coerceBoolean(data.online, data.is_online),
                    reason: data.reason ?? null,
                    voltageStatus: status,
                  },
                ]
              })
            }
          }

        } else if (topic === TOPIC_CONFIG_ACK) {
          setConfigAck(isPlainObject(data) ? { ...data, receivedAt: now } : { value: data, receivedAt: now })
          patchConfigFromBridge(data)

        } else if (topic === TOPIC_DISTANCE) {
          markSensor('distance', 'distance')
          setLastDataTime(now)
          const point = buildDistancePoint(data)
          setLatestData((prev) => ({
            ...(isPlainObject(prev) ? prev : {}),
            time: point.time,
            distance: point.distance,
            diff: point.diff,
            ts: isPlainObject(data) ? data.ts : undefined,
          }))
          if (point.distance != null) {
            setDistanceHistory((prev) => {
              const cutoff  = now - HISTORY_MS
              const trimmed = prev.filter((p) => p.time > cutoff)
              return [...trimmed, point]
            })
          }

        } else if (topic === TOPIC_VOLTAGE) {
          patchHealthFromSnapshot('voltage', data)
          markSensor('current', 'current')
          if (isPlainObject(data)) {
            const voltage = readVoltage(data)
            setLastDataTime(now)
            setCurrentSnapshot({
              ...data,
              receivedAt: now,
              voltage,
            })
            if (voltage != null) {
              setCurrentSnapshotHistory((prev) => {
                const cutoff = now - HISTORY_MS
                const trimmed = prev.filter((p) => p.time > cutoff)
                return [
                  ...trimmed,
                  {
                    time: now,
                    voltage,
                    detected: false,
                    objectBlocking: false,
                    diff: null,
                    minDistance: null,
                    online: data.online,
                    reason: data.reason ?? null,
                    machineStatus,
                  },
                ]
              })
            }
            setLatestData((prev) => ({
              ...(isPlainObject(prev) ? prev : {}),
              ts: data.ts,
              online: data.online,
              uptime: data.uptime,
              reason: data.reason,
            }))
          }

        } else if (topic === TOPIC_HEALTH) {
          const patch = {}

          if (typeof data === 'object' && data !== null) {
            if (typeof data.online === 'boolean') patch.onlineFlag = data.online
            if (typeof data.rssi === 'number') patch.rssi = data.rssi
            if (typeof data.freeHeap === 'number') patch.freeHeap = data.freeHeap
            if (typeof data.uptime === 'number') patch.uptimeSec = data.uptime
            if (typeof data.uptimeSec === 'number') patch.uptimeSec = data.uptimeSec
            if (typeof data.fwVersion === 'string') patch.fwVersion = data.fwVersion
            if (typeof data.reason === 'string') patch.reason = data.reason
          } else if (typeof data === 'string') {
            const normalized = data.trim().toLowerCase()
            if (normalized === 'online') patch.onlineFlag = true
            if (normalized === 'offline') patch.onlineFlag = false
            if (normalized) patch.reason = data.trim()
          }

          markHeartbeat('health', patch)
        }
      } catch (e) {
        console.error('MQTT parse error:', e)
      }
    })

    return () => {
      client.end(true)
    }
  }, [])

  const publish = useCallback((config) => {
    const client = clientRef.current
    if (client?.connected) {
      client.publish(TOPIC_DISTANCE_CONFIG, JSON.stringify(getDistanceDeviceConfigPayload(config)), { qos: 0, retain: true })
      client.publish(TOPIC_CONFIG, JSON.stringify(getBridgeConfigPayload(config)), { qos: 0, retain: true })
    }
  }, [])

  const updateRuntimeConfig = useCallback((next) => {
    configRef.current = { ...configRef.current, ...next }
  }, [])

  const resetCounter = useCallback(() => {
    counterRef.current = 0
    lastItemCountRef.current = 0
    setCounter(0)
    setEventTimes([])
  }, [])

  const setSimulatedVoltage = useCallback((voltage) => {
    const client = clientRef.current
    const value = Number(voltage)
    if (!client?.connected || !Number.isFinite(value)) return
    client.publish(TOPIC_VOLTAGE_CONFIG, JSON.stringify({ voltage: value }), { qos: 0, retain: true })
  }, [])

  const exportMQTTLog = useCallback(() => {
    if (typeof window === 'undefined') return

    const createdAt = new Date()
    const payload = {
      exportedAt: createdAt.toISOString(),
      exportedAtLocal: createdAt.toLocaleString(undefined, { hour12: false }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffsetMinutes: -createdAt.getTimezoneOffset(),
      brokerUrl: BROKER_URL,
      messageCount: mqttLog.length,
      messages: mqttLog,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = window.document.createElement('a')
    const stamp = createdAt.toISOString().replace(/[:.]/g, '-')

    link.href = url
    link.download = `mqtt-log-${stamp}.json`
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }, [mqttLog])

  const now = Date.now()
  const frequency = eventTimes.filter((t) => now - t < WINDOW_MS).length
  const heartbeatAgeMs = deviceHealth.lastHeartbeat ? now - deviceHealth.lastHeartbeat : null

  const sensorConnections = [
    {
      id: 'distance',
      label: 'Distance Sensor',
      shortLabel: 'Distance',
      lastSeen: sensorActivity.distance.lastSeen,
      ageMs: sensorActivity.distance.lastSeen ? now - sensorActivity.distance.lastSeen : null,
      source: sensorActivity.distance.source,
    },
    {
      id: 'current',
      label: 'Current Sensor',
      shortLabel: 'Current',
      lastSeen: sensorActivity.current.lastSeen,
      ageMs: sensorActivity.current.lastSeen ? now - sensorActivity.current.lastSeen : null,
      source: sensorActivity.current.source,
    },
  ].map((sensor) => ({
    ...sensor,
    connected: connected &&
      deviceHealth.onlineFlag !== false &&
      heartbeatAgeMs != null &&
      heartbeatAgeMs <= HEALTH_STALE_MS &&
      sensor.lastSeen != null &&
      now - sensor.lastSeen <= SENSOR_STALE_MS,
    stale: connected &&
      deviceHealth.onlineFlag !== false &&
      sensor.lastSeen != null &&
      (
        heartbeatAgeMs == null ||
        heartbeatAgeMs > HEALTH_STALE_MS ||
        now - sensor.lastSeen > SENSOR_STALE_MS
      ),
  }))

  let healthStatus = 'waiting'
  if (!connected) {
    healthStatus = 'broker_offline'
  } else if (deviceHealth.onlineFlag === false) {
    healthStatus = 'device_offline'
  } else if (heartbeatAgeMs == null) {
    healthStatus = 'waiting'
  } else if (heartbeatAgeMs <= HEALTH_OK_MS) {
    healthStatus = 'online'
  } else if (heartbeatAgeMs <= HEALTH_STALE_MS) {
    healthStatus = 'degraded'
  } else {
    healthStatus = 'device_offline'
  }

  return {
    connected,
    connecting,
    distanceHistory,
    currentSnapshotHistory,
    latestData,
    currentSnapshot,
    statusData,
    configAck,
    counter,
    frequency,
    eventTimes,
    mqttLog,
    lastDataTime,
    machineStatus,
    machineSnapshot,
    deviceHealth: {
      ...deviceHealth,
      ageMs: heartbeatAgeMs,
      status: healthStatus,
    },
    publish,
    updateRuntimeConfig,
    resetCounter,
    setSimulatedVoltage,
    exportMQTTLog,
    sensorConnections,
  }
}
