import { Temporal } from 'temporal-polyfill';
import { sha256Hex } from '../../delivery/inventory.ts';
import type {
  ConditionInput,
  DerivedTradeReconciliation as AnalysisReconciliation,
  DeviationAction,
  DeviationFingerprint,
  ExecutionFact,
  ExpectedDeviation,
  IntegrityFinding,
  RecordedDeviation,
  RecordedDeviationVersion,
  LifecycleState,
  PlannedLegInput,
  TradeAnalysisRecord,
} from '../../domain/trade-analysis/index.ts';
import {
  activityDescOf,
  requireOpen,
  type IdGenerator,
  type Persistence,
  type ReadTransaction,
  type SemanticTransaction,
  type WorkspaceSnapshotBinding,
} from '../../persistence/index.ts';
import { formatDecimal, type Rational } from '../../domain/values/index.ts';
import { canonicalJson } from './canonical.ts';
import type { ConfirmPlanChange, PlanFactValue, PositionChangeChange, PositionChangeFactValue, TradeDocument, TradeFact } from './records.ts';

// A stored decimal string: exact, since quantities carry at most 6 fractional digits (D1 A9).
const decimalText = (value: Rational) => formatDecimal(value, 6).replace(/\.?0+$/, '');

// A stored Trade without the persistence write stamp or private index fields.
function storedDocument(value: Record<string, unknown>): TradeDocument {
  const document = { ...value };
  delete document['revision'];
  delete document['activityDesc'];
  return document as unknown as TradeDocument;
}

const compareInstants = (a: string, b: string) => Temporal.Instant.compare(a, b);

export interface TradeRecordDeps {
  readonly persistence: Persistence;
  readonly ids: IdGenerator;
}

export type PrepareTradeChangeResult =
  | { readonly kind: 'IncoherentChange'; readonly reason: 'NoPlannedLeg' }
  | { readonly kind: 'Conflict'; readonly tradeId: string }
  | { readonly kind: 'NotFound'; readonly tradeId: string }
  | {
  readonly kind: 'Prepared';
  // The record before the change (none for a new Trade) and the candidate after it.
  readonly before: TradeDocument | null;
  readonly candidate: TradeDocument;
  // The AnalysisInput projections of both, for Trade Analysis to reconcile the candidate against.
  readonly beforeAnalysisInput: TradeAnalysisRecord | null;
  readonly analysisInput: TradeAnalysisRecord;
  // Canonical digest of the candidate, rechecked when the prepared change is applied.
  readonly digest: string;
};

// The effective version: the only one until corrections arrive (decision 11).
const effective = <V>(fact: { readonly versions: readonly { readonly value: V }[] }): V => fact.versions[fact.versions.length - 1]!.value;

// The AnalysisInput projection: the complete effective facts Trade Analysis needs.
export function analysisInputOf(document: TradeDocument): TradeAnalysisRecord {
  let plan: PlanFactValue | undefined;
  const legs: (PlannedLegInput & { factId: string })[] = [];
  const stops: (ConditionInput & { factId: string })[] = [];
  const targets: (ConditionInput & { factId: string })[] = [];
  const changes: { factId: string; recordedSequence: number; value: PositionChangeFactValue }[] = [];
  const executions = new Map<string, ExecutionFact>();
  for (const fact of document.facts) {
    const { factId, recordedSequence } = fact;
    if (fact.kind === 'Plan') plan = effective(fact);
    else if (fact.kind === 'PlannedLeg') legs.push({ factId, ...effective(fact) });
    else if (fact.kind === 'Stop') stops.push({ factId, ...effective(fact) });
    else if (fact.kind === 'Target') targets.push({ factId, ...effective(fact) });
    else if (fact.kind === 'PositionChange') changes.push({ factId, recordedSequence, value: effective(fact) });
    else executions.set(factId, { factId, recordedSequence, ...effective(fact) });
  }
  return {
    tradeId: document.tradeId,
    factRevision: document.factRevision,
    storedLifecycle: document.lifecycle,
    plan: { ...plan!, legs, stops, targets },
    positionChanges: changes.map(({ factId, recordedSequence, value }) => ({
      factId,
      economicTime: value.economicTime,
      recordedSequence,
      executions: value.memberIds.map((id) => executions.get(id)!),
    })),
    // Recorded occurrences with their version lists, authoritative here (D2 A26).
    ...(document.deviations && { recordedDeviations: document.deviations }),
  };
}

// Trade Analysis's verdict on the exact candidate: the coordinator supplies expected state and
// Trade Record never sets lifecycle on its own. A Plan confirmation has no recorded occurrences to
// act on, so it may omit the Deviation actions and repairs.
export type DerivedTradeReconciliation = Pick<AnalysisReconciliation, 'candidateDigest' | 'expectedLifecycle'> &
  Partial<Pick<AnalysisReconciliation, 'deviationActions' | 'repairs'>>;

