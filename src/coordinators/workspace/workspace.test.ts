import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { dumpAll, testStack } from '../../../tests/support/stack.ts';
import { createWorkspace, installedCapabilities } from './index.ts';

async function workspaceStack(...args: Parameters<typeof testStack>) {
  const stack = await testStack(...args);
  const workspace = createWorkspace({ ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId });
  return { ...stack, workspace };
}

describe('initialize', () => {
  it('should return TimeZoneSelectionRequired and write nothing when readiness is Writable, no Workspace exists, and no zone is supplied', async () => {
    const { workspace, factory } = await workspaceStack();
    const before = await dumpAll(factory);
    expect(await workspace.initialize({})).toEqual({ kind: 'TimeZoneSelectionRequired' });
    expect(await dumpAll(factory)).toEqual(before);
  });

  it('should create metadata with the zone (settings revision 1), seed Catalog and Journal in the same transaction, and return Opened with onboarding NeedsInstitutionAndAccount and a receipt naming the readiness evidence, fresh status, and seed versions and additions', async () => {
    const { workspace, factory } = await workspaceStack();
    const result = await workspace.initialize({ timeZone: 'America/New_York' });
    expect(result).toEqual(
      expect.objectContaining({
        kind: 'Opened',
        status: expect.objectContaining({ kind: 'Ready', onboarding: 'NeedsInstitutionAndAccount' }) as unknown,
        receipt: {
          fresh: true,
          readiness: expect.objectContaining({ outcome: 'Writable' }) as unknown,
          seeds: {
            catalog: { manifestVersion: 1, additions: ['strategy.long-stock'] },
            journal: {
              manifestVersion: 3,
              additions: [
                'entry-type.plan-reflection',
                'entry-type.position-change-reflection',
                'entry-type.daily-trade-review',
                'source.plan-confirmation',
                'source.position-change',
                'source.daily-review',
              ],
            },
          },
        },
      }),
    );
    const stored = Object.entries(await dumpAll(factory)).find(([name]) => name.startsWith('tj-ws-'))?.[1];
    expect(stored?.['meta']).toEqual(
      expect.arrayContaining([
        { key: 'settings', timeZone: 'America/New_York', settingsRevision: 1, revision: 1 },
        { key: 'content', contentRevision: 1 },
      ]),
    );
    // Every seeded record was written by the one creating transaction (content revision 1).
    expect(stored?.['catalog']).toEqual([expect.objectContaining({ productKey: 'strategy.long-stock', revision: 1 })]);
    expect(stored?.['journalTypes']).toHaveLength(6);
    expect(stored?.['journalDefinitions']).toEqual([expect.objectContaining({ revision: 1 }), expect.objectContaining({ revision: 1 }), expect.objectContaining({ revision: 1 })]);
  });

  it('should reject an invalid zone with InvalidTimeZone and write nothing', async () => {
    const { workspace, factory } = await workspaceStack();
    await workspace.initialize({});
    const before = await dumpAll(factory);
    expect(await workspace.initialize({ timeZone: 'Mars/Base' })).toEqual({ kind: 'Rejected', issues: [{ code: 'InvalidTimeZone' }] });
    expect(await dumpAll(factory)).toEqual(before);
  });

  it('should return Opened(existing) with a receipt showing no seed additions when the Workspace already exists', async () => {
    const first = await workspaceStack();
    await first.workspace.initialize({ timeZone: 'America/New_York' });
    const restarted = await workspaceStack(first.factory);
    const result = await restarted.workspace.initialize({});
    expect(result).toEqual(
      expect.objectContaining({
        kind: 'Opened',
        status: expect.objectContaining({ kind: 'Ready', timeZone: 'America/New_York' }) as unknown,
        receipt: expect.objectContaining({
          fresh: false,
          seeds: {
            catalog: { manifestVersion: 1, additions: [] },
            journal: { manifestVersion: 3, additions: [] },
          },
        }) as unknown,
      }),
    );
  });

  it('should return RuntimeNotWritable from initialize, not Opened, when an existing Workspace Catalog or Journal seed returns RuntimeNotWritable', async () => {
    const first = await workspaceStack();
    await first.workspace.initialize({ timeZone: 'America/New_York' });
    const refused = {
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'inventory', reason: 'InventoryMissing' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [{ action: 'Retry', explanation: 'Check again once the problem is fixed.' }],
    } as const;
    const catalogRefused = await workspaceStack(first.factory);
    let journalSeeds = 0;
    const withCatalogRefused = createWorkspace({
      ...catalogRefused,
      host: catalogRefused.testHost.host,
      releaseId: catalogRefused.testHost.releaseId,
      catalog: { ...catalogRefused.catalog, seedDefaults: () => Promise.resolve(refused) },
      journal: {
        ...catalogRefused.journal,
        seedDefaults: (manifest) => {
          journalSeeds += 1;
          return catalogRefused.journal.seedDefaults(manifest);
        },
      },
    });
    expect(await withCatalogRefused.initialize({})).toEqual(refused);
    expect(journalSeeds).toBe(0);

    const journalRefused = await workspaceStack(first.factory);
    const withJournalRefused = createWorkspace({
      ...journalRefused,
      host: journalRefused.testHost.host,
      releaseId: journalRefused.testHost.releaseId,
      journal: { ...journalRefused.journal, seedDefaults: () => Promise.resolve(refused) },
    });
    expect(await withJournalRefused.initialize({})).toEqual(refused);
  });

  it('should return Opened with no additions for a seed that returns Conflict, and its receipt should name the seed that did not complete', async () => {
    const first = await workspaceStack();
    await first.workspace.initialize({ timeZone: 'America/New_York' });
    const restarted = await workspaceStack(first.factory);
    const workspace = createWorkspace({
      ...restarted,
      host: restarted.testHost.host,
      releaseId: restarted.testHost.releaseId,
      journal: { ...restarted.journal, seedDefaults: () => Promise.resolve({ kind: 'Conflict' }) },
    });
    const result = await workspace.initialize({});
    expect(result).toEqual(
      expect.objectContaining({
        kind: 'Opened',
        receipt: expect.objectContaining({
          seeds: {
            catalog: { manifestVersion: 1, additions: [] },
            journal: { manifestVersion: 3, additions: [], completed: false },
          },
        }) as unknown,
      }),
    );
  });

  it('should return RuntimeNotWritable with Workspace status RecoveryOnly when a readable Workspace exists and readiness fails', async () => {
    const first = await workspaceStack();
    await first.workspace.initialize({ timeZone: 'America/New_York' });
    const restarted = await workspaceStack(first.factory);
    restarted.testHost.fail(['inventory']);
    expect(await restarted.workspace.initialize({})).toEqual({
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'inventory', reason: 'InventoryMissing' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: expect.any(Array) as unknown,
    });
  });

  it('should return RuntimeNotWritable with readiness Unsupported, Workspace status None, and every failed check when no Workspace exists and readiness fails, writing nothing', async () => {
    const { workspace, factory, testHost } = await workspaceStack();
    testHost.fail(['capacity', 'control']);
    await workspace.initialize({});
    const before = await dumpAll(factory);
    expect(await workspace.initialize({ timeZone: 'America/New_York' })).toEqual({
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'Unsupported',
      failedChecks: [
        { check: 'capacity', reason: 'InsufficientQuota' },
        { check: 'control', reason: 'NoController' },
      ],
      workspaceStatus: 'None',
      safeActions: expect.any(Array) as unknown,
    });
    expect(await dumpAll(factory)).toEqual(before);
    expect(Object.keys(before).some((name) => name.startsWith('tj-ws-'))).toBe(false);
  });

  it('should return RuntimeNotWritable with Workspace status IntegrityBlocked and never initialize when the root is unreadable', async () => {
    const factory = new IDBFactory();
    await new Promise<void>((resolve) => {
      const open = factory.open('tj-root', 99);
      open.onupgradeneeded = () => open.result.createObjectStore('future');
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
    });
    const { workspace } = await workspaceStack(factory);
    const before = await dumpAll(factory);
    expect(await workspace.initialize({ timeZone: 'America/New_York' })).toEqual(
      expect.objectContaining({ kind: 'RuntimeNotWritable', runtimeReadiness: 'Unsupported', workspaceStatus: 'IntegrityBlocked' }),
    );
    expect(await dumpAll(factory)).toEqual(before);
    expect((await factory.databases()).find((d) => d.name === 'tj-root')?.version).toBe(99);
  });

  it('should return IntegrityBlocked with recovery actions when readiness is Writable but stored contents fail validation', async () => {
    const factory = new IDBFactory();
    const raw = (name: string, version: number, upgrade: (db: IDBDatabase) => void, seed: (db: IDBDatabase) => Promise<void>) =>
      new Promise<void>((resolve) => {
        const open = factory.open(name, version);
        open.onupgradeneeded = () => upgrade(open.result);
        open.onsuccess = () => void seed(open.result).then(() => (open.result.close(), resolve()));
      });
    const put = (db: IDBDatabase, store: string, value: unknown) =>
      new Promise<void>((resolve) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value);
        tx.oncomplete = () => resolve();
      });
    await raw('tj-root', 1, (db) => (db.createObjectStore('pointer', { keyPath: 'key' }), db.createObjectStore('diagnostics', { keyPath: 'id' })), (db) =>
      put(db, 'pointer', { key: 'current', databaseName: 'tj-ws-future' }),
    );
    await raw('tj-ws-future', 1, (db) => db.createObjectStore('meta', { keyPath: 'key' }), (db) =>
      // Neither a schema this release migrates from nor a newer one.
      put(db, 'meta', { key: 'schema', schemaVersion: 0 }),
    );
    const { workspace } = await workspaceStack(factory);
    const before = await dumpAll(factory);
    expect(await workspace.initialize({ timeZone: 'America/New_York' })).toEqual({
      kind: 'IntegrityBlocked',
      reason: 'UnknownSchemaVersion',
      recoveryActions: [{ action: 'Retry', explanation: expect.any(String) as string }],
    });
    expect(await dumpAll(factory)).toEqual(before);
  });
});

