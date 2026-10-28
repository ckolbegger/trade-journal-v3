import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createSessionPolicy, nyseSessionPolicy } from '../../domain/session-policy/index.ts';
import { NYSE_TABLE } from '../../domain/session-policy/table.ts';
import { fixedClock } from '../../domain/time/index.ts';
import { createPersistence } from '../../persistence/index.ts';
import { countRequests } from '../../../tests/support/request-counter.ts';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import { createMarketData, type MarketDataSaveCommand } from './index.ts';

// T4.6: ResolveFrames, Stale context, snapshot binding, ExpectedSnapshot (D4 A38, A45, A47, A53; AC-MARK-001).

// Tuesday 2026-10-13 12:00 America/New_York.
const TUESDAY_NOON = '2026-10-13T16:00:00Z';

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

const mark = (instrumentKey: string, tradingDate: string, price = '52'): MarketDataSaveCommand => ({
  intention: 'RecordInitialManualMark',
  instrumentKey,
  tradingDate,
  price,
  expectedResolutionRevision: 'None',
});

const current = (instruments: string[], asOf = TUESDAY_NOON) => ({
  kind: 'ResolveFrames' as const,
  context: { kind: 'Current' as const, asOf },
  instruments,
});

import type { MarketDataQueryResult } from './index.ts';

function framesOf(result: MarketDataQueryResult) {
  if (result.kind !== 'Frames') throw new Error(`expected frames, got ${result.kind}`);
  return result.frames;
}

