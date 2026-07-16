import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppRoot } from './AppRoot'
import { createBooks, createReview, createValuations, createWorkspace } from '@/bootstrap'
import './index.css'

// Composition root: the single place where Books and coordinators are
// constructed and wired into the app.

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

const { tradeBook, journal, priceBook, binding } = createBooks()
const valuations = createValuations(tradeBook, priceBook)
const review = createReview(valuations, journal, tradeBook)
const workspace = createWorkspace(tradeBook, journal, binding)

// Seed defaults (apply-iff-absent) at every startup before the first render.
workspace.ensureSeeded().finally(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <AppRoot
          tradeBook={tradeBook}
          journal={journal}
          priceBook={priceBook}
          valuations={valuations}
          review={review}
          workspace={workspace}
        />
      </BrowserRouter>
    </StrictMode>,
  )
})