describe('getStatus', () => {
  it('should return Ready only when readiness is Writable and the Workspace is valid, with the snapshot binding, time zone, Installed Capability Manifest, onboarding, per-check evidence, protection, schema version, and latest receipt', async () => {
    const stack = await workspaceStack();
    const opened = await stack.workspace.initialize({ timeZone: 'America/New_York' });
    if (opened.kind !== 'Opened') throw new Error('expected Opened');
    const status = await stack.workspace.getStatus();
    expect(status).toEqual({
      kind: 'Ready',
      observedAt: '2026-10-12T14:05:00Z',
      binding: { databaseName: expect.stringMatching(/^tj-ws-/) as string, contentRevision: 1 },
      timeZone: 'America/New_York',
      onboarding: 'NeedsInstitutionAndAccount',
      installedCapabilities: expect.objectContaining({ releaseId: stack.testHost.releaseId }) as unknown,
      readiness: expect.objectContaining({
        outcome: 'Writable',
        checks: expect.objectContaining({
          capacity: expect.objectContaining({ passed: true, evidence: expect.any(Object) as unknown }) as unknown,
        }) as unknown,
      }) as unknown,
      protection: 'BestEffort',
      schemaVersion: 3,
      latestReceipt: opened.receipt,
    });
  });

  it('should return InitializationRequired, RecoveryOnly, Unsupported, or IntegrityBlocked for the corresponding inspection and readiness combinations', async () => {
    const fresh = await workspaceStack();
    expect(await fresh.workspace.getStatus()).toEqual(expect.objectContaining({ kind: 'InitializationRequired' }));

    fresh.testHost.fail(['diagnostic']);
    await fresh.session.recheck();
    expect(await fresh.workspace.getStatus()).toEqual(
      expect.objectContaining({ kind: 'Unsupported', failedChecks: [{ check: 'diagnostic', reason: 'OpenFailed' }] }),
    );

    const existing = await workspaceStack();
    await existing.workspace.initialize({ timeZone: 'America/New_York' });
    existing.testHost.fail(['control']);
    await existing.session.recheck();
    expect(await existing.workspace.getStatus()).toEqual(
      expect.objectContaining({
        kind: 'RecoveryOnly',
        failedChecks: [{ check: 'control', reason: 'NoController' }],
        timeZone: 'America/New_York',
      }),
    );

    const unreadable = new IDBFactory();
    await new Promise<void>((resolve) => {
      const open = unreadable.open('tj-root', 99);
      open.onsuccess = () => (open.result.close(), resolve());
    });
    const blocked = await workspaceStack(unreadable);
    expect(await blocked.workspace.getStatus()).toEqual(expect.objectContaining({ kind: 'IntegrityBlocked', root: 'PossibleRoot' }));
  });

  it('should report onboarding NeedsInstitutionAndAccount until a selectable Account exists, then ReadyForTradePlanning', async () => {
    const stack = await workspaceStack();
    await stack.workspace.initialize({ timeZone: 'America/New_York' });
    const institution = await stack.catalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
    if (institution.kind !== 'Saved') throw new Error('institution not saved');
    expect(await stack.workspace.getStatus()).toEqual(expect.objectContaining({ onboarding: 'NeedsInstitutionAndAccount' }));
    await stack.catalog.save({ kind: 'CreateAccount', institutionId: institution.record.id, label: 'Roth IRA' });
    expect(await stack.workspace.getStatus()).toEqual(expect.objectContaining({ onboarding: 'ReadyForTradePlanning' }));
  });

  it('should leave the content revision unchanged', async () => {
    const stack = await workspaceStack();
    await stack.workspace.initialize({ timeZone: 'America/New_York' });
    const before = await dumpAll(stack.factory);
    const first = await stack.workspace.getStatus();
    const second = await stack.workspace.getStatus();
    expect(await dumpAll(stack.factory)).toEqual(before);
    expect(first.kind === 'Ready' && second.kind === 'Ready' && second.binding).toEqual(first.kind === 'Ready' && first.binding);
    // Status is a reading at one observation instant (Workspace, getStatus).
    expect(first).toEqual(expect.objectContaining({ observedAt: '2026-10-12T14:05:00Z' }));
  });
});

