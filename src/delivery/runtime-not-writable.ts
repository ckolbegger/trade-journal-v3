// The cross-cutting result every authoritative mutation returns outside Writable readiness
// (design overview, "Expected domain failures").

export type ReadinessCheckName = 'diagnostic' | 'capacity' | 'control' | 'inventory';

export interface ReadinessFailure {
  readonly check: ReadinessCheckName;
  readonly reason: string;
}

export interface SafeAction {
  readonly action: 'Retry' | 'Reload' | 'TryAnotherBrowser' | 'ReadOnly';
  readonly explanation: string;
}

export interface RuntimeNotWritable {
  readonly kind: 'RuntimeNotWritable';
  readonly runtimeReadiness: 'RecoveryOnly' | 'Unsupported';
  readonly failedChecks: readonly ReadinessFailure[];
  readonly workspaceStatus: 'RecoveryOnly' | 'IntegrityBlocked' | 'None';
  readonly safeActions: readonly SafeAction[];
}
