// I8.2 Concurrent mutation, I8.3 Exclusions and I8.4 Backup failures (AC-BACK-001, AC-DEL-005).
import { describe, expect, it } from 'vitest';
import { closeReasonId, complete, optionCommand, optionExecution } from '../d7/support.ts';
import {
  artifactOf, dumpAll, dumpOf, editedArtifact, exportBackup, failFirstRead, file, launch, lineOf, linesOf, manifestOf, onSnapshotOpened, restart, verify, w7Device,
} from './support.ts';

// Every key name in a JSON value, at any depth.
function keysOf(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => keysOf(item, into));
  else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      keysOf(child, into);
    }
  }
  return into;
}

describe('I8.2 Concurrent mutation', () => {
  it('should download the snapshot from before a Sell 1 on O-C recorded when the snapshot opened, leave the Position Change out of the file, accept the mutation at the next content revision, and include it in a second export', async () => {
    const d = await w7Device();
    const app = await launch(d);
    const w7 = dumpOf('workspace-v7');
    const trades = Object.values(w7.databases).flatMap((db) => db.stores['trades']?.records ?? []) as { tradeId: string; lifecycle: string; facts: { kind: string; versions: { value: { instrument?: { kind: string; right?: string; symbol: string } } }[] }[] }[];
    const oc = trades.find((t) => t.lifecycle === 'Open' && t.facts.some((f) => f.kind === 'PlannedLeg' && f.versions.at(-1)!.value.instrument?.right === 'Call' && f.versions.at(-1)!.value.instrument?.symbol === 'XYZ'));
    if (!oc) throw new Error('W7 holds no open XYZ Long Call');
    const sellTime = '2026-11-20T20:00:00Z';
    // The fixture is Workspace at Journal seed 5, whose form has no Plan Departure Reason prompt: its reflection stays as the form has it.
    const command = await optionCommand(app, oc.tradeId, [await optionExecution(app, oc.tradeId, 'Sell', { quantity: '1', price: '3.00', economicTime: sellTime, fee: '0.65' })], {
      reflection: await complete(app),
      closeReasonId: await closeReasonId(app, 'Time-Based Exit'),
      closeReview: { kind: 'Defer' },
    });

    let mutation: ReturnType<typeof app.TradeWorkflows.recordPositionChange> | undefined;
    onSnapshotOpened(app, () => {
      mutation ??= app.TradeWorkflows.recordPositionChange(command);
    });
    const exported = await exportBackup(app, d);
    const recorded = await mutation;

    // The binding of the file precedes the mutation's, and no line holds anything the mutation wrote.
    expect(recorded).toMatchObject({ kind: 'Recorded', receipt: { binding: { contentRevision: exported.result.sourceBinding.contentRevision + 1 } } });
    if (recorded?.kind !== 'Recorded') throw new Error(`recordPositionChange: ${JSON.stringify(recorded)}`);
    const text = linesOf(exported.bytes).join('\n');
    expect(text).not.toContain(sellTime);
    for (const factId of recorded.receipt.createdFactIds) expect(text).not.toContain(factId);

    // A second export contains it, at the new binding.
    const second = await exportBackup(app, d);
    expect(second.result.sourceBinding.contentRevision).toBe(recorded.receipt.binding.contentRevision);
    const secondText = linesOf(second.bytes).join('\n');
    expect(secondText).toContain(sellTime);
    for (const factId of recorded.receipt.createdFactIds) expect(secondText).toContain(factId);
  }, 60_000);
});

describe('I8.3 Exclusions', () => {
  it('should hold no private store or field, no root, pointer, candidate or diagnostics record, no content revision and no secret-shaped key in A7, and name every excluded category in its manifest', async () => {
    // A7 is W7's export: the committed file and a fresh export of W7 are the same artifact, and both are scanned.
    const d = await w7Device();
    const fresh = await exportBackup(await launch(d), d);
    expect(manifestOf(fresh.bytes).fullDigest).toBe(manifestOf(artifactOf('backup-v7')).fullDigest);
    for (const bytes of [artifactOf('backup-v7'), fresh.bytes]) scanExclusions(bytes);
  });
});

