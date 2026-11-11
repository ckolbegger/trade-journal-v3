import { describe, expect, it } from 'vitest';
import { breakFirstExecution, cardFixture, fiveTradeFixture, rawEditTrade, MONDAY_1615, MONDAY_1700, MONDAY_CUTOFF, reviewStack, ELEVEN_AM, TEN_AM, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import { Rational } from '../../domain/values/index.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import { createDailyReview, type OpenDailyReviewResult, type ReflectionSaveBinding, type SaveDailyReviewResult } from './index.ts';

const open = (stack: ReviewStack, asOf: string) => stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf });
const stock = (symbol: string) => ({ kind: 'Stock', symbol }) as const;

function ready(result: OpenDailyReviewResult) {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result;
}

function marks(result: OpenDailyReviewResult) {
  const family = ready(result).families.find((f) => f.family === 'Marks');
  if (!family) throw new Error('no Marks family');
  return family;
}

// The Trades family of a Ready Review: the attention-ranked eligible Trade walk.
function walk(result: OpenDailyReviewResult) {
  const family = ready(result).families.find((f) => f.family === 'Trades');
  if (!family) throw new Error('no Trades family');
  return family.trades;
}

describe('date and eligibility (P9, P15, A55)', () => {
  it('should resolve LatestCompleted to 2026-10-12 with cutoff 16:00 at Monday 17:00, and to Friday 2026-10-09 at Monday 16:15', async () => {
    const monday = await reviewStack(MONDAY_1700);
    await fiveTradeFixture(monday);
    const evening = await open(monday, MONDAY_1700);
    expect(evening).toEqual(expect.objectContaining({ kind: 'Ready', reviewDate: '2026-10-12', cutoff: MONDAY_CUTOFF }));

    // Every Trade was first filled after Friday's close, so none is eligible then.
    const quarterPast = await reviewStack(MONDAY_1615);
    await fiveTradeFixture(quarterPast, { withoutMarks: true });
    expect(await open(quarterPast, MONDAY_1615)).toEqual({ kind: 'Empty', reviewDate: '2026-10-09', cutoff: '2026-10-09T20:00:00Z', owed: [], binding: expect.any(Object) as unknown });
  }, 30_000);

  it('should exclude a Trade the index selects whose facts are not Open at the cutoff', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const early = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(early, TEN_AM, '100', '50.00');
    const late = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(late, '2026-10-12T20:05:00Z', '100', '30.00');
    // A stale stored exposure start, earlier than the first fill, makes the index select it.
    await rawEditTrade(stack, late.tradeId, (trade) => ({ ...trade, exposureStart: TEN_AM }));

    const result = await open(stack, MONDAY_1700);

    expect(walk(result).map((t) => t.tradeId)).toEqual([early.tradeId]);
    expect(JSON.stringify(marks(result))).not.toContain('ABC');
    expect(JSON.stringify(ready(result).completion)).not.toContain('ABC');
  });

  it('should return Empty when the index selects only Trades whose facts are not Open at the cutoff', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const late = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(late, '2026-10-12T20:05:00Z', '100', '30.00');
    await rawEditTrade(stack, late.tradeId, (trade) => ({ ...trade, exposureStart: TEN_AM }));

    expect(await open(stack, MONDAY_1700)).toEqual({ kind: 'Empty', reviewDate: '2026-10-12', cutoff: MONDAY_CUTOFF, owed: [], binding: expect.any(Object) as unknown });
  });
});

describe('eligibility at the cutoff (AC-REV-001)', () => {
  it('should include a Trade whose first fill is before the cutoff and exclude one whose first fill is at 16:05, though both are Open now', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const early = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(early, TEN_AM, '100', '50.00');
    const late = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    // 16:05 New York is five minutes after the 16:00 cutoff.
    await stack.fill(late, '2026-10-12T20:05:00Z', '100', '30.00');
    const openNow = await stack.tradeRecord.queryRecords({ lifecycle: 'Open', projection: 'Summary' });
    expect(openNow.kind === 'Page' && openNow.items).toHaveLength(2);

    const result = await open(stack, MONDAY_1700);

    expect(walk(result).map((t) => t.tradeId)).toEqual([early.tradeId]);
  });
});

describe('earlier-dated Position Change (P5, A55)', () => {
  it('should make a Trade eligible after an earlier-dated Position Change moves its exposure start before the cutoff', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const early = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(early, TEN_AM, '100', '50.00');
    const late = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(late, '2026-10-12T20:05:00Z', '60', '30.00');
    expect(walk(await open(stack, MONDAY_1700)).map((t) => t.tradeId)).toEqual([early.tradeId]);

    // 15:00 New York, recorded after the fact.
    const refreshed = (await stack.tradeRecord.getRecord({ tradeId: late.tradeId, projection: 'AnalysisInput' }));
    if (refreshed.kind !== 'Found') throw new Error('no Trade');
    await stack.fill(refreshed.projection as typeof late, '2026-10-12T19:00:00Z', '40', '30.00');

    expect(walk(await open(stack, MONDAY_1700)).map((t) => t.tradeId).sort()).toEqual([early.tradeId, late.tradeId].sort());
  });
});

describe('empty Review', () => {
  it('should return Empty when no Trade is eligible and no task exists', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // A Planned Trade has no exposure, so it is never eligible.
    await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    expect(await open(stack, MONDAY_1700)).toEqual({ kind: 'Empty', reviewDate: '2026-10-12', cutoff: MONDAY_CUTOFF, owed: [], binding: expect.any(Object) as unknown });
  });
});

describe('task families (AC-REV-002, AC-MARK-004)', () => {
  it('should return the Marks family first, listing DEF Review-date Mark as a Manual task, then the Trade walk', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const trades = await fiveTradeFixture(stack);

    const result = await open(stack, MONDAY_1700);

    expect(ready(result).families.map((f) => f.family)).toEqual(['Marks', 'Trades']);
    const today = marks(result).today;
    expect(today.map((row) => row.instrumentKey)).toEqual(['ABC', 'DEF', 'GHI', 'JKL', 'XYZ']);
    expect(today.find((row) => row.instrumentKey === 'DEF')).toEqual({
      instrumentKey: 'DEF',
      instrument: { kind: 'Stock', symbol: 'DEF' },
      tradingDate: '2026-10-12',
      trades: [trades.c],
      resolution: { kind: 'Missing' },
      resolutionRevision: 'None',
      task: 'Manual',
    });
    // An Instrument with an exact Mark has a row for correction but no task.
    expect(today.find((row) => row.instrumentKey === 'XYZ')).toEqual(expect.objectContaining({ trades: [trades.a], task: null, resolution: expect.objectContaining({ kind: 'Available' }) as unknown }));
  }, 30_000);

  it('should carry each Mark row and gap date the resolutionRevision its key was read at', async () => {
    const stack = await reviewStack(MONDAY_1700);
    await fiveTradeFixture(stack);
    const mno = await stack.confirm({ symbol: 'MNO', shares: '100', entry: '10.00', stop: '9.00', target: '14.00', planTime: '2026-10-07T13:00:00Z' });
    await stack.fill(mno, '2026-10-07T14:00:00Z', '100', '10.00');
    await stack.saveMark('MNO', '10.00', '2026-10-07');
    await stack.saveMark('MNO', '11.00', '2026-10-08');

    const family = marks(await open(stack, MONDAY_1700));

    // DEF has no record; XYZ has one Mark revision; the Friday gap has no record.
    expect(family.today.find((row) => row.instrumentKey === 'DEF')?.resolutionRevision).toBe('None');
    expect(family.today.find((row) => row.instrumentKey === 'XYZ')?.resolutionRevision).toBe(1);
    expect(family.earlier[0]?.revisions).toEqual({ '2026-10-09': 'None' });
  }, 30_000);

  it('should list one Mark task for an Instrument shared by two eligible Trades, naming both', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const first = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(first, TEN_AM, '100', '50.00');
    const second = await stack.confirm({ symbol: 'XYZ', shares: '50', entry: '50.50', stop: '47.50', target: '56.00' });
    await stack.fill(second, ELEVEN_AM, '50', '50.50');

    const rows = marks(await open(stack, MONDAY_1700)).today;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({ instrumentKey: 'XYZ', task: 'Manual' }));
    expect([...rows[0]!.trades].sort()).toEqual([first.tradeId, second.tradeId].sort());
  });

  it('should list skipped sessions as historical gaps marked nonblocking', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // MNO opened Wednesday 2026-10-07 at 10:00 with Marks for that day and Thursday; Friday was skipped.
    const mno = await stack.confirm({ symbol: 'MNO', shares: '100', entry: '10.00', stop: '9.00', target: '14.00', planTime: '2026-10-07T13:00:00Z' });
    await stack.fill(mno, '2026-10-07T14:00:00Z', '100', '10.00');
    await stack.saveMark('MNO', '10.00', '2026-10-07');
    await stack.saveMark('MNO', '11.00', '2026-10-08');

    const family = marks(await open(stack, MONDAY_1700));

    expect(family.earlier).toMatchObject([{ instrumentKey: 'MNO', missing: ['2026-10-09'], acknowledged: [], blocking: false }]);
  });

  it('should write nothing', async () => {
    const stack = await reviewStack(MONDAY_1700);
    await fiveTradeFixture(stack);
    const before = await dumpAll(stack.factory);

    ready(await open(stack, MONDAY_1700));
    ready(await open(stack, MONDAY_1700));

    // No Review, session, placeholder, Action, Debt, acknowledgment, or Mark record, and no revision change.
    expect(await dumpAll(stack.factory)).toEqual(before);
  }, 30_000);
});

