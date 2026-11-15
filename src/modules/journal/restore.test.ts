import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ExportBatch } from '../../persistence/export-snapshot.ts';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { exportSnapshot, type JournalSectionStore } from './export.ts';
import { applyPreparedRestore, measureCandidateSection, prepareRestore, type RestoreLine } from './restore.ts';

// W7's stores, as stored.
const dump = JSON.parse(readFileSync('tests/fixtures/workspace-v7/dump.json', 'utf8')) as {
  databases: Record<string, { stores: Record<string, { records: Record<string, unknown>[] }> }>;
};
const stores = dump.databases['tj-ws-fx-0013']!.stores;
const STORES: readonly JournalSectionStore[] = ['journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalDebts'];

// A7's Journal records: W7's stores through T8.2's exporter (A7's committed fixture is T8.17's).
const exported = (store: JournalSectionStore): Record<string, unknown>[] => {
  const batch: ExportBatch = { store, records: stores[store]!.records };
  return structuredClone(exportSnapshot(batch)!.records) as Record<string, unknown>[];
};
const linesOf = (records: readonly unknown[]): RestoreLine[] => records.map((record, i) => ({ line: i + 3, record }));
const preparation = prepareRestore();

describe('record parsing at schema 7 (P31)', () => {
  it('should accept every A7 record of its module and reject an extra field, a missing field, and a price that is a number rather than a decimal string as MalformedRecord naming the line and path', () => {
    for (const store of STORES) {
      const records = exported(store);
      expect(records.length).toBeGreaterThan(0);
      expect(preparation.parse(store, linesOf(records))).toEqual({ kind: 'Parsed', records });
    }

    // The per-record write stamp is not part of the artifact (Q3), so it is an extra field.
    const extra = exported('journalEntries');
    extra[3]!['revision'] = 31;
    expect(preparation.parse('journalEntries', linesOf(extra))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: 6, store: 'journalEntries', path: 'revision' }] });

    const missing = exported('journalDeclines');
    delete missing[1]!['entryTypeKey'];
    expect(preparation.parse('journalDeclines', linesOf(missing))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: 4, store: 'journalDeclines', path: 'entryTypeKey' }] });

    // The Journal holds no price; its decimal-string analog is a text field given as a number.
    const numeric = exported('journalDebts');
    (numeric[0]!['versions'] as Record<string, unknown>[])[0]!['savedAt'] = 20261120;
    expect(preparation.parse('journalDebts', linesOf(numeric))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: 3, store: 'journalDebts', path: 'versions.0.savedAt' }] });
  });
});

describe('obligation key shape (D8 A134)', () => {
  it('should reject an obligation key that is not a Daily Trade Review key', () => {
    for (const store of ['journalEntries', 'journalDeclines'] as const) {
      const records = exported(store);
      for (const bad of [['DailyTradeReview', '2026-01-02'], ['Other', '2026-01-02', 't1'], ['a', 'b', 'c', 'd'], []]) {
        const malformed = structuredClone(records);
        malformed[0]!['obligationKey'] = bad;
        expect(preparation.parse(store, linesOf(malformed))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: 3, store, path: 'obligationKey' }] });
      }
    }
  });
});

describe('nested field in a union-typed field (D8 A134)', () => {
  it('should name the nested field in the path of a malformed record', () => {
    for (const store of ['journalEntries', 'journalDeclines'] as const) {
      const bad = exported(store);
      bad[0]!['origin'] = { kind: 'DailyReview', factId: 'f1', reviewDate: 20261120 };
      expect(preparation.parse(store, linesOf(bad))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: 3, store, path: 'origin.reviewDate' }] });
    }
  });
});

describe('section validator gaps (D2 follow-up F12)', () => {
  it('should report a duplicate Entry id', async () => {
    const candidate = () => Object.fromEntries(STORES.map((store) => [store, exported(store)]));
    expect((await preparation.validate(recordSourceOf(candidate()))).issues).toEqual([]);

    const duplicated = candidate();
    const entries = duplicated['journalEntries']!;
    const original = entries.find((e) => e['settledDebtId'] === undefined)!;
    // The copy keeps the id but answers another obligation, so only the identity repeats.
    entries.push({ ...structuredClone(original), obligationKey: 'another-obligation' });
    const result = await preparation.validate(recordSourceOf(duplicated));
    expect(result.issues).toEqual([{ code: 'DuplicateEntryId', id: original['id'] }]);
  });
});

describe('applyPreparedRestore recheck (A135)', () => {
  it('should accept a candidate section whose counts and digest equal those recorded in the candidate meta, and return CandidateChanged naming journalEntries when one Entry was removed from the candidate after preparation', async () => {
    const candidate = () => Object.fromEntries(STORES.map((store) => [store, exported(store)]));
    const recorded = await measureCandidateSection(recordSourceOf(candidate()));
    expect(recorded.counts).toEqual(Object.fromEntries(STORES.map((store) => [store, stores[store]!.records.length])));
    // The same records read in other batch sizes give the same digest.
    expect(await measureCandidateSection(recordSourceOf(candidate(), 7))).toEqual(recorded);
    expect(await applyPreparedRestore(recordSourceOf(candidate()), recorded)).toEqual({ kind: 'Accepted' });

    const removed = candidate();
    removed['journalEntries'] = removed['journalEntries']!.slice(1);
    expect(await applyPreparedRestore(recordSourceOf(removed), recorded)).toEqual({ kind: 'CandidateChanged', store: 'journalEntries' });
    // A changed field with the same counts is caught by the digest.
    const edited = candidate();
    edited['journalDeclines']![0]!['reason'] = 'Changed after preparation.';
    expect(await applyPreparedRestore(recordSourceOf(edited), recorded)).toEqual({ kind: 'CandidateChanged', store: 'journalDeclines' });
  });
});
