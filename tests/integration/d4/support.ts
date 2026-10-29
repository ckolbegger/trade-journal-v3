// The D4 Node application-stack suite (plan section 6.1): the real facade from createApplication on
// fake-indexeddb, NodeTestHost and the in-process lifecycle lock, called through facade operations
// only, as in D1 and D2. Test code touches stored records only before an application opens them
// (the fixture loader and the integrity fixture writer). Clocks are fixed per case.
import { readFileSync } from 'node:fs';
import { createApplication, type Application } from '../../../src/app/compose.ts';
import type { SessionPolicy } from '../../../src/domain/session-policy/index.ts';
import { fixedClock } from '../../../src/domain/time/index.ts';
import { TEST_CAPACITY } from '../../support/stack.ts';
import { loadDump, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import { planCommand } from '../d1/support.ts';
import { confirmReference, dec, device, onboarded, PC1, PC1_TIME, PC2, PLAN_TIME, record, type Device, type MutableDump } from '../d2/support.ts';

export * from '../d2/support.ts';

// Monday 2026-10-12 at 17:00 America/New_York (after the 16:00 close) and the Tuesday noon of I4.4.
export const MONDAY_1700 = '2026-10-12T21:00:00Z';
export const TUESDAY_NOON = '2026-10-13T16:00:00Z';
export const MONDAY = '2026-10-12';
export const FRIDAY = '2026-10-09';

// --- The committed fixtures ---

export function fixtureDump(version: 1 | 2 | 3): WorkspaceDump {
  return JSON.parse(readFileSync(`tests/fixtures/workspace-v${version}/dump.json`, 'utf8')) as WorkspaceDump;
}

export function fixtureViews(version: 1 | 2 | 3): unknown {
  return JSON.parse(readFileSync(`tests/fixtures/workspace-v${version}/expected-views.json`, 'utf8'));
}

// The name of the fixture's Workspace database.
export function fixtureDatabase(version: 1 | 2 | 3): string {
  const name = Object.keys(fixtureDump(version).databases).find((n) => n.startsWith('tj-ws-'));
  if (!name) throw new Error(`workspace-v${version} has no Workspace database`);
  return name;
}

// A device holding a committed fixture, optionally edited before any application opens it, at the
// fixture's recorded as-of instant. Its identities use the `mig` prefix, never the fixture's `fx-`.
export async function fixtureDevice(version: 1 | 2 | 3, edit?: (dump: MutableDump) => void): Promise<Device> {
  const dump = structuredClone(fixtureDump(version));
  edit?.(dump as unknown as MutableDump);
  return device(await loadDump(dump), fixtureDump(version).asOf, 'mig');
}

// --- Marks ---

export async function saveMark(app: Application, instrumentKey: string, tradingDate: string, price: string) {
  const saved = await app.MarketData.save({ intention: 'RecordInitialManualMark', instrumentKey, tradingDate, price, expectedResolutionRevision: 'None' });
  if (saved.kind !== 'Saved' || !('revision' in saved)) throw new Error(`MarketData.save: ${JSON.stringify(saved)}`);
  return saved;
}

// --- The reference Trade with Marks ---

// An onboarded Workspace holding the reference Trade through PC2, on a device whose clock reads `now`.
export async function referenceTrade(now = MONDAY_1700) {
  const d = await device(undefined, now);
  const app = await onboarded(d);
  const tradeId = await confirmReference(app);
  await record(app, tradeId, PC1);
  await record(app, tradeId, PC2);
  return { d, app, tradeId };
}

// --- Views ---

export async function openItem(app: Application, tradeId: string) {
  const open = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
  if (open.kind !== 'Ready') throw new Error(`browseTrades Open: ${open.kind}`);
  const item = open.view.items.find((i) => i.tradeId === tradeId);
  if (!item || !('current' in item)) throw new Error(`Trade ${tradeId} is not listed as a coherent Open Trade`);
  return item;
}

export async function detail(app: Application, tradeId: string) {
  const result = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  if (result.kind !== 'Ready') throw new Error(`getTradeDetail: ${result.kind}`);
  if (!('current' in result.view)) throw new Error(`Trade ${tradeId} has no current evaluation`);
  return result.view;
}

// A Value figure of an exact decimal text.
export const value = (text: string) => ({ kind: 'Value', value: dec(text) });

// Every observation record in the Workspace dump.
export interface StoredObservation {
  readonly instrumentKey: string;
  readonly tradingDate: string;
  readonly resolutionRevision: number;
  readonly marks: { readonly revisionId: string; readonly price: string; readonly [field: string]: unknown }[];
  readonly effectiveMarkId: string | null;
  readonly acknowledgments: unknown[];
}

// --- Part 2 additions ---

// A device's application built with another session policy, as a later release would carry (I4.11).
export function launchWithPolicy(d: Device, sessionPolicy: SessionPolicy): Promise<Application> {
  return createApplication({
    indexedDB: d.factory,
    host: d.testHost.host,
    clock: fixedClock(d.now),
    ids: d.ids,
    releaseId: d.testHost.releaseId,
    capacityRequirement: TEST_CAPACITY,
    locks: d.locks,
    sessionPolicy,
  });
}

// Closes the application and builds a new one on the same storage with another session policy.
export function restartWithPolicy(app: Application, d: Device, sessionPolicy: SessionPolicy): Promise<Application> {
  app.persistence.close();
  return launchWithPolicy(d, sessionPolicy);
}

// The latest completed Review, as the Review opens it; `asOf` is the device clock.
export async function openReview(app: Application, d: Device) {
  const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: d.now });
  if (opened.kind !== 'Ready') throw new Error(`DailyReview.open: ${opened.kind}`);
  return opened;
}

