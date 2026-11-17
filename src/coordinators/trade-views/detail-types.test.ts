import { describe, expect, it } from 'vitest';
import { Rational } from '../../domain/values/index.ts';
import type { ClosedTradeDetail, OpenTradeDetail } from './index.ts';

// A236: a Closed Detail has no open average; the type rejects one, as the Open form accepts it.
describe('Trade Detail types', () => {
  it('a Closed Detail cannot carry an open average, an Open Detail can', () => {
    // @ts-expect-error a Closed Detail has no openAverage (A236)
    const closed: Pick<ClosedTradeDetail, 'openAverage'> = { openAverage: Rational.of(1n) };
    const open: Pick<OpenTradeDetail, 'openAverage'> = { openAverage: Rational.of(1n) };
    expect(open.openAverage).toBeDefined();
    expect(closed).toBeDefined();
  });
});
