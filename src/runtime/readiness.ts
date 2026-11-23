import type { RootInspectionResult, RuntimeWriteGate, WriteGateDecision } from '../persistence/idb';
import type { Clock } from '../shared/clock';
import type { ReadinessCheckId, StorageProtectionStatus } from '../shared/result';
import type { InventoryVerificationResult } from './inventory';

/**
 * Plan-derived capacity/headroom minimum:
 * ~50 MiB mature Workspace (25,000 Trades / 200,000 facts)
 * + ~50 MiB isolated generation migration headroom
 * + ~50 MiB portable backup serialization headroom
 */
export const MINIMUM_REQUIRED_HEADROOM_BYTES = 150 * 1024 * 1024;

export interface ReadinessCheckEvidence {
  readonly id: ReadinessCheckId;
  readonly label: string;
  readonly passed: boolean;
  readonly detail: string;
}

export type RuntimeReadinessState = 'Writable' | 'RecoveryOnly' | 'Unsupported';

export interface RuntimeReadinessSnapshot {
  readonly state: RuntimeReadinessState;
  readonly integrityBlocked: boolean;
  readonly evaluatedAt: string;
  readonly releaseId: string | null;
  readonly checks: readonly ReadinessCheckEvidence[];
  readonly failedChecks: readonly ReadinessCheckId[];
  readonly storageProtection: StorageProtectionStatus;
  readonly showProtectionWarning: boolean;
  readonly rootInspection: RootInspectionResult;
}

export interface ReadinessProbes {
  runStorageDiagnostic(): Promise<{ ok: true } | { ok: false; error: string }>;
  inspectRoot(): Promise<RootInspectionResult>;
  estimateCapacity(): Promise<
    | { readonly supported: true; readonly quotaBytes: number; readonly usageBytes: number }
    | { readonly supported: false; readonly reason: string }
  >;
  checkServiceWorkerControl(): Promise<
    | { readonly controlled: true; readonly releaseId: string }
    | { readonly controlled: false; readonly reason: string }
  >;
  verifyOfflineInventory(): Promise<InventoryVerificationResult>;
  checkStorageProtection(): Promise<StorageProtectionStatus>;
}

export interface RuntimeReadinessController extends RuntimeWriteGate {
  evaluate(): Promise<RuntimeReadinessSnapshot>;
  getCurrent(): RuntimeReadinessSnapshot | null;
  updateStorageProtection(protection: StorageProtectionStatus): RuntimeReadinessSnapshot | null;
  invalidateWritable(
    failedCheck: ReadinessCheckId,
    detail: string,
    hasReadableWorkspace: boolean,
  ): RuntimeReadinessSnapshot;
}

function formatMiB(bytes: number): string {
  return `${Math.floor(bytes / (1024 * 1024))} MiB`;
}

function errMsg(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function safeProbe<T>(fn: () => Promise<T>, onError: (err: unknown) => T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    return onError(err);
  }
}

