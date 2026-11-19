// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CorridorPlot } from './corridor.tsx';
import { timeAxis } from './geometry.ts';
import type { LabelledFigure, PlotMarker, PlotSession, ReplayPlotProps } from './replay.types.ts';

afterEach(cleanup);

// Doubles from the plan's section 5: R-BREN-U (a long call, 2 of 4 sold at $4.00 on Thu 11-12, slot 8). The figures
// the plan quotes are exact (+$982 banked +$478 on Thu, +$1,138 Fri, +$988 Mon; Stop -$324 then +$316; Target +$956);
// the quiet days before Wed 11-11 are filler.
const DAYS = ['Mon Nov 2', 'Tue Nov 3', 'Wed Nov 4', 'Thu Nov 5', 'Fri Nov 6', 'Mon Nov 9', 'Tue Nov 10', 'Wed Nov 11', 'Thu Nov 12', 'Fri Nov 13', 'Mon Nov 16'];
const MARKS = [97.2, 97.0, 97.3, 97.1, 97.2, 98.5, 100.2, 101.8, 103.6, 104.6, 104.0];
const PNL = [28, -12, 40, -18, 20, 120, 330, 520, 982, 1138, 988];
const SALE = 8;

const fig = (value: number, label: string, shortLabel?: string): LabelledFigure => ({ value, label, shortLabel });
const stopAt = (i: number): LabelledFigure => (i < SALE ? fig(-324, 'Stop −$324') : fig(316, 'Stop +$316'));
const target = (): LabelledFigure => fig(956, 'Target +$956');
const PAST = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 26, 182, 32];

const sale: PlotMarker = { id: 'x2', kind: 'Execution', effect: 'Reduced', label: 'Sold 2 at $4.00', shortLabel: 'Sold 2', isEntry: false };
const entry: PlotMarker = { id: 'x1', kind: 'Execution', effect: 'Opened', label: 'Bought 4 at $1.68', shortLabel: 'Bought 4', isEntry: true };

function bren(i: number, over: Partial<PlotSession> = {}): PlotSession {
  const banked = i >= SALE;
  return {
    slot: i,
    dateLabel: DAYS[i]!,
    underlyingMark: MARKS[i]!,
    tradePnl: PNL[i]!,
    banked: banked ? 478 : 0,
    bankedLabel: banked ? 'Banked +$478' : undefined,
    resultAtStop: stopAt(i),
    resultAtTarget: target(),
    worstCase: null,
    maxReward: null,
    markers: i === 0 ? [entry] : i === SALE ? [sale] : [],
    ...over,
  };
}

function props(over: Partial<ReplayPlotProps> = {}): ReplayPlotProps {
  return {
    priceTitle: 'BREN price · one Mark per session',
    priceShortTitle: 'BREN price',
    pnlTitle: 'Trade P&L',
    accessibleName: 'BREN Marks and Trade P&L by session',
    describedBy: 'replay-cards',
    sessions: DAYS.map((_, i) => bren(i)),
    anchors: {
      entryPrice: 97,
      priceLines: [{ kind: 'Strike', price: 100, label: 'Strike $100' }],
      planAtStop: fig(-324, 'Stop −$324'),
      planAtTarget: fig(956, 'Target +$956'),
    },
    axis: { slots: 15, endLabels: ['Fri Nov 20'] },
    sliderIndex: 10,
    ...over,
  };
}

const pnl = (c: HTMLElement) => c.querySelector('svg.pnl-chart') as SVGSVGElement;
const num = (el: Element, a: string) => Number(el.getAttribute(a));
const dots = (c: HTMLElement) => [...pnl(c).querySelectorAll('circle.pnl-dot')];
// The y of the break-even line.
const zeroY = (c: HTMLElement) => Number(/^M[\d.]+ ([\d.]+)H/.exec(pnl(c).querySelector('path.break-even')!.getAttribute('d')!)![1]);
// Every y a path moves to, with M, L or V.
const ys = (d: string) => [...d.matchAll(/(?:[ML]-?[\d.]+ |V)(-?[\d.]+)/g)].map((m) => Number(m[1]));

