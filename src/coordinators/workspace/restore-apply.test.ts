// Workspace.applyPreparedRestore (D8 T8.9): A7 prepared over W-t, then applied, on fake-indexeddb.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { dumpAll, testStack } from '../../../tests/support/stack.ts';
import { loadDump, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import type { CompletedBackupReceipt, RestoreToken } from './backup-types.ts';
import { createMutationGuard } from '../mutation-guard.ts';
import { backupFile, editedArtifact, exportedArtifact, targetWorkspace, workspaceOf } from './restore-test-support.ts';

const W7 = JSON.parse(readFileSync('tests/fixtures/workspace-v7/dump.json', 'utf8')) as WorkspaceDump;

type Target = Awaited<ReturnType<typeof targetWorkspace>>;

const CONFIRM = { kind: 'ReplaceEntireWorkspace' } as const;

// A7 prepared over the target, and the token that says so.
async function preparedWithPreview(target: { workspace: Target['workspace'] }) {
  const a7 = await exportedArtifact(await loadDump(W7));
  const result = await target.workspace.prepareRestore({ file: backupFile(a7.bytes) });
  if (result.kind !== 'Prepared') throw new Error(`expected Prepared, got ${result.kind}`);
  return result;
}

async function prepared(target: { workspace: Target['workspace'] }): Promise<RestoreToken> {
  return (await preparedWithPreview(target)).token;
}

// A completed backup receipt for the target as it stands now, made through its own Workspace.
async function receiptOf(target: Target): Promise<CompletedBackupReceipt> {
  const exported = await target.workspace.exportBackup({});
  if (exported.kind !== 'Downloaded') throw new Error(`expected Downloaded, got ${exported.kind}`);
  const bytes = target.testHost.downloads.offered.at(-1)!.bytes;
  const confirmed = await target.workspace.confirmBackup({ file: backupFile(bytes), expectedBinding: exported.sourceBinding, expectedFullDigest: exported.fullDigest });
  if (confirmed.kind !== 'Completed') throw new Error(`expected Completed, got ${confirmed.kind}`);
  return confirmed.receipt;
}

const databaseNames = (dump: Awaited<ReturnType<typeof dumpAll>>): string[] => Object.keys(dump).filter((name) => name !== 'tj-root');

describe('preconditions (AC-REST-002, A135)', () => {
  it('should return ConfirmationRequired without ReplaceEntireWorkspace and SafetyBackupRequired with neither a receipt nor an acknowledged decline, writing nothing and keeping the candidate', async () => {
    const target = await targetWorkspace();
    const token = await prepared(target);
    const before = await dumpAll(target.factory);

    const unconfirmed = await target.workspace.applyPreparedRestore({ token, safety: { kind: 'DeclinedAfterWarning' } });
    const unprotected = await target.workspace.applyPreparedRestore({ token, confirmation: CONFIRM });

    expect(unconfirmed).toEqual({ kind: 'ConfirmationRequired', liveBinding: token.targetBinding });
    expect(unprotected).toEqual({ kind: 'SafetyBackupRequired', liveBinding: token.targetBinding });
    expect(await dumpAll(target.factory)).toEqual(before);
    expect(databaseNames(before)).toContain(token.candidateId);
  });

  it('should return SafetyBackupStale for a receipt of W-t taken before one more Account was added, and SafetyBackupNotRecognized for a receipt from another instance, writing nothing', async () => {
    const target = await targetWorkspace();
    const early = await receiptOf(target);
    await addAccount(target, 'Brokerage');
    const token = await prepared(target);
    const before = await dumpAll(target.factory);

    const stale = await target.workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'Receipt', receipt: early } });
    // Another application instance verified a file of the current target: its receipt is exact, but this instance never issued it.
    const other = await receiptOf({ ...target, workspace: workspaceOf(target) });
    const foreign = await target.workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'Receipt', receipt: other } });

    expect(stale).toEqual({ kind: 'SafetyBackupStale', liveBinding: token.targetBinding });
    expect(foreign).toEqual({ kind: 'SafetyBackupNotRecognized', liveBinding: token.targetBinding });
    expect(await dumpAll(target.factory)).toEqual(before);
  });

  it('should return Conflict TargetChanged when W-t changed after preparation, deleting the candidate', async () => {
    const target = await targetWorkspace();
    const token = await prepared(target);
    await addAccount(target, 'Brokerage');
    const before = await dumpAll(target.factory);
    const live = databaseNames(before).find((name) => name !== token.candidateId)!;

    const conflict = await target.workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'DeclinedAfterWarning' } });

    expect(conflict).toEqual({ kind: 'Conflict', reason: 'TargetChanged', liveBinding: { databaseName: live, contentRevision: expect.any(Number) as unknown } });
    if (conflict.kind !== 'Conflict' || conflict.liveBinding === 'NoWorkspace') throw new Error('expected a conflict with a live binding');
    expect(conflict.liveBinding.contentRevision).toBeGreaterThan((token.targetBinding as { contentRevision: number }).contentRevision);
    const after = await dumpAll(target.factory);
    expect(databaseNames(after)).toEqual([live]);
    expect(after[live]).toEqual(before[live]);
    // The candidate is gone, so a second attempt finds no preparation.
    const again = await target.workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'DeclinedAfterWarning' } });
    expect(again).toEqual({ kind: 'PreparationNotFound', liveBinding: conflict.liveBinding });
  });
});

