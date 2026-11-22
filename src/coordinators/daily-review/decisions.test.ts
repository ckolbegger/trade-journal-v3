import { describe, expect, it } from 'vitest';
import { instrumentKey } from '../../domain/instrument/index.ts';
import { Rational } from '../../domain/values/index.ts';
import { D7_CATALOG_MANIFEST, type StrategyRecord } from '../../modules/reference-catalog/index.ts';
import type { CalculationResult } from '../../domain/trade-analysis/index.ts';
import { countRequests } from '../../../tests/support/request-counter.ts';
import { MONDAY_1700, reviewStack, type ReviewStack } from '../../../tests/support/review-fixture.ts';

// T95.8: the card's last decisions (A305, P168).

// A stock Trade bought Mon 10-05 (stop 47.50, target 56.00), reviewed on Monday 10-12. Sessions before the Review Date: 10-05 to 10-09.
async function heldTrade() {
  const stack = await reviewStack(MONDAY_1700);
  const planned = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-05T13:00:00Z' });
  await stack.fill(planned, '2026-10-05T14:00:00Z', '100', '50.00');
  return { stack, tradeId: planned.tradeId };
}

async function card(stack: ReviewStack, tradeId: string) {
  const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
  if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
  const result = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  const { decisions } = result.trade;
  if (!decisions) throw new Error('the card carries no decisions');
  return { ...result.trade, decisions };
}

const sign = (result: CalculationResult<Rational> | undefined) => (result?.kind === 'Value' ? result.value.compare(Rational.of(0n)) : undefined);

const DAYS = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'] as const;

async function marks(stack: ReviewStack, prices: Record<string, string>) {
  for (const [date, price] of Object.entries(prices)) await stack.saveMark('XYZ', price, date);
}

