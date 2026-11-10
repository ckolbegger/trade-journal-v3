import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/index.ts';
import { Rational } from '../values/index.ts';
import { derive, type DerivedTradeState } from './index.ts';
import { evaluate, type ObservationFrame } from './evaluate.ts';
import { OS_CONTRACT, OS_S1, osRecord } from './option-trade.ts';

const MNO = { kind: 'Stock', symbol: 'MNO' } as const;
const FRIDAY_CLOSE = '2026-11-20T21:00:00Z';
const NEXT_MONDAY_CLOSE = '2026-11-23T21:00:00Z';

function derivedAt(valuationDate: string): DerivedTradeState {
  const result = derive({ record: osRecord([OS_S1]), valuationDate });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

const missingFrame = (instrument: Instrument, tradingDate: string, closeInstant: string): ObservationFrame => ({ instrument, tradingDate, closeInstant, resolution: { kind: 'Missing' } });
const markFrame = (instrument: Instrument, price: string, tradingDate: string, closeInstant: string): ObservationFrame => ({
  instrument,
  tradingDate,
  closeInstant,
  resolution: { kind: 'Available', mark: { revisionId: 'mark-rev-1', revisionNumber: 1, price } },
});
const frac = (r: Rational) => `${r.numerator}/${r.denominator}`;

describe('evaluate reads the contract status (P81)', () => {
  it('should throw when the frame trading date differs from the state valuation date', () => {
    const state = derivedAt('2026-11-20');
    expect(() =>
      evaluate({ state, frame: missingFrame(OS_CONTRACT, '2026-11-23', NEXT_MONDAY_CLOSE), underlyingFrame: missingFrame(MNO, '2026-11-23', NEXT_MONDAY_CLOSE) }),
    ).toThrow();
  });

  it('should return the Mark-dependent figures Unavailable(SettlementDue) for a PastExpiration contract and a settlement item Due', () => {
    const state = derivedAt('2026-11-23');
    const e = evaluate({ state, frame: missingFrame(OS_CONTRACT, '2026-11-23', NEXT_MONDAY_CLOSE) });
    const due = { kind: 'Unavailable', reason: 'SettlementDue', instrument: OS_CONTRACT, expiration: '2026-11-20' };
    expect(e.settlement.map((s) => s.status)).toEqual(['Due']);
    expect(e.marketValue).toEqual(due);
    expect(e.currentMarkedPnl).toEqual(due);
    expect(e.ongoingRiskToStop).toEqual(due);
    expect(e.conditions.map((c) => c.result)).toEqual([due, due]);
  });

  it('should return a settlement item Due for a DueToday contract with its Mark-dependent figures valued from its Mark', () => {
    const state = derivedAt('2026-11-20');
    const e = evaluate({
      state,
      frame: markFrame(OS_CONTRACT, '0.50', '2026-11-20', FRIDAY_CLOSE),
      underlyingFrame: markFrame(MNO, '47.00', '2026-11-20', FRIDAY_CLOSE),
    });
    expect(e.settlement.map((s) => s.status)).toEqual(['Due']);
    expect(e.marketValue.kind === 'Value' && frac(e.marketValue.value)).toBe(frac(Rational.of(-100n)));
    expect(e.ongoingRiskToStop.kind === 'Value' && frac(e.ongoingRiskToStop.value)).toBe(frac(Rational.of(500n)));
  });
});
