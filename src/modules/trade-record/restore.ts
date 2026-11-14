import { z } from 'zod';
import { canonicalJson } from '../../backup/format/canonical-json.ts';
import { sha256Hex } from '../../delivery/inventory.ts';
import type { RecordSource, SectionRecord } from '../../persistence/index.ts';
import { validateSection, type TradeSectionReferences, type TradeSectionValidation } from './section.ts';

// One artifact record line as the Restore stream hands it over: its line number and parsed JSON.
export interface RestoreLine {
  readonly line: number;
  readonly record: unknown;
}

// A record that does not fit the current schema (D8 A134): the artifact line and the field's path
// in it, joined by dots (a list index is a number: `facts.6.versions.0.value.price`).
export interface MalformedRecord {
  readonly code: 'MalformedRecord';
  readonly line: number;
  readonly store: string;
  readonly path: string;
}

export type ParsedRestoreBatch = { readonly kind: 'Parsed'; readonly records: readonly SectionRecord[] } | { readonly kind: 'Rejected'; readonly issues: readonly MalformedRecord[] };

// Strict schema-7 record schemas (P31): an extra or missing field, or a number where a decimal string
// belongs, fails. The per-record `revision` write stamp (Q3) and the private Trade fields are not part
// of the artifact, so they are extras. A Trade's `facts` is a list of fact kinds of any length and
// each fact carries its own Instrument: how many legs a Strategy has is the section validator's rule
// and `assessPlan`'s, never this schema's.
const instant = z.string();
const decimal = z.string();
const stock = z.strictObject({ kind: z.literal('Stock'), symbol: z.string() });
const option = z.strictObject({
  kind: z.literal('Option'),
  symbol: z.string(),
  root: z.string(),
  expiration: z.string(),
  strike: decimal,
  right: z.enum(['Call', 'Put']),
  multiplier: z.literal(100),
});
const instrument = z.discriminatedUnion('kind', [stock, option]);
const condition = z.strictObject({ kind: z.enum(['UnderlyingPrice', 'StructureValue']), price: decimal });

function fact<K extends string, V extends z.ZodType>(kind: K, value: V) {
  return z.strictObject({
    factId: z.string(),
    kind: z.literal(kind),
    recordedSequence: z.number().int(),
    versions: z.array(z.strictObject({ versionNumber: z.number().int(), value })),
  });
}

const facts = z.discriminatedUnion('kind', [
  fact('Plan', z.strictObject({ economicTime: instant, underlying: z.string(), thesis: z.string(), invalidation: z.string(), exerciseIntent: z.enum(['Authorized', 'NotAuthorized']).optional() })),
  fact('PlannedLeg', z.strictObject({ side: z.enum(['Long', 'Short']), instrument, quantity: decimal, intendedEntry: decimal })),
  fact('Stop', condition),
  fact('Target', condition),
  fact('PositionChange', z.strictObject({ economicTime: instant, originTradeId: z.string(), participatingTradeIds: z.array(z.string()), memberIds: z.array(z.string()) })),
  fact(
    'Execution',
    z.strictObject({
      economicTime: instant,
      action: z.enum(['Buy', 'Sell']),
      instrument,
      quantity: decimal,
      price: decimal,
      fee: decimal,
      intent: z.strictObject({ kind: z.literal('ServesPlannedLeg'), plannedLegId: z.string() }),
    }),
  ),
  fact('Expiration', z.strictObject({ economicTime: instant, instrument, quantity: decimal })),
]);

const deviationVersion = z.union([
  z.strictObject({
    fingerprint: z.strictObject({ tradeId: z.string(), plannedLegId: z.string(), positionChangeId: z.string() }),
    type: z.literal('EntrySize'),
    form: z.literal('Excess'),
    quantityAbovePlan: decimal,
    causingPositionChangeId: z.string(),
    economicTime: instant,
    status: z.literal('Active'),
  }),
  z.strictObject({
    fingerprint: z.strictObject({ tradeId: z.string(), plannedLegId: z.string(), form: z.literal('Shortfall') }),
    type: z.literal('EntrySize'),
    form: z.literal('Shortfall'),
    quantityBelowPlan: decimal,
    causingPositionChangeId: z.string(),
    economicTime: instant,
    status: z.literal('Active'),
  }),
  z.strictObject({
    fingerprint: z.union([
      z.strictObject({ tradeId: z.string(), plannedLegId: z.string(), positionChangeId: z.string() }),
      z.strictObject({ tradeId: z.string(), plannedLegId: z.string(), form: z.literal('Shortfall') }),
    ]),
    type: z.literal('EntrySize'),
    form: z.enum(['Excess', 'Shortfall']),
    quantityAbovePlan: decimal.optional(),
    quantityBelowPlan: decimal.optional(),
    causingPositionChangeId: z.string(),
    economicTime: instant,
    status: z.literal('Superseded'),
    reason: z.literal('NoLongerExpected'),
  }),
]);

