import { describe, expect, it } from 'vitest';
import { debtFixture, TUESDAY_1700, type DebtFixture } from '../../../tests/support/debt-fixture.ts';
import { countRequests, type CountedRequest } from '../../../tests/support/request-counter.ts';
import { reviewStack, REVIEW_DATE, MONDAY_1700, TEN_AM, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import type { MarketDataPrepareEntry } from '../../modules/market-data/index.ts';
import type { DaySummary, OpenDailyReviewResult, SaveDailyReviewResult, SaveReviewMarksResult } from './index.ts';

// T95.4-D1: every save returns the day summary (decision 129, P176).

// The day of a fresh `open`.
async function openDay(stack: ReviewStack, asOf = MONDAY_1700): Promise<DaySummary> {
  const result: OpenDailyReviewResult = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf });
  if (result.kind !== 'Ready' || !result.day) throw new Error(`expected a Ready review with a day, got ${result.kind}`);
  return result.day;
}

// The day a save returned with its refreshed Review.
function savedDay(result: SaveReviewMarksResult): DaySummary | undefined {
  if (result.kind !== 'Saved' && result.kind !== 'DebtResolved' && result.kind !== 'MarksSaved') throw new Error(`expected a save, got ${result.kind}`);
  if (result.review.kind !== 'Ready') throw new Error('expected a Ready review');
  return result.review.day;
}

async function hold(stack: ReviewStack, tradeId: string, asOf = MONDAY_1700): Promise<SaveDailyReviewResult> {
  const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf });
  if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
  const card = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);
  return stack.dailyReview.save({ kind: 'SaveTradeAction', binding: card.trade.saveBinding, action: 'Hold', intent: 'Holding past the line.' });
}

async function saveMarks(stack: ReviewStack, prices: Readonly<Record<string, string>>): Promise<SaveReviewMarksResult> {
  const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
  if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
  const entries = Object.entries(prices).map(([instrumentKey, price]): MarketDataPrepareEntry => ({ key: { instrumentKey, tradingDate: REVIEW_DATE }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price } }));
  return stack.dailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, binding: opened.binding, entries });
}

const ANSWERS = {
  'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
  'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
  'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
} as const;

async function resolveD1(fixture: DebtFixture): Promise<SaveDailyReviewResult> {
  const { stack, debts } = fixture;
  const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 });
  if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
  const card = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId: debts['D-1'].anchor.tradeId, binding: opened.binding });
  if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);
  const reflection = card.trade.reflections.find((r) => r.debtId === debts['D-1'].debtId);
  if (!reflection) throw new Error('no reflection for D-1');
  return stack.dailyReview.save({ kind: 'ResolveReviewDebt', reviewDate: opened.reviewDate, binding: reflection.saveBinding, resolution: { kind: 'Answer', answers: ANSWERS } });
}

// A stock Trade bought Thu 10-08 and held into the Review.
async function heldStock(stack: ReviewStack, symbol: string, entry: string, stop: string, target: string) {
  const planned = await stack.confirm({ symbol, shares: '100', entry, stop, target, planTime: '2026-10-08T13:00:00Z' });
  await stack.fill(planned, '2026-10-08T14:00:00Z', '100', entry);
  return planned.tradeId;
}

