import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import type { StrategyShape } from '../../domain/strategy.ts';
import type { BindingCheck, IdGenerator, Persistence, StoreRecord } from '../../persistence/index.ts';
import type { CatalogSeedManifest } from './manifest.ts';
import {
  normalizeLabel,
  type CatalogRecord,
  type CatalogSnapshot,
  type AccountRecord,
  type CatalogKind,
  type InstitutionRecord,
  type StrategyRecord,
} from './records.ts';

export interface ReferenceCatalogDeps {
  readonly persistence: Persistence;
  readonly ids: IdGenerator;
}

// Attempts in all when only the shared catalogRevision counter moved between read and commit.
const MAX_ATTEMPTS = 3;

export type SeedCatalogResult =
  | {
      readonly kind: 'Seeded';
      readonly snapshot: CatalogSnapshot;
      readonly additions: readonly string[];
      readonly selectableAccountCount: number;
    }
  | { readonly kind: 'SeedConflict'; readonly productKey: string }
  // catalogRevision kept moving through every attempt; nothing was written.
  | { readonly kind: 'Conflict' }
  | { readonly kind: 'RuntimeNotWritable' };

export type PreparedSeed =
  | { readonly kind: 'Additions'; readonly records: readonly StrategyRecord[] }
  | { readonly kind: 'SeedConflict'; readonly productKey: string };

interface CatalogMeta {
  readonly key: 'catalog';
  readonly catalogRevision: number;
}

export type CatalogSaveCommand =
  | { readonly kind: 'CreateInstitution'; readonly label: string }
  | { readonly kind: 'CreateAccount'; readonly institutionId: string; readonly label: string };

export interface CatalogIssue {
  readonly field: 'label' | 'institutionId';
  readonly code: 'LabelRequired' | 'LabelNotDistinguishable' | 'UnknownReference';
}

export type CatalogSaveResult =
  | { readonly kind: 'Rejected'; readonly issues: readonly CatalogIssue[] }
  // The Catalog changed between reading and committing; nothing was written.
  | { readonly kind: 'Conflict'; readonly snapshot: CatalogSnapshot }
  | {
      readonly kind: 'Saved';
      readonly record: CatalogRecord;
      readonly snapshot: CatalogSnapshot;
      readonly selectableAccountCount: number;
    }
  | RuntimeNotWritable;

export interface CatalogQuery {
  readonly family: CatalogKind;
  readonly pageSize?: number;
  readonly cursor?: string;
}

export type CatalogQueryResult =
  | {
      readonly kind: 'Page';
      readonly items: readonly CatalogRecord[];
      readonly snapshot: CatalogSnapshot;
      readonly nextCursor?: string;
    }
  // A cursor is bound to its normalized query and Catalog snapshot.
  | { readonly kind: 'CursorExpired'; readonly snapshot: CatalogSnapshot };

interface CursorState {
  readonly catalogRevision: number;
  readonly family: CatalogKind;
  readonly offset: number;
}

export interface CatalogRequirement {
  readonly name: string;
  readonly kind: CatalogKind;
  readonly id: string;
  readonly mode: 'NewSelection' | 'DisplayOnly';
}

export interface ResolvedReference {
  readonly id: string;
  readonly kind: CatalogKind;
  readonly label: string;
  readonly recordRevision: number;
  readonly selectable: boolean;
  readonly institution?: { readonly id: string; readonly label: string; readonly recordRevision: number };
  readonly shape?: StrategyShape;
}

export type CatalogResolution =
  | {
      readonly kind: 'Resolved';
      readonly snapshot: CatalogSnapshot;
      readonly resolved: Readonly<Record<string, ResolvedReference>>;
    }
  | {
      readonly kind: 'Unresolved';
      readonly snapshot: CatalogSnapshot;
      readonly issues: readonly { readonly name: string; readonly code: 'UnknownReference' | 'WrongKind' }[];
    };

export interface ReferenceCatalog {
  seedDefaults(manifest: CatalogSeedManifest): Promise<SeedCatalogResult>;
  save(command: CatalogSaveCommand): Promise<CatalogSaveResult>;
  // Selectable records of one family, by normalized label then identity, in snapshot-bound pages.
  query(request: CatalogQuery): Promise<CatalogQueryResult>;
  // Validates bounded typed requirements under one Catalog snapshot.
  resolve(requirements: readonly CatalogRequirement[]): Promise<CatalogResolution>;
}

function selectableAccountCount(records: readonly CatalogRecord[]): number {
  const activeInstitutions = new Set(records.filter((r) => r.kind === 'Institution' && r.active).map((r) => r.id));
  return records.filter((r) => r.kind === 'Account' && r.active && activeInstitutions.has(r.institutionId)).length;
}