describe('attention order', () => {
  it('should order the fixture T-D, T-B, T-C, T-A, T-E, returning each Trade band, reasons, and selected basis', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c, d, e } = await fiveTradeFixture(stack);

    const trades = walk(await open(stack, MONDAY_1700));

    expect(trades.map((t) => t.tradeId)).toEqual([d, b, c, a, e]);
    expect(trades.map((t) => t.band)).toEqual(['Blocker', 'BoundaryReached', 'EvidenceLimited', 'QuantifiedPressure', 'QuantifiedPressure']);
    const [blocker, boundary, limited, pressureA, pressureE] = trades;
    // T-D: its recorded Entry Size occurrence is gone while the facts still imply it.
    expect(blocker!.reasons).toEqual([{ code: 'IntegrityDisagreement', findings: [expect.objectContaining({ kind: 'DeviationMissing' })] }]);
    // T-B: 100 @ 30.00 marked 27.50 breaches the 28.00 Stop by $50.00; the whole risk at entry ($200.00) is consumed.
    expect(boundary!.reasons).toEqual([{ code: 'StopBreached', conditionId: 'stop-1', overrun: Rational.of(50n) }]);
    expect(boundary!.basis).toEqual({ kind: 'Value', value: { side: 'Losing', share: Rational.of(1n), atEntry: Rational.of(200n), now: Rational.of(0n) } });
    // T-C: DEF has no Review-date Mark, so the missing input is named.
    expect(limited!.reasons).toEqual([{ code: 'Unavailable', reason: 'MarkMissing', instrument: stock('DEF'), date: '2026-10-12' }]);
    expect(limited!.basis).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: stock('DEF'), date: '2026-10-12' });
    // T-A: reward at entry $582.00 against $400.00 now.
    expect(pressureA!.reasons).toEqual([{ code: 'PressureTowardTarget' }]);
    expect(pressureA!.basis).toEqual({ kind: 'Value', value: { side: 'Winning', share: Rational.of(91n, 291n), atEntry: Rational.of(582n), now: Rational.of(400n) } });
    expect(pressureE!.basis).toEqual({ kind: 'Value', value: { side: 'Winning', share: Rational.of(1n, 10n), atEntry: Rational.of(1000n), now: Rational.of(900n) } });
  }, 30_000);

  it('should carry each walked Trade summary, the open quantity at its average price (decision 67)', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { b } = await fiveTradeFixture(stack);

    const trades = walk(await open(stack, MONDAY_1700));

    // T-B holds 100 @ 30.00.
    expect(trades.find((t) => t.tradeId === b)!.summary).toEqual({ kind: 'Stock', direction: 'Long', quantity: Rational.of(100n), price: Rational.of(30n) });
  }, 30_000);

  it('should keep T-B in boundary reached although its risk to stop is zero', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const b = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(b, TEN_AM, '100', '30.00');
    await stack.saveMark('ABC', '27.50');

    const [item] = walk(await open(stack, MONDAY_1700));

    expect(item).toEqual(expect.objectContaining({ tradeId: b.tradeId, band: 'BoundaryReached' }));
    expect(item!.basis).toMatchObject({ kind: 'Value', value: { now: Rational.of(0n) } });
  });

  it('should give T-A pressure 91/291 and T-E pressure 1/10 as winning shares, measured from each Trade open cost without fees', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, e } = await fiveTradeFixture(stack);

    const trades = walk(await open(stack, MONDAY_1700));

    // T-A: 60 @ 50.10 and 40 @ 50.30 cost 5,018.00 (fees of 2.00 are not part of it); 52.00 is
    // (5,600.00 - 5,018.00 - 400.00) / 582.00 of the way to the 56.00 Target.
    expect(trades.find((t) => t.tradeId === a)!.basis).toMatchObject({ kind: 'Value', value: { side: 'Winning', share: Rational.of(91n, 291n) } });
    expect(trades.find((t) => t.tradeId === e)!.basis).toMatchObject({ kind: 'Value', value: { side: 'Winning', share: Rational.of(1n, 10n) } });
  }, 30_000);

  it('should give equal pressure 3/4 to a Trade marked 48.50 and one marked 53.00, and order the losing one first whatever their Last Activity', async () => {
    // Each is 100 shares at 50.00 with Stop 48.00 and Target 54.00: 3/4 of the way to the Stop or to the Target.
    for (const [loserFilledAt, winnerFilledAt] of [
      [TEN_AM, ELEVEN_AM],
      [ELEVEN_AM, TEN_AM],
    ] as const) {
      const stack = await reviewStack(MONDAY_1700);
      const winner = await stack.confirm({ symbol: 'WIN', shares: '100', entry: '50.00', stop: '48.00', target: '54.00' });
      await stack.fill(winner, winnerFilledAt, '100', '50.00');
      const loser = await stack.confirm({ symbol: 'LOS', shares: '100', entry: '50.00', stop: '48.00', target: '54.00' });
      await stack.fill(loser, loserFilledAt, '100', '50.00');
      await stack.saveMark('WIN', '53.00');
      await stack.saveMark('LOS', '48.50');

      const trades = walk(await open(stack, MONDAY_1700));

      expect(trades.map((t) => [t.tradeId, t.band])).toEqual([
        [loser.tradeId, 'QuantifiedPressure'],
        [winner.tradeId, 'QuantifiedPressure'],
      ]);
      expect(trades.map((t) => [t.basis.kind === 'Value' && t.basis.value.side, t.basis.kind === 'Value' && t.basis.value.share])).toEqual([
        ['Losing', Rational.of(3n, 4n)],
        ['Winning', Rational.of(3n, 4n)],
      ]);
    }
  }, 30_000);

  it('should break equal pressure on the same side by Last Activity descending, then Trade identity', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // Three Trades, each 3/4 of the way to its Target; the first has the latest activity and the other two tie.
    const trades = [];
    for (const [symbol, filledAt] of [['AAA', TEN_AM], ['BBB', ELEVEN_AM], ['CCC', TEN_AM], ['DDD', TEN_AM]] as const) {
      const trade = await stack.confirm({ symbol, shares: '100', entry: '50.00', stop: '48.00', target: '54.00' });
      await stack.fill(trade, filledAt, '100', '50.00');
      await stack.saveMark(symbol, '53.00');
      trades.push(trade.tradeId);
    }
    const [aaa, bbb, ccc, ddd] = trades as [string, string, string, string];

    const walked = walk(await open(stack, MONDAY_1700));

    // BBB is latest; AAA, CCC, and DDD tie on Last Activity and follow by identity.
    expect(walked.map((t) => t.tradeId)).toEqual([bbb, aaa, ccc, ddd]);
    expect(aaa < ccc && ccc < ddd).toBe(true);
  }, 30_000);

  it('should place T-E in quantified pressure, and a Trade marked at its average open cost in routine with pressure 0', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const e = await stack.confirm({ symbol: 'JKL', shares: '100', entry: '20.00', stop: '19.00', target: '30.00' });
    await stack.fill(e, TEN_AM, '100', '20.00');
    await stack.saveMark('JKL', '21.00');
    const flat = await stack.confirm({ symbol: 'FLT', shares: '100', entry: '50.00', stop: '48.00', target: '54.00' });
    await stack.fill(flat, TEN_AM, '100', '50.00');
    await stack.saveMark('FLT', '50.00');

    const trades = walk(await open(stack, MONDAY_1700));

    expect(trades.map((t) => [t.tradeId, t.band])).toEqual([
      [e.tradeId, 'QuantifiedPressure'],
      [flat.tradeId, 'Routine'],
    ]);
    expect(trades[1]!.basis).toEqual({ kind: 'Value', value: { side: 'None', share: Rational.of(0n) } });
  }, 30_000);
});

