// The D7 Node application-stack suite (plan section 6.1): the real facade from createApplication on
// fake-indexeddb, NodeTestHost and the in-process lifecycle lock, called through facade operations
// only, as in D1 to D6. Test code touches stored records only before an application opens them
// (the fixture loader and the integrity fixture writer). Clocks are fixed per case, and restart means a
// new application over the same factory. D7 adds no substitute (section 6.0).
import type { Application } from '../../../src/app/compose.ts';
import type { ConfirmPlanCommand, ExpirationMember, PositionChangeCommand, PositionChangeMember } from '../../../src/coordinators/trade-workflows/index.ts';
import type { ReflectionDisposition } from '../../../src/modules/journal/index.ts';
import type { StrategyRecord } from '../../../src/modules/reference-catalog/index.ts';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { planCommand } from '../d1/support.ts';
import { complete, device, loaded, onboarded, PC1_TIME, PLAN_TIME, planStock, record, recordDeferred, saveMark, type Device, type Fill } from '../d6/support.ts';

export * from '../d6/support.ts';

// --- Instants. New York is on daylight time (UTC-4) until 2026-11-01 and on standard time (UTC-5) after it. ---

export const TUESDAY_10 = '2026-10-13T14:00:00Z';
export const WEDNESDAY_10 = '2026-10-14T14:00:00Z';
export const THURSDAY_1700 = '2026-11-19T22:00:00Z';
export const FRIDAY_1100 = '2026-11-20T16:00:00Z';
export const FRIDAY_1600 = '2026-11-20T21:00:00Z';
export const FRIDAY_1700 = '2026-11-20T22:00:00Z';
export const SATURDAY_1000 = '2026-11-21T15:00:00Z';
export const MONDAY_NEXT_1700 = '2026-11-23T22:00:00Z';
export const MONDAY_NEXT_1705 = '2026-11-23T22:05:00Z';

// --- The contracts (every one expires Friday 2026-11-20) ---

export const XYZ_CALL = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', right: 'Call', strike: '55', multiplier: 100 } as const;
export const ABC_PUT = { kind: 'Option', symbol: 'ABC', root: 'ABC', expiration: '2026-11-20', right: 'Put', strike: '50', multiplier: 100 } as const;
export const MNO_PUT = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-11-20', right: 'Put', strike: '45', multiplier: 100 } as const;

// --- The fills of D7 section 4's fixture Trades ---

export const OC_PC1: Fill = { quantity: '1', price: '2.10', economicTime: '2026-10-12T14:00:00Z', fee: '0.65' };
export const OC_PC2: Fill = { quantity: '1', price: '1.90', economicTime: '2026-10-12T15:00:00Z', fee: '0.65' };
export const OC_X1: Fill = { quantity: '1', price: '3.00', economicTime: TUESDAY_10, fee: '0.65' };
export const OS_S1: Fill = { quantity: '2', price: '1.25', economicTime: '2026-10-12T14:00:00Z', fee: '1.30' };
export const OS_B1: Fill = { quantity: '1', price: '0.60', economicTime: TUESDAY_10, fee: '0.65' };

export type OptionKind = 'O-C' | 'O-P' | 'O-S';

const STRATEGY: Record<OptionKind, string> = { 'O-C': 'strategy.long-call', 'O-P': 'strategy.long-put', 'O-S': 'strategy.cash-secured-put' };

const PLANS: Record<OptionKind, (underlying: string) => ConfirmPlanCommand['plan']> = {
  'O-C': () => ({
    underlying: 'XYZ',
    legs: [{ side: 'Long', instrument: XYZ_CALL, quantity: '2', intendedEntry: '2.00' }],
    stops: [{ kind: 'UnderlyingPrice', price: '48.00' }],
    targets: [{ kind: 'UnderlyingPrice', price: '60.00' }],
    exerciseIntent: 'NotAuthorized',
  }),
  'O-P': () => ({
    underlying: 'ABC',
    legs: [{ side: 'Long', instrument: ABC_PUT, quantity: '1', intendedEntry: '1.50' }],
    stops: [{ kind: 'UnderlyingPrice', price: '55.00' }],
    targets: [{ kind: 'UnderlyingPrice', price: '45.00' }],
    exerciseIntent: 'Authorized',
  }),
  'O-S': () => ({
    underlying: 'MNO',
    legs: [{ side: 'Short', instrument: MNO_PUT, quantity: '-2', intendedEntry: '1.20' }],
    stops: [{ kind: 'UnderlyingPrice', price: '42.00' }],
    targets: [{ kind: 'UnderlyingPrice', price: '50.00' }],
  }),
};

