import { sha256Hex } from '../../delivery/inventory.ts';
import { exerciseIntentApplies, matchesShape, type StrategyShape } from '../../domain/strategy/index.ts';
import { derive, type DerivationResult, type TradeAnalysisRecord, type DerivedTradeState, type DeviationAction, type IncoherentFacts, type IntegrityFinding, type LifecycleState } from '../../domain/trade-analysis/index.ts';
import type { RecordSource } from '../../persistence/index.ts';
import { canonicalJson } from './canonical.ts';
import { analysisInputOf } from './trade-record.ts';
import type { TradeDocument } from './records.ts';

// The other sections' identities a Trade's references are closed against. Workspace builds them
// from the Catalog and Journal validators' results; fact modules never call each other.
export interface TradeSectionReferences {
  readonly accountIds: ReadonlySet<string>;
  readonly anchorTradeIds: ReadonlySet<string>;
  readonly closeReasonIds: ReadonlySet<string>;
  // Every Catalog Strategy's shape by identity, active or not. A Trade naming a Strategy absent here is not reported.
  readonly strategyShapes: ReadonlyMap<string, StrategyShape>;
}

export type TradeSectionIssue =
  | { readonly code: 'UnknownAccount'; readonly tradeId: string; readonly accountId: string }
  | { readonly code: 'DuplicateFactIdentity'; readonly tradeId: string; readonly factId: string }
  | { readonly code: 'UnknownAnchorTrade'; readonly tradeId: string }
  // A Close Reason fact names a Position Change that is not the Closed Trade's terminal one (D6 A85).
  | { readonly code: 'CloseReasonOnNonTerminalChange'; readonly tradeId: string; readonly factId: string; readonly positionChangeId: string }
  | { readonly code: 'MultipleCloseReasons'; readonly tradeId: string; readonly factIds: readonly string[] }
  // A Trade whose facts leave it Closed has Executions, so its terminal change needs a Close Reason.
  | { readonly code: 'MissingCloseReason'; readonly tradeId: string }
  | { readonly code: 'UnknownCloseReason'; readonly tradeId: string; readonly factId: string; readonly closeReasonId: string }
  | { readonly code: 'IncoherentFacts'; readonly tradeId: string; readonly findings: IncoherentFacts['findings'] }
  // A Trade that closed by expiration owes no Close Reason (A107); `factId` names the Close Reason fact it carries.
  | { readonly code: 'CloseReasonNotApplicable'; readonly tradeId: string; readonly factId: string }
  | { readonly code: 'ExpirationHasPriceOrFee'; readonly tradeId: string; readonly factId: string }
  // A stored Plan's legs don't fill its Strategy's roles; the Catalog's StrategyShapeMismatch is another section's code.
  | { readonly code: 'PlanShapeMismatch'; readonly tradeId: string }
  | { readonly code: 'ExerciseIntentRequired' | 'ExerciseIntentNotApplicable'; readonly tradeId: string };

// Stored lifecycle or recorded Deviations that disagree with coherent facts (P7): each finding
// carries the stored and expected values, and the expected lifecycle and Deviation actions are
// what applying the repair writes.
export interface TradeSectionRepair {
  readonly code: 'StoredStateDisagreement';
  readonly tradeId: string;
  readonly findings: readonly IntegrityFinding[];
  readonly expectedLifecycle: LifecycleState;
  readonly deviationActions: readonly DeviationAction[];
}

export interface TradeSectionValidation {
  readonly issues: readonly TradeSectionIssue[];
  readonly repairs: readonly TradeSectionRepair[];
}

// Validates the Trade section batch by batch, keeping only identity sets between batches (D8 A140):
// every Trade's Account exists, every fact identity is used once, and every Journal Anchor names a
// Trade in this section.
export async function validateSection(source: RecordSource, references: TradeSectionReferences): Promise<TradeSectionValidation> {
  const issues: TradeSectionIssue[] = [];
  const repairs: TradeSectionRepair[] = [];
  const tradeIds = new Set<string>();
  const factIds = new Set<string>();
  for await (const batch of source.batches('trades')) {
    for (const document of batch as unknown as readonly TradeDocument[]) {
      const { tradeId } = document;
      tradeIds.add(tradeId);
      if (!references.accountIds.has(document.accountId)) issues.push({ code: 'UnknownAccount', tradeId, accountId: document.accountId });
      // A Close Reason is a Trade fact identity too (D6 A85).
      for (const { factId } of [...document.facts, ...(document.closeReasonFacts ?? [])]) {
        if (factIds.has(factId)) issues.push({ code: 'DuplicateFactIdentity', tradeId, factId });
        factIds.add(factId);
      }
      const record = analysisInputOf(document);
      const derived = derive({ record, candidate: { digest: await sha256Hex(canonicalJson(document)), before: record } });
      const verdict = agreementOf(document, derived);
      if (verdict?.code === 'IncoherentFacts') issues.push(verdict);
      else if (verdict) repairs.push(verdict);
      issues.push(...expirationFactIssuesOf(document), ...planIssuesOf(document, record, references.strategyShapes));
      // Facts that cannot be replayed have no terminal Position Change to judge Close Reasons against.
      if (derived.kind === 'Derived') issues.push(...closeReasonIssuesOf(document, derived, references.closeReasonIds));
    }
  }
  for (const tradeId of references.anchorTradeIds) {
    if (!tradeIds.has(tradeId)) issues.push({ code: 'UnknownAnchorTrade', tradeId });
  }
  return { issues, repairs };
}