describe('pressure that cannot be compared', () => {
  it('should mark a Trade Not Comparable when its risk or reward at entry is not positive on the side it moved toward', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // Filled at its Stop and marked below it: no risk was taken at entry, so no share of it can be consumed.
    const atStop = await stack.confirm({ symbol: 'LOW', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(atStop, TEN_AM, '100', '28.00');
    await stack.saveMark('LOW', '27.00');
    // Filled beyond its Target and marked higher: no reward remained at entry.
    const pastTarget = await stack.confirm({ symbol: 'HIGH', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(pastTarget, ELEVEN_AM, '100', '37.00');
    await stack.saveMark('HIGH', '38.00');

    const trades = walk(await open(stack, MONDAY_1700));

    expect(trades.map((t) => [t.tradeId, t.basis])).toEqual([
      [pastTarget.tradeId, { kind: 'NotApplicable', reason: 'NonPositiveAtEntry', side: 'Winning' }],
      [atStop.tradeId, { kind: 'NotApplicable', reason: 'NonPositiveAtEntry', side: 'Losing' }],
    ]);
  }, 30_000);
});

describe('facts that cannot be replayed', () => {
  it('should list a Trade whose facts cannot be replayed in the blocker band and keep the Review Incomplete', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(trade, TEN_AM, '100', '50.00');
    await stack.saveMark('XYZ', '52.00');
    await stack.saveAction(trade.tradeId, 'Hold');
    await breakFirstExecution(stack, trade.tradeId);

    const review = ready(await open(stack, MONDAY_1700));

    const [item] = walk(review);
    expect(item).toEqual(expect.objectContaining({ tradeId: trade.tradeId, band: 'Blocker', reasons: [{ code: 'Unavailable', reason: 'FactsIncoherent', findings: [expect.objectContaining({ reason: 'UnknownPlannedLeg' })] }] }));
    expect(review.completion).toEqual({ kind: 'Incomplete', reasons: [{ code: 'IncoherentFacts', tradeId: trade.tradeId, findings: [expect.objectContaining({ reason: 'UnknownPlannedLeg' })] }] });
  });
});

describe('facts that cannot be replayed after the cutoff', () => {
  it('should list a Trade whose Execution after the cutoff cannot be replayed in the blocker band', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(trade, TEN_AM, '100', '50.00');
    await stack.fill(trade, '2026-10-12T20:05:00Z', '20', '50.50');
    await stack.saveMark('XYZ', '52.00');
    await stack.saveAction(trade.tradeId, 'Hold');
    type Fact = { factId: string; kind: string; versions: { value: Record<string, unknown> }[] };
    await rawEditTrade(stack, trade.tradeId, (t) => {
      const facts = t['facts'] as Fact[];
      const last = facts.filter((f) => f.kind === 'Execution').at(-1);
      const broken = (fact: Fact) => ({ ...fact, versions: fact.versions.map((v) => ({ ...v, value: { ...v.value, intent: { kind: 'ServesPlannedLeg', plannedLegId: 'leg-unknown' } } })) });
      return { ...t, facts: facts.map((fact) => (fact === last ? broken(fact) : fact)) };
    });

    const review = ready(await open(stack, MONDAY_1700));

    expect(walk(review)).toEqual([expect.objectContaining({ tradeId: trade.tradeId, band: 'Blocker', reasons: [{ code: 'Unavailable', reason: 'FactsIncoherent', findings: [expect.objectContaining({ reason: 'UnknownPlannedLeg' })] }] })]);
    expect(review.completion).toEqual({ kind: 'Incomplete', reasons: [{ code: 'IncoherentFacts', tradeId: trade.tradeId, findings: [expect.objectContaining({ reason: 'UnknownPlannedLeg' })] }] });
  }, 30_000);
});

describe('coherent read (A46)', () => {
  it('should bind the Workspace, Catalog, and Journal revisions, the market snapshot, and each Trade fact revision of one read', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c, d, e } = await fiveTradeFixture(stack);

    const review = ready(await open(stack, MONDAY_1700));

    const stored = await stack.persistence.readSnapshot(['meta'], async (tx) => ({
      catalog: (await tx.get('meta', 'catalog')) as { catalogRevision: number },
      journal: (await tx.get('meta', 'journal')) as { journalRevision: number },
    }));
    const frames = await stack.marketData.query({
      kind: 'ResolveFrames',
      context: { kind: 'Review', reviewDate: '2026-10-12' },
      instruments: ['ABC', 'DEF', 'GHI', 'JKL', 'XYZ'],
    });
    if (frames.kind !== 'Frames') throw new Error('expected frames');
    const factRevisions: Record<string, number> = {};
    for (const tradeId of [a, b, c, d, e]) {
      const record = await stack.tradeRecord.getRecord({ tradeId, projection: 'Summary' });
      if (record.kind !== 'Found') throw new Error('no Trade');
      factRevisions[tradeId] = record.factRevision;
    }
    expect(review.binding).toEqual({
      workspace: stored.binding,
      catalogRevision: stored.value.catalog.catalogRevision,
      journalRevision: stored.value.journal.journalRevision,
      marketDataSnapshotId: frames.snapshotId,
      factRevisions,
      outstandingDebts: {},
    });
  }, 30_000);
});

describe('writes landing during assembly (A46)', () => {
  it('should retry the read when a write lands between phases, and return ChangedDuringAssembly after 3 attempts', async () => {
    const stack = await reviewStack(MONDAY_1700);
    await fiveTradeFixture(stack);
    // Each read of the Trade pages is followed by a write that the read missed: a Mark for another Instrument.
    const sessions = ['2026-10-09', '2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05'];
    let pages = 0;
    let reads = 0;
    const racing = (writes: number) =>
      createDailyReview({
        ...stack,
        tradeRecord: {
          ...stack.tradeRecord,
          queryRecords: async (query) => {
            reads++;
            const page = await stack.tradeRecord.queryRecords(query);
            if (pages < writes) await stack.saveMark('ZZZ', '10.00', sessions[pages++]);
            return page;
          },
        },
      });

    // One write: the second attempt reads a quiet Workspace and binds to it.
    const retried = ready(await racing(1).open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 }));
    const quiet = await stack.persistence.readSnapshot(['meta'], () => Promise.resolve(null));
    expect(retried.binding.workspace).toEqual(quiet.binding);
    expect(reads).toBe(2);

    // A write after every attempt: three attempts, then nothing incoherent is returned.
    let attempts = 0;
    const always = createDailyReview({
      ...stack,
      tradeRecord: {
        ...stack.tradeRecord,
        queryRecords: async (query) => {
          attempts++;
          const page = await stack.tradeRecord.queryRecords(query);
          await stack.saveMark('ZZZ', '10.00', sessions[pages++]);
          return page;
        },
      },
    });
    expect(await always.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 })).toEqual({ kind: 'ChangedDuringAssembly' });
    expect(attempts).toBe(3);
  }, 30_000);

  it('should retry, then return ChangedDuringAssembly, when a Trade commit expires the eligibility cursor between pages', async () => {
    const stack = await reviewStack(MONDAY_1700);
    await fiveTradeFixture(stack);
    // Two Trades to a page, so the five Open Trades span three pages; a Trade commit lands after the first page of an attempt.
    let commits = 0;
    let attempts = 0;
    const racing = (limit: number) =>
      createDailyReview({
        ...stack,
        tradeRecord: {
          ...stack.tradeRecord,
          queryRecords: async (query) => {
            if (!query.cursor) attempts++;
            const page = await stack.tradeRecord.queryRecords({ ...query, pageSize: 2 });
            if (!query.cursor && commits < limit) {
              await stack.confirm({ symbol: `NEW${commits++}`, shares: '10', entry: '10.00', stop: '9.00', target: '12.00' });
            }
            return page;
          },
        },
      });

    // One commit expires the first attempt's cursor; the second attempt reads a quiet Workspace.
    const retried = ready(await racing(1).open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 }));
    expect(attempts).toBe(2);
    expect(walk(retried)).toHaveLength(5);

    // A commit in every attempt: three attempts, then nothing incoherent is returned.
    attempts = 0;
    expect(await racing(commits + 3).open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 })).toEqual({ kind: 'ChangedDuringAssembly' });
    expect(attempts).toBe(3);
  }, 30_000);
});

