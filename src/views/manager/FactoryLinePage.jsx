import { useState } from 'react'
import { useMQTTContext } from '../../context/MQTTContext'
import './FactoryLinePage.css'

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 5)   return 'just now'
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

const MACHINES = [
  { id: 'sealer-1',    name: 'Sealer',    station: 'Station 1', connection: 'sensor', realData: true  },
  { id: 'filler-2',   name: 'Filler',    station: 'Station 2', connection: 'api',    realData: false },
  { id: 'conveyor-3', name: 'Conveyor',  station: 'Station 3', connection: 'manual', realData: false },
  { id: 'labeler-4',  name: 'Labeler',   station: 'Station 4', connection: 'sensor', realData: false },
  { id: 'wrapper-5',  name: 'Wrapper',   station: 'Station 5', connection: 'api',    realData: false },
  { id: 'inspector-6',name: 'Inspector', station: 'Station 6', connection: 'manual', realData: false },
]

const MOCK_STATUS = {
  'filler-2':    'RUNNING',
  'conveyor-3':  'IDLE',
  'labeler-4':   'FAULT',
  'wrapper-5':   'RUNNING',
  'inspector-6': 'RUNNING',
}

const MOCK_DETAILS = {
  'filler-2':    { distance: 142, counter: 118, frequency: 3.1, lastSeen: Date.now() - 8000 },
  'conveyor-3':  { distance: null, counter: 0,   frequency: 0,   lastSeen: Date.now() - 120000 },
  'labeler-4':   { distance: 0,   counter: 89,  frequency: 0,   lastSeen: Date.now() - 45000 },
  'wrapper-5':   { distance: 231, counter: 205, frequency: 2.8, lastSeen: Date.now() - 5000 },
  'inspector-6': { distance: 189, counter: 197, frequency: 3.0, lastSeen: Date.now() - 3000 },
}

function getMachineStatus(machine, realStatus) {
  if (machine.realData) {
    const s = realStatus ?? 'IDLE'
    if (['RUNNING', 'OBJECT_ENTERING', 'OBJECT_PASSING'].includes(s)) return 'RUNNING'
    if (s === 'JAM' || s === 'ERROR') return 'FAULT'
    if (s === 'MACHINE_OFF') return 'IDLE'
    return 'IDLE'
  }
  return MOCK_STATUS[machine.id] ?? 'IDLE'
}

function stateInfo(s) {
  switch (s) {
    case 'RUNNING': return { cls: 'running', badge: '● Running' }
    case 'IDLE':    return { cls: 'idle',    badge: '○ Idle' }
    case 'FAULT':   return { cls: 'fault',   badge: '✕ Fault' }
    default:        return { cls: 'idle',    badge: '— Unknown' }
  }
}

