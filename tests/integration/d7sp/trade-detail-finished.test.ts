// T7SP.17: Trade Detail carries the held quantity and the contract's expiration line (decision 105), so the UI shows
// them without summing Positions or inspecting the Terminal Disposition. Through the real facade on fake-indexeddb.
import { describe, expect, it } from 'vitest';
import { dec } from '../d2/support.ts';
import { PC1_TIME, planStock, record } from '../d6/support.ts';
import {
  closeReasonId, closeReviewDisposition, confirmOption, detailOf, FRIDAY_1600, FRIDAY_1700, OC_PC1, OC_PC2, OC_X1, onboardedAt, OS_S1, recordExpiration, recordOption, THURSDAY_1700,
} from '../d7/support.ts';

describe('Trade Detail as a finished read (decision 105)', () => {
  it('should give an Open stock Trade Detail its held quantity, the sum of its Positions signed quantities', async () => {
    const { app } = await onboardedAt(THURSDAY_1700);
    const tradeId = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');
    await record(app, tradeId, { quantity: '60', price: '50.00', economicTime: PC1_TIME });
    await record(app, tradeId, { quantity: '40', price: '50.20', economicTime: PC1_TIME });

    const detail = await detailOf(app, tradeId);

    if (!('positions' in detail)) throw new Error('expected an Open Detail');
    expect(detail.heldQuantity).toEqual(dec('100'));
    expect('contractExpiration' in detail).toBe(false);
  });

  it('should give an Open option Trade Detail the expiration line Expires with its contract expiration date', async () => {
    const { app } = await onboardedAt(THURSDAY_1700);
    const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
    await recordOption(app, tradeId, 'Buy', OC_PC1);

    const detail = await detailOf(app, tradeId);

    expect('positions' in detail && detail.contractExpiration).toEqual({ status: 'Expires', date: '2026-11-20' });
  });

  it('should give a Planned option Trade Detail the expiration line Expires', async () => {
    const { app } = await onboardedAt(THURSDAY_1700);
    const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;

    const detail = await detailOf(app, tradeId);

    expect(detail.lifecycle).toEqual({ stored: 'Planned', agreement: { kind: 'Agrees' } });
    expect('contractExpiration' in detail && detail.contractExpiration).toEqual({ status: 'Expires', date: '2026-11-20' });
  });

  it('should give no expiration line to an Open option Trade whose contract is Settlement Due, since its panel says so', async () => {
    const { app } = await onboardedAt(FRIDAY_1700);
    const tradeId = (await confirmOption(app, 'O-S')).receipt.tradeId;
    await recordOption(app, tradeId, 'Sell', OS_S1);

    const detail = await detailOf(app, tradeId);

    if (!('positions' in detail)) throw new Error('expected an Open Detail');
    expect(detail.settlement).toHaveLength(1);
    expect('contractExpiration' in detail).toBe(false);
  });

  it('should give a Closed option Trade whose Terminal Disposition includes an Expiration the line Expired with the date', async () => {
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

  it('should give no expiration line to a Closed option Trade that only Executions disposed of (decision 94)', async () => {
    const { app } = await onboardedAt(THURSDAY_1700);
    const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
    await recordOption(app, tradeId, 'Buy', OC_PC1);
    await recordOption(app, tradeId, 'Sell', OC_X1, { closeReasonId: await closeReasonId(app, 'Target Reached'), closeReview: await closeReviewDisposition(app, 'Complete') });

    const detail = await detailOf(app, tradeId);

    if (!('terminalDisposition' in detail)) throw new Error('expected a Closed Detail');
    expect(detail.terminalDisposition).toEqual(expect.objectContaining({ kind: 'Value' }));
    expect('contractExpiration' in detail).toBe(false);
  });
});
