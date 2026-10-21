import type { RecordSource } from '../../persistence/index.ts';

export type JournalSectionIssue =
  | { readonly code: 'MissingDefinitionRevision'; readonly id: string; readonly definitionId: string }
  | { readonly code: 'DuplicateObligationOutcome'; readonly obligationKey: string; readonly ids: readonly [string, string] }
  | { readonly code: 'MissingAnchor'; readonly id: string };

export interface JournalSectionValidation {
  readonly issues: readonly JournalSectionIssue[];
  // The Journal has no repairable disagreement in D2.
  readonly repairs: readonly never[];
  // The Trades that Entries and declines anchor to, for Workspace to close against the Trade section.
  readonly references: { readonly anchorTradeIds: ReadonlySet<string> };
}

// The fields a section validator reads from a stored Entry or decline: an Entry names its
// definition revision in each version, a decline names the revision it was shown.
interface StoredOutcome {
  readonly id: string;
  readonly obligationKey: string;
  readonly anchor?: { readonly kind: 'Trade'; readonly tradeId?: string };
  readonly versions?: readonly { readonly definitionId: string }[];
  readonly definitionId?: string;
}

// Validates the Journal section batch by batch, keeping only identity sets between batches (D8
// A140): every Entry and decline names a retained definition revision and exactly one Trade
// Anchor, and every obligation has at most one outcome. Uniqueness is judged from the Entries and
// declines themselves, never from the private obligation index.
export async function validateSection(source: RecordSource): Promise<JournalSectionValidation> {
  const definitionIds = new Set<string>();
  for await (const batch of source.batches('journalDefinitions')) {
    for (const definition of batch) definitionIds.add(definition['id'] as string);
  }
  const issues: JournalSectionIssue[] = [];
  const anchorTradeIds = new Set<string>();
  // The first outcome seen for each obligation key.
  const outcomes = new Map<string, string>();
  for (const store of ['journalEntries', 'journalDeclines'] as const) {
    for await (const batch of source.batches(store)) {
      for (const outcome of batch as unknown as readonly StoredOutcome[]) {
        const revisions = outcome.versions?.map((v) => v.definitionId) ?? [outcome.definitionId ?? ''];
        for (const definitionId of new Set(revisions)) {
          if (!definitionIds.has(definitionId)) issues.push({ code: 'MissingDefinitionRevision', id: outcome.id, definitionId });
        }
        const tradeId = outcome.anchor?.tradeId;
        if (tradeId === undefined) issues.push({ code: 'MissingAnchor', id: outcome.id });
        else anchorTradeIds.add(tradeId);
        const first = outcomes.get(outcome.obligationKey);
        if (first === undefined) outcomes.set(outcome.obligationKey, outcome.id);
        else issues.push({ code: 'DuplicateObligationOutcome', obligationKey: outcome.obligationKey, ids: [first, outcome.id] });
      }
    }
  }
  return { issues, repairs: [], references: { anchorTradeIds } };
}
