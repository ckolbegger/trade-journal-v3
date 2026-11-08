// I7.12: the write gate refuses every D7 write while the inventory check fails (AC-DEL-004, AC-DEL-006): confirmPlan for an
// option Plan, recordPositionChange for E1 and a direct Persistence.commit each return RuntimeNotWritable and leave every
// store unchanged, and the Detail, both payoff views and the Review stay readable. One case per boundary.
import { describe, expect, it } from 'vitest';
import {
  closeReviewDisposition, complete, confirmOption, detailOf, device, dumpAll, expirationMember, FRIDAY_1600, FRIDAY_1700, OC_PC1, OC_PC2, OC_X1, onboarded, optionCommand, optionPlanCommand, recordOption,
  restart, reviewAt,
} from './support.ts';

const notWritable = expect.objectContaining({
  kind: 'RuntimeNotWritable',
  failedChecks: expect.arrayContaining([expect.objectContaining({ check: 'inventory' })]) as unknown,
}) as unknown;

// O-C after X1 is Open with one contract; a second O-C Plan command and E1 are prepared while the host is healthy. Then
// the host fails the inventory check and the application restarts into Recovery Only.
async function failedHost() {
  const d = await device(undefined, FRIDAY_1700);
  const app = await onboarded(d);
  const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
  await recordOption(app, tradeId, 'Buy', OC_PC1);
  await recordOption(app, tradeId, 'Buy', OC_PC2);
  await recordOption(app, tradeId, 'Sell', OC_X1);
  const plan = await optionPlanCommand(app, 'O-C');
  const expiration = await optionCommand(app, tradeId, [await expirationMember(app, tradeId, '1', FRIDAY_1600)], { reflection: await complete(app), closeReview: await closeReviewDisposition(app, 'Complete') });
  const healthy = { detail: await detailOf(app, tradeId), review: { ...(await reviewAt(app, FRIDAY_1700)), binding: undefined } };

  d.testHost.fail(['inventory']);
  const recovery = await restart(app, d);
  const before = await dumpAll(d.factory);
  return { d, recovery, tradeId, plan, expiration, healthy, before };
}

describe('I7.12 Write gate', () => {
  it('should return RuntimeNotWritable from confirmPlan for O-C and leave every store unchanged', async () => {
    const { d, recovery, plan, before } = await failedHost();

    expect(await recovery.TradeWorkflows.confirmPlan(plan)).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);

  it('should return RuntimeNotWritable from recordPositionChange for E1 and leave every store unchanged', async () => {
    const { d, recovery, expiration, before } = await failedHost();

    expect(await recovery.TradeWorkflows.recordPositionChange(expiration)).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);

  it('should return RuntimeNotWritable from a direct Persistence.commit and leave every store unchanged', async () => {
    const { d, recovery, tradeId, before } = await failedHost();

    expect(await recovery.persistence.commit({ checks: [], writes: [{ op: 'put', store: 'trades', value: { tradeId, direct: true } }] })).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);

  it('should keep the Detail, both payoff views and the Review readable in recovery, equal to what they were while Writable', async () => {
    const { d, recovery, tradeId, healthy, before } = await failedHost();

    expect((await recovery.Workspace.getStatus()).kind).toBe('RecoveryOnly');
    const detail = await detailOf(recovery, tradeId);
    if (!('payoff' in detail)) throw new Error('expected a Detail with payoff views');
    expect(detail.payoff.planned.kind).toBe('Value');
    expect(detail.payoff.current.kind).toBe('Value');
    expect(detail).toEqual(healthy.detail);
    const review = await reviewAt(recovery, FRIDAY_1700);
    expect(review.kind).toBe('Ready');
    expect({ ...review, binding: undefined }).toEqual(healthy.review);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);
});
