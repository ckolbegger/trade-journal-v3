// I95.7 The manifest (AC-CAP-001, cumulative): the exact variant lists after Part A, and every route's operations and variants installed.
import { describe, expect, it } from 'vitest';
import { isRouteInstalled, ROUTES, type RouteDefinition } from '../../../src/app/routes.ts';
import { device, onboarded } from '../d7s/support.ts';

describe('I95.7 The manifest (AC-CAP-001)', () => {
  it('I95.7 should list the Part A and Part B variants exactly, present them on the Review route and install every route requirement', { timeout: 120_000 }, async () => {
    const app = await onboarded(await device());

    const status = await app.Workspace.getStatus();

    if (status.kind !== 'Ready') throw new Error(`getStatus: ${status.kind}`);
    const { operations } = status.installedCapabilities;
    expect(operations['DailyReview.open']).toEqual([
      'LatestCompleted', 'OwedReflections', 'Meter', 'GapTrades', 'OwedReflectionGroup', 'SettlementFamily', 'DaySummary', 'PlanOrder', 'LastAction', 'PlanCall',
    ]);
    expect(operations['DailyReview.getTrade']).toEqual([
      'OwedReflections', 'PlanBaseline', 'RewardRiskNow', 'ReflectionsOwed', 'ExpirationPayoff', 'SettlementDue', 'Replay', 'Odds', 'LastDecisions', 'PlanCall', 'PlanExit',
    ]);
    expect(operations['DailyReview.save']).toEqual(['SaveTradeAction', 'ResolveReviewDebt', 'SaveReviewMarks', 'SaveReviewMarksPage', 'MarksFirst', 'PlanRule']);
    expect(operations['TradeViewsAndReporting.getTradeDetail']).toContain('PlanExit');
    expect(operations['TradeWorkflows.recordPositionChange']).toContain('PlanExitMeasure');
    const routes: readonly RouteDefinition[] = ROUTES;
    const review = routes.find((r) => r.id === 'review')?.variants;
    for (const op of ['DailyReview.open', 'DailyReview.getTrade', 'DailyReview.save']) expect(review?.[op]).toEqual(operations[op]);
    expect(routes.find((r) => r.id === 'trade-detail')?.variants?.['TradeViewsAndReporting.getTradeDetail']).toContain('PlanExit');
    expect(routes.find((r) => r.id === 'record-entry')?.variants?.['TradeWorkflows.recordPositionChange']).toContain('PlanExitMeasure');
    expect(ROUTES.filter((route) => !isRouteInstalled(route, operations)).map((route) => route.id)).toEqual([]);
  });
});
