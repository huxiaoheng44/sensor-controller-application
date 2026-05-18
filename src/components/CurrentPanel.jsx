import { useState } from 'react'
import './CurrentPanel.css'

const MODES = ['off', 'idle', 'normal', 'abnormal']

const MODE_META = {
  off:      { label: 'Off',      color: '#64748b' },
  idle:     { label: 'Idle',     color: '#f59e0b' },
  normal:   { label: 'Normal',   color: '#22c55e' },
  abnormal: { label: 'Abnormal', color: '#ef4444' },
}

const STEP_OPTIONS = [25, 50, 100, 200]

export default function CurrentPanel({ currentData, currentUp, currentDown, publishConfig, connected }) {
  const { currentMa, currentTargetMa, currentMode, currentStepMa } = currentData

  const [selectedStep, setSelectedStep] = useState(50)
  const [directInput, setDirectInput]   = useState('')

  const meta    = MODE_META[currentMode] ?? { label: currentMode ?? '—', color: '#64748b' }
  const hasMa   = currentMa != null
  const hasTarget = currentTargetMa != null && currentTargetMa > 0
  const barPct  = hasMa && hasTarget
    ? Math.min(100, Math.round((currentMa / currentTargetMa) * 100))
    : null

  function handleSetMa() {
    const val = parseInt(directInput, 10)
    if (!isNaN(val) && val >= 0) {
      publishConfig({ currentMa: val })
      setDirectInput('')
    }
  }

  return (
    <div className="cp-wrap">
      <div className="card-header">
        <span className="card-title">Current Sensor</span>
        <div className="cp-head-right">
          {currentMode && (
            <span className="cp-mode-badge" style={{ '--mc': meta.color }}>
              <span className="cp-mode-dot" />
              {meta.label}
            </span>
          )}
          {currentStepMa != null && (
            <span className="cp-device-step">Device step: {currentStepMa} mA</span>
          )}
        </div>
      </div>

      <div className="cp-body">

        {/* ── 左：数据展示 ── */}
        <div className="cp-data">
          <div className="cp-reading">
            <span className="cp-reading-num" style={{ color: meta.color }}>
              {hasMa ? currentMa : '—'}
            </span>
            <span className="cp-reading-unit">mA</span>
          </div>

          {hasTarget && (
            <div className="cp-target-row">
              <span className="cp-target-label">Target</span>
              <span className="cp-target-val">{currentTargetMa} mA</span>
            </div>
          )}

          {barPct != null && (
            <div className="cp-bar-wrap">
              <div className="cp-bar-track">
                <div className="cp-bar-fill" style={{ width: `${barPct}%`, '--fc': meta.color }} />
              </div>
              <span className="cp-bar-pct">{barPct}%</span>
            </div>
          )}

          {!hasMa && <p className="cp-nodata">Waiting for current data…</p>}
        </div>

        {/* ── 右：控制区 ── */}
        <div className="cp-controls">

          <div className="cp-ctrl-group">
            <div className="cp-ctrl-label">Set Mode</div>
            <div className="cp-mode-btns">
              {MODES.map((m) => {
                const mm = MODE_META[m]
                return (
                  <button
                    key={m}
                    className={`cp-mode-btn${currentMode === m ? ' cp-mode-btn--active' : ''}`}
                    style={{ '--mc': mm.color }}
                    onClick={() => publishConfig({ currentMode: m })}
                    disabled={!connected}
                  >
                    {mm.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="cp-ctrl-group">
            <div className="cp-ctrl-label">
              Adjust &ensp;
              <span className="cp-step-hint">step per click:</span>
            </div>
            <div className="cp-step-row">
              {STEP_OPTIONS.map((s) => (
                <button
                  key={s}
                  className={`cp-step-btn${selectedStep === s ? ' cp-step-btn--active' : ''}`}
                  onClick={() => setSelectedStep(s)}
                >
                  {s}
                </button>
              ))}
              <span className="cp-step-unit">mA</span>
            </div>
            <div className="cp-ud-row">
              <button className="cp-ud-btn cp-ud-btn--down" onClick={() => currentDown(selectedStep)} disabled={!connected}>
                <ArrowDown /> Down {selectedStep} mA
              </button>
              <button className="cp-ud-btn cp-ud-btn--up" onClick={() => currentUp(selectedStep)} disabled={!connected}>
                <ArrowUp /> Up {selectedStep} mA
              </button>
            </div>
          </div>

          <div className="cp-ctrl-group">
            <div className="cp-ctrl-label">Set exact value</div>
            <div className="cp-direct-row">
              <input
                type="number"
                className="cp-direct-input"
                placeholder="e.g. 750"
                value={directInput}
                onChange={(e) => setDirectInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetMa()}
                disabled={!connected}
                min={0}
              />
              <span className="cp-direct-unit">mA</span>
              <button className="cp-direct-btn" onClick={handleSetMa} disabled={!connected || directInput === ''}>
                Set
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function ArrowUp() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
      <line x1="8" y1="13" x2="8" y2="3" />
      <polyline points="4,7 8,3 12,7" />
    </svg>
  )
}

function ArrowDown() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
      <line x1="8" y1="3" x2="8" y2="13" />
      <polyline points="4,9 8,13 12,9" />
    </svg>
  )
}
