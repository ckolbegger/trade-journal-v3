import { describe, expect, it } from 'vitest';
import type { TradeReplayView } from '../../../app/types.ts';
import type { CalculationResult } from '../../../domain/calculation-result/index.ts';
import type { Instrument, OptionInstrument } from '../../../domain/instrument/index.ts';
import { Rational } from '../../../domain/values/index.ts';
import { replayProps, sessionWords } from './replay.props.ts';

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
  // The open part of the Trade P&L, as the domain finished it.
  readonly open?: number;
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
    openPnl: spec.open === undefined ? unavailable : value(usd(spec.open)),
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

// F2: each session follows its own condition status (T9.4), not the dollars' zone alone: a crossed Underlying price changes the words.
describe('replay.props: the words follow the condition status (T9.14-F2)', () => {
  // A condition read at the session's Mark: crossed with the distance past its price, or still active.
  const reading = (role: 'Stop' | 'Target', boundary: string, status: 'Active' | 'Breached' | 'Reached', beyond: Rational | null): Figures['conditions'][number] => ({
    ...condition(role, 'UnderlyingPrice', boundary),
    result: {
      kind: 'Value',
      value: { status, distance: { dollars: usd(0), planR: usd(0) }, overrun: null, trigger: { distance: usd(0), beyond } },
    } as unknown as Figures['conditions'][number]['result'],
  });
  const daleFri1113 = session({
    date: '2026-11-13',
    instrument: DALE,
    held: -3,
    pnl: -900,
    pnlR: frac(-900, 1536),
    standing: value({ zone: 'Between', share: frac(900, 1536) }),
    figures: { conditions: [reading('Stop', '54.00', 'Breached', frac(30, 100))] },
  });
  const daleMon1116 = session({
    date: '2026-11-16',
    instrument: DALE,
    held: -3,
    pnl: -500,
    pnlR: frac(-500, 1536),
    standing: value({ zone: 'Between', share: frac(500, 1536) }),
    figures: { conditions: [reading('Stop', '54.00', 'Active', null)] },
  });

  it('should read past the Stop on a session where the Underlying has crossed the Stop though the Trade P&L has not', () => {
    const words = sessionWords(view([daleFri1113]), 0);
    expect(words.howItIsGoing).toBe('Stop breached: DALE $0.30 past $54.00.');
    expect(words.headline).toEqual({ figure: '−$900.00 · −0.59R', tone: 'Loss' });
    const stake = replayProps(view([daleFri1113]), { Plot: () => null }).sessions[0]!.readout.find((g) => g.title === 'At stake from here, whole Position');
    expect(stake?.rows.find((r) => r.label === 'Reward to risk')?.value.text).toBe('Stop breached');
    // The dollars past the line as well: W37's words stand.
    const both = session({ ...{ date: '2026-11-13', instrument: DALE, held: -3, pnl: -1700 }, standing: value({ zone: 'PastStop', pastBy: { dollars: usd(180), r: frac(3, 10), crossed: true } }), figures: { conditions: [reading('Stop', '54.00', 'Breached', frac(30, 100))] } });
    expect(sessionWords(view([both]), 0).howItIsGoing).toBe('Past the Stop by $180.00 (0.30R).');
  });

  it('should go back to Behind on a later session where the condition is no longer crossed', () => {
    const v = view([daleFri1113, daleMon1116]);
    expect(sessionWords(v, 0).howItIsGoing).toBe('Stop breached: DALE $0.30 past $54.00.');
    expect(sessionWords(v, 1).howItIsGoing).toBe('Behind: 33% of the way to the Stop.');
    const stake = replayProps(v, { Plot: () => null }).sessions[1]!.readout.find((g) => g.title === 'At stake from here, whole Position');
    expect(stake?.rows.find((r) => r.label === 'Reward to risk')?.value.text).not.toBe('Stop breached');
    // Dollars past the planned amount alone, the price short of its trigger: the planned-amount words.
    const dollarsOnly = session({
      date: '2026-11-17',
      instrument: DALE,
      held: -3,
      pnl: -1272,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(9), r: frac(9, 1536), crossed: false } }),
      figures: { conditions: [reading('Stop', '54.00', 'Active', null)] },
    });
    expect(sessionWords(view([dollarsOnly]), 0).howItIsGoing).toBe("Past the Stop's planned amount by $9.00, though DALE is still above $54.00.");
  });

  it('should read Target reached on a session where the Target condition is reached though the Trade P&L is short of it', () => {
    const brenTarget = session({
      date: '2026-11-16',
      pnl: 700,
      pnlR: frac(700, 324),
      standing: value({ zone: 'Between', share: frac(700, 956) }),
      figures: { conditions: [reading('Target', '104.00', 'Reached', frac(1, 2))] },
    });
    expect(sessionWords(view([brenTarget]), 0).howItIsGoing).toBe('Target reached.');
    const stake = replayProps(view([brenTarget]), { Plot: () => null }).sessions[0]!.readout.find((g) => g.title === 'At stake from here, whole Position');
    expect(stake?.rows.find((r) => r.label === 'Reward to risk')?.value.text).toBe('Target reached');
  });

  it('should end the readout Stop breached when the Stop is crossed though the dollars are past the Target', () => {
    const crossedPastTarget = session({
      date: '2026-11-16',
      pnl: 1138,
      standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(182), r: frac(182, 324), crossed: true } }),
      figures: { conditions: [reading('Stop', '54.00', 'Breached', frac(30, 100))] },
    });
    const v = view([crossedPastTarget]);
    const headline = sessionWords(v, 0).howItIsGoing;
    const stake = replayProps(v, { Plot: () => null }).sessions[0]!.readout.find((g) => g.title === 'At stake from here, whole Position');
    expect(headline).toBe('Stop breached: BREN $0.30 past $54.00.');
    expect(stake?.rows.find((r) => r.label === 'Reward to risk')?.value.text).toBe('Stop breached');
  });

  it('should read Target reached when the Target is crossed though the dollars are past the Stop planned amount', () => {
    const targetPastStopAmount = session({
      date: '2026-11-16',
      pnl: -1272,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(9), r: frac(9, 1536), crossed: false } }),
      figures: { conditions: [reading('Target', '104.00', 'Reached', frac(1, 2))] },
    });
    const v = view([targetPastStopAmount]);
    const stake = replayProps(v, { Plot: () => null }).sessions[0]!.readout.find((g) => g.title === 'At stake from here, whole Position');
    expect(sessionWords(v, 0).howItIsGoing).toBe('Target reached.');
    expect(stake?.rows.find((r) => r.label === 'Reward to risk')?.value.text).toBe('Target reached');
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

