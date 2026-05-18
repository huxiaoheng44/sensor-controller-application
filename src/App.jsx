import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMQTTContext } from './context/MQTTContext'
import DistanceChart from './components/DistanceChart'
import './App.css'

const HISTORY_RANGE_OPTIONS = [
  { value: 60_000, label: '1 min' },
  { value: 10 * 60_000, label: '10 min' },
  { value: 60 * 60_000, label: '1 hour' },
  { value: 24 * 60 * 60_000, label: '24 hours' },
]

const VOLTAGE_PRESETS = [
  { label: 'Off', value: 0 },
  { label: 'Idle', value: 5 },
  { label: 'Normal', value: 24 },
  { label: 'Abnormal', value: 28.5 },
]

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false })
}

function formatStatus(status) {
  const normalized = String(status ?? '').toUpperCase()
  const labels = {
    RUNNING: 'Running',
    IDLE: 'Idle',
    JAM: 'Blocked',
    ERROR: 'Error',
    WARNING: 'Warning',
    MACHINE_OFF: 'Machine Off',
    CONNECTION_LOST: 'Connection Lost',
    OFF: 'Off',
    OBJECT_ENTERING: 'Object Entering',
    OBJECT_PASSING: 'Object Passing',
  }
  return labels[normalized] ?? (status ? String(status).replaceAll('_', ' ') : 'Waiting')
}

function statusSeverity(status, warnings = []) {
  const normalized = String(status ?? '').toUpperCase()
  if (normalized === 'ERROR' || normalized === 'CONNECTION_LOST') return 'danger'
  if (normalized === 'JAM' || normalized === 'WARNING' || warnings?.length) return 'warning'
  if (normalized === 'RUNNING' || normalized === 'OBJECT_ENTERING' || normalized === 'OBJECT_PASSING') return 'success'
  return 'neutral'
}

