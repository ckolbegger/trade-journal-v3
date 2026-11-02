// The Closed-Trade Review fixture (breakdown D6, section 4, T6.11), built through the real module APIs:
// plans are confirmed and every fill and exit recorded by Trade Workflows, Marks saved by Market Data, and
// Actions by the Journal. Long Stock, 100 shares bought at 10:00 unless stated, every exit a Sell of the
// whole Position. Every exit's own Position Change Reflection is completed, so only the Debts named below
// are owed.
//
// The Workspace grows through two days on a movable clock: Monday's facts are recorded with the clock at
// Monday 17:00 (the Monday Review is opened between the phases, through `onMonday`), then Tuesday's with the
// clock at Tuesday 17:00.
//
//   T-A  XYZ  PC1 (60) and PC2 (40) Monday; X1 (Sell 30) Tuesday 10:00; still Open
//   T-K  KLM  bought Monday; sold Tuesday 11:00; Close Review completed
//   T-L  LMN  bought Tuesday 10:00; sold Tuesday 15:00; Close Review deferred
//   T-M  MNP  bought Monday; sold Monday 15:00; Close Review deferred
//   T-N  NOP  bought Monday; sold Tuesday 16:30, after the close; Close Review completed
//   T-P  PQR  bought Monday; sold Monday 12:00; Close Review completed
//   T-Q  QST  bought Tuesday 16:10, after the close, reflection deferred; still Open
//
// Tuesday's Marks (XYZ, NOP) and the Actions of the Trades Tuesday's Review walks (T-A, T-N) are saved, so only
// owed reflections can keep Tuesday's Review from completing.
import type { PositionChangeMember } from '../../src/coordinators/trade-workflows/index.ts';
import type { TradeAnalysisRecord } from '../../src/domain/trade-analysis/index.ts';
import { D5_JOURNAL_MANIFEST, type DebtProjection, type ReflectionDisposition } from '../../src/modules/journal/index.ts';
import { D6_CATALOG_MANIFEST } from '../../src/modules/reference-catalog/index.ts';
import { ELEVEN_AM, MONDAY_1700, reviewStack, TEN_AM, type ReviewStack } from './review-fixture.ts';

export const TUESDAY_1700 = '2026-10-13T21:00:00Z';
export const TUESDAY_REVIEW_DATE = '2026-10-13';
export const TUESDAY_CUTOFF = '2026-10-13T20:00:00Z';

const MONDAY_1200 = '2026-10-12T16:00:00Z';
const MONDAY_1500 = '2026-10-12T19:00:00Z';
const TUESDAY_PLAN = '2026-10-13T13:00:00Z';
const TUESDAY_1000 = '2026-10-13T14:00:00Z';
const TUESDAY_1100 = '2026-10-13T15:00:00Z';
const TUESDAY_1500 = '2026-10-13T19:00:00Z';
const TUESDAY_1610 = '2026-10-13T20:10:00Z';
const TUESDAY_1630 = '2026-10-13T20:30:00Z';

export type ClosedTradeName = 'A' | 'K' | 'L' | 'M' | 'N' | 'P' | 'Q';

const PLANS: Readonly<Record<ClosedTradeName, { symbol: string; entry: string; stop: string; target: string }>> = {
  A: { symbol: 'XYZ', entry: '50.00', stop: '47.50', target: '56.00' },
  K: { symbol: 'KLM', entry: '20.00', stop: '19.00', target: '25.00' },
  L: { symbol: 'LMN', entry: '30.00', stop: '28.00', target: '36.00' },
  M: { symbol: 'MNP', entry: '40.00', stop: '38.00', target: '46.00' },
  N: { symbol: 'NOP', entry: '25.00', stop: '23.00', target: '30.00' },
  P: { symbol: 'PQR', entry: '15.00', stop: '14.00', target: '18.00' },
  Q: { symbol: 'QST', entry: '10.00', stop: '9.00', target: '12.00' },
};

export interface ClosedTradeFixture {
  readonly stack: ReviewStack;
  // The identity of each Trade the fixture holds.
  readonly trades: Readonly<Partial<Record<ClosedTradeName, string>>>;
  // Every Outstanding Debt the Workspace holds when the fixture is complete, in [due anchor, Debt identity] order.
  readonly debts: readonly DebtProjection[];
}

export interface ClosedTradeFixtureOptions {
  // The Trades to build; every Trade when omitted.
  readonly only?: readonly ClosedTradeName[];
  // Called when Monday's facts are recorded and the clock reads Monday 17:00, before Tuesday's are.
  readonly onMonday?: (monday: Pick<ClosedTradeFixture, 'stack' | 'trades'>) => Promise<void>;
}

