import { describe, expect, it } from 'vitest';
import { debtFixture, TUESDAY_1700 } from '../../../tests/support/debt-fixture.ts';
import { closedTradeReviewFixture } from '../../../tests/support/closed-trade-review-fixture.ts';
import { Rational } from '../../domain/values/index.ts';
import { instrumentKey } from '../../domain/instrument/index.ts';
import { reviewStack, REVIEW_DATE, MONDAY_1700, TEN_AM, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import { D7_CATALOG_MANIFEST, type StrategyRecord } from '../../modules/reference-catalog/index.ts';
import { createDailyReview, type OpenDailyReviewResult } from './index.ts';

// T95.4: the day summary `open` returns (A300, P175).

// The Ready result of an `open`, which always carries the day.
function ready(result: OpenDailyReviewResult) {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  if (!result.day) throw new Error('the Ready result carries no day');
  return { ...result, day: result.day };
}

const open = async (stack: ReviewStack) => ready(await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 }));

// A long call bought Mon 10-05. XYZ's expired Fri 10-09 with no settlement recorded: Settlement Due at Monday 10-12's Review.
const callOn = (symbol: string, expiration: string) => ({ kind: 'Option', symbol, root: symbol, expiration, right: 'Call', strike: '55', multiplier: 100 }) as const;
const dueContract = (stack: ReviewStack) => optionTrade(stack, 'XYZ', '2026-10-09');

