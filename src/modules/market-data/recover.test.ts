import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createSessionPolicy, nyseSessionPolicy } from '../../domain/session-policy/index.ts';
import { NYSE_TABLE } from '../../domain/session-policy/table.ts';
import { fixedClock } from '../../domain/time/index.ts';
import { createPersistence } from '../../persistence/index.ts';
import { countRequests } from '../../../tests/support/request-counter.ts';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import { createMarketData, type MarketDataSaveCommand } from './index.ts';

// T4.7: recover without a provider (D4 A56, A47; P10, P15; AC-MARK-004, AC-MARK-005).

// Tuesday 2026-10-13 12:00 America/New_York: the Review Date 2026-10-12 is completed.
const TUESDAY_NOON = '2026-10-13T16:00:00Z';
// Wednesday 2026-10-07 10:00 and Monday 2026-10-12 10:00 America/New_York.
const MNO_OPENED = '2026-10-07T14:00:00Z';
const XYZ_PC1 = '2026-10-12T14:00:00Z';
// Wednesday 2026-10-14 12:00: the Review Date 2026-10-13 is completed.
const WEDNESDAY_NOON = '2026-10-14T16:00:00Z';

async function setup(now = TUESDAY_NOON, sessionPolicy = nyseSessionPolicy) {
  const persistence = createPersistence({
    indexedDB: new IDBFactory(),
    ids: sequentialIds('ws'),
    writeGate: { current: () => null, recheck: () => Promise.resolve(null) },
    sessionPolicy: { ...nyseSessionPolicy.identity },
  });
  const created = await persistence.createWorkspace([]);
  if (created.kind !== 'Created') throw new Error('workspace not created');
  const marketData = createMarketData({ persistence, ids: sequentialIds('rev'), clock: fixedClock(now), sessionPolicy });
  return { marketData, persistence };
}

const mark = (instrumentKey: string, tradingDate: string, price = '52'): MarketDataSaveCommand => ({
  intention: 'RecordInitialManualMark',
  instrumentKey,
  tradingDate,
  price,
  expectedResolutionRevision: 'None',
});

const acknowledge = (instrumentKey: string, tradingDate: string): MarketDataSaveCommand => ({
  intention: 'AssertUnavailable',
  instrumentKey,
  tradingDate,
  reason: 'no quote',
  expectedResolutionRevision: 'None',
});

const review = (instruments: { instrumentKey: string; earliestExposure: string }[], reviewDate = '2026-10-12') => ({
  context: { kind: 'Review' as const, reviewDate },
  instruments,
});

const MNO = { instrumentKey: 'MNO', earliestExposure: MNO_OPENED };
const XYZ = { instrumentKey: 'XYZ', earliestExposure: XYZ_PC1 };

async function fixture(now = TUESDAY_NOON) {
  const world = await setup(now);
  await world.marketData.save(mark('MNO', '2026-10-07', '10'));
  await world.marketData.save(mark('MNO', '2026-10-08', '11'));
  return world;
}

