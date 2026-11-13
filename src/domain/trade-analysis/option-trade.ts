// Test support: D7's option reference Trades (breakdown, section 4). O-C is the Long Call on XYZ, O-S the
// Cash-Secured Put on MNO; every contract expires 2026-11-20. Plans are confirmed Monday 2026-10-12 09:00 New York.
import type { OptionInstrument } from '../instrument/index.ts';
import type { ExecutionFact, ExpirationFact, PositionChangeFact, TradeAnalysisRecord } from './derive.ts';
import { positionChange } from './reference-trade.ts';

export const OC_LEG_ID = 'leg-oc';
export const OS_LEG_ID = 'leg-os';

const contract = (symbol: string, strike: string, right: 'Call' | 'Put'): OptionInstrument => ({
  kind: 'Option',
  symbol,
  root: symbol,
  expiration: '2026-11-20',
  strike,
  right,
  multiplier: 100,
});
export const OC_CONTRACT = contract('XYZ', '55', 'Call');
export const OS_CONTRACT = contract('MNO', '45', 'Put');
export const OP_CONTRACT = contract('ABC', '50', 'Put');
export const OP_LEG_ID = 'leg-op';

export function optionExecution(
  legId: string,
  instrument: OptionInstrument,
  factId: string,
  economicTime: string,
  recordedSequence: number,
  action: 'Buy' | 'Sell',
  quantity: string,
  price: string,
  fee: string,
): ExecutionFact {
  return { factId, economicTime, recordedSequence, action, instrument, quantity, price, fee, intent: { kind: 'ServesPlannedLeg', plannedLegId: legId } };
}

// A single-Execution Position Change on O-C or O-S.
export const ocChange = (factId: string, time: string, seq: number, action: 'Buy' | 'Sell', quantity: string, price: string, fee: string): PositionChangeFact =>
  positionChange(factId, seq, [optionExecution(OC_LEG_ID, OC_CONTRACT, `ex-${factId}`, time, seq + 1, action, quantity, price, fee)]);
export const osChange = (factId: string, time: string, seq: number, action: 'Buy' | 'Sell', quantity: string, price: string, fee: string): PositionChangeFact =>
  positionChange(factId, seq, [optionExecution(OS_LEG_ID, OS_CONTRACT, `ex-${factId}`, time, seq + 1, action, quantity, price, fee)]);

// O-C: PC1 Monday 10:00 Buy 1 @ 2.10, PC2 Monday 11:00 Buy 1 @ 1.90, X1 Tuesday 10:00 Sell 1 @ 3.00, each fee 0.65.
export const OC_PC1 = ocChange('pc-1', '2026-10-12T14:00:00Z', 1, 'Buy', '1', '2.10', '0.65');
export const OC_PC2 = ocChange('pc-2', '2026-10-12T15:00:00Z', 3, 'Buy', '1', '1.90', '0.65');
export const OC_X1 = ocChange('pc-x1', '2026-10-13T14:00:00Z', 5, 'Sell', '1', '3.00', '0.65');
// O-S: S1 Monday 10:00 Sell 2 @ 1.25 fee 1.30, B1 Tuesday 10:00 Buy 1 @ 0.60 fee 0.65.
export const OS_S1 = osChange('pc-s1', '2026-10-12T14:00:00Z', 1, 'Sell', '2', '1.25', '1.30');
export const OS_B1 = osChange('pc-b1', '2026-10-13T14:00:00Z', 3, 'Buy', '1', '0.60', '0.65');

function record(plan: TradeAnalysisRecord['plan'], positionChanges: readonly PositionChangeFact[]): TradeAnalysisRecord {
  return { tradeId: 'trade-o', factRevision: 3, storedLifecycle: positionChanges.length > 0 ? 'Open' : 'Planned', plan, positionChanges };
}

// Plan: 2 contracts at 2.00, Stop XYZ at or below 48.00 (value 0), Target XYZ at or above 60.00 (value 5.00).
export const ocRecord = (positionChanges: readonly PositionChangeFact[] = []): TradeAnalysisRecord =>
  record(
    {
      economicTime: '2026-10-12T13:00:00Z',
      underlying: 'XYZ',
      thesis: 'Breakout.',
      invalidation: 'Below 48.',
      legs: [{ factId: OC_LEG_ID, side: 'Long', instrument: OC_CONTRACT, quantity: '2', intendedEntry: '2.00' }],
      stops: [{ factId: 'stop-1', kind: 'UnderlyingPrice', price: '48.00' }],
      targets: [{ factId: 'target-1', kind: 'UnderlyingPrice', price: '60.00' }],
    },
    positionChanges,
  );