describe('completion', () => {
  it('should report Incomplete listing DEF missing Review-date Mark and each Trade without an Action', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c, e } = await fiveTradeFixture(stack, { withoutD: true });

    const review = ready(await open(stack, MONDAY_1700));

    // The Marks reasons come first, then the Trades in the walk's order (T-B, T-C, T-A, T-E).
    expect(review.completion).toEqual({
      kind: 'Incomplete',
      reasons: [
        { code: 'MarkMissing', instrument: stock('DEF'), tradingDate: '2026-10-12', trades: [c] },
        { code: 'ActionMissing', tradeId: b },
        { code: 'ActionMissing', tradeId: c },
        { code: 'ActionMissing', tradeId: a },
        { code: 'ActionMissing', tradeId: e },
      ],
    });
  }, 30_000);

  it('should report Complete when every eligible Trade has an Action and every Review-date Mark is exact', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c, e } = await fiveTradeFixture(stack, { withoutD: true });
    await stack.saveMark('DEF', '40.50');
    for (const tradeId of [a, c, e]) await stack.saveAction(tradeId, 'Hold');
    await stack.saveAction(b, 'Exit');

    expect(ready(await open(stack, MONDAY_1700)).completion).toEqual({ kind: 'Complete' });
  }, 30_000);

  it('should report CompleteWithUnavailableMarks naming DEF, T-C, and the affected calculation families when DEF is acknowledged and every Action is saved', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c, e } = await fiveTradeFixture(stack, { withoutD: true });
    await stack.acknowledge('DEF');
    for (const tradeId of [a, b, c, e]) await stack.saveAction(tradeId, 'Hold');

    const review = ready(await open(stack, MONDAY_1700));

    expect(review.completion).toEqual({
      kind: 'CompleteWithUnavailableMarks',
      instruments: [stock('DEF')],
      trades: [c],
      families: ['Valuation', 'Risk', 'Reward', 'ConditionStatus'],
    });
    // The acknowledgment resolves the evidence work but is disclosed: the row stays, with no task.
    expect(marks(review).today.find((row) => row.instrumentKey === 'DEF')).toEqual(
      expect.objectContaining({ task: null, resolution: expect.objectContaining({ kind: 'AcknowledgedUnavailable' }) as unknown }),
    );
  }, 30_000);

  it('should report Incomplete while T-D integrity disagreement remains, even with an Action saved', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c, d, e } = await fiveTradeFixture(stack);
    await stack.saveMark('DEF', '40.50');
    for (const tradeId of [a, b, c, d, e]) await stack.saveAction(tradeId, 'Hold');

    const review = ready(await open(stack, MONDAY_1700));

    expect(review.completion).toEqual({
      kind: 'Incomplete',
      reasons: [{ code: 'IntegrityDisagreement', tradeId: d, findings: [expect.objectContaining({ kind: 'DeviationMissing' })] }],
    });
  }, 30_000);

  it('should not report an integrity blocker for a Deviation recorded after the cutoff', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(trade, TEN_AM, '100', '50.00');
    // 16:05 New York: 20 shares above plan, after the 16:00 cutoff, recorded as an Entry Size Deviation.
    await stack.fill(trade, '2026-10-12T20:05:00Z', '20', '50.50');
    await stack.saveMark('XYZ', '52.00');
    await stack.saveAction(trade.tradeId, 'Hold');

    const review = ready(await open(stack, MONDAY_1700));

    expect(review.completion).toEqual({ kind: 'Complete' });
    expect(walk(review).map((t) => t.band)).not.toContain('Blocker');
  }, 30_000);

  it('should not report an integrity blocker for a Position Change whose Executions straddle the cutoff', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    // One Position Change: 90 before the cutoff and 20 at 16:05 New York, over plan only in total.
    await stack.fillTogether(trade, [
      { economicTime: TEN_AM, quantity: '90', price: '50.00' },
      { economicTime: '2026-10-12T20:05:00Z', quantity: '20', price: '50.50' },
    ]);
    await stack.saveMark('XYZ', '52.00');
    await stack.saveAction(trade.tradeId, 'Hold');

    const review = ready(await open(stack, MONDAY_1700));

    expect(review.completion).toEqual({ kind: 'Complete' });
    expect(walk(review).map((t) => t.band)).not.toContain('Blocker');
  }, 30_000);

  it('should still report an integrity blocker for a disagreement in facts after the cutoff', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(trade, TEN_AM, '100', '50.00');
    // 16:05 New York: over plan after the cutoff, then its recorded Deviation is removed from the stored Trade.
    await stack.fill(trade, '2026-10-12T20:05:00Z', '20', '50.50');
    await rawEditTrade(stack, trade.tradeId, (t) => ({ ...t, deviations: [] }));
    await stack.saveMark('XYZ', '52.00');
    await stack.saveAction(trade.tradeId, 'Hold');

    const review = ready(await open(stack, MONDAY_1700));

    expect(walk(review)).toEqual([expect.objectContaining({ tradeId: trade.tradeId, band: 'Blocker', reasons: [{ code: 'IntegrityDisagreement', findings: [expect.objectContaining({ kind: 'DeviationMissing' })] }] })]);
    expect(review.completion).toEqual({ kind: 'Incomplete', reasons: [{ code: 'IntegrityDisagreement', tradeId: trade.tradeId, findings: [expect.objectContaining({ kind: 'DeviationMissing' })] }] });
  }, 30_000);

  it('should leave historical gaps out of completion', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const mno = await stack.confirm({ symbol: 'MNO', shares: '100', entry: '10.00', stop: '9.00', target: '14.00', planTime: '2026-10-07T13:00:00Z' });
    await stack.fill(mno, '2026-10-07T14:00:00Z', '100', '10.00');
    await stack.saveMark('MNO', '10.00', '2026-10-07');
    await stack.saveMark('MNO', '11.00', '2026-10-08');
    await stack.saveMark('MNO', '12.00');
    await stack.saveAction(mno.tradeId, 'Hold');

    const review = ready(await open(stack, MONDAY_1700));

    // Friday 2026-10-09 has no Mark and is listed, but only today's Mark and the Action count.
    expect(marks(review).earlier).toEqual([expect.objectContaining({ instrumentKey: 'MNO', missing: ['2026-10-09'], blocking: false })]);
    expect(review.completion).toEqual({ kind: 'Complete' });
  });

  it('should derive completion from facts only, with no stored Review, stage, or flag', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c, e } = await fiveTradeFixture(stack, { withoutD: true });
    const stores = async () => Object.keys(Object.values(await dumpAll(stack.factory)).find((db) => 'trades' in db) ?? {});
    const storesBefore = await stores();
    const kinds: string[] = [];
    const completionOf = async (review = stack.dailyReview) => {
      const before = await dumpAll(stack.factory);
      const { completion } = ready(await open({ ...stack, dailyReview: review }, MONDAY_1700));
      expect(await dumpAll(stack.factory)).toEqual(before);
      kinds.push(completion.kind);
      return completion;
    };

    await completionOf();
    await stack.acknowledge('DEF');
    for (const tradeId of [a, b, c, e]) await stack.saveAction(tradeId, 'Hold');
    const acknowledged = await completionOf();
    // A restart: a new Daily Review over the same Workspace reads the same result from the stored facts.
    const restarted = createDailyReview({ ...stack });
    expect(await completionOf(restarted)).toEqual(acknowledged);
    // A Mark saved over the acknowledgment (resolution revision 1) completes the Review with no Review step of its own.
    await stack.marketData.save({ intention: 'RecordInitialManualMark', instrumentKey: 'DEF', tradingDate: '2026-10-12', price: '40.50', expectedResolutionRevision: 1 });
    await completionOf();

    expect(kinds).toEqual(['Incomplete', 'CompleteWithUnavailableMarks', 'CompleteWithUnavailableMarks', 'Complete']);
    expect(await stores()).toEqual(storesBefore);
  }, 30_000);
});