// replayProps (A255): the whole view as the frame's props. These cases were not in the breakdown; the Replay drawer (T9.14) draws from them.
// The view lists the Underlying beside the contract, as the real one does (the Price History drawer reads it the same way).
const BREN_STOCK: Instrument = { kind: 'Stock', symbol: 'BREN' };
const Plot = () => null;
const markOf = (instrument: Instrument, price?: string, change: Session['marks'][number]['change'] = null): Session['marks'][number] => ({
  instrument,
  resolution: price === undefined ? { kind: 'Missing' } : { kind: 'Available', mark: { price, revisionNumber: 1, source: 'Manual', savedAt: '2026-11-02T21:30:00Z' } },
  change,
});
const withMarks = (s: Session, marks: Session['marks']): Session => ({ ...s, marks });
const fullView = (sessions: readonly Session[], planColumn?: TradeReplayView['planColumn']): TradeReplayView => ({ ...view(sessions, planColumn), instruments: [BREN_STOCK, BREN] });

describe('replay.props: the frame, the slider and the table columns (W42, W45)', () => {
  it('should give the frame its fixed words, one slider step per session, and the table columns for the Underlying and the contract', () => {
    const tue = session({ date: '2026-11-03', pnl: -12, pnlR: frac(-12, 324), standing: value({ zone: 'Between', share: frac(12, 324) }) });
    const props = replayProps(fullView([brenMon1102, tue]), { Plot, initialSession: '2026-11-02' });
    expect(props).toMatchObject({ tradeKey: 'T-1', initialSession: '2026-11-02', sliderLabel: 'Session', previousLabel: 'Previous session', nextLabel: 'Next session', tableTitle: 'Session by session', Plot });
    expect(props.tableColumns).toEqual(['BREN Mark', 'Call Mark', 'Trade P&L', 'Banked', 'Risk to stop', 'Reward to target', 'Result at the Stop', 'Result at the Target', 'Stop', 'Target']);
    expect(props.sessions.map((s) => [s.date, s.dateLabel, s.sliderValue])).toEqual([
      ['2026-11-02', 'Mon Nov 2', 'Mon Nov 2 · 1 of 2'],
      ['2026-11-03', 'Tue Nov 3', 'Tue Nov 3 · 2 of 2'],
    ]);
    // The headline, how it is going and the stake are the words of `sessionWords`.
    expect(props.sessions[0]).toMatchObject({ ...sessionWords(fullView([brenMon1102, tue]), 0), isFinal: false });
    // A stock Trade has the one Mark column.
    const axio = session({ date: '2026-11-06', instrument: AXIO, held: 200, pnl: -380 });
    expect(replayProps({ ...view([axio]), instruments: [AXIO] }, { Plot }).tableColumns.slice(0, 2)).toEqual(['AXIO Mark', 'Trade P&L']);
  });
});

