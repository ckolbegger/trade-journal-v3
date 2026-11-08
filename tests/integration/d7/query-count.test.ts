// T7.29 query-count proof (AC-PERF-001, D7 A111, decision 97): the Review `open` adds to D6's counts one Historical frame
// request per distinct due expiration date and nothing per Trade, and Trade Detail adds at most one. Counted as D6's T6.25
// does, with the real facade on fake-indexeddb wrapped in the disclosed request counter (D2 section 6.0).
//
// The Open page's part of the proof (decision 97: one Historical `observations` read per distinct earlier close date that its
// option Trades' dated lines need, and nothing per Trade) is T7.30-B3-R2's `open-list-query-count.test.ts`, which this file does
// not repeat.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';
import { confirmOption, MONDAY_NEXT_1700, OC_PC1, onboardedAt, optionPlanCommand, recordOption, restart, THURSDAY_1700, XYZ_CALL, type Fill } from './support.ts';

const EARLY_EXPIRATION = '2026-11-13';
const EARLY_PLAN = '2026-11-02T14:00:00Z';
const EARLY_FILL: Fill = { quantity: '1', price: '1.00', economicTime: '2026-11-03T15:00:00Z', fee: '0.65' };

// A Long Call on XYZ expiring Friday 2026-11-20, one contract held.
async function fridayCall(app: Application): Promise<string> {
  const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
  await recordOption(app, tradeId, 'Buy', OC_PC1);
  return tradeId;
}