function scanExclusions(bytes: Uint8Array): void {
  const lines = linesOf(bytes).map((line) => JSON.parse(line) as Record<string, unknown>);
  const records = lines.filter((line) => 'r' in line) as { r: Record<string, unknown>; s: string; t: string }[];
  expect(records.length).toBeGreaterThan(100);

  // Only the authoritative stores and the Workspace section.
  expect([...new Set(records.map((r) => r.t))].sort()).toEqual(['catalog', 'journalDebts', 'journalDeclines', 'journalDefinitions', 'journalEntries', 'journalTypes', 'meta', 'observations', 'trades']);
  expect(records.filter((r) => r.t === 'meta').map((r) => r.r['key'])).toEqual(['workspace']);

  // No private field and no content revision in any record (the header's source binding is the one place a content revision is named).
  for (const excluded of ['exposureStart', 'terminalTime', 'activityDesc', 'terminalDesc', 'contentRevision']) {
    expect(records.filter((r) => keysOf(r).has(excluded)), excluded).toEqual([]);
  }
  // No key named like a secret anywhere in the file.
  const keys = keysOf(lines);
  for (const secret of ['credential', 'token', 'apiKey', 'cursor', 'report']) expect(keys.has(secret), secret).toBe(false);
  // No root, pointer, candidate or diagnostics record and no private store in any record line, and no per-record revision stamp (Q3).
  const recordText = linesOf(bytes).filter((line) => line.startsWith('{"r":')).join('\n');
  for (const root of ['"candidates"', '"retired"', '"pointer"', '"diagnostics"', 'journalObligations']) expect(recordText, root).not.toContain(root);
  expect(records.filter((r) => 'revision' in r.r)).toEqual([]);

  // The manifest names each category A125 excludes.
  const exclusions = manifestOf(bytes).exclusions;
  for (const category of ['root', 'journalObligations', 'indexes', 'trades.exposureStart', 'trades.terminalTime', 'trades.activityDesc', 'trades.terminalDesc', 'contentRevision', 'credentials', 'unsavedForms', 'rawProviderPayloads', 'diagnostics', 'reports', 'replayProjections', 'cursors']) {
    expect(exclusions, category).toContain(category);
  }
}

describe('I8.4 Backup failures', () => {
  it('should return NotCompleted at Read with no file when a read fails, Downloaded with no receipt anywhere for an unverified download, and IncompleteOrCorrupt, IncompleteOrCorrupt, Unreadable and DifferentArtifact for R-cut, R-flip, an unreadable file and another exports file, leaving every store unchanged', async () => {
    const d = await w7Device();
    const app = await launch(d);
    const start = await dumpAll(d.factory);

    // A read that fails with UnknownError: no file reaches the host.
    const fault = failFirstRead('trades');
    const failed = await app.Workspace.exportBackup({}).finally(() => fault.restore());
    expect(failed).toMatchObject({ kind: 'NotCompleted', stage: 'Read', reason: 'ReadFailed' });
    expect(d.testHost.downloads.offered).toEqual([]);
    expect(await dumpAll(d.factory)).toEqual(start);

    // Without it: Downloaded and never verified. A download alone carries no receipt, and none is stored.
    const exported = await exportBackup(app, d);
    expect(exported.result).not.toHaveProperty('receipt');
    expect(JSON.stringify(await dumpAll(d.factory))).not.toContain('receiptId');
    expect(await dumpAll(d.factory)).toEqual(start);

    // R-cut, R-flip, a file whose read fails.
    const cut = await verify(app, exported, exported.bytes.slice(0, exported.bytes.length / 2));
    const flipped = editedArtifact(exported.bytes, (artifact) => {
      artifact.keepDigests = true;
      const at = lineOf(artifact.lines, 'trades');
      artifact.lines[at] = artifact.lines[at]!.replace(/"thesis":"(.)/, (_match, first: string) => `"thesis":"${first === 'Z' ? 'Y' : 'Z'}`);
    });
    const flip = await verify(app, exported, flipped);
    d.testHost.files.supplyReadFailure();
    const chosen = await d.testHost.files.port.choose();
    if (chosen.kind !== 'Chosen') throw new Error('no file chosen');
    const unreadable = await app.Workspace.confirmBackup({ file: chosen.file, expectedBinding: exported.result.sourceBinding, expectedFullDigest: exported.result.fullDigest });
    expect(cut).toMatchObject({ kind: 'NotVerified', reason: 'IncompleteOrCorrupt' });
    expect(flip).toMatchObject({ kind: 'NotVerified', reason: 'IncompleteOrCorrupt' });
    expect(unreadable).toMatchObject({ kind: 'NotVerified', reason: 'Unreadable' });
    expect(await dumpAll(d.factory)).toEqual(start);

    // Another export's file: made after one more Institution was saved.
    const saved = await app.ReferenceCatalog.save({ kind: 'CreateInstitution', label: 'Schwab' });
    expect(saved.kind).toBe('Saved');
    const other = await exportBackup(app, d);
    expect(other.result.fullDigest).not.toBe(exported.result.fullDigest);
    const different = await app.Workspace.confirmBackup({ file: file(other.bytes), expectedBinding: exported.result.sourceBinding, expectedFullDigest: exported.result.fullDigest });
    expect(different).toMatchObject({ kind: 'NotVerified', reason: 'DifferentArtifact' });

    // The same application after a restart still holds no receipt: nothing was stored.
    const again = await restart(app, d);
    expect(JSON.stringify(await dumpAll(d.factory))).not.toContain('receiptId');
    expect((await again.Workspace.getStatus()).kind).toBe('Ready');
  }, 120_000);
});