describe('Current and Review contexts', () => {
  it('should resolve the Expected Mark Date from the as-of instant and return one point frame per Instrument with its date, close instant, and next completed session', async () => {
    const { marketData } = await setup();
    await marketData.save(mark('XYZ', '2026-10-12'));
    const result = await marketData.query(current(['XYZ', 'ABC']));
    expect(result).toMatchObject({
      kind: 'Frames',
      frames: [
        { instrumentKey: 'ABC', tradingDate: '2026-10-12', closeInstant: '2026-10-12T20:00:00Z' },
        { instrumentKey: 'XYZ', tradingDate: '2026-10-12', closeInstant: '2026-10-12T20:00:00Z' },
      ],
    });
    // Tuesday's session is not yet completed at noon, so the frames carry no next session.
    if (result.kind !== 'Frames') throw new Error('expected frames');
    for (const frame of result.frames) expect(frame).not.toHaveProperty('nextSession');
  });

  it('should return Available for XYZ at Tuesday noon when a Monday Mark exists, for AC-MARK-001', async () => {
    const { marketData } = await setup();
    await marketData.save(mark('XYZ', '2026-10-12'));
    const result = await marketData.query(current(['XYZ']));
    expect(result).toMatchObject({
      kind: 'Frames',
      frames: [
        {
          instrumentKey: 'XYZ',
          tradingDate: '2026-10-12',
          resolution: { kind: 'Available', mark: { revisionId: 'rev-0001', revisionNumber: 1, price: '52', source: 'Manual' } },
        },
      ],
    });
    expect(framesOf(result)[0]?.resolution).not.toHaveProperty('stale');
  });

  it('should return Missing for 2026-10-12 with Stale context 2026-10-09, 51.20, its revision, its close instant when only a Friday Mark exists, and Missing without Stale context when there is no earlier Mark', async () => {
    const { marketData } = await setup();
    await marketData.save(mark('XYZ', '2026-10-09', '51.20'));
    const result = await marketData.query(current(['XYZ', 'ABC']));
    if (result.kind !== 'Frames') throw new Error('expected frames');
    expect(result.frames.map((f) => [f.instrumentKey, f.resolution])).toEqual([
      ['ABC', { kind: 'Missing' }],
      [
        'XYZ',
        {
          kind: 'Missing',
          stale: { tradingDate: '2026-10-09', price: '51.2', revisionId: 'rev-0001', revisionNumber: 1, closeInstant: '2026-10-09T20:00:00Z' },
        },
      ],
    ]);
  });

  it('should return AcknowledgedUnavailable with Stale context for an acknowledged key', async () => {
    const { marketData } = await setup();
    await marketData.save(mark('DEF', '2026-10-09', '51.20'));
    await marketData.save({ intention: 'AssertUnavailable', instrumentKey: 'DEF', tradingDate: '2026-10-12', reason: 'Halted', expectedResolutionRevision: 'None' });
    const result = await marketData.query(current(['DEF']));
    expect(result).toMatchObject({
      kind: 'Frames',
      frames: [
        {
          resolution: {
            kind: 'AcknowledgedUnavailable',
            acknowledgment: { versionId: 'rev-0002', kind: 'Asserted', reason: 'Halted' },
            stale: { tradingDate: '2026-10-09', price: '51.2', revisionId: 'rev-0001' },
          },
        },
      ],
    });
  });

  it('should give Stale context from the latest earlier session Mark when a stored key holds a malformed date', async () => {
    const { marketData, persistence } = await setup();
    await marketData.save(mark('XYZ', '2026-01-05', '51.20'));
    const forged = {
      instrumentKey: 'XYZ',
      tradingDate: '2026-02-30',
      resolutionRevision: 1,
      marks: [{ revisionId: 'm-forged', revisionNumber: 1, price: '10', source: 'Manual', intention: 'InitialManual', observedAt: TUESDAY_NOON, savedAt: TUESDAY_NOON }],
      effectiveMarkId: 'm-forged',
      acknowledgments: [],
      effectiveAcknowledgmentId: null,
    };
    const committed = await persistence.commit({ checks: [], writes: [{ op: 'put', store: 'observations', value: forged }] });
    if (committed.kind !== 'Committed') throw new Error('seed failed');
    const result = await marketData.query(current(['XYZ']));
    expect(framesOf(result)[0]?.resolution).toMatchObject({ kind: 'Missing', stale: { tradingDate: '2026-01-05', price: '51.2', revisionId: 'rev-0001' } });
  });

  it('should never select a Mark from another date as the exact Mark, and select the corrected revision after a correction', async () => {
    const { marketData } = await setup();
    await marketData.save(mark('XYZ', '2026-10-09', '51.20'));
    await marketData.save(mark('ABC', '2026-10-12', '10'));
    const before = await marketData.query(current(['XYZ', 'ABC']));
    if (before.kind !== 'Frames') throw new Error('expected frames');
    expect(before.frames.map((f) => [f.instrumentKey, f.resolution.kind])).toEqual([['ABC', 'Available'], ['XYZ', 'Missing']]);
    expect(before.frames[1]?.resolution).not.toHaveProperty('mark');
    await marketData.save({
      intention: 'CorrectMark',
      instrumentKey: 'ABC',
      tradingDate: '2026-10-12',
      price: '11',
      reason: 'Typo',
      expectedResolutionRevision: 1,
    });
    const after = await marketData.query(current(['ABC']));
    expect(after).toMatchObject({ frames: [{ resolution: { kind: 'Available', mark: { revisionId: 'rev-0003', revisionNumber: 2, price: '11' } } }] });
  });

  it('should give the frame Mark its save time and correction reason from Market Data', async () => {
    const { marketData } = await setup();
    await marketData.save(mark('ABC', '2026-10-12', '10'));
    const initial = framesOf(await marketData.query(current(['ABC'])))[0]?.resolution;
    expect(initial).toMatchObject({ kind: 'Available', mark: { savedAt: TUESDAY_NOON } });
    expect(initial).not.toHaveProperty('mark.correctionReason');
    await marketData.save({ intention: 'CorrectMark', instrumentKey: 'ABC', tradingDate: '2026-10-12', price: '11', reason: 'Typo', expectedResolutionRevision: 1 });
    const corrected = framesOf(await marketData.query(current(['ABC'])))[0]?.resolution;
    expect(corrected).toMatchObject({ kind: 'Available', mark: { revisionNumber: 2, savedAt: TUESDAY_NOON, correctionReason: 'Typo' } });
  });

  it('should return the same frames for a Review context naming 2026-10-12 as for the Current context at Tuesday noon', async () => {
    const { marketData } = await setup();
    await marketData.save(mark('XYZ', '2026-10-12'));
    await marketData.save(mark('DEF', '2026-10-09', '51.20'));
    const currentResult = await marketData.query(current(['XYZ', 'DEF']));
    const review = await marketData.query({ kind: 'ResolveFrames', context: { kind: 'Review', reviewDate: '2026-10-12' }, instruments: ['DEF', 'XYZ'] });
    expect(framesOf(review)).toEqual(framesOf(currentResult));
  });

  it('should return SessionPolicyCoverage and no frames when the as-of instant is outside coverage', async () => {
    const { marketData } = await setup();
    const early = await marketData.query(current(['XYZ'], '2023-12-29T21:00:00Z'));
    expect(early).toEqual({ kind: 'Rejected', issues: [{ field: 'asOf', code: 'SessionPolicyCoverage' }] });
    const late = await marketData.query(current(['XYZ'], '2029-01-05T21:00:00Z'));
    expect(late).toEqual({ kind: 'Rejected', issues: [{ field: 'asOf', code: 'SessionPolicyCoverage' }] });
  });

  it('should reject a Current context whose asOf is not an ISO instant with an asOf issue', async () => {
    const { marketData } = await setup();
    for (const asOf of ['not-a-time', '2026-10-13']) {
      const result = await marketData.query(current(['XYZ'], asOf));
      expect(result).toEqual({ kind: 'Rejected', issues: [{ field: 'asOf', code: 'InvalidInstant' }] });
    }
  });
});

