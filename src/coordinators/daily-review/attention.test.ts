import { describe, expect, it } from 'vitest';
import { derive, type DerivedTradeState } from '../../domain/trade-analysis/index.ts';
import { evaluate, type ObservationFrame, type UncoveredObservation } from '../../domain/trade-analysis/evaluate.ts';
import { PC1, PC2, referenceRecord } from '../../domain/trade-analysis/reference-trade.ts';
import { Rational } from '../../domain/values/index.ts';
import { attentionOf, byAttention, type Attention } from './attention.ts';

const item = (tradeId: string, lastActivity: string) => ({
  band: 'QuantifiedPressure',
  reasons: [],
  basis: { kind: 'Value', value: { side: 'Losing', share: Rational.of(1n), atEntry: Rational.of(0n), now: Rational.of(0n) } },
  rangePosition: { kind: 'Value', value: { now: Rational.of(0n), atEntry: Rational.of(0n) } },
  tradeId,
  lastActivity,
}) as Attention & { tradeId: string; lastActivity: string };

describe('Last Activity order', () => {
  it('should order equal pressure by Last Activity as instants, not strings', () => {
    // Same instant, spelled differently: identity decides.
    expect(byAttention(item('a', '2026-10-12T15:00:00Z'), item('b', '2026-10-12T15:00:00.000Z'))).toBe(-1);
    expect(byAttention(item('b', '2026-10-12T15:00:00Z'), item('a', '2026-10-12T15:00:00.000Z'))).toBe(1);
    // Different instants whose text order disagrees with time order: the later one first.
    expect(byAttention(item('a', '2026-10-12T10:30:00-05:00'), item('b', '2026-10-12T15:00:00Z'))).toBe(-1);
    expect(byAttention(item('b', '2026-10-12T15:00:00Z'), item('a', '2026-10-12T10:30:00-05:00'))).toBe(1);
  });
});

const XYZ = { kind: 'Stock', symbol: 'XYZ' } as const;
const MONDAY_CLOSE = '2026-10-12T20:00:00Z';

function state(): DerivedTradeState {
  const result = derive({ record: referenceRecord([PC1, PC2]) });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${result.kind}`);
  return result;
}

const frame = (resolution: ObservationFrame['resolution'], closeInstant = MONDAY_CLOSE): ObservationFrame => ({ instrument: XYZ, tradingDate: '2026-10-12', closeInstant, resolution });
const missing = frame({ kind: 'Missing' });
const acknowledged = frame({ kind: 'AcknowledgedUnavailable' });
const uncovered: UncoveredObservation = { instrument: XYZ, date: '2026-10-12' };
// PC2 (15:00Z) is bought after this close, so the Mark does not value it.
const earlyClose = frame({ kind: 'Available', mark: { revisionId: 'm1', revisionNumber: 1, price: '52.00' } }, '2026-10-12T14:30:00Z');

const attentionFor = (observation: ObservationFrame | UncoveredObservation) => attentionOf(state(), evaluate({ state: state(), frame: observation }), []);

describe('risk and reward as Calculation Results (P66)', () => {
  it('should return the close not yet in as Unavailable AwaitingClose in both', () => {
    const attention = attentionFor(earlyClose);

    const awaiting = { kind: 'Unavailable', reason: 'AwaitingClose', after: '2026-10-12' };
    expect(attention.basis).toEqual(awaiting);
    expect(attention.rangePosition).toEqual(awaiting);
  });
});

describe('attention reasons carry the reason unchanged (P67)', () => {
  it('should give an evidence-limited Trade the reason of its evaluation Unavailable figure, for MarkMissing and AcknowledgedUnavailable', () => {
    expect(attentionFor(missing)).toEqual(
      expect.objectContaining({ band: 'EvidenceLimited', reasons: [{ code: 'Unavailable', reason: 'MarkMissing', instrument: XYZ, date: '2026-10-12' }] }),
    );
    expect(attentionFor(acknowledged)).toEqual(
      expect.objectContaining({ band: 'EvidenceLimited', reasons: [{ code: 'Unavailable', reason: 'AcknowledgedUnavailable', instrument: XYZ, date: '2026-10-12' }] }),
    );
  });

  it('should give SessionPolicyNotCovered as SessionPolicyNotCovered, never as AcknowledgedUnavailable, in attentionOf', () => {
    const attention = attentionFor(uncovered);

    const notCovered = { kind: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: XYZ, date: '2026-10-12' };
    expect(attention.reasons).toEqual([{ code: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: XYZ, date: '2026-10-12' }]);
    expect(attention.basis).toEqual(notCovered);
    expect(attention.rangePosition).toEqual(notCovered);
  });

  it('should rank a Value pressure ahead of a pressure without one in the same band, as today', () => {
    const value = item('b', '2026-10-12T10:00:00Z');
    const none = { ...item('a', '2026-10-12T15:00:00Z'), basis: { kind: 'Unavailable', reason: 'AwaitingClose', after: '2026-10-12' } } as Attention & { tradeId: string; lastActivity: string };
    const notApplicable = { ...item('c', '2026-10-12T16:00:00Z'), basis: { kind: 'NotApplicable', reason: 'NonPositiveAtEntry', side: 'Losing' } } as Attention & { tradeId: string; lastActivity: string };

    expect([none, notApplicable, value].sort(byAttention).map((i) => i.tradeId)).toEqual(['b', 'c', 'a']);
  });
});
