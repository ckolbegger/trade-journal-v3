// T8P.9: days to expiration on the contract's expiration line (A208), and the line on confirmPlan's post-commit result (A209).
// Through the real facade on fake-indexeddb.
import { describe, expect, it } from 'vitest';
import {
  closeReviewDisposition, confirmOption, confirmOs2, detailOf, FRIDAY_1600, FRIDAY_1700, OC_PC1, OC_PC2, OC_X1, onboardedAt, openOs2, recordExpiration, recordOption, saveSession, TUESDAY, TUESDAY_1700_NY,
} from '../d7s/support.ts';
import { MONDAY_0900, oc3Command } from './support.ts';

const EXPIRATION_FRIDAY_0900_NY = '2026-12-18T14:00:00Z';

describe('expiration line: days (A208)', () => {
  it("should give an Open O-S2's line \"Expires\" 2026-12-18 with 66 days on Tue 10-13", async () => {
    const { app } = await onboardedAt(TUESDAY_1700_NY);
    const tradeId = await openOs2(app);

    const detail = await detailOf(app, tradeId);

    expect('positions' in detail && detail.contractExpiration).toEqual({ status: 'Expires', date: '2026-12-18', days: 66 });
  });

  it('should give 0 days on the expiration date, before the contract is Settlement Due', async () => {
    const { app } = await onboardedAt(EXPIRATION_FRIDAY_0900_NY);
    const tradeId = await openOs2(app);

    const detail = await detailOf(app, tradeId);

    if (!('positions' in detail)) throw new Error('expected an Open Detail');
    expect(detail.settlement).toHaveLength(0);
    expect(detail.contractExpiration).toEqual({ status: 'Expires', date: '2026-12-18', days: 0 });
  });

  it('should give no days on an Expired line', async () => {
    const { app } = await onboardedAt(FRIDAY_1700);
    const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
    await recordOption(app, tradeId, 'Buy', OC_PC1);
    await recordOption(app, tradeId, 'Buy', OC_PC2);
    await recordOption(app, tradeId, 'Sell', OC_X1);
    await recordExpiration(app, tradeId, '1', FRIDAY_1600, { closeReview: await closeReviewDisposition(app, 'Complete') });

    const detail = await detailOf(app, tradeId);

    if (!('terminalDisposition' in detail)) throw new Error('expected a Closed Detail');
    expect(detail.contractExpiration).toEqual({ status: 'Expired', date: '2026-11-20' });
  });
});

describe('just-confirmed Plan: expiration line (A209, tech debt item 23)', () => {
  it("should carry the expiration line in confirmPlan's post-commit result, equal to the Planned Detail read afterwards", async () => {
    const { app } = await onboardedAt(TUESDAY_1700_NY);

    const confirmed = await confirmOs2(app);
    const detail = await detailOf(app, confirmed.receipt.tradeId);

    expect(confirmed.postCommit.contractExpiration).toEqual({ status: 'Expires', date: '2026-12-18', days: 66 });
    expect('contractExpiration' in detail && detail.contractExpiration).toEqual(confirmed.postCommit.contractExpiration);
  });
});

// Plan section 6.1's I8P.5 and I8P.6. The cases above are T8P.9's, titled "should ..." (that file's convention); these two carry the
// section 6.1 names word for word. The expiration-line figures of I8P.5 are also T8P.9's first case, above; this one adds the nearest marks.
describe('I8P.5 Nearest and days', () => {
  it('I8P.5 Nearest and days', async () => {
    const { app } = await onboardedAt(TUESDAY_1700_NY);
    const tradeId = await openOs2(app);
    await saveSession(app, TUESDAY, { mno: '44.00', put: '1.80' });

    const detail = await detailOf(app, tradeId);

    if (!('positions' in detail)) throw new Error('expected an Open Detail');
    expect(detail.current.evaluation.conditions.filter((c) => c.nearest === true).map((c) => c.id)).toEqual(['stop-2', 'target-1']);
    expect(detail.current.evaluation.conditions.map((c) => c.id)).toEqual(['stop-1', 'stop-2', 'target-1', 'target-2']);
    expect(detail.contractExpiration).toEqual({ status: 'Expires', date: '2026-12-18', days: 66 });
  });
});

describe('I8P.6 Confirmed Plan (AC-RESP-001, re-proven)', () => {
  it('I8P.6 Confirmed Plan (AC-RESP-001, re-proven)', async () => {
    const { app } = await onboardedAt(MONDAY_0900);

    const confirmed = await app.TradeWorkflows.confirmPlan(await oc3Command(app));
    if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan: ${confirmed.kind}`);
    const detail = await detailOf(app, confirmed.receipt.tradeId);

    // O-C3's 18 Dec 2026 55 Call, on Monday 10-12: 67 days.
    expect(confirmed.postCommit.contractExpiration).toEqual({ status: 'Expires', date: '2026-12-18', days: 67 });
    expect('contractExpiration' in detail && detail.contractExpiration).toEqual(confirmed.postCommit.contractExpiration);
  });
});
