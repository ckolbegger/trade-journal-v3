import { z } from 'zod';
import { canonicalJson } from '../../backup/format/canonical-json.ts';
import { sha256Hex } from '../../delivery/inventory.ts';
import type { RecordSource, SectionRecord } from '../../persistence/index.ts';
import type { CatalogSeedManifest } from './manifest.ts';
import { validateSection, type CatalogSectionValidation } from './section.ts';

// One artifact record line as the Restore stream hands it over: its line number and parsed JSON.
export interface RestoreLine {
  readonly line: number;
  readonly record: unknown;
}

// A record that does not fit the current schema (D8 A134): the artifact line and the field's path
// in it, joined by dots.
export interface MalformedRecord {
  readonly code: 'MalformedRecord';
  readonly line: number;
  readonly store: string;
  readonly path: string;
}

export type ParsedRestoreBatch = { readonly kind: 'Parsed'; readonly records: readonly SectionRecord[] } | { readonly kind: 'Rejected'; readonly issues: readonly MalformedRecord[] };

// The counts and digests of one candidate section, as the candidate's `meta` holds them (A132, A135):
// a count and a digest per store, and the section digest over the store digests.
export interface CandidateSectionMeta {
  readonly counts: Readonly<Record<string, number>>;
  readonly storeDigests: Readonly<Record<string, string>>;
  readonly digest: string;
}

export type ApplyPreparedRestoreResult = { readonly kind: 'Accepted' } | { readonly kind: 'CandidateChanged'; readonly store: string };

// Strict schema-7 record schemas (P31): an extra or missing field, or a number where a string
// belongs, fails. The per-record `revision` write stamp is not part of the artifact (Q3), so it is
// an extra field, and so are the content revision counters the Workspace record leaves out.
const base = {
  id: z.string(),
  label: z.string(),
  normalizedLabel: z.string(),
  active: z.boolean(),
  origin: z.enum(['Seeded', 'Trader']),
  recordRevision: z.number().int(),
};
const strategyShape = z.strictObject({
  roles: z.array(z.strictObject({ side: z.enum(['Long', 'Short']), instrument: z.enum(['Stock', 'Call', 'Put']), ratio: z.number().int() })),
});
const catalogRecord = z.discriminatedUnion('kind', [
  z.strictObject({ ...base, kind: z.literal('Institution') }),
  z.strictObject({ ...base, kind: z.literal('Account'), institutionId: z.string() }),
  z.strictObject({ ...base, kind: z.literal('Strategy'), productKey: z.string(), shape: strategyShape }),
  z.strictObject({
    ...base,
    kind: z.literal('CloseReason'),
    productKey: z.string(),
    policy: z.literal('SeededValuesRemainSelectable'),
    role: z.literal('Rolled').optional(),
    seedOrder: z.number().int(),
  }),
]);
// The `workspace` section's one record: time zone, settings revision, seed-manifest versions and
// session-policy identity.
const workspaceRecord = z.strictObject({
  key: z.literal('workspace'),
  timeZone: z.string(),
  settingsRevision: z.number().int(),
  seedManifestVersions: z.strictObject({ catalog: z.number().int(), journal: z.number().int() }),
  sessionPolicy: z.strictObject({
    id: z.string(),
    revision: z.number().int(),
    digest: z.string(),
    coverage: z.strictObject({ first: z.string(), last: z.string() }),
  }),
});
const SCHEMAS = { catalog: catalogRecord, meta: workspaceRecord } as const;

const STORE = 'catalog';

export interface CatalogRestorePreparation {
  // Parses one batch of artifact lines at the current schema: `catalog` records, or the `workspace`
  // section's record (store `meta`). Any malformed record rejects the batch.
  parse(store: 'catalog' | 'meta', lines: readonly RestoreLine[]): ParsedRestoreBatch;
  // Validates the restored Catalog against this release's seed manifest (A132 steps 7-8).
  validate(source: RecordSource): Promise<CatalogSectionValidation>;
}

function malformedOf(store: string, line: number, error: z.ZodError): MalformedRecord[] {
  return error.issues.flatMap((issue) => {
    const keys = issue.code === 'unrecognized_keys' ? issue.keys : [undefined];
    return keys.map((key) => ({ code: 'MalformedRecord' as const, line, store, path: [...issue.path, ...(key === undefined ? [] : [key])].join('.') }));
  });
}

export function prepareRestore(context: { readonly manifest: CatalogSeedManifest }): CatalogRestorePreparation {
  return {
    parse(store, lines) {
      const issues = lines.flatMap(({ line, record }) => {
        const result = SCHEMAS[store].safeParse(record);
        return result.success ? [] : malformedOf(store, line, result.error);
      });
      return issues.length > 0 ? { kind: 'Rejected', issues } : { kind: 'Parsed', records: lines.map((l) => l.record as SectionRecord) };
    },
    validate: (source) => validateSection(source, context.manifest),
  };
}

// Record lines are folded into the digest in chunks of about this many characters, so a mature
// store is hashed in bounded memory and the digest does not depend on the batch size (A140).
const FOLD_AT = 1 << 20;

// The counts and digests of the Catalog as the candidate holds it: SHA-256 chained over every
// record's canonical JSON and LF in key order. The `workspace` section's record lives in the
// candidate's `meta` beside the Workspace's own records and is not part of it. Workspace records
// this in the candidate's `meta` when preparation finishes (A132 step 11) and
// `applyPreparedRestore` recomputes it.
export async function measureCandidateSection(source: RecordSource): Promise<CandidateSectionMeta> {
  let count = 0;
  let digest = '';
  let pending = '';
  for await (const batch of source.batches(STORE)) {
    count += batch.length;
    for (const record of batch) {
      pending += `${canonicalJson(record)}\n`;
      if (pending.length >= FOLD_AT) {
        digest = await sha256Hex(digest + pending);
        pending = '';
      }
    }
  }
  const storeDigest = await sha256Hex(digest + pending);
  return { counts: { [STORE]: count }, storeDigests: { [STORE]: storeDigest }, digest: await sha256Hex(`${STORE} ${storeDigest}\n`) };
}

// A135 step 4: the candidate section still holds exactly what preparation recorded.
export async function applyPreparedRestore(source: RecordSource, recorded: CandidateSectionMeta): Promise<ApplyPreparedRestoreResult> {
  const now = await measureCandidateSection(source);
  const same = now.counts[STORE] === recorded.counts[STORE] && now.storeDigests[STORE] === recorded.storeDigests[STORE];
  return same ? { kind: 'Accepted' } : { kind: 'CandidateChanged', store: STORE };
}
