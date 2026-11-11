// T7SP.8 query count (P84, decisions 102 and 104, AC-PERF-001): the Review `open` makes no request for an option Trade's dated
// line, so it issues D6's requests whatever option Trades it holds; `getTrade` adds at most one `observations` read for its
// Trade's dated line, whatever the Trade count. Counted with the real facade on fake-indexeddb wrapped in the disclosed request
// counter (D2 section 6.0), at Tuesday 2026-10-13 17:00 with the Trades bought Monday and their Marks only for Monday, so each
// option Trade's current figures need Monday's close as a dated line. Decision 104 retargets the draft's P84 cases, which
// assumed the open's items carry the line.
import { describe, expect, it } from 'vitest';
import { nyseSessionPolicy } from '../../../src/domain/session-policy/index.ts';
import { fixedClock } from '../../../src/domain/time/index.ts';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { createMarketData } from '../../../src/modules/market-data/index.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';
import { sequentialIds } from '../../support/workspace.ts';
import type { Application } from '../../../src/app/compose.ts';
import { confirmOption, OC_PC1, OC_PC2, onboardedAt, planStock, PC1_TIME, record, recordOption, saveMark, TUESDAY_1700, XYZ_CALL } from '../d7/support.ts';

const MONDAY_DATE = '2026-10-12';
const REVIEW_DATE = '2026-10-13';

const on = (requests: readonly CountedRequest[], store: string) => requests.filter((r) => r.store === store);
const GET_ALL = { on: 'store', store: 'observations', method: 'getAll' };
const CURSOR = { on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'openCursor' };
const SCAN = { on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'getAll' };

// `calls` Long Calls on XYZ bought Monday, with Monday's Marks for the contract and XYZ.
async function callsAtMonday(calls: number) {
  const { app } = await onboardedAt(TUESDAY_1700);
  const tradeIds: string[] = [];
  for (let n = 0; n < calls; n++) {
    const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
    await recordOption(app, tradeId, 'Buy', OC_PC1);
    await recordOption(app, tradeId, 'Buy', OC_PC2);
    tradeIds.push(tradeId);
  }
  await saveMark(app, instrumentKey(XYZ_CALL), MONDAY_DATE, '2.20');
  await saveMark(app, 'XYZ', MONDAY_DATE, '52.00');
  return { app, tradeIds };
}

const reviewOpen = (app: Application) => countRequests(() => app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 }));

// What `recover` reads for the same Review date and Instruments: D6's requests on `observations`.
async function recoverReads(app: Application, instruments: readonly { instrumentKey: string; earliestExposure: string }[]) {
  const marketData = createMarketData({ persistence: app.persistence, ids: sequentialIds('md'), clock: fixedClock(TUESDAY_1700), sessionPolicy: nyseSessionPolicy });
  return on((await countRequests(() => marketData.recover({ context: { kind: 'Review', reviewDate: REVIEW_DATE }, instruments }))).requests, 'observations');
}

describe('the Review requests with option dated lines (P84, decision 104)', () => {
  it('should make no request for option Trades dated lines in the Review open', { timeout: 120_000 }, async () => {
    const one = await callsAtMonday(1);
    const two = await callsAtMonday(2);

    const openOne = await reviewOpen(one.app);
    const openTwo = await reviewOpen(two.app);

    if (openOne.result.kind !== 'Ready' || openTwo.result.kind !== 'Ready') throw new Error('open: not Ready');
    // Tuesday's date-wide read, the Stale lookups of the two Instruments missing on Tuesday, then their gap scans: D6's recovery,
    // and no read of Monday's date for a dated line. Nothing per Trade.
    expect(on(openOne.requests, 'observations')).toEqual([GET_ALL, CURSOR, CURSOR, SCAN, SCAN]);
    expect(openTwo.requests).toEqual(openOne.requests);
    const exposure = OC_PC1.economicTime;
    expect(await recoverReads(one.app, [{ instrumentKey: 'XYZ', earliestExposure: exposure }, { instrumentKey: instrumentKey(XYZ_CALL), earliestExposure: exposure }])).toEqual(on(openOne.requests, 'observations'));
  });

  it('should add at most one observations read for the Trade dated line in getTrade', { timeout: 120_000 }, async () => {
    for (const calls of [1, 2]) {
      const { app, tradeIds } = await callsAtMonday(calls);
      const open = await reviewOpen(app);
      const opened = open.result;
      if (opened.kind !== 'Ready') throw new Error('open: not Ready');

      const card = await countRequests(() => app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId: tradeIds[0]!, binding: opened.binding }));

      if (card.result.kind !== 'Ready') throw new Error(`getTrade: ${card.result.kind}`);
      expect(card.result.trade.datedLastClose?.tradingDate).toBe(MONDAY_DATE);
      // Tuesday's date-wide read and the Stale lookups of the open's Instruments, then one read of Monday's date for the line.
      expect(on(card.requests, 'observations')).toEqual([GET_ALL, CURSOR, CURSOR, GET_ALL]);
      expect(on(card.requests, 'observations').filter((r) => r.on === 'store' && r.method === 'getAll')).toHaveLength(on(open.requests, 'observations').filter((r) => r.on === 'store' && r.method === 'getAll').length + 1);
    }
  });

  it('should keep D6 requests exactly for a Review with no option dated line', { timeout: 120_000 }, async () => {
    const { app } = await onboardedAt(TUESDAY_1700);
    const tradeId = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');
    await record(app, tradeId, { quantity: '100', price: '50.00', economicTime: PC1_TIME });
    await saveMark(app, 'XYZ', REVIEW_DATE, '52.00');

    const open = await reviewOpen(app);

    if (open.result.kind !== 'Ready') throw new Error('open: not Ready');
    // One date-wide read and one scan of XYZ's history: the requests `recover` makes for the same Review.
    expect(on(open.requests, 'observations')).toEqual([GET_ALL, SCAN]);
    expect(await recoverReads(app, [{ instrumentKey: 'XYZ', earliestExposure: PC1_TIME }])).toEqual(on(open.requests, 'observations'));
  });
});
