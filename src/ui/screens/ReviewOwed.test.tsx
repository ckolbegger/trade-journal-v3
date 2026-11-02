// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardProgress, reflectionsOwedProgress } from '../../../tests/support/card-progress.ts';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { closedExitResult, partialExitResult } from '../../../tests/support/exit-result-fixtures.ts';
import { reflectionDefinition, withExitForm } from '../../../tests/support/position-change-form-facade.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, OpenDailyReviewResult, OwedReflection, OwedReflectionsCard, OwedReflectionsTrade, ReviewBinding, WalkedTrade } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';

afterEach(cleanup);

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;
type Empty = Extract<OpenDailyReviewResult, { kind: 'Empty' }>;

// The Tuesday Review of the closed-Trade fixture (D6 breakdown, section 4): T-X closed on Monday with its Close Review owed,
// T-N opened after the close with a reflection due in the next Review.
const CUTOFF = '2026-10-13T20:00:00Z';
const DATE = '2026-10-13';
const binding: ReviewBinding = {
  workspace: { databaseName: 'tj-ws-1', contentRevision: 3 },
  catalogRevision: 1,
  journalRevision: 1,
  marketDataSnapshotId: 'mds1:1:abc',
  factRevisions: {},
  outstandingDebts: {},
};
const rational = (n: bigint, d = 1n) => Rational.of(n, d);
const symbol = { kind: 'Stock' as const, symbol: 'XYZ' };

const walkedTrade = (tradeId: string, underlying: string): WalkedTrade => ({
  tradeId,
  underlying,
  lastActivity: '2026-10-13T14:00:00Z',
  band: 'Routine',
  reasons: [{ code: 'NoPressure' }],
  basis: { kind: 'Comparable', side: 'None', share: rational(0n) },
  rangePosition: { kind: 'Placed', now: rational(1n, 2n), atEntry: rational(1n, 2n) },
  progress: cardProgress(0, 0, { owed: false }),
});

// An Outstanding reflection of an owed Trade on the snapshot definition.
function reflection(debtId: string, classification: OwedReflection['classification'], economicTime: string): OwedReflection {
  return {
    debtId,
    definition: reflectionDefinition,
    economicTime,
    executions: [{ factId: `${debtId}-x`, economicTime, recordedSequence: 1, action: 'Sell', instrument: symbol, quantity: '100', price: '52.48', fee: '1.00' }] as unknown as OwedReflection['executions'],
    classification,
    saveBinding: { debtId, debtRevision: `${debtId}-rev-1`, definitionRevision: 'def-pcr-1' },
  };
}

const CLOSED_CARD: OwedReflectionsCard = {
  tradeId: 't-x',
  underlying: 'ABC',
  lifecycle: 'Closed',
  labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' },
  summary: {
    kind: 'Closed',
    realizedPnl: rational(248n),
    realizedR: { kind: 'Value', value: rational(3n, 2n) },
    terminalDisposition: { kind: 'Value', value: [{ mechanism: 'Executions', quantity: rational(100n) }] },
    closeReason: { id: 'cr-1', label: 'Target Reached' },
    terminalTime: '2026-10-12T18:00:00Z',
  },
  reflections: [reflection('d-close', 'Due', '2026-10-12T18:00:00Z')],
  progress: reflectionsOwedProgress(1, 0),
};
const OPEN_CARD: OwedReflectionsCard = {
  tradeId: 't-n',
  underlying: 'DEF',
  lifecycle: 'Open',
  labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' },
  summary: { kind: 'Open', position: { kind: 'Stock', direction: 'Long', quantity: rational(40n), price: rational(2105n, 100n) }, entryResolution: { kind: 'Unresolved' } },
  reflections: [reflection('d-entry', 'DueInNextReview', '2026-10-13T21:30:00Z')],
  progress: reflectionsOwedProgress(0, 1),
};
const owedTrade = (card: OwedReflectionsCard): OwedReflectionsTrade => ({
  tradeId: card.tradeId,
  underlying: card.underlying,
  lifecycle: card.lifecycle,
  owed: card.reflections.map((r) => ({ debtId: r.debtId, entryTypeKey: 'entry-type.position-change-reflection', dueAnchor: r.economicTime, classification: r.classification })),
  progress: card.progress,
});
const CARDS = [CLOSED_CARD, OPEN_CARD];
const OWED = CARDS.map(owedTrade);

