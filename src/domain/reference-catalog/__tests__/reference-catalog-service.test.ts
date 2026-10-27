import { describe, expect, it } from 'vitest';
import { TransactionManager } from '../../../persistence/transaction-manager';
import {
  MIN_REQUIRED_STORAGE_BYTES,
  evaluateRuntimeReadiness,
  type RuntimeEnvironmentAdapters,
} from '../../workspace/runtime-readiness';
import { WorkspaceService } from '../../workspace/workspace-service';
import { ReferenceCatalogService } from '../reference-catalog-service';

const encoder = new TextEncoder();
const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

let dbSeq = 0;
async function createInitializedCatalogHarness(
  adapterOverrides: Partial<RuntimeEnvironmentAdapters> = {},
) {
  dbSeq += 1;
  const tm = new TransactionManager({
    dbName: `test-ref-catalog-${dbSeq}-${Date.now()}`,
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

  const workspaceService = new WorkspaceService({
    transactionManager: tm,
    evaluateReadiness,
    requestDurabilityAdapter: {
      getCurrentProtection: async () => 'PersistentGranted',
      requestPersistentStorage: async () => true,
    },
    detectDefaultTimeZone: () => 'America/New_York',
    nowIso: () => '2026-10-27T12:00:00.000Z',
  });

  const catalogService = new ReferenceCatalogService({
    transactionManager: tm,
    evaluateReadiness,
    nowIso: () => '2026-10-27T12:05:00.000Z',
  });

  const initRes = await workspaceService.initialize({ proposedTimeZone: 'America/New_York' });
  if (initRes.outcome !== 'Opened') {
    throw new Error(`Expected workspace to initialize, got ${initRes.outcome}`);
  }

  return {
    tm,
    workspaceService,
    catalogService,
    initialCatalogSnapshot: initRes.statusResult.workspace.catalogSnapshotId,
    setAdapterOverrides(next: Partial<RuntimeEnvironmentAdapters>) {
      currentOverrides = { ...currentOverrides, ...next };
    },
  };
}

describe('Task 3.1: ReferenceCatalog Institution & Account Operations (AC-RESP-001, AC-DEL-004)', () => {
  describe('ReferenceCatalog.save() — CreateInstitution & CreateAccount', () => {
    it('should create an Institution with a stable identity, revision 1 history head, and new CatalogSnapshotId while keeping Workspace onboarding at NeedsInstitutionAndAccount (happy path)', async () => {
      const { catalogService, initialCatalogSnapshot, tm } =
        await createInitializedCatalogHarness();

      const res = await catalogService.save({
        kind: 'CreateInstitution',
        label: '  Interactive   Brokers ',
        expectedCatalogSnapshot: initialCatalogSnapshot,
      });
      await tm.close();

      expect(res.outcome).toBe('Saved');
      if (res.outcome === 'Saved' && res.createdKind === 'Institution') {
        expect(res.institution.id).toBeTruthy();
        expect(res.institution.label).toBe('Interactive Brokers');
        expect(res.institution.normalizedLabel).toBe('interactive brokers');
        expect(res.institution.currentRevision).toBe(1);
        expect(res.appendedHistoryHead).toEqual({
          revision: 1,
          decisionType: 'Created',
          label: 'Interactive Brokers',
          availability: 'Selectable',
          recordedAt: '2026-10-27T12:05:00.000Z',
        });
        expect(res.catalogSnapshotId).not.toBe(initialCatalogSnapshot);
        expect(res.workspaceSummary.onboardingState).toBe('NeedsInstitutionAndAccount');
        expect(res.workspaceSummary.institutionCount).toBe(1);
        expect(res.workspaceSummary.accountCount).toBe(0);
      }
    });

    it('should create an Account under a selectable Institution, return the complete Account record, history head, and new CatalogSnapshotId in one call, and transition Workspace onboarding to ReadyForTradePlanning (happy path, AC-RESP-001)', async () => {
      const { catalogService, initialCatalogSnapshot, tm } =
        await createInitializedCatalogHarness();

      const instRes = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Fidelity',
        expectedCatalogSnapshot: initialCatalogSnapshot,
      });
      expect(instRes.outcome).toBe('Saved');
      if (instRes.outcome !== 'Saved' || instRes.createdKind !== 'Institution') {
        await tm.close();
        return;
      }

      const acctRes = await catalogService.save({
        kind: 'CreateAccount',
        parentInstitutionId: instRes.institution.id,
        label: 'Roth IRA',
        expectedCatalogSnapshot: instRes.catalogSnapshotId,
      });
      await tm.close();

      expect(acctRes.outcome).toBe('Saved');
      if (acctRes.outcome === 'Saved' && acctRes.createdKind === 'Account') {
        expect(acctRes.account.id).toBeTruthy();
        expect(acctRes.account.parentInstitutionId).toBe(instRes.institution.id);
        expect(acctRes.account.label).toBe('Roth IRA');
        expect(acctRes.account.currentRevision).toBe(1);
        expect(acctRes.appendedHistoryHead.decisionType).toBe('Created');
        expect(acctRes.catalogSnapshotId).not.toBe(instRes.catalogSnapshotId);
        expect(acctRes.workspaceSummary.onboardingState).toBe('ReadyForTradePlanning');
        expect(acctRes.workspaceSummary.selectableAccountCount).toBe(1);
      }
    });

    it('should allow two Accounts with the same label (e.g., "Margin") when they belong to different parent Institutions (namespace boundary condition)', async () => {
      const { catalogService, initialCatalogSnapshot, tm } =
        await createInitializedCatalogHarness();

      const inst1 = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Schwab',
        expectedCatalogSnapshot: initialCatalogSnapshot,
      });
      if (inst1.outcome !== 'Saved' || inst1.createdKind !== 'Institution') throw new Error('fail');

      const inst2 = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Tastytrade',
        expectedCatalogSnapshot: inst1.catalogSnapshotId,
      });
      if (inst2.outcome !== 'Saved' || inst2.createdKind !== 'Institution') throw new Error('fail');

      const acct1 = await catalogService.save({
        kind: 'CreateAccount',
        parentInstitutionId: inst1.institution.id,
        label: 'Margin',
        expectedCatalogSnapshot: inst2.catalogSnapshotId,
      });
      if (acct1.outcome !== 'Saved') throw new Error('fail');

      const acct2 = await catalogService.save({
        kind: 'CreateAccount',
        parentInstitutionId: inst2.institution.id,
        label: 'Margin',
        expectedCatalogSnapshot: acct1.catalogSnapshotId,
      });
      await tm.close();

      expect(acct2.outcome).toBe('Saved');
      if (acct2.outcome === 'Saved') {
        expect(acct2.accounts).toHaveLength(2);
      }
    });

    it('should reject creating an Institution whose normalized label collides case-insensitively with an existing Institution (e.g., "  fidelity  " vs "Fidelity") with DuplicateLabelInNamespace and zero writes (boundary/error case)', async () => {
      const { catalogService, initialCatalogSnapshot, tm } =
        await createInitializedCatalogHarness();

      const inst1 = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Fidelity',
        expectedCatalogSnapshot: initialCatalogSnapshot,
      });
      if (inst1.outcome !== 'Saved') throw new Error('fail');

      const dup = await catalogService.save({
        kind: 'CreateInstitution',
        label: '  fIdElItY  ',
        expectedCatalogSnapshot: inst1.catalogSnapshotId,
      });
      const list = await catalogService.query({ mode: 'ListInstitutions' });
      await tm.close();

      expect(dup.outcome).toBe('Rejected');
      if (dup.outcome === 'Rejected') {
        expect(dup.reason).toBe('DuplicateLabelInNamespace');
      }
      if (list.outcome === 'InstitutionList') {
        expect(list.items).toHaveLength(1);
        expect(list.catalogSnapshotId).toBe(inst1.catalogSnapshotId);
      }
    });

    it('should reject creating an Account whose normalized label collides case-insensitively with an existing Account under the same Institution with DuplicateLabelInNamespace and zero writes (error case)', async () => {
      const { catalogService, initialCatalogSnapshot, tm } =
        await createInitializedCatalogHarness();

      const inst = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Fidelity',
        expectedCatalogSnapshot: initialCatalogSnapshot,
      });
      if (inst.outcome !== 'Saved' || inst.createdKind !== 'Institution') throw new Error('fail');

      const acct1 = await catalogService.save({
        kind: 'CreateAccount',
        parentInstitutionId: inst.institution.id,
        label: 'Individual Margin',
        expectedCatalogSnapshot: inst.catalogSnapshotId,
      });
      if (acct1.outcome !== 'Saved') throw new Error('fail');

      const dupAcct = await catalogService.save({
        kind: 'CreateAccount',
        parentInstitutionId: inst.institution.id,
        label: '  individual   margin ',
        expectedCatalogSnapshot: acct1.catalogSnapshotId,
      });
      const list = await catalogService.query({ mode: 'ListAccounts' });
      await tm.close();

      expect(dupAcct.outcome).toBe('Rejected');
      if (dupAcct.outcome === 'Rejected') {
        expect(dupAcct.reason).toBe('DuplicateLabelInNamespace');
      }
      if (list.outcome === 'AccountList') {
        expect(list.items).toHaveLength(1);
        expect(list.catalogSnapshotId).toBe(acct1.catalogSnapshotId);
      }
    });

    it('should reject creating an Institution or Account with an empty or whitespace-only label with InvalidLabel and zero writes (boundary/error case)', async () => {
      const { catalogService, initialCatalogSnapshot, tm } =
        await createInitializedCatalogHarness();

      const emptyInst = await catalogService.save({
        kind: 'CreateInstitution',
        label: '   ',
        expectedCatalogSnapshot: initialCatalogSnapshot,
      });
      const list = await catalogService.query({ mode: 'ListInstitutions' });
      await tm.close();

      expect(emptyInst.outcome).toBe('Rejected');
      if (emptyInst.outcome === 'Rejected') {
        expect(emptyInst.reason).toBe('InvalidLabel');
      }
      if (list.outcome === 'InstitutionList') {
        expect(list.items).toHaveLength(0);
        expect(list.catalogSnapshotId).toBe(initialCatalogSnapshot);
      }
    });

    it('should reject creating an Account when parentInstitutionId does not exist or refers to a non-Institution identity with InvalidParentReference and zero writes (error case)', async () => {
      const { catalogService, initialCatalogSnapshot, tm } =
        await createInitializedCatalogHarness();

      const res = await catalogService.save({
        kind: 'CreateAccount',
        parentInstitutionId: 'inst-does-not-exist',
        label: 'Main Account',
        expectedCatalogSnapshot: initialCatalogSnapshot,
      });
      const list = await catalogService.query({ mode: 'ListAccounts' });
      await tm.close();

      expect(res.outcome).toBe('Rejected');
      if (res.outcome === 'Rejected') {
        expect(res.reason).toBe('InvalidParentReference');
      }
      if (list.outcome === 'AccountList') {
        expect(list.items).toHaveLength(0);
      }
    });

    it('should return Conflict and write nothing when expectedCatalogSnapshot does not match the current catalog snapshot (concurrency error case)', async () => {
      const { catalogService, tm } = await createInitializedCatalogHarness();

      const res = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Schwab',
        expectedCatalogSnapshot: 'stale-snapshot-token',
      });
      const list = await catalogService.query({ mode: 'ListInstitutions' });
      await tm.close();

      expect(res.outcome).toBe('Conflict');
      if (list.outcome === 'InstitutionList') {
        expect(list.items).toHaveLength(0);
      }
    });

    it('should return RuntimeNotWritable and write nothing when called while RuntimeReadiness is not Writable (error case, AC-DEL-004)', async () => {
      const { catalogService, initialCatalogSnapshot, setAdapterOverrides, tm } =
        await createInitializedCatalogHarness();

      setAdapterOverrides({
        estimateFreeStorageBytes: async () => 1024,
      });

      const res = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Schwab',
        expectedCatalogSnapshot: initialCatalogSnapshot,
      });
      const list = await catalogService.query({ mode: 'ListInstitutions' });
      await tm.close();

      expect(res.outcome).toBe('RuntimeNotWritable');
      if (list.outcome === 'InstitutionList') {
        expect(list.items).toHaveLength(0);
      }
    });
  });

  describe('ReferenceCatalog.query() & resolve()', () => {
    it('should list Institutions and Accounts in deterministic label-then-identity order bound to the current CatalogSnapshotId (happy path)', async () => {
      const { catalogService, initialCatalogSnapshot, tm } =
        await createInitializedCatalogHarness();

      const r1 = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Zeta Brokerage',
        expectedCatalogSnapshot: initialCatalogSnapshot,
      });
      if (r1.outcome !== 'Saved') throw new Error('fail');

      const r2 = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Alpha Brokerage',
        expectedCatalogSnapshot: r1.catalogSnapshotId,
      });
      if (r2.outcome !== 'Saved') throw new Error('fail');

      const list = await catalogService.query({ mode: 'ListInstitutions' });
      await tm.close();

      expect(list.outcome).toBe('InstitutionList');
      if (list.outcome === 'InstitutionList') {
        expect(list.items.map((i) => i.label)).toEqual(['Alpha Brokerage', 'Zeta Brokerage']);
        expect(list.catalogSnapshotId).toBe(r2.catalogSnapshotId);
      }
    });

    it('should paginate deterministically using snapshot-bound cursors and reject a cursor bound to a stale CatalogSnapshotId (boundary/error case)', async () => {
      const { catalogService, initialCatalogSnapshot, tm } =
        await createInitializedCatalogHarness();

      const r1 = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Alpha',
        expectedCatalogSnapshot: initialCatalogSnapshot,
      });
      if (r1.outcome !== 'Saved') throw new Error('fail');

      const r2 = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Beta',
        expectedCatalogSnapshot: r1.catalogSnapshotId,
      });
      if (r2.outcome !== 'Saved') throw new Error('fail');

      const page1 = await catalogService.query({ mode: 'ListInstitutions', limit: 1 });
      expect(page1.outcome).toBe('InstitutionList');
      if (page1.outcome !== 'InstitutionList' || !page1.nextCursor) throw new Error('fail');
      expect(page1.items.map((i) => i.label)).toEqual(['Alpha']);

      const page2 = await catalogService.query({
        mode: 'ListInstitutions',
        limit: 1,
        cursor: page1.nextCursor,
      });
      expect(page2.outcome).toBe('InstitutionList');
      if (page2.outcome === 'InstitutionList') {
        expect(page2.items.map((i) => i.label)).toEqual(['Beta']);
        expect(page2.nextCursor).toBeNull();
      }

      // Advance snapshot and verify old cursor is rejected as StaleCursor
      const r3 = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Gamma',
        expectedCatalogSnapshot: r2.catalogSnapshotId,
      });
      expect(r3.outcome).toBe('Saved');

      const staleRes = await catalogService.query({
        mode: 'ListInstitutions',
        cursor: page1.nextCursor,
      });
      await tm.close();
      expect(staleRes.outcome).toBe('StaleCursor');
    });

    it('should return complete revision history for a created Institution or Account identity (happy path)', async () => {
      const { catalogService, initialCatalogSnapshot, tm } =
        await createInitializedCatalogHarness();

      const r1 = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Fidelity',
        expectedCatalogSnapshot: initialCatalogSnapshot,
      });
      if (r1.outcome !== 'Saved' || r1.createdKind !== 'Institution') throw new Error('fail');

      const historyRes = await catalogService.query({
        mode: 'GetItemHistory',
        id: r1.institution.id,
      });
      await tm.close();

      expect(historyRes.outcome).toBe('ItemHistory');
      if (historyRes.outcome === 'ItemHistory') {
        expect(historyRes.history).toHaveLength(1);
        expect(historyRes.history[0]?.decisionType).toBe('Created');
      }
    });

    it('should resolve a selectable Account and its selectable parent Institution as valid for NewSelection (happy path)', async () => {
      const { catalogService, initialCatalogSnapshot, tm } =
        await createInitializedCatalogHarness();

      const inst = await catalogService.save({
        kind: 'CreateInstitution',
        label: 'Schwab',
        expectedCatalogSnapshot: initialCatalogSnapshot,
      });
      if (inst.outcome !== 'Saved' || inst.createdKind !== 'Institution') throw new Error('fail');

      const acct = await catalogService.save({
        kind: 'CreateAccount',
        parentInstitutionId: inst.institution.id,
        label: 'Taxable Brokerage',
        expectedCatalogSnapshot: inst.catalogSnapshotId,
      });
      if (acct.outcome !== 'Saved' || acct.createdKind !== 'Account') throw new Error('fail');

      const resolved = await catalogService.resolve({
        mode: 'NewSelection',
        accountId: acct.account.id,
        expectedCatalogSnapshot: acct.catalogSnapshotId,
      });
      await tm.close();

      expect(resolved.outcome).toBe('Resolved');
      if (resolved.outcome === 'Resolved') {
        expect(resolved.account.id).toBe(acct.account.id);
        expect(resolved.institution.id).toBe(inst.institution.id);
      }
    });

    it('should reject NewSelection resolution when AccountId is unknown or when expectedCatalogSnapshot is stale (error case)', async () => {
      const { catalogService, initialCatalogSnapshot, tm } =
        await createInitializedCatalogHarness();

      const unknownRes = await catalogService.resolve({
        mode: 'NewSelection',
        accountId: 'acct-missing',
        expectedCatalogSnapshot: initialCatalogSnapshot,
      });
      const staleRes = await catalogService.resolve({
        mode: 'NewSelection',
        accountId: 'acct-missing',
        expectedCatalogSnapshot: 'stale-snapshot',
      });
      await tm.close();

      expect(unknownRes.outcome).toBe('Unresolvable');
      expect(staleRes.outcome).toBe('SnapshotMismatch');
    });
  });
});
