// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardProgress } from '../../../tests/support/card-progress.ts';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { payoffFixtures } from '../../../tests/support/payoff-fixtures.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview, MarkRow, OpenDailyReviewResult, ReviewBinding, SettlementItem, WalkedTrade } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewView } from './ReviewView.tsx';

afterEach(cleanup);

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;

// The Friday 2026-11-20 Review: T-3 (Short 2 MNO 45 Puts, expiring today) is Settlement Due, and so its Marks are needed
// only while that is so; T-2 (Long Stock XYZ) is not, and shares the XYZ Mark with T-3 in this fixture.
const DATE = '2026-11-20';
const CUTOFF = '2026-11-21T01:00:00Z';
const MNO_PUT = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-11-20', right: 'Put', strike: '45', multiplier: 100 } as const;
const MNO = { kind: 'Stock', symbol: 'MNO' } as const;
const XYZ = { kind: 'Stock', symbol: 'XYZ' } as const;
const PUT_KEY = 'MNO261120P00045000';
const binding: ReviewBinding = {
  workspace: { databaseName: 'tj-ws-1', contentRevision: 3 },
  catalogRevision: 1,
  journalRevision: 1,
  marketDataSnapshotId: 'mds1:1:abc',
  factRevisions: {},
  outstandingDebts: {},
};
const SETTLEMENT: SettlementItem = { tradeId: 't3', instrument: MNO_PUT, quantity: Rational.of(-2n), expiration: '2026-11-20', settlementTime: { kind: 'Value', value: '2026-11-20T21:00:00Z' } };
const markRow = (instrument: MarkRow['instrument'], key: string, trades: string[]): MarkRow => ({ instrument, instrumentKey: key, tradingDate: DATE, trades, resolution: { kind: 'Missing' }, resolutionRevision: 'None', task: 'Manual' });

const walked = (tradeId: string, underlying: string, over: Partial<WalkedTrade>): WalkedTrade => ({
  tradeId,
  underlying,
  lastActivity: '2026-10-12T14:00:00Z',
  band: 'Routine',
  reasons: [{ code: 'NoPressure' }],
  basis: { kind: 'Value', value: { side: 'None', share: Rational.of(0n, 1n) } },
  rangePosition: { kind: 'Value', value: { now: Rational.of(1n, 2n), atEntry: Rational.of(1n, 2n) } },
  progress: cardProgress(),
  ...over,
});
const T3 = walked('t3', 'MNO', { band: 'Blocker', reasons: [{ code: 'SettlementDue', instrument: MNO_PUT, quantity: SETTLEMENT.quantity, expiration: SETTLEMENT.expiration }], progress: cardProgress(0, 0, { needed: 3, resolved: 0, settlement: true }) });
const T2 = walked('t2', 'XYZ', { progress: cardProgress(0, 0, { needed: 1, resolved: 0 }) });

function review(over: Partial<Ready> = {}): Ready {
  return {
    kind: 'Ready',
    reviewDate: DATE,
    cutoff: CUTOFF,
    families: [
      { family: 'Marks', today: [markRow(MNO_PUT, PUT_KEY, ['t3']), markRow(MNO, 'MNO', ['t3']), markRow(XYZ, 'XYZ', ['t3', 't2'])], earlier: [] },
      { family: 'Settlement', items: [SETTLEMENT] },
      { family: 'Trades', trades: [T3, T2] },
    ],
    owed: [],
    completion: { kind: 'Incomplete', reasons: [{ code: 'MarkMissing', instrument: MNO_PUT, tradingDate: DATE, trades: ['t3'] }, { code: 'ActionMissing', tradeId: 't3' }] },
    binding,
    ...over,
  };
}

function tradeReview(tradeId: string, underlying: string, over: Partial<DailyTradeReview> = {}): DailyTradeReview {
  const walkedTrade = tradeId === 't3' ? T3 : T2;
  return {
    tradeId,
    underlying,
    lifecycle: 'Open',
    attention: walkedTrade,
    labels: { strategy: 'Cash-Secured Put', account: 'Main', institution: 'Broker' },
    settlement: tradeId === 't3' ? [SETTLEMENT] : [],
    reflections: [],
    progress: walkedTrade.progress,
    form: { kind: 'New', viewState: { selectedAction: 'Hold' } },
    definitionRevision: 'def1',
    saveBinding: {
      reviewDate: DATE,
      tradeId,
      factRevision: 2,
      marketDataSnapshotId: 'mds1:1:abc',
      obligationKey: { entryType: 'DailyTradeReview', trade: tradeId, reviewDate: DATE },
      definitionRevision: 'def1',
      databaseName: 'tj-ws-1',
    },
    ...over,
  };
}

function walkFacade(overview: Ready, ...trades: DailyTradeReview[]): UiFacade {
  const facade = facadeDouble();
  vi.mocked(facade.DailyReview.open).mockResolvedValue(overview);
  for (const trade of trades) vi.mocked(facade.DailyReview.getTrade).mockResolvedValueOnce({ kind: 'Ready', reviewDate: DATE, cutoff: CUTOFF, trade });
  return facade;
}