// Matches stable product keys only, never labels, and prepares the genuinely missing seeds. A
// known key whose immutable shape differs is a conflict: seeding never changes a shape.
export function prepareSeed(existing: readonly CatalogRecord[], manifest: CatalogSeedManifest, ids: IdGenerator): PreparedSeed {
  const present = new Map(existing.flatMap((r) => (r.kind === 'Strategy' ? [[r.productKey, r] as const] : [])));
  for (const seed of manifest.strategies) {
    const stored = present.get(seed.productKey);
    if (stored && JSON.stringify(stored.shape) !== JSON.stringify(seed.shape)) {
      return { kind: 'SeedConflict', productKey: seed.productKey };
    }
  }
  const records = manifest.strategies
    .filter((seed) => !present.has(seed.productKey))
    .map((seed): StrategyRecord => ({
      id: ids.next(),
      kind: 'Strategy',
      label: seed.label,
      normalizedLabel: normalizeLabel(seed.label),
      active: true,
      origin: 'Seeded',
      recordRevision: 1,
      productKey: seed.productKey,
      shape: seed.shape,
    }));
  return { kind: 'Additions', records };
}

// Rechecked inside the commit: label distinctness was judged against this Catalog revision.
function catalogUnchanged(catalogRevision: number): BindingCheck {
  return {
    name: `catalog@${catalogRevision}`,
    store: 'meta',
    key: 'catalog',
    verify: (current) => ((current?.['catalogRevision'] as number | undefined) ?? 0) === catalogRevision,
  };
}

function displayLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ');
}

// Drops persistence's write stamp so callers see exactly the Catalog record a save returned.
function stripRevision(stored: Record<string, unknown>): CatalogRecord {
  const record = { ...stored };
  delete record['revision'];
  return record as unknown as CatalogRecord;
}

