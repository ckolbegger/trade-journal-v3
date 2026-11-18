import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/index.ts';
import { Rational } from '../values/index.ts';
import { derive, evaluate, type CalculationResult, type PositionChangeFact, type TradeAnalysisRecord } from './index.ts';
import { BREN_CALL, DALE_PUT, K_SALE, OC2_CONTRACT, OC3_BUY, OC3_SELL, oc3Record, OS_CONTRACT, OS_S1, osRecord, CORV_PUT, R_BREN_U, R_CORV_D, R_DALE_D, R_DALE_U } from './option-trade.ts';
import { AXIO, PC1, PC2, R_AXIO_U, referenceRecord, REPLAY_SESSION_DATES, type ReplayTestSeries, X1, X2 } from './reference-trade.ts';
import { replay, type ReplayResult, type ReplaySessionInput } from './replay-series.ts';

const XYZ: Instrument = { kind: 'Stock', symbol: 'XYZ' };
const CALL = OC2_CONTRACT;

// Closing instants of the four sessions, New York daylight time (UTC-4).
const CLOSE = { mon: '2026-10-12T20:00:00Z', tue: '2026-10-13T20:00:00Z', wed: '2026-10-14T20:00:00Z', thu: '2026-10-15T20:00:00Z' } as const;
const DATE = { mon: '2026-10-12', tue: '2026-10-13', wed: '2026-10-14', thu: '2026-10-15' } as const;

const available = (instrument: Instrument, tradingDate: string, closeInstant: string, price: string) =>
  ({ instrument, tradingDate, closeInstant, resolution: { kind: 'Available', mark: { revisionId: `rev-${tradingDate}`, revisionNumber: 1, price } } }) as const;
const missing = (instrument: Instrument, tradingDate: string, closeInstant: string) =>
  ({ instrument, tradingDate, closeInstant, resolution: { kind: 'Missing' } }) as const;

// O-C3's four sessions: Tuesday has no Mark for either Instrument.
const OC3_SESSIONS: readonly ReplaySessionInput[] = [
  { tradingDate: DATE.mon, closeInstant: CLOSE.mon, frames: [available(XYZ, DATE.mon, CLOSE.mon, '56.00'), available(CALL, DATE.mon, CLOSE.mon, '2.10')] },
  { tradingDate: DATE.tue, closeInstant: CLOSE.tue, frames: [missing(XYZ, DATE.tue, CLOSE.tue), missing(CALL, DATE.tue, CLOSE.tue)] },
  { tradingDate: DATE.wed, closeInstant: CLOSE.wed, frames: [available(XYZ, DATE.wed, CLOSE.wed, '57.40'), available(CALL, DATE.wed, CLOSE.wed, '2.90')] },
  { tradingDate: DATE.thu, closeInstant: CLOSE.thu, frames: [available(XYZ, DATE.thu, CLOSE.thu, '57.90'), available(CALL, DATE.thu, CLOSE.thu, '3.20')] },
];

const frac = (r: Rational) => `${r.numerator}/${r.denominator}`;
const q = (n: bigint, d = 1n) => frac(Rational.of(n, d));

function replayed(result: ReplayResult) {
  if (result.kind !== 'Replayed') throw new Error(`expected Replayed, got ${JSON.stringify(result)}`);
  return result.sessions;
}

