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
      <TradeList facade={facade} />
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
        <TradeList facade={facade} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

const marks = (name: string) => performance.getEntriesByName(name, 'mark').length;

describe('Trades heading', () => {
  it('should show an h1 Trades above the tabs in the Loading, Ready, Empty, and Error states of both tabs', async () => {
    const states = {
      Loading: () => new Promise<never>(() => undefined),
      Ready: (lifecycle: string) => Promise.resolve(readyPage([lifecycle === 'Open' ? openItem : plannedItem])),
      Empty: () => Promise.resolve(readyPage([])),
      Error: () => Promise.reject(new Error('down')),
    };
    for (const lifecycle of ['Open', 'Planned']) {
      for (const [name, respond] of Object.entries(states)) {
        const facade = facadeDouble();
        vi.mocked(facade.TradeViewsAndReporting.browseTrades).mockImplementation(() => respond(lifecycle));
        renderList(facade, `/?lifecycle=${lifecycle}`);
        if (name === 'Ready') await screen.findByRole('table');
        if (name === 'Empty') await screen.findByText(/no (open|planned) trades/i);
        if (name === 'Error') await screen.findByText(/couldn.t load/i);
        const headings = screen.getAllByRole('heading', { level: 1 });
        expect(headings.map((h) => h.textContent), `${lifecycle} ${name}`).toEqual(['Trades']);
        const tablist = screen.getByRole('tablist', { name: 'Trades by lifecycle' });
        expect(headings[0]!.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING, `${lifecycle} ${name} order`).toBeTruthy();
        cleanup();
      }
    }
  });
});

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
});