describe('Corridor: the Trade P&L (W40, W41)', () => {
  it('should fill from break-even to each revealed session’s Trade P&L, as profit above and loss below', () => {
    const { container } = render(<CorridorPlot {...props({ sessions: DAYS.slice(0, 5).map((_, i) => bren(i)), sliderIndex: 4 })} />);
    const z = zeroY(container);
    const profit = pnl(container).querySelector('path.area.profit')!;
    const loss = pnl(container).querySelector('path.area.loss')!;
    // Sessions 0 (+28), 2 (+40), 4 (+20) are above break-even; 1 (-12) and 3 (-18) below.
    expect(Math.min(...ys(profit.getAttribute('d')!))).toBeLessThan(z);
    expect(Math.max(...ys(profit.getAttribute('d')!))).toBeLessThanOrEqual(z);
    expect(Math.max(...ys(loss.getAttribute('d')!))).toBeGreaterThan(z);
    expect(Math.min(...ys(loss.getAttribute('d')!))).toBeGreaterThanOrEqual(z);
    // A bigger result reaches further from break-even.
    cleanup();
    const full = render(<CorridorPlot {...props()} />);
    const top = Math.min(...ys(pnl(full.container).querySelector('path.area.profit')!.getAttribute('d')!));
    const yFri = num(dots(full.container)[9]!, 'cy');
    expect(top).toBe(yFri);
    expect(yFri).toBeLessThan(num(dots(full.container)[8]!, 'cy'));
    expect(screen.getByText('Break-even')).toBeTruthy();
  });

  it('should meet the profit and loss fills at break-even between sessions of opposite sign, with no overlap', () => {
    const sessions = [bren(0, { tradePnl: 100 }), bren(1, { tradePnl: -100 })];
    const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: 1 })} />);
    const z = zeroY(container);
    const [xa, xb] = dots(container).map((d) => num(d, 'cx'));
    const verticesAtZero = (cls: string) =>
      [...pnl(container).querySelector(`path.area.${cls}`)!.getAttribute('d')!.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)]
        .map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
        .filter((p) => p.y === z && p.x > xa! && p.x < xb!);
    // Both fills turn at the break-even crossing, halfway between +100 and -100, so neither slopes across the gap.
    const mid = (xa! + xb!) / 2;
    for (const cls of ['profit', 'loss']) {
      const at = verticesAtZero(cls);
      expect(at).toHaveLength(1);
      expect(Math.abs(at[0]!.x - mid)).toBeLessThan(0.2);
    }
  });

  it('should break the area at a session without a figure', () => {
    // R-CORV-D has no put Mark on one session: its Trade P&L is missing, and the lines still come from the Plan.
    const sessions = DAYS.slice(0, 7).map((_, i) => (i === 3 ? bren(i, { tradePnl: null, underlyingMark: null }) : bren(i)));
    const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: 6 })} />);
    const area = pnl(container).querySelector('path.area.profit')!.getAttribute('d')!;
    expect(area.match(/M/g)).toHaveLength(2);
    // Nothing is drawn on the missing session's column: no point, and no area edge crosses it.
    expect(dots(container)).toHaveLength(6);
    const gapX = dots(container).map((d) => num(d, 'cx'));
    const mid = (a: number, b: number) => (a + b) / 2;
    const lo = mid(gapX[2]!, gapX[3]!) - 1;
    const hi = mid(gapX[2]!, gapX[3]!) + 1;
    const edgeXs = [...area.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1]));
    expect(edgeXs.some((x) => x > lo && x < hi)).toBe(false);
    // The area runs to the edge of the gap's column and no further (T9AR.11, P146): nothing inside the column itself.
    const time = timeAxis(640, 15);
    expect(edgeXs.some((x) => x > time.x(3) - time.column / 2 + 0.1 && x < time.x(3) + time.column / 2 - 0.1)).toBe(false);
  });

  it('should run a lone session area between two No Mark sessions to the edge of each shaded column, and end it upright', () => {
    const sessions = [bren(0, { tradePnl: null }), bren(1, { tradePnl: 100 }), bren(2, { tradePnl: null }), bren(3, { tradePnl: -60 }), bren(4, { tradePnl: null })];
    const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: 3 })} />);
    const time = timeAxis(640, 15);
    const z = zeroY(container);
    for (const [cls, slot] of [['profit', 1], ['loss', 3]] as const) {
      const d = pnl(container).querySelector(`path.area.${cls}`)!.getAttribute('d')!;
      const pts = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
      const [left, right] = [time.x(slot) - time.column / 2, time.x(slot) + time.column / 2];
      expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(left, 0);
      expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(right, 0);
      // Upright: each side is a vertical edge from break-even to the figure.
      for (const edge of [left, right]) {
        const ends = pts.filter((p) => Math.abs(p.x - edge) < 0.1).map((p) => p.y);
        expect(ends).toContain(z);
        expect(ends.some((y) => y !== z)).toBe(true);
      }
    }
  });

  it('should fill a single session with a figure between two gaps, and the first revealed session', () => {
    const sessions = [bren(0, { tradePnl: null }), bren(1, { tradePnl: 100 }), bren(2, { tradePnl: null }), bren(3, { tradePnl: -60 }), bren(4, { tradePnl: null })];
    const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: 3 })} />);
    const z = zeroY(container);
    const [up, down] = dots(container);
    const xs = (cls: string) => [...pnl(container).querySelector(`path.area.${cls}`)!.getAttribute('d')!.matchAll(/[ML](-?[\d.]+) /g)].map((m) => Number(m[1]));
    // Each lone session gets a block across its own column, from break-even to its figure, and none reaches a neighbour.
    for (const [cls, dot] of [['profit', up!], ['loss', down!]] as const) {
      const d = pnl(container).querySelector(`path.area.${cls}`)!.getAttribute('d')!;
      const [cx, cy] = [num(dot, 'cx'), num(dot, 'cy')];
      expect(d.match(/M/g)).toHaveLength(1);
      expect(ys(d)).toContain(cy);
      expect(ys(d)).toContain(z);
      expect(Math.min(...xs(cls))).toBeLessThan(cx);
      expect(Math.max(...xs(cls))).toBeGreaterThan(cx);
      // P146: no further than the edge of its own column (the neighbours' shaded columns begin there).
      const half = timeAxis(640, 15).column / 2;
      expect(Math.min(...xs(cls))).toBeGreaterThanOrEqual(cx - half - 0.1);
      expect(Math.max(...xs(cls))).toBeLessThanOrEqual(cx + half + 0.1);
    }
    // The first revealed session, alone, is filled as well.
    cleanup();
    const first = render(<CorridorPlot {...props({ sessions: [bren(0)], sliderIndex: 0 })} />);
    const d = pnl(first.container).querySelector('path.area.profit')!.getAttribute('d')!;
    expect(Math.min(...ys(d))).toBe(num(dots(first.container)[0]!, 'cy'));
  });

  it('should draw the result at the Stop and at the Target as two lines that step on the session of a Position Change, labelled "Stop +$316" and "Target +$956"', () => {
    const { container } = render(<CorridorPlot {...props()} />);
    const stop = pnl(container).querySelector('path.result-line.stop')!.getAttribute('d')!;
    const target = pnl(container).querySelector('path.result-line.target')!.getAttribute('d')!;
    const cx = dots(container).map((d) => num(d, 'cx'));
    // The Stop line steps up once, at the left edge of Thu 11-12's column (halfway between Wed's point and Thu's).
    const steps = [...stop.matchAll(/H(-?[\d.]+)V(-?[\d.]+)/g)];
    expect(steps).toHaveLength(1);
    expect(Number(steps[0]![1])).toBeCloseTo((cx[7]! + cx[8]!) / 2, 0);
    const before = ys(stop.match(/^M[\d.]+ [\d.]+/)![0])[0]!;
    expect(Number(steps[0]![2])).toBeLessThan(before);
    // The Target line never steps.
    expect(target).not.toMatch(/V/);
    // It runs to the slider's session and no further, and each line is labelled with the slider's figure.
    expect(Number(stop.match(/H(-?[\d.]+)$/)![1])).toBeLessThan(cx[10]! + 20);
    expect(screen.getByText('Stop +$316')).toBeTruthy();
    expect(screen.getByText('Target +$956')).toBeTruthy();
    expect(screen.queryByText('Stop −$324')).toBeNull();
  });

  it('should start both lines from the Plan column, at the Plan’s results', () => {
    const { container } = render(<CorridorPlot {...props()} />);
    const cx = dots(container).map((d) => num(d, 'cx'));
    const column = cx[1]! - cx[0]!;
    for (const kind of ['stop', 'target']) {
      const d = pnl(container).querySelector(`path.result-line.${kind}`)!.getAttribute('d')!;
      const start = /^M(-?[\d.]+) (-?[\d.]+)/.exec(d)!;
      // One column before the first session: the Plan's own column.
      expect(Number(start[1])).toBeCloseTo(cx[0]! - column, 0);
    }
    cleanup();
    // The Plan's result differs from the first session's: the line starts at the Plan's and steps onto the session's.
    const moved = render(
      <CorridorPlot {...props({ anchors: { ...props().anchors, planAtStop: fig(-400, 'Stop −$400') } })} />,
    );
    const stop = pnl(moved.container).querySelector('path.result-line.stop')!.getAttribute('d')!;
    const first = /^M(-?[\d.]+) (-?[\d.]+)H(-?[\d.]+)V(-?[\d.]+)/.exec(stop)!;
    const cx0 = dots(moved.container).map((d) => num(d, 'cx'))[0]!;
    expect(Number(first[3])).toBeCloseTo(cx0 - column / 2, 0);
    expect(Number(first[2])).toBeGreaterThan(Number(first[4]));
  });

  it('should draw what is banked as a solid band from the sale’s session, labelled "Banked +$478", and a realized loss as "Realized −$495"', () => {
    const { container } = render(<CorridorPlot {...props()} />);
    const band = pnl(container).querySelector('path.banked-band.gain')!;
    const d = band.getAttribute('d')!;
    const cx = dots(container).map((p) => num(p, 'cx'));
    const z = zeroY(container);
    // It starts at the left edge of Thu 11-12's column, runs to the slider's and stays above break-even.
    expect(Number(/^M(-?[\d.]+) /.exec(d)![1])).toBeCloseTo((cx[7]! + cx[8]!) / 2, 0);
    expect(Math.max(...ys(d))).toBeLessThanOrEqual(z);
    expect(Math.min(...ys(d))).toBeLessThan(z);
    expect(pnl(container).querySelectorAll('path.banked-band')).toHaveLength(1);
    expect(screen.getByText('Banked +$478')).toBeTruthy();
    expect(pnl(container).querySelector('path.banked-band.loss')).toBeNull();
    cleanup();
    // R-DALE-D buys back 3 at $2.59 on Tue 11-10 (slot 1): a realized loss of -$495, drawn below break-even.
    const dale = [-720, -1065, -1150, -1272].map((p, i): PlotSession => ({
      slot: i,
      dateLabel: `Day ${i}`,
      underlyingMark: 56 - i,
      tradePnl: p,
      banked: i >= 1 ? -495 : 0,
      bankedLabel: i >= 1 ? 'Realized −$495' : undefined,
      resultAtStop: fig(-1263, 'Stop −$1,263'),
      resultAtTarget: fig(-273, 'Target −$273'),
      worstCase: null,
      maxReward: null,
      markers: [],
    }));
    const loss = render(<CorridorPlot {...props({ sessions: dale, sliderIndex: 3 })} />);
    const lossBand = pnl(loss.container).querySelector('path.banked-band.loss')!;
    expect(Math.min(...ys(lossBand.getAttribute('d')!))).toBeGreaterThanOrEqual(zeroY(loss.container));
    expect(Math.max(...ys(lossBand.getAttribute('d')!))).toBeGreaterThan(zeroY(loss.container));
    expect(screen.getByText('Realized −$495')).toBeTruthy();
    // A negative axis label reads with the minus sign.
    expect(screen.getByText('−$1,000')).toBeTruthy();
    expect(screen.queryByText(/^Banked/)).toBeNull();
  });

  it('should hatch the area past a line and label it "$32 past the Target"', () => {
    const sessions = DAYS.map((_, i) => bren(i, PAST[i] === undefined ? {} : { past: { line: 'Target', label: `$${PAST[i]} past the Target`, shortLabel: `$${PAST[i]} past` } }));
    const { container } = render(<CorridorPlot {...props({ sessions })} />);
    const hatch = [...pnl(container).querySelectorAll('rect.hatch.target')];
    // Thu, Fri and Mon are past the Target: each hatches from the Target's level to the result.
    expect(hatch).toHaveLength(3);
    expect(hatch[0]!.getAttribute('fill')).toMatch(/^url\(#/);
    const cx = dots(container).map((p) => num(p, 'cx'));
    const cy = dots(container).map((p) => num(p, 'cy'));
    expect(num(hatch[0]!, 'x') + num(hatch[0]!, 'width') / 2).toBeCloseTo(cx[8]!, 0);
    const level = Number(/^M[\d.]+ ([\d.]+)/.exec(pnl(container).querySelector('path.result-line.target')!.getAttribute('d')!)![1]);
    // Fri's hatch runs from the Target's level up to the +$1,138 point; nothing is hatched before the sale.
    expect(num(hatch[1]!, 'y')).toBeCloseTo(cy[9]!, 0);
    expect(num(hatch[1]!, 'y') + num(hatch[1]!, 'height')).toBeCloseTo(level, 0);
    // Only the slider's session is labelled.
    expect(screen.getByText('$32 past the Target')).toBeTruthy();
    expect(screen.queryByText('$182 past the Target')).toBeNull();
    cleanup();
    // Earlier, before the result passed the line: nothing hatched, no label.
    const early = render(<CorridorPlot {...props({ sessions: sessions.slice(0, 8), sliderIndex: 7 })} />);
    expect(early.container.querySelectorAll('rect.hatch')).toHaveLength(0);
  });

  it('should draw what is at stake once, at the slider’s session, in neutral ink, tagged with the Risk to stop and the Reward to target', () => {
    // Every session carries a stake; only the slider's is drawn.
    const stakes = DAYS.map((_, i) =>
      i === 0
        ? { riskLabel: 'Risk to stop $352', riskShortLabel: 'Risk $352', rewardLabel: 'Reward to target $928', rewardShortLabel: 'Reward $928' }
        : { riskLabel: `Risk to stop $${300 + i}`, rewardLabel: `Reward to target $${900 + i}` },
    );
    const sessions = DAYS.map((_, i) => bren(i, { stake: stakes[i] }));
    const { container } = render(<CorridorPlot {...props({ sessions: sessions.slice(0, 1), sliderIndex: 0 })} />);
    const beams = [...pnl(container).querySelectorAll('path.stake-beam')];
    expect(beams).toHaveLength(2);
    const dot = dots(container)[0]!;
    const risk = pnl(container).querySelector('path.stake-beam.risk')!.getAttribute('d')!;
    const reward = pnl(container).querySelector('path.stake-beam.reward')!.getAttribute('d')!;
    // One beam down from the result to the Stop's level (-$324), one up to the Target's (+$956), at the slider's column.
    expect(risk).toMatch(new RegExp(`^M${num(dot, 'cx')} `));
    expect(Math.min(...ys(risk))).toBeCloseTo(num(dot, 'cy'), 0);
    expect(Math.max(...ys(risk))).toBeGreaterThan(zeroY(container));
    expect(Math.max(...ys(reward))).toBeCloseTo(num(dot, 'cy'), 0);
    expect(Math.min(...ys(reward))).toBeLessThan(num(dot, 'cy') - 20);
    expect(pnl(container).querySelectorAll('g.stake')).toHaveLength(1);
    expect(screen.getByText('Risk to stop $352')).toBeTruthy();
    expect(screen.getByText('Reward to target $928')).toBeTruthy();
    cleanup();
    // Further on, only the slider's session's tags: the Mon 11-16 stake has no reward left to tag.
    const mon = DAYS.map((_, i) => bren(i, i === 10 ? { stake: { riskLabel: 'Risk to stop $672', riskShortLabel: 'Risk $672' } } : { stake: stakes[i] }));
    const later = render(<CorridorPlot {...props({ sessions: mon })} />);
    expect(screen.getByText('Risk to stop $672')).toBeTruthy();
    expect(screen.queryByText(/^Reward to target/)).toBeNull();
    expect(screen.queryByText('Risk to stop $352')).toBeNull();
    expect(later.container.querySelectorAll('path.stake-beam')).toHaveLength(1);
    cleanup();
    // The phone wording.
    // (T9AR.12: on the phone the tags are in the strip under the drawing.)
    const phone = render(<CorridorPlot {...props({ sessions: sessions.slice(0, 1), sliderIndex: 0, compact: true })} />);
    expect(phone.container.querySelector('.replay-strip-labels')!.textContent).toContain('Risk $352 · Reward $928');
  });

  it('should draw a dashed line through both charts at each Position Change after the entry, labelled "Sold 2 at $4.00"', () => {
    const { container } = render(<CorridorPlot {...props()} />);
    const price = container.querySelector('svg.price-strip')!;
    const x = num(dots(container)[8]!, 'cx');
    // The entry (session 0) has none; the sale (session 8) has one in each chart, on its session.
    for (const chart of [price, pnl(container)]) {
      const lines = [...chart.querySelectorAll('path.marker-line')];
      expect(lines).toHaveLength(1);
      expect(lines[0]!.getAttribute('d')).toMatch(new RegExp(`^M${x} `));
    }
    // Labelled once, and the entry's own words are not drawn.
    expect(screen.getAllByText('Sold 2 at $4.00')).toHaveLength(1);
    expect(screen.queryByText('Bought 4 at $1.68')).toBeNull();
    cleanup();
    // (T9AR.12: on the phone the sale is named in the strip under the drawing.)
    const phone = render(<CorridorPlot {...props({ compact: true })} />);
    expect(phone.container.querySelector('.replay-strip-labels')!.textContent).toContain('Sold 2');
    expect(screen.queryByText('Sold 2 at $4.00')).toBeNull();
    cleanup();
    // Before the sale is revealed there is no line.
    const early = render(<CorridorPlot {...props({ sessions: DAYS.slice(0, 5).map((_, i) => bren(i)), sliderIndex: 4 })} />);
    expect(early.container.querySelectorAll('path.marker-line')).toHaveLength(0);
  });

  it('should draw the Worst case and the Max reward only when they fall inside the chart’s range', () => {
    // R-DALE-D after the buy-back: the Worst case (-$33,936) is far outside the chart; the Max reward (+$564) is near.
    const dale = (worst: number, max: number): PlotSession[] =>
      [-720, -1065, -1150, -1272].map((p, i) => ({
        slot: i,
        dateLabel: `Day ${i}`,
        underlyingMark: 56 - i,
        tradePnl: p,
        banked: i >= 1 ? -495 : 0,
        resultAtStop: fig(-1263, 'Stop −$1,263'),
        resultAtTarget: fig(-273, 'Target −$273'),
        worstCase: fig(worst, `Worst case ${worst < 0 ? '−' : '+'}$${Math.abs(worst).toLocaleString('en-US')}`),
        maxReward: fig(max, `Max reward ${max < 0 ? '−' : '+'}$${Math.abs(max).toLocaleString('en-US')}`),
        markers: [],
      }));
    const anchors = { priceLines: [], planAtStop: fig(-1536, 'Stop −$1,536'), planAtTarget: fig(444, 'Target +$444') };
    const { container } = render(<CorridorPlot {...props({ sessions: dale(-33936, 564), sliderIndex: 3, anchors })} />);
    expect(screen.getByText('Max reward +$564')).toBeTruthy();
    expect(pnl(container).querySelectorAll('path.max-reward')).toHaveLength(1);
    expect(screen.queryByText(/^Worst case/)).toBeNull();
    expect(pnl(container).querySelectorAll('path.worst-case')).toHaveLength(0);
    // The line sits above the Target's level, as +$564 is above +$444.
    const targetY = Number(/^M[\d.]+ ([\d.]+)/.exec(pnl(container).querySelector('path.result-line.target')!.getAttribute('d')!)![1]);
    expect(Number(/^M[\d.]+ ([\d.]+)/.exec(pnl(container).querySelector('path.max-reward')!.getAttribute('d')!)![1])).toBeLessThan(targetY);
    cleanup();
    // Neither one stretches the chart: with both near, both are drawn; with the Max reward far above, it is left out.
    render(<CorridorPlot {...props({ sessions: dale(-1500, 99999), sliderIndex: 3, anchors })} />);
    expect(screen.getByText('Worst case −$1,500')).toBeTruthy();
    expect(screen.queryByText(/^Max reward/)).toBeNull();
    cleanup();
    // Not Applicable (null) draws nothing.
    const none = render(<CorridorPlot {...props({ sessions: dale(-1500, 500).map((s) => ({ ...s, worstCase: null, maxReward: null })), sliderIndex: 3, anchors })} />);
    expect(none.container.querySelectorAll('path.worst-case, path.max-reward')).toHaveLength(0);
  });

  // T9AR.10-B3 (A280): the cursor's column is held free; no level label is placed over it.
  it('should keep the Worst case and Max reward labels out of the cursor’s column at the last session', () => {
    const sessions: PlotSession[] = [0, 1, 2, 3].map((i) => ({
      slot: i,
      dateLabel: `Day ${i}`,
      underlyingMark: 56 - i,
      tradePnl: -700 - i * 10,
      banked: 0,
      resultAtStop: fig(-1263, 'Stop −$1,263'),
      resultAtTarget: fig(-273, 'Target −$273'),
      worstCase: fig(-1500, 'Worst case −$1,500'),
      maxReward: fig(500, 'Max reward +$500'),
      markers: [],
    }));
    const anchors = { priceLines: [], planAtStop: fig(-1536, 'Stop −$1,536'), planAtTarget: fig(444, 'Target +$444') };
    const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: 3, anchors, axis: { slots: 4 } })} />);
    const chart = pnl(container);
    const xc = Number(/^M([\d.]+) /.exec(chart.querySelector('path.cursor')!.getAttribute('d')!)![1]);
    const half = Number(/H([\d.]+)$/.exec(chart.querySelector('path.result-line.target')!.getAttribute('d')!)![1]) - xc;
    for (const cls of ['worst-case-label', 'max-reward-label']) {
      const label = chart.querySelector(`text.${cls}`);
      if (!label) continue; // a label with no free place is not drawn, and neither is its line
      const x1 = Number(label.getAttribute('x'));
      const x0 = x1 - (label.textContent.length * 6 + 2);
      expect(x1 <= xc - half || xc + half <= x0).toBe(true);
    }
  });

  // T9.19-B3: the Worst case and the Max reward step with each revealed session's own figure and stop at the slider's session.
  describe('the Worst case and Max reward lines per session', () => {
    const anchors = { priceLines: [], planAtStop: fig(-324, 'Stop −$324'), planAtTarget: fig(956, 'Target +$956') };
    const draw = (kind: string, sessions: PlotSession[], slider = sessions.length - 1) => {
      const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: slider, anchors })} />);
      return pnl(container).querySelector(`path.${kind}`)?.getAttribute('d') ?? null;
    };
    const lastX = (d: string) => Number(/H([\d.]+)$/.exec(d)![1]);

    it('should step the Worst case at the sale and end at the slider session', () => {
      // BREN: -$644 before the sale, +$156 from it; the slider on the sale's session.
      const sessions = DAYS.slice(0, SALE + 1).map((_, i) => bren(i, { tradePnl: i === 0 ? -700 : PNL[i]!, worstCase: i >= SALE ? fig(156, 'Worst case +$156') : fig(-644, 'Worst case −$644') }));
      const d = draw('worst-case', sessions)!;
      expect(d.match(/V/g)).toHaveLength(1);
      expect(d).not.toMatch(/^M[\d.]+ [\d.]+H[\d.]+$/);
      const sliderRight = Number(/H([\d.]+)$/.exec(draw('result-line.target', sessions)!)![1]);
      expect(lastX(d)).toBe(sliderRight);
    });

    it('should draw the Max reward as one level that ends at the slider session', () => {
      const sessions = [0, 1, 2].map((i) => ({ ...bren(i), tradePnl: -700 + i * 10, maxReward: fig(564, 'Max reward +$564') }));
      const d = draw('max-reward', sessions)!;
      expect(d).not.toContain('V');
      const sliderRight = Number(/H([\d.]+)$/.exec(draw('result-line.target', sessions)!)![1]);
      expect(lastX(d)).toBe(sliderRight);
      // The frame passes the revealed sessions only: with the slider on the second, the line ends there.
      cleanup();
      expect(lastX(draw('max-reward', sessions.slice(0, 2))!)).toBeLessThan(lastX(d));
    });

    it('should draw no segment for a session whose Worst case is unavailable', () => {
      const sessions = [0, 1, 2, 3].map((i) => bren(i, { tradePnl: -700, worstCase: i === 1 || i === 2 ? null : fig(-644, 'Worst case −$644') }));
      const d = draw('worst-case', sessions)!;
      expect(d.match(/M/g)).toHaveLength(2);
    });
  });

  it('should leave out a label that has no free spot, and never the result', () => {
    // Eight Position Changes on the slider's session, the Stop and the Target at the same level, and a stake: the
    // chart has room for only some of the marker labels, and none for a second label at the same level.
    const crowd: PlotMarker[] = Array.from({ length: 8 }, (_, k) => ({ id: `m${k}`, kind: 'Execution', effect: 'Reduced', label: `Sold ${k + 1} at $4.00`, isEntry: false }));
    const level = fig(316, 'Stop +$316');
    const sessions = DAYS.map((_, i) =>
      i < 10
        ? bren(i)
        : bren(i, { markers: crowd, resultAtStop: level, resultAtTarget: fig(316, 'Target +$316'), stake: { riskLabel: 'Risk to stop $672', rewardLabel: 'Reward to target $0' } }),
    );
    const { container } = render(<CorridorPlot {...props({ sessions })} />);
    const kept = pnl(container).querySelectorAll('text.marker-label');
    expect(kept.length).toBeGreaterThan(0);
    // Nine in all (the sale's and the eight): room for only some.
    expect(kept.length).toBeLessThan(9);
    // Their lines are still drawn: only the words are left out.
    expect(pnl(container).querySelectorAll('path.marker-line')).toHaveLength(2);
    // The result labels stay, even where they have no free spot; a stake tag with none is left out.
    expect(screen.getByText('Stop +$316')).toBeTruthy();
    expect(screen.getByText('Target +$316')).toBeTruthy();
    expect(screen.queryByText('Reward to target $0')).toBeNull();
    cleanup();
    // The price strip's labels follow the same rule: three lines at one price leave room for only two labels, and a line is drawn only with its label (T9AR.10).
    const same = (kind: 'Strike' | 'Stop' | 'Target') => ({ kind, price: 100, label: `${kind} $100` });
    const labelled = DAYS.map((_, i) => bren(i, i === 10 ? { underlyingLabel: '$104.00' } : {}));
    const strip = render(<CorridorPlot {...props({ sessions: labelled, anchors: { ...props().anchors, priceLines: [same('Strike'), same('Stop'), same('Target')] } })} />);
    expect(strip.container.querySelectorAll('svg.price-strip path.price-line')).toHaveLength(2);
    expect(strip.container.querySelectorAll('svg.price-strip text.price-line-label')).toHaveLength(2);
    // The Mark's own label is the result: it stays.
    expect(screen.getByText('$104.00')).toBeTruthy();
  });

  it('should label each banked level with its own figure, at that level, when a later sale changes it', () => {
    // A second sale on Mon 11-16 (slot 10) takes what is banked from +$478 to +$700: one run, two levels.
    const sessions = DAYS.map((_, i) => bren(i, i === 10 ? { banked: 700, bankedLabel: 'Banked +$700' } : {}));
    const { container } = render(<CorridorPlot {...props({ sessions })} />);
    const first = screen.getByText('Banked +$478');
    const second = screen.getByText('Banked +$700');
    // Each label sits at its own level: the lower figure lower on the chart, in an earlier column.
    expect(num(first, 'y')).toBeGreaterThan(num(second, 'y'));
    expect(num(first, 'x')).toBeLessThan(num(second, 'x'));
    expect(pnl(container).querySelectorAll('text.banked-label')).toHaveLength(2);
  });

  it('should keep the banked label when a stake tag competes for its space', () => {
    // The sale's session is the slider's: a realized loss of -$440 starts there, and the stake tags sit in the same column.
    const sessions = DAYS.slice(0, SALE + 1).map((_, i) =>
      bren(i, {
        tradePnl: i === SALE ? -920 : 0,
        banked: i === SALE ? -440 : 0,
        bankedLabel: i === SALE ? 'Realized −$440' : undefined,
        resultAtStop: fig(-740, 'Stop −$740'),
        resultAtTarget: fig(160, 'Target +$160'),
        stake: i === SALE ? { riskLabel: 'Risk to stop $180', rewardLabel: 'Reward to target $1,080' } : undefined,
      }),
    );
    const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: SALE })} />);
    expect(screen.getByText('Realized −$440')).toBeTruthy();
    // A stake tag with no free spot is left out (its figure stays in the readout), so one of the two gives way.
    expect(pnl(container).querySelectorAll('text.stake-tag').length).toBeLessThan(2);
  });

  // T9.11-B5: one hit area per revealed session, shared by both charts (they use the same time axis), in a group beside
  // the charts' image: a button named by the session's date label.
  const hits = (): HTMLElement[] => screen.getAllByRole('button');

  it('should report hover and focus on a revealed session, and its end on leave and blur', () => {
    const seen: (number | null)[] = [];
    render(<CorridorPlot {...props({ sessions: DAYS.slice(0, 4).map((_, i) => bren(i)), onHoverSession: (i) => seen.push(i) })} />);
    expect(hits().map((h) => h.getAttribute('aria-label'))).toEqual(DAYS.slice(0, 4));
    fireEvent.pointerEnter(hits()[2]!);
    fireEvent.pointerLeave(hits()[2]!);
    fireEvent.focus(hits()[3]!);
    fireEvent.blur(hits()[3]!);
    expect(seen).toEqual([2, null, 3, null]);
  });

  it('should not report hover for a touch or pen pointer, only for a mouse', () => {
    const seen: (number | null)[] = [];
    render(<CorridorPlot {...props({ sessions: DAYS.slice(0, 4).map((_, i) => bren(i)), onHoverSession: (i) => seen.push(i) })} />);
    for (const pointerType of ['touch', 'pen']) {
      fireEvent.pointerEnter(hits()[1]!, { pointerType });
      fireEvent.pointerLeave(hits()[1]!, { pointerType });
    }
    expect(seen).toEqual([]);
    fireEvent.pointerEnter(hits()[2]!, { pointerType: 'mouse' });
    fireEvent.pointerMove(hits()[2]!, { pointerType: 'mouse' });
    expect(seen).toEqual([2]);
  });

  // T9AR.24-B5: a tap elsewhere (the Review card's Replay button) opens the chart under the finger, and the browser then
  // sends the hit under it a mouse pointerenter with no mouse behind it: that is no hover.
  // Part 2: the browser's own enter comes with no pointermove (a real mouse always moves), so a mouse hovers from its first move.
  it('should report a mouse hover only from a real pointermove, not from the pointerenter alone, at any time after a touch', () => {
    const seen: (number | null)[] = [];
    render(<CorridorPlot {...props({ sessions: DAYS.slice(0, 4).map((_, i) => bren(i)), onHoverSession: (i) => seen.push(i) })} />);
    fireEvent.pointerDown(document.body, { pointerType: 'touch' });
    fireEvent.pointerUp(document.body, { pointerType: 'touch' });
    fireEvent.pointerEnter(hits()[0]!, { pointerType: 'mouse' });
    expect(seen).toEqual([]);
    fireEvent.pointerMove(hits()[0]!, { pointerType: 'mouse' });
    fireEvent.pointerMove(hits()[0]!, { pointerType: 'mouse' });
    expect(seen).toEqual([0]);
    fireEvent.pointerLeave(hits()[0]!, { pointerType: 'mouse' });
    expect(seen).toEqual([0, null]);
  });

  it('should clear a mouse hover when a touch or pen taps a session', () => {
    for (const pointerType of ['touch', 'pen']) {
      const seen: (number | null)[] = [];
      const { unmount } = render(<CorridorPlot {...props({ sessions: DAYS.slice(0, 4).map((_, i) => bren(i)), onHoverSession: (i) => seen.push(i) })} />);
      fireEvent.pointerEnter(hits()[1]!, { pointerType: 'mouse' });
      fireEvent.pointerMove(hits()[1]!, { pointerType: 'mouse' });
      fireEvent.pointerDown(hits()[2]!, { pointerType });
      expect(seen, pointerType).toEqual([1, null]);
      unmount();
    }
  });

  it('should not report the focus a tap on a session gives its button, but still report keyboard focus', () => {
    const seen: (number | null)[] = [];
    render(<CorridorPlot {...props({ sessions: DAYS.slice(0, 4).map((_, i) => bren(i)), onHoverSession: (i) => seen.push(i) })} />);
    fireEvent.pointerDown(hits()[1]!, { pointerType: 'touch' });
    fireEvent.focus(hits()[1]!);
    expect(seen).toEqual([]);
    fireEvent.focus(hits()[2]!);
    expect(seen).toEqual([2]);
  });

  it('should report keyboard focus after a tap that gave no focus, a tap on the focused button or a touch that became a scroll',() => {
    const seen: (number | null)[] = [];
    render(<CorridorPlot {...props({ sessions: DAYS.slice(0, 4).map((_, i) => bren(i)), onHoverSession: (i) => seen.push(i) })} />);
    fireEvent.pointerDown(hits()[1]!, { pointerType: 'touch' });
    fireEvent.pointerUp(hits()[1]!, { pointerType: 'touch' });
    fireEvent.click(hits()[1]!);
    fireEvent.focus(hits()[2]!);
    expect(seen).toEqual([2]);
    fireEvent.pointerDown(hits()[1]!, { pointerType: 'touch' });
    fireEvent.pointerCancel(hits()[1]!, { pointerType: 'touch' });
    fireEvent.focus(hits()[3]!);
    expect(seen).toEqual([2, 3]);
  });

  it('should keep a focused session marked when the pointer leaves, and return to it when the pointer leaves another', () => {
    const seen: (number | null)[] = [];
    render(<CorridorPlot {...props({ sessions: DAYS.slice(0, 4).map((_, i) => bren(i)), onHoverSession: (i) => seen.push(i) })} />);
    fireEvent.focus(hits()[1]!);
    fireEvent.pointerEnter(hits()[2]!);
    fireEvent.pointerLeave(hits()[2]!);
    expect(seen).toEqual([1, 2, 1]);
    fireEvent.pointerEnter(hits()[3]!);
    fireEvent.blur(hits()[1]!);
    expect(seen.at(-1)).toBe(3);
    fireEvent.pointerLeave(hits()[3]!);
    expect(seen.at(-1)).toBeNull();
  });

  it('should select a revealed session on a click or tap', () => {
    const picked: number[] = [];
    render(<CorridorPlot {...props({ onSelectSession: (i) => picked.push(i) })} />);
    fireEvent.click(hits()[5]!);
    expect(picked).toEqual([5]);
  });

  it('should mark the hovered session', () => {
    const { container, rerender } = render(<CorridorPlot {...props()} />);
    expect(container.querySelectorAll('rect.hover-column')).toHaveLength(0);
    rerender(<CorridorPlot {...props({ hoverIndex: 6 })} />);
    // A column in each chart, outlined as well as tinted so the cue is not colour alone, and the hit area says so too.
    expect(container.querySelectorAll('svg.price-strip rect.hover-column')).toHaveLength(1);
    expect(container.querySelectorAll('svg.pnl-chart rect.hover-column')).toHaveLength(1);
    expect(hits()[6]!.getAttribute('data-hovered')).toBe('true');
    expect(hits()[5]!.getAttribute('data-hovered')).toBeNull();
  });

  it('should give each session a target that never overlaps its neighbour\'s, at a phone\'s width', () => {
    render(<CorridorPlot {...props({ compact: true })} />);
    const spans = hits().map((h) => ({ left: parseFloat(h.style.left), width: parseFloat(h.style.width) }));
    expect(spans.length).toBeGreaterThan(1);
    // Left is the column's own left edge (the component sets no centring), so the first starts where slot 0's column does.
    const time = timeAxis(340, 15);
    expect(spans[0]!.left).toBeCloseTo(((time.x(0) - time.column / 2) / 340) * 100, 2);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i - 1]!.left + spans[i - 1]!.width).toBeCloseTo(spans[i]!.left, 2);
    }
  });
});

