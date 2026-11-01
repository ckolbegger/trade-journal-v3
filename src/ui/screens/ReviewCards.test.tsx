// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, IncompleteReason, MarkResolution, MarkRow, OpenDailyReviewResult, OwedReflection, ReviewBinding, ReviewCompletion, WalkedTrade } from '../../app/types.ts';
import { reflectionDefinition } from '../../../tests/support/position-change-form-facade.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';

afterEach(cleanup);

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;

// The card fixture (breakdown section 4): the Monday Marks, in attention order T-B, T-C, T-F, T-A, T-E.
const CUTOFF = '2026-10-12T20:00:00Z';
const binding: ReviewBinding = {
  workspace: { databaseName: 'tj-ws-1', contentRevision: 3 },
  catalogRevision: 1,
  journalRevision: 1,
  marketDataSnapshotId: 'mds1:1:abc',
  factRevisions: {},
  outstandingDebts: {},
};
const value = (n: bigint, d = 1n) => ({ kind: 'Value' as const, value: Rational.of(n, d) });
const rational = (n: bigint, d = 1n) => Rational.of(n, d);
const available = (price: string): MarkResolution => ({ kind: 'Available', mark: { revisionId: 'r1', revisionNumber: 1, price, source: 'Manual', savedAt: '2026-10-12T21:00:00Z' } });
const markRow = (instrumentKey: string, trades: readonly string[], resolution: MarkResolution = { kind: 'Missing' }): MarkRow => ({
  instrumentKey,
  tradingDate: '2026-10-12',
  trades,
  resolution,
  resolutionRevision: resolution.kind === 'Missing' ? 'None' : 1,
  task: resolution.kind === 'Missing' ? 'Manual' : null,
});

const trade = (tradeId: string, underlying: string, over: Partial<WalkedTrade>): WalkedTrade => ({
  tradeId,
  underlying,
  lastActivity: '2026-10-12T14:00:00Z',
  band: 'Routine',
  reasons: [{ code: 'NoPressure' }],
  basis: { kind: 'Comparable', side: 'None', share: rational(0n) },
  rangePosition: { kind: 'Placed', now: rational(1n, 2n), atEntry: rational(1n, 2n) },
  reflections: { due: 0, later: 0 },
  ...over,
});
const TB = trade('t-b', 'ABC', {
  band: 'BoundaryReached',
  reasons: [{ code: 'StopBreached', conditionId: 'c', overrun: rational(1n) }],
  rangePosition: { kind: 'Placed', now: rational(0n), atEntry: rational(1n, 4n), pinned: 'Stop' },
  figures: { riskToStop: value(0n), pnl: value(-200n), rewardRiskNow: { kind: 'NotApplicable' } as never },
});
const TC = trade('t-c', 'DEF', {
  band: 'EvidenceLimited',
  reasons: [{ code: 'MarkMissing', instrumentKey: 'DEF', date: '2026-10-12' }],
  rangePosition: { kind: 'NotPlaced', reason: 'MissingInput', instrumentKey: 'DEF', date: '2026-10-12' },
});
const TF = trade('t-f', 'XYZ', {
  band: 'QuantifiedPressure',
  reasons: [{ code: 'PressureTowardTarget' }],
  rangePosition: { kind: 'Placed', now: rational(4n, 7n), atEntry: rational(2n, 7n) },
  figures: { riskToStop: value(200n), pnl: value(100n), rewardRiskNow: value(3n, 4n) },
});
const TA = trade('t-a', 'XYZ', {
  band: 'QuantifiedPressure',
  reasons: [{ code: 'PressureTowardTarget' }],
  rangePosition: { kind: 'Placed', now: rational(9n, 17n), atEntry: rational(134n, 425n) },
  reflections: { due: 1, later: 1 },
  figures: { riskToStop: value(450n), pnl: value(180n), rewardRiskNow: value(8n, 9n) },
});
const TE = trade('t-e', 'JKL', {
  rangePosition: { kind: 'Placed', now: rational(2n, 11n), atEntry: rational(1n, 11n) },
  figures: { riskToStop: value(200n), pnl: value(-100n), rewardRiskNow: value(9n, 2n) },
});
const WALK = [TB, TC, TF, TA, TE] as const;

