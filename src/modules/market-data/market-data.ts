import { Temporal } from 'temporal-polyfill';
import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import type { SessionPolicy } from '../../domain/session-policy/index.ts';
import type { Clock } from '../../domain/time/index.ts';
import { parseDecimal } from '../../domain/values/index.ts';
import type { BindingCheck, IdGenerator, Persistence, ReadTransaction } from '../../persistence/index.ts';
import { resolve, type AcknowledgmentVersion, type MarkResolution, type MarkRevision, type ObservationKey, type ObservationRecord, type StaleMarkContext } from './records.ts';

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
  | (SaveBase & { readonly intention: 'AssertUnavailable'; readonly reason: string })
  | (SaveBase & { readonly intention: 'WithdrawAcknowledgment'; readonly reason?: string })
  // Installed with the provider Marks it overrides (D11); until then it is refused.
  | (SaveBase & { readonly intention: 'OverrideManualValuation'; readonly price: string });

export type MarketDataIssueCode =
  | 'InvalidInstrument'
  | 'InvalidDate'
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
  readonly field: 'instrumentKey' | 'tradingDate' | 'price' | 'reason' | 'key';
  readonly code: MarketDataIssueCode;
}

interface SavedBase {
  readonly kind: 'Saved';
  readonly key: ObservationKey;
  readonly resolution: MarkResolution;
  readonly resolutionRevision: number;
  // The exact command binding that was accepted.
  readonly binding: ObservationKey & { readonly expectedResolutionRevision: ExpectedResolutionRevision };
}

export type MarketDataSaveResult =
  | (SavedBase & {
      // The saved-intention classification of the revision just appended.
      readonly classification: 'InitialManual' | 'Correction';
      readonly revision: MarkRevision;
    })
  // An assert or a withdrawal: the version just appended, with the key's complete resolution.
  | (SavedBase & { readonly classification: 'Asserted' | 'Withdrawn'; readonly acknowledgment: AcknowledgmentVersion })
  | { readonly kind: 'Rejected'; readonly issues: readonly MarketDataIssue[] }
  | { readonly kind: 'VariantNotInstalled'; readonly intention: 'OverrideManualValuation' }
  // The key changed since the command was prepared; nothing was written.
  | { readonly kind: 'Conflict'; readonly key: ObservationKey; readonly resolution: MarkResolution; readonly resolutionRevision: ExpectedResolutionRevision }
  | RuntimeNotWritable;

export interface MarketData {
  save(command: MarketDataSaveCommand): Promise<MarketDataSaveResult>;
}

const MAX_REASON = 500;

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

