// The D6 Node application-stack suite (plan section 6.1): the real facade from createApplication on
// fake-indexeddb, NodeTestHost and the in-process lifecycle lock, called through facade operations
// only, as in D1, D2, D4 and D5. Test code touches stored records only before an application opens
// them (the fixture loader and the integrity fixture writer). Clocks are fixed per case, and restart
// means a new application over the same factory. D6 adds no substitute (section 6.0).
import { readFileSync } from 'node:fs';
import type { Application } from '../../../src/app/compose.ts';
import type { PositionChangeCommand, PositionChangeMember } from '../../../src/coordinators/trade-workflows/index.ts';
import type { ReflectionDisposition } from '../../../src/modules/journal/index.ts';
import { loadDump, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import {
  buy, complete, confirmReference, device, type Device, type Fill, type MutableDump, MONDAY_1700, onboarded, PC1, PC1_TIME, PC2, planStock, positionChange, record, recordDeferred, restart, saveAction, saveMark,
  TUESDAY_1700,
} from '../d5/support.ts';

export * from '../d5/support.ts';

// --- Instants (America/New_York is UTC-4 in October 2026) ---

export const MONDAY_1030 = '2026-10-12T14:30:00Z';
export const TUESDAY_0945 = '2026-10-13T13:45:00Z';
export const TUESDAY_1000 = '2026-10-13T14:00:00Z';
export const TUESDAY_1400 = '2026-10-13T18:00:00Z';
export const WEDNESDAY_1700 = '2026-10-14T21:00:00Z';

// --- T-A's exits (D6 breakdown, section 4) ---

export const X1: Fill = { quantity: '30', price: '52.00', economicTime: TUESDAY_1000, fee: '0.60' };
export const X2A: Fill = { quantity: '50', price: '53.00', economicTime: TUESDAY_1400, fee: '1.00' };
export const X2B: Fill = { quantity: '20', price: '53.00', economicTime: TUESDAY_1400, fee: '0.40' };

// --- The committed fixtures, schema 1 to 4 ---

export type FixtureVersion = 1 | 2 | 3 | 4 | 5;

export function fixtureDump(version: FixtureVersion): WorkspaceDump {
  return JSON.parse(readFileSync(`tests/fixtures/workspace-v${version}/dump.json`, 'utf8')) as WorkspaceDump;
}

export function fixtureViews(version: FixtureVersion): unknown {
  return JSON.parse(readFileSync(`tests/fixtures/workspace-v${version}/expected-views.json`, 'utf8'));
}

// The name of the fixture's Workspace database.
export function fixtureDatabase(version: FixtureVersion): string {
  const name = Object.keys(fixtureDump(version).databases).find((n) => n.startsWith('tj-ws-'));
  if (!name) throw new Error(`workspace-v${version} has no Workspace database`);
  return name;
}

// A device holding a committed fixture, optionally edited before any application opens it, at the
// fixture's recorded as-of instant. Its identities use the `mig` prefix, never the fixture's `fx-`.
export async function fixtureDevice(version: FixtureVersion, edit?: (dump: MutableDump) => void): Promise<Device> {
  const dump = structuredClone(fixtureDump(version));
  edit?.(dump as unknown as MutableDump);
  return device(await loadDump(dump), fixtureDump(version).asOf, 'mig');
}

// --- Close Reasons and Close Review dispositions ---

// The Catalog identity of a Close Reason, by its label.
export async function closeReasonId(app: Application, label: string): Promise<string> {
  const page = await app.ReferenceCatalog.query({ family: 'CloseReason' });
  if (page.kind !== 'Page') throw new Error(`ReferenceCatalog.query CloseReason: ${page.kind}`);
  const found = page.items.find((item) => item.label === label);
  if (!found) throw new Error(`no Close Reason ${label}`);
  return found.id;
}

export type CloseReviewKind = 'Complete' | 'Decline' | 'Defer';

// A Close Review disposition against the current Close Review definition.
export async function closeReviewDisposition(app: Application, kind: CloseReviewKind): Promise<ReflectionDisposition> {
  if (kind === 'Defer') return { kind: 'Defer' };
  const definition = await app.Journal.getDefinitions({ latestFor: 'entry-type.close-review' });
  if (definition.kind !== 'Found') throw new Error('no Close Review definition');
  if (kind === 'Decline') return { kind: 'Decline', definitionId: definition.definition.id };
  return {
    kind: 'Complete',
    form: {
      definitionId: definition.definition.id,
      answers: { 'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' } },
    },
  };
}