describe('getTrade', () => {
  // The overview's binding is what the Review screen carries into a Trade.
  const overview = async (stack: ReviewStack) => ready(await open(stack, MONDAY_1700));
  const getTrade = async (stack: ReviewStack, tradeId: string) => {
    const { reviewDate, binding } = await overview(stack);
    return stack.dailyReview.getTrade({ reviewDate, tradeId, binding });
  };

  it('should return the Trade\'s summary, labels, Review-date frame with Stale context, Review-context evaluation, the existing Action or a new form with Hold preselected only in view state, the definition revision, and the save binding', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, c, e } = await fiveTradeFixture(stack);
    await stack.saveAction(e, 'Hold');
    // DEF has no Mark for Monday; Friday's is disclosed as context only.
    await stack.saveMark('DEF', '39.00', '2026-10-09');

    const result = await getTrade(stack, a);
    const missing = await getTrade(stack, c);
    const saved = await getTrade(stack, e);

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'Ready',
        reviewDate: '2026-10-12',
        trade: expect.objectContaining({
          tradeId: a,
          underlying: 'XYZ',
          summary: { kind: 'Stock', direction: 'Long', quantity: Rational.of(100n), price: Rational.of(5018n, 100n) },
          labels: { strategy: stack.strategy.label, account: stack.account.label, institution: stack.institution.label },
        }) as unknown,
      }),
    );
    expect(result.kind === 'Ready' && result.trade.frame).toEqual(
      expect.objectContaining({ instrumentKey: 'XYZ', tradingDate: '2026-10-12', closeInstant: MONDAY_CUTOFF, resolution: expect.objectContaining({ kind: 'Available' }) as unknown }),
    );
    expect(missing.kind === 'Ready' && missing.trade.frame?.resolution).toEqual({
      kind: 'Missing',
      stale: expect.objectContaining({ tradingDate: '2026-10-09', price: '39' }) as unknown,
    });
    // Evaluated at the cutoff with the Review-date frame: Monday's Mark values A; C's missing Mark is named and Friday's never used.
    expect(result.kind === 'Ready' && result.trade.evaluation).toEqual(
      expect.objectContaining({ valuationDate: '2026-10-12', marketValue: { kind: 'Value', value: Rational.of(5200n) } }),
    );
    expect(missing.kind === 'Ready' && missing.trade.evaluation).toEqual(
      expect.objectContaining({
        marketValue: { kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'DEF' }, date: '2026-10-12' },
        staleContext: expect.objectContaining({ tradingDate: '2026-10-09' }) as unknown,
      }),
    );
    // No Action yet: Hold is preselected in view state only. A saved Action is returned as it is.
    expect(result.kind === 'Ready' && result.trade.form).toEqual({ kind: 'New', viewState: { selectedAction: 'Hold' } });
    expect(saved.kind === 'Ready' && saved.trade.form).toEqual({ kind: 'Saved', action: expect.objectContaining({ action: 'Hold', entryRevision: 1 }) as unknown });
    // The form was rendered from the latest Daily Trade Review definition.
    const definition = await stack.journal.getDefinitions({ latestFor: 'entry-type.daily-trade-review' });
    expect(result.kind === 'Ready' && result.trade.definitionRevision).toBe(definition.kind === 'Found' && definition.definition.id);
    // Save must present the Trade revision, evidence snapshot, obligation, and form revision the Review showed.
    const { binding } = await overview(stack);
    expect(result.kind === 'Ready' && result.trade.saveBinding).toEqual({
      reviewDate: '2026-10-12',
      tradeId: a,
      factRevision: binding.factRevisions[a],
      marketDataSnapshotId: binding.marketDataSnapshotId,
      obligationKey: { entryType: 'DailyTradeReview', trade: a, reviewDate: '2026-10-12' },
      definitionRevision: definition.kind === 'Found' && definition.definition.id,
      databaseName: binding.workspace.databaseName,
    });
    // An Action being edited names the Entry revision it was shown at.
    expect(saved.kind === 'Ready' && saved.trade.saveBinding.expectedEntryRevision).toBe(1);
  }, 30_000);

  it('should include the dated last-close and at-entry lines when the Review-date Mark is Missing, P13', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // 60 shares bought Wednesday 10:00 and 40 on Monday; Wednesday's Mark is the latest, and Monday's is missing.
    const xyz = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-07T13:00:00Z' });
    await stack.fill(xyz, '2026-10-07T14:00:00Z', '60', '50.10');
    await stack.fill(xyz, TEN_AM, '40', '50.30');
    await stack.saveMark('XYZ', '52.00', '2026-10-08');

    const result = await getTrade(stack, xyz.tradeId);

    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
    const { evaluation, datedLastClose } = result.trade;
    // Current figures never use the earlier Mark.
    expect(evaluation?.marketValue).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'XYZ' }, date: '2026-10-12' });
    // The Position held at Wednesday's close, valued with Wednesday's own Mark.
    expect(datedLastClose).toEqual({
      tradingDate: '2026-10-08',
      evaluation: expect.objectContaining({ valuationDate: '2026-10-08', openQuantity: { kind: 'Value', value: Rational.of(60n) }, marketValue: { kind: 'Value', value: Rational.of(3120n) } }) as unknown,
    });
    // The 40 shares bought since are measured from their execution prices, never as valuation.
    expect(evaluation?.atEntry).toEqual({
      label: 'AtEntry',
      quantity: Rational.of(40n),
      averageEntry: Rational.of(503n, 10n),
      riskFromEntry: Rational.of(112n),
      rewardFromEntry: Rational.of(228n),
      riskFromEntryInPlanR: Rational.of(56n, 125n),
      rewardFromEntryInPlanR: Rational.of(114n, 125n),
    });

    // A Trade with no exposure at that close, though Friday's Mark exists, has no dated line.
    const def = await stack.confirm({ symbol: 'DEF', shares: '100', entry: '40.00', stop: '38.00', target: '46.00' });
    await stack.fill(def, TEN_AM, '100', '40.00');
    await stack.saveMark('DEF', '39.00', '2026-10-09');
    const unexposed = await getTrade(stack, def.tradeId);
    expect(unexposed.kind === 'Ready' && unexposed.trade.datedLastClose).toBeUndefined();
  }, 30_000);

  it('should return ReviewChanged when the Trade\'s revision or its evidence no longer matches the overview binding', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, c } = await fiveTradeFixture(stack);
    const { reviewDate, binding } = await overview(stack);

    // A fill recorded after the overview changes the Trade's FactRevision.
    const current = await stack.tradeRecord.getRecord({ tradeId: a, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    await stack.fill(current.projection as Parameters<typeof stack.fill>[0], '2026-10-12T20:05:00Z', '10', '51.00');

    expect(await stack.dailyReview.getTrade({ reviewDate, tradeId: a, binding })).toEqual({ kind: 'ReviewChanged' });

    // A Mark saved after the overview changes the Review-date evidence for a Trade whose own facts are unchanged.
    const evidenceBinding = (await overview(stack)).binding;
    expect((await stack.dailyReview.getTrade({ reviewDate, tradeId: c, binding: evidenceBinding })).kind).toBe('Ready');
    await stack.saveMark('DEF', '40.50');
    expect(await stack.dailyReview.getTrade({ reviewDate, tradeId: c, binding: evidenceBinding })).toEqual({ kind: 'ReviewChanged' });

    // A Trade the Review no longer finds eligible is a changed Review too.
    expect(await stack.dailyReview.getTrade({ reviewDate, tradeId: 'no-such-trade', binding })).toEqual({ kind: 'ReviewChanged' });
  }, 30_000);

  it('should return ReviewChanged when the overview binding names another Workspace', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await fiveTradeFixture(stack);
    const { reviewDate, binding } = await overview(stack);
    expect((await stack.dailyReview.getTrade({ reviewDate, tradeId: a, binding })).kind).toBe('Ready');

    const other = { ...binding, workspace: { ...binding.workspace, databaseName: `${binding.workspace.databaseName}-other` } };
    expect(await stack.dailyReview.getTrade({ reviewDate, tradeId: a, binding: other })).toEqual({ kind: 'ReviewChanged' });
  }, 30_000);

  it('should name the Entry first version\'s definition for a saved Action and the latest definition for a new form', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, e } = await fiveTradeFixture(stack);
    await stack.saveAction(e, 'Hold');
    const original = await stack.journal.getDefinitions({ latestFor: 'entry-type.daily-trade-review' });
    if (original.kind !== 'Found') throw new Error('no Daily Trade Review definition');
    // The Journal has no revise path yet: a second revision is written to the store directly.
    const revised = { ...original.definition, id: 'definition.daily-trade-review.r2', revisionNumber: original.definition.revisionNumber + 1 };
    const committed = await stack.persistence.commit({ checks: [], writes: [{ op: 'put', store: 'journalDefinitions', value: { ...revised } }] });
    expect(committed.kind).toBe('Committed');

    const saved = await getTrade(stack, e);
    const fresh = await getTrade(stack, a);

    if (saved.kind !== 'Ready' || fresh.kind !== 'Ready') throw new Error('expected Ready');
    expect(saved.trade.definitionRevision).toBe(original.definition.id);
    expect(saved.trade.saveBinding.definitionRevision).toBe(original.definition.id);
    expect(fresh.trade.definitionRevision).toBe(revised.id);
    expect(fresh.trade.saveBinding.definitionRevision).toBe(revised.id);
  }, 30_000);

  it('should record nothing', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c, e } = await fiveTradeFixture(stack);
    await stack.saveAction(e, 'Hold');
    const before = await dumpAll(stack.factory);

    // A new form, a saved Action, and a Missing Mark: opening and leaving each records nothing.
    for (const tradeId of [a, b, c, e]) expect((await getTrade(stack, tradeId)).kind).toBe('Ready');

    expect(await dumpAll(stack.factory)).toEqual(before);
  }, 30_000);

  it('should return the same attention reasons as the overview for an integrity disagreement and for facts that cannot be replayed', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { d, e } = await fiveTradeFixture(stack);
    await breakFirstExecution(stack, e);
    const review = await overview(stack);
    const { reviewDate, binding } = review;
    // The Trade card's attention is the overview item without its reflection counts, card progress and slider figures (T5.8, T5R.3-B3, T5R2.4).
    const items = walk(review).map((t) => Object.fromEntries(Object.entries(t).filter(([key]) => key !== 'reflections' && key !== 'progress' && key !== 'figures')));

    // A disagreement between stored records and facts keeps its Blocker reason, with the figures still evaluated.
    const disagreeing = await stack.dailyReview.getTrade({ reviewDate, tradeId: d, binding });
    expect(disagreeing.kind === 'Ready' && disagreeing.trade.attention).toEqual(items.find((t) => t.tradeId === d));

    // Facts that cannot be replayed give no frame or evaluation, only the Blocker and a form to answer.
    const unreplayable = await stack.dailyReview.getTrade({ reviewDate, tradeId: e, binding });
    if (unreplayable.kind !== 'Ready') throw new Error(`expected Ready, got ${unreplayable.kind}`);
    expect(unreplayable.trade.attention).toEqual(items.find((t) => t.tradeId === e));
    expect(unreplayable.trade.attention.reasons).toEqual([expect.objectContaining({ code: 'Unavailable', reason: 'FactsIncoherent' })]);
    expect(unreplayable.trade).not.toHaveProperty('evaluation');
    expect(unreplayable.trade.form).toEqual({ kind: 'New', viewState: { selectedAction: 'Hold' } });
  }, 30_000);
});

