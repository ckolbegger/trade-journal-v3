// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Meter } from './meter.tsx';
import type { MeterNow, MeterProps } from './meter.types.ts';

afterEach(cleanup);

// The rows of prototypes/replay/trade-list.html, as the finished figures a later adapter gives.
const usd = (v: number) => `${v < 0 ? '−' : '+'}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fig = (v: number) => ({ value: v, text: usd(v) });
const now = (v: number, over: Partial<MeterNow> = {}): MeterNow => ({ kind: 'Value', ...fig(v), zone: 'Within', ...over });

// BREN: Stop -$420, Target +$1,260, P&L -$310.
const meter = (over: Partial<MeterProps> = {}) =>
  render(<Meter size="row" stop={fig(-420)} target={fig(1260)} now={now(-310)} {...over} />);
const part = (name: string) => screen.queryByTestId(`meter-${name}`);
const left = (name: string) => parseFloat(part(name)!.style.left);
const width = (name: string) => parseFloat(part(name)!.style.width);
const attr = (name: string, key: string) => part(name)?.getAttribute(key);

describe('Meter (W51)', () => {
  it('should draw a track from the result at the Stop to the result at the Target with a tick at break-even', () => {
    meter();
    expect(part('track')).not.toBeNull();
    expect(left('stop')).toBeCloseTo(0, 1);
    expect(left('target')).toBeCloseTo(100, 1);
    // Break-even is a quarter of the way: 420 of 1,680.
    expect(left('even')).toBeCloseTo(25, 1);
  });

  it('should fill from break-even to the pointer, as profit or loss, outlined for the open part', () => {
    meter();
    // A loss of $310 fills from the pointer (6.55%) to break-even (25%), in the Stop's colour, outlined.
    expect(left('open')).toBeCloseTo(6.55, 1);
    expect(width('open')).toBeCloseTo(18.45, 1);
    expect(attr('open', 'data-tone')).toBe('loss');
    expect(attr('open', 'data-fill')).toBe('outline');
    cleanup();
    meter({ now: now(810) });
    expect(left('open')).toBeCloseTo(25, 1);
    expect(width('open')).toBeCloseTo(48.21, 1);
    expect(attr('open', 'data-tone')).toBe('profit');
  });

  it('should fill the banked part solid', () => {
    // GALT-like: Stop +$150 (locked in), Target +$1,350, banked +$450, P&L +$990.
    meter({ stop: fig(150), target: fig(1350), banked: fig(450), now: now(990) });
    expect(attr('banked', 'data-fill')).toBe('solid');
    expect(attr('banked', 'data-tone')).toBe('profit');
    expect(left('banked')).toBeCloseTo(0, 1);
    expect(width('banked')).toBeCloseTo(33.33, 1);
    cleanup();
    meter({ banked: fig(-150) });
    expect(attr('banked', 'data-tone')).toBe('loss');
    cleanup();
    meter();
    expect(part('banked')).toBeNull();
  });

  it('should draw a faint mark at the session before result', () => {
    meter({ previous: { ...fig(-180), dateLabel: 'Thu Nov 12', direction: 'Down' } });
    // -$180 on a track from -$420 to +$1,260: 14.29%.
    expect(left('previous')).toBeCloseTo(14.29, 1);
    cleanup();
    meter();
    expect(part('previous')).toBeNull();
  });

  it('should stretch the track past a line by a third at most, hatch that part and make the pointer square', () => {
    // DALE: Stop -$400, Target +$300, P&L -$540 (past the Stop by $140). The track grows to -$540: 140 of 840 is 16.67%.
    meter({ stop: fig(-400), target: fig(300), now: now(-540, { zone: 'PastStop', pastBy: '$140.00' }) });
    expect(left('stop')).toBeCloseTo(16.67, 1);
    expect(left('even')).toBeCloseTo(64.29, 1);
    expect(left('pointer')).toBeCloseTo(0, 1);
    expect(attr('pointer', 'data-shape')).toBe('square');
    expect(attr('past', 'data-tone')).toBe('loss');
    expect(left('past')).toBeCloseTo(0, 1);
    expect(width('past')).toBeCloseTo(16.67, 1);
    cleanup();
    // Past the Target by a lot: the track grows by a third of its length (700 / 3) and no more; the pointer rests at its end.
    meter({ stop: fig(-400), target: fig(300), now: now(5000, { zone: 'PastTarget', pastBy: '$4,700.00' }) });
    expect(left('target')).toBeCloseTo(75, 1);
    expect(left('pointer')).toBeCloseTo(100, 1);
    expect(attr('past', 'data-tone')).toBe('profit');
    expect(left('past')).toBeCloseTo(75, 1);
    expect(width('past')).toBeCloseTo(25, 1);
    cleanup();
    meter();
    expect(part('past')).toBeNull();
    expect(attr('pointer', 'data-shape')).toBe('round');
  });

  it('should draw the hatch over the banked fill where the two overlap', () => {
    // Stop +$150, banked +$450, P&L +$60: the hatch (60 to 150) lies inside the banked fill (0 to 450).
    meter({ stop: fig(150), target: fig(1350), banked: fig(450), now: now(60, { zone: 'PastStop', pastBy: '$90.00' }) });
    // Later in the document paints on top of an earlier sibling at the same stacking level.
    expect(part('banked')!.compareDocumentPosition(part('past')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should draw the Stop line to the right of break-even when profit is banked beyond it', () => {
    // GALT: half sold, so the Stop now locks in +$150. Break-even is the track's left end and the Stop is right of it.
    meter({ stop: fig(150), target: fig(1350), banked: fig(450), now: now(990) });
    expect(left('even')).toBeCloseTo(0, 1);
    expect(left('stop')).toBeCloseTo(11.11, 1);
    expect(left('stop')).toBeGreaterThan(left('even'));
    expect(left('target')).toBeCloseTo(100, 1);
    // Past that Stop, the hatch runs from the pointer to the Stop's line, which is still right of break-even.
    cleanup();
    meter({ stop: fig(150), target: fig(1350), now: now(60, { zone: 'PastStop', pastBy: '$90.00' }) });
    expect(left('stop')).toBeGreaterThan(left('even'));
    expect(left('past')).toBeCloseTo(left('pointer'), 1);
    expect(left('past') + width('past')).toBeCloseTo(left('stop'), 1);
  });

  it('should draw a dashed, empty track with no pointer when there is no Mark, keeping the faint mark', () => {
    const { container } = meter({ banked: fig(150), now: { kind: 'Unavailable', reason: 'No Mark for Fri Nov 13: the P&L cannot be placed.' }, previous: { ...fig(-84), dateLabel: 'Thu Nov 12', direction: 'Level' } });
    expect(container.querySelector('.meter')?.getAttribute('data-state')).toBe('empty');
    expect(part('pointer')).toBeNull();
    expect(part('open')).toBeNull();
    expect(part('banked')).toBeNull();
    expect(part('past')).toBeNull();
    expect(part('track')).not.toBeNull();
    expect(left('previous')).toBeCloseTo(20, 1);
    expect(left('stop')).toBeCloseTo(0, 1);
    cleanup();
    expect(meter().container.querySelector('.meter')?.getAttribute('data-state')).toBe('filled');
  });

  it('should show no visible words, and carry its name and its hover text', () => {
    const { container } = meter({
      stop: fig(-600),
      target: fig(1600),
      now: now(990, { share: { percent: '62%', toward: 'Target' } }),
      previous: { ...fig(850), dateLabel: 'Thu Nov 12', direction: 'Up' },
    });
    const name = 'P&L +$990.00, 62% of the way to the Target. Stop −$600.00, Target +$1,600.00. Up from +$850.00 on Thu Nov 12.';
    const box = screen.getByRole('img', { name });
    expect(box.getAttribute('title')).toBe(name);
    expect(container.textContent).toBe('');
    cleanup();
    meter({ stop: fig(-600), target: fig(1600), now: now(-920, { zone: 'PastStop', pastBy: '$180.00' }) });
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('P&L −$920.00, past the Stop by $180.00. Stop −$600.00, Target +$1,600.00.');
    cleanup();
    meter({ stop: fig(-600), target: fig(1600), now: { kind: 'Unavailable', reason: 'No Mark for Fri Nov 13: the P&L cannot be placed.' }, previous: { ...fig(-84), dateLabel: 'Thu Nov 12', direction: 'Level' } });
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('No Mark for Fri Nov 13: the P&L cannot be placed. Stop −$600.00, Target +$1,600.00. Session before −$84.00 on Thu Nov 12.');
  });

  it('should name what was realized Realized, for a loss as for a gain', () => {
    meter({ stop: fig(-600), target: fig(1600), banked: fig(400), now: now(990, { share: { percent: '62%', toward: 'Target' } }) });
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('P&L +$990.00, 62% of the way to the Target. Realized +$400.00. Stop −$600.00, Target +$1,600.00.');
    cleanup();
    meter({ stop: fig(-150), target: fig(1050), banked: fig(-440), now: now(-30) });
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('P&L −$30.00. Realized −$440.00. Stop −$150.00, Target +$1,050.00.');
  });

  it('should draw the same parts at each of its three sizes', () => {
    const props: Partial<MeterProps> = { stop: fig(-600), target: fig(1600), banked: fig(400), now: now(-920, { zone: 'PastStop', pastBy: '$180.00' }), previous: { ...fig(850), dateLabel: 'Thu Nov 12', direction: 'Down' } };
    const partsAt = (size: MeterProps['size']) => {
      const { container, unmount } = meter({ ...props, size });
      const parts = [...container.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid'));
      const root = container.querySelector('.meter');
      const found = { parts, size: root?.getAttribute('data-size'), name: root?.getAttribute('aria-label') };
      unmount();
      return found;
    };
    const card = partsAt('card');
    const row = partsAt('row');
    const detail = partsAt('detail');
    expect(card.parts).toEqual(['meter-track', 'meter-open', 'meter-banked', 'meter-past', 'meter-previous', 'meter-stop', 'meter-target', 'meter-even', 'meter-pointer']);
    expect(row.parts).toEqual(card.parts);
    expect(detail.parts).toEqual(card.parts);
    expect([card.size, row.size, detail.size]).toEqual(['card', 'row', 'detail']);
    expect(row.name).toBe(card.name);
    expect(detail.name).toBe(card.name);
  });

  it('should draw a finite track when the results at the Stop and the Target are both break-even', () => {
    meter({ stop: fig(0), target: fig(0), now: now(0) });
    for (const name of ['stop', 'target', 'even', 'pointer']) {
      expect(Number.isFinite(left(name))).toBe(true);
    }
  });
});
