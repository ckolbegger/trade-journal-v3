import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { GlobalErrorBanner } from './ui/global-error-banner'
import { GlobalErrorBoundary } from './ui/global-error-boundary'
import { installGlobalErrorHandlers } from './ui/global-errors'
import './ui/styles.css'

installGlobalErrorHandlers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBanner />
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Register immediately so control can be established while readiness is
  // being probed; clients.claim() in the generated worker avoids a reload.
  void navigator.serviceWorker.register('/sw.js').catch(() => { /* readiness reports the failure */ })
}