// --- Sells ---

// A Sell member serving the Trade's Planned Leg.
export async function sell(app: Application, tradeId: string, fill: Fill): Promise<PositionChangeMember> {
  return { ...(await buy(app, tradeId, fill)), action: 'Sell' };
}

export interface ExitOptions {
  // The exit's own Position Change Reflection; completed when omitted.
  readonly reflection?: ReflectionDisposition;
  readonly closeReasonId?: string;
  readonly closeReview?: ReflectionDisposition;
}

// One exit decision with one Sell per fill, against the Trade's current FactRevision.
export async function exitCommand(app: Application, tradeId: string, fills: readonly Fill[], options: ExitOptions = {}): Promise<PositionChangeCommand> {
  const members: PositionChangeMember[] = [];
  for (const fill of fills) members.push(await sell(app, tradeId, fill));
  const command = await positionChange(app, tradeId, members, options.reflection ?? (await complete(app)));
  return { ...command, ...(options.closeReasonId !== undefined && { closeReasonId: options.closeReasonId }), ...(options.closeReview !== undefined && { closeReview: options.closeReview }) };
}

// Records an exit and requires it to be accepted.
export async function recordExit(app: Application, tradeId: string, fills: readonly Fill[], options: ExitOptions = {}) {
  const result = await app.TradeWorkflows.recordPositionChange(await exitCommand(app, tradeId, fills, options));
  if (result.kind !== 'Recorded') throw new Error(`recordPositionChange: ${JSON.stringify(result)}`);
  return result;
}

// --- Stored records ---

export interface StoredTradeDoc {
  readonly tradeId: string;
  readonly lifecycle: string;
  readonly terminalTime?: string;
  readonly terminalDesc?: string;
  readonly closeReasonFacts: { readonly factId: string; readonly kind: string; readonly versions: { readonly value: { readonly closeReasonId: string; readonly terminalPositionChangeId: string } }[] }[];
  readonly facts: { readonly factId: string; readonly kind: string; readonly versions: unknown[] }[];
}

// --- The Closed-Trade Review scenario through the facade (section 4, T6.11) ---

export const MONDAY_DATE = '2026-10-12';
export const TUESDAY_DATE = '2026-10-13';
const MONDAY_NOON = '2026-10-12T16:00:00Z';
const MONDAY_1500 = '2026-10-12T19:00:00Z';
const TUESDAY_PLAN = '2026-10-13T13:00:00Z';
const TUESDAY_1100 = '2026-10-13T15:00:00Z';
const TUESDAY_1500 = '2026-10-13T19:00:00Z';
const TUESDAY_1610 = '2026-10-13T20:10:00Z';
const TUESDAY_1630 = '2026-10-13T20:30:00Z';

export type ScenarioName = 'A' | 'K' | 'L' | 'M' | 'N' | 'P' | 'Q';
export type ScenarioTrades = Readonly<Record<ScenarioName, string>>;

export interface ClosedScenario {
  // The Tuesday 17:00 device and its application; every Mark and Action Tuesday's Review needs is saved.
  readonly d: Device;
  readonly app: Application;
  readonly trades: ScenarioTrades;
}