// jsdom has no layout: the box the plot is drawn in is given its width here.
function frameWidth(width: number): void {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
}

describe('Corridor: drawn at a phone\'s real width (W39, W40, W41)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should use the phone words when drawn narrow', () => {
    frameWidth(280);
    const stake = { riskLabel: 'Risk to stop $672', riskShortLabel: 'Risk $672', rewardLabel: 'Reward to target $928', rewardShortLabel: 'Reward $928' };
    const sessions = DAYS.map((_, i) => bren(i, i === 10 ? { stake } : {}));
    const { container } = render(<CorridorPlot {...props({ sessions })} />);
    // Drawn at its real width, so its text is not scaled down.
    expect(container.querySelector('svg.price-strip')!.getAttribute('width')).toBe('280');
    expect(pnl(container).getAttribute('width')).toBe('280');
    expect(screen.getByText('BREN price')).toBeTruthy();
    expect(screen.queryByText('BREN price · one Mark per session')).toBeNull();
    // The stake tags use the phone words (T9AR.12: they are in the strip under the drawing).
    expect(screen.queryByText(/^(Risk|Reward) to /)).toBeNull();
    expect(screen.queryByText('Sold 2 at $4.00')).toBeNull();
    cleanup();
    vi.restoreAllMocks();
    frameWidth(340);
    const phone = render(<CorridorPlot {...props({ sessions })} />);
    expect(phone.container.querySelectorAll('text.stake-tag'), 'no stake tag on the drawing at 340').toHaveLength(0);
    expect(screen.queryByText(/^(Risk|Reward) to /)).toBeNull();
    expect(phone.container.querySelector('.replay-strip-labels')!.textContent).toContain('Risk $672 · Reward $928');
    cleanup();
    // A wide box keeps the long words at the full drawing.
    vi.restoreAllMocks();
    frameWidth(900);
    const wide = render(<CorridorPlot {...props({ sessions })} />);
    expect(wide.container.querySelector('svg.price-strip')!.getAttribute('width')).toBe('900');
    expect(screen.getByText('Risk to stop $672')).toBeTruthy();
  });

  // B12: a resize is drawn in the frame it is observed in. The observer's callback runs between layout and paint; a redraw left to React's scheduler can land after the paint (and after a check that waits two frames), leaving a frame at the old width.
  it('should redraw at the new box width within the resize callback, not later', () => {
    let notify: () => void = () => {};
    let width = 900;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { notify = cb; } observe() {} unobserve() {} disconnect() {} });
    const { container } = render(<CorridorPlot {...props()} />);
    expect(container.querySelector('svg.price-strip')!.getAttribute('width')).toBe('900');
    width = 320;
    notify();
    expect(container.querySelector('svg.price-strip')!.getAttribute('width')).toBe('320');
    expect(pnl(container).getAttribute('width')).toBe('320');
  });

  it('should draw at 200 wide, scaled to fit, when the box is narrower than 200', () => {
    frameWidth(180);
    const { container } = render(<CorridorPlot {...props()} />);
    expect(container.querySelector('svg.price-strip')!.getAttribute('width')).toBe('200');
    expect(pnl(container).getAttribute('width')).toBe('200');
  });

  it('should keep the result and banked labels when drawn narrow', () => {
    for (const width of [280, 240]) {
      frameWidth(width);
      const { container } = render(<CorridorPlot {...props()} />);
      expect(pnl(container).getAttribute('width')).toBe(String(width));
      // T9AR.12: the two results and the banked label are in the strip under the drawing, none on it.
      const text = [...pnl(container).querySelectorAll('text')].map((t) => t.textContent);
      for (const label of ['Stop +$316', 'Target +$956', 'Banked +$478']) expect(text, `${width}: ${text.join(' | ')}`).not.toContain(label);
      expect(container.querySelector('.replay-strip-labels')!.textContent).toBe('Stop +$316 · Banked +$478 · Target +$956 · Sold 2');
      cleanup();
      vi.restoreAllMocks();
    }
  });

  it('should keep the banked label inside the chart when the sale is on the last session, drawn narrow', () => {
    for (const width of [280, 240]) {
      frameWidth(width);
      // Fifteen sessions, the sale on the last slot (14); the plan's doubles stop at slot 10, so the rest are filler.
      const sessions = Array.from({ length: 15 }, (_, i) =>
        bren(Math.min(i, 10), { slot: i, banked: i === 14 ? 478 : 0, bankedLabel: i === 14 ? 'Banked +$478' : undefined, markers: [] }),
      );
      const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: 14 })} />);
      // T9AR.12: drawn narrow the label is in the strip, not on the drawing, so nothing of it can run past the edge.
      expect(container.querySelector('.replay-strip-labels')!.textContent, `${width}: the banked label is kept`).toContain('Banked +$478');
      expect(pnl(container).querySelectorAll('text.banked-label'), `${width}: none on the drawing`).toHaveLength(0);
      cleanup();
      vi.restoreAllMocks();
    }
  });
});