// A readout's rows as [label, kind, text, change], so a case reads the words and not the shape.
const readoutOf = (props: ReturnType<typeof replayProps>, index: number) =>
  props.sessions[index]!.readout.map((group) => [group.title, group.rows.map((row) => [row.label, row.value.kind, row.value.text, row.change])] as const);

// R-BREN-U on Wed 11-11: the 4 contracts at $3.20, +$520, 54% of the way to the Target.
const brenWed1111 = withMarks(
  {
    ...session({
      date: '2026-11-11',
      held: 4,
      pnl: 520,
      pnlR: frac(520, 324),
      standing: value({ zone: 'Between', share: frac(520, 956) }),
      figures: {
        ongoingRiskToStop: value(usd(352)),
        ongoingRiskToStopInPlanR: value(frac(352, 324)),
        incrementalRewardToTarget: value(usd(928)),
        incrementalRewardToTargetInPlanR: value(frac(928, 324)),
        worstCaseOngoingRisk: value(usd(644)),
        worstCaseOngoingRiskInPlanR: value(frac(644, 324)),
        maximumIncrementalReward: UNBOUNDED,
        rewardRiskNow: value(frac(928, 352)),
      },
      outcomes: { atStop: value(usd(-324)), atTarget: value(usd(956)) },
    }),
    change: { since: '2026-11-10', dollars: usd(190) },
    riskChange: { since: '2026-11-10', dollars: usd(-60) },
    rewardChange: { since: '2026-11-10', dollars: usd(60) },
  },
  [markOf(BREN_STOCK, '101.80', { since: '2026-11-10', dollars: usd(1.6) }), markOf(BREN, '3.20', { since: '2026-11-10', dollars: usd(-0.4) })],
);
const PLAN = { atStop: usd(-324), atTarget: usd(956), rewardRisk: frac(956, 324) } as const;

describe('replay.props: Session by session (W45)', () => {
  it('should give each session a row of finished cells, its Events, and No Mark in the cells of a session without a Mark', () => {
    const sale = { id: 'x2', kind: 'Execution', effect: 'Reduced', fills: [{ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4) }] } as const;
    const wed = {
      ...brenWed1111,
      realizedPnl: usd(478),
      markers: [sale],
      figures: { ...brenWed1111.figures!, conditions: [condition('Stop', 'UnderlyingPrice', '96.00'), condition('Target', 'UnderlyingPrice', '104.00')] },
    };
    const none = withMarks(session({ date: '2026-11-12', pnl: null }), [markOf(BREN_STOCK, '100.20'), markOf(BREN)]);
    const props = replayProps(fullView([wed, none]), { Plot });
    expect(props.sessions.map((s) => s.tableRow)).toEqual([
      { dateLabel: 'Wed Nov 11', cells: ['101.80', '$3.20', '+$520.00', '+$478.00', '$352.00', '$928.00', '−$324.00', '+$956.00', '96.00', '104.00'], events: ['Sold 2 at $4.00'] },
      { dateLabel: 'Thu Nov 12', cells: ['100.20', 'No Mark', 'No Mark', '', 'No Mark', 'No Mark', 'No Mark', 'No Mark', '', ''], events: [] },
    ]);
    // One cell for each column after "Session" and before "Events".
    expect(props.sessions.every((s) => s.tableRow.cells.length === props.tableColumns.length)).toBe(true);
  });
});

