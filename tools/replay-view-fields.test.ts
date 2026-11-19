import { describe, expect, it } from 'vitest';
import { againstPlanOf, planColumnWithTerms } from '../tests/support/replay-view-fields.ts';
import { Rational } from '../src/domain/values/index.ts';

const xyz = { kind: 'Stock', symbol: 'XYZ' } as const;

describe('replay view field builders', () => {
  it('it should give the Plan column the odds its own Stop and Target imply', () => {
    const column = planColumnWithTerms(xyz, 100, 90, 120);
    expect(column.rewardRisk?.equals(Rational.of(2n))).toBe(true);
    expect(column.odds?.targetFirst.equals(Rational.of(1n, 3n))).toBe(true);
    expect(column.odds?.percent.targetFirst.equals(Rational.of(33n))).toBe(true);
  });

  it('it should build the Plan column and a fill distance from a decimal price', () => {
    const column = planColumnWithTerms(xyz, 100.5, 90, 120);
    expect(column.atTarget?.equals(Rational.of(39n, 2n))).toBe(true);
    expect(againstPlanOf('Entry', 'Above', 0.5).distance.equals(Rational.of(1n, 2n))).toBe(true);
  });
});
