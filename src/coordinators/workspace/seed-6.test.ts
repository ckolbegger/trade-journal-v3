// T95.28: Journal seed manifest 6 reaches a Workspace by every route (D9.5 P173, A321, A323): a version-5
// Workspace on its next start, a new Workspace, a restored backup and a backup made afterwards.
import { describe, expect, it } from 'vitest';
import { D6_JOURNAL_MANIFEST } from '../../modules/journal/index.ts';
import { fixtureDevice } from '../../../tests/integration/d7s/support.ts';
import { artifactOf, CONFIRM, DECLINE, dumpAll, dumpOf, emptyDevice, exportBackup, launch, linesOf, prepared, w7Device, wtDevice } from '../../../tests/integration/d8/support.ts';

const REVISED = ['entry-type.close-review', 'entry-type.daily-trade-review', 'entry-type.position-change-reflection'];
type Dump = Awaited<ReturnType<typeof dumpAll>>;
type Definition = { id: string; entryTypeKey: string; revisionNumber: number; prompts: unknown };

const storesOf = (dump: Dump): Record<string, unknown[]> => {
  const [name] = Object.keys(dump).filter((n) => n.startsWith('tj-ws-'));
  return dump[name!] as Record<string, unknown[]>;
};
const definitionsOf = (dump: Dump) => storesOf(dump)['journalDefinitions'] as Definition[];
const formOf = (key: string) => D6_JOURNAL_MANIFEST.entryTypes.find((t) => t.productKey === key)!.prompts;