function ready(over: Partial<Ready> = {}): Ready {
  return {
    kind: 'Ready',
    reviewDate: DATE,
    cutoff: CUTOFF,
    families: [
      { family: 'Marks', today: [], earlier: [] },
      { family: 'Trades', trades: [walkedTrade('t-w', 'XYZ')] },
    ],
    owed: OWED,
    completion: { kind: 'Incomplete', reasons: [{ code: 'ReflectionDue', tradeId: 't-x', debtIds: ['d-close'] }] },
    binding,
    ...over,
  };
}
const empty = (): Empty => ({ kind: 'Empty', reviewDate: DATE, cutoff: CUTOFF, owed: OWED, binding });

// A walked Trade as getTrade returns it, with an Action still to take.
function walkedReview(walked: WalkedTrade, over: Partial<DailyTradeReview> = {}): DailyTradeReview {
  return {
    tradeId: walked.tradeId,
    underlying: walked.underlying,
    lifecycle: 'Open',
    attention: walked,
    labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' },
    reflections: [],
    progress: walked.progress,
    form: { kind: 'New', viewState: { selectedAction: 'Hold' } },
    definitionRevision: 'def1',
    saveBinding: {
      reviewDate: DATE,
      tradeId: walked.tradeId,
      factRevision: 2,
      marketDataSnapshotId: 'mds1:1:abc',
      obligationKey: { entryType: 'DailyTradeReview', trade: walked.tradeId, reviewDate: DATE },
      definitionRevision: 'def1',
      databaseName: 'tj-ws-1',
    },
    ...over,
  };
}

// A facade whose getTrade answers an owed Trade with its card and a walked one with its form.
function reviewFacade(overview: OpenDailyReviewResult): UiFacade {
  const facade = facadeDouble();
  vi.mocked(facade.DailyReview.open).mockResolvedValue(overview);
  const walked = overview.kind === 'Ready' ? overview.families.flatMap((f) => (f.family === 'Trades' ? f.trades : [])) : [];
  vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ reviewDate, tradeId }) => {
    const card = CARDS.find((c) => c.tradeId === tradeId);
    if (card) return Promise.resolve({ kind: 'ReflectionsOwed', reviewDate, cutoff: CUTOFF, card });
    const trade = walked.find((t) => t.tradeId === tradeId);
    if (!trade) throw new Error(`no Trade ${tradeId}`);
    return Promise.resolve({ kind: 'Ready', reviewDate, cutoff: CUTOFF, trade: walkedReview(trade) });
  });
  return facade;
}

