// The D1 Node application-stack suite (plan section 6.1): the real facade from createApplication
// on fake-indexeddb and NodeTestHost, called through facade operations only.
import { IDBFactory } from 'fake-indexeddb';
import { createApplication, type Application } from '../../../src/app/compose.ts';
import { createInProcessLifecycleLock, type LifecycleLock } from '../../../src/persistence/index.ts';
import { fixedClock } from '../../../src/domain/time/index.ts';
import type { ConfirmPlanCommand } from '../../../src/coordinators/trade-workflows/index.ts';
import { nodeTestHost, type NodeTestHost } from '../../support/node-test-host.ts';
import { TEST_CAPACITY, dumpAll } from '../../support/stack.ts';
import { sequentialIds } from '../../support/workspace.ts';

export { dumpAll };

export const NOW = '2026-10-12T14:05:00Z';

// One browser profile: its storage, its host, and identities that never repeat across restarts.
export interface Device {
  readonly factory: IDBFactory;
  readonly testHost: NodeTestHost;
  readonly ids: { next(): string };
  // One profile's lifecycle lock, shared by every application on it (in-process, D2 section 6.0).
  readonly locks: LifecycleLock;
}

export async function device(): Promise<Device> {
  const factory = new IDBFactory();
  return { factory, testHost: await nodeTestHost(factory), ids: sequentialIds('id'), locks: createInProcessLifecycleLock() };
}

export function launch(d: Device): Promise<Application> {
  return createApplication({
    indexedDB: d.factory,
    host: d.testHost.host,
    clock: fixedClock(NOW),
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

export async function initialized(d: Device): Promise<Application> {
  const app = await launch(d);
  const result = await app.Workspace.initialize({ timeZone: 'America/New_York' });
  if (result.kind !== 'Opened') throw new Error(`initialize: ${result.kind}`);
  return app;
}

// An initialized Workspace with one Institution and Account, created through the facade.
export async function onboarded(d: Device) {
  const app = await initialized(d);
  const institution = await app.ReferenceCatalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
  if (institution.kind !== 'Saved') throw new Error(`institution: ${institution.kind}`);
  const account = await app.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: institution.record.id, label: 'Roth IRA' });
  if (account.kind !== 'Saved') throw new Error(`account: ${account.kind}`);
  return { app, institution, account };
}

// The complete Long Stock Plan of AC-PLAN-001: 100 @ 50, Stop 47.50, Target 56.
export async function planCommand(app: Application, overrides: { underlying?: string; economicTime?: string } = {}): Promise<ConfirmPlanCommand> {
  const accounts = await app.ReferenceCatalog.query({ family: 'Account' });
  const strategies = await app.ReferenceCatalog.query({ family: 'Strategy' });
  const definition = await app.Journal.getDefinitions({ latestFor: 'entry-type.plan-reflection' });
  if (accounts.kind !== 'Page' || strategies.kind !== 'Page' || definition.kind !== 'Found') throw new Error('catalog or journal missing');
  const account = accounts.items[0]!;
  const strategy = strategies.items[0]!;
  const symbol = overrides.underlying ?? 'XYZ';
  return {
    accountId: account.id,
    accountRevision: account.recordRevision,
    strategyId: strategy.id,
    strategyRevision: strategy.recordRevision,
    economicTime: overrides.economicTime ?? '2026-10-12T13:30:00Z',
    plan: {
      underlying: symbol,
      legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol }, quantity: '100', intendedEntry: '50.00' }],
      stops: [{ kind: 'UnderlyingPrice', price: '47.50' }],
      targets: [{ kind: 'UnderlyingPrice', price: '56.00' }],
    },
    reflection: {
      definitionId: definition.definition.id,
      answers: {
        'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Breakout above the 50-day on volume.' },
        'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close back below 48.' },
        'prompt.plan-reflection.conviction': { kind: 'Scale', value: 4 },
        'prompt.plan-reflection.primary-emotion': { kind: 'Option', optionId: 'option.plan-reflection.primary-emotion.calm' },
      },
    },
  };
}

export type Dump = Awaited<ReturnType<typeof dumpAll>>;

export function workspaceStores(dump: Dump): Record<string, unknown[]> {
  const found = Object.entries(dump).find(([name]) => name.startsWith('tj-ws-'));
  if (!found) throw new Error('no Workspace database');
  return found[1];
}

export function contentRevision(dump: Dump): number {
  const meta = workspaceStores(dump)['meta'] as { key: string; contentRevision?: number }[];
  return meta.find((m) => m.key === 'content')!.contentRevision!;
}

// Reads one index with the raw API.
export async function readIndex(factory: IDBFactory, database: string, store: string, index: string): Promise<unknown[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = factory.open(database);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
  });
  const records = await new Promise<unknown[]>((resolve) => {
    const request = db.transaction(store).objectStore(store).index(index).getAll();
    request.onsuccess = () => resolve(request.result);
  });
  db.close();
  return records;
}