// --- Part 3 additions ---

// Confirms a Long Stock Plan of 100 shares through the facade and returns its Trade identity.
export async function planStock(app: Application, symbol: string, entry: string, stop: string, target: string, shares = '100', planTime = PLAN_TIME): Promise<string> {
  const command = await planCommand(app, { underlying: symbol, economicTime: planTime });
  const leg = { ...command.plan.legs[0]!, quantity: shares, intendedEntry: entry };
  const plan = { ...command.plan, legs: [leg], stops: [{ kind: 'UnderlyingPrice' as const, price: stop }], targets: [{ kind: 'UnderlyingPrice' as const, price: target }] };
  const result = await app.TradeWorkflows.confirmPlan({ ...command, plan });
  if (result.kind !== 'Confirmed') throw new Error(`confirmPlan: ${result.kind}`);
  return result.receipt.tradeId;
}

export interface FourTrades {
  readonly a: string;
  readonly b: string;
  readonly c: string;
  readonly e: string;
}

// The Five-Trade fixture without T-D, through the facade: T-A XYZ (the reference Trade through PC2),
// T-B ABC, T-C DEF and T-E JKL, each filled at 10:00 Monday. No Marks are saved.
export async function fourTrades(app: Application): Promise<FourTrades> {
  const a = await planStock(app, 'XYZ', '50.00', '47.50', '56.00');
  await record(app, a, PC1);
  await record(app, a, PC2);
  const single = async (symbol: string, entry: string, stop: string, target: string) => {
    const tradeId = await planStock(app, symbol, entry, stop, target);
    await record(app, tradeId, { quantity: '100', price: entry, economicTime: PC1_TIME });
    return tradeId;
  };
  const b = await single('ABC', '30.00', '28.00', '36.00');
  const c = await single('DEF', '40.00', '38.00', '46.00');
  const e = await single('JKL', '20.00', '19.00', '30.00');
  return { a, b, c, e };
}

// The Review as `open` returns it, with the Trade's save binding as `getTrade` renders it.
export async function bindingFor(app: Application, d: Device, tradeId: string) {
  const opened = await openReview(app, d);
  const trade = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (trade.kind !== 'Ready') throw new Error(`getTrade: ${trade.kind}`);
  return { opened, form: trade.trade, binding: trade.trade.saveBinding };
}

// Saves an Action for the Trade from a freshly rendered form and requires it to be Saved.
export async function saveAction(app: Application, d: Device, tradeId: string, action: 'Hold' | 'Exit' | 'Roll' | 'Adjust' = 'Hold', intent?: string) {
  const { binding } = await bindingFor(app, d, tradeId);
  const result = await app.DailyReview.save({ kind: 'SaveTradeAction', binding, action, ...(intent === undefined ? {} : { intent }) });
  if (result.kind !== 'Saved') throw new Error(`DailyReview.save: ${result.kind}`);
  return result;
}
