import { describe, expect, it } from 'vitest';
import { debtViolations, withWalkedReflections } from './fixture-views.ts';

const viewsWithPanel = (panel: Record<string, unknown>) => ({
  debts: [],
  details: [],
  reviewTrades: [],
  review: { families: [{ family: 'Trades', trades: [{ tradeId: 'T-A', progress: { panels: [{ panel: 'Reflections', ...panel }] } }] }] },
});

describe('fixture views', () => {
  it('should report a migrated Workspace walked item as a Debt violation when its Reflections panel carries no dueNow or later count', () => {
    for (const panel of [{}, { dueNow: 0 }, { later: 0 }]) {
      const violations = debtViolations(withWalkedReflections(viewsWithPanel(panel)), true);
      expect(violations).toEqual([expect.stringContaining('T-A.review counts')]);
    }
  });
});
