import type { WriteGate } from '../persistence/index.ts';
import type { ReadinessEvaluation, ReadinessSession } from './readiness.ts';
import type { RuntimeNotWritable, SafeAction } from './runtime-not-writable.ts';

const RETRY: SafeAction = { action: 'Retry', explanation: 'Check again once the problem is fixed.' };

function safeActions(evaluation: Exclude<ReadinessEvaluation, { outcome: 'Writable' }>): SafeAction[] {
  if (evaluation.outcome === 'RecoveryOnly') {
    return [{ action: 'ReadOnly', explanation: 'Your journal stays readable, but nothing can be saved in this browser right now.' }, RETRY];
  }
  if (evaluation.workspaceStatus === 'IntegrityBlocked') return [RETRY];
  return [RETRY, { action: 'TryAnotherBrowser', explanation: 'Another browser may pass these checks; it starts with its own empty storage.' }];
}

// The RuntimeNotWritable result for a session that is not Writable, or null when it is.
export function toRuntimeNotWritable(evaluation: ReadinessEvaluation): RuntimeNotWritable | null {
  if (evaluation.outcome === 'Writable') return null;
  return {
    kind: 'RuntimeNotWritable',
    runtimeReadiness: evaluation.outcome,
    failedChecks: evaluation.failures,
    workspaceStatus: evaluation.workspaceStatus,
    safeActions: safeActions(evaluation),
  };
}

export function readinessWriteGate(session: ReadinessSession): WriteGate {
  return {
    current: () => toRuntimeNotWritable(session.current()),
    recheck: async () => toRuntimeNotWritable(await session.recheck()),
  };
}
