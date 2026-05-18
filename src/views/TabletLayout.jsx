import { useState } from 'react'
import { useMQTTContext } from '../context/MQTTContext'
import { useAlerts } from '../hooks/useAlerts'
import OverviewPage from './pages/OverviewPage'
import AlertsPage from './pages/AlertsPage'
import SensorDataPage from './pages/SensorDataPage'
import ActivityLogPage from './pages/ActivityLogPage'
import './TabletLayout.css'

function IconOverview() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}
function IconAlerts() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function IconSensor() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
}
function IconLog() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
}

const NAV = [
  { id: 'overview', label: 'Overview',     Icon: IconOverview },
  { id: 'alerts',   label: 'Alerts',       Icon: IconAlerts },
  { id: 'sensor',   label: 'Sensor Data',  Icon: IconSensor },
  { id: 'log',      label: 'Activity Log', Icon: IconLog },
]

export default function TabletLayout() {
  const [page, setPage] = useState('overview')
  const { connected } = useMQTTContext()
  const { pendingCount } = useAlerts()

  return (
    <div className="tl">
      <main className="tl-content">
        {page === 'overview' && <OverviewPage onNavigate={setPage} />}
        {page === 'alerts'   && <AlertsPage />}
        {page === 'sensor'   && <SensorDataPage />}
        {page === 'log'      && <ActivityLogPage />}
      </main>

      <nav className="tl-bottomnav">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`tl-tab${page === id ? ' tl-tab--active' : ''}`}
            onClick={() => setPage(id)}
          >
            <span className="tl-tab-icon-wrap">
              <span className="tl-tab-icon"><Icon /></span>
              {id === 'alerts' && pendingCount > 0 && (
                <span className="tl-tab-badge">{pendingCount}</span>
              )}
            </span>
            <span className="tl-tab-label">{label}</span>
          </button>
        ))}

        <div className="tl-tab tl-tab-conn">
          <span className={`tl-conn-dot${connected ? ' tl-conn-dot--online' : ''}`} />
          <span className="tl-tab-label">{connected ? 'Online' : 'Offline'}</span>
        </div>
      </nav>
    </div>
  )
}
