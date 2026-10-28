import { describe, expect, it } from 'vitest';
import { nyseSessionPolicy } from '../../domain/session-policy/index.ts';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { validateSection } from './index.ts';
import type { AcknowledgmentVersion, MarkRevision, ObservationRecord } from './records.ts';

// T4.13: the Market Data section validator (D4 A36, A37, A38).

const footprint = (instrumentKey: string, tradingDate: string) => ({
  key: { instrumentKey, tradingDate },
  effectDate: tradingDate,
  savedAt: '2026-10-13T16:00:00Z',
  domains: ['Valuation', 'ConditionStatus', 'Replay'] as const,
  replayInterval: { from: tradingDate, to: tradingDate },
});

function mark(revisionId: string, revisionNumber: number, price: string, extra: Partial<MarkRevision> = {}): MarkRevision {
  return { revisionId, revisionNumber, price, source: 'Manual', intention: 'InitialManual', observedAt: '2026-10-12T21:00:00Z', savedAt: '2026-10-12T21:00:00Z', ...extra };
}

function correction(revisionId: string, revisionNumber: number, price: string, supersedes: string, instrumentKey: string, tradingDate: string, extra: Partial<MarkRevision> = {}): MarkRevision {
  return mark(revisionId, revisionNumber, price, { intention: 'Correction', reason: 'Typo', supersedes, correctionFootprint: footprint(instrumentKey, tradingDate), ...extra });
}

function withoutFootprint(revision: MarkRevision): MarkRevision {
  const { correctionFootprint, ...rest } = revision;
  void correctionFootprint;
  return rest;
}

function acknowledgment(versionId: string, kind: 'Asserted' | 'Withdrawn', savedAt = '2026-10-12T21:30:00Z'): AcknowledgmentVersion {
  return { versionId, kind, reason: 'No quote', savedAt };
}

function record(instrumentKey: string, tradingDate: string, parts: Partial<ObservationRecord>): ObservationRecord {
  return { instrumentKey, tradingDate, resolutionRevision: 1, marks: [], effectiveMarkId: null, acknowledgments: [], effectiveAcknowledgmentId: null, ...parts };
}

const sessionPolicyMeta = { key: 'sessionPolicy', policy: nyseSessionPolicy.identity };

describe('Market Data section', () => {
  it('should accept observation records with continuous Mark and acknowledgment chains and correct effective heads', async () => {
    const source = recordSourceOf({
      meta: [sessionPolicyMeta],
      observations: [
        record('XYZ', '2026-10-12', { marks: [mark('r-1', 1, '52'), correction('r-2', 2, '51.50', 'r-1', 'XYZ', '2026-10-12')], effectiveMarkId: 'r-2' }),
        record('DEF', '2026-10-12', { acknowledgments: [acknowledgment('a-1', 'Asserted')], effectiveAcknowledgmentId: 'a-1' }),
        record('ABC', '2026-10-12', {
          marks: [mark('r-3', 1, '0')],
          effectiveMarkId: 'r-3',
          acknowledgments: [acknowledgment('a-2', 'Asserted', '2026-10-12T20:00:00Z'), acknowledgment('a-3', 'Withdrawn', '2026-10-12T20:30:00Z')],
          effectiveAcknowledgmentId: 'a-3',
        }),
      ],
    });

    const result = await validateSection(source, nyseSessionPolicy);

    expect(result.issues).toEqual([]);
    expect(result.repairs).toEqual([]);
  });

  it('should report a missing or duplicated revision identity, an effective head that is not the chain last entry, a Correction without a reason or footprint, an Asserted acknowledgment while a Mark is effective, a negative or non-finite price, and a key whose date is not a covered session under the stored policy', async () => {
    const source = recordSourceOf({
      meta: [sessionPolicyMeta],
      observations: [
        // A Mark revision with no identity.
        record('AAA', '2026-10-12', { marks: [mark('', 1, '52')], effectiveMarkId: '' }),
        // Two Mark revisions with one identity.
        record('BBB', '2026-10-12', { marks: [mark('d-1', 1, '52'), correction('d-1', 2, '51', 'd-1', 'BBB', '2026-10-12')], effectiveMarkId: 'd-1' }),
        // An effective head that is the first revision, not the last.
        record('CCC', '2026-10-12', { marks: [mark('h-1', 1, '52'), correction('h-2', 2, '51', 'h-1', 'CCC', '2026-10-12')], effectiveMarkId: 'h-1' }),
        // A Correction with a blank reason.
        record('DDD', '2026-10-12', { marks: [mark('c-1', 1, '52'), correction('c-2', 2, '51', 'c-1', 'DDD', '2026-10-12', { reason: '' })], effectiveMarkId: 'c-2' }),
        // A Correction with no Correction Footprint.
        record('EEE', '2026-10-12', { marks: [mark('f-1', 1, '52'), withoutFootprint(correction('f-2', 2, '51', 'f-1', 'EEE', '2026-10-12'))], effectiveMarkId: 'f-2' }),
        // An Asserted acknowledgment saved after a Mark was already effective.
        record('FFF', '2026-10-12', { marks: [mark('m-1', 1, '52')], effectiveMarkId: 'm-1', acknowledgments: [acknowledgment('s-1', 'Asserted')], effectiveAcknowledgmentId: 's-1' }),
        // A negative price.
        record('GGG', '2026-10-12', { marks: [mark('p-1', 1, '-1')], effectiveMarkId: 'p-1' }),
        // A non-finite price.
        record('HHH', '2026-10-12', { marks: [mark('n-1', 1, 'Infinity')], effectiveMarkId: 'n-1' }),
        // A Saturday, which is not a session.
        record('III', '2026-10-10', { marks: [mark('w-1', 1, '52')], effectiveMarkId: 'w-1' }),
        // A date past the policy's coverage.
        record('JJJ', '2030-01-02', { marks: [mark('v-1', 1, '52')], effectiveMarkId: 'v-1' }),
      ],
    });

    const result = await validateSection(source, nyseSessionPolicy);

    expect(result.issues).toEqual([
      { code: 'MissingRevisionIdentity', instrumentKey: 'AAA', tradingDate: '2026-10-12', chain: 'marks' },
      { code: 'DuplicateRevisionIdentity', instrumentKey: 'BBB', tradingDate: '2026-10-12', chain: 'marks', id: 'd-1' },
      { code: 'EffectiveHeadNotLast', instrumentKey: 'CCC', tradingDate: '2026-10-12', chain: 'marks', effectiveId: 'h-1', lastId: 'h-2' },
      { code: 'CorrectionReasonMissing', instrumentKey: 'DDD', tradingDate: '2026-10-12', revisionId: 'c-2' },
      { code: 'CorrectionFootprintMissing', instrumentKey: 'EEE', tradingDate: '2026-10-12', revisionId: 'f-2' },
      { code: 'AssertedWhileMarkEffective', instrumentKey: 'FFF', tradingDate: '2026-10-12', versionId: 's-1' },
      { code: 'PriceNegative', instrumentKey: 'GGG', tradingDate: '2026-10-12', revisionId: 'p-1' },
      { code: 'InvalidPrice', instrumentKey: 'HHH', tradingDate: '2026-10-12', revisionId: 'n-1' },
      { code: 'NotASession', instrumentKey: 'III', tradingDate: '2026-10-10' },
      { code: 'SessionPolicyCoverage', instrumentKey: 'JJJ', tradingDate: '2030-01-02' },
    ]);
    expect(result.repairs).toEqual([]);
  });
});
