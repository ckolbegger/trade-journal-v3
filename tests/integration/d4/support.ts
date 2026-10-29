// The D4 Node application-stack suite (plan section 6.1): the real facade from createApplication on
// fake-indexeddb, NodeTestHost and the in-process lifecycle lock, called through facade operations
// only, as in D1 and D2. Test code touches stored records only before an application opens them
// (the fixture loader and the integrity fixture writer). Clocks are fixed per case.
import { readFileSync } from 'node:fs';
import type { Application } from '../../../src/app/compose.ts';
import { loadDump, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import { confirmReference, dec, device, onboarded, PC1, PC2, record, type Device, type MutableDump } from '../d2/support.ts';

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
