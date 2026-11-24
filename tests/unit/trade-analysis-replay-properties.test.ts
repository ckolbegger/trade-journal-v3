import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ExecutionRecord } from '../../src/persistence/idb';
import {
  abs,
  add,
  cmp,
  ExactNumber,
  fromInteger,
  isNegative,
  isPositive,
  isZero,
} from '../../src/shared/exact-number';
import { replayLongStockTrade } from '../../src/trade-analysis/replay';
import { makeExecution, makeLongStockPlan } from '../helpers/builders';

const VALID_SESSIONS = [
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-09',
  '2026-11-10',
  '2026-11-11',
] as const;

function toPriceStr(cents: number): string {
  return (cents / 100).toFixed(2);
}

const timelineArbitrary = fc
  .record({
    sessionCount: fc.integer({ min: 1, max: VALID_SESSIONS.length }),
    stopCents: fc.integer({ min: 1000, max: 4000 }),
    riskCents: fc.integer({ min: 100, max: 1000 }),
    rewardCents: fc.integer({ min: 100, max: 2000 }),
    plannedQty: fc.integer({ min: 10, max: 200 }),
    initialQty: fc.integer({ min: 10, max: 200 }),
    initialPriceCents: fc.integer({ min: 1200, max: 6000 }),
    initialFeeCents: fc.integer({ min: 0, max: 500 }),
    rawActions: fc.array(
      fc.record({
        sessionIdx: fc.integer({ min: 0, max: 7 }),
        side: fc.constantFrom<'Buy' | 'Sell'>('Buy', 'Sell'),
        qty: fc.integer({ min: 1, max: 50 }),
        priceCents: fc.integer({ min: 800, max: 7000 }),
        feeCents: fc.integer({ min: 0, max: 300 }),
      }),
      { maxLength: 6 },
    ),
    markSeeds: fc.array(
      fc.option(fc.integer({ min: 500, max: 8000 }), { nil: null }),
      { minLength: VALID_SESSIONS.length, maxLength: VALID_SESSIONS.length },
    ),
    reviewChoices: fc.array(
      fc.option(fc.constantFrom<'Hold' | 'Exit'>('Hold', 'Exit'), { nil: null }),
      { minLength: VALID_SESSIONS.length, maxLength: VALID_SESSIONS.length },
    ),
  })
  .map((raw) => {
    const sessions = VALID_SESSIONS.slice(0, raw.sessionCount);
    const entryCents = raw.stopCents + raw.riskCents;
    const targetCents = entryCents + raw.rewardCents;
    const oneRCents = raw.riskCents * raw.plannedQty;

    const executions: ExecutionRecord[] = [
      makeExecution({
        id: 'exec-0',
        positionChangeId: 'pc-0',
        side: 'Buy',
        quantity: String(raw.initialQty),
        fillPrice: toPriceStr(raw.initialPriceCents),
        fee: toPriceStr(raw.initialFeeCents),
        economicTime: `${sessions[0]!}T14:35:00.000Z`,
        recordedSequence: 2,
      }),
    ];

    let held = raw.initialQty;
    let seq = 3;
    const sortedExtras = [...raw.rawActions]
      .filter((a) => a.sessionIdx < sessions.length)
      .sort((a, b) => a.sessionIdx - b.sessionIdx);

    for (let i = 0; i < sortedExtras.length; i += 1) {
      const act = sortedExtras[i]!;
      if (held === 0) break;
      let qty = act.qty;
      if (act.side === 'Sell') {
        qty = Math.min(qty, held);
        held -= qty;
      } else {
        held += qty;
      }
      // Reuse identical timestamps monotonically to exercise recordedSequence tie-breaking
      const sec = String(10 + Math.floor(i / 2) * 2).padStart(2, '0');
      executions.push(
        makeExecution({
          id: `exec-${i + 1}`,
          positionChangeId: `pc-${i + 1}`,
          side: act.side,
          quantity: String(qty),
          fillPrice: toPriceStr(act.priceCents),
          fee: toPriceStr(act.feeCents),
          economicTime: `${sessions[act.sessionIdx]!}T15:00:${sec}.000Z`,
          recordedSequence: seq++,
        }),
      );
    }

    const effectiveMarks: { sessionDate: string; price: { num: string; den: string } }[] = [];
    const reviewActions: { reviewDate: string; action: 'Hold' | 'Exit' }[] = [];
    for (let i = 0; i < sessions.length; i += 1) {
      const m = raw.markSeeds[i];
      if (m !== null && m !== undefined) {
        effectiveMarks.push({
          sessionDate: sessions[i]!,
          price: ExactNumber.toJSON(ExactNumber.fromDecimalString(toPriceStr(m))),
        });
      }
      const act = raw.reviewChoices[i];
      if (act !== null && act !== undefined) {
        reviewActions.push({ reviewDate: sessions[i]!, action: act });
      }
    }

    return {
      sessions,
      plan: makeLongStockPlan({
        plannedQuantity: String(raw.plannedQty),
        intendedEntryPrice: toPriceStr(entryCents),
        stopPrice: toPriceStr(raw.stopCents),
        targetPrice: toPriceStr(targetCents),
      }),
      oneR: ExactNumber.toJSON(ExactNumber.fromDecimalString(toPriceStr(oneRCents))),
      executions,
      effectiveMarks,
      reviewActions,
    };
  });

type TimelineSample = typeof timelineArbitrary extends fc.Arbitrary<infer U> ? U : never;

function buildModel(t: TimelineSample) {
  return replayLongStockTrade({
    tradeId: 'trd-prop',
    symbol: 'AXIO',
    sessions: t.sessions,
    plan: t.plan,
    originalPlannedRisk: t.oneR,
    executions: t.executions,
    effectiveMarks: t.effectiveMarks,
    reviewActions: t.reviewActions,
  });
}

