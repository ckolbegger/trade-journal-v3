import { describe, expect, it } from 'vitest';
import { countRequests } from '../../../tests/support/request-counter.ts';
import { breakFirstExecution, ELEVEN_AM, MONDAY_1700, reviewStack, TEN_AM, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import type { MarketDataPrepareEntry } from '../../modules/market-data/index.ts';
import { D7_CATALOG_MANIFEST, type StrategyRecord } from '../../modules/reference-catalog/index.ts';
import type { OpenDailyReviewResult } from './index.ts';

// T95.3: the Review's attention bands and order, and each Trade's most recent earlier Action (A301, A305, A313).

function walk(result: OpenDailyReviewResult) {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  const family = result.families.find((f) => f.family === 'Trades');
  if (!family) throw new Error('no Trades family');
  return family.trades;
}

const open = (stack: ReviewStack, asOf = MONDAY_1700) => stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf });

// A long call on XYZ bought Mon 10-05 that expired Fri 10-09 with no settlement recorded: Settlement Due at Monday 10-12's Review.
const XYZ_CALL = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-10-09', right: 'Call', strike: '55', multiplier: 100 } as const;

async function dueContract(stack: ReviewStack): Promise<string> {
  await stack.catalog.seedDefaults(D7_CATALOG_MANIFEST);
  const strategies = await stack.catalog.query({ family: 'Strategy' });
  if (strategies.kind !== 'Page') throw new Error('no strategies');
  const strategy = strategies.items.find((s): s is StrategyRecord => s.kind === 'Strategy' && s.productKey === 'strategy.long-call');
  if (!strategy) throw new Error('no long call strategy');
  const confirmed = await stack.tradeWorkflows.confirmPlan({
    accountId: stack.account.id,
    accountRevision: stack.account.recordRevision,
    strategyId: strategy.id,
    strategyRevision: strategy.recordRevision,
    economicTime: '2026-10-05T13:00:00Z',
    plan: { underlying: 'XYZ', legs: [{ side: 'Long', instrument: XYZ_CALL, quantity: '1', intendedEntry: '2.00' }], stops: [{ kind: 'UnderlyingPrice', price: '48.00' }], targets: [{ kind: 'UnderlyingPrice', price: '60.00' }], exerciseIntent: 'NotAuthorized' },
    reflection: { definitionId: stack.definition.id, answers: { 'prompt.plan-reflection.thesis': { kind: 'Text', text: 'The setup is worth the risk.' }, 'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close beyond the stop.' } } },
  });
  if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
  const { tradeId } = confirmed.postCommit.trade;
  const current = await stack.tradeRecord.getRecord({ tradeId, projection: 'AnalysisInput' });
  if (current.kind !== 'Found') throw new Error('no Trade');
  const legId = (current.projection as unknown as { plan: { legs: { factId: string }[] } }).plan.legs[0]!.factId;
  const recorded = await stack.tradeWorkflows.recordPositionChange({
    originTradeId: tradeId,
    trades: [{ tradeId, expectedFactRevision: current.factRevision }],
    members: [{ kind: 'Execution', tradeId, action: 'Buy', instrument: XYZ_CALL, intent: { kind: 'ServesPlannedLeg', plannedLegId: legId }, quantity: '1', price: '2.10', fee: '0.65', economicTime: '2026-10-05T14:00:00Z' }],
    reflection: stack.reflection,
  });
  if (recorded.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(recorded)}`);
  return tradeId;
}

describe('open: the bands (A301)', () => {
  it('should put a Trade past its Stop in StopReached and one at its Target in TargetReached', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const past = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(past, TEN_AM, '100', '30.00');
    const at = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(at, ELEVEN_AM, '100', '50.00');
    await stack.saveMark('ABC', '27.50');
    await stack.saveMark('XYZ', '56.50');

    const trades = walk(await open(stack));

    expect(trades.map((t) => [t.tradeId, t.band])).toEqual([
      [past.tradeId, 'StopReached'],
      [at.tradeId, 'TargetReached'],
    ]);
  }, 60_000);

  it('should order two Trades past their Stops by Stop Overrun in R, deepest first', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // 1R is $200.00 and the Stop is passed by $300.00, 1.5R; the more recently active Trade.
    const shallow = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(shallow, ELEVEN_AM, '100', '30.00');
    // 1R is $100.00 and the Stop is passed by $200.00, 2R: less in dollars, more in R.
    const deep = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '49.00', target: '56.00' });
    await stack.fill(deep, TEN_AM, '100', '50.00');
    await stack.saveMark('ABC', '25.00');
    await stack.saveMark('XYZ', '47.00');

    const trades = walk(await open(stack));

    expect(trades.map((t) => [t.tradeId, t.band])).toEqual([
      [deep.tradeId, 'StopReached'],
      [shallow.tradeId, 'StopReached'],
    ]);
  }, 60_000);

  it('should put StopReached ahead of TargetReached, and both ahead of EvidenceLimited', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // Listed by Last Activity, oldest first: the last band is the most recently active.
    const target = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(target, TEN_AM, '100', '50.00');
    const stop = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(stop, TEN_AM, '100', '30.00');
    const limited = await stack.confirm({ symbol: 'DEF', shares: '100', entry: '40.00', stop: '38.00', target: '46.00' });
    await stack.fill(limited, ELEVEN_AM, '100', '40.00');
    await stack.saveMark('XYZ', '56.50');
    await stack.saveMark('ABC', '27.50');

    const trades = walk(await open(stack));

    expect(trades.map((t) => [t.tradeId, t.band])).toEqual([
      [stop.tradeId, 'StopReached'],
      [target.tradeId, 'TargetReached'],
      [limited.tradeId, 'EvidenceLimited'],
    ]);
  }, 60_000);

  it('should put a Trade with Settlement Due in SettlementDue, behind a blocker', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // The contract is the most recently active; the Trade whose facts disagree is the oldest.
    const broken = await stack.confirm({ symbol: 'GHI', shares: '100', entry: '60.00', stop: '57.00', target: '70.00', planTime: '2026-10-05T13:00:00Z' });
    await stack.fill(broken, '2026-10-05T14:00:00Z', '100', '60.00');
    await breakFirstExecution(stack, broken.tradeId);
    const past = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00', planTime: '2026-10-05T13:00:00Z' });
    await stack.fill(past, '2026-10-05T14:00:00Z', '100', '30.00');
    await stack.saveMark('ABC', '27.50');
    const contract = await dueContract(stack);

    const trades = walk(await open(stack));

    expect(trades.map((t) => [t.tradeId, t.band])).toEqual([
      [broken.tradeId, 'Blocker'],
      [contract, 'SettlementDue'],
      [past.tradeId, 'StopReached'],
    ]);
    expect(trades[1]!.reasons).toEqual([expect.objectContaining({ code: 'SettlementDue' })]);
  }, 60_000);

});

describe('open: the last Action (A305)', () => {
  it('should carry each Trade most recent Action before the Review Date on its item', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const acted = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-08T13:00:00Z' });
    await stack.fill(acted, '2026-10-08T14:00:00Z', '100', '50.00');
    const unreviewed = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00', planTime: '2026-10-08T13:00:00Z' });
    await stack.fill(unreviewed, '2026-10-08T14:00:00Z', '100', '30.00');
    await stack.saveAction(acted.tradeId, 'Hold', '2026-10-08');
    await stack.saveAction(acted.tradeId, 'Adjust', '2026-10-09');

    const trades = walk(await open(stack));

    expect(trades.find((t) => t.tradeId === acted.tradeId)!.lastAction).toEqual({ reviewDate: '2026-10-09', action: 'Adjust', reason: 'Because the plan changed.' });
    expect(trades.find((t) => t.tradeId === unreviewed.tradeId)).not.toHaveProperty('lastAction');
  }, 60_000);

  it('should put a Trade whose most recent earlier Action is Exit in ExitNotCarriedOut, ahead of SettlementDue', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // The Trade told to Exit is also past its Stop, and the oldest of the two.
    const exiting = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00', planTime: '2026-10-05T13:00:00Z' });
    await stack.fill(exiting, '2026-10-05T14:00:00Z', '100', '30.00');
    await stack.saveMark('ABC', '27.50');
    await stack.saveAction(exiting.tradeId, 'Exit', '2026-10-09');
    const contract = await dueContract(stack);

    const trades = walk(await open(stack));

    expect(trades.map((t) => [t.tradeId, t.band])).toEqual([
      [exiting.tradeId, 'ExitNotCarriedOut'],
      [contract, 'SettlementDue'],
    ]);
  }, 60_000);

  it('should not do so for an Exit saved on the Review Date itself, or an earlier Exit followed by a later Hold', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const today = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00', planTime: '2026-10-08T13:00:00Z' });
    await stack.fill(today, '2026-10-08T14:00:00Z', '100', '30.00');
    const held = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-08T13:00:00Z' });
    await stack.fill(held, '2026-10-08T14:00:00Z', '100', '50.00');
    await stack.saveAction(today.tradeId, 'Exit', '2026-10-12');
    await stack.saveAction(held.tradeId, 'Exit', '2026-10-08');
    await stack.saveAction(held.tradeId, 'Hold', '2026-10-09');

    const trades = walk(await open(stack));

    expect(trades.map((t) => t.band)).not.toContain('ExitNotCarriedOut');
    expect(trades.find((t) => t.tradeId === today.tradeId)).not.toHaveProperty('lastAction');
    expect(trades.find((t) => t.tradeId === held.tradeId)!.lastAction).toMatchObject({ reviewDate: '2026-10-09', action: 'Hold' });
  }, 60_000);

});

describe('the order across saves (A301)', () => {
  it('should keep the order when an Action is saved, and return a new order from a Marks save', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const trade = async (symbol: string, entry: string, stop: string, target: string) => {
      const planned = await stack.confirm({ symbol, shares: '100', entry, stop, target, planTime: '2026-10-08T13:00:00Z' });
      await stack.fill(planned, '2026-10-08T14:00:00Z', '100', entry);
      return planned.tradeId;
    };
    const exiting = await trade('XYZ', '50.00', '47.50', '56.00');
    const past = await trade('ABC', '30.00', '28.00', '36.00');
    const unpriced = await trade('DEF', '40.00', '38.00', '46.00');
    await stack.saveMark('XYZ', '52.00');
    await stack.saveMark('ABC', '27.50');
    await stack.saveAction(exiting, 'Exit', '2026-10-09');
    const opened = await open(stack);
    if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
    const idsOf = (trades: readonly { readonly tradeId: string }[]) => trades.map((t) => t.tradeId);
    expect(idsOf(walk(opened))).toEqual([exiting, past, unpriced]);
    const card = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId: exiting, binding: opened.binding });
    if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);

    const savedAction = await stack.dailyReview.save({ kind: 'SaveTradeAction', binding: card.trade.saveBinding, action: 'Hold' });

    if (savedAction.kind !== 'Saved' || savedAction.review.kind !== 'Ready') throw new Error(`expected a Ready review, got ${savedAction.kind}`);
    // The Hold is saved for the Review Date itself, so the earlier Exit still stands.
    const reopened = walk(await open(stack));
    expect(idsOf(reopened)).toEqual([exiting, past, unpriced]);
    expect(reopened[0]!.band).toBe('ExitNotCarriedOut');
    const entry: MarketDataPrepareEntry = { key: { instrumentKey: 'DEF', tradingDate: opened.reviewDate }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '36.00' } };

    const savedMarks = await stack.dailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, tradeId: unpriced, binding: savedAction.review.binding, entries: [entry] });

    if (savedMarks.kind !== 'MarksSaved' || savedMarks.review.kind !== 'Ready') throw new Error(`expected a Ready review, got ${savedMarks.kind}`);
    // DEF is past its Stop by 1R, ahead of ABC's 0.25R.
    expect(idsOf(savedMarks.review.trades)).toEqual([exiting, unpriced, past]);
    expect(savedMarks.review.trades[0]!.band).toBe('ExitNotCarriedOut');
  }, 60_000);
});

describe('open: the Journal read (P168)', () => {
  it('should add exactly one Journal read to open, the same for two Trades and for four', async () => {
    const readsFor = async (symbols: readonly string[]) => {
      const stack = await reviewStack(MONDAY_1700);
      for (const symbol of symbols) {
        const planned = await stack.confirm({ symbol, shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-08T13:00:00Z' });
        await stack.fill(planned, '2026-10-08T14:00:00Z', '100', '50.00');
        await stack.saveMark(symbol, '52.00');
      }
      return (await countRequests(() => open(stack))).requests.filter((r) => r.store === 'journalEntries');
    };

    const two = await readsFor(['AAA', 'BBB']);
    const four = await readsFor(['AAA', 'BBB', 'CCC', 'DDD']);

    expect(two).toEqual([{ on: 'index', store: 'journalEntries', index: 'byObligation', method: 'getAll' }]);
    expect(four).toEqual(two);
  }, 60_000);
});
