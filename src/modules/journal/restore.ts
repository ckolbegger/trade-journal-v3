import { z } from 'zod';
import { canonicalJson } from '../../backup/format/canonical-json.ts';
import { sha256Hex } from '../../delivery/inventory.ts';
import type { RecordSource, SectionRecord } from '../../persistence/index.ts';
import type { JournalSectionStore } from './export.ts';
import { validateSection, type JournalSectionValidation } from './section.ts';

// One artifact record line as the Restore stream hands it over: its line number and parsed JSON.
export interface RestoreLine {
  readonly line: number;
  readonly record: unknown;
}

// A record that does not fit the current schema (D8 A134): the artifact line and the field's path
// in it, joined by dots (a list index is a number: `versions.0.savedAt`).
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
// an extra field. Entries and declines keep their top-level `anchorTradeId` as stored, and Debts the
// private `anchorTradeId` and `outstandingDue` the export carries.
const instant = z.string();
const anchor = z.strictObject({ kind: z.literal('Trade'), tradeId: z.string() });
const origin = z.union([
  z.strictObject({ kind: z.enum(['Plan', 'PositionChange']), factId: z.string() }),
  z.strictObject({ kind: z.literal('DailyReview'), factId: z.string(), reviewDate: z.string() }),
]);
// A Daily Trade Review's key is the array ['DailyTradeReview', reviewDate, tradeId] (D4 A38).
// Every other obligation's key is a string (`PlanReflection:<tradeId>`, ...).
const obligationKey = z.union([z.string(), z.tuple([z.literal('DailyTradeReview'), z.string(), z.string()])]);
const role = z.enum(['Thesis', 'Invalidation', 'Action', 'Intent']);
// A Text prompt's role may also be one of the two a workflow places itself (D9.5 A321).
const textRole = z.enum(['Thesis', 'Invalidation', 'Action', 'Intent', 'PlanDepartureReason', 'ExpirationReason']);

const prompt = z.discriminatedUnion('kind', [
  z.strictObject({
    id: z.string(),
    kind: z.literal('Text'),
    text: z.string(),
    required: z.boolean(),
    role: textRole.optional(),
    requiredWhen: z.strictObject({ promptId: z.string(), optionIds: z.array(z.string()) }).optional(),
  }),
  z.strictObject({ id: z.string(), kind: z.literal('Scale'), text: z.string(), required: z.boolean(), min: z.number().int(), max: z.number().int() }),
  z.strictObject({
    id: z.string(),
    kind: z.literal('SingleSelect'),
    text: z.string(),
    required: z.boolean(),
    role: role.optional(),
    options: z.array(z.strictObject({ id: z.string(), label: z.string(), protected: z.literal(true).optional() })),
  }),
]);

const response = z.strictObject({
  promptId: z.string(),
  value: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('Text'), text: z.string() }),
    z.strictObject({ kind: z.literal('Scale'), value: z.number().int() }),
    z.strictObject({ kind: z.literal('Option'), optionId: z.string() }),
    z.strictObject({ kind: z.literal('Unanswered') }),
  ]),
});

const SCHEMAS: Readonly<Record<JournalSectionStore, z.ZodType>> = {
  journalTypes: z.strictObject({ id: z.string(), kind: z.enum(['EntryType', 'Source']), productKey: z.string(), label: z.string() }),
  journalDefinitions: z.strictObject({ id: z.string(), entryTypeKey: z.string(), revisionNumber: z.number().int(), prompts: z.array(prompt) }),
  journalEntries: z.strictObject({
    id: z.string(),
    entryTypeKey: z.string(),
    sourceKey: z.string(),
    anchor,
    origin,
    momentTime: instant,
    authoredTime: instant,
    obligationKey,
    anchorTradeId: z.string(),
    versions: z.array(z.strictObject({ versionNumber: z.number().int(), definitionId: z.string(), responses: z.array(response), savedAt: instant })),
    settledDebtId: z.string().optional(),
  }),
  journalDeclines: z.strictObject({
    id: z.string(),
    entryTypeKey: z.string(),
    sourceKey: z.string(),
    anchor,
    origin,
    definitionId: z.string(),
    reason: z.string().optional(),
    momentTime: instant,
    authoredTime: instant,
    obligationKey,
    anchorTradeId: z.string(),
    settledDebtId: z.string().optional(),
  }),
  journalDebts: z.strictObject({
    debtId: z.string(),
    obligationKey: z.string(),
    entryTypeKey: z.string(),
    sourceKey: z.string(),
    definitionId: z.string(),
    anchor,
    origin: z.strictObject({ kind: z.literal('PositionChange'), factId: z.string() }),
    momentTime: instant,
    dueAnchor: instant,
    dueRule: z.literal('OneSessionGrace'),
    route: z.literal('JournalOnly'),
    anchorTradeId: z.string(),
    outstandingDue: instant.optional(),
    // The roles the answer must include (D9.5 A321).
    requires: z.array(textRole).optional(),
    versions: z.array(
      z.strictObject({ versionId: z.string(), status: z.enum(['Outstanding', 'Settled', 'Declined']), savedAt: instant, entryId: z.string().optional(), declineId: z.string().optional() }),
    ),
  }),
};

