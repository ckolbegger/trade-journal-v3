import { sha256Hex } from '../../delivery/inventory.ts';
import type {
  ConditionInput,
  LifecycleState,
  PlannedLegInput,
  TradeAnalysisRecord,
} from '../../domain/trade-analysis/index.ts';
import {
  requireOpen,
  type IdGenerator,
  type Persistence,
  type SemanticTransaction,
  type WorkspaceSnapshotBinding,
} from '../../persistence/index.ts';
import { canonicalJson } from './canonical.ts';
import type { ConfirmPlanChange, PlanFactValue, TradeDocument, TradeFact } from './records.ts';

export interface TradeRecordDeps {
  readonly persistence: Persistence;
  readonly ids: IdGenerator;
}

export type PrepareTradeChangeResult =
  | { readonly kind: 'IncoherentChange'; readonly reason: 'NoPlannedLeg' }
  | {
  readonly kind: 'Prepared';
  // The record before the change (none for a new Trade) and the candidate after it.
  readonly before: TradeDocument | null;
  readonly candidate: TradeDocument;
  readonly analysisInput: TradeAnalysisRecord;
  // Canonical digest of the candidate, rechecked when the prepared change is applied.
  readonly digest: string;
};

// The AnalysisInput projection: the complete effective facts Trade Analysis needs.
export function analysisInputOf(document: TradeDocument): TradeAnalysisRecord {
  let plan: PlanFactValue | undefined;
  const legs: (PlannedLegInput & { factId: string })[] = [];
  const stops: (ConditionInput & { factId: string })[] = [];
  const targets: (ConditionInput & { factId: string })[] = [];
  for (const fact of document.facts) {
    // The effective version: the only one until corrections arrive (decision 11).
    if (fact.kind === 'Plan') plan = fact.versions[fact.versions.length - 1]!.value;
    else if (fact.kind === 'PlannedLeg') legs.push({ factId: fact.factId, ...fact.versions[fact.versions.length - 1]!.value });
    else if (fact.kind === 'Stop') stops.push({ factId: fact.factId, ...fact.versions[fact.versions.length - 1]!.value });
    else targets.push({ factId: fact.factId, ...fact.versions[fact.versions.length - 1]!.value });
  }
  return {
    tradeId: document.tradeId,
    factRevision: document.factRevision,
    storedLifecycle: document.lifecycle,
    plan: { ...plan!, legs, stops, targets },
    positionChanges: [],
  };
}

// Trade Analysis's verdict on the exact candidate: the coordinator supplies expected state and
// Trade Record never sets lifecycle on its own.
export interface DerivedTradeReconciliation {
  readonly candidateDigest: string;
  readonly expectedLifecycle: LifecycleState;
}

export type TradeRecordApplyResult =
  | { readonly kind: 'ReconciliationMismatch' }
  | {
      readonly kind: 'Staged';
      // Candidate references mapped to the durable identities assigned at apply.
      readonly mapping: Readonly<Record<string, string>>;
      // The projection that becomes current if the surrounding transaction commits.
      readonly projection: TradeAnalysisRecord;
    };

export interface TradeSummary {
  readonly tradeId: string;
  readonly accountId: string;
  readonly strategyId: string;
  readonly underlying: string;
  readonly lifecycle: LifecycleState;
  readonly planTime: string;
}

export type GetTradeRecordRequest = { readonly tradeId: string; readonly projection: 'Summary' | 'AnalysisInput' };

export type GetTradeRecordResult =
  | { readonly kind: 'Found'; readonly factRevision: number; readonly projection: TradeSummary | TradeAnalysisRecord }
  | { readonly kind: 'NotFound' };

export function summaryOf(document: TradeDocument): TradeSummary {
  return {
    tradeId: document.tradeId,
    accountId: document.accountId,
    strategyId: document.strategyId,
    underlying: document.underlying,
    lifecycle: document.lifecycle,
    planTime: document.planTime,
  };
}

export interface TradeRecordQuery {
  // CurrentState membership from the authoritative lifecycle index.
  readonly lifecycle: LifecycleState;
  // Browse returns each Trade's Summary with its AnalysisInput, for lists that need both.
  readonly projection: 'Summary' | 'AnalysisInput' | 'Browse';
  readonly pageSize?: number;
  readonly cursor?: string;
}

export type TradeRecordPage =
  | {
      readonly kind: 'Page';
      readonly items: readonly (TradeSummary | TradeAnalysisRecord | BrowseRecord)[];
      // The single snapshot the whole page was read from.
      readonly binding: WorkspaceSnapshotBinding;
      readonly nextCursor?: string;
    }
  // A cursor is bound to its normalized query and snapshot; any commit expires it.
  | { readonly kind: 'CursorExpired' };

export interface BrowseRecord {
  readonly summary: TradeSummary;
  readonly analysis: TradeAnalysisRecord;
}

interface TradeCursor {
  readonly databaseName: string;
  readonly contentRevision: number;
  readonly lifecycle: LifecycleState;
  readonly offset: number;
}

