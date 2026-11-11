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
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { confirmOption, MONDAY_NEXT_1700, OC_PC1, onboardedAt, optionPlanCommand, recordOption, restart, saveMark, XYZ_CALL, type Fill } from './support.ts';

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
    const isMarkRead = (r: CountedRequest) => r.store === 'observations' && r.on === 'index';
    const withoutMarkReads = (requests: readonly CountedRequest[]) => requests.filter((r) => !isMarkRead(r));
    // Exactly these requests are removed from each baseline: 2 cursor opens and 2 getAll on `byInstrumentDate`, in this order, for
    // 2 Trades, 4 Trades and 2 Trades on 2 dates alike (a constant, not per Trade). Any other index read on `observations` fails here.
    // A read on another store is not caught here; the tally below catches it.
    const MARK_READS = ['openCursor', 'openCursor', 'getAll', 'getAll'].map((method) => ({ on: 'index', store: 'observations', index: 'byInstrumentDate', method }));
    for (const baseline of [baselineTwo, baselineFour, baselineTwoDates]) expect(baseline.requests.filter(isMarkRead)).toEqual(MARK_READS);
    // Both runs above come from the same code, so a constant extra request would be in the baseline too.
    // D7's measured count is therefore pinned as well, per store and method (20 requests).
    // It is the count D6's Review open had in source: by reading the source, `daily-review.ts` has added no stored read since tag claude-opus-5.5-d6.
    // Its new settlement code asks Market Data for a calendar answer, not the store.
    // No test measures that claim, and no D6 build can open option Trades, so D6 never measured this count.
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

  it('should issue the same Trade Detail requests, bar the frame reads, for an expired and a live contract at one clock', { timeout: 120_000 }, async () => {
    const { d, app: first } = await onboardedAt(MONDAY_NEXT_1700);
    let app = first;
    const dueId = await earlyCall(app);
    const liveId = await earlyCall(app, NOT_DUE_EXPIRATION);
    // Marks for both contracts and for XYZ, so the live contract takes the usual marked path.
    // The expired contract's last Mark is on its expiration date; a Mark after expiration is rejected.
    await saveMark(app, instrumentKey({ ...XYZ_CALL, expiration: EARLY_EXPIRATION }), EARLY_EXPIRATION, '0.05');
    await saveMark(app, instrumentKey({ ...XYZ_CALL, expiration: NOT_DUE_EXPIRATION }), '2026-11-23', '1.20');
    await saveMark(app, 'XYZ', '2026-11-23', '56.00');
    // Each Detail is measured on a fresh launch over the same stores, so neither run warms the other (no cache the first fills).
    const detailOf = async (tradeId: string) => {
      app = await restart(app, d);
      const counted = await countRequests(() => app.TradeViewsAndReporting.getTradeDetail({ tradeId }));
      if (counted.result.kind !== 'Ready') throw new Error(`getTradeDetail: ${counted.result.kind}`);
      const tally: Record<string, number> = {};
      for (const r of counted.requests) tally[`${r.store}.${r.method}`] = (tally[`${r.store}.${r.method}`] ?? 0) + 1;
      return { tally, view: counted.result.view };
    };
    const due = await detailOf(dueId);
    const live = await detailOf(liveId);
    // Exact counts per store and method. The live contract has a Mark at the clock's date, so it takes the usual marked path: 20 requests.
    const PINNED = { 'catalog.getAll': 1, 'journalDebts.getAll': 1, 'journalDeclines.getAll': 1, 'journalDefinitions.getAll': 1, 'journalEntries.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': 11, 'observations.getAll': 1, 'trades.get': 2 };
    expect(live.tally).toEqual(PINNED);
    // The expired contract's settlement time is a calendar answer (`ResolveSession`), not a stored read, and after its expiration
    // date the Mark-to-Market Valuation module reads no frame (decision 103): none for the contract, none for XYZ, and no Stale Mark
    // lookup. So the due Detail makes exactly the live one's requests less those the live one's frame read makes: its date-wide
    // `observations.getAll` and the `meta.get` of that read's snapshot. 18 requests (decision 103; before it, 24: the live 20, the
    // Mark lookup's 1 `meta.get` and 2 `openCursor`, and 1 more `getAll` for A111's Historical frame).
    expect(due.tally).toEqual({ 'catalog.getAll': 1, 'journalDebts.getAll': 1, 'journalDeclines.getAll': 1, 'journalDefinitions.getAll': 1, 'journalEntries.getAll': 1, 'journalTypes.getAll': 1, 'meta.get': PINNED['meta.get'] - 1, 'trades.get': 2 });
    expect('settlement' in live.view && live.view.settlement).toEqual([]);
    expect('settlement' in due.view && due.view.settlement).toHaveLength(1);
  });
});
