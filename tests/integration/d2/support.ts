// The D2 Node application-stack suite (plan section 6.1): the real facade from createApplication
// on fake-indexeddb, NodeTestHost and the in-process lifecycle lock, called through facade
// operations only. Test code touches stored records only before an application opens them: the
// v1 fixture loader, the integrity fixture writer, and the interruption points of I2.3.
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { createApplication, type Application } from '../../../src/app/compose.ts';
import type { PositionChangeCommand, PositionChangeMember } from '../../../src/coordinators/trade-workflows/index.ts';
import { fixedClock } from '../../../src/domain/time/index.ts';
import { parseDecimal, type Rational } from '../../../src/domain/values/index.ts';
import type { ReflectionDisposition } from '../../../src/modules/journal/index.ts';
import { createInProcessLifecycleLock, type LifecycleLock } from '../../../src/persistence/index.ts';
import { loadDump, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import { nodeTestHost, type NodeTestHost } from '../../support/node-test-host.ts';
import { TEST_CAPACITY } from '../../support/stack.ts';
import { sequentialIds } from '../../support/workspace.ts';
import { planCommand } from '../d1/support.ts';

export { contentRevision, dumpAll, readIndex, workspaceStores, type Dump } from '../d1/support.ts';

// The reference Trade (D2 breakdown, section 4), in UTC: the Plan at 09:00 America/New_York and
// PC1 10:00, PC2 11:00, PC3 14:00. The clock reads 17:00 that day, after the close.
export const NOW = '2026-10-12T21:00:00Z';
export const PLAN_TIME = '2026-10-12T13:00:00Z';
export const PC1_TIME = '2026-10-12T14:00:00Z';
export const PC2_TIME = '2026-10-12T15:00:00Z';
export const PC3_TIME = '2026-10-12T18:00:00Z';

// One browser profile: its storage, its host, its clock, identities that never repeat across
// restarts, and one lifecycle lock shared by every application on it (in-process, section 6.0).
export interface Device {
  readonly factory: IDBFactory;
  readonly testHost: NodeTestHost;
  readonly ids: { next(): string };
  readonly locks: LifecycleLock;
  readonly now: string;
}

export async function device(factory = new IDBFactory(), now = NOW, idPrefix = 'id'): Promise<Device> {
  return { factory, testHost: await nodeTestHost(factory), ids: sequentialIds(idPrefix), locks: createInProcessLifecycleLock(), now };
}

// `indexedDB` replaces the device's factory for this application only (I2.3's stopping factory).
export function launch(d: Device, indexedDB: IDBFactory = d.factory): Promise<Application> {
  return createApplication({
    indexedDB,
    host: d.testHost.host,
    clock: fixedClock(d.now),
    ids: d.ids,
    releaseId: d.testHost.releaseId,
    capacityRequirement: TEST_CAPACITY,
    locks: d.locks,
  });
}

// Closes every connection, then builds a new application on the same storage.
export function restart(app: Application, d: Device): Promise<Application> {
  app.persistence.close();
  return launch(d);
}

export async function onboarded(d: Device): Promise<Application> {
  const app = await launch(d);
  const opened = await app.Workspace.initialize({ timeZone: 'America/New_York' });
  if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
  const institution = await app.ReferenceCatalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
  if (institution.kind !== 'Saved') throw new Error(`institution: ${institution.kind}`);
  const account = await app.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: institution.record.id, label: 'Roth IRA' });
  if (account.kind !== 'Saved') throw new Error(`account: ${account.kind}`);
  return app;
}

// Confirms the reference Plan (or one of `quantity` shares) and returns its Trade identity.
export async function confirmReference(app: Application, underlying = 'XYZ', quantity = '100'): Promise<string> {
  const command = await planCommand(app, { underlying, economicTime: PLAN_TIME });
  const leg = { ...command.plan.legs[0]!, quantity };
  const result = await app.TradeWorkflows.confirmPlan({ ...command, plan: { ...command.plan, legs: [leg] } });
  if (result.kind !== 'Confirmed') throw new Error(`confirmPlan: ${result.kind}`);
  return result.receipt.tradeId;
}

export interface Fill {
  readonly quantity: string;
  readonly price: string;
  readonly economicTime: string;
  readonly fee?: string;
}

export const PC1: Fill = { quantity: '60', price: '50.10', economicTime: PC1_TIME };
export const PC2: Fill = { quantity: '40', price: '50.30', economicTime: PC2_TIME };
export const PC3: Fill = { quantity: '20', price: '51.00', economicTime: PC3_TIME };

export async function reflectionDefinitionId(app: Application): Promise<string> {
  const definition = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (definition.kind !== 'Found') throw new Error('no Position Change Reflection definition');
  return definition.definition.id;
}

export async function complete(app: Application): Promise<ReflectionDisposition> {
  return {
    kind: 'Complete',
    form: {
      definitionId: await reflectionDefinitionId(app),
      answers: {
        'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
        'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
        'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
      },
    },
  };
}