const incomplete = (...reasons: IncompleteReason[]): ReviewCompletion => ({ kind: 'Incomplete', reasons });
const actionMissing = (...ids: string[]): IncompleteReason[] => ids.map((tradeId) => ({ code: 'ActionMissing', tradeId }));
const MONDAY_COMPLETION = incomplete(
  { code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-12', trades: ['t-c'] },
  { code: 'ReflectionDue', tradeId: 't-a', debtIds: ['d1'] },
  ...actionMissing('t-b', 't-c', 't-f', 't-a', 't-e'),
);

function review(over: Partial<Ready> = {}): Ready {
  return {
    kind: 'Ready',
    reviewDate: '2026-10-12',
    cutoff: CUTOFF,
    families: [
      { family: 'Marks', today: [markRow('ABC', ['t-b'], available('27.50')), markRow('DEF', ['t-c']), markRow('XYZ', ['t-f', 't-a'], available('52.00')), markRow('JKL', ['t-e'], available('21.00'))], earlier: [] },
      { family: 'Trades', trades: WALK },
    ],
    completion: MONDAY_COMPLETION,
    binding,
    ...over,
  };
}

const saveBinding = (tradeId: string): DailyTradeReview['saveBinding'] => ({
  reviewDate: '2026-10-12',
  tradeId,
  factRevision: 2,
  marketDataSnapshotId: 'mds1:1:abc',
  obligationKey: { entryType: 'DailyTradeReview', trade: tradeId, reviewDate: '2026-10-12' },
  definitionRevision: 'def1',
  databaseName: 'tj-ws-1',
});
const symbol = { kind: 'Stock' as const, symbol: 'XYZ' };
function tradeReview(walked: WalkedTrade, over: Partial<DailyTradeReview> = {}): DailyTradeReview {
  return {
    tradeId: walked.tradeId,
    underlying: walked.underlying,
    attention: walked,
    labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' },
    evaluation: {
      kind: 'Evaluated',
      valuationDate: '2026-10-12',
      coverage: { kind: 'Available', revisionId: 'r1', revisionNumber: 1 },
      observation: { instrument: symbol, tradingDate: '2026-10-12', mark: { revisionId: 'r1', revisionNumber: 1, price: '52.00' } },
      currentMarkedPnl: value(582n),
      currentMarkedPnlInPlanR: value(582n, 250n),
      ongoingRiskToStop: value(400n),
      ongoingRiskToStopInPlanR: value(8n, 5n),
      worstCaseOngoingRisk: value(5000n),
      worstCaseOngoingRiskInPlanR: value(20n),
      incrementalRewardToTarget: value(1200n),
      incrementalRewardToTargetInPlanR: value(24n, 5n),
      rewardRiskNow: value(3n),
      planBaseline: { kind: 'Value' as const, value: { rewardRiskRatio: Rational.of(12n, 5n) } },
      atEntry: null,
    } as unknown as DailyTradeReview['evaluation'],
    reflections: [],
    form: { kind: 'New', viewState: { selectedAction: 'Hold' } },
    definitionRevision: 'def1',
    saveBinding: saveBinding(walked.tradeId),
    ...over,
  };
}

// A facade whose getTrade answers with the walked Trade asked for.
function cardFacade(overview: Ready = review()): UiFacade {
  const facade = facadeDouble();
  vi.mocked(facade.DailyReview.open).mockResolvedValue(overview);
  const walked = overview.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
  vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ tradeId }) => {
    const found = walked.find((t) => t.tradeId === tradeId)!;
    return Promise.resolve({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: CUTOFF, trade: tradeReview(found) });
  });
  return facade;
}

// A test-only control: a button that navigates the router to the address, as a history change would.
function NavigateTo({ to }: { readonly to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(to)}>
      {`Navigate ${to}`}
    </button>
  );
}

function renderReview(facade: UiFacade, options: { writable?: boolean; onDirtyChange?: (dirty: boolean) => void; at?: string; navigateTo?: string } = {}) {
  render(
    <RuntimeContext.Provider value={{ writable: options.writable ?? true, timeZone: 'America/New_York', report: () => undefined }}>
      <MemoryRouter initialEntries={[options.at ?? '/review']}>
        {options.navigateTo !== undefined && <NavigateTo to={options.navigateTo} />}
        <ReviewView facade={facade} now={() => '2026-10-12T21:00:00Z'} onDirtyChange={options.onDirtyChange ?? (() => undefined)} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

// The collapsed header of each card, in list order.
const headers = () => screen.getAllByRole('button', { name: /^Review / });

// What MarketData.save answers to a correction of ABC's Mark, the per-row save that refreshes the Review.
const correctedAbc = {
  kind: 'Saved',
  key: { instrumentKey: 'ABC', tradingDate: '2026-10-12' },
  resolution: available('28.00'),
  resolutionRevision: 2,
  classification: 'Correction',
  revision: { revisionId: 'r2', revisionNumber: 2, price: '28.00', source: 'Manual', intention: 'Correction', observedAt: CUTOFF, savedAt: CUTOFF },
  binding: { instrumentKey: 'ABC', tradingDate: '2026-10-12', expectedResolutionRevision: 1 },
} as never;
// Opens a panel of the card by its header, unless it is already open (A152).
async function showPanel(user: ReturnType<typeof userEvent.setup>, card: HTMLElement, name: 'Marks' | 'Reflections' | 'Action') {
  const header = within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) });
  if (header.getAttribute('aria-expanded') !== 'true') await user.click(header);
}
// Corrects the card's ABC Mark and saves it.
async function correctAbc(user: ReturnType<typeof userEvent.setup>, card: HTMLElement) {
  await showPanel(user, card, 'Marks');
  const entry = within(card).getByRole('region', { name: 'ABC Mark, Mon Oct 12' });
  await user.click(within(entry).getByRole('button', { name: 'Correct' }));
  await user.type(within(entry).getByLabelText('Price'), '28.00');
  await user.type(within(entry).getByLabelText('Reason (required)'), 'typo');
  await user.click(within(entry).getByRole('button', { name: 'Save correction' }));
}