// T9.19-B2: no two labels overlap, and none overlaps a chart title. The boxes are estimated as LabelPlacer estimates
// them (6 px a character, 2 more, 13 px tall about the baseline); a title is bold and larger, so 7 px a character.
describe('Corridor: labels apart (T9.19-B2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const LABELS = 'text.plot-title, text.result-label, text.banked-label, text.stake-tag, text.past-label, text.marker-label, text.worst-case-label, text.max-reward-label, text.break-even-label, text.price-line-label, text.mark-label, text.crossing-label';
  type Box = { name: string; x0: number; x1: number; y0: number; y1: number };
  const boxesOf = (svg: Element): Box[] =>
    [...svg.querySelectorAll(LABELS)].map((t) => {
      const text = t.textContent ?? '';
      const w = text.length * (t.classList.contains('plot-title') ? 7 : 6) + 2;
      const [x, y, anchor] = [num(t, 'x'), num(t, 'y'), t.getAttribute('text-anchor')];
      let x0 = x;
      if (anchor === 'end') x0 = x - w;
      else if (anchor === 'middle') x0 = x - w / 2;
      return { name: text, x0, x1: x0 + w, y0: y - 10, y1: y + 3 };
    });
  const clashes = (svg: Element): string[] => {
    const all = boxesOf(svg);
    return all.flatMap((a, i) => all.slice(i + 1).filter((b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1).map((b) => `"${a.name}" over "${b.name}"`));
  };

  // R-AXIO-D: 2 of 3 sold on Mon 11-09 (slot 5) at a loss, -$440 realized; Stop -$740, Target +$760.
  const axio = (slider: number): Partial<ReplayPlotProps> => ({
    sessions: DAYS.slice(0, slider + 1).map((_, i) =>
      bren(i, {
        tradePnl: i < 5 ? -100 : -440,
        banked: i >= 5 ? -440 : 0,
        bankedLabel: i >= 5 ? 'Realized −$440' : undefined,
        resultAtStop: fig(-740, 'Stop −$740'),
        resultAtTarget: fig(760, 'Target +$760'),
        markers: i === 5 ? [sale] : [],
        stake: i === slider ? { riskLabel: 'Risk to stop $300', riskShortLabel: 'Risk $300', rewardLabel: 'Reward to target $1,200', rewardShortLabel: 'Reward $1,200' } : undefined,
        underlyingLabel: '$45.60',
      }),
    ),
    anchors: { ...props().anchors, planAtStop: fig(-740, 'Stop −$740'), planAtTarget: fig(760, 'Target +$760') },
    sliderIndex: slider,
  });
  // R-BREN-U after the sale: Worst case +$156, Target +$956 passed on Thu and Mon.
  const brenAt = (slider: number): Partial<ReplayPlotProps> => ({
    sessions: DAYS.slice(0, slider + 1).map((_, i) =>
      bren(i, {
        worstCase: i >= SALE ? fig(156, 'Worst case +$156', 'Worst +$156') : null,
        past: i >= SALE ? { line: 'Target', label: `$${PAST[i]} past the Target`, shortLabel: `$${PAST[i]} past` } : undefined,
        stake: i === slider ? { riskLabel: 'Risk to stop $672', riskShortLabel: 'Risk $672' } : undefined,
        underlyingLabel: '$103.60',
      }),
    ),
    sliderIndex: slider,
  });
  // R-DALE-D held, a short put: every figure below break-even but the Target's, Max reward +$564 at the top.
  const dale = (slider: number): Partial<ReplayPlotProps> => ({
    sessions: DAYS.slice(0, slider + 1).map((_, i) => ({
      slot: i,
      dateLabel: DAYS[i]!,
      underlyingMark: 56 + i * 0.1,
      underlyingLabel: '$56.00',
      tradePnl: -720 - i * 40,
      banked: 0,
      resultAtStop: fig(-1263, 'Stop −$1,263'),
      resultAtTarget: fig(564, 'Target +$564'),
      worstCase: null,
      maxReward: fig(564, 'Max reward +$564', 'Max +$564'),
      markers: [],
      stake: i === slider ? { riskLabel: 'Risk to stop $543', rewardLabel: 'Reward to target $1,284', riskShortLabel: 'Risk $543', rewardShortLabel: 'Reward $1,284' } : undefined,
    })),
    anchors: { entryPrice: 56, priceLines: [{ kind: 'Strike', price: 55, label: 'Strike $55' }, { kind: 'Stop', price: 59, label: 'Stop $59' }, { kind: 'Target', price: 52, label: 'Target $52' }], planAtStop: fig(-1263, 'Stop −$1,263'), planAtTarget: fig(564, 'Target +$564') },
    sliderIndex: slider,
    priceTitle: 'DALE price · one Mark per session',
    priceShortTitle: 'DALE price',
  });

  it('should place no two labels on top of each other, nor over a chart title', () => {
    const cases: [string, number, Partial<ReplayPlotProps>][] = [];
    for (const width of [640, 340, 280]) {
      cases.push([`AXIO Mon 11-09 at ${width}`, width, axio(5)], [`BREN Thu 11-12 at ${width}`, width, brenAt(8)], [`BREN Mon 11-16 at ${width}`, width, brenAt(10)]);
    }
    cases.push(['AXIO Mon 11-16 at 640', 640, axio(10)], ['DALE Mon 11-02 at 640', 640, dale(0)], ['DALE Mon 11-16 at 640', 640, dale(10)]);
    for (const [name, width, over] of cases) {
      frameWidth(width === 640 ? 900 : width);
      const { container } = render(<CorridorPlot {...props(over)} />);
      for (const svg of container.querySelectorAll('svg')) expect(clashes(svg), `${name}, ${svg.getAttribute('class')}`).toEqual([]);
      cleanup();
      vi.restoreAllMocks();
    }
  });

  // T9.19-B10: banked labels are never left out, so their own spots must not clash with one another either.
  it('should keep three banked labels apart when sales fall on consecutive sessions at nearly the same level', () => {
    const levels = [0, 0, 0, 0, 0, 478, 480, 482, 482, 482, 482];
    const over: Partial<ReplayPlotProps> = {
      sessions: DAYS.map((_, i) => bren(i, { banked: levels[i]!, bankedLabel: levels[i]! > 0 ? `Banked +$${levels[i]}` : undefined, markers: [] })),
      sliderIndex: 10,
    };
    for (const width of [640, 340]) {
      frameWidth(width === 640 ? 900 : width);
      const { container } = render(<CorridorPlot {...props(over)} />);
      const svg = pnl(container);
      // T9AR.12: drawn narrow the three labels are in the strip, not on the drawing.
      const listed = container.querySelector('.replay-strip-labels')?.textContent?.split(' · ').filter((l) => l.startsWith('Banked')) ?? [];
      expect(width === 640 ? svg.querySelectorAll('text.banked-label').length : listed.length, `${width}`).toBe(3);
      expect(clashes(svg), `${width}`).toEqual([]);
      cleanup();
      vi.restoreAllMocks();
    }
  });

  // T9AR.24-B7: R-AXIO-D's Stop breached flag (Mon 11-09, slot 5) is on every later session, though that session's own labels (the hatch's, the
  // stake tags, the Execution's) crowd it; the flag, a fact that stays, takes the first free row down the pole, after those labels are placed.
  // The series is R-AXIO-D's own (reference-trade.ts): 200 shares bought at $50.00, 100 sold at $45.60 on slot 5, the Marks AXIO_D_UNDERLYING.
  it('should keep the Stop breached flag drawn, clear of every other label, on each AXIO session after Mon 11-09', () => {
    const tradePnl = [-60, -20, -160, -280, -380, -920, -860, -950, -1010, -930, -1040];
    for (const slider of [5, 6, 7, 10]) {
      const base = axio(slider);
      const sessions = base.sessions!.map((s, i) => ({
        ...s,
        ...(i === 5 && { firstCrossing: [{ line: 'Stop' as const, label: 'Stop breached' }], keyEntries: [{ kind: 'FirstCrossing' as const, label: 'Stop breached' }] }),
        // Before the sale the Stop is -$600 and the Target +$1,200; after it the Stop is -$740 and the Target +$160, with the Worst case at -$5,440.
        tradePnl: tradePnl[i]!,
        resultAtStop: fig(i < 5 ? -600 : -740, i < 5 ? 'Stop −$600' : 'Stop −$740'),
        resultAtTarget: i < 5 ? fig(1200, 'Target +$1,200') : fig(160, 'Target +$160'),
        worstCase: i < 5 ? fig(-10000, 'Worst case −$10,000 ↓', 'Worst −$10,000') : fig(-5440, 'Worst case −$5,440 ↓', 'Worst −$5,440'),
        // On the slider's session after the sale the Trade P&L is past the Stop, the hatch is labelled and only the reward's stake tag is drawn.
        ...(i === slider && i >= 5 && {
          past: { line: 'Stop' as const, label: `$${-740 - tradePnl[i]!} past the Stop`, shortLabel: `$${-740 - tradePnl[i]!} past` },
          stake: { rewardLabel: `Remaining Reward $${(160 - tradePnl[i]!).toLocaleString('en-US')}`, rewardShortLabel: `Reward $${(160 - tradePnl[i]!).toLocaleString('en-US')}` },
        }),
      }));
      frameWidth(837);
      // A stock's axis has the eleven sessions and no expiration, so each column is wider than the option fixtures'.
      const { container } = render(<CorridorPlot {...props({ ...base, sessions, anchors: { ...base.anchors!, planAtTarget: fig(1200, 'Target +$1,200') }, axis: { slots: 11, startLabel: 'Mon Nov 2', endLabels: [] } })} />);
      expect([...pnl(container).querySelectorAll('text.crossing-label')].map((t) => t.textContent), `slider ${slider}`).toEqual(['Stop breached']);
      expect([...container.querySelectorAll('.replay-key li')].map((li) => li.textContent), `key at ${slider}`).toContain('Stop breached');
      expect(clashes(pnl(container)), `slider ${slider}`).toEqual([]);
      cleanup();
      vi.restoreAllMocks();
    }
  });


  // T9AR.24-B7 part 2: the flag stays however the figures fall (T9AR.19, W64): it is not tuned to one trade's rows. Each geometry is a sale on
  // Mon 11-09 at a realized figure against a Stop, a Target and a later Trade P&L, hard for the rows beside the pole.
  it('should keep the Stop breached flag drawn, in the key and clear of every label and the axis cursor, on every later session of hard geometries', () => {
    const geometries: [number, number, number, number][] = [
      [-600, -740, 760, -860],
      [-600, -740, 760, -500],
      [-600, -740, 760, 100],
      [-600, -740, 760, -1500],
      [-700, -740, 600, -500],
      [-440, -600, 400, -1500],
    ];
    const signed = (n: number) => `${n < 0 ? '−' : '+'}$${Math.abs(n).toLocaleString('en-US')}`;
    for (const [realized, stop, target, late] of geometries) {
      for (const width of [837, 1000, 1300, 1700]) {
        for (const slider of [6, 7, 8, 9, 10]) {
          const past = late < stop;
          // The Trade P&L is -$100 before the sale, the realized figure on the sale's session, then the late figure.
          const pnlAt = (i: number): number => {
            if (i < 5) return -100;
            if (i === 5) return realized;
            return late;
          };
          const sessions = DAYS.slice(0, slider + 1).map((_, i) =>
            bren(i, {
              tradePnl: pnlAt(i),
              banked: i >= 5 ? realized : 0,
              bankedLabel: i >= 5 ? `Realized ${signed(realized)}` : undefined,
              resultAtStop: fig(stop, `Stop ${signed(stop)}`),
              resultAtTarget: fig(target, `Target ${signed(target)}`),
              worstCase: fig(-5440, 'Worst case −$5,440 ↓', 'Worst −$5,440'),
              markers: i === 5 ? [sale] : [],
              ...(i === 5 && { firstCrossing: [{ line: 'Stop' as const, label: 'Stop breached' }], keyEntries: [{ kind: 'FirstCrossing' as const, label: 'Stop breached' }] }),
              ...(i === slider && {
                ...(past && { past: { line: 'Stop' as const, label: '$120 past the Stop', shortLabel: '$120 past' } }),
                stake: { ...(past ? {} : { riskLabel: 'Current Risk $300', riskShortLabel: 'Risk $300' }), rewardLabel: 'Remaining Reward $1,020', rewardShortLabel: 'Reward $1,020' },
              }),
            }),
          );
          const name = `${realized}/${stop}/${target}/${late} at ${width}, slider ${slider}`;
          frameWidth(width);
          const { container } = render(<CorridorPlot {...props({ sessions, anchors: { ...props().anchors, planAtStop: fig(stop, 'Stop'), planAtTarget: fig(target, 'Target') }, axis: { slots: 11, startLabel: 'Mon Nov 2', endLabels: [] }, sliderIndex: slider })} />);
          const svg = pnl(container);
          expect([...svg.querySelectorAll('text.crossing-label')].map((t) => t.textContent), name).toEqual(['Stop breached']);
          expect([...container.querySelectorAll('.replay-key li')].map((li) => li.textContent), `key, ${name}`).toContain('Stop breached');
          expect(clashes(svg), name).toEqual([]);
          const flag = boxesOf(svg).find((b) => b.name === 'Stop breached')!;
          const cursor = svg.querySelector('text.cursor-label');
          if (cursor) {
            const w = (cursor.textContent ?? '').length * 6 + 2;
            const x0 = num(cursor, 'x') - w / 2;
            const y = num(cursor, 'y');
            expect(flag.x0 < x0 + w && x0 < flag.x1 && flag.y0 < y + 3 && y - 10 < flag.y1, `clear of the cursor text, ${name}`).toBe(false);
          }
          cleanup();
          vi.restoreAllMocks();
        }
      }
    }
  });

  // T9AR.24-B7-B2 and B3: the flag's label, wherever its row falls, reads as the flag's: the pole runs down to it (so it is never a distant,
  // unattached word), it is painted after every line, area and dot (its halo, in the CSS, keeps it legible over them), and it does not
  // straddle the cursor's line when a side clear of it has room.
  it('should join the Stop breached label to its pole, paint it above every drawn shape and keep it off the cursor line, on AXIO and the hard geometries', () => {
    const signed = (n: number) => `${n < 0 ? '−' : '+'}$${Math.abs(n).toLocaleString('en-US')}`;
    // [realized, stop, target, Trade P&L after the sale]; the first is R-AXIO-D's own (Stop -$740, Target +$160 after the sale).
    const geometries: [number, number, number, number][] = [
      [-440, -740, 160, -1010],
      [-600, -740, 760, -860],
      [-600, -740, 760, -500],
      [-600, -740, 760, 100],
      [-600, -740, 760, -1500],
      [-700, -740, 600, -500],
      [-440, -600, 400, -1500],
    ];
    for (const [realized, stop, target, late] of geometries) {
      for (const width of [837, 1000, 1300, 1700]) {
        for (const slider of [5, 6, 7, 8, 9, 10]) {
          const pnlAt = (i: number): number => {
            if (i < 5) return -100;
            if (i === 5) return realized;
            return late;
          };
          const sessions = DAYS.slice(0, slider + 1).map((_, i) =>
            bren(i, {
              tradePnl: pnlAt(i),
              banked: i >= 5 ? realized : 0,
              bankedLabel: i >= 5 ? `Realized ${signed(realized)}` : undefined,
              resultAtStop: fig(stop, `Stop ${signed(stop)}`),
              resultAtTarget: fig(target, `Target ${signed(target)}`),
              markers: i === 5 ? [sale] : [],
              ...(i === 5 && { firstCrossing: [{ line: 'Stop' as const, label: 'Stop breached' }], keyEntries: [{ kind: 'FirstCrossing' as const, label: 'Stop breached' }] }),
              ...(i === slider && {
                ...(late < stop && i > 5 && { past: { line: 'Stop' as const, label: '$120 past the Stop', shortLabel: '$120 past' } }),
                stake: { rewardLabel: 'Remaining Reward $1,020', rewardShortLabel: 'Reward $1,020' },
              }),
            }),
          );
          const name = `${realized}/${stop}/${target}/${late} at ${width}, slider ${slider}`;
          frameWidth(width);
          const { container } = render(<CorridorPlot {...props({ sessions, anchors: { ...props().anchors, planAtStop: fig(stop, 'Stop'), planAtTarget: fig(target, 'Target') }, axis: { slots: 11, startLabel: 'Mon Nov 2', endLabels: [] }, sliderIndex: slider })} />);
          const svg = pnl(container);
          const label = svg.querySelector('text.crossing-label')!;
          const poles = [...svg.querySelectorAll('g.first-crossing path.flag-pole')].map((p) => p.getAttribute('d')!);
          // A pole's path is "M x y V y2": its x, then the two ends.
          const poleX = Number(poles[0]!.match(/[\d.]+/g)![0]);
          const ys = poles.flatMap((d) => d.match(/[\d.]+/g)!.slice(1).map(Number));
          const [bottom, top] = [Math.max(...ys), Math.min(...ys)];
          const labelY = num(label, 'y') - 4;
          expect(Math.abs(num(label, 'x') - poleX), `label beside its pole, ${name}`).toBeCloseTo(6, 0);
          expect(labelY >= top && labelY <= bottom, `the pole (${top} to ${bottom}) reaches the label's row (${labelY}), ${name}`).toBe(true);
          const later = [...svg.querySelectorAll('path, rect, circle')].filter((e) => !(label.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING));
          expect(later.map((e) => e.getAttribute('class')), `nothing drawn over the label, ${name}`).toEqual([]);
          const cursor = svg.querySelector('path.cursor');
          if (cursor) {
            const cx = Number(/^M([\d.]+)/.exec(cursor.getAttribute('d')!)![1]);
            const box = boxesOf(svg).find((b) => b.name === 'Stop breached')!;
            expect(box.x0 < cx && cx < box.x1, `the label crosses the cursor line, ${name}`).toBe(false);
          }
          cleanup();
          vi.restoreAllMocks();
        }
      }
    }
  });
});

