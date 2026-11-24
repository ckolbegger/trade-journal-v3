// I8.11 First-run Restore: an empty browser offers Restore from a backup, and the Restore needs no safety choice.
import { describe, expect, it } from 'vitest';
import { artifactOf, capture, CONFIRM, dumpAll, emptyDevice, EXPORT_AT, launch, liveOf, marksIn, prepared, restart, w7Device } from './support.ts';

describe('I8.11 First-run Restore', () => {
  it('should offer RestoreFromBackup at InitializationRequired, prepare A7 with target NoWorkspace and no safety choice, restore it landing on Trades, and be Ready after restart with A7 time zone and views equal to those of W7', async () => {
    // The views of W7 itself, as I8.1 captures them.
    const source = await w7Device();
    const sourceApp = await launch(source);
    // W7 is seeded at manifest 5; its next start gives it manifest 6's forms, as a Restore does.
    await sourceApp.Workspace.initialize({});
    const sourceDump = await dumpAll(source.factory);
    const marks = marksIn(sourceDump[liveOf(sourceDump)]!);
    const expected = await capture(sourceApp, EXPORT_AT, marks);

    const d = await emptyDevice();
    const app = await launch(d);
    const status = await app.Workspace.getStatus();
    expect(status).toMatchObject({ kind: 'InitializationRequired', backupActions: ['RestoreFromBackup'] });

    const { token, preview } = await prepared(app, artifactOf('backup-v7'));
    expect(token.targetBinding).toBe('NoWorkspace');
    expect(preview.target).toMatchObject({ hasUserData: false, counts: null, currentTimeZone: null, restoredTimeZone: 'America/New_York' });
    expect(preview.safetyChoiceRequired).toBe(false);

    const restored = await app.Workspace.applyPreparedRestore({ token, confirmation: CONFIRM });
    expect(restored).toMatchObject({ kind: 'Restored', receipt: { replacedBinding: 'NoWorkspace' }, landing: { kind: 'RestoreComplete', next: 'Trades' } });

    const again = await restart(app, d);
    const after = await again.Workspace.getStatus();
    expect(after).toMatchObject({ kind: 'Ready', timeZone: 'America/New_York' });
    expect(await capture(again, EXPORT_AT, marks)).toEqual(expected);
  }, 120_000);
});
