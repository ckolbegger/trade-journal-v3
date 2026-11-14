import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ExportBatch } from '../../persistence/export-snapshot.ts';
import { exportSnapshot } from './export.ts';

// W7's observation records, as stored, with the `revision` write stamp.
const dump = JSON.parse(readFileSync('tests/fixtures/workspace-v7/dump.json', 'utf8')) as {
  databases: Record<string, { stores: Record<string, { records: Record<string, unknown>[] }> }>;
};
const stored = dump.databases['tj-ws-fx-0013']!.stores['observations']!.records;

function batchesOf(records: readonly Record<string, unknown>[], size = 3): ExportBatch[] {
  const batches: ExportBatch[] = [];
  for (let i = 0; i < records.length; i += size) batches.push({ store: 'observations', records: records.slice(i, i + size) });
  return batches;
}

describe('Market Data section', () => {
  it('should emit every observation record with its Mark and acknowledgment chains, effective heads, and resolutionRevision, including W7 Marks of 0', () => {
    const batches = batchesOf(stored).map((batch) => exportSnapshot(batch)!);
    expect(batches.every((b) => b.section === 'marketData' && b.store === 'observations')).toBe(true);
    const emitted = batches.flatMap((b) => b.records);
    expect(emitted).toEqual(stored.map((record) => Object.fromEntries(Object.entries(record).filter(([name]) => name !== 'revision'))));
    for (const record of emitted) expect(record).not.toHaveProperty('revision');
    // A corrected chain keeps both Marks and its effective head; resolutionRevision stays in the record.
    const corrected = emitted.find((r) => r['instrumentKey'] === 'KO')!;
    expect(corrected).toMatchObject({ effectiveMarkId: 'fx-0108', resolutionRevision: 2 });
    expect(corrected['marks']).toHaveLength(2);
    // The observation with no Mark at all (W7's zero-Mark chain) is emitted with its acknowledgment chain.
    const markless = emitted.find((r) => r['instrumentKey'] === 'PFE' && r['marks'] instanceof Array && r['marks'].length === 0)!;
    expect(markless).toMatchObject({ effectiveMarkId: null, effectiveAcknowledgmentId: 'fx-0110', acknowledgments: [{ versionId: 'fx-0110' }] });
    // Each chain reports its data kind (A126).
    expect(new Set(batches.flatMap((b) => b.footprint))).toEqual(new Set(['marketData.mark', 'marketData.acknowledgment']));
    expect(exportSnapshot({ store: 'observations', records: [stored[0]!] })!.footprint).toEqual(['marketData.mark']);
  });
});
