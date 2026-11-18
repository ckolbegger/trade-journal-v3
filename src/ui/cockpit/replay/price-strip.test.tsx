// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CorridorPlot } from './corridor.tsx';
import type { PlotSession, ReplayPlotProps } from './replay.types.ts';

afterEach(cleanup);

// Doubles from the plan's section 5 and the prototype's model block: BREN's Underlying Marks (bullish) and DALE's.
const BREN_MARKS = [97.2, 97.0, 97.3, 97.1, 97.2, 98.5, 100.2, 101.8, 103.6, 104.6, 104.0];
const DAYS = ['Mon Nov 2', 'Tue Nov 3', 'Wed Nov 4', 'Thu Nov 5', 'Fri Nov 6', 'Mon Nov 9', 'Tue Nov 10', 'Wed Nov 11', 'Thu Nov 12', 'Fri Nov 13', 'Mon Nov 16'];

function session(slot: number, mark: number | null, label?: string): PlotSession {
  return {
    slot,
    dateLabel: DAYS[slot] ?? `Day ${slot}`,
    underlyingMark: mark,
    underlyingLabel: label,
    tradePnl: null,
    banked: 0,
    resultAtStop: null,
    resultAtTarget: null,
    worstCase: null,
    maxReward: null,
    markers: [],
  };
}

function props(over: Partial<ReplayPlotProps> = {}): ReplayPlotProps {
  const sessions = BREN_MARKS.map((m, i) => session(i, m, i === 10 ? '$104.00' : undefined));
  return {
    priceTitle: 'BREN price · one Mark per session',
    priceShortTitle: 'BREN price',
    pnlTitle: 'Trade P&L',
    accessibleName: 'BREN Marks and Trade P&L by session',
    describedBy: 'replay-table',
    sessions,
    anchors: { entryPrice: 97, priceLines: [{ kind: 'Strike', price: 100, label: 'Strike $100' }], planAtStop: null, planAtTarget: null },
    axis: { slots: 15, endLabel: 'Fri Nov 20' },
    sliderIndex: 10,
    ...over,
  };
}

const strip = (container: HTMLElement) => container.querySelector('svg.price-strip') as SVGSVGElement;
const points = (container: HTMLElement) => [...strip(container).querySelectorAll('circle.mark')];
const num = (el: Element, a: string) => Number(el.getAttribute(a));

