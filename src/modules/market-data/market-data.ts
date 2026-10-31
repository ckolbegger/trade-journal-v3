import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { Temporal } from 'temporal-polyfill';
import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import type { CoverageRange, Covered, Session, SessionPolicy } from '../../domain/session-policy/index.ts';
import type { Clock } from '../../domain/time/index.ts';
import { parseDecimal } from '../../domain/values/index.ts';
import { beginSemanticTransaction, requireOpen, type BindingCheck, type IdGenerator, type Persistence, type ReadTransaction, type SemanticTransaction } from '../../persistence/index.ts';
import {
  resolve,
  type AcknowledgmentVersion,
  type MarkResolution,
  type MarkRevision,
  type ObservationKey,
  type ObservationRecord,
  type StaleMarkContext,
} from './records.ts';
import { classifyDate } from './section.ts';

export interface MarketDataDeps {
  readonly persistence: Persistence;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly sessionPolicy: SessionPolicy;
}

// The resolution revision a command was prepared against; a key with no record binds as `None`.
export type ExpectedResolutionRevision = 'None' | number;

interface SaveBase extends ObservationKey {
  readonly expectedResolutionRevision: ExpectedResolutionRevision;
}

export type MarketDataSaveCommand =
  | (SaveBase & { readonly intention: 'RecordInitialManualMark'; readonly price: string })
  | (SaveBase & { readonly intention: 'CorrectMark'; readonly price: string; readonly reason: string })
  // Installed with the provider Marks it overrides (D11); until then it is refused.
  | (SaveBase & { readonly intention: 'OverrideManualValuation'; readonly price: string })
  | (SaveBase & { readonly intention: 'AssertUnavailable'; readonly reason: string })
  | (SaveBase & { readonly intention: 'WithdrawAcknowledgment'; readonly reason?: string });

export type MarketDataIssueCode =
  | 'InvalidInstrument'
  | 'InvalidDate'
  | 'InvalidInstant'
  | 'NotASession'
  | 'SessionPolicyCoverage'
  | 'SessionNotCompleted'
  | 'InvalidPrice'
  | 'PriceNegative'
  | 'ReasonRequired'
  | 'ReasonTooLong'
  | 'CorrectionUnchanged'
  | 'NothingToCorrect'
  | 'MarkExists'
  | 'NothingToWithdraw';

export interface MarketDataIssue {
  readonly field: 'instrumentKey' | 'tradingDate' | 'asOf' | 'earliestExposure' | 'price' | 'reason' | 'key';
  readonly code: MarketDataIssueCode;
  // Set when the issue concerns one entry of a multi-Instrument request.
  readonly instrumentKey?: string;
  // Set on a SessionPolicyCoverage issue for an as-of instant: the uncovered exchange date and the coverage.
  readonly date?: string;
  readonly coverage?: CoverageRange;
}

export type MarketDataSaveResult =
  | {
      readonly kind: 'Saved';
      readonly key: ObservationKey;
      readonly resolution: MarkResolution;
      readonly resolutionRevision: number;
      readonly classification: 'Asserted' | 'Withdrawn';
      readonly acknowledgment: AcknowledgmentVersion;
      readonly binding: ObservationKey & { readonly expectedResolutionRevision: ExpectedResolutionRevision };
    }
  | {
      readonly kind: 'Saved';
      readonly key: ObservationKey;
      readonly resolution: MarkResolution;
      readonly resolutionRevision: number;
      // The saved-intention classification of the revision just appended.
      readonly classification: 'InitialManual' | 'Correction';
      readonly revision: MarkRevision;
      // The exact command binding that was accepted.
      readonly binding: ObservationKey & { readonly expectedResolutionRevision: ExpectedResolutionRevision };
    }
  | { readonly kind: 'Rejected'; readonly issues: readonly MarketDataIssue[] }
  | { readonly kind: 'VariantNotInstalled'; readonly intention: 'OverrideManualValuation' }
  // The key changed since the command was prepared; nothing was written.
  | { readonly kind: 'Conflict'; readonly key: ObservationKey; readonly resolution: MarkResolution; readonly resolutionRevision: ExpectedResolutionRevision }
  | RuntimeNotWritable;

// What one entry of a prepare request asks for: the D4 intentions a single-key `save` accepts, as `{ kind, ...fields }`.
export type MarketDataPrepareIntention =
  | { readonly kind: 'RecordInitialManualMark'; readonly price: string }
  | { readonly kind: 'CorrectMark'; readonly price: string; readonly reason: string }
  | { readonly kind: 'AssertUnavailable'; readonly reason: string }
  | { readonly kind: 'WithdrawAcknowledgment'; readonly reason?: string };

export interface MarketDataPrepareEntry {
  readonly key: ObservationKey;
  readonly expectedRevision: ExpectedResolutionRevision;
  readonly intention: MarketDataPrepareIntention;
}

