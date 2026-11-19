import type { TradeReplayView } from '../../../app/types.ts';
import type { CalculationResult } from '../../../domain/calculation-result/index.ts';
import type { Instrument, OptionInstrument } from '../../../domain/instrument/index.ts';
import { Rational } from '../../../domain/values/index.ts';
import type { replayProps } from './replay.props.ts';

// Doubles of the replay view, shared by the adapter's test files (replay.props, session-words, stake-words, readout and plot; A286).
// They are built from T9.2's types with the breakdown's section 5 figures as finished values: the adapter selects and formats them and
// works out nothing, so nothing here is derived either.
export type Session = TradeReplayView['sessions'][number];
export type Figures = NonNullable<Session['figures']>;
type Standing = NonNullable<Figures['standing']>;
type Outcomes = NonNullable<Figures['outcomes']>;

export const usd = (dollars: number): Rational => Rational.of(BigInt(Math.round(dollars * 100)), 100n);
export const frac = (n: number, d: number): Rational => Rational.of(BigInt(n), BigInt(d));
export const value = <T>(v: T): CalculationResult<T> => ({ kind: 'Value', value: v });
export const UNBOUNDED: CalculationResult<never> = { kind: 'Unbounded', direction: 'Above', explanation: 'A long Call has no ceiling.' };
export const NOT_APPLICABLE: CalculationResult<never> = { kind: 'NotApplicable', reason: 'NoRemainingPosition' };

export const BREN: OptionInstrument ={ kind: 'Option', symbol: 'BREN', root: 'BREN', expiration: '2026-11-20', strike: '100', right: 'Call', multiplier: 100 };
export const DALE: OptionInstrument ={ kind: 'Option', symbol: 'DALE', root: 'DALE', expiration: '2026-11-20', strike: '57.5', right: 'Put', multiplier: 100 };
export const AXIO: Instrument = { kind: 'Stock', symbol: 'AXIO' };

// A condition on the Underlying's price at its trigger; the adapter reads only its role, kind and boundary.
export const condition = (role: 'Stop' | 'Target', kind: 'UnderlyingPrice' | 'StructureValue', boundary: string): Figures['conditions'][number] => ({
  id: `${role}-1`,
  role,
  kind,
  boundary,
  result: { kind: 'Unavailable', reason: 'AwaitingClose', after: '2026-11-11' },
});

export interface Spec {
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

export function session(spec: Spec): Session {
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

export const view = (sessions: readonly Session[], planColumn: TradeReplayView['planColumn'] = { atStop: usd(-324), atTarget: usd(956), rewardRisk: frac(956, 324) }): TradeReplayView => ({
  tradeId: 'T-1',
  instruments: [BREN],
  sessions,
  plan: [],
  pending: null,
  planColumn,
});

// R-BREN-U on Mon 11-02: the 4 contracts at $1.61, Trade P&L +$28.
export const brenMon1102 = session({
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

// replayProps (A255): the whole view as the frame's props. These cases were not in the breakdown; the Replay drawer (T9.14) draws from them.
// The view lists the Underlying beside the contract, as the real one does (the Price History drawer reads it the same way).
export const BREN_STOCK: Instrument = { kind: 'Stock', symbol: 'BREN' };
export const Plot = () => null;
export const markOf = (instrument: Instrument, price?: string, change: Session['marks'][number]['change'] = null): Session['marks'][number] => ({
  instrument,
  resolution: price === undefined ? { kind: 'Missing' } : { kind: 'Available', mark: { price, revisionNumber: 1, source: 'Manual', savedAt: '2026-11-02T21:30:00Z' } },
  change,
});
export const withMarks = (s: Session, marks: Session['marks']): Session => ({ ...s, marks });
export const fullView = (sessions: readonly Session[], planColumn?: TradeReplayView['planColumn']): TradeReplayView => ({ ...view(sessions, planColumn), instruments: [BREN_STOCK, BREN] });

// R-BREN-U on Wed 11-11: the 4 contracts at $3.20, +$520, 54% of the way to the Target.
export const brenWed1111 = withMarks(
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
  },
  [markOf(BREN_STOCK, '101.80', { since: '2026-11-10', dollars: usd(1.6) }), markOf(BREN, '3.20', { since: '2026-11-10', dollars: usd(-0.4) })],
);
export const PLAN = { atStop: usd(-324), atTarget: usd(956), rewardRisk: frac(956, 324) } as const;

type Props = ReturnType<typeof replayProps>;

// A readout's rows as [label, kind, text, change], so a case reads the words and not the shape.
export const readoutOf = (props: Props, index: number) =>
  props.sessions[index]!.readout.map((group) => [group.title, group.rows.map((row) => [row.label, row.value.kind, row.value.text, row.change])] as const);

// One group's rows as { label: text }.
export const rowsOfGroup = (props: Props, index: number, title: string) =>
  Object.fromEntries(props.sessions[index]!.readout.find((group) => group.title === title)?.rows.map((r) => [r.label, r.value.text]) ?? []);

// T9.19-B4 (PD4): what is at stake from here is separate from where the Trade would end.
export const STAKE = 'At stake from here, whole Position';
export const stakeRows = (props: Props, index: number) => props.sessions[index]!.readout.find((group) => group.title === STAKE)!.rows;
export const rowNamed = (props: Props, index: number, label: string) => stakeRows(props, index).find((r) => r.label === label);

// R-BREN-U on Thu 11-12: 2 of the 4 contracts sold, the Target passed by $26; the Worst case still at risk $832.00 (2.57R), the Trade ending +$156 there.
export const brenThu1112 = session({
  date: '2026-11-12',
  held: 2,
  pnl: 982,
  realized: 478,
  standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(26), r: frac(26, 324), crossed: true }, openProfitAtRisk: usd(504) }),
  figures: {
    ongoingRiskToStop: value(usd(672)),
    ongoingRiskToStopInPlanR: value(frac(672, 324)),
    worstCaseOngoingRisk: value(usd(832)),
    worstCaseOngoingRiskInPlanR: value(frac(832, 324)),
    incrementalRewardToTarget: value(usd(0)),
    maximumIncrementalReward: UNBOUNDED,
  },
  outcomes: { atStop: value(usd(316)), atTarget: value(usd(956)), atWorstCase: value(usd(156)) },
});
