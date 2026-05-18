import { useState, useEffect, useRef } from 'react'
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
  { id: 'multivac-rx4',    name: 'Multivac RX4',        connection: 'api',    realData: false, gridRow: 1, gridCol: 1 },
  { id: 'sealing-station', name: 'Sealing Station',     connection: 'sensor', realData: true,  gridRow: 1, gridCol: 2 },
  { id: 'labeler-l2',      name: 'Labeler L2',           connection: 'api',    realData: false, gridRow: 1, gridCol: 3 },
  { id: 'packaging-b',     name: 'Packaging Station B',  connection: 'manual', realData: false, gridRow: 1, gridCol: 4 },
  { id: 'conveyor-c1',     name: 'Conveyor C1',          connection: 'api',    realData: false, gridRow: 2, gridCol: 1 },
  { id: 'filler-f3',       name: 'Filler F3',            connection: 'sensor', realData: false, gridRow: 2, gridCol: 2 },
  { id: 'capper-k1',       name: 'Capper K1',            connection: 'api',    realData: false, gridRow: 2, gridCol: 3 },
  { id: 'inspection',      name: 'Inspection',           connection: 'manual', realData: false, gridRow: 3, gridCol: 2 },
  { id: 'palletizer-p1',   name: 'Palletizer P1',        connection: 'api',    realData: false, gridRow: 3, gridCol: 3 },
]

const CONNECTIONS = [
  { from: 'sealing-station', to: 'conveyor-c1',   active: false },
  { from: 'sealing-station', to: 'filler-f3',     active: true  },
  { from: 'sealing-station', to: 'capper-k1',     active: false },
  { from: 'conveyor-c1',     to: 'inspection',    active: false },
  { from: 'filler-f3',       to: 'palletizer-p1', active: false },
]

const MOCK_STATUS = {
  'multivac-rx4':  { status: 'RUNNING',      throughput: 48 },
  'labeler-l2':    { status: 'RUNNING',      throughput: 51 },
  'packaging-b':   { status: 'IDLE',         throughput: null },
  'conveyor-c1':   { status: 'RUNNING',      throughput: null },
  'filler-f3':     { status: 'RUNNING',      throughput: 47 },
  'capper-k1':     { status: 'RUNNING',      throughput: 50 },
  'inspection':    { status: 'DISCONNECTED', throughput: null },
  'palletizer-p1': { status: 'RUNNING',      throughput: null },
}

const MOCK_DETAILS = {
  'multivac-rx4':  { counter: 312, frequency: 4.8, lastSeen: Date.now() - 4000   },
  'labeler-l2':    { counter: 287, frequency: 3.2, lastSeen: Date.now() - 6000   },
  'conveyor-c1':   { counter: 0,   frequency: 0,   lastSeen: Date.now() - 120000 },
  'filler-f3':     { counter: 156, frequency: 2.9, lastSeen: Date.now() - 7000   },
  'capper-k1':     { counter: 198, frequency: 3.1, lastSeen: Date.now() - 5000   },
  'palletizer-p1': { counter: 287, frequency: 2.8, lastSeen: Date.now() - 9000   },
}

const CONN_LABELS = {
  sensor: 'EXTERNAL SENSOR',
  api:    'SMART API',
  manual: 'MANUAL REPORTING',
}

const FILTERS = [
  { id: 'all',    label: 'ALL' },
  { id: 'api',    label: 'SMART API' },
  { id: 'sensor', label: 'EXTERNAL SENSOR' },
  { id: 'manual', label: 'MANUAL' },
]

function getMachineStatus(machine, realStatus) {
  if (machine.realData) {
    const s = realStatus ?? 'IDLE'
    if (['RUNNING', 'OBJECT_ENTERING', 'OBJECT_PASSING'].includes(s)) return 'RUNNING'
    if (s === 'JAM' || s === 'ERROR') return 'FAULT'
    return 'IDLE'
  }
  return MOCK_STATUS[machine.id]?.status ?? 'IDLE'
}