// The Strategy a Catalog product key names, never found by its position in the list.
export async function strategyOf(app: Application, productKey: string): Promise<StrategyRecord> {
  const page = await app.ReferenceCatalog.query({ family: 'Strategy' });
  if (page.kind !== 'Page') throw new Error(`ReferenceCatalog.query Strategy: ${page.kind}`);
  const found = page.items.find((s): s is StrategyRecord => s.kind === 'Strategy' && s.productKey === productKey);
  if (!found) throw new Error(`no Strategy ${productKey}`);
  return found;
}

// The command that confirms an option reference Plan on Monday 2026-10-12 at 09:00 New York.
export async function optionPlanCommand(app: Application, kind: OptionKind, planTime = PLAN_TIME): Promise<ConfirmPlanCommand> {
  const base = await planCommand(app, { economicTime: planTime });
  const strategy = await strategyOf(app, STRATEGY[kind]);
  return { ...base, strategyId: strategy.id, strategyRevision: strategy.recordRevision, plan: PLANS[kind](base.plan.underlying) };
}

// Confirms an option reference Plan and returns the whole Confirmed result.
export async function confirmOption(app: Application, kind: OptionKind, planTime = PLAN_TIME) {
  const result = await app.TradeWorkflows.confirmPlan(await optionPlanCommand(app, kind, planTime));
  if (result.kind !== 'Confirmed') throw new Error(`confirmPlan: ${JSON.stringify(result)}`);
  return result;
}

// An onboarded Workspace on a device whose clock reads `now`.
export async function onboardedAt(now: string): Promise<{ d: Device; app: Application }> {
  const d = await device(undefined, now);
  return { d, app: await onboarded(d) };
}

// --- Position Changes ---

export interface ChangeOptions {
  readonly reflection?: ReflectionDisposition;
  readonly closeReasonId?: string;
  readonly closeReview?: ReflectionDisposition;
}

// One option Execution serving the Trade's Planned Leg.
export async function optionExecution(app: Application, tradeId: string, action: 'Buy' | 'Sell', fill: Fill): Promise<PositionChangeMember> {
  const { leg } = await loaded(app, tradeId);
  return { kind: 'Execution', tradeId, action, instrument: leg.instrument, intent: { kind: 'ServesPlannedLeg', plannedLegId: leg.factId }, quantity: fill.quantity, price: fill.price, fee: fill.fee ?? '1.00', economicTime: fill.economicTime };
}

// The Expiration member for the Trade's contract: no price, no fee.
export async function expirationMember(app: Application, tradeId: string, quantity: string, economicTime: string): Promise<ExpirationMember> {
  const { leg } = await loaded(app, tradeId);
  if (leg.instrument.kind !== 'Option') throw new Error('the Planned Leg is not an option');
  return { kind: 'Expiration', tradeId, instrument: leg.instrument, quantity, economicTime };
}

// A command for the given members against the Trade's current FactRevision.
export async function optionCommand(app: Application, tradeId: string, members: readonly (PositionChangeMember | ExpirationMember)[], options: ChangeOptions = {}): Promise<PositionChangeCommand> {
  const { factRevision } = await loaded(app, tradeId);
  return {
    originTradeId: tradeId,
    trades: [{ tradeId, expectedFactRevision: factRevision }],
    members,
    reflection: options.reflection ?? (await complete(app)),
    ...(options.closeReasonId !== undefined && { closeReasonId: options.closeReasonId }),
    ...(options.closeReview !== undefined && { closeReview: options.closeReview }),
  };
}

// Records one option Execution and requires it to be accepted.
export async function recordOption(app: Application, tradeId: string, action: 'Buy' | 'Sell', fill: Fill, options: ChangeOptions = {}) {
  const result = await app.TradeWorkflows.recordPositionChange(await optionCommand(app, tradeId, [await optionExecution(app, tradeId, action, fill)], options));
  if (result.kind !== 'Recorded') throw new Error(`recordPositionChange: ${JSON.stringify(result)}`);
  return result;
}

// The Expiration of `quantity` contracts at the settlement time, returning the facade's result as it is.
export async function attemptExpiration(app: Application, tradeId: string, quantity: string, economicTime: string, options: ChangeOptions = {}) {
  return app.TradeWorkflows.recordPositionChange(await optionCommand(app, tradeId, [await expirationMember(app, tradeId, quantity, economicTime)], options));
}

