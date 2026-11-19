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

// A268, A280: how much weight the extremes (the Worst case and the Max reward) carry. A view without the field is `Main`.
export type ExtremesWeight = 'Main' | 'Remote';

// A280: one thing the chart draws, as the one-line key names it. `kind` picks the swatch; `label` is the key's words.
export interface PlotKeyEntry {
  readonly kind: 'Mark' | 'TradePnl' | 'Banked' | 'Stop' | 'Target' | 'WorstCase' | 'MaxReward' | 'BreakEven' | 'Strike' | 'Execution' | 'FirstCrossing' | 'NoMark';
  readonly label: string;
}

// One revealed session as the plot draws it (A255). The frame passes revealed sessions only.
export interface PlotSession {
  // A280: what this session itself newly draws, for the key; the plot names the union over the revealed sessions and nothing else.
  readonly keyEntries?: readonly PlotKeyEntry[];
  // A280: the Worst case's tag at the bottom edge ("Worst case −$33,936 ↓"), drawn only when its line is below the chart's range;
  // `weight` says how strongly (grey for `Remote`).
  readonly worstCaseTag?: { readonly label: string; readonly weight: ExtremesWeight };
  // A280, phone: this session's labels in the order the strip lists them ("Stop +$316", "Banked +$478", "Sold 2"); the plot adds
  // any label the drawing left out.
  readonly stripLabels?: readonly string[];
  // A271, A280: set on the session where a condition's role was first crossed ("Target reached", "Stop breached"); the flag stays on
  // later sessions because the plot is given every revealed session.
  // Both roles can be first crossed on one session, so it is a list: the Stop's entry, then the Target's.
  readonly firstCrossing?: readonly { readonly line: 'Stop' | 'Target'; readonly label: string; readonly shortLabel?: string }[];
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
  // The P&L chart's title.
  readonly pnlTitle: string;
  // The accessible name of the charts, which are described by the session cards (their list's element id).
  readonly accessibleName: string;
  readonly describedBy: string;
  // Revealed sessions only, oldest first: the plot never sees a later one.
  readonly sessions: readonly PlotSession[];
  readonly anchors: PlotAnchors;
  // The time axis: `slots` trading sessions from the first session to the contract's expiration (to the last session
  // for stock), and the end's label ("Expires Fri Nov 20"); later sessions stay blank. A280: `startLabel` is the first
  // session's date at the left; `endLabel` is absent on a stock Trade, which has nothing to say at the right.
  readonly axis: { readonly slots: number; readonly startLabel?: string; readonly endLabel?: string };
  // A280: the name of the slider's session, shown under the cursor ("Mon Nov 16").
  readonly cursorLabel?: string;
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
  // A287: the row's canonical term, as its accessible description and hover title; nothing is added to see.
  readonly term?: string;
  // A268: the extremes' weight mark, on the Worst case and Max reward rows.
  readonly weight?: ExtremesWeight;
}

// A278: one row of the stake grid. One figure to a cell; each cell is unbreakable, sign included.
export interface StakeRow {
  // "At Stop", "At Worst case", "At Target", "At Max reward".
  readonly label: string;
  // A287: "Ongoing Risk to Stop", "Worst-Case Ongoing Risk", "Incremental Reward to Target", "Maximum Incremental Reward".
  readonly term: string;
  // The "From here" cell: the amount at stake.
  readonly fromHere: ReadoutValue;
  // The "R" cell and the "P&L if hit" cell; both absent on an Unbounded Max reward, which reads "No cap above" across its row.
  readonly r?: ReadoutValue;
  readonly pnlIfHit?: ReadoutValue;
  // A268: the extremes' weight mark, on At Worst case and At Max reward.
  readonly weight?: ExtremesWeight;
}

// A278: a row group of the grid under its heading.
export interface StakeRowGroup {
  readonly heading: 'Current Risk' | 'Remaining Reward';
  readonly rows: readonly StakeRow[];
}