// Plan: -2 contracts at 1.20 credit, Stop MNO at or below 42.00 (value 3.00), Target MNO at or above 50.00 (value 0).
export const osRecord = (positionChanges: readonly PositionChangeFact[] = []): TradeAnalysisRecord =>
  record(
    {
      economicTime: '2026-10-12T13:00:00Z',
      underlying: 'MNO',
      thesis: 'Support holds.',
      invalidation: 'Below 42.',
      legs: [{ factId: OS_LEG_ID, side: 'Short', instrument: OS_CONTRACT, quantity: '-2', intendedEntry: '1.20' }],
      stops: [{ factId: 'stop-s', kind: 'UnderlyingPrice', price: '42.00' }],
      targets: [{ factId: 'target-s', kind: 'UnderlyingPrice', price: '50.00' }],
    },
    positionChanges,
  );

// D7S's both-kinds Trades (breakdown, section 4); their contracts expire Friday 2026-12-18.
export const OC2_CONTRACT: OptionInstrument = { ...OC_CONTRACT, expiration: '2026-12-18' };
export const OS2_CONTRACT: OptionInstrument = { ...OS_CONTRACT, expiration: '2026-12-18' };

// O-C2: Plan 2 contracts at 2.00. Stops: XYZ at or below 48.00 (value 0, $400), option at or below 1.00 ($200).
// Targets: XYZ at or above 60.00 (value 5.00, $600), option at or above 4.00 ($400). 1R $200, reward $400.
export const oc2Record = (positionChanges: readonly PositionChangeFact[] = []): TradeAnalysisRecord =>
  record(
    {
      economicTime: '2026-10-12T13:00:00Z',
      underlying: 'XYZ',
      thesis: 'Breakout.',
      invalidation: 'Below 48 or the option at 1.00.',
      legs: [{ factId: OC_LEG_ID, side: 'Long', instrument: OC2_CONTRACT, quantity: '2', intendedEntry: '2.00' }],
      stops: [
        { factId: 'stop-1', kind: 'UnderlyingPrice', price: '48.00' },
        { factId: 'stop-2', kind: 'StructureValue', price: '1.00' },
      ],
      targets: [
        { factId: 'target-1', kind: 'UnderlyingPrice', price: '60.00' },
        { factId: 'target-2', kind: 'StructureValue', price: '4.00' },
      ],
    },
    positionChanges,
  );

// O-S2: Plan -2 contracts at 1.20 credit. Stops: S-u MNO at or below 41.00 ($560), S-o option at or above 3.60
// ($480). Targets: T-u MNO at or above 44.50 ($140), T-o option at or below 0.30 ($180). 1R $480, reward $140.
export const os2Record = (positionChanges: readonly PositionChangeFact[] = []): TradeAnalysisRecord =>
  record(
    {
      economicTime: '2026-10-12T13:00:00Z',
      underlying: 'MNO',
      thesis: 'Support holds.',
      invalidation: 'Below 41 or the put at 3.60.',
      legs: [{ factId: OS_LEG_ID, side: 'Short', instrument: OS2_CONTRACT, quantity: '-2', intendedEntry: '1.20' }],
      stops: [
        { factId: 'stop-s1', kind: 'UnderlyingPrice', price: '41.00' },
        { factId: 'stop-s2', kind: 'StructureValue', price: '3.60' },
      ],
      targets: [
        { factId: 'target-s1', kind: 'UnderlyingPrice', price: '44.50' },
        { factId: 'target-s2', kind: 'StructureValue', price: '0.30' },
      ],
    },
    positionChanges,
  );

// S1' (O-S2) Monday 10:00 Sell 2 @ 1.25 fee 1.30, and P1' (O-C2) Monday 10:00 Buy 2 @ 2.00 fee 1.30.
export const OS2_S1 = positionChange('pc-s1', 1, [optionExecution(OS_LEG_ID, OS2_CONTRACT, 'ex-pc-s1', '2026-10-12T14:00:00Z', 2, 'Sell', '2', '1.25', '1.30')]);
export const OC2_P1 = positionChange('pc-p1', 1, [optionExecution(OC_LEG_ID, OC2_CONTRACT, 'ex-pc-p1', '2026-10-12T14:00:00Z', 2, 'Buy', '2', '2.00', '1.30')]);

