// The D08R Node suite's fixtures (plan section 5 and 7.1): O-C3, O-C3+ and O-S2X built through the real facade on fake-indexeddb,
// the clock moved by restarting over the same stores. Facade operations only; nothing here reads a stored record.
import type { Application } from '../../../src/app/compose.ts';
import { confirmOption, detailOf, device, onboarded, onboardedAt, OS_S1, planStock, PC1_TIME, record, recordOption, restart, saveMark, type Device } from '../d7s/support.ts';
import { DATES, MONDAY_0900, MONDAY_1005, oc3, oc3Command, type Oc3 } from '../d8p/support.ts';

export { DATES, detailOf, oc3, restart, saveMark };

// Instants in New York daylight time (UTC-4) in October 2026 and EST (UTC-5) in November 2026.
export const MONDAY_1200 = '2026-10-12T16:00:00Z';
export const THURSDAY_1200 = '2026-10-15T16:00:00Z';
export const THURSDAY_1800 = '2026-10-15T22:00:00Z';
export const FRIDAY_1105 = '2026-10-16T15:05:00Z';
export const FRIDAY_1200 = '2026-10-16T16:00:00Z';
export const FRIDAY_1800 = '2026-10-16T22:00:00Z';
export const SATURDAY_1000 = '2026-10-17T14:00:00Z';
export const THANKSGIVING_1200 = '2026-11-26T17:00:00Z';
export const DAY_AFTER_THANKSGIVING_1200 = '2026-11-27T17:00:00Z';
export const MONDAY_NOV_23_1800 = '2026-11-23T23:00:00Z';
export const WEDNESDAY_NOV_25_1800 = '2026-11-25T23:00:00Z';

export const at = (d: Device, now: string): Device => ({ ...d, now });

// The Open Detail's view, or a thrown error naming what came back.
export async function openDetailOf(app: Application, tradeId: string) {
  const detail = await detailOf(app, tradeId);
  if (!('current' in detail)) throw new Error('expected an Open Detail');
  return detail;
}

// The Detail's evaluation, which must be an Evaluated one.
export async function evaluationOf(app: Application, tradeId: string) {
  const { current } = await openDetailOf(app, tradeId);
  if (current.evaluation.kind !== 'Evaluated') throw new Error(`expected an Evaluated evaluation, got ${String(current.evaluation.kind)}`);
  return current.evaluation;
}

// O-C3+: O-C3 with one more contract bought Fri 10-16 11:00 at 3.30 (fee 0.65). The clock ends at Fri 11:05.
export async function oc3Plus(): Promise<Oc3> {
  const built = await oc3({ thursdayHold: true });
  const d = at(built.d, FRIDAY_1105);
  const app = await restart(built.app, d);
  await recordOption(app, built.tradeId, 'Buy', { quantity: '1', price: '3.30', economicTime: '2026-10-16T15:00:00Z', fee: '0.65' });
  return { d, app, tradeId: built.tradeId };
}

// O-C3's Plan confirmed Monday 09:00 and its entry (Buy 2 at 2.00) at 10:00, with no Marks yet, the clock at Mon 12:00.
export async function oc3BeforeMarks(): Promise<Oc3> {
  const first = await device(undefined, MONDAY_0900);
  let app = await onboarded(first);
  const confirmed = await app.TradeWorkflows.confirmPlan(await oc3Command(app));
  if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan: ${JSON.stringify(confirmed)}`);
  const tradeId = confirmed.receipt.tradeId;
  let d = at(first, MONDAY_1005);
  app = await restart(app, d);
  await recordOption(app, tradeId, 'Buy', { quantity: '2', price: '2.00', economicTime: '2026-10-12T14:00:00Z', fee: '1.30' });
  d = at(d, MONDAY_1200);
  return { d, app: await restart(app, d), tradeId };
}

// A Long Stock Trade on XYZ (100 shares at 50.00, Stop 47.50, Target 56.00) with a Mark of 46.00 on Fri 10-16, read at Fri 18:00.
export async function breachedStock() {
  const { d, app } = await onboardedAt(FRIDAY_1800);
  const tradeId = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');
  await record(app, tradeId, { quantity: '100', price: '50.00', economicTime: PC1_TIME });
  await saveMark(app, 'XYZ', DATES.fri, '46.00');
  return { d, app, tradeId };
}

// O-S2X: D7's expired put, MNO 20 Nov 2026 45 Put, 2 short since Mon 10-12; Settlement Due from Sat 11-21. The clock reads `now`.
export async function os2x(now: string) {
  const { d, app } = await onboardedAt(now);
  const tradeId = (await confirmOption(app, 'O-S')).receipt.tradeId;
  await recordOption(app, tradeId, 'Sell', OS_S1);
  return { d, app, tradeId };
}