export async function decline(app: Application, reason?: string): Promise<ReflectionDisposition> {
  return { kind: 'Decline', definitionId: await reflectionDefinitionId(app), ...(reason !== undefined && { reason }) };
}

// The Trade as the entry form loads it: its FactRevision and its single Planned Leg.
export async function loaded(app: Application, tradeId: string) {
  const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  if (detail.kind !== 'Ready') throw new Error(`getTradeDetail: ${detail.kind}`);
  return { factRevision: detail.view.factRevision, leg: detail.view.plan.legs[0]! };
}

export async function buy(app: Application, tradeId: string, fill: Fill): Promise<PositionChangeMember> {
  const { leg } = await loaded(app, tradeId);
  return {
    kind: 'Execution',
    tradeId,
    action: 'Buy',
    instrument: leg.instrument,
    intent: { kind: 'ServesPlannedLeg', plannedLegId: leg.factId },
    quantity: fill.quantity,
    price: fill.price,
    fee: fill.fee ?? '1.00',
    economicTime: fill.economicTime,
  };
}

// One Position Change command against the Trade's current FactRevision.
export async function positionChange(
  app: Application,
  tradeId: string,
  members: readonly PositionChangeMember[],
  reflection: ReflectionDisposition,
): Promise<PositionChangeCommand> {
  const { factRevision } = await loaded(app, tradeId);
  return { originTradeId: tradeId, trades: [{ tradeId, expectedFactRevision: factRevision }], members, reflection };
}

// Records one single-Execution Position Change and requires it to be accepted.
export async function record(app: Application, tradeId: string, fill: Fill, reflection?: ReflectionDisposition) {
  const command = await positionChange(app, tradeId, [await buy(app, tradeId, fill)], reflection ?? (await complete(app)));
  const result = await app.TradeWorkflows.recordPositionChange(command);
  if (result.kind !== 'Recorded') throw new Error(`recordPositionChange: ${JSON.stringify(result)}`);
  return result;
}

export function dec(text: string): Rational {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`not a decimal: ${text}`);
  return parsed.value;
}

// The T2.2 figures for the reference Trade resolved at PC2.
export const REFERENCE_ENTRY_QUALITY = {
  kind: 'Value',
  value: {
    averageEntry: { kind: 'Value', value: dec('50.18') },
    windowQuantity: { kind: 'Value', value: dec('100') },
    windowFees: { kind: 'Value', value: dec('2.00') },
    actualInitialRisk: { kind: 'Value', value: dec('270.00') },
    actualInitialReward: { kind: 'Value', value: dec('580.00') },
    riskInPlanR: { kind: 'Value', value: dec('1.08') },
    slippage: { kind: 'Value', value: dec('18.00') },
    sizeRatio: { kind: 'Value', value: dec('1') },
    plannedRewardRisk: { kind: 'Value', value: dec('2.4') },
    actualRewardRisk: { kind: 'Value', value: dec('580').div(dec('270')) },
    flags: [],
  },
};

// --- The committed schema-1 fixture (D1 T1.31) ---

export const V1_DUMP = JSON.parse(readFileSync('tests/fixtures/workspace-v1/dump.json', 'utf8')) as WorkspaceDump;
export const V1_VIEWS: unknown = JSON.parse(readFileSync('tests/fixtures/workspace-v1/expected-views.json', 'utf8'));
export const V1_DATABASE = 'tj-ws-fx-0003';

export type MutableDump = {
  databases: Record<string, { version: number; stores: Record<string, { records: Record<string, unknown>[] }> }>;
};

// A device holding the v1 fixture, optionally edited before any application opens it. Its own
// identities use the `mig` prefix, so they never repeat the fixture's `fx-` ones.
export async function v1Device(edit?: (dump: MutableDump) => void): Promise<Device> {
  const dump = structuredClone(V1_DUMP);
  edit?.(dump as unknown as MutableDump);
  return device(await loadDump(dump), V1_DUMP.asOf, 'mig');
}

// --- Raw record access: the integrity fixture writer, used only while no application is open ---

function openRaw(factory: IDBFactory, database: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = factory.open(database);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
  });
}

export async function rawUpdate(
  factory: IDBFactory,
  database: string,
  store: string,
  key: string,
  edit: (value: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const db = await openRaw(factory, database);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const get = tx.objectStore(store).get(key);
    get.onsuccess = () => tx.objectStore(store).put(edit(get.result as Record<string, unknown>));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('update failed'));
  });
  db.close();
}

// The Workspace database the root pointer names.
export async function currentDatabase(factory: IDBFactory): Promise<string> {
  const root = await openRaw(factory, 'tj-root');
  const pointer = await new Promise<{ databaseName: string }>((resolve) => {
    const get = root.transaction('pointer').objectStore('pointer').get('current');
    get.onsuccess = () => resolve(get.result as { databaseName: string });
  });
  root.close();
  return pointer.databaseName;
}
