// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, IncompleteReason, MarkResolution, MarkRow, MeterReading, OpenDailyReviewResult, OwedReflection, OwedReflectionsCard, OwedReflectionsTrade, ReviewBinding, ReviewCompletion, WalkedTrade } from '../../app/types.ts';
import { exitFormFacade, reflectionDefinition } from '../../../tests/support/position-change-form-facade.ts';
import type { IncoherentFact } from '../../domain/calculation-result/index.ts';
import { closedExitResult } from '../../../tests/support/exit-result-fixtures.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';
import { cardProgress, reflectionsOwedProgress } from '../../../tests/support/card-progress.ts';
import { dayOf } from '../../../tests/support/review-day.ts';

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
  instrument: { kind: 'Stock', symbol: instrumentKey },
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
  basis: { kind: 'Value', value: { side: 'None', share: rational(0n) } },
  progress: cardProgress(),
  ...over,
});
// The meter readings the Review gives: T-A between its rails, T-B past the Stop, T-C with no Mark.
const meterOf = (now: MeterReading['now'], stop: bigint, target: bigint): MeterReading => ({ stop: value(stop), target: value(target), banked: value(0n), now });
const TB = trade('t-b', 'ABC', {
  band: 'StopReached',
  meter: meterOf({ kind: 'Value', value: { pnl: rational(-200n), zone: 'PastStop', pastBy: { dollars: rational(50n) } as never } }, -150n, 300n),
  reasons: [{ code: 'StopBreached', conditionId: 'c', overrun: rational(1n) }],
  figures: { riskToStop: value(0n), pnl: value(-200n), rewardRiskNow: { kind: 'NotApplicable' } as never },
});
const TC = trade('t-c', 'DEF', {
  band: 'EvidenceLimited',
  meter: meterOf({ kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'DEF' }, date: '2026-10-12' }, -200n, 400n),
  reasons: [{ code: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'DEF' }, date: '2026-10-12' }],
  progress: cardProgress(0, 0, { needed: 1, resolved: 0 }),
});
const TF = trade('t-f', 'XYZ', {
  band: 'QuantifiedPressure',
  reasons: [{ code: 'PressureTowardTarget' }],
  figures: { riskToStop: value(200n), pnl: value(100n), rewardRiskNow: value(3n, 4n) },
});
const TA = trade('t-a', 'XYZ', {
  band: 'QuantifiedPressure',
  reasons: [{ code: 'PressureTowardTarget' }],
  basis: { kind: 'Value', value: { side: 'Winning', share: rational(2n, 5n), atEntry: rational(450n), now: rational(270n) } },
  progress: cardProgress(1, 1),
  meter: meterOf({ kind: 'Value', value: { pnl: rational(180n), zone: 'Between', share: { fraction: rational(2n, 5n), percent: rational(40n), toward: 'Target' } } }, -450n, 450n),
  figures: { riskToStop: value(450n), pnl: value(180n), rewardRiskNow: value(8n, 9n) },
});
const TE = trade('t-e', 'JKL', {
  figures: { riskToStop: value(200n), pnl: value(-100n), rewardRiskNow: value(9n, 2n) },
});
const WALK = [TB, TC, TF, TA, TE] as const;

const incomplete = (...reasons: IncompleteReason[]): ReviewCompletion => ({ kind: 'Incomplete', reasons });
const actionMissing = (...ids: string[]): IncompleteReason[] => ids.map((tradeId) => ({ code: 'ActionMissing', tradeId }));
const MONDAY_COMPLETION = incomplete(
  { code: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'DEF' }, tradingDate: '2026-10-12', trades: ['t-c'] },
  { code: 'ReflectionDue', tradeId: 't-a', debtIds: ['d1'] },
  ...actionMissing('t-b', 't-c', 't-f', 't-a', 't-e'),
);

function review(over: Partial<Ready> = {}): Ready {
  const built: Ready = {
    kind: 'Ready',
    reviewDate: '2026-10-12',
    cutoff: CUTOFF,
    families: [
      // ABC's Mark of the session before is the one a per-row correction fixes: a Mark of the Review Date is fixed in place (T95.14).
      { family: 'Marks', earlierMarks: [{ instrumentKey: 'ABC', instrument: { kind: 'Stock', symbol: 'ABC' }, trades: [{ tradeId: 't-b', from: '2026-10-09' }], marks: { '2026-10-09': { resolution: { kind: 'Available', mark: { revisionId: 'f1', revisionNumber: 1, price: '27.00', source: 'Manual', savedAt: '2026-10-09T21:00:00Z' } }, resolutionRevision: 1 } } }], previousSession: '2026-10-09', today: [markRow('ABC', ['t-b'], available('27.50')), markRow('DEF', ['t-c']), markRow('XYZ', ['t-f', 't-a'], available('52.00')), markRow('JKL', ['t-e'], available('21.00'))], earlier: [] },
      { family: 'Trades', trades: WALK },
    ],
    owed: [],
    completion: MONDAY_COMPLETION,
    binding,
    ...over,
  };
  return over.day ? built : { ...built, day: dayOf(built) };
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
    lifecycle: 'Open',
    attention: walked,
    labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' },
    evaluation: {
      kind: 'Evaluated',
      conditions: [],
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
      maximumIncrementalReward: { kind: 'Unbounded', direction: 'Above' },
      realizedToDate: value(0n),
      remainingOpenPnl: value(582n),
      planBaseline: { kind: 'Value' as const, value: { rewardRiskRatio: Rational.of(12n, 5n) } },
      atEntry: null,
    } as unknown as DailyTradeReview['evaluation'],
    settlement: [],
    reflections: [],
    progress: walked.progress,
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

// The Review with one walked Trade's Marks in, so its card offers the Action (the Action waits for the Trade's Marks).
const withMarksIn = (overview: Ready, tradeId: string): Ready => ({
  ...overview,
  families: overview.families.map((f) => (f.family === 'Trades' ? { ...f, trades: f.trades.map((t) => (t.tradeId === tradeId ? { ...t, progress: cardProgress(0, 0, { resolved: 0 }) } : t)) } : f)),
});

// A test-only control: a button that navigates the router to the address, as a history change would.
function NavigateTo({ to }: { readonly to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => void navigate(to)}>
      {`Navigate ${to}`}
    </button>
  );
}

function renderReview(facade: UiFacade, options: { writable?: boolean; onDirtyChange?: (dirty: boolean) => void; onMarkDraftsChange?: (held: boolean) => void; at?: string; navigateTo?: string } = {}) {
  render(
    <RuntimeContext.Provider value={{ writable: options.writable ?? true, timeZone: 'America/New_York', report: () => undefined }}>
      <MemoryRouter initialEntries={[options.at ?? '/review']}>
        {options.navigateTo !== undefined && <NavigateTo to={options.navigateTo} />}
        <ReviewView facade={facade} now={() => '2026-10-12T21:00:00Z'} onDirtyChange={options.onDirtyChange ?? (() => undefined)} onMarkDraftsChange={options.onMarkDraftsChange} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

// The collapsed header of each card, in list order.
const headers = () => screen.getAllByRole('button', { name: /^Review / });

// What MarketData.save answers to a correction of ABC's Mark, the per-row save that refreshes the Review.
const correctedAbc = {
  kind: 'Saved',
  key: { instrumentKey: 'ABC', tradingDate: '2026-10-09' },
  resolution: available('28.00'),
  resolutionRevision: 2,
  classification: 'Correction',
  revision: { revisionId: 'r2', revisionNumber: 2, price: '28.00', source: 'Manual', intention: 'Correction', observedAt: CUTOFF, savedAt: CUTOFF },
  binding: { instrumentKey: 'ABC', tradingDate: '2026-10-09', expectedResolutionRevision: 1 },
} as never;
// Opens a panel of the card by its header, unless it is already open (A152).
async function showPanel(user: ReturnType<typeof userEvent.setup>, card: HTMLElement, name: 'Marks' | 'Reflections' | 'Action') {
  // The Marks are the page's Marks step, not a panel of a card: there is nothing to open.
  if (name === 'Marks') return;
  const header = within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) });
  if (header.getAttribute('aria-expanded') !== 'true') await user.click(header);
}
// The Marks step: the page's one grid, whichever card is open.
const marksStep = () => screen.getByRole('region', { name: /^Marks for / });
// A cell of the Marks grid by its name: its input while it is Missing, else its button (A161: a link focuses it).
const cellNamed = (_card: HTMLElement, name: string) => within(marksStep()).queryByRole('textbox', { name }) ?? within(marksStep()).getByRole('button', { name });
// Choosing a cell (focusing its input, or pressing its button) opens its editor, a region named after it.
async function chooseCell(user: ReturnType<typeof userEvent.setup>, _card: HTMLElement, name: string) {
  await user.click(within(marksStep()).queryByRole('textbox', { name }) ?? within(marksStep()).getByRole('button', { name }));
  return within(marksStep()).getByRole('region', { name });
}
// Corrects the card's ABC Mark and saves it.
async function correctAbc(user: ReturnType<typeof userEvent.setup>, card: HTMLElement) {
  await showPanel(user, card, 'Marks');
  const entry = await chooseCell(user, card, 'ABC Mark, Fri Oct 9');
  await user.click(within(entry).getByRole('button', { name: 'Correct' }));
  await user.type(within(entry).getByLabelText('Price'), '28.00');
  await user.type(within(entry).getByLabelText('Reason (required)'), 'typo');
  await user.click(within(entry).getByRole('button', { name: 'Save correction' }));
}

describe('plain labels on the page (A302)', () => {
  it('should show none of the five band names', async () => {
    renderReview(cardFacade());
    await screen.findAllByRole('button', { name: /^Review / });
    for (const name of ['Blocker', 'Boundary reached', 'Evidence limited', 'Quantified pressure', 'Routine']) expect(document.body.textContent).not.toContain(name);
  });

  it('should keep each label reason as its accessible description', async () => {
    renderReview(cardFacade());
    await screen.findAllByRole('button', { name: /^Review / });
    // A button's description comes from its own aria-describedby, not from its descendants'.
    const described = (label: string) => {
      const button = headers().find((h) => h.textContent?.includes(label))!;
      return (button.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent).join(' ');
    };
    expect(described('Marks needed')).toBe('Mark missing for DEF on Mon Oct 12');
    expect(described('Past Stop')).toBe('Stop breached');
    expect(headers().find((h) => h.textContent?.includes('Past Stop'))!.textContent).not.toContain('Stop breached');
  });
});

