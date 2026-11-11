import { describe, expect, it } from 'vitest';
import { classifyDue, compareOwed, owedStandingOf } from './index.ts';

// Friday 2026-10-09 20:00Z and Monday 2026-10-12 20:00Z.
const closes = { previousClose: '2026-10-09T20:00:00Z', close: '2026-10-12T20:00:00Z' };

describe('classifyDue (A166, D5 A63)', () => {
  it('should return Due for an anchor before the previous close, and for an anchor exactly at it', () => {
    expect(classifyDue('2026-10-08T15:00:00Z', closes)).toBe('Due');
    expect(classifyDue('2026-10-09T20:00:00Z', closes)).toBe('Due');
  });

  it('should return DueInNextReview for an anchor after the previous close and at or before the close, including exactly at the close', () => {
    expect(classifyDue('2026-10-09T20:00:01Z', closes)).toBe('DueInNextReview');
    expect(classifyDue('2026-10-12T20:00:00Z', closes)).toBe('DueInNextReview');
  });

  it('should return DueInReviewAfterNext for an anchor after the close', () => {
    expect(classifyDue('2026-10-12T20:00:01Z', closes)).toBe('DueInReviewAfterNext');
    expect(classifyDue('2026-10-20T15:00:00Z', closes)).toBe('DueInReviewAfterNext');
  });

  it('should compare an anchor written with a New York offset as an instant, not as text', () => {
    // 16:30 New York is 20:30Z, after the 20:00Z close, though it sorts before it as a string.
    expect(classifyDue('2026-10-12T16:30:00-04:00', closes)).toBe('DueInReviewAfterNext');
    // 16:00 New York is exactly the 20:00Z close, and 16:30 on Friday is 20:30Z, after the previous close.
    expect(classifyDue('2026-10-12T16:00:00-04:00', closes)).toBe('DueInNextReview');
    expect(classifyDue('2026-10-09T16:30:00-04:00', closes)).toBe('DueInNextReview');
    expect(classifyDue('2026-10-09T16:00:00-04:00', closes)).toBe('Due');
  });

  it('should return no classification when there are no closes (decision 56)', () => {
    expect(classifyDue('2026-10-08T15:00:00Z', undefined)).toBeUndefined();
  });
});

describe('owed-group order (A89)', () => {
  const order = (...standings: ReturnType<typeof owedStandingOf>[]) => [...standings].sort(compareOwed).map((s) => s.tradeId);

  it('should put a Trade with a due reflection before one with only later reflections, even when its anchor is newer, then order by oldest owed anchor, then Trade identity', () => {
    const due = owedStandingOf('t-due', ['2026-10-09T19:00:00Z', '2026-10-12T19:00:00Z'], closes);
    const early = owedStandingOf('t-early', ['2026-10-12T15:00:00Z'], closes);
    const late = owedStandingOf('t-late', ['2026-10-12T19:30:00Z'], closes);
    const twinB = owedStandingOf('t-b', ['2026-10-12T19:30:00Z'], closes);
    const twinA = owedStandingOf('t-a', ['2026-10-12T19:30:00Z'], closes);
    expect(due.hasDue).toBe(true);
    expect(early.hasDue).toBe(false);
    // The oldest of a Trade's anchors orders it, wherever it sits in the list.
    expect(owedStandingOf('t-x', ['2026-10-12T19:30:00Z', '2026-10-12T15:00:00Z'], closes).oldestAnchor).toBe('2026-10-12T15:00:00Z');
    expect(order(late, twinB, early, twinA, due)).toEqual(['t-due', 't-early', 't-a', 't-b', 't-late']);
  });

  it('should rank a due standing before a later one whatever the anchors say, the rule being stated apart from the anchor order', () => {
    const due = { tradeId: 't-due', hasDue: true, oldestAnchor: '2026-10-12T19:00:00Z' };
    const earlier = { tradeId: 't-earlier', hasDue: false, oldestAnchor: '2026-10-01T19:00:00Z' };
    expect(order(earlier, due)).toEqual(['t-due', 't-earlier']);
  });

  it('should compare anchors as instants, not as text', () => {
    // 16:30 New York is 20:30Z, later than 20:00Z though it sorts before it as text.
    const newYork = owedStandingOf('t-ny', ['2026-10-12T16:30:00-04:00'], closes);
    const utc = owedStandingOf('t-utc', ['2026-10-12T20:00:00Z'], closes);
    expect(order(newYork, utc)).toEqual(['t-utc', 't-ny']);
  });
});
