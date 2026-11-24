import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import './ui/styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Register immediately so control can be established while readiness is
  // being probed; clients.claim() in the generated worker avoids a reload.
  void navigator.serviceWorker.register('/sw.js').catch(() => { /* readiness reports the failure */ })
}