describe('card list (A150)', () => {
  it('should render one card per walked Trade in attention order, each a heading button showing the Underlying, what remains, its band as text, and its meter, with no Stop Target legend and no Continue to Trades', async () => {
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
    expect(head(bCard)).toContain('Review ABC To do: Action');
    expect(head(cCard)).toContain('To do: Mark, Action');
    expect(head(aCard)).toContain('To do: Reflection, Action');
    // The plain label.
    expect(head(bCard)).toContain('Past Stop');
    expect(head(cCard)).toContain('Marks needed');
    expect(head(aCard)).toContain('40% to Target');
    // The meter, named by its figures: one between its rails, one past the Stop, and the one with no Mark by its reason.
    expect(a.getByRole('img', { name: 'P&L +$180.00, 40% of the way to the Target. Stop −$450.00, Target +$450.00.' })).toBeTruthy();
    // ABC is the open card: its meter is the "Now" box's, not the header's (U3, T95.17).
    // The open card's body loads after its header (getTrade), so wait for it.
    const drawing = await b.findByRole('img', { name: 'P&L −$200.00, past the Stop by $50.00. Stop −$150.00, Target +$300.00.' });
    expect(drawing.closest('.review-card-head')).toBeNull();
    expect(drawing.closest('.now-draw')).not.toBeNull();
    expect(c.getByRole('img', { name: 'Mark missing: DEF, Mon Oct 12 Stop −$200.00, Target +$400.00.' })).toBeTruthy();
    // There is no legend line and no Continue to Trades.
    expect(screen.queryByText(/Stop ◂ ▸ Target/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue to Trades' })).toBeNull();
  });

});

describe('the collapsed card header (T95.16, W101)', () => {
  it('should show, collapsed: the Trade, what is held, its label, Trade P&L in dollars and R with the day change, the shared meter, and what it needs or Done · Hold', async () => {
    const walk = [
      TB,
      TC,
      TF,
      {
        ...TA,
        summary: { kind: 'Stock' as const, direction: 'Long' as const, quantity: rational(50n), price: rational(61n) },
        pnl: { dollars: value(180n), planR: value(2n, 5n), change: { kind: 'Value' as const, dollars: rational(-30n) } },
      },
      { ...TE, progress: cardProgress(0, 0, { owed: false }) },
    ];
    const base = review({ families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: walk }], completion: incomplete(...actionMissing('t-b', 't-c', 't-f', 't-a')) });
    // The Action saved for JKL on the Review Date comes on its day line.
    const day = { ...base.day!, lines: base.day!.lines.map((line) => (line.tradeId === 't-e' ? { ...line, action: 'Hold' } : line)) };
    renderReview(cardFacade({ ...base, day }));
    await screen.findAllByRole('button', { name: /^Review / });

    const a = headers().find((h) => h.textContent?.includes('40% to Target'))!;
    // Not the open card: the first card is.
    expect(a.getAttribute('aria-expanded')).toBe('false');
    expect(a.querySelector('.review-card-name')!.textContent).toBe('XYZ');
    expect(a.querySelector('.review-card-summary')!.textContent).toBe('Long 50 shares @ $61.00');
    expect(a.textContent).toContain('40% to Target');
    expect(a.textContent).toContain('+$180.00 · +0.40R');
    expect(a.textContent).toContain('−$30.00 today');
    expect(a.textContent).toContain('To do: Reflection, Action');
    expect(within(a.closest('li')!).getByRole('img', { name: 'P&L +$180.00, 40% of the way to the Target. Stop −$450.00, Target +$450.00.' })).toBeTruthy();
    expect(headers().find((h) => h.textContent?.includes('JKL'))!.textContent).toContain('Done · Hold');
  });
});

describe('the open card header (T95.16, U3)', () => {
  it('should show no meter in the open card header', async () => {
    renderReview(cardFacade());
    const open = (await screen.findByRole('region', { name: 'ABC review' })).closest('li')!;

    // ABC is open and past its Stop: its header draws no meter (its drawing is the "Now" box's, T95.17). A collapsed card keeps its own.
    expect(open.querySelector('.review-card-head')!.querySelector('[role="img"]')).toBeNull();
    const collapsed = headers().find((h) => h.textContent?.includes('40% to Target'))!.closest('li')!;
    expect(within(collapsed).getByRole('img', { name: /^P&L \+\$180\.00/ })).toBeTruthy();
  });
});

describe('the Plan box in the open card (T95.16, U2)', () => {
  it('should show no Plan box value a second time in the open card', async () => {
    const facade = cardFacade();
    // The Plan: 100 shares at $50.00, 1R $700.00, reward $1,500.00; the card's At entry figures are those same two amounts.
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ tradeId }) => {
      const found = [TB, TC, TF, TA, TE].find((t) => t.tradeId === tradeId)!;
      const base = tradeReview(found);
      const evaluation = { ...base.evaluation, atEntry: { label: 'AtEntry', quantity: rational(100n), averageEntry: rational(50n), riskFromEntry: rational(700n), rewardFromEntry: rational(1500n) } } as unknown as DailyTradeReview['evaluation'];
      const replay = { planColumn: { atStop: rational(-700n), atTarget: rational(1500n), rewardRisk: rational(15n, 7n), terms: { legs: [{ instrument: { kind: 'Stock', symbol: 'ABC' }, side: 'Long', quantity: rational(100n), entryPrice: rational(50n) }], conditions: [] } }, sessions: [] } as unknown as DailyTradeReview['replay'];
      return Promise.resolve({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: CUTOFF, trade: { ...base, evaluation, replay, plan: { thesis: 'Earnings are priced in.', invalidation: 'A close under the 200-day line.' } } });
    });
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });

    expect(within(card).getByRole('region', { name: 'Plan' })).toBeTruthy();
    // Entry, Risk, Reward, the Thesis and "No longer valid if" each stand once in the open card.
    for (const text of ['100 shares at $50.00', '$700.00 (1R)', '$1,500.00', 'Earnings are priced in.', 'A close under the 200-day line.']) {
      expect(within(card).getAllByText(text), text).toHaveLength(1);
    }
    expect(within(card).queryByText('$700.00'), 'Risk to stop at entry').toBeNull();
    expect(within(card).queryByText('Risk to stop'), 'At entry group').toBeNull();
  });
});

describe('the Stop and Target prices and the Trade P&L once in the open card (T95.16 case 5, T95.17)', () => {
  it('should show the Stop and Target prices once, in the Plan box, and no Trade P&L in the open card body', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ tradeId }) => {
      const found = [TB, TC, TF, TA, TE].find((t) => t.tradeId === tradeId)!;
      const base = tradeReview(found);
      const leg = { instrument: { kind: 'Stock', symbol: 'ABC' }, side: 'Long', quantity: rational(100n), entryPrice: rational(50n) };
      const conditions = [
        { role: 'Stop', priceOf: 'Underlying', price: rational(47n), pnlIfHit: rational(-300n) },
        { role: 'Target', priceOf: 'Underlying', price: rational(56n), pnlIfHit: rational(600n) },
      ];
      const replay = { planColumn: { atStop: rational(-300n), atTarget: rational(600n), rewardRisk: rational(2n), terms: { legs: [leg], conditions } }, sessions: [] } as unknown as DailyTradeReview['replay'];
      return Promise.resolve({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: CUTOFF, trade: { ...base, replay } });
    });
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });

    expect(within(card).getAllByText('ABC at or below $47.00')).toHaveLength(1);
    expect(within(card).getAllByText('ABC at or above $56.00')).toHaveLength(1);
    expect(within(card).queryByText('Trade P&L')).toBeNull();
    expect(within(card).queryByText('Current Risk · At Stop')).toBeNull();
  });
});

describe('the Plan box and At entry group when fills differ from the Plan (T95.16-B2)', () => {
  it('should keep the At entry Risk and Reward when the fills differ from the Plan box figures', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ tradeId }) => {
      const found = [TB, TC, TF, TA, TE].find((t) => t.tradeId === tradeId)!;
      const base = tradeReview(found);
      // The Plan says risk $700.00 and reward $1,500.00; the fills measured from the Stop and Target are $650.00 and $1,420.00.
      const evaluation = { ...base.evaluation, atEntry: { label: 'AtEntry', quantity: rational(100n), averageEntry: rational(49n), riskFromEntry: rational(650n), rewardFromEntry: rational(1420n) } } as unknown as DailyTradeReview['evaluation'];
      const replay = { planColumn: { atStop: rational(-700n), atTarget: rational(1500n), rewardRisk: rational(15n, 7n), terms: { legs: [{ instrument: { kind: 'Stock', symbol: 'ABC' }, side: 'Long', quantity: rational(100n), entryPrice: rational(50n) }], conditions: [] } }, sessions: [] } as unknown as DailyTradeReview['replay'];
      return Promise.resolve({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: CUTOFF, trade: { ...base, evaluation, replay, plan: { thesis: 'Earnings are priced in.', invalidation: 'A close under the 200-day line.' } } });
    });
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });

    expect(within(card).getByRole('region', { name: 'Plan' })).toBeTruthy();
    expect(within(card).getByText('At entry')).toBeTruthy();
    expect(within(card).getByText('$650.00')).toBeTruthy();
    expect(within(card).getByText('$1,420.00')).toBeTruthy();
  });
});

describe('the header owes a Close Review (T95.16-B1)', () => {
  it('should read To do: Close Review in the header when the day card line says Close Review', async () => {
    const built = review();
    const lines = built.day!.lines.map((line) => (line.tradeId === 't-a' ? { ...line, closeReview: true, needs: ['Reflection' as const] } : line));
    renderReview(cardFacade({ ...built, day: { ...built.day!, lines } }));
    await screen.findAllByRole('button', { name: /^Review / });

    const header = headers().find((h) => h.closest('li')?.getAttribute('data-trade-id') === 't-a')!;
    expect(header.textContent).toContain('To do: Close Review');
    expect(header.textContent).not.toContain('Reflection');
  });
});

describe('the header owes a reason (T95.42, W155)', () => {
  it('should read To do: Say why in the header when the day card line says Say why', async () => {
    const built = review();
    const lines = built.day!.lines.map((line) => (line.tradeId === 't-a' ? { ...line, needs: ['SayWhy' as const, 'Action' as const] } : line));
    renderReview(cardFacade({ ...built, day: { ...built.day!, lines } }));
    await screen.findAllByRole('button', { name: /^Review / });

    const header = headers().find((h) => h.closest('li')?.getAttribute('data-trade-id') === 't-a')!;
    expect(header.textContent).toContain('To do: Say why, Action');
    expect(header.textContent).not.toContain('Reflection');
  });
});

