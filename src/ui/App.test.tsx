import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'
import { TradeBookContext } from './tradeBookContext'
import { ValuationsContext } from './valuationsContext'
import { Valuations } from '@/coordinators/valuations'
import { inMemoryBooks } from '../../tests/support/trade-book'

function renderAt(path: string) {
  const { tradeBook, priceBook } = inMemoryBooks()
  return render(
    <TradeBookContext.Provider value={tradeBook}>
      <ValuationsContext.Provider value={new Valuations(tradeBook, priceBook)}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </ValuationsContext.Provider>
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