export default function App() {
  const {
    connected,
    connecting,
    distanceHistory,
    currentSnapshotHistory,
    latestData,
    currentSnapshot,
    machineSnapshot,
    counter,
    frequency,
    eventTimes,
    lastDataTime,
    resetCounter,
    setSimulatedVoltage,
    config,
    sendConfig,
    sensorConnections,
    exportMQTTLog,
  } = useMQTTContext()

  const [tick, setTick] = useState(0)
  const [frozenHistory, setFrozenHistory] = useState(null)
  const [activeSensorId, setActiveSensorId] = useState('distance')
  const [distanceRangeMs, setDistanceRangeMs] = useState(60_000)
  const [currentRangeMs, setCurrentRangeMs] = useState(60_000)
  const [voltageInput, setVoltageInput] = useState('')
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

  function handleClearThreshold(e) {
    sendConfig({ ...config, clearThreshold: parseFloat(e.target.value) })
  }

  function handleSampleHz(e) {
    sendConfig({ ...config, sampleHz: parseFloat(e.target.value) })
  }

  function handleSetVoltage() {
    const value = parseFloat(voltageInput)
    if (!Number.isFinite(value)) return
    setSimulatedVoltage(value)
    setVoltageInput('')
  }

  const distance = latestData?.distance ?? null
  const fusedStatus = machineSnapshot?.status ?? null
  const fusedWarnings = Array.isArray(machineSnapshot?.warnings) ? machineSnapshot.warnings : []
  const distanceStatus = fusedStatus ?? latestData?.distanceState ?? (latestData?.objectBlocking ? 'JAM' : null)
  const currentStatus = fusedStatus ?? currentSnapshot?.voltageStatus ?? currentSnapshot?.machineStatus ?? null
  const isBlocking = fusedStatus === 'JAM' || latestData?.objectBlocking === true
  const statusSource = machineSnapshot?.source ? `Source: ${machineSnapshot.source}` : 'Sensor derived'
  const staleSecs = lastDataTime ? Math.floor((Date.now() - lastDataTime) / 1000) : null
  const isStale = staleSecs !== null && staleSecs > 5

  const now = Date.now()
  const chartData = (frozenHistory ?? distanceHistory).filter((point) => now - point.time <= distanceRangeMs)
  const chartEvents = eventTimes.filter((time) => now - time <= distanceRangeMs)
  const currentChartData = currentSnapshotHistory.filter((point) => now - point.time <= currentRangeMs)

  const activeSensor = sensorConnections.find((sensor) => sensor.id === activeSensorId) ?? sensorConnections[0]

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-title">
          <svg className="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Sensor Control Panel
        </div>

        <div className="app-header-right">
          <SensorSwitcher
            sensors={sensorConnections}
            activeSensorId={activeSensor.id}
            connecting={connecting}
            onSelect={setActiveSensorId}
          />
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
        {activeSensor.id === 'distance' && (
          <>
            <div className="sensor-view-title">
              <span>{activeSensor.label}</span>
              <span className={`sensor-view-state sensor-view-state--${statusSeverity(distanceStatus ?? (activeSensor.connected ? 'RUNNING' : null), fusedWarnings)}`}>
                {fusedStatus ? `${formatStatus(fusedStatus)} · ${statusSource}` : activeSensor.connected ? 'Connected' : activeSensor.stale ? 'Signal timeout' : 'Waiting for data'}
              </span>
            </div>

            {/* ── Metrics Row ── */}
            <div className="metrics-row">

              {/* Distance */}
              <div className={`card metric-card distance-card${isBlocking ? ' card-blocking' : ''}${isStale ? ' card-stale' : ''}`}>
                <div className="metric-label">Distance</div>
                <div className={`distance-number${isBlocking ? ' distance-blocking' : ''}`}>
                  {distance != null ? distance.toFixed(1) : '—'}
                </div>
                <div className="metric-unit">cm</div>
                <div className={`blocking-pill status-pill--${statusSeverity(distanceStatus, fusedWarnings)}`}>
                  {isBlocking && <span className="pulse-dot pulse-dot--orange" />}
                  {isBlocking ? 'Blocked' : formatStatus(distanceStatus ?? 'IDLE')}
                </div>
                {machineSnapshot?.confidence && (
                  <div className="metric-note">Confidence: {machineSnapshot.confidence}</div>
                )}
                {fusedWarnings.length > 0 && (
                  <div className="metric-note">{fusedWarnings[0]}</div>
                )}
                {/* {isBlocking && (
                  <div className="blocking-pill">
                    <span className="pulse-dot pulse-dot--orange" />
                    Blocking
                  </div>
                )} */}
                {isStale && !isBlocking && !fusedStatus && (
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
                  <span className="param-key">Clear Threshold</span>
                  <span className="param-val">{config.clearThreshold} cm</span>
                </div>
              </div>

            </div>

            {/* ── Chart ── */}
            <div className="card chart-card">
              <div className="card-header">
                <span className="card-title">
                  Live Distance
                  {!config.running && <span className="paused-tag">PAUSED</span>}
                </span>
                <div className="chart-legend">
                  <select
                    className="chart-range-select"
                    value={distanceRangeMs}
                    onChange={(e) => setDistanceRangeMs(Number(e.target.value))}
                    aria-label="Distance chart time range"
                  >
                    {HISTORY_RANGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <span><span style={{ color: '#22d3ee' }}>——</span>&ensp;Distance</span>
                  <span><span style={{ color: '#f97316' }}>- -</span>&ensp;Enter</span>
                  <span><span style={{ color: '#22c55e' }}>- -</span>&ensp;Exit</span>
                  <span><span style={{ background: '#f9731630', border: '1px solid #f9731660', display: 'inline-block', width: 12, height: 10, borderRadius: 2 }} />&ensp;Blocking</span>
                  <span><span style={{ color: '#ef4444' }}>|</span>&ensp;Count</span>
                  <button
                    type="button"
                    className="chart-export-btn"
                    onClick={exportMQTTLog}
                    title="Export MQTT log"
                  >
                    <DownloadIcon />
                    Export Log
                  </button>
                </div>
              </div>
              <DistanceChart
                data={chartData}
                eventTimes={chartEvents}
                enterThreshold={config.enterThreshold}
                exitThreshold={config.exitThreshold}
                domainStart={now - distanceRangeMs}
                domainEnd={now}
              />
            </div>

            {/* ── Control Panel ── */}
            <div className="card control-card">
              <div className="card-header">
                <span className="card-title">Distance Sensor Control</span>
                {!connected && (
                  <span className="offline-hint">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" clipRule="evenodd" />
                    </svg>
                    Connection offline — commands unavailable
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
                  <p className="control-hint">Bridge enters blocked state below this value</p>
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

                {/* Clear Threshold */}
                <div className="control-group">
                  <label className="control-label">
                    Clear Threshold
                    <span className="control-val control-val--alt">{config.clearThreshold} cm</span>
                  </label>
                  <input
                    type="range" min={5} max={200} step={0.5}
                    value={config.clearThreshold}
                    onChange={handleClearThreshold}
                    disabled={!connected}
                    className="slider slider--alt"
                  />
                  <div className="slider-marks">
                    <span>5 cm</span>
                    <span>200 cm</span>
                  </div>
                  <p className="control-hint">Bridge clear threshold for distance state</p>
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

              </div>
            </div>
          </>
        )}

        {activeSensor.id === 'current' && (
          <>
            <div className="sensor-view-title">
              <span>{activeSensor.label}</span>
              <span className={`sensor-view-state sensor-view-state--${statusSeverity(currentStatus, fusedWarnings)}`}>
                {fusedStatus ? `${formatStatus(fusedStatus)} · ${statusSource}` : activeSensor.connected ? 'Connected' : activeSensor.stale ? 'Signal timeout' : 'Waiting for data'}
              </span>
            </div>

            <div className="metrics-row">
              <div className={`card metric-card distance-card${isStale ? ' card-stale' : ''}`}>
                <div className="metric-label">Voltage</div>
                <div className="distance-number">
                  {currentSnapshot?.voltage != null ? currentSnapshot.voltage.toFixed(2) : '—'}
                </div>
                <div className="metric-unit">V</div>
                <div className={`blocking-pill status-pill--${statusSeverity(currentStatus, fusedWarnings)}`}>
                  {formatStatus(currentStatus ?? (currentSnapshot?.receivedAt ? 'RUNNING' : 'OFF'))}
                </div>
              </div>

              <div className="card metric-card config-summary-card">
                <div className="metric-label">Voltage Snapshot</div>
                {/* <div className={`run-state-badge ${currentSnapshot?.online ? 'state-running' : 'state-stopped'}`}>
                  {currentSnapshot?.online ? '● Online' : '■ Offline'}
                </div> */}
                <div className="param-row">
                  <span className="param-key">Reason</span>
                  <span className="param-val">{currentSnapshot?.reason ?? '—'}</span>
                </div>
                <div className="param-row">
                  <span className="param-key">Uptime</span>
                  <span className="param-val">{currentSnapshot?.uptime != null ? `${currentSnapshot.uptime}s` : '—'}</span>
                </div>
                <div className="param-row">
                  <span className="param-key">Device TS</span>
                  <span className="param-val">{currentSnapshot?.ts ?? '—'}</span>
                </div>
                <div className="param-row">
                  <span className="param-key">Received</span>
                  <span className="param-val">{currentSnapshot?.receivedAt ? fmtTime(currentSnapshot.receivedAt) : '—'}</span>
                </div>
              </div>
            </div>

            <div className="card control-card">
              <div className="card-header">
                <span className="card-title">Voltage Control</span>
                {!connected && <span className="offline-hint">Connection offline — commands unavailable</span>}
              </div>
              <div className="controls-grid controls-grid--compact">
                <div className="control-group">
                  <label className="control-label">
                    Simulated Voltage
                    <span className="control-val control-val--alt">
                      {currentSnapshot?.simulated ? 'SIM' : 'LIVE'}
                    </span>
                  </label>
                  <div className="direct-control-row">
                    <input
                      type="number"
                      className="direct-control-input"
                      placeholder="12.5"
                      value={voltageInput}
                      onChange={(e) => setVoltageInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSetVoltage()}
                      min={0}
                      step={0.01}
                      disabled={!connected}
                    />
                    <span className="direct-control-unit">V</span>
                    <button
                      type="button"
                      className="direct-control-btn"
                      onClick={handleSetVoltage}
                      disabled={!connected || voltageInput === ''}
                    >
                      Set
                    </button>
                  </div>
                  <p className="control-hint">Publishes to factory/line1/voltage/config.</p>
                  <div className="preset-row">
                    {VOLTAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className="preset-btn"
                        onClick={() => setSimulatedVoltage(preset.value)}
                        disabled={!connected}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card chart-card">
              <div className="card-header">
                <span className="card-title">Voltage — Current Sensor</span>
                <div className="chart-actions">
                  <select
                    className="chart-range-select"
                    value={currentRangeMs}
                    onChange={(e) => setCurrentRangeMs(Number(e.target.value))}
                    aria-label="Voltage chart time range"
                  >
                    {HISTORY_RANGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="chart-export-btn"
                    onClick={exportMQTTLog}
                    title="Export MQTT log"
                  >
                    <DownloadIcon />
                    Export Log
                  </button>
                </div>
              </div>
              <DistanceChart
                data={currentChartData}
                eventTimes={[]}
                valueKey="voltage"
                valueUnit="V"
                valueLabel="Voltage"
                showThresholds={false}
                domainStart={now - currentRangeMs}
                domainEnd={now}
              />
            </div>

            <div className="card chart-card">
              <div className="card-header">
                <span className="card-title">Voltage Source</span>
              </div>
              <div className="snapshot-panel">
                <pre>{JSON.stringify(currentSnapshot ?? {}, null, 2)}</pre>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="app-footer">
        broker.emqx.io : 8083 &nbsp;·&nbsp; factory/line1 &nbsp;·&nbsp;
        ESP32 + HC-SR04
      </footer>
    </div>
  )
}

function SensorSwitcher({ sensors, activeSensorId, connecting, onSelect }) {
  const hasAnySensor = sensors.some((sensor) => sensor.connected || sensor.stale)

  return (
    <div className="sensor-switcher" aria-label="Connected sensors">
      {!hasAnySensor && (
        <span className="sensor-empty">{connecting ? 'Waiting for sensors...' : 'No sensor data'}</span>
      )}
      {sensors.map((sensor) => {
        const stateClass = sensor.connected
          ? ' sensor-chip--online'
          : sensor.stale
            ? ' sensor-chip--stale'
            : ''
        return (
          <button
            key={sensor.id}
            type="button"
            className={`sensor-chip${activeSensorId === sensor.id ? ' sensor-chip--active' : ''}${stateClass}`}
            onClick={() => onSelect(sensor.id)}
            title={sensor.connected ? `${sensor.label} connected` : sensor.stale ? `${sensor.label} signal timeout` : `${sensor.label} offline`}
          >
            <span className="sensor-chip-dot" />
            <ChipIcon />
            <span>{sensor.label}</span>
          </button>
        )
      })}
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

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width="15" height="15">
      <path d="M10 3v9" />
      <path d="M6 8l4 4 4-4" />
      <path d="M4 16h12" />
    </svg>
  )
}

function ChipIcon() {
  return (
    <svg className="sensor-chip-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="5" width="10" height="10" rx="1.5" />
      <path d="M2 7h3M2 10h3M2 13h3M15 7h3M15 10h3M15 13h3M7 2v3M10 2v3M13 2v3M7 15v3M10 15v3M13 15v3" />
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