// 1 to 100 entries with distinct keys (A154).
export interface MarketDataPrepareRequest {
  readonly entries: readonly MarketDataPrepareEntry[];
}

export type MarketDataPrepareIssueCode = MarketDataIssueCode | 'DuplicateKey' | 'TooManyEntries';

// An issue of a prepare request: `entryIndex` names the entry it concerns, and is absent for the request as a whole.
export interface MarketDataPrepareIssue extends Omit<MarketDataIssue, 'code' | 'field'> {
  readonly entryIndex?: number;
  readonly field: MarketDataIssue['field'] | 'entries';
  readonly code: MarketDataPrepareIssueCode;
}

// One key's new record and what the key will report once the record is committed.
export type PreparedMarketDataEntry = {
  readonly key: ObservationKey;
  // The revision the key was read at, which applying rechecks inside the commit.
  readonly expectedRevision: ExpectedResolutionRevision;
  readonly record: ObservationRecord;
  readonly resolution: MarkResolution;
  readonly resolutionRevision: number;
} & (
  | { readonly classification: 'InitialManual' | 'Correction'; readonly revision: MarkRevision }
  | { readonly classification: 'Asserted' | 'Withdrawn'; readonly acknowledgment: AcknowledgmentVersion }
);

export interface PreparedMarketDataEffect {
  readonly kind: 'Prepared';
  readonly entries: readonly PreparedMarketDataEntry[];
}

// A key whose resolution revision is not the expected one, or an acknowledgment meeting an exact Mark.
export interface MarketDataConflictedKey {
  readonly entryIndex: number;
  readonly key: ObservationKey;
  readonly code: 'StaleRevision' | 'MarkExists';
  readonly resolution: MarkResolution;
  readonly resolutionRevision: ExpectedResolutionRevision;
}

export type MarketDataPrepareResult =
  | PreparedMarketDataEffect
  | { readonly kind: 'Rejected'; readonly issues: readonly MarketDataPrepareIssue[] }
  // Every conflicted key, each with its current resolution; nothing was written.
  | { readonly kind: 'Conflict'; readonly keys: readonly MarketDataConflictedKey[] };

// A point context (A53): the Expected Mark Date comes from the as-of instant, the Review Date, or the date itself.
export type FrameContext =
  | { readonly kind: 'Current'; readonly asOf: string }
  | { readonly kind: 'Review'; readonly reviewDate: string }
  | { readonly kind: 'Historical'; readonly tradingDate: string };

export interface ResolveFramesQuery {
  readonly kind: 'ResolveFrames';
  readonly context: FrameContext;
  readonly instruments: readonly string[];
  // The snapshot a coordinator prepared against; the query then answers whether it still holds (A45).
  readonly expectedSnapshot?: string;
}

// The session a point context names, with no Instrument: Daily Review resolves its date and cutoff here.
export interface ResolveSessionQuery {
  readonly kind: 'ResolveSession';
  readonly context: FrameContext;
}

export type MarketDataQuery = ResolveFramesQuery | ResolveSessionQuery;

// One point frame: an Instrument at one session, with that session's close and the next session once completed.
export interface MarkFrame {
  readonly instrumentKey: string;
  readonly tradingDate: string;
  readonly closeInstant: string;
  // The close of the session before this date: the Debt due boundary (A75).
  readonly previousCloseInstant: string;
  readonly nextSession?: { readonly tradingDate: string; readonly closeInstant: string };
  readonly resolution: MarkResolution;
}

export type MarketDataQueryResult =
  // The session's trading date and its close, which is the Review Cutoff (P9).
  | { readonly kind: 'Session'; readonly tradingDate: string; readonly closeInstant: string }
  | { readonly kind: 'SnapshotUnchanged'; readonly snapshotId: string; readonly evidenceDigest: string }
  | {
      readonly kind: 'Frames';
      readonly frames: readonly MarkFrame[];
      // The close of the session before the resolved date, whether or not any frame is asked for (A75).
      readonly previousCloseInstant: string;
      // The resolutionRevision each frame's key was read at, by Instrument: the binding a save of it presents.
      readonly resolutionRevisions: Readonly<Record<string, ExpectedResolutionRevision>>;
      // Opaque token holding the session-policy revision and the evidence digest (A45).
      readonly snapshotId: string;
      readonly evidenceDigest: string;
    }
  // The snapshot a coordinator prepared against no longer holds: the current frames, never a blessing of the old ones.
  | {
      readonly kind: 'SnapshotChanged';
      readonly frames: readonly MarkFrame[];
      readonly previousCloseInstant: string;
      readonly snapshotId: string;
      readonly evidenceDigest: string;
    }
  | { readonly kind: 'Rejected'; readonly issues: readonly MarketDataIssue[] };

// Recovery is asked at a Review Date or an as-of instant, with each Instrument's earliest exposure instant (A56).
export interface RecoverRequest {
  readonly context: Exclude<FrameContext, { kind: 'Historical' }>;
  readonly instruments: readonly { readonly instrumentKey: string; readonly earliestExposure: string }[];
}

