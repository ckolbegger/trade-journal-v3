// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { plannedItem } from '../../../tests/support/views-fixtures.ts';
import type { UiFacade } from '../../app/compose.ts';
import { TradeList } from './TradeList.tsx';

afterEach(cleanup);

function renderList(facade: UiFacade) {
  render(
    <MemoryRouter>
      <TradeList facade={facade} timeZone="America/New_York" />
    </MemoryRouter>,
  );
}

describe('Planned list', () => {
  it('should render distinct Loading, Ready, Empty (with a New Plan action), and Error (with Retry) states', async () => {
    const loading = facadeDouble();
    vi.mocked(loading.TradeViewsAndReporting.browseTrades).mockReturnValue(new Promise(() => undefined));
    renderList(loading);
    expect(screen.getByRole('status').textContent).toMatch(/loading planned trades/i);
    cleanup();

    const ready = facadeDouble();
    vi.mocked(ready.TradeViewsAndReporting.browseTrades).mockResolvedValue({ kind: 'Ready', view: { items: [plannedItem] }, binding: {} } as never);
    renderList(ready);
    expect(await screen.findByRole('table', { name: 'Planned Trades' })).toBeTruthy();
    cleanup();

    const empty = facadeDouble();
    vi.mocked(empty.TradeViewsAndReporting.browseTrades).mockResolvedValue({ kind: 'Ready', view: { items: [] }, binding: {} } as never);
    renderList(empty);
    expect(await screen.findByText(/no planned trades yet/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New Plan' }).getAttribute('href')).toBe('/plans/new');
    cleanup();

    const failing = facadeDouble();
    vi.mocked(failing.TradeViewsAndReporting.browseTrades)
      .mockResolvedValueOnce({ kind: 'ChangedDuringAssembly' })
      .mockResolvedValueOnce({ kind: 'Ready', view: { items: [] }, binding: {} } as never);
    renderList(failing);
    expect(await screen.findByText(/couldn’t load your planned trades/i)).toBeTruthy();
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(await screen.findByText(/no planned trades yet/i)).toBeTruthy();
  });

  it('should show underlying, Strategy, Account, Plan time in the Workspace zone, 1R, Original Planned Reward, and ratio, right-aligned with tabular numerals and units', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.browseTrades).mockResolvedValue({ kind: 'Ready', view: { items: [plannedItem] }, binding: {} } as never);
    renderList(facade);
    const table = await screen.findByRole('table', { name: 'Planned Trades' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Underlying',
      'Strategy',
      'Account',
      'Plan time',
      '1R',
      'Planned reward',
      'Reward : risk',
      'Entry',
    ]);
    const cells = within(within(table).getAllByRole('row')[1]!).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual([
      'XYZ',
      'Long Stock',
      'Fidelity — Roth IRA',
      '2026-10-12 09:30',
      '$250.00',
      '$600.00',
      '2.4',
      'Awaiting entry',
    ]);
    for (const numeric of [cells[4]!, cells[5]!, cells[6]!]) expect(numeric.className).toBe('number');
  });
});