export function createRuntimeReadinessController(options: {
  readonly clock: Clock;
  readonly probes: ReadinessProbes;
}): RuntimeReadinessController {
  const { clock, probes } = options;
  let current: RuntimeReadinessSnapshot | null = null;
  let evalSeq = 0;

  return {
    async evaluate(): Promise<RuntimeReadinessSnapshot> {
      const seq = ++evalSeq;

      const [diag, rootInspection, capacity, swControl, inventory, storageProtection] =
        await Promise.all([
          safeProbe(
            () => probes.runStorageDiagnostic(),
            (err) => ({ ok: false as const, error: errMsg(err, 'Storage diagnostic failed.') }),
          ),
          safeProbe<RootInspectionResult>(
            () => probes.inspectRoot(),
            (err) => ({
              status: 'IntegrityBlocked',
              reason: errMsg(err, 'Unable to inspect workspace root.'),
            }),
          ),
          safeProbe(
            () => probes.estimateCapacity(),
            (err) => ({
              supported: false as const,
              reason: errMsg(err, 'Capacity estimation failed.'),
            }),
          ),
          safeProbe(
            () => probes.checkServiceWorkerControl(),
            (err) => ({
              controlled: false as const,
              reason: errMsg(err, 'Service worker control check failed.'),
            }),
          ),
          safeProbe<InventoryVerificationResult>(
            () => probes.verifyOfflineInventory(),
            (err) => ({
              valid: false,
              reason: errMsg(err, 'Offline release inventory verification failed.'),
            }),
          ),
          safeProbe<StorageProtectionStatus>(
            () => probes.checkStorageProtection(),
            (err) => ({
              state: 'Unavailable',
              reason: errMsg(err, 'Unable to query storage persistence.'),
            }),
          ),
        ]);

      const checks: ReadinessCheckEvidence[] = [];

      // 1. Storage diagnostic
      const rootCorrupt = rootInspection.status === 'IntegrityBlocked';
      if (!diag.ok) {
        checks.push({
          id: 'storage_diagnostic',
          label: 'Authoritative storage diagnostic',
          passed: false,
          detail: diag.error,
        });
      } else if (rootCorrupt) {
        checks.push({
          id: 'storage_diagnostic',
          label: 'Authoritative storage diagnostic',
          passed: false,
          detail: rootInspection.reason,
        });
      } else {
        checks.push({
          id: 'storage_diagnostic',
          label: 'Authoritative storage diagnostic',
          passed: true,
          detail: 'Isolated diagnostic transaction committed cleanly.',
        });
      }

      // 2. Capacity / headroom
      if (!capacity.supported) {
        checks.push({
          id: 'capacity_headroom',
          label: 'Storage capacity and headroom',
          passed: false,
          detail: capacity.reason,
        });
      } else {
        const availableBytes = Math.max(0, capacity.quotaBytes - capacity.usageBytes);
        const hasHeadroom = availableBytes >= MINIMUM_REQUIRED_HEADROOM_BYTES;
        checks.push({
          id: 'capacity_headroom',
          label: 'Storage capacity and headroom',
          passed: hasHeadroom,
          detail: hasHeadroom
            ? `${formatMiB(availableBytes)} available (requires at least ${formatMiB(MINIMUM_REQUIRED_HEADROOM_BYTES)}).`
            : `Only ${formatMiB(availableBytes)} available; at least ${formatMiB(MINIMUM_REQUIRED_HEADROOM_BYTES)} is required for mature scale, migrations, and backups.`,
        });
      }

      // 3. Service worker control
      if (swControl.controlled) {
        checks.push({
          id: 'service_worker_control',
          label: 'Versioned service worker control',
          passed: true,
          detail: `Controlled by release ${swControl.releaseId}.`,
        });
      } else {
        checks.push({
          id: 'service_worker_control',
          label: 'Versioned service worker control',
          passed: false,
          detail: swControl.reason,
        });
      }

      // 4. Offline Release Inventory (and release identity agreement with controlling SW)
      if (!inventory.valid) {
        checks.push({
          id: 'offline_inventory',
          label: 'Offline release inventory digests',
          passed: false,
          detail: inventory.reason,
        });
      } else if (swControl.controlled && swControl.releaseId !== inventory.releaseId) {
        checks.push({
          id: 'offline_inventory',
          label: 'Offline release inventory digests',
          passed: false,
          detail: `Controlling service worker release (${swControl.releaseId}) does not match verified inventory release (${inventory.releaseId}).`,
        });
      } else {
        checks.push({
          id: 'offline_inventory',
          label: 'Offline release inventory digests',
          passed: true,
          detail: `Verified ${inventory.assetCount} cached assets for ${inventory.releaseId}.`,
        });
      }

      const failedChecks = checks.filter((c) => !c.passed).map((c) => c.id);
      let state: RuntimeReadinessState;
      if (rootCorrupt) {
        state = 'Unsupported';
      } else if (failedChecks.length === 0) {
        state = 'Writable';
      } else if (rootInspection.status === 'Present') {
        state = 'RecoveryOnly';
      } else {
        state = 'Unsupported';
      }

      let releaseId: string | null = null;
      if (inventory.valid) {
        releaseId = inventory.releaseId;
      } else if (swControl.controlled) {
        releaseId = swControl.releaseId;
      }

      const snapshot: RuntimeReadinessSnapshot = {
        state,
        integrityBlocked: rootCorrupt,
        evaluatedAt: clock.nowIso(),
        releaseId,
        checks,
        failedChecks,
        storageProtection,
        showProtectionWarning: storageProtection.state !== 'Protected',
        rootInspection,
      };

      if (seq === evalSeq) {
        current = snapshot;
      }
      return current ?? snapshot;
    },

    getCurrent() {
      return current;
    },

    updateStorageProtection(protection: StorageProtectionStatus) {
      evalSeq += 1;
      if (!current) {
        return null;
      }
      current = {
        ...current,
        storageProtection: protection,
        showProtectionWarning: protection.state !== 'Protected',
      };
      return current;
    },

    invalidateWritable(
      failedCheck: ReadinessCheckId,
      detail: string,
      hasReadableWorkspace: boolean,
    ): RuntimeReadinessSnapshot {
      evalSeq += 1;
      const priorChecks = current?.checks ?? [];
      const hasCheck = priorChecks.some((c) => c.id === failedCheck);
      const updatedChecks: ReadinessCheckEvidence[] = hasCheck
        ? priorChecks.map((check) =>
            check.id === failedCheck ? { ...check, passed: false, detail } : check,
          )
        : [
            ...priorChecks,
            {
              id: failedCheck,
              label: failedCheck,
              passed: false,
              detail,
            },
          ];

      const failedChecks = updatedChecks.filter((c) => !c.passed).map((c) => c.id);
      const preserveIntegrityBlocked = current?.integrityBlocked === true;
      const nextState: RuntimeReadinessState = preserveIntegrityBlocked
        ? 'Unsupported'
        : hasReadableWorkspace
          ? 'RecoveryOnly'
          : 'Unsupported';

      current = {
        state: nextState,
        integrityBlocked: preserveIntegrityBlocked,
        evaluatedAt: clock.nowIso(),
        releaseId: current?.releaseId ?? null,
        checks: updatedChecks,
        failedChecks,
        storageProtection: current?.storageProtection ?? {
          state: 'Unavailable',
          reason: 'Not evaluated before runtime invalidation.',
        },
        showProtectionWarning: (current?.storageProtection.state ?? 'Unavailable') !== 'Protected',
        rootInspection: current?.rootInspection ?? {
          status: 'IntegrityBlocked',
          reason: detail,
        },
      };
      return current;
    },

    checkWritable(): WriteGateDecision {
      if (!current) {
        return {
          writable: false,
          reason: 'Unsupported',
          failedChecks: ['storage_diagnostic'],
        };
      }
      if (current.integrityBlocked) {
        return {
          writable: false,
          reason: 'IntegrityBlocked',
          failedChecks:
            current.failedChecks.length > 0 ? current.failedChecks : ['storage_diagnostic'],
        };
      }
      if (current.state === 'Writable') {
        return { writable: true };
      }
      return {
        writable: false,
        reason: current.state,
        failedChecks: current.failedChecks,
      };
    },
  };
}
