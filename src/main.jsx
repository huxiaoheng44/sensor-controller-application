import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MQTTProvider } from './context/MQTTContext.jsx'
import './index.css'
import App from './App.jsx'
import TabletView from './views/TabletView.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <MQTTProvider>
        <Routes>
          <Route path="/"       element={<App />} />
          <Route path="/tablet" element={<TabletView />} />
          <Route path="*"       element={<Navigate to="/" replace />} />
        </Routes>
      </MQTTProvider>
    </BrowserRouter>
  </StrictMode>,
)