describe('replacement (AC-REST-003)', () => {
  it('should replace W-t with the candidate given a receipt bound to W-t live binding, returning Restored with the receipt, fresh status Ready with readiness evidence from a rerun after activation, and landing RestoreComplete with next destination Trades', async () => {
    const target = await targetWorkspace();
    const events: string[] = [];
    const session = target.session;
    const workspace = workspaceOf(target, {
      session: { ...session, recheck: () => (events.push('recheck'), session.recheck()) },
      persistence: { ...target.persistence, activateCandidate: (...args) => (events.push('activate'), target.persistence.activateCandidate(...args)) },
    });
    const receipt = await receiptOf({ ...target, workspace });
    const { token, preview } = await preparedWithPreview({ workspace });
    const wtDump = await dumpAll(target.factory);
    const wtTradeIds = (wtDump[(token.targetBinding as { databaseName: string }).databaseName]!['trades'] as { tradeId: string }[]).map((trade) => trade.tradeId);
    const heard: unknown[] = [];
    const channel = new BroadcastChannel('tj-updates');
    channel.onmessage = (event: MessageEvent) => void heard.push(event.data);
    events.length = 0;

    const result = await workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'Receipt', receipt } });

    if (result.kind !== 'Restored') throw new Error(`expected Restored, got ${JSON.stringify(result)}`);
    const newBinding = { databaseName: token.candidateId, contentRevision: expect.any(Number) as unknown };
    expect(result.receipt).toEqual({
      artifactDigest: token.fullDigest,
      replacedBinding: token.targetBinding,
      newBinding,
      counts: preview.counts,
      migrations: { steps: [], seedAdditions: [] },
      repairs: [],
      readiness: expect.objectContaining({ outcome: 'Writable' }) as unknown,
    });
    expect(result.status).toMatchObject({ kind: 'Ready', binding: result.receipt.newBinding, timeZone: 'America/New_York', onboarding: 'ReadyForTradePlanning', readiness: result.receipt.readiness });
    expect(result.landing).toEqual({ kind: 'RestoreComplete', next: 'Trades' });
    // The guard, then the switch, then the readiness rerun that the status reports.
    expect(events).toEqual(['recheck', 'activate', 'recheck']);
    await vi.waitFor(() => expect(heard).toEqual([{ kind: 'WorkspaceReplaced', databaseName: token.candidateId }]));
    channel.close();

    // Only the restored database remains: the pointer names it, no candidate or retired entry is left, and no preparation bookkeeping.
    const after = await dumpAll(target.factory);
    expect(databaseNames(after)).toEqual([token.candidateId]);
    const root = after['tj-root']!['pointer'] as { key: string; databaseName?: string; databaseNames?: string[] }[];
    expect(root.find((record) => record.key === 'current')).toMatchObject({ databaseName: token.candidateId });
    expect(root.filter((record) => record.key !== 'current').flatMap((record) => record.databaseNames ?? [])).toEqual([]);
    const live = after[token.candidateId]!;
    expect((live['meta'] as { key: string }[]).map((record) => record.key)).not.toContain('restorePrepared');
    const restoredTradeIds = (live['trades'] as { tradeId: string }[]).map((trade) => trade.tradeId);
    expect(restoredTradeIds).toHaveLength(17);
    expect(restoredTradeIds.filter((id) => wtTradeIds.includes(id))).toEqual([]);
    // A second application with the same token finds the new binding only: nothing is deleted.
    const again = await workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'DeclinedAfterWarning' } });
    expect(again).toEqual({ kind: 'PreparationNotFound', liveBinding: result.receipt.newBinding });
    expect(await dumpAll(target.factory)).toEqual(after);
  });

  it('should replace the Workspace when the prepared candidate carries repairs', async () => {
    const target = await targetWorkspace();
    const a7 = await exportedArtifact(await loadDump(W7));
    // R-lc: T-A (fx-0145, Closed) stored as Open. R-dev: Open Trade fx-0075 with its recorded Entry Size occurrence removed.
    const repairable = editedArtifact(a7.bytes, (artifact) => {
      artifact.lines.forEach((line, index) => {
        if (!line.startsWith('{"r":') || !line.endsWith(',"t":"trades"}')) return;
        const envelope = JSON.parse(line) as { r: Record<string, unknown> };
        if (envelope.r['tradeId'] === 'fx-0145') envelope.r['lifecycle'] = 'Open';
        else if (envelope.r['tradeId'] === 'fx-0075') delete envelope.r['deviations'];
        else return;
        artifact.lines[index] = JSON.stringify(envelope);
      });
    });
    const preparedResult = await target.workspace.prepareRestore({ file: backupFile(repairable) });
    if (preparedResult.kind !== 'Prepared') throw new Error(`expected Prepared, got ${JSON.stringify(preparedResult)}`);

    const result = await target.workspace.applyPreparedRestore({ token: preparedResult.token, confirmation: CONFIRM, safety: { kind: 'DeclinedAfterWarning' } });

    if (result.kind !== 'Restored') throw new Error(`expected Restored, got ${JSON.stringify(result)}`);
    expect(result.receipt.repairs).toEqual(preparedResult.preview.repairs);
    expect(result.receipt.repairs.map((repair) => repair.kind)).toEqual(['EntrySizeDeviation', 'Lifecycle']);
  });

  it('should return CandidateChanged and delete the candidate when the Workspace settings in the candidate changed after preparation', async () => {
    const target = await targetWorkspace();
    const { token } = await preparedWithPreview(target);
    const live = (token.targetBinding as { databaseName: string }).databaseName;
    // Another writer changes the time-zone setting in the candidate, as the preview would no longer describe it.
    await new Promise<void>((resolve, reject) => {
      const open = target.factory.open(token.candidateId);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('meta', 'readwrite');
        const store = tx.objectStore('meta');
        const read = store.get('settings');
        read.onsuccess = () => store.put({ ...(read.result as object), timeZone: 'Asia/Tokyo' });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error('write failed'));
      };
      open.onerror = () => reject(open.error ?? new Error('open failed'));
    });
    const before = await dumpAll(target.factory);

    const result = await target.workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'DeclinedAfterWarning' } });

    expect(result).toEqual({ kind: 'CandidateChanged', store: 'meta', liveBinding: token.targetBinding });
    const after = await dumpAll(target.factory);
    expect(databaseNames(after)).toEqual([live]);
    expect(after[live]).toEqual(before[live]);
    const pointerOf = (dump: typeof after) => (dump['tj-root']!['pointer'] as { key: string }[]).find((record) => record.key === 'current');
    expect(pointerOf(after)).toEqual(pointerOf(before));
  });

  // Rewrites one `meta` record of the candidate, then expects apply to delete the candidate and report CandidateChanged on `meta`.
  async function expectCandidateChangedAfterMetaRewrite(key: string, rewrite: (record: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
    const target = await targetWorkspace();
    const { token } = await preparedWithPreview(target);
    const live = (token.targetBinding as { databaseName: string }).databaseName;
    await new Promise<void>((resolve, reject) => {
      const open = target.factory.open(token.candidateId);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('meta', 'readwrite');
        const store = tx.objectStore('meta');
        const read = store.get(key);
        read.onsuccess = () => store.put(rewrite(read.result as Record<string, unknown>));
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error('write failed'));
      };
      open.onerror = () => reject(open.error ?? new Error('open failed'));
    });
    const before = await dumpAll(target.factory);

    const result = await target.workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'DeclinedAfterWarning' } });

    expect(result).toEqual({ kind: 'CandidateChanged', store: 'meta', liveBinding: token.targetBinding });
    const after = await dumpAll(target.factory);
    expect(databaseNames(after)).toEqual([live]);
    expect(after[live]).toEqual(before[live]);
    const pointerOf = (dump: typeof after) => (dump['tj-root']!['pointer'] as { key: string }[]).find((record) => record.key === 'current');
    expect(pointerOf(after)).toEqual(pointerOf(before));
  }

  it('should return CandidateChanged and delete the candidate when a Workspace settings record in the candidate holds a value that cannot be digested', async () => {
    await expectCandidateChangedAfterMetaRewrite('settings', (record) => ({ ...record, timeZone: undefined }));
  });
});

