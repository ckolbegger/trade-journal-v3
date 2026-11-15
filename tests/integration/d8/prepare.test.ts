// I8.6 Preparation is nonmutating (AC-REST-001): previews for valid and older artifacts, typed aggregated issues for the
// rest, W-t untouched after every call, no candidate left after a restart, and no network request.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { artifactOf, dumpAll, editedArtifact, lineOf, liveOf, pointerOf, prepare, restart, wtDevice } from './support.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('I8.6 Preparation is nonmutating', () => {
  it('should prepare A7 and A5b with previews, reject R-bad, R-flip, R-cut and R-new with typed issues, leave W-t binding and stores unchanged after every call, leave no candidate after a restart, and make no network request', async () => {
    const { d, app } = await wtDevice();
    const a7 = artifactOf('backup-v7');
    const status = await app.Workspace.getStatus();
    if (status.kind !== 'Ready') throw new Error(`getStatus: ${status.kind}`);
    const startDump = await dumpAll(d.factory);
    const live = liveOf(startDump);
    // The network, as the request-counting host sees it: any fetch at all.
    const requests = vi.spyOn(globalThis, 'fetch');

    const flipped = editedArtifact(a7, (artifact) => {
      artifact.keepDigests = true;
      const at = lineOf(artifact.lines, 'trades');
      artifact.lines[at] = artifact.lines[at]!.replace(/"thesis":"(.)/, (_match, first: string) => `"thesis":"${first === 'Z' ? 'Y' : 'Z'}`);
    });
    const bad = editedArtifact(a7, (artifact) => {
      artifact.lines[lineOf(artifact.lines, 'catalog')] = '{"r":this is not json';
      const at = lineOf(artifact.lines, 'trades');
      const record = JSON.parse(artifact.lines[at]!) as { r: { facts: { kind: string; versions: { value: Record<string, unknown> }[] }[] } };
      delete record.r.facts.find((fact) => fact.kind === 'Plan')!.versions[0]!.value['economicTime'];
      artifact.lines[at] = JSON.stringify(record);
    });
    const newer = editedArtifact(a7, (artifact) => {
      artifact.lines[0] = JSON.stringify({ ...(JSON.parse(artifact.lines[0]!) as Record<string, unknown>), schemaVersion: 8 });
    });

    // After each call: W-t's binding and every store of W-t, and the pointer, are as they were.
    const candidates: string[] = [];
    const untouched = async () => {
      const after = await dumpAll(d.factory);
      expect(after[live]).toEqual(startDump[live]);
      expect(pointerOf(after).filter((record) => (record as { key: string }).key === 'current')).toEqual(pointerOf(startDump).filter((record) => (record as { key: string }).key === 'current'));
      expect(Object.keys(after).filter((name) => name !== 'tj-root' && name !== live).every((name) => candidates.includes(name))).toBe(true);
      const now = await app.Workspace.getStatus();
      expect(now.kind === 'Ready' && now.binding).toEqual(status.binding);
    };

    const valid = await prepare(app, a7);
    if (valid.kind !== 'Prepared') throw new Error(`prepareRestore A7: ${JSON.stringify(valid)}`);
    candidates.push(valid.token.candidateId);
    expect(valid.preview).toMatchObject({ source: { schemaVersion: 7, exportKind: 'Normal' }, migrations: { steps: [] }, repairs: [], safetyChoiceRequired: true });
    await untouched();

    const rejections = [
      [bad, [{ code: 'MalformedRecord' }, { code: 'MalformedRecord' }], 2],
      [flipped, [{ code: 'DigestMismatch', section: 'trades' }], 1],
      [a7.slice(0, a7.length / 2), [{ code: 'IncompleteArtifact' }], 1],
      [newer, [{ code: 'UnsupportedNewerSchema' }], 1],
    ] as const;
    for (const [bytes, issues, total] of rejections) {
      const result = await prepare(app, bytes);
      expect(result).toMatchObject({ kind: 'Rejected', issues, totalIssues: total, liveBinding: status.binding });
      await untouched();
    }

    const older = await prepare(app, artifactOf('backup-v5-blocked'));
    if (older.kind !== 'Prepared') throw new Error(`prepareRestore A5b: ${JSON.stringify(older)}`);
    candidates.push(older.token.candidateId);
    expect(older.preview.migrations.steps).toEqual([{ from: 5, to: 6 }, { from: 6, to: 7 }]);
    expect(older.preview.warnings).toContain('OlderSchema');
    await untouched();
    expect(requests).not.toHaveBeenCalled();

    // After a restart no candidate database exists, and the root lists none.
    const again = await restart(app, d);
    const restarted = await dumpAll(d.factory);
    expect(Object.keys(restarted).sort()).toEqual(['tj-root', live].sort());
    expect(restarted[live]).toEqual(startDump[live]);
    expect(pointerOf(restarted)).toEqual(expect.arrayContaining([{ key: 'candidates', databaseNames: [] }]));
    const final = await again.Workspace.getStatus();
    expect(final.kind === 'Ready' && final.binding).toEqual(status.binding);
    expect(requests).not.toHaveBeenCalled();
  }, 120_000);
});
