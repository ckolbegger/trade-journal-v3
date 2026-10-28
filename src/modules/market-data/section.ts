import { Temporal } from 'temporal-polyfill';
import type { SessionPolicy } from '../../domain/session-policy/index.ts';
import { parseDecimal } from '../../domain/values/index.ts';
import type { RecordSource } from '../../persistence/index.ts';
import type { ObservationRecord } from './records.ts';

type Chain = 'marks' | 'acknowledgments';

export type MarketDataSectionIssue = { readonly instrumentKey: string; readonly tradingDate: string } & (
  | { readonly code: 'MissingRevisionIdentity'; readonly chain: Chain }
  | { readonly code: 'DuplicateRevisionIdentity'; readonly chain: Chain; readonly id: string }
  | { readonly code: 'NotASession' | 'SessionPolicyCoverage' }
  | { readonly code: 'CorrectionReasonMissing'; readonly revisionId: string }
  | { readonly code: 'CorrectionFootprintMissing'; readonly revisionId: string }
  | { readonly code: 'AssertedWhileMarkEffective' | 'WithdrawnWhileMarkEffective' | 'WithdrawalWithoutAssertion'; readonly versionId: string }
  | { readonly code: 'MarkChainBroken'; readonly revisionId: string; readonly field: 'supersedes' | 'revisionNumber' }
  | { readonly code: 'PriceNegative' | 'InvalidPrice'; readonly revisionId: string }
  | { readonly code: 'EffectiveHeadNotLast'; readonly chain: Chain; readonly effectiveId: string | null; readonly lastId: string | null }
);

export interface MarketDataSectionValidation {
  readonly issues: readonly MarketDataSectionIssue[];
  // The Market Data section has no repairable disagreement in D4.
  readonly repairs: readonly never[];
}

// classify throws on a malformed or impossible calendar date; a stored key may hold one.
function classifyDate(policy: SessionPolicy, date: string): ReturnType<SessionPolicy['classify']> | 'Invalid' {
  try {
    return policy.classify(date);
  } catch {
    return 'Invalid';
  }
}

export async function validateSection(source: RecordSource, policy: SessionPolicy): Promise<MarketDataSectionValidation> {
  const issues: MarketDataSectionIssue[] = [];
  // Revision and version identities seen so far, kept between batches.
  const seen = new Set<string>();
  for await (const batch of source.batches('observations')) {
    for (const record of batch as unknown as readonly ObservationRecord[]) {
      const { instrumentKey, tradingDate } = record;
      const day = classifyDate(policy, tradingDate);
      if (day === 'Invalid') issues.push({ code: 'NotASession', instrumentKey, tradingDate });
      else if (day.kind === 'NotCovered') issues.push({ code: 'SessionPolicyCoverage', instrumentKey, tradingDate });
      else if (day.kind !== 'Session') issues.push({ code: 'NotASession', instrumentKey, tradingDate });
      const chains: readonly (readonly [Chain, readonly (string | undefined)[], string | null])[] = [
        ['marks', record.marks.map((m) => m.revisionId), record.effectiveMarkId],
        ['acknowledgments', record.acknowledgments.map((a) => a.versionId), record.effectiveAcknowledgmentId],
      ];
      for (const [chain, ids, effectiveId] of chains) {
        for (const id of ids) {
          if (id === undefined || id === '') issues.push({ code: 'MissingRevisionIdentity', instrumentKey, tradingDate, chain });
          else if (seen.has(id)) issues.push({ code: 'DuplicateRevisionIdentity', instrumentKey, tradingDate, chain, id });
          else seen.add(id);
        }
        // The effective head is the chain's last entry, or null for an empty chain.
        const lastId = ids.at(-1) ?? null;
        if (effectiveId !== lastId) issues.push({ code: 'EffectiveHeadNotLast', instrumentKey, tradingDate, chain, effectiveId, lastId });
      }
      // A Mark is never withdrawn, so an acknowledgment version saved after the first Mark was saved
      // contradicts it: the writer takes an Asserted version only while nothing is effective and
      // rejects a withdrawal once a Mark is. An Asserted version that came first and was followed by
      // a Mark is the normal history, which the resolution rule reads as Available.
      const firstMarkAt = record.marks[0]?.savedAt;
      for (const ack of record.acknowledgments) {
        if (firstMarkAt === undefined || Temporal.Instant.compare(ack.savedAt, firstMarkAt) <= 0) continue;
        const code = ack.kind === 'Asserted' ? 'AssertedWhileMarkEffective' : 'WithdrawnWhileMarkEffective';
        issues.push({ code, instrumentKey, tradingDate, versionId: ack.versionId });
      }
      // The writer withdraws only an effective Asserted version, so a Withdrawn version must follow one.
      record.acknowledgments.forEach((ack, index) => {
        if (ack.kind === 'Withdrawn' && record.acknowledgments[index - 1]?.kind !== 'Asserted') {
          issues.push({ code: 'WithdrawalWithoutAssertion', instrumentKey, tradingDate, versionId: ack.versionId });
        }
      });
      record.marks.forEach((mark, index) => {
        // The first revision is numbered 1 and supersedes nothing; every later one follows the revision before it.
        const previous = record.marks[index - 1];
        const expectedNumber = previous === undefined ? 1 : previous.revisionNumber + 1;
        const expectedSupersedes = previous?.revisionId;
        if (mark.revisionNumber !== expectedNumber) {
          issues.push({ code: 'MarkChainBroken', instrumentKey, tradingDate, revisionId: mark.revisionId, field: 'revisionNumber' });
        }
        if (mark.supersedes !== expectedSupersedes) {
          issues.push({ code: 'MarkChainBroken', instrumentKey, tradingDate, revisionId: mark.revisionId, field: 'supersedes' });
        }
      });
      for (const mark of record.marks) {
        // A price is a finite decimal with at most 6 fractional digits (A37); zero is valid.
        const price = parseDecimal(mark.price);
        if (!price.ok) issues.push({ code: 'InvalidPrice', instrumentKey, tradingDate, revisionId: mark.revisionId });
        else if (price.normalized.startsWith('-')) issues.push({ code: 'PriceNegative', instrumentKey, tradingDate, revisionId: mark.revisionId });
        if (mark.intention !== 'Correction') continue;
        if ((mark.reason ?? '').trim() === '') issues.push({ code: 'CorrectionReasonMissing', instrumentKey, tradingDate, revisionId: mark.revisionId });
        if (mark.correctionFootprint === undefined) issues.push({ code: 'CorrectionFootprintMissing', instrumentKey, tradingDate, revisionId: mark.revisionId });
      }
    }
  }
  return { issues, repairs: [] };
}