// Long Stock, 100 shares bought at 10:00 unless stated, every exit a Sell of the whole Position (T-A's X1 sells 30),
// every exit's own Position Change Reflection completed. `onMonday` runs once Monday's facts are recorded, the clock
// at Monday 17:00. The Marks and Actions of the Trades the Monday Review walks (T-A, T-K, T-N) are then saved, and
// Tuesday's facts recorded on a Tuesday 17:00 clock, followed by the Marks and Actions of Tuesday's walk (T-A, T-N).
export async function closedScenario(onMonday?: (app: Application, d: Device, trades: Partial<Record<ScenarioName, string>>) => Promise<void>): Promise<ClosedScenario> {
  const monday = await device(undefined, MONDAY_1700);
  let app = await onboarded(monday);
  const reason = await closeReasonId(app, 'Target Reached');
  const closing = async () => ({ closeReasonId: reason, closeReview: await closeReviewDisposition(app, 'Complete') });
  const deferring = async () => ({ closeReasonId: reason, closeReview: await closeReviewDisposition(app, 'Defer') });
  const buyAt = (price: string, economicTime: string): Fill => ({ quantity: '100', price, economicTime });
  const sellAt = (price: string, economicTime: string): Fill => ({ quantity: '100', price, economicTime, fee: '0.60' });
  const stock = (symbol: string, entry: string, stop: string, target: string, planTime?: string) => planStock(app, symbol, entry, stop, target, '100', planTime);

  // Monday.
  const trades: Partial<Record<ScenarioName, string>> = {};
  const a = (trades.A = await confirmReference(app));
  await record(app, a, PC1);
  await record(app, a, PC2);
  const k = (trades.K = await stock('KLM', '20.00', '19.00', '25.00'));
  const m = (trades.M = await stock('MNP', '40.00', '38.00', '46.00'));
  const n = (trades.N = await stock('NOP', '25.00', '23.00', '30.00'));
  const p = (trades.P = await stock('PQR', '15.00', '14.00', '18.00'));
  for (const [tradeId, entry] of [[k, '20.00'], [m, '40.00'], [n, '25.00'], [p, '15.00']] as const) await record(app, tradeId, buyAt(entry, PC1_TIME));
  await recordExit(app, p, [sellAt('16.00', MONDAY_NOON)], await closing());
  await recordExit(app, m, [sellAt('41.00', MONDAY_1500)], await deferring());
  await onMonday?.(app, monday, trades);
  for (const [tradeId, symbol, price] of [[a, 'XYZ', '51.00'], [k, 'KLM', '20.50'], [n, 'NOP', '25.50']] as const) {
    await saveMark(app, symbol, MONDAY_DATE, price);
    await saveAction(app, monday, tradeId);
  }

  // Tuesday.
  const tuesday: Device = { ...monday, now: TUESDAY_1700 };
  app = await restart(app, tuesday);
  await recordExit(app, a, [{ quantity: '30', price: '52.00', economicTime: TUESDAY_1000, fee: '0.60' }]);
  await recordExit(app, k, [sellAt('21.00', TUESDAY_1100)], await closing());
  const l = (trades.L = await stock('LMN', '30.00', '28.00', '36.00', TUESDAY_PLAN));
  await record(app, l, buyAt('30.00', TUESDAY_1000));
  await recordExit(app, l, [sellAt('31.00', TUESDAY_1500)], await deferring());
  await recordExit(app, n, [sellAt('26.00', TUESDAY_1630)], await closing());
  const q = (trades.Q = await stock('QST', '10.00', '9.00', '12.00', TUESDAY_PLAN));
  await recordDeferred(app, q, buyAt('10.00', TUESDAY_1610));
  for (const [tradeId, symbol, price] of [[a, 'XYZ', '52.00'], [n, 'NOP', '26.00']] as const) {
    await saveMark(app, symbol, TUESDAY_DATE, price);
    await saveAction(app, tuesday, tradeId);
  }
  return { d: tuesday, app, trades: trades as ScenarioTrades };
}

// The Review `open` returns at `asOf` (Ready or Empty).
export async function reviewAt(app: Application, asOf: string) {
  const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf });
  if (opened.kind !== 'Ready' && opened.kind !== 'Empty') throw new Error(`DailyReview.open: ${opened.kind}`);
  return opened;
}

// The Trades the Review walks, in walk order.
export function walkedIds(opened: Awaited<ReturnType<typeof reviewAt>>): string[] {
  if (opened.kind !== 'Ready') return [];
  return opened.families.flatMap((family) => (family.family === 'Trades' ? family.trades.map((t) => t.tradeId) : []));
}