// A Long Call on XYZ expiring on `expiration` (default Friday 2026-11-13), one contract held.
async function earlyCall(app: Application, expiration = EARLY_EXPIRATION): Promise<string> {
  const base = await optionPlanCommand(app, 'O-C', EARLY_PLAN);
  const confirmed = await app.TradeWorkflows.confirmPlan({ ...base, plan: { ...base.plan, legs: [{ ...base.plan.legs[0]!, instrument: { ...XYZ_CALL, expiration } }] } });
  if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan: ${JSON.stringify(confirmed)}`);
  await recordOption(app, confirmed.receipt.tradeId, 'Buy', EARLY_FILL);
  return confirmed.receipt.tradeId;
}

// Well after the Review's clock, so a Trade expiring then is open but not due.
const NOT_DUE_EXPIRATION = '2026-12-18';

// The Review `open` at Monday 2026-11-23 17:00 New York, with `friday` Trades expiring 2026-11-20 and `early` expiring 2026-11-13,
// all due. With `due` false the same number of Trades, at the same clock, all expire 2026-12-18 instead, so none is due: the baseline.
async function reviewOpen(friday: number, early: number, due = true) {
  const { app } = await onboardedAt(MONDAY_NEXT_1700);
  for (let n = 0; n < friday + early; n++) await (due ? (n < friday ? fridayCall(app) : earlyCall(app)) : earlyCall(app, NOT_DUE_EXPIRATION));
  const review = await countRequests(() => app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_NEXT_1700 }));
  if (review.result.kind !== 'Ready') throw new Error(`open: ${review.result.kind}`);
  const items = review.result.families.flatMap((f) => (f.family === 'Settlement' ? f.items : []));
  return { requests: review.requests, items };
}

const on = (requests: readonly CountedRequest[], store: string) => requests.filter((r) => r.store === store);
const GET_ALL = { on: 'store', store: 'observations', method: 'getAll' };

describe('T7.29 query count: the Review open and Trade Detail with Settlement Due', () => {
  // DEVIATION from the plan's wording (reported with T7.29): the plan (A111, T7.29) says the Review open adds exactly one Historical
  // ResolveFrames request, hence one stored `observations` read, per distinct due expiration date. The code asks Market Data
  // for a `ResolveSession` Historical per due item instead (`settlementTimeOf`), which the calendar answers with no stored read.
  // The first version of this case asked for the plan's one getAll per date and failed on that (tdd-log row). The case now pins
  // what the facade does: no stored read per Trade, none per date, so the Review open keeps D6's counts exactly.
  it('should add no stored read per Trade or per distinct due expiration date to D6 counts for a Review open', { timeout: 120_000 }, async () => {
    const twoTrades = await reviewOpen(2, 0);
    const fourTrades = await reviewOpen(4, 0);
    const twoDates = await reviewOpen(2, 2);
    expect(new Set(twoTrades.items.map((i) => i.expiration)).size).toBe(1);
    expect(fourTrades.items).toHaveLength(4);
    expect(new Set(twoDates.items.map((i) => i.expiration)).size).toBe(2);
    // The baseline: the same number of Trades at the same clock, none due. Their Review has no Settlement items, so it issues D6's requests.
    const baselineTwo = await reviewOpen(2, 0, false);
    const baselineFour = await reviewOpen(4, 0, false);
    const baselineTwoDates = await reviewOpen(2, 2, false);
    for (const baseline of [baselineTwo, baselineFour, baselineTwoDates]) expect(baseline.items).toEqual([]);
    // Each due run issues exactly the baseline's requests with the same Trades, so a constant extra request on any store fails.
    // The one allowed difference: the baseline's contracts are still live, so D6 reads their marks through the `byInstrumentDate`
    // index of `observations`; an expired contract has no mark to read, so the due runs make no such read (also checked below).
    const withoutMarkReads = (requests: readonly CountedRequest[]) => requests.filter((r) => !(r.store === 'observations' && r.on === 'index'));
    expect(baselineTwo.requests).not.toEqual(withoutMarkReads(baselineTwo.requests));
    // Both runs above come from the same code, so a constant extra request would be in the baseline too: D6's own count is pinned
    // as well, per store and method (20 requests).
    const tally: Record<string, number> = {};
    for (const r of twoTrades.requests) tally[`${r.store}.${r.method}`] = (tally[`${r.store}.${r.method}`] ?? 0) + 1;
    expect(tally).toEqual({ 'meta.get': 13, 'trades.getAll': 2, 'observations.getAll': 1, 'journalDebts.getAll': 1, 'journalDefinitions.getAll': 1, 'journalObligations.getAll': 1, 'journalTypes.getAll': 1 });
    expect(twoTrades.requests).toEqual(withoutMarkReads(baselineTwo.requests));
    expect(fourTrades.requests).toEqual(withoutMarkReads(baselineFour.requests));
    expect(twoDates.requests).toEqual(withoutMarkReads(baselineTwoDates.requests));
    // Nothing per Trade: twice the due Trades on the one date issue the same requests.
    expect(fourTrades.requests).toEqual(twoTrades.requests);
    // Nothing per distinct date: a second due date issues the same requests too, and D6's one getAll on observations is all there is.
    expect(twoDates.requests).toEqual(twoTrades.requests);
    expect(on(twoDates.requests, 'observations')).toEqual([GET_ALL]);
  });

  it('should add at most one Historical frame request to a Trade Detail whose contract is due', { timeout: 120_000 }, async () => {
    const { d, app } = await onboardedAt(MONDAY_NEXT_1700);
    const tradeId = await fridayCall(app);
    const detailOf = async (application: Application) => {
      const counted = await countRequests(() => application.TradeViewsAndReporting.getTradeDetail({ tradeId }));
      if (counted.result.kind !== 'Ready') throw new Error(`getTradeDetail: ${counted.result.kind}`);
      return { requests: on(counted.requests, 'observations'), view: counted.result.view };
    };
    // Thursday 17:00: the contract is not yet due, so Detail does only D4's reads.
    const thursday = await restart(app, { ...d, now: THURSDAY_1700 });
    const notDue = await detailOf(thursday);
    const monday = await restart(thursday, { ...d, now: MONDAY_NEXT_1700 });
    const due = await detailOf(monday);
    expect('settlement' in notDue.view && notDue.view.settlement).toEqual([]);
    expect('settlement' in due.view && due.view.settlement).toHaveLength(1);
    expect(due.requests.length - notDue.requests.length).toBeLessThanOrEqual(1);
  });
});