// BUG-3 (decision 109): Long Call NVDA 18 Dec 2026 150, 1 contract at 15.00, one Buy to open 1 at `fill`, fee 0.
// Stops: NVDA at or below 140.00 (value 0, $1,500), option at or below 7.50 ($750). Targets: NVDA at or above
// 200.00 (value 50.00), option at or above 50.00. 1R $750.
export const NVDA_LEG_ID = 'leg-nvda';
export const NVDA_CALL: OptionInstrument = { kind: 'Option', symbol: 'NVDA', root: 'NVDA', expiration: '2026-12-18', strike: '150', right: 'Call', multiplier: 100 };
export const nvdaRecord = (fill: string): TradeAnalysisRecord =>
  record(
    {
      economicTime: '2026-10-12T13:00:00Z',
      underlying: 'NVDA',
      thesis: 'Breakout.',
      invalidation: 'Below 140 or the option at 7.50.',
      legs: [{ factId: NVDA_LEG_ID, side: 'Long', instrument: NVDA_CALL, quantity: '1', intendedEntry: '15.00' }],
      stops: [
        { factId: 'stop-1', kind: 'UnderlyingPrice', price: '140.00' },
        { factId: 'stop-2', kind: 'StructureValue', price: '7.50' },
      ],
      targets: [
        { factId: 'target-1', kind: 'UnderlyingPrice', price: '200.00' },
        { factId: 'target-2', kind: 'StructureValue', price: '50.00' },
      ],
    },
    [positionChange('pc-n1', 1, [optionExecution(NVDA_LEG_ID, NVDA_CALL, 'ex-pc-n1', '2026-10-12T14:00:00Z', 2, 'Buy', '1', fill, '0')])],
  );

// O-P: the Long Put on ABC, 1 contract at 1.50, Stop ABC at or above 55.00, Target ABC at or below 45.00.
export const opRecord = (positionChanges: readonly PositionChangeFact[] = []): TradeAnalysisRecord =>
  record(
    {
      economicTime: '2026-10-12T13:00:00Z',
      underlying: 'ABC',
      thesis: 'Breakdown.',
      invalidation: 'Above 55.',
      legs: [{ factId: OP_LEG_ID, side: 'Long', instrument: OP_CONTRACT, quantity: '1', intendedEntry: '1.50' }],
      stops: [{ factId: 'stop-p', kind: 'UnderlyingPrice', price: '55.00' }],
      targets: [{ factId: 'target-p', kind: 'UnderlyingPrice', price: '45.00' }],
    },
    positionChanges,
  );
export const opChange = (factId: string, time: string, seq: number, action: 'Buy' | 'Sell', quantity: string, price: string, fee: string): PositionChangeFact =>
  positionChange(factId, seq, [optionExecution(OP_LEG_ID, OP_CONTRACT, `ex-${factId}`, time, seq + 1, action, quantity, price, fee)]);

// An Expiration is a Position Change with no Execution and no agency (A106): one settlement fact naming the
// contract, the quantity and the settlement time, which is also the Position Change's Economic Time.
export const expirationChange = (factId: string, time: string, seq: number, instrument: ExpirationFact['instrument'], quantity: string): PositionChangeFact => ({
  factId,
  economicTime: time,
  recordedSequence: seq,
  executions: [],
  settlements: [{ factId: `exp-${factId}`, economicTime: time, recordedSequence: seq + 1, instrument, quantity }],
});
// Friday 2026-11-20 16:00 New York, the close of the expiration session.
export const EXPIRATION_CLOSE = '2026-11-20T21:00:00Z';
// E1 expires O-C's one remaining contract (after PC1 and X1's sale), E-S expires both of O-S's contracts.
export const OC_E1 = expirationChange('pc-e1', EXPIRATION_CLOSE, 7, OC_CONTRACT, '1');
export const OS_ES = expirationChange('pc-es', EXPIRATION_CLOSE, 5, OS_CONTRACT, '2');
