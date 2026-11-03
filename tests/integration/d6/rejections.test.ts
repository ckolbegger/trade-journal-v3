// I6.5 and I6.6: exits the application refuses write nothing, checked on the whole Workspace dump
// (AC-POS-004 requirements, P22 position paths).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import type { PositionChangeCommand } from '../../../src/coordinators/trade-workflows/index.ts';
import {
  buy, closeReasonId, closeReviewDisposition, complete, confirmReference, dec, device, dumpAll, exitCommand, MONDAY_1030, onboarded, PC1, PC2, PC3, positionChange, record, recordExit, TUESDAY_1000, TUESDAY_1400, TUESDAY_1700,
  type Fill,
} from './support.ts';

// The reference Trade after PC1 and PC2 (100 shares), on an onboarded Workspace whose clock reads
// Tuesday 17:00, so the Tuesday exits are not in the future.
async function afterPc2() {
  const d = await device(undefined, TUESDAY_1700);
  const app = await onboarded(d);
  const tradeId = await confirmReference(app);
  await record(app, tradeId, PC1);
  await record(app, tradeId, PC2);
  return { d, app, tradeId };
}

const sellOf = (quantity: string, economicTime: string): Fill => ({ quantity, price: '52.00', economicTime, fee: '0.60' });

// Records the command and requires it to be Rejected with no write: the dump is equal before and after.
async function rejected(app: Application, d: { factory: Parameters<typeof dumpAll>[0] }, command: PositionChangeCommand) {
  const before = await dumpAll(d.factory);
  const result = await app.TradeWorkflows.recordPositionChange(command);
  if (result.kind !== 'Rejected') throw new Error(`expected Rejected, got ${result.kind}`);
  expect(await dumpAll(d.factory)).toEqual(before);
  return result.issues;
}

describe('I6.5 Close requirements write nothing', () => {
  it('should reject a terminal exit without a Close Reason and Close Review disposition, a Close Reason on a partial exit, and a Strategy identity as Close Reason, leaving the dump unchanged', async () => {
    const { d, app, tradeId } = await afterPc2();
    const targetReached = await closeReasonId(app, 'Target Reached');

    // Terminal X2 (all 100 shares) with neither.
    const missing = await rejected(app, d, await exitCommand(app, tradeId, [sellOf('100', TUESDAY_1400)]));
    expect(missing.map((i) => [i.source, i.field, i.code])).toEqual([
      ['TradeWorkflows', 'closeReasonId', 'CloseReasonRequired'],
      ['TradeWorkflows', 'closeReview', 'CloseReviewDispositionRequired'],
    ]);

    // X1 (30 of 100 shares) with a Close Reason.
    const partial = await rejected(app, d, await exitCommand(app, tradeId, [sellOf('30', TUESDAY_1000)], { closeReasonId: targetReached }));
    expect(partial.map((i) => [i.source, i.field, i.code])).toEqual([['TradeWorkflows', 'closeReasonId', 'CloseReasonNotApplicable']]);

    // Terminal X2 with a Strategy identity as its Close Reason.
    const strategies = await app.ReferenceCatalog.query({ family: 'Strategy' });
    if (strategies.kind !== 'Page') throw new Error('no Strategies');
    const wrong = await rejected(app, d, await exitCommand(app, tradeId, [sellOf('100', TUESDAY_1400)], { closeReasonId: strategies.items[0]!.id, closeReview: await closeReviewDisposition(app, 'Complete') }));
    expect(wrong).toEqual([expect.objectContaining({ source: 'ReferenceCatalog', field: 'closeReasonId', code: 'WrongKind' })]);
  }, 60_000);
});

describe('I6.6 Position paths write nothing', () => {
  it('should reject a Sell of 101, a Sell of 70 dated Monday 10:30, a Sell of 60 dated Monday 10:30, and a Buy on the Closed Trade, leaving the dump unchanged', async () => {
    const { d, app, tradeId } = await afterPc2();

    const tooMany = await rejected(app, d, await exitCommand(app, tradeId, [sellOf('101', TUESDAY_1000)]));
    expect(tooMany).toEqual([expect.objectContaining({ source: 'TradeAnalysis', code: 'ExceedsOpenQuantity', available: dec('100') })]);

    // At 10:30 only PC1's 60 shares are held: PC2 is dated 11:00.
    const early = await rejected(app, d, await exitCommand(app, tradeId, [sellOf('70', MONDAY_1030)]));
    expect(early).toEqual([expect.objectContaining({ source: 'TradeAnalysis', code: 'ExceedsOpenQuantity', available: dec('60') })]);

    // Selling 60 at 10:30 would leave the Position flat before PC2's later fact.
    const flat = await rejected(app, d, await exitCommand(app, tradeId, [sellOf('60', MONDAY_1030)]));
    expect(flat.map((i) => [i.source, i.code])).toEqual([['TradeAnalysis', 'FlatBeforeLaterFacts']]);

    // After X2 closes the Trade, a Buy is refused.
    await recordExit(app, tradeId, [sellOf('100', TUESDAY_1400)], { closeReasonId: await closeReasonId(app, 'Target Reached'), closeReview: await closeReviewDisposition(app, 'Complete') });
    const closed = await rejected(app, d, await positionChange(app, tradeId, [await buy(app, tradeId, PC3)], await complete(app)));
    expect(closed).toEqual([expect.objectContaining({ code: 'TradeClosed' })]);
  }, 60_000);
});
