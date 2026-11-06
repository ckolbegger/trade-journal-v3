import { describe, expect, it } from 'vitest';
import type { OptionInstrument } from '../instrument/index.ts';
import { Rational } from '../values/index.ts';
import { assessPlan, expirationPayoff, type ExpirationPayoffInput, type ExpirationPayoffView } from './index.ts';
import type { CalculationResult, PlanInput } from './index.ts';

const r = (n: bigint | number, d: bigint | number = 1) => Rational.of(BigInt(n), BigInt(d));
// A decimal text as an exact Rational: 57.0065 is 570065/10000.
const dec = (text: string) => {
  const [whole = '0', fraction = ''] = text.replace('-', '').split('.');
  const value = Rational.of(BigInt(whole + fraction), 10n ** BigInt(fraction.length));
  return text.startsWith('-') ? Rational.of(0n).sub(value) : value;
};

function contract(symbol: string, strike: string, right: 'Call' | 'Put') {
  return { kind: 'Option', symbol, root: symbol, expiration: '2026-11-20', strike, right, multiplier: 100 } as const;
}

const OC_CONTRACT = contract('XYZ', '55', 'Call');
const OP_CONTRACT = contract('ABC', '50', 'Put');
const OS_CONTRACT = contract('MNO', '45', 'Put');

// O-C: Long Call XYZ 20 Nov 2026 55, 2 contracts at 2.00.
const OC: PlanInput = {
  underlying: 'XYZ',
  legs: [{ side: 'Long', instrument: OC_CONTRACT, quantity: '2', intendedEntry: '2.00' }],
  stops: [{ kind: 'UnderlyingPrice', price: '48.00' }],
  targets: [{ kind: 'UnderlyingPrice', price: '60.00' }],
  exerciseIntent: 'NotAuthorized',
};
// O-P: Long Put ABC 20 Nov 2026 50, 1 contract at 1.50.
const OP: PlanInput = {
  underlying: 'ABC',
  legs: [{ side: 'Long', instrument: OP_CONTRACT, quantity: '1', intendedEntry: '1.50' }],
  stops: [{ kind: 'UnderlyingPrice', price: '55.00' }],
  targets: [{ kind: 'UnderlyingPrice', price: '45.00' }],
  exerciseIntent: 'Authorized',
};
// O-S: Cash-Secured Put MNO 20 Nov 2026 45, short 2 contracts at 1.20.
const OS: PlanInput = {
  underlying: 'MNO',
  legs: [{ side: 'Short', instrument: OS_CONTRACT, quantity: '-2', intendedEntry: '1.20' }],
  stops: [{ kind: 'UnderlyingPrice', price: '42.00' }],
  targets: [{ kind: 'UnderlyingPrice', price: '50.00' }],
};

function view(result: CalculationResult<ExpirationPayoffView>): ExpirationPayoffView {
  if (result.kind !== 'Value') throw new Error(`expected a Value, got ${result.kind}`);
  return result.value;
}

