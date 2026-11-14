import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SessionPolicy } from '../../domain/session-policy/index.ts';
import type { ExportBatch } from '../../persistence/export-snapshot.ts';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { exportSnapshot } from './export.ts';
import { applyPreparedRestore, measureCandidateSection, prepareRestore, type RestoreLine } from './restore.ts';

// W7's stores, as stored.
const dump = JSON.parse(readFileSync('tests/fixtures/workspace-v7/dump.json', 'utf8')) as {
  databases: Record<string, { stores: Record<string, { records: Record<string, unknown>[] }> }>;
};
const stores = dump.databases['tj-ws-fx-0013']!.stores;

// A7's observation records: W7's through T8.2's exporter (A7's committed fixture is T8.17's).
const exported = (): Record<string, unknown>[] => {
  const batch: ExportBatch = { store: 'observations', records: stores['observations']!.records };
  return structuredClone(exportSnapshot(batch)!.records) as Record<string, unknown>[];
};
const linesOf = (records: readonly unknown[]): RestoreLine[] => records.map((record, i) => ({ line: i + 3, record }));
// Validation is not exercised here (D4's cases prove it), so the policy is a stub.
const preparation = prepareRestore({ policy: {} as SessionPolicy });

describe('record parsing at schema 7 (P31)', () => {
  it('should accept every A7 record of its module and reject an extra field, a missing field, and a price that is a number rather than a decimal string as MalformedRecord naming the line and path', () => {
    const records = exported();
    expect(records.length).toBeGreaterThan(0);
    expect(preparation.parse('observations', linesOf(records))).toEqual({ kind: 'Parsed', records });

    const extra = exported();
    extra[2]!['revision'] = 25;
    expect(preparation.parse('observations', linesOf(extra))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: 5, store: 'observations', path: 'revision' }] });

    const missing = exported();
    delete missing[0]!['resolutionRevision'];
    expect(preparation.parse('observations', linesOf(missing))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: 3, store: 'observations', path: 'resolutionRevision' }] });

    const priced = exported();
    const at = priced.findIndex((r) => (r['marks'] as unknown[]).length > 0);
    (priced[at]!['marks'] as Record<string, unknown>[])[0]!['price'] = 50.8;
    expect(preparation.parse('observations', linesOf(priced))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: at + 3, store: 'observations', path: 'marks.0.price' }] });
  });
});

describe('applyPreparedRestore recheck (A135)', () => {
  it('should accept a candidate section whose counts and digest equal those recorded in the candidate meta, and return CandidateChanged naming observations when one observation was removed from the candidate after preparation', async () => {
    const candidate = () => ({ observations: exported() });
    const recorded = await measureCandidateSection(recordSourceOf(candidate()));
    expect(recorded.counts).toEqual({ observations: stores['observations']!.records.length });
    // The same records read in other batch sizes give the same digest.
    expect(await measureCandidateSection(recordSourceOf(candidate(), 3))).toEqual(recorded);
    expect(await applyPreparedRestore(recordSourceOf(candidate()), recorded)).toEqual({ kind: 'Accepted' });

    const removed = candidate();
    removed.observations = removed.observations.slice(1);
    expect(await applyPreparedRestore(recordSourceOf(removed), recorded)).toEqual({ kind: 'CandidateChanged', store: 'observations' });
    // A changed field with the same count is caught by the digest.
    const edited = candidate();
    edited.observations[0]!['resolutionRevision'] = 99;
    expect(await applyPreparedRestore(recordSourceOf(edited), recorded)).toEqual({ kind: 'CandidateChanged', store: 'observations' });
  });
});
