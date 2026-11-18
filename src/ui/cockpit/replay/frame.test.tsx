// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReplayFrame } from './frame.tsx';
import type { PlotSession, ReplayFrameSession, ReplayPlotProps, ReplayProps } from './replay.types.ts';

afterEach(cleanup);

// BREN's eleven sessions, Mon Nov 2 to Mon Nov 16, as the adapter would finish them: the frame selects, it works out nothing.
const DAYS = ['Mon Nov 2', 'Tue Nov 3', 'Wed Nov 4', 'Thu Nov 5', 'Fri Nov 6', 'Mon Nov 9', 'Tue Nov 10', 'Wed Nov 11', 'Thu Nov 12', 'Fri Nov 13', 'Mon Nov 16'];
const DATES = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16'];
const FIGURES = ['-$40.00 · -0.06R', '-$120.00 · -0.18R', '+$60.00 · 0.09R', '+$150.00 · 0.22R', '+$210.00 · 0.31R', '+$340.00 · 0.50R', '+$520.00 · 0.77R', '+$688.00 · 1.02R', '+$790.00 · 1.17R', '+$838.00 · 1.25R', '+$988.00 · 3.05R'];
const TONES = [-1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

function plotSession(slot: number): PlotSession {
  return { slot, dateLabel: DAYS[slot] ?? `Day ${slot}`, underlyingMark: 100 + slot, tradePnl: slot * 10, banked: 0, resultAtStop: null, resultAtTarget: null, worstCase: null, maxReward: null, markers: [] };
}

function frameSession(index: number): ReplayFrameSession {
  const loss = TONES[index] === -1;
  return {
    date: DATES[index] ?? `2026-11-${20 + index}`,
    sliderValue: `${DAYS[index]} · ${index + 1} of 15`,
    dateLabel: DAYS[index] ?? `Day ${index}`,
    headline: { figure: FIGURES[index] ?? '+$1.00 · 0.01R', tone: loss ? 'Loss' : 'Profit' },
    howItIsGoing: loss ? 'Behind: 12% of the way to the Stop.' : `Ahead: ${index * 8}% of the way to the Target.`,
    stake: null,
    isFinal: false,
    readout: [],
    tableRow: { dateLabel: DAYS[index] ?? '', cells: [], events: [] },
    plot: plotSession(index),
    hover: [],
    hasMarker: false,
  };
}

// The plot double lists what it is given, so a test can see what the frame passes it.
const PlotDouble: ComponentType<ReplayPlotProps> = ({ sessions, sliderIndex }) => (
  <div data-testid="plot" data-slider={sliderIndex}>
    {sessions.map((s) => (
      <span key={s.slot} data-testid="point" data-mark={s.underlyingMark ?? ''}>
        {s.dateLabel}
      </span>
    ))}
  </div>
);

function props(over: Partial<ReplayProps> = {}, count = 11): ReplayProps {
  return {
    tradeKey: 'trade-bren',
    sessions: Array.from({ length: count }, (_, i) => frameSession(i)),
    sliderLabel: 'Session',
    previousLabel: 'Previous session',
    nextLabel: 'Next session',
    tableTitle: 'Session by session',
    tableColumns: [],
    plotBase: { priceTitle: 'BREN price', pnlTitle: 'Trade P&L', accessibleName: 'BREN Marks and Trade P&L by session', describedBy: 'replay-table', anchors: { priceLines: [], planAtStop: null, planAtTarget: null }, axis: { slots: 15, endLabel: 'Fri Nov 20' } },
    Plot: PlotDouble,
    ...over,
  };
}

const slider = () => screen.getByRole('slider', { name: 'Session' });
const value = () => (slider() as HTMLInputElement).value;
const text = (el: Element) => el.textContent ?? '';
const attr = (el: Element, name: string) => el.getAttribute(name);

describe('Replay frame: the slider (W42)', () => {
  it('should open resting on the last session, with its headline', () => {
    render(<ReplayFrame {...props()} />);
    expect(value()).toBe('10');
    expect(text(screen.getByTestId('headline'))).toContain('+$988.00 · 3.05R');
  });

  it('should show an earlier session\'s headline when the slider moves to it', async () => {
    const user = userEvent.setup();
    render(<ReplayFrame {...props()} />);
    await user.click(screen.getByRole('button', { name: 'Previous session' }));
    expect(text(screen.getByTestId('headline'))).toContain('+$838.00 · 1.25R');
    expect(screen.queryByText('Ahead: 72% of the way to the Target.')).not.toBeNull();
  });

  it('should keep every later session out of the DOM: no figure, date or point of a session after the slider\'s', async () => {
    const user = userEvent.setup();
    const { container } = render(<ReplayFrame {...props({ initialSession: '2026-11-04' })} />);
    expect(screen.getAllByTestId('point').map((p) => p.textContent)).toEqual(['Mon Nov 2', 'Tue Nov 3', 'Wed Nov 4']);
    expect(attr(screen.getByTestId('plot'), 'data-slider')).toBe('2');
    for (const later of ['Thu Nov 5', 'Mon Nov 16', '+$150.00', '+$988.00', '4 of 15', '11 of 15']) expect(text(container)).not.toContain(later);
    await user.click(screen.getByRole('button', { name: 'Previous session' }));
    expect(screen.getAllByTestId('point')).toHaveLength(2);
    expect(text(container)).not.toContain('Wed Nov 4');
    expect(text(container)).not.toContain('+$60.00');
  });

  it('should move one session with the Left and Right keys and to either end with Home and End', async () => {
    const user = userEvent.setup();
    render(<ReplayFrame {...props()} />);
    slider().focus();
    await user.keyboard('{ArrowLeft}');
    expect(value()).toBe('9');
    await user.keyboard('{ArrowRight}');
    expect(value()).toBe('10');
    await user.keyboard('{Home}');
    expect(value()).toBe('0');
    expect(text(screen.getByTestId('headline'))).toContain('-$40.00 · -0.06R');
    await user.keyboard('{End}');
    expect(value()).toBe('10');
  });

  it('should name the slider "Session" and speak "Mon Nov 16 · 11 of 15", then the headline, as its value', () => {
    render(<ReplayFrame {...props()} />);
    expect(attr(slider(), 'aria-valuetext')).toBe('Mon Nov 16 · 11 of 15. +$988.00 · 3.05R');
  });

  it('should start from a given session when one is passed in', () => {
    render(<ReplayFrame {...props({ initialSession: '2026-11-12' })} />);
    expect(value()).toBe('8');
    expect(attr(slider(), 'aria-valuetext')).toBe('Thu Nov 12 · 9 of 15. +$790.00 · 1.17R');
  });

  it('should keep the slider\'s session when the same Trade\'s replay is passed in again with one more session', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ReplayFrame {...props({}, 11)} />);
    await user.click(screen.getByRole('button', { name: 'Previous session' }));
    rerender(<ReplayFrame {...props({}, 12)} />);
    expect(value()).toBe('9');
    expect(attr(slider(), 'max')).toBe('11');
    rerender(<ReplayFrame {...props({ tradeKey: 'trade-other' }, 12)} />);
    expect(value()).toBe('11');
  });

  it('should follow a new last session when the slider has not been moved, and keep a moved slider\'s session', async () => {
    const user = userEvent.setup();
    const untouched = render(<ReplayFrame {...props({}, 11)} />);
    untouched.rerender(<ReplayFrame {...props({}, 12)} />);
    expect(value()).toBe('11');
    expect(attr(slider(), 'max')).toBe('11');
    untouched.unmount();
    const moved = render(<ReplayFrame {...props({}, 11)} />);
    await user.click(screen.getByRole('button', { name: 'Previous session' }));
    moved.rerender(<ReplayFrame {...props({}, 12)} />);
    expect(value()).toBe('9');
  });

  it('should tell the screen the slider\'s new session when it moves', async () => {
    const user = userEvent.setup();
    const onSessionChange = vi.fn();
    render(<ReplayFrame {...props({ onSessionChange })} />);
    expect(onSessionChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Previous session' }));
    expect(onSessionChange).toHaveBeenLastCalledWith('2026-11-13');
    slider().focus();
    await user.keyboard('{Home}');
    expect(onSessionChange).toHaveBeenLastCalledWith('2026-11-02');
    fireEvent.change(slider(), { target: { value: '4' } });
    expect(onSessionChange).toHaveBeenLastCalledWith('2026-11-06');
    expect(onSessionChange).toHaveBeenCalledTimes(3);
  });

  it('should edge the card in the result\'s colour and say the result in words, never by colour alone', async () => {
    const user = userEvent.setup();
    render(<ReplayFrame {...props()} />);
    expect(attr(screen.getByTestId('replay-card'), 'data-tone')).toBe('Profit');
    expect(screen.queryByText('Ahead: 80% of the way to the Target.')).not.toBeNull();
    slider().focus();
    await user.keyboard('{Home}');
    expect(attr(screen.getByTestId('replay-card'), 'data-tone')).toBe('Loss');
    expect(screen.queryByText('Behind: 12% of the way to the Stop.')).not.toBeNull();
  });
});
