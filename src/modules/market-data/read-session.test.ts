import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { instrumentOf, type OptionInstrument } from '../../domain/instrument/index.ts';
import { nyseSessionPolicy } from '../../domain/session-policy/index.ts';
import { fixedClock } from '../../domain/time/index.ts';
import { createPersistence } from '../../persistence/index.ts';
import { countRequests } from '../../../tests/support/request-counter.ts';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import { createMarketData, type FrameContext, type MarketDataSaveCommand } from './index.ts';

// T7SP.5: the read session (P78, P79, A193). Each case's oracle is ResolveFrames or recover on the same context.

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

describe('the read session (P78, P79)', () => {
  it('should resolve the trading date and close once at open for a Current, a Review and a Historical context', async () => {
    const { marketData } = await setup();
    const contexts: FrameContext[] = [
      { kind: 'Current', asOf: TUESDAY_NOON },
      { kind: 'Review', reviewDate: '2026-10-12' },
      { kind: 'Historical', tradingDate: '2026-10-09' },
    ];
    for (const context of contexts) {
      const resolved = await marketData.query({ kind: 'ResolveSession', context });
      if (resolved.kind !== 'Session') throw new Error('expected a session');
      const { result: session, requests } = await countRequests(() => marketData.openReadSession(context));
      expect(session).toMatchObject({ tradingDate: resolved.tradingDate, closeInstant: resolved.closeInstant, covered: true });
      expect(requests).toEqual([]);
    }
  });

  it("should return each Instrument's frame equal to ResolveFrames' frame for it alone", async () => {
    const { marketData } = await setup();
    await marketData.save(mark('XYZ', '2026-10-12'));
    await marketData.save(mark('OLD', '2026-10-08', '40'));
    await marketData.save({ intention: 'AssertUnavailable', instrumentKey: 'ACK', tradingDate: '2026-10-12', reason: 'no quote', expectedResolutionRevision: 'None' });
    const contexts: FrameContext[] = [
      { kind: 'Current', asOf: TUESDAY_NOON },
      { kind: 'Review', reviewDate: '2026-10-12' },
      { kind: 'Historical', tradingDate: '2026-10-09' },
    ];
    for (const context of contexts) {
      const session = await marketData.openReadSession(context);
      const instruments = ['XYZ', 'OLD', 'ACK', 'NONE'];
      const frames = await session.frames(instruments);
      expect(frames.map((f) => f.instrumentKey)).toEqual(instruments);
      for (const [i, instrumentKey] of instruments.entries()) {
        const alone = await marketData.query({ kind: 'ResolveFrames', context, instruments: [instrumentKey] });
        if (alone.kind !== 'Frames') throw new Error('expected frames');
        expect(frames[i]).toEqual(alone.frames[0]);
      }
    }
  });

  it('should read a date\'s observations once when three calls ask for frames on it, for different Instruments', async () => {
    const { marketData } = await setup();
    for (const key of ['AAA', 'BBB', 'CCC']) await marketData.save(mark(key, '2026-10-12'));
    const context: FrameContext = { kind: 'Current', asOf: TUESDAY_NOON };
    const session = await marketData.openReadSession(context);
    const { result: frames, requests } = await countRequests(async () => [
      ...(await session.frames(['AAA'])),
      ...(await session.frames(['BBB'])),
      ...(await session.frames(['CCC', 'AAA'])),
    ]);
    expect(requests.filter((r) => r.store === 'observations')).toEqual([{ on: 'store', store: 'observations', method: 'getAll' }]);
    const together = await marketData.query({ kind: 'ResolveFrames', context, instruments: ['AAA', 'BBB', 'CCC'] });
    if (together.kind !== 'Frames') throw new Error('expected frames');
    expect(frames.slice(0, 3)).toEqual(together.frames);
    expect(frames[3]).toEqual(together.frames[0]);
  });

  it("should look up an Instrument's Stale context once when two calls ask for its frame", async () => {
    const { marketData } = await setup();
    await marketData.save(mark('OLD', '2026-10-08', '40'));
    const context: FrameContext = { kind: 'Current', asOf: TUESDAY_NOON };
    const alone = await countRequests(() => marketData.query({ kind: 'ResolveFrames', context, instruments: ['OLD'] }));
    if (alone.result.kind !== 'Frames') throw new Error('expected frames');
    const lookups = (requests: { store: string }[]) => requests.filter((r) => r.store === 'observations');
    const session = await marketData.openReadSession(context);
    const { result: frames, requests } = await countRequests(async () => [...(await session.frames(['OLD'])), ...(await session.frames(['OLD']))]);
    expect(frames).toEqual([alone.result.frames[0], alone.result.frames[0]]);
    expect(frames[0]!.resolution).toMatchObject({ kind: 'Missing', stale: { tradingDate: '2026-10-08' } });
    expect(lookups(requests)).toEqual(lookups(alone.requests));
  });

  it('should read an earlier date\'s observations once for every historicalFrames call on that date, and once more for a second date', async () => {
    const { marketData } = await setup();
    for (const key of ['AAA', 'BBB']) await marketData.save(mark(key, '2026-10-08'));
    await marketData.save(mark('AAA', '2026-10-09'));
    const session = await marketData.openReadSession({ kind: 'Current', asOf: TUESDAY_NOON });
    const { result: frames, requests } = await countRequests(async () => [
      ...(await session.historicalFrames('2026-10-08', ['AAA'])),
      ...(await session.historicalFrames('2026-10-08', ['BBB', 'AAA'])),
      ...(await session.historicalFrames('2026-10-09', ['AAA'])),
    ]);
    expect(requests.filter((r) => r.store === 'observations')).toEqual([
      { on: 'store', store: 'observations', method: 'getAll' },
      { on: 'store', store: 'observations', method: 'getAll' },
    ]);
    const oracle = async (tradingDate: string, instruments: string[]) => {
      const result = await marketData.query({ kind: 'ResolveFrames', context: { kind: 'Historical', tradingDate }, instruments });
      if (result.kind !== 'Frames') throw new Error('expected frames');
      return result.frames;
    };
    const [a, b, c] = [await oracle('2026-10-08', ['AAA']), await oracle('2026-10-08', ['BBB', 'AAA']), await oracle('2026-10-09', ['AAA'])];
    // A session answers in the order asked; ResolveFrames sorts.
    expect(frames).toEqual([...a, b[1], b[0], ...c]);
  });

  it("should return each Instrument's gaps as recover does, scanning each Instrument once however many calls ask", async () => {
    const { marketData } = await setup();
    await marketData.save(mark('MNO', '2026-10-08'));
    await marketData.save({ intention: 'AssertUnavailable', instrumentKey: 'MNO', tradingDate: '2026-10-09', reason: 'no quote', expectedResolutionRevision: 'None' });
    const opened = { instrumentKey: 'MNO', earliestExposure: '2026-10-07T14:00:00Z' };
    const laterOpened = { instrumentKey: 'MNO', earliestExposure: '2026-10-09T14:00:00Z' };
    const xyz = { instrumentKey: 'XYZ', earliestExposure: '2026-10-12T14:00:00Z' };
    const context = { kind: 'Review' as const, reviewDate: '2026-10-12' };
    const recovered = async (instruments: { instrumentKey: string; earliestExposure: string }[]) => {
      const result = await marketData.recover({ context, instruments });
      if (result.kind !== 'Recovered') throw new Error('expected recovery');
      return result.gaps;
    };
    const baseline = await countRequests(() => recovered([opened, xyz]));
    const session = await marketData.openReadSession(context);
    const { result: gaps, requests } = await countRequests(async () => [
      await session.gaps([opened]),
      await session.gaps([opened]),
      await session.gaps([opened, xyz]),
      await session.gaps([laterOpened]),
    ]);
    // A scan is one range read of an Instrument's history; recover's frame reads are cursor requests.
    const scans = (all: { on: string; method: string }[]) => all.filter((r) => r.on === 'index' && r.method === 'getAll');
    expect(scans(baseline.requests)).toHaveLength(1);
    expect(scans(requests)).toEqual(scans(baseline.requests));
    expect(gaps[0]).toEqual(await recovered([opened]));
    expect(gaps[1]).toEqual(gaps[0]);
    expect(gaps[2]).toEqual(baseline.result);
    expect(gaps[0]![0]).toMatchObject({ acknowledged: ['2026-10-09'] });
    expect(gaps[3]).toEqual(await recovered([laterOpened]));
  });

  it("should give a settlement time for an expiration date from the calendar with no stored read, and the latest session's close for a date that isn't one", async () => {
    // After every date but the last, so ResolveSession answers for them.
    const asOf = '2026-12-01T16:00:00Z';
    const { marketData } = await setup(asOf);
    const session = await marketData.openReadSession({ kind: 'Current', asOf });
    const contractOn = (expiration: string): OptionInstrument => ({ ...(instrumentOf('ABC261016C00050000') as OptionInstrument), expiration });
    const dates = ['2026-10-16', '2026-10-17', '2026-11-26', '2030-01-18'];
    const { result: times, requests } = await countRequests(() => Promise.all(dates.map((date) => session.settlementTime(contractOn(date)))));
    expect(requests).toEqual([]);
    // The oracle is ResolveSession on the date, or the latest session it names when the date is not one.
    const oracle = async (tradingDate: string) => {
      const resolved = await marketData.query({ kind: 'ResolveSession', context: { kind: 'Historical', tradingDate } });
      if (resolved.kind === 'Session') return resolved.closeInstant;
      return resolved.kind === 'Rejected' ? resolved.issues[0]?.latestSession?.closeInstant : undefined;
    };
    expect(times[0]).toEqual({ kind: 'Value', value: '2026-10-16T20:00:00Z' });
    expect(times[1]).toEqual({ kind: 'Value', value: '2026-10-16T20:00:00Z' });
    // Thanksgiving: the Wednesday before it closes at 16:00 New York.
    expect(times[2]).toEqual({ kind: 'Value', value: '2026-11-25T21:00:00Z' });
    for (const [i, date] of dates.slice(0, 3).entries()) expect(times[i]).toEqual({ kind: 'Value', value: await oracle(date) });
    expect(times[3]).toEqual({ kind: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: contractOn('2030-01-18'), date: '2030-01-18' });
  });

  it('should give a binding covering every key read, with one snapshot id per date that ResolveFrames with that ExpectedSnapshot answers SnapshotUnchanged', async () => {
    const { marketData } = await setup();
    await marketData.save(mark('AAA', '2026-10-12'));
    await marketData.save(mark('OLD', '2026-10-08', '40'));
    await marketData.save(mark('AAA', '2026-10-09'));
    const current: FrameContext = { kind: 'Current', asOf: TUESDAY_NOON };
    const session = await marketData.openReadSession(current);
    await session.frames(['OLD']);
    await session.frames(['NONE', 'AAA']);
    await session.historicalFrames('2026-10-09', ['AAA']);
    await session.historicalFrames('2026-10-09', ['OLD']);
    const { evidenceBinding, snapshotIds } = session.binding();
    const reads: { context: FrameContext; date: string; instruments: string[] }[] = [
      { context: current, date: '2026-10-12', instruments: ['AAA', 'NONE', 'OLD'] },
      { context: { kind: 'Historical', tradingDate: '2026-10-09' }, date: '2026-10-09', instruments: ['AAA', 'OLD'] },
    ];
    expect(Object.keys(snapshotIds)).toEqual(reads.map((r) => r.date));
    const expectedBinding = [];
    for (const { context, date, instruments } of reads) {
      const again = await marketData.query({ kind: 'ResolveFrames', context, instruments, expectedSnapshot: snapshotIds[date] });
      expect(again.kind).toBe('SnapshotUnchanged');
      const fresh = await marketData.query({ kind: 'ResolveFrames', context, instruments });
      if (fresh.kind !== 'Frames') throw new Error('expected frames');
      expect(snapshotIds[date]).toBe(fresh.snapshotId);
      expectedBinding.push(...fresh.evidenceBinding);
    }
    expect(evidenceBinding).toEqual(expectedBinding);
    // The Stale context's key is bound too, at the date it came from.
    expect(evidenceBinding).toContainEqual({ instrumentKey: 'OLD', tradingDate: '2026-10-08', resolutionRevision: 1 });
    await marketData.save(mark('NONE', '2026-10-12'));
    const changed = await marketData.query({ kind: 'ResolveFrames', context: current, instruments: reads[0]!.instruments, expectedSnapshot: snapshotIds['2026-10-12'] });
    expect(changed.kind).toBe('SnapshotChanged');
  });

  it('should read a Mark saved after the session closed only in a new session', async () => {
    const { marketData } = await setup();
    const context: FrameContext = { kind: 'Current', asOf: TUESDAY_NOON };
    const session = await marketData.openReadSession(context);
    const [before] = await session.frames(['AAA']);
    expect(before!.resolution.kind).toBe('Missing');
    const saved = await marketData.save(mark('AAA', '2026-10-12'));
    expect(saved.kind).toBe('Saved');
    const { result: [same], requests } = await countRequests(() => session.frames(['AAA']));
    expect(same).toEqual(before);
    expect(requests).toEqual([]);
    const [after] = await (await marketData.openReadSession(context)).frames(['AAA']);
    expect(after!.resolution.kind).toBe('Available');
  });

  it('should open outside coverage with the as-of exchange date, covered false, and answer every frame with no Mark, as ResolveFrames does today', async () => {
    const { marketData } = await setup();
    const contexts: { context: FrameContext; date: string }[] = [
      { context: { kind: 'Current', asOf: '2023-12-29T21:00:00Z' }, date: '2023-12-29' },
      // 21:00 on 2029-01-04 in New York is 02:00 UTC the next day: the exchange date is the earlier one.
      { context: { kind: 'Current', asOf: '2029-01-05T02:00:00Z' }, date: '2029-01-04' },
      { context: { kind: 'Review', reviewDate: '2029-02-01' }, date: '2029-02-01' },
    ];
    for (const { context, date } of contexts) {
      const { result: session, requests } = await countRequests(() => marketData.openReadSession(context));
      expect(session.tradingDate).toBe(date);
      expect(session.covered).toBe(false);
      expect(session.closeInstant).toBeUndefined();
      const frames = await session.frames(['XYZ']);
      const resolved = await marketData.query({ kind: 'ResolveFrames', context, instruments: ['XYZ'] });
      expect(resolved.kind).toBe('Rejected');
      expect(frames).toEqual([]);
      expect(requests).toEqual([]);
    }
  });
});
