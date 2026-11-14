import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';
import { canonicalJson } from '../../backup/format/canonical-json.ts';
import { sha256Hex } from '../../delivery/inventory.ts';
import type { SessionPolicy } from '../../domain/session-policy/index.ts';
import type { RecordSource, SectionRecord } from '../../persistence/index.ts';
import { validateSection, type MarketDataSectionValidation } from './section.ts';

// One artifact record line as the Restore stream hands it over: its line number and parsed JSON.
export interface RestoreLine {
  readonly line: number;
  readonly record: unknown;
}

// A record that does not fit the current schema (D8 A134): the artifact line and the field's path
// in it, joined by dots (a list index is a number: `marks.0.price`).
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

// The strict schema-7 observation record (P31): an extra or missing field, or a number where a
// decimal string belongs, fails. The per-record `revision` write stamp is not part of the artifact
// (Q3), so it is an extra field.
// Instants are checked with the grammar section validation reads them with (`Temporal.Instant.from`),
// so validation never meets a stored time it cannot read. A price stays a plain string: the section
// validator reports a bad one as InvalidPrice or PriceNegative (A37).
const instant = z.string().refine((text) => {
  try {
    Temporal.Instant.from(text);
    return true;
  } catch {
    return false;
  }
});
const mark = z.strictObject({
  revisionId: z.string(),
  revisionNumber: z.number().int(),
  price: z.string(),
  source: z.literal('Manual'),
  intention: z.enum(['InitialManual', 'Correction']),
  reason: z.string().optional(),
  supersedes: z.string().optional(),
  correctionFootprint: z
    .strictObject({
      key: z.strictObject({ instrumentKey: z.string(), tradingDate: z.string() }),
      effectDate: z.string(),
      savedAt: instant,
      domains: z.array(z.enum(['Valuation', 'ConditionStatus', 'Replay'])),
      replayInterval: z.strictObject({ from: z.string(), to: z.string() }),
    })
    .optional(),
  observedAt: instant,
  savedAt: instant,
});
const acknowledgment = z.strictObject({ versionId: z.string(), kind: z.enum(['Asserted', 'Withdrawn']), reason: z.string().optional(), savedAt: instant });
const observation = z.strictObject({
  instrumentKey: z.string(),
  tradingDate: z.string(),
  resolutionRevision: z.number().int(),
  marks: z.array(mark),
  effectiveMarkId: z.string().nullable(),
  acknowledgments: z.array(acknowledgment),
  effectiveAcknowledgmentId: z.string().nullable(),
});

const STORE = 'observations';

export interface MarketDataRestorePreparation {
  // Parses one batch of artifact lines at the current schema; any malformed record rejects the batch.
  parse(store: typeof STORE, lines: readonly RestoreLine[]): ParsedRestoreBatch;
  // Validates the restored observations against the session policy (A132 steps 7-8).
  validate(source: RecordSource): Promise<MarketDataSectionValidation>;
}

function malformedOf(store: string, line: number, error: z.ZodError): MalformedRecord[] {
  return error.issues.flatMap((issue) => {
    const keys = issue.code === 'unrecognized_keys' ? issue.keys : [undefined];
    return keys.map((key) => ({ code: 'MalformedRecord' as const, line, store, path: [...issue.path, ...(key === undefined ? [] : [key])].join('.') }));
  });
}

// `policy` is the session policy this release ships; when the artifact's policy identity differs,
// Workspace revalidates observation keys through `validate` (D4 A40).
export function prepareRestore(context: { readonly policy: SessionPolicy }): MarketDataRestorePreparation {
  return {
    parse(store, lines) {
      const issues = lines.flatMap(({ line, record }) => {
        const result = observation.safeParse(record);
        return result.success ? [] : malformedOf(store, line, result.error);
      });
      return issues.length > 0 ? { kind: 'Rejected', issues } : { kind: 'Parsed', records: lines.map((l) => l.record as SectionRecord) };
    },
    validate: (source) => validateSection(source, context.policy),
  };
}

// Record lines are folded into the digest in chunks of about this many characters, so a mature
// store is hashed in bounded memory and the digest does not depend on the batch size (A140).
const FOLD_AT = 1 << 20;

// The counts and digests of the section as the candidate holds it: SHA-256 chained over every
// record's canonical JSON and LF in key order. Workspace records it in the candidate's `meta` when
// preparation finishes (A132 step 11) and `applyPreparedRestore` recomputes it.
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
