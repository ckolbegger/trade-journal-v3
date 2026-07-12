import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'
import { TradeBookContext } from './tradeBookContext'
import { PriceBookContext } from './priceBookContext'
import { ValuationsContext } from './valuationsContext'
import { ReviewContext } from './reviewContext'
import { Valuations } from '@/coordinators/valuations'
import { Review } from '@/coordinators/review'
import { inMemoryBooks } from '../../tests/support/trade-book'

function renderAt(path: string) {
  const { tradeBook, journal, priceBook } = inMemoryBooks()
  const valuations = new Valuations(tradeBook, priceBook)
  return render(
    <TradeBookContext.Provider value={tradeBook}>
      <PriceBookContext.Provider value={priceBook}>
        <ValuationsContext.Provider value={valuations}>
          <ReviewContext.Provider value={new Review(valuations, journal, tradeBook)}>
            <MemoryRouter initialEntries={[path]}>
              <App />
            </MemoryRouter>
          </ReviewContext.Provider>
        </ValuationsContext.Provider>
      </PriceBookContext.Provider>
    </TradeBookContext.Provider>,
  )
}

describe('AppShell', () => {
  it('renders the header and nav links', () => {
    renderAt('/')
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Trades' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review' })).toBeInTheDocument()
  })

  it('renders the Trades stub at /', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Trades' })).toBeInTheDocument()
  })

  it('renders the Review stub at /review', () => {
    renderAt('/review')
    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument()
  })

  it('renders not-found for an unknown route', () => {
    renderAt('/does-not-exist')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
