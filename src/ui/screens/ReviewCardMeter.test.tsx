// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { cardProgress } from '../../../tests/support/card-progress.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, MarkResolution, MarkRow, MeterReading, OpenDailyReviewResult, ReviewBinding, ReviewCompletion, WalkedTrade } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';

afterEach(cleanup);

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;
type SaveResult = Awaited<ReturnType<UiFacade['DailyReview']['save']>>;

// Two XYZ cards and a DEF card, in miniature of CardMarks.test.tsx: each card holds a Monday row without a Mark.
const CUTOFF = '2026-10-12T20:00:00Z';
const MONDAY = '2026-10-12';
const binding: ReviewBinding = {
  workspace: { databaseName: 'tj-ws-1', contentRevision: 3 },
  catalogRevision: 1,
  journalRevision: 1,
  marketDataSnapshotId: 'mds1:1:abc',
  factRevisions: {},
  outstandingDebts: {},
};
const rational = (n: bigint, d = 1n) => Rational.of(n, d);
const value = (n: bigint, d = 1n) => ({ kind: 'Value' as const, value: rational(n, d) });
const available = (price: string): MarkResolution => ({ kind: 'Available', mark: { revisionId: 'r1', revisionNumber: 1, price, source: 'Manual', savedAt: '2026-10-12T21:00:00Z' } });
const missingRow = (instrumentKey: string, trades: readonly string[]): MarkRow => ({ instrumentKey, instrument: { kind: 'Stock', symbol: instrumentKey }, tradingDate: MONDAY, trades, resolution: { kind: 'Missing' }, resolutionRevision: 'None', task: 'Manual' });

// The readings the Review gives: Stop -600, Target +1,600. With a Mark, P&L +990 is 62% of the way to the Target.
const markMissing = (symbol: string) => ({ kind: 'Unavailable' as const, reason: 'MarkMissing' as const, instrument: { kind: 'Stock' as const, symbol }, date: MONDAY });
const within62: MeterReading = {
  stop: value(-600n),
  target: value(1600n),
  banked: value(400n),
  now: { kind: 'Value', value: { pnl: rational(990n), zone: 'Between', share: { fraction: rational(31n, 50n), percent: rational(62n), toward: 'Target' } } },
  previous: { tradingDate: '2026-10-09', pnl: rational(850n), direction: 'Up' },
};
const pastStop: MeterReading = {
  stop: value(-600n),
  target: value(1600n),
  banked: value(0n),
  now: { kind: 'Value', value: { pnl: rational(-920n), zone: 'PastStop', pastBy: { dollars: rational(320n) } as never } },
};
const noMark = (symbol: string): MeterReading => ({ stop: value(-600n), target: value(1600n), banked: value(0n), now: markMissing(symbol) });

const walked = (tradeId: string, underlying: string, over: Partial<WalkedTrade> = {}): WalkedTrade => ({
  tradeId,
  underlying,
  lastActivity: '2026-10-12T14:00:00Z',
  band: 'Routine',
  reasons: [{ code: 'NoPressure' }],
  basis: { kind: 'Value', value: { side: 'None', share: rational(0n) } },
  progress: cardProgress(0, 0, { needed: 1, resolved: 0 }),
  ...over,
});
const TA = walked('t-a', 'XYZ', { meter: noMark('XYZ') });
const TF = walked('t-f', 'XYZ', { summary: { kind: 'Stock', direction: 'Long', quantity: rational(100n), price: rational(50n) }, meter: noMark('XYZ') });
const TC = walked('t-c', 'DEF', { meter: pastStop });
const WALK = [TA, TF, TC] as const;
const OWING: ReviewCompletion = { kind: 'Incomplete', reasons: [{ code: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'XYZ' }, tradingDate: MONDAY, trades: ['t-a', 't-f'] }, { code: 'ActionMissing', tradeId: 't-a' }] };

const reviewOf = (trades: readonly WalkedTrade[] = WALK): Ready => ({
  kind: 'Ready',
  reviewDate: MONDAY,
  cutoff: CUTOFF,
  families: [
    { family: 'Marks', earlierMarks: [], today: [missingRow('XYZ', ['t-a', 't-f']), missingRow('DEF', ['t-c'])], earlier: [] },
    { family: 'Trades', trades },
  ],
  owed: [],
  completion: OWING,
  binding,
});

const tradeReview = (item: WalkedTrade): DailyTradeReview => ({
  tradeId: item.tradeId,
  underlying: item.underlying,
  lifecycle: 'Open',
  attention: item,
  labels: { strategy: 'Long Stock', account: 'Main', institution: 'Broker' },
  settlement: [],
  reflections: [],
  progress: item.progress,
  form: { kind: 'New', viewState: { selectedAction: 'Hold' } },
  definitionRevision: 'def1',
  saveBinding: { reviewDate: MONDAY, tradeId: item.tradeId, factRevision: 2, marketDataSnapshotId: 'mds1:1:abc', obligationKey: { entryType: 'DailyTradeReview', trade: item.tradeId, reviewDate: MONDAY }, definitionRevision: 'def1', databaseName: 'tj-ws-1' },
});