describe('Planned view', () => {
  it('should return O-C Planned curve as two normalized segments, zero set Crossing 57, Payoff Maximum Unbounded Above, and Payoff Minimum -400 attained on 0 to 55', () => {
    const input: ExpirationPayoffInput = { plan: OC };
    // No theoretical price: the input type accepts Plan facts and exposure, never a Mark or a date.
    expect(Object.keys(input)).toEqual(['plan']);
    const planned = view(expirationPayoff(input).planned);
    expect(planned.segments).toEqual([
      { from: r(0), to: r(55), valueAtStart: r(-400), slope: r(0) },
      { from: r(55), to: null, valueAtStart: r(-400), slope: r(200) },
    ]);
    expect(planned.zeroSet).toEqual([{ kind: 'Crossing', price: r(57) }]);
    expect(planned.maximum.kind).toBe('Unbounded');
    expect(planned.maximum).toMatchObject({ kind: 'Unbounded', direction: 'Above' });
    expect(planned.minimum).toEqual({
      kind: 'Value',
      value: { value: r(-400), attainedOn: [{ kind: 'Interval', from: r(0), to: r(55) }] },
    });
    expect(planned.realizedOffset).toEqual(r(0));
    expect(planned.unconsumedFees).toEqual(r(0));
  });

  it('should return O-P curve with Maximum 4850 at 0, Minimum -150 on the ray from 50, Crossing 48.5, and O-S with Maximum 240 on the ray from 45, Minimum -8760 at 0, Crossing 43.8', () => {
    const put = view(expirationPayoff({ plan: OP }).planned);
    expect(put.maximum).toEqual({ kind: 'Value', value: { value: r(4850), attainedOn: [{ kind: 'Point', at: r(0) }] } });
    expect(put.minimum).toEqual({ kind: 'Value', value: { value: r(-150), attainedOn: [{ kind: 'Ray', from: r(50) }] } });
    expect(put.zeroSet).toEqual([{ kind: 'Crossing', price: dec('48.5') }]);

    const short = view(expirationPayoff({ plan: OS }).planned);
    expect(short.maximum).toEqual({ kind: 'Value', value: { value: r(240), attainedOn: [{ kind: 'Ray', from: r(45) }] } });
    expect(short.minimum).toEqual({ kind: 'Value', value: { value: r(-8760), attainedOn: [{ kind: 'Point', at: r(0) }] } });
    expect(short.zeroSet).toEqual([{ kind: 'Crossing', price: dec('43.8') }]);
  });

  it('should report a Touch at 0, Maximum 0 at 0, and no Crossing for the Plan facts of a Long Put DEF 5 Put at 5.00', () => {
    const plan: PlanInput = {
      underlying: 'DEF',
      legs: [{ side: 'Long', instrument: contract('DEF', '5', 'Put'), quantity: '1', intendedEntry: '5.00' }],
      stops: [{ kind: 'UnderlyingPrice', price: '6.00' }],
      targets: [{ kind: 'UnderlyingPrice', price: '4.00' }],
      exerciseIntent: 'Authorized',
    };
    const planned = view(expirationPayoff({ plan }).planned);
    expect(planned.zeroSet).toEqual([{ kind: 'Touch', price: r(0) }]);
    expect(planned.maximum).toEqual({ kind: 'Value', value: { value: r(0), attainedOn: [{ kind: 'Point', at: r(0) }] } });
  });
});

const lot = (instrument: OptionInstrument, quantity: number, basis: string, fee: string) => ({
  instrument,
  quantity: r(quantity),
  basis: dec(basis),
  unconsumedOpeningFee: dec(fee),
});

describe('Planned payoff at confirmation', () => {
  it('should return from assessPlan, with an accepted option Plan, the same Planned view as expirationPayoff for those Plan facts', () => {
    const assessment = assessPlan({
      economicTime: '2026-10-12T13:00:00Z',
      strategyShape: { roles: [{ side: 'Long', instrument: 'Call', ratio: 1 }] },
      plan: OC,
    });
    if (assessment.kind !== 'Accepted') throw new Error('O-C is accepted');
    expect(assessment.plannedPayoff).toEqual(expirationPayoff({ plan: OC }).planned);
    expect(view(assessment.plannedPayoff).zeroSet).toEqual([{ kind: 'Crossing', price: r(57) }]);
  });
});

