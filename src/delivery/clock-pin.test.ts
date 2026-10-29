import { describe, expect, it } from 'vitest';
import { pinnedClock } from './faults.ts';

const real = { now: () => '2030-01-01T00:00:00Z' };

describe('pinnedClock', () => {
  it('should fix the clock to the clock query instant for the launch', () => {
    const clock = pinnedClock('?clock=2026-10-09T21:00:00Z', real);
    expect(clock.now()).toBe('2026-10-09T21:00:00Z');
    expect(clock.now()).toBe('2026-10-09T21:00:00Z');
  });
  it('should keep the real clock when the clock query is absent or not an instant', () => {
    expect(pinnedClock('', real)).toBe(real);
    expect(pinnedClock('?clock=yesterday', real)).toBe(real);
    expect(pinnedClock('?clock=2026-10-09T21:00:00', real)).toBe(real);
  });
});