describe('getTrade: the last decisions (A305)', () => {
  it('should list the four most recent Actions before the Review Date, newest first, each with that session Trade P&L', async () => {
    const { stack, tradeId } = await heldTrade();
    const marks = ['51.00', '52.00', '49.00', '50.50', '53.00'];
    for (const [i, date] of DAYS.entries()) {
      await stack.saveMark('XYZ', marks[i]!, date);
      await stack.saveAction(tradeId, i === 3 ? 'Adjust' : 'Hold', date);
    }
    // Saved for the Review Date itself, so it is not a last decision.
    await stack.saveAction(tradeId, 'Exit', '2026-10-12');

    const { decisions } = await card(stack, tradeId);

    expect(decisions.recent.map((d) => [d.date, d.action])).toEqual([['2026-10-09', 'Hold'], ['2026-10-08', 'Adjust'], ['2026-10-07', 'Hold'], ['2026-10-06', 'Hold']]);
    const pnl = (date: string) => decisions.recent.find((d) => d.date === date)!.tradePnl;
    // Bought at 50.00: a gain at 53.00 on 10-09, a loss at 49.00 on 10-07.
    expect(sign(pnl('2026-10-09'))).toBe(1);
    expect(sign(pnl('2026-10-07'))).toBe(-1);
  }, 60_000);

  it('should count the Actions earlier than those four', async () => {
    const { stack, tradeId } = await heldTrade();
    for (const date of DAYS) await stack.saveAction(tradeId, 'Hold', date);

    const { decisions } = await card(stack, tradeId);

    expect(decisions.recent).toHaveLength(4);
    expect(decisions.earlier).toBe(1);
  }, 60_000);

  it('should give no reason where none was saved', async () => {
    const { stack, tradeId } = await heldTrade();
    await stack.saveAction(tradeId, 'Hold', '2026-10-08');
    await stack.saveAction(tradeId, 'Adjust', '2026-10-09');

    const { decisions } = await card(stack, tradeId);

    expect(decisions.recent[0]).toMatchObject({ date: '2026-10-09', reason: 'Because the plan changed.' });
    expect(decisions.recent[1]).toMatchObject({ date: '2026-10-08', action: 'Hold' });
    expect(decisions.recent[1]).not.toHaveProperty('reason');
  }, 60_000);

  it('should count the consecutive earlier Review Dates on which Hold was saved while the Stop was reached', async () => {
    const { stack, tradeId } = await heldTrade();
    await marks(stack, { '2026-10-05': '50.00', '2026-10-06': '47.00', '2026-10-07': '47.00', '2026-10-08': '46.00', '2026-10-09': '46.50' });
    for (const date of DAYS.slice(1)) await stack.saveAction(tradeId, 'Hold', date);

    const { decisions } = await card(stack, tradeId);

    expect(decisions.heldPast).toEqual({ line: 'Stop', sessions: 4 });
  }, 60_000);

  it('should end that count at a session with no Review, and at a Hold saved before the Stop was reached', async () => {
    const gap = await heldTrade();
    await marks(gap.stack, { '2026-10-06': '47.00', '2026-10-07': '47.00', '2026-10-08': '47.00', '2026-10-09': '47.00' });
    for (const date of ['2026-10-06', '2026-10-08', '2026-10-09']) await gap.stack.saveAction(gap.tradeId, 'Hold', date);
    const before = await heldTrade();
    await marks(before.stack, { '2026-10-06': '47.00', '2026-10-07': '50.00', '2026-10-08': '47.00', '2026-10-09': '47.00' });
    for (const date of ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) await before.stack.saveAction(before.tradeId, 'Hold', date);

    // 10-07 has no Review in the first Trade, and was not past the Stop in the second.
    expect((await card(gap.stack, gap.tradeId)).decisions.heldPast).toEqual({ line: 'Stop', sessions: 2 });
    expect((await card(before.stack, before.tradeId)).decisions.heldPast).toEqual({ line: 'Stop', sessions: 2 });
  }, 60_000);

  it('should count Holds past the Target the same way', async () => {
    const { stack, tradeId } = await heldTrade();
    await marks(stack, { '2026-10-06': '55.00', '2026-10-07': '57.00', '2026-10-08': '57.00', '2026-10-09': '58.00' });
    for (const date of DAYS.slice(1)) await stack.saveAction(tradeId, 'Hold', date);

    const { decisions } = await card(stack, tradeId);

    expect(decisions.heldPast).toEqual({ line: 'Target', sessions: 3 });
  }, 60_000);

  it('should name the sessions with no Review since the last Action', async () => {
    const { stack, tradeId } = await heldTrade();
    await stack.saveAction(tradeId, 'Hold', '2026-10-06');
    await stack.saveAction(tradeId, 'Hold', '2026-10-07');
    const never = await heldTrade();

    expect((await card(stack, tradeId)).decisions.sessionsWithoutReview).toEqual(['2026-10-08', '2026-10-09']);
    // With no Action at all, every session from the first exposure to the day before.
    expect((await card(never.stack, never.tradeId)).decisions.sessionsWithoutReview).toEqual(DAYS);
  }, 60_000);

  it('should make exactly one journalEntries read, through byAnchorTrade', async () => {
    const { stack, tradeId } = await heldTrade();
    await marks(stack, { '2026-10-08': '47.00', '2026-10-09': '47.00' });
    for (const date of DAYS) await stack.saveAction(tradeId, 'Hold', date);
    const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);

    const { result, requests } = await countRequests(() => stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding }));

    expect(result.kind === 'Ready' && result.trade.decisions?.recent).toHaveLength(4);
    expect(requests.filter((r) => r.store === 'journalEntries')).toEqual([{ on: 'index', store: 'journalEntries', index: 'byAnchorTrade', method: 'getAll' }]);
  }, 60_000);
});