describe('preparation results held in memory (T8.9-F1)', () => {
  it('should return PreparationNotFound when this instance holds no preparation for the candidate', async () => {
    const target = await targetWorkspace();
    const { token } = await preparedWithPreview(target);
    // Another Workspace instance over the same database never prepared this candidate.
    const other = workspaceOf(target);

    const result = await other.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'DeclinedAfterWarning' } });

    expect(result).toEqual({ kind: 'PreparationNotFound', liveBinding: token.targetBinding });
  });

  it('should not write a preparation record to the candidate', async () => {
    const target = await targetWorkspace();
    const { token } = await preparedWithPreview(target);

    const dump = await dumpAll(target.factory);

    expect((dump[token.candidateId]!['meta'] as { key: string }[]).map((record) => record.key)).not.toContain('restorePrepared');
  });

  it('should name the section whose recheck threw in CandidateChanged', async () => {
    const target = await targetWorkspace();
    const armed: { candidate?: string } = {};
    const unreadable = { [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('unreadable')) }) };
    const workspace = workspaceOf(target, {
      persistence: {
        ...target.persistence,
        candidateSource: (name) => {
          const source = target.persistence.candidateSource(name);
          if (name !== armed.candidate) return source;
          return { batches: (store) => (store === 'trades' ? unreadable : source.batches(store)) };
        },
      },
    });
    const { token } = await preparedWithPreview({ workspace });
    armed.candidate = token.candidateId;

    const result = await workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'DeclinedAfterWarning' } });

    expect(result).toEqual({ kind: 'CandidateChanged', store: 'trades', liveBinding: token.targetBinding });
  });
});