describe('replay.props: what the plot draws of a session (W39 to W41, W44)', () => {
  const sale = { id: 'x2', kind: 'Execution', effect: 'Reduced', fills: [{ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4) }] } as const;
  const buy = { id: 'x1', kind: 'Execution', effect: 'Opened', fills: [{ instrument: BREN, action: 'Buy', quantity: usd(4), price: usd(1.68) }] } as const;
  const expiry = { id: 'x3', kind: 'Expiration', effect: 'Closed', fills: [{ instrument: BREN, action: 'Expire', quantity: usd(2) }] } as const;

  it('should give the plot each session Marks, result, banked and Stop and Target as numbers beside their finished labels', () => {
    const wed = { ...brenWed1111, realizedPnl: usd(478), markers: [sale] };
    const props = replayProps(fullView([wed], PLAN), { Plot });
    expect(props.sessions[0]!.plot).toEqual({
      slot: 0,
      dateLabel: 'Wed Nov 11',
      underlyingMark: 101.8,
      underlyingLabel: '$101.80',
      tradePnl: 520,
      banked: 478,
      bankedLabel: 'Banked +$478',
      resultAtStop: { value: -324, label: 'Stop −$324' },
      resultAtTarget: { value: 956, label: 'Target +$956' },
      worstCase: null,
      maxReward: null,
      stake: { riskLabel: 'Risk to stop $352', riskShortLabel: 'Risk $352', rewardLabel: 'Reward to target $928', rewardShortLabel: 'Reward $928' },
      markers: [{ id: 'x2', kind: 'Execution', effect: 'Reduced', label: 'Sold 2 at $4.00', shortLabel: 'Sold 2', isEntry: false }],
    });
  });

  it('should label the Worst case and the Max reward, what is past a line, a realized loss and each marker, and draw a session without a Mark as a break', () => {
    const past = withMarks(
      {
        ...session({
          date: '2026-11-13',
          held: 2,
          pnl: 1138,
          standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(182), r: frac(182, 324), crossed: true } }),
          figures: { ongoingRiskToStop: value(usd(672)), incrementalRewardToTarget: value(usd(0)) },
          outcomes: { atStop: value(usd(316)), atTarget: value(usd(956)), atWorstCase: value(usd(156)), atMaxReward: value(usd(564)) },
        }),
        markers: [buy, expiry],
      },
      [markOf(BREN_STOCK, '104.60')],
    );
    const loss = withMarks({ ...session({ date: '2026-11-16', pnl: null, realized: -495 }) }, [markOf(BREN_STOCK, '100.20')]);
    const [one, two] = replayProps(fullView([past, loss], PLAN), { Plot }).sessions.map((s) => s.plot);
    expect(one).toMatchObject({
      slot: 0,
      worstCase: { value: 156, label: 'Worst case +$156' },
      maxReward: { value: 564, label: 'Max reward +$564' },
      past: { line: 'Target', label: '$182 past the Target' },
      // Nothing more to reach: only the Risk to stop is tagged.
      stake: { riskLabel: 'Risk to stop $672', riskShortLabel: 'Risk $672' },
    });
    expect(one!.markers).toEqual([
      { id: 'x1', kind: 'Execution', effect: 'Opened', label: 'Bought 4 at $1.68', shortLabel: 'Bought 4', isEntry: true },
      { id: 'x3', kind: 'Expiration', effect: 'Closed', label: 'Expired', isEntry: false },
    ]);
    expect(two).toMatchObject({ slot: 1, underlyingMark: 100.2, tradePnl: null, banked: -495, bankedLabel: 'Realized −$495', resultAtStop: null, resultAtTarget: null });
    expect(two).not.toHaveProperty('stake');
  });

  it('should keep the reward tag after a Stop breach', () => {
    const pastStop = session({
      date: '2026-11-09',
      instrument: AXIO,
      held: 100,
      pnl: -920,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(180), r: frac(3, 10), crossed: true } }),
      figures: { ongoingRiskToStop: value(usd(0)), incrementalRewardToTarget: value(usd(1080)) },
    });
    const plot = replayProps(view([pastStop]), { Plot }).sessions[0]!.plot;
    expect(plot.stake).toEqual({ rewardLabel: 'Reward to target $1,080', rewardShortLabel: 'Reward $1,080' });
  });

  it('should place each session in its own weekday slot, leaving a holiday blank', () => {
    // Wed 11-25, then Fri 11-27 (Thanksgiving Thu 11-26 has no session), then Mon 11-30.
    const days = ['2026-11-25', '2026-11-27', '2026-11-30'].map((date) => withMarks(session({ date, pnl: 10 }), [markOf(BREN_STOCK, '100.00')]));
    const props = replayProps(fullView(days, PLAN), { Plot });
    expect(props.sessions.map((s) => s.plot.slot)).toEqual([0, 2, 3]);
    expect(props.sessions.map((s) => s.plot.slot)).not.toContain(1);
  });
});