describe('card list (A150)', () => {
  it('should render one card per walked Trade in attention order, each a heading button showing the Underlying, what remains, its band as text, and its slider, with a Stop Target legend above the list and no Continue to Trades', async () => {
    renderReview(cardFacade());
    await screen.findAllByRole('button', { name: /^Review / });

    expect(headers().map((h) => h.textContent)).toEqual([
      expect.stringContaining('ABC'),
      expect.stringContaining('DEF'),
      expect.stringContaining('XYZ'),
      expect.stringContaining('XYZ'),
      expect.stringContaining('JKL'),
    ]);
    const cards = screen.getAllByRole('listitem').filter((li) => within(li).queryByRole('button', { name: /^Review / }) && li.parentElement?.getAttribute('aria-label') === 'Positions');
    expect(cards).toHaveLength(5);
    const [bCard, cCard, , aCard] = cards as [HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    const b = within(bCard);
    const c = within(cCard);
    const a = within(aCard);
    // Each header is a heading's button.
    for (const card of cards) expect(within(card).getAllByRole('heading')[0]!.querySelector('button')).not.toBeNull();
    // What remains, from the Mark rows, the reflection counts and the completion reasons.
    const head = (card: HTMLElement) => within(card).getAllByRole('button')[0]!.textContent;
    expect(head(bCard)).toContain('Review ABC Action');
    expect(head(cCard)).toContain('1 Mark · Action');
    expect(head(aCard)).toContain('1 reflection due · Action');
    // The band as text.
    expect(head(bCard)).toContain('Boundary reached');
    expect(head(cCard)).toContain('Evidence limited');
    expect(head(aCard)).toContain('Quantified pressure');
    // The slider, described: a placed one with its figures, and the unplaced one in words.
    expect(a.getByRole('img', { name: '53% of the way from the Stop to the Target, entry at 32%. Risk to stop $450.00, P&L +$180.00, Reward : risk 0.89.' })).toBeTruthy();
    expect(b.getByRole('img', { name: /^Past the Stop/ })).toBeTruthy();
    expect(c.getByRole('img', { name: 'Mark missing: DEF, Mon Oct 12' })).toBeTruthy();
    // The legend sits above the list; there is no Continue to Trades.
    const legend = screen.getByText(/Stop ◂ ▸ Target/);
    expect(legend.compareDocumentPosition(screen.getByRole('list', { name: 'Positions' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue to Trades' })).toBeNull();
  });

  it('should show Done and Action saved on a card whose Marks are resolved, with no due reflection and a saved Action', async () => {
    // T-E has its Mark, no reflection due, and its Action saved: the Action is the one thing no longer owed.
    renderReview(cardFacade(review({ completion: incomplete(...actionMissing('t-b', 't-c', 't-f', 't-a')) })));
    await screen.findAllByRole('button', { name: /^Review / });

    const jkl = headers().find((h) => h.textContent?.includes('JKL'))!;
    expect(jkl.textContent).toContain('Done · Action saved');
    // The card keeps its place, and the others are not Done.
    expect(headers().indexOf(jkl)).toBe(4);
    for (const other of headers().filter((h) => h !== jkl)) expect(other.textContent).not.toContain('Done');
  });
});

describe('opening in place (A151)', () => {
  it('should open the first card that is not Done when the Review loads, calling getTrade once for it, with aria-expanded true and its figures and panels inside it', async () => {
    const facade = cardFacade();
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });

    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);
    expect(vi.mocked(facade.DailyReview.getTrade).mock.calls[0]![0]).toMatchObject({ reviewDate: '2026-10-12', tradeId: 't-b', binding });
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    // The open card sits inside its own list item, under its header.
    expect(card.closest('li')).toBe(headers()[0]!.closest('li'));
    // Its figures and panels: Marks, Reflections, and the Action, which is the first not done.
    expect(within(card).getByText('Current Marked Trade P&L')).toBeTruthy();
    expect((['Marks', 'Reflections', 'Action'] as const).map((name) => within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) }).getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true']);
    expect(within(card).getByRole('form', { name: 'Action' })).toBeTruthy();

    // With every card Done, none opens and nothing is read.
    cleanup();
    const done = cardFacade(review({ completion: { kind: 'Complete' } }));
    renderReview(done);
    await screen.findAllByRole('button', { name: /^Review / });
    expect(headers().every((h) => h.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(done.DailyReview.getTrade).not.toHaveBeenCalled();
  });

  it('should collapse the open card, call getTrade for the pressed one, render it inside its own list item, scroll its top into view, and move focus to its header when another header is pressed', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const facade = cardFacade();
    renderReview(facade);
    await screen.findByRole('region', { name: 'ABC review' });

    // fireEvent leaves focus where it is, so focus on the header is the card's doing.
    fireEvent.click(headers()[2]!);
    const card = await screen.findByRole('region', { name: 'XYZ review' });

    expect(screen.queryByRole('region', { name: 'ABC review' })).toBeNull();
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(2);
    expect(vi.mocked(facade.DailyReview.getTrade).mock.calls[1]![0]).toMatchObject({ tradeId: 't-f' });
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true', 'false', 'false']);
    expect(card.closest('li')).toBe(headers()[2]!.closest('li'));
    expect(scrollIntoView.mock.contexts).toContain(headers()[2]!.closest('li'));
    expect(document.activeElement).toBe(headers()[2]);
  });

  it('should collapse the open card, with no call, when its own header is pressed', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    renderReview(facade);
    await screen.findByRole('region', { name: 'ABC review' });

    await user.click(headers()[0]!);

    expect(screen.queryByRole('region', { name: 'ABC review' })).toBeNull();
    expect(headers().every((h) => h.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);
    expect(facade.DailyReview.open).toHaveBeenCalledTimes(1);
  });
});

describe('after a per-row Mark save', () => {
  it('should read the Review through open and the open card through getTrade again, under the new binding, after a Mark is corrected in the card', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    const moved: ReviewBinding = { ...binding, marketDataSnapshotId: 'mds1:2:def' };
    const afterMark = review({ binding: moved, completion: incomplete(...actionMissing('t-b', 't-c', 't-f', 't-a', 't-e')) });
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(review()).mockResolvedValue(afterMark);
    vi.mocked(facade.MarketData.save).mockResolvedValue(correctedAbc);
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });
    // DEF's card still owes its Mark.
    expect(headers()[1]!.textContent).toContain('1 Mark · Action');

    await correctAbc(user, card);

    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(2));
    expect(vi.mocked(facade.DailyReview.getTrade).mock.calls[1]![0]).toMatchObject({ tradeId: 't-b', binding: moved });
    // The cards' summaries follow the refreshed Review, and the card stays open.
    expect(headers()[1]!.textContent).not.toContain('Mark ·');
    expect(headers()[0]!.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('card order follows the newest Review (A150, decision 64)', () => {
  it('should re-sort the cards when a refreshed Review returns the Trades in a different order', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    const reordered = review({
      families: [
        { family: 'Marks', today: [], earlier: [] },
        { family: 'Trades', trades: [...WALK].reverse() },
      ],
    });
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(review()).mockResolvedValue(reordered);
    vi.mocked(facade.MarketData.save).mockResolvedValue(correctedAbc);
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });
    await correctAbc(user, card);
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(2));

    const underlyings = headers().map((h) => /Review (\w+)/.exec(h.getAttribute('aria-label') ?? h.textContent ?? '')?.[1]);
    expect(underlyings).toEqual(['JKL', 'XYZ', 'XYZ', 'DEF', 'ABC']);
  });

  it('should keep the open card open, with its entered values, when a refreshed Review moves it', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    const reordered = review({
      families: [
        { family: 'Marks', today: [], earlier: [] },
        { family: 'Trades', trades: [...WALK].reverse() },
      ],
    });
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(review()).mockResolvedValue(reordered);
    vi.mocked(facade.MarketData.save).mockResolvedValue(correctedAbc);
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });
    // A value is entered in the card's Action form before the Mark is corrected.
    const field = within(card).getAllByRole('textbox').find((box) => !box.closest('[aria-label="ABC Mark, Mon Oct 12"]'))!;
    await user.type(field, 'kept');
    await showPanel(user, card, 'Marks');
    const entry = within(card).getByRole('region', { name: 'ABC Mark, Mon Oct 12' });
    await user.click(within(entry).getByRole('button', { name: 'Correct' }));
    await user.type(within(entry).getByLabelText('Price'), '28.00');
    await user.type(within(entry).getByLabelText('Reason (required)'), 'typo');
    await user.click(within(entry).getByRole('button', { name: 'Save correction' }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(2));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    const moved = headers().find((h) => h.textContent?.includes('ABC'))!;
    expect(headers().indexOf(moved)).toBe(4);
    expect(moved.getAttribute('aria-expanded')).toBe('true');
    await showPanel(user, screen.getByRole('region', { name: 'ABC review' }), 'Action');
    expect(within(screen.getByRole('region', { name: 'ABC review' })).getAllByRole('textbox').find((box) => (box as HTMLTextAreaElement | HTMLInputElement).value === 'kept')).toBeTruthy();
  });
});

