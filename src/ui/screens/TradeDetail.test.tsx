// @vitest-environment jsdom
// Trade Detail's replay read (P95, W20) and the rail following the Journal (revision 95), through `TradeDetail` against the facade double.
import { useEffect } from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UiFacade } from '../../app/compose.ts';
import { closedDetailOf } from '../../../tests/support/closed-detail-fixtures.ts';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { incoherentDetailOf, openDetailAt, PC1, PC2, PC3, pc1Reflection, pc3Excess, X1, X2 } from '../../../tests/support/open-detail-fixtures.ts';
import { optionOpenDetail, type OptionFrames } from '../../../tests/support/option-detail-fixtures.ts';
import { OS_S1 } from '../../../tests/support/option-trade-fixtures.ts';
import { reflectionDefinition } from '../../../tests/support/position-change-form-facade.ts';
import { plannedDetail } from '../../../tests/support/views-fixtures.ts';
import type { TradeDetailDebt, TradeDetailView, TradeReplayView } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { available, useFixedClock } from './trade-detail/test-support.ts';
import { TradeDetail } from './TradeDetail.tsx';

afterEach(cleanup);

const STOCK = { kind: 'Stock', symbol: 'XYZ' } as const;
const BINDING = { workspace: { databaseName: 'tj-ws-1', contentRevision: 7 }, catalogRevision: 1, journalRevision: 2 } as const;

const debt: TradeDetailDebt = {
  kind: 'Debt',
  id: 'debt-1',
  entryType: 'Position Change Reflection',
  entryTypeKey: 'entry-type.position-change-reflection',
  source: 'Position Change',
  anchor: { kind: 'Trade', tradeId: 'trade-1' },
  momentTime: '2026-10-12T14:00:00Z',
  positionChangeId: 'pc-1',
  definitionId: 'def-pcr-1',
  dueAnchor: '2026-10-13T20:00:00Z',
  revision: 'debt-1-rev-1',
  dueStatus: 'DueInNextReview',
};

// XYZ valued at Thursday's Mark of 53.00, with one reflection owed.
const thursday = (journal: readonly TradeDetailDebt[] = [debt]) => ({
  ...openDetailAt([PC1, PC2], { instrumentKey: 'XYZ', tradingDate: '2026-10-15', closeInstant: '2026-10-15T20:00:00Z', previousCloseInstant: '2026-10-14T20:00:00Z', resolution: available('53.00') }, { journal }),
  // A232: the Today table's column dates, which Trade Views names (T8R.21).
  marksColumns: { today: { date: '2026-10-15', next: false }, yesterday: '2026-10-14' },
});

const markOf = (price: string | undefined) => ({
  instrument: STOCK,
  resolution: price === undefined ? { kind: 'Missing' as const } : { kind: 'Available' as const, mark: { price, revisionNumber: 1, source: 'Manual' as const, savedAt: '2026-10-15T20:30:00Z' } },
  change: null,
});

// Monday and Thursday have Marks; Tuesday and Wednesday have none. Thursday is up $200.00 since Monday, and Monday holds the owed reflection.
// A replayed Debt carries no due status (T8P.10): the Detail's own Debt says how soon it is due.
const replayed = (item: TradeReplayView['sessions'][number]['journal'][number]) => {
  if (item.kind !== 'Debt') return item;
  const { dueStatus, ...bare } = item;
  void dueStatus;
  return bare;
};

// `marked`: every session has a Mark, so the Journal has four session cards (it shows three to a page).
const replay = (items: TradeReplayView['sessions'][number]['journal'] = [debt], marked = false): TradeReplayView => {
  const journal = items.map(replayed);
  const empty = { positions: [{ instrument: STOCK, quantity: Rational.of(100n) }], heldQuantity: Rational.of(100n), realizedPnl: Rational.of(0n), positionChangeIds: [], journal: [] };
  const noMarks = (date: string) =>
    marked
      ? { ...empty, date, tradePnl: { kind: 'Value' as const, value: Rational.of(100n) }, change: null, marks: [markOf('52.00')] }
      : { ...empty, date, tradePnl: { kind: 'Unavailable' as const, reason: 'MarkMissing' as const, instrument: STOCK, date }, change: null, marks: [markOf(undefined)] };
  return {
    tradeId: 'trade-1',
    instruments: [STOCK],
    sessions: [
      { ...empty, date: '2026-10-12', tradePnl: { kind: 'Value', value: Rational.of(50n) }, change: null, marks: [markOf('51.00')], journal },
      noMarks('2026-10-13'),
      noMarks('2026-10-14'),
      { ...empty, date: '2026-10-15', tradePnl: { kind: 'Value', value: Rational.of(250n) }, change: { since: '2026-10-12', dollars: Rational.of(200n) }, marks: [markOf('53.00')] },
    ],
    plan: [],
    pending: null,
  } as unknown as TradeReplayView;
};

// Where an element sits: its drawer panel, the rail, or neither.
const placeOf = (element: Element) => element.closest('[role="tabpanel"]')?.id ?? (element.closest('.cockpit-rail') ? 'rail' : 'elsewhere');
// A term of a definition list (or another selector) shown exactly once on the page, hidden drawers included; where it is.
function onePlace(term: string, selector = 'dt') {
  const found = screen.getAllByText(term, { selector });
  expect(found, `${term} is shown once`).toHaveLength(1);
  return placeOf(found[0]!);
}

interface Setup {
  readonly view?: TradeDetailView;
  readonly replayResult?: unknown;
}

function facadeOf({ view = thursday(), replayResult = { kind: 'Ready', view: replay(), binding: BINDING } }: Setup = {}) {
  const facade = facadeDouble();
  vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view, binding: BINDING } as never);
  vi.mocked(facade.TradeViewsAndReporting.replayTrade).mockResolvedValue(replayResult as never);
  return facade;
}