describe('requestDurability', () => {
  it('should return Improved when persist() succeeds after persisted() was false', async () => {
    const stack = await workspaceStack();
    stack.testHost.setProtection({ persisted: false, persistResult: true });
    expect(await stack.workspace.requestDurability()).toEqual({ kind: 'Improved', currentProtection: 'Protected' });
  });

  it('should return AlreadyProtected when persisted() is already true', async () => {
    const stack = await workspaceStack();
    stack.testHost.setProtection({ persisted: true });
    expect(await stack.workspace.requestDurability()).toEqual({ kind: 'AlreadyProtected', currentProtection: 'Protected' });
  });

  it('should return NotImproved(BestEffort) when persist() resolves false and NotImproved(Unavailable) when the API is absent', async () => {
    const stack = await workspaceStack();
    stack.testHost.setProtection({ persisted: false, persistResult: false });
    expect(await stack.workspace.requestDurability()).toEqual({
      kind: 'NotImproved',
      currentProtection: { kind: 'BestEffort', reason: 'HostDeclined' },
    });
    stack.testHost.setProtection({ available: false });
    expect(await stack.workspace.requestDurability()).toEqual({
      kind: 'NotImproved',
      currentProtection: { kind: 'Unavailable', reason: 'NoStorageManager' },
    });
  });

  it('should never change Runtime Readiness', async () => {
    const stack = await workspaceStack();
    await stack.workspace.initialize({ timeZone: 'America/New_York' });
    const before = stack.session.current();
    stack.testHost.setProtection({ persisted: false, persistResult: true });
    await stack.workspace.requestDurability();
    expect(stack.session.current()).toBe(before);
    const status = await stack.workspace.getStatus();
    // Protection is reported honestly after the request, while readiness is untouched.
    expect(status.protection).toBe('Protected');
    expect(status.readiness.outcome).toBe('Writable');
  });
});