describe('Journal seed manifest 6 delivery', () => {
  it('should give a Workspace seeded at version 5 the three revisions on its next start, and nothing else', async () => {
    const d = await w7Device();
    const before = await dumpAll(d.factory);
    const app = await launch(d);
    const opened = await app.Workspace.initialize({});
    if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
    const after = await dumpAll(d.factory);

    const stored = new Set(definitionsOf(before).map((definition) => definition.id));
    const added = definitionsOf(after).filter((definition) => !stored.has(definition.id));
    expect(added.map((definition) => definition.entryTypeKey).sort()).toEqual(REVISED);
    for (const definition of added) {
      const latestBefore = Math.max(...definitionsOf(before).filter((b) => b.entryTypeKey === definition.entryTypeKey).map((b) => b.revisionNumber));
      expect(definition.revisionNumber).toBe(latestBefore + 1);
      expect(definition.prompts).toEqual(formOf(definition.entryTypeKey));
    }
    // Every other store is as it was; the Journal's revision counter is the one thing the seed moves.
    const rest = (dump: Dump) => Object.fromEntries(Object.entries(storesOf(dump)).filter(([store]) => store !== 'journalDefinitions' && store !== 'meta'));
    expect(rest(after)).toEqual(rest(before));
  }, 60_000);

  it('should name version 6 and the three revised types in the receipt', async () => {
    const app = await launch(await w7Device());
    const opened = await app.Workspace.initialize({});
    if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
    expect(opened.receipt.seeds.journal.manifestVersion).toBe(6);
    expect([...opened.receipt.seeds.journal.additions].sort()).toEqual(REVISED);
  }, 60_000);

  it('should name the three revised types in the receipt of a Workspace migrated from schema 6', async () => {
    const app = await launch(await fixtureDevice(6));
    const opened = await app.Workspace.initialize({});
    if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
    expect(opened.receipt.migration?.fromVersion).toBe(6);
    expect([...opened.receipt.seeds.journal.additions].sort()).toEqual(REVISED);
  }, 60_000);

  it('should seed a new Workspace at version 6', async () => {
    const d = await emptyDevice();
    const app = await launch(d);
    const opened = await app.Workspace.initialize({ timeZone: 'America/New_York' });
    if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
    expect(opened.receipt.seeds.journal.manifestVersion).toBe(6);
    const definitions = definitionsOf(await dumpAll(d.factory));
    for (const key of REVISED) {
      const own = definitions.filter((definition) => definition.entryTypeKey === key);
      expect(own.map((definition) => definition.revisionNumber)).toEqual([1]);
      expect(own[0]!.prompts).toEqual(formOf(key));
    }
  }, 60_000);

  it('should give a restored version-5 backup the three revisions', async () => {
    const { d, app } = await wtDevice();
    const { token } = await prepared(app, artifactOf('backup-v7'));
    const restored = await app.Workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: DECLINE });
    if (restored.kind !== 'Restored') throw new Error(`applyPreparedRestore: ${JSON.stringify(restored)}`);

    const inBackup = Object.values(dumpOf('workspace-v7').databases).flatMap((db) => (db.stores['journalDefinitions']?.records ?? []) as unknown as Definition[]);
    const restoredDefinitions = definitionsOf(await dumpAll(d.factory));
    expect(restoredDefinitions).toHaveLength(inBackup.length + REVISED.length);
    for (const key of REVISED) {
      const own = restoredDefinitions.filter((definition) => definition.entryTypeKey === key).sort((a, b) => a.revisionNumber - b.revisionNumber);
      expect(own.at(-1)!.prompts).toEqual(formOf(key));
      expect(own.at(-1)!.revisionNumber).toBe(inBackup.filter((definition) => definition.entryTypeKey === key).length + 1);
    }
  }, 120_000);

  it('should keep an Action saved under the earlier form readable as it was saved', async () => {
    const stored = Object.values(dumpOf('workspace-v7').databases).flatMap((db) => (db.stores['journalEntries']?.records ?? []) as unknown as { entryTypeKey: string; anchor: { tradeId: string } }[]);
    const saved = stored.find((entry) => entry.entryTypeKey === 'entry-type.daily-trade-review');
    if (!saved) throw new Error('workspace-v7 holds no Daily Trade Review');
    const app = await launch(await w7Device());
    const narrative = { scope: 'TradeNarrative', tradeId: saved.anchor.tradeId } as const;
    const before = await app.Journal.query(narrative);
    const opened = await app.Workspace.initialize({});
    if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);

    const after = await app.Journal.query(narrative);
    expect(JSON.stringify(after)).toContain('Why are you taking this action?');
    // Only the Journal's revision counter moved with the seed; every saved answer reads as it did.
    expect(JSON.stringify(after).replace(/"journalRevision":\d+/, '')).toBe(JSON.stringify(before).replace(/"journalRevision":\d+/, ''));
  }, 60_000);

  it('should give a revised form the same identity whichever route seeds it', async () => {
    const opened = await w7Device();
    await launch(opened).then((app) => app.Workspace.initialize({}));
    const { d, app } = await wtDevice();
    const { token } = await prepared(app, artifactOf('backup-v7'));
    await app.Workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: DECLINE });

    const revised = (dump: Dump) => definitionsOf(dump).filter((definition) => definition.revisionNumber > 1 && REVISED.includes(definition.entryTypeKey)).map((definition) => [definition.entryTypeKey, definition.revisionNumber, definition.id]).sort();
    const stored = new Set(Object.values(dumpOf('workspace-v7').databases).flatMap((db) => ((db.stores['journalDefinitions']?.records ?? []) as unknown as Definition[]).map((definition) => definition.id)));
    const fromStart = revised(await dumpAll(opened.factory)).filter(([, , id]) => !stored.has(id as string));
    expect(fromStart).toHaveLength(3);
    expect(revised(await dumpAll(d.factory)).filter(([, , id]) => !stored.has(id as string))).toEqual(fromStart);
  }, 120_000);

  it('should name Journal seed version 6 in a backup made afterwards, and still read a version-5 backup as 5', async () => {
    const journalSeedOf = (bytes: Uint8Array) => {
      const record = linesOf(bytes).find((line) => line.startsWith('{"r":'));
      return (JSON.parse(record!) as { r: { seedManifestVersions: { journal: number } } }).r.seedManifestVersions.journal;
    };
    const d = await w7Device();
    const app = await launch(d);
    // The Workspace says which manifest it holds: before its next start it still holds 5, as the committed backup says.
    expect(journalSeedOf((await exportBackup(app, d)).bytes)).toBe(5);
    expect(journalSeedOf(artifactOf('backup-v7'))).toBe(5);
    expect((await prepared(app, artifactOf('backup-v7'))).preview.source.schemaVersion).toBe(7);

    const opened = await app.Workspace.initialize({});
    if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
    expect(journalSeedOf((await exportBackup(app, d)).bytes)).toBe(6);
  }, 120_000);
});
