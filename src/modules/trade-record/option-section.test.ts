import { describe, expect, it } from 'vitest';
import type { OptionInstrument } from '../../domain/instrument/index.ts';
import type { StrategyShape } from '../../domain/strategy/index.ts';
import type { PlannedLegInput } from '../../domain/trade-analysis/index.ts';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { validateSection, type CloseReasonFact, type ExecutionFactValue, type ExpirationFactValue, type TradeDocument, type TradeFact } from './index.ts';

const PLAN_TIME = '2026-10-12T13:00:00Z';
const BUY_TIME = '2026-10-12T14:00:00Z';
const EXPIRATION_TIME = '2026-11-20T21:00:00Z';

const XYZ_CALL: OptionInstrument = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', strike: '55', right: 'Call', multiplier: 100 };
const XYZ_PUT: OptionInstrument = { ...XYZ_CALL, strike: '45', right: 'Put' };
const MNO_PUT: OptionInstrument = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-11-20', strike: '45', right: 'Put', multiplier: 100 };

const LONG_CALL: StrategyShape = { roles: [{ side: 'Long', instrument: 'Call', ratio: 1 }] };
const CASH_SECURED_PUT: StrategyShape = { roles: [{ side: 'Short', instrument: 'Put', ratio: 1 }] };
const LONG_STOCK: StrategyShape = { roles: [{ side: 'Long', instrument: 'Stock', ratio: 1 }] };

const references = {
  accountIds: new Set(['acct-1']),
  anchorTradeIds: new Set<string>(),
  closeReasonIds: new Set(['cr-1']),
  strategyShapes: new Map([
    ['strategy-long-call', LONG_CALL],
    ['strategy-cash-secured-put', CASH_SECURED_PUT],
    ['strategy-long-stock', LONG_STOCK],
  ]),
};

const longCallLeg = (instrument: OptionInstrument = XYZ_CALL): PlannedLegInput => ({ side: 'Long', instrument, quantity: '2', intendedEntry: '2.00' });
const cashSecuredPutLeg: PlannedLegInput = { side: 'Short', instrument: MNO_PUT, quantity: '-2', intendedEntry: '1.20' };

interface Options {
  readonly strategyId: string;
  readonly leg: PlannedLegInput;
  readonly exerciseIntent?: 'Authorized' | 'NotAuthorized';
  readonly changes?: readonly { readonly execution?: ExecutionFactValue; readonly expiration?: ExpirationFactValue }[];
  readonly closeReason?: boolean;
  readonly strategyKnown?: boolean;
}

// A stored option Trade: its Plan, then one Position Change per entry of `changes`, each holding an
// Execution or an Expiration. Lifecycle is stored as the facts leave it.
function optionTrade(tradeId: string, { strategyId, leg, exerciseIntent, changes = [], closeReason }: Options): TradeDocument {
  const underlying = leg.instrument.symbol;
  const plan: TradeFact[] = [
    { factId: `${tradeId}:plan`, kind: 'Plan', recordedSequence: 1, versions: [{ versionNumber: 1, value: { economicTime: PLAN_TIME, underlying, thesis: 'Move.', invalidation: 'Wrong.', ...(exerciseIntent && { exerciseIntent }) } }] },
    { factId: `${tradeId}:leg`, kind: 'PlannedLeg', recordedSequence: 2, versions: [{ versionNumber: 1, value: leg }] },
    { factId: `${tradeId}:stop`, kind: 'Stop', recordedSequence: 3, versions: [{ versionNumber: 1, value: { kind: 'UnderlyingPrice', price: '48' } }] },
    { factId: `${tradeId}:target`, kind: 'Target', recordedSequence: 4, versions: [{ versionNumber: 1, value: { kind: 'UnderlyingPrice', price: '60' } }] },
  ];
  let sequence = 4;
  const facts = changes.flatMap((change, i): TradeFact[] => {
    const memberId = `${tradeId}:member-${i + 1}`;
    const value = change.execution ?? change.expiration!;
    const economicTime = value.economicTime;
    const position: TradeFact = {
      factId: `${tradeId}:pc-${i + 1}`,
      kind: 'PositionChange',
      recordedSequence: ++sequence,
      versions: [{ versionNumber: 1, value: { economicTime, originTradeId: tradeId, participatingTradeIds: [tradeId], memberIds: [memberId] } }],
    };
    const member: TradeFact = change.execution
      ? { factId: memberId, kind: 'Execution', recordedSequence: ++sequence, versions: [{ versionNumber: 1, value: change.execution }] }
      : { factId: memberId, kind: 'Expiration', recordedSequence: ++sequence, versions: [{ versionNumber: 1, value: change.expiration! }] };
    return [position, member];
  });
  const closed = changes.some((c) => c.expiration);
  const reason: CloseReasonFact = {
    factId: `${tradeId}:cr`,
    kind: 'CloseReason',
    recordedSequence: sequence + 1,
    versions: [{ versionNumber: 1, value: { closeReasonId: 'cr-1', terminalPositionChangeId: `${tradeId}:pc-${changes.length}` } }],
  };
  return {
    tradeId,
    accountId: 'acct-1',
    strategyId,
    lifecycle: closed ? 'Closed' : changes.length > 0 ? 'Open' : 'Planned',
    planTime: PLAN_TIME,
    underlying,
    factRevision: 1 + changes.length,
    facts: [...plan, ...facts],
    ...(changes.length > 0 && { recordedSequenceCounter: sequence, lastActivity: EXPIRATION_TIME, deviations: [] }),
    ...(closeReason && { closeReasonFacts: [reason] }),
  };
}

