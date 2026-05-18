import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MQTTProvider } from './context/MQTTContext.jsx'
import './index.css'
import App from './App.jsx'
import TabletLayout from './views/TabletLayout.jsx'
import ManagerView from './views/ManagerView.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <MQTTProvider>
        <Routes>
          <Route path="/"        element={<App />} />
          <Route path="/tablet"  element={<TabletLayout />} />
          <Route path="/manager" element={<ManagerView />} />
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </MQTTProvider>
    </BrowserRouter>
  </StrictMode>,
)
