import { describe, expect, it } from 'vitest';
import { classifyDue } from './index.ts';

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

  it('should return no classification when there are no closes (decision 56)', () => {
    expect(classifyDue('2026-10-08T15:00:00Z', undefined)).toBeUndefined();
  });
});
