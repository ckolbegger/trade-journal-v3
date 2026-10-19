import type { ReadinessSession } from '../delivery/readiness.ts';
import type { RuntimeNotWritable } from '../delivery/runtime-not-writable.ts';
import { toRuntimeNotWritable } from '../delivery/write-gate.ts';

// Wraps every authoritative mutation the facade exposes: readiness is rerun immediately before
// it (D1 A4), so a mid-session cache or storage failure is caught at the next mutation.
// An infrastructure failure while readiness still passes: nothing was written, and it is not
// trader validation (design overview, "Expected domain failures").
export interface StorageFailure {
  readonly kind: 'StorageFailure';
  readonly reason: string;
}

export interface MutationGuard {
  run<T>(operation: string, mutation: () => Promise<T>): Promise<T | RuntimeNotWritable | StorageFailure>;
}

// Requesting host durability mutates no authoritative Workspace data, so it is never gated
// (design overview, "Expected domain failures").
const UNGATED = new Set(['Workspace.requestDurability']);

export function createMutationGuard(session: ReadinessSession): MutationGuard {
  return {
    async run(operation, mutation) {
      if (UNGATED.has(operation)) return mutation();
      const refusal = toRuntimeNotWritable(await session.recheck());
      if (refusal) return refusal;
      try {
        return await mutation();
      } catch (error) {
        // A storage failure during the commit re-evaluates readiness, which replaces the
        // session state: a session that is no longer Writable stays downgraded.
        const after = toRuntimeNotWritable(await session.recheck());
        if (after) return after;
        return { kind: 'StorageFailure', reason: error instanceof Error ? error.name : 'Unknown' };
      }
    },
  };
}
