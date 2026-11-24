import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ExactNumber,
  fromDecimalString,
  toDecimalString,
} from '../../src/shared/exact-number';
import { replayLongStockTrade, type LongStockReplayModel } from '../../src/trade-analysis/replay';
import {
  buildCorridorGeometry,
  buildSparklineGeometry,
} from '../../src/ui/replay/corridor-geometry';
import { makeExecution, makeLongStockPlan, ser } from '../helpers/builders';

function assertAllCoordsFinite(values: readonly number[]) {
  for (const v of values) {
    expect(Number.isFinite(v)).toBe(true);
  }
}

function solvePnlY(ticks: readonly { readonly value: number; readonly y: number }[], value: number): number {
  expect(ticks.length).toBeGreaterThanOrEqual(2);
  const t0 = ticks[0]!;
  const t1 = ticks[ticks.length - 1]!;
  const slope = (t1.y - t0.y) / (t1.value - t0.value);
  return t0.y + slope * (value - t0.value);
}

function buildWorkedCorridorModel(): LongStockReplayModel {
  return replayLongStockTrade({
    tradeId: 'trd-geom',
    symbol: 'AXIO',
    sessions: ['2026-11-02', '2026-11-03', '2026-11-04'],
    reviewDate: '2026-11-04',
    plan: makeLongStockPlan(),
    originalPlannedRisk: ser('300.00'),
    executions: [
      makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00' }),
      makeExecution({
        id: 's1',
        side: 'Sell',
        quantity: '50',
        fillPrice: '55.00',
        economicTime: '2026-11-03T15:00:00.000Z',
        recordedSequence: 3,
      }),
    ],
    effectiveMarks: [
      { sessionDate: '2026-11-02', price: ser('49.00') },
      { sessionDate: '2026-11-03', price: ser('54.00') },
      { sessionDate: '2026-11-04', price: ser('57.00') },
    ],
    reviewActions: [
      { reviewDate: '2026-11-02', action: 'Hold' },
      { reviewDate: '2026-11-03', action: 'Hold' },
    ],
  });
}

