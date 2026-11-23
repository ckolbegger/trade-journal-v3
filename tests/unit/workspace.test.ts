import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createPersistenceSeam } from '../../src/persistence/idb';
import {
  createRuntimeReadinessController,
  type ReadinessProbes,
} from '../../src/runtime/readiness';
import { createReferenceCatalog } from '../../src/catalog/reference-catalog';
import { createWorkspace } from '../../src/workspace/workspace';
import { createManualClock } from '../../src/shared/clock';
import type { StorageProtectionStatus } from '../../src/shared/result';

function createWorkspaceHarness(options: {
  swControlled?: boolean;
  protection?: StorageProtectionStatus;
  persistGrants?: boolean;
} = {}) {
  const clock = createManualClock('2026-11-23T15:00:00.000Z');
  const idb = new IDBFactory();
  let swControlled = options.swControlled ?? true;
  let protection: StorageProtectionStatus = options.protection ?? {
    state: 'BestEffort',
    reason: 'Browser storage is currently best-effort.',
  };
  let persistGrants = options.persistGrants ?? true;

  const gateHolder: { checkWritable: ReturnType<typeof createRuntimeReadinessController>['checkWritable'] } = {
    checkWritable: () => ({
      writable: false,
      reason: 'Unsupported',
      failedChecks: ['storage_diagnostic'],
    }),
  };
  const persistence = createPersistenceSeam({
    indexedDB: idb,
    writeGate: { checkWritable: () => gateHolder.checkWritable() },
  });

  const probes: ReadinessProbes = {
    runStorageDiagnostic: () => persistence.runDiagnosticProbe(),
    inspectRoot: () => persistence.inspectRoot(),
    estimateCapacity: async () => ({
      supported: true,
      quotaBytes: 500 * 1024 * 1024,
      usageBytes: 5 * 1024 * 1024,
    }),
    checkServiceWorkerControl: async () =>
      swControlled
        ? { controlled: true, releaseId: 'rel-d1-test' }
        : { controlled: false, reason: 'No active service worker controller.' },
    verifyOfflineInventory: async () => ({
      valid: true,
      releaseId: 'rel-d1-test',
      assetCount: 4,
    }),
    checkStorageProtection: async () => protection,
  };

  const readiness = createRuntimeReadinessController({ clock, probes });
  gateHolder.checkWritable = () => readiness.checkWritable();
  const catalog = createReferenceCatalog({ persistence, clock });
  const workspace = createWorkspace({
    persistence,
    readiness,
    catalog,
    clock,
    requestPersistentStorage: async () => {
      if (protection.state === 'Protected') {
        return { state: 'Protected' };
      }
      if (persistGrants) {
        protection = { state: 'Protected' };
        return protection;
      }
      return protection;
    },
  });

  return {
    workspace,
    catalog,
    readiness,
    clock,
    setSwControlled: (next: boolean) => {
      swControlled = next;
    },
    setPersistGrants: (next: boolean) => {
      persistGrants = next;
    },
  };
}