export interface TradeRecord {
  // Builds the candidate record without writing or reserving any durable identity.
  prepareChange(change: ConfirmPlanChange): Promise<PrepareTradeChangeResult>;
  applyPreparedChange(
    tx: SemanticTransaction,
    prepared: Extract<PrepareTradeChangeResult, { kind: 'Prepared' }>,
    reconciliation: DerivedTradeReconciliation,
  ): TradeRecordApplyResult;
  // One projection read from a single snapshot at its FactRevision.
  getRecord(request: GetTradeRecordRequest): Promise<GetTradeRecordResult>;
  queryRecords(query: TradeRecordQuery): Promise<TradeRecordPage>;
}

export function createTradeRecord(deps: TradeRecordDeps): TradeRecord {
  return {
    async queryRecords(query) {
      const { value, binding } = await deps.persistence.readSnapshot(['trades'], (tx) =>
        tx.getAllFromIndex('trades', 'byLifecycle', IDBKeyRange.bound([query.lifecycle], [query.lifecycle, []])),
      );
      const documents = (value as unknown as TradeDocument[]).sort((a, b) =>
        a.planTime !== b.planTime ? (a.planTime < b.planTime ? 1 : -1) : a.tradeId < b.tradeId ? -1 : a.tradeId > b.tradeId ? 1 : 0,
      );
      const cursor = query.cursor ? (JSON.parse(query.cursor) as TradeCursor) : undefined;
      if (
        cursor &&
        (cursor.databaseName !== binding.databaseName ||
          cursor.contentRevision !== binding.contentRevision ||
          cursor.lifecycle !== query.lifecycle)
      ) {
        return { kind: 'CursorExpired' };
      }
      const start = cursor?.offset ?? 0;
      const end = start + (query.pageSize ?? 50);
      // One batch from one snapshot: no per-Trade loads.
      const page = documents.slice(start, end);
      const items =
        query.projection === 'Summary'
          ? page.map(summaryOf)
          : query.projection === 'AnalysisInput'
            ? page.map(analysisInputOf)
            : page.map((d) => ({ summary: summaryOf(d), analysis: analysisInputOf(d) }));
      if (end >= documents.length) return { kind: 'Page', items, binding };
      const next: TradeCursor = { ...binding, lifecycle: query.lifecycle, offset: end };
      return { kind: 'Page', items, binding, nextCursor: JSON.stringify(next) };
    },

    async getRecord(request) {
      const { value } = await deps.persistence.readSnapshot(['trades'], (tx) => tx.get('trades', request.tradeId));
      if (!value) return { kind: 'NotFound' };
      const document = value as unknown as TradeDocument;
      return {
        kind: 'Found',
        factRevision: document.factRevision,
        projection: request.projection === 'Summary' ? summaryOf(document) : analysisInputOf(document),
      };
    },

    applyPreparedChange(tx, prepared, reconciliation) {
      requireOpen(tx);
      if (reconciliation.candidateDigest !== prepared.digest || reconciliation.expectedLifecycle !== prepared.candidate.lifecycle) {
        return { kind: 'ReconciliationMismatch' };
      }
      // Durable identities are assigned only here, never in prepare (D1 A11).
      const mapping: Record<string, string> = { [prepared.candidate.tradeId]: deps.ids.next() };
      for (const fact of prepared.candidate.facts) mapping[fact.factId] = deps.ids.next();
      const document: TradeDocument = {
        ...prepared.candidate,
        tradeId: mapping[prepared.candidate.tradeId]!,
        facts: prepared.candidate.facts.map((fact) => ({ ...fact, factId: mapping[fact.factId]! })),
      };
      // The stored lifecycle field places the Trade in the lifecycle index in the same commit.
      tx.stage({ op: 'add', store: 'trades', value: { ...document } });
      return { kind: 'Staged', mapping, projection: analysisInputOf(document) };
    },

    async prepareChange(change) {
      const { legs, stops, targets, ...plan } = change.plan;
      // A confirmed Plan owns one or more Planned Legs.
      if (legs.length === 0) return { kind: 'IncoherentChange', reason: 'NoPlannedLeg' };
      const submitted: TradeFact[] = [
        { factId: 'candidate:plan', kind: 'Plan', recordedSequence: 0, versions: [{ versionNumber: 1, value: plan }] },
        ...legs.map((value, i): TradeFact => ({ factId: `candidate:leg-${i + 1}`, kind: 'PlannedLeg', recordedSequence: 0, versions: [{ versionNumber: 1, value }] })),
        ...stops.map((value, i): TradeFact => ({ factId: `candidate:stop-${i + 1}`, kind: 'Stop', recordedSequence: 0, versions: [{ versionNumber: 1, value }] })),
        ...targets.map((value, i): TradeFact => ({ factId: `candidate:target-${i + 1}`, kind: 'Target', recordedSequence: 0, versions: [{ versionNumber: 1, value }] })),
      ];
      // All Plan facts share the confirmation Economic Time; Recorded Sequence breaks the tie in
      // submitted order.
      const facts: TradeFact[] = submitted.map((fact, i) => ({ ...fact, recordedSequence: i + 1 }));
      const candidate: TradeDocument = {
        tradeId: 'candidate:trade',
        accountId: change.accountId,
        strategyId: change.strategyId,
        lifecycle: 'Planned',
        planTime: plan.economicTime,
        underlying: plan.underlying,
        factRevision: 1,
        facts,
      };
      return {
        kind: 'Prepared',
        before: null,
        candidate,
        analysisInput: analysisInputOf(candidate),
        digest: await sha256Hex(canonicalJson(candidate)),
      };
    },
  };
}