describe('Corridor SVG geometry engine (pure TypeScript)', () => {
  it('lays out desktop (720px) margins, hitTargets, and finite rail anchor coordinates', () => {
    const geom = buildCorridorGeometry(buildWorkedCorridorModel(), {
      width: 720,
      narrow: false,
      selectedIndex: 2,
    });
    expect(geom.width).toBe(720);
    expect(geom.left).toBe(62);
    expect(geom.hitTargets).toHaveLength(3);
    expect(geom.stopRailEndLabel).toBe('Stop +$100');
    expect(geom.targetRailEndLabel).toBe('Target +$550');
    assertAllCoordsFinite([geom.yZero, geom.cursorX, geom.stopRailEndY, geom.targetRailEndY]);
  });

  it('produces positive banked sub-run, execution diamonds, and desktop marker text', () => {
    const geom = buildCorridorGeometry(buildWorkedCorridorModel(), {
      width: 720,
      narrow: false,
      selectedIndex: 2,
    });
    expect(geom.pnlRuns).toHaveLength(1);
    expect(geom.pnlRuns[0]!.bankedRuns).toHaveLength(1);
    expect(geom.pnlRuns[0]!.bankedRuns[0]!.sign).toBe('up');
    expect(geom.pnlRuns[0]!.bankedRuns[0]!.areaPath).toMatch(/^M[\d.-]+ [\d.-]+L/);
    expect(geom.execDiamonds).toHaveLength(2);
    expect(geom.execMarkers.map((m) => m.text)).toEqual(['Bought 100 at $50.00', 'Sold 50 at $55.00']);
    expect(geom.actionLabels.map((a) => a.code)).toEqual(['H', 'H', '']);
  });

  it('switches margins, heights, and abbreviated execution marker copy cleanly for narrow 340px layout', () => {
    const geom = buildCorridorGeometry(buildWorkedCorridorModel(), {
      width: 340,
      narrow: true,
      selectedIndex: 1,
    });
    expect(geom.width).toBe(340);
    expect(geom.left).toBe(48);
    expect(geom.plotRight).toBe(234);
    expect(geom.execMarkers.map((m) => m.text)).toEqual(['Bought 100', 'Sold 50']);
    assertAllCoordsFinite([geom.yZero, geom.cursorX, geom.stopRailEndY, geom.targetRailEndY]);
  });

  it('splits price and P&L runs at every missing-Mark index with explicit No Mark bands and zero bridging', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-gaps',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'],
      reviewDate: '2026-11-06',
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-03', price: ser('51.00') },
        { sessionDate: '2026-11-05', price: ser('48.50') },
      ],
    });

    const geom = buildCorridorGeometry(model, { width: 720, narrow: false, selectedIndex: 3 });

    expect(geom.missingBands.map((b) => b.sessionIndex)).toEqual([0, 2, 4]);
    expect(geom.priceRuns.map((r) => r.sessionIndices)).toEqual([[1], [3]]);
    expect(geom.pnlRuns.map((r) => r.sessionIndices)).toEqual([[1], [3]]);
    for (const run of geom.pnlRuns) {
      expect(run.areaPath).toMatch(/^M.*Z$/);
    }

    const spark = buildSparklineGeometry(model);
    expect(spark.pnlLineRuns.map((r) => r.map((p) => p.sessionIndex))).toEqual([[1], [3]]);
  });

  it('draws exact Plan-slot rails computed from planRails.stop (-$300) and hides live exposure rails on 1-session Closed trades', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-1day',
      symbol: 'AXIO',
      sessions: ['2026-11-02'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00' }),
        makeExecution({
          id: 's1',
          side: 'Sell',
          quantity: '100',
          fillPrice: '52.00',
          economicTime: '2026-11-02T15:45:00.000Z',
          recordedSequence: 3,
        }),
      ],
      effectiveMarks: [{ sessionDate: '2026-11-02', price: ser('52.00') }],
    });

    const geom = buildCorridorGeometry(model, { width: 720, narrow: false, selectedIndex: 0 });
    const expectedStopY = solvePnlY(geom.pnlTicks, -300).toFixed(1);
    const planRightX = geom.left + geom.slotWidth;
    expect(geom.stopRailPath).toBe(`M${geom.left.toFixed(1)} ${expectedStopY}L${planRightX.toFixed(1)} ${expectedStopY}`);
    expect(geom.stopClipPolygons).toEqual([
      expect.stringContaining(`${planRightX.toFixed(1)},${geom.height.toFixed(1)}`),
    ]);
    expect(geom.targetClipPolygons).toEqual([
      expect.stringContaining(`${planRightX.toFixed(1)},0`),
    ]);
    expect(geom.stopRailEndLabel).toBe('');
    expect(geom.targetRailEndLabel).toBe('');
    expect(geom.missingBands).toEqual([]);

    const spark = buildSparklineGeometry(model);
    expect(spark.stopRailPath).toBe('');
    expect(spark.targetRailPath).toBe('');
    expect(spark.lastDot).toEqual({ cx: 100, cy: expect.any(Number), tone: 'up' });
  });

  it('stops Stop/Target rails and overrun clip polygons before Closed slots when closing sale slips past Stop', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-closed-slip',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03', '2026-11-04'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({
          id: 'b1',
          quantity: '100',
          fillPrice: '50.00',
          economicTime: '2026-11-02T15:00:00.000Z',
        }),
        makeExecution({
          id: 's1',
          side: 'Sell',
          quantity: '100',
          fillPrice: '45.00',
          economicTime: '2026-11-04T15:30:00.000Z',
          recordedSequence: 3,
        }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('49.00') },
        { sessionDate: '2026-11-03', price: ser('48.00') },
        { sessionDate: '2026-11-04', price: ser('45.00') },
      ],
    });

    const geom = buildCorridorGeometry(model, { width: 720, narrow: false, selectedIndex: 2 });
    const lastLiveRightX = geom.hitTargets[1]!.x + geom.slotWidth;
    expect(lastLiveRightX).toBeLessThan(geom.plotRight);
    expect(geom.stopClipPolygons[0]).toContain(`${lastLiveRightX.toFixed(1)},${geom.height.toFixed(1)}`);
    expect(geom.stopClipPolygons[0]).not.toContain(`${geom.plotRight.toFixed(1)},`);
    expect(geom.targetClipPolygons[0]).not.toContain(`${geom.plotRight.toFixed(1)},`);
    expect(geom.stopRailEndLabel).toBe('');
    expect(geom.targetRailEndLabel).toBe('');
    expect(geom.missingBands).toEqual([]);
  });

  it('sets sparkline lastDot tone to flat when latest marked session totalPnl is exactly $0.00', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-flat',
      symbol: 'AXIO',
      sessions: ['2026-11-02'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution({ quantity: '100', fillPrice: '50.00', fee: '0.00' })],
      effectiveMarks: [{ sessionDate: '2026-11-02', price: ser('50.00') }],
    });

    const spark = buildSparklineGeometry(model);
    expect(spark.lastDot?.tone).toBe('flat');
  });

  it('handles zero-Mark all-gap trades cleanly without NaN across Corridor and Sparkline', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-zero',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [],
    });

    const geom = buildCorridorGeometry(model, { width: 720, narrow: false, selectedIndex: 0 });
    expect(geom.missingBands).toHaveLength(2);
    expect(geom.priceRuns).toHaveLength(0);
    expect(geom.pnlRuns).toHaveLength(0);
    expect(geom.selectedPriceLabel).toBeNull();
    assertAllCoordsFinite([geom.yZero, geom.cursorX, geom.stopRailEndY, geom.targetRailEndY]);

    const spark = buildSparklineGeometry(model);
    expect(spark.pnlLineRuns).toHaveLength(0);
    expect(spark.lastDot).toBeNull();
    assertAllCoordsFinite([spark.yZero]);
  });

  it('handles a strictly zero-span price domain cleanly without NaN or infinite ticks', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-zero-price-span',
      symbol: 'AXIO',
      sessions: ['2026-11-02'],
      plan: makeLongStockPlan({
        intendedEntryPrice: '50.00',
        stopPrice: '50.00',
        targetPrice: '50.00',
      }),
      originalPlannedRisk: ser('100.00'),
      executions: [makeExecution({ fillPrice: '50.00' })],
      effectiveMarks: [{ sessionDate: '2026-11-02', price: ser('50.00') }],
    });

    const geom = buildCorridorGeometry(model, { width: 720, narrow: false, selectedIndex: 0 });
    expect(geom.priceTicks.length).toBeGreaterThan(0);
    assertAllCoordsFinite(geom.priceTicks.map((t) => t.y));
    assertAllCoordsFinite(geom.priceDots.map((d) => d.cy));
  });

  it('draws horizontal sparkline Stop/Target rails when open and live.length === 1', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-1live',
      symbol: 'AXIO',
      sessions: ['2026-11-02'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [{ sessionDate: '2026-11-02', price: ser('51.00') }],
    });

    const spark = buildSparklineGeometry(model);
    expect(spark.stopRailPath).toMatch(/^M[\d.-]+ [\d.-]+H[\d.-]+$/);
    expect(spark.targetRailPath).toMatch(/^M[\d.-]+ [\d.-]+H[\d.-]+$/);
    expect(spark.stopRailPath).not.toBe(spark.targetRailPath);
  });

  it('splits bankedRuns on sign flip and deterministically separates rail end labels within 14px', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-flip',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03', '2026-11-04'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({
          id: 'b1',
          quantity: '100',
          fillPrice: '50.00',
          economicTime: '2026-11-02T15:00:00.000Z',
          recordedSequence: 2,
        }),
        makeExecution({
          id: 's1',
          side: 'Sell',
          quantity: '20',
          fillPrice: '55.00',
          economicTime: '2026-11-03T15:00:00.000Z',
          recordedSequence: 3,
        }),
        makeExecution({
          id: 's2',
          side: 'Sell',
          quantity: '79',
          fillPrice: '40.00',
          economicTime: '2026-11-04T15:00:00.000Z',
          recordedSequence: 4,
        }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('52.00') },
        { sessionDate: '2026-11-03', price: ser('55.00') },
        { sessionDate: '2026-11-04', price: ser('40.00') },
      ],
    });

    const geom = buildCorridorGeometry(model, { width: 720, narrow: false, selectedIndex: 2 });
    expect(geom.pnlRuns).toHaveLength(1);
    expect(geom.pnlRuns[0]!.bankedRuns.map((b) => b.sign)).toEqual(['up', 'down']);

    const endStopVal = Number(toDecimalString(model.sessions[2]!.atStopPnl!, 4));
    const endTargetVal = Number(toDecimalString(model.sessions[2]!.atTargetPnl!, 4));
    const rawStopY = solvePnlY(geom.pnlTicks, endStopVal);
    const rawTargetY = solvePnlY(geom.pnlTicks, endTargetVal);
    expect(Math.abs(rawStopY - rawTargetY)).toBeLessThan(14); // non-vacuity proof: separation branch must execute
    expect(geom.stopRailEndY).toBeCloseTo(rawStopY + 4 + 7, 1);
    expect(geom.targetRailEndY).toBeCloseTo(rawTargetY + 4 - 7, 1);
  });

  it('breaks Stop/Target rail subpaths and clip polygons across non-contiguous Oversold or Closed slots', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-gap-rail',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03', '2026-11-04'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00', economicTime: '2026-11-02T15:00:00.000Z', recordedSequence: 2 }),
        makeExecution({ id: 's1', side: 'Sell', quantity: '100', fillPrice: '52.00', economicTime: '2026-11-03T15:00:00.000Z', recordedSequence: 3 }),
        makeExecution({ id: 'b2', quantity: '50', fillPrice: '53.00', economicTime: '2026-11-04T15:00:00.000Z', recordedSequence: 4 }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('51.00') },
        { sessionDate: '2026-11-03', price: ser('52.00') },
        { sessionDate: '2026-11-04', price: ser('54.00') },
      ],
    });

    const geom = buildCorridorGeometry(model, { width: 720, narrow: false, selectedIndex: 2 });
    const mCount = geom.stopRailPath.split('M').length - 1;
    expect(mCount).toBe(2);
    expect(geom.stopClipPolygons).toHaveLength(2);
    expect(geom.targetClipPolygons).toHaveLength(2);
  });

  it('labels out-of-domain Stop/Target rails as off-scale instead of hiding clamping silently', () => {
    const model = replayLongStockTrade({
      tradeId: 'trd-offscale',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00', economicTime: '2026-11-02T15:00:00.000Z', recordedSequence: 2 }),
        makeExecution({ id: 'b2', quantity: '900', fillPrice: '50.00', economicTime: '2026-11-03T15:00:00.000Z', recordedSequence: 3 }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('50.50') },
        { sessionDate: '2026-11-03', price: ser('50.50') },
      ],
    });

    const geom = buildCorridorGeometry(model, { width: 720, narrow: false, selectedIndex: 1 });
    expect(geom.stopRailEndLabel).toContain('(off-scale)');
    expect(geom.targetRailEndLabel).toContain('(off-scale)');

    // Shared inReach filter stops sparkline domain from squashing P&L when scaled-in rails jump far out of reach
    const spark = buildSparklineGeometry(model);
    expect(spark.pnlLineRuns[0]![0]!.y).not.toBeCloseTo(spark.yZero, 0);
  });

  it('enforces finite bounds, gap isolation, and in-bounds dot Y coords across 100 random multi-session models', () => {
    const sessionsPool = [
      '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05',
      '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11',
      '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17',
    ];
    const arb = fc.record({
      count: fc.integer({ min: 1, max: 12 }),
      narrow: fc.boolean(),
      partialRatio: fc.integer({ min: 1, max: 99 }),
      marks: fc.array(fc.option(fc.integer({ min: 4000, max: 6500 }), { nil: null }), {
        minLength: 12,
        maxLength: 12,
      }),
      closeAtEnd: fc.boolean(),
    });

    let skippedLabelsObserved = 0;
    fc.assert(
      fc.property(arb, ({ count, narrow, partialRatio, marks, closeAtEnd }) => {
        const sessions = sessionsPool.slice(0, count);
        const execs = [
          makeExecution({
            id: 'b1',
            quantity: '100',
            fillPrice: '50.00',
            economicTime: `${sessions[0]!}T14:35:00.000Z`,
          }),
        ];
        if (count >= 2 && partialRatio < 100) {
          execs.push(
            makeExecution({
              id: 's-part',
              side: 'Sell',
              quantity: String(partialRatio),
              fillPrice: '52.00',
              economicTime: `${sessions[1]!}T15:00:00.000Z`,
              recordedSequence: 3,
            }),
          );
        }
        if (closeAtEnd) {
          const rem = count >= 2 ? 100 - partialRatio : 100;
          execs.push(
            makeExecution({
              id: 's-end',
              side: 'Sell',
              quantity: String(rem),
              fillPrice: '53.00',
              economicTime: `${sessions[count - 1]!}T15:30:00.000Z`,
              recordedSequence: 4,
            }),
          );
        }
        const effMarks: { sessionDate: string; price: ReturnType<typeof ExactNumber.toJSON> }[] = [];
        for (let i = 0; i < count; i += 1) {
          const m = marks[i];
          if (m !== null && m !== undefined) {
            effMarks.push({
              sessionDate: sessions[i]!,
              price: ExactNumber.toJSON(fromDecimalString((m / 100).toFixed(2))),
            });
          }
        }
        const model: LongStockReplayModel = replayLongStockTrade({
          tradeId: 'trd-f',
          symbol: 'AXIO',
          sessions,
          plan: makeLongStockPlan(),
          originalPlannedRisk: ser('300.00'),
          executions: execs,
          effectiveMarks: effMarks,
        });

        const geom = buildCorridorGeometry(model, {
          width: narrow ? 340 : 720,
          narrow,
          selectedIndex: model.initialSelectedIndex,
        });

        if (geom.xAxisLabels.length < count + 1) skippedLabelsObserved += 1;
        expect(geom.hitTargets).toHaveLength(count);
        assertAllCoordsFinite([geom.yZero, geom.cursorX, geom.stopRailEndY, geom.targetRailEndY]);
        for (const dot of geom.pnlDots) {
          expect(dot.cy).toBeGreaterThanOrEqual(geom.pnlTop - 0.5);
          expect(dot.cy).toBeLessThanOrEqual(geom.pnlBottom + 0.5);
        }

        const missingSet = new Set(
          model.sessions.filter((s) => s.missingMark).map((s) => s.index),
        );
        for (const run of geom.priceRuns) {
          for (const idx of run.sessionIndices) {
            expect(missingSet.has(idx)).toBe(false);
          }
        }
        for (const run of geom.pnlRuns) {
          for (const idx of run.sessionIndices) {
            expect(model.sessions[idx]!.totalPnl).not.toBeNull();
          }
        }
      }),
      { numRuns: 100 },
    );
    expect(skippedLabelsObserved).toBeGreaterThan(0);
  });

  it('staggers overlapping adjacent execution markers onto separate rows for 2-session desktop and 3-session mobile', () => {
    const markerSpan = (m: { x: number; anchor: 'start' | 'middle' | 'end'; text: string }) => {
      const w = m.text.length * 6.8 + 10;
      if (m.anchor === 'start') return { start: m.x, end: m.x + w };
      if (m.anchor === 'end') return { start: m.x - w, end: m.x };
      return { start: m.x - w / 2, end: m.x + w / 2 };
    };

    const twoDayClosed = replayLongStockTrade({
      tradeId: 'trd-bren-overlap',
      symbol: 'BREN',
      sessions: ['2026-11-17', '2026-11-18'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('400.00'),
      executions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '80.00', economicTime: '2026-11-17T15:00:00.000Z', recordedSequence: 2 }),
        makeExecution({ id: 's1', side: 'Sell', quantity: '100', fillPrice: '89.00', economicTime: '2026-11-18T15:30:00.000Z', recordedSequence: 3 }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-17', price: ser('82.00') },
        { sessionDate: '2026-11-18', price: ser('89.00') },
      ],
    });
    const desktopGeom = buildCorridorGeometry(twoDayClosed, {
      width: 720,
      narrow: false,
      selectedIndex: 1,
    });
    expect(desktopGeom.execMarkers).toHaveLength(2);
    const [d0, d1] = desktopGeom.execMarkers;
    const d0Box = markerSpan(d0!);
    const d1Box = markerSpan(d1!);
    expect(d0Box.end).toBeGreaterThan(d1Box.start);
    expect(d1!.labelY).toBeGreaterThan(d0!.labelY);

    const threeDayMobile = replayLongStockTrade({
      tradeId: 'trd-axio-mobile-overlap',
      symbol: 'AXIO',
      sessions: ['2026-11-17', '2026-11-18', '2026-11-19'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [
        makeExecution({ id: 'b1', quantity: '100', fillPrice: '50.00', economicTime: '2026-11-17T15:00:00.000Z', recordedSequence: 2 }),
        makeExecution({ id: 's1', side: 'Sell', quantity: '50', fillPrice: '52.00', economicTime: '2026-11-19T15:00:00.000Z', recordedSequence: 3 }),
      ],
      effectiveMarks: [
        { sessionDate: '2026-11-17', price: ser('46.50') },
        { sessionDate: '2026-11-19', price: ser('53.00') },
      ],
    });
    const mobileGeom = buildCorridorGeometry(threeDayMobile, {
      width: 340,
      narrow: true,
      selectedIndex: 2,
    });
    expect(mobileGeom.execMarkers).toHaveLength(2);
    const [m0, m1] = mobileGeom.execMarkers;
    expect(m1!.labelY).toBeGreaterThan(m0!.labelY);
  });

  it('bounds missingBands separately within Price and P&L panels without spanning the inter-panel gutter', () => {
    const gapModel = replayLongStockTrade({
      tradeId: 'trd-band-bounds',
      symbol: 'AXIO',
      sessions: ['2026-11-02', '2026-11-03', '2026-11-04'],
      plan: makeLongStockPlan(),
      originalPlannedRisk: ser('300.00'),
      executions: [makeExecution()],
      effectiveMarks: [
        { sessionDate: '2026-11-02', price: ser('49.00') },
        { sessionDate: '2026-11-04', price: ser('53.00') },
      ],
    });
    const geom = buildCorridorGeometry(gapModel, {
      width: 720,
      narrow: false,
      selectedIndex: 2,
    });
    expect(geom.missingBands).toHaveLength(1);
    const band = geom.missingBands[0]!;
    expect(band.priceTop).toBe(geom.priceTop);
    expect(band.priceTop + band.priceHeight).toBe(geom.priceBottom);
    expect(band.top).toBe(geom.pnlTop);
    expect(band.top + band.height).toBe(geom.pnlBottom);
  });
});