// B6: a text's box as LabelPlacer estimates it (6 px a character and 2 over, from its anchor); it must lie inside the drawing.
function outsideDrawing(svg: SVGSVGElement): string[] {
  const width = Number(svg.getAttribute('width'));
  return [...svg.querySelectorAll('text')]
    .filter((t) => t.getAttribute('x') !== null)
    .flatMap((t) => {
      const w = t.textContent.length * 6 + 2;
      const x = Number(t.getAttribute('x'));
      const anchor = t.getAttribute('text-anchor');
      const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
      return x0 < 0 || x0 + w > width ? [`${t.textContent} (${x0} to ${x0 + w} of ${width})`] : [];
    });
}

describe('Corridor: every figure drawn is readable in full (B6)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should keep every axis tick inside the chart, minus sign included, when drawn narrow', () => {
    for (const [low, high] of [[-1000, 1000], [-2000, 500]] as const) {
      for (const width of [340, 280]) {
        frameWidth(width);
        const sessions = DAYS.map((_, i) => bren(i, { tradePnl: i % 2 === 0 ? low : high, banked: 0, bankedLabel: undefined, resultAtStop: null, resultAtTarget: null }));
        const { container } = render(<CorridorPlot {...props({ sessions, anchors: { priceLines: [], planAtStop: null, planAtTarget: null } })} />);
        const ticks = [...pnl(container).querySelectorAll('text')].filter((t) => /^−?\$[\d,]+$/.test(t.textContent));
        expect(ticks.some((t) => t.textContent.startsWith('−')), `${low}, ${width}: a negative tick is drawn`).toBe(true);
        expect(outsideDrawing(pnl(container)), `${low}, ${width}`).toEqual([]);
        cleanup();
        vi.restoreAllMocks();
      }
    }
  });
});