describe('a late Mark save', () => {
  it('should keep the newly opened card shown, with its values, when a Mark saved on the previous card finishes after the switch', async () => {
    const user = userEvent.setup();
    // DEF's Mark is an acknowledgment, which Withdraw saves with nothing typed, so another card can be opened while the save is in flight.
    const acknowledged: MarkResolution = { kind: 'AcknowledgedUnavailable', acknowledgment: { versionId: 'a1', kind: 'Asserted', savedAt: CUTOFF } };
    const overview = review({
      families: [
        { family: 'Marks', today: [markRow('ABC', ['t-b'], available('27.50')), { ...markRow('DEF', ['t-c'], acknowledged), task: null }, markRow('JKL', ['t-e'], available('21.00'))], earlier: [] },
        { family: 'Trades', trades: WALK },
      ],
    });
    const facade = cardFacade(overview);
    let finish: (result: never) => void = () => undefined;
    vi.mocked(facade.MarketData.save).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderReview(facade);
    await screen.findByRole('region', { name: 'ABC review' });
    await user.click(headers()[1]!);
    const card = await screen.findByRole('region', { name: 'DEF review' });
    await user.click(within(within(card).getByRole('region', { name: 'DEF Mark, Mon Oct 12' })).getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(facade.MarketData.save).toHaveBeenCalledTimes(1));

    // Another card is opened while the save is in flight, and a value is typed into it.
    await user.click(headers()[4]!);
    const other = await screen.findByRole('region', { name: 'JKL review' });
    await user.type(within(other).getAllByRole('textbox')[0]!, 'kept');
    finish({
      kind: 'Saved',
      key: { instrumentKey: 'DEF', tradingDate: '2026-10-12' },
      resolution: { kind: 'Missing' },
      resolutionRevision: 'None',
      classification: 'Withdrawal',
      binding: { instrumentKey: 'DEF', tradingDate: '2026-10-12', expectedResolutionRevision: 1 },
    } as never);
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    // Let the refresh run to its end.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(screen.getByRole('region', { name: 'JKL review' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'DEF review' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'JKL review' })).getAllByRole('textbox')[0]).toHaveProperty('value', 'kept');
  });
});

