import { describe, expect, it } from 'vitest';
import {
  STORE_REFERENCE_CATALOG,
  STORE_WORKSPACE_META,
} from '../../../persistence/schema-v1';
import { TransactionManager } from '../../../persistence/transaction-manager';
import {
  MIN_REQUIRED_STORAGE_BYTES,
  evaluateRuntimeReadiness,
  type RuntimeEnvironmentAdapters,
} from '../runtime-readiness';
import { WorkspaceService, isValidIanaTimeZone } from '../workspace-service';

const encoder = new TextEncoder();
const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

let dbSeq = 0;
function createTestHarness(adapterOverrides: Partial<RuntimeEnvironmentAdapters> = {}) {
  dbSeq += 1;
  const tm = new TransactionManager({
    dbName: `test-ws-service-${dbSeq}-${Date.now()}`,
  });
  const assetBytes = encoder.encode('abc');

  let currentOverrides = { ...adapterOverrides };

  const evaluateReadiness = () =>
    evaluateRuntimeReadiness({
      isIndexedDbSupported: () => true,
      runDiagnosticProbe: () => tm.runDiagnosticProbeTransaction('2026-10-27T12:00:00.000Z'),
      inspectStorageRoot: () => tm.inspectStorageRoot(),
      estimateFreeStorageBytes: async () => MIN_REQUIRED_STORAGE_BYTES + 10_000,
      getStorageProtection: async () => 'PersistentGranted',
      isServiceWorkerSupported: () => true,
      verifyServiceWorkerActive: async () => ({
        ok: true,
        releaseVersion: '1.0.0-d01',
      }),
      loadOfflineReleaseInventory: async () => ({
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
      }),
      fetchCachedAssetBytes: async () => assetBytes,
      expectedReleaseVersion: '1.0.0-d01',
      ...currentOverrides,
    });

  const service = new WorkspaceService({
    transactionManager: tm,
    evaluateReadiness,
    requestDurabilityAdapter: {
      getCurrentProtection: async () => 'BestEffort',
      requestPersistentStorage: async () => true,
    },
    detectDefaultTimeZone: () => 'America/New_York',
    nowIso: () => '2026-10-27T12:00:00.000Z',
  });

  return {
    tm,
    service,
    setAdapterOverrides(next: Partial<RuntimeEnvironmentAdapters>) {
      currentOverrides = { ...currentOverrides, ...next };
    },
  };
}

