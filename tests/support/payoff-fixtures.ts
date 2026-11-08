// Fixed payoff read models for the payoff view tests (breakdown, section 4; the T7.3 fixtures), built by the
// engine itself because the UI tests may not import the domain.
import type { ExpirationPayoffs, ExpirationPayoffView, PlanInput } from '../../src/domain/trade-analysis/index.ts';
import { expirationPayoff } from '../../src/domain/trade-analysis/index.ts';
import { expirationValueAt } from '../../src/domain/trade-analysis/payoff.ts';
import type { OptionInstrument } from '../../src/domain/instrument/index.ts';
import { Rational } from '../../src/domain/values/index.ts';

const r = (n: bigint | number, d: bigint | number = 1) => Rational.of(BigInt(n), BigInt(d));
// A decimal text as an exact Rational: 57.0065 is 570065/10000.
const dec = (text: string) => {
  const [whole = '0', fraction = ''] = text.replace('-', '').split('.');
  const value = Rational.of(BigInt(whole + fraction), 10n ** BigInt(fraction.length));
  return text.startsWith('-') ? Rational.of(0n).sub(value) : value;
};

const contract = (symbol: string, strike: string, right: 'Call' | 'Put') =>
  ({ kind: 'Option', symbol, root: symbol, expiration: '2026-11-20', strike, right, multiplier: 100 }) as const satisfies OptionInstrument;
const lot = (instrument: OptionInstrument, quantity: number, basis: string, fee: string) => ({
  instrument,
  quantity: r(quantity),
  basis: dec(basis),
  unconsumedOpeningFee: dec(fee),
});

const OC_CONTRACT = contract('XYZ', '55', 'Call');
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
  legs: [{ side: 'Long', instrument: contract('ABC', '50', 'Put'), quantity: '1', intendedEntry: '1.50' }],
  stops: [{ kind: 'UnderlyingPrice', price: '55.00' }],
  targets: [{ kind: 'UnderlyingPrice', price: '45.00' }],
  exerciseIntent: 'Authorized',
};
// DEF: Long Put DEF 5 Put at 5.00, whose Planned zero set is a Touch at 0.
const DEF: PlanInput = {
  underlying: 'DEF',
  legs: [{ side: 'Long', instrument: contract('DEF', '5', 'Put'), quantity: '1', intendedEntry: '5.00' }],
  stops: [{ kind: 'UnderlyingPrice', price: '6.00' }],
  targets: [{ kind: 'UnderlyingPrice', price: '4.00' }],
  exerciseIntent: 'Authorized',
};
// O-S: Short MNO 20 Nov 2026 45 Put, 2 contracts at 1.20 planned and 1.25 filled, fee 1.30 (the Settlement Review's T-3).
const MNO_PUT = contract('MNO', '45', 'Put');
const OS: PlanInput = {
  underlying: 'MNO',
  legs: [{ side: 'Short', instrument: MNO_PUT, quantity: '-2', intendedEntry: '1.20' }],
  stops: [{ kind: 'UnderlyingPrice', price: '42.00' }],
  targets: [{ kind: 'UnderlyingPrice', price: '50.00' }],
};
// T-A: Long Stock, which has no option expiration.
const STOCK: PlanInput = {
  underlying: 'XYZ',
  legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50.00' }],
  stops: [{ kind: 'UnderlyingPrice', price: '45.00' }],
  targets: [{ kind: 'UnderlyingPrice', price: '60.00' }],
};

export const payoffFixtures = {
  // O-C's Planned view and its Current view after PC2 (offset 0, fees 1.30).
  ocPayoffs: (): ExpirationPayoffs =>
    expirationPayoff({ plan: OC, exposure: { lots: [lot(OC_CONTRACT, 1, '2.10', '0.65'), lot(OC_CONTRACT, 1, '1.90', '0.65')], realizedToDate: r(0) } }),
  // O-C after X1: one Lot left and 88.70 realized.
  ocAfterExit: (): ExpirationPayoffs =>
    expirationPayoff({ plan: OC, exposure: { lots: [lot(OC_CONTRACT, 1, '1.90', '0.65')], realizedToDate: dec('88.70') } }),
  // X1 prime: the realized offset makes the flat segment exactly zero.
  zeroRange: (): ExpirationPayoffs =>
    expirationPayoff({ plan: OC, exposure: { lots: [lot(OC_CONTRACT, 1, '1.90', '0.65')], realizedToDate: dec('190.65') } }),
  // A realized gain larger than the remaining loss: the curve never reaches zero.
  noBreakeven: (): ExpirationPayoffs =>
    expirationPayoff({ plan: OC, exposure: { lots: [lot(OC_CONTRACT, 1, '1.90', '0.65')], realizedToDate: dec('500.00') } }),
  // O-S after S1: breakeven 43.7565, best case $248.70, worst case $8,751.30 down.
  osPayoffs: (): ExpirationPayoffs => expirationPayoff({ plan: OS, exposure: { lots: [lot(MNO_PUT, -2, '1.25', '1.30')], realizedToDate: r(0) } }),
  ocFlat:(): ExpirationPayoffs => expirationPayoff({ plan: OC, exposure: { lots: [], realizedToDate: dec('-101.95') } }),
  longPut: (): ExpirationPayoffs => expirationPayoff({ plan: OP }),
  touch: (): ExpirationPayoffs => expirationPayoff({ plan: DEF }),
  stock: (): ExpirationPayoffs => expirationPayoff({ plan: STOCK }),
  // The view's value at an Underlying price, as the A122 result carries it.
  valueAt: (view: ExpirationPayoffView, price: string) => ({ underlyingPrice: dec(price), value: expirationValueAt(view, dec(price)) }),
};

// A Value result's view, for a fixture the test knows is a Value.
export function viewOf(result: ExpirationPayoffs['planned'] | ExpirationPayoffs['current']): ExpirationPayoffView {
  if (result.kind !== 'Value') throw new Error(`expected a Value, got ${result.kind}`);
  return result.value;
}