describe('Save while the Review is read again', () => {
  it('should hold the Action Save while the Review is read again after a Mark is saved, then offer it under the new binding', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    let settle: (result: Ready) => void = () => undefined;
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(review()).mockReturnValueOnce(new Promise((resolve) => (settle = resolve)));
    vi.mocked(facade.MarketData.save).mockResolvedValue({
      kind: 'Saved',
      key: { instrumentKey: 'ABC', tradingDate: '2026-10-12' },
      resolution: available('28.00'),
      resolutionRevision: 2,
      classification: 'Correction',
      revision: { revisionId: 'r2', revisionNumber: 2, price: '28.00', source: 'Manual', intention: 'Correction', observedAt: CUTOFF, savedAt: CUTOFF },
      binding: { instrumentKey: 'ABC', tradingDate: '2026-10-12', expectedResolutionRevision: 1 },
    } as never);
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });

    await correctAbc(user, card);
    await showPanel(user, card, 'Action');

    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    const save = () => within(screen.getByRole('region', { name: 'ABC review' })).getByRole<HTMLButtonElement>('button', { name: 'Save' });
    expect(save().disabled).toBe(true);
    settle(review({ binding: { ...binding, marketDataSnapshotId: 'mds1:2:def' } }));
    await waitFor(() => expect(save().disabled).toBe(false));
  });
});

describe('unsaved work (A156)', () => {
  const MESSAGE = 'Save or discard what you entered for ABC to leave it';

  it('should keep the open card open, make no call, and say to save or discard what was entered when another header is pressed while a draft Mark or an entered form value is held, and report unsaved through onDirtyChange', async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    const facade = cardFacade();
    renderReview(facade, { onDirtyChange });
    const card = await screen.findByRole('region', { name: 'ABC review' });

    // An entered Mark value holds the card.
    await showPanel(user, card, 'Marks');
    const entry = within(card).getByRole('region', { name: 'ABC Mark, Mon Oct 12' });
    await user.click(within(entry).getByRole('button', { name: 'Correct' }));
    await user.type(within(entry).getByLabelText('Price'), '28.00');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    await user.click(headers()[2]!);
    expect(screen.getByText(new RegExp(MESSAGE))).toBeTruthy();
    expect(screen.getByRole('region', { name: 'ABC review' })).toBe(card);
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);
    // The open card's own header cannot collapse it either.
    await user.click(headers()[0]!);
    expect(screen.getByRole('region', { name: 'ABC review' })).toBe(card);

    // An entered Action value holds it the same way.
    cleanup();
    const second = cardFacade();
    renderReview(second);
    const open = await screen.findByRole('region', { name: 'ABC review' });
    await user.click(within(within(open).getByRole('form', { name: 'Action' })).getByRole('radio', { name: 'Exit' }));
    await user.click(headers()[2]!);
    expect(screen.getByText(new RegExp(MESSAGE))).toBeTruthy();
    expect(second.DailyReview.getTrade).toHaveBeenCalledTimes(1);
  });
});

describe('read only (A162)', () => {
  it('should open cards and show their figures, Marks, reflections, and saved Action with no input, Save Marks, Answer, Decline, or Save when the shell is not Writable', async () => {
    const user = userEvent.setup();
    const reflection: OwedReflection = {
      debtId: 'd1',
      definition: reflectionDefinition,
      economicTime: '2026-10-09T14:30:00Z',
      executions: [{ factId: 'x1', economicTime: '2026-10-09T14:30:00Z', recordedSequence: 1, action: 'Buy', instrument: symbol, quantity: '100', price: '50.00', fee: '1.00' }] as unknown as OwedReflection['executions'],
      classification: 'Due',
      saveBinding: { debtId: 'd1', debtRevision: 'd1-rev-1', definitionRevision: 'def-pcr-1' },
    };
    const saved = {
      id: 'e1',
      entryType: 'Daily Trade Review',
      source: 'Daily Review',
      anchor: { kind: 'Trade', tradeId: 't-a' },
      momentTime: CUTOFF,
      authoredTime: '2026-10-12T21:00:00Z',
      responses: [{ prompt: 'Action', answer: { kind: 'Option', label: 'Hold' } }],
      entryRevision: 1,
      action: 'Hold',
      definitionId: 'def1',
    } as unknown as Extract<DailyTradeReview['form'], { kind: 'Saved' }>['action'];
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ tradeId }) => {
      const walked = WALK.find((t) => t.tradeId === tradeId)!;
      const detail = tradeId === 't-a' ? tradeReview(walked, { reflections: [reflection], form: { kind: 'Saved', action: saved } }) : tradeReview(walked);
      return Promise.resolve({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: CUTOFF, trade: detail });
    });
    renderReview(facade, { writable: false });
    const first = await screen.findByRole('region', { name: 'ABC review' });

    // The first card: its figures, and its Mark as saved, with nothing to enter.
    expect(within(first).getByText('Current Marked Trade P&L')).toBeTruthy();
    expect(within(first).getByText('No Action saved.')).toBeTruthy();
    await showPanel(user, first, 'Marks');
    expect(within(first).getByRole('region', { name: 'ABC Mark, Mon Oct 12' }).textContent).toContain('$27.50');
    // The card with a reflection and a saved Action.
    await user.click(headers()[3]!);
    const card = await screen.findByRole('region', { name: 'XYZ review' });
    await showPanel(user, card, 'Action');
    expect(within(card).getByText('Saved Action: Hold')).toBeTruthy();
    await showPanel(user, card, 'Reflections');
    expect(within(card).getByRole('region', { name: 'Reflections' })).toBeTruthy();
    // Opening the reflection shows its questions, none of them enabled, as D5 renders a reflection read only.
    await user.click(within(card).getByRole('button', { name: /^Reflect on/ }));
    expect(within(card).getByRole('form', { name: 'Reflection' })).toBeTruthy();
    for (const field of [...screen.queryAllByRole('textbox'), ...screen.queryAllByRole('radio')]) expect((field as HTMLInputElement).disabled).toBe(true);
    for (const name of ['Save Marks', 'Answer', 'Decline', 'Save', 'Save Mark', 'Change', 'Enter', 'Correct']) expect(screen.queryByRole('button', { name })).toBeNull();
  });
});

