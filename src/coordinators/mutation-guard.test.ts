import { describe, expect, it, vi } from 'vitest';
import { createReadinessSession, type ReadinessEvaluation } from '../delivery/readiness.ts';
import { createMutationGuard } from './mutation-guard.ts';

const passed = { passed: true } as const;
const writable: ReadinessEvaluation = {
  outcome: 'Writable',
  failures: [],
  protection: 'BestEffort',
  checks: { diagnostic: passed, capacity: passed, control: passed, inventory: passed },
};
const recoveryOnly: ReadinessEvaluation = {
  outcome: 'RecoveryOnly',
  workspaceStatus: 'RecoveryOnly',
  failures: [{ check: 'inventory', reason: 'InventoryInvalid' }],
  protection: 'BestEffort',
  checks: { ...writable.checks, inventory: { passed: false, reason: 'InventoryInvalid' } },
};

// A session whose successive evaluations come from `sequence`, repeating the last.
async function sessionOf(...sequence: ReadinessEvaluation[]) {
  const evaluate = vi.fn(() => Promise.resolve(sequence.length > 1 ? sequence.shift()! : sequence[0]!));
  const session = await createReadinessSession(evaluate);
  return { session, evaluate };
}

describe('mutation-boundary recheck', () => {
  it('should re-run readiness before each authoritative mutation and return RuntimeNotWritable without calling the mutation when the recheck fails', async () => {
    const { session, evaluate } = await sessionOf(writable, recoveryOnly);
    const mutation = vi.fn(() => Promise.resolve('done'));
    const result = await createMutationGuard(session).run('ReferenceCatalog.save', mutation);
    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(mutation).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ kind: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly' }));
  });

  it('should downgrade the session and return RuntimeNotWritable when a commit fails with a storage error and the re-evaluated readiness is no longer Writable', async () => {
    const { session } = await sessionOf(writable, writable, recoveryOnly);
    const failingCommit = () => Promise.reject(new DOMException('disk gone', 'UnknownError'));
    const result = await createMutationGuard(session).run('TradeWorkflows.confirmPlan', failingCommit);
    expect(result).toEqual(expect.objectContaining({ kind: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly' }));
    expect(session.current().outcome).toBe('RecoveryOnly');
  });

  it('should return a typed StorageFailure, not RuntimeNotWritable, when a commit fails with a storage error but readiness still passes', async () => {
    const { session } = await sessionOf(writable);
    const failingCommit = () => Promise.reject(new DOMException('transient', 'UnknownError'));
    const result = await createMutationGuard(session).run('TradeWorkflows.confirmPlan', failingCommit);
    expect(result).toEqual({ kind: 'StorageFailure', reason: 'UnknownError' });
    expect(session.current().outcome).toBe('Writable');
  });

  it('should not apply the gate to requestDurability', async () => {
    const { session, evaluate } = await sessionOf(recoveryOnly);
    const request = vi.fn(() => Promise.resolve({ kind: 'NotImproved' }));
    const result = await createMutationGuard(session).run('Workspace.requestDurability', request);
    expect(result).toEqual({ kind: 'NotImproved' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });
});
