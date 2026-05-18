import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMQTTContext } from '../context/MQTTContext'
import DistanceChart from '../components/DistanceChart'
import './TabletView.css'

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

export default function TabletView() {
  const {
    connected, connecting,
    distanceHistory, currentSnapshotHistory, latestData, currentSnapshot,
    machineSnapshot,
    counter, frequency, eventTimes,
    lastDataTime,
    resetCounter,
    setSimulatedVoltage,
    config, sendConfig,
    sensorConnections,
    exportMQTTLog,
  } = useMQTTContext()

  const [frozenHistory, setFrozenHistory] = useState(null)
  const [activeSensorId, setActiveSensorId] = useState('distance')
  const [activeTab, setActiveTab] = useState('monitor')
  const [distanceRangeMs, setDistanceRangeMs] = useState(60_000)
  const [currentRangeMs, setCurrentRangeMs] = useState(60_000)
  const [, setTick] = useState(0)
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

  const distance = latestData?.distance ?? null
  const fusedStatus = machineSnapshot?.status ?? null
  const fusedWarnings = Array.isArray(machineSnapshot?.warnings) ? machineSnapshot.warnings : []
  const distanceStatus = fusedStatus ?? latestData?.distanceState ?? (latestData?.objectBlocking ? 'JAM' : null)
  const currentStatus = fusedStatus ?? currentSnapshot?.voltageStatus ?? currentSnapshot?.machineStatus ?? null
  const isBlocking = fusedStatus === 'JAM' || latestData?.objectBlocking === true
  const statusSource = machineSnapshot?.source ? `Source: ${machineSnapshot.source}` : 'Sensor derived'
  const staleSecs = lastDataTime ? Math.floor((Date.now() - lastDataTime) / 1000) : null
  const isStale = staleSecs !== null && staleSecs > 5
  const currentSnapshotAgeSecs = currentSnapshot?.receivedAt
    ? Math.floor((Date.now() - currentSnapshot.receivedAt) / 1000)
    : null
  const isCurrentSnapshotOnline = currentSnapshotAgeSecs !== null && currentSnapshotAgeSecs <= 5
  const now = Date.now()
  const chartData = (frozenHistory ?? distanceHistory).filter((point) => now - point.time <= distanceRangeMs)
  const chartEvents = eventTimes.filter((time) => now - time <= distanceRangeMs)
  const currentChartData = currentSnapshotHistory.filter((point) => now - point.time <= currentRangeMs)
  const activeSensor = sensorConnections.find((sensor) => sensor.id === activeSensorId) ?? sensorConnections[0]

  return (
    <div className="tv">

      {/* ── Header ── */}
      <header className="tv-header">
        <TabletSensorSwitcher
          sensors={sensorConnections}
          activeSensorId={activeSensor.id}
          connecting={connecting}
          onSelect={setActiveSensorId}
        />
        <div className={`tv-lastseen${isStale ? ' tv-stale' : ''}`}>
          {lastDataTime
            ? isStale ? `No data · ${staleSecs}s ago` : `Last · ${fmtTime(lastDataTime)}`
            : 'Waiting…'}
        </div>
        <Link to="/" className="tv-exit"><MonitorIcon /> Desktop</Link>
      </header>

      {/* ── Tab bar ── */}
      {activeSensor.id === 'distance' && (
        <nav className="tv-tabbar">
          {[
            { id: 'monitor', label: 'Monitor', icon: <ChartTabIcon /> },
            { id: 'settings', label: 'Settings', icon: <SlidersTabIcon /> },
          ].map(({ id, label, icon }) => (
            <button
              key={id}
              className={`tv-tab${activeTab === id ? ' tv-tab--active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* ── Tab body ── */}
      <div className="tv-body">

        {/* ─── Monitor tab ─── */}
        {activeSensor.id === 'distance' && activeTab === 'monitor' && (
          <div className="tv-monitor">

            <div className="tv-metrics">
              <div className={`tv-mcard${isBlocking ? ' tv-mcard--blocking' : ''}${isStale ? ' tv-mcard--stale' : ''}`}>
                <div className="tv-mcard-label">Distance</div>
                <div className={`tv-mcard-num${isBlocking ? ' tv-mcard-num--orange' : ''}`}>
                  {distance != null ? distance.toFixed(1) : '—'}
                </div>
                <div className="tv-mcard-unit">cm</div>
                <div className={`tv-badge tv-badge--${statusSeverity(distanceStatus, fusedWarnings)}`}>
                  {isBlocking && <span className="tv-pulse" />}
                  {isBlocking ? 'Blocked' : formatStatus(distanceStatus ?? 'IDLE')}
                </div>
                <div className="tv-mcard-note">
                  {fusedStatus ? `${statusSource}${machineSnapshot?.confidence ? ` · ${machineSnapshot.confidence}` : ''}` : 'Distance sensor'}
                </div>
              </div>

              <div className="tv-mcard">
                <div className="tv-mcard-label">Total Count</div>
                <div className="tv-mcard-num tv-mcard-num--green">{counter.toLocaleString()}</div>
                <div className="tv-mcard-unit">pcs</div>
                <button className="tv-reset-btn" onClick={resetCounter}>Reset</button>
              </div>

              <div className="tv-mcard">
                <div className="tv-mcard-label">Rate</div>
                <div className="tv-mcard-num tv-mcard-num--yellow">{frequency}</div>
                <div className="tv-mcard-unit">pcs / min</div>
                <div className="tv-mcard-note">Last 60 s</div>
              </div>

            </div>

            <div className="tv-chart-wrap">
              <div className="tv-chart-bar">
                <span className="tv-chart-title">
                  Live Distance
                  {!config.running && <span className="tv-paused">PAUSED</span>}
                </span>
                <div className="tv-legend">
                  <select
                    className="tv-chart-select"
                    value={distanceRangeMs}
                    onChange={(e) => setDistanceRangeMs(Number(e.target.value))}
                    aria-label="Distance chart time range"
                  >
                    {HISTORY_RANGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <span><span style={{ color: '#f97316' }}>--</span >&ensp;Enter</span>
                  <span><span style={{ color: '#22c55e' }}>--</span >&ensp;Exit</span>
                  <span><span style={{ color: '#f97316' }}>█</span >&ensp;Blocking</span>
                  <span><span style={{ color: '#ef4444' }}>│</span >&ensp;Count</span>
                  <button type="button" className="tv-chart-export" onClick={exportMQTTLog}>
                    <DownloadIcon /> Export Log
                  </button>
                </div>
              </div>
              <div className="tv-chart-inner">
                <DistanceChart
                  data={chartData}
                  eventTimes={chartEvents}
                  enterThreshold={config.enterThreshold}
                  exitThreshold={config.exitThreshold}
                  domainStart={now - distanceRangeMs}
                  domainEnd={now}
                  height="100%"
                />
              </div>
            </div>

          </div>
        )}

        {/* ─── Settings tab ─── */}
        {activeSensor.id === 'distance' && activeTab === 'settings' && (
          <div className="tv-settings">

            {/* Start/Stop */}
            <div className="tv-action-card tv-action--run">
              <div className="tv-action-head">
                <div>
                  <div className="tv-ctrl-label">Detection</div>
                  <div className={`tv-run-status${config.running ? ' tv-run-status--running' : ' tv-run-status--stopped'}`}>
                    <span />
                    {config.running ? 'Running' : 'Stopped'}
                  </div>
                </div>
                <button
                  className={`tv-big-btn${config.running ? ' tv-big-btn--stop' : ' tv-big-btn--start'}`}
                  onClick={() => sendConfig({ ...config, running: !config.running })}
                  disabled={!connected}
                >
                  {config.running ? 'Stop' : 'Start'}
                </button>
              </div>
              <p className="tv-ctrl-hint">
                {config.running ? 'Counting is active. Pause only when changing the line setup.' : 'Counting is paused. Start when the sensor is ready.'}
              </p>
            </div>

            <div className="tv-action-card tv-action-card--summary">
              <div className="tv-ctrl-label">Current Setup</div>
              <div className="tv-setup-list">
                <div><span>Enter</span><strong>{config.enterThreshold} cm</strong></div>
                <div><span>Exit</span><strong>{config.exitThreshold} cm</strong></div>
                <div><span>Clear</span><strong>{config.clearThreshold} cm</strong></div>
                <div><span>Rate</span><strong>{config.sampleHz} Hz</strong></div>
              </div>
            </div>

            {/* Enter Threshold */}
            <SliderCard
              label="Enter Threshold" value={config.enterThreshold} unit="cm"
              min={5} max={200} step={0.5} disabled={!connected}
              onChange={(v) => sendConfig({ ...config, enterThreshold: v })}
              hint="Detected when dist < this"
              alt
            />

            {/* Exit Threshold */}
            <SliderCard
              label="Exit Threshold" value={config.exitThreshold} unit="cm"
              min={5} max={200} step={0.5} disabled={!connected}
              onChange={(v) => sendConfig({ ...config, exitThreshold: v })}
              hint="Count triggers when dist > this"
              alt
            />

            {/* Clear Threshold */}
            <SliderCard
              label="Clear Threshold" value={config.clearThreshold} unit="cm"
              min={5} max={200} step={0.5} disabled={!connected}
              onChange={(v) => sendConfig({ ...config, clearThreshold: v })}
              hint="Bridge clear threshold"
              alt
            />

            {/* Sample Rate */}
            <SliderCard
              label="Sample Rate" value={config.sampleHz} unit="Hz"
              min={1} max={20} step={0.5} disabled={!connected}
              onChange={(v) => sendConfig({ ...config, sampleHz: v })}
              hint="Readings per second"
              alt
            />

          </div>
        )}

        {activeSensor.id === 'current' && (
          <div className="tv-settings tv-settings--current">
            <div className="tv-current-overview">
              <div className="tv-mcard-label">Current Sensor</div>
              <div className="tv-mcard-num">
                {currentSnapshot?.voltage != null ? currentSnapshot.voltage.toFixed(2) : '—'}
              </div>
              <div className="tv-mcard-unit">V</div>
              <div className={`tv-badge tv-badge--${statusSeverity(currentStatus ?? (isCurrentSnapshotOnline ? 'RUNNING' : 'OFF'), fusedWarnings)}`}>
                {formatStatus(currentStatus ?? (isCurrentSnapshotOnline ? 'RUNNING' : 'OFF'))}
              </div>
              <div className="tv-mcard-note">
                {fusedStatus ? `${statusSource}${machineSnapshot?.confidence ? ` · ${machineSnapshot.confidence}` : ''}` : 'Voltage sensor'}
              </div>
            </div>

            <div className="tv-chart-wrap tv-current-chart-wrap">
              <div className="tv-chart-bar">
                <span className="tv-chart-title">Live Voltage</span>
                <div className="tv-chart-actions">
                  <select
                    className="tv-chart-select"
                    value={currentRangeMs}
                    onChange={(e) => setCurrentRangeMs(Number(e.target.value))}
                    aria-label="Voltage chart time range"
                  >
                    {HISTORY_RANGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button type="button" className="tv-chart-export" onClick={exportMQTTLog}>
                    <DownloadIcon /> Export Log
                  </button>
                </div>
              </div>
              <div className="tv-chart-inner">
                <DistanceChart
                  data={currentChartData}
                  eventTimes={[]}
                  valueKey="voltage"
                  valueUnit="V"
                  valueLabel="Voltage"
                  showThresholds={false}
                  domainStart={now - currentRangeMs}
                  domainEnd={now}
                  height="100%"
                />
              </div>
            </div>

            <div className="tv-current-card">
              <div className="tv-ctrl-label">Snapshot</div>
              <div className="tv-snapshot-rows">
                <div><span>Reason</span><strong>{currentSnapshot?.reason ?? '—'}</strong></div>
                <div><span>Uptime</span><strong>{currentSnapshot?.uptime != null ? `${currentSnapshot.uptime}s` : '—'}</strong></div>
                <div><span>Device TS</span><strong>{currentSnapshot?.ts ?? '—'}</strong></div>
                <div><span>Received</span><strong>{currentSnapshot?.receivedAt ? fmtTime(currentSnapshot.receivedAt) : '—'}</strong></div>
              </div>
            </div>

            <div className="tv-current-card">
              <div className="tv-ctrl-label">Set simulated voltage</div>
              <div className="tv-preset-grid">
                {VOLTAGE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="tv-preset-btn"
                    onClick={() => setSimulatedVoltage(preset.value)}
                    disabled={!connected}
                  >
                    <span>{preset.label}</span>
                    <strong>{preset.value.toFixed(preset.value % 1 === 0 ? 0 : 1)} V</strong>
                  </button>
                ))}
              </div>
              <p className="tv-ctrl-hint">
                {currentSnapshot?.simulated ? 'Simulated voltage source' : 'Live voltage source'}
              </p>
            </div>

            <div className="tv-current-card tv-current-card--wide">
              <div className="tv-chart-bar tv-snapshot-bar">
                <span className="tv-chart-title">Raw Snapshot</span>
                <button type="button" className="tv-chart-export" onClick={exportMQTTLog}>
                  <DownloadIcon /> Export Log
                </button>
              </div>
              <pre className="tv-snapshot-json">{JSON.stringify(currentSnapshot ?? {}, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TabletSensorSwitcher({ sensors, activeSensorId, connecting, onSelect }) {
  const hasAnySensor = sensors.some((sensor) => sensor.connected || sensor.stale)

  return (
    <div className="tv-sensor-switcher">
      {!hasAnySensor && (
        <span className="tv-sensor-empty">{connecting ? 'Waiting sensors...' : 'No sensor data'}</span>
      )}
      {sensors.map((sensor) => {
        const stateClass = sensor.connected
          ? ' tv-sensor-chip--online'
          : sensor.stale
            ? ' tv-sensor-chip--stale'
            : ''
        return (
          <button
            key={sensor.id}
            type="button"
            className={`tv-sensor-chip${activeSensorId === sensor.id ? ' tv-sensor-chip--active' : ''}${stateClass}`}
            onClick={() => onSelect(sensor.id)}
            title={sensor.connected ? `${sensor.label} connected` : sensor.stale ? `${sensor.label} signal timeout` : `${sensor.label} offline`}
          >
            <span className="tv-sensor-dot" />
            <ChipIcon />
            <span>{sensor.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════
   Slider card
═══════════════════════════════════════ */
function SliderCard({ label, value, unit, min, max, step, disabled, onChange, hint, alt }) {
  const isInt = step === 1 || unit === 'ms'
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="tv-slider-card">
      <div className="tv-ctrl-label">{label}</div>

      <div className="tv-slider-value-wrap">
        <span className={`tv-slider-value${alt ? ' tv-slider-value--alt' : ''}`}>{value}</span>
        {unit && <span className="tv-slider-unit">{unit}</span>}
      </div>

      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(isInt ? parseInt(e.target.value, 10) : parseFloat(e.target.value))}
        disabled={disabled}
        className={`tv-ctrl-slider${alt ? ' tv-ctrl-slider--alt' : ''}`}
        style={{ '--pct': `${pct}%` }}
      />

      <div className="tv-ctrl-range">
        <span>{min}{unit ? ` ${unit}` : ''}</span>
        <span>{max}{unit ? ` ${unit}` : ''}</span>
      </div>

      {hint && <p className="tv-ctrl-hint">{hint}</p>}
    </div>
  )
}

/* ═══════════════════════════════════════
   Icons
═══════════════════════════════════════ */
function MonitorIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width="17" height="17">
      <rect x="2" y="3" width="16" height="11" rx="2" />
      <path d="M7 17h6M10 14v3" />
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width="17" height="17">
      <path d="M10 3v9" />
      <path d="M6 8l4 4 4-4" />
      <path d="M4 16h12" />
    </svg>
  )
}
function ChipIcon() {
  return (
    <svg className="tv-sensor-chip-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="5" width="10" height="10" rx="1.5" />
      <path d="M2 7h3M2 10h3M2 13h3M15 7h3M15 10h3M15 13h3M7 2v3M10 2v3M13 2v3M7 15v3M10 15v3M13 15v3" />
    </svg>
  )
}
function ChartTabIcon() {
  return (
    <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
      <polyline points="3,16 8,9 12,12 19,4" />
      <line x1="3" y1="19" x2="19" y2="19" />
    </svg>
  )
}
function SlidersTabIcon() {
  return (
    <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
      <line x1="3" y1="7" x2="19" y2="7" />
      <circle cx="8" cy="7" r="2.5" fill="currentColor" stroke="none" />
      <line x1="3" y1="15" x2="19" y2="15" />
      <circle cx="14" cy="15" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