describe('links (A161)', () => {
  it('should open the first card holding XYZ in attention order on its Marks panel, with focus on XYZ row, for /review?instrument=XYZ', async () => {
    const facade = cardFacade();
    renderReview(facade, { at: '/review?instrument=XYZ' });
    const card = await screen.findByRole('region', { name: 'XYZ review' });

    // T-F comes before T-A in attention order; the card ABC that would open on load does not.
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true', 'false', 'false']);
    expect(card.closest('li')).toBe(headers()[2]!.closest('li'));
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);
    expect(vi.mocked(facade.DailyReview.getTrade).mock.calls[0]![0]).toMatchObject({ tradeId: 't-f' });
    expect(within(card).getByRole('button', { name: /^Marks\b/ }).getAttribute('aria-expanded')).toBe('true');
    expect(within(card).getByRole('region', { name: 'XYZ Mark, Mon Oct 12' }).contains(document.activeElement)).toBe(true);
  });

  it('should open T-E card on its first panel that is not done for /review?trade=t-e', async () => {
    const facade = cardFacade();
    renderReview(facade, { at: '/review?trade=t-e' });
    const card = await screen.findByRole('region', { name: 'JKL review' });

    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'false', 'true']);
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);
    expect(vi.mocked(facade.DailyReview.getTrade).mock.calls[0]![0]).toMatchObject({ tradeId: 't-e' });
    // Its Marks are saved and no reflection is due, so the Action is the first panel not done.
    expect((['Marks', 'Reflections', 'Action'] as const).map((name) => within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) }).getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true']);
  });

  it('should open the card that the trade param names, with the row that the instrument param names, when both are given', async () => {
    const facade = cardFacade();
    renderReview(facade, { at: '/review?trade=t-a&instrument=XYZ' });
    const card = await screen.findByRole('region', { name: 'XYZ review' });

    // T-F also holds XYZ and comes first, but the Trade picks the card.
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'true', 'false']);
    expect(vi.mocked(facade.DailyReview.getTrade).mock.calls[0]![0]).toMatchObject({ tradeId: 't-a' });
    expect(within(card).getByRole('button', { name: /^Marks\b/ }).getAttribute('aria-expanded')).toBe('true');
    expect(within(card).getByRole('region', { name: 'XYZ Mark, Mon Oct 12' }).contains(document.activeElement)).toBe(true);
  });

  const panelStates = (card: HTMLElement) => (['Marks', 'Reflections', 'Action'] as const).map((name) => within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) }).getAttribute('aria-expanded'));

  it('should open the panel that the panel param names, not the first panel that is not done', async () => {
    renderReview(cardFacade(), { at: '/review?trade=t-e&panel=Marks' });
    const card = await screen.findByRole('region', { name: 'JKL review' });

    // T-E's Action is its first panel not done; the link names Marks.
    expect(panelStates(card)).toEqual(['true', 'false', 'false']);
  });

  it('should ignore a panel param that names no panel', async () => {
    renderReview(cardFacade(), { at: '/review?trade=t-e&panel=Nonsense' });
    const card = await screen.findByRole('region', { name: 'JKL review' });

    expect(panelStates(card)).toEqual(['false', 'false', 'true']);
  });
});

describe('a search-param change on the mounted Review (A161)', () => {
  it('should open the card that a changed trade param names, as on load, when nothing is held', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    renderReview(facade, { navigateTo: '/review?trade=t-e' });
    await screen.findByRole('region', { name: 'ABC review' });

    await user.click(screen.getByRole('button', { name: 'Navigate /review?trade=t-e' }));
    const card = await screen.findByRole('region', { name: 'JKL review' });

    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'false', 'true']);
    expect(vi.mocked(facade.DailyReview.getTrade).mock.calls.at(-1)![0]).toMatchObject({ tradeId: 't-e' });
    expect((['Marks', 'Reflections', 'Action'] as const).map((name) => within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) }).getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true']);
  });

  it('should keep the held card open and say to save or discard what was entered when a changed param names another card', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    renderReview(facade, { navigateTo: '/review?trade=t-e' });
    const card = await screen.findByRole('region', { name: 'ABC review' });
    await user.click(within(within(card).getByRole('form', { name: 'Action' })).getByRole('radio', { name: 'Exit' }));

    await user.click(screen.getByRole('button', { name: 'Navigate /review?trade=t-e' }));

    expect(await screen.findByText('Save or discard what you entered for ABC to leave it.')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'ABC review' })).toBe(card);
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);
  });

  it('should switch to the panel that a changed param names on the held open card', async () => {
    const user = userEvent.setup();
    renderReview(cardFacade(), { navigateTo: '/review?trade=t-b&panel=Reflections' });
    const card = await screen.findByRole('region', { name: 'ABC review' });
    await user.click(within(within(card).getByRole('form', { name: 'Action' })).getByRole('radio', { name: 'Exit' }));
    const states = () => (['Marks', 'Reflections', 'Action'] as const).map((name) => within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) }).getAttribute('aria-expanded'));
    expect(states()).toEqual(['false', 'false', 'true']);

    await user.click(screen.getByRole('button', { name: 'Navigate /review?trade=t-b&panel=Reflections' }));

    await waitFor(() => expect(states()).toEqual(['false', 'true', 'false']));
    expect(screen.getByRole('region', { name: 'ABC review' })).toBe(card);
  });
});

