import { describe, expect, it } from 'vitest';
import { Rational } from '../../domain/values/index.ts';
import { byAttention, type Attention } from './attention.ts';

const item = (tradeId: string, lastActivity: string) => ({
  band: 'QuantifiedPressure',
  reasons: [],
  basis: { kind: 'Comparable', side: 'Losing', share: Rational.of(1n), atEntry: Rational.of(0n), now: Rational.of(0n) },
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