describe('safety choices and first run (AC-REST-002, P33)', () => {
  it('should accept an acknowledged decline instead of a receipt, and apply to an origin with no Workspace with no safety choice', async () => {
    const target = await targetWorkspace();
    const { token } = await preparedWithPreview(target);

    const declined = await target.workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'DeclinedAfterWarning' } });

    expect(declined).toMatchObject({ kind: 'Restored', receipt: { replacedBinding: token.targetBinding, newBinding: { databaseName: token.candidateId } }, landing: { next: 'Trades' } });

    // First run: no Workspace exists, so there is nothing to protect and the Restore adds the pointer.
    const empty = await testStack(new IDBFactory());
    const workspace = workspaceOf(empty);
    const first = await preparedWithPreview({ workspace });

    const restored = await workspace.applyPreparedRestore({ token: first.token, confirmation: CONFIRM });

    if (restored.kind !== 'Restored') throw new Error(`expected Restored, got ${JSON.stringify(restored)}`);
    expect(restored.receipt.replacedBinding).toBe('NoWorkspace');
    expect(restored.receipt.newBinding.databaseName).toBe(first.token.candidateId);
    expect(restored.status).toMatchObject({ kind: 'Ready', binding: restored.receipt.newBinding });
    expect(restored.landing).toEqual({ kind: 'RestoreComplete', next: 'Trades' });
    const after = await dumpAll(empty.factory);
    expect(databaseNames(after)).toEqual([first.token.candidateId]);
    expect((after['tj-root']!['pointer'] as { key: string; databaseName?: string }[]).find((record) => record.key === 'current')).toMatchObject({ databaseName: first.token.candidateId });
  });
});

