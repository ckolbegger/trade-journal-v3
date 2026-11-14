// The D08P Node suite's fixtures (plan section 5 and 6.1): O-C3 built through the real facade on fake-indexeddb, the clock
// moved by restarting over the same stores, as D6's closedScenario does. Facade operations only; nothing here reads a stored record.
import type { Application } from '../../../src/app/compose.ts';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { optionPrice, underlyingPrice, XYZ_DEC_CALL } from '../d7s/support.ts';
import { device, onboarded, optionPlanCommand, PLAN_TIME, recordOption, restart, saveAction, saveMark, type Device } from '../d7/support.ts';

export { XYZ_DEC_CALL };

// New York is on daylight time (UTC-4) in October 2026.
export const MONDAY_0900 = PLAN_TIME;
export const MONDAY_1005 = '2026-10-12T14:05:00Z';
export const MONDAY_1700 = '2026-10-12T21:00:00Z';
export const WEDNESDAY_0800 = '2026-10-14T12:00:00Z';
export const WEDNESDAY_1105 = '2026-10-14T15:05:00Z';
export const WEDNESDAY_1700 = '2026-10-14T21:00:00Z';
export const THURSDAY_1700 = '2026-10-15T21:00:00Z';
export const THURSDAY_1800 = '2026-10-15T22:00:00Z';
export const FRIDAY_1105 = '2026-10-16T15:05:00Z';
export const FRIDAY_1700 = '2026-10-16T21:00:00Z';

export const DATES = { mon: '2026-10-12', tue: '2026-10-13', wed: '2026-10-14', thu: '2026-10-15', fri: '2026-10-16' } as const;
export const XYZ = { kind: 'Stock', symbol: 'XYZ' } as const;
export const CALL_KEY = instrumentKey(XYZ_DEC_CALL);

const at = (d: Device, now: string): Device => ({ ...d, now });

// O-C3's Plan command: the Long Call on XYZ 18 Dec 2026 55 Call, 2 at 2.00, Stop "option at or below 1.00", Target "XYZ at or above 60.00".
export async function oc3Command(app: Application) {
  const base = await optionPlanCommand(app, 'O-C', MONDAY_0900);
  return {
    ...base,
    plan: { ...base.plan, legs: [{ ...base.plan.legs[0]!, instrument: XYZ_DEC_CALL }], stops: [optionPrice('1.00')], targets: [underlyingPrice('60.00')] },
  };
}

export interface Oc3 {
  readonly d: Device;
  readonly app: Application;
  readonly tradeId: string;
}

// O-C3 with section 5's executions, Marks and Journal, the clock at `finalClock`, in the order the events happened:
//   Mon 09:00 Plan with its Reflection; Mon 10:05 Buy 2 @ 2.00 (10:00, fee 1.30) with its reflection; Mon 17:00 Monday's Marks;
//   Wed 08:00 the Daily Action Hold for Review Date Tue 10-13; Wed 11:05 Sell 1 @ 3.00 (11:00, fee 0.65) with its reflection deferred;
//   Wed 17:00 Wednesday's Marks; Thu 17:00 Thursday's Marks; and, with `thursdayHold`, Thu 18:00 the Hold for Thu 10-15.
// Tuesday has no Marks. With `thursdayHold` false the clock stays Thu 17:00, since a Hold saved at 18:00 is after it.
export async function oc3(options: { readonly thursdayHold?: boolean } = {}): Promise<Oc3> {
  const first = await device(undefined, MONDAY_0900);
  let app = await onboarded(first);
  const confirmed = await app.TradeWorkflows.confirmPlan(await oc3Command(app));
  if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan: ${JSON.stringify(confirmed)}`);
  const tradeId = confirmed.receipt.tradeId;

  let d = at(first, MONDAY_1005);
  app = await restart(app, d);
  await recordOption(app, tradeId, 'Buy', { quantity: '2', price: '2.00', economicTime: '2026-10-12T14:00:00Z', fee: '1.30' });

  d = at(d, MONDAY_1700);
  app = await restart(app, d);
  await saveMark(app, 'XYZ', DATES.mon, '56.00');
  await saveMark(app, CALL_KEY, DATES.mon, '2.10');

  d = at(d, WEDNESDAY_0800);
  app = await restart(app, d);
  await saveAction(app, d, tradeId);

  d = at(d, WEDNESDAY_1105);
  app = await restart(app, d);
  await recordOption(app, tradeId, 'Sell', { quantity: '1', price: '3.00', economicTime: '2026-10-14T15:00:00Z', fee: '0.65' }, { reflection: { kind: 'Defer' } });

  d = at(d, WEDNESDAY_1700);
  app = await restart(app, d);
  await saveMark(app, 'XYZ', DATES.wed, '57.40');
  await saveMark(app, CALL_KEY, DATES.wed, '2.90');

  d = at(d, THURSDAY_1700);
  app = await restart(app, d);
  await saveMark(app, 'XYZ', DATES.thu, '57.90');
  await saveMark(app, CALL_KEY, DATES.thu, '3.20');

  if (options.thursdayHold === true) {
    d = at(d, THURSDAY_1800);
    app = await restart(app, d);
    await saveAction(app, d, tradeId);
  }
  return { d, app, tradeId };
}

// The Detail's binding, then the replay with it, as the cockpit asks.
export async function replayOf(app: Application, tradeId: string) {
  const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  if (detail.kind !== 'Ready') throw new Error(`getTradeDetail: ${detail.kind}`);
  return { detail, replay: await app.TradeViewsAndReporting.replayTrade({ tradeId, binding: detail.binding }) };
}
