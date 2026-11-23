// D9.5 Part A integration fixtures: the six-Trade book of I95.1 and I95.2, built through the real facade (createApplication on
// fake-indexeddb). Facade operations only; an earlier Review Date is reached by launching the same device on that date's clock.
import type { Application } from '../../../src/app/compose.ts';
import { device, launch, onboarded, optionPlanCommand, planStock, record, recordDeferred, recordOption, saveMark, XYZ_CALL, type Device } from '../d7/support.ts';

export { launch, saveMark };

export const FRI_1700 = '2026-10-09T21:00:00Z';
export const MON_1700 = '2026-10-12T21:00:00Z';
export const FRIDAY = '2026-10-09';
export const MONDAY = '2026-10-12';

const THU_1000 = '2026-10-08T14:00:00Z';
const MON_1000 = '2026-10-12T14:00:00Z';

// A call on XYZ that expired Fri 10-09 with no settlement recorded: Settlement Due at Monday 10-12's Review.
const EXPIRED_CALL = { ...XYZ_CALL, expiration: FRIDAY } as const;

export interface Book {
  readonly d: Device;
  readonly app: Application;
  readonly ids: { readonly shallow: string; readonly deep: string; readonly target: string; readonly inside: string; readonly exit: string; readonly expired: string };
}

// The Review as `open` returns it on the device's own clock, or on another instant.
export async function openOn(app: Application, now: string) {
  const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: now });
  if (opened.kind !== 'Ready') throw new Error(`open: ${opened.kind}`);
  return opened;
}

export function walkOf(opened: Awaited<ReturnType<typeof openOn>>) {
  const family = opened.families.find((f) => f.family === 'Trades');
  if (family?.family !== 'Trades') throw new Error('no Trades family');
  return family.trades;
}

// An Action saved for the Review as of `now`, from a freshly rendered card; it must be Saved.
export async function saveActionOn(app: Application, now: string, tradeId: string, action: 'Hold' | 'Exit' | 'Roll' | 'Adjust' = 'Hold', intent?: string) {
  const opened = await openOn(app, now);
  const card = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (card.kind !== 'Ready') throw new Error(`getTrade: ${card.kind}`);
  const result = await app.DailyReview.save({ kind: 'SaveTradeAction', binding: card.trade.saveBinding, action, ...(intent === undefined ? {} : { intent }) });
  if (result.kind !== 'Saved') throw new Error(`save: ${JSON.stringify(result).slice(0, 300)}`);
  return result;
}

// `work` on a launch whose clock reads `now` (an earlier Review Date), closed afterwards.
export async function onDay<T>(d: Device, now: string, work: (app: Application) => Promise<T>): Promise<T> {
  const app = await launch({ ...d, now });
  try {
    return await work(app);
  } finally {
    app.persistence.close();
  }
}

export interface BookOptions {
  // Marks left unsaved on Monday, by Trade name.
  readonly withoutMonday?: readonly (keyof Book['ids'])[];
}

