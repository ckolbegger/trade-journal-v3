import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StrategyShape } from '../../domain/strategy/index.ts';
import type { ExportBatch } from '../../persistence/export-snapshot.ts';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { exportSnapshot } from './export.ts';
import { applyPreparedRestore, measureCandidateSection, prepareRestore, type RestoreLine } from './restore.ts';
import type { TradeSectionReferences } from './section.ts';

// W7's stores, as stored.
const dump = JSON.parse(readFileSync('tests/fixtures/workspace-v7/dump.json', 'utf8')) as {
  databases: Record<string, { stores: Record<string, { records: Record<string, unknown>[] }> }>;
};
const stores = dump.databases['tj-ws-fx-0013']!.stores;

// A7's Trade records: W7's trades through T8.2's exporter (A7's committed fixture is T8.17's).
const exported = (): Record<string, unknown>[] => {
  const batch: ExportBatch = { store: 'trades', records: stores['trades']!.records };
  return structuredClone(exportSnapshot(batch)!.records) as Record<string, unknown>[];
};
const linesOf = (records: readonly unknown[]): RestoreLine[] => records.map((record, i) => ({ line: i + 3, record }));

// The other sections' identities, read from W7's own Catalog and Journal records.
const references: TradeSectionReferences = {
  accountIds: new Set(stores['catalog']!.records.filter((r) => r['kind'] === 'Account').map((r) => r['id'] as string)),
  closeReasonIds: new Set(stores['catalog']!.records.filter((r) => r['kind'] === 'CloseReason').map((r) => r['id'] as string)),
  strategyShapes: new Map(stores['catalog']!.records.filter((r) => r['kind'] === 'Strategy').map((r) => [r['id'] as string, r['shape'] as StrategyShape])),
  anchorTradeIds: new Set(['journalEntries', 'journalDeclines', 'journalDebts'].flatMap((store) => stores[store]!.records.map((r) => r['anchorTradeId'] as string))),
};
const preparation = prepareRestore({ references });

const tradeOf = (records: Record<string, unknown>[], tradeId: string) => records.find((r) => r['tradeId'] === tradeId)!;
type Fact = { kind: string; versions: { value: Record<string, unknown> }[] };
const factsOf = (trade: Record<string, unknown>) => trade['facts'] as Fact[];

describe('record parsing at schema 7 (P31)', () => {
  it('should accept every A7 record of its module and reject an extra field, a missing field, and a price that is a number rather than a decimal string as MalformedRecord naming the line and path', () => {
    const records = exported();
    expect(preparation.parse('trades', linesOf(records))).toEqual({ kind: 'Parsed', records });

    const extra = exported();
    extra[4]!['exposureStart'] = '2026-10-12T14:00:00Z';
    expect(preparation.parse('trades', linesOf(extra))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: 7, store: 'trades', path: 'exposureStart' }] });

    const missing = exported();
    delete missing[2]!['accountId'];
    expect(preparation.parse('trades', linesOf(missing))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: 5, store: 'trades', path: 'accountId' }] });

    const priced = exported();
    const at = factsOf(tradeOf(priced, 'fx-0049')).findIndex((f) => f.kind === 'Execution');
    factsOf(tradeOf(priced, 'fx-0049'))[at]!.versions[0]!.value['price'] = 228.5;
    const line = priced.findIndex((r) => r['tradeId'] === 'fx-0049') + 3;
    expect(preparation.parse('trades', linesOf(priced))).toEqual({
      kind: 'Rejected',
      issues: [{ code: 'MalformedRecord', line, store: 'trades', path: `facts.${at}.versions.0.value.price` }],
    });
  });
});

describe('record parsing is leg-generic', () => {
  it('should accept a Trade whose facts hold any number of Planned Legs, Executions and Expirations, each with its own option Instrument', () => {
    const option = (strike: string) => ({ kind: 'Option', symbol: 'ABC', root: 'ABC', expiration: '2026-12-18', strike, right: 'Call', multiplier: 100 });
    const legs = Array.from({ length: 8 }, (_, i) => ({
      factId: `leg-${i}`,
      kind: 'PlannedLeg',
      recordedSequence: i + 1,
      versions: [{ versionNumber: 1, value: { side: i % 2 === 0 ? 'Long' : 'Short', instrument: option(String(100 + 5 * i)), quantity: '1', intendedEntry: '1.5' } }],
    }));
    const fills = legs.map((leg, i) => ({
      factId: `fill-${i}`,
      kind: 'Execution',
      recordedSequence: 9 + i,
      versions: [{ versionNumber: 1, value: { economicTime: '2026-10-12T14:00:00Z', action: 'Buy', instrument: leg.versions[0]!.value.instrument, quantity: '1', price: '1.5', fee: '0.65', intent: { kind: 'ServesPlannedLeg', plannedLegId: leg.factId } } }],
    }));
    const trade = { ...exported().find((r) => r['tradeId'] === 'fx-0189')!, facts: [...legs, ...fills] };
    expect(preparation.parse('trades', linesOf([trade]))).toEqual({ kind: 'Parsed', records: [trade] });
  });
});

