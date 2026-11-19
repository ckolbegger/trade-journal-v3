import { describe, expect, it } from 'vitest';
import { overlayWordsOf } from './overlay.props.ts';
import { session, view } from './view-doubles.props.ts';

// W53: the overlay's name and header, from the latest session's finished figure.
describe('overlayWordsOf (W53)', () => {
  it('should head an open Trade with its Trade P&L at the latest session, and name the dialog Replay, BREN', () => {
    const open = view([session({ date: '2026-11-11', pnl: 520 }), session({ date: '2026-11-12', pnl: 988 })]);
    expect(overlayWordsOf('BREN', open)).toEqual({ name: 'Replay, BREN', header: 'BREN · Trade P&L +$988.00' });
  });

  it('should head a finished Trade with its Final result', () => {
    const closed = view([session({ date: '2026-11-12', held: 0, pnl: 1138, realized: 1138, final: { kind: 'Sold' } })]);
    expect(overlayWordsOf('BREN', closed).header).toBe('BREN · Final result +$1,138.00');
  });

  it('should head the symbol alone with no replay read yet or no Mark at the latest session', () => {
    expect(overlayWordsOf('CORV')).toEqual({ name: 'Replay, CORV', header: 'CORV' });
    const unmarked = view([session({ date: '2026-11-11', pnl: 520 }), session({ date: '2026-11-12', pnl: null })]);
    expect(overlayWordsOf('CORV', unmarked).header).toBe('CORV');
  });
});
