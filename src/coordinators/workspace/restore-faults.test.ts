// The Restore stage hooks the faults build uses (D8 T8.15): each acts only when a hook is supplied.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { dumpAll, testStack } from '../../../tests/support/stack.ts';
import { loadDump, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import { backupFile, exportedArtifact, targetWorkspace, workspaceOf } from './restore-test-support.ts';
import type { RestoreStageHooks } from './restore.ts';

const W7 = JSON.parse(readFileSync('tests/fixtures/workspace-v7/dump.json', 'utf8')) as WorkspaceDump;
const CONFIRM = { kind: 'ReplaceEntireWorkspace' } as const;
const DECLINE = { kind: 'DeclinedAfterWarning' } as const;

async function a7() {
  return exportedArtifact(await loadDump(W7));
}

// `held` settles only when `open` is called; `entered` settles when the hook calls `enter`, so a test waits for the hook, not a timer.
function gate() {
  let open: () => void = () => undefined;
  let enter: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (open = resolve));
  const entered = new Promise<void>((resolve) => (enter = resolve));
  return { held, open, entered, enter };
}

// Waits for the hook to be reached, then gives `pending` a short bounded chance to finish: false when it is still waiting.
// The wait only bounds the negative check; the hook being reached is awaited by event, so a slow machine cannot fail the test.
async function finishedAfter(entered: Promise<void>, pending: Promise<unknown>) {
  await entered;
  return Promise.race([pending.then(() => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500))]);
}

describe('Restore stage hooks (T8.15)', () => {
  it('should return CandidateChanged naming the store when the recheck hook names a store of the module, leaving the live database and no candidate', async () => {
    const hooks: RestoreStageHooks = { recheck: (stores) => stores.find((store) => store === 'journalEntries') };
    const target = await targetWorkspace();
    const workspace = workspaceOf(target, { restoreHooks: hooks });
    const prepared = await workspace.prepareRestore({ file: backupFile((await a7()).bytes) });
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
    const before = await dumpAll(target.factory);
    const live = (prepared.token.targetBinding as { databaseName: string }).databaseName;

    const result = await workspace.applyPreparedRestore({ token: prepared.token, confirmation: CONFIRM, safety: DECLINE });

    expect(result).toMatchObject({ kind: 'CandidateChanged', store: 'journalEntries' });
    const after = await dumpAll(target.factory);
    expect(Object.keys(after).filter((name) => name !== 'tj-root')).toEqual([live]);
    expect(after[live]).toEqual(before[live]);
  });

  it('should abort the root activation transaction when the activating hook throws, keeping the pointer and discarding the candidate', async () => {
    const hooks: RestoreStageHooks = {
      activating: () => {
        throw new Error('injected fault: restore:activate');
      },
    };
    const target = await targetWorkspace();
    const workspace = workspaceOf(target, { restoreHooks: hooks });
    const prepared = await workspace.prepareRestore({ file: backupFile((await a7()).bytes) });
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
    const live = (prepared.token.targetBinding as { databaseName: string }).databaseName;

    await expect(workspace.applyPreparedRestore({ token: prepared.token, confirmation: CONFIRM, safety: DECLINE })).rejects.toThrow('aborted');

    const after = await dumpAll(target.factory);
    expect(Object.keys(after).filter((name) => name !== 'tj-root')).toEqual([live]);
    expect(await target.persistence.lookupRoot()).toMatchObject({ kind: 'KnownWorkspace', databaseName: live });
  });

  it('should abort the first-run activation too, so no pointer is added', async () => {
    const hooks: RestoreStageHooks = {
      activating: () => {
        throw new Error('injected fault: restore:activate');
      },
    };
    const empty = await testStack(new IDBFactory());
    const workspace = workspaceOf(empty, { restoreHooks: hooks });
    const prepared = await workspace.prepareRestore({ file: backupFile((await a7()).bytes) });
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);

    await expect(workspace.applyPreparedRestore({ token: prepared.token, confirmation: CONFIRM })).rejects.toThrow();

    expect((await empty.persistence.lookupRoot()).kind).not.toBe('KnownWorkspace');
  });

  it('should wait in preparation after staging the records until the staged hook resolves', async () => {
    const { held, open, entered, enter } = gate();
    const hooks: RestoreStageHooks = {
      staged: () => {
        enter();
        return held;
      },
    };
    const target = await targetWorkspace();
    const workspace = workspaceOf(target, { restoreHooks: hooks });
    const pending = workspace.prepareRestore({ file: backupFile((await a7()).bytes) });

    expect(await finishedAfter(entered, pending)).toBe(false);
    const names = (await dumpAll(target.factory));
    expect(Object.keys(names).filter((name) => name !== 'tj-root')).toHaveLength(2);

    open();
    expect((await pending).kind).toBe('Prepared');
  });

  it('should wait in apply after the pointer switch and before the readiness rerun until the activated hook resolves', async () => {
    const { held, open, entered, enter } = gate();
    const hooks: RestoreStageHooks = {
      activated: () => {
        enter();
        return held;
      },
    };
    const target = await targetWorkspace();
    const workspace = workspaceOf(target, { restoreHooks: hooks });
    const prepared = await workspace.prepareRestore({ file: backupFile((await a7()).bytes) });
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${prepared.kind}`);
    const pending = workspace.applyPreparedRestore({ token: prepared.token, confirmation: CONFIRM, safety: DECLINE });

    expect(await finishedAfter(entered, pending)).toBe(false);
    expect(await target.persistence.lookupRoot()).toMatchObject({ kind: 'KnownWorkspace', databaseName: prepared.token.candidateId });

    open();
    expect((await pending).kind).toBe('Restored');
  });
});