describe('Historical point context (A53)', () => {
  const historical = (tradingDate: string, instruments = ['XYZ']) => ({
    kind: 'ResolveFrames' as const,
    context: { kind: 'Historical' as const, tradingDate },
    instruments,
  });

  it('should return Available for XYZ and 2026-10-09 from a Friday Mark when asked at Tuesday noon', async () => {
    const { marketData } = await setup();
    await marketData.save(mark('XYZ', '2026-10-09', '51.20'));
    const result = await marketData.query(historical('2026-10-09'));
    expect(framesOf(result)).toEqual([
      {
        instrumentKey: 'XYZ',
        tradingDate: '2026-10-09',
        closeInstant: '2026-10-09T20:00:00Z',
        nextSession: { tradingDate: '2026-10-12', closeInstant: '2026-10-12T20:00:00Z' },
        resolution: { kind: 'Available', mark: { revisionId: 'rev-0001', revisionNumber: 1, price: '51.2', source: 'Manual', savedAt: TUESDAY_NOON } },
      },
    ]);
  });

  it('should return NotASession for Saturday 2026-10-10 and SessionNotCompleted for Tuesday at Tuesday noon', async () => {
    const { marketData } = await setup();
    expect(await marketData.query(historical('2026-10-10'))).toEqual({ kind: 'Rejected', issues: [{ field: 'tradingDate', code: 'NotASession' }] });
    expect(await marketData.query(historical('2026-10-13'))).toEqual({ kind: 'Rejected', issues: [{ field: 'tradingDate', code: 'SessionNotCompleted' }] });
  });
});

