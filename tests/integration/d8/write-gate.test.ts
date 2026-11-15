// I8.14 Write gate (AC-DEL-004): with the inventory check failing, Restore apply is refused through the facade, and
// Persistence refuses to create a Restore candidate and to activate one. Nothing changes.
import { describe, expect, it } from 'vitest';
import { artifactOf, CONFIRM, DECLINE, dumpAll, liveOf, pointerOf, prepared, wtDevice } from './support.ts';

const notWritable = expect.objectContaining({
  kind: 'RuntimeNotWritable',
  failedChecks: expect.arrayContaining([expect.objectContaining({ check: 'inventory' })]) as unknown,
}) as unknown;

describe('I8.14 Write gate', () => {
  it('should return RuntimeNotWritable from applyPreparedRestore through the facade and from Persistence.createRestoreCandidate directly, leaving the pointer and every store unchanged', async () => {
    const { d, app } = await wtDevice();
    const { token } = await prepared(app, artifactOf('backup-v7'));
    const before = await dumpAll(d.factory);

    d.testHost.fail(['inventory']);
    const viaFacade = await app.Workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: DECLINE });
    const created = await app.persistence.createRestoreCandidate();

    expect(viaFacade).toEqual(notWritable);
    expect(created).toEqual(notWritable);
    const after = await dumpAll(d.factory);
    expect(after).toEqual(before);
    expect(pointerOf(after)).toEqual(pointerOf(before));
  }, 60_000);

  it('should return RuntimeNotWritable from Persistence.activateCandidate called directly, leaving the pointer and every store unchanged', async () => {
    const { d, app } = await wtDevice();
    const { token } = await prepared(app, artifactOf('backup-v7'));
    const before = await dumpAll(d.factory);
    const live = liveOf(before);

    d.testHost.fail(['inventory']);
    const direct = await app.persistence.activateCandidate(token.candidateId, live);

    expect(direct).toEqual(notWritable);
    const after = await dumpAll(d.factory);
    expect(after).toEqual(before);
    expect(pointerOf(after)).toEqual(pointerOf(before));
  }, 60_000);
});
