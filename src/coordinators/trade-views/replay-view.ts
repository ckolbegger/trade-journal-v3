import type { Instrument } from '../../domain/instrument/index.ts';
import type { CalculationResult, IncoherentFact } from '../../domain/trade-analysis/index.ts';
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
// or a gap (A210). The series carries no provenance (source, saved time), which the Detail's own Mark carries.
export type ReplayMarkResolution =
  | { readonly kind: 'Available'; readonly mark: { readonly price: string; readonly revisionNumber: number } }
  | { readonly kind: 'Missing' }
  | { readonly kind: 'AcknowledgedUnavailable'; readonly acknowledgment: AcknowledgmentVersion };

// One Instrument's Mark in one session, or the gap that stands in its place. A gap is never filled (A210).
export interface ReplayMark {
  readonly instrument: Instrument;
  readonly resolution: ReplayMarkResolution;
  // The Mark's change in price since this Instrument's previous Mark; null when it has no previous Mark or none now.
  readonly change: ReplayChange | null;
}

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
}

export type ReplayNotApplicable =
  // A Planned or Abandoned Trade was never exposed.
  | { readonly kind: 'NotApplicable'; readonly reason: 'NeverExposed' }
  // The facts cannot be replayed: each finding describes itself (P69).
  | { readonly kind: 'NotApplicable'; readonly reason: 'FactsIncoherent'; readonly findings: readonly IncoherentFact[] };

// Ready, ChangedDuringAssembly, NotFound or Rejected as every read, or Not Applicable.
export type ReplayTradeResult = ReadViewResult<TradeReplayView> | ReplayNotApplicable;