describe('first run activation outcomes (T8.9-F1-B1, T8.15-B1)', () => {
  // A first run whose persistence answers the activation as given, the candidate otherwise prepared as usual.
  async function firstRunWith(activate: () => Promise<{ kind: 'AlreadyInitialized'; databaseName: string }>) {
    const empty = await testStack(new IDBFactory());
    const persistence = { ...empty.persistence, activateFirstCandidate: activate } as typeof empty.persistence;
    const workspace = workspaceOf(empty, { persistence });
    const { token } = await preparedWithPreview({ workspace });
    return { empty, workspace, token };
  }

  it('should drop the held preparation when the first run finds the journal already initialized', async () => {
    const { workspace, token } = await firstRunWith(() => Promise.resolve({ kind: 'AlreadyInitialized', databaseName: 'other-tab' }));

    const first = await workspace.applyPreparedRestore({ token, confirmation: CONFIRM });
    const again = await workspace.applyPreparedRestore({ token, confirmation: CONFIRM });

    expect(first).toMatchObject({ kind: 'AlreadyInitialized', databaseName: 'other-tab' });
    expect(again).toMatchObject({ kind: 'PreparationNotFound' });
  });

  it('should discard the candidate when the first run activation throws', async () => {
    const { empty, workspace, token } = await firstRunWith(() => Promise.reject(new Error('activation failed')));

    await expect(workspace.applyPreparedRestore({ token, confirmation: CONFIRM })).rejects.toThrow('activation failed');
    const again = await workspace.applyPreparedRestore({ token, confirmation: CONFIRM });

    expect(databaseNames(await dumpAll(empty.factory))).toEqual([]);
    expect(again).toMatchObject({ kind: 'PreparationNotFound' });
  });
});

describe('replacement through the real readiness session (T8.9-B2)', () => {
  it('should return Restored when a prepared Restore is applied through the stack readiness session, whose rechecks keep the candidate', async () => {
    const target = await targetWorkspace();
    const workspace = workspaceOf(target, { session: target.session });
    const { token } = await preparedWithPreview({ workspace });

    const result = await workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'DeclinedAfterWarning' } });

    expect(result.kind).toBe('Restored');
  });
});