// The section's stores, in the order its digest is taken.
const STORES = Object.keys(SCHEMAS) as JournalSectionStore[];

export interface JournalRestorePreparation {
  // Parses one batch of artifact lines of a Journal store at the current schema; any malformed
  // record rejects the batch.
  parse(store: JournalSectionStore, lines: readonly RestoreLine[]): ParsedRestoreBatch;
  // Validates the restored Journal section (A132 step 8).
  validate(source: RecordSource): Promise<JournalSectionValidation>;
}

// The paths of the fields an issue names. A union issue is narrowed to the one branch whose `kind`
// matched and that failed only inside it; when no single branch did (a wrong `kind`, or a union
// without one such as the obligation key), it names the union field itself.
function pathsOf(issue: z.core.$ZodIssue, base: readonly PropertyKey[] = []): string[] {
  if (issue.code === 'invalid_union') {
    const wrongKind = (branch: readonly z.core.$ZodIssue[]) => branch.some((i) => i.path.length === 1 && i.path[0] === 'kind');
    const reached = issue.errors.filter((branch) => !wrongKind(branch));
    if (reached.length === 1 && issue.errors.length > 1) {
      return reached[0]!.flatMap((i) => pathsOf(i, [...base, ...issue.path]));
    }
  }
  const keys = issue.code === 'unrecognized_keys' ? issue.keys : [undefined];
  return keys.map((key) => [...base, ...issue.path, ...(key === undefined ? [] : [key])].join('.'));
}

function malformedOf(store: string, line: number, error: z.ZodError): MalformedRecord[] {
  return error.issues.flatMap((issue) => pathsOf(issue).map((path) => ({ code: 'MalformedRecord' as const, line, store, path })));
}

export function prepareRestore(): JournalRestorePreparation {
  return {
    parse(store, lines) {
      const issues = lines.flatMap(({ line, record }) => {
        const result = SCHEMAS[store].safeParse(record);
        return result.success ? [] : malformedOf(store, line, result.error);
      });
      return issues.length > 0 ? { kind: 'Rejected', issues } : { kind: 'Parsed', records: lines.map((l) => l.record as SectionRecord) };
    },
    validate: (source) => validateSection(source),
  };
}

// Record lines are folded into a digest in chunks of about this many characters, so a mature store
// is hashed in bounded memory and the digest does not depend on the batch size (A140).
const FOLD_AT = 1 << 20;

// The counts and digests of the section as the candidate holds it: per store, SHA-256 chained over
// every record's canonical JSON and LF in key order; the section digest is taken over the store
// digests. Workspace records it in the candidate's `meta` when preparation finishes (A132 step 11)
// and `applyPreparedRestore` recomputes it.
export async function measureCandidateSection(source: RecordSource): Promise<CandidateSectionMeta> {
  const counts: Record<string, number> = {};
  const storeDigests: Record<string, string> = {};
  for (const store of STORES) {
    let count = 0;
    let digest = '';
    let pending = '';
    for await (const batch of source.batches(store)) {
      count += batch.length;
      for (const record of batch) {
        pending += `${canonicalJson(record)}\n`;
        if (pending.length >= FOLD_AT) {
          digest = await sha256Hex(digest + pending);
          pending = '';
        }
      }
    }
    counts[store] = count;
    storeDigests[store] = await sha256Hex(digest + pending);
  }
  return { counts, storeDigests, digest: await sha256Hex(STORES.map((store) => `${store} ${storeDigests[store]}\n`).join('')) };
}

// A135 step 4: the candidate section still holds exactly what preparation recorded. A store whose
// count or digest differs is named.
export async function applyPreparedRestore(source: RecordSource, recorded: CandidateSectionMeta): Promise<ApplyPreparedRestoreResult> {
  const now = await measureCandidateSection(source);
  // The section digest is the store digests' digest, so comparing the stores covers it.
  const changed = STORES.find((store) => now.counts[store] !== recorded.counts[store] || now.storeDigests[store] !== recorded.storeDigests[store]);
  return changed === undefined ? { kind: 'Accepted' } : { kind: 'CandidateChanged', store: changed };
}