describe('replay.props: the hover and the marker flag', () => {
  it('should give the hover the date, the Marks, each Execution and the Trade P&L, and say whether a Position Change falls in the session', () => {
    const sale = { id: 'x2', kind: 'Execution', effect: 'Reduced', fills: [{ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4) }] } as const;
    const none = withMarks(session({ date: '2026-11-12', pnl: null }), [markOf(BREN_STOCK, '100.20'), markOf(BREN)]);
    const props = replayProps(fullView([{ ...brenWed1111, markers: [sale] }, none], PLAN), { Plot });
    expect(props.sessions.map((s) => s.hover)).toEqual([
      ['Wed Nov 11', 'BREN Mark: 101.80', 'Call Mark: $3.20', 'Sold 2 at $4.00', 'Trade P&L: +$520.00 · 1.60R'],
      ['Thu Nov 12', 'BREN Mark: 100.20', 'Call Mark: No Mark', 'Trade P&L: No Mark'],
    ]);
    expect(props.sessions.map((s) => s.hasMarker)).toEqual([true, false]);
  });
});

describe('replay.props: the plot titles, anchors and time axis (W39, W40, A256)', () => {
  it('should title the charts, name the Plan anchors, and run an option Trade axis to its expiration day', () => {
    const wed = { ...brenWed1111, figures: { ...brenWed1111.figures!, conditions: [condition('Stop', 'UnderlyingPrice', '96.00'), condition('Target', 'UnderlyingPrice', '104.00')] } };
    const mon = withMarks(session({ date: '2026-11-09', pnl: 28 }), [markOf(BREN_STOCK, '97.20'), markOf(BREN, '1.61')]);
    const { plotBase } = replayProps(fullView([mon, wed], PLAN), { Plot });
    expect(plotBase).toEqual({
      priceTitle: 'BREN price · one Mark per session',
      priceShortTitle: 'BREN price',
      pnlTitle: 'Trade P&L · dollars for the whole Position, between the result at the Stop and at the Target',
      pnlShortTitle: 'Trade P&L',
      accessibleName: 'BREN Marks and Trade P&L by session',
      describedBy: 'replay-table-T-1',
      anchors: {
        priceLines: [
          { kind: 'Strike', price: 100, label: 'Strike $100' },
          { kind: 'Stop', price: 96, label: 'Stop $96.00' },
          { kind: 'Target', price: 104, label: 'Target $104.00' },
        ],
        planAtStop: { value: -324, label: 'Stop −$324' },
        planAtTarget: { value: 956, label: 'Target +$956' },
      },
      // Mon Nov 9 to Fri Nov 20: ten trading days, the later ones left blank until the slider reaches them.
      axis: { slots: 10, endLabel: 'Fri Nov 20' },
    });
  });

  it('should end a stock Trade axis on its last session, and anchor it at the price it was bought at', () => {
    const buy = { id: 'x1', kind: 'Execution', effect: 'Opened', fills: [{ instrument: AXIO, action: 'Buy', quantity: usd(200), price: usd(48) }] } as const;
    const fri = { ...session({ date: '2026-11-06', instrument: AXIO, held: 200, pnl: -380 }), markers: [buy] };
    const mon = session({ date: '2026-11-09', instrument: AXIO, held: 200, pnl: -920 });
    const { plotBase } = replayProps({ ...view([fri, mon]), instruments: [AXIO] }, { Plot });
    expect(plotBase.anchors.entryPrice).toBe(48);
    expect(plotBase.axis).toEqual({ slots: 2, endLabel: 'Mon Nov 9' });
    expect(plotBase.priceTitle).toBe('AXIO price · one Mark per session');
  });
});

