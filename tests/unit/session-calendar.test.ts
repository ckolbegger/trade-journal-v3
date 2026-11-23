import { describe, expect, it } from 'vitest';
import {
  getCompletedSessionsBetween,
  getLatestCompletedSessionDate,
  getPreviousTradingDate,
  SESSION_POLICY_REVISION,
} from '../../src/market-data/session-calendar';

describe('U.S. Market Session Calendar seam', () => {
  it('returns Monday close during Tuesday open market hours (normal Available evidence, not Stale)', () => {
    expect(SESSION_POLICY_REVISION).toBeTruthy();

    // Tuesday 2026-11-17 at 11:00 AM EST (16:00 UTC) -> market open -> latest completed is Monday 2026-11-16
    const tuesdayMidday = new Date('2026-11-17T16:00:00.000Z');
    expect(getLatestCompletedSessionDate(tuesdayMidday)).toBe('2026-11-16');

    // Tuesday 2026-11-17 at 4:05 PM EST (21:05 UTC) -> after regular 16:00 ET close -> Tuesday 2026-11-17
    const tuesdayAfterClose = new Date('2026-11-17T21:05:00.000Z');
    expect(getLatestCompletedSessionDate(tuesdayAfterClose)).toBe('2026-11-17');
  });

  it('respects NYSE holidays (Thanksgiving) and early-close 13:00 ET cutoffs (Black Friday)', () => {
    // Thanksgiving 2026 is Thursday 2026-11-26 (closed) -> latest completed is Wednesday 2026-11-25
    const thanksgivingEvening = new Date('2026-11-26T22:00:00.000Z');
    expect(getLatestCompletedSessionDate(thanksgivingEvening)).toBe('2026-11-25');

    // Black Friday 2026-11-27 closes early at 13:00 EST (18:00 UTC)
    const blackFriday1250 = new Date('2026-11-27T17:50:00.000Z');
    expect(getLatestCompletedSessionDate(blackFriday1250)).toBe('2026-11-25');

    const blackFriday1305 = new Date('2026-11-27T18:05:00.000Z');
    expect(getLatestCompletedSessionDate(blackFriday1305)).toBe('2026-11-27');

    // Previous trading day before Black Friday skips Thanksgiving
    expect(getPreviousTradingDate('2026-11-27')).toBe('2026-11-25');
  });

  it('lists completed trading sessions between two dates skipping weekends and holidays', () => {
    const sessions = getCompletedSessionsBetween('2026-11-25', '2026-11-30');
    expect(sessions).toEqual(['2026-11-25', '2026-11-27', '2026-11-30']);
  });
});