describe('Trades table columns', () => {
  const disagreeing = { ...openItem, tradeId: 'trade-3', underlying: 'DEF', openQuantity: Rational.of(241n, 2n), entryStatus: 'Resolved', integrity: 'Disagrees' };

  async function openTable(items: readonly unknown[]) {
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.browseTrades).mockResolvedValue(readyPage(items));
    renderOpen(facade);
    return screen.findByRole('table', { name: 'Open Trades' });
  }

  async function plannedTable(items: readonly unknown[]) {
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.browseTrades).mockResolvedValue(readyPage(items));
    renderList(facade);
    return screen.findByRole('table', { name: 'Planned Trades' });
  }

  it('should show the Open columns in order Underlying, Trade, Net cost, P&L, Entry, Account, with Underlying a link named by the symbol, and no Fees, Integrity, Deviations or Last activity column', async () => {
    const table = await openTable([openItem]);
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Underlying', 'Trade', 'Net cost', 'P&L', 'Entry', 'Account']);
    const row = within(table).getAllByRole('row')[1]!;
    expect(within(row).getAllByRole('cell')).toHaveLength(6);
    expect(within(row).getAllByRole('cell')[0]!.textContent).toBe('ABC');
    expect(within(row).getByRole('link', { name: 'ABC' }).getAttribute('href')).toBe('/trades/trade-2');
  });

  it('should show the Planned columns in order Underlying, Trade, 1R, Reward : risk, Entry, Account, with no Planned reward or Plan time column', async () => {
    const table = await plannedTable([plannedItem]);
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Underlying', 'Trade', '1R', 'Reward : risk', 'Entry', 'Account']);
    const row = within(table).getAllByRole('row')[1]!;
    expect(within(row).getAllByRole('cell')).toHaveLength(6);
    expect(within(row).getByRole('link', { name: 'XYZ' }).getAttribute('href')).toBe('/trades/trade-1');
  });

  it('should show the Trade cell summary text and, on a second line, Net cost 3,007.00 for Open or 1R 250.00 and Reward : risk 2.4 for Planned', async () => {
    const open = await openTable([openItem]);
    const openCell = within(within(open).getAllByRole('row')[1]!).getAllByRole('cell')[1]!;
    expect(openCell.textContent).toBe('Long 60 shares @ $50.10 Net cost $3,007.00 · P&L Awaiting the next close');
    // T2.62: the "@" and its price sit in one no-wrap span, so the summary text has no break between them.
    expect(within(openCell).getByText('@ $50.10').className).toBe('nowrap');
    expect(within(openCell).getByText('Net cost $3,007.00 · P&L Awaiting the next close').className).toBe('trade-line');
    // The Net cost column carries the same figure for the wide layout.
    expect(within(within(open).getAllByRole('row')[1]!).getAllByRole('cell')[2]!.textContent).toBe('$3,007.00');
    cleanup();

    const planned = await plannedTable([plannedItem]);
    const plannedCell = within(within(planned).getAllByRole('row')[1]!).getAllByRole('cell')[1]!;
    expect(plannedCell.textContent).toBe('Long 100 shares @ $50.00 ' + '1R $250.00 · Reward : risk 2.4');
    expect(within(plannedCell).getByText('1R $250.00 · Reward : risk 2.4').className).toBe('trade-line');
  });

  it("should separate the Trade cell's summary, badge and second line with a space", async () => {
    const open = await openTable([openItem, disagreeing]);
    const [, agreeing, coherent] = within(open).getAllByRole('row');
    expect(within(agreeing!).getAllByRole('cell')[1]!.textContent).toBe('Long 60 shares @ $50.10 Net cost $3,007.00 · P&L Awaiting the next close');
    expect(within(coherent!).getAllByRole('cell')[1]!.textContent).toBe('Long 60 shares @ $50.10 Records disagree Net cost $3,007.00 · P&L Awaiting the next close');
  });

  it('should show Entering · 60 of 100 or Resolved · 120.5 of 100 in the Open Entry cell', async () => {
    const table = await openTable([openItem, disagreeing]);
    const [, entering, resolved] = within(table).getAllByRole('row');
    expect(within(entering!).getAllByRole('cell')[4]!.textContent).toBe('Entering · 60 of 100');
    expect(within(resolved!).getAllByRole('cell')[4]!.textContent).toBe('Resolved · 120.5 of 100');
  });

  describe('badge meanings', () => {
    it('should give a Records disagree badge the warning tone', async () => {
      const open = await openTable([openItem, disagreeing]);
      const [, , flagged] = within(open).getAllByRole('row');
      expect(within(flagged!).getByText('Records disagree').getAttribute('data-tone')).toBe('warning');
    });
  });

  it('should carry the Net cost of an incoherent Open row, Not available, in the second line of its Trade cell', async () => {
    const { strategy, account, institution, plannedQuantity, deviationCount, lastActivity } = openItem;
    const incoherent = { tradeId: 'trade-4', underlying: 'GHI', strategy, account, institution, plannedQuantity, deviationCount, integrity: 'Disagrees', lastActivity };
    const open = await openTable([incoherent]);
    const [, row] = within(open).getAllByRole('row');
    const cells = within(row!).getAllByRole('cell');
    expect(within(cells[1]!).getByText('Net cost Not available').className).toBe('trade-line');
    expect(cells[2]!.textContent).toBe('Not available');
  });

  it('should carry 1R and Reward : risk of an incoherent Planned row, Not available, in the second line of its Trade cell', async () => {
    const { strategy, account, institution, planTime } = plannedItem;
    const incoherent = { tradeId: 'trade-6', underlying: 'JKL', strategy, account, institution, planTime, integrity: 'Disagrees' };
    const planned = await plannedTable([incoherent]);
    const [, row] = within(planned).getAllByRole('row');
    const cells = within(row!).getAllByRole('cell');
    expect(within(cells[1]!).getByText('1R Not available · Reward : risk Not available').className).toBe('trade-line');
    expect(cells[2]!.textContent).toBe('Not available');
    expect(cells[3]!.textContent).toBe('Not available');
  });

  it('should show a Records disagree badge in the Trade cell of a disagreeing row, coherent or incoherent, and none on an agreeing row', async () => {
    const { tradeId, underlying, strategy, account, institution, plannedQuantity, deviationCount, lastActivity } = openItem;
    const incoherent = { tradeId: 'trade-4', underlying: 'GHI', strategy, account, institution, plannedQuantity, deviationCount, integrity: 'Disagrees', lastActivity };
    const open = await openTable([openItem, disagreeing, incoherent]);
    const [, agreeing, coherent, broken] = within(open).getAllByRole('row');
    expect(tradeId).toBe('trade-2');
    expect(underlying).toBe('ABC');
    expect(within(agreeing!).queryByText(/records (dis)?agree/i)).toBeNull();
    const coherentCell = within(coherent!).getAllByRole('cell')[1]!;
    expect(within(coherentCell).getByText('Records disagree').className).toBe('badge');
    expect(coherentCell.textContent).toBe('Long 60 shares @ $50.10 Records disagree Net cost $3,007.00 · P&L Awaiting the next close');
    const brokenCells = within(broken!).getAllByRole('cell');
    expect(brokenCells[1]!.textContent).toBe('Not available Records disagree Net cost Not available');
    expect(within(brokenCells[1]!).getByText('Records disagree').className).toBe('badge');
    expect(brokenCells.map((c) => c.textContent).slice(2)).toEqual(['Not available', 'Not available', 'Not available', 'Fidelity — Roth IRA']);
    expect(within(broken!).getByRole('link', { name: 'GHI' }).getAttribute('href')).toBe('/trades/trade-4');
    cleanup();

    const disagreeingPlanned = { ...plannedItem, tradeId: 'trade-5', underlying: 'DEF', integrity: 'Disagrees' };
    const { planTime } = plannedItem;
    const incoherentPlanned = { tradeId: 'trade-6', underlying: 'JKL', strategy, account, institution, planTime, integrity: 'Disagrees' };
    const planned = await plannedTable([plannedItem, disagreeingPlanned, incoherentPlanned]);
    const [, ok, flagged, lost] = within(planned).getAllByRole('row');
    expect(within(ok!).queryByText('Records disagree')).toBeNull();
    const flaggedCells = within(flagged!).getAllByRole('cell');
    expect(within(flaggedCells[1]!).getByText('Records disagree').className).toBe('badge');
    expect(flaggedCells[4]!.textContent).toBe('Awaiting entry');
    const lostCells = within(lost!).getAllByRole('cell');
    expect(lostCells.map((c) => c.textContent)).toEqual(['JKL', 'Not available Records disagree 1R Not available · Reward : risk Not available', 'Not available', 'Not available', 'Not available', 'Fidelity — Roth IRA']);
  });
});