export async function closedTradeReviewFixture(options: ClosedTradeFixtureOptions = {}): Promise<ClosedTradeFixture> {
  const stack = await reviewStack(MONDAY_1700);
  const included = (name: ClosedTradeName) => options.only === undefined || options.only.includes(name);
  await stack.catalog.seedDefaults(D6_CATALOG_MANIFEST);
  const seeded = await stack.journal.seedDefaults(D5_JOURNAL_MANIFEST);
  if (seeded.kind !== 'Seeded') throw new Error(`Close Review seed failed: ${seeded.kind}`);
  const reasons = await stack.catalog.query({ family: 'CloseReason' });
  if (reasons.kind !== 'Page') throw new Error('no Close Reasons');
  const closeReview = await stack.journal.getDefinitions({ latestFor: 'entry-type.close-review' });
  if (closeReview.kind !== 'Found') throw new Error('no Close Review definition');
  const closeReasonId = reasons.items[0]!.id;
  const closeReviewDefinitionId = closeReview.definition.id;

  const completedCloseReview: ReflectionDisposition = {
    kind: 'Complete',
    form: {
      definitionId: closeReviewDefinitionId,
      answers: { 'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' } },
    },
  };
  const deferred: ReflectionDisposition = { kind: 'Defer' };

  const records: Partial<Record<ClosedTradeName, TradeAnalysisRecord>> = {};
  const plan = async (name: ClosedTradeName, planTime?: string) => {
    if (!included(name)) return;
    records[name] = await stack.confirm({ shares: '100', ...PLANS[name], ...(planTime && { planTime }) });
  };
  const recordOf = (name: ClosedTradeName) => records[name]!;
  // A Sell of the given quantity; `closeReview` makes it the Trade's terminal exit.
  const sell = async (name: ClosedTradeName, economicTime: string, quantity: string, price: string, closeReviewDisposition?: ReflectionDisposition) => {
    if (!included(name)) return;
    const trade = recordOf(name);
    const current = await stack.tradeRecord.getRecord({ tradeId: trade.tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    const member: PositionChangeMember = {
      kind: 'Execution',
      tradeId: trade.tradeId,
      action: 'Sell',
      instrument: { kind: 'Stock', symbol: trade.plan.underlying },
      intent: { kind: 'ServesPlannedLeg', plannedLegId: trade.plan.legs[0]!.factId },
      quantity,
      price,
      fee: '0.60',
      economicTime,
    };
    const result = await stack.tradeWorkflows.recordPositionChange({
      originTradeId: trade.tradeId,
      trades: [{ tradeId: trade.tradeId, expectedFactRevision: current.factRevision }],
      members: [member],
      reflection: stack.reflection,
      ...(closeReviewDisposition && { closeReasonId, closeReview: closeReviewDisposition }),
    });
    if (result.kind !== 'Recorded') throw new Error(`exit of ${name}: expected Recorded, got ${result.kind}`);
  };
  const buy = async (name: ClosedTradeName, economicTime: string, quantity: string, reflection?: ReflectionDisposition) => {
    if (included(name)) await stack.fill(recordOf(name), economicTime, quantity, PLANS[name].entry, reflection);
  };
  const tradeIds = () => Object.fromEntries(Object.entries(records).map(([name, record]) => [name, record.tradeId])) as Partial<Record<ClosedTradeName, string>>;

  // Monday.
  await plan('A');
  await buy('A', TEN_AM, '60');
  await buy('A', ELEVEN_AM, '40');
  for (const name of ['K', 'M', 'N', 'P'] as const) await plan(name);
  for (const name of ['K', 'M', 'N', 'P'] as const) await buy(name, TEN_AM, '100');
  await sell('P', MONDAY_1200, '100', '16.00', completedCloseReview);
  await sell('M', MONDAY_1500, '100', '41.00', deferred);
  await options.onMonday?.({ stack, trades: tradeIds() });

  // Tuesday.
  stack.clock.now = () => TUESDAY_1700;
  await sell('A', TUESDAY_1000, '30', '52.00');
  await sell('K', TUESDAY_1100, '100', '21.00', completedCloseReview);
  await plan('L', TUESDAY_PLAN);
  await buy('L', TUESDAY_1000, '100');
  await sell('L', TUESDAY_1500, '100', '31.00', deferred);
  await sell('N', TUESDAY_1630, '100', '26.00', completedCloseReview);
  await plan('Q', TUESDAY_PLAN);
  await buy('Q', TUESDAY_1610, '100', deferred);

  // Tuesday's Review walks T-A and T-N.
  for (const name of ['A', 'N'] as const) {
    if (!included(name)) continue;
    await stack.saveMark(PLANS[name].symbol, name === 'A' ? '52.00' : '26.00', TUESDAY_REVIEW_DATE);
    await stack.saveAction(recordOf(name).tradeId, 'Hold', TUESDAY_REVIEW_DATE);
  }

  const outstanding = await stack.journal.query({ scope: 'OutstandingDebt' });
  return { stack, trades: tradeIds(), debts: outstanding.debts };
}