describe('blocker links open in a new tab (A161)', () => {
  const blockers = incomplete({ code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-12', trades: ['t-c'] }, { code: 'ActionMissing', tradeId: 't-b' }, { code: 'ReflectionDue', tradeId: 't-a', debtIds: ['d1'] });

  it('should give a Mark blocker link the Instrument in its href, and Action and Reflection links the Trade and their panel', async () => {
    renderReview(cardFacade(review({ completion: blockers })));
    await screen.findByRole('region', { name: 'ABC review' });
    const status = screen.getByRole('region', { name: 'Review status' });

    expect(within(status).getByRole('link', { name: 'DEF' }).getAttribute('href')).toBe('/review?trade=t-c&instrument=DEF');
    expect(within(status).getByRole('link', { name: 'ABC' }).getAttribute('href')).toBe('/review?trade=t-b&panel=Action');
    expect(within(status).getByRole('link', { name: 'XYZ' }).getAttribute('href')).toBe('/review?trade=t-a&panel=Reflections');
  });

  it.each([
    ['ctrlKey', { ctrlKey: true }],
    ['metaKey', { metaKey: true }],
    ['shiftKey', { shiftKey: true }],
    ['middle button', { button: 1 }],
  ])('should leave a click with %s to the browser, with the open card unchanged', async (_name, modifier) => {
    renderReview(cardFacade(review({ completion: blockers })));
    await screen.findByRole('region', { name: 'ABC review' });
    const link = within(screen.getByRole('region', { name: 'Review status' })).getByRole('link', { name: 'DEF' });

    // fireEvent answers false when a handler called preventDefault.
    expect(fireEvent.click(link, modifier)).toBe(true);
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false']);
  });

  it('should still open the card in place for a plain left click', async () => {
    renderReview(cardFacade(review({ completion: blockers })));
    await screen.findByRole('region', { name: 'ABC review' });
    const link = within(screen.getByRole('region', { name: 'Review status' })).getByRole('link', { name: 'DEF' });

    expect(fireEvent.click(link)).toBe(false);
    await screen.findByRole('region', { name: 'DEF review' });
  });
});

describe('header', () => {
  it('should show the Review Date, completion as text, and the blockers, with Missing Marks first, each opening the card and panel that resolve it', async () => {
    const user = userEvent.setup();
    const facade = cardFacade(
      review({
        completion: incomplete(
          { code: 'ActionMissing', tradeId: 't-b' },
          { code: 'ReflectionDue', tradeId: 't-a', debtIds: ['d1'] },
          { code: 'MarkMissing', instrumentKey: 'DEF', tradingDate: '2026-10-12', trades: ['t-c'] },
        ),
      }),
    );
    renderReview(facade);
    const status = await screen.findByRole('region', { name: 'Review status' });

    expect(within(status).getByText('Mon Oct 12')).toBeTruthy();
    expect(within(status).getByText('Incomplete')).toBeTruthy();
    const blockers = within(within(status).getByRole('list', { name: 'Blockers' })).getAllByRole('listitem');
    expect(blockers.map((b) => b.textContent)).toEqual(['Mark missing for DEF on Mon Oct 12', 'Action missing for ABC', 'Reflection due for XYZ']);
    await screen.findByRole('region', { name: 'ABC review' });

    // The Mark opens DEF's card on its Marks panel, with focus on the row.
    await user.click(within(blockers[0]!).getByRole('link', { name: 'DEF' }));
    const def = await screen.findByRole('region', { name: 'DEF review' });
    expect(within(def).getByRole('button', { name: /^Marks\b/ }).getAttribute('aria-expanded')).toBe('true');
    expect(within(def).getByRole('region', { name: 'DEF Mark, Mon Oct 12' }).contains(document.activeElement)).toBe(true);
    // The reflection opens XYZ's card on its Reflections panel.
    await user.click(within(blockers[2]!).getByRole('link', { name: 'XYZ' }));
    const xyz = await screen.findByRole('region', { name: 'XYZ review' });
    expect(within(xyz).getByRole('button', { name: /^Reflections\b/ }).getAttribute('aria-expanded')).toBe('true');
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'true', 'false']);
    // The Action opens ABC's card on its Action panel, from another panel.
    await user.click(within(blockers[1]!).getByRole('link', { name: 'ABC' }));
    const abc = await screen.findByRole('region', { name: 'ABC review' });
    expect(within(abc).getByRole('button', { name: /^Action\b/ }).getAttribute('aria-expanded')).toBe('true');
  });
});