const trade = z.strictObject({
  tradeId: z.string(),
  accountId: z.string(),
  strategyId: z.string(),
  lifecycle: z.enum(['Planned', 'Open', 'Closed']),
  planTime: instant,
  underlying: z.string(),
  factRevision: z.number().int(),
  facts: z.array(facts),
  recordedSequenceCounter: z.number().int().optional(),
  lastActivity: instant.optional(),
  deviations: z.array(z.strictObject({ occurrenceId: z.string(), versions: z.array(deviationVersion) })).optional(),
  closeReasonFacts: z.array(fact('CloseReason', z.strictObject({ closeReasonId: z.string(), terminalPositionChangeId: z.string() }))).optional(),
});

// The counts and digests of one candidate section, as the candidate's `meta` holds them (A132, A135):
// a count and a digest per store, and the section digest over the store digests.
export interface CandidateSectionMeta {
  readonly counts: Readonly<Record<string, number>>;
  readonly storeDigests: Readonly<Record<string, string>>;
  readonly digest: string;
}

export type ApplyPreparedRestoreResult = { readonly kind: 'Accepted' } | { readonly kind: 'CandidateChanged'; readonly store: string };

// Record lines are folded into the digest in chunks of about this many characters, so a mature
// section is hashed in bounded memory and the digest does not depend on the batch size (A140).
const FOLD_AT = 1 << 20;

// The counts and digest of the section as the candidate holds it: SHA-256 chained over every
// record's canonical JSON and LF, in key order. Workspace records it in the candidate's `meta` when
// preparation finishes (A132 step 11) and `applyPreparedRestore` recomputes it.
export async function measureCandidateSection(source: RecordSource): Promise<CandidateSectionMeta> {
  let count = 0;
  let digest = '';
  let pending = '';
  for await (const batch of source.batches('trades')) {
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
  return { counts: { trades: count }, storeDigests: { trades: storeDigest }, digest: await sha256Hex(`trades ${storeDigest}\n`) };
}

// A135 step 4: the candidate section still holds exactly what preparation recorded.
export async function applyPreparedRestore(source: RecordSource, recorded: CandidateSectionMeta): Promise<ApplyPreparedRestoreResult> {
  const now = await measureCandidateSection(source);
  const same = now.counts['trades'] === recorded.counts['trades'] && now.storeDigests['trades'] === recorded.storeDigests['trades'];
  return same ? { kind: 'Accepted' } : { kind: 'CandidateChanged', store: 'trades' };
}

export interface TradeRestorePreparation {
  // Parses one batch of artifact lines at the current schema; any malformed record rejects the batch.
  parse(store: 'trades', lines: readonly RestoreLine[]): ParsedRestoreBatch;
  // Validates the restored Trades, supplied as the candidate source for derivation (A132 steps 8-9).
  validate(source: RecordSource): Promise<TradeSectionValidation>;
}

function malformedOf(store: string, line: number, error: z.ZodError): MalformedRecord[] {
  return error.issues.flatMap((issue) => {
    const keys = issue.code === 'unrecognized_keys' ? issue.keys : [undefined];
    return keys.map((key) => ({ code: 'MalformedRecord' as const, line, store, path: [...issue.path, ...(key === undefined ? [] : [key])].join('.') }));
  });
}

export function prepareRestore(context: { readonly references: TradeSectionReferences }): TradeRestorePreparation {
  return {
    parse(store, lines) {
      const issues = lines.flatMap(({ line, record }) => {
        const result = trade.safeParse(record);
        return result.success ? [] : malformedOf(store, line, result.error);
      });
      return issues.length > 0 ? { kind: 'Rejected', issues } : { kind: 'Parsed', records: lines.map((l) => l.record as SectionRecord) };
    },
    validate: (source) => validateSection(source, context.references),
  };
}