export interface ResolvedKey extends ObservationKey {
  readonly resolution: MarkResolution;
  // The revision the key was read at: the optimistic binding a save of it presents.
  readonly resolutionRevision: ExpectedResolutionRevision;
}

// Sessions before the Review Date that lack an effective Mark: Missing and acknowledged ones are kept apart.
export interface HistoricalGaps {
  readonly instrumentKey: string;
  readonly missing: readonly string[];
  readonly acknowledged: readonly string[];
  // The resolutionRevision of each listed date, the binding a save of it presents.
  readonly revisions: Readonly<Record<string, ExpectedResolutionRevision>>;
  // The effective acknowledgment of each acknowledged date, as its resolution carries it.
  readonly acknowledgments: Readonly<Record<string, AcknowledgmentVersion>>;
  // The session close (an instant) of each listed date: only Market Data sees the session policy (decision 62).
  readonly closes: Readonly<Record<string, string>>;
}

// Transient: it is never stored and creates no fact.
export type RecoverDiagnostic =
  | { readonly kind: 'NotConfigured' }
  // The Instrument's relevance starts before the session policy's coverage: only covered sessions are listed (P8).
  | { readonly kind: 'SessionPolicyCoverage'; readonly instrumentKey: string; readonly coverage: CoverageRange };

export type RecoverResult =
  | {
      readonly kind: 'Recovered';
      readonly frames: readonly MarkFrame[];
      // The close of the session before the Review Date: the Debt due boundary, independent of the frames (A75).
      readonly previousCloseInstant: string;
      readonly resolutions: readonly ResolvedKey[];
      readonly gaps: readonly HistoricalGaps[];
      // The Review Date's Missing keys: the Marks task asks the trader for each (A56).
      readonly manualTasks: readonly ObservationKey[];
      readonly snapshotId: string;
      readonly evidenceDigest: string;
      readonly diagnostics: readonly RecoverDiagnostic[];
    }
  | { readonly kind: 'Rejected'; readonly issues: readonly MarketDataIssue[] };

export interface MarketData {
  save(command: MarketDataSaveCommand): Promise<MarketDataSaveResult>;
  // The read half of `save` for many keys: validates every entry, reads each key once in one snapshot, and builds
  // each new record. It writes nothing (P37).
  prepareEffects(request: MarketDataPrepareRequest): Promise<MarketDataPrepareResult>;
  // The write half: stages, per key, a check that the key is still at the revision prepared against and the new
  // record, in the coordinator's semantic transaction (P37).
  applyPreparedEffects(tx: SemanticTransaction, prepared: PreparedMarketDataEffect): void;
  query(query: MarketDataQuery): Promise<MarketDataQueryResult>;
  recover(request: RecoverRequest): Promise<RecoverResult>;
}

const MAX_REASON = 500;
const MAX_ENTRIES = 100;

// The exact decimal text without redundant digits: "52.000" is stored as "52".
function normalizedPrice(price: string): string {
  const parsed = parseDecimal(price);
  return parsed.ok ? parsed.normalized : price;
}

// Drops persistence's write stamp so callers see exactly the stored observation.
function stripRevision(stored: Record<string, unknown> | undefined): ObservationRecord | undefined {
  if (!stored) return undefined;
  const record = { ...stored };
  delete record['revision'];
  return record as unknown as ObservationRecord;
}

const revisionOf = (record: ObservationRecord | undefined): ExpectedResolutionRevision => record?.resolutionRevision ?? 'None';

function conflictOf(key: ObservationKey, record: ObservationRecord | undefined): MarketDataSaveResult {
  return { kind: 'Conflict', key, resolution: resolve(record), resolutionRevision: revisionOf(record) };
}

// Rechecked inside the commit: the key is still at the revision the save read.
function keyUnchanged(key: ObservationKey, expected: ExpectedResolutionRevision): BindingCheck {
  return {
    name: `observation@${key.tradingDate}/${key.instrumentKey}`,
    store: 'observations',
    key: [key.tradingDate, key.instrumentKey],
    verify: (current) => (current === undefined ? 'None' : (current['resolutionRevision'] as number)) === expected,
  };
}

function canonicalContextOf(context: FrameContext): FrameContext {
  switch (context.kind) {
    case 'Current':
      return { kind: context.kind, asOf: context.asOf };
    case 'Review':
      return { kind: context.kind, reviewDate: context.reviewDate };
    case 'Historical':
      return { kind: context.kind, tradingDate: context.tradingDate };
  }
}

