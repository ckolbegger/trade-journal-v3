import { describe, expect, it } from 'vitest';
import { closeDate, closedIdentity, firstDifference, tradeIdOfHref } from './compare.ts';

describe('bench identity comparisons', () => {
  it('should report no difference for equal lists and the first difference otherwise', () => {
    expect(firstDifference(['a', 'b'], ['a', 'b'])).toBeUndefined();
    expect(firstDifference(['a', 'b', 'c'], ['a', 'x', 'c'])).toBe('position 2: expected "b", rendered "x"');
    expect(firstDifference(['a', 'b'], ['a'])).toBe('2 expected, 1 rendered (they agree on the first 1)');
  });

  it('should date a Closed row in the Workspace time zone, not in UTC', () => {
    expect(closeDate('2026-03-03T02:30:00Z', 'America/New_York')).toBe('2026-03-02');
    expect(closedIdentity({ tradeId: 't1', underlying: 'XYZ', terminalTime: '2026-03-03T15:00:00Z' }, 'America/New_York')).toBe('t1 XYZ 2026-03-03');
  });

  it('should read the Trade from a Closed row link', () => {
    expect(tradeIdOfHref('/trades/abc-123')).toBe('abc-123');
  });
});