describe('Corridor: the key, the dates and the lines (suggestion 3)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const keyed = (i: number): PlotSession =>
    bren(i, {
      keyEntries: [
        ...(i === 0
          ? ([
              { kind: 'Mark', label: 'Mark' },
              { kind: 'TradePnl', label: 'Open profit' },
              { kind: 'BreakEven', label: 'Break-even' },
              { kind: 'Stop', label: 'At Stop' },
              { kind: 'Target', label: 'At Target' },
              { kind: 'WorstCase', label: 'At Worst case' },
            ] as const)
          : []),
        ...(i === SALE ? ([{ kind: 'Banked', label: 'Banked' }] as const) : []),
      ],
    });
  const keyOf = (c: HTMLElement) => [...c.querySelectorAll('.replay-key li')].map((li) => li.textContent);

  it('should show a one-line key under the charts naming each thing drawn so far and nothing else', () => {
    const early = render(<CorridorPlot {...props({ sessions: [keyed(0)], sliderIndex: 0 })} />);
    // No Banked on Mon 11-02; the Worst case is named by a session but its line is not drawn (no figure), so it is not in the key.
    expect(keyOf(early.container)).toEqual(['Mark', 'Open profit', 'Break-even', 'At Stop', 'At Target']);
    cleanup();
    const thu = render(<CorridorPlot {...props({ sessions: DAYS.slice(0, SALE + 1).map((_, i) => keyed(i)), sliderIndex: SALE })} />);
    expect(keyOf(thu.container)).toEqual(['Mark', 'Open profit', 'Break-even', 'At Stop', 'At Target', 'Banked']);
  });

  it('should give each key entry the swatch of what it names', () => {
    const entry = (kind: 'TradePnl' | 'Banked', label: string): PlotSession => bren(0, { keyEntries: [{ kind, label }] });
    const swatches = (labels: [('TradePnl' | 'Banked'), string][]) => {
      const out: Record<string, string | null> = {};
      for (const [kind, label] of labels) {
        const { container } = render(<CorridorPlot {...props({ sessions: [entry(kind, label)], sliderIndex: 0 })} />);
        out[label] = container.querySelector('.replay-key li')!.getAttribute('data-swatch');
        cleanup();
      }
      return out;
    };
    expect(
      swatches([
        ['TradePnl', 'Open profit'],
        ['TradePnl', 'Open loss'],
        ['Banked', 'Banked'],
        ['Banked', 'Realized loss'],
      ]),
    ).toEqual({ 'Open profit': 'area-profit', 'Open loss': 'area-loss', Banked: 'banked-gain', 'Realized loss': 'banked-loss' });

    // Each swatch takes the colour variable and opacity of the thing it names in the drawing.
    const rules = new Map<string, Record<string, string>>();
    postcss.parse(readFileSync('src/ui/cockpit/styles/replay-plot.css', 'utf8')).walkRules((rule) => {
      const decls: Record<string, string> = {};
      rule.walkDecls((d) => {
        decls[d.prop] = d.value;
      });
      for (const sel of rule.selectors) rules.set(sel.replace(/\s+/g, ' '), { ...rules.get(sel.replace(/\s+/g, ' ')), ...decls });
    });
    const swatch = (variant: string) => rules.get(`.replay-key li[data-swatch='${variant}']::before`);
    const drawn = (sel: string) => rules.get(sel)!;
    for (const [variant, drawing] of [
      ['area-profit', '.replay-plot .area.profit'],
      ['area-loss', '.replay-plot .area.loss'],
      ['banked-gain', '.replay-plot .banked-band.gain'],
      ['banked-loss', '.replay-plot .banked-band.loss'],
    ] as const) {
      const s = swatch(variant)!;
      expect(s, variant).toBeDefined();
      expect(s['background'] ?? s['background-color'], variant).toBe(drawn(drawing)['fill']);
      expect(s['opacity'], variant).toBe(drawn(drawing)['fill-opacity']);
    }
  });

  // T9AR.24-B8 (critic-1 defect 8): "No Mark" is a shaded column in the drawing, so its swatch is a block in the column's own fill, not a line.
  it('should give No Mark a block swatch in the fill of the shaded column', () => {
    const { container } = render(<CorridorPlot {...props({ sessions: [bren(0, { keyEntries: [{ kind: 'NoMark', label: 'No Mark' }] })], sliderIndex: 0 })} />);
    expect(container.querySelector('.replay-key li')!.getAttribute('data-swatch')).toBe('no-mark');
    const rules = new Map<string, Record<string, string>>();
    postcss.parse(readFileSync('src/ui/cockpit/styles/replay-plot.css', 'utf8')).walkRules((rule) => {
      const decls: Record<string, string> = {};
      rule.walkDecls((d) => {
        decls[d.prop] = d.value;
      });
      for (const sel of rule.selectors) rules.set(sel.replace(/\s+/g, ' '), { ...rules.get(sel.replace(/\s+/g, ' ')), ...decls });
    });
    const s = rules.get(".replay-key li[data-swatch='no-mark']::before")!;
    expect(s, 'a rule for the swatch').toBeDefined();
    expect(s['background'] ?? s['background-color']).toBe(rules.get('.replay-plot .no-mark')!['fill']);
    expect(s['border-top']).toBe('0');
  });

  it('should draw at its box own width on a wide screen, the text the same size at 860 and at 1400', () => {
    const scales: number[] = [];
    for (const box of [860, 1400]) {
      frameWidth(box);
      const { container } = render(<CorridorPlot {...props()} />);
      for (const svg of [container.querySelector('svg.price-strip')!, pnl(container)]) {
        // Drawn at the box's width with a viewBox of the same width: one drawing unit is one pixel, so the text is not scaled.
        expect(svg.getAttribute('width')).toBe(String(box));
        expect(svg.getAttribute('viewBox')!.split(' ')[2]).toBe(String(box));
        scales.push(num(svg, 'width') / Number(svg.getAttribute('viewBox')!.split(' ')[2]));
      }
      cleanup();
      vi.restoreAllMocks();
    }
    expect(new Set(scales)).toEqual(new Set([1]));
  });

  it('should draw a Worst case, Max reward or price line only with its label: the P&L chart', () => {
    const maxReward = fig(1250, 'Max reward +$1,250');
    const sessions = DAYS.map((_, i) => bren(i, { maxReward }));
    // With room: line and label are both drawn.
    const roomy = render(<CorridorPlot {...props({ sessions })} />);
    expect(roomy.container.querySelectorAll('path.max-reward')).toHaveLength(1);
    expect(screen.getByText('Max reward +$1,250')).toBeTruthy();
    cleanup();
    // The title takes the room the label needs (R-DALE-D's Max reward under the title): neither is drawn.
    const crowded = render(<CorridorPlot {...props({ sessions, pnlTitle: 'T'.repeat(80) })} />);
    expect(screen.queryByText('Max reward +$1,250')).toBeNull();
    expect(crowded.container.querySelectorAll('path.max-reward')).toHaveLength(0);
    // The key does not name a line that is not drawn.
    expect(crowded.container.querySelector('.key-MaxReward')).toBeNull();
  });

  // T9AR.24-B6 (A280, W66): a hatch or a stake bar is drawn with its label or not at all, and the key names each while it is drawn.
  it('should draw a hatch or a stake bar only with its label, and name each in the key only while it is drawn', () => {
    const at = (over: Partial<PlotSession>) => DAYS.map((_, i) => bren(i, i === 10 ? over : {}));
    const stake = { riskLabel: 'Risk to stop $672', riskShortLabel: 'Risk $672', rewardLabel: 'Reward to target $928', rewardShortLabel: 'Reward $928' };
    const past = { line: 'Target' as const, label: '$32 past the Target', shortLabel: '$32 past' };
    const sessions = at({ past, stake });
    const keyed = (c: HTMLElement) => [...c.querySelectorAll('.replay-key li')].map((li) => li.textContent);
    // With room: the bar and the hatch have their labels, and the key says "At stake" and "Past the Target".
    const roomy = render(<CorridorPlot {...props({ sessions })} />);
    expect(roomy.container.querySelectorAll('path.stake-beam')).toHaveLength(2);
    expect(roomy.container.querySelectorAll('rect.hatch')).toHaveLength(1);
    expect(keyed(roomy.container)).toEqual(expect.arrayContaining(['At stake', 'Past the Target']));
    cleanup();
    // No room for the labels (a title that takes the width): neither the bars nor the hatch, and the key names neither.
    const crowded = render(<CorridorPlot {...props({ sessions: at({ past: { ...past, label: 'p'.repeat(120) }, stake: { ...stake, riskLabel: 'r'.repeat(120), rewardLabel: 'w'.repeat(120) } }) })} />);
    expect(crowded.container.querySelectorAll('path.stake-beam')).toHaveLength(0);
    expect(crowded.container.querySelectorAll('rect.hatch')).toHaveLength(0);
    expect(keyed(crowded.container)).not.toContain('At stake');
    expect(keyed(crowded.container)).not.toContain('Past the Target');
    cleanup();
    // On a phone the labels are in the strip, so the bars and the hatch stay and the key names them.
    const phone = render(<CorridorPlot {...props({ sessions, compact: true })} />);
    expect(phone.container.querySelectorAll('path.stake-beam')).toHaveLength(2);
    expect(phone.container.querySelectorAll('rect.hatch')).toHaveLength(1);
    expect(keyed(phone.container)).toEqual(expect.arrayContaining(['At stake', 'Past the Target']));
  });

  it('should end the past label at the cursor when the slider is on the last session, so the hatch keeps its label at the right edge', () => {
    const sessions = DAYS.map((_, i) => bren(i, i === 10 ? { past: { line: 'Stop', label: '$300 past the Stop', shortLabel: '$300 past' } } : {}));
    const { container } = render(<CorridorPlot {...props({ sessions, axis: { slots: 11 } })} />);
    const label = pnl(container).querySelector('text.past-label')!;
    expect(label.textContent).toBe('$300 past the Stop');
    expect(label.getAttribute('text-anchor')).toBe('end');
    expect(pnl(container).querySelectorAll('rect.hatch')).toHaveLength(1);
    expect(outsideDrawing(pnl(container))).toEqual([]);
  });

  it('should name a hatch past the Stop in the key as "Past the Stop"', () => {
    const sessions = DAYS.map((_, i) => bren(i, i === 10 ? { past: { line: 'Stop', label: '$300 past the Stop', shortLabel: '$300 past' } } : {}));
    const { container } = render(<CorridorPlot {...props({ sessions })} />);
    const listed = [...container.querySelectorAll('.replay-key li')].map((li) => li.textContent);
    expect(listed).toContain('Past the Stop');
    expect(listed).not.toContain('Past the Target');
    expect(listed).not.toContain('At stake');
  });

  it('should draw a Worst case, Max reward or price line only with its label: the price chart', () => {
    const lines = [
      { kind: 'Strike' as const, price: 100, label: 'Strike $100' },
      { kind: 'Stop' as const, price: 100, label: 'Stop $100.00' },
      { kind: 'Target' as const, price: 100.05, label: 'Target $100.05' },
    ];
    const { container } = render(<CorridorPlot {...props({ anchors: { ...props().anchors, priceLines: lines } })} />);
    const strip = container.querySelector('svg.price-strip')!;
    // The Target's label has no free spot beside the other two, so its line is not drawn either.
    expect([...strip.querySelectorAll('text.price-line-label')].map((t) => t.textContent)).toEqual(['Strike $100', 'Stop $100.00']);
    expect([...strip.querySelectorAll('path.price-line')].map((p) => p.getAttribute('data-kind'))).toEqual(['Strike', 'Stop']);
  });

  it('should label nothing at the right on a stock Trade, and name the slider session under the cursor', () => {
    const { container } = render(<CorridorPlot {...props({ axis: { slots: 5, startLabel: 'Mon Nov 2' }, sliderIndex: 3, sessions: DAYS.slice(0, 4).map((_, i) => bren(i)) })} />);
    const time = timeAxis(640, 5);
    expect(pnl(container).querySelector('text.axis-end')).toBeNull();
    const under = pnl(container).querySelector('text.cursor-label')!;
    expect([under.textContent, under.getAttribute('text-anchor'), num(under, 'x')]).toEqual(['Thu Nov 5', 'middle', Math.round(time.x(3) * 10) / 10]);
    // On an option the name sits under the cursor as well, and the first session's own date is not drawn twice.
    cleanup();
    const first = render(<CorridorPlot {...props({ axis: { slots: 15, startLabel: 'Mon Nov 2', endLabels: ['Expires Fri Nov 20', 'Expires Nov 20', 'Exp Nov 20'] }, sliderIndex: 0, sessions: [bren(0)] })} />);
    expect([...pnl(first.container).querySelectorAll('text')].filter((t) => t.textContent === 'Mon Nov 2')).toHaveLength(1);
  });

  it('should label the time axis with the first session date at the left and Expires Fri Nov 20 at the right on an option: the drawing', () => {
    const { container } = render(<CorridorPlot {...props({ axis: { slots: 15, startLabel: 'Mon Nov 2', endLabels: ['Expires Fri Nov 20', 'Expires Nov 20', 'Exp Nov 20'] }, sliderIndex: 5, sessions: DAYS.slice(0, 6).map((_, i) => bren(i)) })} />);
    const time = timeAxis(640, 15);
    const start = pnl(container).querySelector('text.axis-start')!;
    const end = pnl(container).querySelector('text.axis-end')!;
    expect([start.textContent, start.getAttribute('text-anchor'), num(start, 'x')]).toEqual(['Mon Nov 2', 'start', time.left]);
    expect([end.textContent, end.getAttribute('text-anchor'), num(end, 'x')]).toEqual(['Expires Fri Nov 20', 'end', time.right]);
  });

  it('should keep Expires Fri Nov 20 on an option time axis at the last session, with the cursor date beside it and not overlapping it', () => {
    const { container } = render(<CorridorPlot {...props({ axis: { slots: 11, startLabel: 'Mon Nov 2', endLabels: ['Expires Fri Nov 20', 'Expires Nov 20', 'Exp Nov 20'] }, sliderIndex: 10, sessions: DAYS.map((_, i) => bren(i)) })} />);
    const end = pnl(container).querySelector('text.axis-end')!;
    const cursor = pnl(container).querySelector('text.cursor-label')!;
    expect([end.textContent, cursor.textContent]).toEqual(['Expires Fri Nov 20', 'Mon Nov 16']);
    const width = (t: Element) => t.textContent.length * 6 + 2;
    const endLeft = num(end, 'x') - width(end);
    const cursorRight = cursor.getAttribute('text-anchor') === 'end' ? num(cursor, 'x') : num(cursor, 'x') + width(cursor) / 2;
    expect(cursorRight).toBeLessThanOrEqual(endLeft);
  });
});

