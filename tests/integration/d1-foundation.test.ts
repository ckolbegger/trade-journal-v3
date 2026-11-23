import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createReferenceCatalog } from '../../src/catalog/reference-catalog';
import { createPersistenceSeam } from '../../src/persistence/idb';
import { verifyOfflineInventory } from '../../src/runtime/inventory';
import { createRuntimeReadinessController } from '../../src/runtime/readiness';
import { createManualClock } from '../../src/shared/clock';
import { createWorkspace } from '../../src/workspace/workspace';
import { buildReleaseInventory } from '../../vite-plugins/release-inventory';

/**
 * Disclosed test-specific infrastructure replacement:
 * - fake-indexeddb (IDBFactory) replaces browser-owned IndexedDB in Node.
 * - Real buildReleaseInventory + real Web Crypto SHA-256 verification run against a self-contained
 *   fixture bundle directory so `vitest run` never requires a pre-built `dist/` on clean checkouts.
 * No application modules are mocked or stubbed.
 */
describe('D1 mock-free real-stack integration', () => {
  it('verifies real build release-inventory.json digests and executes full Workspace + Catalog lifecycle with cold restart and RecoveryOnly protection', async () => {
    const distDir = mkdtempSync(join(tmpdir(), 'tjv3-d1-dist-'));
    try {
      writeFileSync(join(distDir, 'index.html'), '<!doctype html><title>Trade Journal V3</title>');
      writeFileSync(join(distDir, 'manifest.webmanifest'), '{"id":"/","name":"Trade Journal V3"}');
      writeFileSync(join(distDir, 'sw.js'), '// sw v1');

      const inventory = buildReleaseInventory(distDir);
      expect(inventory.assets.some((a) => a.url === '/index.html')).toBe(true);
      expect(inventory.assets.some((a) => a.url === '/manifest.webmanifest')).toBe(true);

    const idb = new IDBFactory();
    const clock = createManualClock('2026-11-23T16:00:00.000Z');
    let inventoryTampered = false;

    const buildStack = () => {
      const gateHolder: {
        checkWritable: ReturnType<typeof createRuntimeReadinessController>['checkWritable'];
      } = {
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
      const readiness = createRuntimeReadinessController({
        clock,
        probes: {
          runStorageDiagnostic: () => persistence.runDiagnosticProbe(),
          inspectRoot: () => persistence.inspectRoot(),
          estimateCapacity: async () => ({
            supported: true,
            quotaBytes: 512 * 1024 * 1024,
            usageBytes: 4 * 1024 * 1024,
          }),
          checkServiceWorkerControl: async () => ({
            controlled: true,
            releaseId: inventory.releaseId,
          }),
          verifyOfflineInventory: async () =>
            verifyOfflineInventory(inventory, async (url) => {
              const abs = join(distDir, url.replace(/^\//, ''));
              const buf = readFileSync(abs);
              if (inventoryTampered && url === '/index.html') {
                return new TextEncoder().encode('corrupted');
              }
              return new Uint8Array(buf);
            }),
          checkStorageProtection: async () => ({
            state: 'BestEffort',
            reason: 'Simulated best-effort browser origin.',
          }),
        },
      });
      gateHolder.checkWritable = () => readiness.checkWritable();
      const catalog = createReferenceCatalog({ persistence, clock });
      const workspace = createWorkspace({
        persistence,
        readiness,
        catalog,
        clock,
        requestPersistentStorage: async () => ({ state: 'Protected' }),
      });
      return { persistence, readiness, catalog, workspace };
    };

    // Launch 1: fresh initialization + Institution/Account setup
    const session1 = buildStack();
    const opened = await session1.workspace.initialize({ proposedTimeZone: 'America/New_York' });
    expect(opened.status).toBe('Opened');
    if (opened.status !== 'Opened') return;
    expect(opened.workspaceStatus.onboardingState).toBe('NeedsInstitutionAndAccount');
    expect(opened.workspaceStatus.readiness.showProtectionWarning).toBe(true);

    const inst = await session1.catalog.save({ kind: 'CreateInstitution', label: 'Interactive Brokers' });
    expect(inst.status).toBe('Saved');
    if (inst.status !== 'Saved' || inst.family !== 'Institution') return;

    const acct = await session1.catalog.save({
      kind: 'CreateAccount',
      institutionId: inst.record.id,
      label: 'Margin Pro',
    });
    expect(acct.status).toBe('Saved');

    const tzSave = await session1.workspace.saveSettings({
      timeZone: 'America/Chicago',
      expectedSettingsRevision: 1,
    });
    expect(tzSave.status).toBe('Saved');

    // Launch 2: cold restart (new stack instances against same persistent IDB)
    const session2 = buildStack();
    const reopened = await session2.workspace.initialize({});
    expect(reopened.status).toBe('Opened');
    if (reopened.status !== 'Opened') return;
    expect(reopened.fresh).toBe(false);
    expect(reopened.workspaceStatus.timeZone).toBe('America/Chicago');
    expect(reopened.workspaceStatus.onboardingState).toBe('ReadyForTradePlanning');
    expect(reopened.workspaceStatus.selectableAccountCount).toBe(1);

    // Launch 3: Offline Release Inventory tampered -> RecoveryOnly (reads ok, writes blocked)
    inventoryTampered = true;
    const session3 = buildStack();
    const degradedInit = await session3.workspace.initialize({});
    expect(degradedInit.status).toBe('RuntimeNotWritable');
    if (degradedInit.status === 'RuntimeNotWritable') {
      expect(degradedInit.reason).toBe('RecoveryOnly');
    }

    const status = await session3.workspace.getStatus();
    expect(status.status).toBe('RecoveryOnly');
    if (status.status === 'RecoveryOnly') {
      expect(status.workspaceStatus.timeZone).toBe('America/Chicago');
    }

    const blockedWrite = await session3.catalog.save({
      kind: 'CreateInstitution',
      label: 'Should Fail',
    });
    expect(blockedWrite.status).toBe('RuntimeNotWritable');
    } finally {
      rmSync(distDir, { recursive: true, force: true });
    }
  });
});
