import { describe, expect, it } from 'vitest';
import { nyseSessionPolicy } from '../../domain/session-policy/index.ts';
import { fixedClock } from '../../domain/time/index.ts';
import { beginSemanticTransaction, createPersistence } from '../../persistence/index.ts';
import { IDBFactory } from 'fake-indexeddb';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import { createMarketData, type MarketDataPrepareEntry, type PreparedMarketDataEffect } from './index.ts';
import { resolve, type ObservationRecord } from './records.ts';

// T5R.1: Market Data prepareEffects and applyPreparedEffects (D5R P37, A154, A163).

// Tuesday 2026-10-13 12:00 America/New_York: Monday 2026-10-12 is completed, with no Monday Marks.
const TUESDAY_NOON = '2026-10-13T16:00:00Z';
const MONDAY = '2026-10-12';

async function setup(now = TUESDAY_NOON) {
  const persistence = createPersistence({
    indexedDB: new IDBFactory(),
    ids: sequentialIds('ws'),
    writeGate: { current: () => null, recheck: () => Promise.resolve(null) },
    sessionPolicy: { ...nyseSessionPolicy.identity },
  });
  const created = await persistence.createWorkspace([]);
  if (created.kind !== 'Created') throw new Error('workspace not created');
  const marketData = createMarketData({ persistence, ids: sequentialIds('rev'), clock: fixedClock(now), sessionPolicy: nyseSessionPolicy });
  return { marketData, persistence };
}

type Fixture = Awaited<ReturnType<typeof setup>>;

async function stored(persistence: Fixture['persistence']) {
  const { value } = await persistence.readSnapshot(['meta', 'observations'], async (tx) => ({
    observations: (await tx.getAll('observations')) as unknown as (ObservationRecord & { revision: number })[],
    content: (await tx.get('meta', 'content'))?.['contentRevision'],
  }));
  return value;
}

const mark = (instrumentKey: string, price: string, overrides: Partial<MarketDataPrepareEntry> = {}): MarketDataPrepareEntry => ({
  key: { instrumentKey, tradingDate: MONDAY },
  expectedRevision: 'None',
  intention: { kind: 'RecordInitialManualMark', price },
  ...overrides,
});

const unavailable = (instrumentKey: string, reason: string, overrides: Partial<MarketDataPrepareEntry> = {}): MarketDataPrepareEntry => ({
  key: { instrumentKey, tradingDate: MONDAY },
  expectedRevision: 'None',
  intention: { kind: 'AssertUnavailable', reason },
  ...overrides,
});

async function prepared(marketData: Fixture['marketData'], entries: MarketDataPrepareEntry[]): Promise<PreparedMarketDataEffect> {
  const result = await marketData.prepareEffects({ entries });
  if (result.kind !== 'Prepared') throw new Error(`expected Prepared, got ${result.kind}`);
  return result;
}

