import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/index.ts';
import { Rational } from '../values/index.ts';
import { derive, evaluate, type TradeAnalysisRecord } from './index.ts';
import { OC2_CONTRACT, OC3_BUY, OC3_SELL, oc3Record, OS_CONTRACT, OS_S1, osRecord } from './option-trade.ts';
import { PC1, PC2, referenceRecord, X1, X2 } from './reference-trade.ts';
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