export function createReferenceCatalog(deps: ReferenceCatalogDeps): ReferenceCatalog {
  async function readCatalog() {
    const { value } = await deps.persistence.readSnapshot(['meta', 'catalog'], async (tx) => ({
      meta: (await tx.get('meta', 'catalog')) as CatalogMeta | undefined,
      records: (await tx.getAll('catalog')).map(stripRevision),
    }));
    return { catalogRevision: value.meta?.catalogRevision ?? 0, records: value.records };
  }

  function selectable(records: readonly CatalogRecord[]): CatalogRecord[] {
    const activeInstitutions = new Set(records.filter((r) => r.kind === 'Institution' && r.active).map((r) => r.id));
    return records.filter((r) => r.active && (r.kind !== 'Account' || activeInstitutions.has(r.institutionId)));
  }

  return {
    async resolve(requirements) {
      const current = await readCatalog();
      const byId = new Map(current.records.map((r) => [r.id, r]));
      const resolved: Record<string, ResolvedReference> = {};
      const issues: { name: string; code: 'UnknownReference' | 'WrongKind' }[] = [];
      for (const requirement of requirements) {
        const record = byId.get(requirement.id);
        if (!record) {
          issues.push({ name: requirement.name, code: 'UnknownReference' });
          continue;
        }
        if (record.kind !== requirement.kind) {
          issues.push({ name: requirement.name, code: 'WrongKind' });
          continue;
        }
        const parent = record.kind === 'Account' ? byId.get(record.institutionId) : undefined;
        resolved[requirement.name] = {
          id: record.id,
          kind: record.kind,
          label: record.label,
          recordRevision: record.recordRevision,
          // Only a NewSelection grants eligibility; DisplayOnly is a label lens.
          selectable: requirement.mode === 'NewSelection',
          ...(parent ? { institution: { id: parent.id, label: parent.label, recordRevision: parent.recordRevision } } : {}),
          ...(record.kind === 'Strategy' ? { shape: record.shape } : {}),
        };
      }
      const snapshot = { catalogRevision: current.catalogRevision };
      // Every issue is reported together, never only the first.
      if (issues.length > 0) return { kind: 'Unresolved', snapshot, issues };
      return { kind: 'Resolved', snapshot, resolved };
    },

    async query(request) {
      const current = await readCatalog();
      const cursor = request.cursor ? (JSON.parse(request.cursor) as CursorState) : undefined;
      if (cursor && (cursor.catalogRevision !== current.catalogRevision || cursor.family !== request.family)) {
        return { kind: 'CursorExpired', snapshot: { catalogRevision: current.catalogRevision } };
      }
      const start = cursor?.offset ?? 0;
      const pageSize = request.pageSize ?? 50;
      const items = selectable(current.records)
        .filter((r) => r.kind === request.family)
        .sort((a, b) =>
          a.normalizedLabel !== b.normalizedLabel ? (a.normalizedLabel < b.normalizedLabel ? -1 : 1) : a.id < b.id ? -1 : 1,
        );
      const page = items.slice(start, start + pageSize);
      const snapshot = { catalogRevision: current.catalogRevision };
      const end = start + page.length;
      if (end >= items.length) return { kind: 'Page', items: page, snapshot };
      const next: CursorState = { catalogRevision: current.catalogRevision, family: request.family, offset: end };
      return { kind: 'Page', items: page, snapshot, nextCursor: JSON.stringify(next) };
    },

    async save(command) {
      if (normalizeLabel(command.label) === '') {
        return { kind: 'Rejected', issues: [{ field: 'label', code: 'LabelRequired' }] };
      }
      const current = await readCatalog();
      if (command.kind === 'CreateAccount') {
        // An Account is created only under an existing, selectable Institution.
        const parent = current.records.find((r) => r.id === command.institutionId);
        if (parent?.kind !== 'Institution' || !parent.active) {
          return { kind: 'Rejected', issues: [{ field: 'institutionId', code: 'UnknownReference' }] };
        }
      }
      const normalized = normalizeLabel(command.label);
      // Labels must be distinguishable within their namespace: Institutions globally, Accounts
      // within their Institution.
      const namespace = (r: CatalogRecord) =>
        command.kind === 'CreateInstitution'
          ? r.kind === 'Institution'
          : r.kind === 'Account' && r.institutionId === command.institutionId;
      if (current.records.some((r) => namespace(r) && r.normalizedLabel === normalized)) {
        return { kind: 'Rejected', issues: [{ field: 'label', code: 'LabelNotDistinguishable' }] };
      }
      const common = {
        id: deps.ids.next(),
        label: displayLabel(command.label),
        normalizedLabel: normalized,
        active: true,
        origin: 'Trader',
        recordRevision: 1,
      } as const;
      const record: InstitutionRecord | AccountRecord =
        command.kind === 'CreateInstitution'
          ? { ...common, kind: 'Institution' }
          : { ...common, kind: 'Account', institutionId: command.institutionId };
      const catalogRevision = current.catalogRevision + 1;
      const committed = await deps.persistence.commit({
        checks: [catalogUnchanged(current.catalogRevision)],
        writes: [
          { op: 'add', store: 'catalog', value: { ...record } },
          { op: 'put', store: 'meta', value: { key: 'catalog', catalogRevision } },
        ],
      });
      if (committed.kind === 'RuntimeNotWritable') return committed;
      if (committed.kind !== 'Committed') return { kind: 'Conflict', snapshot: { catalogRevision: current.catalogRevision } };
      return {
        kind: 'Saved',
        record,
        snapshot: { catalogRevision },
        selectableAccountCount: selectableAccountCount([...current.records, record]),
      };
    },


    async seedDefaults(manifest) {
      for (let attempt = 1; ; attempt++) {
        const { value } = await deps.persistence.readSnapshot(['meta', 'catalog'], async (tx) => ({
          meta: (await tx.get('meta', 'catalog')) as CatalogMeta | undefined,
          records: (await tx.getAll('catalog')) as unknown as CatalogRecord[],
        }));
        const current = value.meta?.catalogRevision ?? 0;
        const prepared = prepareSeed(value.records, manifest, deps.ids);
        if (prepared.kind === 'SeedConflict') return prepared;
        const additions = prepared.records;
        const accounts = selectableAccountCount(value.records);
        if (additions.length === 0) {
          return { kind: 'Seeded', snapshot: { catalogRevision: current }, additions: [], selectableAccountCount: accounts };
        }
        const catalogRevision = current + 1;
        const records: StoreRecord[] = [
          ...additions.map((record) => ({ store: 'catalog' as const, value: { ...(record as CatalogRecord) } })),
          { store: 'meta', value: { key: 'catalog', catalogRevision } },
        ];
        const committed = await deps.persistence.commit({
          checks: [catalogUnchanged(current)],
          writes: records.map((r) => ({ op: 'put', ...r })),
        });
        if (committed.kind === 'RuntimeNotWritable') return committed;
        // Only the Catalog counter moved: read again and prepare the seed afresh.
        if (committed.kind !== 'Committed') {
          if (attempt < MAX_ATTEMPTS) continue;
          return { kind: 'Conflict' };
        }
        return {
          kind: 'Seeded',
          snapshot: { catalogRevision },
          additions: additions.map((a) => a.productKey),
          selectableAccountCount: accounts,
        };
      }
    },
  };
}
