import { describe, expect, it } from 'vitest';
import { device, dumpAll, onboarded, planCommand } from './support.ts';

describe('I1.4 rejection writes nothing', () => {
  it('should return one rejection listing the Stop above entry, the blank Thesis, and the two-leg shape, with every store unchanged', async () => {
    const d = await device();
    const { app } = await onboarded(d);
    const base = await planCommand(app);
    const leg = base.plan.legs[0]!;
    const before = await dumpAll(d.factory);
    const result = await app.TradeWorkflows.confirmPlan({
      ...base,
      plan: { ...base.plan, legs: [leg, leg], stops: [{ kind: 'UnderlyingPrice', price: '52.00' }] },
      reflection: {
        ...base.reflection,
        answers: { ...base.reflection.answers, 'prompt.plan-reflection.thesis': { kind: 'Text', text: '' } },
      },
    });
    expect(result.kind === 'Rejected' && result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'TradeAnalysis', code: 'StrategyShapeMismatch' }),
        expect.objectContaining({ source: 'TradeAnalysis', code: 'NoPositiveRisk' }),
        expect.objectContaining({ source: 'Journal', field: 'prompt.plan-reflection.thesis', code: 'RequiredAnswerMissing' }),
      ]),
    );
    expect(result.kind === 'Rejected' && result.issues).toHaveLength(3);
    expect(await dumpAll(d.factory)).toEqual(before);
  });
});