describe('opening and closing a card from the day card (T95.16)', () => {
  it('should open the card the day card link names, and close it on a second press', async () => {
    const user = userEvent.setup();
    renderReview(cardFacade());
    await screen.findByRole('region', { name: 'ABC review' });
    const link = within(within(screen.getByRole('region', { name: 'The day' })).getByRole('list', { name: 'Trade lines' })).getByRole('link', { name: 'JKL' });

    await user.click(link);

    const header = headers().find((h) => h.textContent?.includes('JKL'))!;
    await screen.findByRole('region', { name: 'JKL review' });
    expect(header.getAttribute('aria-expanded')).toBe('true');
    // The card the line named replaces the one open before it.
    expect(screen.queryByRole('region', { name: 'ABC review' })).toBeNull();

    await user.click(header);

    expect(screen.queryByRole('region', { name: 'JKL review' })).toBeNull();
    expect(header.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('card header from progress (A169)', () => {
  it('should read To do: 2 Marks, Reflection, Action for progress with 2 Marks needed, 1 reflection due now and the Action owed, and Done for a done card, with no other input to the header', async () => {
    // The completion reasons disagree with the progress on purpose: they name an Action for T-E and no Marks or reflection for T-C.
    // T-C owes 2 Marks and a reflection by its progress; T-E owes nothing by its progress.
    const walk = [TB, { ...TC, progress: cardProgress(1, 0, { needed: 2 }) }, TF, TA, { ...TE, progress: cardProgress(0, 0, { owed: false }) }];
    renderReview(cardFacade(review({ families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: walk }], completion: incomplete(...actionMissing('t-b', 't-c', 't-f', 't-a', 't-e')) })));
    await screen.findAllByRole('button', { name: /^Review / });

    const def = headers().find((h) => h.textContent?.includes('DEF'))!;
    expect(def.textContent).toContain('To do: 2 Marks, Reflection, Action');
    const jkl = headers().find((h) => h.textContent?.includes('JKL'))!;
    expect(jkl.textContent).toContain('Done');
    // The card keeps its place, and the others are not Done.
    expect(headers().indexOf(jkl)).toBe(4);
    for (const other of headers().filter((h) => h !== jkl)) expect(other.textContent).not.toContain('Done');
  });

  it('should open on load the first card whose progress is not done', async () => {
    // The first two cards are done by their progress, though the completion reasons name an Action for T-B; T-F is the first not done.
    const walk = [{ ...TB, progress: cardProgress(0, 0, { owed: false }) }, { ...TC, progress: cardProgress(0, 0, { owed: false }) }, TF, TA, TE];
    const facade = cardFacade(review({ families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: walk }], completion: incomplete(...actionMissing('t-b')) }));
    renderReview(facade);
    await screen.findByRole('region', { name: 'XYZ review' });

    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);
    expect(vi.mocked(facade.DailyReview.getTrade).mock.calls[0]![0]).toMatchObject({ tradeId: 't-f' });
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true', 'false', 'false']);
  });
});

describe('card identity (decision 68)', () => {
  it("should put each card's Trade id on its list item as data-trade-id, in attention order (t-b, t-c, t-f, t-a, t-e)", async () => {
    renderReview(cardFacade());
    await screen.findAllByRole('button', { name: /^Review / });

    expect(headers().map((h) => h.closest('li')!.getAttribute('data-trade-id'))).toEqual(['t-b', 't-c', 't-f', 't-a', 't-e']);
  });

  it("should show the Trade's summary line after the Underlying in the card header, in its own span, and the Underlying alone for a Trade with no summary", async () => {
    const summarised = [
      TB,
      TC,
      { ...TF, summary: { kind: 'Stock' as const, direction: 'Long' as const, quantity: rational(100n), price: rational(5018n, 100n) } },
      { ...TA, summary: { kind: 'Stock' as const, direction: 'Long' as const, quantity: rational(50n), price: rational(61n) } },
      TE,
    ];
    renderReview(cardFacade(review({ families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: summarised }] })));
    await screen.findAllByRole('button', { name: /^Review / });

    const [b, , f, a] = headers() as [HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    // The summary line follows the Underlying, which stays alone in its own span.
    expect(f.querySelector('.review-card-name')!.textContent).toBe('XYZ');
    expect(f.querySelector('.review-card-summary')!.textContent).toBe('Long 100 shares @ $50.18');
    expect(a.querySelector('.review-card-summary')!.textContent).toBe('Long 50 shares @ $61.00');
    expect(f.querySelector('.review-card-name')!.nextElementSibling).toBe(f.querySelector('.review-card-summary'));
    expect(f.getAttribute('aria-label') ?? f.textContent).toMatch(/^Review XYZ Long 100 shares @ \$50\.18 /);
    // A Trade with no summary shows its Underlying alone.
    expect(b.querySelector('.review-card-summary')).toBeNull();
    expect(b.textContent).toMatch(/^Review ABC To do: Action/);
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
    // Its figures and panels: Reflections and the Action, which is the first not done. The Marks are the page's.
    expect(within(card).getByRole('heading', { name: 'Now · Mon Oct 12' })).toBeTruthy();
    expect((['Reflections', 'Action'] as const).map((name) => within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) }).getAttribute('aria-expanded'))).toEqual(['false', 'true']);
    expect(within(card).queryByRole('button', { name: /^Marks\b/ })).toBeNull();
    expect(within(card).getByRole('form', { name: 'Action' })).toBeTruthy();

    // With every card Done, none opens and nothing is read.
    cleanup();
    const everyCardDone = WALK.map((t) => ({ ...t, progress: cardProgress(0, 0, { owed: false }) }));
    const done = cardFacade(review({ completion: { kind: 'Complete' }, families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: everyCardDone }] }));
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
    // The refreshed Review's DEF card has its Mark: its progress no longer needs one.
    const walked = [TB, { ...TC, progress: cardProgress() }, TF, TA, TE];
    const afterMark = review({ binding: moved, completion: incomplete(...actionMissing('t-b', 't-c', 't-f', 't-a', 't-e')), families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: walked }] });
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(review()).mockResolvedValue(afterMark);
    vi.mocked(facade.MarketData.save).mockResolvedValue(correctedAbc);
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });
    // DEF's card still owes its Mark.
    expect(headers()[1]!.textContent).toContain('To do: Mark, Action');

    await correctAbc(user, card);

    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(2));
    expect(vi.mocked(facade.DailyReview.getTrade).mock.calls[1]![0]).toMatchObject({ tradeId: 't-b', binding: moved });
    // The cards' summaries follow the refreshed Review, and the card stays open.
    expect(headers()[1]!.textContent).not.toContain('Mark ·');
    expect(headers()[0]!.getAttribute('aria-expanded')).toBe('true');
  });

  // T6.20-B3, items 1 and 2: a saved Mark removes its Trade from the walk. Only what is still unsaved was lost.
  const withoutB = () => review({ completion: incomplete(...actionMissing('t-c', 't-f', 't-a', 't-e')), families: [{ family: 'Marks', earlierMarks: [], today: [], earlier: [] }, { family: 'Trades', trades: [TC, TF, TA, TE] }] });
  const NOT_KEPT = /is no longer in this Review, so what you entered for it was not kept\./;

  it('should not say a Mark was not kept when the Mark just saved is all the removed card held', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(review()).mockResolvedValue(withoutB());
    vi.mocked(facade.MarketData.save).mockResolvedValue(correctedAbc);
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });

    await correctAbc(user, card);

    await waitFor(() => expect(screen.queryByRole('region', { name: 'ABC review' })).toBeNull());
    expect(screen.queryByText(NOT_KEPT)).toBeNull();
  });

  it('should say what was not kept when a Mark is saved on a card that also held an unsaved Action edit, and the refresh removes the card', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(review()).mockResolvedValue(withoutB());
    vi.mocked(facade.MarketData.save).mockResolvedValue(correctedAbc);
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });
    await showPanel(user, card, 'Action');
    await user.click(within(within(card).getByRole('form', { name: 'Action' })).getByRole('radio', { name: 'Exit' }));

    await correctAbc(user, card);

    expect((await screen.findByRole('status')).textContent).toMatch(NOT_KEPT);
    expect(screen.queryByRole('region', { name: 'ABC review' })).toBeNull();
  });
});

describe('card order follows the newest Review (A150, decision 64)', () => {
  it('should re-sort the cards when a refreshed Review returns the Trades in a different order', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    const reordered = review({
      families: [
        { family: 'Marks', earlierMarks: [], today: [], earlier: [] },
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
    // The two XYZ cards read alike, so their Trade ids show that T-A and T-F swapped too.
    expect(headers().map((h) => h.closest('li')!.getAttribute('data-trade-id'))).toEqual(['t-e', 't-a', 't-f', 't-c', 't-b']);
  });

  it('should keep the open card open, with its entered values, when a refreshed Review moves it', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    const reordered = review({
      families: [
        { family: 'Marks', earlierMarks: [], today: [], earlier: [] },
        { family: 'Trades', trades: [...WALK].reverse() },
      ],
    });
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(review()).mockResolvedValue(reordered);
    vi.mocked(facade.MarketData.save).mockResolvedValue(correctedAbc);
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });
    // A value is entered in the card's Action form before the Mark is corrected.
    const field = within(card).getAllByRole('textbox').find((box) => !box.closest('[aria-label="ABC Mark, Fri Oct 9"]'))!;
    await user.type(field, 'kept');
    await showPanel(user, card, 'Marks');
    const entry = await chooseCell(user, card, 'ABC Mark, Fri Oct 9');
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
        { family: 'Marks', earlierMarks: [], today: [markRow('ABC', ['t-b'], available('27.50')), { ...markRow('DEF', ['t-c'], acknowledged), task: null }, markRow('JKL', ['t-e'], available('21.00'))], earlier: [] },
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
    await user.click(within(await chooseCell(user, card, 'DEF Mark, Mon Oct 12')).getByRole('button', { name: 'Withdraw' }));
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
    const save = () => within(screen.getByRole('region', { name: 'ABC review' })).getByRole<HTMLButtonElement>('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ });
    expect(save().disabled).toBe(true);
    settle(review({ binding: { ...binding, marketDataSnapshotId: 'mds1:2:def' } }));
    await waitFor(() => expect(save().disabled).toBe(false));
  });
});

