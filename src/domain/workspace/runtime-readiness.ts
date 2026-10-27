import {
  verifyOfflineReleaseInventory,
  type OfflineReleaseInventory,
} from '../../pwa/release-inventory';
import type {
  DiagnosticProbeResult,
  RuntimeReadinessMode,
  StorageRootInspectionResult,
} from '../../persistence/transaction-manager';

export const MIN_REQUIRED_STORAGE_BYTES = 150 * 1024 * 1024; // 157,286,400 bytes

export type RuntimeStorageProtection = 'PersistentGranted' | 'BestEffort' | 'Unavailable';

export type RuntimeFailureCode =
  | 'IndexedDbUnavailable'
  | 'DiagnosticTransactionFailed'
  | 'InsufficientFreeStorage'
  | 'ServiceWorkerUnsupported'
  | 'ServiceWorkerRegistrationFailed'
  | 'OfflineReleaseMissingOrCorrupt'
  | 'WorkspaceStorageUnreadable'
  | 'WorkspaceMetadataCorrupt'
  | 'UnsupportedNewerSchemaVersion';

export interface RuntimeCheckDetail {
  readonly checkId:
    | 'indexeddb_diagnostic_probe'
    | 'free_storage_headroom'
    | 'service_worker_registration'
    | 'offline_release_inventory';
  readonly passed: boolean;
  readonly failureCode?: RuntimeFailureCode;
  readonly message: string;
}

export interface RuntimeEnvironmentAdapters {
  readonly isIndexedDbSupported: () => boolean;
  readonly runDiagnosticProbe: () => Promise<DiagnosticProbeResult>;
  readonly inspectStorageRoot: () => Promise<StorageRootInspectionResult>;
  readonly estimateFreeStorageBytes: () => Promise<number | null>;
  readonly getStorageProtection: () => Promise<RuntimeStorageProtection>;
  readonly isServiceWorkerSupported: () => boolean;
  readonly verifyServiceWorkerActive: () => Promise<{
    readonly ok: boolean;
    readonly releaseVersion?: string;
    readonly errorMessage?: string;
  }>;
  readonly loadOfflineReleaseInventory: () => Promise<OfflineReleaseInventory | null>;
  readonly fetchCachedAssetBytes: (path: string) => Promise<Uint8Array | null>;
  readonly expectedReleaseVersion: string;
}

export interface RuntimeReadinessReport {
  readonly readiness: RuntimeReadinessMode;
  readonly storageProtection: RuntimeStorageProtection;
  readonly workspaceIntegrity:
    | 'FreshEmpty'
    | 'Readable'
    | 'IntegrityBlocked';
  readonly freeStorageBytes: number | null;
  readonly requiredStorageBytes: number;
  readonly checks: readonly RuntimeCheckDetail[];
  readonly failureCodes: readonly RuntimeFailureCode[];
  readonly summaryMessage: string;
  readonly inspection: StorageRootInspectionResult;
}

