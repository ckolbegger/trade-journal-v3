import type { ComponentType, ReactNode } from 'react';

// A216, A255: the replay's components take plain, already-formatted props. Strings are for the screen; a number is a
// finished price or dollar figure that the plot only turns into a coordinate (A256), never one it works out.
// No view or domain type is imported here: only `replay.props.ts` knows the view and builds these.

// A signed result's tone, for the card's edge colour and the area's fill. The words always say it too (W37).
export type ReplayTone = 'Profit' | 'Loss' | 'Even' | 'None';

// A finished figure with the label the plot draws beside it ("Stop +$316", "Banked +$478").
export interface LabelledFigure {
  // Dollars (P&L chart) or price (price chart), as drawn.
  readonly value: number;
  // The wording, in full.
  readonly label: string;
  // The phone wording ("Sold 2", "Risk $672"); the full label when absent.
  readonly shortLabel?: string;
}

// A Position Change drawn through both charts (W41).
export interface PlotMarker {
  // The fact id, for the Position drawer's link.
  readonly id: string;
  readonly kind: 'Execution' | 'Expiration';
  readonly effect: 'Opened' | 'Added' | 'Reduced' | 'Closed';
  // "Sold 2 at $4.00", "Expired".
  readonly label: string;
  readonly shortLabel?: string;
  // True for the Position Change that opened the Trade: no dashed line is drawn for it.
  readonly isEntry: boolean;
}

// One revealed session as the plot draws it (A255). The frame passes revealed sessions only.
export interface PlotSession {
  // Position on the time axis: 0 for the first session, counting every trading session up to `axis.slots - 1`.
  readonly slot: number;
  // "Mon Nov 16": the label for hover and the slider's mark.
  readonly dateLabel: string;
  // The Underlying's Mark; null for a session without one (drawn as a break, shaded, "No Mark").
  readonly underlyingMark: number | null;
  // The Underlying's Mark as labelled when the slider rests on this session ("$53.10").
  readonly underlyingLabel?: string;
  // The Trade P&L; null for a session without a figure (the area breaks).
  readonly tradePnl: number | null;
  // What the Trade has banked (its realized result so far); negative for a realized loss.
  readonly banked: number;
  // Its label, drawn on the session of the sale: "Banked +$478" or "Realized −$495".
  readonly bankedLabel?: LabelledFigure['label'];
  // The result at the Stop and at the Target as of this session, with their labels; null when Not Applicable.
  readonly resultAtStop: LabelledFigure | null;
  readonly resultAtTarget: LabelledFigure | null;
  // The Worst case and Max reward results; drawn only when they fall inside the chart's range. Null when none
  // (Unbounded or Not Applicable).
  readonly worstCase: LabelledFigure | null;
  readonly maxReward: LabelledFigure | null;
  // Where the result stands against the lines, to hatch the area past one and label it ("$32 past the Target").
  readonly past?: { readonly line: 'Stop' | 'Target'; readonly label: string; readonly shortLabel?: string };
  // What is at stake from here, tagged at the slider's session only: the neutral-ink bar and its two tags (reward only after a Stop breach).
  readonly stake?: { readonly riskLabel?: string; readonly riskShortLabel?: string; readonly rewardLabel?: string; readonly rewardShortLabel?: string };
  // The Position Changes in this session, in fact order.
  readonly markers: readonly PlotMarker[];
}

// A256: the Plan's anchors, which size each vertical axis together with the revealed sessions.
export interface PlotAnchors {
  // The Trade's average entry on the Underlying, when it has one.
  readonly entryPrice?: number;
  // Lines drawn on the price chart where a condition is on the Underlying's price, or the strike: "Stop $54.00",
  // "Strike $100".
  readonly priceLines: readonly { readonly kind: 'Stop' | 'Target' | 'Strike'; readonly price: number; readonly label: string }[];
  // The Plan column's two results: where both lines start (A252).
  readonly planAtStop: LabelledFigure | null;
  readonly planAtTarget: LabelledFigure | null;
}

// What the one plot component takes: Corridor today, a Ribbon plot later (A255).
export interface ReplayPlotProps {
  // The price chart's title and its phone form: "BREN price · one Mark per session", "BREN price".
  readonly priceTitle: string;
  readonly priceShortTitle?: string;
  // The P&L chart's title and its phone form.
  readonly pnlTitle: string;
  readonly pnlShortTitle?: string;
  // The accessible name of the charts, which are described by the table (its element id).
  readonly accessibleName: string;
  readonly describedBy: string;
  // Revealed sessions only, oldest first: the plot never sees a later one.
  readonly sessions: readonly PlotSession[];
  readonly anchors: PlotAnchors;
  // The time axis: `slots` trading sessions from the first session to the contract's expiration (to the last session
  // for stock), and the end's label ("Fri Nov 20"); later sessions stay blank.
  readonly axis: { readonly slots: number; readonly endLabel: string };
  // The slider's session, as an index into `sessions`.
  readonly sliderIndex: number;
  // Phone layout: use the short labels and fewer of them.
  readonly compact?: boolean;
  // A click or tap on a session, and hover or focus on one (null when it leaves); the frame owns what they do.
  readonly onSelectSession?: (index: number) => void;
  readonly onHoverSession?: (index: number | null) => void;
  // The session under hover or focus, which the frame passes back so the plot can mark it.
  readonly hoverIndex?: number | null;
}