describe('unsaved work (A156)', () => {
  const MESSAGE = "ABC's note isn't saved";

  it('should hold the page, not a card, while a Correct is in progress, and still hold the card while an Action, a Debt or a reflection form has entered values', async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    const facade = cardFacade();
    renderReview(facade, { onDirtyChange });
    const card = await screen.findByRole('region', { name: 'ABC review' });

    // A Correct in progress sits in the Marks step: it reports the page unsaved, and holds no card.
    const entry = await chooseCell(user, card, 'ABC Mark, Fri Oct 9');
    await user.click(within(entry).getByRole('button', { name: 'Correct' }));
    await user.type(within(entry).getByLabelText('Price'), '28.00');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    await user.click(headers()[2]!);
    expect(screen.queryByText(new RegExp(MESSAGE))).toBeNull();
    await waitFor(() => expect(headers()[2]!.getAttribute('aria-expanded')).toBe('true'));
    expect(within(marksStep()).getByLabelText<HTMLInputElement>('Price').value).toBe('28.00');

    // An entered Action value holds the card, as does a reflection form (ReviewCard.test.tsx, Leaving an unsaved reflection).
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

describe('leaving the page holds only Mark drafts (P156)', () => {
  it('should report no Mark draft held for an unsaved Action form, and report one while a Mark draft exists', async () => {
    const user = userEvent.setup();
    const onMarkDraftsChange = vi.fn();
    renderReview(cardFacade(withMarksIn(review(), 't-c')), { onMarkDraftsChange, at: '/review?trade=t-c' });
    const card = await screen.findByRole('region', { name: 'DEF review' });
    await showPanel(user, card, 'Action');
    await user.click(within(within(card).getByRole('form', { name: 'Action' })).getByRole('radio', { name: 'Exit' }));
    expect(onMarkDraftsChange).not.toHaveBeenCalledWith(true);
    await showPanel(user, card, 'Marks');
    await user.type(within(marksStep()).getByRole('textbox', { name: 'DEF Mark, Mon Oct 12' }), '33.10');
    await waitFor(() => expect(onMarkDraftsChange).toHaveBeenLastCalledWith(true));
  });
});

describe('read only (A162)', () => {
  it('should open cards and show their figures, Marks, reflections, and saved Action with no input, Save Marks, Answer, Decline, or Save when the shell is not Writable', async () => {
    const user = userEvent.setup();
    const reflection: OwedReflection = {
      debtId: 'd1',
      entryType: 'Position Change Reflection',
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
    expect(within(first).getByRole('heading', { name: 'Now · Mon Oct 12' })).toBeTruthy();
    expect(within(first).getByText('No Action saved.')).toBeTruthy();
    await showPanel(user, first, 'Marks');
    expect(within(marksStep()).getByRole('button', { name: 'ABC Mark, Mon Oct 12' }).textContent).toContain('$27.50');
    // The card with a reflection and a saved Action.
    await user.click(headers()[3]!);
    const card = await screen.findByRole('region', { name: 'XYZ review' });
    await showPanel(user, card, 'Action');
    expect(within(card).getByText(/^Mon Oct 12: Hold/)).toBeTruthy();
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
  it('should focus the Review Date cell of the Instrument in the Marks step for /review?instrument=XYZ, and open no card for it', async () => {
    const facade = cardFacade();
    renderReview(facade, { at: '/review?instrument=XYZ' });
    const card = await screen.findByRole('region', { name: 'ABC review' });

    // The Marks are the page's: the card that opens on load is still the first not done, and the link reads no other.
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);
    expect(vi.mocked(facade.DailyReview.getTrade).mock.calls[0]![0]).toMatchObject({ tradeId: 't-b' });
    // Focus lands in a passive effect after the commit that shows the step, so the test waits for it.
    await waitFor(() => expect(document.activeElement).toBe(cellNamed(card, 'XYZ Mark, Mon Oct 12')));
  });

  it('should open T-E card on its first panel that is not done for /review?trade=t-e', async () => {
    const facade = cardFacade();
    renderReview(facade, { at: '/review?trade=t-e' });
    const card = await screen.findByRole('region', { name: 'JKL review' });

    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'false', 'true']);
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);
    expect(vi.mocked(facade.DailyReview.getTrade).mock.calls[0]![0]).toMatchObject({ tradeId: 't-e' });
    // No reflection is due, so the Action is the first panel not done.
    expect((['Reflections', 'Action'] as const).map((name) => within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) }).getAttribute('aria-expanded'))).toEqual(['false', 'true']);
  });

  it('should focus the Instrument cell when both a trade and an instrument are given, the Marks being the pages', async () => {
    const facade = cardFacade();
    renderReview(facade, { at: '/review?trade=t-a&instrument=XYZ' });
    const card = await screen.findByRole('region', { name: 'ABC review' });

    // T-A and T-F both hold XYZ; the page has the one row, and no card is picked for it.
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    await waitFor(() => expect(document.activeElement).toBe(cellNamed(card, 'XYZ Mark, Mon Oct 12')));
  });

  const panelStates = (card: HTMLElement) => (['Reflections', 'Action'] as const).map((name) => within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) }).getAttribute('aria-expanded'));

  it('should send panel=Marks to the Marks step and open no card panel for it', async () => {
    renderReview(cardFacade(), { at: '/review?trade=t-e&panel=Marks' });
    const step = await screen.findByRole('region', { name: /^Marks for / });

    // The Marks panel left the card: the link goes to the step, which takes focus in its first price.
    await waitFor(() => expect(step.contains(document.activeElement)).toBe(true));
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false']);
  });

  it('should open the panel that the panel param names, not the first panel that is not done', async () => {
    renderReview(cardFacade(), { at: '/review?trade=t-e&panel=Reflections' });
    const card = await screen.findByRole('region', { name: 'JKL review' });

    // T-E's Action is its first panel not done; the link names Reflections.
    expect(panelStates(card)).toEqual(['true', 'false']);
  });

  it('should ignore a panel param that names no panel', async () => {
    renderReview(cardFacade(), { at: '/review?trade=t-e&panel=Nonsense' });
    const card = await screen.findByRole('region', { name: 'JKL review' });

    expect(panelStates(card)).toEqual(['false', 'true']);
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
    expect((['Reflections', 'Action'] as const).map((name) => within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) }).getAttribute('aria-expanded'))).toEqual(['false', 'true']);
  });

  it('should keep the held card open and say to save or discard what was entered when a changed param names another card', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    renderReview(facade, { navigateTo: '/review?trade=t-e' });
    const card = await screen.findByRole('region', { name: 'ABC review' });
    await user.click(within(within(card).getByRole('form', { name: 'Action' })).getByRole('radio', { name: 'Exit' }));

    await user.click(screen.getByRole('button', { name: 'Navigate /review?trade=t-e' }));

    expect(await screen.findByText("ABC's note isn't saved.")).toBeTruthy();
    expect(screen.getByRole('region', { name: 'ABC review' })).toBe(card);
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1);
  });

  it('should switch to the panel that a changed param names on the held open card', async () => {
    const user = userEvent.setup();
    renderReview(cardFacade(), { navigateTo: '/review?trade=t-b&panel=Reflections' });
    const card = await screen.findByRole('region', { name: 'ABC review' });
    await user.click(within(within(card).getByRole('form', { name: 'Action' })).getByRole('radio', { name: 'Exit' }));
    const states = () => (['Reflections', 'Action'] as const).map((name) => within(card).getByRole('button', { name: new RegExp(`^${name}\\b`) }).getAttribute('aria-expanded'));
    expect(states()).toEqual(['false', 'true']);

    await user.click(screen.getByRole('button', { name: 'Navigate /review?trade=t-b&panel=Reflections' }));

    await waitFor(() => expect(states()).toEqual(['true', 'false']));
    expect(screen.getByRole('region', { name: 'ABC review' })).toBe(card);
  });
});

describe('day line links open in a new tab (A161)', () => {
  const lineLink = (name: string, index = 0) => within(within(screen.getByRole('region', { name: 'The day' })).getByRole('list', { name: 'Trade lines' })).getAllByRole('link', { name })[index]!;

  it('should give a Trade with a Mark to go the Instrument in its href, and one with an Action or a reflection to go the Trade and its panel', async () => {
    renderReview(cardFacade());
    await screen.findByRole('region', { name: 'ABC review' });

    expect(lineLink('DEF').getAttribute('href')).toBe('/review?trade=t-c&instrument=DEF');
    expect(lineLink('ABC').getAttribute('href')).toBe('/review?trade=t-b&panel=Action');
    expect(lineLink('XYZ', 1).getAttribute('href')).toBe('/review?trade=t-a&panel=Reflections');
  });

  it.each([
    ['ctrlKey', { ctrlKey: true }],
    ['metaKey', { metaKey: true }],
    ['shiftKey', { shiftKey: true }],
    ['middle button', { button: 1 }],
  ])('should leave a click with %s to the browser, with the open card unchanged', async (_name, modifier) => {
    renderReview(cardFacade());
    await screen.findByRole('region', { name: 'ABC review' });
    const link = lineLink('DEF');

    // fireEvent answers false when a handler called preventDefault.
    expect(fireEvent.click(link, modifier)).toBe(true);
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false']);
  });

  it('should still open the card in place for a plain left click, and the Marks step for a Mark to go', async () => {
    renderReview(cardFacade());
    await screen.findByRole('region', { name: 'ABC review' });

    // DEF's line needs a Mark first: its click goes to the Marks step, whose cell takes the focus.
    expect(fireEvent.click(lineLink('DEF'))).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(cellNamed(document.body, 'DEF Mark, Mon Oct 12')));
    // XYZ's line needs a reflection: its card opens in place.
    expect(fireEvent.click(lineLink('XYZ', 1))).toBe(false);
    await screen.findByRole('region', { name: 'XYZ review' });
  });
});

describe('header', () => {
  it('should show the Review Date, completion as text, the counts and each Trade line, each opening the card and panel that resolve it', async () => {
    const user = userEvent.setup();
    renderReview(cardFacade());
    const status = await screen.findByRole('region', { name: 'The day' });

    expect(within(status).getByText('Mon Oct 12')).toBeTruthy();
    expect(within(status).getByText('Incomplete')).toBeTruthy();
    expect(within(status).getByText('5 Trades · 1 Mark, 5 Actions and 1 reflection to go')).toBeTruthy();
    const lines = within(within(status).getByRole('list', { name: 'Trade lines' })).getAllByRole('listitem');
    expect(lines.map((line) => line.textContent)).toEqual([
      'ABC Past Stop To do: Action',
      'DEF Marks needed To do: Mark, Action',
      'XYZ To do: Action',
      'XYZ 40% to Target To do: Reflection, Action',
      'JKL To do: Action',
    ]);
    await screen.findByRole('region', { name: 'ABC review' });

    // The Mark goes to the Marks step, with focus on the cell.
    await user.click(within(lines[1]!).getByRole('link', { name: 'DEF' }));
    await waitFor(() => expect(document.activeElement).toBe(cellNamed(document.body, 'DEF Mark, Mon Oct 12')));
    // The reflection opens XYZ's card on its Reflections panel.
    await user.click(within(lines[3]!).getByRole('link', { name: 'XYZ' }));
    const xyz = await screen.findByRole('region', { name: 'XYZ review' });
    expect(within(xyz).getByRole('button', { name: /^Reflections\b/ }).getAttribute('aria-expanded')).toBe('true');
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'true', 'false']);
    // The Action opens ABC's card on its Action panel, from another panel.
    await user.click(within(lines[0]!).getByRole('link', { name: 'ABC' }));
    const abc = await screen.findByRole('region', { name: 'ABC review' });
    expect(within(abc).getByRole('button', { name: /^Action\b/ }).getAttribute('aria-expanded')).toBe('true');
  });
});

