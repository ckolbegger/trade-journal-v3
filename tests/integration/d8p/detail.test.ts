// T8P.9: days to expiration on the contract's expiration line (A208), and the line on confirmPlan's post-commit result (A209).
// Through the real facade on fake-indexeddb.
import { describe, expect, it } from 'vitest';
import {
  closeReviewDisposition, confirmOption, confirmOs2, detailOf, FRIDAY_1600, FRIDAY_1700, OC_PC1, OC_PC2, OC_X1, onboardedAt, openOs2, recordExpiration, recordOption, TUESDAY_1700_NY,
} from '../d7s/support.ts';

const EXPIRATION_FRIDAY_0900_NY = '2026-12-18T14:00:00Z';

describe('expiration line: days (A208)', () => {
  it('should give an Open O-S2 line Expires 2026-12-18 with 66 days on Tue 10-13', async () => {
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
  it('should carry the expiration line in confirmPlan post-commit result, equal to the Planned Detail read afterwards', async () => {
    const { app } = await onboardedAt(TUESDAY_1700_NY);

    const confirmed = await confirmOs2(app);
    const detail = await detailOf(app, confirmed.receipt.tradeId);

    expect(confirmed.postCommit.contractExpiration).toEqual({ status: 'Expires', date: '2026-12-18', days: 66 });
    expect('contractExpiration' in detail && detail.contractExpiration).toEqual(confirmed.postCommit.contractExpiration);
  });
});