describe('Workspace seam', () => {
  it('blocks initialization with RuntimeNotWritable when RuntimeReadiness fails, creating no workspace', async () => {
    const { workspace } = createWorkspaceHarness({ swControlled: false });

    const init = await workspace.initialize({ proposedTimeZone: 'America/New_York' });
    expect(init.status).toBe('RuntimeNotWritable');
    if (init.status === 'RuntimeNotWritable') {
      expect(init.reason).toBe('Unsupported');
    }

    const status = await workspace.getStatus();
    expect(status.status).toBe('Unsupported');
  });

  it('requires a valid IANA time zone on first run and opens in NeedsInstitutionAndAccount state', async () => {
    const { workspace, catalog } = createWorkspaceHarness();

    const missingTz = await workspace.initialize({});
    expect(missingTz.status).toBe('TimeZoneSelectionRequired');

    const badTz = await workspace.initialize({ proposedTimeZone: 'Mars/Olympus_Mons' });
    expect(badTz.status).toBe('Rejected');

    const opened = await workspace.initialize({ proposedTimeZone: 'America/New_York' });
    expect(opened.status).toBe('Opened');
    if (opened.status !== 'Opened') return;
    expect(opened.fresh).toBe(true);
    expect(opened.workspaceStatus.timeZone).toBe('America/New_York');
    expect(opened.workspaceStatus.onboardingState).toBe('NeedsInstitutionAndAccount');
    expect(opened.workspaceStatus.capabilities.releaseDeliverable).toBe('D4');

    // Adding an Institution + Account transitions onboarding to ReadyForTradePlanning.
    const inst = await catalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
    if (inst.status !== 'Saved' || inst.family !== 'Institution') throw new Error('expected inst');
    await catalog.save({
      kind: 'CreateAccount',
      institutionId: inst.record.id,
      label: 'Individual',
    });

    const afterAccounts = await workspace.getStatus();
    expect(afterAccounts.status).toBe('Ready');
    if (afterAccounts.status === 'Ready') {
      expect(afterAccounts.workspaceStatus.onboardingState).toBe('ReadyForTradePlanning');
      expect(afterAccounts.workspaceStatus.selectableAccountCount).toBe(1);
    }
  });

  it('saves time zone with optimistic revision, returns complete post-commit status, and enters RecoveryOnly if readiness later fails', async () => {
    const { workspace, setSwControlled } = createWorkspaceHarness();
    await workspace.initialize({ proposedTimeZone: 'America/New_York' });

    const saved = await workspace.saveSettings({
      timeZone: 'America/Chicago',
      expectedSettingsRevision: 1,
    });
    expect(saved.status).toBe('Saved');
    if (saved.status !== 'Saved') return;
    expect(saved.workspaceStatus.timeZone).toBe('America/Chicago');
    expect(saved.workspaceStatus.settingsRevision).toBe(2);

    const unchanged = await workspace.saveSettings({
      timeZone: 'America/Chicago',
      expectedSettingsRevision: 2,
    });
    expect(unchanged.status).toBe('Unchanged');

    const conflict = await workspace.saveSettings({
      timeZone: 'America/Los_Angeles',
      expectedSettingsRevision: 1,
    });
    expect(conflict).toEqual({
      status: 'Conflict',
      currentTimeZone: 'America/Chicago',
      currentSettingsRevision: 2,
    });

    // Concurrent saves against the same expectedSettingsRevision must allow only one Saved and one Conflict
    const [s1, s2] = await Promise.all([
      workspace.saveSettings({ timeZone: 'America/Denver', expectedSettingsRevision: 2 }),
      workspace.saveSettings({ timeZone: 'America/Los_Angeles', expectedSettingsRevision: 2 }),
    ]);
    expect([s1.status, s2.status].sort()).toEqual(['Conflict', 'Saved']);
    const winnerTz =
      s1.status === 'Saved'
        ? s1.workspaceStatus.timeZone
        : s2.status === 'Saved'
          ? s2.workspaceStatus.timeZone
          : '';

    // Simulate readiness degradation on relaunch: existing workspace becomes RecoveryOnly.
    setSwControlled(false);
    const relaunched = await workspace.initialize({});
    expect(relaunched.status).toBe('RuntimeNotWritable');
    if (relaunched.status === 'RuntimeNotWritable') {
      expect(relaunched.reason).toBe('RecoveryOnly');
    }

    const status = await workspace.getStatus();
    expect(status.status).toBe('RecoveryOnly');
    if (status.status === 'RecoveryOnly') {
      expect(status.workspaceStatus.timeZone).toBe(winnerTz);
    }

    // Writes must fail with RuntimeNotWritable in RecoveryOnly.
    const blockedSave = await workspace.saveSettings({
      timeZone: 'America/Phoenix',
      expectedSettingsRevision: 3,
    });
    expect(blockedSave.status).toBe('RuntimeNotWritable');
  });

  it('handles requestDurability honestly as Improved, AlreadyProtected, or NotImproved', async () => {
    const { workspace, setPersistGrants } = createWorkspaceHarness({ persistGrants: false });
    await workspace.initialize({ proposedTimeZone: 'America/New_York' });

    const denied = await workspace.requestDurability();
    expect(denied.status).toBe('NotImproved');
    expect(denied.currentProtection.state).toBe('BestEffort');

    setPersistGrants(true);
    const granted = await workspace.requestDurability();
    expect(granted.status).toBe('Improved');
    expect(granted.currentProtection.state).toBe('Protected');

    const already = await workspace.requestDurability();
    expect(already.status).toBe('AlreadyProtected');
    expect(already.currentProtection.state).toBe('Protected');
  });
});