describe('card-top scroll once the body shows (T5R.15-B1-B1)', () => {
  const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
  afterEach(() => {
    if (original) Object.defineProperty(Element.prototype, 'scrollIntoView', original);
    else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });
  type Spy = ReturnType<typeof vi.fn<(options: ScrollIntoViewOptions) => void>>;
  const topScrolls = (spy: Spy, li: Element | null) => spy.mock.contexts.flatMap((context, i) => (context === li ? [spy.mock.calls[i]![0]] : []));

  it('should leave a focused Mark row alone, scrolling the card top only at the press, for a Mark-row landing', async () => {
    const scrollIntoView: Spy = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderReview(cardFacade(), { at: '/review?instrument=XYZ' });
    const card = await screen.findByRole('region', { name: 'XYZ review' });

    await waitFor(() => expect(within(card).getByRole('region', { name: 'XYZ Mark, Mon Oct 12' }).contains(document.activeElement)).toBe(true));
    expect(topScrolls(scrollIntoView, card.closest('li'))).toEqual([{ block: 'start' }]);
  });

  it('should scroll the card top at the press and again once the body shows, for a plain header open', async () => {
    const scrollIntoView: Spy = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderReview(cardFacade());
    await screen.findByRole('region', { name: 'ABC review' });

    fireEvent.click(headers()[2]!);
    const card = await screen.findByRole('region', { name: 'XYZ review' });

    expect(document.activeElement).toBe(headers()[2]);
    expect(topScrolls(scrollIntoView, card.closest('li'))).toEqual([{ block: 'start' }, { block: 'start' }]);
  });
});

describe('Action save whose next step is a Mark (T5R.12-B3)', () => {
  const markStep = (trades: readonly string[]) => ({ kind: 'Mark', row: markRow('DEF', trades) }) as const;
  const postWith = (nextStep: ReturnType<typeof markStep>) => ({ kind: 'Ready', progress: { tradesWithAction: 1, tradesEligible: 5 }, completion: MONDAY_COMPLETION, nextStep, binding }) as const;

  it('should collapse the saving card and open the card for the Missing Mark on its Marks panel, with focus in the row', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: {} as never, review: postWith(markStep(['t-c'])) });
    renderReview(facade);
    const abc = await screen.findByRole('region', { name: 'ABC review' });

    await user.click(within(abc).getByRole('button', { name: 'Save' }));

    const def = await screen.findByRole('region', { name: 'DEF review' });
    expect(screen.queryByRole('region', { name: 'ABC review' })).toBeNull();
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'true', 'false', 'false', 'false']);
    expect(within(def).getByRole('button', { name: /^Marks\b/ }).getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(within(def).getByRole('region', { name: 'DEF Mark, Mon Oct 12' }).contains(document.activeElement)).toBe(true));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('should open the first card in the Review order whose Trade is in the Mark row', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: {} as never, review: postWith(markStep(['t-e', 't-a'])) });
    renderReview(facade);
    const abc = await screen.findByRole('region', { name: 'ABC review' });

    await user.click(within(abc).getByRole('button', { name: 'Save' }));

    await screen.findByRole('region', { name: 'XYZ review' });
    // T-A comes before T-E in attention order.
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'true', 'false']);
  });

  it('should keep the old behaviour when none of the row Trades is in the Review', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: {} as never, review: postWith(markStep(['t-zzz'])) });
    renderReview(facade);
    const abc = await screen.findByRole('region', { name: 'ABC review' });

    await user.click(within(abc).getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('status')).textContent).toBe('A Mark is needed before the next Trade. It is listed in its card.');
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'false', 'false']);
  });

  it('should stay on the card and say to save or discard when the card holds a Mark draft and the next step is a Mark', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: {} as never, review: postWith(markStep(['t-e'])) });
    renderReview(facade, { at: '/review?trade=t-c' });
    const card = await screen.findByRole('region', { name: 'DEF review' });
    await user.type(within(within(card).getByRole('region', { name: 'DEF Mark, Mon Oct 12' })).getByLabelText('Price'), '33.10');
    await showPanel(user, card, 'Action');

    await user.click(within(card).getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('status')).textContent).toContain('Save or discard what you entered for DEF');
    expect(screen.getByRole('region', { name: 'DEF review' })).toBe(card);
    expect(screen.queryByRole('region', { name: 'JKL review' })).toBeNull();
  });
});

describe('Action save while other forms hold values (A156)', () => {
  it('should stay on the card, keep the entered Mark, and say why when an Action save names another card as the next step', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    const post = { kind: 'Ready', progress: { tradesWithAction: 1, tradesEligible: 5 }, completion: MONDAY_COMPLETION, nextStep: { kind: 'Trade', trade: tradeReview(TF) }, binding } as const;
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: {} as never, review: post });
    renderReview(facade, { at: '/review?trade=t-c' });
    const card = await screen.findByRole('region', { name: 'DEF review' });
    await user.type(within(within(card).getByRole('region', { name: 'DEF Mark, Mon Oct 12' })).getByLabelText('Price'), '33.10');
    await showPanel(user, card, 'Action');

    await user.click(within(card).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(facade.DailyReview.save).toHaveBeenCalledTimes(1));
    expect((await screen.findByRole('status')).textContent).toContain('Save or discard what you entered for DEF');
    expect(screen.getByRole('region', { name: 'DEF review' })).toBe(card);
    expect(screen.queryByRole('region', { name: 'XYZ review' })).toBeNull();
    await showPanel(user, card, 'Marks');
    expect(within(within(card).getByRole('region', { name: 'DEF Mark, Mon Oct 12' })).getByLabelText<HTMLInputElement>('Price').value).toBe('33.10');
  });
});