describe('recover without a provider (A56)', () => {
  it('should return Review-date frames, current resolutions, the MarketDataSnapshotId, and a NotConfigured diagnostic, and write nothing', async () => {
    const { marketData, persistence } = await fixture();
    const before = await persistence.readSnapshot(['observations'], (tx) => tx.getAll('observations'));
    const { result, requests } = await countRequests(() => marketData.recover(review([MNO, XYZ])));
    const queried = await marketData.query({ kind: 'ResolveFrames', context: { kind: 'Review', reviewDate: '2026-10-12' }, instruments: ['MNO', 'XYZ'] });
    if (result.kind !== 'Recovered' || queried.kind !== 'Frames') throw new Error('expected a recovery');
    expect(result.frames).toEqual(queried.frames);
    expect(result.frames.map((f) => [f.instrumentKey, f.tradingDate])).toEqual([['MNO', '2026-10-12'], ['XYZ', '2026-10-12']]);
    expect(result.resolutions.map((r) => [r.instrumentKey, r.tradingDate, r.resolution.kind])).toEqual([
      ['MNO', '2026-10-12', 'Missing'],
      ['XYZ', '2026-10-12', 'Missing'],
    ]);
    expect(result.snapshotId).toBe(queried.snapshotId);
    expect(result.evidenceDigest).toBe(queried.evidenceDigest);
    expect(result.diagnostics).toEqual([{ kind: 'NotConfigured' }]);
    expect(requests.filter((r) => ['put', 'add', 'delete', 'clear'].includes(r.method))).toEqual([]);
    const after = await persistence.readSnapshot(['observations'], (tx) => tx.getAll('observations'));
    expect(after.value).toEqual(before.value);
  });

  it('should list Friday 2026-10-09 as MNO historical gap and no gap for XYZ, whose relevance starts on 2026-10-12', async () => {
    const { marketData } = await fixture();
    const result = await marketData.recover(review([MNO, XYZ]));
    if (result.kind !== 'Recovered') throw new Error('expected a recovery');
    expect(result.gaps).toEqual([
      { instrumentKey: 'MNO', missing: ['2026-10-09'], acknowledged: [] },
      { instrumentKey: 'XYZ', missing: [], acknowledged: [] },
    ]);
  });

  it('should list acknowledged earlier sessions separately from Missing ones', async () => {
    const { marketData } = await fixture(WEDNESDAY_NOON);
    await marketData.save(acknowledge('MNO', '2026-10-09'));
    const result = await marketData.recover(review([MNO], '2026-10-13'));
    if (result.kind !== 'Recovered') throw new Error('expected a recovery');
    // 2026-10-12 is a Missing session now historical; 2026-10-09 is acknowledged and stays recoverable.
    expect(result.gaps).toEqual([{ instrumentKey: 'MNO', missing: ['2026-10-12'], acknowledged: ['2026-10-09'] }]);
  });

  it('should start relevance at the first session whose close is at or after the earliest exposure, so a first fill at Monday 17:00 starts relevance on Tuesday', async () => {
    const { marketData } = await fixture('2026-10-15T16:00:00Z');
    // Monday 2026-10-12 closes at 16:00; 17:00 is 21:00Z. A fill at 15:00 is before that close.
    const duringSession = { instrumentKey: 'AAA', earliestExposure: '2026-10-12T19:00:00Z' };
    const afterClose = { instrumentKey: 'BBB', earliestExposure: '2026-10-12T21:00:00Z' };
    const atClose = { instrumentKey: 'CCC', earliestExposure: '2026-10-12T20:00:00Z' };
    const result = await marketData.recover(review([duringSession, afterClose, atClose], '2026-10-14'));
    if (result.kind !== 'Recovered') throw new Error('expected a recovery');
    expect(result.gaps).toEqual([
      { instrumentKey: 'AAA', missing: ['2026-10-12', '2026-10-13'], acknowledged: [] },
      { instrumentKey: 'BBB', missing: ['2026-10-13'], acknowledged: [] },
      { instrumentKey: 'CCC', missing: ['2026-10-12', '2026-10-13'], acknowledged: [] },
    ]);
  });

  it('should return the current-date Missing keys of MNO and XYZ on 2026-10-12 as Manual tasks', async () => {
    const { marketData } = await fixture();
    const result = await marketData.recover(review([MNO, XYZ]));
    if (result.kind !== 'Recovered') throw new Error('expected a recovery');
    expect(result.manualTasks).toEqual([
      { instrumentKey: 'MNO', tradingDate: '2026-10-12' },
      { instrumentKey: 'XYZ', tradingDate: '2026-10-12' },
    ]);
    // An Available key and an acknowledged key are not tasks.
    await marketData.save(mark('MNO', '2026-10-12'));
    await marketData.save(acknowledge('XYZ', '2026-10-12'));
    const settled = await marketData.recover(review([MNO, XYZ]));
    if (settled.kind !== 'Recovered') throw new Error('expected a recovery');
    expect(settled.manualTasks).toEqual([]);
  });

  it('should issue one gap request per Instrument, whatever the history length', async () => {
    const longPolicy = createSessionPolicy({ id: 'nyse', revision: 1, coverage: { first: '2020-01-01', last: '2028-12-31' }, table: NYSE_TABLE });
    const gapRequests = async (sessionsBack: number) => {
      const { marketData, persistence } = await setup(TUESDAY_NOON, longPolicy);
      let from = '2026-10-09';
      for (let n = 1; n < sessionsBack; n++) {
        const previous = longPolicy.previousSession(from);
        if (!previous.ok) throw new Error('coverage');
        from = previous.value.date;
      }
      const dates = longPolicy.sessionsBetween(from, '2026-10-09');
      if (!dates.ok) throw new Error('coverage');
      // Every other session has a Mark, so the gaps are real and the history long.
      const records = dates.value
        .filter((_, i) => i % 2 === 0)
        .flatMap((s) =>
          ['AAA', 'BBB'].map((instrumentKey) => ({
            instrumentKey,
            tradingDate: s.date,
            resolutionRevision: 1,
            marks: [{ revisionId: `m-${instrumentKey}-${s.date}`, revisionNumber: 1, price: '10', source: 'Manual', intention: 'InitialManual', observedAt: TUESDAY_NOON, savedAt: TUESDAY_NOON }],
            effectiveMarkId: `m-${instrumentKey}-${s.date}`,
            acknowledgments: [],
            effectiveAcknowledgmentId: null,
          })),
        );
      const committed = await persistence.commit({ checks: [], writes: records.map((value) => ({ op: 'put' as const, store: 'observations' as const, value })) });
      if (committed.kind !== 'Committed') throw new Error('seed failed');
      const exposure = `${from}T00:00:00Z`;
      const { result, requests } = await countRequests(() =>
        marketData.recover(review([{ instrumentKey: 'AAA', earliestExposure: exposure }, { instrumentKey: 'BBB', earliestExposure: exposure }])),
      );
      if (result.kind !== 'Recovered') throw new Error('expected a recovery');
      expect(result.gaps[0]!.missing.length).toBeGreaterThan(0);
      return requests.filter((r) => r.store === 'observations' && r.index === 'byInstrumentDate' && r.method === 'getAll');
    };
    const small = await gapRequests(10);
    const large = await gapRequests(1000);
    expect(small).toHaveLength(2);
    expect(large).toEqual(small);
  });
});