// One group's rows as { label: text }.
const rowsOfGroup = (props: ReturnType<typeof replayProps>, index: number, title: string) =>
  Object.fromEntries(props.sessions[index]!.readout.find((group) => group.title === title)?.rows.map((r) => [r.label, r.value.text]) ?? []);

describe('replay.props: the readout of a session in flight (W43)', () => {
  it('should name the overrun in place of the risk or the reward once past a line, add what is banked, and say Stop breached or Target reached', () => {
    const pastStop = session({
      date: '2026-11-09',
      instrument: AXIO,
      held: 100,
      pnl: -920,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(180), r: frac(3, 10), crossed: true } }),
      figures: { ongoingRiskToStop: value(usd(0)), incrementalRewardToTarget: value(usd(1080)) },
    });
    const stopRows = rowsOfGroup(replayProps(view([pastStop]), { Plot }), 0, 'At stake from here, whole Position');
    expect(stopRows).toMatchObject({ 'Stop Overrun': '$180.00 · 0.30R', 'Reward to target': '$1,080.00', 'Reward to risk': 'Stop breached' });
    expect(stopRows).not.toHaveProperty('Risk to stop');
    // Past the Target with 2 of 4 contracts sold: the sale's +$478 is banked.
    const pastTarget = session({
      date: '2026-11-13',
      held: 2,
      pnl: 1138,
      realized: 478,
      standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(182), r: frac(182, 324), crossed: true } }),
      figures: { ongoingRiskToStop: value(usd(672)), incrementalRewardToTarget: value(usd(0)) },
    });
    const props = replayProps(view([pastTarget]), { Plot });
    const targetRows = rowsOfGroup(props, 0, 'At stake from here, whole Position');
    expect(targetRows).toMatchObject({ 'Risk to stop': '$672.00', 'Target Overrun': '$182.00 · 0.56R', 'Reward to risk': 'Target reached' });
    expect(targetRows).not.toHaveProperty('Reward to target');
    expect(rowsOfGroup(props, 0, 'How it is going')).toEqual({ 'Trade P&L': '+$1,138.00', Banked: '+$478.00' });
  });

  it('should show the open part of the Trade P&L in the readout', () => {
    // 2 of 4 contracts sold for +$478 banked; the 2 held are open +$660 of the +$1,138.
    const props = replayProps(view([session({ date: '2026-11-13', held: 2, pnl: 1138, realized: 478, open: 660 })]), { Plot });
    expect(rowsOfGroup(props, 0, 'How it is going')).toEqual({ 'Trade P&L': '+$1,138.00', Banked: '+$478.00', Open: '+$660.00' });
  });

  it('should call a planned-amount overrun by its words, not a breach, when the condition has not triggered', () => {
    const untriggered = (zone: 'PastStop' | 'PastTarget') =>
      rowsOfGroup(
        replayProps(view([session({ date: '2026-11-12', instrument: DALE, held: -3, pnl: -1272, standing: value({ zone, pastBy: { dollars: usd(9), r: frac(9, 1536), crossed: false } }) })]), { Plot }),
        0,
        'At stake from here, whole Position',
      );
    const stopRows = untriggered('PastStop');
    expect(stopRows).toMatchObject({ "Past Stop's amount": '$9.00 · 0.01R', 'Reward to risk': 'Not triggered' });
    expect(stopRows).not.toHaveProperty('Stop Overrun');
    const targetRows = untriggered('PastTarget');
    expect(targetRows).toMatchObject({ "Past Target's amount": '$9.00 · 0.01R', 'Reward to risk': 'Not triggered' });
    expect(targetRows).not.toHaveProperty('Target Overrun');
  });

  it('should show Final result with the Execution on a final session, and No Mark in place of the stake and the Marks on a session without one', () => {
    const sale = { id: 'x2', kind: 'Execution', effect: 'Closed', fills: [{ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4) }] } as const;
    const final = { ...withMarks(session({ date: '2026-11-13', held: 0, pnl: 1260, realized: 1260, standing: NOT_APPLICABLE, final: { kind: 'Sold' } }), [markOf(BREN_STOCK, '104.60'), markOf(BREN)]), markers: [sale] };
    const props = replayProps(fullView([final], PLAN), { Plot });
    expect(props.sessions[0]!.readout.map((group) => group.title)).toEqual(['Final result', 'Marks', 'Position', 'The Plan']);
    expect(rowsOfGroup(props, 0, 'Final result')).toEqual({ 'Trade P&L': '+$1,260.00', Banked: '+$1,260.00' });
    expect(rowsOfGroup(props, 0, 'Position')).toEqual({ 'Execution, Fri Nov 13': 'Sold 2 at $4.00' });
    // A Mark that was never saved reads "No Mark"; nothing is carried over.
    const none = withMarks(session({ date: '2026-11-10', pnl: null }), [markOf(BREN_STOCK, '100.20'), markOf(BREN)]);
    const gap = replayProps(fullView([none], PLAN), { Plot });
    expect(gap.sessions[0]!.readout.map((group) => group.title)).toEqual(['How it is going', 'Marks', 'Position', 'The Plan']);
    expect(rowsOfGroup(gap, 0, 'Marks')).toEqual({ 'BREN Mark': '100.20', 'Call Mark': 'No Mark' });
    expect(rowsOfGroup(gap, 0, 'How it is going')).toEqual({ 'Trade P&L': 'Mark missing: BREN Nov 20 $100 Call, Tue Nov 10' });
  });

  it('should group How it is going, At stake from here, Marks, Position and The Plan, each figure finished, with its change since the earlier session', () => {
    const props = replayProps(fullView([brenWed1111], PLAN), { Plot });
    expect(readoutOf(props, 0)).toEqual([
      ['How it is going', [['Trade P&L', 'Figure', '+$520.00 · 1.60R', 'up $190.00 since Tue Nov 10']]],
      [
        'At stake from here, whole Position',
        [
          ['Risk to stop', 'Figure', '$352.00 · 1.09R', 'down $60.00 since Tue Nov 10'],
          ['Result at the Stop', 'Figure', '−$324.00', undefined],
          ['Worst case', 'Figure', '$644.00 · 1.99R', undefined],
          ['Reward to target', 'Figure', '$928.00 · 2.86R', 'up $60.00 since Tue Nov 10'],
          ['Result at the Target', 'Figure', '+$956.00', undefined],
          ['Max reward', 'Unbounded', 'No cap above', undefined],
          ['Reward to risk', 'Figure', '2.64 to 1', '(Plan 2.95 to 1)'],
        ],
      ],
      [
        'Marks',
        [
          ['BREN Mark', 'Figure', '101.80', 'up 1.60 since Tue Nov 10'],
          ['Call Mark', 'Figure', '$3.20', 'down $0.40 since Tue Nov 10'],
        ],
      ],
      ['Position', [['Held', 'Figure', '4 contracts', undefined]]],
      [
        'The Plan',
        [
          // Named apart from the session's own results above, so each label stands once in the drawer.
          ['At the Stop', 'Figure', '−$324.00', undefined],
          ['At the Target', 'Figure', '+$956.00', undefined],
        ],
      ],
    ]);
  });
});
