// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    describedBy: 'replay-table',
    sessions: DAYS.map((_, i) => bren(i)),
    anchors: {
      entryPrice: 97,
      priceLines: [{ kind: 'Strike', price: 100, label: 'Strike $100' }],
      planAtStop: fig(-324, 'Stop −$324'),
      planAtTarget: fig(956, 'Target +$956'),
    },
    axis: { slots: 15, endLabel: 'Fri Nov 20' },
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
    expect(edgeXs.some((x) => x > gapX[2]! && x < gapX[3]!)).toBe(false);
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
      expect(Math.min(...xs(cls))).toBeGreaterThan(cx - 15);
      expect(Math.max(...xs(cls))).toBeLessThan(cx + 15);
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
    render(<CorridorPlot {...props({ sessions: sessions.slice(0, 1), sliderIndex: 0, compact: true })} />);
    expect(screen.getByText('Risk $352')).toBeTruthy();
    expect(screen.getByText('Reward $928')).toBeTruthy();
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
    render(<CorridorPlot {...props({ compact: true })} />);
    expect(screen.getByText('Sold 2')).toBeTruthy();
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

  it('should leave out a label that has no free spot, and never the result or the stake tags', () => {
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
    // The result and stake tags stay, even where they have no free spot.
    expect(screen.getByText('Stop +$316')).toBeTruthy();
    expect(screen.getByText('Target +$316')).toBeTruthy();
    expect(screen.getByText('Risk to stop $672')).toBeTruthy();
    expect(screen.getByText('Reward to target $0')).toBeTruthy();
    cleanup();
    // The price strip's labels follow the same rule: three lines at one price leave room for only two labels.
    const same = (kind: 'Strike' | 'Stop' | 'Target') => ({ kind, price: 100, label: `${kind} $100` });
    const labelled = DAYS.map((_, i) => bren(i, i === 10 ? { underlyingLabel: '$104.00' } : {}));
    const strip = render(<CorridorPlot {...props({ sessions: labelled, anchors: { ...props().anchors, priceLines: [same('Strike'), same('Stop'), same('Target')] } })} />);
    expect(strip.container.querySelectorAll('svg.price-strip path.price-line')).toHaveLength(3);
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
    expect(pnl(container).querySelectorAll('text.stake-tag')).toHaveLength(2);
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
    expect(screen.getByText('Risk $672')).toBeTruthy();
    expect(screen.getByText('Reward $928')).toBeTruthy();
    expect(screen.queryByText('Risk to stop $672')).toBeNull();
    expect(screen.queryByText('Sold 2 at $4.00')).toBeNull();
    cleanup();
    // A wide box keeps the long words at the full drawing.
    vi.restoreAllMocks();
    frameWidth(900);
    const wide = render(<CorridorPlot {...props({ sessions })} />);
    expect(wide.container.querySelector('svg.price-strip')!.getAttribute('width')).toBe('640');
    expect(screen.getByText('Risk to stop $672')).toBeTruthy();
  });

  it('should draw at 240 wide, scaled to fit, when the box is narrower than 240', () => {
    frameWidth(200);
    const { container } = render(<CorridorPlot {...props()} />);
    expect(container.querySelector('svg.price-strip')!.getAttribute('width')).toBe('240');
    expect(pnl(container).getAttribute('width')).toBe('240');
  });

  it('should keep the result and banked labels when drawn narrow', () => {
    for (const width of [280, 240]) {
      frameWidth(width);
      const { container } = render(<CorridorPlot {...props()} />);
      expect(pnl(container).getAttribute('width')).toBe(String(width));
      const text = [...pnl(container).querySelectorAll('text')].map((t) => t.textContent);
      expect(text, `${width}: ${text.join(' | ')}`).toEqual(expect.arrayContaining(['Stop +$316', 'Target +$956', 'Banked +$478']));
      // Each of them sits inside the drawing, so none is cut off at the edge.
      for (const t of pnl(container).querySelectorAll('text.result-label, text.banked-label')) {
        const x = num(t, 'x');
        const w = t.textContent.length * 6;
        const start = t.getAttribute('text-anchor') === 'end' ? x - w : t.getAttribute('text-anchor') === 'middle' ? x - w / 2 : x;
        expect(start).toBeGreaterThanOrEqual(0);
        expect(start + w).toBeLessThanOrEqual(width);
      }
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
      const t = [...pnl(container).querySelectorAll('text.banked-label')].find((e) => e.textContent === 'Banked +$478')!;
      expect(t, `${width}: the banked label is kept`).toBeTruthy();
      const x = num(t, 'x');
      const w = t.textContent.length * 6;
      const start = t.getAttribute('text-anchor') === 'end' ? x - w : x;
      expect(start, `${width}: left edge`).toBeGreaterThanOrEqual(0);
      expect(start + w, `${width}: right edge`).toBeLessThanOrEqual(width);
      cleanup();
      vi.restoreAllMocks();
    }
  });
});
