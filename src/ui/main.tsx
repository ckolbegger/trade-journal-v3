import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppRoot } from './AppRoot'
import { createTradeBook, createWorkspace } from '@/bootstrap'

// Composition root: the single place where Books and coordinators are
// constructed and wired into the app.

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

const tradeBook = createTradeBook()

// Seed defaults (apply-iff-absent) at every startup before the first render.
createWorkspace(tradeBook)
  .ensureSeeded()
  .finally(() => {
    createRoot(rootElement).render(
      <StrictMode>
        <BrowserRouter>
          <AppRoot tradeBook={tradeBook} />
        </BrowserRouter>
      </StrictMode>,
    )
  })
