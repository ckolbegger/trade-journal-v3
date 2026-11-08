import { describe, expect, it } from 'vitest';
import { instrumentKey } from '../../domain/instrument/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { D7_CATALOG_MANIFEST, type StrategyRecord } from '../../modules/reference-catalog/index.ts';
import { reviewStack, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import type { ConfirmPlanCommand, PositionChangeMember } from '../trade-workflows/index.ts';
import type { OpenDailyReviewResult } from './index.ts';

// D7 section 4's O-C (PC1, PC2) and O-S (S1) on Tuesday 10-13, 17:00 New York (daylight time, 21:00Z).
const TUESDAY_1700 = '2026-10-13T21:00:00Z';
const TUESDAY = '2026-10-13';
const PLAN = '2026-10-12T13:00:00Z';
const MONDAY_10 = '2026-10-12T14:00:00Z';
const MONDAY_11 = '2026-10-12T15:00:00Z';

const XYZ_CALL = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', right: 'Call', strike: '55', multiplier: 100 } as const;
const MNO_PUT = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-11-20', right: 'Put', strike: '45', multiplier: 100 } as const;
type Contract = typeof XYZ_CALL | typeof MNO_PUT;

async function strategyOf(stack: ReviewStack, productKey: string): Promise<StrategyRecord> {
  const strategies = await stack.catalog.query({ family: 'Strategy' });
  if (strategies.kind !== 'Page') throw new Error('no strategies');
  const found = strategies.items.find((s): s is StrategyRecord => s.kind === 'Strategy' && s.productKey === productKey);
  if (!found) throw new Error(`no ${productKey}`);
  return found;
}

async function fixture() {
  const stack = await reviewStack(TUESDAY_1700);
  await stack.catalog.seedDefaults(D7_CATALOG_MANIFEST);
  const reflection = {
    definitionId: stack.definition.id,
    answers: { 'prompt.plan-reflection.thesis': { kind: 'Text', text: 'The setup is worth the risk.' }, 'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close beyond the stop.' } },
  } as const;
  const confirm = async (productKey: string, plan: ConfirmPlanCommand['plan']) => {
    const strategy = await strategyOf(stack, productKey);
    const confirmed = await stack.tradeWorkflows.confirmPlan({ accountId: stack.account.id, accountRevision: stack.account.recordRevision, strategyId: strategy.id, strategyRevision: strategy.recordRevision, economicTime: PLAN, plan, reflection });
    if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
    return confirmed.postCommit.trade.tradeId;
  };
  const fill = async (tradeId: string, instrument: Contract, action: 'Buy' | 'Sell', economicTime: string, quantity: string, price: string, fee: string) => {
    const current = await stack.tradeRecord.getRecord({ tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    const legId = (current.projection as unknown as { plan: { legs: { factId: string }[] } }).plan.legs[0]!.factId;
    const members: PositionChangeMember[] = [{ kind: 'Execution', tradeId, action, instrument, intent: { kind: 'ServesPlannedLeg', plannedLegId: legId }, quantity, price, fee, economicTime }];
    const result = await stack.tradeWorkflows.recordPositionChange({ originTradeId: tradeId, trades: [{ tradeId, expectedFactRevision: current.factRevision }], members, reflection: stack.reflection });
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(result)}`);
  };
  return { stack, confirm, fill };
}

async function longCall(callMark: string, underlyingMark: string) {
  const { stack, confirm, fill } = await fixture();
  const tradeId = await confirm('strategy.long-call', { underlying: 'XYZ', legs: [{ side: 'Long', instrument: XYZ_CALL, quantity: '2', intendedEntry: '2.00' }], stops: [{ kind: 'UnderlyingPrice', price: '48.00' }], targets: [{ kind: 'UnderlyingPrice', price: '60.00' }], exerciseIntent: 'NotAuthorized' });
  await fill(tradeId, XYZ_CALL, 'Buy', MONDAY_10, '1', '2.10', '0.65');
  await fill(tradeId, XYZ_CALL, 'Buy', MONDAY_11, '1', '1.90', '0.65');
  await stack.saveMark(instrumentKey(XYZ_CALL), callMark, TUESDAY);
  await stack.saveMark('XYZ', underlyingMark, TUESDAY);
  return { stack, tradeId };
}

async function shortPut() {
  const { stack, confirm, fill } = await fixture();
  const tradeId = await confirm('strategy.cash-secured-put', { underlying: 'MNO', legs: [{ side: 'Short', instrument: MNO_PUT, quantity: '-2', intendedEntry: '1.20' }], stops: [{ kind: 'UnderlyingPrice', price: '42.00' }], targets: [{ kind: 'UnderlyingPrice', price: '50.00' }] });
  await fill(tradeId, MNO_PUT, 'Sell', MONDAY_10, '2', '1.25', '1.30');
  await stack.saveMark(instrumentKey(MNO_PUT), '0.80', TUESDAY);
  await stack.saveMark('MNO', '47.00', TUESDAY);
  return { stack, tradeId };
}

function ready(result: OpenDailyReviewResult) {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result;
}

async function figures(stack: ReviewStack, tradeId: string) {
  const review = ready(await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 }));
  const trades = review.families.find((f) => f.family === 'Trades');
  if (trades?.family !== 'Trades') throw new Error('no Trades family');
  const walked = trades.trades.find((t) => t.tradeId === tradeId);
  if (!walked) throw new Error('Trade not walked');
  const card = await stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId, binding: review.binding });
  if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);
  return { basis: walked.basis, walkedRange: walked.rangePosition, cardRange: card.trade.attention.rangePosition };
}

const r = (n: bigint, d: bigint) => Rational.of(n, d);

describe('pressure and range position for options (decision 88)', () => {
  it('should give O-C after PC1 and PC2, with the call at 2.40 and XYZ 52.00, pressure 2/15 on its winning side and range position 12/25 now, 2/5 at entry', async () => {
    const { stack, tradeId } = await longCall('2.40', '52.00');

    const { basis, walkedRange, cardRange } = await figures(stack, tradeId);

    expect(basis).toEqual({ kind: 'Value', value: { side: 'Winning', share: r(2n, 15n), atEntry: r(600n, 1n), now: r(520n, 1n) } });
    for (const range of [walkedRange, cardRange]) {
      expect(range).toEqual({ kind: 'Value', value: { now: r(12n, 25n), atEntry: r(2n, 5n) } });
    }
  }, 60_000);

  it('should give O-C with the call at 1.60 and XYZ 50.00 pressure 1/5 on its losing side and range position 8/25 now, 2/5 at entry', async () => {
    const { stack, tradeId } = await longCall('1.60', '50.00');

    const { basis, walkedRange, cardRange } = await figures(stack, tradeId);

    expect(basis).toEqual({ kind: 'Value', value: { side: 'Losing', share: r(1n, 5n), atEntry: r(400n, 1n), now: r(320n, 1n) } });
    for (const range of [walkedRange, cardRange]) {
      expect(range).toEqual({ kind: 'Value', value: { now: r(8n, 25n), atEntry: r(2n, 5n) } });
    }
  }, 60_000);

  it('should give O-S after S1, with the put at 0.80 and MNO 47.00, pressure 9/25 on its winning side and range position 11/15 now, 7/12 at entry', async () => {
    const { stack, tradeId } = await shortPut();

    const { basis, walkedRange, cardRange } = await figures(stack, tradeId);

    expect(basis).toEqual({ kind: 'Value', value: { side: 'Winning', share: r(9n, 25n), atEntry: r(250n, 1n), now: r(160n, 1n) } });
    for (const range of [walkedRange, cardRange]) {
      expect(range).toEqual({ kind: 'Value', value: { now: r(11n, 15n), atEntry: r(7n, 12n) } });
    }
  }, 60_000);
});