describe('prepareEffects (P37, A154)', () => {
  it('should return a prepared effect for initial Manual Marks on XYZ, ABC, and JKL for 2026-10-12, holding each new record and the resolution, revision, and classification each key will report, and write nothing', async () => {
    const { marketData, persistence } = await setup();
    const before = await stored(persistence);
    const result = await marketData.prepareEffects({ entries: [mark('XYZ', '52.000'), mark('ABC', '27.5'), mark('JKL', '21')] });
    if (result.kind !== 'Prepared') throw new Error(`expected Prepared, got ${result.kind}`);
    expect(result.entries.map((e) => e.key)).toEqual([
      { instrumentKey: 'XYZ', tradingDate: MONDAY },
      { instrumentKey: 'ABC', tradingDate: MONDAY },
      { instrumentKey: 'JKL', tradingDate: MONDAY },
    ]);
    const [xyz, abc, jkl] = result.entries;
    expect(xyz).toMatchObject({
      resolutionRevision: 1,
      classification: 'InitialManual',
      resolution: { kind: 'Available', mark: { revisionId: 'rev-0001', revisionNumber: 1, price: '52', source: 'Manual', savedAt: TUESDAY_NOON } },
      revision: { revisionId: 'rev-0001', revisionNumber: 1, price: '52', source: 'Manual', intention: 'InitialManual', observedAt: TUESDAY_NOON, savedAt: TUESDAY_NOON },
      record: {
        instrumentKey: 'XYZ',
        tradingDate: MONDAY,
        resolutionRevision: 1,
        effectiveMarkId: 'rev-0001',
        marks: [{ revisionId: 'rev-0001', price: '52' }],
        acknowledgments: [],
        effectiveAcknowledgmentId: null,
      },
    });
    expect(abc?.resolution).toMatchObject({ kind: 'Available', mark: { revisionId: 'rev-0002', price: '27.5' } });
    expect(jkl?.resolution).toMatchObject({ kind: 'Available', mark: { revisionId: 'rev-0003', price: '21' } });
    expect(await stored(persistence)).toEqual(before);
  });

  it('should prepare an acknowledgment for DEF with its reason alongside the Marks', async () => {
    const { marketData, persistence } = await setup();
    const before = await stored(persistence);
    const result = await marketData.prepareEffects({ entries: [mark('XYZ', '52'), unavailable('DEF', '  Vendor has no close  ')] });
    if (result.kind !== 'Prepared') throw new Error(`expected Prepared, got ${result.kind}`);
    const [xyz, def] = result.entries;
    expect(xyz).toMatchObject({ classification: 'InitialManual', resolution: { kind: 'Available' } });
    const acknowledgment = { versionId: 'rev-0002', kind: 'Asserted', reason: 'Vendor has no close', savedAt: TUESDAY_NOON };
    expect(def).toMatchObject({
      key: { instrumentKey: 'DEF', tradingDate: MONDAY },
      classification: 'Asserted',
      resolutionRevision: 1,
      acknowledgment,
      resolution: { kind: 'AcknowledgedUnavailable', acknowledgment },
      record: { instrumentKey: 'DEF', resolutionRevision: 1, marks: [], effectiveMarkId: null, acknowledgments: [acknowledgment], effectiveAcknowledgmentId: 'rev-0002' },
    });
    expect(await stored(persistence)).toEqual(before);
  });

  it('should return the issues of every entry at once, keyed by entry index and field, and write nothing, for an invalid price, a negative price, and an acknowledgment without a reason', async () => {
    const { marketData, persistence } = await setup();
    const before = await stored(persistence);
    const result = await marketData.prepareEffects({
      entries: [mark('XYZ', 'abc'), mark('ABC', '-5'), unavailable('DEF', '   '), mark('JKL', '21'), mark('xyz!', '3', { key: { instrumentKey: 'xyz!', tradingDate: '2026-10-11' } })],
    });
    expect(result).toEqual({
      kind: 'Rejected',
      issues: [
        { entryIndex: 0, field: 'price', code: 'InvalidPrice' },
        { entryIndex: 1, field: 'price', code: 'PriceNegative' },
        { entryIndex: 2, field: 'reason', code: 'ReasonRequired' },
        { entryIndex: 4, field: 'instrumentKey', code: 'InvalidInstrument' },
        { entryIndex: 4, field: 'tradingDate', code: 'NotASession' },
      ],
    });
    expect(await stored(persistence)).toEqual(before);
  });

  it('should reject two entries for the same key with DuplicateKey and more than 100 entries with TooManyEntries', async () => {
    const { marketData, persistence } = await setup();
    const before = await stored(persistence);
    const duplicate = await marketData.prepareEffects({ entries: [mark('XYZ', '52'), mark('ABC', '27.5'), unavailable('XYZ', 'No close')] });
    expect(duplicate).toEqual({ kind: 'Rejected', issues: [{ entryIndex: 2, field: 'key', code: 'DuplicateKey' }] });
    const hundred = Array.from({ length: 100 }, (_, i) => mark(`S${i}`, '10'));
    expect((await marketData.prepareEffects({ entries: hundred })).kind).toBe('Prepared');
    const tooMany = await marketData.prepareEffects({ entries: [...hundred, mark('S100', '10')] });
    expect(tooMany).toEqual({ kind: 'Rejected', issues: [{ field: 'entries', code: 'TooManyEntries' }] });
    expect(await stored(persistence)).toEqual(before);
  });

  it('should return Conflict naming each key whose resolution revision differs from the expected one, with its current resolution, and MarkExists for an acknowledgment whose key already has an exact Mark', async () => {
    const { marketData, persistence } = await setup();
    const xyz = await marketData.save({ intention: 'RecordInitialManualMark', instrumentKey: 'XYZ', tradingDate: MONDAY, price: '52', expectedResolutionRevision: 'None' });
    const abc = await marketData.save({ intention: 'RecordInitialManualMark', instrumentKey: 'ABC', tradingDate: MONDAY, price: '27.5', expectedResolutionRevision: 'None' });
    if (xyz.kind !== 'Saved' || abc.kind !== 'Saved') throw new Error('setup Marks not saved');
    const before = await stored(persistence);
    const result = await marketData.prepareEffects({
      entries: [mark('XYZ', '53'), mark('JKL', '21'), unavailable('ABC', 'No close', { expectedRevision: 1 }), unavailable('DEF', 'No close', { expectedRevision: 3 })],
    });
    expect(result).toEqual({
      kind: 'Conflict',
      keys: [
        { entryIndex: 0, key: { instrumentKey: 'XYZ', tradingDate: MONDAY }, code: 'StaleRevision', resolution: xyz.resolution, resolutionRevision: 1 },
        { entryIndex: 2, key: { instrumentKey: 'ABC', tradingDate: MONDAY }, code: 'MarkExists', resolution: abc.resolution, resolutionRevision: 1 },
        { entryIndex: 3, key: { instrumentKey: 'DEF', tradingDate: MONDAY }, code: 'StaleRevision', resolution: { kind: 'Missing' }, resolutionRevision: 'None' },
      ],
    });
    expect(await stored(persistence)).toEqual(before);
  });
});