describe('snapshot binding and ExpectedSnapshot', () => {
  it('should return equal MarketDataSnapshotIds and evidence digests for the same evidence and request, whatever the Instrument order', async () => {
    const { marketData } = await setup();
    await marketData.save(mark('XYZ', '2026-10-12'));
    await marketData.save(mark('DEF', '2026-10-09', '51.20'));
    const a = await marketData.query(current(['XYZ', 'DEF', 'ABC']));
    const b = await marketData.query(current(['ABC', 'XYZ', 'DEF', 'XYZ']));
    if (a.kind !== 'Frames' || b.kind !== 'Frames') throw new Error('expected frames');
    expect(a.evidenceDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof a.snapshotId).toBe('string');
    expect(b.snapshotId).toBe(a.snapshotId);
    expect(b.evidenceDigest).toBe(a.evidenceDigest);
    const other = await marketData.query(current(['XYZ', 'DEF']));
    if (other.kind !== 'Frames') throw new Error('expected frames');
    expect(other.evidenceDigest).not.toBe(a.evidenceDigest);
  });

  it('should return equal snapshot ids and digests for contexts with the same fields in a different order', async () => {
    const { marketData } = await setup();
    await marketData.save(mark('XYZ', '2026-10-12'));
    const a = await marketData.query({ kind: 'ResolveFrames', context: { kind: 'Current', asOf: TUESDAY_NOON }, instruments: ['XYZ'] });
    const reordered = { kind: 'ResolveFrames' as const, context: { asOf: TUESDAY_NOON, kind: 'Current' as const }, instruments: ['XYZ'] };
    const b = await marketData.query(reordered);
    if (a.kind !== 'Frames' || b.kind !== 'Frames') throw new Error('expected frames');
    expect(b.snapshotId).toBe(a.snapshotId);
    expect(b.evidenceDigest).toBe(a.evidenceDigest);
    const check = await marketData.query({ ...reordered, expectedSnapshot: a.snapshotId });
    expect(check).toEqual({ kind: 'SnapshotUnchanged', snapshotId: a.snapshotId, evidenceDigest: a.evidenceDigest });
  });

  it('should include the session-policy revision in the binding', async () => {
    const { marketData, persistence } = await setup();
    await marketData.save(mark('XYZ', '2026-10-12'));
    const revised = createMarketData({
      persistence,
      ids: sequentialIds('rev'),
      clock: fixedClock(TUESDAY_NOON),
      sessionPolicy: createSessionPolicy({ id: 'nyse', revision: 2, coverage: nyseSessionPolicy.identity.coverage, table: NYSE_TABLE }),
    });
    const before = await marketData.query(current(['XYZ']));
    const after = await revised.query(current(['XYZ']));
    if (before.kind !== 'Frames' || after.kind !== 'Frames') throw new Error('expected frames');
    expect(after.frames).toEqual(before.frames);
    expect(after.snapshotId).not.toBe(before.snapshotId);
    expect(after.evidenceDigest).not.toBe(before.evidenceDigest);
  });

  it('should return SnapshotUnchanged for the same request when nothing material changed', async () => {
    const { marketData } = await setup();
    await marketData.save(mark('XYZ', '2026-10-12'));
    const first = await marketData.query(current(['XYZ', 'ABC']));
    if (first.kind !== 'Frames') throw new Error('expected frames');
    const check = await marketData.query({ ...current(['ABC', 'XYZ']), expectedSnapshot: first.snapshotId });
    expect(check).toEqual({ kind: 'SnapshotUnchanged', snapshotId: first.snapshotId, evidenceDigest: first.evidenceDigest });
  });

  it('should return SnapshotChanged for a Review context once that date next session completes, and SnapshotUnchanged while it has not', async () => {
    const { marketData, persistence } = await setup();
    await marketData.save(mark('XYZ', '2026-10-12'));
    const at = (now: string) => createMarketData({ persistence, ids: sequentialIds('rev'), clock: fixedClock(now), sessionPolicy: nyseSessionPolicy });
    const review = (expectedSnapshot?: string) => ({
      kind: 'ResolveFrames' as const,
      context: { kind: 'Review' as const, reviewDate: '2026-10-12' },
      instruments: ['XYZ'],
      ...(expectedSnapshot && { expectedSnapshot }),
    });
    const first = await at('2026-10-13T16:00:00Z').query(review());
    if (first.kind !== 'Frames') throw new Error('expected frames');
    // Tuesday 16:00 America/New_York: the session has closed but is not yet completed.
    const notYet = await at('2026-10-13T20:00:00Z').query(review(first.snapshotId));
    expect(notYet.kind).toBe('SnapshotUnchanged');
    // Tuesday 16:30 America/New_York: the next session is completed.
    const done = await at('2026-10-13T20:30:00Z').query(review(first.snapshotId));
    expect(done.kind).toBe('SnapshotChanged');
    if (done.kind !== 'SnapshotChanged') return;
    expect(done.frames[0]).toHaveProperty('nextSession');
  });

  it('should return SnapshotChanged with current frames when a selected Mark, an acknowledgment, a Stale-context Mark, or an absence changed', async () => {
    const { marketData } = await setup();
    await marketData.save(mark('XYZ', '2026-10-12', '52'));
    await marketData.save(mark('GHI', '2026-10-09', '51.20'));
    const changes: [string, () => Promise<unknown>][] = [
      ['selected Mark', () => marketData.save({ intention: 'CorrectMark', instrumentKey: 'XYZ', tradingDate: '2026-10-12', price: '53', reason: 'Typo', expectedResolutionRevision: 1 })],
      ['acknowledgment', () => marketData.save({ intention: 'AssertUnavailable', instrumentKey: 'DEF', tradingDate: '2026-10-12', reason: 'Halted', expectedResolutionRevision: 'None' })],
      ['Stale-context Mark', () => marketData.save({ intention: 'CorrectMark', instrumentKey: 'GHI', tradingDate: '2026-10-09', price: '51.30', reason: 'Typo', expectedResolutionRevision: 1 })],
      ['absence', () => marketData.save(mark('ABC', '2026-10-12', '10'))],
    ];
    for (const [name, change] of changes) {
      const prepared = await marketData.query(current(['XYZ', 'DEF', 'GHI', 'ABC']));
      if (prepared.kind !== 'Frames') throw new Error('expected frames');
      await change();
      const check = await marketData.query({ ...current(['XYZ', 'DEF', 'GHI', 'ABC']), expectedSnapshot: prepared.snapshotId });
      const fresh = await marketData.query(current(['XYZ', 'DEF', 'GHI', 'ABC']));
      if (fresh.kind !== 'Frames') throw new Error('expected frames');
      expect(check, name).toEqual({ ...fresh, kind: 'SnapshotChanged' });
      expect(fresh.snapshotId, name).not.toBe(prepared.snapshotId);
    }
  });
});