// A278: past a line, the one row that stands above the two headings in place of the row whose amount would be zero.
export interface StakePastLineRow {
  // "Past the Stop by $300.00 (0.50R) · at Stop −$740.00"; "Past the Stop's amount by $9.00 (0.01R) · at Stop −$1,263.00".
  readonly text: string;
  // A287: "Stop Overrun" or "Target Overrun".
  readonly term: string;
}

// A267, A278: the odds as the readout says them.
export interface StakeOdds {
  // "11.69 to 1 · about 8% : 92%".
  readonly text: string;
  // "(Plan 0.29 to 1 · 78% : 22%)", beside it.
  readonly planText?: string;
  // The odds in full for a screen reader: "about 8% chance of the Target first, 92% of the Stop first".
  readonly spoken: string;
  // "Odds: Target first : Stop first, estimated with no edge and no time limit.", shown once, under the grid.
  readonly note: string;
}

// A278: the "At stake from here, whole Position" group as a real table. The columns are fixed: "From here", "R", "P&L if hit".
export interface StakeGrid {
  readonly columns: readonly ['From here', 'R', 'P&L if hit'];
  readonly pastLine?: StakePastLineRow;
  // "Current Risk" then "Remaining Reward".
  readonly groups: readonly StakeRowGroup[];
  // Absent when there is no ratio (a Trade past a line).
  readonly odds?: StakeOdds;
}

export interface ReadoutGroup {
  // "How it is going", "At stake from here, whole Position", "Marks", "Position", "Final result".
  readonly title: string;
  readonly rows: readonly ReadoutRow[];
  // A278: the stake group's grid, which the readout draws in place of `rows` when present.
  readonly grid?: StakeGrid;
}

// A269, decision 5: the Plan's own terms, fixed above the cards. Each row is finished words, one line:
// "Entry: 4 contracts at $1.61", "Strike $100", "Stop: call at or below $0.80 · P&L if hit −$324.00", "Reward to risk: 2.95 to 1 · 25% : 75%".
export interface PlanBlock {
  // "The Plan".
  readonly title: string;
  readonly rows: readonly string[];
}

// What the readout takes: the slider session's groups.
export interface ReadoutProps {
  readonly groups: readonly ReadoutGroup[];
}

// A277: one row of a session card, top to bottom: the Marks, Trade P&L, Banked, the stake rows, Events.
export interface SessionCardRow {
  readonly label: string;
  // A figure, or for a stake row the amount from here: "$672.00".
  readonly value: ReadoutValue;
  // A stake row's R and where the Trade would end ("P&L if hit"), beside the amount from here: "$672.00 · 2.07R · P&L if hit +$316.00".
  readonly r?: ReadoutValue;
  readonly pnl?: ReadoutValue;
  // A287: the canonical term as accessible text.
  readonly term?: string;
  readonly weight?: ExtremesWeight;
  // A267: the Reward to risk row's odds in full for a screen reader, when its value holds them.
  readonly spoken?: string;
}

// A277: what the adapter builds for one session; the frame adds `id` and `isCurrent`.
export interface SessionCardBody {
  // "Mon Nov 16".
  readonly heading: string;
  readonly rows: readonly SessionCardRow[];
  // W56: a Trade past a line, in one row above the stake rows, in place of the row whose amount would be zero.
  readonly pastLine?: StakePastLineRow;
  // The session's events, one text each ("Sold 2 at $4.00"); none when it had none.
  readonly events: readonly string[];
}

// A277: one card as `SessionCards` draws it.
export interface SessionCard extends SessionCardBody {
  // The session's date, which names the card and moves the slider when its heading is pressed.
  readonly id: string;
  // The slider's session: the card carries `aria-current`.
  readonly isCurrent: boolean;
}

// A277: the adapter's fixed words for the cards; the cards themselves come from the sessions' `card`.
export interface SessionCardsWords {
  // "Session by session".
  readonly title: string;
  // "Newer sessions" and "Earlier sessions": the pager's buttons.
  readonly newerLabel: string;
  readonly earlierLabel: string;
}

