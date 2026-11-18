// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CorridorPlot } from './corridor.tsx';
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
});