describe('Current view', () => {
  it('should return O-C after PC2 with offset 0 and fees 1.30 as Crossing 57.0065 and Minimum -401.30 on 0 to 55, and after X1 with offset 88.70 as Crossing 56.0195 and Minimum -101.95, while the Planned view stays the same', () => {
    const planned = view(expirationPayoff({ plan: OC }).planned);
    const afterPc2 = expirationPayoff({
      plan: OC,
      exposure: { lots: [lot(OC_CONTRACT, 1, '2.10', '0.65'), lot(OC_CONTRACT, 1, '1.90', '0.65')], realizedToDate: r(0) },
    });
    const first = view(afterPc2.current);
    expect(first.realizedOffset).toEqual(r(0));
    expect(first.unconsumedFees).toEqual(dec('1.30'));
    expect(first.zeroSet).toEqual([{ kind: 'Crossing', price: dec('57.0065') }]);
    expect(first.minimum).toEqual({ kind: 'Value', value: { value: dec('-401.30'), attainedOn: [{ kind: 'Interval', from: r(0), to: r(55) }] } });
    expect(view(afterPc2.planned)).toEqual(planned);

    const afterX1 = expirationPayoff({
      plan: OC,
      exposure: { lots: [lot(OC_CONTRACT, 1, '1.90', '0.65')], realizedToDate: dec('88.70') },
    });
    const second = view(afterX1.current);
    expect(second.realizedOffset).toEqual(dec('88.70'));
    expect(second.zeroSet).toEqual([{ kind: 'Crossing', price: dec('56.0195') }]);
    expect(second.minimum).toEqual({ kind: 'Value', value: { value: dec('-101.95'), attainedOn: [{ kind: 'Interval', from: r(0), to: r(55) }] } });
    expect(view(afterX1.planned)).toEqual(planned);
  });

  it('should give short Lots a falling segment so O-S after S1 has Maximum 248.70 on the ray from 45, Minimum -8751.30 at 0, and Crossing 43.7565', () => {
    const current = view(
      expirationPayoff({ plan: OS, exposure: { lots: [lot(OS_CONTRACT, -2, '1.25', '1.30')], realizedToDate: r(0) } }).current,
    );
    expect(current.segments[0]).toMatchObject({ from: r(0), to: r(45), valueAtStart: dec('-8751.30'), slope: r(200) });
    expect(current.maximum).toEqual({ kind: 'Value', value: { value: dec('248.70'), attainedOn: [{ kind: 'Ray', from: r(45) }] } });
    expect(current.minimum).toEqual({ kind: 'Value', value: { value: dec('-8751.30'), attainedOn: [{ kind: 'Point', at: r(0) }] } });
    expect(current.zeroSet).toEqual([{ kind: 'Crossing', price: dec('43.7565') }]);
  });

  it('should return Zero Range 0 to 55 and no Crossing when X1 prime makes the flat segment exactly zero', () => {
    const current = view(
      expirationPayoff({ plan: OC, exposure: { lots: [lot(OC_CONTRACT, 1, '1.90', '0.65')], realizedToDate: dec('190.65') } }).current,
    );
    expect(current.zeroSet).toEqual([{ kind: 'ZeroRange', from: r(0), to: r(55) }]);
    expect(current.minimum).toEqual({ kind: 'Value', value: { value: r(0), attainedOn: [{ kind: 'Interval', from: r(0), to: r(55) }] } });
  });

  it('should return Current NotApplicable NoRemainingPosition when flat, and both views NotApplicable NoOptionExpirationAnchor for T-A', () => {
    const flat = expirationPayoff({ plan: OC, exposure: { lots: [], realizedToDate: dec('-101.95') } });
    expect(flat.current).toEqual({ kind: 'NotApplicable', reason: 'NoRemainingPosition' });
    expect(flat.planned.kind).toBe('Value');

    // T-A: D6's Long Stock reference Trade, 100 shares of XYZ at 50.00.
    const stock: PlanInput = {
      underlying: 'XYZ',
      legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50.00' }],
      stops: [{ kind: 'UnderlyingPrice', price: '47.50' }],
      targets: [{ kind: 'UnderlyingPrice', price: '56.00' }],
    };
    const anchorless = { kind: 'NotApplicable', reason: 'NoOptionExpirationAnchor' };
    expect(expirationPayoff({ plan: stock })).toEqual({ planned: anchorless, current: anchorless });
    expect(expirationPayoff({ plan: stock, exposure: { lots: [], realizedToDate: r(0) } })).toEqual({ planned: anchorless, current: anchorless });
  });
});