const buy = (instrument: OptionInstrument, tradeId: string, quantity = '2'): ExecutionFactValue => ({
  economicTime: BUY_TIME,
  action: 'Buy',
  instrument,
  quantity,
  price: '2.00',
  fee: '1.30',
  intent: { kind: 'ServesPlannedLeg', plannedLegId: `${tradeId}:leg` },
});
const sellToOpen = (tradeId: string): ExecutionFactValue => ({ ...buy(MNO_PUT, tradeId), action: 'Sell', price: '1.25' });
const expire = (instrument: OptionInstrument, extra: object = {}): ExpirationFactValue => ({ economicTime: EXPIRATION_TIME, instrument, quantity: '2', ...extra });

describe('Trade Record section, options', () => {
  it('should accept option Trades with Executions and an Expiration, and report Exercise Intent on a Cash-Secured Put, a Close Reason on a Position Change whose terminal member is an Expiration, an Expiration with a price, and an option Execution of a fractional quantity', async () => {
    const trades = [
      // Accepted: a Long Call bought and expired, and a Cash-Secured Put sold and expired, neither with a Close Reason.
      optionTrade('ok-call', { strategyId: 'strategy-long-call', leg: longCallLeg(), exerciseIntent: 'NotAuthorized', changes: [{ execution: buy(XYZ_CALL, 'ok-call') }, { expiration: expire(XYZ_CALL) }] }),
      optionTrade('ok-csp', { strategyId: 'strategy-cash-secured-put', leg: cashSecuredPutLeg, changes: [{ execution: sellToOpen('ok-csp') }, { expiration: expire(MNO_PUT) }] }),
      optionTrade('csp-intent', { strategyId: 'strategy-cash-secured-put', leg: cashSecuredPutLeg, exerciseIntent: 'Authorized' }),
      optionTrade('expired-with-reason', {
        strategyId: 'strategy-long-call',
        leg: longCallLeg(),
        exerciseIntent: 'Authorized',
        changes: [{ execution: buy(XYZ_CALL, 'expired-with-reason') }, { expiration: expire(XYZ_CALL) }],
        closeReason: true,
      }),
      optionTrade('priced', {
        strategyId: 'strategy-long-call',
        leg: longCallLeg(),
        exerciseIntent: 'Authorized',
        changes: [{ execution: buy(XYZ_CALL, 'priced') }, { expiration: expire(XYZ_CALL, { price: '0.10' }) }],
      }),
      optionTrade('fractional', { strategyId: 'strategy-long-call', leg: longCallLeg(), exerciseIntent: 'Authorized', changes: [{ execution: buy(XYZ_CALL, 'fractional', '1.5') }] }),
      // The stored-Plan checks: Exercise Intent missing, Exercise Intent on Long Stock, legs that don't fill the roles.
      optionTrade('call-no-intent', { strategyId: 'strategy-long-call', leg: longCallLeg() }),
      optionTrade('stock-intent', {
        strategyId: 'strategy-long-stock',
        leg: { side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50' },
        exerciseIntent: 'NotAuthorized',
      }),
      optionTrade('wrong-roles', { strategyId: 'strategy-long-call', leg: longCallLeg(XYZ_PUT), exerciseIntent: 'Authorized' }),
      // A Strategy the Catalog doesn't hold is not reported, and its shape check is skipped.
      optionTrade('unknown-strategy', { strategyId: 'strategy-gone', leg: longCallLeg() }),
    ];

    const result = await validateSection(recordSourceOf({ trades }), references);

    expect(result.issues.map((i) => (i.code === 'IncoherentFacts' ? { ...i, findings: i.findings.map((f) => f.reason) } : i))).toEqual([
      { code: 'ExerciseIntentNotApplicable', tradeId: 'csp-intent' },
      { code: 'CloseReasonNotApplicable', tradeId: 'expired-with-reason', factId: 'expired-with-reason:cr' },
      { code: 'ExpirationHasPriceOrFee', tradeId: 'priced', factId: 'priced:member-2' },
      { code: 'IncoherentFacts', tradeId: 'fractional', findings: ['ContractQuantityNotWhole'] },
      { code: 'ExerciseIntentRequired', tradeId: 'call-no-intent' },
      { code: 'ExerciseIntentNotApplicable', tradeId: 'stock-intent' },
      { code: 'PlanShapeMismatch', tradeId: 'wrong-roles' },
    ]);
    expect(result.repairs).toEqual([]);
  });
});