// An Expiration records no price and no fee (A106); a stored one that does is hand-edited.
function expirationFactIssuesOf(document: TradeDocument): TradeSectionIssue[] {
  return document.facts.flatMap((fact) => {
    if (fact.kind !== 'Expiration') return [];
    const value: object = fact.versions.at(-1)!.value;
    return 'price' in value || 'fee' in value ? [{ code: 'ExpirationHasPriceOrFee' as const, tradeId: document.tradeId, factId: fact.factId }] : [];
  });
}

// A stored Plan is checked only for its shape and its Exercise Intent against its Strategy's shape,
// so a later Plan rule can't block migration or Restore of existing history (decision 88). A Trade
// whose Strategy the Catalog doesn't hold is skipped, and a Plan that doesn't fill the roles is
// reported for that alone.
function planIssuesOf(document: TradeDocument, record: TradeAnalysisRecord, shapes: ReadonlyMap<string, StrategyShape>): TradeSectionIssue[] {
  const { tradeId } = document;
  const shape = shapes.get(document.strategyId);
  if (shape === undefined) return [];
  if (!matchesShape(record.plan.legs, shape)) return [{ code: 'PlanShapeMismatch', tradeId }];
  const recorded = record.plan.exerciseIntent !== undefined;
  if (exerciseIntentApplies(shape) && !recorded) return [{ code: 'ExerciseIntentRequired', tradeId }];
  if (!exerciseIntentApplies(shape) && recorded) return [{ code: 'ExerciseIntentNotApplicable', tradeId }];
  return [];
}

// A Closed Trade's Close Reason must agree with its facts (D6 A85): exactly one fact, naming the
// terminal Position Change (the last in Fact Order of the replayed facts, which Trade Analysis
// derives) and a Catalog identity that exists. Lifecycle and `terminalTime` agreement belong to
// the stored-state repairs and the private index (A96), not here.
function closeReasonIssuesOf(document: TradeDocument, derived: DerivedTradeState, closeReasonIds: ReadonlySet<string>): TradeSectionIssue[] {
  const { tradeId } = document;
  const facts = document.closeReasonFacts ?? [];
  const closed = derived.expectedLifecycle === 'Closed';
  // An Expiration must settle everything open, so a Trade that closed with one ended on it (A106, A107):
  // it owes no Close Reason and any it carries is reported.
  if (closed && derived.terminalDisposition.kind === 'Value' && derived.terminalDisposition.value.some((m) => m.mechanism === 'Expiration')) {
    return facts.map(({ factId }) => ({ code: 'CloseReasonNotApplicable', tradeId, factId }));
  }
  const terminalId = closed ? derived.facts.at(-1)?.positionChangeId : undefined;
  const issues: TradeSectionIssue[] = [];
  for (const { factId, versions } of facts) {
    const { closeReasonId, terminalPositionChangeId } = versions.at(-1)!.value;
    if (terminalPositionChangeId !== terminalId) issues.push({ code: 'CloseReasonOnNonTerminalChange', tradeId, factId, positionChangeId: terminalPositionChangeId });
    if (!closeReasonIds.has(closeReasonId)) issues.push({ code: 'UnknownCloseReason', tradeId, factId, closeReasonId });
  }
  if (facts.length > 1) issues.push({ code: 'MultipleCloseReasons', tradeId, factIds: facts.map((f) => f.factId) });
  if (facts.length === 0 && terminalId !== undefined) issues.push({ code: 'MissingCloseReason', tradeId });
  return issues;
}

// Trade Analysis judges the stored lifecycle and recorded Deviations against the Trade's own facts
// (P7): a disagreement with coherent facts is a repair, facts that cannot be replayed an issue.
// The Trade is derived as a candidate of itself, so the reconciliation names the Deviation actions
// that bring its recorded occurrences to the expected ones.
function agreementOf(document: TradeDocument, derived: DerivationResult): TradeSectionRepair | Extract<TradeSectionIssue, { code: 'IncoherentFacts' }> | undefined {
  if (derived.kind === 'IncoherentFacts') return { code: 'IncoherentFacts', tradeId: document.tradeId, findings: derived.findings };
  if (derived.findings.length === 0) return undefined;
  return {
    code: 'StoredStateDisagreement',
    tradeId: document.tradeId,
    findings: derived.findings,
    expectedLifecycle: derived.expectedLifecycle,
    deviationActions: derived.reconciliation!.deviationActions,
  };
}
