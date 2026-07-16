import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPage } from './SettingsPage'
import { TradeBookContext } from '../tradeBookContext'
import { WorkspaceContext } from '../workspaceContext'
import { Workspace } from '@/workspace/workspace'
import { inMemoryBooks } from '../../../tests/support/trade-book'

function renderSettings() {
  const { tradeBook, journal } = inMemoryBooks()
  const workspace = new Workspace(tradeBook, journal)
  render(
    <TradeBookContext.Provider value={tradeBook}>
      <WorkspaceContext.Provider value={workspace}>
        <SettingsPage />
      </WorkspaceContext.Provider>
    </TradeBookContext.Provider>,
  )
  return { workspace }
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
