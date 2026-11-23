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

  it('computes exact EST, EDT, and early-close instants via getSessionCloseInstant', async () => {
    const { getSessionCloseInstant } = await import('../../src/market-data/session-calendar');
    // Standard time (EST, UTC-5): 4:00 PM ET = 21:00 UTC
    expect(getSessionCloseInstant('2026-11-23').toISOString()).toBe('2026-11-23T21:00:00.000Z');
    // Daylight saving time (EDT, UTC-4): 4:00 PM ET = 20:00 UTC
    expect(getSessionCloseInstant('2026-07-15').toISOString()).toBe('2026-07-15T20:00:00.000Z');
    // NYSE early close (Day after Thanksgiving 2026-11-27, 1:00 PM EST = 18:00 UTC)
    expect(getSessionCloseInstant('2026-11-27').toISOString()).toBe('2026-11-27T18:00:00.000Z');
  });

  it('resolves economic timestamps with EDT/EST, early close, now cap, and minSameDayIso clamping', async () => {
    const { resolveExecutionEconomicIso } = await import('../../src/market-data/session-calendar');

    // Past EDT session after close -> exact 20:00Z close
    expect(
      resolveExecutionEconomicIso('2026-07-15', new Date('2026-07-16T15:00:00.000Z')),
    ).toBe('2026-07-15T20:00:00.000Z');

    // Early close session -> exact 18:00Z close
    expect(
      resolveExecutionEconomicIso('2026-11-27', new Date('2026-11-30T15:00:00.000Z')),
    ).toBe('2026-11-27T18:00:00.000Z');

    // Same-day before market close -> capped at now
    expect(
      resolveExecutionEconomicIso('2026-11-23', new Date('2026-11-23T15:30:00.000Z')),
    ).toBe('2026-11-23T15:30:00.000Z');

    // Same-day after close: returns now (minSameDayIso does not alter today cap)
    expect(
      resolveExecutionEconomicIso(
        '2026-11-23',
        new Date('2026-11-23T22:00:00.000Z'),
        '2026-11-23T21:15:00.000Z',
      ),
    ).toBe('2026-11-23T22:00:00.000Z');

    // Backdated session with same-day prior execution after close -> clamped to minSameDayIso + 1s
    expect(
      resolveExecutionEconomicIso(
        '2026-11-23',
        new Date('2026-11-24T15:00:00.000Z'),
        '2026-11-23T21:15:00.000Z',
      ),
    ).toBe('2026-11-23T21:15:01.000Z');

    // Backdated session with minSameDayIso on a DIFFERENT exchange date -> ignored, returns exact close
    expect(
      resolveExecutionEconomicIso(
        '2026-11-23',
        new Date('2026-11-24T15:00:00.000Z'),
        '2026-11-20T21:15:00.000Z',
      ),
    ).toBe('2026-11-23T21:00:00.000Z');
  });

  it('handles Good Friday, Juneteenth, year boundaries, and rejects malformed YYYY-MM-DD dates', async () => {
    const {
      isUsTradingDay,
      getPreviousTradingDate,
      getNextTradingDate,
      getSessionCloseInstant,
    } = await import('../../src/market-data/session-calendar');

    expect(isUsTradingDay('2026-04-03')).toBe(false); // Good Friday
    expect(isUsTradingDay('2026-06-19')).toBe(false); // Juneteenth
    expect(getPreviousTradingDate('2026-04-06')).toBe('2026-04-02');
    expect(getNextTradingDate('2026-04-02')).toBe('2026-04-06');

    // Year boundary: 2027-01-01 New Year's Day (Friday) -> Jan 4 Monday
    expect(isUsTradingDay('2027-01-01')).toBe(false);
    expect(getNextTradingDate('2026-12-31')).toBe('2027-01-04');
    expect(getPreviousTradingDate('2027-01-04')).toBe('2026-12-31');

    expect(() => isUsTradingDay('not-a-date')).toThrow();
    expect(() => getSessionCloseInstant('not-a-date')).toThrow();
    expect(() => getNextTradingDate('2026-11-9')).toThrow();
  });
});