function conflictOf(key: ObservationKey, current: { readonly record: ObservationRecord | undefined; readonly stale: StaleMarkContext | undefined }): MarketDataSaveResult {
  return { kind: 'Conflict', key, resolution: resolve(current.record, current.stale), resolutionRevision: revisionOf(current.record) };
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

const SYMBOL = /^[A-Z][A-Z0-9.]{0,9}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// A well-shaped date must also be a real calendar day (2026-02-30 is not).
function isRealDate(text: string): boolean {
  const [y, m, d] = text.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function createMarketData(deps: MarketDataDeps): MarketData {
  // The key checks of P8, P9, and P10 (any well-formed Instrument on a completed covered
  // session), the price check of A37, and the reason check of A35, all reported together.
  function validate(command: Exclude<MarketDataSaveCommand, { intention: 'OverrideManualValuation' }>): MarketDataIssue[] {
    const issues: MarketDataIssue[] = [];
    if (!SYMBOL.test(command.instrumentKey)) issues.push({ field: 'instrumentKey', code: 'InvalidInstrument' });
    if (!DATE.test(command.tradingDate) || !isRealDate(command.tradingDate)) {
      issues.push({ field: 'tradingDate', code: 'InvalidDate' });
    } else {
      const day = deps.sessionPolicy.classify(command.tradingDate);
      if (day.kind === 'NotCovered') issues.push({ field: 'tradingDate', code: 'SessionPolicyCoverage' });
      else if (day.kind !== 'Session') issues.push({ field: 'tradingDate', code: 'NotASession' });
      else if (Temporal.Instant.compare(Temporal.Instant.from(deps.clock.now()), Temporal.Instant.from(day.completion)) < 0) issues.push({ field: 'tradingDate', code: 'SessionNotCompleted' });
    }
    if ('price' in command) {
      const price = parseDecimal(command.price);
      if (!price.ok) issues.push({ field: 'price', code: 'InvalidPrice' });
      else if (price.normalized.startsWith('-')) issues.push({ field: 'price', code: 'PriceNegative' });
    }
    // A correction and an assert need a reason; a withdrawal may omit it, but not exceed the limit.
    if (command.intention !== 'RecordInitialManualMark') {
      const reason = command.reason?.trim() ?? '';
      if (reason === '' && command.intention !== 'WithdrawAcknowledgment') issues.push({ field: 'reason', code: 'ReasonRequired' });
      else if (reason.length > MAX_REASON) issues.push({ field: 'reason', code: 'ReasonTooLong' });
    }
    return issues;
  }

  // The closest earlier Mark of the Instrument, by one reverse cursor on byInstrumentDate (A47).
  async function staleContext(tx: ReadTransaction, key: ObservationKey): Promise<StaleMarkContext | undefined> {
    const found = (await tx.findLastFromIndex(
      'observations',
      'byInstrumentDate',
      IDBKeyRange.bound([key.instrumentKey, ''], [key.instrumentKey, key.tradingDate], false, true),
      (candidate) => candidate['effectiveMarkId'] != null,
    )) as unknown as ObservationRecord | undefined;
    const mark = found?.marks.find((m) => m.revisionId === found.effectiveMarkId);
    const day = found ? deps.sessionPolicy.classify(found.tradingDate) : undefined;
    if (!found || !mark || day?.kind !== 'Session') return undefined;
    return { tradingDate: found.tradingDate, price: mark.price, revisionId: mark.revisionId, revisionNumber: mark.revisionNumber, closeInstant: day.close };
  }

  // The key's record and, when it has no effective Mark, the Stale context that goes with it.
  async function readKey(tx: ReadTransaction, key: ObservationKey) {
    const record = stripRevision(await tx.get('observations', [key.tradingDate, key.instrumentKey]));
    const hasMark = record?.effectiveMarkId != null;
    return { record, stale: hasMark ? undefined : await staleContext(tx, key) };
  }

  return {
    async save(command) {
      const key: ObservationKey = { instrumentKey: command.instrumentKey, tradingDate: command.tradingDate };
      if (command.intention === 'OverrideManualValuation') return { kind: 'VariantNotInstalled', intention: command.intention };
      const issues = validate(command);
      if (issues.length > 0) return { kind: 'Rejected', issues };
      const { value: current } = await deps.persistence.readSnapshot(['observations'], (tx) => readKey(tx, key));
      if (revisionOf(current.record) !== command.expectedResolutionRevision) return conflictOf(key, current);
      const effective = current.record?.marks.find((m) => m.revisionId === current.record?.effectiveMarkId);
      const effectiveAck = current.record?.acknowledgments.find((a) => a.versionId === current.record?.effectiveAcknowledgmentId);
      if (command.intention === 'RecordInitialManualMark' && effective) return conflictOf(key, current);
      if (command.intention === 'CorrectMark') {
        if (!effective) return { kind: 'Rejected', issues: [{ field: 'price', code: 'NothingToCorrect' }] };
        if (effective.price === normalizedPrice(command.price)) {
          return { kind: 'Rejected', issues: [{ field: 'price', code: 'CorrectionUnchanged' }] };
        }
      }
      if (command.intention === 'AssertUnavailable' && effective) return { kind: 'Rejected', issues: [{ field: 'key', code: 'MarkExists' }] };
      if (command.intention === 'WithdrawAcknowledgment' && (effective || effectiveAck?.kind !== 'Asserted')) {
        return { kind: 'Rejected', issues: [{ field: 'key', code: 'NothingToWithdraw' }] };
      }
      const savedAt = deps.clock.now();
      const id = deps.ids.next();
      const marks = current.record?.marks ?? [];
      const acknowledgments = current.record?.acknowledgments ?? [];
      let written: { readonly marks: readonly MarkRevision[]; readonly effectiveMarkId: string | null; readonly acknowledgments: readonly AcknowledgmentVersion[]; readonly effectiveAcknowledgmentId: string | null };
      let outcome: { readonly classification: 'InitialManual' | 'Correction'; readonly revision: MarkRevision } | { readonly classification: 'Asserted' | 'Withdrawn'; readonly acknowledgment: AcknowledgmentVersion };
      if (command.intention === 'AssertUnavailable' || command.intention === 'WithdrawAcknowledgment') {
        const reason = command.reason?.trim();
        const kind = command.intention === 'AssertUnavailable' ? 'Asserted' : 'Withdrawn';
        const acknowledgment: AcknowledgmentVersion = { versionId: id, kind, ...(reason ? { reason } : {}), savedAt };
        written = { marks, effectiveMarkId: current.record?.effectiveMarkId ?? null, acknowledgments: [...acknowledgments, acknowledgment], effectiveAcknowledgmentId: id };
        outcome = { classification: kind, acknowledgment };
      } else {
        const base = { revisionId: id, price: normalizedPrice(command.price), source: 'Manual', observedAt: savedAt, savedAt } as const;
        const revision: MarkRevision =
          command.intention === 'RecordInitialManualMark'
            ? { ...base, revisionNumber: 1, intention: 'InitialManual' }
            : {
                ...base,
                revisionNumber: effective!.revisionNumber + 1,
                intention: 'Correction',
                reason: command.reason.trim(),
                supersedes: effective!.revisionId,
                correctionFootprint: {
                  key,
                  effectDate: key.tradingDate,
                  savedAt,
                  domains: ['Valuation', 'ConditionStatus', 'Replay'],
                  replayInterval: { from: key.tradingDate, to: key.tradingDate },
                },
              };
        written = { marks: [...marks, revision], effectiveMarkId: id, acknowledgments, effectiveAcknowledgmentId: current.record?.effectiveAcknowledgmentId ?? null };
        outcome = { classification: revision.intention, revision };
      }
      const resolutionRevision = (current.record?.resolutionRevision ?? 0) + 1;
      const record: ObservationRecord = { ...key, resolutionRevision, ...written };
      const committed = await deps.persistence.commit({
        checks: [keyUnchanged(key, command.expectedResolutionRevision)],
        writes: [{ op: 'put', store: 'observations', value: { ...record } }],
      });
      if (committed.kind === 'RuntimeNotWritable') return committed;
      if (committed.kind !== 'Committed') {
        const latest = await deps.persistence.readSnapshot(['observations'], (tx) => readKey(tx, key));
        return conflictOf(key, latest.value);
      }
      return {
        kind: 'Saved',
        key,
        resolution: resolve(record, current.stale),
        resolutionRevision,
        ...outcome,
        binding: { ...key, expectedResolutionRevision: command.expectedResolutionRevision },
      };
    },
  };
}