function cardFacade(trades: readonly WalkedTrade[] = WALK): UiFacade {
  const facade = facadeDouble();
  vi.mocked(facade.DailyReview.open).mockResolvedValue(reviewOf(trades));
  vi.mocked(facade.DailyReview.getTrade).mockImplementation(({ tradeId }) => Promise.resolve({ kind: 'Ready', reviewDate: MONDAY, cutoff: CUTOFF, trade: tradeReview(trades.find((t) => t.tradeId === tradeId)!) }));
  return facade;
}

function renderReview(facade: UiFacade) {
  render(
    <RuntimeContext.Provider value={{ writable: true, timeZone: 'America/New_York', report: () => undefined }}>
      <MemoryRouter initialEntries={['/review']}>
        <ReviewView facade={facade} now={() => '2026-10-12T21:00:00Z'} onDirtyChange={() => undefined} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

// A card by its header's Underlying, then by position among the cards that share it.
const cardOf = (underlying: string, index = 0) => screen.getAllByRole('button', { name: new RegExp('^Review ' + underlying + '\\b') })[index]!.closest('li')!;
const meterIn = (card: HTMLElement) => within(card).getByRole('img');

describe('Review card: the meter (W51)', () => {
  it('should show the meter in the card header, named by its figures, and no slider', async () => {
    renderReview(cardFacade([TA, walked('t-c', 'DEF', { meter: within62 }), TF]));
    await screen.findAllByRole('button', { name: /^Review / });

    const def = cardOf('DEF');
    expect(meterIn(def).getAttribute('aria-label')).toBe('P&L +$990.00, 62% of the way to the Target. Realized +$400.00. Stop −$600.00, Target +$1,600.00. Up from +$850.00 on Fri Oct 9.');
    expect(meterIn(def).getAttribute('data-size')).toBe('card');
    expect(meterIn(def).closest('.review-card-head')).not.toBeNull();
    expect(document.querySelector('.slider')).toBeNull();

    cleanup();
    renderReview(cardFacade([walked('t-c', 'DEF', { meter: pastStop })]));
    await screen.findAllByRole('button', { name: /^Review / });
    expect(meterIn(cardOf('DEF')).getAttribute('aria-label')).toBe('P&L −$920.00, past the Stop by $320.00. Stop −$600.00, Target +$1,600.00.');
  });

  it('should show the dashed track named by the reason when the Mark is missing', async () => {
    renderReview(cardFacade());
    await screen.findAllByRole('button', { name: /^Review / });

    const xyz = meterIn(cardOf('XYZ'));
    expect(xyz.getAttribute('aria-label')).toBe('Mark missing: XYZ, Mon Oct 12 Stop −$600.00, Target +$1,600.00.');
    expect(xyz.getAttribute('data-state')).toBe('empty');
    expect(within(xyz).queryByTestId('meter-pointer')).toBeNull();
  });

  it('should follow a Save Marks result without reading again', async () => {
    const facade = cardFacade();
    const placed = walked('t-f', 'XYZ', { summary: TF.summary, meter: within62, progress: TF.progress });
    const trade = tradeReview(TA);
    const saved: SaveResult = {
      kind: 'MarksSaved',
      marks: [{ key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, resolution: available('52.00'), resolutionRevision: 1, classification: 'InitialManual' }],
      review: { kind: 'Ready', progress: { tradesWithAction: 0, tradesEligible: 3 }, completion: OWING, binding: { ...binding, marketDataSnapshotId: 'mds1:2:def' }, trades: [TA, placed, TC], trade, nextStep: { kind: 'Trade', trade } },
    };
    vi.mocked(facade.DailyReview.save).mockResolvedValue(saved);
    renderReview(facade);
    const user = userEvent.setup();
    await screen.findAllByRole('button', { name: /^Review / });
    // The second XYZ card is T-F's.
    expect(meterIn(cardOf('XYZ', 1)).getAttribute('data-state')).toBe('empty');

    const panel = await screen.findByRole('region', { name: /^Marks for / });
    await user.type(within(panel).getByRole('textbox', { name: 'XYZ Mark, Mon Oct 12' }), '52.00');
    await user.click(within(panel).getByRole('button', { name: 'Save Marks (1)' }));

    await waitFor(() => expect(meterIn(cardOf('XYZ', 1)).getAttribute('aria-label')).toContain('62% of the way to the Target'));
    expect(facade.DailyReview.open).toHaveBeenCalledTimes(1);
  });

  it('should keep the header other parts and their order', async () => {
    renderReview(cardFacade([TF, TC]));
    await screen.findAllByRole('button', { name: /^Review / });

    const head = cardOf('XYZ').querySelector('.review-card-head')!;
    const button = head.querySelector('h3 > button')!;
    expect([...button.children].map((el) => el.className.split(' ')[0])).toEqual(['visually-hidden', 'review-card-name', 'review-card-summary', 'review-card-remains', 'badge']);
    // The meter follows the heading inside the header.
    expect([...head.children].map((el) => el.tagName)).toEqual(['H3', 'SPAN']);
    expect(head.children[1]!.getAttribute('role')).toBe('img');
  });
});