describe('replay: per-session results (A211)', () => {
  it("should give O-C3's Monday session a Trade P&L of $18.70 with 2 contracts held and no change, as its first session with a figure", () => {
    const monday = replayed(replay({ record: oc3Record([OC3_BUY, OC3_SELL]), sessions: OC3_SESSIONS }))[0]!;
    expect(monday.date).toBe(DATE.mon);
    expect(monday.tradePnl.kind === 'Value' && frac(monday.tradePnl.value)).toBe(q(1870n, 100n));
    expect(frac(monday.heldQuantity)).toBe(q(2n));
    expect(monday.change).toBeNull();
  });

  it('should give Tuesday Unavailable Mark missing naming the call, with no change and no value carried from Monday', () => {
    const tuesday = replayed(replay({ record: oc3Record([OC3_BUY, OC3_SELL]), sessions: OC3_SESSIONS }))[1]!;
    expect(tuesday.date).toBe(DATE.tue);
    expect(tuesday.tradePnl).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: CALL, date: DATE.tue });
    expect(tuesday.change).toBeNull();
    expect(frac(tuesday.heldQuantity)).toBe(q(2n));
  });

  it("should give Wednesday a Trade P&L of $188.05 from realized $98.70 and the remaining contract, +$169.35 since Monday, with the sale's Position Change id", () => {
    const wednesday = replayed(replay({ record: oc3Record([OC3_BUY, OC3_SELL]), sessions: OC3_SESSIONS }))[2]!;
    expect(frac(wednesday.realizedPnl)).toBe(q(9870n, 100n));
    expect(wednesday.tradePnl.kind === 'Value' && frac(wednesday.tradePnl.value)).toBe(q(18805n, 100n));
    expect(frac(wednesday.heldQuantity)).toBe(q(1n));
    expect(wednesday.change && { since: wednesday.change.since, dollars: frac(wednesday.change.dollars) }).toEqual({ since: DATE.mon, dollars: q(16935n, 100n) });
    expect(wednesday.positionChangeIds).toEqual([OC3_SELL.factId]);
  });

  it("should give each Mark its change since that Instrument's previous Mark, the call +$0.80 since Monday on Wednesday", () => {
    const [monday, tuesday, wednesday, thursday] = replayed(replay({ record: oc3Record([OC3_BUY, OC3_SELL]), sessions: OC3_SESSIONS }));
    const changes = (s: NonNullable<typeof monday>) =>
      s.marks.map((m) => ({ instrument: m.instrument, change: m.change && { since: m.change.since, dollars: frac(m.change.dollars) } }));
    expect(changes(monday!)).toEqual([{ instrument: XYZ, change: null }, { instrument: CALL, change: null }]);
    expect(changes(tuesday!)).toEqual([{ instrument: XYZ, change: null }, { instrument: CALL, change: null }]);
    expect(changes(wednesday!)).toEqual([
      { instrument: XYZ, change: { since: DATE.mon, dollars: q(140n, 100n) } },
      { instrument: CALL, change: { since: DATE.mon, dollars: q(80n, 100n) } },
    ]);
    expect(changes(thursday!)[1]).toEqual({ instrument: CALL, change: { since: DATE.wed, dollars: q(30n, 100n) } });
    expect(wednesday!.marks[1]!.resolution).toEqual(OC3_SESSIONS[2]!.frames[1]!.resolution);
    expect(tuesday!.marks[1]!.resolution).toEqual({ kind: 'Missing' });
  });

  it("should give a Long Stock Trade one Mark per session and its Trade P&L (D6's T-A)", () => {
    // T-A: PC1 and PC2 Monday buy 100 shares for $5,018.00 with fees $2.00; X1 Tuesday sells 30 @ 52.00, fee 0.60.
    const sessions: readonly ReplaySessionInput[] = [
      { tradingDate: DATE.mon, closeInstant: CLOSE.mon, frames: [available(XYZ, DATE.mon, CLOSE.mon, '50.50')] },
      { tradingDate: DATE.tue, closeInstant: CLOSE.tue, frames: [available(XYZ, DATE.tue, CLOSE.tue, '52.50')] },
    ];
    const [monday, tuesday] = replayed(replay({ record: referenceRecord([PC1, PC2, X1]), sessions }));
    expect(monday!.marks.map((m) => m.instrument)).toEqual([XYZ]);
    expect(tuesday!.marks.map((m) => m.instrument)).toEqual([XYZ]);
    expect(monday!.tradePnl.kind === 'Value' && frac(monday!.tradePnl.value)).toBe(q(3000n, 100n));
    expect(frac(monday!.heldQuantity)).toBe(q(100n));
    // Realized $55.90 and the 70 shares left, marked at 52.50: $158.50.
    expect(frac(tuesday!.realizedPnl)).toBe(q(5590n, 100n));
    expect(tuesday!.tradePnl.kind === 'Value' && frac(tuesday!.tradePnl.value)).toBe(q(21440n, 100n));
    expect(frac(tuesday!.heldQuantity)).toBe(q(70n));
    expect(tuesday!.change && { since: tuesday!.change.since, dollars: frac(tuesday!.change.dollars) }).toEqual({ since: DATE.mon, dollars: q(18440n, 100n) });
    expect(tuesday!.marks[0]!.change && frac(tuesday!.marks[0]!.change.dollars)).toBe(q(2n));
    expect(tuesday!.positionChangeIds).toEqual([X1.factId]);
  });

  it('should return Not applicable for a Trade never exposed', () => {
    expect(replay({ record: oc3Record(), sessions: OC3_SESSIONS })).toEqual({ kind: 'NotApplicable', reason: 'NeverExposed' });
  });

  // Added beyond the planned cases: the lifetime of a Closed Trade ends on a flat session.
  it('should give the session a Trade closes in its realized P&L as its Trade P&L, with nothing held', () => {
    const sessions: readonly ReplaySessionInput[] = [
      { tradingDate: DATE.mon, closeInstant: CLOSE.mon, frames: [available(XYZ, DATE.mon, CLOSE.mon, '50.50')] },
      { tradingDate: DATE.tue, closeInstant: CLOSE.tue, frames: [available(XYZ, DATE.tue, CLOSE.tue, '52.50')] },
    ];
    const [, tuesday] = replayed(replay({ record: { ...referenceRecord([PC1, PC2, X1, X2]), storedLifecycle: 'Closed' }, sessions }));
    expect(frac(tuesday!.heldQuantity)).toBe(q(0n));
    expect(tuesday!.tradePnl).toEqual({ kind: 'Value', value: tuesday!.realizedPnl });
    expect(tuesday!.change && frac(tuesday!.change.dollars)).toBe(frac(tuesday!.realizedPnl.sub(Rational.of(3000n, 100n))));
  });

  // Bug task T8P.7-B1 (ocr): a session whose frames lack the held Instrument's is a gap, not a crash.
  it("it should give that session an unavailable Trade P&L, not throw, when its frames lack the held Instrument's.", () => {
    const sessions: readonly ReplaySessionInput[] = [
      OC3_SESSIONS[0]!,
      { tradingDate: DATE.tue, closeInstant: CLOSE.tue, frames: [missing(XYZ, DATE.tue, CLOSE.tue)] },
    ];
    const [, tuesday] = replayed(replay({ record: oc3Record([OC3_BUY, OC3_SELL]), sessions }));
    expect(tuesday!.tradePnl).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: CALL, date: DATE.tue });
    expect(tuesday!.change).toBeNull();
  });

  // Added beyond the planned cases: facts that cannot be replayed give no figure.
  it('should return Not applicable naming each finding when the facts cannot be replayed', () => {
    const result = replay({ record: referenceRecord([X1]), sessions: [] });
    expect(result.kind).toBe('NotApplicable');
    expect(result).toMatchObject({ reason: 'FactsIncoherent', findings: [{ factId: 'ex-x1', reason: 'ExceedsOpenQuantity' }] });
  });
});

