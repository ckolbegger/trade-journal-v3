import { sha256Hex } from '../../delivery/inventory.ts';
import { derive, type DeviationAction, type IncoherentFacts, type IntegrityFinding, type LifecycleState } from '../../domain/trade-analysis/index.ts';
import type { RecordSource } from '../../persistence/index.ts';
import { canonicalJson } from './canonical.ts';
import { analysisInputOf } from './trade-record.ts';
import type { TradeDocument } from './records.ts';

// The other sections' identities a Trade's references are closed against. Workspace builds them
// from the Catalog and Journal validators' results; fact modules never call each other.
export interface TradeSectionReferences {
  readonly accountIds: ReadonlySet<string>;
  readonly anchorTradeIds: ReadonlySet<string>;
}

export type TradeSectionIssue =
  | { readonly code: 'UnknownAccount'; readonly tradeId: string; readonly accountId: string }
  | { readonly code: 'DuplicateFactIdentity'; readonly tradeId: string; readonly factId: string }
  | { readonly code: 'UnknownAnchorTrade'; readonly tradeId: string }
  | { readonly code: 'IncoherentFacts'; readonly tradeId: string; readonly findings: IncoherentFacts['findings'] };

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
      for (const { factId } of document.facts) {
        if (factIds.has(factId)) issues.push({ code: 'DuplicateFactIdentity', tradeId, factId });
        factIds.add(factId);
      }
      const verdict = await agreementOf(document);
      if (verdict?.code === 'IncoherentFacts') issues.push(verdict);
      else if (verdict) repairs.push(verdict);
    }
  }
  for (const tradeId of references.anchorTradeIds) {
    if (!tradeIds.has(tradeId)) issues.push({ code: 'UnknownAnchorTrade', tradeId });
  }
  return { issues, repairs };
}

// Trade Analysis judges the stored lifecycle and recorded Deviations against the Trade's own facts
// (P7): a disagreement with coherent facts is a repair, facts that cannot be replayed an issue.
// The Trade is derived as a candidate of itself, so the reconciliation names the Deviation actions
// that bring its recorded occurrences to the expected ones.
async function agreementOf(document: TradeDocument): Promise<TradeSectionRepair | Extract<TradeSectionIssue, { code: 'IncoherentFacts' }> | undefined> {
  const record = analysisInputOf(document);
  const derived = derive({ record, candidate: { digest: await sha256Hex(canonicalJson(document)), before: record } });
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