export async function evaluateRuntimeReadiness(
  env: RuntimeEnvironmentAdapters,
): Promise<RuntimeReadinessReport> {
  const checks: RuntimeCheckDetail[] = [];
  const failureCodes: RuntimeFailureCode[] = [];

  // Check 1: IndexedDB support + diagnostic readwrite probe
  if (!env.isIndexedDbSupported()) {
    checks.push({
      checkId: 'indexeddb_diagnostic_probe',
      passed: false,
      failureCode: 'IndexedDbUnavailable',
      message: 'IndexedDB is unavailable in this browser environment.',
    });
    failureCodes.push('IndexedDbUnavailable');
  } else {
    const probeRes = await env.runDiagnosticProbe();
    if (probeRes.ok) {
      checks.push({
        checkId: 'indexeddb_diagnostic_probe',
        passed: true,
        message: 'IndexedDB open and isolated diagnostic readwrite transaction succeeded.',
      });
    } else {
      checks.push({
        checkId: 'indexeddb_diagnostic_probe',
        passed: false,
        failureCode: 'DiagnosticTransactionFailed',
        message: probeRes.message,
      });
      failureCodes.push('DiagnosticTransactionFailed');
    }
  }

  // Check 2: Free storage headroom >= 150 MiB (157,286,400 bytes)
  const freeStorageBytes = await env.estimateFreeStorageBytes();
  if (freeStorageBytes !== null && freeStorageBytes >= MIN_REQUIRED_STORAGE_BYTES) {
    checks.push({
      checkId: 'free_storage_headroom',
      passed: true,
      message: `Available free storage (${Math.floor(freeStorageBytes / (1024 * 1024))} MiB) meets the 150 MiB minimum requirement.`,
    });
  } else {
    const reported =
      freeStorageBytes === null
        ? 'unavailable'
        : `${freeStorageBytes} bytes (${(freeStorageBytes / (1024 * 1024)).toFixed(1)} MiB)`;
    checks.push({
      checkId: 'free_storage_headroom',
      passed: false,
      failureCode: 'InsufficientFreeStorage',
      message: `Insufficient free local storage (${reported}; at least 150 MiB / ${MIN_REQUIRED_STORAGE_BYTES} bytes required).`,
    });
    failureCodes.push('InsufficientFreeStorage');
  }

  // Check 3: Service Worker support & active registration
  if (!env.isServiceWorkerSupported()) {
    checks.push({
      checkId: 'service_worker_registration',
      passed: false,
      failureCode: 'ServiceWorkerUnsupported',
      message: 'Service Worker API is unsupported in this browser or context.',
    });
    failureCodes.push('ServiceWorkerUnsupported');
  } else {
    const swStatus = await env.verifyServiceWorkerActive();
    if (swStatus.ok) {
      checks.push({
        checkId: 'service_worker_registration',
        passed: true,
        message: 'Service Worker is active and controlling offline release assets.',
      });
    } else {
      checks.push({
        checkId: 'service_worker_registration',
        passed: false,
        failureCode: 'ServiceWorkerRegistrationFailed',
        message:
          swStatus.errorMessage ??
          'Service Worker failed to register or activate for this release.',
      });
      failureCodes.push('ServiceWorkerRegistrationFailed');
    }
  }

  // Check 4: OfflineReleaseInventory verification (SHA-256 + byte length)
  const inventory = await env.loadOfflineReleaseInventory();
  if (!inventory) {
    checks.push({
      checkId: 'offline_release_inventory',
      passed: false,
      failureCode: 'OfflineReleaseMissingOrCorrupt',
      message: 'OfflineReleaseInventory could not be loaded for this release.',
    });
    failureCodes.push('OfflineReleaseMissingOrCorrupt');
  } else {
    const verifyRes = await verifyOfflineReleaseInventory(
      inventory,
      env.fetchCachedAssetBytes,
    );
    if (verifyRes.valid && inventory.releaseId === env.expectedReleaseVersion) {
      checks.push({
        checkId: 'offline_release_inventory',
        passed: true,
        message: `Verified all ${verifyRes.verifiedAssetCount} required offline release assets against SHA-256 digests.`,
      });
    } else {
      const msg = !verifyRes.valid
        ? verifyRes.message
        : `Release version mismatch: expected ${env.expectedReleaseVersion}, found ${inventory.releaseId}.`;
      checks.push({
        checkId: 'offline_release_inventory',
        passed: false,
        failureCode: 'OfflineReleaseMissingOrCorrupt',
        message: msg,
      });
      failureCodes.push('OfflineReleaseMissingOrCorrupt');
    }
  }

  // Inspect existing storage root
  const inspection: StorageRootInspectionResult = env.isIndexedDbSupported()
    ? await env.inspectStorageRoot()
    : { kind: 'FreshEmptyRoot' };

  const storageProtection = await env.getStorageProtection();

  if (inspection.kind === 'IntegrityBlockedRoot') {
    const integrityCode: RuntimeFailureCode =
      inspection.reason === 'UnsupportedNewerSchemaVersion'
        ? 'UnsupportedNewerSchemaVersion'
        : inspection.reason === 'CorruptOrPartialMetadata'
          ? 'WorkspaceMetadataCorrupt'
          : 'WorkspaceStorageUnreadable';
    failureCodes.push(integrityCode);
    return {
      readiness: 'Unsupported',
      storageProtection,
      workspaceIntegrity: 'IntegrityBlocked',
      freeStorageBytes,
      requiredStorageBytes: MIN_REQUIRED_STORAGE_BYTES,
      checks,
      failureCodes,
      summaryMessage: inspection.message,
      inspection,
    };
  }

  const allChecksPassed = checks.every((c) => c.passed);

  if (allChecksPassed) {
    return {
      readiness: 'Writable',
      storageProtection,
      workspaceIntegrity:
        inspection.kind === 'ExistingReadableWorkspace' ? 'Readable' : 'FreshEmpty',
      freeStorageBytes,
      requiredStorageBytes: MIN_REQUIRED_STORAGE_BYTES,
      checks,
      failureCodes: [],
      summaryMessage:
        storageProtection === 'PersistentGranted'
          ? 'Runtime is Writable with persistent storage protection granted.'
          : 'Runtime is Writable. Local storage is currently under best-effort browser eviction policy.',
      inspection,
    };
  }

  if (inspection.kind === 'ExistingReadableWorkspace') {
    return {
      readiness: 'RecoveryOnly',
      storageProtection,
      workspaceIntegrity: 'Readable',
      freeStorageBytes,
      requiredStorageBytes: MIN_REQUIRED_STORAGE_BYTES,
      checks,
      failureCodes,
      summaryMessage:
        'Existing workspace is readable in Recovery Only mode. Write actions are disabled until runtime readiness checks pass.',
      inspection,
    };
  }

  return {
    readiness: 'Unsupported',
    storageProtection,
    workspaceIntegrity: 'FreshEmpty',
    freeStorageBytes,
    requiredStorageBytes: MIN_REQUIRED_STORAGE_BYTES,
    checks,
    failureCodes,
    summaryMessage:
      'Runtime prerequisites are not satisfied. First-run workspace initialization is blocked until all required checks pass.',
    inspection,
  };
}
