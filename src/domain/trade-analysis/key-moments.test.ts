import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { keyMoments } from './key-moments.ts';
import type { ReplayedSession } from './replay-series.ts';

const n = (v: number) => Rational.of(BigInt(v));

interface Spec {
  readonly date: string;
  readonly pnl: number;
  readonly held?: number;
  readonly effect?: 'Opened' | 'Added' | 'Reduced' | 'Closed';
  readonly stopFirst?: string;
  readonly targetFirst?: string;
}

function session(s: Spec): ReplayedSession {
  return {
    date: s.date,
    positions: [],
    heldQuantity: n(s.held ?? 10),
    realizedPnl: n(0),
    tradePnl: { kind: 'Value', value: n(s.pnl) },
    change: null,
    marks: [],
    positionChangeIds: [],
    ...(s.effect && { markers: [{ id: 'pc-' + s.date, kind: 'Execution' as const, effect: s.effect, fills: [] }] }),
    crossings: {
      stop: { conditions: [], ...(s.stopFirst && { first: { date: s.stopFirst, afterGap: false } }) },
      target: { conditions: [], ...(s.targetFirst && { first: { date: s.targetFirst, afterGap: false } }) },
    },
  };
}

const series = (...specs: Spec[]) => specs.map(session);

describe('keyMoments', () => {
  it('should give Entry as the first moment', () => {
    const moments = keyMoments(series({ date: '2026-11-02', pnl: 0, effect: 'Opened' }, { date: '2026-11-03', pnl: -5 }, { date: '2026-11-04', pnl: 5 }));
    expect(moments[0]).toEqual({ date: '2026-11-02', kinds: ['Entry'] });
  });

  it('should give the worst and the best session by Trade P&L', () => {
    const moments = keyMoments(series({ date: '2026-11-02', pnl: 0, effect: 'Opened' }, { date: '2026-11-03', pnl: -50 }, { date: '2026-11-04', pnl: 80 }, { date: '2026-11-05', pnl: 20 }));
    expect(moments.filter((m) => m.kinds.includes('Low'))).toEqual([{ date: '2026-11-03', kinds: ['Low'] }]);
    expect(moments.filter((m) => m.kinds.includes('High'))).toEqual([{ date: '2026-11-04', kinds: ['High'] }]);
  });

  it('should give the first session past the Stop, and the session the Target was first reached', () => {
    const moments = keyMoments(
      series(
        { date: '2026-11-02', pnl: 0, effect: 'Opened' },
        { date: '2026-11-03', pnl: -30, stopFirst: '2026-11-03' },
        { date: '2026-11-04', pnl: 10, stopFirst: '2026-11-03' },
        { date: '2026-11-05', pnl: 40, stopFirst: '2026-11-03', targetFirst: '2026-11-05' },
        { date: '2026-11-06', pnl: 35, stopFirst: '2026-11-03', targetFirst: '2026-11-05' },
      ),
    );
    expect(moments.find((m) => m.kinds.includes('Stop'))?.date).toBe('2026-11-03');
    expect(moments.find((m) => m.kinds.includes('Target'))?.date).toBe('2026-11-05');
  });

  it('should give each sale', () => {
    const moments = keyMoments(
      series({ date: '2026-11-02', pnl: 0, effect: 'Opened' }, { date: '2026-11-03', pnl: 5, effect: 'Added' }, { date: '2026-11-04', pnl: 9, effect: 'Reduced' }, { date: '2026-11-05', pnl: 7 }, { date: '2026-11-06', pnl: 8, effect: 'Reduced' }, { date: '2026-11-09', pnl: 6 }),
    );
    expect(moments.filter((m) => m.kinds.includes('Sale')).map((m) => m.date)).toEqual(['2026-11-04', '2026-11-06']);
  });

  it('should give Now for an Open Trade and End for a closed one', () => {
    const open = keyMoments(series({ date: '2026-11-02', pnl: 0, effect: 'Opened' }, { date: '2026-11-03', pnl: 4 }, { date: '2026-11-04', pnl: 2 }));
    expect(open.at(-1)).toEqual({ date: '2026-11-04', kinds: ['Now'] });
    const closed = keyMoments(series({ date: '2026-11-02', pnl: 0, effect: 'Opened' }, { date: '2026-11-03', pnl: 4 }, { date: '2026-11-04', pnl: 2, held: 0 }));
    expect(closed.at(-1)).toEqual({ date: '2026-11-04', kinds: ['End'] });
  });

  it('should give one moment, naming both, for a session that is two things', () => {
    const moments = keyMoments(
      series({ date: '2026-11-02', pnl: 0, effect: 'Opened' }, { date: '2026-11-03', pnl: 60, targetFirst: '2026-11-03' }, { date: '2026-11-04', pnl: 20, targetFirst: '2026-11-03' }),
    );
    expect(moments.filter((m) => m.date === '2026-11-03')).toEqual([{ date: '2026-11-03', kinds: ['Target', 'High'] }]);
  });

  it('should give the moments in session order', () => {
    const moments = keyMoments(
      series(
        { date: '2026-11-02', pnl: 0, effect: 'Opened' },
        { date: '2026-11-03', pnl: -10, stopFirst: '2026-11-03' },
        { date: '2026-11-04', pnl: 70, stopFirst: '2026-11-03', targetFirst: '2026-11-04' },
        { date: '2026-11-05', pnl: -40, stopFirst: '2026-11-03', targetFirst: '2026-11-04' },
        { date: '2026-11-06', pnl: 50, stopFirst: '2026-11-03', targetFirst: '2026-11-04', effect: 'Reduced' },
        { date: '2026-11-09', pnl: 55, stopFirst: '2026-11-03', targetFirst: '2026-11-04' },
      ),
    );
    expect(moments.map((m) => m.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09']);
  });
});