describe('applyPreparedEffects', () => {
  it('should stage one revision check and one observations write per key in the transaction of the caller, so one commit writes every record, each equal to the resolution the prepared effect reported (AC-RESP-001)', async () => {
    const { marketData, persistence } = await setup();
    const before = await stored(persistence);
    const effect = await prepared(marketData, [mark('XYZ', '52'), mark('ABC', '27.5'), mark('JKL', '21'), unavailable('DEF', 'No close')]);
    const tx = beginSemanticTransaction();
    marketData.applyPreparedEffects(tx, effect);
    const { checks, writes } = tx.close();
    expect(checks.map((c) => [c.store, c.key])).toEqual([
      ['observations', [MONDAY, 'XYZ']],
      ['observations', [MONDAY, 'ABC']],
      ['observations', [MONDAY, 'JKL']],
      ['observations', [MONDAY, 'DEF']],
    ]);
    expect(writes.map((w) => [w.op, w.store])).toEqual(Array(4).fill(['put', 'observations']));
    expect((await stored(persistence)).observations).toEqual([]);
    const committed = await persistence.commit({ checks, writes });
    expect(committed.kind).toBe('Committed');
    const after = await stored(persistence);
    expect(after.content).toBe((before.content as number) + 1);
    expect(after.observations).toHaveLength(4);
    for (const entry of effect.entries) {
      const record = after.observations.find((o) => o.instrumentKey === entry.key.instrumentKey)!;
      expect(record).toEqual(expect.objectContaining(entry.record));
      expect(resolve(record)).toEqual(entry.resolution);
    }
  });

  it('should fail the commit of the caller with Conflict, writing no record for any key, when one key resolution revision moved after preparation', async () => {
    const { marketData, persistence } = await setup();
    const effect = await prepared(marketData, [mark('XYZ', '52'), mark('ABC', '27.5')]);
    const moved = await marketData.save({ intention: 'RecordInitialManualMark', instrumentKey: 'ABC', tradingDate: MONDAY, price: '28', expectedResolutionRevision: 'None' });
    expect(moved.kind).toBe('Saved');
    const before = await stored(persistence);
    const tx = beginSemanticTransaction();
    marketData.applyPreparedEffects(tx, effect);
    const { checks, writes } = tx.close();
    const committed = await persistence.commit({ checks, writes });
    expect(committed).toEqual({ kind: 'Conflict', binding: `observation@${MONDAY}/ABC` });
    expect(await stored(persistence)).toEqual(before);
    expect(before.observations.map((o) => o.instrumentKey)).toEqual(['ABC']);
  });
});