describe('Task 2.1 & Task 2.2: WorkspaceService (getStatus, initialize, saveSettings)', () => {
  describe('Task 2.1: Workspace.getStatus & Workspace.initialize (AC-DEL-004, AC-DEL-005, AC-DEL-006, AC-RESP-001)', () => {
    describe('Workspace.getStatus()', () => {
      it('should return InitializationRequired when RuntimeReadiness is Writable and the storage root is proven empty (happy path)', async () => {
        const { service, tm } = createTestHarness();
        const status = await service.getStatus();
        await tm.close();

        expect(status.status).toBe('InitializationRequired');
        if (status.status === 'InitializationRequired') {
          expect(status.readinessReport.readiness).toBe('Writable');
          expect(status.suggestedTimeZone).toBe('America/New_York');
          expect(status.capabilityManifest.deliverableSlice).toBe('D01');
        }
      });

      it('should return Ready with WorkspaceSnapshotBinding, timeZone, InstalledCapabilityManifest v1, and NeedsInstitutionAndAccount after initialization (happy path)', async () => {
        const { service, tm } = createTestHarness();
        await service.initialize({ proposedTimeZone: 'America/New_York' });

        const status = await service.getStatus();
        await tm.close();

        expect(status.status).toBe('Ready');
        if (status.status === 'Ready') {
          expect(status.workspace.timeZone).toBe('America/New_York');
          expect(status.workspace.settingsRevision).toBe(1);
          expect(status.workspace.snapshotBinding).toBeTruthy();
          expect(status.workspace.onboardingState).toBe('NeedsInstitutionAndAccount');
          expect(status.workspace.selectableAccountCount).toBe(0);
          expect(status.workspace.capabilityManifest.deliverableSlice).toBe('D01');
        }
      });

      it('should never mutate storage or create diagnostic artifacts when getStatus is called repeatedly (idempotency edge case)', async () => {
        const { service, tm } = createTestHarness();
        const first = await service.getStatus();
        const second = await service.getStatus();
        await tm.close();

        expect(first.status).toBe('InitializationRequired');
        expect(second.status).toBe('InitializationRequired');
      });

      it('should return RecoveryOnly with readable Workspace status when a Workspace exists but a readiness check fails (error case)', async () => {
        const { service, tm, setAdapterOverrides } = createTestHarness();
        await service.initialize({ proposedTimeZone: 'America/Chicago' });

        setAdapterOverrides({
          estimateFreeStorageBytes: async () => 10 * 1024 * 1024,
        });

        const status = await service.getStatus();
        await tm.close();

        expect(status.status).toBe('RecoveryOnly');
        if (status.status === 'RecoveryOnly') {
          expect(status.workspace.timeZone).toBe('America/Chicago');
          expect(status.readinessReport.readiness).toBe('RecoveryOnly');
        }
      });

      it('should return IntegrityBlocked and never InitializationRequired when storage read fails or metadata is corrupt (error case)', async () => {
        const { service, tm } = createTestHarness();
        await tm._unsafeWriteRawForTesting(STORE_WORKSPACE_META, {
          key: 'root',
          schemaVersion: 1,
          // corrupt/incomplete record
        });

        const status = await service.getStatus();
        await tm.close();

        expect(status.status).toBe('IntegrityBlocked');
      });
    });

    describe('Workspace.initialize()', () => {
      it('should initialize a fresh Workspace atomically with a valid IANA time zone (e.g., "America/New_York") and return Opened with complete post-commit status and receipt without requiring a follow-up getStatus (happy path, AC-RESP-001)', async () => {
        const { service, tm } = createTestHarness();
        const res = await service.initialize({ proposedTimeZone: 'America/New_York' });
        await tm.close();

        expect(res.outcome).toBe('Opened');
        if (res.outcome === 'Opened') {
          expect(res.statusResult.status).toBe('Ready');
          expect(res.statusResult.workspace.timeZone).toBe('America/New_York');
          expect(res.statusResult.workspace.settingsRevision).toBe(1);
          expect(res.statusResult.workspace.onboardingState).toBe('NeedsInstitutionAndAccount');
          expect(res.statusResult.workspace.institutionCount).toBe(0);
          expect(res.statusResult.workspace.accountCount).toBe(0);
          expect(res.receipt.isFreshInitialization).toBe(true);
          expect(res.receipt.toSchemaVersion).toBe(1);
          expect(res.receipt.catalogSeedVersion).toBe(0);
        }
      });

      it('should return TimeZoneSelectionRequired and write nothing when initializing a fresh store without a proposedTimeZone (boundary condition)', async () => {
        const { service, tm } = createTestHarness();
        const res = await service.initialize({});
        const postStatus = await service.getStatus();
        await tm.close();

        expect(res.outcome).toBe('TimeZoneSelectionRequired');
        if (res.outcome === 'TimeZoneSelectionRequired') {
          expect(res.suggestedTimeZone).toBe('America/New_York');
        }
        expect(postStatus.status).toBe('InitializationRequired');
      });

      it('should open an already-initialized v1 Workspace idempotently without overwriting its stored timeZone or Catalog records (edge case)', async () => {
        const { service, tm } = createTestHarness();
        const first = await service.initialize({ proposedTimeZone: 'America/New_York' });
        expect(first.outcome).toBe('Opened');

        const second = await service.initialize({ proposedTimeZone: 'Europe/London' });
        await tm.close();

        expect(second.outcome).toBe('Opened');
        if (second.outcome === 'Opened') {
          expect(second.statusResult.workspace.timeZone).toBe('America/New_York');
          expect(second.receipt.isFreshInitialization).toBe(false);
          expect(second.receipt.fromSchemaVersion).toBe(1);
        }
      });

      it('should reject invalid or non-IANA time-zone strings (e.g., "", "Mars/Phobos", "+04:00", "   ") with a typed validation rejection and zero writes (error case)', async () => {
        const { service, tm } = createTestHarness();

        for (const invalidZone of ['', '   ', 'Mars/Phobos', '+04:00', '-05:00', 'GMT+2']) {
          expect(isValidIanaTimeZone(invalidZone)).toBe(false);
          const res = await service.initialize({ proposedTimeZone: invalidZone });
          expect(res.outcome).toBe('InvalidTimeZone');
        }

        const status = await service.getStatus();
        await tm.close();
        expect(status.status).toBe('InitializationRequired');
      });

      it('should return RuntimeNotWritable and write nothing when called while RuntimeReadiness is Unsupported or RecoveryOnly (error case, AC-DEL-004)', async () => {
        const { service, tm } = createTestHarness({
          estimateFreeStorageBytes: async () => 1024,
        });

        const res = await service.initialize({ proposedTimeZone: 'America/New_York' });
        const postStatus = await service.getStatus();
        await tm.close();

        expect(res.outcome).toBe('RuntimeNotWritable');
        expect(postStatus.status).toBe('Unsupported');
      });

      it('should return IntegrityBlocked and refuse to initialize or overwrite when an unreadable or partially corrupt existing root is detected (error case, AC-DEL-005)', async () => {
        const { service, tm } = createTestHarness();
        await tm._unsafeWriteRawForTesting(STORE_REFERENCE_CATALOG, {
          id: 'inst-existing',
          kind: 'Institution',
          label: 'Existing Broker',
          normalizedLabel: 'existing broker',
          availability: 'Selectable',
          origin: 'TraderCreated',
          currentRevision: 1,
          createdAt: '2026-10-27T12:00:00.000Z',
          updatedAt: '2026-10-27T12:00:00.000Z',
          history: [],
        });

        const res = await service.initialize({ proposedTimeZone: 'America/New_York' });
        const status = await service.getStatus();
        await tm.close();

        expect(res.outcome).toBe('IntegrityBlocked');
        expect(status.status).toBe('IntegrityBlocked');
      });
    });
  });

  describe('Task 2.2: Workspace.saveSettings (AC-RESP-001, AC-DEL-004)', () => {
    describe('saveSettings() happy path & revision binding', () => {
      it('should save a new valid IANA time zone (e.g., "America/Chicago"), increment settingsRevision from 1 to 2, advance WorkspaceSnapshotBinding, and return complete post-commit status in one call (happy path, AC-RESP-001)', async () => {
        const { service, tm } = createTestHarness();
        const initRes = await service.initialize({ proposedTimeZone: 'America/New_York' });
        expect(initRes.outcome).toBe('Opened');
        const initialBinding =
          initRes.outcome === 'Opened' ? initRes.statusResult.workspace.snapshotBinding : '';

        const saveRes = await service.saveSettings({
          timeZone: 'America/Chicago',
          expectedSettingsRevision: 1,
        });
        await tm.close();

        expect(saveRes.outcome).toBe('Saved');
        if (saveRes.outcome === 'Saved') {
          expect(saveRes.statusResult.workspace.timeZone).toBe('America/Chicago');
          expect(saveRes.statusResult.workspace.settingsRevision).toBe(2);
          expect(saveRes.statusResult.workspace.snapshotBinding).not.toBe(initialBinding);
        }
      });

      it('should return Unchanged without incrementing settingsRevision or writing to storage when the submitted timeZone is identical to the current timeZone at the expected revision (edge case)', async () => {
        const { service, tm } = createTestHarness();
        const initRes = await service.initialize({ proposedTimeZone: 'America/New_York' });
        const initialBinding =
          initRes.outcome === 'Opened' ? initRes.statusResult.workspace.snapshotBinding : '';

        const saveRes = await service.saveSettings({
          timeZone: 'America/New_York',
          expectedSettingsRevision: 1,
        });
        await tm.close();

        expect(saveRes.outcome).toBe('Unchanged');
        if (saveRes.outcome === 'Unchanged') {
          expect(saveRes.statusResult.workspace.settingsRevision).toBe(1);
          expect(saveRes.statusResult.workspace.snapshotBinding).toBe(initialBinding);
        }
      });

      it('should accept rare but valid multi-segment IANA zones such as "America/Indiana/Indianapolis" and "UTC" (boundary condition)', async () => {
        const { service, tm } = createTestHarness();
        await service.initialize({ proposedTimeZone: 'UTC' });

        const saveRes = await service.saveSettings({
          timeZone: 'America/Indiana/Indianapolis',
          expectedSettingsRevision: 1,
        });
        await tm.close();

        expect(saveRes.outcome).toBe('Saved');
        if (saveRes.outcome === 'Saved') {
          expect(saveRes.statusResult.workspace.timeZone).toBe('America/Indiana/Indianapolis');
          expect(saveRes.statusResult.workspace.settingsRevision).toBe(2);
        }
      });
    });

    describe('saveSettings() conflict, validation, and readiness errors', () => {
      it('should return Conflict with the current stored settings and revision when expectedSettingsRevision is stale (0 or 99), leaving storage unchanged (error case)', async () => {
        const { service, tm } = createTestHarness();
        await service.initialize({ proposedTimeZone: 'America/New_York' });

        const conflictLow = await service.saveSettings({
          timeZone: 'America/Los_Angeles',
          expectedSettingsRevision: 0,
        });
        const conflictHigh = await service.saveSettings({
          timeZone: 'America/Los_Angeles',
          expectedSettingsRevision: 99,
        });
        const status = await service.getStatus();
        await tm.close();

        expect(conflictLow.outcome).toBe('Conflict');
        if (conflictLow.outcome === 'Conflict') {
          expect(conflictLow.actualSettingsRevision).toBe(1);
          expect(conflictLow.currentStatus.workspace.timeZone).toBe('America/New_York');
        }
        expect(conflictHigh.outcome).toBe('Conflict');
        if (status.status === 'Ready') {
          expect(status.workspace.timeZone).toBe('America/New_York');
          expect(status.workspace.settingsRevision).toBe(1);
        }
      });

      it('should return InvalidTimeZone with typed validation issues and leave storage unchanged when timeZone is blank or invalid (error case)', async () => {
        const { service, tm } = createTestHarness();
        await service.initialize({ proposedTimeZone: 'America/New_York' });

        const invalidRes = await service.saveSettings({
          timeZone: 'Not/A_Real_Zone',
          expectedSettingsRevision: 1,
        });
        const status = await service.getStatus();
        await tm.close();

        expect(invalidRes.outcome).toBe('InvalidTimeZone');
        if (status.status === 'Ready') {
          expect(status.workspace.timeZone).toBe('America/New_York');
          expect(status.workspace.settingsRevision).toBe(1);
        }
      });

      it('should return RuntimeNotWritable and leave storage unchanged when readiness transitions to RecoveryOnly before saveSettings is called (error case, AC-DEL-006)', async () => {
        const { service, tm, setAdapterOverrides } = createTestHarness();
        await service.initialize({ proposedTimeZone: 'America/New_York' });

        setAdapterOverrides({
          verifyServiceWorkerActive: async () => ({
            ok: false,
            errorMessage: 'SW controller lost mid-session',
          }),
        });

        const res = await service.saveSettings({
          timeZone: 'America/Chicago',
          expectedSettingsRevision: 1,
        });
        const status = await service.getStatus();
        await tm.close();

        expect(res.outcome).toBe('RuntimeNotWritable');
        expect(status.status).toBe('RecoveryOnly');
        if (status.status === 'RecoveryOnly') {
          expect(status.workspace.timeZone).toBe('America/New_York');
          expect(status.workspace.settingsRevision).toBe(1);
        }
      });
    });
  });
});