describe('bounded reads (A47)', () => {
  it('should read all exact-date observations with one request and Stale context with one request per Missing Instrument, whether each Instrument has 10 or 1,000 earlier Marks', async () => {
    // A policy covering 2020 on, so 1,000 earlier sessions exist.
    const longPolicy = createSessionPolicy({ id: 'nyse', revision: 1, coverage: { first: '2020-01-01', last: '2028-12-31' }, table: NYSE_TABLE });
    const countsFor = async (earlier: number) => {
      const { persistence } = await setup();
      const marketData = createMarketData({ persistence, ids: sequentialIds('rev'), clock: fixedClock(TUESDAY_NOON), sessionPolicy: longPolicy });
      const records: Record<string, unknown>[] = [];
      let date = '2026-10-09';
      const dates: string[] = [];
      for (let n = 0; n < earlier; n++) {
        dates.push(date);
        const previous = longPolicy.previousSession(date);
        if (!previous.ok) throw new Error('coverage');
        date = previous.value.date;
      }
      for (const instrumentKey of ['AAA', 'BBB']) {
        for (const tradingDate of dates) {
          records.push({
            instrumentKey,
            tradingDate,
            resolutionRevision: 1,
            marks: [{ revisionId: `m-${instrumentKey}-${tradingDate}`, revisionNumber: 1, price: '10', source: 'Manual', intention: 'InitialManual', observedAt: TUESDAY_NOON, savedAt: TUESDAY_NOON }],
            effectiveMarkId: `m-${instrumentKey}-${tradingDate}`,
            acknowledgments: [],
            effectiveAcknowledgmentId: null,
          });
        }
      }
      const committed = await persistence.commit({ checks: [], writes: records.map((value) => ({ op: 'put' as const, store: 'observations' as const, value })) });
      if (committed.kind !== 'Committed') throw new Error('seed failed');
      await marketData.save(mark('XYZ', '2026-10-12'));
      const { result, requests } = await countRequests(() => marketData.query(current(['AAA', 'BBB', 'XYZ'])));
      expect(framesOf(result).map((f) => f.resolution.kind)).toEqual(['Missing', 'Missing', 'Available']);
      return requests.filter((r) => r.store === 'observations');
    };
    const small = await countsFor(10);
    const large = await countsFor(1000);
    expect(large).toEqual(small);
    expect(small).toEqual([
      { on: 'store', store: 'observations', method: 'getAll' },
      { on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'openCursor' },
      { on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'openCursor' },
    ]);
  });
});

describe('ResolveSession (T4.14: Daily Review resolves its date through Market Data)', () => {
  it('should resolve the latest completed session at an as-of instant to its trading date and close, and reject an instant outside coverage', async () => {
    const { marketData } = await setup();
    // Monday 16:15 New York: the session closed at 16:00 but completes at 16:30, so Friday is still the latest completed.
    expect(await marketData.query({ kind: 'ResolveSession', context: { kind: 'Current', asOf: '2026-10-12T20:15:00Z' } })).toEqual({
      kind: 'Session',
      tradingDate: '2026-10-09',
      closeInstant: '2026-10-09T20:00:00Z',
    });
    expect(await marketData.query({ kind: 'ResolveSession', context: { kind: 'Current', asOf: '2026-10-12T20:30:00Z' } })).toEqual({
      kind: 'Session',
      tradingDate: '2026-10-12',
      closeInstant: '2026-10-12T20:00:00Z',
    });
    const outside = await marketData.query({ kind: 'ResolveSession', context: { kind: 'Current', asOf: '2020-01-02T21:00:00Z' } });
    expect(outside).toEqual({ kind: 'Rejected', issues: [{ field: 'asOf', code: 'SessionPolicyCoverage' }] });
  });
});