describe('range position per walked Trade (P39)', () => {
  it('should return each walked Trade share of its Stop-to-Target range now and at entry, from the same risk and reward its pressure basis selects: T-A 9/17 and 134/425, T-E 2/11 and 1/11', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c, e, f } = await cardFixture(stack);

    const trades = walk(await open(stack, MONDAY_1700));

    expect(trades.map((t) => t.tradeId)).toEqual([b, c, f, a, e]);
    const positionOf = (tradeId: string) => trades.find((t) => t.tradeId === tradeId)!.rangePosition;
    expect(positionOf(a)).toEqual({ kind: 'Value', value: { now: Rational.of(9n, 17n), atEntry: Rational.of(134n, 425n) } });
    expect(positionOf(e)).toEqual({ kind: 'Value', value: { now: Rational.of(2n, 11n), atEntry: Rational.of(1n, 11n) } });
    expect(positionOf(f)).toEqual({ kind: 'Value', value: { now: Rational.of(4n, 7n), atEntry: Rational.of(2n, 7n) } });
  }, 30_000);

  it('should return T-B share now as 0 with its StopBreached reason, and T-C as not placed with the missing Instrument and date', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { b, c } = await cardFixture(stack);

    const trades = walk(await open(stack, MONDAY_1700));

    const tb = trades.find((t) => t.tradeId === b)!;
    expect(tb.reasons).toEqual([expect.objectContaining({ code: 'StopBreached' })]);
    expect(tb.rangePosition).toEqual({ kind: 'Value', value: { now: Rational.of(0n), atEntry: Rational.of(1n, 4n), pinned: 'Stop' } });
    expect(trades.find((t) => t.tradeId === c)!.rangePosition).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: stock('DEF'), date: '2026-10-12' });
  }, 30_000);

  // Added beyond the planned cases: the Target end of the pin rule (reward zero gives share 1).
  it('should return the share 1 pinned at the Target when the Mark is past the Target', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '51.00' });
    await stack.fill(trade, TEN_AM, '100', '50.00');
    await stack.saveMark('XYZ', '52.00');

    const [item] = walk(await open(stack, MONDAY_1700));

    expect(item!.reasons).toEqual([expect.objectContaining({ code: 'TargetReached' })]);
    expect(item!.rangePosition).toEqual({ kind: 'Value', value: { now: Rational.of(1n), atEntry: Rational.of(250n, 350n), pinned: 'Target' } });
  }, 30_000);
});

describe('slider figures per walked Trade (P39, A150)', () => {
  it('should return each walked Trade Ongoing Risk to Stop, current P and L, and Reward to risk now from the Review-date evaluation: T-A at XYZ 52.00 with 8/9, T-B Not applicable, T-C Unavailable with the missing Mark', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c } = await cardFixture(stack);
    const opened = ready(await open(stack, MONDAY_1700));
    const trades = walk(opened);

    const figuresOf = (tradeId: string) => trades.find((t) => t.tradeId === tradeId)!.figures;
    expect(figuresOf(a)?.rewardRiskNow).toEqual({ kind: 'Value', value: Rational.of(8n, 9n) });
    expect(figuresOf(b)?.rewardRiskNow.kind).toBe('NotApplicable');
    const tc = figuresOf(c);
    expect(tc?.riskToStop).toMatchObject({ kind: 'Unavailable' });
    expect(tc?.pnl.kind).toBe('Unavailable');
    expect(tc?.rewardRiskNow.kind).toBe('Unavailable');
    // The collapsed card and the open card never disagree.
    for (const tradeId of [a, b, c]) {
      const result = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
      const evaluation = result.kind === 'Ready' ? result.trade.evaluation : undefined;
      expect(figuresOf(tradeId)).toEqual({
        riskToStop: evaluation?.ongoingRiskToStop,
        pnl: evaluation?.currentMarkedPnl,
        rewardRiskNow: evaluation?.rewardRiskNow,
      });
    }
  }, 30_000);
});

describe('historical gap groups name their Trades (A153)', () => {
  it('should list with XYZ gap group each eligible Trade that holds XYZ and the first session it is relevant from: T-A from Friday 2026-10-09, T-F from Monday 2026-10-12, so Friday gap belongs to T-A card only', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, f } = await cardFixture(stack);

    const { earlier } = marks(await open(stack, MONDAY_1700));

    expect(earlier).toHaveLength(1);
    expect(earlier[0]).toMatchObject({ instrumentKey: 'XYZ', missing: ['2026-10-09'] });
    // In the walk's order: T-F ranks before T-A. T-F has no listed date at or after its fill, so it is listed from the Review date (decision 63).
    expect(earlier[0]!.trades).toEqual([
      { tradeId: f, from: '2026-10-12' },
      { tradeId: a, from: '2026-10-09' },
    ]);
  }, 30_000);

  // Setup chosen: Monday Review, so Friday is the only listed date. A Trade filled Friday 17:00 New York
  // (after Friday's 16:00 close) has no listed date relevant to it, so it must be absent: the unambiguous case.
  it('should list a Trade filled after a session close from the next session, so that session gap is not on its card', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await cardFixture(stack);
    const g = await stack.confirm({ symbol: 'XYZ', shares: '10', entry: '50.00', stop: '48.00', target: '55.00', planTime: '2026-10-09T13:00:00Z' });
    await stack.fill(g, '2026-10-09T21:00:00Z', '10', '50.00');

    const { earlier } = marks(await open(stack, MONDAY_1700));

    // No listed date is at or after the fill, so the Trade is listed from the Review date (decision 63).
    expect(earlier[0]!.trades.find((t) => t.tradeId === g.tradeId)).toEqual({ tradeId: g.tradeId, from: '2026-10-12' });
    expect(earlier[0]!.trades.find((t) => t.tradeId === a)).toEqual({ tradeId: a, from: '2026-10-09' });
  }, 30_000);
});

