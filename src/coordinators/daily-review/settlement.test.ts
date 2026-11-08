import { describe, expect, it } from 'vitest';
import { instrumentKey, type OptionInstrument } from '../../domain/instrument/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { D7_CATALOG_MANIFEST, type StrategyRecord } from '../../modules/reference-catalog/index.ts';
import { reviewStack, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import type { ConfirmPlanCommand, PositionChangeMember } from '../trade-workflows/index.ts';
import { createDailyReview, type OpenDailyReviewResult, type ReviewFamily } from './index.ts';
import type { ReflectionDisposition } from '../../modules/journal/index.ts';

// D7 section 4, the Settlement Review fixture of T7.14. New York is on daylight time until 2026-11-01 and on
// standard time after it, so 10:00 is 14:00Z on 10-12 and 15:00Z in the week of 11-16.
const FRIDAY_1700 = '2026-11-20T22:00:00Z';
const MONDAY_NEXT_1700 = '2026-11-23T22:00:00Z';
const FRIDAY_CLOSE = { kind: 'Value', value: '2026-11-20T21:00:00Z' } as const;
const OC_PLAN = '2026-10-12T13:00:00Z';
const OC_10 = '2026-10-12T14:00:00Z';
const OC_11 = '2026-10-12T15:00:00Z';
const TUESDAY_10 = '2026-10-13T14:00:00Z';
const WEEK_PLAN = '2026-11-16T14:00:00Z';
const WEEK_10 = '2026-11-16T15:00:00Z';
const THURSDAY_10 = '2026-11-19T15:00:00Z';

const XYZ_CALL = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', right: 'Call', strike: '55', multiplier: 100 } as const;
const MNO_PUT = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-11-20', right: 'Put', strike: '45', multiplier: 100 } as const;
const ABC_PUT = { kind: 'Option', symbol: 'ABC', root: 'ABC', expiration: '2026-12-18', right: 'Put', strike: '50', multiplier: 100 } as const;
type Contract = OptionInstrument;

async function strategyOf(stack: ReviewStack, productKey: string): Promise<StrategyRecord> {
  const strategies = await stack.catalog.query({ family: 'Strategy' });
  if (strategies.kind !== 'Page') throw new Error('no strategies');
  const found = strategies.items.find((s): s is StrategyRecord => s.kind === 'Strategy' && s.productKey === productKey);
  if (!found) throw new Error(`no ${productKey}`);
  return found;
}

async function settlementFixture(now: string, withMarks: boolean) {
  const stack = await reviewStack(now);
  await stack.catalog.seedDefaults(D7_CATALOG_MANIFEST);
  const planReflection = {
    definitionId: stack.definition.id,
    answers: { 'prompt.plan-reflection.thesis': { kind: 'Text', text: 'The setup is worth the risk.' }, 'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close beyond the stop.' } },
  } as const;

  const confirm = async (productKey: string, economicTime: string, plan: ConfirmPlanCommand['plan']) => {
    const strategy = await strategyOf(stack, productKey);
    const confirmed = await stack.tradeWorkflows.confirmPlan({ accountId: stack.account.id, accountRevision: stack.account.recordRevision, strategyId: strategy.id, strategyRevision: strategy.recordRevision, economicTime, plan, reflection: planReflection });
    if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
    return confirmed.postCommit.trade;
  };

  const record = async (tradeId: string, members: (legId: string) => PositionChangeMember[], disposition: ReflectionDisposition = stack.reflection) => {
    const current = await stack.tradeRecord.getRecord({ tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    const legId = (current.projection as unknown as { plan: { legs: { factId: string }[] } }).plan.legs[0]!.factId;
    const result = await stack.tradeWorkflows.recordPositionChange({ originTradeId: tradeId, trades: [{ tradeId, expectedFactRevision: current.factRevision }], members: members(legId), reflection: disposition });
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(result)}`);
  };
  const optionFill = (tradeId: string, instrument: Contract, action: 'Buy' | 'Sell', economicTime: string, quantity: string, price: string, fee: string) => (legId: string): PositionChangeMember[] => [
    { kind: 'Execution', tradeId, action, instrument, intent: { kind: 'ServesPlannedLeg', plannedLegId: legId }, quantity, price, fee, economicTime },
  ];
  const stockBuy = (tradeId: string, symbol: string, economicTime: string, quantity: string, price: string) => (legId: string): PositionChangeMember[] => [
    { kind: 'Execution', tradeId, action: 'Buy', instrument: { kind: 'Stock', symbol }, intent: { kind: 'ServesPlannedLeg', plannedLegId: legId }, quantity, price, fee: '1.00', economicTime },
  ];

  // T-1: O-C through X1, leaving 1 contract.
  const t1 = await confirm('strategy.long-call', OC_PLAN, { underlying: 'XYZ', legs: [{ side: 'Long', instrument: XYZ_CALL, quantity: '2', intendedEntry: '2.00' }], stops: [{ kind: 'UnderlyingPrice', price: '48.00' }], targets: [{ kind: 'UnderlyingPrice', price: '60.00' }], exerciseIntent: 'NotAuthorized' });
  await record(t1.tradeId, optionFill(t1.tradeId, XYZ_CALL, 'Buy', OC_10, '1', '2.10', '0.65'));
  await record(t1.tradeId, optionFill(t1.tradeId, XYZ_CALL, 'Buy', OC_11, '1', '1.90', '0.65'));
  await record(t1.tradeId, optionFill(t1.tradeId, XYZ_CALL, 'Sell', TUESDAY_10, '1', '3.00', '0.65'));
  // T-2: Long Stock XYZ, 100 shares since Monday 10-12.
  const t2 = await confirm('strategy.long-stock', OC_PLAN, { underlying: 'XYZ', legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50.00' }], stops: [{ kind: 'UnderlyingPrice', price: '47.50' }], targets: [{ kind: 'UnderlyingPrice', price: '56.00' }] });
  await record(t2.tradeId, stockBuy(t2.tradeId, 'XYZ', OC_10, '100', '50.00'));
  // T-3: O-S after S1, 2 short.
  const t3 = await confirm('strategy.cash-secured-put', OC_PLAN, { underlying: 'MNO', legs: [{ side: 'Short', instrument: MNO_PUT, quantity: '-2', intendedEntry: '1.20' }], stops: [{ kind: 'UnderlyingPrice', price: '42.00' }], targets: [{ kind: 'UnderlyingPrice', price: '50.00' }] });
  await record(t3.tradeId, optionFill(t3.tradeId, MNO_PUT, 'Sell', OC_10, '2', '1.25', '1.30'));
  // T-4: Long Put ABC 18 Dec 2026 50 Put, 1 contract since 11-16.
  const t4 = await confirm('strategy.long-put', WEEK_PLAN, { underlying: 'ABC', legs: [{ side: 'Long', instrument: ABC_PUT, quantity: '1', intendedEntry: '1.50' }], stops: [{ kind: 'UnderlyingPrice', price: '55.00' }], targets: [{ kind: 'UnderlyingPrice', price: '45.00' }], exerciseIntent: 'Authorized' });
  await record(t4.tradeId, optionFill(t4.tradeId, ABC_PUT, 'Buy', WEEK_10, '1', '1.50', '0.65'));
  // T-5: Long Stock KLM since 11-16, with a reflection on a Thursday 11-19 10:00 add deferred.
  const t5 = await confirm('strategy.long-stock', WEEK_PLAN, { underlying: 'KLM', legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'KLM' }, quantity: '100', intendedEntry: '20.00' }], stops: [{ kind: 'UnderlyingPrice', price: '19.00' }], targets: [{ kind: 'UnderlyingPrice', price: '25.00' }] });
  await record(t5.tradeId, stockBuy(t5.tradeId, 'KLM', WEEK_10, '50', '20.00'));
  await record(t5.tradeId, stockBuy(t5.tradeId, 'KLM', THURSDAY_10, '50', '20.50'), { kind: 'Defer' });

  if (withMarks) {
    const friday = '2026-11-20';
    await stack.saveMark(instrumentKey(XYZ_CALL), '0.05', friday);
    await stack.saveMark(instrumentKey(MNO_PUT), '0.00', friday);
    await stack.saveMark('MNO', '46.00', friday);
    await stack.saveMark(instrumentKey(ABC_PUT), '1.20', friday);
    await stack.saveMark('ABC', '49.00', friday);
    await stack.saveMark('KLM', '20.50', friday);
  }
  return { stack, confirm, record, optionFill, t1: t1.tradeId, t2: t2.tradeId, t3: t3.tradeId, t4: t4.tradeId, t5: t5.tradeId };
}

function ready(result: OpenDailyReviewResult) {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result;
}

const open = (stack: ReviewStack, asOf: string) => stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf });

function family<N extends ReviewFamily['family']>(result: OpenDailyReviewResult, name: N) {
  const found = ready(result).families.find((f) => f.family === name);
  if (!found) throw new Error(`no ${name} family`);
  return found as Extract<ReviewFamily, { family: N }>;
}

describe('after the expiration session (P25, A110)', () => {
  it('should, at Monday 17:00 with nothing recorded, keep T-1 and T-3 Settlement Due and walked with settlement time Friday 16:00, and list no Mark task for either contract or for MNO, while XYZ task names T-2 only', async () => {
    const { stack, t1, t2, t3 } = await settlementFixture(MONDAY_NEXT_1700, false);

    const result = await open(stack, MONDAY_NEXT_1700);

    expect(ready(result)).toEqual(expect.objectContaining({ reviewDate: '2026-11-23' }));
    expect(family(result, 'Settlement').items.map(({ tradeId, settlementTime }) => ({ tradeId, settlementTime }))).toEqual([
      { tradeId: t1, settlementTime: FRIDAY_CLOSE },
      { tradeId: t3, settlementTime: FRIDAY_CLOSE },
    ]);
    const walked = family(result, 'Trades').trades;
    for (const id of [t1, t3]) {
      const trade = walked.find((candidate) => candidate.tradeId === id);
      expect(trade?.band).toBe('Blocker');
      expect(trade?.reasons).toEqual([expect.objectContaining({ code: 'SettlementDue' })]);
    }
    const rows = family(result, 'Marks').today;
    expect(rows.map((row) => row.instrumentKey)).not.toContain('XYZ261120C00055000');
    expect(rows.map((row) => row.instrumentKey)).not.toContain('MNO261120P00045000');
    expect(rows.map((row) => row.instrumentKey)).not.toContain('MNO');
    expect(rows.find((row) => row.instrumentKey === 'XYZ')).toEqual(expect.objectContaining({ trades: [t2], task: 'Manual' }));
  }, 60_000);

  it('should name among the completion blockers XYZ Mark, both settlements, every missing Action, and T-5 reflection', async () => {
    const { stack, t1, t2, t3, t4, t5 } = await settlementFixture(FRIDAY_1700, true);

    const { completion } = ready(await open(stack, FRIDAY_1700));

    if (completion.kind !== 'Incomplete') throw new Error(`expected Incomplete, got ${completion.kind}`);
    const codes = completion.reasons.map((reason) => (reason.code === 'MarkMissing' ? `MarkMissing:${instrumentKey(reason.instrument)}` : `${reason.code}:${'tradeId' in reason ? reason.tradeId : ''}`));
    // Marks first, then the settlements by Trade, then the walk's Actions and reflections.
    expect(codes.slice(0, 3)).toEqual(['MarkMissing:XYZ', `SettlementDue:${t1}`, `SettlementDue:${t3}`]);
    expect(codes.slice(3).filter((code) => code.startsWith('ActionMissing')).sort()).toEqual([t1, t2, t3, t4, t5].map((id) => `ActionMissing:${id}`).sort());
    expect(codes).toContain(`ReflectionDue:${t5}`);
    expect(codes).toHaveLength(9);
  }, 60_000);

  it('should return, in order, the Marks family naming T-1 and T-2 for XYZ, the settlement family with T-1 then T-3, the walk with T-1 and T-3 in the blocker band, and an empty owed-reflection group', async () => {
    const { stack, t1, t2, t3 } = await settlementFixture(FRIDAY_1700, true);

    const result = await open(stack, FRIDAY_1700);

    expect(ready(result).families.map((f) => f.family)).toEqual(['Marks', 'Settlement', 'Trades']);
    const xyz = family(result, 'Marks').today.find((row) => row.instrumentKey === 'XYZ');
    expect(xyz).toEqual(expect.objectContaining({ task: 'Manual', trades: expect.arrayContaining([t1, t2]) as unknown }));
    expect(xyz?.trades).toHaveLength(2);
    expect(family(result, 'Settlement').items.map((item) => ({ ...item, instrument: instrumentKey(item.instrument) }))).toEqual([
      { tradeId: t1, instrument: 'XYZ261120C00055000', quantity: Rational.of(1n), expiration: '2026-11-20', settlementTime: FRIDAY_CLOSE },
      { tradeId: t3, instrument: 'MNO261120P00045000', quantity: Rational.of(-2n), expiration: '2026-11-20', settlementTime: FRIDAY_CLOSE },
    ]);
    const walk = family(result, 'Trades').trades;
    expect(walk).toHaveLength(5);
    expect(walk.slice(0, 2).map((t) => t.tradeId).sort()).toEqual([t1, t3].sort());
    for (const trade of walk.slice(0, 2)) {
      expect(trade.band).toBe('Blocker');
      expect(trade.reasons).toEqual([expect.objectContaining({ code: 'SettlementDue' })]);
    }
    expect(ready(result).owed).toEqual([]);
  }, 60_000);
});

async function cardOf(stack: ReviewStack, asOf: string, tradeId: string) {
  const review = ready(await open(stack, asOf));
  const card = await stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId, binding: review.binding });
  if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);
  return card.trade;
}

describe('settlement and payoff in the card', () => {
  it('should return T-3 card with its Settlement Due item, the Record expiration route with the settlement time, the assignment explanation, its Review-date evaluation, its Current payoff summary, and its value at expiration at MNO close, and T-4 with payoff and value at expiration and no settlement item', async () => {
    const { stack, t3, t4 } = await settlementFixture(FRIDAY_1700, true);

    const card = await cardOf(stack, FRIDAY_1700, t3);

    // The item carries the route's settlement time and, by its negative quantity, the assignment explanation.
    expect(card.settlement.map((item) => ({ ...item, instrument: instrumentKey(item.instrument) }))).toEqual([
      { tradeId: t3, instrument: 'MNO261120P00045000', quantity: Rational.of(-2n), expiration: '2026-11-20', settlementTime: FRIDAY_CLOSE },
    ]);
    expect(card.evaluation).toEqual(expect.objectContaining({ kind: 'Evaluated', valuationDate: '2026-11-20' }));
    expect(card.progress.panels.map((panel) => panel.panel)).toEqual(['Marks', 'Reflections', 'Settlement', 'Action']);
    expect(card.progress.panels.find((panel) => panel.panel === 'Settlement')).toEqual({ panel: 'Settlement', done: false, needed: true });
    const current = card.payoff?.current;
    if (current?.kind !== 'Value') throw new Error(`expected a Current view, got ${current?.kind}`);
    expect(current.value.zeroSet).toEqual([{ kind: 'Crossing', price: Rational.of(437565n, 10000n) }]);
    expect(current.value.maximum).toEqual(expect.objectContaining({ kind: 'Value', value: expect.objectContaining({ value: Rational.of(24870n, 100n) }) as unknown }));
    expect(current.value.minimum).toEqual(expect.objectContaining({ kind: 'Value', value: expect.objectContaining({ value: Rational.of(-875130n, 100n) }) as unknown }));
    expect(card.evaluation?.expirationValueAtUnderlyingClose).toEqual({ kind: 'Value', value: { underlyingPrice: Rational.of(46n), value: Rational.of(24870n, 100n) } });

    const longPut = await cardOf(stack, FRIDAY_1700, t4);

    expect(longPut.settlement).toEqual([]);
    expect(longPut.progress.panels.map((panel) => panel.panel)).toEqual(['Marks', 'Reflections', 'Action']);
    expect(longPut.payoff?.current.kind).toBe('Value');
    expect(longPut.evaluation?.expirationValueAtUnderlyingClose).toEqual({ kind: 'Value', value: { underlyingPrice: Rational.of(49n), value: Rational.of(-5065n, 100n) } });
  }, 60_000);

  it('should return T-3 card at Monday 17:00, after the expiration session, with its Settlement Due item and no Mark-dependent figures, without needing a frame for MNO', async () => {
    const { stack, t3 } = await settlementFixture(MONDAY_NEXT_1700, false);

    const card = await cardOf(stack, MONDAY_NEXT_1700, t3);

    expect(card.settlement.map(({ tradeId, quantity, settlementTime }) => ({ tradeId, quantity, settlementTime }))).toEqual([{ tradeId: t3, quantity: Rational.of(-2n), settlementTime: FRIDAY_CLOSE }]);
    expect(card.evaluation?.currentMarkedPnl).toEqual(expect.objectContaining({ kind: 'Unavailable', reason: 'SettlementDue' }));
    expect(card.evaluation?.expirationValueAtUnderlyingClose).toEqual(expect.objectContaining({ kind: 'Unavailable', reason: 'SettlementDue' }));
    expect(card.progress.panels.find((panel) => panel.panel === 'Settlement')).toEqual({ panel: 'Settlement', done: false, needed: true });
  }, 60_000);
});

describe('the Instrument of a Marks row (K18)', () => {
  it('should give each Marks row and its MarkMissing blocker the Instrument the Trade holds, so a dotted symbol keeps its dot', async () => {
    const { stack, confirm, record, optionFill } = await settlementFixture(FRIDAY_1700, false);
    // BRK.B's OCC root has no dot: a label parsed from the key would read BRKB.
    const BRK_CALL = { kind: 'Option', symbol: 'BRK.B', root: 'BRKB', expiration: '2026-12-18', right: 'Call', strike: '400', multiplier: 100 } as const;
    const brk = await confirm('strategy.long-call', WEEK_PLAN, { underlying: 'BRK.B', legs: [{ side: 'Long', instrument: BRK_CALL, quantity: '1', intendedEntry: '5.00' }], stops: [{ kind: 'UnderlyingPrice', price: '380.00' }], targets: [{ kind: 'UnderlyingPrice', price: '440.00' }], exerciseIntent: 'NotAuthorized' });
    await record(brk.tradeId, optionFill(brk.tradeId, BRK_CALL, 'Buy', WEEK_10, '1', '5.00', '0.65'));

    const result = await open(stack, FRIDAY_1700);

    const row = family(result, 'Marks').today.find((candidate) => candidate.instrumentKey === instrumentKey(BRK_CALL));
    expect(row?.instrument).toEqual(BRK_CALL);
    const { completion } = ready(result);
    const blocker = completion.kind === 'Incomplete' ? completion.reasons.find((reason) => reason.code === 'MarkMissing' && instrumentKey(reason.instrument) === instrumentKey(BRK_CALL)) : undefined;
    expect(blocker).toEqual(expect.objectContaining({ instrument: BRK_CALL }));
  }, 60_000);
});

describe('the dated last close of an option card (T7.24 known defect)', () => {
  it('should give an option card no dated last close when its contract has only a Stale context, since the Underlying frame is not the contract', async () => {
    const { stack, t4 } = await settlementFixture(FRIDAY_1700, false);
    // The Long Put has a Mark only for Thursday, so Friday's contract Mark is Missing with that Stale context.
    await stack.saveMark(instrumentKey(ABC_PUT), '1.30', '2026-11-19');
    await stack.saveMark('ABC', '49.00', '2026-11-20');

    const card = await cardOf(stack, FRIDAY_1700, t4);

    expect(card.evaluation?.staleContext).toEqual(expect.objectContaining({ tradingDate: '2026-11-19', price: '1.3' }));
    expect(card.datedLastClose).toBeUndefined();
  }, 60_000);
});

// Not in the breakdown: the T7.23-B5 ocr asked for a Review case with one covered and one uncovered item, and the Review
// shows an Expiration on the owed reflection of the Position Change that recorded it (row 21.14).
describe('settlement items outside and inside calendar coverage (D7 Q1)', () => {
  it('should give an unavailable settlement time to an item whose expiration date is outside calendar coverage, and the close to the covered one, listing both Trades', async () => {
    const { stack, confirm, record, optionFill, t1, t3 } = await settlementFixture(MONDAY_NEXT_1700, false);
    const OLD_CALL = { kind: 'Option', symbol: 'BCD', root: 'BCD', expiration: '2026-11-13', right: 'Call', strike: '30', multiplier: 100 } as const;
    const old = await confirm('strategy.long-call', '2026-11-02T14:00:00Z', { underlying: 'BCD', legs: [{ side: 'Long', instrument: OLD_CALL, quantity: '1', intendedEntry: '1.00' }], stops: [{ kind: 'UnderlyingPrice', price: '27.00' }], targets: [{ kind: 'UnderlyingPrice', price: '35.00' }], exerciseIntent: 'NotAuthorized' });
    await record(old.tradeId, optionFill(old.tradeId, OLD_CALL, 'Buy', '2026-11-03T15:00:00Z', '1', '1.00', '0.65'));
    // The calendar does not cover that expiration date (a stand-in for a date outside 2024 to 2028): Market Data refuses its session.
    const marketData = {
      ...stack.marketData,
      query: (query: Parameters<typeof stack.marketData.query>[0]) =>
        query.kind === 'ResolveSession' && query.context.kind === 'Historical' && query.context.tradingDate === OLD_CALL.expiration
          ? Promise.resolve({ kind: 'Rejected' as const, issues: [{ field: 'tradingDate' as const, code: 'SessionPolicyCoverage' as const }] })
          : stack.marketData.query(query),
    };
    const dailyReview = createDailyReview({ ...stack, marketData });

    const result = await dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_NEXT_1700 });

    const items = family(result, 'Settlement').items.map(({ tradeId, settlementTime }) => ({ tradeId, settlementTime }));
    expect(items).toEqual([
      { tradeId: old.tradeId, settlementTime: { kind: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: OLD_CALL, date: '2026-11-13' } },
      { tradeId: t1, settlementTime: FRIDAY_CLOSE },
      { tradeId: t3, settlementTime: FRIDAY_CLOSE },
    ]);
    expect(family(result, 'Trades').trades.map((trade) => trade.tradeId)).toContain(old.tradeId);
  }, 60_000);

  it('should carry the recorded Expiration on the owed reflection of the Position Change that settled the Trade', async () => {
    const { stack, t3 } = await settlementFixture(MONDAY_NEXT_1700, false);
    const current = await stack.tradeRecord.getRecord({ tradeId: t3, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    const recorded = await stack.tradeWorkflows.recordPositionChange({
      originTradeId: t3,
      trades: [{ tradeId: t3, expectedFactRevision: current.factRevision }],
      members: [{ kind: 'Expiration', tradeId: t3, instrument: MNO_PUT, quantity: '2', economicTime: FRIDAY_CLOSE.value }],
      reflection: { kind: 'Defer' },
      closeReview: { kind: 'Defer' },
    });
    if (recorded.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(recorded)}`);
    const review = ready(await open(stack, MONDAY_NEXT_1700));

    const card = await stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId: t3, binding: review.binding });

    if (card.kind !== 'ReflectionsOwed') throw new Error(`expected ReflectionsOwed, got ${card.kind}`);
    // The Position Change Reflection and the Close Review both follow that Position Change, so each carries its Expiration.
    const expirations = card.card.reflections.map((reflection) => (reflection.settlements ?? []).map(({ instrument, quantity, economicTime }) => ({ instrument: instrumentKey(instrument), quantity, economicTime })));
    const expired = { instrument: 'MNO261120P00045000', quantity: '2', economicTime: FRIDAY_CLOSE.value };
    expect(expirations).toEqual([[expired], [expired]]);
  }, 60_000);
});