describe("evaluate: Max reward's R (W6, revision 89)", () => {
  it('should give a bounded Max reward its R, as Worst case has, and no R when it is Unbounded above', () => {
    const MNO: Instrument = { kind: 'Stock', symbol: 'MNO' };
    const derivedOf = (record: TradeAnalysisRecord, valuationDate: string) => {
      const state = derive({ record, valuationDate });
      if (state.kind !== 'Derived') throw new Error('expected Derived');
      return state;
    };
    // O-S after S1 at a put Mark of 0.80: Max reward $160.00 over 1R $360.00 is 4/9 R; Worst case $8,840.00 has its R beside it.
    const put = evaluate({
      state: derivedOf(osRecord([OS_S1]), DATE.mon),
      frame: available(OS_CONTRACT, DATE.mon, CLOSE.mon, '0.80'),
      underlyingFrame: available(MNO, DATE.mon, CLOSE.mon, '47.00'),
    });
    expect(put.maximumIncrementalRewardInPlanR).toEqual({ kind: 'Value', value: Rational.of(4n, 9n) });
    expect(put.worstCaseOngoingRiskInPlanR.kind).toBe('Value');
    // A long Call's reward has no ceiling, so there is no R to give.
    const call = evaluate({
      state: derivedOf(oc3Record([OC3_BUY]), DATE.mon),
      frame: available(CALL, DATE.mon, CLOSE.mon, '2.10'),
      underlyingFrame: available(XYZ, DATE.mon, CLOSE.mon, '56.00'),
    });
    expect(call.maximumIncrementalRewardInPlanR).toMatchObject({ kind: 'Unbounded', direction: 'Above' });
  });
});

