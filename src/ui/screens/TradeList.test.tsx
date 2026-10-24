// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { openItem, plannedItem } from '../../../tests/support/views-fixtures.ts';
import type { UiFacade } from '../../app/compose.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { TradeList } from './TradeList.tsx';

afterEach(cleanup);

function renderList(facade: UiFacade, entry = '/?lifecycle=Planned') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <TradeList facade={facade} timeZone="America/New_York" />
    </MemoryRouter>,
  );
}

const readyPage = (items: readonly unknown[]) => ({ kind: 'Ready', view: { items }, binding: {} }) as never;

describe('lifecycle tabs', () => {
  it('should show Open and Planned tabs as a tablist with Open selected by default, and no other lifecycle', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.browseTrades).mockResolvedValue(readyPage([]));
    renderList(facade, '/');
    const tablist = screen.getByRole('tablist', {
      name: 'Trades by lifecycle',
    });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Open', 'Planned']);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(screen.getByRole('tabpanel', { name: 'Open' })).toBeTruthy();
    expect(vi.mocked(facade.TradeViewsAndReporting.browseTrades)).toHaveBeenCalledWith({ lifecycle: 'Open' });
    await screen.findByText(/no open trades/i);

    // One tab stop; the arrow keys move between the tabs.
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1]);
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Planned' }).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Planned' }));
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Planned' }), {
      key: 'ArrowRight',
    });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Open' }));
  });

  it('should request a fresh page on every tab switch', async () => {
    const facade = facadeDouble();
    const browse = vi.mocked(facade.TradeViewsAndReporting.browseTrades);
    browse.mockResolvedValue(readyPage([]));
    renderList(facade, '/');
    await screen.findByText(/no open trades/i);

    fireEvent.click(screen.getByRole('tab', { name: 'Planned' }));
    expect(screen.getByRole('tab', { name: 'Planned' }).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText(/no planned trades yet/i)).toBeTruthy();

    // Returning to Open asks again rather than showing the earlier page as current.
    browse.mockReturnValueOnce(new Promise(() => undefined));
    fireEvent.click(screen.getByRole('tab', { name: 'Open' }));
    expect(screen.getByRole('status').textContent).toMatch(/loading open trades/i);
    expect(browse.mock.calls.map(([request]) => request)).toEqual([{ lifecycle: 'Open' }, { lifecycle: 'Planned' }, { lifecycle: 'Open' }]);
  });
});

