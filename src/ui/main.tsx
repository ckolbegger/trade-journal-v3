import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppRoot } from './AppRoot'
import { createBooks, createValuations, createWorkspace } from '@/bootstrap'
import './index.css'

// Composition root: the single place where Books and coordinators are
// constructed and wired into the app.

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

const { tradeBook, journal } = createBooks()
const valuations = createValuations(tradeBook)

// Seed defaults (apply-iff-absent) at every startup before the first render.
createWorkspace(tradeBook, journal)
  .ensureSeeded()
  .finally(() => {
    createRoot(rootElement).render(
      <StrictMode>
        <BrowserRouter>
          <AppRoot tradeBook={tradeBook} journal={journal} valuations={valuations} />
        </BrowserRouter>
      </StrictMode>,
    )
  })
