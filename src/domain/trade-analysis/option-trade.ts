// Test support: D7's option reference Trades (breakdown, section 4). O-C is the Long Call on XYZ, O-S the
// Cash-Secured Put on MNO; every contract expires 2026-11-20. Plans are confirmed Monday 2026-10-12 09:00 New York.
import type { OptionInstrument } from '../instrument/index.ts';
import type { ExecutionFact, ExpirationFact, PositionChangeFact, TradeAnalysisRecord } from './derive.ts';
import type { ConditionInput } from './plan.ts';
import { positionChange, type ReplayTestSeries } from './reference-trade.ts';

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

// BUG-3 (decision 109): Long Call NVDA 18 Dec 2026 150, 1 contract at 15.00, one Buy to open 1 at `fill`, fee 0, and one more at each later fill.
// Stops: NVDA at or below 140.00 (value 0, $1,500), option at or below 7.50 ($750). Targets: NVDA at or above
// 200.00 (value 50.00), option at or above 50.00. 1R $750.
export const NVDA_LEG_ID = 'leg-nvda';
export const NVDA_CALL: OptionInstrument = { kind: 'Option', symbol: 'NVDA', root: 'NVDA', expiration: '2026-12-18', strike: '150', right: 'Call', multiplier: 100 };
export const nvdaRecord = (fill: string, ...laterFills: readonly string[]): TradeAnalysisRecord =>
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
    [fill, ...laterFills].map((price, i) =>
      positionChange(`pc-n${i + 1}`, i + 1, [optionExecution(NVDA_LEG_ID, NVDA_CALL, `ex-pc-n${i + 1}`, `2026-10-12T14:0${i}:00Z`, i + 2, 'Buy', '1', price, '0')]),
    ),
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

// D9's replay test Trades (breakdown, section 5): every contract expires Fri 2026-11-20, every Execution is at 10:00 New
// York (EST, 15:00Z) with fee 0.00, and each Plan is confirmed Fri 2026-10-30 09:00. Marks are observed:
// `underlying[i]` and `held[i]` (null: no Mark) belong to `REPLAY_SESSION_DATES[i]`.
const rChange = (instrument: OptionInstrument, legId: string, factId: string, date: string, seq: number, action: 'Buy' | 'Sell', quantity: string, price: string) =>
  positionChange(factId, seq, [optionExecution(legId, instrument, `ex-${factId}`, `${date}T15:00:00Z`, seq + 1, action, quantity, price, '0.00')]);
const rRecord = (
  tradeId: string,
  underlying: string,
  legId: string,
  instrument: OptionInstrument,
  side: 'Long' | 'Short',
  quantity: string,
  intendedEntry: string,
  stop: ConditionInput,
  target: ConditionInput,
  positionChanges: readonly PositionChangeFact[],
): TradeAnalysisRecord => ({
  tradeId,
  factRevision: 3,
  storedLifecycle: 'Open',
  plan: {
    economicTime: '2026-10-30T13:00:00Z',
    underlying,
    thesis: 'Replay test Trade.',
    invalidation: 'The Stop.',
    legs: [{ factId: legId, side, instrument, quantity, intendedEntry }],
    stops: [{ factId: 'stop-1', ...stop }],
    targets: [{ factId: 'target-1', ...target }],
  },
  positionChanges,
});

// R-BREN: long Call, $100 strike, 4 contracts at $1.61, Stop the call at or below $0.80, Target at or above $4.00
// (1R $324, reward $956).
export const BREN_CALL = contract('BREN', '100', 'Call');
const BREN_LEG_ID = 'leg-bren';
const brenRecord = (positionChanges: readonly PositionChangeFact[]) =>
  rRecord('trade-bren', 'BREN', BREN_LEG_ID, BREN_CALL, 'Long', '4', '1.61', { kind: 'StructureValue', price: '0.80' }, { kind: 'StructureValue', price: '4.00' }, positionChanges);
const BREN_BUY = rChange(BREN_CALL, BREN_LEG_ID, 'pc-bren-1', '2026-11-02', 1, 'Buy', '4', '1.61');
const BREN_U_UNDERLYING = ['97.20', '97.00', '97.30', '97.10', '97.20', '98.50', '100.20', '101.80', '103.60', '104.60', '104.00', '105.20', '104.80', '106.00', '106.50'];
const BREN_U_HELD = ['1.68', '1.49', '1.49', '1.30', '1.22', '1.41', '2.07', '2.91', '4.13', '4.91', '4.16', '5.25', '4.83', '6.01', '6.50'];
// Buys 4 at $1.61 Mon 11-02; 2 are sold at $4.00 Thu 11-12.
export const R_BREN_U: ReplayTestSeries = {
  id: 'R-BREN-U',
  record: brenRecord([BREN_BUY, rChange(BREN_CALL, BREN_LEG_ID, 'pc-bren-2', '2026-11-12', 3, 'Sell', '2', '4.00')]),
  underlying: BREN_U_UNDERLYING,
  held: BREN_U_HELD,
};
// K-sale: R-BREN-U with the last 2 contracts sold at $4.91 Fri 11-13, so nothing is held after.
export const K_SALE: ReplayTestSeries = {
  ...R_BREN_U,
  id: 'K-sale',
  record: brenRecord([
    BREN_BUY,
    rChange(BREN_CALL, BREN_LEG_ID, 'pc-bren-2', '2026-11-12', 3, 'Sell', '2', '4.00'),
    rChange(BREN_CALL, BREN_LEG_ID, 'pc-bren-3', '2026-11-13', 5, 'Sell', '2', '4.91'),
  ]),
};

