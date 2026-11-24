// I95.9 The Journal seed 6 and Restore (AC-BACK-001, AC-REST-001): the backup-v7 fixture, a backup of Journal seed 5, restores and receives the three revisions;
// a backup made afterwards names seed 6 and restores to equal views.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import {
  artifactOf, capture, CONFIRM, DECLINE, dumpAll, dumpOf, emptyDevice, EXPORT_AT, exportBackup, launch, liveOf, linesOf, marksIn, prepared, restart, type Device,
} from '../d8/support.ts';
import { CONTRACT, definitionsOf, latestForm, REVISED, shapeOf } from './seed-support.ts';

// A backup's Journal seed version, as its Workspace section names it.
function journalSeedOf(bytes: Uint8Array): number {
  const record = linesOf(bytes).find((line) => line.startsWith('{"r":'));
  return (JSON.parse(record!) as { r: { seedManifestVersions: { journal: number } } }).r.seedManifestVersions.journal;
}

// Restores a backup into an empty device and returns the restarted application.
async function restoredFrom(bytes: Uint8Array): Promise<{ d: Device; app: Application }> {
  const d = await emptyDevice();
  const first = await launch(d);
  const { token } = await prepared(first, bytes);
  const applied = await first.Workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: DECLINE });
  if (applied.kind !== 'Restored') throw new Error(`applyPreparedRestore: ${JSON.stringify(applied)}`);
  return { d, app: await restart(first, d) };
}

describe('I95.9 The seed after a Restore (AC-REST-001, AC-BACK-001)', () => {
  it('should restore the backup-v7 fixture and give it exactly the three revisions, each equal to the Journal contract', { timeout: 120_000 }, async () => {
    expect(journalSeedOf(artifactOf('backup-v7'))).toBe(5);
    const inBackup = Object.values(dumpOf('workspace-v7').databases).flatMap((db) => (db.stores['journalDefinitions']?.records ?? []) as unknown as { id: string; entryTypeKey: string; revisionNumber: number }[]);

    const { d, app } = await restoredFrom(artifactOf('backup-v7'));

    const restored = definitionsOf(await dumpAll(d.factory));
    const known = new Set(inBackup.map((definition) => definition.id));
    const added = restored.filter((definition) => !known.has(definition.id));
    // Catches a Restore that leaves a version-5 form in place, or revises another type: three new revisions, one for each revised type.
    expect(added.map((definition) => definition.entryTypeKey).sort()).toEqual(REVISED);
    expect(restored).toHaveLength(inBackup.length + 3);
    for (const key of REVISED) expect(shapeOf((await latestForm(app, key)).prompts)).toEqual(CONTRACT[key]);
  });

  it('should keep an owed reflection of the backup on the form it was owed under after the Restore', { timeout: 120_000 }, async () => {
    const stored = Object.values(dumpOf('workspace-v7').databases).flatMap((db) => (db.stores['journalDebts']?.records ?? []) as unknown as { debtId: string; entryTypeKey: string; definitionId: string; versions: { status: string }[] }[]);
    const owed = stored.find((debt) => debt.entryTypeKey === 'entry-type.position-change-reflection' && debt.versions.at(-1)!.status === 'Outstanding');
    if (!owed) throw new Error('backup-v7 owes no Position Change Reflection');

    const { app } = await restoredFrom(artifactOf('backup-v7'));

    const page = await app.Journal.query({ scope: 'OutstandingDebt' });
    if (!('debts' in page)) throw new Error('no debts page');
    // Catches a Restore that re-pins a Debt to the new revision: it keeps its own form and asks for nothing more.
    expect(page.debts.find((debt) => debt.debtId === owed.debtId)).toMatchObject({ definitionId: owed.definitionId });
    expect(page.debts.find((debt) => debt.debtId === owed.debtId)).not.toHaveProperty('requires');
  });

  it('should name Journal seed 6 in a backup made after the Restore and restore it to equal views', { timeout: 180_000 }, async () => {
    const { d, app } = await restoredFrom(artifactOf('backup-v7'));
    const marks = marksIn((await dumpAll(d.factory))[liveOf(await dumpAll(d.factory))]!);
    const before = await capture(app, EXPORT_AT, marks);

    const exported = await exportBackup(app, d);
    const again = await restoredFrom(exported.bytes);

    // Catches a backup that still names the earlier seed, and a restore whose views, Review included, differ from the Workspace it was made from.
    expect(journalSeedOf(exported.bytes)).toBe(6);
    expect(await capture(again.app, EXPORT_AT, marks)).toEqual(before);
    expect(definitionsOf(await dumpAll(again.d.factory)).map((definition) => definition.id).sort()).toEqual(definitionsOf(await dumpAll(d.factory)).map((definition) => definition.id).sort());
  });
});