// The address the page is at now, and how the router got there (A274: opening pushes an entry; Close goes back one, or replaces the address).
const here = { address: '', how: 'POP' as string, go: undefined as ((delta: number) => void) | undefined };
function Where() {
  const location = useLocation();
  const how = useNavigationType();
  const navigate = useNavigate();
  useEffect(() => {
    Object.assign(here, { address: location.pathname + location.search, how, go: (delta: number) => void navigate(delta) });
  });
  return null;
}
const addressNow = () => here.address;
// The browser's Back button, and how the router last got to the address (A274).
const browserBack = () =>
  act(() => {
    here.go?.(-1);
    return Promise.resolve();
  });
const lastMove = () => here.how;

function renderWith(facade: UiFacade, address = '/trades/trade-1') {
  render(
    <RuntimeContext.Provider value={{ writable: true, report: () => undefined, timeZone: 'America/New_York' }}>
      <MemoryRouter initialEntries={[address]}>
        <Where />
        <Routes>
          <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
        </Routes>
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

function show(setup: Setup = {}) {
  const facade = facadeOf(setup);
  renderWith(facade);
  return facade;
}

describe('Trade Detail: the rail card order (T8P.23-B5)', () => {
  it('should show the rail cards in the order identity, P&L, Conditions and Needs you', async () => {
    show();
    const rail = await screen.findByRole('region', { name: 'State of play' });
    const needsYou = within(rail).getByRole('region', { name: 'Needs you' });
    const conditions = within(rail).getByRole('region', { name: 'Conditions' });
    const pnl = rail.querySelector('.pnl-card');
    const identity = rail.querySelector('.identity-card');
    // The owed Debt is in Needs you, and the four cards are the rail's only children, in the prototype's order.
    expect(within(needsYou).getByRole('button', { name: 'Reflect now' })).toBeTruthy();
    expect([...rail.children]).toEqual([identity, pnl, conditions, needsYou]);
  });
});

describe('Trade Detail: the replay read (P95)', () => {
  it('should read replayTrade with the Detail\'s binding and fill the change line, the Today comparison, Price History and the Journal cards from it', async () => {
    const user = userEvent.setup();
    const facade = show();
    // The change line, in the rail's P&L card.
    const rail = await screen.findByRole('region', { name: 'State of play' });
    expect(await within(rail).findByText('+$200.00 since Mon Oct 12')).toBeTruthy();
    expect(facade.TradeViewsAndReporting.replayTrade).toHaveBeenCalledTimes(1);
    expect(facade.TradeViewsAndReporting.replayTrade).toHaveBeenCalledWith({ tradeId: 'trade-1', binding: BINDING });
    // The Today table: Thursday's Mark from the replay, and Wednesday, which had none, a dash.
    const marksTable = within(screen.getByRole('tabpanel', { name: 'Today' })).getByRole('table', { name: 'Marks' });
    expect(within(marksTable).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Today, Thu Oct 15', 'Yesterday, Wed Oct 14', 'Change']);
    expect(within(within(marksTable).getAllByRole('row')[1]!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['$53.00', '—', '—']);
    // The tabs carry W1's counts: the sessions without Marks and the reflections owed.
    expect(within(screen.getByRole('tab', { name: 'Price History' })).getByText('2')).toBeTruthy();
    expect(within(screen.getByRole('tab', { name: 'Journal' })).getByText('1 owed')).toBeTruthy();
    // Price History.
    await user.click(screen.getByRole('tab', { name: 'Price History' }));
    const history = screen.getByRole('tabpanel', { name: 'Price History' });
    expect(within(history).getByRole('region', { name: 'Price History' })).toBeTruthy();
    expect(within(history).getByText(/2 sessions without Marks/)).toBeTruthy();
    // The Journal cards stand in for the old Journal list, which is gone from the page, hidden drawers included.
    await user.click(screen.getByRole('tab', { name: 'Journal' }));
    expect(within(screen.getByRole('tabpanel', { name: 'Journal' })).getByRole('heading', { name: 'Sessions, newest first' })).toBeTruthy();
    // An owed reflection on its card says how soon it is due, from the Detail's own Debt (a replayed Debt carries no due status).
    expect(within(screen.getByRole('tabpanel', { name: 'Journal' })).getByText('Due in the next Review')).toBeTruthy();
    expect(screen.queryAllByRole('heading', { name: /^Journal \(/, hidden: true })).toEqual([]);
  });

  it('should read both again when replayTrade answers ChangedDuringAssembly', async () => {
    const facade = facadeOf();
    const moved = { ...BINDING, workspace: { ...BINDING.workspace, contentRevision: 8 } };
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail)
      .mockResolvedValueOnce({ kind: 'Ready', view: thursday(), binding: BINDING } as never)
      .mockResolvedValue({ kind: 'Ready', view: thursday(), binding: moved } as never);
    vi.mocked(facade.TradeViewsAndReporting.replayTrade)
      .mockResolvedValueOnce({ kind: 'ChangedDuringAssembly' } as never)
      .mockResolvedValue({ kind: 'Ready', view: replay(), binding: moved } as never);
    renderWith(facade);
    const rail = await screen.findByRole('region', { name: 'State of play' });
    expect(await within(rail).findByText('+$200.00 since Mon Oct 12')).toBeTruthy();
    expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenCalledTimes(2);
    expect(facade.TradeViewsAndReporting.replayTrade).toHaveBeenCalledTimes(2);
    // The second replay is read with the second Detail's binding.
    expect(vi.mocked(facade.TradeViewsAndReporting.replayTrade).mock.calls.map(([request]) => request.binding)).toEqual([BINDING, moved]);
  });

  it('should show the rest of the cockpit while the replay is pending', async () => {
    let arrive: (result: unknown) => void = () => undefined;
    const facade = facadeOf();
    vi.mocked(facade.TradeViewsAndReporting.replayTrade).mockReturnValue(new Promise((resolve) => (arrive = resolve)) as never);
    renderWith(facade);
    // The rail and the drawers are there, with no change line yet.
    const rail = await screen.findByRole('region', { name: 'State of play' });
    expect(within(rail).getByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
    expect(within(rail).getByRole('region', { name: 'Needs you' })).toBeTruthy();
    expect(within(rail).queryByText(/since Mon Oct 12/)).toBeNull();
    expect(screen.getByRole('tabpanel', { name: 'Today' })).toBeTruthy();
    // Price History and Journal show the existing Loading words in their own panels, hidden or not, and the old Journal list is not shown instead.
    const panelOf = (id: string) => document.getElementById(`drawer-panel-${id}`)!;
    for (const id of ['price-history', 'journal']) expect(within(panelOf(id)).getByText('Loading the Trade…')).toBeTruthy();
    expect(screen.queryAllByRole('heading', { name: /^Journal \(/, hidden: true })).toEqual([]);
    expect(panelOf('price-history').hidden).toBe(true);

    arrive({ kind: 'Ready', view: replay(), binding: BINDING });
    expect(await within(rail).findByText('+$200.00 since Mon Oct 12')).toBeTruthy();
    expect(screen.queryAllByText('Loading the Trade…')).toEqual([]);
  });

  it('should show a saved reflection on its card without reading again', async () => {
    const user = userEvent.setup();
    const facade = facadeOf();
    vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition: reflectionDefinition } as never);
    vi.mocked(facade.Journal.save).mockResolvedValue({ kind: 'Saved', decline: { id: 'decl-1', authoredTime: '2026-10-15T21:00:00Z' }, debt: { debtId: 'debt-1' }, currentOutcome: { kind: 'Decline', id: 'decl-1' }, snapshot: { journalRevision: 5 } } as never);
    renderWith(facade);
    await user.click(await screen.findByRole('tab', { name: 'Journal' }));
    const journal = screen.getByRole('tabpanel', { name: 'Journal' });
    await user.click(within(journal).getByRole('button', { name: 'Reflect now' }));
    await user.click(await within(journal).findByRole('button', { name: 'Decline' }));
    // The card shows the saved reflection, and the Debt is no longer owed on it.
    expect(await within(journal).findByRole('region', { name: 'Saved reflection' })).toBeTruthy();
    expect(within(journal).queryByText('Reflection owed')).toBeNull();
    expect(within(journal).getByText('Declined later')).toBeTruthy();
    // Nothing was read again: one Detail and one replay, as at the start.
    expect(facade.Journal.save).toHaveBeenCalledTimes(1);
    expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenCalledTimes(1);
    expect(facade.TradeViewsAndReporting.replayTrade).toHaveBeenCalledTimes(1);
  });

  it('should show no Summary card, Valuation section or Risk and reward section, with each of their figures in its one place', async () => {
    show();
    await screen.findByRole('region', { name: 'State of play' });
    // The three blocks are gone from the page, hidden drawer panels included.
    for (const name of ['Summary', 'Valuation', 'Risk and reward']) expect(screen.queryAllByRole('region', { name, hidden: true }), name).toEqual([]);
    expect(document.querySelectorAll('.summary-card')).toHaveLength(0);
    expect(screen.queryAllByText('Current Marked Trade P&L')).toEqual([]);
    // Each figure they gave is on the page once, in the one place that owns it.
    expect(onePlace('Open P&L')).toBe('drawer-panel-position');
    expect(onePlace('Realized to date')).toBe('drawer-panel-position');
    expect(onePlace('Average entry')).toBe('drawer-panel-plan-and-risk');
    expect(onePlace('Actual initial risk')).toBe('drawer-panel-plan-and-risk');
    // The rail no longer gives the worst case or the maximum reward (T8R.14); Plan and Risk owns them (T8R.10).
    expect(document.querySelector('.cockpit-rail')!.textContent).not.toMatch(/Worst case|Max reward/);
    // The Trade Summary text is in the Position drawer, once.
    const summaries = [...document.querySelectorAll('.summary-text')];
    expect(summaries.map((element) => element.textContent)).toEqual(['Long 100 shares @ $50.18']);
    expect(placeOf(summaries[0]!)).toBe('drawer-panel-position');
    // T8P.31's places (revision 96): Net cost in the Position card, the Entry status in Entry Quality, each condition's Risk to stop and Reward
    // to target in Plan and Risk, and Today's comparison holding the Marks with their provenance, so the current-Marks card does not repeat them.
    expect(onePlace('Net cost')).toBe('drawer-panel-position');
    expect(onePlace('Entry')).toBe('drawer-panel-plan-and-risk');
    // T8R.10: each condition's Risk to stop and Reward to target is a cell of Plan and Risk's Conditions table.
    expect(onePlace('Risk or reward', 'th')).toBe('drawer-panel-plan-and-risk');
    // W29: Today's table shows the Marks, so the Expected Mark Date, Source and Saved are gone, hidden drawer panels included.
    for (const term of ['Expected Mark Date', 'Mark', 'Source', 'Saved']) expect(screen.queryAllByText(term, { selector: 'dt' }), term).toEqual([]);
    cleanup();

    // Without a replay (not applicable) there is no table, and still no current-Marks card.
    show({ replayResult: { kind: 'NotApplicable', reason: 'NeverExposed' } });
    await screen.findByRole('region', { name: 'State of play' });
    expect(document.querySelectorAll('.current-marks')).toHaveLength(0);
    for (const term of ['Expected Mark Date', 'Mark', 'Source', 'Saved']) expect(screen.queryAllByText(term, { selector: 'dt' }), term).toEqual([]);
    cleanup();

    // The "Deviation active" badge is gone from the identity card (W22, T8R.13); a Deviation shows in Plan and Risk (T8R.11).
    show({ view: openDetailAt([PC1, PC2, PC3], { instrumentKey: 'XYZ', tradingDate: '2026-10-15', closeInstant: '2026-10-15T20:00:00Z', previousCloseInstant: '2026-10-14T20:00:00Z', resolution: available('53.00') }, { recordedDeviations: [pc3Excess] }) });
    await screen.findByRole('region', { name: 'State of play' });
    expect(screen.queryAllByText('Deviation active')).toEqual([]);
  });

  it('should not read replayTrade for a Planned or incoherent Detail', async () => {
    const findings = [{ factId: 'pc-9', kind: 'PositionChange', economicTime: '2026-10-14T14:30:00Z', reason: 'DuplicateFactId' }] as const;
    const incoherent = incoherentDetailOf([PC1, PC2], findings, [pc1Reflection]);
    for (const view of [plannedDetail, incoherent]) {
      const facade = show({ view });
      await screen.findByRole('region', { name: 'State of play' });
      // The drawer panels are in place, so the Detail has settled; the replay was never asked for.
      expect(screen.getAllByRole('tabpanel', { hidden: true }).length).toBeGreaterThan(0);
      expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenCalledTimes(1);
      expect(facade.TradeViewsAndReporting.replayTrade).not.toHaveBeenCalled();
      cleanup();
    }
    // An incoherent Detail has no sessions, so its Journal drawer lists the entries as one card (W13), and the old Journal list is gone.
    show({ view: incoherent });
    await screen.findByRole('region', { name: 'State of play' });
    const journal = document.getElementById('drawer-panel-journal')!;
    expect(within(journal).getByText('Every entry, newest first')).toBeTruthy();
    expect(screen.queryAllByRole('heading', { name: /^Journal \(/, hidden: true })).toEqual([]);
  });
});

describe('Trade Detail: a stale read (T8P.22-B2)', () => {
  it('should keep the Detail of the Trade the route is on when an earlier Trade\'s read settles after the route moved', async () => {
    const user = userEvent.setup();
    const facade = facadeDouble();
    const trade = (symbol: string) => {
      const view = thursday();
      return { ...view, plan: { ...view.plan, underlying: symbol } };
    };
    let settleA: (result: unknown) => void = () => undefined;
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockImplementation((({ tradeId }: { tradeId: string }) =>
      tradeId === 'trade-a' ? new Promise((resolve) => (settleA = resolve)) : Promise.resolve({ kind: 'Ready', view: trade('BBB'), binding: BINDING })) as never);
    vi.mocked(facade.TradeViewsAndReporting.replayTrade).mockResolvedValue({ kind: 'Ready', view: replay([]), binding: BINDING } as never);
    render(
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined, timeZone: 'America/New_York' }}>
        <MemoryRouter initialEntries={['/trades/trade-a']}>
          <Link to="/trades/trade-b">Other</Link>
          <Routes>
            <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    // Trade A's read is pending; the route moves to Trade B, which reads at once.
    await user.click(screen.getByRole('link', { name: 'Other' }));
    expect(await screen.findByRole('heading', { name: 'BBB', level: 1 })).toBeTruthy();
    // A's read settles last: its Detail is not shown, and B's stays.
    settleA({ kind: 'Ready', view: trade('AAA'), binding: BINDING });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryAllByRole('heading', { name: 'AAA', level: 1, hidden: true })).toEqual([]);
    expect(screen.getByRole('heading', { name: 'BBB', level: 1 })).toBeTruthy();
  });
});

describe('Trade Detail: Reflect now finds the Debt (T8P.22-B1)', () => {
  it('should turn the Journal cards to the page holding the Debt when Reflect now is chosen for a Debt on an older session', async () => {
    const user = userEvent.setup();
    const facade = facadeOf({ replayResult: { kind: 'Ready', view: replay([debt], true), binding: BINDING } });
    vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition: reflectionDefinition } as never);
    renderWith(facade);
    const needsYou = await screen.findByRole('region', { name: 'Needs you' });
    // Four session cards, three to a page: the Monday card with the Debt is on the second page, hidden (present, not gone).
    const cardOf = () => document.querySelector('#drawer-panel-journal .journal-cards ol > li:last-child') as HTMLElement;
    expect(cardOf().hidden).toBe(true);
    expect(cardOf().textContent).toContain('Reflection owed');

    await user.click(within(needsYou).getByRole('button', { name: 'Reflect now' }));
    const form = await within(screen.getByRole('tabpanel', { name: 'Journal' })).findByRole('form', { name: 'Reflection' });
    // The form is open on the Debt's card, and that card is on the page that shows.
    expect(cardOf().hidden).toBe(false);
    expect(cardOf().contains(form)).toBe(true);
  });
});

describe('Trade Detail: Needs you follows the Journal (revision 95)', () => {
  it('should take a Debt off Needs you as soon as it is answered or declined on its card, without reading again', async () => {
    const user = userEvent.setup();
    // Two reflections owed, on two Position Changes; the first is declined on its card.
    const second: TradeDetailDebt = { ...debt, id: 'debt-2', revision: 'debt-2-rev-1', positionChangeId: 'pc-2', momentTime: '2026-10-12T15:00:00Z' };
    const facade = facadeOf({ view: thursday([debt, second]), replayResult: { kind: 'Ready', view: replay([debt, second]), binding: BINDING } });
    vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition: reflectionDefinition } as never);
    vi.mocked(facade.Journal.save).mockResolvedValue({ kind: 'Saved', decline: { id: 'decl-1', authoredTime: '2026-10-15T21:00:00Z' }, debt: { debtId: 'debt-1' }, currentOutcome: { kind: 'Decline', id: 'decl-1' }, snapshot: { journalRevision: 5 } } as never);
    renderWith(facade);
    const needsYou = await screen.findByRole('region', { name: 'Needs you' });
    expect(within(needsYou).getAllByText('Position Change Reflection Reflection owed')).toHaveLength(2);
    expect(within(screen.getByRole('tab', { name: 'Journal' })).getByText('2 owed')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Journal' }));
    const journal = screen.getByRole('tabpanel', { name: 'Journal' });
    await user.click(within(journal).getAllByRole('button', { name: 'Reflect now' })[0]!);
    await user.click(within(await within(journal).findByRole('form', { name: 'Reflection' })).getByRole('button', { name: 'Decline' }));
    await within(journal).findByRole('region', { name: 'Saved reflection' });

    // One Debt is left in Needs you, and the Journal tab counts the one still owed; the answered one is gone from the rail's DOM.
    expect(within(needsYou).getAllByText('Position Change Reflection Reflection owed')).toHaveLength(1);
    expect(within(needsYou).getAllByRole('button', { name: 'Reflect now' })).toHaveLength(1);
    expect(within(screen.getByRole('tab', { name: 'Journal' })).getByText('1 owed')).toBeTruthy();
    expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenCalledTimes(1);
    expect(facade.TradeViewsAndReporting.replayTrade).toHaveBeenCalledTimes(1);
  });
});

