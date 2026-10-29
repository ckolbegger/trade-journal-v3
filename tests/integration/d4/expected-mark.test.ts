// I4.4: the Expected Mark Date and Stale context (AC-MARK-001, AC-CALC-002), at Tuesday noon.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { detail, FRIDAY, MONDAY, openItem, referenceTrade, restart, saveMark, TUESDAY_NOON, value } from './support.ts';

const MARK_DEPENDENT = [
  'remainingOpenPnl',
  'currentMarkedPnl',
  'currentMarkedPnlInPlanR',
  'ongoingRiskToStop',
  'ongoingRiskToStopInPlanR',
  'worstCaseOngoingRisk',
  'worstCaseOngoingRiskInPlanR',
  'incrementalRewardToTarget',
  'incrementalRewardToTargetInPlanR',
] as const;

const unavailable = { kind: 'Unavailable', reason: 'MarkMissing', detail: { instrument: { kind: 'Stock', symbol: 'XYZ' }, date: MONDAY } };

async function readA(app: Application, tradeId: string) {
  const current = (await openItem(app, tradeId)).current;
  const view = (await detail(app, tradeId)).current;
  expect(current.expectedMarkDate).toBe(MONDAY);
  expect(current.markResolution?.kind).toBe('Available');
  expect(current.markResolution && 'stale' in current.markResolution).toBe(false);
  expect(current.currentMarkedPnl).toEqual(value('180'));
  expect(current.currentMarkedPnlInPlanR).toEqual(value('0.72'));
  expect(current.ongoingRiskToStop).toEqual(value('450'));
  expect(current.worstCaseOngoingRisk).toEqual(value('5200'));
  expect(current.incrementalRewardToTarget).toEqual(value('400'));
  expect(view.expectedMarkDate).toBe(MONDAY);
  expect(view.markResolution?.kind).toBe('Available');
  expect(view.evaluation).toEqual(expect.objectContaining({ kind: 'Evaluated', currentMarkedPnl: value('180') }));
}

async function readB(app: Application, tradeId: string) {
  const item = (await openItem(app, tradeId)).current;
  const view = await detail(app, tradeId);
  const evaluation = view.current.evaluation;
  if (evaluation.kind !== 'Evaluated') throw new Error('the Detail has no evaluation');
  for (const current of [item, view.current]) {
    expect(current.expectedMarkDate).toBe(MONDAY);
    expect(current.markResolution).toEqual({ kind: 'Missing', stale: expect.objectContaining({ tradingDate: FRIDAY, price: '51.2' }) as unknown });
  }
  // Mark-dependent figures are Unavailable naming XYZ and the Expected Mark Date, in the list and the Detail; every condition too.
  for (const figures of [item, evaluation] as unknown as Record<string, unknown>[]) {
    for (const name of MARK_DEPENDENT) expect([name, figures[name]]).toEqual([name, unavailable]);
    for (const condition of figures['conditions'] as { result: unknown }[]) expect(condition.result).toEqual(unavailable);
  }
  // The at-entry risk and reward stand in for the unmarked line.
  expect(item.atEntry).toEqual(expect.objectContaining({ riskFromEntry: value('268').value, rewardFromEntry: value('582').value }));
  expect(evaluation.atEntry).toEqual(expect.objectContaining({ riskFromEntry: value('268').value, rewardFromEntry: value('582').value }));
  // Not dependent on a Mark: still Values.
  expect(evaluation.realizedToDate).toEqual(value('0'));
  expect(evaluation.incurredFees).toEqual(value('2'));
  expect(view.baseline.oneR).toEqual(value('250').value);
  expect(evaluation.oneR).toEqual(value('250'));
  expect(evaluation.planBaseline.kind).toBe('Value');
  expect(evaluation.entryQuality.kind).toBe('Value');
  // No dated line, and no figure uses 51.20 (100 shares at it would be 5,120).
  expect(view.current.datedLine).toBeUndefined();
  expect(view.current.mark).toBeUndefined();
  expect(evaluation.observation.mark).toBeNull();
  const figuresOnly = JSON.stringify({ item: { ...item, markResolution: undefined }, evaluation: { ...evaluation, staleContext: undefined } }, (_k, v: unknown) =>
    typeof v === 'bigint' ? v.toString() : v,
  );
  expect(figuresOnly).not.toMatch(/5120|51\.2/);
}

describe('I4.4 Expected Mark Date and Stale context', () => {
  it('should value from the Monday Mark in workspace A, and with only a Friday Mark in workspace B be Missing for Monday with Stale 51.20 context, Mark-dependent figures Unavailable, other figures Values and no figure using 51.20, before and after restart', async () => {
    const a = await referenceTrade(TUESDAY_NOON);
    await saveMark(a.app, 'XYZ', MONDAY, '52.00');
    const b = await referenceTrade(TUESDAY_NOON);
    await saveMark(b.app, 'XYZ', FRIDAY, '51.20');

    await readA(a.app, a.tradeId);
    await readB(b.app, b.tradeId);
    await readA(await restart(a.app, a.d), a.tradeId);
    await readB(await restart(b.app, b.d), b.tradeId);
  });
});
