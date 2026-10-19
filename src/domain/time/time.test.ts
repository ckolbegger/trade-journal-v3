import { describe, expect, it } from 'vitest';
import { fixedClock, fromWorkspaceLocal, toWorkspaceLocal, validateTimeZone } from './index.ts';

describe('injected clock', () => {
  it('should return exactly the instant supplied by a fixed test clock on every call', () => {
    const clock = fixedClock('2026-10-12T13:00:00Z');
    expect(clock.now()).toBe('2026-10-12T13:00:00Z');
    expect(clock.now()).toBe('2026-10-12T13:00:00Z');
  });
});

describe('time-zone validation', () => {
  it('should accept "America/New_York" and "Europe/London" and return their canonical identifiers', () => {
    expect(validateTimeZone('America/New_York')).toEqual({ ok: true, timeZone: 'America/New_York' });
    expect(validateTimeZone('Europe/London')).toEqual({ ok: true, timeZone: 'Europe/London' });
    expect(validateTimeZone('america/new_york')).toEqual({ ok: true, timeZone: 'America/New_York' });
  });

  it('should reject "Mars/Base" and "" with a typed InvalidTimeZone reason', () => {
    // A Workspace zone is a rules-based identity (Workspace contract), so a fixed offset is invalid too.
    for (const id of ['Mars/Base', '', '+05:00']) {
      expect(validateTimeZone(id), id).toEqual({ ok: false, reason: 'InvalidTimeZone' });
    }
  });
});

describe('instant and Workspace-local conversion', () => {
  it('should render 2026-03-09T14:30:00Z as 2026-03-09 10:30 in America/New_York (after the DST change)', () => {
    expect(toWorkspaceLocal('2026-03-09T14:30:00Z', 'America/New_York')).toBe('2026-03-09T10:30');
  });

  it('should convert local 2026-10-12 09:00 in America/New_York to 2026-10-12T13:00:00Z', () => {
    expect(fromWorkspaceLocal('2026-10-12T09:00', 'America/New_York')).toEqual({
      ok: true,
      instant: '2026-10-12T13:00:00Z',
    });
  });

  it('should reject local 2026-03-08 02:30 in America/New_York with a typed NonexistentLocalTime reason', () => {
    expect(fromWorkspaceLocal('2026-03-08T02:30', 'America/New_York')).toEqual({
      ok: false,
      reason: 'NonexistentLocalTime',
    });
  });

  it('should reject local 2026-11-01 01:30 in America/New_York with a typed AmbiguousLocalTime reason', () => {
    expect(fromWorkspaceLocal('2026-11-01T01:30', 'America/New_York')).toEqual({
      ok: false,
      reason: 'AmbiguousLocalTime',
    });
  });
});
