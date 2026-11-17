import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/index.ts';
import { Rational } from '../values/index.ts';
import { derive, type DerivedTradeState, type TradeAnalysisRecord } from './index.ts';
import { evaluate, type ConditionStatus, type ObservationFrame } from './evaluate.ts';
import { OC2_CONTRACT, OC2_P1, oc2Record } from './option-trade.ts';
import { PC1, referenceRecord } from './reference-trade.ts';

const XYZ = { kind: 'Stock', symbol: 'XYZ' } as const;
const DATE = '2026-10-12';

function derivedState(record: TradeAnalysisRecord): DerivedTradeState {
  const result = derive({ record, valuationDate: DATE });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

const frameOf = (instrument: Instrument, price: string): ObservationFrame => ({
  instrument,
  tradingDate: DATE,
  closeInstant: '2026-10-12T20:00:00Z',
  resolution: { kind: 'Available', mark: { revisionId: 'mark', revisionNumber: 1, price } },
});

const frac = (r: Rational) => `${r.numerator}/${r.denominator}`;
const triggerOf = (condition: ConditionStatus) => {
  if (condition.result.kind !== 'Value') throw new Error('expected a Value');
  const t = condition.result.value.trigger;
  return t && { distance: frac(t.distance), beyond: t.beyond ? frac(t.beyond) : null };
};

const callOn = (call: string, xyz: string) =>
  evaluate({ state: derivedState(oc2Record([OC2_P1])), frame: frameOf(OC2_CONTRACT, call), underlyingFrame: frameOf(XYZ, xyz) });

describe('evaluate: trigger distance (A230)', () => {
  it('should give a stock Stop distance in the stock price, 2.82 from a 50.32 Mark to a 47.50 Stop', () => {
    const e = evaluate({ state: derivedState(referenceRecord([PC1])), frame: frameOf(XYZ, '50.32') });
    expect(triggerOf(e.conditions[0]!)).toEqual({ distance: '141/50', beyond: null });
  });

  it('should give an option-price Stop distance in the option price, 2.20 from 3.20 to 1.00', () => {
    const e = callOn('3.20', '52.00');
    expect(triggerOf(e.conditions[1]!)).toEqual({ distance: '11/5', beyond: null });
  });

  it("should give an option Underlying condition its Underlying distance, 2.10 from 57.90 to 60.00", () => {
    const e = callOn('3.20', '57.90');
    expect(triggerOf(e.conditions[2]!)).toEqual({ distance: '21/10', beyond: null });
  });

  it('should give zero distance and the distance beyond once a condition is crossed', () => {
    const stock = evaluate({ state: derivedState(referenceRecord([PC1])), frame: frameOf(XYZ, '47.00') });
    expect(triggerOf(stock.conditions[0]!)).toEqual({ distance: '0/1', beyond: '1/2' });
    const option = callOn('0.95', '52.00');
    expect(triggerOf(option.conditions[1]!)).toEqual({ distance: '0/1', beyond: '1/20' });
    expect(triggerOf(callOn('3.20', '49.00').conditions[0]!)).toEqual({ distance: '1/1', beyond: null });
    expect(triggerOf(callOn('3.20', '47.50').conditions[0]!)).toEqual({ distance: '0/1', beyond: '1/2' });
  });
});
