// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RangePosition } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { StopTargetSlider, type SliderFigures } from './StopTargetSlider.tsx';

afterEach(cleanup);

const figures: SliderFigures = { riskToStop: '$450.00', pnl: '+$582.00 · +2.33R', rewardToRisk: '0.89' };
// T-A: 9/17 now, 134/425 at entry.
const placed: RangePosition = { kind: 'Placed', now: Rational.of(9n, 17n), atEntry: Rational.of(134n, 425n) };

describe('placement (P39)', () => {
  it('should place the dot at the share now and the entry tick at the share at entry, on a track running from the Stop colour to the Target colour, with no number in its visible text', () => {
    const { container } = render(<StopTargetSlider position={placed} figures={figures} />);
    const dot = container.querySelector('.slider-now') as HTMLElement;
    const tick = container.querySelector('.slider-entry') as HTMLElement;
    expect(parseFloat(dot.style.left)).toBeCloseTo((9 / 17) * 100, 4);
    expect(parseFloat(tick.style.left)).toBeCloseTo((134 / 425) * 100, 4);
    expect(container.querySelector('.slider-track')).not.toBeNull();
    expect(container.textContent).toBe('');
  });

  it('should give the slider an image role and an accessible description stating the position in words and the Risk to stop, P&L, and Reward : risk', () => {
    render(<StopTargetSlider position={placed} figures={figures} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      '53% of the way from the Stop to the Target, entry at 32%. Risk to stop $450.00, P&L +$582.00 · +2.33R, Reward : risk 0.89.',
    );
  });
});

describe('ends and missing inputs', () => {
  it('should pin the dot at the Stop end with the pinned shape, and say past the Stop in its description, for a share of 0 with StopBreached; and at the Target end with past the Target for TargetReached', () => {
    const atStop: RangePosition = { kind: 'Placed', now: Rational.of(0n), atEntry: Rational.of(1n, 4n), pinned: 'Stop' };
    const { container, rerender } = render(<StopTargetSlider position={atStop} figures={figures} />);
    const dot = () => container.querySelector('.slider-now') as HTMLElement;
    expect(dot().style.left).toBe('0%');
    expect(dot().classList.contains('slider-pinned')).toBe(true);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/^Past the Stop, entry at 25%\./);

    const atTarget: RangePosition = { kind: 'Placed', now: Rational.of(1n), atEntry: Rational.of(1n, 4n), pinned: 'Target' };
    rerender(<StopTargetSlider position={atTarget} figures={figures} />);
    expect(dot().style.left).toBe('100%');
    expect(dot().classList.contains('slider-pinned')).toBe(true);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/^Past the Target, entry at 25%\./);
  });

  it('should show a grey track with no dot, and Mark missing: DEF, Oct 12 as its description, when the Trade is not placed', () => {
    const missing: RangePosition = { kind: 'NotPlaced', reason: 'MissingInput', instrumentKey: 'DEF', date: '2026-10-12' };
    const { container } = render(<StopTargetSlider position={missing} figures={figures} />);
    expect(container.querySelector('.slider-none')).not.toBeNull();
    expect(container.querySelector('.slider-now')).toBeNull();
    expect(container.querySelector('.slider-entry')).toBeNull();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Mark missing: DEF, Mon Oct 12'); // shortDate adds the weekday, as figures.ts does everywhere else
  });
});