function renderReview(facade: UiFacade, at = '/review') {
  render(
    <RuntimeContext.Provider value={{ writable: true, timeZone: 'America/New_York', report: () => undefined }}>
      <MemoryRouter initialEntries={[at]}>
        <ReviewView facade={facade} now={() => '2026-11-20T22:00:00Z'} onDirtyChange={() => undefined} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

const markRegion = (card: HTMLElement, label: string) => within(card).getByRole('region', { name: `${label} Mark, Fri Nov 20` });

describe('option Marks (A115)', () => {
  it('should accept 0 for a contract with its explanatory note, and show Needed only while settlement is due on a task needed only by Settlement Due Trades', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(review(), tradeReview('t3', 'MNO'));
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Rejected', issues: [] });
    renderReview(facade);

    const card = await screen.findByRole('region', { name: 'MNO review' });
    // The contract is named by its label in the row heading and the row's region (convention C6), never by its OCC key.
    const marks = within(card).getByRole('region', { name: 'Marks' });
    expect(within(marks).getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual(['MNO 20 Nov 2026 45 Put', 'MNO', 'XYZ']);
    const contract = markRegion(card, 'MNO 20 Nov 2026 45 Put');

    // 0 is an honest closing value, with the note saying so, for every Instrument.
    await user.type(within(contract).getByLabelText('Price'), '0');
    expect(within(contract).getByText('0 means it closed with no value')).toBeTruthy();
    expect(within(markRegion(card, 'MNO')).getByText('0 means it closed with no value')).toBeTruthy();
    await user.click(within(marks).getByRole('button', { name: /^Save Marks/ }));
    expect(facade.DailyReview.save).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'SaveReviewMarks', entries: [{ key: { instrumentKey: PUT_KEY, tradingDate: DATE }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '0' } }] }),
    );

    // A task only the Settlement Due Trade needs says so; one a Trade without a due settlement also needs does not.
    expect(within(contract).getByText('Needed only while settlement is due')).toBeTruthy();
    expect(within(markRegion(card, 'MNO')).getByText('Needed only while settlement is due')).toBeTruthy();
    expect(within(markRegion(card, 'XYZ')).queryByText('Needed only while settlement is due')).toBeNull();
  });
});

type Evaluation = NonNullable<DailyTradeReview['evaluation']>;
const value = (n: bigint, d = 1n) => ({ kind: 'Value' as const, value: Rational.of(n, d) });
// The figures the card reads; every other evaluation field is out of this screen's sight.
const optionEvaluation = (): Evaluation =>
  ({
    kind: 'Evaluated',
    conditions: [],
    valuationDate: DATE,
    coverage: { kind: 'Available', revisionId: 'r1', revisionNumber: 1 },
    observation: { instrument: MNO_PUT, tradingDate: DATE, mark: { revisionId: 'r1', revisionNumber: 1, price: '0.45' } },
    currentMarkedPnl: value(160n),
    currentMarkedPnlInPlanR: value(2n),
    ongoingRiskToStop: value(400n),
    ongoingRiskToStopInPlanR: value(1n),
    worstCaseOngoingRisk: value(900n),
    worstCaseOngoingRiskInPlanR: value(2n),
    incrementalRewardToTarget: value(100n),
    incrementalRewardToTargetInPlanR: value(1n),
    rewardRiskNow: value(1n),
    planBaseline: { kind: 'Value' as const, value: { rewardRiskRatio: Rational.of(1n) } },
    atEntry: null,
  }) as unknown as Evaluation;

// Not in the breakdown: the other rows of K18 and 24.7 to 24.8, each against one card.
describe('a contract named by its label (conflict K18) and the card payoff summary', () => {
  it('should name the contract by its label in the Mark line, and word the Current payoff in one line', async () => {
    const payoff = payoffFixtures.osPayoffs();
    renderReview(walkFacade(review(), tradeReview('t3', 'MNO', { evaluation: optionEvaluation(), payoff })));

    const card = await screen.findByRole('region', { name: 'MNO review' });

    expect(within(card).getByText('Mark $0.45 for MNO 20 Nov 2026 45 Put, Fri Nov 20')).toBeTruthy();
    expect(within(card).getByText('At expiration: breakeven 43.76 · max profit $248.70 · max loss $8,751.30')).toBeTruthy();
  });

  it('should move focus to the contract row when the Mark blocker link is followed, and name the contract by its label in the blocker', async () => {
    const user = userEvent.setup();
    renderReview(walkFacade(review(), tradeReview('t3', 'MNO')));
    const card = await screen.findByRole('region', { name: 'MNO review' });

    const blockers = within(screen.getByRole('region', { name: 'Review status' })).getByRole('list', { name: 'Blockers' });
    expect(within(blockers).getByText(/^Mark missing for/).textContent).toBe('Mark missing for MNO 20 Nov 2026 45 Put on Fri Nov 20');
    await user.click(within(blockers).getByRole('link', { name: 'MNO 20 Nov 2026 45 Put' }));

    expect(markRegion(card, 'MNO 20 Nov 2026 45 Put').contains(document.activeElement)).toBe(true);
  });

  it('should word Market Datas AfterExpiration beside the contract row with the expiration date', async () => {
    const user = userEvent.setup();
    const facade = walkFacade(review(), tradeReview('t3', 'MNO'));
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Rejected', issues: [{ entryIndex: 0, field: 'tradingDate', code: 'AfterExpiration' }] } as never);
    renderReview(facade);
    const card = await screen.findByRole('region', { name: 'MNO review' });

    await user.type(within(markRegion(card, 'MNO 20 Nov 2026 45 Put')).getByLabelText('Price'), '0.10');
    await user.click(within(card).getByRole('button', { name: /^Save Marks/ }));

    expect(within(markRegion(card, 'MNO 20 Nov 2026 45 Put')).getByText('This contract expired on Fri Nov 20, so it has no Mark for a later date.')).toBeTruthy();
  });

  it('should list a contract acknowledged unavailable by its label', async () => {
    const complete = review({ completion: { kind: 'CompleteWithUnavailableMarks', instruments: [MNO_PUT], trades: ['t3'], families: ['Valuation'] } });
    renderReview(walkFacade(complete, tradeReview('t3', 'MNO')));

    const group = await screen.findByRole('group', { name: 'Unavailable Marks' });

    expect(within(group).getByText('Instruments: MNO 20 Nov 2026 45 Put')).toBeTruthy();
  });
});
