// I7S.11: the write gate refuses a Plan holding option-price conditions while the inventory check fails (AC-DEL-004,
// AC-DEL-006): confirmPlan for O-S2 and a direct Persistence.commit each return RuntimeNotWritable and leave every
// store unchanged, and the Detail stays readable, equal to what it was while Writable.
import { describe, expect, it } from 'vitest';
import { detailOf, device, dumpAll, onboarded, openOs2, os2Command, restart, TUESDAY_1700_NY } from './support.ts';

const notWritable = expect.objectContaining({
  kind: 'RuntimeNotWritable',
  failedChecks: expect.arrayContaining([expect.objectContaining({ check: 'inventory' })]) as unknown,
}) as unknown;

describe('I7S.11 Write gate', () => {
  it('should return RuntimeNotWritable from confirmPlan for O-S2 and from a direct Persistence.commit, leave every store unchanged and keep the Detail readable', async () => {
    const d = await device(undefined, TUESDAY_1700_NY);
    const app = await onboarded(d);
    const tradeId = await openOs2(app);
    // A second O-S2 command is prepared while the host is healthy; then the host fails the inventory check.
    const plan = await os2Command(app);
    const healthy = await detailOf(app, tradeId);

    d.testHost.fail(['inventory']);
    const recovery = await restart(app, d);
    const before = await dumpAll(d.factory);

    expect((await recovery.Workspace.getStatus()).kind).toBe('RecoveryOnly');
    expect(await recovery.TradeWorkflows.confirmPlan(plan)).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
    expect(await recovery.persistence.commit({ checks: [], writes: [{ op: 'put', store: 'trades', value: { tradeId, direct: true } }] })).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);

    // The Detail, with its option-price conditions, is still readable and equal.
    expect(await detailOf(recovery, tradeId)).toEqual(healthy);
  }, 60_000);
});
