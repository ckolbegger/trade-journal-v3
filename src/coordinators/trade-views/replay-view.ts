import type { Instrument, OptionInstrument } from '../../domain/instrument/index.ts';
import type { CalculationResult, IncoherentFact, ReplayedSession, ReplayResult } from '../../domain/trade-analysis/index.ts';
import type { Rational } from '../../domain/values/index.ts';
import type { AcknowledgmentVersion } from '../../modules/market-data/index.ts';
import type { ReadViewResult, TradeDetailNarrativeItem, ViewBinding } from './view-types.ts';

// D08P's slice of `replayTrade` (P94, P95, A211 to A213): per completed session, the Position held, the realized
// and Trade P&L, the change since the previous session with a figure, each Instrument's Mark or gap, the Position
// Changes and the Journal items. D9 adds condition status per session, Deviations and markers; nothing here stubs them.

export interface ReplayTradeRequest {
  readonly tradeId: string;
  // The binding of the Detail this replay sits beside; a Workspace moved since gives ChangedDuringAssembly (A212).
  readonly binding: ViewBinding;
}

// A change since the previous session with a figure, which need not be the previous session (A211).
export interface ReplayChange {
  // That session's date.
  readonly since: string;
  readonly dollars: Rational;
}

// What a session's series point says of an Instrument: its effective Mark (price and revision, as `series` gives them),
// or a gap (A210), with the effective revision's provenance (revision 93).
export type ReplayMarkResolution =
  | {
      readonly kind: 'Available';
      readonly mark: {
        readonly price: string;
        readonly revisionNumber: number;
        readonly source: 'Manual';
        readonly savedAt: string;
        // The reason given when this revision corrected an earlier one (revision 93).
        readonly correctionReason?: string;
      };
    }
  | { readonly kind: 'Missing' }
  | { readonly kind: 'AcknowledgedUnavailable'; readonly acknowledgment: AcknowledgmentVersion };

// One Instrument's Mark in one session, or the gap that stands in its place. A gap is never filled (A210).
export interface ReplayMark {
  readonly instrument: Instrument;
  readonly resolution: ReplayMarkResolution;
  // The Mark's change in price since this Instrument's previous Mark; null when it has no previous Mark or none now.
  readonly change: ReplayChange | null;
}

// A250: a session's figures, the domain's own type.
export type ReplayFigures = NonNullable<ReplayedSession['figures']>;
// A251: a Position Change's marker and its fills.
export type ReplayMarker = NonNullable<ReplayedSession['markers']>[number];
// A252: the Plan column: the results at the Stop and the Target as planned, and the Plan Baseline's reward to risk.
export interface ReplayPlanColumn {
  readonly atStop: Rational;
  readonly atTarget: Rational;
  readonly rewardRisk: Rational;
  // A267: the Plan's own odds beside its ratio (the domain's own shape, as a session's figures carry it).
  readonly odds?: Extract<NonNullable<ReplayFigures['rewardRiskOdds']>, { kind: 'Value' }>['value'];
  // A269: each Planned Leg and every original Stop and Target (the domain's own shape).
  readonly terms: NonNullable<Extract<ReplayResult, { kind: 'Replayed' }>['plan']>['terms'];
}
// A271: a session's first crossings, per role and per condition.
export type ReplayCrossings = NonNullable<ReplayedSession['crossings']>;
// A258: a session's estimates.
export type ReplayEstimates = NonNullable<ReplayedSession['estimates']>;
// A253: how a Closed Trade ended.
export type ReplayFinal = { readonly kind: 'Sold' } | { readonly kind: 'Expired'; readonly contract: OptionInstrument };

export interface ReplaySession {
  // The session's trading date.
  readonly date: string;
  // The Position held at this session's Mark: signed quantity per Instrument, and their sum (decision 105).
  readonly positions: readonly { readonly instrument: Instrument; readonly quantity: Rational }[];
  readonly heldQuantity: Rational;
  readonly realizedPnl: Rational;
  // Realized plus open, or why it is Unavailable (a missing Mark names its Instrument, with no value carried forward).
  readonly tradePnl: CalculationResult<Rational>;
  // The change in Trade P&L since the previous session with a figure; null when this session has none or is the first.
  readonly change: ReplayChange | null;
  readonly marks: readonly ReplayMark[];
  // The Position Changes whose Economic Time falls in this session.
  readonly positionChangeIds: readonly string[];
  // This session's Journal items (A213), in moment-time order.
  readonly journal: readonly TradeDetailNarrativeItem[];
  // A250: this session's figures.
  readonly figures?: ReplayFigures;
  // A251: the Position Changes in this session.
  readonly markers?: readonly ReplayMarker[];
  // A271: each role's first crossing and current run.
  readonly crossings?: ReplayCrossings;
  // A258: this session's estimates (implied volatility, share equivalent, split, with the rate and days used), the domain's own shape,
  // passed through unchanged. Absent when the session holds nothing of the Trade's Instrument.
  readonly estimates?: ReplayEstimates;
  // A253: set on a Closed Trade's last session only, with how the Trade ended.
  readonly final?: ReplayFinal;
}

export interface TradeReplayView {
  readonly tradeId: string;
  // Every Instrument the lifetime exposes, in the order the Mark rows show them.
  readonly instruments: readonly Instrument[];
  // Completed sessions, oldest first: from the first exposure's session to the Expected Mark Date (Open) or the
  // final session (Closed). The screen reverses them for "newest first".
  readonly sessions: readonly ReplaySession[];
  // Journal items from before the first exposure: the "Plan" list (A213).
  readonly plan: readonly TradeDetailNarrativeItem[];
  // The session not yet ended (W12): its date, and the items saved since the newest completed session. Null for a
  // Closed Trade.
  readonly pending: { readonly date: string; readonly journal: readonly TradeDetailNarrativeItem[] } | null;
  // A252: the Plan column. Named `planColumn` because `plan` above already holds the pre-exposure Journal items.
  readonly planColumn?: ReplayPlanColumn;
}

export type ReplayNotApplicable =
  // A Planned or Abandoned Trade was never exposed.
  | { readonly kind: 'NotApplicable'; readonly reason: 'NeverExposed' }
  // The facts cannot be replayed: each finding describes itself (P69).
  | { readonly kind: 'NotApplicable'; readonly reason: 'FactsIncoherent'; readonly findings: readonly IncoherentFact[] };

// Ready, ChangedDuringAssembly, NotFound or Rejected as every read, or Not Applicable.
export type ReplayTradeResult = ReadViewResult<TradeReplayView> | ReplayNotApplicable;
