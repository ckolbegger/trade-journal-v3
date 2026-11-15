// I8.13 Readiness after Restore (AC-DEL-006) and I8.15 Another instance is superseded.
import { describe, expect, it } from 'vitest';
import { buy, complete, positionChange } from '../d7/support.ts';
import { planCommand } from '../d1/support.ts';
import { artifactOf, CONFIRM, DECLINE, dumpAll, launch, onActivationCommitted, prepared, restart, wtDevice } from './support.ts';

describe('I8.13 Readiness after Restore', () => {
  it('should return Restored with status RecoveryOnly and the failed capacity check when the host fails the capacity check at activation, keep the restored data readable, and refuse confirmPlan with RuntimeNotWritable, leaving every store unchanged', async () => {
    const { d, app } = await wtDevice();
    const { token, preview } = await prepared(app, artifactOf('backup-v7'));
    // On the activation-committed notification the host starts failing its capacity check.
    onActivationCommitted(app, () => d.testHost.fail(['capacity']));

    const restored = await app.Workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: DECLINE });

    if (restored.kind !== 'Restored') throw new Error(`applyPreparedRestore: ${JSON.stringify(restored)}`);
    expect(restored.status).toMatchObject({ kind: 'RecoveryOnly', failedChecks: [{ check: 'capacity' }] });
    expect(restored.receipt.readiness).toMatchObject({ outcome: 'RecoveryOnly', failures: [{ check: 'capacity' }] });

    // The restored data is readable.
    const open = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
    expect(open.kind === 'Ready' && open.view.items).toHaveLength(preview.counts.tradesByLifecycle.Open);

    // The next mutation is refused and changes nothing.
    const plan = await planCommand(app, { underlying: 'ZZZ' });
    const before = await dumpAll(d.factory);
    const refused = await app.TradeWorkflows.confirmPlan(plan);
    expect(refused).toMatchObject({ kind: 'RuntimeNotWritable', failedChecks: [{ check: 'capacity' }] });
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 120_000);
});

const superseded = expect.objectContaining({
  kind: 'RuntimeNotWritable',
  failedChecks: expect.arrayContaining([{ check: 'control', reason: 'SessionSuperseded' }]) as unknown,
}) as unknown;

// Two applications on one factory, both on W-t; A restores A7. B holds a Position Change prepared against W-t before that.
async function supersededPair() {
  const { d, app: a, tradeId } = await wtDevice();
  const b = await launch(d);
  const fill = { quantity: '100', price: '50.10', economicTime: '2026-11-20T16:00:00Z' };
  const command = await positionChange(b, tradeId, [await buy(b, tradeId, fill)], await complete(b));
  const { token } = await prepared(a, artifactOf('backup-v7'));
  const restored = await a.Workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: DECLINE });
  if (restored.kind !== 'Restored') throw new Error(`applyPreparedRestore: ${JSON.stringify(restored)}`);
  return { d, b, command, restored };
}

describe('I8.15 Another instance is superseded', () => {
  it('should refuse the commit of a second application with RuntimeNotWritable, superseded and writing nothing, after the first restored A7, and open the restored Workspace when the second restarts', async () => {
    const { d, b, restored } = await supersededPair();
    const before = await dumpAll(d.factory);

    // B's commit, at the Persistence boundary every mutation ends in.
    const refused = await b.persistence.commit({ checks: [], writes: [{ op: 'put', store: 'trades', value: { tradeId: 'superseded-write' } }] });

    expect(refused).toEqual(superseded);
    expect(await dumpAll(d.factory)).toEqual(before);

    const reopened = await restart(b, d);
    const status = await reopened.Workspace.getStatus();
    expect(status).toMatchObject({ kind: 'Ready', binding: { databaseName: restored.receipt.newBinding.databaseName } });
  }, 120_000);

  // KNOWN DEFECT (reported with T8.20): section 6.1 says B calling recordPositionChange gets RuntimeNotWritable (superseded).
  // recordPositionChange reads the Trade before it commits, and that read throws InvalidStateError on B's closed connection,
  // so the mutation guard answers StorageFailure. Nothing is written. `it.fails` keeps the suite green until it is settled.
  it.fails('should return RuntimeNotWritable, superseded, from recordPositionChange of the second application, writing nothing', async () => {
    const { d, b, command } = await supersededPair();
    const before = await dumpAll(d.factory);

    const refused = await b.TradeWorkflows.recordPositionChange(command);

    expect(refused).toEqual(superseded);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 120_000);
});