describe('getTrade: the Hold count after a Settlement Due expiration (A305)', () => {
  // A long XYZ call bought Mon 10-05 that expires Wed 10-07, reviewed on Monday 10-12 with its underlying past the Stop on 10-06 and 10-07.
  const CALL = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-10-07', right: 'Call', strike: '55', multiplier: 100 } as const;

  async function expiredTrade() {
    const stack = await reviewStack(MONDAY_1700);
    await stack.catalog.seedDefaults(D7_CATALOG_MANIFEST);
    const strategies = await stack.catalog.query({ family: 'Strategy' });
    const strategy = strategies.kind === 'Page' ? strategies.items.find((s): s is StrategyRecord => s.kind === 'Strategy' && s.productKey === 'strategy.long-call') : undefined;
    if (!strategy) throw new Error('no strategy.long-call');
    const confirmed = await stack.tradeWorkflows.confirmPlan({
      accountId: stack.account.id,
      accountRevision: stack.account.recordRevision,
      strategyId: strategy.id,
      strategyRevision: strategy.recordRevision,
      economicTime: '2026-10-05T13:00:00Z',
      plan: { underlying: 'XYZ', legs: [{ side: 'Long', instrument: CALL, quantity: '1', intendedEntry: '2.00' }], stops: [{ kind: 'UnderlyingPrice', price: '48.00' }], targets: [{ kind: 'UnderlyingPrice', price: '60.00' }], exerciseIntent: 'NotAuthorized' },
      reflection: { definitionId: stack.definition.id, answers: { 'prompt.plan-reflection.thesis': { kind: 'Text', text: 'The setup is worth the risk.' }, 'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close beyond the stop.' } } },
    });
    if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
    const trade = confirmed.postCommit.trade;
    const current = await stack.tradeRecord.getRecord({ tradeId: trade.tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    const recorded = await stack.tradeWorkflows.recordPositionChange({
      originTradeId: trade.tradeId,
      trades: [{ tradeId: trade.tradeId, expectedFactRevision: current.factRevision }],
      members: [{ kind: 'Execution', tradeId: trade.tradeId, action: 'Buy', instrument: CALL, intent: { kind: 'ServesPlannedLeg', plannedLegId: trade.plan.legs[0]!.factId }, quantity: '1', price: '2.00', fee: '0.65', economicTime: '2026-10-05T14:00:00Z' }],
      reflection: stack.reflection,
    });
    if (recorded.kind !== 'Recorded') throw new Error(`expected Recorded, got ${recorded.kind}`);
    for (const date of ['2026-10-05', '2026-10-06', '2026-10-07']) {
      await stack.saveMark(instrumentKey(CALL), '1.00', date);
      await stack.saveMark('XYZ', date === '2026-10-05' ? '50.00' : '47.00', date);
    }
    return { stack, tradeId: trade.tradeId };
  }

  it('should end the Hold count at a session with no Review after a Settlement Due expiration', async () => {
    const { stack, tradeId } = await expiredTrade();
    for (const date of ['2026-10-06', '2026-10-07']) await stack.saveAction(tradeId, 'Hold', date);

    const { decisions } = await card(stack, tradeId);

    // The replay ends at the expiration session, but 10-08 and 10-09 are sessions with no Review, so no Hold run reaches the Review Date.
    expect(decisions.sessionsWithoutReview).toEqual(['2026-10-08', '2026-10-09']);
    expect(decisions.heldPast).toBeUndefined();
  }, 60_000);
});

describe('the first Review Date of a Trade filled after the close (A305, A300)', () => {
  it('should not list the day of a first fill after the close as a session with no Review', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const planned = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-09T13:00:00Z' });
    // Friday 10-09 21:00Z is 17:00 New York, an hour after that day's close: the first session it is held for is Monday.
    await stack.fill(planned, '2026-10-09T21:00:00Z', '100', '50.00');

    const { decisions } = await card(stack, planned.tradeId);
    const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);

    expect(decisions.sessionsWithoutReview).toEqual([]);
    expect(opened.day?.missed).toEqual([]);
  }, 60_000);
});