// Six Trades, all with 100 shares (the contract with one): `shallow` ABC 1.5R past its Stop, `deep` DEF 2R past its Stop, `target` GHI past its Target,
// `inside` JKL between its lines (a Friday fill whose reflection is deferred and due Monday), `exit` MNO whose Action saved on Friday is Exit, and `expired` XYZ's call, Settlement Due. Monday's Marks are in
// (the expired contract needs none); Friday's Marks and Exit are in for `exit` alone.
export async function sixTradeBook(options: BookOptions = {}): Promise<Book> {
  const d = await device(undefined, MON_1700);
  let app = await onboarded(d);
  const stock = async (symbol: string, entry: string, stop: string, target: string, filled: string) => {
    const planTime = new Date(Date.parse(filled) - 3_600_000).toISOString().replace('.000', '');
    const tradeId = await planStock(app, symbol, entry, stop, target, '100', planTime);
    await record(app, tradeId, { quantity: '100', price: entry, economicTime: filled });
    return tradeId;
  };
  const shallow = await stock('ABC', '30.00', '28.00', '36.00', MON_1000);
  const deep = await stock('DEF', '50.00', '49.00', '56.00', MON_1000);
  const target = await stock('GHI', '50.00', '47.50', '56.00', MON_1000);
  const inside = await stock('JKL', '20.00', '19.00', '30.00', THU_1000);
  // A Friday fill whose reflection is put off: due at Monday's Review.
  await recordDeferred(app, inside, { quantity: '10', price: '20.10', economicTime: '2026-10-09T15:00:00Z' });
  const exit = await stock('MNO', '40.00', '38.00', '46.00', THU_1000);

  const call = await optionPlanCommand(app, 'O-C', '2026-10-05T13:00:00Z');
  const confirmed = await app.TradeWorkflows.confirmPlan({ ...call, plan: { ...call.plan, legs: [{ ...call.plan.legs[0]!, instrument: EXPIRED_CALL, quantity: '1' }] } });
  if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan: ${JSON.stringify(confirmed)}`);
  const expired = confirmed.receipt.tradeId;
  await recordOption(app, expired, 'Buy', { quantity: '1', price: '2.10', economicTime: '2026-10-05T14:00:00Z', fee: '0.65' });

  const ids = { shallow, deep, target, inside, exit, expired };
  const monday: Record<string, string> = { ABC: '25.00', DEF: '47.00', GHI: '56.50', JKL: '20.50', MNO: '40.50', XYZ: '60.00' };
  const without = new Set((options.withoutMonday ?? []).map((name) => ({ shallow: 'ABC', deep: 'DEF', target: 'GHI', inside: 'JKL', exit: 'MNO', expired: 'XYZ' })[name]));
  for (const [symbol, price] of Object.entries(monday)) if (!without.has(symbol)) await saveMark(app, symbol, MONDAY, price);

  // Friday: MNO's Mark, then its Exit, saved on a launch whose clock reads Friday 17:00.
  await saveMark(app, 'MNO', FRIDAY, '41.00');
  app.persistence.close();
  const friday = await launch({ ...d, now: FRI_1700 });
  await saveActionOn(friday, FRI_1700, exit, 'Exit', 'The thesis is done.');
  friday.persistence.close();
  app = await launch(d);
  return { d, app, ids };
}

const at = (date: string) => `${date}T21:00:00Z`;

// The one-Trade book of I95.5 and I95.6: marks on each session, the Trade open from 10-05, and a Hold saved on each of `holds`; returns the application at Monday's clock.
export async function heldTrade(marks: Readonly<Record<string, string>>, holds: readonly string[]) {
  const d = await device(undefined, MON_1700);
  const first = await onboarded(d);
  const tradeId = await planStock(first, 'XYZ', '50.00', '47.50', '56.00', '100', '2026-10-05T13:00:00Z');
  await record(first, tradeId, { quantity: '100', price: '50.00', economicTime: '2026-10-05T14:00:00Z' });
  for (const [date, price] of Object.entries(marks)) await saveMark(first, 'XYZ', date, price);
  first.persistence.close();
  for (const date of holds) await onDay(d, at(date), (app) => saveActionOn(app, at(date), tradeId, 'Hold', `Held on ${date}.`));
  return { app: await launch(d), d, tradeId };
}

export async function decisionsOf(app: Application, tradeId: string) {
  const opened = await openOn(app, MON_1700);
  const card = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (card.kind !== 'Ready' || !card.trade.decisions) throw new Error(`getTrade: ${card.kind}`);
  return card.trade.decisions;
}

export const MARKS = { '2026-10-05': '50.00', '2026-10-06': '47.00', '2026-10-07': '46.00', '2026-10-08': '47.00', '2026-10-09': '46.50', [MONDAY]: '46.00' };