describe('the day card button', () => {
  it('should move focus to the Marks step, on the first Trade with a Mark to go, when Enter the Marks is pressed', async () => {
    const user = userEvent.setup();
    renderReview(cardFacade());
    await screen.findByRole('region', { name: 'ABC review' });

    await user.click(within(screen.getByRole('region', { name: 'The day' })).getByRole('button', { name: 'Enter the Marks' }));

    await waitFor(() => expect(document.activeElement).toBe(cellNamed(document.body, 'DEF Mark, Mon Oct 12')));
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

  it('should scroll the card top at the press and again once the body shows, for a plain header open', async () => {
    const scrollIntoView: Spy = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderReview(cardFacade());
    await screen.findByRole('region', { name: 'ABC review' });

    fireEvent.click(headers()[2]!);
    const card = await screen.findByRole('region', { name: 'XYZ review' });

    expect(document.activeElement).toBe(headers()[2]);
    await waitFor(() => expect(topScrolls(scrollIntoView, card.closest('li'))).toEqual([{ block: 'start' }, { block: 'start' }]));
  });
});

describe('Action save whose next step is a Mark (T5R.12-B3)', () => {
  const markStep = (trades: readonly string[]) => ({ kind: 'Mark', row: markRow('DEF', trades) }) as const;
  const postWith = (nextStep: ReturnType<typeof markStep>) => ({ kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 5 }, completion: MONDAY_COMPLETION, nextStep, binding }) as const;

  it('should collapse the saving card and take focus to the Missing Mark cell in the Marks step', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: {} as never, review: postWith(markStep(['t-c'])) });
    renderReview(facade);
    const abc = await screen.findByRole('region', { name: 'ABC review' });

    await user.click(within(abc).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    await waitFor(() => expect(screen.queryByRole('region', { name: 'ABC review' })).toBeNull());
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'false', 'false']);
    await waitFor(() => expect(document.activeElement).toBe(cellNamed(document.body, 'DEF Mark, Mon Oct 12')));
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('should keep a typed Mark and say nothing of saving or discarding after an Action save whose next step is a Mark', async () => {
    const user = userEvent.setup();
    const facade = cardFacade(withMarksIn(review(), 't-c'));
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: {} as never, review: postWith(markStep(['t-e'])) });
    renderReview(facade, { at: '/review?trade=t-c' });
    const card = await screen.findByRole('region', { name: 'DEF review' });
    await user.type(within(marksStep()).getByRole('textbox', { name: 'DEF Mark, Mon Oct 12' }), '33.10');
    await showPanel(user, card, 'Action');

    await user.click(within(card).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    // The Mark is next, so its cell takes the focus with the draft in it.
    await waitFor(() => expect(document.activeElement).toBe(cellNamed(document.body, 'DEF Mark, Mon Oct 12')));
    expect(screen.queryByText(/Save or discard what you entered/)).toBeNull();
    expect((document.activeElement as HTMLInputElement).value).toBe('33.10');
  });
});

describe('Action save while other forms hold values (A156)', () => {
  it('should open the next Trade card, keeping the entered Mark, when an Action save names another card as the next step and only Mark drafts exist', async () => {
    const user = userEvent.setup();
    const facade = cardFacade(withMarksIn(review(), 't-c'));
    const post = { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 5 }, completion: MONDAY_COMPLETION, nextStep: { kind: 'Trade', trade: tradeReview(TF) }, binding } as const;
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: {} as never, review: post });
    renderReview(facade, { at: '/review?trade=t-c' });
    const card = await screen.findByRole('region', { name: 'DEF review' });
    await user.type(within(marksStep()).getByRole('textbox', { name: 'DEF Mark, Mon Oct 12' }), '33.10');
    await showPanel(user, card, 'Action');

    await user.click(within(card).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    await waitFor(() => expect(facade.DailyReview.save).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('region', { name: 'XYZ review' })).toBeTruthy();
    expect(screen.queryByText(/Save or discard what you entered/)).toBeNull();
    expect(screen.queryByRole('region', { name: 'DEF review' })).toBeNull();
    expect(within(marksStep()).getByRole<HTMLInputElement>('textbox', { name: 'DEF Mark, Mon Oct 12' }).value).toBe('33.10');
  });
});

// A reflection due for T-F: its open form holds the card, which a Mark in the Marks step no longer does.
const DUE_REFLECTION: OwedReflection = {
  debtId: 'd1',
  entryType: 'Position Change Reflection',
  definition: reflectionDefinition,
  economicTime: '2026-10-09T14:30:00Z',
  executions: [{ factId: 'x1', economicTime: '2026-10-09T14:30:00Z', recordedSequence: 1, action: 'Buy', instrument: symbol, quantity: '100', price: '50.00', fee: '1.00' }] as unknown as OwedReflection['executions'],
  classification: 'Due',
  saveBinding: { debtId: 'd1', debtRevision: 'd1-rev-1', definitionRevision: 'def-pcr-1' },
};
// Opens T-F's reflection and starts to answer it, so the card holds an entered value.
async function startReflection(user: ReturnType<typeof userEvent.setup>, card: HTMLElement) {
  await showPanel(user, card, 'Reflections');
  await user.click(within(card).getByRole('button', { name: /^Reflect on/ }));
  await user.type(within(card).getByLabelText('Reason for declining (optional)'), 'No time.');
  await showPanel(user, card, 'Action');
}
// T-F's card carries the reflection due.
const withDueReflection = (facade: UiFacade, walked: readonly WalkedTrade[]) =>
  vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ tradeId }) => Promise.resolve({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: CUTOFF, trade: tradeReview(walked.find((t) => t.tradeId === tradeId)!, tradeId === 't-f' ? { reflections: [DUE_REFLECTION] } : {}) }));

