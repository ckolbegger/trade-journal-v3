import { describe, expect, it } from 'vitest';
import { closeViolations, debtViolations, withWalkedReflections } from './fixture-views.ts';

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

  const open = { tradeId: 'T-O', lifecycle: { stored: 'Open' }, positionChanges: [{ executions: [{ action: 'Buy' }] }], journal: [], lotMatches: [], realizedToDate: '0/1' };
  const planned = { tradeId: 'T-P', lifecycle: { stored: 'Planned' }, journal: [] };
  const without = (detail: Record<string, unknown>, key: string) => Object.fromEntries(Object.entries(detail).filter(([name]) => name !== key));
  const closeViews = (...details: unknown[]) => ({ closed: [], details, debts: [] });

  it('should report no close violation for a clean view with one Planned and one Open Trade', () => {
    expect(closeViolations(closeViews(planned, open), true)).toEqual([]);
  });

  it('should report an Open detail that lacks lotMatches', () => {
    expect(closeViolations(closeViews(without(open, 'lotMatches')), true)).toEqual([expect.stringContaining('T-O Lot Matches (missing)')]);
  });

  it('should report an Open detail that lacks realizedToDate', () => {
    expect(closeViolations(closeViews(without(open, 'realizedToDate')), true)).toEqual([expect.stringContaining('T-O realized-to-date (missing)')]);
  });

  it('should report a detail that lacks positionChanges or journal', () => {
    expect(closeViolations(closeViews(without(open, 'positionChanges')), true)).toEqual([expect.stringContaining('T-O.positionChanges (missing)')]);
    expect(closeViolations(closeViews(open, without(planned, 'journal')), true)).toEqual([expect.stringContaining('T-P.journal (missing)')]);
  });

  it('should report a view with no Open detail to check when the schema has Open Trades', () => {
    expect(closeViolations(closeViews(planned), true)).toEqual([expect.stringContaining('no Open Trades to check')]);
    expect(closeViolations(closeViews(planned), false)).toEqual([]);
  });

  it('should report a Closed Trade, an exit and a Close Review', () => {
    const exit = { ...open, tradeId: 'T-X', positionChanges: [{ executions: [{ action: 'Sell' }] }] };
    const review = { ...open, tradeId: 'T-R', journal: [{ entryTypeKey: 'entry-type.close-review' }] };
    const violations = closeViolations({ closed: [{}], details: [exit, review], debts: [{ entryTypeKey: 'entry-type.close-review' }] }, true);
    expect(violations).toEqual(['closed list (1)', 'T-X exit', 'T-R Close Review', 'Close Review Debt']);
  });
});
