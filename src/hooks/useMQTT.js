import { useState, useEffect, useRef, useCallback } from 'react'
import mqtt from 'mqtt'

const BROKER_URL = 'ws://broker.emqx.io:8083/mqtt'
const TOPIC_DISTANCE = 'factory/line1/distance'
const TOPIC_EVENT    = 'factory/line1/event'
const TOPIC_CONFIG   = 'factory/line1/config'
const TOPIC_STATUS   = 'factory/line1/status'
const WINDOW_MS = 60_000
const CALIB_TIMEOUT_MS = 15_000   // give up after 15s if no status reply

const CALIB_IDLE        = 'idle'
const CALIB_IN_PROGRESS = 'in_progress'
const CALIB_DONE        = 'done'
const CALIB_TIMEOUT     = 'timeout'

export function useMQTT() {
  const [connected, setConnected]         = useState(false)
  const [connecting, setConnecting]       = useState(true)
  const [distanceHistory, setDistanceHistory] = useState([])
  const [latestData, setLatestData]       = useState(null)
  const [counter, setCounter]             = useState(0)
  const [eventTimes, setEventTimes]       = useState([])
  const [lastDataTime, setLastDataTime]   = useState(null)

  // Calibration state: { status, baseline, ts }
  const [calibration, setCalibration] = useState({
    status: CALIB_IDLE,
    baseline: null,   // new baseline received from ESP32
    ts: null,         // timestamp when done/timeout occurred
  })

  const clientRef      = useRef(null)
  const calibTimerRef  = useRef(null)  // timeout handle

  // Clear any pending calibration timeout
  function clearCalibTimer() {
    if (calibTimerRef.current) {
      clearTimeout(calibTimerRef.current)
      calibTimerRef.current = null
    }
  }

  useEffect(() => {
    const clientId = `web_${Math.random().toString(36).slice(2, 9)}`

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
        [TOPIC_DISTANCE, TOPIC_EVENT, TOPIC_STATUS],
        { qos: 0 },
        (err) => { if (err) console.error('Subscribe error:', err) }
      )
    })

    client.on('reconnect', () => { setConnected(false); setConnecting(true) })
    client.on('close',     () => { setConnected(false); setConnecting(false) })
    client.on('error',     (err) => { console.error('MQTT error:', err); setConnected(false) })

    client.on('message', (topic, payload) => {
      const now = Date.now()
      try {
        const data = JSON.parse(payload.toString())

        if (topic === TOPIC_DISTANCE) {
          setLastDataTime(now)
          setLatestData(data)
          setDistanceHistory((prev) => {
            const cutoff  = now - WINDOW_MS
            const trimmed = prev.filter((p) => p.time > cutoff)
            return [
              ...trimmed,
              {
                time:           now,
                distance:       typeof data.distance === 'number'
                  ? Math.round(data.distance * 10) / 10
                  : null,
                baseline:       data.baseline       ?? null,
                detected:       data.detected       ?? false,
                objectBlocking: data.objectBlocking ?? false,
                diff:           typeof data.diff === 'number'
                  ? Math.round(data.diff * 10) / 10
                  : null,
                minDistance:    data.minDistance    ?? null,
              },
            ]
          })

        } else if (topic === TOPIC_EVENT) {
          if (data.detected) {
            setCounter((c) => c + 1)
            setEventTimes((prev) => {
              const cutoff = now - WINDOW_MS
              return [...prev.filter((t) => t > cutoff), now]
            })
          }

        } else if (topic === TOPIC_STATUS) {
          // ESP32 publishes here after calibration completes.
          // Expected payload: { "baseline": 82.3 }  (plus any other fields)
          // Also handle { "calibrating": true } if device sends an in-progress ping.
          if (data.calibrating === true) {
            // Device confirmed it started – keep in_progress, reset timeout
            clearCalibTimer()
            calibTimerRef.current = setTimeout(() => {
              setCalibration({ status: CALIB_TIMEOUT, baseline: null, ts: Date.now() })
            }, CALIB_TIMEOUT_MS)
          } else if (typeof data.baseline === 'number') {
            // Calibration complete
            clearCalibTimer()
            setCalibration({ status: CALIB_DONE, baseline: data.baseline, ts: now })
          }
        }
      } catch (e) {
        console.error('MQTT parse error:', e)
      }
    })

    return () => {
      clearCalibTimer()
      client.end(true)
    }
  }, [])

  // Send {"calibrate": true} to config topic and start timeout watchdog
  const triggerCalibration = useCallback(() => {
    const client = clientRef.current
    if (!client?.connected) return

    clearCalibTimer()
    setCalibration({ status: CALIB_IN_PROGRESS, baseline: null, ts: null })
    client.publish(TOPIC_CONFIG, JSON.stringify({ calibrate: true }), { qos: 0, retain: false })

    calibTimerRef.current = setTimeout(() => {
      setCalibration({ status: CALIB_TIMEOUT, baseline: null, ts: Date.now() })
    }, CALIB_TIMEOUT_MS)
  }, [])

  const publish = useCallback((config) => {
    const client = clientRef.current
    if (client?.connected) {
      client.publish(TOPIC_CONFIG, JSON.stringify(config), { qos: 0, retain: true })
    }
  }, [])

  const resetCounter = useCallback(() => {
    setCounter(0)
    setEventTimes([])
  }, [])

  const resetCalibration = useCallback(() => {
    clearCalibTimer()
    setCalibration({ status: CALIB_IDLE, baseline: null, ts: null })
  }, [])

  const now = Date.now()
  const frequency = eventTimes.filter((t) => now - t < WINDOW_MS).length

  return {
    connected,
    connecting,
    distanceHistory,
    latestData,
    counter,
    frequency,
    eventTimes,
    lastDataTime,
    calibration,
    publish,
    resetCounter,
    triggerCalibration,
    resetCalibration,
  }
}