describe('Trade names in messages and blockers (decision 68)', () => {
  // The two XYZ Trades carry summaries here only; the shared fixtures carry none.
  const NAME_F = 'XYZ (Long 100 shares @ $50.18)';
  const NAME_A = 'XYZ (Long 50 shares @ $61.00)';
  const named = [
    TB,
    TC,
    { ...TF, summary: { kind: 'Stock' as const, direction: 'Long' as const, quantity: rational(100n), price: rational(5018n, 100n) } },
    { ...TA, summary: { kind: 'Stock' as const, direction: 'Long' as const, quantity: rational(50n), price: rational(61n) } },
    TE,
  ];
  const namedReview = (over: Partial<Ready> = {}): Ready => review({ families: [review().families[0]!, { family: 'Trades', trades: named }], ...over });

  it('should name the Trade in its line and in the recorded facts disagree and cannot be replayed lines, each link still opening its card and panel', async () => {
    const user = userEvent.setup();
    renderReview(
      cardFacade(
        namedReview({
          completion: incomplete(
            { code: 'ActionMissing', tradeId: 't-f' },
            { code: 'ReflectionDue', tradeId: 't-a', debtIds: ['d1'] },
            { code: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'DEF' }, tradingDate: '2026-10-12', trades: ['t-c'] },
            { code: 'IntegrityDisagreement', tradeId: 't-f', findings: [] },
            { code: 'IncoherentFacts', tradeId: 't-b', findings: [] as never },
          ),
        }),
      ),
    );
    const status = await screen.findByRole('region', { name: 'The day' });

    // A Trade's line names its Underlying; the lines about its facts name the Trade as the card does.
    const facts = within(within(status).getByRole('list', { name: 'Facts to check' })).getAllByRole('listitem');
    expect(facts.map((b) => b.textContent)).toEqual([`${NAME_F}: recorded facts disagree`, "ABC: Facts can't be replayed"]);
    const lines = within(within(status).getByRole('list', { name: 'Trade lines' })).getAllByRole('listitem');
    const open = (index: number) => within(headers()[index]!.closest('li')!);
    const panelOpen = (index: number, panel: 'Marks' | 'Reflections' | 'Action') => open(index).getByRole('button', { name: new RegExp(`^${panel}\\b`) }).getAttribute('aria-expanded');
    await waitFor(() => expect(headers().some((h) => h.getAttribute('aria-expanded') === 'true')).toBe(true));

    // Each link opens that Trade's own card on the panel that resolves it.
    const action = within(lines[2]!).getByRole('link', { name: 'XYZ' });
    expect(action.getAttribute('href')).toBe('/review?trade=t-f&panel=Action');
    await user.click(action);
    await waitFor(() => expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true', 'false', 'false']));
    await waitFor(() => expect(panelOpen(2, 'Action')).toBe('true'));
    const reflection = within(lines[3]!).getByRole('link', { name: 'XYZ' });
    expect(reflection.getAttribute('href')).toBe('/review?trade=t-a&panel=Reflections');
    await user.click(reflection);
    await waitFor(() => expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'true', 'false']));
    await waitFor(() => expect(panelOpen(3, 'Reflections')).toBe('true'));
    // A Trade with a Mark to go links with the Trade and the row.
    expect(within(lines[1]!).getByRole('link', { name: 'DEF' }).getAttribute('href')).toBe('/review?trade=t-c&instrument=DEF');
  });

  it('should list the Trades by name under Complete with unavailable Marks', async () => {
    const completion: ReviewCompletion = { kind: 'CompleteWithUnavailableMarks', instruments: [{ kind: 'Stock', symbol: 'DEF' }, { kind: 'Stock', symbol: 'XYZ' }], trades: ['t-c', 't-f', 't-a'], families: ['Valuation'] };
    renderReview(cardFacade(namedReview({ completion })));
    const status = await screen.findByRole('region', { name: 'The day' });

    // DEF's Trade has no summary here, so it reads by its Underlying alone.
    expect(within(within(status).getByRole('group', { name: 'Unavailable Marks' })).getByText(/^Trades:/).textContent).toBe(`Trades: DEF, ${NAME_F}, ${NAME_A}`);
  });

  it('should name the Trade in the hold message when another header is pressed while the open card holds unsaved work', async () => {
    const user = userEvent.setup();
    const facade = cardFacade(namedReview());
    renderReview(facade, { at: '/review?trade=t-f&panel=Action' });
    const form = await screen.findByRole('form', { name: 'Action' });
    await user.click(within(form).getByRole('radio', { name: 'Exit' }));

    await user.click(headers()[0]!);

    // W128 names the Underlying; the card pressed is another Trade's.
    expect(await within(screen.getAllByRole('listitem').find((li) => li.getAttribute('data-trade-id') === 't-b')!).findByText("XYZ's note isn't saved.")).toBeTruthy();
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true', 'false', 'false']);
  });

  it('should name the Trade in the message after an Action save on a held card', async () => {
    const user = userEvent.setup();
    const facade = cardFacade(namedReview());
    withDueReflection(facade, named);
    const post = { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 5 }, completion: MONDAY_COMPLETION, nextStep: { kind: 'Trade', trade: tradeReview(TA) }, binding } as const;
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: {} as never, review: post });
    renderReview(facade, { at: '/review?trade=t-f' });
    await waitFor(() => expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1));
    const card = (await screen.findAllByRole('listitem')).find((li) => li.getAttribute('data-trade-id') === 't-f')!;
    // A reflection with an entered value holds the card while its Action is saved.
    await startReflection(user, card);

    await user.click(within(card).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));

    expect((await screen.findByRole('status')).textContent).toBe(`The Action is saved. Save or discard what you entered for ${NAME_F} to go on.`);
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true', 'false', 'false']);
  });

  // T95.34-B4: a Review read that started before a later save was applied must not undo it when it returns last.
  it('should keep the Review a later reflection save applied when the Review read after an Action save returns afterwards', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    withDueReflection(facade, WALK);
    const actionPost = { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 5 }, completion: MONDAY_COMPLETION, nextStep: { kind: 'Trade', trade: tradeReview(TA) }, binding } as const;
    const debtPost = { ...actionPost, completion: { kind: 'Complete' }, nextStep: { kind: 'Done' } } as const;
    vi.mocked(facade.DailyReview.save).mockImplementation(((request: { kind: string }) =>
      Promise.resolve(request.kind === 'SaveTradeAction' ? { kind: 'Saved', action: {}, review: actionPost } : { kind: 'DebtResolved', entry: { id: 'e1', responses: [] }, debt: { debtId: 'd1', status: 'Settled', revision: 'd1-rev-2' }, review: debtPost })) as never);
    let late: (value: Ready) => void = () => {};
    vi.mocked(facade.DailyReview.open).mockResolvedValueOnce(review()).mockReturnValueOnce(new Promise<Ready>((resolve) => (late = resolve)));
    renderReview(facade, { at: '/review?trade=t-f' });
    await waitFor(() => expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1));
    const card = (await screen.findAllByRole('listitem')).find((li) => li.getAttribute('data-trade-id') === 't-f')!;
    await startReflection(user, card);
    await user.click(within(card).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await waitFor(() => expect(facade.DailyReview.open).toHaveBeenCalledTimes(2));
    await showPanel(user, card, 'Reflections');
    await user.click(within(card).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(facade.DailyReview.save).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByText('Complete').length).toBeGreaterThan(0));
    expect(screen.queryByText('Incomplete')).toBeNull();

    await act(async () => {
      late(review());
      await Promise.resolve();
    });

    expect(screen.queryByText('Incomplete')).toBeNull();
    expect(screen.getAllByText('Complete').length).toBeGreaterThan(0);
  });

  // T6.20-B2, items 3 and 4: an Action is saved on a card that holds a Mark draft, and the Review read again no longer walks the Trade.
  async function savedOnHeldCard(refreshed: OpenDailyReviewResult, owedCard?: OwedReflectionsCard, unreadable = false) {
    const user = userEvent.setup();
    const facade = cardFacade(namedReview());
    withDueReflection(facade, named);
    const post = { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 5 }, completion: MONDAY_COMPLETION, nextStep: { kind: 'Trade', trade: tradeReview(TA) }, binding } as const;
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: {} as never, review: post });
    renderReview(facade, { at: '/review?trade=t-f' });
    await waitFor(() => expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1));
    const card = (await screen.findAllByRole('listitem')).find((li) => li.getAttribute('data-trade-id') === 't-f')!;
    await startReflection(user, card);
    vi.mocked(facade.DailyReview.open).mockResolvedValue(refreshed);
    if (owedCard) vi.mocked(facade.DailyReview.getTrade).mockResolvedValue({ kind: 'ReflectionsOwed', reviewDate: '2026-10-12', cutoff: CUTOFF, card: owedCard });
    // The first read of the Trade as it now is fails, so its owed card offers Retry.
    if (unreadable) vi.mocked(facade.DailyReview.getTrade).mockRejectedValueOnce(new Error('down'));
    await user.click(within(card).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await waitFor(() => expect(screen.queryByRole('region', { name: `${NAME_F} review` })).toBeNull());
    return { user };
  }
  const withoutF = (over: Partial<Ready> = {}): Ready => namedReview({ families: [review().families[0]!, { family: 'Trades', trades: named.filter((t) => t.tradeId !== 't-f') }], ...over });
  const OWED_F: OwedReflectionsCard = {
    tradeId: 't-f',
    underlying: 'XYZ',
    lifecycle: 'Closed',
    labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' },
    reflections: [],
    progress: reflectionsOwedProgress(1, 0),
  };
  const owedF: OwedReflectionsTrade = { tradeId: 't-f', underlying: 'XYZ', lifecycle: 'Closed', owed: [], progress: OWED_F.progress };

  it('should not keep the Action is saved message after the refresh finds the Trade gone from the walk', async () => {
    await savedOnHeldCard(withoutF());
    expect(screen.queryByText(/The Action is saved/)).toBeNull();
    cleanup();

    await savedOnHeldCard(withoutF({ owed: [owedF] }), OWED_F);
    expect(screen.queryByText(/The Action is saved/)).toBeNull();
  });

  it('should say what was not kept when the refresh removes a card that held drafts from the Review, or leaves the Review Empty', async () => {
    await savedOnHeldCard(withoutF());
    expect((await screen.findByRole('status')).textContent).toBe(`${NAME_F} is no longer in this Review, so what you entered for it was not kept.`);
    cleanup();

    await savedOnHeldCard({ kind: 'Empty', reviewDate: '2026-10-12', cutoff: CUTOFF, owed: [], binding });
    expect((await screen.findByRole('status')).textContent).toBe(`${NAME_F} is no longer in this Review, so what you entered for it was not kept.`);
    cleanup();

    // A Trade that moved to the owed group is still in the Review, but its card is a new one with none of the drafts.
    await savedOnHeldCard(withoutF({ owed: [owedF] }), OWED_F);
    expect((await screen.findByRole('status')).textContent).toBe(`${NAME_F} is now in Trades with owed reflections, so what you entered for it was not kept.`);
  });

  // T6.20-B3, item 3.
  it('should keep the not kept notice when Retry opens the owed card the Trade moved to', async () => {
    const { user } = await savedOnHeldCard(withoutF({ owed: [owedF] }), OWED_F, true);
    const notice = `${NAME_F} is now in Trades with owed reflections, so what you entered for it was not kept.`;
    expect(await screen.findByText(notice)).toBeTruthy();

    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('region', { name: 'XYZ review' })).toBeTruthy();
    expect(screen.getByText(notice)).toBeTruthy();
  });

  it('should show Closed after this session close with the current lifecycle on a walked card whose Trade closed after the cutoff, and not on an Open one', async () => {
    const user = userEvent.setup();
    const overview = review();
    const facade = cardFacade(overview);
    const walked = overview.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ tradeId }) => {
      const found = walked.find((t) => t.tradeId === tradeId)!;
      const lifecycle = tradeId === walked[0]!.tradeId ? 'Closed' : 'Open';
      return Promise.resolve({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: CUTOFF, trade: tradeReview(found, { lifecycle }) });
    });
    renderReview(facade);

    const closed = await screen.findByRole('region', { name: /review$/ });
    expect(within(closed).getByText("Closed after this session's close")).toBeTruthy();
    expect(within(closed).getByText('Closed', { selector: '.review-card-lifecycle' })).toBeTruthy();
    expect(within(closed).getByRole('button', { name: /Action/ })).toBeTruthy();

    await user.click(headers()[1]!);
    const open = await screen.findByRole('region', { name: /review$/ });
    expect(within(open).queryByText("Closed after this session's close")).toBeNull();
    expect(within(open).queryByText('Closed', { selector: '.review-card-lifecycle' })).toBeNull();
  });

  it('should label the open card body with the Trade name then review, and with the Underlying then review for a Trade with no summary', async () => {
    const user = userEvent.setup();
    const noSummary = { ...TA, underlying: 'XYZ', summary: undefined };
    renderReview(cardFacade(namedReview({ families: [review().families[0]!, { family: 'Trades', trades: [TB, TC, named[2]!, noSummary, TE] }] })), { at: '/review?trade=t-f' });

    // Two Trades on one Underlying read apart.
    const card = await screen.findByRole('region', { name: `${NAME_F} review` });
    expect(card.closest('li')!.getAttribute('data-trade-id')).toBe('t-f');
    await user.click(headers()[3]!);
    expect((await screen.findByRole('region', { name: 'XYZ review' })).closest('li')!.getAttribute('data-trade-id')).toBe('t-a');
    expect(screen.queryByRole('region', { name: `${NAME_F} review` })).toBeNull();
  });
});

