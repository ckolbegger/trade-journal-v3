// @vitest-environment jsdom
// Trade Detail's replay read (P95, W20) and the rail following the Journal (revision 95), through `TradeDetail` against the facade double.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UiFacade } from '../../app/compose.ts';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { incoherentDetailOf, openDetailAt, PC1, PC2, PC3, pc1Reflection, pc3Excess } from '../../../tests/support/open-detail-fixtures.ts';
import { reflectionDefinition } from '../../../tests/support/position-change-form-facade.ts';
import { plannedDetail } from '../../../tests/support/views-fixtures.ts';
import type { TradeDetailDebt, TradeDetailView, TradeReplayView } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { available } from './trade-detail/test-support.ts';
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
const thursday = (journal: readonly TradeDetailDebt[] = [debt]) =>
  openDetailAt([PC1, PC2], { instrumentKey: 'XYZ', tradingDate: '2026-10-15', closeInstant: '2026-10-15T20:00:00Z', previousCloseInstant: '2026-10-14T20:00:00Z', resolution: available('53.00') }, { journal });

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
  const empty = { positions: [], heldQuantity: Rational.of(100n), realizedPnl: Rational.of(0n), positionChangeIds: [], journal: [] };
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

function renderWith(facade: UiFacade) {
  render(
    <RuntimeContext.Provider value={{ writable: true, report: () => undefined, timeZone: 'America/New_York' }}>
      <MemoryRouter initialEntries={['/trades/trade-1']}>
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

describe('Trade Detail: the replay read (P95)', () => {
  it('should read replayTrade with the Detail\'s binding and fill the change line, the Today comparison, Price History and the Journal cards from it', async () => {
    const user = userEvent.setup();
    const facade = show();
    // The change line, in the rail's P&L card.
    const rail = await screen.findByRole('region', { name: 'State of play' });
    expect(await within(rail).findByText('+$200.00 since Mon Oct 12')).toBeTruthy();
    expect(facade.TradeViewsAndReporting.replayTrade).toHaveBeenCalledTimes(1);
    expect(facade.TradeViewsAndReporting.replayTrade).toHaveBeenCalledWith({ tradeId: 'trade-1', binding: BINDING });
    // The Today comparison.
    expect(within(screen.getByRole('tabpanel', { name: 'Today' })).getByRole('heading', { name: 'Marks: Thu Oct 15 against Mon Oct 12' })).toBeTruthy();
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
    expect(onePlace('Worst case:', '.summary-label')).toBe('rail');
    // The Trade Summary text is in the Position drawer, once.
    const summaries = [...document.querySelectorAll('.summary-text')];
    expect(summaries.map((element) => element.textContent)).toEqual(['Long 100 shares @ $50.18']);
    expect(placeOf(summaries[0]!)).toBe('drawer-panel-position');
    // T8P.31's places (revision 96): Net cost in the Position card, the Entry status in Entry Quality, each condition's Risk to stop and Reward
    // to target in Plan and Risk, and Today's comparison holding the Marks with their provenance, so the current-Marks card does not repeat them.
    expect(onePlace('Net cost')).toBe('drawer-panel-position');
    expect(onePlace('Entry')).toBe('drawer-panel-plan-and-risk');
    expect(onePlace('Risk to stop')).toBe('drawer-panel-plan-and-risk');
    expect(onePlace('Reward to target')).toBe('drawer-panel-plan-and-risk');
    expect(onePlace('Expected Mark Date')).toBe('drawer-panel-today');
    for (const term of ['Mark', 'Source', 'Saved']) expect(screen.queryAllByText(term, { selector: 'dt' }), term).toEqual([]);
    cleanup();

    // Without a comparison (the replay is not applicable) the current Marks stand in Today, once.
    show({ replayResult: { kind: 'NotApplicable', reason: 'NeverExposed' } });
    await screen.findByRole('region', { name: 'State of play' });
    expect(document.querySelectorAll('.current-marks')).toHaveLength(1);
    for (const term of ['Expected Mark Date', 'Mark', 'Source', 'Saved']) expect(onePlace(term), term).toBe('drawer-panel-today');
    cleanup();

    // "Deviation active" is beside the lifecycle badge in the identity card, once.
    show({ view: openDetailAt([PC1, PC2, PC3], { instrumentKey: 'XYZ', tradingDate: '2026-10-15', closeInstant: '2026-10-15T20:00:00Z', previousCloseInstant: '2026-10-14T20:00:00Z', resolution: available('53.00') }, { recordedDeviations: [pc3Excess] }) });
    await screen.findByRole('region', { name: 'State of play' });
    const active = screen.getAllByText('Deviation active');
    expect(active).toHaveLength(1);
    expect(placeOf(active[0]!)).toBe('rail');
    expect(active[0]!.closest('header')).toBeTruthy();
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