// Records an Expiration and requires it to be accepted.
export async function recordExpiration(app: Application, tradeId: string, quantity: string, economicTime: string, options: ChangeOptions = {}) {
  const result = await attemptExpiration(app, tradeId, quantity, economicTime, options);
  if (result.kind !== 'Recorded') throw new Error(`recordPositionChange: ${JSON.stringify(result)}`);
  return result;
}

// --- The Settlement Review fixture (D7 breakdown, T7.14), through the facade ---

export const WEEK_PLAN = '2026-11-16T14:00:00Z';
export const WEEK_10 = '2026-11-16T15:00:00Z';
export const THURSDAY_10 = '2026-11-19T15:00:00Z';
export const FRIDAY_DATE = '2026-11-20';
// The Long Put on ABC expiring 18 Dec 2026, which T-4 holds.
export const ABC_DEC_PUT = { ...ABC_PUT, expiration: '2026-12-18' } as const;

export interface SettlementTrades {
  readonly t1: string;
  readonly t2: string;
  readonly t3: string;
  readonly t4: string;
  readonly t5: string;
}

// T-1 O-C through X1 (1 contract left); T-2 Long Stock XYZ, 100 shares since Monday 10-12; T-3 O-S after S1 (2 short);
// T-4 Long Put ABC 18 Dec 2026 50 Put, 1 contract since 11-16; T-5 Long Stock KLM since 11-16, with the reflection of
// a Thursday 11-19 10:00 add deferred. With `withMarks`, the Friday Marks the breakdown gives are saved (XYZ stays Missing).
export async function settlementTrades(app: Application, withMarks: boolean): Promise<SettlementTrades> {
  const t1 = (await confirmOption(app, 'O-C')).receipt.tradeId;
  await recordOption(app, t1, 'Buy', OC_PC1);
  await recordOption(app, t1, 'Buy', OC_PC2);
  await recordOption(app, t1, 'Sell', OC_X1);

  const t2 = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');
  await record(app, t2, { quantity: '100', price: '50.00', economicTime: PC1_TIME });

  const t3 = (await confirmOption(app, 'O-S')).receipt.tradeId;
  await recordOption(app, t3, 'Sell', OS_S1);

  const put = await optionPlanCommand(app, 'O-P', WEEK_PLAN);
  const confirmed = await app.TradeWorkflows.confirmPlan({ ...put, plan: { ...put.plan, legs: [{ ...put.plan.legs[0]!, instrument: ABC_DEC_PUT }] } });
  if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan: ${JSON.stringify(confirmed)}`);
  const t4 = confirmed.receipt.tradeId;
  await recordOption(app, t4, 'Buy', { quantity: '1', price: '1.50', economicTime: WEEK_10, fee: '0.65' });

  const t5 = await planStock(app, 'KLM', '20.00', '19.00', '25.00', '100', WEEK_PLAN);
  await record(app, t5, { quantity: '50', price: '20.00', economicTime: WEEK_10 });
  await recordDeferred(app, t5, { quantity: '50', price: '20.50', economicTime: THURSDAY_10 });

  if (withMarks) {
    await saveMark(app, instrumentKey(XYZ_CALL), FRIDAY_DATE, '0.05');
    await saveMark(app, instrumentKey(MNO_PUT), FRIDAY_DATE, '0.00');
    await saveMark(app, 'MNO', FRIDAY_DATE, '46.00');
    await saveMark(app, instrumentKey(ABC_DEC_PUT), FRIDAY_DATE, '1.20');
    await saveMark(app, 'ABC', FRIDAY_DATE, '49.00');
    await saveMark(app, 'KLM', FRIDAY_DATE, '20.50');
  }
  return { t1, t2, t3, t4, t5 };
}

// --- Views ---

export async function detailOf(app: Application, tradeId: string) {
  const result = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  if (result.kind !== 'Ready') throw new Error(`getTradeDetail: ${result.kind}`);
  return result.view;
}

export async function listed(app: Application, lifecycle: 'Planned' | 'Open' | 'Closed') {
  const page = await app.TradeViewsAndReporting.browseTrades({ lifecycle });
  if (page.kind !== 'Ready') throw new Error(`browseTrades ${lifecycle}: ${page.kind}`);
  return page.view.items;
}