describe('Review words (P72)', () => {
  const DEF = { kind: 'Stock' as const, symbol: 'DEF' };
  const sell = (quantity: string): IncoherentFact => ({ factId: 'e1', kind: 'Execution', instrument: symbol, economicTime: '2026-10-14T14:30:00Z', side: 'Sell', quantity, reason: 'ExceedsOpenQuantity', available: Rational.of(100n) });
  const duplicate: IncoherentFact = { factId: 'p1', kind: 'PositionChange', economicTime: '2026-10-14T14:30:00Z', reason: 'DuplicateFactId' };
  const SELL_SENTENCE = 'Sell of 120 XYZ on Wed Oct 14, 10:30 is more than the 100 shares in the position';

  it('should give the attention reason the sentence length for each Unavailable reason', async () => {
    const reasons: WalkedTrade['reasons'] = [
      { code: 'Unavailable', reason: 'MarkMissing', instrument: DEF, date: '2026-10-12' },
      { code: 'Unavailable', reason: 'AcknowledgedUnavailable', instrument: DEF, date: '2026-10-12' },
      { code: 'Unavailable', reason: 'AwaitingClose', after: '2026-10-12' },
      { code: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: DEF, date: '2026-10-12' },
      { code: 'Unavailable', reason: 'FactsIncoherent', findings: [sell('120'), duplicate] },
    ];
    renderReview(cardFacade(review({ families: [review().families[0]!, { family: 'Trades', trades: [{ ...TC, reasons }] }] })), { at: '/review?trade=t-c' });

    const card = await screen.findByRole('region', { name: 'DEF review' });
    for (const words of [
      'Mark missing for DEF on Mon Oct 12',
      'Mark acknowledged unavailable for DEF on Mon Oct 12',
      'Awaiting the next close after Mon Oct 12',
      'Mon Oct 12 is outside the market calendar',
      `${SELL_SENTENCE} and 1 more`,
    ]) {
      expect(within(card).getByText(words).tagName).toBe('P');
    }
  });

  it('should give the line for facts that cannot be replayed the Trade name, the first finding sentence and and 1 more, linking to Trade Detail', async () => {
    renderReview(cardFacade(review({ completion: incomplete({ code: 'IncoherentFacts', tradeId: 't-b', findings: [sell('120'), duplicate] }) })));
    const status = await screen.findByRole('region', { name: 'The day' });

    const [blocker] = within(within(status).getByRole('list', { name: 'Facts to check' })).getAllByRole('listitem');
    expect(blocker!.textContent).toBe(`ABC: ${SELL_SENTENCE} and 1 more`);
    expect(within(blocker!).getByRole('link', { name: 'ABC' }).getAttribute('href')).toBe('/trades/t-b');
  });

  it('should show no meter on a Trade whose facts cannot be replayed', async () => {
    const incoherent = { ...TF, figures: undefined };
    renderReview(cardFacade(review({ families: [review().families[0]!, { family: 'Trades', trades: [incoherent] }] })));
    await screen.findAllByRole('button', { name: /^Review / });

    expect(within(screen.getByRole('list', { name: 'Positions' })).queryByRole('img')).toBeNull();
  });
});