function renderOpen(facade: UiFacade, writable = true) {
  render(
    <RuntimeContext.Provider value={{ writable, report: () => undefined }}>
      <MemoryRouter initialEntries={['/']}>
        <TradeList facade={facade} timeZone="America/New_York" />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

const marks = (name: string) => performance.getEntriesByName(name, 'mark').length;

describe('Open list', () => {
  beforeEach(() => performance.clearMarks());

  it('should render distinct Loading, Ready, Empty explaining that recording an entry on a Planned Trade opens it, and Error with Retry states', async () => {
    const loading = facadeDouble();
    vi.mocked(loading.TradeViewsAndReporting.browseTrades).mockReturnValue(new Promise(() => undefined));
    renderOpen(loading);
    expect(screen.getByRole('status').textContent).toMatch(/loading open trades/i);
    expect(screen.queryByText(/no open trades/i)).toBeNull();
    expect(marks('tj:open-list-ready')).toBe(0);
    cleanup();

    const ready = facadeDouble();
    vi.mocked(ready.TradeViewsAndReporting.browseTrades).mockResolvedValue(readyPage([openItem]));
    renderOpen(ready);
    expect(await screen.findByRole('table', { name: 'Open Trades' })).toBeTruthy();
    // The benchmark's marks (T2.21): the Open list is complete, and the first one while Writable is interactive.
    expect(marks('tj:open-list-ready')).toBe(1);
    expect(marks('tj:interactive')).toBe(1);
    cleanup();

    const empty = facadeDouble();
    vi.mocked(empty.TradeViewsAndReporting.browseTrades).mockResolvedValue(readyPage([]));
    renderOpen(empty);
    expect(await screen.findByText(/no open trades/i)).toBeTruthy();
    expect(screen.getByText(/recording an entry on a planned trade opens it/i)).toBeTruthy();
    expect(marks('tj:open-list-ready')).toBe(2);
    expect(marks('tj:interactive')).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Show Planned Trades' }));
    expect(screen.getByRole('tab', { name: 'Planned' }).getAttribute('aria-selected')).toBe('true');
    cleanup();

    const failing = facadeDouble();
    vi.mocked(failing.TradeViewsAndReporting.browseTrades)
      .mockResolvedValueOnce({ kind: 'ChangedDuringAssembly' })
      .mockRejectedValueOnce(new Error('storage'))
      .mockResolvedValueOnce(readyPage([]));
    renderOpen(failing);
    expect(await screen.findByText(/couldn’t load your open trades/i)).toBeTruthy();
    expect(screen.queryByText(/no open trades/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/couldn’t load your open trades/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/no open trades/i)).toBeTruthy();
    expect(marks('tj:open-list-ready')).toBe(3);
  });

  it('should show quantity as 60 of 100, average cost, fees, entry status, Deviation count, an integrity badge with text, and Last Activity in the Workspace zone, with numbers right-aligned in tabular numerals', async () => {
    const disagreeing = {
      ...openItem,
      tradeId: 'trade-3',
      underlying: 'DEF',
      openQuantity: Rational.of(241n, 2n),
      averageOpenCost: { kind: 'NotApplicable', reason: 'NoOpenQuantity' },
      entryStatus: 'Resolved',
      deviationCount: 2,
      integrity: 'Disagrees',
    };
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.browseTrades).mockResolvedValue(readyPage([openItem, disagreeing]));
    renderOpen(facade);
    const table = await screen.findByRole('table', { name: 'Open Trades' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Underlying', 'Strategy', 'Account', 'Quantity', 'Average cost', 'Fees', 'Entry', 'Deviations', 'Integrity', 'Last activity']);
    const [, first, second] = within(table).getAllByRole('row');
    const cells = within(first!).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual([
      'ABC',
      'Long Stock',
      'Fidelity — Roth IRA',
      '60 of 100',
      '$50.10',
      '$1.00',
      'Entering',
      '0',
      'Records agree',
      '2026-10-13 10:00',
    ]);
    for (const numeric of [cells[3]!, cells[4]!, cells[5]!, cells[7]!]) expect(numeric.className).toBe('number');
    expect(within(first!).getByRole('link', { name: 'ABC' }).getAttribute('href')).toBe('/trades/trade-2');

    const other = within(second!)
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect([other[3], other[4], other[6], other[7], other[8]]).toEqual(['120.5 of 100', 'Not applicable', 'Resolved', '2', 'Records disagree']);
    expect(within(second!).getByText('Records disagree').className).toMatch(/badge/);
  });

  it('should show an Open Trade whose facts cannot be replayed with Records disagree and its Position and entry figures as Unavailable', async () => {
    const { tradeId, underlying, strategy, account, institution, plannedQuantity, deviationCount, lastActivity } = openItem;
    const incoherent = { tradeId, underlying, strategy, account, institution, plannedQuantity, deviationCount, integrity: 'Disagrees', lastActivity };
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.browseTrades).mockResolvedValue(readyPage([incoherent]));
    renderOpen(facade);
    const table = await screen.findByRole('table', { name: 'Open Trades' });
    const [, row] = within(table).getAllByRole('row');
    expect(
      within(row!)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual([
      'ABC',
      'Long Stock',
      'Fidelity — Roth IRA',
      'Unavailable',
      'Unavailable',
      'Unavailable',
      'Unavailable',
      '0',
      'Records disagree',
      '2026-10-13 10:00',
    ]);
  });
});

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

  it('should show the Records disagree badge in the Entry cell of a Planned item whose records disagree, with no added column', async () => {
    const disagreeing = { ...plannedItem, tradeId: 'trade-2', underlying: 'ABC', integrity: 'Disagrees' };
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.browseTrades).mockResolvedValue(readyPage([plannedItem, disagreeing]));
    renderList(facade);
    const table = await screen.findByRole('table', { name: 'Planned Trades' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(8);
    const [, agreeingRow, disagreeingRow] = within(table).getAllByRole('row');
    expect(within(agreeingRow!).getAllByRole('cell').at(-1)!.textContent).toBe('Awaiting entry');
    const entry = within(disagreeingRow!).getAllByRole('cell').at(-1)!;
    expect(within(entry).getByText('Records disagree').className).toBe('badge warning');
  });
});

describe('Planned list row for an incoherent Trade', () => {
  it('should show the row with Records disagree and Not available in each derived cell, linking to its Detail', async () => {
    const { tradeId, underlying, strategy, account, institution, planTime } = plannedItem;
    const incoherent = { tradeId: 'trade-2', underlying: 'ABC', strategy, account, institution, planTime, integrity: 'Disagrees' };
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.browseTrades).mockResolvedValue(readyPage([plannedItem, incoherent]));
    renderList(facade);
    const table = await screen.findByRole('table', { name: 'Planned Trades' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(8);
    const [, agreeingRow, row] = within(table).getAllByRole('row');
    expect(within(agreeingRow!).getByRole('link', { name: underlying }).getAttribute('href')).toBe(`/trades/${tradeId}`);
    const cells = within(row!).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual([
      'ABC',
      'Long Stock',
      'Fidelity — Roth IRA',
      '2026-10-12 09:30',
      'Not available',
      'Not available',
      'Not available',
      'Not available Records disagree',
    ]);
    expect(within(cells[7]!).getByText('Records disagree').className).toBe('badge warning');
    expect(within(row!).getByRole('link', { name: 'ABC' }).getAttribute('href')).toBe('/trades/trade-2');
  });
});
