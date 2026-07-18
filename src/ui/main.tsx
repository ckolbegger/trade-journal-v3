import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppRoot } from './AppRoot'
import {
  createBooks,
  createPriceBook,
  createReview,
  createValuations,
  createWorkspace,
} from '@/bootstrap'
import './index.css'

// Composition root: the single place where Books and coordinators are
// constructed and wired into the app.

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

async function start() {
  const { tradeBook, journal, binding } = createBooks()
  const workspace = createWorkspace(tradeBook, journal, binding)
  // PriceBook's adapters are built from persisted Settings — registration
  // happens once, here, at startup (docs/plan/slice-04-automated-pricing.md).
  const pricingSources = await workspace.settings.get('pricingSources')
  const priceBook = createPriceBook(binding, pricingSources)
  const valuations = createValuations(tradeBook, priceBook)
  const review = createReview(valuations, journal, tradeBook)

  // Seed defaults (apply-iff-absent) at every startup before the first render.
  await workspace.ensureSeeded()

  createRoot(rootElement!).render(
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
}

void start()
