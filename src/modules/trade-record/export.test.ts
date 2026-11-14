import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ExportBatch } from '../../persistence/export-snapshot.ts';
import { exportSnapshot } from './export.ts';

// W7's Trades, as stored: private index fields and the `revision` write stamp included.
const dump = JSON.parse(readFileSync('tests/fixtures/workspace-v7/dump.json', 'utf8')) as {
  databases: Record<string, { stores: Record<string, { records: Record<string, unknown>[] }> }>;
};
const stores = dump.databases['tj-ws-fx-0013']!.stores;
const stored = stores['trades']!.records;

function batchesOf(records: readonly Record<string, unknown>[], size = 5): ExportBatch[] {
  const batches: ExportBatch[] = [];
  for (let i = 0; i < records.length; i += size) batches.push({ store: 'trades', records: records.slice(i, i + size) });
  return batches;
}

const without = (record: Record<string, unknown>, fields: readonly string[]) => Object.fromEntries(Object.entries(record).filter(([name]) => !fields.includes(name)));
const REMOVED = ['revision', 'exposureStart', 'terminalTime', 'activityDesc', 'terminalDesc'];

describe('Trade Record section (A125, D7 review-queue item 1)', () => {
  it('should emit every Trade document in key order with each fact identity and its version list, Recorded Sequence, stored lifecycle record, recorded Deviation occurrence, Close Reason, Exercise Intent, option Instrument, and Expiration member, and without exposureStart, terminalTime, activityDesc, terminalDesc, or revision', () => {
    const emitted = batchesOf(stored).flatMap((batch) => exportSnapshot(batch)!.records);
    expect(emitted.map((r) => r['tradeId'])).toEqual(stored.map((r) => r['tradeId']));
    expect(emitted).toEqual(stored.map((record) => without(record, REMOVED)));
    for (const record of emitted) for (const field of REMOVED) expect(record).not.toHaveProperty(field);
    // W7 exercises each kind of history the section must carry.
    const text = JSON.stringify(emitted);
    for (const needle of ['"kind":"Expiration"', '"closeReasonFacts"', '"deviations"', '"exerciseIntent"', '"kind":"Option"', '"recordedSequence"', '"lifecycle"']) expect(text).toContain(needle);
    // The private fields really were in the input.
    for (const field of REMOVED) expect(stored.some((r) => field in r)).toBe(true);
  });

  it('should report the footprint instrument.stock, instrument.option, positionChange.execution, positionChange.expiration, plan.exerciseIntent, condition.structureValue, trade.closeReason, and trade.deviation.entrySize for W7', () => {
    const footprint = new Set(batchesOf(stored).flatMap((batch) => exportSnapshot(batch)!.footprint));
    expect([...footprint].sort()).toEqual(
      [
        'instrument.stock',
        'instrument.option',
        'positionChange.execution',
        'positionChange.expiration',
        'plan.exerciseIntent',
        'condition.structureValue',
        'trade.closeReason',
        'trade.deviation.entrySize',
      ].sort(),
    );
  });

  it('should find an option Instrument on any leg or fact of a Trade, not only the first', () => {
    const leg = (factId: string, instrument: object) => ({ factId, kind: 'PlannedLeg', recordedSequence: 1, versions: [{ versionNumber: 1, value: { instrument } }] });
    const trade = { tradeId: 'T', facts: [leg('a', { kind: 'Stock', symbol: 'X' }), leg('b', { kind: 'Stock', symbol: 'Y' }), leg('c', { kind: 'Option', symbol: 'Z' })] };
    expect(exportSnapshot({ store: 'trades', records: [trade] })!.footprint).toEqual(['instrument.option', 'instrument.stock']);
  });
});