describe('Plan baseline (P40)', () => {
  it('should return T-A Plan baseline: 1R $250.00, original planned reward $600.00, and planned Reward : risk 12/5, with Reward : risk now 8/9 in its evaluation', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await cardFixture(stack);
    const opened = ready(await open(stack, MONDAY_1700));

    const result = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId: a, binding: opened.binding });

    expect(result.kind).toBe('Ready');
    const evaluation = result.kind === 'Ready' ? result.trade.evaluation : undefined;
    expect(evaluation?.oneR).toEqual({ kind: 'Value', value: Rational.of(250n) });
    expect(evaluation?.planBaseline).toEqual({
      kind: 'Value',
      value: expect.objectContaining({
        oneR: Rational.of(250n),
        originalPlannedRisk: Rational.of(250n),
        originalPlannedReward: Rational.of(600n),
        rewardRiskRatio: Rational.of(12n, 5n),
      }) as unknown,
    });
    expect(evaluation?.rewardRiskNow).toEqual({ kind: 'Value', value: Rational.of(8n, 9n) });
  }, 30_000);
});

describe('card progress in open (A164)', () => {
  const progressOf = (result: OpenDailyReviewResult, tradeId: string) => walk(result).find((t) => t.tradeId === tradeId)!.progress;
  const marksPanel = (resolved: number, needed: number) => ({ panel: 'Marks', done: needed === 0, resolved, needed });
  const reflectionsPanel = (dueNow: number, later: number) => ({ panel: 'Reflections', done: dueNow === 0, dueNow, later });
  const actionPanel = (owed: boolean) => ({ panel: 'Action', done: !owed, owed });

  it('should return each walked Trade progress with its panels Marks, Reflections, Action in that order and the counts of the expected-progress table, none of them done', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, c, e, f } = await cardFixture(stack);
    const opened = await open(stack, MONDAY_1700);

    const expected: readonly (readonly [string, number, number, number, number])[] = [[a, 1, 0, 1, 1], [b, 1, 0, 0, 0], [c, 0, 1, 0, 0], [e, 1, 0, 0, 0], [f, 1, 0, 0, 0]];
    for (const [tradeId, resolved, needed, dueNow, later] of expected) {
      expect(progressOf(opened, tradeId)).toEqual({
        kind: 'Walked',
        panels: [marksPanel(resolved, needed), reflectionsPanel(dueNow, later), actionPanel(true)],
        done: false,
      });
    }
    expect(walk(opened)).toHaveLength(5);
  }, 30_000);

  it('should count a shared Instrument Missing Mark as needed on every card that holds it: T-A and T-F each 0 resolved and 1 needed without Marks', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, f } = await cardFixture(stack, { withoutMarks: true });
    const opened = await open(stack, MONDAY_1700);

    for (const tradeId of [a, f]) expect(progressOf(opened, tradeId).panels[0]).toEqual(marksPanel(0, 1));
  }, 30_000);

  it('should count an acknowledged Review-date Mark as resolved: T-C 1 resolved and 0 needed once DEF is acknowledged', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { c } = await cardFixture(stack);
    await stack.acknowledge('DEF');
    const opened = await open(stack, MONDAY_1700);

    expect(progressOf(opened, c).panels[0]).toEqual(marksPanel(1, 0));
  }, 30_000);

  it('should mark the Action panel done, and the card done, once an Action is saved for a Trade with nothing else owed: T-E after Hold', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { e } = await cardFixture(stack);
    await stack.saveAction(e, 'Hold');
    const opened = await open(stack, MONDAY_1700);

    expect(progressOf(opened, e)).toEqual({ kind: 'Walked', panels: [marksPanel(1, 0), reflectionsPanel(0, 0), actionPanel(false)], done: true });
  }, 30_000);

  it('should keep T-A not done after its Action is saved while D-1 is due, with the Reflections panel 1 due now and 1 later', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await cardFixture(stack);
    await stack.saveAction(a, 'Hold');
    const opened = await open(stack, MONDAY_1700);

    expect(progressOf(opened, a)).toEqual({ kind: 'Walked', panels: [marksPanel(1, 0), reflectionsPanel(1, 1), actionPanel(false)], done: false });
  }, 30_000);
});

const REFLECTION_ANSWERS = {
  'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
  'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
  'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
} as const;

const walkedProgress = (opened: OpenDailyReviewResult, tradeId: string) => walk(opened).find((t) => t.tradeId === tradeId)!.progress;
const panelsOf = (progress: { readonly panels: readonly unknown[] }) => progress.panels;

async function openedBinding(stack: ReviewStack) {
  const opened = ready(await open(stack, MONDAY_1700));
  return { opened, reviewDate: opened.reviewDate, binding: opened.binding };
}

async function tradeOf(stack: ReviewStack, tradeId: string) {
  const { reviewDate, binding } = await openedBinding(stack);
  const result = await stack.dailyReview.getTrade({ reviewDate, tradeId, binding });
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result.trade;
}

async function resolveReflection(stack: ReviewStack, tradeId: string, debtIndex: number): Promise<Extract<SaveDailyReviewResult, { kind: 'DebtResolved' }>> {
  const { reviewDate } = await openedBinding(stack);
  const reflection = (await tradeOf(stack, tradeId)).reflections[debtIndex]!;
  const binding: ReflectionSaveBinding = reflection.saveBinding;
  const result = await stack.dailyReview.save({ kind: 'ResolveReviewDebt', reviewDate, binding, resolution: { kind: 'Answer', answers: REFLECTION_ANSWERS } });
  if (result.kind !== 'DebtResolved') throw new Error(`expected DebtResolved, got ${result.kind}`);
  return result;
}

describe('card progress in getTrade (A165)', () => {
  it('should return on T-A card the same progress as T-A walked item in open', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await cardFixture(stack);
    const { opened } = await openedBinding(stack);

    const trade = await tradeOf(stack, a);

    expect(trade.progress).toEqual(walkedProgress(opened, a));
    expect(panelsOf(trade.progress)).toHaveLength(3);
  }, 30_000);
});