// T9AR.11 (A280, A256, P146): the entry session, an off-scale Worst case, a session with no Mark.
describe('Corridor: labels clear of the cursor (suggestion 10)', () => {
  // The cursor's column on a 640-wide drawing of an 11-slot option axis, and a label's box by the placer's own estimate.
  const AXIS = { slots: 11, startLabel: 'Mon Nov 2', endLabels: ['Expires Fri Nov 20', 'Expires Nov 20', 'Exp Nov 20'] };
  const LINES = [
    { kind: 'Strike' as const, price: 100, label: 'Strike $100' },
    { kind: 'Stop' as const, price: 94, label: 'Stop $94.00' },
  ];
  const clear = (label: Element, slot: number): boolean => {
    const time = timeAxis(640, AXIS.slots);
    const w = label.textContent.length * 6 + 2;
    const x = Number(label.getAttribute('x'));
    const x0 = label.getAttribute('text-anchor') === 'end' ? x - w : x;
    return x0 + w <= time.x(slot) - time.column / 2 || time.x(slot) + time.column / 2 <= x0;
  };

  it.each([
    ['the entry session', 0],
    ['the last session', 10],
  ])('should keep every level label out of the cursor’s column, on %s', (_name, i) => {
    const sessions = DAYS.slice(0, i + 1).map((_d, k) => bren(k));
    const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: i, axis: AXIS, anchors: { ...props().anchors, priceLines: LINES } })} />);
    const strip = container.querySelector('svg.price-strip')!;
    for (const text of ['Strike $100', 'Stop $94.00']) {
      const label = [...strip.querySelectorAll('text.price-line-label')].find((t) => t.textContent === text);
      expect(label, text).toBeTruthy();
      expect(clear(label!, i), text).toBe(true);
    }
    const breakEven = pnl(container).querySelector('text.break-even-label');
    expect(breakEven, 'Break-even').toBeTruthy();
    expect(clear(breakEven!, i), 'Break-even').toBe(true);
  });

  it('should keep the Worst case and Max reward lines on the chart at the last session, their labels clear of the cursor', () => {
    const sessions = DAYS.map((_d, k) => bren(k, { worstCase: fig(-400, 'Worst case −$400'), maxReward: fig(1000, 'Max reward +$1,000') }));
    const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: 10, axis: AXIS })} />);
    for (const css of ['worst-case', 'max-reward']) {
      expect(pnl(container).querySelectorAll(`path.${css}`), css).toHaveLength(1);
      expect(clear(pnl(container).querySelector(`text.${css}-label`)!, 10), css).toBe(true);
    }
  });
});

describe('Corridor: a Worst case off the scale (suggestion 13)', () => {
  // R-DALE-D after the buy-back: the Worst case (-$33,936) is far below the chart; the adapter hands each session its tag.
  const dale = (worst: number, weight: 'Main' | 'Remote' = 'Main', tagged = true): PlotSession[] =>
    [-720, -1065, -1150, -1272].map((p, i) => ({
      slot: i,
      dateLabel: `Day ${i}`,
      underlyingMark: 56 - i,
      tradePnl: p,
      banked: i >= 1 ? -495 : 0,
      resultAtStop: fig(-1263, 'Stop −$1,263'),
      resultAtTarget: fig(-273, 'Target −$273'),
      worstCase: fig(worst, `Worst case ${worst < 0 ? '−' : '+'}$${Math.abs(worst).toLocaleString('en-US')}`),
      maxReward: null,
      ...(tagged && { worstCaseTag: { label: `Worst case ${worst < 0 ? '−' : '+'}$${Math.abs(worst).toLocaleString('en-US')} ↓`, weight } }),
      markers: [],
    }));
  const anchors = { priceLines: [], planAtStop: fig(-1536, 'Stop −$1,536'), planAtTarget: fig(444, 'Target +$444') };
  const draw = (sessions: PlotSession[], sliderIndex = 3) => render(<CorridorPlot {...props({ sessions, sliderIndex, anchors, axis: { slots: 4 } })} />);

  it('should tag the bottom edge "Worst case −$33,936 ↓" when the Worst case is below the chart’s range without stretching the axis, and show no tag when its line is on the scale', () => {
    const { container } = draw(dale(-33936));
    const tag = pnl(container).querySelector('text.worst-case-tag')!;
    expect(tag.textContent).toBe('Worst case −$33,936 ↓');
    // At the bottom edge of the plotted area, clear of the cursor's column; its line is not drawn.
    expect(Number(tag.getAttribute('y'))).toBeGreaterThan(Math.max(...dots(container).map((d) => num(d, 'cy'))));
    expect(Number(tag.getAttribute('y'))).toBeLessThanOrEqual(Number(pnl(container).getAttribute('height')) - 22);
    const time = timeAxis(640, 4);
    const x = Number(tag.getAttribute('x'));
    const x0 = tag.getAttribute('text-anchor') === 'end' ? x - (tag.textContent.length * 6 + 2) : x;
    expect(x0 + tag.textContent.length * 6 + 2 <= time.x(3) - time.column / 2 || time.x(3) + time.column / 2 <= x0).toBe(true);
    expect(pnl(container).querySelectorAll('path.worst-case')).toHaveLength(0);
    // The axis is the same as with no Worst case at all: the dots do not move.
    const cys = dots(container).map((d) => num(d, 'cy'));
    cleanup();
    const bare = draw(dale(-33936, 'Main', false).map((s) => ({ ...s, worstCase: null })));
    expect(dots(bare.container).map((d) => num(d, 'cy'))).toEqual(cys);
    cleanup();
    // On the scale the line carries its own label and no tag is drawn.
    const on = draw(dale(-1500));
    expect(on.container.querySelector('text.worst-case-tag')).toBeNull();
    expect(screen.getByText('Worst case −$1,500')).toBeTruthy();
  });

  it('should give the tag the extremes’ weight: grey for a stock or long option, full strength for a short option', () => {
    const remote = draw(dale(-33936, 'Remote')).container.querySelector('text.worst-case-tag')!;
    cleanup();
    const main = draw(dale(-33936, 'Main')).container.querySelector('text.worst-case-tag')!;
    expect(remote.getAttribute('class')).toContain('remote');
    expect(main.getAttribute('class')).toContain('main');
    const rules = new Map<string, Record<string, string>>();
    postcss.parse(readFileSync('src/ui/cockpit/styles/replay-plot.css', 'utf8')).walkRules((rule) => {
      const decls: Record<string, string> = {};
      rule.walkDecls((d) => {
        decls[d.prop] = d.value;
      });
      for (const sel of rule.selectors) rules.set(sel.replace(/\s+/g, ' '), { ...rules.get(sel.replace(/\s+/g, ' ')), ...decls });
    });
    expect(rules.get('.replay-plot .worst-case-tag.remote')?.fill).toBe('var(--muted)');
    expect(rules.get('.replay-plot .worst-case-tag.main')?.fill).toBe('var(--stop)');
    expect(rules.get('.replay-plot .worst-case-tag')?.['font-weight']).toBe('650');
    expect(rules.get('.replay-plot .worst-case-tag.remote')?.['font-weight']).toBe('500');
  });
});

describe('Corridor: a session with no Mark (suggestion 12)', () => {
  // R-CORV-D has no put Mark on one session: its Trade P&L is missing (P146: shaded and labelled, bridged by nothing).
  const AXIS = { slots: 11 };
  const withGap = (): PlotSession[] => DAYS.slice(0, 7).map((_d, i) => (i === 3 ? bren(i, { tradePnl: null, underlyingMark: null }) : bren(i)));
  const draw = () => render(<CorridorPlot {...props({ sessions: withGap(), sliderIndex: 6, axis: AXIS })} />);

  it('should shade that session’s column in the P&L chart and label it "No Mark", as the price chart does', () => {
    const { container } = draw();
    const time = timeAxis(640, AXIS.slots);
    const shade = pnl(container).querySelectorAll('rect.no-mark');
    expect(shade).toHaveLength(1);
    expect(num(shade[0]!, 'x')).toBeCloseTo(time.x(3) - time.column / 2, 1);
    expect(num(shade[0]!, 'width')).toBeCloseTo(time.column, 1);
    expect([...pnl(container).querySelectorAll('text.no-mark-label')].map((t) => t.textContent)).toEqual(['No Mark']);
    // The same shading and words as the price chart's.
    expect(container.querySelector('svg.price-strip rect.no-mark')!.getAttribute('x')).toBe(shade[0]!.getAttribute('x'));
  });

  it('should run the area to the edge of that column on each side and end it upright, joining nothing across it', () => {
    const sessions = withGap().map((s) => (s.tradePnl === null ? s : { ...s, tradePnl: 100 + s.slot * 10 }));
    const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: 6, axis: AXIS })} />);
    const time = timeAxis(640, AXIS.slots);
    const [gapLeft, gapRight] = [time.x(3) - time.column / 2, time.x(3) + time.column / 2];
    const z = zeroY(container);
    const cy = (slot: number) => num(dots(container).find((d) => num(d, 'cx') === Math.round(time.x(slot) * 10) / 10)!, 'cy');
    const [before, after] = pnl(container).querySelector('path.area.profit')!.getAttribute('d')!.split(/(?=M)/).map((p) => [...p.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) })));
    // The run before the gap ends at the gap's left edge, at its last level, then drops straight to break-even.
    expect(before!.at(-2)).toEqual({ x: Math.round(gapLeft * 10) / 10, y: cy(2) });
    expect(before!.at(-1)).toEqual({ x: Math.round(gapLeft * 10) / 10, y: z });
    // The run after it starts at the gap's right edge, straight up from break-even to its first level.
    expect(after![0]).toEqual({ x: Math.round(gapRight * 10) / 10, y: z });
    expect(after![1]).toEqual({ x: Math.round(gapRight * 10) / 10, y: cy(4) });
    // Nothing is drawn inside the gap's column.
    expect([...before!, ...after!].some((p) => p.x > gapLeft + 0.1 && p.x < gapRight - 0.1)).toBe(false);
  });
});

