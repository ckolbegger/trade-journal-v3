import { describe, expect, it } from 'vitest';
import { Rational } from '../../domain/values/index.ts';
import { D7_CATALOG_MANIFEST, type StrategyRecord } from '../../modules/reference-catalog/index.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import { onboardedStack } from '../../../tests/support/onboarded.ts';
import type { ConfirmPlanCommand } from './index.ts';

// The Long Call is seeded here; production seeding moves to D7's manifest in T7.17.
async function optionStack() {
  const stack = await onboardedStack();
  await stack.catalog.seedDefaults(D7_CATALOG_MANIFEST);
  const strategies = await stack.catalog.query({ family: 'Strategy' });
  if (strategies.kind !== 'Page') throw new Error('no strategies');
  const longCall = strategies.items.find((s): s is StrategyRecord => s.kind === 'Strategy' && s.productKey === 'strategy.long-call');
  if (!longCall) throw new Error('no Long Call');
  return { stack, longCall };
}

function command(stack: Awaited<ReturnType<typeof onboardedStack>>, longCall: { id: string; recordRevision: number }, overrides: Partial<ConfirmPlanCommand> = {}): ConfirmPlanCommand {
  return {
    accountId: stack.account.id,
    accountRevision: stack.account.recordRevision,
    strategyId: longCall.id,
    strategyRevision: longCall.recordRevision,
    economicTime: '2026-10-12T13:00:00Z',
    plan: {
      underlying: 'XYZ',
      legs: [
        {
          side: 'Long',
          instrument: { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', right: 'Call', strike: '55', multiplier: 100 },
          quantity: '2',
          intendedEntry: '2.00',
        },
      ],
      stops: [{ kind: 'UnderlyingPrice', price: '48.00' }],
      targets: [{ kind: 'UnderlyingPrice', price: '60.00' }],
      exerciseIntent: 'NotAuthorized',
    },
    reflection: {
      definitionId: stack.definition.id,
      answers: {
        'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Earnings run-up.' },
        'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close below 48.' },
        'prompt.plan-reflection.conviction': { kind: 'Scale', value: 4 },
        'prompt.plan-reflection.primary-emotion': { kind: 'Option', optionId: 'option.plan-reflection.primary-emotion.calm' },
      },
    },
    ...overrides,
  };
}

describe('confirmPlan: option Plans (AC-PLAN-001)', () => {
  it('should commit O-C with its exact contract, frozen conditions, Exercise Intent, Planned lifecycle, and the Plan Reflection in one semantic commit, returning 1R $400 and the Planned payoff view with the post-commit Trade', async () => {
    const { stack, longCall } = await optionStack();
    const content = async () => {
      const ws = Object.entries(await dumpAll(stack.factory)).find(([name]) => name.startsWith('tj-ws-'))![1];
      return (ws['meta'] as { key: string; contentRevision?: number }[]).find((m) => m.key === 'content')!.contentRevision!;
    };
    const before = await content();
    const result = await stack.tradeWorkflows.confirmPlan(command(stack, longCall));
    if (result.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${JSON.stringify(result)}`);
    expect(await content()).toBe(before + 1);
    const { trade, derivation } = result.postCommit;
    expect(trade.storedLifecycle).toBe('Planned');
    expect(trade.plan.exerciseIntent).toBe('NotAuthorized');
    expect(trade.plan.legs[0]).toMatchObject({
      instrument: { kind: 'Option', strike: '55', right: 'Call', expiration: '2026-11-20' },
      quantity: '2',
      intendedEntry: '2',
    });
    expect(trade.plan.stops).toHaveLength(1);
    expect(trade.plan.targets).toHaveLength(1);
    expect(derivation.baseline.oneR.equals(Rational.of(400n))).toBe(true);
    expect(derivation.agreement).toEqual({ kind: 'Agrees' });
    expect(result.postCommit.entry.anchor).toEqual({ kind: 'Trade', tradeId: trade.tradeId });
    const planned = result.postCommit.payoff.planned;
    if (planned.kind !== 'Value') throw new Error('expected a Planned view');
    expect(planned.value.segments).toEqual([
      { from: Rational.of(0n), to: Rational.of(55n), valueAtStart: Rational.of(-400n), slope: Rational.of(0n) },
      { from: Rational.of(55n), to: null, valueAtStart: Rational.of(-400n), slope: Rational.of(200n) },
    ]);
  });

  it('should aggregate assessPlan option issues with Catalog and Journal issues into one rejection and leave every content revision unchanged', async () => {
    const { stack, longCall } = await optionStack();
    const base = command(stack, longCall);
    const before = await dumpAll(stack.factory);
    const result = await stack.tradeWorkflows.confirmPlan({
      ...base,
      accountId: 'no-such-account',
      plan: {
        ...base.plan,
        legs: [{ ...base.plan.legs[0]!, instrument: { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-10-11', right: 'Call', strike: '55', multiplier: 100 } }],
        stops: [{ kind: 'UnderlyingPrice', price: '57.50' }],
      },
      reflection: { ...base.reflection, answers: { ...base.reflection.answers, 'prompt.plan-reflection.thesis': { kind: 'Text', text: '' } } },
    });
    if (result.kind !== 'Rejected') throw new Error(`expected Rejected, got ${result.kind}`);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { source: 'ReferenceCatalog', field: 'account', code: 'UnknownReference' },
        { source: 'Journal', field: 'prompt.plan-reflection.thesis', code: 'RequiredAnswerMissing' },
        { source: 'TradeAnalysis', code: 'ContractAlreadyExpired' },
        { source: 'TradeAnalysis', code: 'NoPositiveRisk' },
      ]),
    );
    expect(await dumpAll(stack.factory)).toEqual(before);
  });
});