describe('section validation in a Restore candidate', () => {
  it('should return Trade Record repairs for R-lc (Lifecycle, stored Open, expected Closed) and R-dev (Deviation create), and Trade Record issues for R-inc and R-dup, with the restored Trades supplied for derivation', async () => {
    // W7 itself is coherent.
    expect(await preparation.validate(recordSourceOf({ trades: exported() }))).toEqual({ issues: [], repairs: [] });

    // R-lc: a Closed Trade stored as Open. R-dev: an Open Trade's recorded Entry Size occurrence removed.
    const repaired = exported();
    tradeOf(repaired, 'fx-0145')['lifecycle'] = 'Open';
    delete tradeOf(repaired, 'fx-0075')['deviations'];
    const result = await preparation.validate(recordSourceOf({ trades: repaired }));
    expect(result.issues).toEqual([]);
    expect(result.repairs.map((r) => [r.code, r.tradeId, r.expectedLifecycle])).toEqual([
      ['StoredStateDisagreement', 'fx-0075', 'Open'],
      ['StoredStateDisagreement', 'fx-0145', 'Closed'],
    ]);
    const lifecycle = result.repairs.find((r) => r.tradeId === 'fx-0145')!;
    expect(lifecycle.findings.map((f) => f.kind)).toEqual(['LifecycleDisagreement']);
    expect(result.repairs.find((r) => r.tradeId === 'fx-0075')!.deviationActions.map((a) => a.kind)).toEqual(['Create']);

    // R-inc: an Execution naming an unknown Planned Leg. R-dup: one fact identity used by two Executions.
    const broken = exported();
    const incoherent = factsOf(tradeOf(broken, 'fx-0092'));
    incoherent.find((f) => f.kind === 'Execution')!.versions[0]!.value['intent'] = { kind: 'ServesPlannedLeg', plannedLegId: 'no-such-leg' };
    const duplicated = tradeOf(broken, 'fx-0117')['facts'] as { factId: string; kind: string; versions: { value: { memberIds?: string[] } }[] }[];
    const executions = duplicated.filter((f) => f.kind === 'Execution');
    const changes = duplicated.filter((f) => f.kind === 'PositionChange');
    changes[1]!.versions[0]!.value.memberIds = [executions[0]!.factId];
    executions[1]!.factId = executions[0]!.factId;
    const rejected = await preparation.validate(recordSourceOf({ trades: broken }));
    // The duplicated Execution also leaves fx-0117's facts unreplayable, so that Trade reports both.
    expect(rejected.issues.map((i) => [i.code, i.tradeId])).toEqual(
      expect.arrayContaining([
        ['IncoherentFacts', 'fx-0092'],
        ['DuplicateFactIdentity', 'fx-0117'],
      ]),
    );
    expect(rejected.issues.every((i) => i.tradeId === 'fx-0092' || i.tradeId === 'fx-0117')).toBe(true);
    expect(rejected.repairs).toEqual([]);
  });
});

describe('applyPreparedRestore recheck (A135)', () => {
  it('should accept a candidate section whose counts and digest equal those recorded in the candidate meta, and return CandidateChanged naming trades when one Trade was removed from the candidate after preparation', async () => {
    const candidate = exported();
    const recorded = await measureCandidateSection(recordSourceOf({ trades: candidate }));
    expect(recorded.counts).toEqual({ trades: candidate.length });
    // The same records read in other batch sizes give the same digest.
    expect(await measureCandidateSection(recordSourceOf({ trades: candidate }, 7))).toEqual(recorded);
    expect(await applyPreparedRestore(recordSourceOf({ trades: candidate }), recorded)).toEqual({ kind: 'Accepted' });

    expect(await applyPreparedRestore(recordSourceOf({ trades: candidate.slice(1) }), recorded)).toEqual({ kind: 'CandidateChanged', store: 'trades' });
    // A changed field with the same count is caught by the digest.
    const edited = exported();
    edited[0]!['lifecycle'] = 'Closed';
    expect(await applyPreparedRestore(recordSourceOf({ trades: edited }), recorded)).toEqual({ kind: 'CandidateChanged', store: 'trades' });
  });
});