function getMachineThroughput(machine, realFrequency) {
  if (machine.realData) {
    return typeof realFrequency === 'number' ? `${realFrequency.toFixed(1)} u/min` : null
  }
  const tp = MOCK_STATUS[machine.id]?.throughput
  return tp != null ? `${tp} u/min` : null
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none">
      <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function PanelContent({ machine }) {
  const { latestData, machineSnapshot, counter, frequency, lastDataTime } = useMQTTContext()

  if (machine.realData) {
    const rawStatus = machineSnapshot?.status ?? 'IDLE'
    const status = getMachineStatus(machine, rawStatus)
    const distance = latestData?.distance
    return (
      <div className="fac-panel-metrics">
        <div className="fac-pm">
          <span className="fac-pm-label">Machine Status</span>
          <span className={`fac-pm-value fac-pm-value--${status.toLowerCase()}`}>{rawStatus}</span>
        </div>
        <div className="fac-pm">
          <span className="fac-pm-label">Distance</span>
          <span className="fac-pm-value">{distance != null ? `${distance} mm` : '—'}</span>
          <span className="fac-pm-sub">Live sensor reading</span>
        </div>
        <div className="fac-pm">
          <span className="fac-pm-label">Counter</span>
          <span className="fac-pm-value">{counter ?? 0}</span>
          <span className="fac-pm-sub">pcs this session</span>
        </div>
        <div className="fac-pm">
          <span className="fac-pm-label">Frequency</span>
          <span className="fac-pm-value">{typeof frequency === 'number' ? `${frequency.toFixed(2)} /min` : '—'}</span>
        </div>
        <div className="fac-pm">
          <span className="fac-pm-label">Last Seen</span>
          <span className="fac-pm-value fac-pm-value--meta">{timeAgo(lastDataTime)}</span>
        </div>
      </div>
    )
  }

  const mock = MOCK_DETAILS[machine.id]
  if (!mock) {
    return <p className="fac-panel-empty">No sensor data — manual reporting only.</p>
  }
  return (
    <div className="fac-panel-metrics">
      <div className="fac-pm">
        <span className="fac-pm-label">Counter</span>
        <span className="fac-pm-value">{mock.counter}</span>
        <span className="fac-pm-sub">pcs this session</span>
      </div>
      <div className="fac-pm">
        <span className="fac-pm-label">Frequency</span>
        <span className="fac-pm-value">{mock.frequency > 0 ? `${mock.frequency.toFixed(2)} /min` : '—'}</span>
      </div>
      <div className="fac-pm">
        <span className="fac-pm-label">Last Seen</span>
        <span className="fac-pm-value fac-pm-value--meta">{timeAgo(mock.lastSeen)}</span>
        <span className="fac-pm-sub">simulated data</span>
      </div>
    </div>
  )
}

export default function FactoryLinePage() {
  const { machineSnapshot, frequency: mqttFrequency, connected } = useMQTTContext()
  const [selectedId, setSelectedId]   = useState(null)
  const [filter, setFilter]           = useState('all')
  const [now, setNow]                 = useState(Date.now())
  const [lines, setLines]             = useState([])
  const containerRef                  = useRef(null)
  const cardRefs                      = useRef({})

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  function measureLines() {
    if (!containerRef.current) return
    const box = containerRef.current.getBoundingClientRect()
    const next = CONNECTIONS.map(conn => {
      const a = cardRefs.current[conn.from]
      const b = cardRefs.current[conn.to]
      if (!a || !b) return null
      const ar = a.getBoundingClientRect()
      const br = b.getBoundingClientRect()
      return {
        x1: ar.left + ar.width / 2 - box.left,
        y1: ar.bottom - box.top,
        x2: br.left + br.width / 2 - box.left,
        y2: br.top - box.top,
        active: conn.active,
      }
    }).filter(Boolean)
    setLines(next)
  }

  useEffect(() => {
    measureLines()
    const obs = new ResizeObserver(measureLines)
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const id = setTimeout(measureLines, 220)
    return () => clearTimeout(id)
  }, [selectedId])

  const realStatus    = machineSnapshot?.status ?? null
  const selectedMachine = MACHINES.find(m => m.id === selectedId) ?? null

  function handleCardClick(machine) {
    if (machine.connection === 'manual') return
    setSelectedId(prev => prev === machine.id ? null : machine.id)
  }

  const headerDate = new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const headerTime = new Date(now).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fac">
      {/* Header */}
      <div className="fac-header">
        <h1 className="fac-title">
          <span className="fac-title-dark">Factory</span>{' '}
          <span className="fac-title-blue">Line</span>
        </h1>
        <div className="fac-header-right">
          <span className="fac-header-date">{headerDate} · {headerTime}</span>
          <span className={`fac-live${connected ? ' fac-live--on' : ''}`}>
            LIVE <span className="fac-live-dot" />
          </span>
        </div>
      </div>

      {/* Stats + filter bar */}
      <div className="fac-bar">
        <span className="fac-bar-stats">9 MACHINES · 4 LINES</span>
        <div className="fac-filters">
          {FILTERS.map(f => (
            <button
              key={f.id}
              className={`fac-filter${filter === f.id ? ' fac-filter--active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.id !== 'all' && <span className={`fac-filter-dot fac-filter-dot--${f.id}`} />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="fac-body">
        <div className="fac-map-wrap">
          <div className="fac-map" ref={containerRef}>

            {/* SVG connection lines */}
            <svg className="fac-lines" aria-hidden="true">
              {lines.map((ln, i) => (
                <line
                  key={i}
                  x1={ln.x1} y1={ln.y1}
                  x2={ln.x2} y2={ln.y2}
                  className={`fac-line${ln.active ? ' fac-line--active' : ''}`}
                />
              ))}
            </svg>

            {/* Machine cards */}
            <div className="fac-map-grid">
              {MACHINES.map(machine => {
                const status     = getMachineStatus(machine, realStatus)
                const throughput = getMachineThroughput(machine, mqttFrequency)
                const isSelected = selectedId === machine.id
                const isDimmed   = filter !== 'all' && machine.connection !== filter
                const clickable  = machine.connection !== 'manual'

                return (
                  <div
                    key={machine.id}
                    ref={el => { cardRefs.current[machine.id] = el }}
                    style={{ gridRow: machine.gridRow, gridColumn: machine.gridCol }}
                    className={[
                      'fac-card',
                      clickable  ? 'fac-card--clickable' : '',
                      isSelected ? 'fac-card--selected'  : '',
                      isDimmed   ? 'fac-card--dimmed'    : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => handleCardClick(machine)}
                  >
                    <div className="fac-card-conn">
                      <span className={`fac-conn-dot fac-conn-dot--${machine.connection}`} />
                      <span className="fac-conn-label">{CONN_LABELS[machine.connection]}</span>
                    </div>
                    <div className="fac-card-name">{machine.name}</div>
                    <div className="fac-card-divider" />
                    <div className="fac-card-footer">
                      <span className={`fac-status fac-status--${status.toLowerCase()}`}>
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </span>
                      <span className="fac-throughput">
                        {throughput ?? '—'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

          </div>
        </div>

        {/* Detail panel */}
        {selectedMachine && (
          <div className="fac-panel">
            <div className="fac-panel-header">
              <div>
                <div className="fac-panel-name">{selectedMachine.name}</div>
                <div className="fac-panel-conn-row">
                  <span className={`fac-conn-dot fac-conn-dot--${selectedMachine.connection}`} />
                  <span className="fac-panel-conn-label">{CONN_LABELS[selectedMachine.connection]}</span>
                </div>
              </div>
              <button className="fac-panel-close" onClick={() => setSelectedId(null)} aria-label="Close">
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
