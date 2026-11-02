import type { RecordSource } from '../../persistence/index.ts';
import type { CatalogSeedManifest } from './manifest.ts';
import { normalizeLabel, type CatalogRecord } from './records.ts';

export type CatalogSectionIssue =
  | { readonly code: 'DuplicateIdentity'; readonly id: string }
  | { readonly code: 'MissingParent'; readonly id: string; readonly parentId: string }
  | { readonly code: 'UnknownSeedKey'; readonly id: string; readonly productKey: string }
  // Seeded Close Reasons stay selectable (SeededValuesRemainSelectable), so an inactive one is a finding.
  | { readonly code: 'SeededRecordInactive'; readonly id: string; readonly productKey: string }
  // Close Reason labels are unique within their family; `otherId` is the earlier record in stored order.
  | { readonly code: 'LabelNotDistinguishable'; readonly id: string; readonly otherId: string };

export interface CatalogSectionValidation {
  readonly issues: readonly CatalogSectionIssue[];
  // The Catalog has no repairable disagreement in D2.
  readonly repairs: readonly never[];
  // The identities other sections' references are closed against, for Workspace to pass on.
  readonly references: { readonly accountIds: ReadonlySet<string>; readonly closeReasonIds: ReadonlySet<string> };
}

// Validates the Catalog section batch by batch, keeping only identity sets between batches (D8
// A140): identities are unique, every Account's Institution is present, and every seeded record
// carries a product key this release's manifest knows.
export async function validateSection(source: RecordSource, manifest: CatalogSeedManifest): Promise<CatalogSectionValidation> {
  // One key set per kind: a record's key must come from its own family's manifest list.
  const knownKeys = {
    Strategy: new Set(manifest.strategies.map((s) => s.productKey)),
    CloseReason: new Set((manifest.closeReasons ?? []).map((s) => s.productKey)),
  };
  const ids = new Set<string>();
  const institutionIds = new Set<string>();
  const accountIds = new Set<string>();
  const closeReasonIds = new Set<string>();
  // Each Close Reason's identity by normalized label, to judge that labels stay distinguishable.
  const closeReasonLabels = new Map<string, string>();
  // Each Account's parent, judged once every Institution has been seen.
  const parents = new Map<string, string>();
  const issues: CatalogSectionIssue[] = [];
  for await (const batch of source.batches('catalog')) {
    for (const record of batch as unknown as readonly CatalogRecord[]) {
      if (ids.has(record.id)) issues.push({ code: 'DuplicateIdentity', id: record.id });
      ids.add(record.id);
      if (record.kind === 'Institution') institutionIds.add(record.id);
      if (record.kind === 'Account') {
        accountIds.add(record.id);
        parents.set(record.id, record.institutionId);
      }
      if ((record.kind === 'Strategy' || record.kind === 'CloseReason') && !knownKeys[record.kind].has(record.productKey)) {
        issues.push({ code: 'UnknownSeedKey', id: record.id, productKey: record.productKey });
      }
      if (record.kind === 'CloseReason') {
        closeReasonIds.add(record.id);
        if (record.origin === 'Seeded' && !record.active) {
          issues.push({ code: 'SeededRecordInactive', id: record.id, productKey: record.productKey });
        }
        const label = normalizeLabel(record.label);
        const other = closeReasonLabels.get(label);
        if (other !== undefined) issues.push({ code: 'LabelNotDistinguishable', id: record.id, otherId: other });
        else closeReasonLabels.set(label, record.id);
      }
    }
  }
  for (const [id, parentId] of parents) {
    if (!institutionIds.has(parentId)) issues.push({ code: 'MissingParent', id, parentId });
  }
  return { issues, repairs: [], references: { accountIds, closeReasonIds } };
}
