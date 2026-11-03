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
import { buy, complete, device, type Device, type Fill, type MutableDump, positionChange } from '../d5/support.ts';

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

export type FixtureVersion = 1 | 2 | 3 | 4;

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