// D9's test Trades: every session of the series, closing 16:00 New York (EST from Sun 2026-11-01), with each session's
// Marks observed (null: no Mark).
const sessionsOf = (series: ReplayTestSeries): readonly ReplaySessionInput[] =>
  REPLAY_SESSION_DATES.map((date, i) => {
    const closeInstant = `${date}T21:00:00Z`;
    const frame = (instrument: Instrument, price: string | null | undefined) =>
      price === null || price === undefined ? missing(instrument, date, closeInstant) : available(instrument, date, closeInstant, price);
    return {
      tradingDate: date,
      closeInstant,
      frames: [frame({ kind: 'Stock', symbol: series.record.plan.underlying }, series.underlying[i]), frame(series.record.plan.legs[0]!.instrument, series.held[i])],
    };
  });
const sessionAt = (series: ReplayTestSeries, date: string) => {
  const session = replayed(replay({ record: series.record, sessions: sessionsOf(series) })).find((s) => s.date === date);
  if (!session) throw new Error(`no session ${date}`);
  return session;
};
const figuresAt = (series: ReplayTestSeries, date: string) => {
  const { figures } = sessionAt(series, date);
  if (!figures) throw new Error(`no figures on ${date}`);
  return figures;
};
const valueOf = (result: CalculationResult<Rational>) => (result.kind === 'Value' ? frac(result.value) : result);

describe("replay: each session's risk, reward and condition status (A250)", () => {
  it("should give R-BREN-U's Mon 11-02 session a Risk to stop of 352.00 (1.09R) and a Reward to target of 928.00, both conditions Active", () => {
    const figures = figuresAt(R_BREN_U, '2026-11-02');
    expect(valueOf(figures.ongoingRiskToStop)).toBe(q(352n));
    expect(valueOf(figures.ongoingRiskToStopInPlanR)).toBe(q(352n, 324n));
    expect(valueOf(figures.incrementalRewardToTarget)).toBe(q(928n));
    expect(valueOf(figures.currentMarkedPnlInPlanR)).toBe(q(28n, 324n));
    expect(figures.conditions.map((c) => [c.role, c.result.kind === 'Value' && c.result.value.status])).toEqual([['Stop', 'Active'], ['Target', 'Active']]);
  });

  it("should read an option Trade's Underlying condition from that session's Underlying Mark: R-DALE-D Fri 11-13, the Stop Breached, DALE 0.30 past 54.00", () => {
    const stop = figuresAt(R_DALE_D, '2026-11-13').conditions.find((c) => c.role === 'Stop')!;
    if (stop.result.kind !== 'Value') throw new Error(`expected a Value, got ${JSON.stringify(stop.result)}`);
    expect(stop.result.value.status).toBe('Breached');
    expect(stop.result.value.trigger && frac(stop.result.value.trigger.beyond!)).toBe(q(30n, 100n));
    expect(stop.result.value.evidence.instrument).toEqual({ kind: 'Stock', symbol: 'DALE' });
  });

  it('should carry each session\'s results at the Stop and the Target, stepping on the session of a sale (R-BREN-U: -324.00 on Wed 11-11, +316.00 on Thu 11-12)', () => {
    const before = figuresAt(R_BREN_U, '2026-11-11').outcomes!;
    expect(valueOf(before.atStop)).toBe(q(-324n));
    expect(valueOf(before.atTarget)).toBe(q(956n));
    const after = figuresAt(R_BREN_U, '2026-11-12').outcomes!;
    expect(valueOf(after.atStop)).toBe(q(316n));
    expect(valueOf(after.atTarget)).toBe(q(956n));
  });

  it('should give each session its own status and never an earlier date across a gap (R-CORV-D: Target Reached Fri 11-06, Active Mon 11-09, Reached Wed 11-11)', () => {
    const target = (date: string) => {
      const c = figuresAt(R_CORV_D, date).conditions.find((x) => x.role === 'Target')!;
      if (c.result.kind !== 'Value') throw new Error(`expected a Value on ${date}, got ${JSON.stringify(c.result)}`);
      return { status: c.result.value.status, date: c.result.value.evidence.date };
    };
    expect(target('2026-11-06')).toEqual({ status: 'Reached', date: '2026-11-06' });
    expect(target('2026-11-09')).toEqual({ status: 'Active', date: '2026-11-09' });
    expect(target('2026-11-11')).toEqual({ status: 'Reached', date: '2026-11-11' });
  });

  it("should leave Tue 11-10's Mark-dependent figures Unavailable naming the put, and keep its two results", () => {
    const figures = figuresAt(R_CORV_D, '2026-11-10');
    const unavailable = { kind: 'Unavailable', reason: 'MarkMissing', instrument: CORV_PUT, date: '2026-11-10' };
    expect(figures.ongoingRiskToStop).toEqual(unavailable);
    expect(figures.incrementalRewardToTarget).toEqual(unavailable);
    expect(figures.worstCaseOngoingRisk).toEqual(unavailable);
    expect(valueOf(figures.outcomes!.atStop)).toBe(q(-318n));
    expect(valueOf(figures.outcomes!.atTarget)).toBe(q(867n));
  });

  it('should give the change in Risk to stop since the previous session with the figure (R-BREN-U Mon 11-16: down 150.00 since 11-13)', () => {
    const { riskChange } = sessionAt(R_BREN_U, '2026-11-16');
    expect(riskChange && { since: riskChange.since, dollars: frac(riskChange.dollars) }).toEqual({ since: '2026-11-13', dollars: q(-150n) });
  });

  it('should measure a change across a gap from the last session that had the figure (R-CORV-D Wed 11-11: since 11-09)', () => {
    const wednesday = sessionAt(R_CORV_D, '2026-11-11');
    expect(wednesday.riskChange && { since: wednesday.riskChange.since, dollars: frac(wednesday.riskChange.dollars) }).toEqual({ since: '2026-11-09', dollars: q(261n) });
    expect(wednesday.rewardChange && { since: wednesday.rewardChange.since, dollars: frac(wednesday.rewardChange.dollars) }).toEqual({ since: '2026-11-09', dollars: q(-225n) });
    expect(sessionAt(R_CORV_D, '2026-11-10').riskChange).toBeUndefined();
  });
});