function renderReview(facade: UiFacade, at = '/review') {
  render(
    <RuntimeContext.Provider value={{ writable: true, timeZone: 'America/New_York', report: () => undefined }}>
      <MemoryRouter initialEntries={[at]}>
        <ReviewView facade={facade} now={() => '2026-10-13T21:00:00Z'} onDirtyChange={() => undefined} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

const GROUP = 'Trades with owed reflections';

describe('owed-reflection group (P19, P20)', () => {
  it('should show Trades with owed reflections after the walk, each card with its lifecycle summary and its Reflections section and no Action form', async () => {
    const user = userEvent.setup();
    const facade = reviewFacade(ready());
    renderReview(facade);

    // The group follows the walk, under its own heading.
    const heading = await screen.findByRole('heading', { name: GROUP });
    const walk = screen.getByRole('list', { name: 'Positions' });
    expect(walk.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const group = screen.getByRole('list', { name: GROUP });
    const headers = within(group).getAllByRole('button', { name: /^Review / });
    expect(headers.map((h) => h.textContent)).toEqual([expect.stringContaining('ABC'), expect.stringContaining('DEF')]);

    // The first card with a reflection due opens on load, as a walked card does.
    const closed = await screen.findByRole('region', { name: 'ABC review' });
    expect(facade.DailyReview.getTrade).toHaveBeenCalledWith({ reviewDate: DATE, tradeId: 't-x', binding });
    const result = within(closed).getByRole('region', { name: 'Result' });
    expect(within(result).getByText('Closed')).toBeTruthy();
    expect(within(result).getByText('Closed via sale of 100 shares')).toBeTruthy();
    expect(within(result).getByText('Target Reached')).toBeTruthy();
    expect(within(result).getByText('+$248.00')).toBeTruthy();
    expect(within(result).getByText('+1.50R')).toBeTruthy();
    expect(within(closed).getByRole('region', { name: 'Reflections' })).toBeTruthy();
    expect(within(closed).getByRole('button', { name: /^Reflect on/ })).toBeTruthy();
    // No Action panel or form, and no Marks panel.
    expect(within(closed).queryByRole('form', { name: 'Action' })).toBeNull();
    expect(within(closed).queryByRole('button', { name: /^Action\b/ })).toBeNull();
    expect(within(closed).queryByRole('button', { name: /^Marks\b/ })).toBeNull();

    // The other card: an Open Trade's summary is its Position and entry status.
    await user.click(headers[1]!);
    const open = await screen.findByRole('region', { name: 'DEF review' });
    expect(screen.queryByRole('region', { name: 'ABC review' })).toBeNull();
    const position = within(open).getByRole('region', { name: 'Result' });
    expect(within(position).getByText('Open')).toBeTruthy();
    expect(within(position).getByText('Long 40 shares @ $21.05')).toBeTruthy();
    expect(within(open).getByText(/Due in the next Review/)).toBeTruthy();
    expect(within(open).queryByRole('form', { name: 'Action' })).toBeNull();
  });

  it('should open DebtForm for a not-yet-due reflection and, after Save, render it resolved from the result, leaving completion unchanged', async () => {
    const user = userEvent.setup();
    const incomplete = ready().completion;
    const facade = reviewFacade(ready());
    const post = { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 1 }, completion: incomplete, nextStep: { kind: 'Done' }, binding } as const;
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'DebtResolved', decline: { id: 'decl-1', reason: 'Not now.', authoredTime: '2026-10-13T21:05:00Z' } as never, debt: { debtId: 'd-entry', status: 'Settled', revision: 'd-entry-rev-2' } as never, review: post });
    renderReview(facade);
    const status = await screen.findByRole('region', { name: 'Review status' });
    expect(within(status).getByText('Incomplete')).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: /^Review DEF/ }));
    const card = await screen.findByRole('region', { name: 'DEF review' });

    // The reflection is not due yet, and can still be answered now.
    await user.click(within(card).getByRole('button', { name: /^Reflect on/ }));
    expect(within(card).getByRole('form', { name: 'Reflection' })).toBeTruthy();
    await user.type(within(card).getByLabelText('Reason for declining (optional)'), 'Not now.');
    await user.click(within(card).getByRole('button', { name: 'Decline' }));

    expect(facade.DailyReview.save).toHaveBeenCalledWith({ kind: 'ResolveReviewDebt', reviewDate: DATE, binding: OPEN_CARD.reflections[0]!.saveBinding, resolution: { kind: 'Decline', reason: 'Not now.' } });
    expect(await within(card).findByText('Declined to reflect. Reason: Not now.')).toBeTruthy();
    // Completion is the Review's, and the result left it as it was: still Incomplete, with the same blocker.
    expect(within(status).getByText('Incomplete')).toBeTruthy();
    expect(within(within(status).getByRole('list', { name: 'Blockers' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('should open the owed card, from the save result, when an Action save names an owed Trade as the next step', async () => {
    const user = userEvent.setup();
    // The walked Trade still owes its Action; the saved Action leaves the owed group next (T6.13).
    const overview = ready({ families: [{ family: 'Marks', today: [], earlier: [] }, { family: 'Trades', trades: [{ ...walkedTrade('t-w', 'XYZ'), progress: cardProgress() }] }] });
    const facade = reviewFacade(overview);
    const incomplete = ready().completion;
    vi.mocked(facade.DailyReview.save).mockResolvedValue({
      kind: 'Saved',
      action: {} as never,
      review: { kind: 'Ready', cards: [{ tradeId: 't-w', progress: cardProgress(0, 0, { owed: false }) }], progress: { tradesWithAction: 1, tradesEligible: 1 }, completion: incomplete, nextStep: { kind: 'OwedTrade', card: CLOSED_CARD }, binding },
    });
    renderReview(facade);
    const walked = await screen.findByRole('region', { name: 'XYZ review' });
    vi.mocked(facade.DailyReview.getTrade).mockClear();

    await user.click(within(walked).getByRole('button', { name: 'Save' }));

    // The owed card opens from the step's card, with no further read, and takes focus; the saved card closes.
    const closed = await screen.findByRole('region', { name: 'ABC review' });
    expect(within(closed).getByRole('region', { name: 'Reflections' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
    expect(facade.DailyReview.getTrade).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Review ABC/ })));
  });

  it('should name an owed Trade by its Underlying in its Reflection due blocker, and open its card from the link, and on load for its trade address', async () => {
    const user = userEvent.setup();
    renderReview(reviewFacade(ready()), '/review?trade=t-n');

    // The address names the other owed Trade, so it opens in place of the first one due.
    expect(await screen.findByRole('region', { name: 'DEF review' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'ABC review' })).toBeNull();
    const blockers = within(screen.getByRole('region', { name: 'Review status' })).getByRole('list', { name: 'Blockers' });
    expect(blockers.textContent).toBe('Reflection due for ABC');
    const link = within(blockers).getByRole('link', { name: 'ABC' });
    expect(link.getAttribute('href')).toBe('/review?trade=t-x&panel=Reflections');

    await user.click(link);

    expect(await screen.findByRole('region', { name: 'ABC review' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'DEF review' })).toBeNull();
  });

  it('should show the same Trades with owed reflections group inside the Empty view', async () => {
    const user = userEvent.setup();
    const facade = reviewFacade(empty());
    renderReview(facade);

    // The Empty message stays, and the group follows it; there is no walk and no status.
    expect(await screen.findByText("No Trades were open at this session's close")).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Positions' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Review status' })).toBeNull();
    const group = screen.getByRole('list', { name: GROUP });
    const headers = within(group).getAllByRole('button', { name: /^Review / });
    expect(headers.map((h) => h.textContent)).toEqual([expect.stringContaining('ABC'), expect.stringContaining('DEF')]);

    // The card with a reflection due opens on load, and the other one is one press away.
    const closed = await screen.findByRole('region', { name: 'ABC review' });
    expect(within(closed).getByRole('region', { name: 'Reflections' })).toBeTruthy();
    expect(facade.DailyReview.getTrade).toHaveBeenCalledWith({ reviewDate: DATE, tradeId: 't-x', binding });
    await user.click(headers[1]!);
    const open = await screen.findByRole('region', { name: 'DEF review' });
    expect(within(open).getByRole('region', { name: 'Reflections' })).toBeTruthy();
    expect(within(open).queryByRole('form', { name: 'Action' })).toBeNull();
  });
});

