import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPage } from './SettingsPage'
import { TradeBookContext } from '../tradeBookContext'
import { WorkspaceContext } from '../workspaceContext'
import { PriceBookContext } from '../priceBookContext'
import {
  Workspace,
  EXPORT_SCHEMA_VERSION,
  EXPORTED_STORES,
  type StorageManager,
} from '@/workspace/workspace'
import type { DateRange, PricingSource, SourceObservation } from '@/books/pricebook/types'
import { inMemoryBooks } from '../../../tests/support/trade-book'

function renderSettings(sources: PricingSource[] = [], storageManager?: StorageManager) {
  const { tradeBook, journal, priceBook } = inMemoryBooks(sources)
  const workspace = new Workspace(tradeBook, journal, undefined, storageManager)
  render(
    <TradeBookContext.Provider value={tradeBook}>
      <WorkspaceContext.Provider value={workspace}>
        <PriceBookContext.Provider value={priceBook}>
          <SettingsPage />
        </PriceBookContext.Provider>
      </WorkspaceContext.Provider>
    </TradeBookContext.Provider>,
  )
  return { workspace, tradeBook }
}

function makeStorageManager(overrides: Partial<StorageManager> = {}): StorageManager {
  return {
    persisted: async () => false,
    persist: async () => false,
    estimate: async () => ({ usage: 0, quota: 0 }),
    ...overrides,
  }
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

  it('names the reload requirement when no source is registered at all (a saved key not yet active)', async () => {
    // PriceBook's adapters are built once at startup from Settings — saving a
    // key here does not register a source in the ALREADY-RUNNING PriceBook the
    // page is testing against (main.tsx). No source ⇒ MSFT lands in
    // `unsupported`, not `errors`, so this must not read like "no data".
    renderSettings([])
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /test this source/i }))

    expect(await screen.findByText(/reload the page/i)).toBeInTheDocument()
  })
})

describe('BackupSettings', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.restoreAllMocks()
  })

  it('shows health figures and last-export date', async () => {
    renderSettings(
      [],
      makeStorageManager({
        persisted: async () => true,
        estimate: async () => ({ usage: 2_000_000, quota: 100_000_000 }),
      }),
    )

    expect(await screen.findByText(/durable storage: yes/i)).toBeInTheDocument()
    expect(await screen.findByText(/1\.9.*mb.*95\.4.*mb/i)).toBeInTheDocument()
    expect(await screen.findByText(/never exported/i)).toBeInTheDocument()
  })

  it('triggers a download and updates lastExportAt', async () => {
    const { workspace } = renderSettings([], makeStorageManager())
    const user = userEvent.setup()
    expect((await workspace.storageHealth()).lastExportAt).toBeUndefined()

    await user.click(await screen.findByRole('button', { name: /export backup/i }))

    expect(await screen.findByText(/last export:/i)).toBeInTheDocument()
    expect((await workspace.storageHealth()).lastExportAt).toBeDefined()
  })

  it('hides the persistence request once granted', async () => {
    let persisted = false
    renderSettings(
      [],
      makeStorageManager({
        persist: async () => {
          persisted = true
          return true
        },
        persisted: async () => persisted,
      }),
    )
    const user = userEvent.setup()

    expect(
      await screen.findByRole('button', { name: /request durable storage/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /request durable storage/i }))

    expect(await screen.findByText(/durable storage: yes/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /request durable storage/i }),
    ).not.toBeInTheDocument()
  })

  it('refreshes the institutions and accounts lists after a successful restore', async () => {
    const { tradeBook, journal, priceBook, binding } = inMemoryBooks()
    await tradeBook.registries.institutions.save({ id: 'inst-old', name: 'Old Broker' })
    const workspace = new Workspace(tradeBook, journal, binding)
    const { container } = render(
      <TradeBookContext.Provider value={tradeBook}>
        <WorkspaceContext.Provider value={workspace}>
          <PriceBookContext.Provider value={priceBook}>
            <SettingsPage />
          </PriceBookContext.Provider>
        </WorkspaceContext.Provider>
      </TradeBookContext.Provider>,
    )
    const user = userEvent.setup()
    // Institution names also appear as <option>s in the Accounts form's
    // Institution select — scope to the Institutions card's own list to
    // disambiguate (it's the first <ul> the page renders).
    function institutionsList() {
      return within(container.querySelectorAll('ul')[0]!)
    }
    expect(await institutionsList().findByText('Old Broker')).toBeInTheDocument()

    const emptyStores = Object.fromEntries(EXPORTED_STORES.map((store) => [store, []]))
    const file = new File(
      [
        JSON.stringify({
          schemaVersion: EXPORT_SCHEMA_VERSION,
          exportedAt: Date.now(),
          stores: { ...emptyStores, institutions: [{ id: 'inst-new', name: 'New Broker' }] },
        }),
      ],
      'backup.json',
      { type: 'application/json' },
    )

    await user.upload(screen.getByLabelText(/backup file/i), file)
    await user.click(screen.getByRole('button', { name: /replace all data/i }))

    expect(await institutionsList().findByText('New Broker')).toBeInTheDocument()
    expect(institutionsList().queryByText('Old Broker')).not.toBeInTheDocument()
  })
})
