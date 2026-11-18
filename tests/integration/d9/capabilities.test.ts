// I9.7 The manifest (AC-CAP-001, cumulative): the manifest a launched facade reports lists the variants T9.8 added, and every route
// (the Trade Detail and Review routes among them) has all its operations and variants installed.
import { describe, expect, it } from 'vitest';
import { isRouteInstalled, ROUTES, type RouteDefinition } from '../../../src/app/routes.ts';
import { device, onboarded } from '../d7s/support.ts';

describe('I9.7 The manifest (AC-CAP-001)', () => {
  it('I9.7 should list the T9.8 variants and install every route requirements', { timeout: 120_000 }, async () => {
    const app = await onboarded(await device());

    const status = await app.Workspace.getStatus();

    if (status.kind !== 'Ready') throw new Error(`getStatus: ${status.kind}`);
    const { operations } = status.installedCapabilities;
    expect(operations['TradeViewsAndReporting.replayTrade']).toEqual(['ConditionStatus', 'Markers']);
    expect(operations['DailyReview.getTrade']).toContain('Replay');
    // The routes that present the replay require those variants, and are offered.
    const routes: readonly RouteDefinition[] = ROUTES;
    const requiring = (id: string, op: string) => routes.find((r) => r.id === id)?.variants?.[op];
    expect(requiring('trade-detail', 'TradeViewsAndReporting.replayTrade')).toEqual(['ConditionStatus', 'Markers']);
    expect(requiring('review', 'DailyReview.getTrade')).toContain('Replay');
    // Every route's requirements are installed.
    expect(ROUTES.filter((route) => !isRouteInstalled(route, operations)).map((route) => route.id)).toEqual([]);
  });
});
