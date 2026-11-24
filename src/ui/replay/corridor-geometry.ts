import { toDecimalString, type Rational } from '../../shared/exact-number';
import type { LongStockReplayModel } from '../../trade-analysis/replay';

export interface SparklinePoint {
  readonly sessionIndex: number;
  readonly x: number;
  readonly y: number;
}

export interface SparklineGeometry {
  readonly width: number;
  readonly height: number;
  readonly yZero: number;
  readonly stopRailPath: string;
  readonly targetRailPath: string;
  readonly pnlLineRuns: readonly (readonly SparklinePoint[])[];
  readonly pnlLinePaths: readonly string[];
  readonly lastDot: {
    readonly cx: number;
    readonly cy: number;
    readonly tone: 'up' | 'down' | 'flat';
  } | null;
}

export interface AxisTick {
  readonly value: number;
  readonly y: number;
  readonly label: string;
}

export interface XAxisLabel {
  readonly x: number;
  readonly label: string;
  readonly sessionIndex: number | null;
  readonly selected: boolean;
}

export interface PriceRefLine {
  readonly kind: 'stop' | 'target' | 'plan';
  readonly y: number;
  readonly label: string;
}

export interface PriceRun {
  readonly sessionIndices: readonly number[];
  readonly path: string;
}

export interface MissingMarkBand {
  readonly sessionIndex: number;
  readonly x: number;
  readonly width: number;
  readonly priceTop: number;
  readonly priceHeight: number;
  readonly top: number;
  readonly height: number;
  readonly textX: number;
  readonly textY: number;
}

export interface BankedSubRun {
  readonly sign: 'up' | 'down';
  readonly areaPath: string;
}

export interface PnlRun {
  readonly sessionIndices: readonly number[];
  readonly areaPath: string;
  readonly linePath: string;
  readonly bankedRuns: readonly BankedSubRun[];
}

const RAIL_REACH_FACTOR = 2.2;
const RAIL_MIN_SPAN_DOLLARS = 100;
const DOMAIN_MARGIN_FACTOR = 1.15;

function isRailInDomainReach(v: number, planStop: number, planTarget: number): boolean {
  const spanHint = Math.abs(planStop) + Math.abs(planTarget);
  return Number.isFinite(v) && Math.abs(v) <= Math.max(spanHint * RAIL_REACH_FACTOR, RAIL_MIN_SPAN_DOLLARS);
}