function connLabel(type) {
  switch (type) {
    case 'sensor': return 'External Sensor'
    case 'api':    return 'Smart API'
    case 'manual': return 'Manual Reporting'
    default:       return type
  }
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function PanelContent({ machine, realData }) {
  const { latestData, machineSnapshot, counter, frequency, lastDataTime } = useMQTTContext()

  if (machine.realData) {
    const rawStatus = machineSnapshot?.status ?? 'IDLE'
    const displayStatus = getMachineStatus(machine, rawStatus)
    const distance = latestData?.distance
    return (
      <>
        <div className="fac-panel-metric">
          <div className="fac-panel-metric-label">Distance</div>
          <div className="fac-panel-metric-value">
            {distance != null ? distance : '—'}
            {distance != null && <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 4 }}>mm</span>}
          </div>
          <div className="fac-panel-metric-sub">Live sensor reading</div>
        </div>
        <div className="fac-panel-divider" />
        <div className="fac-panel-metric">
          <div className="fac-panel-metric-label">Machine Status</div>
          <div className={`fac-panel-metric-value${displayStatus === 'FAULT' ? ' fac-panel-metric-value--warn' : ''}`}
               style={{ fontSize: 20, letterSpacing: 0, fontWeight: 800 }}>
            {rawStatus}
          </div>
          <div className="fac-panel-metric-sub">{displayStatus}</div>
        </div>
        <div className="fac-panel-divider" />
        <div className="fac-panel-metric">
          <div className="fac-panel-metric-label">Counter</div>
          <div className="fac-panel-metric-value">{counter ?? 0}</div>
          <div className="fac-panel-metric-sub">pieces this session</div>
        </div>
        <div className="fac-panel-divider" />
        <div className="fac-panel-metric">
          <div className="fac-panel-metric-label">Frequency</div>
          <div className="fac-panel-metric-value">
            {typeof frequency === 'number' ? frequency.toFixed(2) : '—'}
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 4 }}>/min</span>
          </div>
          <div className="fac-panel-metric-sub">passing rate</div>
        </div>
        <div className="fac-panel-divider" />
        <div className="fac-panel-metric">
          <div className="fac-panel-metric-label">Last Seen</div>
          <div className="fac-panel-metric-value" style={{ fontSize: 20, fontWeight: 700 }}>
            {timeAgo(lastDataTime)}
          </div>
          <div className="fac-panel-metric-sub">data freshness</div>
        </div>
      </>
    )
  }

  const mock = MOCK_DETAILS[machine.id] ?? {}
  return (
    <>
      <div className="fac-panel-metric">
        <div className="fac-panel-metric-label">Distance</div>
        <div className="fac-panel-metric-value">
          {mock.distance != null && mock.distance > 0 ? mock.distance : '—'}
          {mock.distance != null && mock.distance > 0 &&
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 4 }}>mm</span>}
        </div>
        <div className="fac-panel-metric-sub">Simulated reading</div>
      </div>
      <div className="fac-panel-divider" />
      <div className="fac-panel-metric">
        <div className="fac-panel-metric-label">Counter</div>
        <div className="fac-panel-metric-value">{mock.counter ?? 0}</div>
        <div className="fac-panel-metric-sub">pieces this session</div>
      </div>
      <div className="fac-panel-divider" />
      <div className="fac-panel-metric">
        <div className="fac-panel-metric-label">Frequency</div>
        <div className="fac-panel-metric-value">
          {mock.frequency != null ? mock.frequency.toFixed(2) : '—'}
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 4 }}>/min</span>
        </div>
        <div className="fac-panel-metric-sub">passing rate</div>
      </div>
      <div className="fac-panel-divider" />
      <div className="fac-panel-metric">
        <div className="fac-panel-metric-label">Last Seen</div>
        <div className="fac-panel-metric-value" style={{ fontSize: 20, fontWeight: 700 }}>
          {timeAgo(mock.lastSeen)}
        </div>
        <div className="fac-panel-metric-sub">data freshness</div>
      </div>
    </>
  )
}

export default function FactoryLinePage() {
  const { machineSnapshot } = useMQTTContext()
  const [selectedMachine, setSelectedMachine] = useState(null)

  const realStatus = machineSnapshot?.status ?? null

  function handleCardClick(machine) {
    if (selectedMachine?.id === machine.id) {
      setSelectedMachine(null)
    } else {
      setSelectedMachine(machine)
    }
  }

  return (
    <div className="fac">
      <div className="fac-header">
        <h1 className="fac-title">Factory Line</h1>
        <span className="fac-line-chip">Line 1</span>
      </div>

      <div className="fac-body">
        <div className="fac-grid-wrap">
          <div className="fac-grid">
            {MACHINES.map((machine) => {
              const status = getMachineStatus(machine, realStatus)
              const { cls, badge } = stateInfo(status)
              const isSelected = selectedMachine?.id === machine.id

              return (
                <div
                  key={machine.id}
                  className={[
                    'fac-card',
                    `fac-card--${cls}`,
                    machine.realData ? 'fac-card--clickable' : '',
                    isSelected ? 'fac-card--selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => machine.realData && handleCardClick(machine)}
                >
                  <div className="fac-card-top">
                    <div>
                      <div className="fac-card-name">{machine.name}</div>
                      <div className="fac-card-station">{machine.station}</div>
                    </div>
                    <span className={`fac-state-badge fac-state-badge--${cls}`}>{badge}</span>
                  </div>
                  <div className="fac-card-footer">
                    <span className={`fac-conn-badge fac-conn-badge--${machine.connection}`}>
                      {connLabel(machine.connection)}
                    </span>
                    {machine.realData && (
                      <span className="fac-sensor-hint">View details →</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {selectedMachine && (
          <div className="fac-panel">
            <div className="fac-panel-header">
              <span className="fac-panel-title">{selectedMachine.name}</span>
              <button
                className="fac-panel-close"
                onClick={() => setSelectedMachine(null)}
                aria-label="Close panel"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="fac-panel-body">
              <PanelContent machine={selectedMachine} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
