import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RestoreFlow } from './RestoreFlow'
import { WorkspaceContext } from '../workspaceContext'
import { TradeBookContext } from '../tradeBookContext'
import { Onboarding } from '../Onboarding'
import { Workspace, EXPORT_SCHEMA_VERSION, EXPORTED_STORES } from '@/workspace/workspace'
import type { TradeBook } from '@/books/tradebook/trade-book'
import { inMemoryBooks } from '../../../tests/support/trade-book'

function emptyStores(): Record<string, unknown[]> {
  return Object.fromEntries(EXPORTED_STORES.map((store) => [store, []]))
}

function backupFile(
  stores: Record<string, unknown[]>,
  schemaVersion = EXPORT_SCHEMA_VERSION,
): File {
  return new File(
    [
      JSON.stringify({
        schemaVersion,
        exportedAt: Date.now(),
        stores: { ...emptyStores(), ...stores },
      }),
    ],
    'backup.json',
    { type: 'application/json' },
  )
}

function renderRestoreFlow(onRestored?: (report: unknown) => void) {
  const { tradeBook, journal, priceBook, binding } = inMemoryBooks()
  const workspace = new Workspace(tradeBook, journal, binding)
  render(
    <TradeBookContext.Provider value={tradeBook}>
      <WorkspaceContext.Provider value={workspace}>
        <RestoreFlow onRestored={onRestored} />
      </WorkspaceContext.Provider>
    </TradeBookContext.Provider>,
  )
  return { workspace, tradeBook, journal, priceBook }
}

describe('RestoreFlow', () => {
  it('requires explicit confirmation naming the replacement', async () => {
    renderRestoreFlow()
    const user = userEvent.setup()

    await user.upload(screen.getByLabelText(/backup file/i), backupFile({}))

    expect(screen.getByText(/will replace all current data/i)).toBeInTheDocument()
    expect(screen.queryByText(/restored \d+ record/i)).not.toBeInTheDocument()
  })

  it('offers a safety export before replacing', async () => {
    renderRestoreFlow()
    const user = userEvent.setup()

    await user.upload(screen.getByLabelText(/backup file/i), backupFile({}))

    expect(screen.getByRole('button', { name: /export current data first/i })).toBeInTheDocument()
  })

  it('shows restored counts on success', async () => {
    const { tradeBook } = renderRestoreFlow()
    const user = userEvent.setup()

    await user.upload(
      screen.getByLabelText(/backup file/i),
      backupFile({ institutions: [{ id: 'inst-1', name: 'Schwab' }] }),
    )
    await user.click(screen.getByRole('button', { name: /replace all data/i }))

    expect(await screen.findByText(/restored 1 record/i)).toBeInTheDocument()
    // The count isn't just a display artifact — the shared binding actually
    // received the restored record.
    expect((await tradeBook.registries.institutions.list()).map((i) => i.name)).toEqual(['Schwab'])
  })

  it('shows the rejection reason and leaves data untouched on a bad file', async () => {
    const { tradeBook } = renderRestoreFlow()
    await tradeBook.registries.institutions.save({ id: 'inst-old', name: 'Old Broker' })
    const user = userEvent.setup()

    await user.upload(
      screen.getByLabelText(/backup file/i),
      backupFile({}, EXPORT_SCHEMA_VERSION + 1),
    )
    await user.click(screen.getByRole('button', { name: /replace all data/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/schema version/i)
    expect((await tradeBook.registries.institutions.list()).map((i) => i.name)).toEqual([
      'Old Broker',
    ])
  })

  it('is reachable from onboarding on a fresh profile', async () => {
    const { tradeBook, journal, binding } = inMemoryBooks()
    const workspace = new Workspace(tradeBook as TradeBook, journal, binding)
    render(
      <TradeBookContext.Provider value={tradeBook}>
        <WorkspaceContext.Provider value={workspace}>
          <Onboarding onComplete={() => {}} />
        </WorkspaceContext.Provider>
      </TradeBookContext.Provider>,
    )

    expect(await screen.findByLabelText(/backup file/i)).toBeInTheDocument()
  })
})