// A277: what `SessionCards` takes. `cards` are the revealed sessions, newest first.
export interface SessionCardsProps extends SessionCardsWords {
  readonly cards: readonly SessionCard[];
  // The element id the charts name in `aria-describedby`.
  readonly id: string;
  readonly onSelectSession: (id: string) => void;
}

// A273: what `ReplayOverlay` takes: a modal dialog over the whole viewport.
export interface ReplayOverlayProps {
  // The dialog's accessible name: "Replay, BREN".
  readonly name: string;
  // The header's text: "BREN · Trade P&L +$988.00", "BREN · Final result +$1,138.00", or the symbol alone.
  readonly header: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

// Everything the frame shows for one session. The frame reveals sessions up to the slider's and drops the rest from
// the page, so nothing here is read for a later one.
export interface ReplayFrameSession {
  // The session's trading date, "2026-11-16": the key the address and the slider's state use.
  readonly date: string;
  // A277: this session's card, shown newest first for the revealed sessions; the frame adds the id and the current mark.
  readonly card: SessionCardBody;
  // A267: the stake sentence's odds in full for a screen reader, when the sentence holds them.
  readonly stakeSpoken?: string;
  // The slider's spoken value, "Mon Nov 16 · 11 of 15"; the headline follows it.
  readonly sliderValue: string;
  readonly dateLabel: string;
  // W36: "+$988.00 · 3.05R"; absent with no Mark, when `reason` stands in its place (no figure of another session).
  readonly headline: { readonly figure?: string; readonly reason?: string; readonly tone: ReplayTone };
  // A281: where "Add the Mark" links, the Review's Marks row for the Instrument whose Mark is missing (or acknowledged unavailable), "/review?trade=<id>&instrument=<key>"; set only on an Open Trade, absent on a Trade that has ended.
  readonly addMarkTo?: string;
  // W37: "Ahead: 85% of the way to the Target."; "Final result: sold out Thu Nov 12." on a final session.
  readonly howItIsGoing: string;
  // W64: when a Stop or Target was first crossed, one sentence after the status line, from the session it happened in on;
  // absent when neither has been.
  readonly crossingWords?: string;
  // W38: the stake sentence; null when the session has none to say.
  readonly stake: string | null;
  // True for a Closed Trade's last session: the readout shows "Final result" in place of the first two groups.
  readonly isFinal: boolean;
  // The readout, in the order shown.
  readonly readout: readonly ReadoutGroup[];
  // This session's drawing data; the plot's `sessions` are these, for the revealed ones.
  readonly plot: PlotSession;
  // Shown on hover and focus: "Tue Nov 3", then Marks and result, as lines.
  readonly hover: readonly string[];
  // Whether a Position Change falls in this session, for the "Position" link.
  readonly hasMarker: boolean;
}

// What `ReplayFrame` takes (A255): the headline, stake sentence, slider, readout, session cards, plot and the slots.
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
  // A277: the cards' fixed words ("Session by session", the pager's buttons); each session's `card` is its own.
  readonly cardsWords: SessionCardsWords;
  // Decision 5: the Plan block above the cards; absent for a view that carries no Plan terms.
  readonly plan?: PlanBlock;
  // The plot's fixed parts (titles, anchors, axis), to which the frame adds the revealed sessions.
  readonly plotBase: Omit<ReplayPlotProps, 'sessions' | 'sliderIndex' | 'onSelectSession' | 'onHoverSession' | 'hoverIndex' | 'compact' | 'cursorLabel'>;
  // The plot component: Corridor in the app, a double in tests; a Ribbon plot later.
  readonly Plot: ComponentType<ReplayPlotProps>;
  // Slots the screen fills in (A255): the links under the readout, and the "since" line and chips.
  readonly renderLinks?: (session: { readonly date: string; readonly hasMarker: boolean }) => ReactNode;
  readonly renderSince?: (session: { readonly date: string }) => ReactNode;
  readonly renderChips?: (session: { readonly date: string }) => ReactNode;
  // Called when the slider's session changes, so the screen can keep it (A257).
  readonly onSessionChange?: (date: string) => void;
}
