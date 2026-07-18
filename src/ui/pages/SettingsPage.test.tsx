import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPage } from './SettingsPage'
import { TradeBookContext } from '../tradeBookContext'
import { WorkspaceContext } from '../workspaceContext'
import { PriceBookContext } from '../priceBookContext'
import { Workspace } from '@/workspace/workspace'
import type { DateRange, PricingSource, SourceObservation } from '@/books/pricebook/types'
import { inMemoryBooks } from '../../../tests/support/trade-book'

function renderSettings(sources: PricingSource[] = []) {
  const { tradeBook, journal, priceBook } = inMemoryBooks(sources)
  const workspace = new Workspace(tradeBook, journal)
  render(
    <TradeBookContext.Provider value={tradeBook}>
      <WorkspaceContext.Provider value={workspace}>
        <PriceBookContext.Provider value={priceBook}>
          <SettingsPage />
        </PriceBookContext.Provider>
      </WorkspaceContext.Provider>
    </TradeBookContext.Provider>,
  )
  return { workspace }
}

// A minimal PricingSource stub for "Test this source" — the same seam
// PriceBook.fetch routes through, without a real adapter's HTTP concerns.
function stubSource(opts: {
  id: string
  observations?: SourceObservation[]
  error?: Error
}): PricingSource {
  return {
    id: opts.id,
    supports: () => true,
    fetch: async (_instruments: string[], _range: DateRange) => {
      if (opts.error) throw opts.error
      return opts.observations ?? []
    },
  }
}

describe('SettingsPage — risk-free rate', () => {
  it('shows the default risk-free rate (4%)', async () => {
    renderSettings()
    expect(await screen.findByLabelText(/risk-free rate/i)).toHaveValue(4)
  })

  it('saves a changed risk-free rate as a decimal setting', async () => {
    const { workspace } = renderSettings()
    const user = userEvent.setup()

    const field = await screen.findByLabelText(/risk-free rate/i)
    await user.clear(field)
    await user.type(field, '5')
    await user.click(screen.getByRole('button', { name: /save rate/i }))

    expect(await workspace.settings.get('riskFreeRate')).toBe(0.05)
  })
})

describe('PricingSettings', () => {
  it('persists enablement and key via Workspace.settings', async () => {
    const { workspace } = renderSettings()
    const user = userEvent.setup()

    await user.click(await screen.findByLabelText(/enable marketdata\.app/i))
    await user.type(screen.getByLabelText(/api key/i), 'my-api-key')
    await user.click(screen.getByRole('button', { name: /save source/i }))

    expect(await workspace.settings.get('pricingSources')).toEqual([
      { id: 'marketdata.app', enabled: true, apiKey: 'my-api-key' },
    ])
  })

  it('shows test success with the latest fetched close in the trailing window and its date', async () => {
    // Out of order, and a weekend gap — the shown close is the LATEST date's,
    // not the last item in the array (a same-day-only test is a false
    // negative every weekend/holiday: it needs a trailing window).
    const source = stubSource({
      id: 'marketdata.app',
      observations: [
        { instrument: 'MSFT', date: '2026-07-13', close: 39000 },
        { instrument: 'MSFT', date: '2026-07-17', close: 39382 },
      ],
    })
    renderSettings([source])
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /test this source/i }))

    expect(await screen.findByText(/2026-07-17.*393\.82/)).toBeInTheDocument()
  })

  it("shows a bad key's error message verbatim", async () => {
    const source = stubSource({
      id: 'marketdata.app',
      error: new Error('Invalid token header. No credentials provided.'),
    })
    renderSettings([source])
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /test this source/i }))

    expect(
      await screen.findByText('Invalid token header. No credentials provided.'),
    ).toBeInTheDocument()
  })

  it('shows a message (never a blank result) when the source returns no price for the whole trailing window', async () => {
    const source = stubSource({ id: 'marketdata.app', observations: [] })
    renderSettings([source])
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /test this source/i }))

    expect(await screen.findByText(/no price returned for msft/i)).toBeInTheDocument()
  })
})
