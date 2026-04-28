import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMQTT } from './hooks/useMQTT'
import { useDeviceConfig } from './hooks/useDeviceConfig'
import DistanceChart from './components/DistanceChart'
import './App.css'

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false })
}

export default function App() {
  const {
    connected,
    connecting,
    distanceHistory,
    latestData,
    counter,
    frequency,
    eventTimes,
    lastDataTime,
    deviceHealth,
    calibration,
    publish,
    resetCounter,
    triggerCalibration,
    resetCalibration,
  } = useMQTT()

  const { config, sendConfig } = useDeviceConfig(latestData, calibration, publish)

  const [tick, setTick] = useState(0)
  const [frozenHistory, setFrozenHistory] = useState(null)
  const prevRunningRef = useRef(true)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (prevRunningRef.current && !config.running) {
      setFrozenHistory([...distanceHistory])
    } else if (!prevRunningRef.current && config.running) {
      setFrozenHistory(null)
    }
    prevRunningRef.current = config.running
  }, [config.running]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleRunning() {
    sendConfig({ ...config, running: !config.running })
  }

  function handleEnterThreshold(e) {
    sendConfig({ ...config, enterThreshold: parseFloat(e.target.value) })
  }

  function handleExitThreshold(e) {
    sendConfig({ ...config, exitThreshold: parseFloat(e.target.value) })
  }

  function handleStableSamples(e) {
    sendConfig({ ...config, stableSamples: parseInt(e.target.value, 10) })
  }

  function handleSampleHz(e) {
    sendConfig({ ...config, sampleHz: parseFloat(e.target.value) })
  }

  function handleDebounce(e) {
    sendConfig({ ...config, debounceMs: parseInt(e.target.value, 10) })
  }

  const distance    = latestData?.distance      ?? null
  const isBlocking  = latestData?.objectBlocking ?? false
  const staleSecs   = lastDataTime ? Math.floor((Date.now() - lastDataTime) / 1000) : null
  const isStale     = staleSecs !== null && staleSecs > 5

  const chartData = frozenHistory ?? distanceHistory

  const connLabel = connected ? 'MQTT Connected' : connecting ? 'Connecting...' : 'MQTT Disconnected'
  const connColor = connected ? '#22c55e' : connecting ? '#f59e0b' : '#ef4444'
  const healthAgeSecs = deviceHealth.ageMs != null ? Math.floor(deviceHealth.ageMs / 1000) : null

  const healthMeta = {
    online: { label: 'Device Online', color: '#22c55e' },
    degraded: { label: 'Heartbeat Delayed', color: '#f59e0b' },
    device_offline: { label: 'Device Offline', color: '#ef4444' },
    broker_offline: { label: 'Broker Offline', color: '#ef4444' },
    waiting: { label: 'Waiting Heartbeat', color: '#64748b' },
  }[deviceHealth.status]

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-title">
          <svg className="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          ESP32 Factory Counter
        </div>

        <div className="app-header-right">
          <div className="conn-badge" style={{ '--conn-color': connColor }}>
            <span className="conn-dot" />
            <span>{connLabel}</span>
          </div>
          <div className="health-badge" style={{ '--health-color': healthMeta.color }}>
            <span className="health-dot" />
            <span>{healthMeta.label}</span>
            {healthAgeSecs != null && <span className="health-age">{healthAgeSecs}s</span>}
          </div>
          {lastDataTime && (
            <div className="last-data">
              Last data&nbsp;
              <span className={isStale ? 'stale-time' : ''}>{fmtTime(lastDataTime)}</span>
              {isStale && <span className="stale-tag">&nbsp;({staleSecs}s ago)</span>}
            </div>
          )}
          <Link to="/tablet" className="mode-switch-btn">
            <TabletIcon />
            Tablet
          </Link>
        </div>
      </header>

      <main className="app-main">
        {/* ── Metrics Row ── */}
        <div className="metrics-row">

          {/* Distance */}
          <div className={`card metric-card distance-card${isBlocking ? ' card-blocking' : ''}${isStale ? ' card-stale' : ''}`}>
            <div className="metric-label">Distance</div>
            <div className={`distance-number${isBlocking ? ' distance-blocking' : ''}`}>
              {distance != null ? distance.toFixed(1) : '—'}
            </div>
            <div className="metric-unit">cm</div>
            {isBlocking && (
              <div className="blocking-pill">
                <span className="pulse-dot pulse-dot--orange" />
                Blocking
              </div>
            )}
            {isStale && !isBlocking && (
              <div className="stale-pill">Signal Timeout</div>
            )}
          </div>

          {/* Counter */}
          <div className="card metric-card counter-card">
            <div className="metric-label">Total Count</div>
            <div className="counter-number">{counter.toLocaleString()}</div>
            <div className="metric-unit">pcs</div>
            <button className="ghost-btn" onClick={resetCounter}>Reset</button>
          </div>

          {/* Frequency */}
          <div className="card metric-card freq-card">
            <div className="metric-label">Rate</div>
            <div className="freq-number">{frequency}</div>
            <div className="metric-unit">pcs / min</div>
            <div className="metric-note">Based on last 60 seconds</div>
          </div>

          {/* Config Summary */}
          <div className="card metric-card config-summary-card">
            <div className="metric-label">Parameters</div>
            <div className={`run-state-badge ${config.running ? 'state-running' : 'state-stopped'}`}>
              {config.running ? '● Running' : '■ Stopped'}
            </div>
            <div className="param-row">
              <span className="param-key">Sample Rate</span>
              <span className="param-val">{config.sampleHz} Hz</span>
            </div>
            <div className="param-row">
              <span className="param-key">Enter / Exit</span>
              <span className="param-val">{config.enterThreshold} / {config.exitThreshold} cm</span>
            </div>
            <div className="param-row">
              <span className="param-key">Stable Samples</span>
              <span className="param-val">{config.stableSamples}</span>
            </div>
            <div className="param-row">
              <span className="param-key">Debounce</span>
              <span className="param-val">{config.debounceMs} ms</span>
            </div>
          </div>

        </div>

        {/* ── Chart ── */}
        <div className="card chart-card">
          <div className="card-header">
            <span className="card-title">
              Live Distance — last 60s
              {!config.running && <span className="paused-tag">PAUSED</span>}
            </span>
            <div className="chart-legend">
              <span><span style={{ color: '#22d3ee' }}>——</span>&ensp;Distance</span>
              <span><span style={{ color: '#f97316' }}>- -</span>&ensp;Enter</span>
              <span><span style={{ color: '#22c55e' }}>- -</span>&ensp;Exit</span>
              <span><span style={{ background: '#f9731630', border: '1px solid #f9731660', display:'inline-block', width:12, height:10, borderRadius:2 }} />&ensp;Blocking</span>
              <span><span style={{ color: '#ef4444' }}>|</span>&ensp;Count</span>
            </div>
          </div>
          <DistanceChart
            data={chartData}
            eventTimes={eventTimes}
            enterThreshold={config.enterThreshold}
            exitThreshold={config.exitThreshold}
          />
        </div>

        {/* ── Control Panel ── */}
        <div className="card control-card">
          <div className="card-header">
            <span className="card-title">Remote Control</span>
            {!connected && (
              <span className="offline-hint">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
                </svg>
                MQTT offline — commands unavailable
              </span>
            )}
          </div>

          <div className="controls-grid">

            {/* Run / Stop */}
            <div className="control-group control-run">
              <label className="control-label">Detection</label>
              <button
                className={`run-btn ${config.running ? 'btn-stop' : 'btn-start'}`}
                onClick={toggleRunning}
                disabled={!connected}
              >
                {config.running
                  ? <><StopIcon /> Stop</>
                  : <><PlayIcon /> Start</>
                }
              </button>
              <p className="control-hint">
                {config.running
                  ? 'Device is counting. Click to pause.'
                  : 'Device is stopped. Click to start.'}
              </p>
            </div>

            {/* Calibration */}
            <div className="control-group control-calib">
              <label className="control-label">Calibration</label>
              <button
                className={`calib-btn${calibration.status === 'in_progress' ? ' calib-busy' : ''}`}
                onClick={triggerCalibration}
                disabled={!connected || calibration.status === 'in_progress'}
              >
                {calibration.status === 'in_progress'
                  ? <><SpinnerIcon /> Calibrating...</>
                  : <><TargetIcon /> Calibrate Now</>
                }
              </button>
              <CalibStatus calibration={calibration} onDismiss={resetCalibration} />
              <p className="control-hint">
                Clear sensor path before triggering. Resets state machine.
              </p>
            </div>

            {/* ── Section divider ── */}
            <div className="controls-divider">
              <span>Detection Thresholds</span>
            </div>

            {/* Enter Threshold */}
            <div className="control-group">
              <label className="control-label">
                Enter Threshold
                <span className="control-val control-val--alt">{config.enterThreshold} cm</span>
              </label>
              <input
                type="range" min={5} max={200} step={0.5}
                value={config.enterThreshold}
                onChange={handleEnterThreshold}
                disabled={!connected}
                className="slider slider--alt"
              />
              <div className="slider-marks">
                <span>5 cm</span>
                <span>200 cm</span>
              </div>
              <p className="control-hint">Object detected when dist &lt; this value</p>
            </div>

            {/* Exit Threshold */}
            <div className="control-group">
              <label className="control-label">
                Exit Threshold
                <span className="control-val control-val--alt">{config.exitThreshold} cm</span>
              </label>
              <input
                type="range" min={5} max={200} step={0.5}
                value={config.exitThreshold}
                onChange={handleExitThreshold}
                disabled={!connected}
                className="slider slider--alt"
              />
              <div className="slider-marks">
                <span>5 cm</span>
                <span>200 cm</span>
              </div>
              <p className="control-hint">Count triggers when dist &gt; this value (must be &gt; Enter)</p>
            </div>

            {/* Stable Samples */}
            <div className="control-group">
              <label className="control-label">
                Stable Samples
                <span className="control-val control-val--alt">{config.stableSamples}</span>
              </label>
              <input
                type="range" min={1} max={10} step={1}
                value={config.stableSamples}
                onChange={handleStableSamples}
                disabled={!connected}
                className="slider slider--alt"
              />
              <div className="slider-marks">
                <span>1</span>
                <span>10</span>
              </div>
              <p className="control-hint">Consecutive readings required to change state</p>
            </div>

            {/* Sample Rate */}
            <div className="control-group">
              <label className="control-label">
                Sample Rate
                <span className="control-val control-val--alt">{config.sampleHz} Hz</span>
              </label>
              <input
                type="range" min={1} max={20} step={0.5}
                value={config.sampleHz}
                onChange={handleSampleHz}
                disabled={!connected}
                className="slider slider--alt"
              />
              <div className="slider-marks">
                <span>1 Hz</span>
                <span>20 Hz</span>
              </div>
              <p className="control-hint">Sensor readings per second</p>
            </div>

            {/* Debounce */}
            <div className="control-group">
              <label className="control-label">
                Debounce
                <span className="control-val control-val--alt">{config.debounceMs} ms</span>
              </label>
              <input
                type="range" min={50} max={2000} step={50}
                value={config.debounceMs}
                onChange={handleDebounce}
                disabled={!connected}
                className="slider slider--alt"
              />
              <div className="slider-marks">
                <span>50 ms</span>
                <span>2000 ms</span>
              </div>
              <p className="control-hint">Cooldown between consecutive counts</p>
            </div>

          </div>
        </div>
      </main>

      <footer className="app-footer">
        broker.emqx.io : 8083 &nbsp;·&nbsp; factory/line1 &nbsp;·&nbsp;
        ESP32 + HC-SR04
      </footer>
    </div>
  )
}

function TabletIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="15" height="15">
      <rect x="2" y="3" width="16" height="14" rx="2" />
      <circle cx="10" cy="14.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <rect x="4" y="4" width="12" height="12" rx="2" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16">
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="10" y1="16" x2="10" y2="19" />
      <line x1="1" y1="10" x2="4" y2="10" />
      <line x1="16" y1="10" x2="19" y2="10" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
      width="16" height="16" className="spin-icon">
      <circle cx="10" cy="10" r="7" strokeDasharray="22 22" strokeLinecap="round" />
    </svg>
  )
}

function CalibStatus({ calibration, onDismiss }) {
  const { status, baseline, ts } = calibration

  if (status === 'idle') return null

  if (status === 'in_progress') {
    return (
      <div className="calib-status calib-status--progress">
        <div className="calib-bar-track">
          <div className="calib-bar-fill" />
        </div>
        <span>Resetting state machine…</span>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="calib-status calib-status--done">
        <span className="calib-icon">✓</span>
        <span>
          {baseline != null
            ? <>Done — new baseline&nbsp;<strong>{baseline.toFixed(1)} cm</strong></>
            : 'Done — state machine reset'}
        </span>
        <button className="calib-dismiss" onClick={onDismiss} title="Dismiss">×</button>
      </div>
    )
  }

  if (status === 'timeout') {
    return (
      <div className="calib-status calib-status--error">
        <span className="calib-icon">⚠</span>
        <span>No response from device</span>
        <button className="calib-dismiss" onClick={onDismiss} title="Dismiss">×</button>
      </div>
    )
  }

  return null
}