const SYMBOL = /^[A-Z][A-Z0-9.]{0,9}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// A well-shaped date must also be a real calendar day (2026-02-30 is not).
function isRealDate(text: string): boolean {
  const [y, m, d] = text.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// The latest earlier date with an effective Mark for the instrument, by one reverse cursor request (A47).
async function staleContextOf(tx: ReadTransaction, policy: SessionPolicy, key: ObservationKey): Promise<StaleMarkContext | undefined> {
  const found = await tx.findLastFromIndex(
    'observations',
    'byInstrumentDate',
    IDBKeyRange.bound([key.instrumentKey], [key.instrumentKey, key.tradingDate], false, true),
    // A key the policy no longer counts as a session stays stored but is never selected (A40).
    (r) => {
      if (r['instrumentKey'] !== key.instrumentKey || (r['effectiveMarkId'] as string | null) === null) return false;
      const day = classifyDate(policy, r['tradingDate'] as string);
      return day !== 'Invalid' && day.kind === 'Session';
    },
  );
  const earlier = stripRevision(found);
  const mark = earlier?.marks.find((m) => m.revisionId === earlier.effectiveMarkId);
  const day = earlier && policy.classify(earlier.tradingDate);
  if (!earlier || !mark || day?.kind !== 'Session') return undefined;
  return { tradingDate: earlier.tradingDate, price: mark.price, revisionId: mark.revisionId, revisionNumber: mark.revisionNumber, closeInstant: day.close };
}

// An as-of instant must be a full ISO instant with an offset; a date-only or free-text value is not one.
function isInstant(value: string): boolean {
  try {
    Temporal.Instant.from(value);
    return true;
  } catch {
    return false;
  }
}

export function createMarketData(deps: MarketDataDeps): MarketData {
  // The key checks of P8, P9, and P10 (any well-formed Instrument on a completed covered
  // session), the price check of A37, and the reason check of A35, all reported together.
  // A date must be a real, covered, completed session.
  function validateDate(tradingDate: string): MarketDataIssue[] {
    if (!DATE.test(tradingDate) || !isRealDate(tradingDate)) return [{ field: 'tradingDate', code: 'InvalidDate' }];
    const day = deps.sessionPolicy.classify(tradingDate);
    if (day.kind === 'NotCovered') return [{ field: 'tradingDate', code: 'SessionPolicyCoverage' }];
    if (day.kind !== 'Session') return [{ field: 'tradingDate', code: 'NotASession' }];
    if (Temporal.Instant.compare(Temporal.Instant.from(deps.clock.now()), Temporal.Instant.from(day.completion)) < 0) return [{ field: 'tradingDate', code: 'SessionNotCompleted' }];
    return [];
  }

  function validateKey(command: ObservationKey): MarketDataIssue[] {
    const issues: MarketDataIssue[] = [];
    if (!SYMBOL.test(command.instrumentKey)) issues.push({ field: 'instrumentKey', code: 'InvalidInstrument' });
    issues.push(...validateDate(command.tradingDate));
    return issues;
  }

  // The key, price, and reason checks of one prepare entry (A35, A37), all reported together.
  function validateEntry({ key, intention }: MarketDataPrepareEntry): MarketDataIssue[] {
    const issues = validateKey(key);
    if (intention.kind === 'RecordInitialManualMark' || intention.kind === 'CorrectMark') {
      const price = parseDecimal(intention.price);
      if (!price.ok) issues.push({ field: 'price', code: 'InvalidPrice' });
      else if (price.normalized.startsWith('-')) issues.push({ field: 'price', code: 'PriceNegative' });
    }
    if (intention.kind === 'RecordInitialManualMark') return issues;
    const reason = (intention.reason ?? '').trim();
    if (intention.kind !== 'WithdrawAcknowledgment' && reason === '') issues.push({ field: 'reason', code: 'ReasonRequired' });
    else if (reason.length > MAX_REASON) issues.push({ field: 'reason', code: 'ReasonTooLong' });
    return issues;
  }

  async function latestRecord(key: ObservationKey): Promise<ObservationRecord | undefined> {
    const latest = await deps.persistence.readSnapshot(['observations'], async (tx) =>
      stripRevision(await tx.get('observations', [key.tradingDate, key.instrumentKey])),
    );
    return latest.value;
  }

  // The prepare entry intention a single-key save command asks for.
  function intentionOf(command: Exclude<MarketDataSaveCommand, { intention: 'OverrideManualValuation' }>): MarketDataPrepareIntention {
    switch (command.intention) {
      case 'RecordInitialManualMark':
        return { kind: command.intention, price: command.price };
      case 'CorrectMark':
        return { kind: command.intention, price: command.price, reason: command.reason };
      case 'AssertUnavailable':
        return { kind: command.intention, reason: command.reason };
      case 'WithdrawAcknowledgment':
        return { kind: command.intention, ...(command.reason !== undefined && { reason: command.reason }) };
    }
  }

  // Per Instrument, the sessions before the Review Date without an effective Mark, from its relevance start (A56).
  // One bounded range read per Instrument, whatever the history length (A47).
  async function historicalGaps(tx: ReadTransaction, instruments: RecoverRequest['instruments'], reviewDate: string): Promise<{ gaps: HistoricalGaps[]; diagnostics: RecoverDiagnostic[] }> {
    const lastHistorical = Temporal.PlainDate.from(reviewDate).subtract({ days: 1 }).toString();
    const { coverage } = deps.sessionPolicy.identity;
    // One request entry per Instrument: a Trade's earliest exposure governs (A56).
    const earliest = new Map<string, string>();
    for (const { instrumentKey, earliestExposure } of instruments) {
      const known = earliest.get(instrumentKey);
      if (known === undefined || Temporal.Instant.compare(Temporal.Instant.from(earliestExposure), Temporal.Instant.from(known)) < 0) earliest.set(instrumentKey, earliestExposure);
    }
    const value = await Promise.all(
        [...earliest]
          .map(([instrumentKey, earliestExposure]) => ({ instrumentKey, earliestExposure }))
          .sort((a, b) => (a.instrumentKey < b.instrumentKey ? -1 : 1))
          .map(async ({ instrumentKey, earliestExposure }) => {
            const exposure = Temporal.Instant.from(earliestExposure);
            const exposureDate = exposure.toZonedDateTimeISO('UTC').toPlainDate().toString();
            // Outside coverage there is a diagnostic, never a guessed session (P8): enumeration starts at the first covered date.
            const beforeCoverage = exposureDate < coverage.first;
            const from = beforeCoverage ? coverage.first : exposureDate;
            const sessions = deps.sessionPolicy.sessionsBetween(from, lastHistorical);
            // Relevance starts at the first session whose close is at or after the exposure.
            const relevant = sessions.ok ? sessions.value.filter((s) => Temporal.Instant.compare(Temporal.Instant.from(s.close), exposure) >= 0) : [];
            const stored = relevant.length === 0 ? [] : await tx.getAllFromIndex('observations', 'byInstrumentDate', IDBKeyRange.bound([instrumentKey, relevant[0]!.date], [instrumentKey, relevant[relevant.length - 1]!.date]));
            const storedOn = new Map(stored.map((r) => [r['tradingDate'] as string, r]));
            const resolutionOf = new Map([...storedOn].map(([date, r]) => [date, resolve(stripRevision(r))]));
            const kinds = relevant.map((s) => ({ date: s.date, kind: resolutionOf.get(s.date)?.kind ?? 'Missing' }));
            const gaps: HistoricalGaps = {
              instrumentKey,
              missing: kinds.filter((k) => k.kind === 'Missing').map((k) => k.date),
              acknowledged: kinds.filter((k) => k.kind === 'AcknowledgedUnavailable').map((k) => k.date),
              revisions: Object.fromEntries(
                kinds.filter((k) => k.kind !== 'Available').map((k) => [k.date, revisionOf(stripRevision(storedOn.get(k.date)))]),
              ),
              acknowledgments: Object.fromEntries(
                kinds.flatMap((k) => {
                  const resolution = resolutionOf.get(k.date);
                  return resolution?.kind === 'AcknowledgedUnavailable' ? [[k.date, resolution.acknowledgment]] : [];
                }),
              ),
              closes: Object.fromEntries(relevant.filter((s) => resolutionOf.get(s.date)?.kind !== 'Available').map((s) => [s.date, s.close])),
            };
            return { gaps, beforeCoverage };
          }),
    );
    return {
      gaps: value.map((v) => v.gaps),
      diagnostics: value.filter((v) => v.beforeCoverage).map((v): RecoverDiagnostic => ({ kind: 'SessionPolicyCoverage', instrumentKey: v.gaps.instrumentKey, coverage })),
    };
  }

  // The day a frame context names, or why it names none.
  function resolveDay(context: ResolveFramesQuery['context']): { kind: 'Day'; day: Session } | { kind: 'Rejected'; issues: MarketDataIssue[] } {
  let day: Covered<Session>;
  if (context.kind === 'Current') {
    if (!isInstant(context.asOf)) return { kind: 'Rejected', issues: [{ field: 'asOf', code: 'InvalidInstant' }] };
    day = deps.sessionPolicy.latestCompleted(context.asOf);
  }
  else {
    const date = context.kind === 'Review' ? context.reviewDate : context.tradingDate;
    const issues = validateDate(date);
    if (issues.length > 0) return { kind: 'Rejected', issues };
    day = { ok: true, value: deps.sessionPolicy.classify(date) as Session };
  }
  if (!day.ok) return { kind: 'Rejected', issues: [{ field: 'asOf', code: 'SessionPolicyCoverage', date: day.diagnostic.date, coverage: day.diagnostic.coverage }] };
  return { kind: 'Day', day: day.value };
  }

  // The read half of a frame query, inside the caller's read transaction.
  // One range read of the valuation date, then one reverse-cursor request per Missing Instrument (A47).
  async function frameEvidence(tx: ReadTransaction, date: string, instruments: readonly string[]) {
    const onDate = await tx.getAllInRange('observations', IDBKeyRange.bound([date], [date, []]));
    return Promise.all(
      instruments.map(async (instrumentKey) => {
        const record = stripRevision(onDate.find((r) => r['instrumentKey'] === instrumentKey));
        const stale = record?.effectiveMarkId ? undefined : await staleContextOf(tx, deps.sessionPolicy, { instrumentKey, tradingDate: date });
        return { record, stale };
      }),
    );
  }

  // The frames, digest, and snapshot id from evidence already read; computed after the read transaction closes (A45).
  function frameResult(query: ResolveFramesQuery, day: Session, instruments: readonly string[], evidence: Awaited<ReturnType<typeof frameEvidence>>): MarketDataQueryResult {
  // The next session is disclosed once it is completed at the as-of instant (the clock for a date context).
  const at = Temporal.Instant.from(query.context.kind === 'Current' ? query.context.asOf : deps.clock.now());
  const next = deps.sessionPolicy.nextSession(day.date);
  const nextSession =
    next.ok && Temporal.Instant.compare(at, Temporal.Instant.from(next.value.completion)) >= 0
      ? { tradingDate: next.value.date, closeInstant: next.value.close }
      : undefined;
  const previous = deps.sessionPolicy.previousSession(day.date);
  if (!previous.ok) return { kind: 'Rejected', issues: [{ field: 'asOf', code: 'SessionPolicyCoverage', date: previous.diagnostic.date, coverage: previous.diagnostic.coverage }] };
  const previousCloseInstant = previous.value.close;
  // The context is serialized from its known fields so the caller's property order and extra properties cannot change the digest.
  const canonicalContext = canonicalContextOf(query.context);
  // The digest is computed after the read transaction closes (A45). It carries the as-of instant's material effect: the completed next session.
  const evidenceDigest = bytesToHex(
    sha256(
      utf8ToBytes(
        JSON.stringify({
          request: { context: canonicalContext, date: day.date, instruments },
          policy: { id: deps.sessionPolicy.identity.id, revision: deps.sessionPolicy.identity.revision, digest: deps.sessionPolicy.identity.digest },
          nextSession: nextSession?.tradingDate ?? null,
          evidence: evidence.map(({ record, stale }) => [record?.effectiveMarkId ?? null, record?.effectiveAcknowledgmentId ?? null, stale?.revisionId ?? null]),
        }),
      ),
    ),
  );
  const snapshotId = `mds1:${deps.sessionPolicy.identity.revision}:${evidenceDigest}`;
  if (query.expectedSnapshot === snapshotId) return { kind: 'SnapshotUnchanged', snapshotId, evidenceDigest };
  return {
    kind: query.expectedSnapshot === undefined ? 'Frames' : 'SnapshotChanged',
    previousCloseInstant,
    frames: instruments.map((instrumentKey, i) => ({
      instrumentKey,
      tradingDate: day.date,
      closeInstant: day.close,
      previousCloseInstant,
      ...(nextSession && { nextSession }),
      resolution: resolve(evidence[i]!.record, evidence[i]!.stale),
    })),
    resolutionRevisions: Object.fromEntries(instruments.map((instrumentKey, i) => [instrumentKey, revisionOf(evidence[i]!.record)])),
    snapshotId,
    evidenceDigest,
  };
  }

  const marketData: MarketData = {
    async prepareEffects({ entries }) {
      if (entries.length > MAX_ENTRIES) return { kind: 'Rejected', issues: [{ field: 'entries', code: 'TooManyEntries' }] };
      const seen = new Set<string>();
      const issues = entries.flatMap((entry, entryIndex): MarketDataPrepareIssue[] => {
        const id = JSON.stringify([entry.key.tradingDate, entry.key.instrumentKey]);
        const duplicate = seen.has(id);
        seen.add(id);
        return [...validateEntry(entry), ...(duplicate ? [{ field: 'key', code: 'DuplicateKey' } as const] : [])].map((issue) => ({ ...issue, entryIndex }));
      });
      if (issues.length > 0) return { kind: 'Rejected', issues };
      const { value: read } = await deps.persistence.readSnapshot(['observations'], (tx) =>
        Promise.all(
          entries.map(async ({ key, intention }) => ({
            record: stripRevision(await tx.get('observations', [key.tradingDate, key.instrumentKey])),
            // An acknowledgment's resolution discloses the latest earlier Mark (A47).
            stale: intention.kind === 'AssertUnavailable' || intention.kind === 'WithdrawAcknowledgment' ? await staleContextOf(tx, deps.sessionPolicy, key) : undefined,
          })),
        ),
      );
      const conflicts = entries.flatMap(({ key, expectedRevision, intention }, entryIndex): MarketDataConflictedKey[] => {
        const { record } = read[entryIndex]!;
        // A first Mark over an exact Mark is as stale as a moved revision: the trader saw no Mark.
        const stale = revisionOf(record) !== expectedRevision || (intention.kind === 'RecordInitialManualMark' && record?.effectiveMarkId);
        const code = stale ? 'StaleRevision' : intention.kind === 'AssertUnavailable' && record?.effectiveMarkId ? 'MarkExists' : undefined;
        return code ? [{ entryIndex, key, code, resolution: resolve(record), resolutionRevision: revisionOf(record) }] : [];
      });
      if (conflicts.length > 0) return { kind: 'Conflict', keys: conflicts };
      const rejectionOf = (intention: MarketDataPrepareIntention,record: ObservationRecord | undefined): MarketDataIssue | undefined => {
        if (intention.kind === 'CorrectMark') {
          const effective = record?.marks.find((m) => m.revisionId === record.effectiveMarkId);
          if (!effective) return { field: 'price', code: 'NothingToCorrect' };
          if (effective.price === normalizedPrice(intention.price)) return { field: 'price', code: 'CorrectionUnchanged' };
          return undefined;
        }
        if (intention.kind === 'WithdrawAcknowledgment' && resolve(record).kind !== 'AcknowledgedUnavailable') return { field: 'key', code: 'NothingToWithdraw' };
        return undefined;
      };
      const rejections = entries.flatMap(({ intention }, entryIndex): MarketDataPrepareIssue[] => {
        const issue = rejectionOf(intention, read[entryIndex]!.record);
        return issue ? [{ ...issue, entryIndex }] : [];
      });
      if (rejections.length > 0) return { kind: 'Rejected', issues: rejections };
      const prepared = entries.map((entry, i): PreparedMarketDataEntry => {
        const { key, intention } = entry;
        const { record: current, stale } = read[i]!;
        const savedAt = deps.clock.now();
        if (intention.kind === 'AssertUnavailable' || intention.kind === 'WithdrawAcknowledgment') {
          const reason = (intention.reason ?? '').trim();
          const asserting = intention.kind === 'AssertUnavailable';
          const acknowledgment: AcknowledgmentVersion = { versionId: deps.ids.next(), kind: asserting ? 'Asserted' : 'Withdrawn', ...(reason !== '' && { reason }), savedAt };
          const resolutionRevision = (current?.resolutionRevision ?? 0) + 1;
          const record: ObservationRecord = {
            ...key,
            resolutionRevision,
            marks: current?.marks ?? [],
            effectiveMarkId: current?.effectiveMarkId ?? null,
            acknowledgments: [...(current?.acknowledgments ?? []), acknowledgment],
            effectiveAcknowledgmentId: acknowledgment.versionId,
          };
          return { key, expectedRevision: entry.expectedRevision, record, resolution: resolve(record, stale), resolutionRevision, classification: acknowledgment.kind, acknowledgment };
        }
        const effective = current?.marks.find((m) => m.revisionId === current.effectiveMarkId);
        const base = { revisionId: deps.ids.next(), price: normalizedPrice(intention.price), source: 'Manual', observedAt: savedAt, savedAt } as const;
        const revision: MarkRevision =
          intention.kind === 'RecordInitialManualMark'
            ? { ...base, revisionNumber: 1, intention: 'InitialManual' }
            : {
                ...base,
                revisionNumber: effective!.revisionNumber + 1,
                intention: 'Correction',
                reason: intention.reason.trim(),
                supersedes: effective!.revisionId,
                correctionFootprint: {
                  key,
                  effectDate: key.tradingDate,
                  savedAt,
                  domains: ['Valuation', 'ConditionStatus', 'Replay'],
                  replayInterval: { from: key.tradingDate, to: key.tradingDate },
                },
              };
        const resolutionRevision = (current?.resolutionRevision ?? 0) + 1;
        const record: ObservationRecord = {
          ...key,
          resolutionRevision,
          marks: [...(current?.marks ?? []), revision],
          effectiveMarkId: revision.revisionId,
          acknowledgments: current?.acknowledgments ?? [],
          effectiveAcknowledgmentId: current?.effectiveAcknowledgmentId ?? null,
        };
        return { key, expectedRevision: entry.expectedRevision, record, resolution: resolve(record), resolutionRevision, classification: revision.intention, revision };
      });
      // A Mark prepared in this batch for an earlier date is the Stale context query will report once committed (A47, A154).
      const entriesWithStale = prepared.map((entry, i): PreparedMarketDataEntry => {
        if (!('acknowledgment' in entry)) return entry;
        let stale = read[i]!.stale;
        for (const other of prepared) {
          if (!('revision' in other) || other.key.instrumentKey !== entry.key.instrumentKey) continue;
          if (other.key.tradingDate >= entry.key.tradingDate || (stale && other.key.tradingDate < stale.tradingDate)) continue;
          const day = deps.sessionPolicy.classify(other.key.tradingDate);
          if (day.kind !== 'Session') continue;
          const { revisionId, revisionNumber, price } = other.revision;
          stale = { tradingDate: other.key.tradingDate, price, revisionId, revisionNumber, closeInstant: day.close };
        }
        return { ...entry, resolution: resolve(entry.record, stale) };
      });
      return { kind: 'Prepared', entries: entriesWithStale };
    },
    applyPreparedEffects(tx, prepared) {
      requireOpen(tx);
      for (const { key, expectedRevision, record } of prepared.entries) {
        tx.require(keyUnchanged(key, expectedRevision));
        tx.stage({ op: 'put', store: 'observations', value: { ...record } });
      }
    },
    async query(query) {
      const resolved = resolveDay(query.context);
      if (resolved.kind === 'Rejected') return resolved;
      if (query.kind === 'ResolveSession') return { kind: 'Session', tradingDate: resolved.day.date, closeInstant: resolved.day.close };
      const instruments = [...new Set(query.instruments)].sort();
      const { value: evidence } = await deps.persistence.readSnapshot(['observations'], (tx) => frameEvidence(tx, resolved.day.date, instruments));
      return frameResult(query, resolved.day, instruments, evidence);
    },
    async save(command) {
      if (command.intention === 'OverrideManualValuation') return { kind: 'VariantNotInstalled', intention: command.intention };
      const key: ObservationKey = { instrumentKey: command.instrumentKey, tradingDate: command.tradingDate };
      const binding = { ...key, expectedResolutionRevision: command.expectedResolutionRevision };
      const prepared = await marketData.prepareEffects({ entries: [{ key, expectedRevision: command.expectedResolutionRevision, intention: intentionOf(command) }] });
      // One entry cannot produce a request-level or duplicate issue, so every issue here is one `save` already reported.
      if (prepared.kind === 'Rejected') return { kind: 'Rejected', issues: prepared.issues.map(({ field, code }) => ({ field, code }) as MarketDataIssue) };
      if (prepared.kind === 'Conflict') {
        const [conflict] = prepared.keys;
        if (conflict!.code === 'MarkExists') return { kind: 'Rejected', issues: [{ field: 'key', code: 'MarkExists' }] };
        return { kind: 'Conflict', key, resolution: conflict!.resolution, resolutionRevision: conflict!.resolutionRevision };
      }
      const tx = beginSemanticTransaction();
      marketData.applyPreparedEffects(tx, prepared);
      const { checks, writes } = tx.close();
      const committed = await deps.persistence.commit({ checks, writes });
      if (committed.kind === 'RuntimeNotWritable') return committed;
      if (committed.kind !== 'Committed') return conflictOf(key, await latestRecord(key));
      const [entry] = prepared.entries;
      const { resolution, resolutionRevision } = entry!;
      if ('revision' in entry!) return { kind: 'Saved', key, resolution, resolutionRevision, classification: entry.classification, revision: entry.revision, binding };
      return { kind: 'Saved', key, resolution, resolutionRevision, classification: entry!.classification, acknowledgment: entry!.acknowledgment, binding };
    },
    async recover(request) {
      const invalid = request.instruments.filter((i) => !isInstant(i.earliestExposure));
      if (invalid.length > 0) {
        return { kind: 'Rejected', issues: invalid.map((i) => ({ field: 'earliestExposure', code: 'InvalidInstant', instrumentKey: i.instrumentKey })) };
      }
      const instruments = request.instruments.map((i) => i.instrumentKey);
      const sorted = [...new Set(instruments)].sort();
      const resolved = resolveDay(request.context);
      if (resolved.kind === 'Rejected') return resolved;
      // Frames and gaps are read in one transaction, so a Mark saved meanwhile cannot show in one and not the other (A47).
      const { value: read } = await deps.persistence.readSnapshot(['observations'], async (tx) => ({
        evidence: await frameEvidence(tx, resolved.day.date, sorted),
        historical: await historicalGaps(tx, request.instruments, resolved.day.date),
      }));
      const queried = frameResult({ kind: 'ResolveFrames', context: request.context, instruments }, resolved.day, sorted, read.evidence);
      if (queried.kind !== 'Frames') return { kind: 'Rejected', issues: queried.kind === 'Rejected' ? queried.issues : [] };
      const { gaps, diagnostics } = read.historical;
      return {
        kind: 'Recovered',
        frames: queried.frames,
        previousCloseInstant: queried.previousCloseInstant,
        resolutions: queried.frames.map(({ instrumentKey, tradingDate, resolution }, i) => ({ instrumentKey, tradingDate, resolution, resolutionRevision: revisionOf(read.evidence[i]!.record) })),
        gaps,
        manualTasks: queried.frames.filter((f) => f.resolution.kind === 'Missing').map(({ instrumentKey, tradingDate }) => ({ instrumentKey, tradingDate })),
        snapshotId: queried.snapshotId,
        evidenceDigest: queried.evidenceDigest,
        diagnostics: [{ kind: 'NotConfigured' }, ...diagnostics],
      };
    },
  };
  return marketData;
}