describe('Installed Capability Manifest', () => {
  it('should list exactly the public operations and variants through D2, the Long Stock Strategy, the Plan Reflection and Position Change Reflection Entry Types, schema version 2, no backup schema range, and no provider adapters, bound to the release identity', () => {
    expect(installedCapabilities('release-1')).toEqual({
      releaseId: 'release-1',
      operations: {
        'Workspace.initialize': ['FreshWorkspace', 'ExistingWorkspace'],
        'Workspace.getStatus': [],
        'Workspace.requestDurability': [],
        'ReferenceCatalog.save': ['CreateInstitution', 'CreateAccount'],
        'ReferenceCatalog.query': ['Institution', 'Account', 'Strategy'],
        'ReferenceCatalog.resolve': ['NewSelection', 'DisplayOnly'],
        'Journal.getDefinitions': [],
        'Journal.query': ['TradeNarrative'],
        'TradeWorkflows.confirmPlan': ['LongStock'],
        'TradeWorkflows.recordPositionChange': ['Opening', 'Increase', 'Stock', 'SingleTrade', 'Complete', 'Decline'],
        'TradeViewsAndReporting.browseTrades': ['Planned', 'Open'],
        'TradeViewsAndReporting.getTradeDetail': ['Planned', 'Open'],
      },
      strategies: ['strategy.long-stock'],
      entryTypes: ['entry-type.plan-reflection', 'entry-type.position-change-reflection'],
      schemaVersion: 3,
      backupSchemaRange: null,
      providerAdapters: [],
    });
  });
});
