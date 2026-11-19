// I9AR.3 The manifest (AC-CAP-001, cumulative): the manifest a launched facade reports lists the variants T9AR.6 added, and every route
// (the Trade Detail and Review routes among them) has all its operations and variants installed.
import { describe, expect, it } from 'vitest';
import { isRouteInstalled, ROUTES, type RouteDefinition } from '../../../src/app/routes.ts';
import { device, onboarded } from '../d7s/support.ts';

describe('I9AR.3 The manifest (AC-CAP-001)', () => {
  it('I9AR.3 should list the PlanComparison and Odds variants, require them on the Trade Detail and Review routes and install every route requirement', { timeout: 120_000 }, async () => {
    const app = await onboarded(await device());

    const status = await app.Workspace.getStatus();

    if (status.kind !== 'Ready') throw new Error(`getStatus: ${status.kind}`);
    const { operations } = status.installedCapabilities;
    expect(operations['TradeViewsAndReporting.replayTrade']).toEqual(['ConditionStatus', 'Markers', 'PlanComparison', 'Odds']);
    expect(operations['DailyReview.getTrade']).toContain('Odds');
    // The routes that present the replay and the odds require those variants.
    const routes: readonly RouteDefinition[] = ROUTES;
    const requiring = (id: string, op: string) => routes.find((r) => r.id === id)?.variants?.[op];
    expect(requiring('trade-detail', 'TradeViewsAndReporting.replayTrade')).toEqual(expect.arrayContaining(['PlanComparison', 'Odds']));
    expect(requiring('review', 'DailyReview.getTrade')).toContain('Odds');
    // Every route's requirements are installed.
    expect(ROUTES.filter((route) => !isRouteInstalled(route, operations)).map((route) => route.id)).toEqual([]);
  });
});
