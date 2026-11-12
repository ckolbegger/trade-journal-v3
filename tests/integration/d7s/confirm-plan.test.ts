// I7S.3 and I7S.7: confirming and refusing Plans that hold option-price conditions (AC-PLAN-001 and AC-PLAN-002
// re-proven, AC-RESP-001), through the real facade on fake-indexeddb. A refused Plan writes nothing, checked on the
// whole dump.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import type { ConfirmPlanCommand } from '../../../src/coordinators/trade-workflows/index.ts';
import { Rational } from '../../../src/domain/values/index.ts';
import { planCommand } from '../d1/support.ts';
import { detailOf, dumpAll, MONDAY_NEXT_1700, oc2Command, onboardedAt, optionPrice, os2Command, restart, TUESDAY_1700_NY, underlyingPrice, workspaceStores } from './support.ts';

const r = (n: bigint, d = 1n) => Rational.of(n, d);

describe('I7S.3 Confirm O-S2', () => {
  it('should confirm O-S2 with 1R 480, reward 140, ratio 7/24 and four condition bases, four stored condition facts with their own identities, kinds and normalized prices, and a Detail equal to the result after restart', async () => {
    const { d, app } = await onboardedAt(TUESDAY_1700_NY);
    const result = await app.TradeWorkflows.confirmPlan(await os2Command(app));
    if (result.kind !== 'Confirmed') throw new Error(`confirmPlan: ${JSON.stringify(result)}`);
    const { tradeId } = result.receipt;
    const baseline = result.postCommit.derivation.baseline;

    expect(baseline.oneR).toEqual(r(480n));
    expect(baseline.originalPlannedReward).toEqual(r(140n));
    expect(baseline.rewardRiskRatio).toEqual(r(7n, 24n));
    // Each basis: the condition, its distance, and the value at expiration only for an Underlying condition.
    const [stopU, stopO] = baseline.stopBasis;
    const [targetU, targetO] = baseline.targetBasis;
    expect(baseline.stopBasis).toHaveLength(2);
    expect(baseline.targetBasis).toHaveLength(2);
    expect(stopU).toEqual(expect.objectContaining({ distance: r(560n), valueAtExpiration: r(4n) }));
    expect(stopO!.distance).toEqual(r(480n));
    expect(targetU).toEqual(expect.objectContaining({ distance: r(140n), valueAtExpiration: r(1n, 2n) }));
    expect(targetO!.distance).toEqual(r(180n));
    expect(stopO).not.toHaveProperty('valueAtExpiration');
    expect(targetO).not.toHaveProperty('valueAtExpiration');

    // The durable state holds four condition facts, each with its own identity, kind and normalized price.
    const again = await restart(app, d);
    const trades = workspaceStores(await dumpAll(d.factory))['trades'] as { facts: { factId: string; kind: string; versions: { value: { kind?: string; price?: string } }[] }[] }[];
    const conditions = trades[0]!.facts.filter((fact) => fact.kind === 'Stop' || fact.kind === 'Target');
    expect(conditions.map((fact) => [fact.kind, fact.versions[0]!.value.kind, fact.versions[0]!.value.price])).toEqual([
      ['Stop', 'UnderlyingPrice', '41'],
      ['Stop', 'StructureValue', '3.6'],
      ['Target', 'UnderlyingPrice', '44.5'],
      ['Target', 'StructureValue', '0.3'],
    ]);
    expect(new Set(conditions.map((fact) => fact.factId)).size).toBe(4);
    expect(conditions.every((fact) => result.receipt.createdFactIds.includes(fact.factId))).toBe(true);

    // AC-RESP-001: the Detail equals the result.
    const detail = await detailOf(again, tradeId);
    if (!('baseline' in detail)) throw new Error('expected a Detail with a Plan Baseline');
    expect(detail.baseline).toEqual(baseline);
    expect(detail.plan.stops).toEqual(result.postCommit.trade.plan.stops);
    expect(detail.plan.targets).toEqual(result.postCommit.trade.plan.targets);
    expect(detail.plan.stops.map((stop) => [stop.kind, stop.price])).toEqual([['UnderlyingPrice', '41'], ['StructureValue', '3.6']]);
    expect(detail.plan.targets.map((target) => [target.kind, target.price])).toEqual([['UnderlyingPrice', '44.5'], ['StructureValue', '0.3']]);
  }, 60_000);
});

// Confirms the command and requires it to be Rejected with every store dump unchanged; returns the issues.
async function rejected(app: Application, d: { factory: Parameters<typeof dumpAll>[0] }, command: ConfirmPlanCommand) {
  const before = await dumpAll(d.factory);
  const result = await app.TradeWorkflows.confirmPlan(command);
  if (result.kind !== 'Rejected') throw new Error(`expected Rejected, got ${result.kind}`);
  expect(await dumpAll(d.factory)).toEqual(before);
  return result.issues;
}

describe('I7S.7 Rejections write nothing', () => {
  it('should reject O-C2 with an option-price Stop at 2.50 as NoPositiveRisk naming Stop 2, O-S2 with two option-price Stops as ConditionKindRepeated, T-A with an option-price Stop as ConditionKindNotApplicable and O-S2 with an option price of 0 as InvalidPrice, each leaving the dump unchanged', async () => {
    const { d, app } = await onboardedAt(MONDAY_NEXT_1700);

    // O-C2's option-price Stop at 2.50 is above the 2.00 entry: it cannot lose less than the entry.
    const oc2 = await oc2Command(app);
    const wrongSide = await rejected(app, d, { ...oc2, plan: { ...oc2.plan, stops: [underlyingPrice('48.00'), optionPrice('2.50')] } });
    expect(wrongSide).toEqual([{ source: 'TradeAnalysis', code: 'NoPositiveRisk', details: { condition: { role: 'Stop', position: 2, kind: 'StructureValue' } } }]);

    // Two option-price Stops on O-S2.
    const os2 = await os2Command(app);
    const repeated = await rejected(app, d, { ...os2, plan: { ...os2.plan, stops: [optionPrice('3.60'), optionPrice('3.00')] } });
    expect(repeated).toEqual(expect.arrayContaining([expect.objectContaining({ source: 'TradeAnalysis', code: 'ConditionKindRepeated' })]));

    // T-A, D6's Long Stock Plan, with an option-price Stop.
    const stock = await planCommand(app);
    const notApplicable = await rejected(app, d, { ...stock, plan: { ...stock.plan, stops: [optionPrice('47.50')] } });
    expect(notApplicable).toEqual(expect.arrayContaining([expect.objectContaining({ source: 'TradeAnalysis', code: 'ConditionKindNotApplicable' })]));

    // An option price of 0 on O-S2.
    const invalid = await rejected(app, d, { ...os2, plan: { ...os2.plan, stops: [underlyingPrice('41.00'), optionPrice('0')] } });
    expect(invalid).toEqual(expect.arrayContaining([expect.objectContaining({ source: 'TradeAnalysis', code: 'InvalidPrice' })]));
  }, 60_000);
});