// The Open item's current evaluation at the Expected Mark Date (T4.18), each figure its own result.
const value = (n: bigint, d = 1n) => ({ kind: 'Value' as const, value: Rational.of(n, d) });
const unavailableMark = { kind: 'Unavailable' as const, reason: 'MarkMissing', detail: { instrument: { kind: 'Stock', symbol: 'ABC' }, date: '2026-10-13' } };
const awaitingClose = { kind: 'Unavailable' as const, reason: 'AwaitingClose', detail: { after: '2026-10-13' } };
const condition = (role: 'Stop' | 'Target', status: 'Active' | 'Breached' | 'Reached') => ({
  id: `${role}-1`,
  role,
  kind: 'UnderlyingPrice',
  boundary: '47.5',
  result: { kind: 'Value', value: { status } },
});
const valued = (over: Record<string, unknown> = {}) => ({
  ...openItem,
  current: {
    expectedMarkDate: '2026-10-13',
    currentMarkedPnl: value(582n),
    currentMarkedPnlInPlanR: value(582n, 250n),
    ongoingRiskToStop: value(400n),
    incrementalRewardToTarget: value(1200n),
    conditions: [],
    atEntry: null,
    ...over,
  },
});

describe('Open list current evaluation', () => {
  async function openTable(items: readonly unknown[]) {
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.browseTrades).mockResolvedValue(readyPage(items));
    renderOpen(facade);
    return screen.findByRole('table', { name: 'Open Trades' });
  }

  it('should show per row the signed Current Marked Trade P&L in dollars and R right-aligned in tabular numerals and Stop breached or Target reached badges with text in the Trade cell, with no Risk to stop or Reward to target column', async () => {
    const stopped = { ...valued({ currentMarkedPnl: value(-320n), currentMarkedPnlInPlanR: value(-32n, 25n), conditions: [condition('Stop', 'Breached'), condition('Target', 'Active')] }), tradeId: 'trade-3', underlying: 'DEF' };
    const target = { ...valued({ conditions: [condition('Stop', 'Active'), condition('Target', 'Reached')] }), tradeId: 'trade-4', underlying: 'GHI' };
    const table = await openTable([valued(), stopped, target]);
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Underlying', 'Trade', 'Net cost', 'P&L', 'Entry', 'Account']);
    const [, gain, loss, reached] = within(table).getAllByRole('row');
    const pnl = (row: HTMLElement) => within(row).getAllByRole('cell')[3]!;
    expect(pnl(gain!).textContent).toBe('+$582.00 · +2.33R');
    expect(pnl(loss!).textContent).toBe('−$320.00 · −1.28R');
    expect(pnl(gain!).className).toContain('number');
    // The badges sit in the Trade cell, as text; an active condition shows none.
    const tradeCell = (row: HTMLElement) => within(row).getAllByRole('cell')[1]!;
    expect(within(tradeCell(loss!)).getByText('Stop breached').className).toBe('badge');
    expect(within(tradeCell(reached!)).getByText('Target reached').className).toBe('badge');
    expect(within(tradeCell(gain!)).queryByText(/breached|reached/i)).toBeNull();
    // Risk and reward stay on the Detail and the Review.
    expect(within(table).queryByText(/risk to stop|reward to target/i)).toBeNull();
  });

  it('should show Mark missing linking to the Review Marks family in place of the P&L, never a number, plus the dated line P&L labelled with its date when present', async () => {
    const dated = { tradingDate: '2026-10-12', evaluation: { currentMarkedPnl: value(120n), currentMarkedPnlInPlanR: value(120n, 250n) } };
    const missing = valued({ currentMarkedPnl: unavailableMark, currentMarkedPnlInPlanR: unavailableMark, datedLine: dated });
    const bare = { ...valued({ currentMarkedPnl: unavailableMark, currentMarkedPnlInPlanR: unavailableMark }), tradeId: 'trade-3', underlying: 'DEF' };
    const table = await openTable([missing, bare]);
    const [, withDated, without] = within(table).getAllByRole('row');
    const cell = (row: HTMLElement) => within(row).getAllByRole('cell')[3]!;
    const link = within(cell(withDated!)).getByRole('link', { name: 'Mark missing: ABC, Tue Oct 13' });
    expect(link.getAttribute('href')).toBe('/review?instrument=ABC');
    expect(cell(withDated!).textContent).toBe('Mark missing: ABC, Tue Oct 13 Mon Oct 12 close +$120.00 · +0.48R');
    // With no dated line the cell holds the words alone: no figure.
    expect(cell(without!).textContent).toBe('Mark missing: ABC, Tue Oct 13');
    // The status is also a text badge in the Trade cell.
    expect(within(within(withDated!).getAllByRole('cell')[1]!).getByText('Mark missing').className).toBe('badge');
  });

  it('should show Awaiting the next close in place of the P&L when the evaluation reports AwaitingClose, with no at-entry risk in the list, and the dated line when present', async () => {
    const atEntry = { label: 'AtEntry', quantity: Rational.of(40n), averageEntry: Rational.of(503n, 10n), riskFromEntry: Rational.of(130n), rewardFromEntry: Rational.of(230n) };
    const dated = { tradingDate: '2026-10-12', evaluation: { currentMarkedPnl: value(120n), currentMarkedPnlInPlanR: value(120n, 250n) } };
    const awaiting = valued({ currentMarkedPnl: awaitingClose, currentMarkedPnlInPlanR: awaitingClose, atEntry, datedLine: dated });
    const table = await openTable([awaiting]);
    const [, row] = within(table).getAllByRole('row');
    const cells = within(row!).getAllByRole('cell');
    expect(cells[3]!.textContent).toBe('Awaiting the next close Mon Oct 12 close +$120.00 · +0.48R');
    // Awaiting a close is not a missing Mark: no link, no Mark missing badge.
    expect(within(cells[3]!).queryByRole('link')).toBeNull();
    expect(within(cells[1]!).queryByText('Mark missing')).toBeNull();
    // Risk at entry is a risk figure, which stays on the Detail and the Review.
    expect(within(row!).queryByText(/at entry|\$130\.00/i)).toBeNull();
  });

  it('should give the compact P&L heading its canonical term Current Marked Trade P&L in its accessible name', async () => {
    const table = await openTable([valued()]);
    expect(within(table).getByRole('columnheader', { name: 'Current Marked Trade P&L' }).textContent).toBe('P&L');
  });

  it('should show Not available with no Review link and no Mark missing badge when the date lies outside session-policy coverage', async () => {
    const uncovered = { kind: 'Unavailable', reason: 'SessionPolicyNotCovered', detail: { instrument: { kind: 'Stock', symbol: 'ABC' }, date: '2030-01-02' } };
    const outside = { ...openItem, current: { currentMarkedPnl: uncovered, currentMarkedPnlInPlanR: uncovered, conditions: [], atEntry: null } };
    const table = await openTable([outside]);
    const [, row] = within(table).getAllByRole('row');
    const cells = within(row!).getAllByRole('cell');
    expect(cells[3]!.textContent).toBe('Not available');
    expect(within(row!).queryByRole('link', { name: /mark missing/i })).toBeNull();
    expect(within(cells[1]!).queryByText('Mark missing')).toBeNull();
  });

  it('should word an Acknowledged Unavailable P&L as the trader acknowledgment, linked to the Review, with no Mark missing badge', async () => {
    const acknowledged = { kind: 'Unavailable', reason: 'AcknowledgedUnavailable', detail: { instrument: { kind: 'Stock', symbol: 'ABC' }, date: '2026-10-13' } };
    const item = { ...openItem, current: { currentMarkedPnl: acknowledged, currentMarkedPnlInPlanR: acknowledged, conditions: [], atEntry: null } };
    const table = await openTable([item]);
    const [, row] = within(table).getAllByRole('row');
    const cells = within(row!).getAllByRole('cell');
    expect(cells[3]!.textContent).toBe('Acknowledged unavailable: ABC, Tue Oct 13');
    expect(within(cells[3]!).getByRole('link').getAttribute('href')).toBe('/review?instrument=ABC');
    expect(within(cells[1]!).queryByText('Mark missing')).toBeNull();
  });

  it('should word an unknown reason as Not available with no Review link and no Mark missing badge', async () => {
    const unknown = { kind: 'Unavailable', reason: 'SomeFutureReason', detail: { instrument: { kind: 'Stock', symbol: 'ABC' }, date: '2026-10-13' } };
    const item = { ...openItem, current: { currentMarkedPnl: unknown, currentMarkedPnlInPlanR: unknown, conditions: [], atEntry: null } };
    const table = await openTable([item]);
    const [, row] = within(table).getAllByRole('row');
    const cells = within(row!).getAllByRole('cell');
    expect(cells[3]!.textContent).toBe('Not available');
    expect(within(cells[3]!).queryByRole('link')).toBeNull();
    expect(within(cells[1]!).queryByText('Mark missing')).toBeNull();
  });

  it('should carry the P&L after Net cost in the second line of the Trade cell, with the Review link for a missing Mark, for the narrow layout', async () => {
    const missing = { ...valued({ currentMarkedPnl: unavailableMark, currentMarkedPnlInPlanR: unavailableMark }), tradeId: 'trade-3', underlying: 'DEF' };
    const table = await openTable([valued(), missing]);
    const [, gain, lost] = within(table).getAllByRole('row');
    const line = (row: HTMLElement) => row.querySelector('.trade-line') as HTMLElement;
    expect(line(gain!).textContent).toBe('Net cost $3,007.00 · P&L +$582.00 · +2.33R');
    expect(line(lost!).textContent).toBe('Net cost $3,007.00 · P&L Mark missing: ABC, Tue Oct 13');
    expect(within(line(lost!)).getByRole('link', { name: 'Mark missing: ABC, Tue Oct 13' }).getAttribute('href')).toBe('/review?instrument=ABC');
  });
});