// W54, P143: Replay is a button beside the drawers, not a drawer; it opens the overlay (decision 3, A274).
const tabNames = () => within(screen.getByRole('tablist', { name: 'Detail' })).getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'));
// Friday 2026-11-20 after the close: the expiration date, whose contracts are due for settlement.
const FRIDAY: OptionFrames = { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', contractMark: '0.80', underlyingMark: '52.00' };

describe('Trade Detail: the Replay overlay (decision 3)', () => {
  useFixedClock();

  it('should show six drawers on an Open, a Settlement Due and a Closed Detail and a Replay button beside them', async () => {
    for (const view of [thursday(), optionOpenDetail('O-S', [OS_S1], FRIDAY), closedDetailOf([PC1, PC2, X1, X2])]) {
      show({ view });
      await screen.findByRole('region', { name: 'State of play' });
      expect(tabNames()).toEqual(['Today', 'Position', 'Plan and Risk', 'Price History', 'Journal', 'Payoff']);
      // The button ends the tab row and is not one of the tabs.
      const tablist = screen.getByRole('tablist', { name: 'Detail' });
      const button = screen.getByRole('button', { name: 'Replay' });
      expect(tablist.contains(button)).toBe(false);
      expect(button.parentElement).toBe(tablist.parentElement);
      expect(button.previousElementSibling).toBe(tablist);
      expect(document.getElementById('drawer-panel-replay')).toBeNull();
      cleanup();
    }
  });

  it('should show no Replay button on a Planned Detail or one whose records disagree', async () => {
    const findings = [{ factId: 'pc-9', kind: 'PositionChange', economicTime: '2026-10-14T14:30:00Z', reason: 'DuplicateFactId' }] as const;
    for (const view of [plannedDetail, incoherentDetailOf([PC1, PC2], findings, [pc1Reflection])]) {
      show({ view });
      await screen.findByRole('region', { name: 'State of play' });
      expect(screen.queryByRole('button', { name: 'Replay' })).toBeNull();
      expect(tabNames()).not.toContain('Replay');
      cleanup();
    }
  });

  it('should open the overlay from the button with the replay the Detail already read, with no second read, and put replay=open in the address', async () => {
    const user = userEvent.setup();
    const facade = show();
    await user.click(await screen.findByRole('button', { name: 'Replay' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    // The newest session is shown: Thursday's Trade P&L, the slider on it, and the Corridor's charts with their text equivalent.
    expect(within(dialog).getByRole('heading', { name: 'XYZ · Trade P&L +$250.00' })).toBeTruthy();
    expect(await within(dialog).findByTestId('headline')).toBeTruthy();
    expect(within(dialog).getByTestId('headline').textContent).toBe('+$250.00');
    expect(within(dialog).getByRole('slider', { name: 'Session' }).getAttribute('aria-valuetext')).toBe('Thu Oct 15 · 4 of 4. +$250.00');
    expect(within(dialog).getByRole('img', { name: 'XYZ Marks and Trade P&L by session' })).toBeTruthy();
    expect(within(dialog).getByRole('group', { name: 'Sessions' })).toBeTruthy();
    expect(facade.TradeViewsAndReporting.replayTrade).toHaveBeenCalledTimes(1);
    expect(addressNow()).toBe('/trades/trade-1?replay=open');
  });

  it('should close it on Close, on Escape and on the browser\'s Back, staying on the Trade, with focus back on the Replay button', async () => {
    const user = userEvent.setup();
    show();
    const button = await screen.findByRole('button', { name: 'Replay' });
    const closers = [
      () => user.click(screen.getByRole('button', { name: 'Close' })),
      () => user.keyboard('{Escape}'),
      () => browserBack(),
    ];
    for (const close of closers) {
      await user.click(button);
      await screen.findByRole('dialog', { name: 'Replay, XYZ' });
      await close();
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      // Still on the Trade, with the address as it was, and the opener holds focus. Close went back the entry that opening pushed.
      expect(addressNow()).toBe('/trades/trade-1');
      expect(lastMove()).toBe('POP');
      expect(screen.getByRole('region', { name: 'State of play' })).toBeTruthy();
      expect(document.activeElement).toBe(button);
    }
  });

  it('should open in the overlay on load when the address holds replay=open, on the session it names, and close by replacing the address', async () => {
    const user = userEvent.setup();
    const facade = facadeOf({ replayResult: { kind: 'Ready', view: replay([debt], true), binding: BINDING } });
    renderWith(facade, '/trades/trade-1?replay=open&session=2026-10-13');
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    expect((await within(dialog).findByRole('slider', { name: 'Session' })).getAttribute('aria-valuetext')).toBe('Tue Oct 13 · 2 of 4. +$100.00');
    // This visit pushed nothing, so Close replaces the address without `replay` and the Trade stays.
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(addressNow()).toBe('/trades/trade-1?session=2026-10-13');
    expect(lastMove()).toBe('REPLACE');
    expect(screen.getByRole('region', { name: 'State of play' })).toBeTruthy();
    // `drawer=replay` names no drawer any more: the default one is selected and no overlay opens. A drawer named by its address form
    // ("price-history") opens, and the overlay is not offered on a Detail that has none.
    cleanup();
    renderWith(facadeOf(), '/trades/trade-1?drawer=replay');
    await screen.findByRole('region', { name: 'State of play' });
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Today');
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();
    renderWith(facadeOf(), '/trades/trade-1?drawer=price-history');
    await screen.findByRole('region', { name: 'State of play' });
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Price History');
    cleanup();
    renderWith(facadeOf({ view: plannedDetail }), '/trades/trade-1?replay=open');
    await screen.findByRole('region', { name: 'State of play' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should show Loading the Trade… in the overlay while the replay is pending, and No replay. when it could not be read', async () => {
    let arrive: (result: unknown) => void = () => undefined;
    const facade = facadeOf();
    vi.mocked(facade.TradeViewsAndReporting.replayTrade).mockReturnValue(new Promise((resolve) => (arrive = resolve)) as never);
    renderWith(facade, '/trades/trade-1?replay=open');
    // The dialog is there at once, headed by the symbol alone until the latest session's figure is read.
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    expect(within(dialog).getByText('Loading the Trade…')).toBeTruthy();
    expect(within(dialog).getByRole('heading').textContent).toBe('XYZ');
    expect(within(dialog).queryByTestId('headline')).toBeNull();
    await act(() => {
      arrive({ kind: 'Ready', view: replay(), binding: BINDING });
      return Promise.resolve();
    });
    expect(await within(dialog).findByTestId('headline')).toBeTruthy();
    expect(within(dialog).queryByText('Loading the Trade…')).toBeNull();
    expect(within(dialog).getByRole('heading', { level: 2, name: 'XYZ · Trade P&L +$250.00' })).toBeTruthy();
    cleanup();
    renderWith(facadeOf({ replayResult: { kind: 'Unavailable' } }), '/trades/trade-1?replay=open');
    expect(within(await screen.findByRole('dialog', { name: 'Replay, XYZ' })).getByText('No replay.')).toBeTruthy();
  });

  it('should close the overlay and select the drawer when Price History, Position or Journal is pressed, with focus on that session place in it', async () => {
    const user = userEvent.setup();
    // Monday holds the Position Change pc-1 and the owed reflection, so all three links are offered on it.
    const links: readonly (readonly [string, string, () => boolean])[] = [
      ['Price History', 'Price History', () => document.activeElement?.textContent === 'MonOct 12'],
      ['Position', 'Position', () => document.activeElement?.closest('li')?.textContent?.includes('Buy 60 XYZ') === true && document.activeElement.tagName === 'BUTTON'],
      ['Journal', 'Journal', () => document.activeElement?.id === 'journal-card-2026-10-12'],
    ];
    renderWith(facadeOf({ replayResult: { kind: 'Ready', view: withMonday(), binding: BINDING } }), '/trades/trade-1?replay=open&session=2026-10-12');
    for (const [index, [link, drawer, focused]] of links.entries()) {
      // The first pass finds the overlay open from the address; the others open it again from the button.
      if (index > 0) await user.click(await screen.findByRole('button', { name: 'Replay' }));
      const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
      await user.click(await within(dialog).findByRole('button', { name: link }));
      await waitFor(() => expect(screen.queryByRole('dialog'), `${link} closes it`).toBeNull());
      expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe(drawer);
      await waitFor(() => expect(focused(), `${link} holds focus`).toBe(true));
    }
  });

  it('should read the drawer and session again when the address names another Trade', async () => {
    const user = userEvent.setup();
    const facade = facadeOf({ replayResult: { kind: 'Ready', view: replay([debt], true), binding: BINDING } });
    render(
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined, timeZone: 'America/New_York' }}>
        <MemoryRouter initialEntries={['/trades/trade-1?drawer=price-history']}>
          <Link to="/trades/trade-2?replay=open&session=2026-10-13">Other</Link>
          <Routes>
            <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    await screen.findByRole('region', { name: 'State of play' });
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Price History');
    await user.click(screen.getByRole('link', { name: 'Other' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    expect(screen.getByRole('tab', { selected: true, hidden: true }).getAttribute('aria-label')).toBe('Today');
    expect((await within(dialog).findByRole('slider', { name: 'Session' })).getAttribute('aria-valuetext')).toBe('Tue Oct 13 · 2 of 4. +$100.00');
  });

  it('should reopen the overlay on the session the slider was on when it closed', async () => {
    const user = userEvent.setup();
    show({ replayResult: { kind: 'Ready', view: replay([debt], true), binding: BINDING } });
    await user.click(await screen.findByRole('button', { name: 'Replay' }));
    let dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    await user.click(within(dialog).getByRole('button', { name: 'Previous session' }));
    const moved = within(dialog).getByRole('slider', { name: 'Session' }).getAttribute('aria-valuetext');
    expect(moved).toBe('Wed Oct 14 · 3 of 4. +$100.00');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Replay' }));
    dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    expect(within(dialog).getByRole('slider', { name: 'Session' }).getAttribute('aria-valuetext')).toBe(moved);
  });

  it('should go back one entry on Close after Back then Forward brought the overlay back', async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: 'Replay' }));
    await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    await browserBack();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(() => {
      here.go?.(1);
      return Promise.resolve();
    });
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    expect(addressNow()).toBe('/trades/trade-1?replay=open');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(addressNow()).toBe('/trades/trade-1');
    expect(lastMove()).toBe('POP');
    // No second closed Detail entry is left: one more Back leaves the Trade's history (the router stays on the first entry).
    await browserBack();
    expect(addressNow()).toBe('/trades/trade-1');
  });

  it('should go back one entry on the second Close after Replay, Close, Forward', async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: 'Replay' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Replay, XYZ' })).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(() => {
      here.go?.(1);
      return Promise.resolve();
    });
    await user.click(within(await screen.findByRole('dialog', { name: 'Replay, XYZ' })).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(addressNow()).toBe('/trades/trade-1');
    expect(lastMove()).toBe('POP');
    // No extra closed Detail entry is left: one more Back stays where it was.
    await browserBack();
    expect(addressNow()).toBe('/trades/trade-1');
  });

  it('should put focus on the Replay button when an overlay opened from the address closes', async () => {
    const user = userEvent.setup();
    renderWith(facadeOf(), '/trades/trade-1?replay=open');
    const dialog = await screen.findByRole('dialog', { name: 'Replay, XYZ' });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Replay' }));
  });
});

// Four sessions with Marks: Monday holds the Position Change pc-1 (a purchase of 60) and the owed reflection, Tuesday has neither.
const withMonday = (): TradeReplayView => {
  const base = replay([debt], true);
  const [monday, ...rest] = base.sessions;
  const marker = { id: 'pc-1', kind: 'Execution', effect: 'Opened', fills: [{ instrument: STOCK, action: 'Buy', quantity: Rational.of(60n), price: Rational.of(5010n, 100n) }] };
  return { ...base, sessions: [{ ...monday!, markers: [marker] }, ...rest] } as unknown as TradeReplayView;
};

describe('Replay: the round trip from the Review (P129)', () => {
  useFixedClock();

  it('should show Back to the Review on a Detail opened that way, and not otherwise', async () => {
    renderWith(facadeOf(), '/trades/trade-1?drawer=price-history&session=2026-10-13&from=review');
    await screen.findByRole('region', { name: 'State of play' });
    expect(screen.getByRole('link', { name: 'Back to the Review' })).toBeTruthy();
    cleanup();
    for (const address of ['/trades/trade-1', '/trades/trade-1?drawer=price-history&session=2026-10-13', '/trades/trade-1?from=trades']) {
      renderWith(facadeOf(), address);
      await screen.findByRole('region', { name: 'State of play' });
      expect(screen.queryByRole('link', { name: 'Back to the Review' })).toBeNull();
      cleanup();
    }
  });

  it('should send Back to the Review to the card with replay=open and the slider session', async () => {
    const user = userEvent.setup();
    renderWith(facadeOf({ replayResult: { kind: 'Ready', view: replay([debt], true), binding: BINDING } }), '/trades/trade-1?replay=open&session=2026-10-13&from=review');
    const dialog = within(await screen.findByRole('dialog', { name: 'Replay, XYZ' }));
    expect(screen.getByRole('link', { name: 'Back to the Review' }).getAttribute('href')).toBe('/review?trade=trade-1&panel=Action&replay=open&session=2026-10-13');
    // The session is the slider's now: moved on the Detail, it is the one the Review is told.
    await user.click(await dialog.findByRole('button', { name: 'Next session' }));
    expect(screen.getByRole('link', { name: 'Back to the Review' }).getAttribute('href')).toBe('/review?trade=trade-1&panel=Action&replay=open&session=2026-10-14');
  });
});

describe('Replay: audit navigation (W46)', () => {
  useFixedClock();
  const open = async (session: string) => {
    renderWith(facadeOf({ replayResult: { kind: 'Ready', view: withMonday(), binding: BINDING } }), `/trades/trade-1?replay=open&session=${session}`);
    return within(await screen.findByRole('dialog', { name: 'Replay, XYZ' }));
  };

  it('should offer Price History for the slider session, selecting that drawer with the session column in focus', async () => {
    const user = userEvent.setup();
    const panel = await open('2026-10-13');
    await user.click(await panel.findByRole('button', { name: 'Price History' }));
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Price History');
    expect(document.activeElement?.textContent).toBe('TueOct 13');
    // The link follows the slider.
    await user.click(screen.getByRole('button', { name: 'Replay' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Replay, XYZ' })).getByRole('button', { name: 'Previous session' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Replay, XYZ' })).getByRole('button', { name: 'Price History' }));
    expect(document.activeElement?.textContent).toBe('MonOct 12');
  });

  it('should arrive from an address naming Price History and a session with that session column in focus', async () => {
    renderWith(facadeOf({ replayResult: { kind: 'Ready', view: withMonday(), binding: BINDING } }), '/trades/trade-1?drawer=price-history&session=2026-10-12&from=review');
    await screen.findByRole('region', { name: 'State of play' });
    await waitFor(() => expect(document.activeElement?.textContent).toBe('MonOct 12'));
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Price History');
  });

  it('should leave focus on the Replay button when the overlay opened from an address naming Price History and a session is closed', async () => {
    const user = userEvent.setup();
    renderWith(facadeOf({ replayResult: { kind: 'Ready', view: withMonday(), binding: BINDING } }), '/trades/trade-1?drawer=price-history&session=2026-10-12&replay=open');
    const dialog = within(await screen.findByRole('dialog', { name: 'Replay, XYZ' }));
    await user.click(await dialog.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Replay' }));
  });

  it('should answer a Position link from an overlay opened from an address naming Price History and a session, not the Price History arrival', async () => {
    const user = userEvent.setup();
    renderWith(facadeOf({ replayResult: { kind: 'Ready', view: withMonday(), binding: BINDING } }), '/trades/trade-1?drawer=price-history&session=2026-10-12&replay=open');
    const dialog = within(await screen.findByRole('dialog', { name: 'Replay, XYZ' }));
    await user.click(await dialog.findByRole('button', { name: 'Position' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Position');
    expect(document.activeElement?.closest('li')?.textContent).toContain('Buy 60 XYZ');
  });

  // The address names Price History and a session, and the replay read is held until `arrive` is called.
  const arrivalHeld = async () => {
    let arrive: (result: unknown) => void = () => undefined;
    const facade = facadeOf();
    vi.mocked(facade.TradeViewsAndReporting.replayTrade).mockReturnValue(new Promise((resolve) => (arrive = resolve)) as never);
    renderWith(facade, '/trades/trade-1?drawer=price-history&session=2026-10-12');
    await screen.findByRole('region', { name: 'State of play' });
    const load = () =>
      act(() => {
        arrive({ kind: 'Ready', view: withMonday(), binding: BINDING });
        return Promise.resolve();
      });
    return load;
  };

  it('should leave focus on the Replay button when the overlay was opened while the replay was loading and is closed after it loaded', async () => {
    const user = userEvent.setup();
    const load = await arrivalHeld();
    await user.click(screen.getByRole('button', { name: 'Replay' }));
    await load();
    const dialog = within(await screen.findByRole('dialog', { name: 'Replay, XYZ' }));
    await user.click(await dialog.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Replay' }));
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Price History');
  });

  it('should keep the tab chosen while the replay was loading, with focus where it was, when the replay arrives', async () => {
    const user = userEvent.setup();
    const load = await arrivalHeld();
    await user.click(screen.getByRole('tab', { name: 'Position' }));
    await load();
    await screen.findAllByText('+$200.00 since Mon Oct 12');
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Position');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Position' }));
  });

  it('should not override a drawer request made from the overlay when the replay arrives while the overlay is open from the button', async () => {
    const user = userEvent.setup();
    const load = await arrivalHeld();
    await user.click(screen.getByRole('button', { name: 'Replay' }));
    await load();
    const dialog = within(await screen.findByRole('dialog', { name: 'Replay, XYZ' }));
    await user.click(await dialog.findByRole('button', { name: 'Position' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Position');
    expect(document.activeElement?.closest('li')?.textContent).toContain('Buy 60 XYZ');
  });

  it('should render the Detail and throw nothing when the address names a session with a quote or a backslash', async () => {
    for (const session of ['a"b', 'x\\']) {
      renderWith(facadeOf({ replayResult: { kind: 'Ready', view: withMonday(), binding: BINDING } }), `/trades/trade-1?drawer=price-history&session=${encodeURIComponent(session)}`);
      await screen.findByRole('region', { name: 'State of play' });
      await waitFor(() => expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Price History'));
      cleanup();
    }
  });

  it('should select Price History and throw nothing when the session is well formed but has no column', async () => {
    renderWith(facadeOf({ replayResult: { kind: 'Ready', view: withMonday(), binding: BINDING } }), '/trades/trade-1?drawer=price-history&session=2020-01-01');
    await screen.findByRole('region', { name: 'State of play' });
    await waitFor(() => expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Price History'));
  });

  it('should offer Position on a session with a marker, with the Execution row in focus', async () => {
    const user = userEvent.setup();
    // Tuesday has no marker, so no link.
    const tuesday = await open('2026-10-13');
    await tuesday.findByRole('button', { name: 'Price History' });
    expect(tuesday.queryByRole('button', { name: 'Position' })).toBeNull();
    cleanup();
    const panel = await open('2026-10-12');
    await user.click(await panel.findByRole('button', { name: 'Position' }));
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Position');
    // The Execution's own toggle holds focus, inside its row.
    expect(document.activeElement?.closest('li')?.textContent).toContain('Buy 60 XYZ');
    expect(document.activeElement?.tagName).toBe('BUTTON');
  });

  it('should focus the Expiration row when Position is chosen on a session whose marker is an Expiration', async () => {
    const user = userEvent.setup();
    const settlement = { factId: 'exp-1', economicTime: '2026-10-12T20:00:00Z', recordedSequence: 3, instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '1' };
    const detail = thursday();
    const view = { ...detail, positionChanges: [...detail.positionChanges, { ...detail.positionChanges[0]!, factId: 'pc-exp', executions: [], settlements: [settlement] }] } as unknown as TradeDetailView;
    const base = withMonday();
    const marker = { id: 'pc-exp', kind: 'Expiration', effect: 'Closed', fills: [{ instrument: STOCK, action: 'Expire', quantity: Rational.of(1n) }] };
    const replayView = { ...base, sessions: [{ ...base.sessions[0]!, markers: [marker] }, ...base.sessions.slice(1)] } as unknown as TradeReplayView;
    renderWith(facadeOf({ view, replayResult: { kind: 'Ready', view: replayView, binding: BINDING } }), '/trades/trade-1?replay=open&session=2026-10-12');
    const panel = within(await screen.findByRole('dialog', { name: 'Replay, XYZ' }));
    await user.click(await panel.findByRole('button', { name: 'Position' }));
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Position');
    // The Expiration's own toggle holds focus, inside its row.
    expect(document.activeElement?.closest('li')?.textContent).toContain('Expiration of');
    expect(document.activeElement?.tagName).toBe('BUTTON');
  });

  it('should offer Journal on a session with Journal items, with that session card in focus', async () => {
    const user = userEvent.setup();
    // Tuesday has no Journal items, so no link.
    const tuesday = await open('2026-10-13');
    await tuesday.findByRole('button', { name: 'Price History' });
    expect(tuesday.queryByRole('button', { name: 'Journal' })).toBeNull();
    cleanup();
    const panel = await open('2026-10-12');
    await user.click(await panel.findByRole('button', { name: 'Journal' }));
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Journal');
    // Monday is the oldest of four cards, so it is on the second page of three: the cards turn to it first.
    expect(document.activeElement?.id).toBe('journal-card-2026-10-12');
  });

  it('should focus the merged card that holds the session when Journal is chosen on a later session of a Mark-less run', async () => {
    const user = userEvent.setup();
    // Tuesday and Wednesday have no Marks, so they are one card (Tuesday's); the owed reflection is on Wednesday.
    const base = replay([debt]);
    const [monday, tuesday, wednesday, ...rest] = base.sessions;
    const view = { ...base, sessions: [{ ...monday!, journal: [] }, tuesday!, { ...wednesday!, journal: monday!.journal }, ...rest] } as unknown as TradeReplayView;
    renderWith(facadeOf({ replayResult: { kind: 'Ready', view, binding: BINDING } }), '/trades/trade-1?replay=open&session=2026-10-14');
    const panel = within(await screen.findByRole('dialog', { name: 'Replay, XYZ' }));
    await user.click(await panel.findByRole('button', { name: 'Journal' }));
    expect(screen.getByRole('tab', { selected: true }).getAttribute('aria-label')).toBe('Journal');
    expect(document.activeElement?.id).toBe('journal-card-2026-10-13');
  });
});
