// I2.1–I2.4: migrating the committed schema-1 fixture through Workspace.initialize (D2 A30, P6).
import type { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { compareSnapshot } from '../../../tools/fixtures/snapshot-compare.ts';
import { viewsOf } from '../../../tools/fixtures/workspace-fixture.ts';
import { currentDatabase, dumpAll, launch, rawUpdate, restart, V1_DATABASE, V1_VIEWS, v1Device, type Device } from './support.ts';

type Pointer = { key: string; databaseName?: string; databaseNames?: string[] };

const pointerRecords = async (factory: IDBFactory) => (await dumpAll(factory))['tj-root']!['pointer'] as Pointer[];

// Migrates the v1 fixture on `d` and requires Opened with a migration receipt.
async function migrated(app: Application) {
  const opened = await app.Workspace.initialize({});
  if (opened.kind !== 'Opened' || !opened.receipt.migration) throw new Error(`initialize: ${JSON.stringify(opened)}`);
  return opened;
}

// What a completed migration of the v1 fixture leaves, apart from the minted database name.
async function migratedState(d: Device, app: Application) {
  const status = await app.Workspace.getStatus();
  const dump = await dumpAll(d.factory);
  const databaseName = await currentDatabase(d.factory);
  const stores = dump[databaseName]!;
  return {
    status: status.kind === 'Ready' ? { kind: status.kind, schemaVersion: status.schemaVersion } : status.kind,
    views: await viewsOf(app, 1),
    databases: Object.keys(dump)
      .sort()
      .map((name) => (name === databaseName ? 'current' : name)),
    pointer: (dump['tj-root']!['pointer'] as Pointer[]).map((p) => (p.key === 'current' ? { key: 'current' } : p)),
    reflectionTypes: (stores['journalTypes'] as { productKey: string }[]).filter((t) => t.productKey === 'entry-type.position-change-reflection')
      .length,
    counts: Object.fromEntries(Object.entries(stores).map(([store, records]) => [store, records.length])),
  };
}

// I2.1 run in full: migrate, restart, then describe the result.
async function cleanMigration() {
  const d = await v1Device();
  const opened = await migrated(await launch(d));
  const app = await launch(d);
  return { d, opened, state: await migratedState(d, app) };
}

const receiptWithoutName = (receipt: NonNullable<Awaited<ReturnType<typeof migrated>>['receipt']['migration']>) => ({
  ...receipt,
  databaseName: undefined,
});

describe('I2.1 migrate the v1 fixture', () => {
  it('should open with the migration receipt, then after restart be Ready at schema 2 with the fixture views, the reflection seeded once, and only the new database', async () => {
    const d = await v1Device();
    const app = await launch(d);
    const opened = await migrated(app);
    expect(opened.receipt.migration).toEqual(
      expect.objectContaining({
        fromVersion: 1,
        toVersion: 2,
        sourceDatabase: V1_DATABASE,
        databaseName: expect.stringMatching(/^tj-ws-/) as string,
      }),
    );
    expect(opened.receipt.seeds.journal).toEqual({
      manifestVersion: 2,
      additions: ['entry-type.position-change-reflection', 'source.position-change'],
    });
    const newDatabase = opened.receipt.migration!.databaseName;

    const again = await restart(app, d);
    const status = await again.Workspace.getStatus();
    expect(status.kind === 'Ready' && status.schemaVersion).toBe(2);
    expect(compareSnapshot(await viewsOf(again, 1), V1_VIEWS)).toEqual([]);
    // A second launch seeds nothing more.
    const second = await again.Workspace.initialize({});
    expect(second.kind === 'Opened' && [second.receipt.migration, second.receipt.seeds.journal.additions]).toEqual([undefined, []]);

    const dump = await dumpAll(d.factory);
    const types = dump[newDatabase]!['journalTypes'] as { productKey: string }[];
    expect(types.filter((t) => t.productKey === 'entry-type.position-change-reflection')).toHaveLength(1);
    expect(Object.keys(dump).sort()).toEqual(['tj-root', newDatabase]);
    expect(dump['tj-root']!['pointer']).toEqual(
      expect.arrayContaining([
        { key: 'current', databaseName: newDatabase },
        { key: 'candidates', databaseNames: [] },
        { key: 'retired', databaseNames: [] },
      ]),
    );
  });
});

describe('I2.2 migration failure and retry', () => {
  it('should block naming the unknown Account, leave the old stores and no candidate, never be Ready, then migrate on Retry and be Ready after restart', async () => {
    const d = await v1Device((dump) => {
      dump.databases[V1_DATABASE]!.stores['trades']!.records[0]!['accountId'] = 'fx-unknown';
    });
    const loaded = await dumpAll(d.factory);
    const app = await launch(d);

    const blocked = await app.Workspace.initialize({});
    expect(blocked).toEqual(
      expect.objectContaining({
        kind: 'MigrationBlocked',
        issues: [{ code: 'UnknownAccount', tradeId: 'fx-0009', accountId: 'fx-unknown' }],
      }),
    );
    // The old database's stores; dumpAll records no IndexedDB version, so this is "equal apart from
    // the version". The root gains only an empty candidates list.
    const after = await dumpAll(d.factory);
    expect(after[V1_DATABASE]).toEqual(loaded[V1_DATABASE]);
    expect(Object.keys(after).sort()).toEqual(['tj-root', V1_DATABASE]);
    expect(after['tj-root']!['pointer']).toEqual(expect.arrayContaining([{ key: 'candidates', databaseNames: [] }]));
    expect((await app.Workspace.getStatus()).kind).toBe('MigrationBlocked');

    // The cause is removed, then Retry is initialize again.
    await rawUpdate(d.factory, V1_DATABASE, 'trades', 'fx-0009', (trade) => ({ ...trade, accountId: 'fx-0006' }));
    const retried = await app.Workspace.initialize({});
    expect(retried.kind === 'Opened' && retried.receipt.migration).toEqual(expect.objectContaining({ fromVersion: 1, toVersion: 2 }));
    const again = await restart(app, d);
    expect((await again.Workspace.getStatus()).kind).toBe('Ready');
  });
});

// Stops the application at an interruption point: the named IndexedDB call throws, as if the
// process had ended there. Everything before it happened through production code.
function stoppingFactory(factory: IDBFactory, stopAt: (method: 'open' | 'deleteDatabase', name: string) => boolean): IDBFactory {
  return {
    open(name: string, version?: number) {
      if (stopAt('open', name)) throw new Error(`stopped before opening ${name}`);
      return version === undefined ? factory.open(name) : factory.open(name, version);
    },
    deleteDatabase(name: string) {
      if (stopAt('deleteDatabase', name)) throw new Error(`stopped before deleting ${name}`);
      return factory.deleteDatabase(name);
    },
    databases: () => factory.databases(),
    cmp: (a: unknown, b: unknown) => factory.cmp(a, b),
  };
}

const isCandidate = (name: string) => name.startsWith('tj-ws-') && name !== V1_DATABASE;

describe('I2.3 interrupted migration', () => {
  // The copy is one transaction, so a stop leaves the candidate either empty or holding the copied
  // records without its seeds, validation, repairs, or private rebuild.
  for (const [point, opens] of [
    ['listed and created, before the copy commits', 2],
    ['listed and copied, before seeding and validation', 3],
  ] as const) {
    it(`a: should delete a candidate stopped ${point}, rerun the migration, and equal I2.1`, async () => {
      const d = await v1Device();
      let candidateOpens = 0;
      const stopped = await launch(
        d,
        stoppingFactory(d.factory, (method, name) => method === 'open' && isCandidate(name) && ++candidateOpens === opens),
      );
      await expect(stopped.Workspace.initialize({})).rejects.toThrow(/^stopped/);
      stopped.persistence.close();
      const interrupted = await dumpAll(d.factory);
      const candidate = Object.keys(interrupted).find(isCandidate)!;
      expect(interrupted['tj-root']!['pointer']).toEqual(
        expect.arrayContaining([
          { key: 'current', databaseName: V1_DATABASE },
          { key: 'candidates', databaseNames: [candidate] },
        ]),
      );
      expect(Object.values(interrupted[candidate]!['journalTypes']!)).toHaveLength(opens === 2 ? 0 : 2);

      const app = await launch(d);
      const opened = await migrated(app);
      const reference = await cleanMigration();
      expect(receiptWithoutName(opened.receipt.migration!)).toEqual(receiptWithoutName(reference.opened.receipt.migration!));
      expect(opened.receipt.seeds).toEqual(reference.opened.receipt.seeds);
      const again = await restart(app, d);
      expect(await migratedState(d, again)).toEqual(reference.state);
      expect(Object.keys(await dumpAll(d.factory))).not.toContain(candidate);
    });
  }

  it('b: should delete the retired database stopped after the flip and open Ready without migrating again', async () => {
    const d = await v1Device();
    const stopped = await launch(
      d,
      stoppingFactory(d.factory, (method, name) => method === 'deleteDatabase' && name === V1_DATABASE),
    );
    await expect(stopped.Workspace.initialize({})).rejects.toThrow(/^stopped/);
    stopped.persistence.close();
    const flipped = await currentDatabase(d.factory);
    expect(flipped).not.toBe(V1_DATABASE);
    expect(await pointerRecords(d.factory)).toEqual(expect.arrayContaining([{ key: 'retired', databaseNames: [V1_DATABASE] }]));
    expect(Object.keys(await dumpAll(d.factory))).toContain(V1_DATABASE);

    const app = await launch(d);
    const status = await app.Workspace.getStatus();
    expect(status.kind === 'Ready' && [status.schemaVersion, status.binding.databaseName]).toEqual([2, flipped]);
    const opened = await app.Workspace.initialize({});
    expect(opened.kind === 'Opened' && opened.receipt.migration).toBeUndefined();
    expect(Object.keys(await dumpAll(d.factory)).sort()).toEqual(['tj-root', flipped]);
    expect(await pointerRecords(d.factory)).toEqual(expect.arrayContaining([{ key: 'retired', databaseNames: [] }]));
    expect(compareSnapshot(await viewsOf(app, 1), V1_VIEWS)).toEqual([]);
  });
});

describe('I2.4 concurrent migration', () => {
  it('should run one migration when two applications initialize at once, both Opened on the same schema-2 database', async () => {
    const d = await v1Device();
    const [a, b] = [await launch(d), await launch(d)];
    const results = await Promise.all([a.Workspace.initialize({}), b.Workspace.initialize({})]);
    expect(results.map((r) => r.kind)).toEqual(['Opened', 'Opened']);
    const opened = results.flatMap((r) => (r.kind === 'Opened' ? [r] : []));
    expect(opened.filter((r) => r.receipt.migration !== undefined)).toHaveLength(1);
    const names = opened.map((r) => r.status.binding.databaseName);
    expect(names[0]).toBe(names[1]);
    expect(opened.map((r) => r.status.schemaVersion)).toEqual([2, 2]);
    expect(Object.keys(await dumpAll(d.factory)).sort()).toEqual(['tj-root', names[0]]);
  });
});