describe('recover outside session policy coverage (P8)', () => {
  const policyFrom = (first: string) => createSessionPolicy({ id: 'nyse', revision: 1, coverage: { first, last: '2028-12-31' }, table: NYSE_TABLE });

  it('should list gaps from the first covered session and add a SessionPolicyCoverage diagnostic for an Instrument whose relevance starts before coverage', async () => {
    const coverage = { first: '2026-10-09', last: '2028-12-31' };
    const { marketData } = await setup(TUESDAY_NOON, policyFrom(coverage.first));
    const result = await marketData.recover(review([MNO, XYZ]));
    if (result.kind !== 'Recovered') throw new Error('expected a recovery');
    expect(result.gaps).toEqual([
      { instrumentKey: 'MNO', missing: ['2026-10-09'], acknowledged: [] },
      { instrumentKey: 'XYZ', missing: [], acknowledged: [] },
    ]);
    expect(result.diagnostics).toEqual([{ kind: 'NotConfigured' }, { kind: 'SessionPolicyCoverage', instrumentKey: 'MNO', coverage }]);
  });

  it('should list gaps normally, with no diagnostic, for an exposure on the first covered session', async () => {
    const { marketData } = await setup(TUESDAY_NOON, policyFrom('2026-10-07'));
    const result = await marketData.recover(review([MNO]));
    if (result.kind !== 'Recovered') throw new Error('expected a recovery');
    expect(result.gaps).toEqual([{ instrumentKey: 'MNO', missing: ['2026-10-07', '2026-10-08', '2026-10-09'], acknowledged: [] }]);
    expect(result.diagnostics).toEqual([{ kind: 'NotConfigured' }]);
  });
});
