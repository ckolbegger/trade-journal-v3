// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OC_PC1, optionTrade } from '../../../tests/support/option-trade-fixtures.ts';
import { cardProgress,reflectionsOwedProgress } from '../../../tests/support/card-progress.ts';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { reflectionDefinition } from '../../../tests/support/position-change-form-facade.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, OpenDailyReviewResult, OwedReflection, OwedReflectionsCard, OwedReflectionsTrade, OwedTradeSummary, ReviewBinding, WalkedTrade } from '../../app/types.ts';
import { DAILY_TRADE_REVIEW_PROMPTS } from '../../domain/daily-trade-review-prompts.ts';
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
  basis: { kind: 'Value', value: { side: 'None', share: rational(0n) } },
  rangePosition: { kind: 'Value', value: { now: rational(1n, 2n), atEntry: rational(1n, 2n) } },
  progress: cardProgress(0, 0, { owed: false }),
});

// An Outstanding reflection of an owed Trade on the snapshot definition.
function reflection(debtId: string, classification: OwedReflection['classification'], economicTime: string, entryType = 'Position Change Reflection'): OwedReflection {
  return {
    debtId,
    entryType,
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
    settlement: [],
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

describe('owed card Terminal Disposition, row 23.12', () => {
  it('should say Closed via sale of 1 contract and expiration of 1 contract on the owed card of an option Trade closed by a sale and an expiration', async () => {
    const facade = reviewFacade(ready());
    const card: OwedReflectionsCard = {
      ...CLOSED_CARD,
      labels: { ...CLOSED_CARD.labels, strategy: 'Long Call' },
      summary: {
        ...(CLOSED_CARD.summary as Extract<OwedTradeSummary, { kind: 'Closed' }>),
        optionSide: 'Long',
        terminalDisposition: { kind: 'Value', value: [{ mechanism: 'Executions', quantity: rational(1n) }, { mechanism: 'Expiration', quantity: rational(1n) }] },
      },
    };
    vi.mocked(facade.DailyReview.getTrade).mockResolvedValue({ kind: 'ReflectionsOwed', reviewDate: DATE, cutoff: CUTOFF, card });
    renderReview(facade);
    const closed = await screen.findByRole('region', { name: 'ABC review' });
    const result = within(closed).getByRole('region', { name: 'Result' });
    expect(within(result).getByText('Terminal Disposition').nextElementSibling?.textContent).toBe('Closed via sale of 1 contract and expiration of 1 contract');
  });
});

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

  it('should name each owed reflection by its Entry Type, Close Review and Position Change Reflection for the same Position Change, and title the opened form with it', async () => {
    const user = userEvent.setup();
    const facade = reviewFacade(ready());
    const time = '2026-10-13T20:30:00Z';
    const both: OwedReflectionsCard = { ...CLOSED_CARD, reflections: [reflection('d-pcr', 'Due', time), reflection('d-close', 'Due', time, 'Close Review')], progress: reflectionsOwedProgress(2, 0) };
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ reviewDate }) => Promise.resolve({ kind: 'ReflectionsOwed', reviewDate, cutoff: CUTOFF, card: both }));
    renderReview(facade);
    const panel = await screen.findByRole('region', { name: 'Reflections' });
    const titles = within(panel).getAllByRole('heading', { level: 6 }).map((h) => h.textContent);
    expect(titles).toEqual(['Position Change Reflection', 'Close Review']);

    const close = within(panel).getAllByRole('listitem').find((li) => within(li).queryByRole('heading', { name: 'Close Review' }))!;
    await user.click(within(close).getByRole('button', { name: /^Reflect on/ }));
    const form = await within(close).findByRole('form', { name: 'Reflection' });
    expect(within(close).getByRole('heading', { name: 'Close Review' }).compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should name an option Execution in a Review reflection by the role action, count and label, Buy to open 1 XYZ 20 Nov 2026 55 Call @ $2.10, with no fee', async () => {
    const facade = reviewFacade(ready());
    const option: OwedReflection = {
      ...reflection('d-opt', 'Due', '2026-10-12T14:00:00Z'),
      executions: OC_PC1.executions,
      legs: optionTrade('O-C').record.plan.legs.map(({ factId, side }) => ({ factId, side })),
    };
    const card: OwedReflectionsCard = { ...CLOSED_CARD, reflections: [option] };
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ reviewDate }) => Promise.resolve({ kind: 'ReflectionsOwed', reviewDate, cutoff: CUTOFF, card }));
    renderReview(facade);
    const panel = await screen.findByRole('region', { name: 'Reflections' });
    expect(within(panel).getAllByRole('listitem').map((li) => li.textContent)).toContain('Buy to open 1 XYZ 20 Nov 2026 55 Call @ $2.10');
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

describe('Exit Action records intent only (decision 72)', () => {
  it('should show a saved Exit Action with its Intent in the Action panel of the card, with no Record the exit, no exit form and no Refresh Review for an exit', async () => {
    const user = userEvent.setup();
    const walked = walkedTrade('t-w', 'XYZ');
    const intent = 'Sell into strength';
    const savedExit = {
      id: 'e1',
      entryType: 'Daily Trade Review',
      entryTypeKey: 'entry-type.daily-trade-review',
      source: 'Daily Review',
      anchor: { kind: 'Trade', tradeId: 't-w' },
      momentTime: CUTOFF,
      authoredTime: '2026-10-13T21:00:00Z',
      responses: [
        { prompt: 'Action', answer: { kind: 'Option', label: 'Exit' } },
        { prompt: DAILY_TRADE_REVIEW_PROMPTS.intent, answer: { kind: 'Text', text: intent } },
      ],
      entryRevision: 1,
      action: 'Exit',
      definitionId: 'def1',
    } as never;
    // The Trade still holds its 100 shares: the Review offers no way to exit them (decision 72).
    const trade = walkedReview(walked, { form: { kind: 'Saved', action: savedExit } });
    const facade = reviewFacade(ready({ owed: [], completion: { kind: 'Complete' }, families: [{ family: 'Marks', today: [], earlier: [] }, { family: 'Trades', trades: [walked] }] }));
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ reviewDate }) => Promise.resolve({ kind: 'Ready', reviewDate, cutoff: CUTOFF, trade }));
    renderReview(facade);
    await user.click(await screen.findByRole('button', { name: /^Review XYZ/ }));
    const card = await screen.findByRole('region', { name: 'XYZ review' });
    const header = within(card).getByRole('button', { name: /^Action\b/ });
    if (header.getAttribute('aria-expanded') !== 'true') await user.click(header);

    // The Action panel shows the saved Exit and its Intent, and nothing that records the exit.
    expect(within(card).getByText('Saved Action: Exit')).toBeTruthy();
    expect(within(card).getByText(`${DAILY_TRADE_REVIEW_PROMPTS.intent} ${intent}`)).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Record the exit' })).toBeNull();
    expect(within(card).queryByRole('heading', { name: 'Record exit' })).toBeNull();
    expect(within(card).queryByRole('group', { name: 'Execution 1' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Refresh Review' })).toBeNull();
    expect(facade.TradeViewsAndReporting.getTradeDetail).not.toHaveBeenCalled();
    expect(facade.TradeWorkflows.recordPositionChange).not.toHaveBeenCalled();
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