describe('card progress in save results (A165, Q12)', () => {
  it('should return T-E progress, done, in the cards of the review a SaveTradeAction for T-E returns, and the next step Trade with its own progress', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { e } = await cardFixture(stack);
    await stack.saveMark('DEF', '40.50');
    const binding = (await tradeOf(stack, e)).saveBinding;

    const result = await stack.dailyReview.save({ kind: 'SaveTradeAction', binding, action: 'Hold' });

    if (result.kind !== 'Saved' || result.review.kind !== 'Ready') throw new Error('expected a Ready saved review');
    expect(result.review.cards).toEqual([{ tradeId: e, progress: { kind: 'Walked', panels: [{ panel: 'Marks', done: true, resolved: 1, needed: 0 }, { panel: 'Reflections', done: true, dueNow: 0, later: 0 }, { panel: 'Action', done: true, owed: false }], done: true } }]);
    const next = result.review.nextStep;
    if (next.kind !== 'Trade') throw new Error(`expected a Trade next step, got ${next.kind}`);
    const reopened = await open(stack, MONDAY_1700);
    expect(next.trade.progress).toEqual(walkedProgress(reopened, next.trade.tradeId));
    expect(next.trade.tradeId).not.toBe(e);
  }, 60_000);

  it('should return T-A progress with 0 due now and 1 later, and the Reflections panel done, after ResolveReviewDebt answers D-1', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await cardFixture(stack);

    const result = await resolveReflection(stack, a, 0);

    if (result.review.kind !== 'Ready') throw new Error('expected a Ready review');
    const card = result.review.cards.find((c) => c.tradeId === a)!;
    expect(panelsOf(card.progress)[1]).toEqual({ panel: 'Reflections', done: true, dueNow: 0, later: 1 });
    expect(result.review.cards).toHaveLength(1);
  }, 60_000);

  it('should return T-A progress with 0 due now and 0 later after D-1 and D-2 are both resolved, so the panel has nothing owed', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a } = await cardFixture(stack);
    await resolveReflection(stack, a, 0);

    const result = await resolveReflection(stack, a, 0);

    if (result.review.kind !== 'Ready') throw new Error('expected a Ready review');
    const card = result.review.cards.find((c) => c.tradeId === a)!;
    expect(panelsOf(card.progress)[1]).toEqual({ panel: 'Reflections', done: true, dueNow: 0, later: 0 });
  }, 60_000);

  it('should return, after SaveReviewMarks saves XYZ from T-A card without Marks, T-A and T-F each with 1 resolved and 0 needed among the review trades, and T-A card progress equal to its walked item', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, f } = await cardFixture(stack, { withoutMarks: true });
    const { reviewDate, binding } = await openedBinding(stack);
    const entries = [{ key: { instrumentKey: 'XYZ', tradingDate: reviewDate }, expectedRevision: 'None' as const, intention: { kind: 'RecordInitialManualMark' as const, price: '52.00' } }];

    const result = await stack.dailyReview.save({ kind: 'SaveReviewMarks', reviewDate, tradeId: a, binding, entries });

    if (result.kind !== 'MarksSaved' || result.review.kind !== 'Ready') throw new Error('expected a Ready marks review');
    const { trades, trade } = result.review;
    for (const tradeId of [a, f]) expect(panelsOf(trades.find((t) => t.tradeId === tradeId)!.progress)[0]).toEqual({ panel: 'Marks', done: true, resolved: 1, needed: 0 });
    expect(trade.progress).toEqual(trades.find((t) => t.tradeId === a)!.progress);
  }, 60_000);
});

describe('pressure and range position (P66, P67)', () => {
  it('should return pressure and range position as Values with todays figures for XYZ, ABC and JKL', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, b, e } = await cardFixture(stack);

    const trades = walk(await open(stack, MONDAY_1700));

    const of = (id: string) => trades.find((t) => t.tradeId === id)!;
    expect(of(a).basis).toEqual({ kind: 'Value', value: { side: 'Winning', share: Rational.of(91n, 291n), atEntry: Rational.of(582n), now: Rational.of(400n) } });
    expect(of(a).rangePosition).toEqual({ kind: 'Value', value: { now: Rational.of(9n, 17n), atEntry: Rational.of(134n, 425n) } });
    expect(of(b).basis).toEqual({ kind: 'Value', value: { side: 'Losing', share: Rational.of(1n), atEntry: Rational.of(200n), now: Rational.of(0n) } });
    expect(of(b).rangePosition).toEqual({ kind: 'Value', value: { now: Rational.of(0n), atEntry: Rational.of(1n, 4n), pinned: 'Stop' } });
    expect(of(e).basis).toEqual({ kind: 'Value', value: { side: 'Winning', share: Rational.of(1n, 10n), atEntry: Rational.of(1000n), now: Rational.of(900n) } });
    expect(of(e).rangePosition).toEqual({ kind: 'Value', value: { now: Rational.of(2n, 11n), atEntry: Rational.of(1n, 11n) } });
  }, 30_000);

  it('should return DEFs pressure and range position as the same Unavailable MarkMissing DEF Mon Oct 12 its evaluation returns', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { c } = await cardFixture(stack);

    const item = walk(await open(stack, MONDAY_1700)).find((t) => t.tradeId === c)!;

    const missing = { kind: 'Unavailable', reason: 'MarkMissing', instrument: stock('DEF'), date: '2026-10-12' };
    expect(item.basis).toEqual(missing);
    expect(item.rangePosition).toEqual(missing);
  }, 30_000);

  it('should return an acknowledged DEF Mark as Unavailable AcknowledgedUnavailable in both, no longer merged with a missing Mark in the pressure', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { c } = await cardFixture(stack);
    await stack.acknowledge('DEF');

    const item = walk(await open(stack, MONDAY_1700)).find((t) => t.tradeId === c)!;

    const acknowledged = { kind: 'Unavailable', reason: 'AcknowledgedUnavailable', instrument: stock('DEF'), date: '2026-10-12' };
    expect(item.basis).toEqual(acknowledged);
    expect(item.rangePosition).toEqual(acknowledged);
  }, 30_000);

  it('should return pressure NotApplicable NonPositiveAtEntry Losing with range position still a Value, for a Trade whose risk at entry is not positive', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // Filled at its Stop and marked below it: no risk was taken at entry.
    const atStop = await stack.confirm({ symbol: 'LOW', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(atStop, TEN_AM, '100', '28.00');
    await stack.saveMark('LOW', '27.00');

    const [item] = walk(await open(stack, MONDAY_1700));

    expect(item!.basis).toEqual({ kind: 'NotApplicable', reason: 'NonPositiveAtEntry', side: 'Losing' });
    expect(item!.rangePosition).toEqual({ kind: 'Value', value: { now: Rational.of(0n), atEntry: Rational.of(0n), pinned: 'Stop' } });
  }, 30_000);

  it('should return a Trade whose facts cannot be replayed with both as Unavailable FactsIncoherent carrying its findings', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(trade, TEN_AM, '100', '50.00');
    await stack.saveMark('XYZ', '52.00');
    await breakFirstExecution(stack, trade.tradeId);

    const [item] = walk(await open(stack, MONDAY_1700));

    const incoherent = { kind: 'Unavailable', reason: 'FactsIncoherent', findings: [expect.objectContaining({ reason: 'UnknownPlannedLeg', kind: 'Execution', instrument: stock('XYZ') })] };
    expect(item!.basis).toEqual(incoherent);
    expect(item!.rangePosition).toEqual(incoherent);
  }, 30_000);
});

describe('attention reasons and incomplete reasons (P67, P68)', () => {
  it('should give the blocker for facts that cannot be replayed the same FactsIncoherent reason, with its findings', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(trade, TEN_AM, '100', '50.00');
    await stack.saveMark('XYZ', '52.00');
    await breakFirstExecution(stack, trade.tradeId);

    const [item] = walk(await open(stack, MONDAY_1700));

    const findings = [expect.objectContaining({ reason: 'UnknownPlannedLeg', kind: 'Execution' })];
    expect(item!.band).toBe('Blocker');
    expect(item!.reasons).toEqual([{ code: 'Unavailable', reason: 'FactsIncoherent', findings }]);
    expect(item!.basis).toEqual({ kind: 'Unavailable', reason: 'FactsIncoherent', findings });
  }, 30_000);

  it('should name the Instrument of a MarkMissing incomplete reason as an Instrument, converted from its key', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { c } = await cardFixture(stack);

    const review = ready(await open(stack, MONDAY_1700));

    if (review.completion.kind !== 'Incomplete') throw new Error('expected an Incomplete Review');
    expect(review.completion.reasons.filter((r) => r.code === 'MarkMissing')).toEqual([{ code: 'MarkMissing', instrument: stock('DEF'), tradingDate: '2026-10-12', trades: [c] }]);
  }, 30_000);
});

describe("the Review's session-policy reach (P73)", () => {
  it('should open the Review with its as-of instant outside session-policy coverage and return what it returns today', async () => {
    // Coverage is 2024-01-01 to 2028-12-31. After it, and early on its first morning (the Review date would be 2023-12-31), open rejects the as-of instant.
    const after = await reviewStack('2029-01-03T22:00:00Z');
    await cardFixture(after);
    expect(await open(after, '2029-01-03T22:00:00Z')).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'asOf', code: 'SessionPolicyCoverage', date: '2029-01-03', coverage: { first: '2024-01-01', last: '2028-12-31' } }],
    });
    const before = await reviewStack('2024-01-02T14:00:00Z');
    const trade = await before.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2023-12-28T14:00:00Z' });
    await before.fill(trade, '2023-12-28T15:00:00Z', '100', '50.00');
    expect(await open(before, '2024-01-02T14:00:00Z')).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'asOf', code: 'SessionPolicyCoverage', date: '2023-12-31', coverage: { first: '2024-01-01', last: '2028-12-31' } }],
    });
  }, 30_000);
});