describe('Exit link (A94)', () => {
  const savedAction = (action: string) =>
    ({
      id: 'e1',
      entryType: 'Daily Trade Review',
      entryTypeKey: 'entry-type.daily-trade-review',
      source: 'Daily Review',
      anchor: { kind: 'Trade', tradeId: 't-w' },
      momentTime: CUTOFF,
      authoredTime: '2026-10-13T21:00:00Z',
      responses: [{ prompt: 'Action', answer: { kind: 'Option', label: action } }],
      entryRevision: 1,
      action,
      definitionId: 'def1',
    }) as never;
  // A Review of one walked Trade whose Action is saved, and no owed group; the Trade's card is the Review's only card.
  const walked = { ...walkedTrade('t-w', 'XYZ') };
  const overview = (): Ready => ready({ owed: [], completion: { kind: 'Complete' }, families: [{ family: 'Marks', today: [], earlier: [] }, { family: 'Trades', trades: [walked] }] });
  // The facade reads the Trade with the Action saved, and with the quantity that is still open (none once it is closed).
  function exitFacade(action: string, remaining: () => bigint) {
    const facade = withExitForm(reviewFacade(overview()));
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ reviewDate }) =>
      Promise.resolve({ kind: 'Ready', reviewDate, cutoff: CUTOFF, trade: walkedReview(walked, { form: { kind: 'Saved', action: savedAction(action) }, ...(remaining() > 0n && { exitRoute: { remainingQuantity: rational(remaining()) } }) }) }),
    );
    return facade;
  }
  const openAction = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: /^Review XYZ/ }));
    const card = await screen.findByRole('region', { name: 'XYZ review' });
    const header = within(card).getByRole('button', { name: /^Action\b/ });
    if (header.getAttribute('aria-expanded') !== 'true') await user.click(header);
    return card;
  };

  it('should offer Record the exit once an Exit Action is saved for a Trade that is still Open, open the exit form in context, and after its Save show the recorded exit from the result with Refresh Review', async () => {
    const user = userEvent.setup();
    let remaining = 100n;
    const facade = exitFacade('Exit', () => remaining);
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockImplementation(() => {
      remaining = 70n;
      return Promise.resolve(partialExitResult() as never);
    });
    const replaceState = vi.spyOn(window.history, 'replaceState');
    renderReview(facade);
    const card = await openAction(user);

    // The Exit is saved and the Trade holds shares: the card offers the exit, and nothing opens by itself.
    expect(within(card).getByText('Saved Action: Exit')).toBeTruthy();
    expect(facade.TradeViewsAndReporting.getTradeDetail).not.toHaveBeenCalled();
    await user.click(within(card).getByRole('button', { name: 'Record the exit' }));

    // The exit form opens over the Review, in the card, with nothing prefilled but the Trade.
    expect(await within(card).findByRole('heading', { name: 'Record exit' })).toBeTruthy();
    expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenCalledWith({ tradeId: 't-w' });
    const row = within(card).getByRole('group', { name: 'Execution 1' });
    for (const label of ['Quantity', 'Price', 'Fee']) expect(within(row).getByLabelText<HTMLInputElement>(label).value).toBe('');
    expect(screen.getByRole('region', { name: 'Review status' })).toBeTruthy();
    for (const [label, value] of [['Quantity', '30'], ['Price', '52.00'], ['Fee', '0.60']] as const) await user.type(within(row).getByLabelText(label), value);
    await user.click(within(card).getByRole('button', { name: 'Save exit' }));

    // The recorded exit shows from the result, beside Refresh Review. The Review has not been read again.
    expect(facade.TradeWorkflows.recordPositionChange).toHaveBeenCalledWith(expect.objectContaining({ originTradeId: 't-w', trades: [expect.objectContaining({ tradeId: 't-w' })] }));
    expect(await within(card).findByRole('heading', { name: 'Exit recorded' })).toBeTruthy();
    const result = within(card).getByRole('region', { name: 'Result' });
    expect(within(result).getByText('+$55.90')).toBeTruthy();
    expect(facade.DailyReview.open).toHaveBeenCalledTimes(1);
    // The Review stays on its own address.
    expect(replaceState).not.toHaveBeenCalled();

    // Refresh Review calls open (D4 A48) and reads the card again: the Trade still holds shares, so the exit is offered again.
    await user.click(within(card).getByRole('button', { name: 'Refresh Review' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    expect(await within(card).findByRole('button', { name: 'Record the exit' })).toBeTruthy();
    expect(within(card).queryByRole('heading', { name: 'Exit recorded' })).toBeNull();
    replaceState.mockRestore();
    cleanup();

    // A Hold offers no exit, and neither does an Exit on a Trade with no open quantity.
    for (const [action, shares] of [['Hold', 100n], ['Exit', 0n]] as const) {
      renderReview(exitFacade(action, () => shares));
      const other = await openAction(user);
      expect(within(other).getByText(`Saved Action: ${action}`)).toBeTruthy();
      expect(within(other).queryByRole('button', { name: 'Record the exit' })).toBeNull();
      cleanup();
    }
  });

  // Records a partial exit of 30 shares from the open card and waits for the receipt.
  // With `onLoad`, the card is the one that opens by itself on load (its Action is still owed), so no press has asked for it.
  const refreshCase = async (onLoad = false) => {
    const user = userEvent.setup();
    let remaining = 100n;
    const facade = exitFacade('Exit', () => remaining);
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockImplementation(() => {
      remaining = 70n;
      return Promise.resolve(partialExitResult() as never);
    });
    if (onLoad) vi.mocked(facade.DailyReview.open).mockResolvedValue(ready({ owed: [], completion: { kind: 'Complete' }, families: [{ family: 'Marks', today: [], earlier: [] }, { family: 'Trades', trades: [{ ...walked, progress: cardProgress() }] }] }));
    renderReview(facade);
    const card = onLoad ? await screen.findByRole('region', { name: 'XYZ review' }) : await openAction(user);
    if (onLoad) await user.click(within(card).getByRole('button', { name: /^Action\b/ }));
    await user.click(within(card).getByRole('button', { name: 'Record the exit' }));
    const row = await within(card).findByRole('group', { name: 'Execution 1' });
    for (const [label, value] of [['Quantity', '30'], ['Price', '52.00'], ['Fee', '0.60']] as const) await user.type(within(row).getByLabelText(label), value);
    await user.click(within(card).getByRole('button', { name: 'Save exit' }));
    await within(card).findByRole('heading', { name: 'Exit recorded' });
    return { user, facade, card };
  };

  // T6.20-B1, item 2: Refresh Review follows every valid result of the Review, as its first opening does.
  it('should replace the held Review with the Empty one that Refresh Review reads, with no refresh error', async () => {
    const { user, facade } = await refreshCase();
    vi.mocked(facade.DailyReview.open).mockResolvedValue(empty());

    await user.click(screen.getByRole('button', { name: 'Refresh Review' }));

    // The new session has nothing to walk: the Empty message and the owed group stand in place of the card and the status.
    expect(await screen.findByText("No Trades were open at this session's close")).toBeTruthy();
    expect(screen.queryByText(/We couldn’t refresh the Review/)).toBeNull();
    expect(screen.queryByRole('list', { name: 'Positions' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Review status' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
    expect(within(screen.getByRole('list', { name: GROUP })).getAllByRole('button', { name: /^Review / })).toHaveLength(2);
  });

  it('should show the owed card when the Trade Refresh Review reads is now one of the owed group', async () => {
    const { user, facade } = await refreshCase();
    const owedCard: OwedReflectionsCard = { ...CLOSED_CARD, tradeId: 't-w', underlying: 'XYZ', reflections: [reflection('d-exit', 'Due', '2026-10-13T14:05:00Z')] };
    vi.mocked(facade.DailyReview.open).mockResolvedValue(ready({ families: [{ family: 'Marks', today: [], earlier: [] }, { family: 'Trades', trades: [] }], owed: [owedTrade(owedCard)] }));
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ reviewDate }) => Promise.resolve({ kind: 'ReflectionsOwed', reviewDate, cutoff: CUTOFF, card: owedCard }));

    await user.click(screen.getByRole('button', { name: 'Refresh Review' }));

    const card = await screen.findByRole('region', { name: 'XYZ review' });
    expect(within(card).getByRole('region', { name: 'Reflections' })).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Record the exit' })).toBeNull();
    expect(screen.queryByText(/We couldn’t refresh the Review/)).toBeNull();
  });

  it('should still say the Review could not be refreshed when the Review cannot be read, and keep the receipt', async () => {
    const { user, facade } = await refreshCase();
    for (const failure of [() => Promise.reject(new Error('down')), () => Promise.resolve({ kind: 'ChangedDuringAssembly' } as const)]) {
      vi.mocked(facade.DailyReview.open).mockImplementation(failure);
      await user.click(screen.getByRole('button', { name: 'Refresh Review' }));
      expect(await screen.findByText('We couldn’t refresh the Review. Nothing was changed.')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Exit recorded' })).toBeTruthy();
    }
  });

  // T6.20-B1, item 4: the receipt goes when the Review is read again, so focus must not fall to the page.
  it('should move focus to the Action panel header when Refresh Review succeeds, and keep it on Refresh Review when it fails', async () => {
    const { user, facade, card } = await refreshCase();
    const refresh = screen.getByRole('button', { name: 'Refresh Review' });
    vi.mocked(facade.DailyReview.open).mockRejectedValueOnce(new Error('down'));
    await user.click(refresh);
    expect(await within(card).findByText('We couldn’t refresh the Review. Nothing was changed.')).toBeTruthy();
    expect(document.activeElement).toBe(refresh);

    await user.click(refresh);
    // The Trade still holds shares, so the exit is offered again, and focus is still on the panel's header.
    expect(await within(card).findByRole('button', { name: 'Record the exit' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(within(card).getByRole('button', { name: /^Action\b/ })));
  });

  it('should move focus to the Action panel header after a closing exit leaves no Record the exit button', async () => {
    const user = userEvent.setup();
    let remaining = 100n;
    const facade = exitFacade('Exit', () => remaining);
    renderReview(facade);
    const card = await openAction(user);
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockImplementation(() => {
      remaining = 0n;
      return Promise.resolve(closedExitResult() as never);
    });
    await user.click(within(card).getByRole('button', { name: 'Record the exit' }));
    const row = await within(card).findByRole('group', { name: 'Execution 1' });
    for (const [label, value] of [['Quantity', '100'], ['Price', '53.00'], ['Fee', '1.00']] as const) await user.type(within(row).getByLabelText(label), value);
    await user.click(within(card).getByRole('radio', { name: 'Target Reached' }));
    await user.click(within(card).getByRole('button', { name: 'Save exit' }));
    await user.click(await within(card).findByRole('button', { name: 'Refresh Review' }));

    await waitFor(() => expect(within(card).queryByRole('heading', { name: 'Exit recorded' })).toBeNull());
    expect(within(card).queryByRole('button', { name: 'Record the exit' })).toBeNull();
    expect(document.activeElement).toBe(within(card).getByRole('button', { name: /^Action\b/ }));
  });

  // T6.20-B2, item 1: the card that took the focus is gone when the refreshed Trade leaves the walk.
  it('should move focus to the owed card header when Refresh Review moves the Trade to the owed group, to the Empty message when the Review is Empty, and to the Review status when the Trade has left the Review', async () => {
    const owedCard: OwedReflectionsCard = { ...CLOSED_CARD, tradeId: 't-w', underlying: 'XYZ', reflections: [reflection('d-exit', 'Due', '2026-10-13T14:05:00Z')] };
    const noWalk = [{ family: 'Marks' as const, today: [], earlier: [] }, { family: 'Trades' as const, trades: [] }];

    // The Trade is now owed: its owed card opens and takes the focus at its header, though no press had asked for the card.
    const closing = await refreshCase(true);
    vi.mocked(closing.facade.DailyReview.open).mockResolvedValue(ready({ families: noWalk, owed: [owedTrade(owedCard)] }));
    vi.mocked(closing.facade.DailyReview.getTrade).mockImplementation(({ reviewDate }) => Promise.resolve({ kind: 'ReflectionsOwed', reviewDate, cutoff: CUTOFF, card: owedCard }));
    await closing.user.click(screen.getByRole('button', { name: 'Refresh Review' }));
    await screen.findByRole('region', { name: 'XYZ review' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Review XYZ/ })));
    cleanup();

    // The Review is Empty: the Empty message takes the focus.
    const emptied = await refreshCase();
    vi.mocked(emptied.facade.DailyReview.open).mockResolvedValue(empty());
    await emptied.user.click(screen.getByRole('button', { name: 'Refresh Review' }));
    const message = await screen.findByText("No Trades were open at this session's close");
    await waitFor(() => expect(document.activeElement).toBe(message));
    cleanup();

    // The Review still has Trades but not this one, and it is not owed: the Review status takes the focus.
    const gone = await refreshCase();
    vi.mocked(gone.facade.DailyReview.open).mockResolvedValue(ready({ families: noWalk, owed: [], completion: { kind: 'Complete' } }));
    await gone.user.click(screen.getByRole('button', { name: 'Refresh Review' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Review status' })));
    // Nothing was held on the card, so no notice is made.
    expect(screen.queryByText(/is no longer in this Review/)).toBeNull();
  });

  // T6.20-B2, item 2: the Trade moved to the owed group, but reading it failed.
  it('should show the owed card load failure with Retry when the Trade moved to the owed group but cannot be read', async () => {
    const { user, facade } = await refreshCase(true);
    const owedCard: OwedReflectionsCard = { ...CLOSED_CARD, tradeId: 't-w', underlying: 'XYZ', reflections: [reflection('d-exit', 'Due', '2026-10-13T14:05:00Z')] };
    vi.mocked(facade.DailyReview.open).mockResolvedValue(ready({ families: [{ family: 'Marks', today: [], earlier: [] }, { family: 'Trades', trades: [] }], owed: [owedTrade(owedCard)] }));
    vi.mocked(facade.DailyReview.getTrade).mockRejectedValueOnce(new Error('down'));

    await user.click(screen.getByRole('button', { name: 'Refresh Review' }));

    const header = await screen.findByRole('button', { name: /^Review XYZ/ });
    expect(header.getAttribute('aria-expanded')).toBe('true');
    const item = header.closest('li')!;
    expect(await within(item).findByText('We couldn’t load this Trade. Nothing was changed.')).toBeTruthy();
    // The button that was pressed is gone with the card: the focus is on the owed card, not the page.
    await waitFor(() => expect(document.activeElement).toBe(header));
    (document.activeElement as HTMLElement).blur();

    // Retry reads the Trade again under the Review held, and the card opens.
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ reviewDate }) => Promise.resolve({ kind: 'ReflectionsOwed', reviewDate, cutoff: CUTOFF, card: owedCard }));
    await user.click(within(item).getByRole('button', { name: 'Retry' }));
    expect(await within(item).findByRole('region', { name: 'XYZ review' })).toBeTruthy();
    expect(within(item).queryByText('We couldn’t load this Trade. Nothing was changed.')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(header));
  });
});

describe('owed card links (T6.20-B1)', () => {
  // Item 3: the Reflection due blocker names the open owed card's Reflections panel, which the trader has collapsed.
  it('should reopen the Reflections panel the trader collapsed when a Reflection due blocker links to the open owed card', async () => {
    const user = userEvent.setup();
    renderReview(reviewFacade(ready()));
    const card = await screen.findByRole('region', { name: 'ABC review' });
    const panel = within(card).getByRole('button', { name: /^Reflections/ });
    await user.click(panel);
    expect(panel.getAttribute('aria-expanded')).toBe('false');

    const blockers = within(screen.getByRole('region', { name: 'Review status' })).getByRole('list', { name: 'Blockers' });
    await user.click(within(blockers).getByRole('link', { name: 'ABC' }));

    expect(panel.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(panel);
    expect(within(card).getByRole('button', { name: /^Reflect on/ })).toBeTruthy();
  });
});