describe("Corridor: the Underlying's price (W39)", () => {
  it('should draw one point for each revealed session with an Underlying Mark, joined in order', () => {
    const { container } = render(<CorridorPlot {...props()} />);
    expect(points(container)).toHaveLength(11);
    const xs = points(container).map((p) => num(p, 'cx'));
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    const line = strip(container).querySelectorAll('path.mark-line');
    expect(line).toHaveLength(1);
    const d = line[0]!.getAttribute('d')!;
    expect(d.match(/M/g)).toHaveLength(1);
    expect(d.match(/L/g)).toHaveLength(10);
    // The point at 104.60 (Fri Nov 13) is higher on the page than the one at 97.00 (Tue Nov 3).
    expect(num(points(container)[9]!, 'cy')).toBeLessThan(num(points(container)[1]!, 'cy'));
  });

  it('should break the line at a session without a Mark, shade that session and label it "No Mark"', () => {
    const sessions = BREN_MARKS.map((m, i) => session(i, i === 4 ? null : m));
    const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: 10 })} />);
    expect(points(container)).toHaveLength(10);
    const d = strip(container).querySelector('path.mark-line')!.getAttribute('d')!;
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d.match(/L/g)).toHaveLength(8);
    const gap = strip(container).querySelectorAll('rect.no-mark');
    expect(gap).toHaveLength(1);
    // The shade sits on the missing session's column: between the points either side of it.
    const xs = points(container).map((p) => num(p, 'cx'));
    const left = xs[3]!;
    const right = xs[4]!;
    expect(num(gap[0]!, 'x')).toBeGreaterThan(left);
    expect(num(gap[0]!, 'x') + num(gap[0]!, 'width')).toBeLessThan(right);
    expect(screen.getAllByText('No Mark')).toHaveLength(1);
  });

  it("should draw the strike on an option Trade, and a condition's line where the condition is on the Underlying's price", () => {
    const bren = render(<CorridorPlot {...props()} />);
    expect(strip(bren.container).querySelectorAll('path.price-line')).toHaveLength(1);
    expect(screen.getByText('Strike $100')).toBeTruthy();
    expect(screen.queryByText(/^Stop/)).toBeNull();
    cleanup();
    // R-DALE-D: a Cash-Secured Put at $57.50 with its Stop on DALE at $54.00.
    const marks = [56.9, 55.8, 54.6, 53.7];
    const dale = render(
      <CorridorPlot
        {...props({
          sessions: marks.map((m, i) => session(i, m)),
          sliderIndex: 3,
          anchors: {
            entryPrice: 57.5,
            priceLines: [
              { kind: 'Strike', price: 57.5, label: 'Strike $57.50' },
              { kind: 'Stop', price: 54, label: 'Stop $54.00' },
            ],
            planAtStop: null,
            planAtTarget: null,
          },
        })}
      />,
    );
    const lines = [...strip(dale.container).querySelectorAll('path.price-line')];
    expect(lines.map((l) => l.getAttribute('data-kind'))).toEqual(['Strike', 'Stop']);
    const y = (el: Element) => Number(/^M[\d.]+ ([\d.]+)H/.exec(el.getAttribute('d')!)![1]);
    expect(y(lines[1]!)).toBeGreaterThan(y(lines[0]!));
    expect(screen.getByText('Strike $57.50')).toBeTruthy();
    expect(screen.getByText('Stop $54.00')).toBeTruthy();
  });

  it("should run the time axis to the contract's expiration, leaving later sessions blank", () => {
    const sessions = BREN_MARKS.slice(0, 5).map((m, i) => session(i, m));
    const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: 4 })} />);
    const xs = points(container).map((p) => num(p, 'cx'));
    // Even steps, one per trading session, and the five revealed stop well short of the right edge.
    const step = xs[1]! - xs[0]!;
    expect(xs[4]! - xs[0]!).toBeCloseTo(4 * step, 0);
    expect(xs[4]!).toBeLessThan(640 / 2);
    expect(screen.getByText('Fri Nov 20')).toBeTruthy();
    cleanup();
    // A stock Trade's axis ends on its last session, which then sits at the right edge.
    const stock = render(<CorridorPlot {...props({ sessions, sliderIndex: 4, axis: { slots: 5, endLabel: 'Fri Nov 6' } })} />);
    const last = points(stock.container).map((p) => num(p, 'cx')).at(-1)!;
    expect(last).toBeGreaterThan(640 * 0.9);
  });

  it("should size the price axis from the Plan's anchors and the revealed sessions, unchanged by a more extreme later session", () => {
    const strikeY = (c: HTMLElement) => Number(/^M[\d.]+ ([\d.]+)H/.exec(strip(c).querySelector('path.price-line')!.getAttribute('d')!)![1]);
    const series = [...BREN_MARKS.slice(0, 5), 130];
    const early = render(<CorridorPlot {...props({ sessions: series.slice(0, 5).map((m, i) => session(i, m)), sliderIndex: 4 })} />);
    const before = strikeY(early.container);
    cleanup();
    // The session that holds the extreme Mark is not passed until the slider reaches it, so nothing in the axis knows of it.
    const again = render(<CorridorPlot {...props({ sessions: series.slice(0, 5).map((m, i) => session(i, m)), sliderIndex: 4 })} />);
    expect(strikeY(again.container)).toBe(before);
    cleanup();
    // Once revealed, the extreme Mark stretches the axis and stays in view.
    const late = render(<CorridorPlot {...props({ sessions: series.map((m, i) => session(i, m)), sliderIndex: 5 })} />);
    expect(strikeY(late.container)).toBeGreaterThan(before);
    const top = Math.min(...points(late.container).map((p) => num(p, 'cy')));
    expect(top).toBeGreaterThanOrEqual(0);
    // With the Marks inside the anchors' room, only the anchors set the axis.
    cleanup();
    const quiet = render(<CorridorPlot {...props({ sessions: [session(0, 97.2), session(1, 97.4)], sliderIndex: 1 })} />);
    expect(strikeY(quiet.container)).toBe(before);
  });

  it("should mark the slider's session and label its Mark", () => {
    const { container } = render(<CorridorPlot {...props({ sliderIndex: 10 })} />);
    const current = strip(container).querySelectorAll('circle.mark.current');
    expect(current).toHaveLength(1);
    expect(current[0]).toBe(points(container)[10]);
    expect(num(current[0]!, 'r')).toBeGreaterThan(num(points(container)[9]!, 'r'));
    const cursor = strip(container).querySelector('path.cursor')!;
    expect(cursor.getAttribute('d')).toMatch(new RegExp(`^M${num(current[0]!, 'cx')} `));
    // Only the slider's Mark is labelled.
    expect(screen.getAllByText('$104.00')).toHaveLength(1);
    cleanup();
    const earlier = render(<CorridorPlot {...props({ sliderIndex: 4 })} />);
    expect(strip(earlier.container).querySelector('circle.mark.current')).toBe(points(earlier.container)[4]);
    expect(screen.queryByText('$104.00')).toBeNull();
  });

  it('should draw the Mark label with the anchor of the spot it was placed in', () => {
    // The slider's session is the last column, so the label overflows the right edge above and below the dot: it is placed left of it.
    const { container } = render(<CorridorPlot {...props({ compact: true, axis: { slots: 11, endLabel: 'Tue Nov 17' } })} />);
    const label = strip(container).querySelector('text.mark-label')!;
    const dot = strip(container).querySelector('circle.mark.current')!;
    expect(label.getAttribute('text-anchor')).toBe('end');
    // LabelPlacer's estimate of the box (6 per character plus 2), end-anchored: it ends left of the dot.
    expect(num(label, 'x')).toBeLessThan(num(dot, 'cx') - num(dot, 'r'));
  });

  it('should give the chart an accessible name, and describe it by the table', () => {
    const { container } = render(
      <>
        <CorridorPlot {...props()} />
        <table id="replay-table" />
      </>,
    );
    const chart = screen.getByRole('img', { name: 'BREN Marks and Trade P&L by session' });
    expect(chart.getAttribute('aria-describedby')).toBe('replay-table');
    expect(container.querySelector(`#${chart.getAttribute('aria-describedby')}`)).toBeTruthy();
    // The price chart's title (W39), and its phone form.
    expect(screen.getByText('BREN price · one Mark per session')).toBeTruthy();
    cleanup();
    render(<CorridorPlot {...props({ compact: true })} />);
    expect(screen.getByText('BREN price')).toBeTruthy();
    expect(screen.queryByText('BREN price · one Mark per session')).toBeNull();
  });
});
