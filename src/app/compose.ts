import { createMutationGuard } from '../coordinators/mutation-guard.ts';
import { createTradeViews, type TradeBrowseRequest, type TradeDetailRequest } from '../coordinators/trade-views/index.ts';
import { createTradeWorkflows, type PositionChangeCommand } from '../coordinators/trade-workflows/index.ts';
import { createWorkspace, installedCapabilities, type MigrationStageHooks } from '../coordinators/workspace/index.ts';
import type { HostPort } from '../delivery/host.ts';
import { createReadinessSession, evaluateReadiness, type CapacityRequirement, type ReadinessSession } from '../delivery/readiness.ts';
import { toRuntimeNotWritable } from '../delivery/write-gate.ts';
import type { Clock } from '../domain/time/index.ts';
import { createJournal } from '../modules/journal/index.ts';
import { createReferenceCatalog } from '../modules/reference-catalog/index.ts';
import { createTradeRecord } from '../modules/trade-record/index.ts';
import { nyseSessionPolicy, type SessionPolicy } from '../domain/session-policy/index.ts';
import { createPersistence, type IdGenerator, type LifecycleLock } from '../persistence/index.ts';

export interface ApplicationDeps {
  readonly indexedDB: IDBFactory;
  readonly host: HostPort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly releaseId: string;
  // Only the Node suite supplies this, to stand in for a later release's policy (D4 section 6.0).
  readonly sessionPolicy?: SessionPolicy;
  readonly capacityRequirement: CapacityRequirement;
  // The Workspace lifecycle lock: the Web Locks API in the browser, the disclosed in-process lock
  // in Node (D2 section 6.0).
  readonly locks: LifecycleLock;
  // Migration stage-boundary hooks: only the faults build supplies them (D2 T2.16).
  readonly migrationHooks?: MigrationStageHooks;
  // Only the bench build's generator supplies this (D2 T2.20): while it returns true, mutations
  // skip the per-mutation readiness recheck (D1 A4).
  readonly skipMutationRecheck?: () => boolean;
}

// The single application facade used by the UI and by the Node integration suite. It exposes
// exactly the public operations in the Installed Capability Manifest, grouped under the same
// names; every authoritative mutation runs through the readiness guard.
export async function createApplication(deps: ApplicationDeps) {
  // The session and the persistence write gate refer to each other.
  const holder: { session?: ReadinessSession } = {};
  const sessionPolicy = deps.sessionPolicy ?? nyseSessionPolicy;
  const persistence = createPersistence({
    indexedDB: deps.indexedDB,
    ids: deps.ids,
    sessionPolicy: sessionPolicy.identity,
    writeGate: {
      current: () => toRuntimeNotWritable(holder.session!.current()),
      recheck: async () => toRuntimeNotWritable(await holder.session!.recheck()),
    },
  });
  const session = await createReadinessSession(async () =>
    evaluateReadiness({
      host: deps.host,
      rootInspection: await persistence.inspectRoot(),
      capacityRequirement: deps.capacityRequirement,
      pageReleaseId: deps.releaseId,
    }),
  );
  holder.session = session;

  const guard = createMutationGuard(session, deps.skipMutationRecheck);
  const catalog = createReferenceCatalog({ persistence, ids: deps.ids });
  const journal = createJournal({ persistence, ids: deps.ids, clock: deps.clock });
  const tradeRecord = createTradeRecord({ persistence, ids: deps.ids });
  const workspace = createWorkspace({ persistence, session, catalog, journal, host: deps.host, ids: deps.ids, clock: deps.clock, releaseId: deps.releaseId, sessionPolicy, locks: deps.locks, migrationHooks: deps.migrationHooks });
  const tradeWorkflows = createTradeWorkflows({ persistence, catalog, journal, tradeRecord, clock: deps.clock, guard });
  const tradeViews = createTradeViews({ persistence, catalog, journal, tradeRecord });

  return {
    Workspace: {
      initialize: (request: Parameters<typeof workspace.initialize>[0]) => workspace.initialize(request),
      getStatus: () => workspace.getStatus(),
      requestDurability: () => workspace.requestDurability(),
    },
    ReferenceCatalog: {
      save: (command: Parameters<typeof catalog.save>[0]) => guard.run('ReferenceCatalog.save', () => catalog.save(command)),
      query: (request: Parameters<typeof catalog.query>[0]) => catalog.query(request),
      resolve: (requirements: Parameters<typeof catalog.resolve>[0]) => catalog.resolve(requirements),
    },
    Journal: {
      getDefinitions: (request: Parameters<typeof journal.getDefinitions>[0]) => journal.getDefinitions(request),
      query: (query: Parameters<typeof journal.query>[0]) => journal.query(query),
    },
    TradeWorkflows: {
      confirmPlan: (command: Parameters<typeof tradeWorkflows.confirmPlan>[0]) => tradeWorkflows.confirmPlan(command),
      recordPositionChange: (command: PositionChangeCommand) => tradeWorkflows.recordPositionChange(command),
    },
    TradeViewsAndReporting: {
      // Generic in the lifecycle, so the Planned and Open forms are both typed (T2.11).
      browseTrades: <L extends 'Planned' | 'Open'>(request: TradeBrowseRequest<L>) => tradeViews.browseTrades(request),
      getTradeDetail: (request: TradeDetailRequest) => tradeViews.getTradeDetail(request),
    },
    capabilities: installedCapabilities(deps.releaseId),
    session,
    persistence,
  };
}

export type Application = Awaited<ReturnType<typeof createApplication>>;

// The operation groups of the facade, named as in the Installed Capability Manifest.
export const FACADE_GROUPS = ['Workspace', 'ReferenceCatalog', 'Journal', 'TradeWorkflows', 'TradeViewsAndReporting'] as const;

export function facadeOperations(app: Application): string[] {
  return FACADE_GROUPS.flatMap((group) => Object.keys(app[group]).map((op) => `${group}.${op}`)).sort();
}

// What the UI may call: the public operation groups and the capability manifest only.
export type UiFacade = Pick<Application, (typeof FACADE_GROUPS)[number] | 'capabilities'>;
