// The composition root (D8 T8.11): the session it builds, with the backup and Restore operations served.
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { backupFile, exportedArtifact } from '../coordinators/workspace/restore-test-support.ts';
import { fixedClock } from '../domain/time/index.ts';
import { createInProcessLifecycleLock } from '../persistence/index.ts';
import { nodeTestHost } from '../../tests/support/node-test-host.ts';
import { dumpAll, TEST_CAPACITY } from '../../tests/support/stack.ts';
import { sequentialIds } from '../../tests/support/workspace.ts';
import { loadDump, type WorkspaceDump } from '../../tools/fixtures/workspace-fixture.ts';
import { createApplication } from './compose.ts';

const W7 = JSON.parse(readFileSync('tests/fixtures/workspace-v7/dump.json', 'utf8')) as WorkspaceDump;

describe('session rechecks after launch (A135, Q10)', () => {
  it('should keep a prepared Restore candidate through a readiness recheck after launch', async () => {
    const backup = await exportedArtifact(await loadDump(W7));
    const factory = new IDBFactory();
    const testHost = await nodeTestHost(factory);
    const app = await createApplication({
      indexedDB: factory,
      host: testHost.host,
      clock: fixedClock('2026-11-21T15:00:00Z'),
      ids: sequentialIds('id'),
      releaseId: testHost.releaseId,
      capacityRequirement: TEST_CAPACITY,
      locks: createInProcessLifecycleLock(),
    });
    const opened = await app.Workspace.initialize({ timeZone: 'America/Chicago' });
    if (opened.kind !== 'Opened') throw new Error(`expected Opened, got ${opened.kind}`);
    const prepared = await app.Workspace.prepareRestore({ file: backupFile(backup.bytes) });
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);

    await app.session.recheck();

    expect(Object.keys(await dumpAll(factory))).toContain(prepared.token.candidateId);
    const applied = await app.Workspace.applyPreparedRestore({ token: prepared.token, confirmation: { kind: 'ReplaceEntireWorkspace' }, safety: { kind: 'DeclinedAfterWarning' } });
    expect(applied.kind).toBe('Restored');
  });
});
