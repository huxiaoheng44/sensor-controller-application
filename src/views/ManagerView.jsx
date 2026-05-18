import { useState } from 'react'
import { useMQTTContext } from '../context/MQTTContext'
import { useAlerts } from '../hooks/useAlerts'
import OverviewPage from './manager/OverviewPage'
import FactoryLinePage from './manager/FactoryLinePage'
import AICenterPage from './manager/AICenterPage'
import './ManagerView.css'

function IconGrid() {
  return (
    <svg viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="10" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="1" y="10" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="10" y="10" width="6" height="6" rx="1.5" fill="currentColor" />
    </svg>
  )
}

function IconFactory() {
  return (
    <svg viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M1 14V7l4-3v3l4-3v3l4-3v10H1z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="3" y="10" width="2" height="4" rx="0.5" fill="currentColor" />
      <rect x="7.5" y="10" width="2" height="4" rx="0.5" fill="currentColor" />
      <rect x="12" y="10" width="2" height="4" rx="0.5" fill="currentColor" />
    </svg>
  )
}

function IconAI() {
  return (
    <svg viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8.5" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8.5 1v2M8.5 14v2M1 8.5h2M14 8.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M3.4 3.4l1.4 1.4M12.2 12.2l1.4 1.4M12.2 3.4l-1.4 1.4M4.8 12.2l-1.4 1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconSignal() {
  return (
    <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="18" width="4" height="12" rx="1.5" fill="currentColor" opacity="0.4" />
      <rect x="11" y="12" width="4" height="18" rx="1.5" fill="currentColor" opacity="0.65" />
      <rect x="18" y="6" width="4" height="24" rx="1.5" fill="currentColor" opacity="0.85" />
      <rect x="25" y="2" width="4" height="28" rx="1.5" fill="currentColor" />
    </svg>
  )
}

const NAV = [
  { id: 'overview', label: 'Overview',     Icon: IconGrid },
  { id: 'factory',  label: 'Factory Line', Icon: IconFactory },
  { id: 'ai',       label: 'AI Center',    Icon: IconAI },
]

export default function ManagerView() {
  const [page, setPage] = useState('overview')
  const { connected } = useMQTTContext()
  const { pendingCount } = useAlerts()

  return (
    <div className="mv">
      <aside className="mv-sidebar">
        <div className="mv-brand">
          <span className="mv-brand-icon">
            <IconSignal />
          </span>
          <div className="mv-brand-text">
            <span className="mv-brand-name">OEE Monitor</span>
            <span className="mv-brand-sub">Manager Dashboard</span>
          </div>
        </div>

        <nav className="mv-nav">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`mv-nav-item${page === id ? ' mv-nav-item--active' : ''}`}
              onClick={() => setPage(id)}
            >
              <span className="mv-nav-icon"><Icon /></span>
              <span className="mv-nav-label">{label}</span>
              {id === 'ai' && pendingCount > 0 && (
                <span className="mv-nav-badge">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="mv-sidebar-footer">
          <span className={`mv-conn-dot${connected ? ' mv-conn-dot--online' : ''}`} />
          <span className="mv-conn-label">{connected ? 'Live Data' : 'Offline'}</span>
        </div>
      </aside>

      <main className="mv-content">
        {page === 'overview' && <OverviewPage />}
        {page === 'factory'  && <FactoryLinePage />}
        {page === 'ai'       && <AICenterPage />}
      </main>
    </div>
  )
}
