import type { RecordSource } from '../../persistence/index.ts';

export type JournalSectionIssue =
  | { readonly code: 'MissingDefinitionRevision'; readonly id: string; readonly definitionId: string }
  | { readonly code: 'DuplicateObligationOutcome'; readonly obligationKey: string; readonly ids: readonly [string, string] }
  | { readonly code: 'MissingAnchor'; readonly id: string }
  | { readonly code: 'EditDefinitionChanged'; readonly id: string; readonly versionNumber: number }
  // A Settled or Declined version that names no Entry or decline, or one that is absent.
  | { readonly code: 'DebtResolutionMissing'; readonly debtId: string; readonly versionId: string; readonly status: 'Settled' | 'Declined' }
  | { readonly code: 'DebtVersionAfterResolution'; readonly debtId: string; readonly versionId: string }
  | { readonly code: 'DebtEntryDefinitionChanged'; readonly debtId: string; readonly entryId: string }
  // `id` is the Entry or decline on the other side of a settlement link that does not point back.
  | { readonly code: 'DebtLinkNotReciprocated'; readonly debtId: string; readonly id: string }
  // `id` is the Entry or decline that settled the Debt but answers a different obligation key.
  | { readonly code: 'DebtObligationMismatch'; readonly debtId: string; readonly id: string };

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
  // A Daily Trade Review key is the array ['DailyTradeReview', reviewDate, tradeId] (D4 A38).
  readonly obligationKey: string | readonly string[];
  readonly anchor?: { readonly kind: 'Trade'; readonly tradeId?: string };
  readonly versions?: readonly { readonly versionNumber: number; readonly definitionId: string }[];
  readonly definitionId?: string;
  readonly settledDebtId?: string;
}

// What the Debt checks keep of an Entry or decline between batches.
interface SettlementLink {
  readonly id: string;
  readonly settledDebtId: string | undefined;
  readonly definitionId: string;
  readonly obligationKey: string;
}

// The authoritative fields a section validator reads from a stored Debt (D5 A61); the private
// `outstandingDue` and `anchorTradeId` are never judged.
interface StoredDebt {
  readonly debtId: string;
  readonly obligationKey: string;
  readonly definitionId: string;
  readonly anchor: { readonly kind: 'Trade'; readonly tradeId: string };
  readonly versions: readonly {
    readonly versionId: string;
    readonly status: 'Outstanding' | 'Settled' | 'Declined';
    readonly entryId?: string;
    readonly declineId?: string;
  }[];
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
  const links = { journalEntries: new Map<string, SettlementLink>(), journalDeclines: new Map<string, SettlementLink>() };
  for (const store of ['journalEntries', 'journalDeclines'] as const) {
    for await (const batch of source.batches(store)) {
      for (const outcome of batch as unknown as readonly StoredOutcome[]) {
        const obligationKey = typeof outcome.obligationKey === 'string' ? outcome.obligationKey : outcome.obligationKey.join(':');
        links[store].set(outcome.id, { id: outcome.id, settledDebtId: outcome.settledDebtId, definitionId: outcome.versions?.[0]?.definitionId ?? outcome.definitionId ?? '', obligationKey });
        const revisions = outcome.versions?.map((v) => v.definitionId) ?? [outcome.definitionId ?? ''];
        for (const definitionId of new Set(revisions)) {
          if (!definitionIds.has(definitionId)) issues.push({ code: 'MissingDefinitionRevision', id: outcome.id, definitionId });
        }
        // An edit keeps the Entry's original definition snapshot.
        const [firstVersion, ...edits] = outcome.versions ?? [];
        for (const version of edits) {
          if (version.definitionId !== firstVersion!.definitionId) issues.push({ code: 'EditDefinitionChanged', id: outcome.id, versionNumber: version.versionNumber });
        }
        const tradeId = outcome.anchor?.tradeId;
        if (tradeId === undefined) issues.push({ code: 'MissingAnchor', id: outcome.id });
        else anchorTradeIds.add(tradeId);
        const first = outcomes.get(obligationKey);
        if (first === undefined) outcomes.set(obligationKey, outcome.id);
        else issues.push({ code: 'DuplicateObligationOutcome', obligationKey, ids: [first, outcome.id] });
      }
    }
  }
  // Every version naming each Entry or decline, to check that settlement links point back.
  const named = new Set<string>();
  for await (const batch of source.batches('journalDebts')) {
    for (const debt of batch as unknown as readonly StoredDebt[]) {
      const anchorTradeId = (debt.anchor as Partial<StoredDebt['anchor']> | undefined)?.tradeId;
      if (anchorTradeId === undefined) issues.push({ code: 'MissingAnchor', id: debt.debtId });
      else anchorTradeIds.add(anchorTradeId);
      if (!definitionIds.has(debt.definitionId)) issues.push({ code: 'MissingDefinitionRevision', id: debt.debtId, definitionId: debt.definitionId });
      let resolved = false;
      for (const version of debt.versions) {
        if (resolved) issues.push({ code: 'DebtVersionAfterResolution', debtId: debt.debtId, versionId: version.versionId });
        if (version.status === 'Outstanding') continue;
        resolved = true;
        const [store, id] = version.status === 'Settled' ? (['journalEntries', version.entryId] as const) : (['journalDeclines', version.declineId] as const);
        const link = id === undefined ? undefined : links[store].get(id);
        if (link === undefined) {
          issues.push({ code: 'DebtResolutionMissing', debtId: debt.debtId, versionId: version.versionId, status: version.status });
          continue;
        }
        named.add(`${debt.debtId}|${link.id}`);
        if (link.settledDebtId !== debt.debtId) issues.push({ code: 'DebtLinkNotReciprocated', debtId: debt.debtId, id: link.id });
        else if (link.obligationKey !== debt.obligationKey) issues.push({ code: 'DebtObligationMismatch', debtId: debt.debtId, id: link.id });
        else if (store === 'journalEntries' && link.definitionId !== debt.definitionId) issues.push({ code: 'DebtEntryDefinitionChanged', debtId: debt.debtId, entryId: link.id });
      }
      // A Debt still Outstanding is a current outcome of its obligation; a resolved one is replaced by its Entry or decline.
      if (!resolved) {
        const first = outcomes.get(debt.obligationKey);
        if (first === undefined) outcomes.set(debt.obligationKey, debt.debtId);
        else issues.push({ code: 'DuplicateObligationOutcome', obligationKey: debt.obligationKey, ids: [first, debt.debtId] });
      }
    }
  }
  // The other direction: an Entry or decline that names a Debt no version of which names it back.
  for (const store of ['journalEntries', 'journalDeclines'] as const) {
    for (const link of links[store].values()) {
      if (link.settledDebtId !== undefined && !named.has(`${link.settledDebtId}|${link.id}`)) {
        issues.push({ code: 'DebtLinkNotReciprocated', debtId: link.settledDebtId, id: link.id });
      }
    }
  }
  return { issues, repairs: [], references: { anchorTradeIds } };
}