describe('the refusal on the Trade pressed (T95.34, W128)', () => {
  const cardOf = (tradeId: string) => screen.getAllByRole('listitem').find((li) => li.getAttribute('data-trade-id') === tradeId)!;
  // ABC is the open card; its Action form holds an Exit that is not saved, and XYZ's header is pressed.
  async function pressXyzWhileAbcHoldsExit(facade = cardFacade(), intent = '') {
    const user = userEvent.setup();
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });
    const form = within(card).getByRole('form', { name: 'Action' });
    await user.click(within(form).getByRole('radio', { name: 'Exit' }));
    if (intent) await user.type(within(form).getAllByRole('textbox')[0]!, intent);
    await user.click(headers()[2]!);
    return { user, facade, card };
  }
  const savedPost = { kind: 'Ready', cards: [], progress: { tradesWithAction: 1, tradesEligible: 5 }, completion: MONDAY_COMPLETION, nextStep: { kind: 'Trade', trade: tradeReview(TA) }, binding } as const;

  it('should show the refusal on the Trade pressed, naming the Trade whose form is unsaved', async () => {
    await pressXyzWhileAbcHoldsExit();

    const refusal = within(cardOf('t-f'));
    expect(refusal.getByText("ABC's note isn't saved.")).toBeTruthy();
    expect(within(cardOf('t-b')).queryByText("ABC's note isn't saved.")).toBeNull();
    expect(screen.queryByText(/Save or discard what you entered for ABC to leave it/)).toBeNull();
  });

  it('should focus Save it when the refusal appears', async () => {
    await pressXyzWhileAbcHoldsExit();

    await waitFor(() => expect(document.activeElement).toBe(within(cardOf('t-f')).getByRole('button', { name: 'Save it' })));
  });

  it('should save that form on Save it and then open the Trade pressed', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: {} as never, review: savedPost });
    const { user } = await pressXyzWhileAbcHoldsExit(facade, 'Plan changed.');

    await user.click(within(cardOf('t-f')).getByRole('button', { name: 'Save it' }));

    await waitFor(() => expect(headers()[2]!.getAttribute('aria-expanded')).toBe('true'));
    expect(vi.mocked(facade.DailyReview.save).mock.calls[0]![0]).toMatchObject({ kind: 'SaveTradeAction', action: 'Exit', intent: 'Plan changed.' });
    // The Action's next step is not the Trade opened: the pressed Trade is.
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true', 'false', 'false']);
    expect(screen.queryByText("ABC's note isn't saved.")).toBeNull();
  });

  it('should show the form own refusal, and stay on it, when Save it cannot save', async () => {
    const facade = cardFacade();
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: {} as never, review: savedPost });
    // No reason is typed, and an Exit owes one.
    const { user, card } = await pressXyzWhileAbcHoldsExit(facade);

    await user.click(within(cardOf('t-f')).getByRole('button', { name: 'Save it' }));

    expect(await within(card).findByText('Say why.')).toBeTruthy();
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    expect(within(cardOf('t-f')).getByText("ABC's note isn't saved.")).toBeTruthy();

    // The Trade pressed is not kept as the target: the ordinary Save that follows goes to the Action's next step.
    await user.type(within(within(card).getByRole('form', { name: 'Action' })).getAllByRole('textbox')[0]!, 'Plan changed.');
    await user.click(within(card).getByRole('button', { name: /^Save( Hold| Exit| Roll| Adjust)?$/ }));
    await waitFor(() => expect(headers()[3]!.getAttribute('aria-expanded')).toBe('true'));
    expect(headers()[2]!.getAttribute('aria-expanded')).toBe('false');
  });

  it('should discard it on Discard it and open the Trade pressed', async () => {
    const { user, facade } = await pressXyzWhileAbcHoldsExit(cardFacade(), 'Plan changed.');

    await user.click(within(cardOf('t-f')).getByRole('button', { name: 'Discard it' }));

    await waitFor(() => expect(headers()[2]!.getAttribute('aria-expanded')).toBe('true'));
    expect(headers()[0]!.getAttribute('aria-expanded')).toBe('false');
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
    expect(screen.queryByText("ABC's note isn't saved.")).toBeNull();
    // What was entered is gone: the card opened again shows the Hold the Plan preselected, with no reason.
    await user.click(headers()[0]!);
    const form = await screen.findByRole('form', { name: 'Action' });
    expect(within(form).getByRole('radio', { name: 'Hold' })).toHaveProperty('checked', true);
    expect(within(form).getAllByRole('textbox')[0]).toHaveProperty('value', '');
  });

  it('should return to the unsaved form on Back to ABC', async () => {
    const { user, card } = await pressXyzWhileAbcHoldsExit(cardFacade(), 'Plan changed.');

    await user.click(within(cardOf('t-f')).getByRole('button', { name: 'Back to ABC' }));

    expect(screen.queryByText("ABC's note isn't saved.")).toBeNull();
    const form = within(card).getByRole('form', { name: 'Action' });
    expect(form.contains(document.activeElement)).toBe(true);
    expect(within(form).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', true);
    expect(within(form).getAllByRole('textbox')[0]).toHaveProperty('value', 'Plan changed.');
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false']);
  });

  it('should hold the refusal buttons while Save it runs, and open the Trade pressed once it ends', async () => {
    const facade = cardFacade();
    let finish: (value: never) => void = () => {};
    vi.mocked(facade.DailyReview.save).mockReturnValue(new Promise((resolve) => (finish = resolve as never)) as never);
    const { user } = await pressXyzWhileAbcHoldsExit(facade, 'Plan changed.');

    await user.click(within(cardOf('t-f')).getByRole('button', { name: 'Save it' }));

    for (const name of ['Save it', 'Discard it', 'Back to ABC']) expect(within(cardOf('t-f')).getByRole('button', { name })).toHaveProperty('disabled', true);
    await user.click(within(cardOf('t-f')).getByRole('button', { name: 'Save it' }));
    expect(facade.DailyReview.save).toHaveBeenCalledTimes(1);
    finish({ kind: 'Saved', action: {} as never, review: savedPost } as never);
    await waitFor(() => expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true', 'false', 'false']));
  });

  it('should open the Action panel, and focus its form, on Back to ABC when another panel is open', async () => {
    const user = userEvent.setup();
    renderReview(cardFacade());
    const card = await screen.findByRole('region', { name: 'ABC review' });
    await user.click(within(within(card).getByRole('form', { name: 'Action' })).getByRole('radio', { name: 'Exit' }));
    await showPanel(user, card, 'Reflections');
    await user.click(headers()[2]!);

    await user.click(within(cardOf('t-f')).getByRole('button', { name: 'Back to ABC' }));

    expect(within(card).getByRole('button', { name: /^Action\b/ }).getAttribute('aria-expanded')).toBe('true');
    const form = within(card).getByRole('form', { name: 'Action' });
    expect(form.contains(document.activeElement)).toBe(true);
  });

  it('should open the Action panel on Save it when another panel is open, so the form own refusal shows', async () => {
    const user = userEvent.setup();
    renderReview(cardFacade());
    const card = await screen.findByRole('region', { name: 'ABC review' });
    await user.click(within(within(card).getByRole('form', { name: 'Action' })).getByRole('radio', { name: 'Exit' }));
    await showPanel(user, card, 'Reflections');
    await user.click(headers()[2]!);

    await user.click(within(cardOf('t-f')).getByRole('button', { name: 'Save it' }));

    expect(await within(card).findByText('Say why.')).toBeTruthy();
    expect(within(card).getByRole('button', { name: /^Action\b/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('should read the Trade again after an asked Action save when a reflection is also unsaved', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    withDueReflection(facade, WALK);
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Saved', action: {} as never, review: savedPost });
    renderReview(facade, { at: '/review?trade=t-f' });
    await waitFor(() => expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1));
    const form = await within(cardOf('t-f')).findByRole('form', { name: 'Action' });
    await user.click(within(form).getByRole('radio', { name: 'Exit' }));
    await user.type(within(form).getAllByRole('textbox')[0]!, 'Plan changed.');
    await startReflection(user, cardOf('t-f'));
    await user.click(headers()[0]!);
    const readsOfF = () => vi.mocked(facade.DailyReview.getTrade).mock.calls.filter(([request]) => request.tradeId === 't-f').length;
    const before = readsOfF();

    await user.click(within(cardOf('t-b')).getByRole('button', { name: 'Save it' }));

    await waitFor(() => expect(readsOfF()).toBeGreaterThan(before));
    expect(vi.mocked(facade.DailyReview.save).mock.calls[0]![0]).toMatchObject({ kind: 'SaveTradeAction', action: 'Exit' });
  });

  it('should not refuse when only the Marks step holds typed Marks', async () => {
    const user = userEvent.setup();
    renderReview(cardFacade());
    await screen.findByRole('region', { name: 'ABC review' });
    await user.type(within(marksStep()).getByRole('textbox', { name: 'DEF Mark, Mon Oct 12' }), '33.10');

    await user.click(headers()[2]!);

    await waitFor(() => expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true', 'false', 'false']));
    expect(screen.queryByText(/note isn't saved/)).toBeNull();
    expect(within(marksStep()).getByRole('textbox', { name: 'DEF Mark, Mon Oct 12' })).toHaveProperty('value', '33.10');
  });

  it('should answer an unsaved reflection on Save it and then open the Trade pressed', async () => {
    const user = userEvent.setup();
    const facade = cardFacade();
    withDueReflection(facade, WALK);
    const post = { kind: 'Ready', cards: [], progress: { tradesWithAction: 0, tradesEligible: 5 }, completion: MONDAY_COMPLETION, nextStep: { kind: 'Done' }, binding } as const;
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'DebtResolved', entry: { id: 'e1', responses: [] } as never, debt: { debtId: 'd1', status: 'Settled', revision: 'd1-rev-2' } as never, review: post });
    renderReview(facade, { at: '/review?trade=t-f' });
    await waitFor(() => expect(facade.DailyReview.getTrade).toHaveBeenCalledTimes(1));
    await startReflection(user, cardOf('t-f'));
    await user.click(headers()[0]!);

    await user.click(within(cardOf('t-b')).getByRole('button', { name: 'Save it' }));

    await waitFor(() => expect(headers()[0]!.getAttribute('aria-expanded')).toBe('true'));
    expect(vi.mocked(facade.DailyReview.save).mock.calls[0]![0]).toMatchObject({ kind: 'ResolveReviewDebt', resolution: { kind: 'Answer' } });
    expect(headers()[2]!.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('the sale in the card (T95.40)', () => {
  const cardOf = (tradeId: string) => screen.getAllByRole('listitem').find((li) => li.getAttribute('data-trade-id') === tradeId)!;
  const savedExit = { kind: 'Saved', action: { action: 'Exit', responses: [{ prompt: 'Action', answer: { kind: 'Option', label: 'Exit' } }] } } as never;
  const planExit = { positions: [{ instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', conditions: [] }], heldPast: [] } as never;
  // ABC's card holds a saved Exit; the exit form's reads come from the exit-form facade.
  function saleFacade(): UiFacade {
    const facade = cardFacade();
    const sale = exitFormFacade();
    vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ tradeId }) => {
      const found = WALK.find((t) => t.tradeId === tradeId)!;
      return Promise.resolve({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: CUTOFF, trade: tradeReview(found, tradeId === 't-b' ? { form: savedExit, planExit } : {}) });
    });
    Object.assign(facade, { TradeViewsAndReporting: sale.TradeViewsAndReporting, Journal: sale.Journal, ReferenceCatalog: sale.ReferenceCatalog, TradeWorkflows: sale.TradeWorkflows });
    return facade;
  }
  async function pressXyzWhileAbcHoldsASale(facade = saleFacade()) {
    const user = userEvent.setup();
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });
    await user.click(within(card).getByRole('button', { name: 'Record the sale' }));
    const row = await within(card).findByRole('group', { name: 'Execution 1' });
    await user.type(within(row).getByLabelText('Quantity'), '30');
    await user.click(headers()[2]!);
    return { user, facade, card };
  }

  const OWED_B: OwedReflectionsCard = { tradeId: 't-b', underlying: 'ABC', lifecycle: 'Closed', labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' }, reflections: [], progress: reflectionsOwedProgress(0, 1) };
  const owedB: OwedReflectionsTrade = { tradeId: 't-b', underlying: 'ABC', lifecycle: 'Closed', owed: [{ debtId: 'debt-2', entryTypeKey: 'entry-type.close-review', dueAnchor: '2026-10-12T19:30:00Z', classification: 'DueInNextReview' }], progress: OWED_B.progress };
  async function sellAllOnAbc(facade: UiFacade) {
    const user = userEvent.setup();
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });
    await user.click(within(card).getByRole('button', { name: 'Record the sale' }));
    const row = await within(card).findByRole('group', { name: 'Execution 1' });
    for (const [label, value] of [['Quantity', '100'], ['Price', '53.00'], ['Fee', '1.00']] as const) {
      await user.clear(within(row).getByLabelText(label));
      await user.type(within(row).getByLabelText(label), value);
    }
    await user.click(within(card).getByRole('button', { name: 'Save exit' }));
    return { user, card };
  }

  it('should keep the receipt in the card after a closing sale, then show the Trade under Trades with owed reflections as Close Review · next Review', async () => {
    const facade = saleFacade();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(closedExitResult({ reflection: { kind: 'Debt', debt: { debtId: 'debt-1' } }, closeReview: { kind: 'Debt', debt: { debtId: 'debt-2' } } }) as never);
    const walkedGetTrade = vi.mocked(facade.DailyReview.getTrade).getMockImplementation()!;
    vi.mocked(facade.DailyReview.getTrade).mockImplementation((request) => (request.tradeId === 't-b' && sold ? Promise.resolve({ kind: 'ReflectionsOwed', reviewDate: '2026-10-12', cutoff: CUTOFF, card: OWED_B }) : walkedGetTrade(request)));
    let sold = false;
    const { user, card } = await sellAllOnAbc(facade);
    sold = true;
    vi.mocked(facade.DailyReview.open).mockResolvedValue(review({ families: [review().families[0]!, { family: 'Trades', trades: WALK.filter((t) => t.tradeId !== 't-b') }], owed: [owedB] }));

    // The Trade is still the walked card, with its receipt.
    expect(await within(card).findByText('Recorded. XYZ is closed. Its Close Review is due in the next Review.')).toBeTruthy();
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(1);
    await user.click(within(card).getByRole('button', { name: 'Back to the Review' }));

    const group = await screen.findByRole('list', { name: 'Trades with owed reflections' });
    expect(within(group).getByRole('button', { name: /^Review ABC/ }).textContent).toContain('Close Review · next Review');
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(2);
  });

  it('should show no open-position figures beside the receipt of a closing sale', async () => {
    const facade = saleFacade();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(closedExitResult({ reflection: { kind: 'Debt', debt: { debtId: 'debt-1' } }, closeReview: { kind: 'Debt', debt: { debtId: 'debt-2' } } }) as never);
    const pnl = { dollars: value(-251n), planR: value(-126n, 100n), change: { kind: 'Value' as const, dollars: rational(-150n) } };
    vi.mocked(facade.DailyReview.open).mockResolvedValue(review({ families: [review().families[0]!, { family: 'Trades', trades: WALK.map((t) => (t.tradeId === 't-b' ? { ...t, pnl } : t)) }] }));
    const user = userEvent.setup();
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'ABC review' });
    expect(within(card).getByText('Worst case')).toBeTruthy();
    expect(headers()[0]!.textContent).toContain('today');
    await user.click(within(card).getByRole('button', { name: 'Record the sale' }));
    const row = await within(card).findByRole('group', { name: 'Execution 1' });
    for (const [label, value] of [['Quantity', '100'], ['Price', '53.00'], ['Fee', '1.00']] as const) {
      await user.clear(within(row).getByLabelText(label));
      await user.type(within(row).getByLabelText(label), value);
    }
    await user.click(within(card).getByRole('button', { name: 'Save exit' }));

    expect(await within(card).findByText('Recorded. XYZ is closed. Its Close Review is due in the next Review.')).toBeTruthy();
    expect(within(card).queryByText('Worst case')).toBeNull();
    expect(headers()[0]!.textContent).not.toContain('today');
    expect(headers()[0]!.textContent).not.toContain('Past Stop');
  });

  it('should say the Review could not be refreshed when the read after dismissing the receipt of a closing sale fails', async () => {
    const facade = saleFacade();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(closedExitResult({ reflection: { kind: 'Debt', debt: { debtId: 'debt-1' } }, closeReview: { kind: 'Debt', debt: { debtId: 'debt-2' } } }) as never);
    const { user, card } = await sellAllOnAbc(facade);
    await within(card).findByText('Recorded. XYZ is closed. Its Close Review is due in the next Review.');
    vi.mocked(facade.DailyReview.open).mockRejectedValue(new Error('down'));
    await user.click(within(card).getByRole('button', { name: 'Back to the Review' }));
    expect((await screen.findByRole('alert')).textContent).toContain('We couldn’t refresh the Review. Nothing was changed.');
  });

  it('should read the Review again when another Trade is pressed while the receipt of a closing sale is still shown', async () => {
    const facade = saleFacade();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(closedExitResult({ reflection: { kind: 'Debt', debt: { debtId: 'debt-1' } }, closeReview: { kind: 'Debt', debt: { debtId: 'debt-2' } } }) as never);
    const { user, card } = await sellAllOnAbc(facade);
    await within(card).findByText('Recorded. XYZ is closed. Its Close Review is due in the next Review.');
    vi.mocked(facade.DailyReview.open).mockResolvedValue(review({ families: [review().families[0]!, { family: 'Trades', trades: WALK.filter((t) => t.tradeId !== 't-b') }], owed: [owedB] }));

    await user.click(headers()[2]!);

    const group = await screen.findByRole('list', { name: 'Trades with owed reflections' });
    expect(within(group).getByRole('button', { name: /^Review ABC/ })).toBeTruthy();
    expect(vi.mocked(facade.DailyReview.open)).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/not kept/)).toBeNull();
  });

  it('should refuse to leave a half-typed sale as a half-typed Action is refused', async () => {
    const { user, card, facade } = await pressXyzWhileAbcHoldsASale();

    expect(within(cardOf('t-f')).getByText("ABC's note isn't saved.")).toBeTruthy();
    expect(headers().map((h) => h.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false', 'false']);

    await user.click(within(cardOf('t-f')).getByRole('button', { name: 'Back to ABC' }));
    expect(within(card).getByRole('group', { name: 'Execution 1' }).contains(document.activeElement)).toBe(true);
    expect(within(within(card).getByRole('group', { name: 'Execution 1' })).getByLabelText('Quantity')).toHaveProperty('value', '30');

    await user.click(headers()[2]!);
    await user.click(within(cardOf('t-f')).getByRole('button', { name: 'Discard it' }));
    await waitFor(() => expect(headers()[2]!.getAttribute('aria-expanded')).toBe('true'));
    expect(vi.mocked(facade.TradeWorkflows.recordPositionChange)).not.toHaveBeenCalled();
    expect(screen.queryByText("ABC's note isn't saved.")).toBeNull();
  });
});