const markersAt = (series: ReplayTestSeries, date: string) => sessionAt(series, date).markers;
const fillsOf = (marker: NonNullable<ReturnType<typeof markersAt>>[number]) =>
  marker.fills.map((f) => ({ instrument: f.instrument, action: f.action, quantity: frac(f.quantity), price: f.price && frac(f.price) }));

describe('replay: markers (A251)', () => {
  it("should mark R-AXIO-U's Mon 11-02 session Opened, with a Buy of 100 at 50.00", () => {
    const markers = markersAt(R_AXIO_U, '2026-11-02')!;
    expect(markers.map((m) => ({ id: m.id, kind: m.kind, effect: m.effect }))).toEqual([{ id: 'pc-axio-1', kind: 'Execution', effect: 'Opened' }]);
    expect(fillsOf(markers[0]!)).toEqual([{ instrument: AXIO, action: 'Buy', quantity: q(100n), price: q(50n) }]);
  });

  it('should mark Fri 11-06 Added with the second lot, and give a session without a Position Change no marker', () => {
    const markers = markersAt(R_AXIO_U, '2026-11-06')!;
    expect(markers.map((m) => ({ id: m.id, kind: m.kind, effect: m.effect }))).toEqual([{ id: 'pc-axio-2', kind: 'Execution', effect: 'Added' }]);
    expect(fillsOf(markers[0]!)).toEqual([{ instrument: AXIO, action: 'Buy', quantity: q(100n), price: q(5140n, 100n) }]);
    expect(markersAt(R_AXIO_U, '2026-11-03')).toEqual([]);
  });

  it("should mark R-BREN-U's Thu 11-12 Reduced, with a Sell of 2 at 4.00 and the Position Change's id", () => {
    const markers = markersAt(R_BREN_U, '2026-11-12')!;
    expect(markers.map((m) => ({ id: m.id, kind: m.kind, effect: m.effect }))).toEqual([{ id: 'pc-bren-2', kind: 'Execution', effect: 'Reduced' }]);
    expect(fillsOf(markers[0]!)).toEqual([{ instrument: BREN_CALL, action: 'Sell', quantity: q(2n), price: q(4n) }]);
  });

  it("should mark K-sale's Fri 11-13 Closed", () => {
    const markers = markersAt(K_SALE, '2026-11-13')!;
    expect(markers.map((m) => ({ id: m.id, kind: m.kind, effect: m.effect }))).toEqual([{ id: 'pc-bren-3', kind: 'Execution', effect: 'Closed' }]);
    expect(fillsOf(markers[0]!)).toEqual([{ instrument: BREN_CALL, action: 'Sell', quantity: q(2n), price: q(491n, 100n) }]);
  });

  it("should mark R-DALE-U's recorded Expiration as an Expiration naming the contract, Closed", () => {
    const markers = markersAt(R_DALE_U, '2026-11-20')!;
    expect(markers.map((m) => ({ id: m.id, kind: m.kind, effect: m.effect }))).toEqual([{ id: 'pc-dale-e', kind: 'Expiration', effect: 'Closed' }]);
    expect(markers[0]!.fills).toEqual([{ instrument: DALE_PUT, action: 'Expire', quantity: Rational.of(6n) }]);
    expect(markers[0]!.fills[0]).not.toHaveProperty('price');
  });

  it('should give a session with two Position Changes two markers, in fact order', () => {
    // R-BREN-U with a later sale of 1 at 4.10 the same Thu 11-12, handed over before the earlier sale of 2 at 4.00.
    const [buy, sale] = R_BREN_U.record.positionChanges as [PositionChangeFact, PositionChangeFact];
    const later: PositionChangeFact = {
      ...sale,
      factId: 'pc-bren-x',
      economicTime: '2026-11-12T18:00:00Z',
      recordedSequence: 5,
      executions: sale.executions.map((e) => ({ ...e, factId: 'ex-pc-bren-x', economicTime: '2026-11-12T18:00:00Z', recordedSequence: 6, quantity: '1', price: '4.10' })),
    };
    const series: ReplayTestSeries = { ...R_BREN_U, record: { ...R_BREN_U.record, positionChanges: [buy, later, sale] } };
    const markers = markersAt(series, '2026-11-12')!;
    expect(markers.map((m) => [m.id, m.effect])).toEqual([['pc-bren-2', 'Reduced'], ['pc-bren-x', 'Reduced']]);
    expect(markers.map((m) => fillsOf(m).map((f) => [f.quantity, f.price]))).toEqual([[[q(2n), q(4n)]], [[q(1n), q(410n, 100n)]]]);
  });

  it("should list only the fills up to the session's close in a Position Change that straddles it, with the effect they make", () => {
    // R-BREN-U's sale of 4 as one Position Change: 2 at 4.00 Thu 11-12 and the other 2 at 4.10 after Fri 11-13's open, before its close.
    const [buy, sale] = R_BREN_U.record.positionChanges as [PositionChangeFact, PositionChangeFact];
    const first = sale.executions[0]!;
    const straddling: PositionChangeFact = {
      ...sale,
      executions: [first, { ...first, factId: 'ex-pc-bren-2b', economicTime: '2026-11-13T15:00:00Z', recordedSequence: first.recordedSequence + 1, price: '4.10' }],
    };
    const series: ReplayTestSeries = { ...R_BREN_U, record: { ...R_BREN_U.record, positionChanges: [buy, straddling] } };
    const markers = markersAt(series, '2026-11-12')!;
    expect(markers.map((m) => [m.id, m.effect])).toEqual([['pc-bren-2', 'Reduced']]);
    expect(markers.map((m) => fillsOf(m).map((f) => [f.quantity, f.price]))).toEqual([[[q(2n), q(4n)]]]);
    expect(sessionAt(series, '2026-11-12').heldQuantity).toEqual(Rational.of(2n));
  });
});

