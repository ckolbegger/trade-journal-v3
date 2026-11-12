import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { closeViolations, debtViolations, openStructureValueCount, optionViolations, withWalkedReflections } from './fixture-views.ts';

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

  const noAnchor = { kind: 'NotApplicable', reason: 'NoOptionExpirationAnchor' };
  const stock = { kind: 'Stock', symbol: 'AAPL' };
  const optionDetail = { tradeId: 'T-O', lifecycle: { stored: 'Open' }, payoff: { planned: noAnchor, current: noAnchor }, settlement: [], plan: { legs: [{ instrument: stock }] } };
  const optionViews = (detail: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    open: [{ tradeId: 'T-O', settlement: [] }],
    details: [detail],
    review: { families: [{ family: 'Settlement', items: [] }] },
    reviewTrades: [{ tradeId: 'T-O', settlement: [] }],
    ...extra,
  });

  it('should report no option violation for a Stock-only view with NotApplicable payoffs and no settlement', () => {
    expect(optionViolations(optionViews(optionDetail), true, true)).toEqual([]);
  });

  it('should report a missing or applicable payoff view and a missing or non-empty settlement list', () => {
    const detail = { ...optionDetail, payoff: { planned: { kind: 'Value' } }, settlement: [{}] };
    expect(optionViolations(optionViews(detail), true, true)).toEqual([
      'T-O.payoff.planned ({"kind":"Value"})',
      'T-O.payoff.current (missing)',
      'T-O.settlement (1)',
    ]);
    expect(optionViolations(optionViews(without(optionDetail, 'settlement')), true, true)).toEqual(['T-O.settlement (missing)']);
  });

  it('should report an option Instrument and a Stock multiplier other than 1', () => {
    const option = { kind: 'Option', symbol: 'XYZ', right: 'Call', strike: '55', multiplier: 100 };
    const detail = { ...optionDetail, plan: { legs: [{ instrument: option }, { instrument: { ...stock, multiplier: 100 } }] } };
    expect(optionViolations(optionViews(detail), true, true)).toEqual([
      'views.details[0].plan.legs[0].instrument (option Instrument)',
      'views.details[0].plan.legs[1].instrument (Stock multiplier 100)',
    ]);
    expect(optionViolations(optionViews({ ...optionDetail, plan: {} }), true, true)).toEqual(['Instruments (no Stock Instrument to check)']);
  });

  it('should report a non-empty Settlement family, missing Review settlement lists, and missing open rows', () => {
    const review = { families: [{ family: 'Settlement', items: [{}] }] };
    expect(optionViolations(optionViews(optionDetail, { review, reviewTrades: [{ tradeId: 'T-O' }] }), true, true)).toEqual(['review Settlement family (not empty)', 'T-O.review settlement (missing)']);
    expect(optionViolations(optionViews(optionDetail, { open: [] }), true, true)).toEqual(['open list (no Open Trades to check)']);
    expect(optionViolations(optionViews(optionDetail, { review: undefined }), true, true)).toEqual(['review.families (missing)']);
  });

  it('should report a missing Review Trade list when the Workspace has a Review', () => {
    expect(optionViolations(optionViews(optionDetail, { reviewTrades: undefined }), true, true)).toEqual(['reviewTrades (missing)']);
  });
});

describe('v7 content check', () => {
  const sv = { kind: 'StructureValue' };
  const detail = (stored: string, stops: unknown[], targets: unknown[]) => ({ lifecycle: { stored }, plan: { stops, targets } });

  it('should fail the v7 content check when the StructureValue conditions are only on Planned or Closed details', () => {
    const planted = { details: [detail('Planned', [sv], [sv]), detail('Closed', [sv], []), detail('Open', [{ kind: 'Price' }], [])] };
    expect(openStructureValueCount(planted)).toBeLessThan(2);
  });

  it('should count the two StructureValue conditions on the frozen v7 Open detail', () => {
    const frozen: unknown = JSON.parse(readFileSync(new URL('../tests/fixtures/workspace-v7/expected-views.json', import.meta.url), 'utf8'));
    expect(openStructureValueCount(frozen)).toBeGreaterThanOrEqual(2);
  });
});
