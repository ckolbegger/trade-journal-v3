import { describe, expect, it } from 'vitest';
import type { OfflineReleaseInventory } from '../../../pwa/release-inventory';
import { requestWorkspaceDurability } from '../request-durability';
import {
  MIN_REQUIRED_STORAGE_BYTES,
  evaluateRuntimeReadiness,
  type RuntimeEnvironmentAdapters,
} from '../runtime-readiness';

const encoder = new TextEncoder();

// NIST FIPS 180-4 SHA-256 vector for "abc"
const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

function createValidAdapters(
  overrides: Partial<RuntimeEnvironmentAdapters> = {},
): RuntimeEnvironmentAdapters {
  const assetBytes = encoder.encode('abc');
  const inventory: OfflineReleaseInventory = {
    releaseId: '1.0.0-d01',
    generatedAt: '2026-10-27T12:00:00.000Z',
    cacheName: 'tj-v3-release-1.0.0-d01',
    assets: [
      {
        path: '/index.html',
        sha256: SHA256_ABC,
        sizeBytes: assetBytes.byteLength,
      },
    ],
  };

  return {
    isIndexedDbSupported: () => true,
    runDiagnosticProbe: async () => ({
      ok: true,
      probedAt: '2026-10-27T12:00:00.000Z',
    }),
    inspectStorageRoot: async () => ({
      kind: 'FreshEmptyRoot',
    }),
    estimateFreeStorageBytes: async () => MIN_REQUIRED_STORAGE_BYTES + 1024,
    getStorageProtection: async () => 'PersistentGranted',
    isServiceWorkerSupported: () => true,
    verifyServiceWorkerActive: async () => ({
      ok: true,
      releaseVersion: '1.0.0-d01',
    }),
    loadOfflineReleaseInventory: async () => inventory,
    fetchCachedAssetBytes: async () => assetBytes,
    expectedReleaseVersion: '1.0.0-d01',
    ...overrides,
  };
}