const planOf = (series: ReplayTestSeries) => {
  const result = replay({ record: series.record, sessions: sessionsOf(series) });
  if (result.kind !== 'Replayed' || !result.plan) throw new Error(`expected a Plan on a Replayed result, got ${result.kind}`);
  return result.plan;
};

describe('replay: the Plan column (A252)', () => {
  it("should give R-BREN-U's Plan minus 324.00 at the Stop, plus 956.00 at the Target and 2.95 to 1", () => {
    const plan = planOf(R_BREN_U);
    expect(frac(plan.atStop)).toBe(q(-324n));
    expect(frac(plan.atTarget)).toBe(q(956n));
    expect(frac(plan.rewardRisk)).toBe(q(956n, 324n));
    expect(Number(plan.rewardRisk.numerator) / Number(plan.rewardRisk.denominator)).toBeCloseTo(2.95, 2);
  });

  it('should leave the Plan column unchanged after a second lot (R-AXIO-U: minus 600.00 and plus 1,200.00)', () => {
    const plan = planOf(R_AXIO_U);
    expect(frac(plan.atStop)).toBe(q(-600n));
    expect(frac(plan.atTarget)).toBe(q(1200n));
    const beforeSecondLot = replay({ record: { ...R_AXIO_U.record, positionChanges: R_AXIO_U.record.positionChanges.slice(0, 1) }, sessions: sessionsOf(R_AXIO_U) });
    expect(beforeSecondLot).toMatchObject({ plan });
  });
});
