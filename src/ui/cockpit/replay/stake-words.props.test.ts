import { describe, expect, it } from 'vitest';
import type { CalculationResult } from '../../../domain/calculation-result/index.ts';
import type { Rational } from '../../../domain/values/index.ts';
import { sessionWords } from './session-words.props.ts';
import { AXIO, brenMon1102, frac, NOT_APPLICABLE, session, UNBOUNDED, usd, value, view } from './view-doubles.props.ts';

describe('replay.props: what is at stake (W38)', () => {
  it('should say "From here: $352.00 at risk to the Stop · $928.00 more to the Target · 2.64 to 1 (the Plan was 2.95 to 1)."', () => {
    expect(sessionWords(view([brenMon1102]), 0).stake).toBe('From here: $352.00 at risk to the Stop · $928.00 more to the Target · 2.64 to 1 (the Plan was 2.95 to 1).');
  });

  it('should say "$672.00 at risk back to the Stop ($510.00 of it open profit) · no cap above." after the Target, and "at most" a bounded Max reward', () => {
    const pastTarget = (maxReward: CalculationResult<Rational>) =>
      session({
        date: '2026-11-16',
        held: 2,
        pnl: 988,
        standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(32), r: frac(32, 324), crossed: true }, openProfitAtRisk: usd(510) }),
        figures: { ongoingRiskToStop: value(usd(672)), incrementalRewardToTarget: value(usd(0)), maximumIncrementalReward: maxReward },
      });
    expect(sessionWords(view([pastTarget(UNBOUNDED)]), 0).stake).toBe('From here: $672.00 at risk back to the Stop ($510.00 of it open profit) · no cap above.');
    expect(sessionWords(view([pastTarget(value(usd(90)))]), 0).stake).toBe('From here: $672.00 at risk back to the Stop ($510.00 of it open profit) · at most $90.00 more.');
  });

  it('should add "Even at the Stop this Trade would end $316.00 ahead." when the result at the Stop is above break-even', () => {
    const atStop = (result: number) =>
      session({
        date: '2026-11-16',
        held: 2,
        pnl: 988,
        standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(32), r: frac(32, 324), crossed: true }, openProfitAtRisk: usd(510) }),
        figures: { ongoingRiskToStop: value(usd(672)), incrementalRewardToTarget: value(usd(0)), maximumIncrementalReward: UNBOUNDED },
        outcomes: { atStop: value(usd(result)) },
      });
    expect(sessionWords(view([atStop(316)]), 0).stake).toBe(
      'From here: $672.00 at risk back to the Stop ($510.00 of it open profit) · no cap above. Even at the Stop this Trade would end $316.00 ahead.',
    );
    expect(sessionWords(view([atStop(0)]), 0).stake).not.toContain('Even at the Stop');
    expect(sessionWords(view([atStop(-324)]), 0).stake).not.toContain('Even at the Stop');
  });

  it('should name the Worst case and the way back up to the Target once past the Stop', () => {
    const axioMon1109 = session({
      date: '2026-11-09',
      instrument: AXIO,
      held: 100,
      pnl: -920,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(180), r: frac(3, 10), crossed: true } }),
      figures: { ongoingRiskToStop: value(usd(0)), worstCaseOngoingRisk: value(usd(4520)), incrementalRewardToTarget: value(usd(1080)) },
    });
    expect(sessionWords(view([axioMon1109]), 0).stake).toBe('From here: Worst case $4,520.00 more · $1,080.00 back up to the Target.');
  });

  it('should say "Nothing is at risk and nothing is left to gain." with what was banked, on a final session', () => {
    // K-sale: the first 2 contracts sold Thu 11-12 (+$478 banked), the last 2 on Fri 11-13.
    const sold1112 = session({ date: '2026-11-12', held: 2, pnl: 982, realized: 478, standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(26), r: frac(26, 324), crossed: true } }) });
    const final1113 = session({ date: '2026-11-13', held: 0, pnl: 1260, realized: 1260, standing: NOT_APPLICABLE, final: { kind: 'Sold' } });
    expect(sessionWords(view([sold1112, final1113]), 1).stake).toBe('Nothing is at risk and nothing is left to gain. +$478.00 of the result was banked before the end.');
    // Nothing banked before the end: the sentence stops after the first.
    const final1120 = session({ date: '2026-11-20', held: 0, pnl: 564, realized: 564, standing: NOT_APPLICABLE, final: { kind: 'Sold' } });
    const mon1116 = session({ date: '2026-11-16', held: 2, pnl: 534, realized: 0 });
    expect(sessionWords(view([mon1116, final1120]), 1).stake).toBe('Nothing is at risk and nothing is left to gain.');
  });
});