export interface CorridorGeometry {
  readonly width: number;
  readonly height: number;
  readonly narrow: boolean;
  readonly left: number;
  readonly plotRight: number;
  readonly planX: number;
  readonly slotWidth: number;
  readonly priceTop: number;
  readonly priceHeight: number;
  readonly priceBottom: number;
  readonly pnlTop: number;
  readonly pnlHeight: number;
  readonly pnlBottom: number;
  readonly yZero: number;
  readonly cursorX: number;
  readonly priceTicks: readonly AxisTick[];
  readonly priceRefLines: readonly PriceRefLine[];
  readonly priceRuns: readonly PriceRun[];
  readonly priceDots: readonly {
    readonly sessionIndex: number;
    readonly cx: number;
    readonly cy: number;
    readonly r: number;
    readonly selected: boolean;
  }[];
  readonly selectedPriceLabel: {
    readonly x: number;
    readonly y: number;
    readonly text: string;
    readonly anchor: 'start' | 'middle' | 'end';
  } | null;
  readonly execDiamonds: readonly {
    readonly sessionIndex: number;
    readonly d: string;
    readonly side: 'Buy' | 'Sell';
  }[];
  readonly missingBands: readonly MissingMarkBand[];
  readonly pnlTicks: readonly AxisTick[];
  readonly pnlRuns: readonly PnlRun[];
  readonly stopRailPath: string;
  readonly targetRailPath: string;
  readonly stopClipPolygons: readonly string[];
  readonly targetClipPolygons: readonly string[];
  readonly stopRailEndY: number;
  readonly targetRailEndY: number;
  readonly stopRailEndLabel: string;
  readonly targetRailEndLabel: string;
  readonly realizedStepPath: string;
  readonly pnlDots: readonly {
    readonly sessionIndex: number;
    readonly cx: number;
    readonly cy: number;
    readonly r: number;
    readonly tone: 'up' | 'down' | 'flat';
    readonly selected: boolean;
  }[];
  readonly execMarkers: readonly {
    readonly sessionIndex: number;
    readonly x: number;
    readonly triangleD: string;
    readonly labelY: number;
    readonly anchor: 'start' | 'middle' | 'end';
    readonly text: string;
  }[];
  readonly actionLabels: readonly {
    readonly sessionIndex: number;
    readonly x: number;
    readonly y: number;
    readonly code: 'H' | 'E' | '–' | '';
    readonly highlighted: boolean;
    readonly selected: boolean;
  }[];
  readonly xAxisLabels: readonly XAxisLabel[];
  readonly hitTargets: readonly {
    readonly sessionIndex: number;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
}

function toNum(r: Rational): number {
  return Number(toDecimalString(r, 4));
}

function f1(n: number): string {
  return n.toFixed(1);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function formatAxisMoney(v: number): string {
  const negSign = v < -0.004 ? '-' : '';
  const abs = Math.abs(v);
  const dec = abs > 0 && abs < 10 && Math.abs(abs % 1) > 0.005 ? 2 : 0;
  return `${negSign}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })}`;
}

function formatCompactSigned(v: number): string {
  const abs = Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (v > 0.49) return `+$${abs}`;
  if (v < -0.49) return `-$${abs}`;
  return '$0';
}

function niceTicks(min: number, max: number, want = 4): number[] {
  const span = max - min;
  if (!Number.isFinite(span) || span <= 1e-9) return [min];
  const raw = span / Math.max(1, want);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) {
    out.push(Math.abs(v) < 1e-9 ? 0 : Number(v.toFixed(6)));
  }
  return out;
}

function buildStepPath(pts: readonly [number, number][]): string {
  if (pts.length === 0) return '';
  return pts
    .map((p, idx) =>
      idx === 0 ? `M${f1(p[0])} ${f1(p[1])}` : `H${f1(p[0])}V${f1(p[1])}`,
    )
    .join('');
}

function buildAreaPolygonPath(
  pts: readonly { readonly x: number; readonly y: number }[],
  yZero: number,
  barHalf: number,
): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) {
    const p = pts[0]!;
    const x0 = p.x - barHalf;
    const x1 = p.x + barHalf;
    return `M${f1(x0)} ${f1(yZero)}L${f1(x0)} ${f1(p.y)}L${f1(x1)} ${f1(p.y)}L${f1(x1)} ${f1(yZero)}Z`;
  }
  const firstX = pts[0]!.x;
  const lastX = pts[pts.length - 1]!.x;
  const topPts = pts.map((p) => `L${f1(p.x)} ${f1(p.y)}`).join('');
  return `M${f1(firstX)} ${f1(yZero)}${topPts}L${f1(lastX)} ${f1(yZero)}Z`;
}