// ABC is past its Stop on Thursday and again on Friday and Monday, after Wednesday's recovery; DEF is bought Monday and ends it at its Target.
async function finishableDay(withDefMark = true) {
  const stack = await reviewStack(MONDAY_1700);
  const past = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00', planTime: '2026-10-05T13:00:00Z' });
  await stack.fill(past, '2026-10-05T14:00:00Z', '100', '30.00');
  for (const [date, price] of [['2026-10-05', '29.00'], ['2026-10-06', '27.00'], ['2026-10-07', '29.00'], ['2026-10-08', '27.00'], ['2026-10-09', '27.00'], [REVIEW_DATE, '27.00']] as const) await stack.saveMark('ABC', price, date);
  const at = await stack.confirm({ symbol: 'DEF', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
  await stack.fill(at, TEN_AM, '100', '50.00');
  if (withDefMark) await stack.saveMark('DEF', '57.00');
  return { stack, past: past.tradeId, at: at.tradeId };
}

describe('save: the day summary (decision 129)', () => {
  it('should return the day summary with every save result, equal to a fresh open\'s', async () => {
    // An Action save: ABC's Hold leaves DEF's Action to go.
    const action = await reviewStack(MONDAY_1700);
    const abc = await heldStock(action, 'ABC', '30.00', '28.00', '36.00');
    await heldStock(action, 'DEF', '40.00', '38.00', '46.00');
    await action.saveMark('ABC', '31.00');
    await action.saveMark('DEF', '41.00');
    const held = savedDay(await hold(action, abc));
    expect(held?.toGo).toMatchObject({ marks: 0, actions: 1 });
    expect(held).toEqual(await openDay(action));

    // A Marks save: DEF's Mark was Missing, and both Actions are still to go.
    const marks = await reviewStack(MONDAY_1700);
    await heldStock(marks, 'ABC', '30.00', '28.00', '36.00');
    await heldStock(marks, 'DEF', '40.00', '38.00', '46.00');
    await marks.saveMark('ABC', '31.00');
    const marked = savedDay(await saveMarks(marks, { DEF: '41.00' }));
    expect(marked?.toGo).toMatchObject({ marks: 0, actions: 2 });
    expect(marked).toEqual(await openDay(marks));

    // A Debt resolution: D-2 of T-A is still due.
    const debts = await debtFixture();
    const answered = savedDay(await resolveD1(debts));
    expect(answered?.toGo.reflections).toBeGreaterThan(0);
    expect(answered).toEqual(await openDay(debts.stack, TUESDAY_1700));
  }, 120_000);
});

describe('save: the finished day (decision 129)', () => {
  it('should return the finished-day lists with the save that finishes the day', async () => {
    // An Action save that finishes it: the first Hold leaves DEF's Action to go, the second leaves nothing.
    const { stack, past, at } = await finishableDay();
    expect(savedDay(await hold(stack, past))?.finished).toBeUndefined();

    const last = savedDay(await hold(stack, at));

    // The run past the Stop began Thursday: Thursday, Friday and the Review Date; DEF reached its Target on the Review Date.
    expect(last?.finished?.pastLine).toEqual({ stop: [{ tradeId: past, sessions: 3 }], target: [{ tradeId: at, sessions: 1 }] });
    expect(last?.finished?.chosen).toEqual([{ tradeId: past, action: 'Hold' }, { tradeId: at, action: 'Hold' }]);
    expect(last).toEqual(await openDay(stack));

    // A Marks save that finishes it: both Actions are saved, DEF's Mark is the last thing to go.
    const marks = await finishableDay(false);
    await marks.stack.saveAction(marks.past);
    await marks.stack.saveAction(marks.at);
    const marked = savedDay(await saveMarks(marks.stack, { DEF: '57.00' }));
    expect(marked?.finished?.pastLine).toEqual({ stop: [{ tradeId: marks.past, sessions: 3 }], target: [{ tradeId: marks.at, sessions: 1 }] });
    expect(marked).toEqual(await openDay(marks.stack));
  }, 120_000);
});

// The tallies of the same saves before they returned the day (T95.4's code), by what each touches.
const BEFORE_THE_DAY: Readonly<Record<'action' | 'marks' | 'debt' | 'finishing', Readonly<Record<string, number>>>> = {
  action: { 'transaction:pointer:readonly': 1, 'store:pointer:get': 1, 'transaction:meta:readonly': 7, 'store:meta:get': 45, 'transaction:diagnostics:readwrite': 1, 'store:diagnostics:put': 1, 'store:diagnostics:get': 1, 'store:diagnostics:delete': 1, 'transaction:meta,trades:readonly': 3, 'index:trades.byLifecycleActivity:getAll': 3, 'index:trades.byLifecycleTerminal:getAll': 3, 'transaction:meta,observations:readonly': 5, 'store:observations:getAll': 4, 'transaction:meta,journalDefinitions,journalObligations,journalEntries,journalTypes:readonly': 1, 'store:journalObligations:get': 1, 'store:journalDefinitions:getAll': 4, 'store:journalTypes:getAll': 3, 'transaction:meta,trades,observations,journalEntries,journalObligations:readwrite': 1, 'store:trades:get': 1, 'store:observations:get': 2, 'store:journalEntries:add': 1, 'store:journalObligations:add': 1, 'store:meta:put': 2, 'transaction:meta,journalObligations,journalEntries,journalDefinitions,journalTypes:readonly': 2, 'store:journalObligations:getAll': 2, 'store:journalEntries:get': 2, 'index:journalEntries.byObligation:getAll': 1, 'transaction:meta,journalDebts:readonly': 2, 'index:journalDebts.byOutstandingDue:getAll': 2, 'transaction:meta,catalog:readonly': 1, 'store:catalog:getAll': 1, 'index:journalEntries.byAnchorTrade:getAll': 1, 'index:observations.byInstrumentDate:getAll': 1, 'transaction:meta,journalDefinitions:readonly': 1 },
  marks: { 'transaction:pointer:readonly': 1, 'store:pointer:get': 1, 'transaction:meta:readonly': 6, 'store:meta:get': 37, 'transaction:diagnostics:readwrite': 1, 'store:diagnostics:put': 1, 'store:diagnostics:get': 1, 'store:diagnostics:delete': 1, 'transaction:meta,observations:readonly': 5, 'store:observations:get': 2, 'transaction:meta,observations:readwrite': 1, 'store:observations:put': 1, 'store:meta:put': 1, 'transaction:meta,trades:readonly': 2, 'index:trades.byLifecycleActivity:getAll': 2, 'index:trades.byLifecycleTerminal:getAll': 2, 'store:observations:getAll': 3, 'transaction:meta,journalObligations,journalEntries,journalDefinitions,journalTypes:readonly': 2, 'store:journalObligations:getAll': 2, 'index:journalEntries.byObligation:getAll': 1, 'store:journalDefinitions:getAll': 3, 'store:journalTypes:getAll': 2, 'transaction:meta,journalDebts:readonly': 2, 'index:journalDebts.byOutstandingDue:getAll': 2, 'transaction:meta,catalog:readonly': 1, 'store:catalog:getAll': 1, 'index:journalEntries.byAnchorTrade:getAll': 1, 'index:observations.byInstrumentDate:getAll': 1, 'transaction:meta,journalDefinitions:readonly': 1 },
  debt: { 'transaction:pointer:readonly': 1, 'store:pointer:get': 1, 'transaction:meta:readonly': 5, 'store:meta:get': 39, 'transaction:diagnostics:readwrite': 1, 'store:diagnostics:put': 1, 'store:diagnostics:get': 1, 'store:diagnostics:delete': 1, 'transaction:meta,journalDebts,journalObligations,journalDefinitions:readonly': 1, 'store:journalDebts:get': 2, 'store:journalObligations:get': 2, 'store:journalDefinitions:get': 1, 'transaction:meta,journalObligations,journalDebts,journalEntries:readwrite': 1, 'store:journalEntries:add': 1, 'store:journalObligations:put': 1, 'store:journalDebts:put': 1, 'index:journalDebts.byOutstandingDue:openCursor': 1, 'store:meta:put': 2, 'transaction:meta,trades:readonly': 2, 'index:trades.byLifecycleActivity:getAll': 2, 'index:trades.byLifecycleTerminal:getAll': 2, 'transaction:meta,observations:readonly': 4, 'store:observations:getAll': 3, 'transaction:meta,journalObligations,journalEntries,journalDefinitions,journalTypes:readonly': 2, 'store:journalObligations:getAll': 2, 'store:journalEntries:get': 10, 'index:journalEntries.byObligation:getAll': 1, 'store:journalDefinitions:getAll': 5, 'store:journalTypes:getAll': 3, 'transaction:meta,journalDebts:readonly': 2, 'index:journalDebts.byOutstandingDue:getAll': 2, 'transaction:meta,catalog:readonly': 1, 'store:catalog:getAll': 1, 'index:journalEntries.byAnchorTrade:getAll': 2, 'index:observations.byInstrumentDate:getAll': 1, 'transaction:meta,journalEntries,journalDeclines,journalDebts,journalDefinitions,journalTypes:readonly': 1, 'index:journalDeclines.byAnchorTrade:getAll': 1, 'index:journalDebts.byAnchorTrade:getAll': 1, 'transaction:meta,journalDefinitions:readonly': 2 },
  finishing: { 'transaction:pointer:readonly': 1, 'store:pointer:get': 1, 'transaction:meta:readonly': 5, 'store:meta:get': 28, 'transaction:diagnostics:readwrite': 1, 'store:diagnostics:put': 1, 'store:diagnostics:get': 1, 'store:diagnostics:delete': 1, 'transaction:meta,trades:readonly': 2, 'index:trades.byLifecycleActivity:getAll': 2, 'index:trades.byLifecycleTerminal:getAll': 2, 'transaction:meta,observations:readonly': 3, 'store:observations:getAll': 3, 'transaction:meta,journalDefinitions,journalObligations,journalEntries,journalTypes:readonly': 1, 'store:journalObligations:get': 1, 'store:journalDefinitions:getAll': 2, 'store:journalTypes:getAll': 2, 'transaction:meta,trades,observations,journalEntries,journalObligations:readwrite': 1, 'store:trades:get': 1, 'store:observations:get': 2, 'store:journalEntries:add': 1, 'store:journalObligations:add': 1, 'store:meta:put': 2, 'transaction:meta,journalObligations,journalEntries,journalDefinitions,journalTypes:readonly': 1, 'store:journalObligations:getAll': 1, 'store:journalEntries:get': 2, 'index:journalEntries.byObligation:getAll': 1, 'transaction:meta,journalDebts:readonly': 1, 'index:journalDebts.byOutstandingDue:getAll': 1 },
};

// The requests of a save as a tally by what they touch: a store (or index) and the method, with the transactions the save opened.
function tally(requests: readonly CountedRequest[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const r of requests) {
    const name = `${r.on}:${r.store}${r.index ? `.${r.index}` : ''}:${r.method}`;
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

describe('save: the request counts (decision 129, R2, R4)', () => {
  it('should keep each save\'s request counts', async () => {
    const seen: Record<string, Readonly<Record<string, number>>> = {};
    const action = await reviewStack(MONDAY_1700);
    const abc = await heldStock(action, 'ABC', '30.00', '28.00', '36.00');
    await heldStock(action, 'DEF', '40.00', '38.00', '46.00');
    await action.saveMark('ABC', '31.00');
    await action.saveMark('DEF', '41.00');
    const opened = await action.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (opened.kind !== 'Ready') throw new Error('expected Ready');
    const card = await action.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId: abc, binding: opened.binding });
    if (card.kind !== 'Ready') throw new Error('expected Ready');
    const saved = await countRequests(() => action.dailyReview.save({ kind: 'SaveTradeAction', binding: card.trade.saveBinding, action: 'Hold' }), { transactions: true });
    expect(saved.result.kind).toBe('Saved');
    seen.action = tally(saved.requests);

    const marks = await reviewStack(MONDAY_1700);
    await heldStock(marks, 'ABC', '30.00', '28.00', '36.00');
    await heldStock(marks, 'DEF', '40.00', '38.00', '46.00');
    await marks.saveMark('ABC', '31.00');
    const reopened = await marks.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (reopened.kind !== 'Ready') throw new Error('expected Ready');
    const entries: MarketDataPrepareEntry[] = [{ key: { instrumentKey: 'DEF', tradingDate: REVIEW_DATE }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '41.00' } }];
    const markSaved = await countRequests(() => marks.dailyReview.save({ kind: 'SaveReviewMarks', reviewDate: REVIEW_DATE, binding: reopened.binding, entries }), { transactions: true });
    expect(markSaved.result.kind).toBe('MarksSaved');
    seen.marks = tally(markSaved.requests);

    const debts = await debtFixture();
    const d1 = debts.debts['D-1'];
    const dOpened = await debts.stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 });
    if (dOpened.kind !== 'Ready') throw new Error('expected Ready');
    const dCard = await debts.stack.dailyReview.getTrade({ reviewDate: dOpened.reviewDate, tradeId: d1.anchor.tradeId, binding: dOpened.binding });
    if (dCard.kind !== 'Ready') throw new Error('expected Ready');
    const reflection = dCard.trade.reflections.find((r) => r.debtId === d1.debtId)!;
    const resolved = await countRequests(() => debts.stack.dailyReview.save({ kind: 'ResolveReviewDebt', reviewDate: dOpened.reviewDate, binding: reflection.saveBinding, resolution: { kind: 'Answer', answers: ANSWERS } }), { transactions: true });
    expect(resolved.result.kind).toBe('DebtResolved');
    seen.debt = tally(resolved.requests);

    const fin = await finishableDay();
    await hold(fin.stack, fin.past);
    const fOpened = await fin.stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (fOpened.kind !== 'Ready') throw new Error('expected Ready');
    const fCard = await fin.stack.dailyReview.getTrade({ reviewDate: fOpened.reviewDate, tradeId: fin.at, binding: fOpened.binding });
    if (fCard.kind !== 'Ready') throw new Error('expected Ready');
    const finished = await countRequests(() => fin.stack.dailyReview.save({ kind: 'SaveTradeAction', binding: fCard.trade.saveBinding, action: 'Hold', intent: 'Holding past the line.' }), { transactions: true });
    expect(finished.result.kind).toBe('Saved');
    seen.finishing = tally(finished.requests);
    // The saves that leave something to go read what they read before: the day is built from the same pass.
    expect(seen.action).toEqual(BEFORE_THE_DAY.action);
    expect(seen.marks).toEqual(BEFORE_THE_DAY.marks);
    expect(seen.debt).toEqual(BEFORE_THE_DAY.debt);
    // The save that finishes the day adds only the replay of the Trades past a line, which reads no Journal store and opens no further commit.
    const journal = (counts: Readonly<Record<string, number>>) => Object.entries(counts).filter(([name]) => name.split(':')[1]!.startsWith('journal'));
    expect(journal(seen.finishing)).toEqual(journal(BEFORE_THE_DAY.finishing));
    const commits = (counts: Readonly<Record<string, number>>) => Object.entries(counts).filter(([name]) => name.startsWith('transaction:') && name.endsWith(':readwrite') && !name.includes('diagnostics'));
    expect(commits(seen.finishing)).toEqual(commits(BEFORE_THE_DAY.finishing));
  }, 120_000);
});