describe('save, rebuilt on prepare and apply', () => {
  it('should record, correct, acknowledge, and withdraw a single key with the results D4 defined, through the prepared path', async () => {
    const { marketData, persistence } = await setup();
    // `save` reaches the pair through the module object, so a wrapper sees every call it makes.
    const prepares: MarketDataPrepareEntry[][] = [];
    const applies: PreparedMarketDataEffect[] = [];
    const prepareEffects = marketData.prepareEffects.bind(marketData);
    const applyPreparedEffects = marketData.applyPreparedEffects.bind(marketData);
    marketData.prepareEffects = (request) => {
      prepares.push([...request.entries]);
      return prepareEffects(request);
    };
    marketData.applyPreparedEffects = (tx, effect) => {
      applies.push(effect);
      applyPreparedEffects(tx, effect);
    };
    const key = { instrumentKey: 'XYZ', tradingDate: MONDAY };

    const recorded = await marketData.save({ intention: 'RecordInitialManualMark', ...key, price: '52.000', expectedResolutionRevision: 'None' });
    expect(recorded).toMatchObject({ kind: 'Saved', key, resolutionRevision: 1, classification: 'InitialManual', revision: { revisionId: 'rev-0001', price: '52' }, binding: { ...key, expectedResolutionRevision: 'None' } });
    const corrected = await marketData.save({ intention: 'CorrectMark', ...key, price: '51.5', reason: 'Typo', expectedResolutionRevision: 1 });
    expect(corrected).toMatchObject({ kind: 'Saved', resolutionRevision: 2, classification: 'Correction', revision: { revisionNumber: 2, reason: 'Typo', supersedes: 'rev-0001' } });
    const def = { instrumentKey: 'DEF', tradingDate: MONDAY };
    const asserted = await marketData.save({ intention: 'AssertUnavailable', ...def, reason: 'No close', expectedResolutionRevision: 'None' });
    expect(asserted).toMatchObject({ kind: 'Saved', resolutionRevision: 1, classification: 'Asserted', resolution: { kind: 'AcknowledgedUnavailable' }, acknowledgment: { versionId: 'rev-0003', reason: 'No close' } });
    const withdrawn = await marketData.save({ intention: 'WithdrawAcknowledgment', ...def, expectedResolutionRevision: 1 });
    expect(withdrawn).toMatchObject({ kind: 'Saved', resolutionRevision: 2, classification: 'Withdrawn', resolution: { kind: 'Missing' } });

    expect(prepares.map((entries) => entries.map((e) => [e.key.instrumentKey, e.intention.kind, e.expectedRevision]))).toEqual([
      [['XYZ', 'RecordInitialManualMark', 'None']],
      [['XYZ', 'CorrectMark', 1]],
      [['DEF', 'AssertUnavailable', 'None']],
      [['DEF', 'WithdrawAcknowledgment', 1]],
    ]);
    expect(applies.map((effect) => effect.entries.map((e) => e.classification))).toEqual([['InitialManual'], ['Correction'], ['Asserted'], ['Withdrawn']]);

    const { observations } = await stored(persistence);
    expect(observations.map((o) => [o.instrumentKey, o.resolutionRevision])).toEqual([['DEF', 2], ['XYZ', 2]]);
    expect(resolve(observations.find((o) => o.instrumentKey === 'XYZ'))).toEqual(corrected.kind === 'Saved' ? corrected.resolution : undefined);
  });
});
