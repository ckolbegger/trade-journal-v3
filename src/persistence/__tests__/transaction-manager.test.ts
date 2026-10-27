import { describe, expect, it } from 'vitest';
import {
  STORE_REFERENCE_CATALOG,
  STORE_WORKSPACE_META,
  type WorkspaceMetaRecord,
} from '../schema-v1';
import { TransactionManager } from '../transaction-manager';

let dbCounter = 0;
function nextDbName(): string {
  dbCounter += 1;
  return `test-tj-v3-tm-${dbCounter}-${Date.now()}`;
}

function sampleMeta(overrides: Partial<WorkspaceMetaRecord> = {}): WorkspaceMetaRecord {
  return {
    key: 'root',
    workspaceId: 'ws-001',
    schemaVersion: 1,
    snapshotBinding: 'snap-1',
    timeZone: 'America/New_York',
    settingsRevision: 1,
    catalogSnapshotId: 'cat-1',
    createdAt: '2026-10-27T12:00:00.000Z',
    updatedAt: '2026-10-27T12:00:00.000Z',
    latestReceipt: {
      receiptId: 'rcpt-1',
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
    ...overrides,
  };
}

describe('Task 1.3: Persistence/Transaction Seam, Diagnostic Probe & Write Gate (AC-DEL-004, AC-DEL-005, AC-DEL-006)', () => {
  describe('runDiagnosticProbeTransaction()', () => {
    it('should open IndexedDB, complete an isolated readwrite probe in _diagnostic_probe, and leave zero records in workspace_meta, reference_catalog, or _diagnostic_probe (happy path)', async () => {
      const tm = new TransactionManager({ dbName: nextDbName() });
      const res = await tm.runDiagnosticProbeTransaction('2026-10-27T12:00:00.000Z');
      const inspection = await tm.inspectStorageRoot();
      await tm.close();

      expect(res).toEqual({
        ok: true,
        probedAt: '2026-10-27T12:00:00.000Z',
      });
      expect(inspection).toEqual({ kind: 'FreshEmptyRoot' });
    });

    it('should not increment any WorkspaceSnapshotBinding, settings revision, or catalog snapshot token when the diagnostic probe runs (edge case)', async () => {
      const tm = new TransactionManager({ dbName: nextDbName(), initialReadiness: 'Writable' });
      const initialMeta = sampleMeta();
      await tm.executeWriteTransaction([STORE_WORKSPACE_META], async (tx) => {
        await tx.objectStore(STORE_WORKSPACE_META).put(initialMeta);
      });

      const probeRes = await tm.runDiagnosticProbeTransaction('2026-10-27T13:00:00.000Z');
      expect(probeRes.ok).toBe(true);

      const inspection = await tm.inspectStorageRoot();
      await tm.close();
      expect(inspection.kind).toBe('ExistingReadableWorkspace');
      if (inspection.kind === 'ExistingReadableWorkspace') {
        expect(inspection.meta.snapshotBinding).toBe('snap-1');
        expect(inspection.meta.settingsRevision).toBe(1);
        expect(inspection.meta.catalogSnapshotId).toBe('cat-1');
      }
    });

    it('should return a structured DiagnosticTransactionFailed check failure when IndexedDB open or readwrite commit throws or aborts (error case)', async () => {
      const tm = new TransactionManager({ dbName: nextDbName() });
      tm.injectFaults({ probeFailure: 'QuotaExceededError: diagnostic write failed' });

      const res = await tm.runDiagnosticProbeTransaction();
      await tm.close();
      expect(res).toEqual({
        ok: false,
        code: 'DiagnosticTransactionFailed',
        message: 'QuotaExceededError: diagnostic write failed',
      });
    });
  });

  describe('inspectStorageRoot()', () => {
    it('should report FreshEmptyRoot only when the database opens cleanly and both workspace_meta and reference_catalog are proven empty (happy path)', async () => {
      const tm = new TransactionManager({ dbName: nextDbName() });
      const inspection = await tm.inspectStorageRoot();
      await tm.close();
      expect(inspection).toEqual({ kind: 'FreshEmptyRoot' });
    });

    it('should report ExistingReadableWorkspace with its snapshot binding when valid workspace_meta exists (happy path)', async () => {
      const tm = new TransactionManager({ dbName: nextDbName(), initialReadiness: 'Writable' });
      await tm.executeWriteTransaction([STORE_WORKSPACE_META], async (tx) => {
        await tx.objectStore(STORE_WORKSPACE_META).put(sampleMeta());
      });

      const inspection = await tm.inspectStorageRoot();
      await tm.close();
      expect(inspection.kind).toBe('ExistingReadableWorkspace');
      if (inspection.kind === 'ExistingReadableWorkspace') {
        expect(inspection.meta.workspaceId).toBe('ws-001');
        expect(inspection.meta.snapshotBinding).toBe('snap-1');
        expect(inspection.selectableAccountCount).toBe(0);
      }
    });

    it('should report IntegrityBlockedRoot when workspace_meta is missing/corrupt but reference_catalog contains records (partial/corrupt root edge case)', async () => {
      const tm = new TransactionManager({ dbName: nextDbName() });
      await tm._unsafeWriteRawForTesting(STORE_REFERENCE_CATALOG, {
        id: 'inst-1',
        kind: 'Institution',
        label: 'Fidelity',
        normalizedLabel: 'fidelity',
        availability: 'Selectable',
        origin: 'TraderCreated',
        currentRevision: 1,
        createdAt: '2026-10-27T12:00:00.000Z',
        updatedAt: '2026-10-27T12:00:00.000Z',
        history: [],
      });

      const inspection = await tm.inspectStorageRoot();
      await tm.close();
      expect(inspection.kind).toBe('IntegrityBlockedRoot');
      if (inspection.kind === 'IntegrityBlockedRoot') {
        expect(inspection.reason).toBe('CorruptOrPartialMetadata');
      }
    });

    it('should report IntegrityBlockedRoot when a known storage root marker exists or IndexedDB read throws an unexpected DOMException, never falling through to FreshEmptyRoot (error case)', async () => {
      const tm = new TransactionManager({ dbName: nextDbName() });
      tm.injectFaults({
        knownUnreadableRoot: true,
        storageReadFailure: 'VersionError: existing database cannot be read',
      });

      const inspection = await tm.inspectStorageRoot();
      await tm.close();
      expect(inspection.kind).toBe('IntegrityBlockedRoot');
      if (inspection.kind === 'IntegrityBlockedRoot') {
        expect(inspection.reason).toBe('StorageOpenOrReadFailed');
        expect(inspection.message).toContain('existing database cannot be read');
      }
    });

    it('should report IntegrityBlockedRoot when stored schemaVersion is higher than the installed release schema version (unknown newer data boundary condition)', async () => {
      const tm = new TransactionManager({ dbName: nextDbName() });
      await tm._unsafeWriteRawForTesting(STORE_WORKSPACE_META, {
        ...sampleMeta(),
        schemaVersion: 99,
      });

      const inspection = await tm.inspectStorageRoot();
      await tm.close();
      expect(inspection.kind).toBe('IntegrityBlockedRoot');
      if (inspection.kind === 'IntegrityBlockedRoot') {
        expect(inspection.reason).toBe('UnsupportedNewerSchemaVersion');
      }
    });
  });

  describe('Persistence-level RuntimeNotWritable write gate', () => {
    it('should commit all participating object stores atomically when RuntimeReadiness is Writable (happy path)', async () => {
      const tm = new TransactionManager({ dbName: nextDbName(), initialReadiness: 'Writable' });
      const res = await tm.executeWriteTransaction(
        [STORE_WORKSPACE_META, STORE_REFERENCE_CATALOG],
        async (tx) => {
          await tx.objectStore(STORE_WORKSPACE_META).put(sampleMeta());
          await tx.objectStore(STORE_REFERENCE_CATALOG).put({
            id: 'inst-1',
            kind: 'Institution',
            label: 'Schwab',
            normalizedLabel: 'schwab',
            availability: 'Selectable',
            origin: 'TraderCreated',
            currentRevision: 1,
            createdAt: '2026-10-27T12:00:00.000Z',
            updatedAt: '2026-10-27T12:00:00.000Z',
            history: [],
          });
          return 'committed';
        },
      );

      expect(res).toEqual({ ok: true, value: 'committed' });
      const inspection = await tm.inspectStorageRoot();
      await tm.close();
      expect(inspection.kind).toBe('ExistingReadableWorkspace');
      if (inspection.kind === 'ExistingReadableWorkspace') {
        expect(inspection.institutions).toHaveLength(1);
      }
    });

    it('should reject any write transaction with RuntimeNotWritable and leave all store revisions unchanged when RuntimeReadiness is Unsupported or RecoveryOnly (error case)', async () => {
      const tm = new TransactionManager({ dbName: nextDbName(), initialReadiness: 'Writable' });
      await tm.executeWriteTransaction([STORE_WORKSPACE_META], async (tx) => {
        await tx.objectStore(STORE_WORKSPACE_META).put(sampleMeta());
      });
      tm.setReadinessMode('RecoveryOnly');

      const writeRes = await tm.executeWriteTransaction([STORE_WORKSPACE_META], async (tx) => {
        await tx
          .objectStore(STORE_WORKSPACE_META)
          .put(sampleMeta({ settingsRevision: 2, snapshotBinding: 'snap-2' }));
        return 'should-not-happen';
      });

      expect(writeRes.ok).toBe(false);
      if (!writeRes.ok) {
        expect(writeRes.error.kind).toBe('RuntimeNotWritable');
        expect(writeRes.error.readiness).toBe('RecoveryOnly');
      }

      const inspection = await tm.inspectStorageRoot();
      await tm.close();
      expect(inspection.kind).toBe('ExistingReadableWorkspace');
      if (inspection.kind === 'ExistingReadableWorkspace') {
        expect(inspection.meta.settingsRevision).toBe(1);
        expect(inspection.meta.snapshotBinding).toBe('snap-1');
      }
    });

    it('should immediately invalidate Writable status and block the next write transaction if a storage or release-integrity failure occurs mid-session (AC-DEL-006 edge case)', async () => {
      const tm = new TransactionManager({ dbName: nextDbName(), initialReadiness: 'Writable' });
      await tm.executeWriteTransaction([STORE_WORKSPACE_META], async (tx) => {
        await tx.objectStore(STORE_WORKSPACE_META).put(sampleMeta());
      });

      tm.injectFaults({ midSessionFailure: 'ServiceWorkerControllerLost' });

      const writeRes = await tm.executeWriteTransaction([STORE_WORKSPACE_META], async (tx) => {
        await tx
          .objectStore(STORE_WORKSPACE_META)
          .put(sampleMeta({ settingsRevision: 2, snapshotBinding: 'snap-2' }));
      });

      expect(writeRes.ok).toBe(false);
      if (!writeRes.ok) {
        expect(writeRes.error.kind).toBe('RuntimeNotWritable');
        expect(writeRes.error.readiness).toBe('RecoveryOnly');
      }
      await tm.close();
    });

    it('should roll back all changes across workspace_meta and reference_catalog if any step inside a multi-store transaction throws or aborts (atomicity error case)', async () => {
      const tm = new TransactionManager({ dbName: nextDbName(), initialReadiness: 'Writable' });
      await tm.executeWriteTransaction([STORE_WORKSPACE_META], async (tx) => {
        await tx.objectStore(STORE_WORKSPACE_META).put(sampleMeta());
      });

      await expect(
        tm.executeWriteTransaction(
          [STORE_WORKSPACE_META, STORE_REFERENCE_CATALOG],
          async (tx) => {
            await tx
              .objectStore(STORE_WORKSPACE_META)
              .put(sampleMeta({ settingsRevision: 2, snapshotBinding: 'snap-2' }));
            await tx.objectStore(STORE_REFERENCE_CATALOG).put({
              id: 'inst-abort',
              kind: 'Institution',
              label: 'AbortCorp',
              normalizedLabel: 'abortcorp',
              availability: 'Selectable',
              origin: 'TraderCreated',
              currentRevision: 1,
              createdAt: '2026-10-27T12:00:00.000Z',
              updatedAt: '2026-10-27T12:00:00.000Z',
              history: [],
            });
            throw new Error('Injected mid-transaction failure');
          },
        ),
      ).rejects.toThrow('Injected mid-transaction failure');

      const inspection = await tm.inspectStorageRoot();
      await tm.close();
      expect(inspection.kind).toBe('ExistingReadableWorkspace');
      if (inspection.kind === 'ExistingReadableWorkspace') {
        expect(inspection.meta.settingsRevision).toBe(1);
        expect(inspection.meta.snapshotBinding).toBe('snap-1');
        expect(inspection.institutions).toHaveLength(0);
      }
    });
  });
});
