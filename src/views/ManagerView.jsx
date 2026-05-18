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
      <path d="M1 14V7l4-3v3l4-3v3l4-3v10H1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
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

function IconAlerts() {
  return (
    <svg viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 13V5a6.5 6.5 0 0 1 13 0v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M1 13h15M6.5 13a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8.5" cy="8.5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8.5 1.5v1.8M8.5 13.7v1.8M1.5 8.5h1.8M13.7 8.5h1.8M3.5 3.5l1.3 1.3M12.2 12.2l1.3 1.3M12.2 3.5l-1.3 1.3M4.8 12.2l-1.3 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

const NAV_PLATFORM = [
  { id: 'overview', label: 'Overview',     Icon: IconGrid    },
  { id: 'factory',  label: 'Factory Line', Icon: IconFactory },
  { id: 'ai',       label: 'AI Center',    Icon: IconAI      },
]

const NAV_WORKSPACE = [
  { id: 'alerts',   label: 'Alerts',   Icon: IconAlerts },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
]

export default function ManagerView() {
  const [page, setPage] = useState('overview')
  const { connected } = useMQTTContext()
  const { pendingCount } = useAlerts()

  return (
    <div className="mv">
      <aside className="mv-sidebar">
        {/* Brand */}
        <div className="mv-brand">
          <div className="mv-brand-icon">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="20" height="20" rx="5" fill="white" fillOpacity="0.22" />
              <path d="M5 10.5L8.5 7L10 9.5L12 6.5L15 10.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="13.5" r="1.2" fill="white" />
            </svg>
          </div>
          <span className="mv-brand-name">PingPong</span>
        </div>

        <nav className="mv-nav">
          {/* Platform section */}
          <p className="mv-nav-section">Platform</p>
          {NAV_PLATFORM.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`mv-nav-item${page === id ? ' mv-nav-item--active' : ''}`}
              onClick={() => setPage(id)}
            >
              <span className="mv-nav-icon"><Icon /></span>
              <span className="mv-nav-label">{label}</span>
            </button>
          ))}

          {/* Workspace section */}
          <p className="mv-nav-section mv-nav-section--gap">Workspace</p>
          {NAV_WORKSPACE.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`mv-nav-item${page === id ? ' mv-nav-item--active' : ''}`}
              onClick={() => setPage(id)}
            >
              <span className="mv-nav-icon"><Icon /></span>
              <span className="mv-nav-label">{label}</span>
              {id === 'alerts' && pendingCount > 0 && (
                <span className="mv-nav-badge">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* User profile */}
        <div className="mv-user">
          <div className={`mv-user-avatar${connected ? ' mv-user-avatar--online' : ''}`}>M</div>
          <div className="mv-user-info">
            <span className="mv-user-name">Manager</span>
            <span className="mv-user-role">Plant Manager</span>
          </div>
        </div>
      </aside>

      <main className="mv-content">
        {page === 'overview'  && <OverviewPage />}
        {page === 'factory'   && <FactoryLinePage />}
        {page === 'ai'        && <AICenterPage />}
      </main>
    </div>
  )
}