describe('Task 1.4: RuntimeReadiness Evaluator & Workspace.requestDurability (AC-DEL-004, AC-DEL-005, AC-DEL-006)', () => {
  describe('evaluateRuntimeReadiness() decision rules', () => {
    it('should evaluate to Writable with PersistentGranted when all 4 runtime checks pass and navigator.storage.persisted() is true (happy path)', async () => {
      const report = await evaluateRuntimeReadiness(createValidAdapters());
      expect(report.readiness).toBe('Writable');
      expect(report.storageProtection).toBe('PersistentGranted');
      expect(report.failureCodes).toEqual([]);
      expect(report.checks.every((c) => c.passed)).toBe(true);
    });

    it('should evaluate to Writable with BestEffort advisory protection when all 4 required checks pass even if navigator.storage.persisted() is false (browser-neutral happy path — AC-DEL-004)', async () => {
      const report = await evaluateRuntimeReadiness(
        createValidAdapters({
          getStorageProtection: async () => 'BestEffort',
        }),
      );
      expect(report.readiness).toBe('Writable');
      expect(report.storageProtection).toBe('BestEffort');
      expect(report.failureCodes).toEqual([]);
    });

    it('should evaluate to Writable when free storage is exactly 157286400 bytes (150 MiB boundary condition)', async () => {
      const report = await evaluateRuntimeReadiness(
        createValidAdapters({
          estimateFreeStorageBytes: async () => 157_286_400,
        }),
      );
      expect(report.readiness).toBe('Writable');
      expect(report.freeStorageBytes).toBe(157_286_400);
      expect(report.failureCodes).toEqual([]);
    });

    it('should fail the storage headroom check when free storage is 157286399 bytes (150 MiB minus 1 byte boundary condition)', async () => {
      const report = await evaluateRuntimeReadiness(
        createValidAdapters({
          estimateFreeStorageBytes: async () => 157_286_399,
        }),
      );
      expect(report.readiness).toBe('Unsupported');
      expect(report.failureCodes).toContain('InsufficientFreeStorage');
    });

    it('should return Unsupported when no Workspace exists and the versioned service worker does not control the page (error case)', async () => {
      const report = await evaluateRuntimeReadiness(
        createValidAdapters({
          verifyServiceWorkerActive: async () => ({
            ok: false,
            errorMessage: 'No active service worker controller',
          }),
        }),
      );
      expect(report.readiness).toBe('Unsupported');
      expect(report.failureCodes).toEqual(['ServiceWorkerRegistrationFailed']);
    });

    it('should evaluate to Unsupported and list every failed check simultaneously without short-circuiting on first-run when multiple checks fail (multi-failure error case — AC-DEL-004)', async () => {
      const report = await evaluateRuntimeReadiness(
        createValidAdapters({
          runDiagnosticProbe: async () => ({
            ok: false,
            code: 'DiagnosticTransactionFailed',
            message: 'Probe failed',
          }),
          estimateFreeStorageBytes: async () => 50 * 1024 * 1024,
          verifyServiceWorkerActive: async () => ({
            ok: false,
            errorMessage: 'SW inactive',
          }),
          loadOfflineReleaseInventory: async () => null,
        }),
      );

      expect(report.readiness).toBe('Unsupported');
      expect(report.checks).toHaveLength(4);
      expect(report.failureCodes).toEqual([
        'DiagnosticTransactionFailed',
        'InsufficientFreeStorage',
        'ServiceWorkerRegistrationFailed',
        'OfflineReleaseMissingOrCorrupt',
      ]);
    });

    it('should evaluate to RecoveryOnly when an existing workspace is readable in IndexedDB but free storage headroom (< 150 MiB) fails (existing workspace degraded case — AC-DEL-005)', async () => {
      const report = await evaluateRuntimeReadiness(
        createValidAdapters({
          inspectStorageRoot: async () => ({
            kind: 'ExistingReadableWorkspace',
            meta: {
              key: 'root',
              workspaceId: 'ws-1',
              schemaVersion: 1,
              snapshotBinding: 'snap-1',
              timeZone: 'America/New_York',
              settingsRevision: 1,
              catalogSnapshotId: 'cat-1',
              createdAt: '2026-10-27T12:00:00.000Z',
              updatedAt: '2026-10-27T12:00:00.000Z',
              latestReceipt: {
                receiptId: 'r-1',
                openedAt: '2026-10-27T12:00:00.000Z',
                isFreshInitialization: true,
                fromSchemaVersion: null,
                toSchemaVersion: 1,
                migrationsApplied: [],
                catalogSeedVersion: 0,
                journalSeedVersion: 0,
                privateStateRebuilt: false,
                incompleteTransactionRecovered: false,
              },
            },
            institutions: [],
            accounts: [],
            selectableAccountCount: 0,
          }),
          estimateFreeStorageBytes: async () => 20 * 1024 * 1024,
        }),
      );

      expect(report.readiness).toBe('RecoveryOnly');
      expect(report.workspaceIntegrity).toBe('Readable');
      expect(report.failureCodes).toContain('InsufficientFreeStorage');
    });

    it('should evaluate to RecoveryOnly when an existing workspace is readable in IndexedDB but Service Worker or OfflineReleaseInventory verification fails (existing workspace degraded case — AC-DEL-005)', async () => {
      const report = await evaluateRuntimeReadiness(
        createValidAdapters({
          inspectStorageRoot: async () => ({
            kind: 'ExistingReadableWorkspace',
            meta: {
              key: 'root',
              workspaceId: 'ws-1',
              schemaVersion: 1,
              snapshotBinding: 'snap-1',
              timeZone: 'America/New_York',
              settingsRevision: 1,
              catalogSnapshotId: 'cat-1',
              createdAt: '2026-10-27T12:00:00.000Z',
              updatedAt: '2026-10-27T12:00:00.000Z',
              latestReceipt: {
                receiptId: 'r-1',
                openedAt: '2026-10-27T12:00:00.000Z',
                isFreshInitialization: true,
                fromSchemaVersion: null,
                toSchemaVersion: 1,
                migrationsApplied: [],
                catalogSeedVersion: 0,
                journalSeedVersion: 0,
                privateStateRebuilt: false,
                incompleteTransactionRecovered: false,
              },
            },
            institutions: [],
            accounts: [],
            selectableAccountCount: 0,
          }),
          loadOfflineReleaseInventory: async () => null,
        }),
      );

      expect(report.readiness).toBe('RecoveryOnly');
      expect(report.failureCodes).toContain('OfflineReleaseMissingOrCorrupt');
    });

    it('should evaluate to RecoveryOnly when an existing workspace is readable in IndexedDB even if the diagnostic write probe fails (existing workspace read-only quota full edge case)', async () => {
      const report = await evaluateRuntimeReadiness(
        createValidAdapters({
          inspectStorageRoot: async () => ({
            kind: 'ExistingReadableWorkspace',
            meta: {
              key: 'root',
              workspaceId: 'ws-1',
              schemaVersion: 1,
              snapshotBinding: 'snap-1',
              timeZone: 'America/New_York',
              settingsRevision: 1,
              catalogSnapshotId: 'cat-1',
              createdAt: '2026-10-27T12:00:00.000Z',
              updatedAt: '2026-10-27T12:00:00.000Z',
              latestReceipt: {
                receiptId: 'r-1',
                openedAt: '2026-10-27T12:00:00.000Z',
                isFreshInitialization: true,
                fromSchemaVersion: null,
                toSchemaVersion: 1,
                migrationsApplied: [],
                catalogSeedVersion: 0,
                journalSeedVersion: 0,
                privateStateRebuilt: false,
                incompleteTransactionRecovered: false,
              },
            },
            institutions: [],
            accounts: [],
            selectableAccountCount: 0,
          }),
          runDiagnosticProbe: async () => ({
            ok: false,
            code: 'DiagnosticTransactionFailed',
            message: 'QuotaExceededError',
          }),
        }),
      );

      expect(report.readiness).toBe('RecoveryOnly');
      expect(report.failureCodes).toContain('DiagnosticTransactionFailed');
    });

    it('should evaluate to Unsupported and IntegrityBlocked when existing workspace storage root is unreadable, corrupt, or from a newer schema version (integrity block error case — AC-DEL-005)', async () => {
      const report = await evaluateRuntimeReadiness(
        createValidAdapters({
          inspectStorageRoot: async () => ({
            kind: 'IntegrityBlockedRoot',
            reason: 'CorruptOrPartialMetadata',
            message: 'Workspace metadata is corrupt.',
          }),
        }),
      );

      expect(report.readiness).toBe('Unsupported');
      expect(report.workspaceIntegrity).toBe('IntegrityBlocked');
      expect(report.failureCodes).toContain('WorkspaceMetadataCorrupt');
    });
  });

  describe('Workspace.requestDurability()', () => {
    it('should return NotImproved with PersistentGranted when host storage is already persistent before requesting (already protected edge case)', async () => {
      const res = await requestWorkspaceDurability({
        getCurrentProtection: async () => 'PersistentGranted',
        requestPersistentStorage: async () => true,
      });

      expect(res.currentProtection).toBe('PersistentGranted');
      expect(res.previousProtection).toBe('PersistentGranted');
    });

    it('should call navigator.storage.persist() and return Improved with PersistentGranted when the browser grants persistence (happy path)', async () => {
      const res = await requestWorkspaceDurability({
        getCurrentProtection: async () => 'BestEffort',
        requestPersistentStorage: async () => true,
      });

      expect(res).toEqual({
        outcome: 'Improved',
        previousProtection: 'BestEffort',
        currentProtection: 'PersistentGranted',
        message: 'Browser granted persistent storage protection for this workspace.',
      });
    });

    it('should return NotImproved with BestEffort and keep the workspace Writable when navigator.storage.persist() resolves to false (browser-refusal edge case — AC-DEL-004)', async () => {
      const res = await requestWorkspaceDurability({
        getCurrentProtection: async () => 'BestEffort',
        requestPersistentStorage: async () => false,
      });

      expect(res.outcome).toBe('NotImproved');
      expect(res.currentProtection).toBe('BestEffort');
      expect(res.message).toContain('best-effort');
    });

    it('should return NotImproved with Unavailable and not throw when navigator.storage or navigator.storage.persist is absent or rejects (error case)', async () => {
      const res = await requestWorkspaceDurability({
        getCurrentProtection: async () => 'Unavailable',
        requestPersistentStorage: async () => {
          throw new Error('SecurityError: persist not allowed');
        },
      });

      expect(res.outcome).toBe('NotImproved');
      expect(res.currentProtection).toBe('Unavailable');
    });
  });
});