// Whether the Deviation actions account for every recorded occurrence of the before-state exactly
// once and name only this candidate's Trade, Planned Legs, and Position Changes.
function actionsMatch(prepared: Extract<PrepareTradeChangeResult, { kind: 'Prepared' }>, actions: readonly DeviationAction[]): boolean {
  const recorded = new Map((prepared.before?.deviations ?? []).map((d) => [d.occurrenceId, d]));
  const accounted = new Set<string>();
  const factIds = new Set(prepared.candidate.facts.filter((f) => f.kind === 'PositionChange' || f.kind === 'PlannedLeg').map((f) => f.factId));
  const names = (f: DeviationFingerprint) => f.tradeId === prepared.candidate.tradeId && factIds.has(f.plannedLegId) && factIds.has(f.positionChangeId);
  for (const action of actions) {
    if (action.kind === 'Create') {
      if (!names(action.occurrence.fingerprint)) return false;
      continue;
    }
    const occurrence = recorded.get(action.occurrenceId);
    if (!occurrence || accounted.has(action.occurrenceId)) return false;
    accounted.add(action.occurrenceId);
    const fingerprint = action.kind === 'NewVersion' ? action.occurrence.fingerprint : action.fingerprint;
    if (canonicalJson(fingerprint) !== canonicalJson(occurrence.versions.at(-1)!.fingerprint)) return false;
  }
  return accounted.size === recorded.size;
}

// The recorded occurrences after Trade Analysis's Deviation actions (D2 A26): Create appends a new
// occurrence with an identity from `ids`, NewVersion and Supersede append a version, and Retain
// changes nothing. `durable` maps candidate references to the identities assigned at apply.
export function applyDeviationActions(
  recorded: readonly RecordedDeviation[],
  actions: readonly DeviationAction[],
  ids: IdGenerator,
  durable: (id: string) => string = (id) => id,
): RecordedDeviation[] {
  const version = (o: ExpectedDeviation): RecordedDeviationVersion => ({
    fingerprint: { ...o.fingerprint, positionChangeId: durable(o.fingerprint.positionChangeId) },
    type: o.type,
    form: o.form,
    quantityAbovePlan: decimalText(o.quantityAbovePlan),
    causingPositionChangeId: durable(o.causingPositionChangeId),
    economicTime: o.economicTime,
    status: 'Active',
  });
  const deviations = [...recorded];
  const append = (occurrenceId: string, next: (latest: RecordedDeviationVersion) => RecordedDeviationVersion) => {
    const i = deviations.findIndex((d) => d.occurrenceId === occurrenceId);
    const versions = deviations[i]!.versions;
    deviations[i] = { occurrenceId, versions: [...versions, next(versions[versions.length - 1]!)] };
  };
  for (const action of actions) {
    if (action.kind === 'Create') deviations.push({ occurrenceId: ids.next(), versions: [version(action.occurrence)] });
    else if (action.kind === 'NewVersion') append(action.occurrenceId, () => version(action.occurrence));
    else if (action.kind === 'Supersede') append(action.occurrenceId, (latest) => ({ ...latest, status: 'Superseded', reason: action.reason }));
  }
  return deviations;
}

// A stored Trade with a disagreement repaired (P7): the expected lifecycle and the Deviation actions
// that bring its recorded occurrences to the expected ones. Migration and Restore apply it to a
// candidate; its facts are untouched.
export function repairedDocument(
  document: TradeDocument,
  repair: { readonly expectedLifecycle: LifecycleState; readonly deviationActions: readonly DeviationAction[] },
  ids: IdGenerator,
): TradeDocument {
  const deviations = applyDeviationActions(document.deviations ?? [], repair.deviationActions, ids);
  return { ...document, lifecycle: repair.expectedLifecycle, ...(deviations.length > 0 && { deviations }) };
}

export type TradeRecordApplyResult = { readonly kind: 'ReconciliationMismatch' } | Staged;

interface Staged {
  readonly kind: 'Staged';
  // Candidate references mapped to the durable identities assigned at apply.
  readonly mapping: Readonly<Record<string, string>>;
  // The projection that becomes current if the surrounding transaction commits.
  readonly projection: TradeAnalysisRecord;
  // The before-state disagreements this change repairs, exactly as the reconciliation listed them
  // (P7); a Plan confirmation has none.
  readonly repairs?: readonly IntegrityFinding[];
}

