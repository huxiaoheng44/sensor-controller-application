import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMQTT } from '../hooks/useMQTT'
import { useDeviceConfig } from '../hooks/useDeviceConfig'
import DistanceChart from '../components/DistanceChart'
import './TabletView.css'

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false })
}

export default function TabletView() {
  const {
    connected, connecting,
    distanceHistory, latestData,
    counter, frequency, eventTimes,
    lastDataTime,
    deviceHealth,
    calibration, publish, resetCounter,
    triggerCalibration, resetCalibration,
  } = useMQTT()

  const { config, sendConfig } = useDeviceConfig(latestData, calibration, publish)

  const [frozenHistory, setFrozenHistory] = useState(null)
  const [activeTab, setActiveTab] = useState('monitor')
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

  const distance   = latestData?.distance      ?? null
  const isBlocking = latestData?.objectBlocking ?? false
  const staleSecs  = lastDataTime ? Math.floor((Date.now() - lastDataTime) / 1000) : null
  const isStale    = staleSecs !== null && staleSecs > 5
  const chartData  = frozenHistory ?? distanceHistory
  const connColor  = connected ? '#22c55e' : connecting ? '#f59e0b' : '#ef4444'
  const connLabel  = connected ? 'Connected' : connecting ? 'Connecting…' : 'Offline'
  const healthAgeSecs = deviceHealth.ageMs != null ? Math.floor(deviceHealth.ageMs / 1000) : null

  const healthMeta = {
    online: { label: 'Device Online', color: '#22c55e' },
    degraded: { label: 'Heartbeat Delayed', color: '#f59e0b' },
    device_offline: { label: 'Device Offline', color: '#ef4444' },
    broker_offline: { label: 'Broker Offline', color: '#ef4444' },
    waiting: { label: 'Waiting Heartbeat', color: '#64748b' },
  }[deviceHealth.status]

  return (
    <div className="tv">

      {/* ── Header ── */}
      <header className="tv-header">
        <div className="tv-conn" style={{ '--cc': connColor }}>
          <span className="tv-conn-dot" />
          <span className="tv-conn-label">{connLabel}</span>
        </div>
        <div className="tv-health" style={{ '--hc': healthMeta.color }}>
          <span className="tv-health-dot" />
          <span>{healthMeta.label}</span>
          {healthAgeSecs != null && <span className="tv-health-age">{healthAgeSecs}s</span>}
        </div>
        <div className={`tv-lastseen${isStale ? ' tv-stale' : ''}`}>
          {lastDataTime
            ? isStale ? `No data · ${staleSecs}s ago` : `Last · ${fmtTime(lastDataTime)}`
            : 'Waiting…'}
        </div>
        <Link to="/" className="tv-exit"><MonitorIcon /> Desktop</Link>
      </header>

      {/* ── Tab bar ── */}
      <nav className="tv-tabbar">
        {[
          { id: 'monitor',  label: 'Monitor',  icon: <ChartTabIcon /> },
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

      {/* ── Tab body ── */}
      <div className="tv-body">

        {/* ─── Monitor tab ─── */}
        {activeTab === 'monitor' && (
          <div className="tv-monitor">

            <div className="tv-metrics">
              <div className={`tv-mcard${isBlocking ? ' tv-mcard--blocking' : ''}${isStale ? ' tv-mcard--stale' : ''}`}>
                <div className="tv-mcard-label">Distance</div>
                <div className={`tv-mcard-num${isBlocking ? ' tv-mcard-num--orange' : ''}`}>
                  {distance != null ? distance.toFixed(1) : '—'}
                </div>
                <div className="tv-mcard-unit">cm</div>
                {isBlocking
                  ? <div className="tv-badge tv-badge--orange"><span className="tv-pulse" />Blocking</div>
                  : <div className="tv-badge tv-badge--dim">Sensor clear</div>
                }
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
                  Live Distance — last 60 s
                  {!config.running && <span className="tv-paused">PAUSED</span>}
                </span>
                <div className="tv-legend">
                  <span><span style={{ color: '#f97316' }}>--</span>&ensp;Enter</span>
                  <span><span style={{ color: '#22c55e' }}>--</span>&ensp;Exit</span>
                  <span><span style={{ color: '#f97316' }}>█</span>&ensp;Blocking</span>
                  <span><span style={{ color: '#ef4444' }}>│</span>&ensp;Count</span>
                </div>
              </div>
              <div className="tv-chart-inner">
                <DistanceChart
                  data={chartData}
                  eventTimes={eventTimes}
                  enterThreshold={config.enterThreshold}
                  exitThreshold={config.exitThreshold}
                  height="100%"
                />
              </div>
            </div>

          </div>
        )}

        {/* ─── Settings tab ─── */}
        {activeTab === 'settings' && (
          <div className="tv-settings">

            {/* Start/Stop */}
            <div className="tv-action-card tv-action--run">
              <div className="tv-ctrl-label">Detection</div>
              <button
                className={`tv-big-btn${config.running ? ' tv-big-btn--stop' : ' tv-big-btn--start'}`}
                onClick={() => sendConfig({ ...config, running: !config.running })}
                disabled={!connected}
              >
                {config.running ? '■  Stop' : '▶  Start'}
              </button>
              <p className="tv-ctrl-hint">
                {config.running ? 'Counting. Tap to pause.' : 'Stopped. Tap to start.'}
              </p>
            </div>

            {/* Calibration */}
            <div className="tv-action-card tv-action--calib">
              <div className="tv-ctrl-label">Calibration</div>
              <button
                className={`tv-big-btn tv-big-btn--calib${calibration.status === 'in_progress' ? ' tv-big-btn--busy' : ''}`}
                onClick={triggerCalibration}
                disabled={!connected || calibration.status === 'in_progress'}
              >
                {calibration.status === 'in_progress'
                  ? <><SpinSvg /> Calibrating…</>
                  : <><TargetSvg /> Calibrate Now</>}
              </button>
              <CalibStatus calibration={calibration} onDismiss={resetCalibration} />
              <p className="tv-ctrl-hint">Clear path first. Resets state machine.</p>
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

            {/* Stable Samples */}
            <SliderCard
              label="Stable Samples" value={config.stableSamples} unit=""
              min={1} max={10} step={1} disabled={!connected}
              onChange={(v) => sendConfig({ ...config, stableSamples: v })}
              hint="Consecutive readings to change state"
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

            {/* Debounce */}
            <SliderCard
              label="Debounce" value={config.debounceMs} unit="ms"
              min={50} max={2000} step={50} disabled={!connected}
              onChange={(v) => sendConfig({ ...config, debounceMs: v })}
              hint="Cooldown between counts"
              alt
            />

          </div>
        )}

      </div>
    </div>
  )
}

/* ═══════════════════════════════════════
   Slider card
═══════════════════════════════════════ */
function SliderCard({ label, value, unit, min, max, step, disabled, onChange, hint, alt }) {
  const isInt = step === 1 || unit === 'ms'
  const pct   = ((value - min) / (max - min)) * 100

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
   Calibration status banner
═══════════════════════════════════════ */
function CalibStatus({ calibration, onDismiss }) {
  const { status, baseline } = calibration
  if (status === 'idle') return null

  if (status === 'in_progress') return (
    <div className="tv-calib-prog">
      <div className="tv-calib-bar"><div className="tv-calib-fill" /></div>
      <span>Resetting state machine…</span>
    </div>
  )

  return (
    <div className={`tv-calib-result${status === 'done' ? ' tv-calib-result--ok' : ' tv-calib-result--err'}`}>
      <span>
        {status === 'done'
          ? baseline != null
            ? <>✓ Done — new baseline <strong>{baseline?.toFixed(1)} cm</strong></>
            : '✓ Done — state reset'
          : '⚠ No response from device'}
      </span>
      <button className="tv-calib-x" onClick={onDismiss}>×</button>
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
      <line x1="3" y1="7"  x2="19" y2="7"  />
      <circle cx="8"  cy="7"  r="2.5" fill="currentColor" stroke="none" />
      <line x1="3" y1="15" x2="19" y2="15" />
      <circle cx="14" cy="15" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
function TargetSvg() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" width="20" height="20">
      <circle cx="10" cy="10" r="7" /><circle cx="10" cy="10" r="3" />
      <line x1="10" y1="1" x2="10" y2="4" /><line x1="10" y1="16" x2="10" y2="19" />
      <line x1="1"  y1="10" x2="4"  y2="10" /><line x1="16" y1="10" x2="19" y2="10" />
    </svg>
  )
}
function SpinSvg() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2"
      width="20" height="20" style={{ animation: 'tv-spin 1s linear infinite', flexShrink: 0 }}>
      <circle cx="10" cy="10" r="7" strokeDasharray="22 22" strokeLinecap="round" />
    </svg>
  )
}
