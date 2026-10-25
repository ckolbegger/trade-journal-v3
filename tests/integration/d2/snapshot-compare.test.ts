import { describe, expect, it } from 'vitest';
import { compareSnapshot } from '../../../tools/fixtures/snapshot-compare.ts';

// T2.56: tools tests are not collected by the unit project (src/** only), so this lives with the
// Node integration suite, which the cumulative run includes.
const snapshot = { open: [{ symbol: 'KO', averageOpenCost: { value: '10.00' } }, { symbol: 'PFE' }], asOf: 'x' };

describe('compareSnapshot', () => {
  it('should accept a field the current views add', () => {
    const views = { open: [{ symbol: 'KO', averageOpenCost: { value: '10.00' }, summary: { kind: 'LongStock' } }, { symbol: 'PFE' }], asOf: 'x', extra: 1 };
    expect(compareSnapshot(views, snapshot)).toEqual([]);
  });

  it('should name the path of a changed snapshot field', () => {
    const views = { ...snapshot, open: [{ symbol: 'KO', averageOpenCost: { value: '11.00' } }, { symbol: 'PFE' }] };
    expect(compareSnapshot(views, snapshot)).toEqual(['open[0].averageOpenCost.value']);
  });

  it('should name the path of a removed snapshot field', () => {
    const views = { ...snapshot, open: [{ symbol: 'KO' }, { symbol: 'PFE' }] };
    expect(compareSnapshot(views, snapshot)).toEqual(['open[0].averageOpenCost']);
  });

  it('should name the path of reordered array items', () => {
    const views = { ...snapshot, open: [{ symbol: 'PFE' }, { symbol: 'KO', averageOpenCost: { value: '10.00' } }] };
    expect(compareSnapshot(views, snapshot)).toEqual(['open[0].symbol', 'open[0].averageOpenCost', 'open[1].symbol']);
  });

  it('should fail an extra or missing array item', () => {
    const extra = { ...snapshot, open: [...snapshot.open, { symbol: 'X' }] };
    const missing = { ...snapshot, open: snapshot.open.slice(0, 1) };
    expect(compareSnapshot(extra, snapshot)).toEqual(['open (length 3, snapshot 2)']);
    expect(compareSnapshot(missing, snapshot)).toEqual(['open (length 1, snapshot 2)']);
  });
});
