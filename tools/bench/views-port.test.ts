import { afterEach, describe, expect, it, vi } from 'vitest';
import { pinnedOpenRowsOf } from './views-port.ts';

// A row function that says what year the clock reads, as the app's own row function does for an option expiration.
const yearRead = () => ({ headers: ['Year'], rows: [[String(new Date().getUTCFullYear())]] });

describe('bench views port clock', () => {
  afterEach(() => vi.useRealTimers());

  it('should give the rows for the as-of instant whatever year the generator runs in', () => {
    vi.useFakeTimers({ now: new Date('2031-03-04T12:00:00Z'), toFake: ['Date'] });
    const rows = pinnedOpenRowsOf(yearRead)([], 'America/New_York', '2026-05-01T20:00:00.000Z');
    expect(rows.rows).toEqual([['2026']]);
  });

  it('should restore the wall clock after the rows are made, even when the row function throws', () => {
    vi.useFakeTimers({ now: new Date('2031-03-04T12:00:00Z'), toFake: ['Date'] });
    expect(() => pinnedOpenRowsOf(() => { throw new Error('boom'); })([], 'UTC', '2026-05-01T20:00:00.000Z')).toThrow('boom');
    expect(new Date().getUTCFullYear()).toBe(2031);
  });
});