// R-CORV-D: long Put, $80 strike, 3 contracts at $2.11, Stop the put at or below $1.05, Target at or above $5.00
// (1R $318, reward $867). A plain hold; Tue 11-10 has no put Mark.
export const CORV_PUT = contract('CORV', '80', 'Put');
export const R_CORV_D: ReplayTestSeries = {
  id: 'R-CORV-D',
  record: rRecord(
    'trade-corv', 'CORV', 'leg-corv', CORV_PUT, 'Long', '3', '2.11',
    { kind: 'StructureValue', price: '1.05' }, { kind: 'StructureValue', price: '5.00' },
    [rChange(CORV_PUT, 'leg-corv', 'pc-corv-1', '2026-11-02', 1, 'Buy', '3', '2.11')],
  ),
  underlying: ['81.20', '80.60', '79.40', '77.80', '76.50', '76.80', '76.20', '75.40', '74.60', '75.00', '74.20', '73.80', '74.40', '73.90', '73.50'],
  held: ['2.22', '2.47', '3.09', '4.20', '5.20', '4.25', null, '5.12', '5.73', '5.30', '5.84', '6.20', '5.59', '6.09', '6.50'],
};

// R-DALE: Cash-Secured Put, $57.50 strike, short 6 contracts at $0.94, Stop DALE at or below $54.00 (the put worth $3.50
// at expiration), Target the put at or below $0.20 (1R $1,536, reward $444).
export const DALE_PUT = contract('DALE', '57.5', 'Put');
const DALE_LEG_ID = 'leg-dale';
const daleRecord = (positionChanges: readonly PositionChangeFact[]) =>
  rRecord('trade-dale', 'DALE', DALE_LEG_ID, DALE_PUT, 'Short', '-6', '0.94', { kind: 'UnderlyingPrice', price: '54.00' }, { kind: 'StructureValue', price: '0.20' }, positionChanges);
const DALE_SELL = rChange(DALE_PUT, DALE_LEG_ID, 'pc-dale-1', '2026-11-02', 1, 'Sell', '6', '0.94');
// Sells 6 at $0.94 Mon 11-02; 3 are bought back at $2.59 Tue 11-10.
export const R_DALE_D: ReplayTestSeries = {
  id: 'R-DALE-D',
  record: daleRecord([DALE_SELL, rChange(DALE_PUT, DALE_LEG_ID, 'pc-dale-2', '2026-11-10', 3, 'Buy', '3', '2.59')]),
  underlying: ['59.60', '59.00', '58.40', '58.80', '57.60', '56.90', '55.80', '55.10', '54.60', '53.70', '53.20', '53.90', '52.80', '52.40', '52.00'],
  held: ['1.10', '1.30', '1.57', '1.31', '1.88', '2.14', '2.84', '3.24', '3.53', '4.21', '4.42', '3.70', '4.70', '5.09', '5.50'],
};
// A plain hold with Marks to Thu 11-19; the Expiration is recorded Fri 11-20 and has no Mark.
export const R_DALE_U: ReplayTestSeries = {
  id: 'R-DALE-U',
  record: daleRecord([DALE_SELL, expirationChange('pc-dale-e', EXPIRATION_CLOSE, 3, DALE_PUT, '6')]),
  underlying: ['60.10', '59.90', '60.20', '60.00', '59.80', '60.10', '60.30', '60.00', '60.20', '60.40', '60.90', '61.40', '61.20', '61.80'],
  held: ['0.91', '0.92', '0.77', '0.76', '0.76', '0.52', '0.41', '0.42', '0.32', '0.22', '0.05', '0.01', '0.00', '0.00'],
};

// O-C3 (D08P): the Long Call on XYZ, 18 Dec 2026 55 Call. Plan 2 contracts at 2.00, Stop the option at or below 1.00,
// Target XYZ at or above 60.00. Buy 2 @ 2.00 Monday 2026-10-12 10:00 fee 1.30; Sell 1 @ 3.00 Wednesday 10-14 11:00 fee 0.65.
export const OC3_BUY = positionChange('pc-c3-buy', 1, [optionExecution(OC_LEG_ID, OC2_CONTRACT, 'ex-c3-buy', '2026-10-12T14:00:00Z', 2, 'Buy', '2', '2.00', '1.30')]);
export const OC3_SELL = positionChange('pc-c3-sell', 3, [optionExecution(OC_LEG_ID, OC2_CONTRACT, 'ex-c3-sell', '2026-10-14T15:00:00Z', 4, 'Sell', '1', '3.00', '0.65')]);
export const oc3Record = (positionChanges: readonly PositionChangeFact[] = []): TradeAnalysisRecord =>
  record(
    {
      economicTime: '2026-10-12T13:00:00Z',
      underlying: 'XYZ',
      thesis: 'Breakout.',
      invalidation: 'The option at 1.00.',
      legs: [{ factId: OC_LEG_ID, side: 'Long', instrument: OC2_CONTRACT, quantity: '2', intendedEntry: '2.00' }],
      stops: [{ factId: 'stop-1', kind: 'StructureValue', price: '1.00' }],
      targets: [{ factId: 'target-1', kind: 'UnderlyingPrice', price: '60.00' }],
    },
    positionChanges,
  );