describe('readiness after Restore (AC-DEL-006)', () => {
  it('should return Restored with status RecoveryOnly when the readiness rerun after activation fails, so the next mutation returns RuntimeNotWritable', async () => {
    const target = await targetWorkspace();
    const session = target.session;
    // The browser stops saving safely just after the pointer switches.
    const workspace = workspaceOf(target, {
      session,
      persistence: {
        ...target.persistence,
        activateCandidate: async (...args) => {
          const activated = await target.persistence.activateCandidate(...args);
          target.testHost.fail(['capacity']);
          return activated;
        },
      },
    });
    const { token } = await preparedWithPreview({ workspace });

    const result = await workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'DeclinedAfterWarning' } });

    if (result.kind !== 'Restored') throw new Error(`expected Restored, got ${JSON.stringify(result)}`);
    expect(result.receipt.readiness).toMatchObject({ outcome: 'RecoveryOnly', failures: [{ check: 'capacity' }] });
    expect(result.status).toMatchObject({ kind: 'RecoveryOnly', failedChecks: [{ check: 'capacity' }], binding: result.receipt.newBinding });
    expect(result.landing).toEqual({ kind: 'RestoreComplete', next: 'Trades' });
    const refused = await createMutationGuard(session).run('Catalog.save', () => target.catalog.save({ kind: 'CreateInstitution', label: 'Schwab' }));
    expect(refused).toMatchObject({ kind: 'RuntimeNotWritable', failedChecks: [{ check: 'capacity' }] });
  });

  it('should still return Restored when a step after activation throws, with status RecoveryOnly', async () => {
    const target = await targetWorkspace();
    // Just after the pointer switches, the browser stops saving safely and announcing the replacement to other tabs throws.
    class FailingChannel {
      constructor() {
        target.testHost.fail(['capacity']);
        throw new Error('the replacement could not be announced');
      }
    }
    const { token } = await preparedWithPreview(target);
    vi.stubGlobal('BroadcastChannel', FailingChannel);
    let result;
    try {
      result = await target.workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'DeclinedAfterWarning' } });
    } finally {
      vi.unstubAllGlobals();
    }

    if (result.kind !== 'Restored') throw new Error(`expected Restored, got ${JSON.stringify(result)}`);
    expect(result.status).toMatchObject({ kind: 'RecoveryOnly', failedChecks: [{ check: 'capacity' }], binding: result.receipt.newBinding });
    const pointer = (await dumpAll(target.factory))['tj-root']!['pointer'] as { key: string; databaseName?: string }[];
    expect(pointer.find((record) => record.key === 'current')).toMatchObject({ databaseName: token.candidateId });
  });
});

// Removes one record from a database with the raw API, as another writer touching the candidate would.
async function removeRecord(factory: IDBFactory, database: string, store: string): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = factory.open(database);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const cursor = tx.objectStore(store).openCursor();
    cursor.onsuccess = () => void cursor.result?.delete();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('delete failed'));
  });
  db.close();
}

describe('a candidate changed after preparation (A135)', () => {
  it('should leave the pointer and W-t unchanged and delete the candidate when one module recheck returns CandidateChanged', async () => {
    const target = await targetWorkspace();
    const { token } = await preparedWithPreview(target);
    const live = (token.targetBinding as { databaseName: string }).databaseName;
    await removeRecord(target.factory, token.candidateId, 'journalEntries');
    const before = await dumpAll(target.factory);

    const result = await target.workspace.applyPreparedRestore({ token, confirmation: CONFIRM, safety: { kind: 'DeclinedAfterWarning' } });

    expect(result).toEqual({ kind: 'CandidateChanged', store: 'journalEntries', liveBinding: token.targetBinding });
    const after = await dumpAll(target.factory);
    expect(databaseNames(after)).toEqual([live]);
    expect(after[live]).toEqual(before[live]);
    const pointerOf = (dump: typeof after) => (dump['tj-root']!['pointer'] as { key: string }[]).find((record) => record.key === 'current');
    expect(pointerOf(after)).toEqual(pointerOf(before));
    expect((after['tj-root']!['pointer'] as { key: string; databaseNames?: string[] }[]).flatMap((record) => record.databaseNames ?? [])).toEqual([]);
  });

});

// One more Account in the target, so that its content revision moves on.
async function addAccount(target: Target, label: string): Promise<void> {
  const institutions = await target.catalog.query({ family: 'Institution' });
  if (institutions.kind !== 'Page') throw new Error('no institutions');
  const saved = await target.catalog.save({ kind: 'CreateAccount', institutionId: institutions.items[0]!.id, label });
  if (saved.kind !== 'Saved') throw new Error(`account not saved: ${saved.kind}`);
}