describe('TradeAnalysis.replay property-based invariants', () => {
  it('enforces closed-session zero Open P&L and null Stop/Target rails across 200 random timelines', () => {
    let closedCount = 0;
    let openCount = 0;
    fc.assert(
      fc.property(timelineArbitrary, (t) => {
        const model = buildModel(t);
        expect(model.sessions).toHaveLength(t.sessions.length);
        for (const s of model.sessions) {
          if (s.isClosed) {
            closedCount += 1;
            expect(s.openPnl).toEqual(fromInteger(0));
            expect(s.totalPnl).toEqual(s.realizedPnl);
            expect(s.atStopPnl).toBeNull();
            expect(s.atTargetPnl).toBeNull();
          } else {
            openCount += 1;
          }
        }
      }),
      { numRuns: 200 },
    );
    expect(closedCount).toBeGreaterThan(0);
    expect(openCount).toBeGreaterThan(0);
  });

  it('satisfies exact P&L additivity when marked and leaves missing Marks uninterpolated', () => {
    let markedCount = 0;
    let gapCount = 0;
    fc.assert(
      fc.property(timelineArbitrary, (t) => {
        const model = buildModel(t);
        for (const s of model.sessions) {
          if (s.isClosed) continue;
          if (s.mark !== null) {
            markedCount += 1;
            expect(s.openPnl).not.toBeNull();
            expect(s.totalPnl).toEqual(add(s.realizedPnl, s.openPnl!));
          } else {
            gapCount += 1;
            expect(s.openPnl).toBeNull();
            expect(s.totalPnl).toBeNull();
          }
        }
      }),
      { numRuns: 200 },
    );
    expect(markedCount).toBeGreaterThan(0);
    expect(gapCount).toBeGreaterThan(0);
  });

  it('preserves strict Stop < Target rail ordering on every live session', () => {
    let liveCount = 0;
    fc.assert(
      fc.property(timelineArbitrary, (t) => {
        const model = buildModel(t);
        for (const s of model.sessions) {
          if (!s.isClosed && isPositive(s.openShares)) {
            liveCount += 1;
            expect(s.atStopPnl).not.toBeNull();
            expect(s.atTargetPnl).not.toBeNull();
            expect(cmp(s.atStopPnl!, s.atTargetPnl!)).toBe(-1);
          }
        }
      }),
      { numRuns: 200 },
    );
    expect(liveCount).toBeGreaterThan(0);
  });

  it('bounds bankedPart between zero and min(|realizedPnl|, |totalPnl|) aligned with totalPnl sign', () => {
    let nonZeroBankedCount = 0;
    fc.assert(
      fc.property(timelineArbitrary, (t) => {
        const model = buildModel(t);
        for (const s of model.sessions) {
          if (s.totalPnl === null) {
            expect(isZero(s.bankedPart)).toBe(true);
            continue;
          }
          if (!isZero(s.bankedPart)) nonZeroBankedCount += 1;
          expect(cmp(abs(s.bankedPart), abs(s.realizedPnl))).toBeLessThanOrEqual(0);
          if (!isNegative(s.totalPnl)) {
            expect(isNegative(s.bankedPart)).toBe(false);
            expect(cmp(s.bankedPart, s.totalPnl)).toBeLessThanOrEqual(0);
          } else {
            expect(isPositive(s.bankedPart)).toBe(false);
            expect(cmp(s.bankedPart, s.totalPnl)).toBeGreaterThanOrEqual(0);
          }
        }
      }),
      { numRuns: 200 },
    );
    expect(nonZeroBankedCount).toBeGreaterThan(0);
  });

  it('places Entry at initial session, Now/End at final session, and omits Low at final session when open', () => {
    fc.assert(
      fc.property(timelineArbitrary, (t) => {
        const model = buildModel(t);
        const endIdx = model.sessions.length - 1;
        const entryMoments = model.keyMoments.filter((km) => km.kinds.includes('Entry'));
        const terminalMoments = model.keyMoments.filter(
          (km) => km.kinds.includes('Now') || km.kinds.includes('End'),
        );
        expect(entryMoments).toHaveLength(1);
        expect(entryMoments[0]!.sessionIndex).toBe(0);
        expect(terminalMoments).toHaveLength(1);
        expect(terminalMoments[0]!.sessionIndex).toBe(endIdx);
        expect(model.keyMoments.find((km) => km.sessionIndex === endIdx)?.kinds).not.toContain('Low');
      }),
      { numRuns: 200 },
    );
  });

  it('remains invariant to arbitrary permuted execution, effectiveMark, and reviewAction orderings', () => {
    const shuffleWithSeed = <T,>(items: readonly T[], seed: number): T[] => {
      const copy = [...items];
      let s = (seed >>> 0) || 1;
      for (let i = copy.length - 1; i > 0; i -= 1) {
        s = (s * 1664525 + 1013904223) >>> 0;
        const j = s % (i + 1);
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    };

    fc.assert(
      fc.property(timelineArbitrary, fc.integer({ min: 1, max: 0x7fffffff }), (t, seed) => {
        const model = buildModel(t);
        const permuted = replayLongStockTrade({
          tradeId: 'trd-prop',
          symbol: 'AXIO',
          sessions: t.sessions,
          plan: t.plan,
          originalPlannedRisk: t.oneR,
          executions: shuffleWithSeed(t.executions, seed),
          effectiveMarks: shuffleWithSeed(t.effectiveMarks, seed + 1),
          reviewActions: shuffleWithSeed(t.reviewActions, seed + 2),
        });
        expect(permuted).toEqual(model);
      }),
      { numRuns: 200 },
    );
  });
});