export interface TradeSummary {
  readonly tradeId: string;
  readonly accountId: string;
  readonly strategyId: string;
  readonly underlying: string;
  readonly lifecycle: LifecycleState;
  readonly planTime: string;
  // From the first Position Change on (D2 A27).
  readonly lastActivity?: string;
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
    ...(document.lastActivity && { lastActivity: document.lastActivity }),
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
  // A cursor is bound to its normalized query and the Trade section; any Trade commit expires it.
  | { readonly kind: 'CursorExpired' };

export interface BrowseRecord {
  readonly summary: TradeSummary;
  readonly analysis: TradeAnalysisRecord;
}

// A cursor is bound to its query's lifecycle and to the Trade-section revision it was read at.
interface TradeCursor {
  readonly databaseName: string;
  readonly tradeRevision: number;
  readonly lifecycle: LifecycleState;
  // The Open list resumes after the last index key of the previous page; others by position.
  readonly after?: [string, string, string];
  readonly offset?: number;
}

// The benchmarked maximum Open book, shown as one page (D2 A32).
const OPEN_PAGE_SIZE = 200;

// Every Trade commit rewrites this meta record, so the persistence write stamp on it is the
// Trade-section revision: any Trade commit changes it, and no other commit does.
const TRADE_SECTION_KEY = 'tradeRecord';
const touchTradeSection = (tx: SemanticTransaction) => tx.stage({ op: 'put', store: 'meta', value: { key: TRADE_SECTION_KEY } });

async function tradeSectionRevision(tx: ReadTransaction): Promise<number> {
  return ((await tx.get('meta', TRADE_SECTION_KEY)) as { revision: number } | undefined)?.revision ?? 0;
}

export interface TradeRecord {
  // Builds the candidate record without writing or reserving any durable identity.
  prepareChange(change: ConfirmPlanChange | PositionChangeChange): Promise<PrepareTradeChangeResult>;
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
  async function preparePositionChange(change: PositionChangeChange): Promise<PrepareTradeChangeResult> {
    const { value } = await deps.persistence.readSnapshot(['trades'], (tx) => tx.get('trades', change.tradeId));
    if (!value) return { kind: 'NotFound', tradeId: change.tradeId };
    const before = storedDocument(value);
    // The change was composed against a FactRevision that is no longer current.
    if (before.factRevision !== change.expectedFactRevision) return { kind: 'Conflict', tradeId: change.tradeId };
    const memberIds = change.executions.map((_, i) => `candidate:execution-${i + 1}`);
    // Recorded Sequence continues the Trade's counter: the Position Change first, then its members
    // in submitted order (D2 A20).
    const counter = before.recordedSequenceCounter ?? Math.max(...before.facts.map((f) => f.recordedSequence));
    // A Position Change's Economic Time is its earliest member's (D2 A19).
    const economicTime = change.executions.map((e) => e.economicTime).sort(compareInstants)[0]!;
    const added: TradeFact[] = [
      {
        factId: 'candidate:pc-1',
        kind: 'PositionChange',
        recordedSequence: counter + 1,
        versions: [
          {
            versionNumber: 1,
            value: { economicTime, originTradeId: change.tradeId, participatingTradeIds: [change.tradeId], memberIds },
          },
        ],
      },
      ...change.executions.map(
        (value, i): TradeFact => ({ factId: memberIds[i]!, kind: 'Execution', recordedSequence: counter + 2 + i, versions: [{ versionNumber: 1, value }] }),
      ),
    ];
    const candidate: TradeDocument = {
      ...before,
      factRevision: before.factRevision + 1,
      facts: [...before.facts, ...added],
      recordedSequenceCounter: counter + 1 + change.executions.length,
      // Last Activity: the latest Economic Time among the Plan and the Position Changes (D2 A27).
      lastActivity: [before.lastActivity ?? before.planTime, economicTime].sort(compareInstants)[1],
    };
    return {
      kind: 'Prepared',
      before,
      candidate,
      beforeAnalysisInput: analysisInputOf(before),
      analysisInput: analysisInputOf(candidate),
      digest: await sha256Hex(canonicalJson(candidate)),
    };
  }

  // Stages a Position Change on an existing Trade: durable identities for its facts and created
  // occurrences, the expected lifecycle, and every Deviation action, bound to the base FactRevision.
  function stagePositionChange(
    tx: SemanticTransaction,
    before: TradeDocument,
    candidate: TradeDocument,
    { expectedLifecycle, deviationActions = [] }: DerivedTradeReconciliation,
  ): Omit<Staged, 'repairs'> {
    // Durable identities are assigned only here, never in prepare (D1 A11).
    const mapping: Record<string, string> = {};
    for (const fact of candidate.facts.slice(before.facts.length)) mapping[fact.factId] = deps.ids.next();
    const durable = (id: string) => mapping[id] ?? id;
    const facts = candidate.facts.map((fact): TradeFact => {
      if (fact.kind !== 'PositionChange') return { ...fact, factId: durable(fact.factId) };
      return {
        ...fact,
        factId: durable(fact.factId),
        versions: fact.versions.map((v) => ({ ...v, value: { ...v.value, memberIds: v.value.memberIds.map(durable) } })),
      };
    });
    const deviations = applyDeviationActions(before.deviations ?? [], deviationActions, deps.ids, durable);
    const document: TradeDocument = { ...candidate, lifecycle: expectedLifecycle, facts, deviations };
    // Applies only to the FactRevision it was prepared from.
    tx.require({
      name: `trade:${before.tradeId}`,
      store: 'trades',
      key: before.tradeId,
      verify: (current) => current?.['factRevision'] === before.factRevision,
    });
    // The stored lifecycle and the private Last Activity sort key place the Trade in the lifecycle
    // indexes in the same commit.
    tx.stage({ op: 'put', store: 'trades', value: { ...document, activityDesc: activityDescOf(document.lastActivity!) } });
    touchTradeSection(tx);
    return { kind: 'Staged', mapping, projection: analysisInputOf(document) };
  }