function buildOpenLinePath(pts: readonly { readonly x: number; readonly y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) {
    const p = pts[0]!;
    return `M${f1(p.x - 4)} ${f1(p.y)}L${f1(p.x + 4)} ${f1(p.y)}`;
  }
  return pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${f1(p.x)} ${f1(p.y)}`).join('');
}

export function buildSparklineGeometry(
  model: LongStockReplayModel,
  width = 200,
  height = 48,
): SparklineGeometry {
  const n = model.sessions.length;
  const padX = 4;
  const padY = 4;
  const xAt = (i: number) =>
    n <= 1 ? width / 2 : padX + (i * (width - padX * 2)) / (n - 1);

  const planStop = toNum(model.planRails.stop);
  const planTarget = toNum(model.planRails.target);

  const vals: number[] = [0, planStop * DOMAIN_MARGIN_FACTOR, planTarget * DOMAIN_MARGIN_FACTOR];
  for (const s of model.sessions) {
    if (s.totalPnl !== null) vals.push(toNum(s.totalPnl));
    if (!s.isClosed && s.atStopPnl !== null && s.atTargetPnl !== null) {
      const sv = toNum(s.atStopPnl);
      const tv = toNum(s.atTargetPnl);
      if (isRailInDomainReach(sv, planStop, planTarget)) vals.push(sv);
      if (isRailInDomainReach(tv, planStop, planTarget)) vals.push(tv);
    }
  }
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = (hi - lo) * 0.08 || 1;
  lo -= pad;
  hi += pad;
  const yAt = (v: number) => padY + clamp((hi - v) / (hi - lo), 0, 1) * (height - padY * 2);

  const live = model.sessions.filter(
    (s) => !s.isClosed && s.atStopPnl !== null && s.atTargetPnl !== null,
  );
  let stopRailPath = '';
  let targetRailPath = '';
  if (!model.isClosed && live.length === 1) {
    stopRailPath = `M${f1(padX)} ${f1(yAt(toNum(live[0]!.atStopPnl!)))}H${f1(width - padX)}`;
    targetRailPath = `M${f1(padX)} ${f1(yAt(toNum(live[0]!.atTargetPnl!)))}H${f1(width - padX)}`;
  } else if (live.length > 1) {
    stopRailPath = buildStepPath(live.map((s) => [xAt(s.index), yAt(toNum(s.atStopPnl!))]));
    targetRailPath = buildStepPath(live.map((s) => [xAt(s.index), yAt(toNum(s.atTargetPnl!))]));
  }

  const pnlLineRuns: SparklinePoint[][] = [];
  let curRun: SparklinePoint[] | null = null;
  let lastValid: { cx: number; cy: number; tone: 'up' | 'down' | 'flat' } | null = null;
  for (const s of model.sessions) {
    if (s.totalPnl === null) {
      curRun = null;
      continue;
    }
    const v = toNum(s.totalPnl);
    const pt: SparklinePoint = { sessionIndex: s.index, x: xAt(s.index), y: yAt(v) };
    if (!curRun) {
      curRun = [];
      pnlLineRuns.push(curRun);
    }
    curRun.push(pt);
    const tone: 'up' | 'down' | 'flat' =
      s.totalPnl.num > 0n ? 'up' : s.totalPnl.num < 0n ? 'down' : 'flat';
    lastValid = { cx: pt.x, cy: pt.y, tone };
  }

  const pnlLinePaths = pnlLineRuns.map((run) => buildOpenLinePath(run));

  return {
    width,
    height,
    yZero: yAt(0),
    stopRailPath,
    targetRailPath,
    pnlLineRuns,
    pnlLinePaths,
    lastDot: lastValid,
  };
}

export function buildCorridorGeometry(
  model: LongStockReplayModel,
  options: { readonly width: number; readonly narrow: boolean; readonly selectedIndex: number },
): CorridorGeometry {
  const { width, narrow } = options;
  const n = model.sessions.length;
  const selectedIndex = clamp(options.selectedIndex, 0, Math.max(0, n - 1));

  const left = narrow ? 48 : 62;
  const rightMargin = narrow ? 106 : 132;
  const plotRight = Math.max(left + 60, width - rightMargin);
  const plotWidth = plotRight - left;
  const slotWidth = plotWidth / Math.max(n + 1, 2);
  const planX = left + slotWidth * 0.5;
  const xAt = (i: number) => left + slotWidth * (1.5 + i);

  const priceTop = narrow ? 32 : 24;
  const priceHeight = 114;
  const priceBottom = priceTop + priceHeight;
  const pnlTop = priceBottom + 42;
  const pnlHeight = 196;
  const pnlBottom = pnlTop + pnlHeight;

  // Interval-packed execution markers along P&L floor to guarantee zero horizontal collisions
  const execMarkers: CorridorGeometry['execMarkers'][number][] = [];
  const rowSpans: { readonly start: number; readonly end: number }[][] = [];
  const labelGapPx = 8;
  let maxExecRow = 0;
  for (const s of model.sessions) {
    if (s.executionsToday.length === 0) continue;
    const x = xAt(s.index);
    const ex = s.executionsToday[s.executionsToday.length - 1]!;
    const verb = ex.side === 'Buy' ? 'Bought' : 'Sold';
    const countNote = s.executionsToday.length > 1 ? ` (+${s.executionsToday.length - 1})` : '';
    const text = narrow
      ? `${verb} ${ex.quantityDisplay}${countNote}`
      : `${verb} ${ex.quantityDisplay} at ${ex.fillPriceDisplay}${countNote}`;
    const estW = text.length * 6.8 + 10;

    let anchor: 'start' | 'middle' | 'end' = 'middle';
    if (s.index === 0 || x - estW / 2 < left) {
      anchor = 'start';
    } else if ((s.index === n - 1 && n > 1) || x + estW / 2 > width - 6) {
      anchor = 'end';
    }

    let spanStart = x - estW / 2;
    if (anchor === 'start') {
      spanStart = x;
    } else if (anchor === 'end') {
      spanStart = x - estW;
    }
    const spanEnd = spanStart + estW;

    let assignedRow = rowSpans.findIndex((rowList) =>
      rowList.every(
        (existing) =>
          spanEnd + labelGapPx <= existing.start || existing.end + labelGapPx <= spanStart,
      ),
    );
    if (assignedRow < 0) {
      assignedRow = rowSpans.length;
      rowSpans.push([]);
    }
    rowSpans[assignedRow]!.push({ start: spanStart, end: spanEnd });
    if (assignedRow > maxExecRow) maxExecRow = assignedRow;

    execMarkers.push({
      sessionIndex: s.index,
      x,
      triangleD: `M${f1(x)} ${f1(pnlBottom)}l-4.5 8h9z`,
      labelY: pnlBottom + 20 + assignedRow * 13,
      anchor,
      text,
    });
  }

  const actionY = pnlBottom + 49 + Math.max(0, maxExecRow - 1) * 13;
  const height = actionY + 10;

  // 1. Price Strip Scale & Series
  const stopPriceNum = toNum(model.stopPrice);
  const targetPriceNum = toNum(model.targetPrice);
  const entryPriceNum = toNum(model.intendedEntryPrice);
  const priceVals: number[] = [stopPriceNum, targetPriceNum, entryPriceNum];
  for (const s of model.sessions) {
    if (s.mark !== null) priceVals.push(toNum(s.mark));
    for (const ex of s.executionsToday) {
      priceVals.push(toNum(ex.fillPrice));
    }
  }
  let priceLo = Math.min(...priceVals);
  let priceHi = Math.max(...priceVals);
  const pricePad = (priceHi - priceLo) * 0.1 || 1;
  priceLo -= pricePad;
  priceHi += pricePad;
  const yPrice = (v: number) => priceTop + ((priceHi - v) / (priceHi - priceLo)) * priceHeight;

  const priceTicks: AxisTick[] = niceTicks(priceLo, priceHi, 3).map((v) => ({
    value: v,
    y: yPrice(v),
    label: formatAxisMoney(v),
  }));

  const priceRefLines: PriceRefLine[] = [
    { kind: 'stop', y: yPrice(stopPriceNum), label: `Stop ${model.stopPriceDisplay}` },
    { kind: 'target', y: yPrice(targetPriceNum), label: `Target ${model.targetPriceDisplay}` },
    { kind: 'plan', y: yPrice(entryPriceNum), label: `Entry ${model.intendedEntryDisplay}` },
  ];

  const priceRuns: PriceRun[] = [];
  let curPricePts: { sessionIndex: number; x: number; y: number }[] | null = null;
  const priceDots: {
    sessionIndex: number;
    cx: number;
    cy: number;
    r: number;
    selected: boolean;
  }[] = [];

  for (const s of model.sessions) {
    if (s.mark === null) {
      curPricePts = null;
      continue;
    }
    const cx = xAt(s.index);
    const cy = yPrice(toNum(s.mark));
    const isSel = s.index === selectedIndex;
    priceDots.push({ sessionIndex: s.index, cx, cy, r: isSel ? 5 : 2.8, selected: isSel });
    if (!curPricePts) {
      curPricePts = [];
      priceRuns.push({ sessionIndices: [], path: '' });
    }
    curPricePts.push({ sessionIndex: s.index, x: cx, y: cy });
    const runObj = priceRuns[priceRuns.length - 1]!;
    priceRuns[priceRuns.length - 1] = {
      sessionIndices: [...runObj.sessionIndices, s.index],
      path: buildOpenLinePath(curPricePts),
    };
  }

  const selSession = model.sessions[selectedIndex];
  const selectedPriceLabel =
    selSession && selSession.mark !== null && selSession.markDisplay
      ? {
          x: xAt(selectedIndex) - (selectedIndex === n - 1 && n > 1 ? 6 : 0),
          y: yPrice(toNum(selSession.mark)) - 9,
          text: selSession.markDisplay,
          anchor: (selectedIndex === n - 1 && n > 1 ? 'end' : 'middle') as
            | 'start'
            | 'middle'
            | 'end',
        }
      : null;

  const execDiamonds: { sessionIndex: number; d: string; side: 'Buy' | 'Sell' }[] = [];
  for (const s of model.sessions) {
    for (const ex of s.executionsToday) {
      const cx = xAt(s.index);
      const cy = yPrice(toNum(ex.fillPrice));
      const r = 5;
      execDiamonds.push({
        sessionIndex: s.index,
        side: ex.side,
        d: `M${f1(cx)} ${f1(cy - r)}L${f1(cx + r)} ${f1(cy)}L${f1(cx)} ${f1(cy + r)}L${f1(cx - r)} ${f1(cy)}Z`,
      });
    }
  }

  const missingBands: MissingMarkBand[] = model.sessions
    .filter((s) => s.missingMark)
    .map((s) => ({
      sessionIndex: s.index,
      x: xAt(s.index) - slotWidth / 2,
      width: slotWidth,
      priceTop,
      priceHeight,
      top: pnlTop,
      height: pnlHeight,
      textX: xAt(s.index) + 3.5,
      textY: pnlBottom - 6,
    }));

  // 2. Trade P&L Corridor Scale & Rails
  const planStop = toNum(model.planRails.stop);
  const planTarget = toNum(model.planRails.target);
  const liveSessions = model.sessions.filter(
    (s) => !s.isClosed && s.atStopPnl !== null && s.atTargetPnl !== null,
  );

  const pnlVals: number[] = [0, planStop * DOMAIN_MARGIN_FACTOR, planTarget * DOMAIN_MARGIN_FACTOR];
  for (const s of model.sessions) {
    if (s.totalPnl !== null) pnlVals.push(toNum(s.totalPnl));
    if (s.realizedPnl.num !== 0n) pnlVals.push(toNum(s.realizedPnl));
    if (!s.isClosed && s.atStopPnl !== null && s.atTargetPnl !== null) {
      const sv = toNum(s.atStopPnl);
      const tv = toNum(s.atTargetPnl);
      if (isRailInDomainReach(sv, planStop, planTarget)) pnlVals.push(sv);
      if (isRailInDomainReach(tv, planStop, planTarget)) pnlVals.push(tv);
    }
  }
  let pnlLo = Math.min(...pnlVals);
  let pnlHi = Math.max(...pnlVals);
  const pnlPad = (pnlHi - pnlLo) * 0.1 || 1;
  pnlLo -= pnlPad;
  pnlHi += pnlPad;
  const yPnl = (v: number) => pnlTop + ((pnlHi - v) / (pnlHi - pnlLo)) * pnlHeight;
  const yPnlClamp = (v: number) => clamp(yPnl(v), pnlTop, pnlBottom);
  const yZero = yPnlClamp(0);

  const pnlTicks: AxisTick[] = niceTicks(pnlLo, pnlHi, 4).map((v) => ({
    value: v,
    y: yPnl(v),
    label: formatAxisMoney(v),
  }));

  // Group contiguous live sessions so non-live slots (Oversold/Closed) break rails cleanly instead of bridging.
  const liveGroups: (typeof liveSessions)[number][][] = [];
  for (const s of liveSessions) {
    const prevGrp = liveGroups[liveGroups.length - 1];
    if (prevGrp && prevGrp[prevGrp.length - 1]!.index + 1 === s.index) {
      prevGrp.push(s);
    } else {
      liveGroups.push([s]);
    }
  }

  const endSession = model.sessions[n - 1]!;
  const endsLiveContiguous =
    !endSession.isClosed && endSession.atStopPnl !== null && endSession.atTargetPnl !== null;

  const buildRailSegments = (
    pick: (s: (typeof liveSessions)[number]) => number,
    planVal: number,
  ): [number, number][][] => {
    const segs: [number, number][][] = [];
    if (liveGroups.length === 0) {
      const seg: [number, number][] = [
        [left, planVal],
        [left + slotWidth, planVal],
      ];
      return [seg];
    }
    const firstGrp = liveGroups[0]!;
    if (firstGrp[0]!.index === 0) {
      const pts: [number, number][] = [
        [left, planVal],
        [left + slotWidth, planVal],
      ];
      for (const s of firstGrp) {
        const val = pick(s);
        pts.push([xAt(s.index) - slotWidth / 2, val], [xAt(s.index) + slotWidth / 2, val]);
      }
      if (liveGroups.length === 1 && endsLiveContiguous) {
        const lastPt = pts[pts.length - 1]!;
        if (plotRight - lastPt[0] > 0.05) pts.push([plotRight, lastPt[1]]);
      }
      segs.push(pts);
    } else {
      segs.push([
        [left, planVal],
        [left + slotWidth, planVal],
      ]);
      const pts: [number, number][] = [];
      for (const s of firstGrp) {
        const val = pick(s);
        pts.push([xAt(s.index) - slotWidth / 2, val], [xAt(s.index) + slotWidth / 2, val]);
      }
      if (liveGroups.length === 1 && endsLiveContiguous) {
        const lastPt = pts[pts.length - 1]!;
        if (plotRight - lastPt[0] > 0.05) pts.push([plotRight, lastPt[1]]);
      }
      segs.push(pts);
    }

    for (let g = 1; g < liveGroups.length; g += 1) {
      const grp = liveGroups[g]!;
      const pts: [number, number][] = [];
      for (const s of grp) {
        const val = pick(s);
        pts.push([xAt(s.index) - slotWidth / 2, val], [xAt(s.index) + slotWidth / 2, val]);
      }
      if (g === liveGroups.length - 1 && endsLiveContiguous) {
        const lastPt = pts[pts.length - 1]!;
        if (plotRight - lastPt[0] > 0.05) pts.push([plotRight, lastPt[1]]);
      }
      segs.push(pts);
    }
    return segs;
  };

  const stopRailSegs = buildRailSegments((s) => toNum(s.atStopPnl!), planStop);
  const targetRailSegs = buildRailSegments((s) => toNum(s.atTargetPnl!), planTarget);

  const formatSegsPath = (segs: readonly [number, number][][]) =>
    segs
      .map((seg) =>
        seg.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${f1(p[0])} ${f1(yPnlClamp(p[1]))}`).join(''),
      )
      .join('');

  const stopRailPath = formatSegsPath(stopRailSegs);
  const targetRailPath = formatSegsPath(targetRailSegs);

  const buildClipPolys = (segs: readonly [number, number][][], boundaryY: number): string[] =>
    segs.map((seg) => {
      const segStartX = seg[0]![0];
      const segEndX = seg[seg.length - 1]![0];
      const polyPts = seg.map((p) => `${f1(p[0])},${f1(yPnlClamp(p[1]))}`).join(' ');
      return `${polyPts} ${f1(segEndX)},${f1(boundaryY)} ${f1(segStartX)},${f1(boundaryY)}`;
    });

  const stopClipPolygons = buildClipPolys(stopRailSegs, height);
  const targetClipPolygons = buildClipPolys(targetRailSegs, 0);

  const lastLive = liveSessions[liveSessions.length - 1] ?? null;
  const endStopVal = lastLive ? toNum(lastLive.atStopPnl!) : planStop;
  const endTargetVal = lastLive ? toNum(lastLive.atTargetPnl!) : planTarget;
  const stopOffScale = endStopVal < pnlLo || endStopVal > pnlHi;
  const targetOffScale = endTargetVal < pnlLo || endTargetVal > pnlHi;
  let stopRailEndY = yPnlClamp(endStopVal) + 4;
  let targetRailEndY = yPnlClamp(endTargetVal) + 4;
  if (Math.abs(stopRailEndY - targetRailEndY) < 14) {
    targetRailEndY -= 7;
    stopRailEndY += 7;
  }

  // Contiguous P&L Runs (breaking cleanly at missing-Mark sessions)
  const barHalf = Math.min(8, slotWidth * 0.25);
  const pnlRuns: PnlRun[] = [];
  let activeRun: {
    sessionIndices: number[];
    areaPts: { x: number; y: number }[];
    linePts: { x: number; y: number }[];
    banked: { x: number; y: number; sign: 'up' | 'down' | null }[];
  } | null = null;

  const flushRun = () => {
    if (!activeRun || activeRun.sessionIndices.length === 0) {
      activeRun = null;
      return;
    }
    const bankedRuns: BankedSubRun[] = [];
    let bSign: 'up' | 'down' | null = null;
    let bPts: { x: number; y: number }[] = [];
    const flushBanked = () => {
      if (bSign && bPts.length > 0) {
        bankedRuns.push({
          sign: bSign,
          areaPath: buildAreaPolygonPath(bPts, yZero, barHalf),
        });
      }
      bSign = null;
      bPts = [];
    };
    for (const bp of activeRun.banked) {
      if (!bp.sign) {
        flushBanked();
        continue;
      }
      if (bSign && bSign !== bp.sign) {
        flushBanked();
      }
      bSign = bp.sign;
      bPts.push({ x: bp.x, y: bp.y });
    }
    flushBanked();

    pnlRuns.push({
      sessionIndices: activeRun.sessionIndices,
      areaPath: buildAreaPolygonPath(activeRun.areaPts, yZero, barHalf),
      linePath: buildOpenLinePath(activeRun.linePts),
      bankedRuns,
    });
    activeRun = null;
  };

  for (const s of model.sessions) {
    if (s.totalPnl === null) {
      flushRun();
      continue;
    }
    const val = toNum(s.totalPnl);
    const x = xAt(s.index);
    const y = yPnl(val);
    if (!activeRun) {
      activeRun = {
        sessionIndices: [],
        areaPts: s.index === 0 ? [{ x: left + slotWidth, y: yZero }] : [],
        linePts: [],
        banked: [],
      };
    }
    activeRun.sessionIndices.push(s.index);
    activeRun.areaPts.push({ x, y });
    activeRun.linePts.push({ x, y });
    const bVal = toNum(s.bankedPart);
    activeRun.banked.push({
      x,
      y: yPnl(bVal),
      sign: s.bankedPart.num > 0n ? 'up' : s.bankedPart.num < 0n ? 'down' : null,
    });
  }
  flushRun();

  const hasAnyRealized = model.sessions.some((s) => s.realizedPnl.num !== 0n);
  const realizedStepPts: [number, number][] = [];
  if (hasAnyRealized) {
    for (const s of model.sessions) {
      const yReal = yPnlClamp(toNum(s.realizedPnl));
      realizedStepPts.push([xAt(s.index) - slotWidth / 2, yReal]);
      realizedStepPts.push([xAt(s.index) + slotWidth / 2, yReal]);
    }
  }
  const realizedStepPath =
    realizedStepPts.length > 0
      ? realizedStepPts
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${f1(p[0])} ${f1(p[1])}`)
          .join('')
      : '';

  const pnlDots = model.sessions
    .filter((s) => s.totalPnl !== null)
    .map((s) => {
      const val = toNum(s.totalPnl!);
      const isSel = s.index === selectedIndex;
      return {
        sessionIndex: s.index,
        cx: xAt(s.index),
        cy: yPnl(val),
        r: isSel ? 5.5 : 3,
        tone: (s.totalPnl!.num > 0n ? 'up' : s.totalPnl!.num < 0n ? 'down' : 'flat') as
          | 'up'
          | 'down'
          | 'flat',
        selected: isSel,
      };
    });

  const actionLabels = model.sessions.map((s) => ({
    sessionIndex: s.index,
    x: xAt(s.index),
    y: actionY,
    code: s.actionCode,
    highlighted: s.reviewAction.kind === 'Exit',
    selected: s.index === selectedIndex,
  }));

  const step = slotWidth < 18 ? 2 : 1;
  const xAxisLabels: XAxisLabel[] = [{ x: planX, label: 'Plan', sessionIndex: null, selected: false }];
  for (const s of model.sessions) {
    if (step > 1 && s.index % 2 === 1 && s.index !== selectedIndex) continue;
    if (step > 1 && s.index !== selectedIndex && Math.abs(s.index - selectedIndex) === 1) continue;
    const dayNum = String(Number(s.sessionDate.slice(8)));
    xAxisLabels.push({
      x: xAt(s.index),
      label: dayNum,
      sessionIndex: s.index,
      selected: s.index === selectedIndex,
    });
  }

  const hitTargets = model.sessions.map((s) => ({
    sessionIndex: s.index,
    x: xAt(s.index) - slotWidth / 2,
    y: 0,
    width: slotWidth,
    height,
  }));

  return {
    width,
    height,
    narrow,
    left,
    plotRight,
    planX,
    slotWidth,
    priceTop,
    priceHeight,
    priceBottom,
    pnlTop,
    pnlHeight,
    pnlBottom,
    yZero,
    cursorX: xAt(selectedIndex),
    priceTicks,
    priceRefLines,
    priceRuns,
    priceDots,
    selectedPriceLabel,
    execDiamonds,
    missingBands,
    pnlTicks,
    pnlRuns,
    stopRailPath,
    targetRailPath,
    stopClipPolygons,
    targetClipPolygons,
    stopRailEndY,
    targetRailEndY,
    stopRailEndLabel: model.isClosed
      ? ''
      : `Stop ${formatCompactSigned(endStopVal)}${stopOffScale ? ' (off-scale)' : ''}`,
    targetRailEndLabel: model.isClosed
      ? ''
      : `Target ${formatCompactSigned(endTargetVal)}${targetOffScale ? ' (off-scale)' : ''}`,
    realizedStepPath,
    pnlDots,
    execMarkers,
    actionLabels,
    xAxisLabels,
    hitTargets,
  };
}