// A figure in the readout: its kind decides the wording's treatment (W43).
export type ReadoutValue =
  | { readonly kind: 'Figure'; readonly text: string }
  // "No cap above".
  | { readonly kind: 'Unbounded'; readonly text: string }
  // The reason, as the screen words it.
  | { readonly kind: 'Unavailable'; readonly text: string }
  | { readonly kind: 'NotApplicable'; readonly text: string };

export interface ReadoutRow {
  // "Trade P&L", "At Stop", "At Worst case".
  readonly label: string;
  readonly value: ReadoutValue;
  // Where the Trade would end at that point, beside the amount from here; absent where there is none ("No cap above").
  readonly pnl?: ReadoutValue;
  // "Current Risk" or "Remaining Reward": a heading shown above the row that opens its part of the group.
  readonly heading?: string;
  // "down $150.00 since Fri Nov 13"; absent when the figure has no earlier one.
  readonly change?: string;
  // Set for a figure the charts draw, which the readout must hold too.
  readonly drawn?: boolean;
}

export interface ReadoutGroup {
  // "How it is going", "At stake from here, whole Position", "Marks", "Position", "The Plan", "Final result".
  readonly title: string;
  readonly rows: readonly ReadoutRow[];
}

// A row of "Session by session" (W45): cells line up with `ReplayProps.tableColumns` after "Session" and before "Events".
export interface TableRow {
  // "Mon Nov 16".
  readonly dateLabel: string;
  // Finished text; "No Mark" for a session without a Mark, never a carried value.
  readonly cells: readonly string[];
  // The session's events, one text each ("Sold 2 at $4.00").
  readonly events: readonly string[];
}

// Everything the frame shows for one session. The frame reveals sessions up to the slider's and drops the rest from
// the page, so nothing here is read for a later one.
export interface ReplayFrameSession {
  // The session's trading date, "2026-11-16": the key the address and the slider's state use.
  readonly date: string;
  // The slider's spoken value, "Mon Nov 16 · 11 of 15"; the headline follows it.
  readonly sliderValue: string;
  readonly dateLabel: string;
  // W36: "+$988.00 · 3.05R"; absent with no Mark, when `reason` stands in its place (no figure of another session).
  readonly headline: { readonly figure?: string; readonly reason?: string; readonly tone: ReplayTone };
  // W37: "Ahead: 85% of the way to the Target."; "Final result: sold out Thu Nov 12." on a final session.
  readonly howItIsGoing: string;
  // W38: the stake sentence; null when the session has none to say.
  readonly stake: string | null;
  // True for a Closed Trade's last session: the readout shows "Final result" in place of the first two groups.
  readonly isFinal: boolean;
  // The readout, in the order shown.
  readonly readout: readonly ReadoutGroup[];
  readonly tableRow: TableRow;
  // This session's drawing data; the plot's `sessions` are these, for the revealed ones.
  readonly plot: PlotSession;
  // Shown on hover and focus: "Tue Nov 3", then Marks and result, as lines.
  readonly hover: readonly string[];
  // Whether a Position Change falls in this session, for the "Position" link.
  readonly hasMarker: boolean;
}

// What `ReplayFrame` takes (A255): the headline, stake sentence, slider, readout, table, plot and the slots.
export interface ReplayProps {
  // The Trade's id: the slider's session is kept while the same Trade's replay is passed in again (A257).
  readonly tradeKey: string;
  // Sessions, oldest first. The slider has one step per session.
  readonly sessions: readonly ReplayFrameSession[];
  // The session to open on (a date); the last session when absent (T9.10).
  readonly initialSession?: string;
  // Fixed text for the whole replay: the slider's label ("Session") and its button labels.
  readonly sliderLabel: string;
  readonly previousLabel: string;
  readonly nextLabel: string;
  // The table's title ("Session by session") and its middle columns, after "Session" and before "Events":
  // "BREN Mark", "Trade P&L", "Banked", ...
  readonly tableTitle: string;
  readonly tableColumns: readonly string[];
  // The plot's fixed parts (titles, anchors, axis), to which the frame adds the revealed sessions.
  readonly plotBase: Omit<ReplayPlotProps, 'sessions' | 'sliderIndex' | 'onSelectSession' | 'onHoverSession' | 'hoverIndex' | 'compact'>;
  // The plot component: Corridor in the app, a double in tests; a Ribbon plot later.
  readonly Plot: ComponentType<ReplayPlotProps>;
  // Slots the screen fills in (A255): the links under the readout, and the "since" line and chips.
  readonly renderLinks?: (session: { readonly date: string; readonly hasMarker: boolean }) => ReactNode;
  readonly renderSince?: (session: { readonly date: string }) => ReactNode;
  readonly renderChips?: (session: { readonly date: string }) => ReactNode;
  // Called when the slider's session changes, so the screen can keep it (A257).
  readonly onSessionChange?: (date: string) => void;
}
