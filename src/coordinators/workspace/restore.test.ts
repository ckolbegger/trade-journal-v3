// Workspace.prepareRestore (D8 T8.8): backup files made from W7 through exportBackup (A7), edited
// into the R-fixtures, restored over W-t, on fake-indexeddb.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { dumpAll, testStack } from '../../../tests/support/stack.ts';
import { loadDump, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import { Rational } from '../../domain/values/index.ts';
import { applyPreparedRestore as applyJournal, type CandidateSectionMeta } from '../../modules/journal/index.ts';
import { applyPreparedRestore as applyMarketData } from '../../modules/market-data/index.ts';
import { applyPreparedRestore as applyCatalog } from '../../modules/reference-catalog/index.ts';
import { applyPreparedRestore as applyTrades } from '../../modules/trade-record/index.ts';
import { backupFile, editedArtifact, exportedArtifact, targetWorkspace, workspaceOf } from './restore-test-support.ts';

const W7 = JSON.parse(readFileSync('tests/fixtures/workspace-v7/dump.json', 'utf8')) as WorkspaceDump;

// A7's counts, tallied from W7's stored records (tests/fixtures/workspace-v7/dump.json).
const A7_COUNTS = {
  tradesByLifecycle: { Planned: 6, Open: 7, Closed: 4 },
  positionChanges: 27,
  executions: 26,
  expirations: 1,
  deviationOccurrences: 5,
  entriesByType: {
    'entry-type.plan-reflection': 17,
    'entry-type.position-change-reflection': 11,
    'entry-type.daily-trade-review': 2,
    'entry-type.close-review': 2,
  },
  declines: 14,
  debtsByStatus: { Outstanding: 4, Settled: 1, Declined: 1 },
  marks: 7,
  acknowledgments: 1,
  institutions: 2,
  accounts: 3,
  strategies: 4,
  closeReasons: 4,
  entryDefinitionRevisions: 4,
  // Fact versions of every Trade, and the versions of every Entry and Debt.
  versions: { trades: 127, entries: 33, debts: 8 },
};

// W-t's counts: one Institution, one Account, one Planned Trade (a Plan, one Planned Leg, a Stop and a Target) and its Plan Reflection.
const WT_COUNTS = {
  tradesByLifecycle: { Planned: 1, Open: 0, Closed: 0 },
  positionChanges: 0,
  executions: 0,
  expirations: 0,
  deviationOccurrences: 0,
  entriesByType: { 'entry-type.plan-reflection': 1 },
  declines: 0,
  debtsByStatus: {},
  marks: 0,
  acknowledgments: 0,
  institutions: 1,
  accounts: 1,
  strategies: 4,
  closeReasons: 4,
  entryDefinitionRevisions: 4,
  versions: { trades: 4, entries: 1, debts: 0 },
};

// The database the root's pointer names.
const liveDatabaseOf = (dump: Awaited<ReturnType<typeof dumpAll>>): string => (dump['tj-root']!['pointer'] as { databaseName: string }[])[0]!.databaseName;

describe('valid artifact (AC-REST-001, A133)', () => {
  it('should prepare A7 and return a preview with the source (created Fri 20 Nov 2026 18:00, release, schema 7, Normal), A7 exact counts per kind with version counts, no migrations, no repairs, the target impact (user data present, W-t counts, time zones America/Chicago and America/New_York), the warning TimeZoneDiffers, and safety choice required, leaving W-t binding and every live store unchanged', async () => {
    const a7 = await exportedArtifact(await loadDump(W7));
    const target = await targetWorkspace();
    const before = await dumpAll(target.factory);
    const live = liveDatabaseOf(before);
    const contentRevision = (before[live]!['meta'] as { key: string; contentRevision?: number }[]).find((r) => r.key === 'content')!.contentRevision;

    const result = await target.workspace.prepareRestore({ file: backupFile(a7.bytes) });

    if (result.kind !== 'Prepared') throw new Error(`expected Prepared, got ${JSON.stringify(result)}`);
    expect(result.token).toEqual({
      candidateId: expect.stringMatching(/^tj-ws-/) as unknown,
      fullDigest: a7.fullDigest,
      targetBinding: { databaseName: live, contentRevision },
      releaseId: target.testHost.releaseId,
    });
    expect(result.preview).toEqual({
      source: { createdAt: '2026-11-20T18:00', releaseId: a7.releaseId, schemaVersion: 7, exportKind: 'Normal' },
      counts: A7_COUNTS,
      migrations: { steps: [], seedAdditions: [] },
      repairs: [],
      providerNeedsSetup: [],
      target: { hasUserData: true, counts: WT_COUNTS, currentTimeZone: 'America/Chicago', restoredTimeZone: 'America/New_York' },
      warnings: ['TimeZoneDiffers'],
      safetyChoiceRequired: true,
    });
    // Preparation wrote only its own candidate: W-t's database and the pointer are as they were.
    const after = await dumpAll(target.factory);
    expect(after[live]).toEqual(before[live]);
    const pointerOf = (dump: typeof after) => (dump['tj-root']!['pointer'] as { key: string }[]).find((record) => record.key === 'current');
    expect(pointerOf(after)).toEqual(pointerOf(before));
    expect(Object.keys(after).filter((name) => name !== live && name !== 'tj-root')).toEqual([result.token.candidateId]);

    // The candidate holds A7's records and the Workspace section, and its meta records what apply will recheck.
    const candidate = after[result.token.candidateId]!;
    expect(Object.fromEntries(['catalog', 'observations', 'trades', 'journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalDebts'].map((store) => [store, candidate[store]!.length]))).toEqual({
      catalog: 13,
      observations: 7,
      trades: 17,
      journalTypes: 9,
      journalDefinitions: 4,
      journalEntries: 32,
      journalDeclines: 14,
      journalDebts: 6,
    });
    const meta = candidate['meta'] as { key: string; [field: string]: unknown }[];
    expect(meta.find((r) => r.key === 'settings')).toMatchObject({ timeZone: 'America/New_York', settingsRevision: 1 });
    const recorded = meta.find((r) => r.key === 'restorePrepared')!['sections'] as Record<string, CandidateSectionMeta>;
    expect(Object.keys(recorded)).toEqual(['catalog', 'marketData', 'trades', 'journal']);
    expect(recorded['journal']!.counts).toEqual({ journalTypes: 9, journalDefinitions: 4, journalEntries: 32, journalDeclines: 14, journalDebts: 6 });
    expect(Object.keys(recorded['journal']!.storeDigests)).toEqual(['journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalDebts']);
    const source = target.persistence.candidateSource(result.token.candidateId);
    expect(await applyCatalog(source, recorded['catalog']!)).toEqual({ kind: 'Accepted' });
    expect(await applyMarketData(source, recorded['marketData']!)).toEqual({ kind: 'Accepted' });
    expect(await applyTrades(source, recorded['trades']!)).toEqual({ kind: 'Accepted' });
    expect(await applyJournal(source, recorded['journal']!)).toEqual({ kind: 'Accepted' });
  });
});

// A7 with its header edited: the artifact's digests are recomputed, so only the header check can reject it.
function withHeader(bytes: Uint8Array, change: Record<string, unknown>): Uint8Array {
  return editedArtifact(bytes, (artifact) => {
    artifact.lines[0] = JSON.stringify({ ...(JSON.parse(artifact.lines[0]!) as Record<string, unknown>), ...change });
  });
}

describe('rejections before anything is written', () => {
  it('should reject R-new with UnsupportedNewerSchema and a header with formatVersion 2 with UnsupportedFormat, creating no candidate', async () => {
    const a7 = await exportedArtifact(await loadDump(W7));
    const target = await targetWorkspace();
    const before = await dumpAll(target.factory);
    const liveBinding = { databaseName: liveDatabaseOf(before), contentRevision: expect.any(Number) as unknown };

    const newer = await target.workspace.prepareRestore({ file: backupFile(withHeader(a7.bytes, { schemaVersion: 8 })) });
    expect(newer).toMatchObject({ kind: 'Rejected', issues: [{ code: 'UnsupportedNewerSchema' }], totalIssues: 1, liveBinding });
    const format = await target.workspace.prepareRestore({ file: backupFile(withHeader(a7.bytes, { formatVersion: 2 })) });
    expect(format).toMatchObject({ kind: 'Rejected', issues: [{ code: 'UnsupportedFormat' }], totalIssues: 1, liveBinding });
    // Nothing was written: no candidate database, and the root lists none.
    expect(await dumpAll(target.factory)).toEqual(before);
  });

  it('should reject with InsufficientCapacity, naming available and required bytes, when the projected candidate exceeds quota minus usage, creating no candidate', async () => {
    const a7 = await exportedArtifact(await loadDump(W7));
    const target = await targetWorkspace();
    const before = await dumpAll(target.factory);
    // Plenty of quota for readiness, but only ten kilobytes free.
    const full = { ...target.testHost.host, estimate: () => Promise.resolve({ quota: 10 * 1024 ** 3, usage: 10 * 1024 ** 3 - 10_000 }) };

    const result = await workspaceOf(target, { host: full }).prepareRestore({ file: backupFile(a7.bytes) });

    expect(result).toMatchObject({ kind: 'Rejected', issues: [{ code: 'InsufficientCapacity', availableBytes: 10_000, requiredBytes: expect.any(Number) as unknown }], totalIssues: 1 });
    if (result.kind !== 'Rejected') throw new Error(`expected Rejected, got ${result.kind}`);
    expect(result.issues[0]!.requiredBytes).toBeGreaterThan(10_000);
    expect(await dumpAll(target.factory)).toEqual(before);
  });
});

// The index of the first record line of one store in an artifact's lines.
const lineOf = (lines: readonly string[], store: string): number => lines.findIndex((line) => line.startsWith('{"r":') && line.endsWith(`,"t":"${store}"}`));

// What a rejection leaves behind: W-t's database as it was, and no candidate database or root entry.
function expectNoCandidate(after: Awaited<ReturnType<typeof dumpAll>>, before: Awaited<ReturnType<typeof dumpAll>>): void {
  expect(Object.keys(after)).toEqual(Object.keys(before));
  expect(after[liveDatabaseOf(before)]).toEqual(before[liveDatabaseOf(before)]);
  const listed = (after['tj-root']!['pointer'] as { key: string; databaseNames?: string[] }[]).find((record) => record.key === 'candidates');
  expect(listed?.databaseNames ?? []).toEqual([]);
}

describe('rejections after staging (A134)', () => {
  it('should reject R-flip with DigestMismatch trades, R-cut with IncompleteArtifact, R-bad with two MalformedRecord issues naming their lines, and a manifest footprint missing instrument.option with ManifestMismatch, deleting the candidate each time', async () => {
    const a7 = await exportedArtifact(await loadDump(W7));
    const target = await targetWorkspace();
    const before = await dumpAll(target.factory);
    const prepare = async (bytes: Uint8Array) => {
      const result = await target.workspace.prepareRestore({ file: backupFile(bytes) });
      expectNoCandidate(await dumpAll(target.factory), before);
      return result;
    };
    const liveBinding = { databaseName: liveDatabaseOf(before), contentRevision: expect.any(Number) as unknown };

    // R-flip: one character of a trades record, with no digest recomputed.
    const flipped = editedArtifact(a7.bytes, (artifact) => {
      artifact.keepDigests = true;
      const at = lineOf(artifact.lines, 'trades');
      artifact.lines[at] = artifact.lines[at]!.replace(/"thesis":"(.)/, (_match, first: string) => `"thesis":"${first === 'Z' ? 'Y' : 'Z'}`);
    });
    expect(await prepare(flipped)).toMatchObject({ kind: 'Rejected', issues: [{ code: 'DigestMismatch', section: 'trades' }], totalIssues: 1, liveBinding });

    // R-cut: the compressed file cut at half its length.
    expect(await prepare(a7.bytes.slice(0, a7.bytes.length / 2))).toMatchObject({ kind: 'Rejected', issues: [{ code: 'IncompleteArtifact' }], totalIssues: 1, liveBinding });

    // R-bad: a record line that is not JSON, and a record missing its economicTime.
    let notJsonLine = 0;
    let missingLine = 0;
    let planAt = 0;
    const bad = editedArtifact(a7.bytes, (artifact) => {
      const notJson = lineOf(artifact.lines, 'catalog');
      artifact.lines[notJson] = '{"r":this is not json';
      const missing = lineOf(artifact.lines, 'trades');
      const record = JSON.parse(artifact.lines[missing]!) as { r: { facts: { kind: string; versions: { value: Record<string, unknown> }[] }[] } };
      planAt = record.r.facts.findIndex((fact) => fact.kind === 'Plan');
      delete record.r.facts[planAt]!.versions[0]!.value['economicTime'];
      artifact.lines[missing] = JSON.stringify(record);
      // Artifact lines are numbered from 1.
      notJsonLine = notJson + 1;
      missingLine = missing + 1;
    });
    expect(await prepare(bad)).toMatchObject({
      kind: 'Rejected',
      issues: [
        { code: 'MalformedRecord', line: notJsonLine },
        { code: 'MalformedRecord', line: missingLine, path: `facts.${planAt}.versions.0.value.economicTime` },
      ],
      totalIssues: 2,
      liveBinding,
    });

    // A manifest footprint that lacks what the records carry.
    const footprint = editedArtifact(a7.bytes, (artifact) => {
      artifact.manifest['footprint'] = (artifact.manifest['footprint'] as string[]).filter((identifier) => identifier !== 'instrument.option');
    });
    expect(await prepare(footprint)).toMatchObject({ kind: 'Rejected', issues: [{ code: 'ManifestMismatch' }], totalIssues: 1, liveBinding });
  });

  it('should reject one artifact holding R-ref, R-anchor, R-dup, and R-inc with all four issues, cross-section ones as CrossSectionReference, and delete the candidate', async () => {
    const a7 = await exportedArtifact(await loadDump(W7));
    const target = await targetWorkspace();
    const before = await dumpAll(target.factory);

    type Fact = { factId: string; kind: string; versions: { value: Record<string, unknown> }[] };
    const broken = editedArtifact(a7.bytes, (artifact) => {
      const edit = (store: string, change: (record: Record<string, unknown>) => boolean) => {
        artifact.lines.forEach((line, index) => {
          if (!line.startsWith('{"r":') || !line.endsWith(`,"t":"${store}"}`)) return;
          const envelope = JSON.parse(line) as { r: Record<string, unknown> };
          if (change(envelope.r)) artifact.lines[index] = JSON.stringify(envelope);
        });
      };
      edit('trades', (trade) => {
        const facts = trade['facts'] as Fact[];
        const executions = facts.filter((fact) => fact.kind === 'Execution');
        if (trade['tradeId'] === 'fx-0049') {
          // R-ref: a Trade naming an unknown Account.
          trade['accountId'] = 'acct-unknown';
        } else if (trade['tradeId'] === 'fx-0092') {
          // R-inc: an Execution naming an unknown Planned Leg.
          executions[0]!.versions[0]!.value['intent'] = { kind: 'ServesPlannedLeg', plannedLegId: 'no-such-leg' };
        } else if (trade['tradeId'] === 'fx-0117') {
          // R-dup: one fact identity used by two Executions.
          const changes = facts.filter((fact) => fact.kind === 'PositionChange');
          changes[1]!.versions[0]!.value['memberIds'] = [executions[0]!.factId];
          executions[1]!.factId = executions[0]!.factId;
        } else {
          return false;
        }
        return true;
      });
      // R-anchor: the first Position Change Reflection Entry, whose origin is no fact of any Trade.
      let anchored = false;
      edit('journalEntries', (entry) => {
        const origin = entry['origin'] as { kind: string; factId: string };
        if (anchored || origin.kind !== 'PositionChange') return false;
        anchored = true;
        origin.factId = 'no-such-fact';
        return true;
      });
    });

    const result = await target.workspace.prepareRestore({ file: backupFile(broken) });

    if (result.kind !== 'Rejected') throw new Error(`expected Rejected, got ${result.kind}`);
    expect(result.issues).toContainEqual({ code: 'CrossSectionReference', kind: 'Account', identity: 'acct-unknown' });
    expect(result.issues).toContainEqual({ code: 'CrossSectionReference', kind: 'PositionChange', identity: 'no-such-fact' });
    expect(result.issues).toContainEqual({ code: 'IncoherentFacts', section: 'trades' });
    expect(result.issues).toContainEqual({ code: 'DuplicateFactIdentity', section: 'trades' });
    expect(result.totalIssues).toBe(result.issues.length);
    expectNoCandidate(await dumpAll(target.factory), before);
  });
});

describe('repairs (AC-LIFE-003, decision 23, D6 review-queue item 2)', () => {
  it('should prepare an artifact holding R-lc and R-dev with both repairs listed with stored and expected values, and leave the candidate holding T-A as Closed and the restored occurrence', async () => {
    const a7 = await exportedArtifact(await loadDump(W7));
    const target = await targetWorkspace();
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

    const result = await target.workspace.prepareRestore({ file: backupFile(repairable) });

    if (result.kind !== 'Prepared') throw new Error(`expected Prepared, got ${JSON.stringify(result)}`);
    // Both Trades are Long Stock plans of 100 shares at 50.00; the summary is what the app shows for a Trade elsewhere.
    const summary = (underlying: string) => ({ underlying, summary: { kind: 'Stock', direction: 'Long', quantity: Rational.of(100n), price: Rational.of(50n) } });
    expect(result.preview.repairs).toEqual([
      { tradeId: 'fx-0075', tradeSummary: summary('KO'), kind: 'EntrySizeDeviation', stored: 'None', expected: '20' },
      { tradeId: 'fx-0145', tradeSummary: summary('GIS'), kind: 'Lifecycle', stored: 'Open', expected: 'Closed' },
    ]);
    // The counts are the finished candidate's: T-A counts as Closed and the occurrence is back.
    expect(result.preview.counts).toEqual(A7_COUNTS);

    const candidate = (await dumpAll(target.factory))[result.token.candidateId]!;
    const trades = candidate['trades'] as Record<string, unknown>[];
    const tradeOf = (tradeId: string) => trades.find((trade) => trade['tradeId'] === tradeId)!;
    expect(tradeOf('fx-0145')['lifecycle']).toBe('Closed');
    expect(tradeOf('fx-0075')['deviations']).toEqual([
      {
        occurrenceId: expect.any(String) as unknown,
        versions: [
          {
            fingerprint: { tradeId: 'fx-0075', plannedLegId: 'fx-0077', positionChangeId: 'fx-0087' },
            type: 'EntrySize',
            form: 'Excess',
            quantityAbovePlan: '20',
            causingPositionChangeId: 'fx-0087',
            economicTime: '2026-10-12T18:00:00Z',
            status: 'Active',
          },
        ],
      },
    ]);
    // The private state is rebuilt from the repaired records, and what apply rechecks was measured after the repair.
    expect(trades.every((trade) => typeof trade['activityDesc'] === 'string' && typeof trade['exposureStart'] === 'string' || trade['lifecycle'] === 'Planned')).toBe(true);
    expect(candidate['journalObligations']).toHaveLength(50);
    const recorded = (candidate['meta'] as { key: string; sections?: Record<string, CandidateSectionMeta> }[]).find((record) => record.key === 'restorePrepared')!.sections!;
    expect(await applyTrades(target.persistence.candidateSource(result.token.candidateId), recorded['trades']!)).toEqual({ kind: 'Accepted' });
  });
});

describe('older artifact (P31, P32)', () => {
  it('should prepare A5b through the 5 to 6 and 6 to 7 transforms, list both migration steps and the seed additions Long Call, Long Put, and Cash-Secured Put, and warn OlderSchema', async () => {
    // A5b: the schema-5 fixture exported as it stands, a blocked-database artifact (P32).
    const V5 = JSON.parse(readFileSync('tests/fixtures/workspace-v5/dump.json', 'utf8')) as WorkspaceDump;
    const a5b = await exportedArtifact(await loadDump(V5), '2026-10-20T22:00:00Z');
    const target = await targetWorkspace();

    const result = await target.workspace.prepareRestore({ file: backupFile(a5b.bytes) });

    if (result.kind !== 'Prepared') throw new Error(`expected Prepared, got ${JSON.stringify(result)}`);
    expect(result.preview.source).toMatchObject({ schemaVersion: 5, exportKind: 'BlockedDatabase' });
    expect(result.preview.migrations).toEqual({ steps: [{ from: 5, to: 6 }, { from: 6, to: 7 }], seedAdditions: ['Long Call', 'Long Put', 'Cash-Secured Put'] });
    expect(result.preview.warnings).toEqual(['TimeZoneDiffers', 'OlderSchema']);
    // The candidate holds the migrated records, with the seeds that schema 5 lacked.
    const candidate = (await dumpAll(target.factory))[result.token.candidateId]!;
    const labels = (candidate['catalog'] as { kind: string; label: string }[]).filter((record) => record.kind === 'Strategy').map((record) => record.label);
    expect(labels).toEqual(expect.arrayContaining(['Long Call', 'Long Put', 'Cash-Secured Put']));
    expect(result.preview.counts.strategies).toBe(labels.length);
  });
});

describe('unreadable files', () => {
  it('should reject a file that is not UTF-8 text with UnsupportedFormat, not as an incomplete artifact, creating no candidate', async () => {
    const target = await targetWorkspace();
    const before = await dumpAll(target.factory);

    const result = await target.workspace.prepareRestore({ file: backupFile(Uint8Array.of(0xff, 0xfe, 0xfd, 0x0a)) });

    expect(result).toMatchObject({ kind: 'Rejected', issues: [{ code: 'UnsupportedFormat' }], totalIssues: 1 });
    expect(await dumpAll(target.factory)).toEqual(before);
  });
});

describe('failure detail for the developer log (Q5, Q9)', () => {
  it('should carry a Prepare detail with codes, sections and lines in every rejection, and the name, message and stack of an unexpected error with the candidate deleted', async () => {
    const a7 = await exportedArtifact(await loadDump(W7));
    const target = await targetWorkspace();
    const before = await dumpAll(target.factory);

    // A rejection names its first issue and how many there were, and no record contents.
    const newer = await target.workspace.prepareRestore({ file: backupFile(withHeader(a7.bytes, { schemaVersion: 8 })) });
    expect(newer).toMatchObject({ kind: 'Rejected', detail: { stage: 'Prepare', name: 'UnsupportedNewerSchema', context: { code: 'UnsupportedNewerSchema', totalIssues: 1 } } });
    const notJson = editedArtifact(a7.bytes, (artifact) => {
      artifact.lines[lineOf(artifact.lines, 'catalog')] = '{"r":this is not json';
    });
    const bad = await target.workspace.prepareRestore({ file: backupFile(notJson) });
    expect(bad).toMatchObject({ kind: 'Rejected', detail: { stage: 'Prepare', name: 'MalformedRecord', context: { code: 'MalformedRecord', totalIssues: 1, line: expect.any(Number) as unknown } } });
    expect(JSON.stringify((bad as { detail: unknown }).detail)).not.toContain('this is not json');

    // An unexpected failure after the candidate exists is a rejection with no issues, the error as it was thrown, and no candidate left.
    const failing = { ...target.persistence, rebuildCandidate: () => Promise.reject(new RangeError('rebuild blew up')) };
    const unexpected = await workspaceOf(target, { persistence: failing }).prepareRestore({ file: backupFile(a7.bytes) });
    expect(unexpected).toMatchObject({ kind: 'Rejected', issues: [], totalIssues: 0, detail: { stage: 'Prepare', name: 'RangeError', message: 'rebuild blew up' } });
    expect((unexpected as { detail: { stack?: string } }).detail.stack).toContain('rebuild blew up');
    expectNoCandidate(await dumpAll(target.factory), before);
  });
});

describe('availability (P30)', () => {
  it('should return RuntimeNotWritable and create no candidate in Recovery Only, and prepare A7 with target NoWorkspace and no safety choice when no Workspace exists', async () => {
    const a7 = await exportedArtifact(await loadDump(W7));
    // Recovery Only: the browser can no longer save safely, so the readiness the Restore rechecks fails.
    const target = await targetWorkspace();
    const before = await dumpAll(target.factory);
    target.testHost.fail(['capacity']);

    const refused = await target.workspace.prepareRestore({ file: backupFile(a7.bytes) });

    expect(refused).toMatchObject({ kind: 'RuntimeNotWritable', failedChecks: [{ check: 'capacity' }] });
    expect(await dumpAll(target.factory)).toEqual(before);

    // No Workspace at all: the first-run Restore.
    const empty = await testStack(new IDBFactory());
    const result = await workspaceOf(empty).prepareRestore({ file: backupFile(a7.bytes) });

    if (result.kind !== 'Prepared') throw new Error(`expected Prepared, got ${JSON.stringify(result)}`);
    expect(result.token.targetBinding).toBe('NoWorkspace');
    expect(result.preview.target).toEqual({ hasUserData: false, counts: null, currentTimeZone: null, restoredTimeZone: 'America/New_York' });
    expect(result.preview.warnings).toEqual([]);
    expect(result.preview.safetyChoiceRequired).toBe(false);
  });
});
