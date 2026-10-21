import type { RecordSource } from '../../persistence/index.ts';
import type { CatalogSeedManifest } from './manifest.ts';
import type { CatalogRecord } from './records.ts';

export type CatalogSectionIssue =
  | { readonly code: 'DuplicateIdentity'; readonly id: string }
  | { readonly code: 'MissingParent'; readonly id: string; readonly parentId: string }
  | { readonly code: 'UnknownSeedKey'; readonly id: string; readonly productKey: string };

export interface CatalogSectionValidation {
  readonly issues: readonly CatalogSectionIssue[];
  // The Catalog has no repairable disagreement in D2.
  readonly repairs: readonly never[];
  // The identities other sections' references are closed against, for Workspace to pass on.
  readonly references: { readonly accountIds: ReadonlySet<string> };
}

// Validates the Catalog section batch by batch, keeping only identity sets between batches (D8
// A140): identities are unique, every Account's Institution is present, and every seeded record
// carries a product key this release's manifest knows.
export async function validateSection(source: RecordSource, manifest: CatalogSeedManifest): Promise<CatalogSectionValidation> {
  const knownKeys = new Set(manifest.strategies.map((s) => s.productKey));
  const ids = new Set<string>();
  const institutionIds = new Set<string>();
  const accountIds = new Set<string>();
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
      if (record.kind === 'Strategy' && !knownKeys.has(record.productKey)) {
        issues.push({ code: 'UnknownSeedKey', id: record.id, productKey: record.productKey });
      }
    }
  }
  for (const [id, parentId] of parents) {
    if (!institutionIds.has(parentId)) issues.push({ code: 'MissingParent', id, parentId });
  }
  return { issues, repairs: [], references: { accountIds } };
}
