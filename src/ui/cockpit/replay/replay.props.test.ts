import { describe, expect, it } from 'vitest';
import type { TradeReplayView } from '../../../app/types.ts';
import type { CalculationResult } from '../../../domain/calculation-result/index.ts';
import type { Instrument, OptionInstrument } from '../../../domain/instrument/index.ts';
import { Rational } from '../../../domain/values/index.ts';
import { sessionWords } from './replay.props.ts';

// Doubles of the replay view, built from T9.2's types with the breakdown's section 5 figures as finished values: the
// adapter selects and formats them and works out nothing, so nothing here is derived either.
type Session = TradeReplayView['sessions'][number];
type Figures = NonNullable<Session['figures']>;
type Standing = NonNullable<Figures['standing']>;
type Outcomes = NonNullable<Figures['outcomes']>;

const usd = (dollars: number): Rational => Rational.of(BigInt(Math.round(dollars * 100)), 100n);
const frac = (n: number, d: number): Rational => Rational.of(BigInt(n), BigInt(d));
const value = <T>(v: T): CalculationResult<T> => ({ kind: 'Value', value: v });
const UNBOUNDED: CalculationResult<never> = { kind: 'Unbounded', direction: 'Above', explanation: 'A long Call has no ceiling.' };
const NOT_APPLICABLE: CalculationResult<never> = { kind: 'NotApplicable', reason: 'NoRemainingPosition' };

const BREN: OptionInstrument ={ kind: 'Option', symbol: 'BREN', root: 'BREN', expiration: '2026-11-20', strike: '100', right: 'Call', multiplier: 100 };
const DALE: OptionInstrument ={ kind: 'Option', symbol: 'DALE', root: 'DALE', expiration: '2026-11-20', strike: '57.5', right: 'Put', multiplier: 100 };
const AXIO: Instrument = { kind: 'Stock', symbol: 'AXIO' };

// A condition on the Underlying's price at its trigger; the adapter reads only its role, kind and boundary.
const condition = (role: 'Stop' | 'Target', kind: 'UnderlyingPrice' | 'StructureValue', boundary: string): Figures['conditions'][number] => ({
  id: `${role}-1`,
  role,
  kind,
  boundary,
  result: { kind: 'Unavailable', reason: 'AwaitingClose', after: '2026-11-11' },
});

interface Spec {
  readonly date: string;
  readonly instrument?: Instrument;
  readonly held?: number;
  // The Trade P&L; null for a session without a Mark.
  readonly pnl: number | null;
  readonly pnlR?: Rational;
  readonly realized?: number;
  readonly standing?: Standing;
  readonly figures?: Partial<Figures>;
  readonly outcomes?: Partial<Outcomes>;
  readonly final?: Session['final'];
}

const FIGURES_ABSENT = { kind: 'Unavailable', reason: 'MarkMissing', instrument: BREN, date: '2026-11-10' } as const;

function session(spec: Spec): Session {
  const instrument = spec.instrument ?? BREN;
  const noMark = spec.pnl === null;
  const unavailable = { ...FIGURES_ABSENT, instrument, date: spec.date } as CalculationResult<never>;
  const figures: Figures = {
    ongoingRiskToStop: unavailable,
    ongoingRiskToStopInPlanR: unavailable,
    incrementalRewardToTarget: unavailable,
    incrementalRewardToTargetInPlanR: unavailable,
    worstCaseOngoingRisk: unavailable,
    worstCaseOngoingRiskInPlanR: unavailable,
    maximumIncrementalReward: unavailable,
    maximumIncrementalRewardInPlanR: unavailable,
    rewardRiskNow: unavailable,
    conditions: [],
    outcomes: { atStop: NOT_APPLICABLE, atTarget: NOT_APPLICABLE, atWorstCase: NOT_APPLICABLE, atMaxReward: NOT_APPLICABLE, ...spec.outcomes },
    standing: spec.standing ?? unavailable,
    currentMarkedPnlInPlanR: spec.pnlR ? value(spec.pnlR) : unavailable,
    ...spec.figures,
  };
  return {
    date: spec.date,
    positions: [{ instrument, quantity: usd(spec.held ?? 1) }],
    heldQuantity: usd(spec.held ?? 1),
    realizedPnl: usd(spec.realized ?? 0),
    tradePnl: noMark ? unavailable : value(usd(spec.pnl ?? 0)),
    change: null,
    marks: [],
    positionChangeIds: [],
    journal: [],
    figures,
    ...(spec.final && { final: spec.final }),
  };
}

const view = (sessions: readonly Session[], planColumn: TradeReplayView['planColumn'] = { atStop: usd(-324), atTarget: usd(956), rewardRisk: frac(956, 324) }): TradeReplayView => ({
  tradeId: 'T-1',
  instruments: [BREN],
  sessions,
  plan: [],
  pending: null,
  planColumn,
});

// R-BREN-U on Mon 11-02: the 4 contracts at $1.61, Trade P&L +$28.
const brenMon1102 = session({
  date: '2026-11-02',
  pnl: 28,
  pnlR: frac(28, 324),
  standing: value({ zone: 'Between', share: frac(28, 956) }),
  figures: {
    ongoingRiskToStop: value(usd(352)),
    incrementalRewardToTarget: value(usd(928)),
    rewardRiskNow: value(frac(928, 352)),
  },
  outcomes: { atStop: value(usd(-324)), atTarget: value(usd(956)) },
});