async function optionTrade(stack: ReviewStack, symbol: string, expiration: string, seed = true): Promise<string> {
  const contract = callOn(symbol, expiration);
  if (seed) await stack.catalog.seedDefaults(D7_CATALOG_MANIFEST);
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
    plan: { underlying: symbol, legs: [{ side: 'Long', instrument: contract, quantity: '1', intendedEntry: '2.00' }], stops: [{ kind: 'UnderlyingPrice', price: '48.00' }], targets: [{ kind: 'UnderlyingPrice', price: '60.00' }], exerciseIntent: 'NotAuthorized' },
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
    members: [{ kind: 'Execution', tradeId, action: 'Buy', instrument: contract, intent: { kind: 'ServesPlannedLeg', plannedLegId: legId }, quantity: '1', price: '2.10', fee: '0.65', economicTime: '2026-10-05T14:00:00Z' }],
    reflection: stack.reflection,
  });
  if (recorded.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(recorded)}`);
  return tradeId;
}

// A stock Trade bought Thu 10-08 and held into the Review.
async function heldStock(stack: ReviewStack, symbol: string, entry = '50.00', stop = '47.50', target = '56.00') {
  const planned = await stack.confirm({ symbol, shares: '100', entry, stop, target, planTime: '2026-10-08T13:00:00Z' });
  await stack.fill(planned, '2026-10-08T14:00:00Z', '100', entry);
  return planned.tradeId;
}

const walkIds = (result: ReturnType<typeof ready>) => {
  const walk = result.families.find((family) => family.family === 'Trades');
  return walk?.family === 'Trades' ? walk.trades.map((trade) => trade.tradeId) : [];
};

describe('open: the counts still to go (A300)', () => {
  it('should count the Trades in the Review and the Marks, Actions and expirations still to go', async () => {
    const stack = await reviewStack(MONDAY_1700);
    await heldStock(stack, 'ABC', '30.00', '28.00', '36.00');
    const acted = await heldStock(stack, 'DEF', '40.00', '38.00', '46.00');
    await dueContract(stack);
    await stack.saveAction(acted, 'Hold', REVIEW_DATE);

    const { day } = await open(stack);

    // Three Trades; ABC and DEF each need the Review Date's Mark; DEF has its Action, the expired contract owes none.
    expect(day.trades).toBe(3);
    expect(day.toGo).toMatchObject({ marks: 2, actions: 1, expirations: 1 });
  }, 60_000);
});

describe('open: what each Trade still needs (A300)', () => {
  it('should say what each Trade still needs', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const unmarked = await heldStock(stack, 'ABC', '30.00', '28.00', '36.00');
    const marked = await heldStock(stack, 'DEF', '40.00', '38.00', '46.00');
    const done = await heldStock(stack, 'GHI', '20.00', '18.00', '26.00');
    const contract = await dueContract(stack);
    await stack.saveMark('DEF', '41.00');
    await stack.saveMark('GHI', '21.00');
    await stack.saveAction(done, 'Hold', REVIEW_DATE);

    const opened = await open(stack);

    const needs = Object.fromEntries(opened.day.lines.map((line) => [line.tradeId, line.needs]));
    expect(needs).toEqual({ [unmarked]: ['Marks', 'Action'], [marked]: ['Action'], [done]: [], [contract]: ['Settlement'] });
    // One line per Trade, in the walk's order.
    expect(opened.day.lines.map((line) => line.tradeId)).toEqual(walkIds(opened));
  }, 60_000);
});

describe('open: reflections due (A300)', () => {
  it('should count a Close Review or a reflection that is due', async () => {
    // T-M is closed outside the walk with its Close Review due; the day names it, and counts no reflection.
    const closed = await closedTradeReviewFixture();
    const closeDay = ready(await closed.stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 })).day;
    expect(closeDay.toGo).toMatchObject({ closeReviews: 1, reflections: 0 });
    expect(closeDay.lines.find((line) => line.tradeId === closed.trades.M)).toEqual({ tradeId: closed.trades.M, needs: ['Reflection'] });

    // T-A owes two due reflections and T-F, T-E and T-G one each; the later ones are not counted.
    const debts = await debtFixture();
    const debtDay = ready(await debts.stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 })).day;
    expect(debtDay.toGo).toMatchObject({ closeReviews: 0, reflections: 5 });
    expect(debtDay.lines.find((line) => line.tradeId === debts.trades.a)!.needs).toContain('Reflection');
    expect(debtDay.lines.find((line) => line.tradeId === debts.trades.h)!.needs).not.toContain('Reflection');
  }, 120_000);
});

describe('open: the change in Trade P&L (A300)', () => {
  const FRIDAY = '2026-10-09';

  it('should give the change in Trade P&L over the Trades, and Unavailable while a Review Date Mark is Missing', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // Held since Thursday: +$100.00 at Friday's Mark, -$100.00 at Monday's, a change of -$200.00.
    await heldStock(stack, 'ABC', '30.00', '28.00', '36.00');
    await stack.saveMark('ABC', '31.00', FRIDAY);
    await stack.saveMark('ABC', '29.00');
    // Bought Monday morning: no earlier valuation, so +$100.00 from nothing, less the fixture's $1.00 fee.
    const bought = await stack.confirm({ symbol: 'DEF', shares: '100', entry: '40.00', stop: '38.00', target: '46.00' });
    await stack.fill(bought, TEN_AM, '100', '40.00');
    await stack.saveMark('DEF', '41.00');

    const marked = await open(stack);

    expect(marked.day.change).toEqual({ kind: 'Value', dollars: Rational.of(-101n) });

    // A third Trade whose Review Date Mark is Missing leaves the change Unavailable.
    await heldStock(stack, 'GHI', '20.00', '18.00', '26.00');

    expect((await open(stack)).day.change).toEqual({ kind: 'Unavailable' });

    // A Trade held at the session before with no Mark that day has no earlier figure: its whole P&L is not the day's change.
    const gap = await reviewStack(MONDAY_1700);
    await heldStock(gap, 'JKL', '30.00', '28.00', '36.00');
    await gap.saveMark('JKL', '29.00');

    expect((await open(gap)).day.change).toEqual({ kind: 'Unavailable' });
  }, 60_000);
});

// The `open` of a stack whose calendar names no session before the Review Date, as at the start of the session policy's coverage.
async function openWithoutPrevious(stack: ReviewStack) {
  const marketData = {
    ...stack.marketData,
    openReadSession: async (context: Parameters<typeof stack.marketData.openReadSession>[0], options?: Parameters<typeof stack.marketData.openReadSession>[1]) => {
      const session = await stack.marketData.openReadSession(context, options);
      return Object.fromEntries(Object.entries(session).filter(([key]) => key !== 'previousSessionDate')) as typeof session;
    },
  };
  return ready(await createDailyReview({ ...stack, marketData }).open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 }));
}

describe('open: the change in Trade P&L with no session before the Review Date (A300)', () => {
  it('should make the day change Unavailable when the calendar has no session before the Review Date for a Trade open before it', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // Held since Thursday: its figure then is unknown, so its whole P&L is not the day's change.
    await heldStock(stack, 'ABC', '30.00', '28.00', '36.00');
    await stack.saveMark('ABC', '29.00');

    expect((await openWithoutPrevious(stack)).day.change).toEqual({ kind: 'Unavailable' });

    // A Trade bought on the Review Date was not open before it: its change is from nothing.
    const fresh = await reviewStack(MONDAY_1700);
    const bought = await fresh.confirm({ symbol: 'DEF', shares: '100', entry: '40.00', stop: '38.00', target: '46.00' });
    await fresh.fill(bought, TEN_AM, '100', '40.00');
    await fresh.saveMark('DEF', '41.00');
    const freshOpen = await openWithoutPrevious(fresh);

    expect(freshOpen.day.change).toEqual({ kind: 'Value', dollars: Rational.of(99n) });
  }, 60_000);
});

describe('open: the sessions with no Review (A300)', () => {
  it('should name each session since the last saved Action that had no Review', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const first = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00', planTime: '2026-10-05T13:00:00Z' });
    await stack.fill(first, '2026-10-05T14:00:00Z', '100', '30.00');
    const second = await stack.confirm({ symbol: 'DEF', shares: '100', entry: '40.00', stop: '38.00', target: '46.00', planTime: '2026-10-05T13:00:00Z' });
    await stack.fill(second, '2026-10-05T14:00:00Z', '100', '40.00');
    await stack.saveAction(first.tradeId, 'Hold', '2026-10-06');
    // An Action saved on the Review Date itself is not an earlier Review.
    await stack.saveAction(first.tradeId, 'Hold', REVIEW_DATE);

    // The weekend and the Review Date are not sessions with no Review.
    expect((await open(stack)).day.missed).toEqual(['2026-10-07', '2026-10-08', '2026-10-09']);

    // The latest earlier Action counts whichever Trade it was saved for.
    await stack.saveAction(second.tradeId, 'Hold', '2026-10-08');

    expect((await open(stack)).day.missed).toEqual(['2026-10-09']);

    // With no earlier Action at all, the count starts at the session the first Trade was held.
    const none = await reviewStack(MONDAY_1700);
    await heldStock(none, 'GHI');

    expect((await open(none)).day.missed).toEqual(['2026-10-08', '2026-10-09']);
  }, 60_000);
});

describe('open: the finished day (A300)', () => {
  // ABC is past its Stop on Thursday and again on Friday and Monday, after Wednesday's recovery; DEF is bought Monday and ends it at its Target.
  async function finishedDay() {
    const stack = await reviewStack(MONDAY_1700);
    const past = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00', planTime: '2026-10-05T13:00:00Z' });
    await stack.fill(past, '2026-10-05T14:00:00Z', '100', '30.00');
    for (const [date, price] of [['2026-10-05', '29.00'], ['2026-10-06', '27.00'], ['2026-10-07', '29.00'], ['2026-10-08', '27.00'], ['2026-10-09', '27.00'], [REVIEW_DATE, '27.00']] as const) await stack.saveMark('ABC', price, date);
    const at = await stack.confirm({ symbol: 'DEF', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(at, TEN_AM, '100', '50.00');
    await stack.saveMark('DEF', '57.00');
    return { stack, past: past.tradeId, at: at.tradeId };
  }

  it('should list, once nothing is to go, the Trades past each line with the sessions since the crossing', async () => {
    const { stack, past, at } = await finishedDay();

    // Both Actions are still to go, so nothing is listed.
    expect((await open(stack)).day.finished).toBeUndefined();

    await stack.saveAction(past, 'Hold', REVIEW_DATE);
    await stack.saveAction(at, 'Hold', REVIEW_DATE);
    const { day } = await open(stack);

    // The run past the Stop began Thursday, not Tuesday's first crossing; it counts Thursday, Friday and the Review Date.
    expect(day.finished?.pastLine).toEqual({ stop: [{ tradeId: past, sessions: 3 }], target: [{ tradeId: at, sessions: 1 }] });
  }, 60_000);

  it('should list what was chosen for each Trade', async () => {
    const { stack, past, at } = await finishedDay();
    await stack.saveAction(past, 'Hold', REVIEW_DATE);
    await stack.saveAction(at, 'Exit', REVIEW_DATE);

    const opened = await open(stack);

    // In the walk's order: the Trade past its Stop, then the one at its Target.
    expect(walkIds(opened)).toEqual([past, at]);
    expect(opened.day.finished?.chosen).toEqual([
      { tradeId: past, action: 'Hold' },
      { tradeId: at, action: 'Exit' },
    ]);
  }, 60_000);
});

describe('open: what comes due (A300, P175)', () => {
  it('should list what comes due: a saved Exit to carry out, and each contract expiration with the sessions left', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const selling = await heldStock(stack, 'ABC', '30.00', '28.00', '36.00');
    await stack.saveMark('ABC', '31.00');
    await stack.saveAction(selling, 'Exit', REVIEW_DATE);
    const holding = await heldStock(stack, 'GHI', '20.00', '18.00', '26.00');
    await stack.saveMark('GHI', '21.00');
    await stack.saveAction(holding, 'Hold', REVIEW_DATE);
    // Two contracts expiring Friday Oct 16 and one the Friday after; each needs its own Mark and its Underlying's.
    const contracts = [
      await optionTrade(stack, 'UVW', '2026-10-16'),
      await optionTrade(stack, 'XYZ', '2026-10-16', false),
      await optionTrade(stack, 'RST', '2026-10-23', false),
    ];
    for (const [symbol, expiration] of [['UVW', '2026-10-16'], ['XYZ', '2026-10-16'], ['RST', '2026-10-23']] as const) {
      await stack.saveMark(symbol, '52.00');
      await stack.saveMark(instrumentKey(callOn(symbol, expiration)), '3.00');
      await stack.saveAction(contracts[['UVW', 'XYZ', 'RST'].indexOf(symbol)]!, 'Hold', REVIEW_DATE);
    }

    const { day } = await open(stack);

    expect(day.toGo).toMatchObject({ marks: 0, actions: 0, expirations: 0 });
    // Only the Trade told to Exit; the Hold is not a sale to record.
    expect(day.finished?.due.sales).toEqual([selling]);
    // Grouped by date, the sooner first: Oct 13, 14, 15, 16 are four sessions left, and the Friday after has five more.
    const ahead = day.finished?.due.expirations ?? [];
    expect(ahead.map(({ expiration, sessionsLeft }) => ({ expiration, sessionsLeft }))).toEqual([
      { expiration: '2026-10-16', sessionsLeft: 4 },
      { expiration: '2026-10-23', sessionsLeft: 9 },
    ]);
    const byTrade = <T extends { readonly tradeId: string }>(list: readonly T[]) => list.toSorted((a, b) => (a.tradeId < b.tradeId ? -1 : 1));
    expect(byTrade(ahead[0]!.contracts)).toEqual(byTrade([{ tradeId: contracts[0]!, instrument: callOn('UVW', '2026-10-16') }, { tradeId: contracts[1]!, instrument: callOn('XYZ', '2026-10-16') }]));
    expect(ahead[1]!.contracts).toEqual([{ tradeId: contracts[2], instrument: callOn('RST', '2026-10-23') }]);
  }, 120_000);
});

describe('open: the next Review Date (A300)', () => {
  it('should give the next Review Date from the session policy', async () => {
    const stack = await reviewStack(MONDAY_1700);
    await heldStock(stack, 'ABC', '30.00', '28.00', '36.00');

    // Monday's Review is followed by Tuesday's; Friday's by the Monday after the weekend.
    expect((await open(stack)).day.nextReviewDate).toBe('2026-10-13');
    const friday = ready(await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: '2026-10-09T21:00:00Z' }));
    expect(friday.reviewDate).toBe('2026-10-09');
    expect(friday.day.nextReviewDate).toBe('2026-10-12');
  }, 60_000);
});