describe('Corridor on a phone (suggestion 9)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  // R-BREN-U Thu 11-12: the slider on the sale's session.
  const thursday = () => props({ sessions: DAYS.slice(0, 9).map((_, i) => bren(i)), sliderIndex: 8 });
  const strip = (c: HTMLElement) => c.querySelector('.replay-strip-labels');
  const drawingText = (c: HTMLElement) => [...pnl(c).querySelectorAll('text')].map((t) => t.textContent);

  it('should draw the phone P&L chart at least 200 high', () => {
    frameWidth(340);
    const { container } = render(<CorridorPlot {...thursday()} />);
    expect(num(pnl(container), 'height')).toBeGreaterThanOrEqual(200);
  });

  it('should draw the phone price chart 12 px shorter, so the replay fits one screen at 320 by 667 with the PnL chart 200 high', () => {
    frameWidth(340);
    const phone = render(<CorridorPlot {...thursday()} />);
    expect(num(phone.container.querySelector('svg.price-strip')!, 'height')).toBe(123);
    expect(num(pnl(phone.container), 'height')).toBe(200);
    cleanup();
    vi.restoreAllMocks();
    frameWidth(900);
    const wide = render(<CorridorPlot {...thursday()} />);
    expect(num(wide.container.querySelector('svg.price-strip')!, 'height')).toBe(136);
  });

  it('should keep the slider value inside the phone drawing at the last session', () => {
    frameWidth(340);
    const at = (slider: number) =>
      props({
        sessions: Array.from({ length: slider + 1 }, (_, i) => bren(i, { tradePnl: 1138, markers: [], resultAtStop: null, resultAtTarget: null })),
        sliderIndex: slider,
        axis: { slots: 15, endLabels: ['Fri Nov 20'] },
      });
    // The label's extent by the same 6 px a character the placer uses, from its anchor.
    const extent = (c: HTMLElement) => {
      const t = pnl(c).querySelector('text.slider-value')!;
      const x = num(t, 'x');
      const w = t.textContent.length * 6 + 2;
      const a = t.getAttribute('text-anchor');
      let x0: number;
      if (a === 'start') {
        x0 = x;
      } else if (a === 'end') {
        x0 = x - w;
      } else {
        x0 = x - w / 2;
      }
      return { x0, x1: x0 + w, text: t.textContent };
    };
    for (const slider of [14, 0]) {
      const { container } = render(<CorridorPlot {...at(slider)} />);
      const e = extent(container);
      expect(e.text).toBe('+$1,138');
      expect(e.x0, `slider ${slider}, left edge`).toBeGreaterThanOrEqual(0);
      expect(e.x1, `slider ${slider}, right edge`).toBeLessThanOrEqual(340);
      cleanup();
    }
  });

  // R-BREN-U Thu 11-12: "Stop +$316 · Banked +$478 · Target +$956 · Sold 2".
  it('should take the line labels off the phone drawing and list them in a strip under it', () => {
    frameWidth(340);
    const { container } = render(<CorridorPlot {...thursday()} />);
    expect(strip(container)!.textContent).toBe('Stop +$316 · Banked +$478 · Target +$956 · Sold 2');
    const text = drawingText(container);
    for (const label of ['Stop +$316', 'Banked +$478', 'Target +$956', 'Sold 2', 'Break-even']) expect(text).not.toContain(label);
    // Under the drawing, outside it.
    expect(pnl(container).contains(strip(container))).toBe(false);
    expect(pnl(container).compareDocumentPosition(strip(container)!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // The slider's value is "+$982".
  it('should keep the slider value on the drawing with the title and the axis figures', () => {
    frameWidth(340);
    const { container } = render(<CorridorPlot {...thursday()} />);
    const text = drawingText(container);
    expect(text).toContain('+$982');
    expect(text).toContain('Trade P&L');
    expect(text.filter((t) => /^[−]?\$[\d,]+$/.test(t ?? '')).length, text.join(' | ')).toBeGreaterThan(0);
    // The wide drawing carries its labels on the lines and no strip.
    cleanup();
    vi.restoreAllMocks();
    frameWidth(900);
    const wide = render(<CorridorPlot {...thursday()} />);
    expect(strip(wide.container)).toBeNull();
    expect(drawingText(wide.container)).toEqual(expect.arrayContaining(['Stop +$316', 'Target +$956']));
  });

  it('should list in the strip a label the wide drawing would leave out for lack of room', () => {
    const crowd: PlotMarker[] = Array.from({ length: 9 }, (_, n) => ({ id: `s${n}`, kind: 'Execution', effect: 'Reduced', label: `Sold ${n + 1} at $4.00`, shortLabel: `Sold ${n + 1}`, isEntry: false }));
    const sessions = DAYS.slice(0, 9).map((_, i) => bren(i, i === 8 ? { markers: crowd } : {}));
    frameWidth(900);
    const wide = render(<CorridorPlot {...props({ sessions, sliderIndex: 8 })} />);
    const drawn = [...pnl(wide.container).querySelectorAll('text.marker-label')].length;
    expect(drawn, 'the wide drawing has no room for every sale').toBeLessThan(9);
    cleanup();
    vi.restoreAllMocks();
    frameWidth(340);
    const phone = render(<CorridorPlot {...props({ sessions, sliderIndex: 8 })} />);
    const listed = strip(phone.container)!.textContent;
    for (let n = 1; n <= 9; n += 1) expect(listed, `Sold ${n}`).toContain(`Sold ${n}`);
  });
});

describe('Corridor: a first crossing (decision 2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  // R-CORV-D: the Target first reached on Fri Nov 6 (slot 4); the plot is given every revealed session, so the flag stays.
  const crossed = (stop: 'Stop' | 'Target', label: string, at: number, upTo: number): PlotSession[] =>
    DAYS.slice(0, upTo + 1).map((_, i) => bren(i, i === at ? { firstCrossing: [{ line: stop, label, shortLabel: label }], keyEntries: [{ kind: 'FirstCrossing', label }] } : {}));
  const flags = (c: HTMLElement) => [...pnl(c).querySelectorAll('.first-crossing')];
  const words = (c: HTMLElement) => [...pnl(c).querySelectorAll('text.crossing-label')].map((t) => t.textContent);

  it('should flag a line at the session its condition was first crossed, labelled "Target reached" (R-CORV-D Fri 11-06) or "Stop breached" (R-AXIO-D Mon 11-09), and keep the flag on later sessions', () => {
    // Before the session is revealed there is no flag (P145); from it on, the flag is at its column.
    const before = render(<CorridorPlot {...props({ sessions: crossed('Target', 'Target reached', 4, 3), sliderIndex: 3 })} />);
    expect(flags(before.container)).toHaveLength(0);
    cleanup();
    const time = timeAxis(640, 15);
    for (const upTo of [4, 7, 10]) {
      const { container } = render(<CorridorPlot {...props({ sessions: crossed('Target', 'Target reached', 4, upTo), sliderIndex: upTo })} />);
      const [flag] = flags(container);
      expect(flags(container), `slider ${upTo}`).toHaveLength(1);
      expect(flag!.classList.contains('target')).toBe(true);
      expect(words(container)).toEqual(['Target reached']);
      expect(Math.abs(Number(/^M([\d.]+) /.exec(flag!.querySelector('path.flag-pole')!.getAttribute('d')!)![1]) - time.x(4))).toBeLessThan(1);
      cleanup();
    }
    const stop = render(<CorridorPlot {...props({ sessions: crossed('Stop', 'Stop breached', 5, 6), sliderIndex: 6 })} />);
    expect(words(stop.container)).toEqual(['Stop breached']);
    expect(flags(stop.container)[0]!.classList.contains('stop')).toBe(true);
  });

  it('should flag both the Stop and the Target on a session where both were first crossed, and name both in the key', () => {
    const sessions = DAYS.slice(0, 7).map((_, i) =>
      bren(i, i === 4 ? { firstCrossing: [{ line: 'Stop' as const, label: 'Stop breached' }, { line: 'Target' as const, label: 'Target reached' }], keyEntries: [{ kind: 'FirstCrossing' as const, label: 'Stop breached' }, { kind: 'FirstCrossing' as const, label: 'Target reached' }] } : {}),
    );
    const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: 6 })} />);
    expect(flags(container).map((f) => [...f.classList].filter((c) => c === 'stop' || c === 'target')[0])).toEqual(['stop', 'target']);
    expect(words(container).sort()).toEqual(['Stop breached', 'Target reached']);
    expect([...container.querySelectorAll('.replay-key li')].map((li) => li.textContent)).toEqual(['Stop breached', 'Target reached']);
  });

  it('should name the flag in the key, and list its words in the phone\'s strip', () => {
    const keyOf = (c: HTMLElement) => [...c.querySelectorAll('.replay-key li')].map((li) => li.textContent);
    // Wide: the key names the flag once it is on the page, in the flag's own words, and not before.
    const wide = render(<CorridorPlot {...props({ sessions: crossed('Target', 'Target reached', 4, 7), sliderIndex: 7 })} />);
    expect(keyOf(wide.container)).toEqual(['Target reached']);
    expect(wide.container.querySelector('.replay-key .key-FirstCrossing')).toBeTruthy();
    cleanup();
    // A key entry with no flag drawn (the session carries no crossing) is not named.
    const none = render(<CorridorPlot {...props({ sessions: [bren(0, { keyEntries: [{ kind: 'FirstCrossing', label: 'Target reached' }] })], sliderIndex: 0 })} />);
    expect(keyOf(none.container)).toEqual([]);
    cleanup();
    // A phone's drawing carries no label on a line: the words go to the strip under it, after the figures' labels.
    frameWidth(340);
    const phone = render(<CorridorPlot {...props({ sessions: crossed('Target', 'Target reached', 4, 7), sliderIndex: 7 })} />);
    expect(pnl(phone.container).querySelectorAll('text.crossing-label')).toHaveLength(0);
    expect(phone.container.querySelector('.replay-strip-labels')!.textContent).toContain('Target reached');
    expect(keyOf(phone.container)).toEqual(['Target reached']);
  });

  it('should name in the key only the flags that are drawn, each by its own words', () => {
    // A Target flag at slot 4 whose label finds no room (T9AR.24-B7 part 2: the flag searches every row to the floor, so its label is wider than
    // the whole drawing, and no row on either side holds it) and a Stop flag at slot 5 that is drawn.
    const wide = `Target reached ${'on a session whose label is wider than the drawing '.repeat(3)}`;
    const sessions = DAYS.slice(0, 7).map((_, i) =>
      bren(i, {
        ...(i === 4 && { resultAtTarget: null, tradePnl: 300, banked: 300, bankedLabel: 'Banked +$300 from a very long sale that takes the room', firstCrossing: [{ line: 'Target' as const, label: wide }], keyEntries: [{ kind: 'FirstCrossing' as const, label: wide }] }),
        ...(i === 5 && { firstCrossing: [{ line: 'Stop' as const, label: 'Stop breached' }], keyEntries: [{ kind: 'FirstCrossing' as const, label: 'Stop breached' }] }),
      }),
    );
    const { container } = render(<CorridorPlot {...props({ sessions, sliderIndex: 6 })} />);
    expect(words(container)).toEqual(['Stop breached']);
    expect([...container.querySelectorAll('.replay-key li')].map((li) => li.textContent)).toEqual(['Stop breached']);
  });

  it('should still flag a first crossing on a session with no Trade P&L, at the line\'s own level or at the top of the plot, and name it in the key and the phone\'s strip', () => {
    const noPnl = (withStop: boolean): PlotSession[] =>
      DAYS.slice(0, 7).map((_, i) =>
        bren(i, i === 4 ? { tradePnl: null, underlyingMark: null, resultAtStop: withStop ? stopAt(4) : null, firstCrossing: [{ line: 'Stop', label: 'Stop breached', shortLabel: 'Stop breached' }], keyEntries: [{ kind: 'FirstCrossing', label: 'Stop breached' }] } : {}),
      );
    const poleY = (c: HTMLElement) => Number(/^M[\d.]+ ([\d.]+)V([\d.]+)$/.exec(flags(c)[0]!.querySelector('path.flag-pole')!.getAttribute('d')!)![1]);
    const keyNames = (c: HTMLElement) => [...c.querySelectorAll('.replay-key li')].map((li) => li.textContent);
    // On the Stop line's own level while the session has the line.
    const on = render(<CorridorPlot {...props({ sessions: noPnl(true), sliderIndex: 6 })} />);
    expect(flags(on.container)).toHaveLength(1);
    expect(words(on.container)).toEqual(['Stop breached']);
    expect(keyNames(on.container)).toEqual(['Stop breached']);
    const lineY = Number(/^M[\d.]+ ([\d.]+)/.exec([...pnl(on.container).querySelectorAll('path.result-line.stop')].map((p) => p.getAttribute('d'))[0]!)![1]);
    expect(lineY).toBeGreaterThan(0);
    const levelY = poleY(on.container);
    cleanup();
    // With no figure to stand on, the flag is at the top of the plot, clear of the title row.
    const off = render(<CorridorPlot {...props({ sessions: noPnl(false), sliderIndex: 6 })} />);
    expect(flags(off.container)).toHaveLength(1);
    expect(words(off.container)).toEqual(['Stop breached']);
    expect(keyNames(off.container)).toEqual(['Stop breached']);
    expect(poleY(off.container)).toBeLessThan(levelY);
    cleanup();
    frameWidth(340);
    const phone = render(<CorridorPlot {...props({ sessions: noPnl(false), sliderIndex: 6 })} />);
    expect(flags(phone.container)).toHaveLength(1);
    expect(phone.container.querySelector('.replay-strip-labels')!.textContent).toContain('Stop breached');
  });
});

// T9AR.23-S7 (W67, A280): the first session's date stays at the left of the P&L chart; the cursor's name steps right of it.
describe('Corridor: the time axis keeps its first date (T9AR.23-S7)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const AXIS = { slots: 15, startLabel: 'Mon Nov 2', endLabels: ['Expires Fri Nov 20', 'Expires Nov 20', 'Exp Nov 20'] };
  const box = (t: Element) => {
    const w = t.textContent.length * 6 + 2;
    const x = num(t, 'x');
    const a = t.getAttribute('text-anchor');
    const x0 = a === 'start' ? x : a === 'end' ? x - w : x - w / 2;
    return [x0, x0 + w] as const;
  };

  it('should keep the first session date at the left when the cursor name would cover it, with the cursor name beside it and not overlapping it', () => {
    frameWidth(560);
    const { container } = render(<CorridorPlot {...props({ axis: AXIS, sliderIndex: 1, sessions: DAYS.slice(0, 2).map((_, i) => bren(i)) })} />);
    const start = pnl(container).querySelector('text.axis-start')!;
    const cursor = pnl(container).querySelector('text.cursor-label')!;
    expect([start.textContent, cursor.textContent]).toEqual(['Mon Nov 2', 'Tue Nov 3']);
    expect(box(start)[1]).toBeLessThanOrEqual(box(cursor)[0]);
  });

  it('should draw the first session date once at the left on the first session at 850 px', () => {
    frameWidth(850);
    const { container } = render(<CorridorPlot {...props({ axis: AXIS, sliderIndex: 0, sessions: [bren(0)] })} />);
    expect([...pnl(container).querySelectorAll('text')].filter((t) => t.textContent === 'Mon Nov 2').map((t) => t.getAttribute('class'))).toEqual(['axis-start']);
  });

  it('should keep both edge labels and leave out the cursor name on a chart too narrow for all three', () => {
    frameWidth(280);
    const { container } = render(<CorridorPlot {...props({ axis: AXIS, sliderIndex: 7, sessions: DAYS.slice(0, 8).map((_, i) => bren(i)) })} />);
    expect(pnl(container).querySelector('text.axis-start')).not.toBeNull();
    expect(pnl(container).querySelector('text.axis-end')).not.toBeNull();
    expect(pnl(container).querySelector('text.cursor-label')).toBeNull();
  });

  it('should draw the first end label form that clears the first date, unchanged, whatever shape the forms take', () => {
    const forms = ['Closes on Friday November 20 2026', 'Fri Nov 20', 'Nov 20'];
    frameWidth(640);
    const wide = render(<CorridorPlot {...props({ axis: { slots: 11, startLabel: 'Mon Nov 2', endLabels: forms }, sliderIndex: 0, sessions: [bren(0)] })} />);
    expect(pnl(wide.container).querySelector('text.axis-end')!.textContent).toBe(forms[0]);
    cleanup();
    frameWidth(200);
    const { container } = render(<CorridorPlot {...props({ axis: { slots: 11, startLabel: 'Mon Nov 2', endLabels: forms }, sliderIndex: 0, sessions: [bren(0)] })} />);
    const start = pnl(container).querySelector('text.axis-start')!;
    const end = pnl(container).querySelector('text.axis-end')!;
    expect(forms.indexOf(end.textContent)).toBeGreaterThan(0);
    expect(box(start)[1] + 4).toBeLessThanOrEqual(box(end)[0]);
  });

  it('should draw no end label when even the shortest form cannot clear the first date', () => {
    frameWidth(200);
    const { container } = render(<CorridorPlot {...props({ axis: { slots: 11, startLabel: 'Mon Nov 2', endLabels: ['Closes on Friday November 20 2026', 'Closes on Friday Nov 20'] }, sliderIndex: 0, sessions: [bren(0)] })} />);
    expect(pnl(container).querySelector('text.axis-end')).toBeNull();
  });

  it.each([200, 215, 223, 240])('should draw both edge labels without overlap at width %i on an option Trade', (w) => {
    frameWidth(w);
    const { container } = render(<CorridorPlot {...props({ axis: AXIS, sliderIndex: 0, sessions: [bren(0)] })} />);
    const start = pnl(container).querySelector('text.axis-start')!;
    const end = pnl(container).querySelector('text.axis-end')!;
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    expect(end.textContent).toContain('Nov 20');
    expect(box(start)[1]).toBeLessThanOrEqual(box(end)[0]);
    expect(box(end)[1]).toBeLessThanOrEqual(w);
  });
});