describe('replay.props: how it is going (W36, W37)', () => {
  it('should head R-BREN-U\'s Mon 11-02 "+$28.00 · 0.09R" and "Ahead: 3% of the way to the Target."', () => {
    const words = sessionWords(view([brenMon1102]), 0);
    expect(words.headline).toEqual({ figure: '+$28.00 · 0.09R', tone: 'Profit' });
    expect(words.howItIsGoing).toBe('Ahead: 3% of the way to the Target.');
  });

  it('should say "Behind: 63% of the way to the Stop." for R-AXIO-D on Fri 11-06', () => {
    const axioFri1106 = session({
      date: '2026-11-06',
      instrument: AXIO,
      held: 200,
      pnl: -380,
      pnlR: frac(-380, 600),
      standing: value({ zone: 'Between', share: frac(380, 600) }),
    });
    const words = sessionWords(view([axioFri1106]), 0);
    expect(words.headline).toEqual({ figure: '−$380.00 · −0.63R', tone: 'Loss' });
    expect(words.howItIsGoing).toBe('Behind: 63% of the way to the Stop.');
  });

  it('should say "Past the Stop by $180.00 (0.30R)." once the Stop is breached', () => {
    const axioMon1109 = session({
      date: '2026-11-09',
      instrument: AXIO,
      held: 100,
      pnl: -920,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(180), r: frac(3, 10), crossed: true } }),
    });
    expect(sessionWords(view([axioMon1109]), 0).howItIsGoing).toBe('Past the Stop by $180.00 (0.30R).');
  });

  it('should say "Target reached, $32.00 past it." for R-BREN-U on Mon 11-16', () => {
    const brenMon1116 = session({
      date: '2026-11-16',
      held: 2,
      pnl: 988,
      standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(32), r: frac(32, 324), crossed: true } }),
    });
    expect(sessionWords(view([brenMon1116]), 0).howItIsGoing).toBe('Target reached, $32.00 past it.');
    const atTarget = session({ date: '2026-11-16', pnl: 956, standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(0), r: usd(0), crossed: true } }) });
    expect(sessionWords(view([atTarget]), 0).howItIsGoing).toBe('Target reached.');
  });

  it('should head a session without a Mark with the reason at the figure length, and no figure of another session', () => {
    const corvMon1109 = session({ date: '2026-11-09', pnl: 642, pnlR: frac(642, 318), standing: value({ zone: 'Between', share: frac(642, 867) }) });
    const corvTue1110 = session({ date: '2026-11-10', pnl: null });
    const words = sessionWords(view([corvMon1109, corvTue1110]), 1);
    expect(words.headline).toEqual({ reason: 'Mark missing: BREN Nov 20 $100 Call, Tue Nov 10', tone: 'None' });
    expect(words.headline).not.toHaveProperty('figure');
    expect(words.howItIsGoing).toBe('No Mark.');
    expect(words.stake).toBeNull();
  });

  it('should head a final session "Final result: sold out Fri Nov 13." or "Final result: the put expired Fri Nov 20."', () => {
    const sold = session({ date: '2026-11-13', held: 0, pnl: 1260, realized: 1260, standing: NOT_APPLICABLE, final: { kind: 'Sold' } });
    const soldWords = sessionWords(view([sold]), 0);
    expect(soldWords.howItIsGoing).toBe('Final result: sold out Fri Nov 13.');
    expect(soldWords.headline).toEqual({ figure: '+$1,260.00', tone: 'Profit' });
    const expired = session({ date: '2026-11-20', instrument: DALE, held: 0, pnl: 564, realized: 564, standing: NOT_APPLICABLE, final: { kind: 'Expired', contract: DALE } });
    expect(sessionWords(view([expired]), 0).howItIsGoing).toBe('Final result: the put expired Fri Nov 20.');
  });

  it("should say \"Past the Stop's planned amount by $9.00, though DALE is still above $54.00.\" for R-DALE-D on Thu 11-12", () => {
    const daleThu1112 = session({
      date: '2026-11-12',
      instrument: DALE,
      held: -3,
      pnl: -1272,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(9), r: frac(9, 1536), crossed: false } }),
      figures: { conditions: [condition('Stop', 'UnderlyingPrice', '54.00')] },
    });
    expect(sessionWords(view([daleThu1112]), 0).howItIsGoing).toBe("Past the Stop's planned amount by $9.00, though DALE is still above $54.00.");
    // A long stock Target reached in dollars while the price is short of its trigger: the price is still below it.
    const axioTarget = session({
      date: '2026-11-17',
      instrument: AXIO,
      held: 200,
      pnl: 1100,
      standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(40), r: frac(40, 600), crossed: false } }),
      figures: { conditions: [condition('Target', 'UnderlyingPrice', '56.00')] },
    });
    expect(sessionWords(view([axioTarget]), 0).howItIsGoing).toBe("Past the Target's planned amount by $40.00, though AXIO is still below $56.00.");
  });
});

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
