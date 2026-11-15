// AC-RESP-001 for Restore (I8.9, second half): the Restored result alone carries the fresh status and the landing, so the
// caller reads nothing more to show where to go.
import { describe, expect, it } from 'vitest';
import { artifactOf, CONFIRM, DECLINE, prepared, wtDevice } from './support.ts';

describe('I8.9 Atomicity, responses', () => {
  it('should carry the Ready status of the restored Workspace, its time zone, onboarding and readiness, and the Trades landing in the one Restored result', async () => {
    const { app } = await wtDevice();
    const { token } = await prepared(app, artifactOf('backup-v7'));

    const restored = await app.Workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: DECLINE });

    if (restored.kind !== 'Restored') throw new Error(`applyPreparedRestore: ${JSON.stringify(restored)}`);
    expect(restored.status).toMatchObject({
      kind: 'Ready',
      binding: restored.receipt.newBinding,
      timeZone: 'America/New_York',
      onboarding: 'ReadyForTradePlanning',
      schemaVersion: 7,
    });
    expect(restored.receipt.readiness).toMatchObject({ outcome: 'Writable', failures: [] });
    expect(restored.landing).toEqual({ kind: 'RestoreComplete', next: 'Trades' });
  }, 60_000);
});