  return {
    async queryRecords(query) {
      const cursor = query.cursor ? (JSON.parse(query.cursor) as TradeCursor) : undefined;
      // Open Trades are listed by Last Activity descending, which is the private key's index order,
      // one bounded index read per page resuming after the previous page's last key (D2 A28, A32).
      const byActivity = query.lifecycle === 'Open';
      const pageSize = byActivity ? Math.min(query.pageSize ?? OPEN_PAGE_SIZE, OPEN_PAGE_SIZE) : (query.pageSize ?? 50);
      const all = IDBKeyRange.bound([query.lifecycle], [query.lifecycle, []]);
      const { value, binding } = await deps.persistence.readSnapshot(['trades', 'meta'], async (tx) => ({
        tradeRevision: await tradeSectionRevision(tx),
        documents: (byActivity
          ? // One more than a page shows whether another page follows.
            await tx.getAllFromIndex(
              'trades',
              'byLifecycleActivity',
              cursor?.after ? IDBKeyRange.bound(cursor.after, [query.lifecycle, []], true) : all,
              pageSize + 1,
            )
          : await tx.getAllFromIndex('trades', 'byLifecycle', all)) as unknown as (TradeDocument & { activityDesc?: string })[],
      }));
      const { tradeRevision, documents } = value;
      if (
        cursor &&
        (cursor.databaseName !== binding.databaseName || cursor.tradeRevision !== tradeRevision || cursor.lifecycle !== query.lifecycle)
      ) {
        return { kind: 'CursorExpired' };
      }
      if (!byActivity) {
        documents.sort((a, b) =>
          a.planTime !== b.planTime ? (a.planTime < b.planTime ? 1 : -1) : a.tradeId < b.tradeId ? -1 : a.tradeId > b.tradeId ? 1 : 0,
        );
      }
      const start = byActivity ? 0 : (cursor?.offset ?? 0);
      const end = start + pageSize;
      // One batch from one snapshot: no per-Trade loads.
      const page = documents.slice(start, end);
      const items =
        query.projection === 'Summary'
          ? page.map(summaryOf)
          : query.projection === 'AnalysisInput'
            ? page.map(analysisInputOf)
            : page.map((d) => ({ summary: summaryOf(d), analysis: analysisInputOf(d) }));
      if (end >= documents.length) return { kind: 'Page', items, binding };
      const last = page[page.length - 1]!;
      const next: TradeCursor = {
        databaseName: binding.databaseName,
        tradeRevision,
        lifecycle: query.lifecycle,
        ...(byActivity ? { after: [query.lifecycle, last.activityDesc!, last.tradeId] } : { offset: end }),
      };
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
      // Confirmation creates a Planned Trade; a Position Change of opening Buys leaves exposure, so the
      // Trade it applies to is Open (D2 A18). Trade Analysis must agree.
      const lifecycle: LifecycleState = prepared.before ? 'Open' : 'Planned';
      if (
        reconciliation.candidateDigest !== prepared.digest ||
        reconciliation.expectedLifecycle !== lifecycle ||
        !actionsMatch(prepared, reconciliation.deviationActions ?? [])
      ) {
        return { kind: 'ReconciliationMismatch' };
      }
      if (prepared.before) {
        const staged = stagePositionChange(tx, prepared.before, prepared.candidate, reconciliation);
        // Applying the expected lifecycle and Deviation actions repairs each listed disagreement;
        // the list is returned as given for the receipt to disclose (P7).
        return { ...staged, repairs: reconciliation.repairs ?? [] };
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
      touchTradeSection(tx);
      return { kind: 'Staged', mapping, projection: analysisInputOf(document) };
    },

    async prepareChange(change) {
      if (change.kind === 'PositionChange') return preparePositionChange(change);
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
        beforeAnalysisInput: null,
        analysisInput: analysisInputOf(candidate),
        digest: await sha256Hex(canonicalJson(candidate)),
      };
    },
  };
}
