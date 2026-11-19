# D09A-R — D9 Stage A Refactor: task breakdown

Definition: not yet in the implementation plan; section 1.2 holds the text to add when this breakdown is agreed. Source: the coach review of the built replay (`evidence/D09/coach-review-1.md`, score 6 of 10, 15 suggestions) and the user's eight decisions on it (`plan/D09A-R-decisions.md`, 2026-11-18). **The decisions are the authority; where one differs from the coach's suggestion, the decision wins.** The deliverable being changed is D9's stage A as built ([D09-trade-replay.md](D09-trade-replay.md); its section 1.4 lists stage A's nineteen tasks). Drafted on `claude-opus-5.5` at `bbc3ae28`.

Status: **agreed by the user, 2026-11-18** (plan decision 118, revision 107). The five open questions in section 12 are answered and the eighteen rows of words in section 1.6 approved. Numbering continues from D9: P139, A266 and W53. Runs after D9's Stage A gate (T9.19) closes and Stage A is pushed, before D9's Stage B.

**Checked against all of `specs/`, 2026-11-18.** After the four answers, every spec file was read in full (the appendix lists them) and the draft was checked against them. What that reading changed is marked "(full reading)" where it stands: P153, A287, additions to A268, A269, A270, A271, A273, A278, A281 and A284, new cases in T9AR.4, T9AR.5, T9AR.13, T9AR.16, T9AR.18 and T9AR.20, and new checks in B9AR.3, B9AR.6 and B9AR.7. It raised one new question, open question 5 in section 12, which is not yet answered. No answered question and no approved word was changed.

**What this draft assumes is already done.** D9A-R runs after stage A's gate (T9.19) has closed, on its current layout, and before stage B (decision 1). Two stage A fixes are not in the tree yet and are planned as done here, not planned again: T9.19-B3 (the chart's Worst case and Max reward lines step per session) and T9.19-B11 (a unit test for the Worst case and Max reward rows on a session with no Mark). Every lookup in section 1.5 was run on `bbc3ae28`; rerun them if those two fixes move a listed line.

**In the trader's words.**
- **Replay opens over the whole page.** Press "Replay" on a Trade, or on its Review card, and the replay covers the screen: the Trade's symbol and today's P&L on top, a Close button, and the charts as wide as the screen allows. Escape or the browser's Back closes it. On a phone it fills the screen.
- **The figures line up.** What is at risk and what is left to gain are a small grid: from here, in R, and where the Trade would end. A minus sign never parts from its number.
- **A losing Trade is not flattered.** Beside the reward-to-risk ratio stands the estimated chance of reaching the Target first: "11.69 to 1 · about 8% : 92%".
- **The Plan stands beside what happened.** The Plan's prices are on the page. Each sale or buy says how it stood against the Plan ("$1.40 below the Stop", "at the Target"). The replay remembers when a Stop or Target was first crossed.
- **Session cards replace the wide table.** One card per session, newest first, paged like the Journal. The slider and the cards move together.
- **The chart explains itself.** A key, dates on the time axis, a label on every line, nothing drawn through the entry session's labels, and on a phone the labels sit in a strip under the drawing.
- **One name per figure.** "Realized" for a loss, a dollar sign on every price, ratios with two decimals, and the Review card's summary in the replay's words.

---

## 1. Decisions and clarifications

### 1.1 Decisions for this breakdown

**The user's eight decisions** (`plan/D09A-R-decisions.md`; final). Each is quoted in short; the file holds the full text.

| # | Decision | Where it lands |
|---|---|---|
| D1 | D9A-R runs after stage A's gate has passed and before stage B, as its own deliverable with its own critic. | Sections 4 and 9; gate T9AR.24. |
| D2 | All 15 suggestions are in scope, suggestion 5 included; its domain tasks come first; its new words need approval. | T9AR.4, T9AR.5 before T9AR.18, T9AR.19; W62, W63, W64. |
| D3 | The replay opens as an overlay of the whole page, from Trade Detail and from a "Replay" button on the Review card (the card's inline replay goes). Header with symbol, today's P&L and Close; Escape; focus kept inside and returned; Back closes it; the readout may sit beside the charts on a wide screen; full screen on a phone. Price History, Journal and the Review's Price History link are unchanged. | T9AR.7, T9AR.8, T9AR.9. |
| D4 | The ratio stays, with the estimated chance of the Target first and the Stop first, beside the Plan's own: "11.69 to 1 · about 8% : 92% (the Plan was 0.29 to 1 · 78% : 22%)". Chance of the Target first = risk to the Stop ÷ (risk to the Stop + reward to the Target). Worked out in the domain; worded as an estimate. | T9AR.3, T9AR.15, T9AR.20. |
| D5 | The table becomes a fixed Plan block and a carousel of session cards in the Journal's pattern, newest first, synced both ways with the slider. Stage A's pass condition reads "… and the session cards". | T9AR.17, T9AR.18; section 10. |
| D6 | "At Worst case" and "At Max reward" are smaller and grey on a stock or a long option, full strength on a short option; decided in the domain from the strategy. The P&L chart's long desktop title takes the phone's form. | T9AR.3, T9AR.15, T9AR.11, T9AR.10. |
| D7 | The Review card's summary (`CardFigures.tsx`) takes the replay's words; past a Stop or Target it uses the replay's wording, not "$0.00 · 0.00R". | T9AR.20. |
| D8 | The "since" line stays under Trade P&L and under each Mark only; its words are unchanged. | T9AR.13, T9AR.21. |

**The planner's proposals.** These stand unless you object, except where a row names an open question.

| # | Question | Recommendation | Alternatives and tradeoff |
|---|---|---|---|
| P139 | **Size.** | **One breakdown of 24 tasks, with four open questions and no schema change.** None of the drafting guide's three limits is met (more than 25 tasks, a schema change through every layer, five or more questions), so no split is proposed (section 1.4). It is a vertical deliverable in the planning protocol's sense, not a UI-only one: each new figure runs from Trade Analysis through both views to the screen, so the protocol's layer-only gate does not apply (full reading). | A split at the overlay (overlay first, the rest after): it would put a gate in the middle of work whose parts are judged together on one screen. |
| P140 | **Lanes or one task at a time.** | **Lanes, as stage A ran, with at most 4 agents** (decision 111's rules; section 3 has the reasons and the times). The domain chain, the overlay and the chart's drawing share no file, and the Progress order in section 15 is also a valid order for running one task at a time. | One task at a time: about 22 hours against about 9, with no merges to manage. Yours to overrule when you agree the breakdown. |
| P141 | **Names.** The earlier refactors are D5R (tasks `T5R.n`) and D8R (`T8R.n`): the deliverable's letters join the number with no hyphen. | **Tasks are named `T9AR.n`; the 24 are listed in section 4.1, and are written out one by one wherever they are listed.** `tdd.sh` maps `T9AR.n` to `evidence/D09AR/`, and `full-suite.sh` maps that folder to `e2e/d9ar/` (checked: section 1.5). Integration cases go in `tests/integration/d9ar/`. Case IDs are `I9AR.n`, `B9AR.n` and `C9AR.n`. The tag is `claude-opus-5.5-d9ar`. T9AR.1 makes `status.sh D09A-R` find `evidence/D09AR/`. | `T9A-R.n`: `tdd.sh` rejects a hyphen in a task ID. |
| P142 | **Who works out each new figure** (ADR 0001: the screen calculates nothing). | **Trade Analysis.** `evaluate` gains the estimated odds, the Plan's odds and the extremes' weight (A267, A268). `replay` gains the Plan's terms, each fill against the Plan, and each condition's first crossing (A269, A270, A271). The coordinators pass them through unchanged. The domain tasks run first (D2). | The adapter working them out: forbidden by ADR 0001, and the Review card's summary would need a second copy. |
| P143 | **Where "Replay" sits on Trade Detail** once it is no longer a drawer. | **A "Replay" button at the end of the drawers' tab row, outside the tab list.** The drawers return to D8R's six: Today, Position, Plan and Risk, Price History, Journal, Payoff (W54). A tab that opens an overlay would break the tabs pattern, since a tab must show a panel. | On the rail's P&L card: nearer the figure, but the rail scrolls away on a phone. |
| P144 | **How Back closes the overlay.** | **The address carries it** (A274): opening adds `replay=open` as one new history entry, so the browser's Back removes it and the page under it is as it was. Close and Escape do the same as Back. A reload keeps the overlay open. | State held in memory with a history listener: lost on reload, and a second mechanism beside A257's. |
| P145 | **The reveal rule and the cards.** D9's rule, the user's, is that nothing of a session after the slider's is on the page. Decision 5 says the slider's card is "scrolled into view", which reads as if every session's card were always there. (Open question 3.) | **Keep the reveal rule: cards exist for the sessions up to the slider's.** The slider's card is then the newest card. Choosing an earlier card moves the slider back to it; the slider or its buttons move forward. "Scrolled into view" means the cards turn back to the slider's card when the trader had paged to older ones. The overlay's header shows today's P&L by decision 3, the one figure of a later session on the page. | Every session's card always present: the cards would show the ending while the trader steps through the Trade. |
| P146 | **The hole in the P&L area on a session with no Mark** (suggestion 12 asks for "a dashed bridge across the hole"). The UI contract says "Lines never bridge a dependent missing value", and Trade Views says replay does not "bridge a gap". Market Data says the same of every series: ranges "never interpolate, carry forward, connect across absence" (full reading). (Open question 2.) | **No bridge.** The session's column is shaded and labelled "No Mark" in the P&L chart as it already is in the price chart, and the area runs to the edge of that column on each side and stops upright, so it no longer reads as a fall to nothing. The rest of suggestion 12 is built as asked. | A dashed, labelled connector: it needs both spec sentences amended. |
| P147 | **Spec amendments.** The estimated odds are a new figure with no glossary term, the replay's names are not among the glossary's permitted compact labels, and Trade Analysis's `evaluate` and `replay` paragraphs do not name the new results. (Open question 1.) | **Amend the glossary and two Trade Analysis sentences, and add one clause to Trade Views' invariants** (section 1.2 holds the text). No new acceptance scenario: the odds are arithmetic on AC-CALC-003's risk and reward, and are proven under it. | No amendment: the app would show a figure the frozen specs neither define nor permit a label for. |
| P148 | **No figure disappears between merges** (D8R's P116). | **A task that removes a figure's place is blocked by the task that gives it its new one, or keeps it until then.** T9AR.17 removes the table only when the cards hold every figure, and keeps the Stop and Target prices as two card rows until T9AR.18 moves them to the Plan block. T9AR.21 removes the stake rows' change fields only after T9AR.13 stops reading them. | Remove and add in separate lanes at once: a merge run could see a figure on no part of the page. |
| P149 | **Words.** (Open question 4.) | **Words the decisions give are approved. Every other new or changed text is proposed in section 1.6, W53 to W70.** D9's wording rule P137 is carried over (section 9): a task may shorten, never lengthen. | — |
| P150 | **Stage A's existing browser cases.** Moving the replay into an overlay changes how every `e2e/d9` case opens it. | **Each task re-points the `e2e/d9` lines its lookup lists (section 1.5), so stage A's cases B9.1, B9.2, B9.3, B9.4 and B9.5 keep passing as amended. New behavior gets new cases in `e2e/d9ar/` (T9AR.23).** | Rewrite `e2e/d9` wholesale in the browser-suite task: every merge run before it would fail. |
| P151 | **Run rules.** D9's P138 was given for "every stage of D9". The planner's reading, for the user to correct: it holds for D9A-R too. | **Both of P138's rules apply:** if three critics at the gate leave only moderate or lower defects, the gate closes and each becomes a tech debt item; a known flaky case that fails a run is rerun alone once. | Stopping for each. |
| P152 | **Left out of D9A-R.** | The other screens' older names: Plan and Risk's "Risk to stop", "Reward to target", "Worst case" and "Max reward", the Review card's "At entry" group, and reward-to-risk ratios outside the replay and the card's summary (decision 7 names the summary). Convention C3 outside the replay (W58). A top-edge tag for an off-scale Max reward. Refining the odds with volatility (stage B, section 10). A real touch device (emulated only). Listed in section 11. | Each is a change no decision asks for. |
| P153 | **The shell's standing warnings while the overlay is open** (full reading). Decision 3's overlay covers the whole page. The shell shows, above or beside every screen: the storage-protection warning, the update-available notice, the read-only banner, and the "updated in another tab" and "replaced by a Restore" banners. The specs say the first is kept visible (UI contract, delivery contract, AC-DEL-004) and that the trader is told of the others (AC-DEL-002, AC-DEL-005). A whole-page modal covers them and makes them inert while it is open. (Open question 5, **answered 2026-11-18: (b)**.) | **They stay in place, underneath the overlay** (the user's words: "keep them in place, but underneath the replay overlay (it is an overlay)"). The overlay covers them while it is open; they are never dismissed or changed, and they are there again the moment it closes. The overlay is read-only, so nothing can be saved while one is covered. A note in the UI contract records the reading: a warning covered by a read-only overlay is still kept, not dismissed. | Above the overlay, with the storage icon in its header (the drafting recommendation); only the storage icon in the header. |

### 1.2 Amendments to other plan sections and specs (proposed; applied when the breakdown is agreed)

The main session applies these in the revision that agrees the breakdown. Nothing here is applied by drafting. The spec text is open question 1.

- **Implementation plan.** A definition "D9A-R — D9 Stage A Refactor" after D9's: the replay as an overlay, the readout grid, the Plan beside what happened, the estimated odds, session cards, and one name per figure; run after D9's stage A and before its stage B; 24 tasks, lanes with at most 4 agents; a light gate with no benchmark (A285). The deliverable summary gains its row. D9's definition line "in the Daily Review card, just before the Action, and in Trade Detail" gains "(D9A-R: both open the replay as an overlay)".
- **`specs/glossary.md`**, under "Risk, reward, and outcome language", one term:
  - **No-Edge Odds**: the chance of reaching the headline Target before the headline Stop if price moved with no edge and no time limit: Ongoing Risk to Stop divided by the sum of Ongoing Risk to Stop and Incremental Reward to Target. It is also the chance a trader would need for the trade-off from here to break even. It is always worded as an estimate, is exact arithmetic on two exact figures, and is never an input to another calculation. Added by plan decision 118. Avoid: probability of profit, win rate, forecast.
- **`specs/glossary.md`**, the permitted compact labels gain six rows: "Current Risk · At Stop" for Ongoing Risk to Stop; "Current Risk · At Worst case" for Worst-Case Ongoing Risk; "Remaining Reward · At Target" for Incremental Reward to Target; "Remaining Reward · At Max reward" for Maximum Incremental Reward; "Past the Stop by" for Stop Overrun; "Past the Target by" for Target Overrun.
- **`specs/design/trade-analysis.md`.**
  - `evaluate`'s list gains: "the No-Edge Odds from here and the Plan's own, and whether the structural extremes are the Trade's main risk (plan decision 118)".
  - `replay`'s paragraph gains: "It also returns the Plan's terms as confirmed, each fill's price measured against the Plan's entry, Stop or Target, and each Stop's and Target's first crossing, marked first seen after a gap (plan decision 118)."
- **`specs/design/trade-views-and-reporting.md`**, the last invariant gains: "The No-Edge Odds are arithmetic on the reward-to-risk ratio, labelled an estimate, and not a prediction about a Trade."
- **The UI contract**, beside its sentence that the UI "keeps a visible warning" when storage is not Protected: "A read-only overlay, such as the Replay, may cover the shell's warnings and banners while it is open; they stay in place, unchanged, and are not dismissed (plan decision 118, open question 5)."
- **Spec map.** The glossary's and Trade Analysis's line ranges and character counts are recalculated, as revision 106 did, and the reading lists regenerated with `.claude/scripts/spec-reading-lists.py`. No tag is added (A284).
- **Acceptance matrix.** The rows of section 13.
- **D9's breakdown.** The edits of section 10.
- **D08P and D8R breakdowns.** The note under each status line that names D9's change to W1 gains: "D9A-R (decision 118): Replay is a button beside the drawers, not a drawer; the drawers are D8R's six again."
- **`.claude/scripts/status.sh`:** T9AR.1.

### 1.3 Working assumptions

Implementation-level choices. They stand unless you object.

| # | Assumption |
|---|---|
| A266 | **Scope.** What the app holds today, as A247: stock, a long Call, a long Put and a Cash-Secured Put. Persistence, Market Data, Trade Record, Journal, the Reference Catalog and Trade Workflows are not touched. |
| A267 | **The estimated odds** (`evaluate`, T9AR.3; decision 4). `TradeEvaluation` gains `rewardRiskOdds`, a Calculation Result holding `targetFirst` and `stopFirst` (exact fractions: the Risk to stop over the sum of the Risk to stop and the Reward to target, and the rest) and `percent`, the same pair as whole percents. The Target's percent is rounded with a half going up, and the Stop's is the remainder to 100, so the pair always adds to 100 and no screen rounds twice. It is a Value exactly when `rewardRiskNow` is one; otherwise it carries `rewardRiskNow`'s own result. `TradeEvaluation` also gains `planOdds`, the same from 1R and the Original Planned Reward, which never changes. Both are exact; what is estimated is reading them as a chance, so screens say "about". A session's figures carry `rewardRiskOdds`, and the replay's Plan column carries the Plan's. |
| A268 | **The extremes' weight** (`evaluate`, T9AR.3; decision 6). `TradeEvaluation` gains `extremes`: `Main` when the Plan holds a short option leg, where the Worst case is the main risk; `Remote` for stock and long options. It is fixed for the Trade's life and is carried in each session's figures. A screen shown an evaluation without the field treats it as `Main`, so nothing is dimmed by mistake. The rule is for the four single-leg Strategies the app holds (A266). It is not carried to a multi-leg Strategy as it stands: a Covered Call has a short option leg and its Worst case is still the stock's; D10 decides each multi-leg shape's weight (full reading: the Reference Catalog's eleven Strategy shapes). |
| A269 | **The Plan's terms** (`replay`, T9AR.4; decision 2). The Plan column gains `terms`: each Planned Leg's Instrument, side, quantity and intended entry price, and each original Stop and Target with what its price is a price of (the Underlying or the option) and the price. They are the confirmed Plan's facts; later fills never change them, and a Management Revision (D17) will not either. It also gains `odds` (A267). **Every Stop and Target is listed, not only the headline one** (full reading): Trade Analysis says "Underlying-price and structure-value conditions remain independently visible even when a headline nearest boundary is available", and an option Plan can hold a Stop on the option's price and another on the Underlying's. Each listed condition carries its own planned result, from the Plan Baseline's per-condition basis, so the Plan block's "P&L if hit" is that condition's and not the headline's. |
| A270 | **Each fill against the Plan** (`replay`, T9AR.4; decision 2). A marker's fill gains `againstPlan`: the line it is measured against (`Entry`, `Stop` or `Target`), where the fill's price lies (`At`, `Above` or `Below`), and the distance in price. A fill that opens or adds is measured against its Planned Leg's intended entry. A fill that reduces or closes is measured against the Plan's conditions that are prices of the fill's own Instrument: against the Stop when the fill is at or beyond it, otherwise against the Target. With several conditions of one role on that price, the nearest to the fill is used. It is absent for an Expiration, which has no price, and when the Plan has no such condition (a Cash-Secured Put's Stop is a price of the Underlying, so a buyback is measured against the Target). It states a line, a side and a distance, never whether the fill was good or bad: the specs allow no automated judgment (the Process Scorecard's rule), and the screen's words follow (full reading). It reads the effective corrected facts, so a Replace or a Void of an Execution restates it. An Assignment's or an Exercise's Settlement Price is not measured here; those settlements arrive in a later deliverable, which decides. |
| A271 | **First crossings** (`replay`, T9AR.5; decision 2). Each session gains `crossings`, with a Stop part and a Target part. A role is crossed in a session when any of its conditions reads Breached or Reached there, by the condition's own reading or, while only the contract's Mark is missing, by its Underlying reading (A110). `first` is the earliest session with the role crossed, and stays on every later session. `since` is the start of the unbroken crossed run that holds this session, and is absent when the role is not crossed now. A session with no reading neither starts nor ends a run, as the Trade Analysis spec says of Stop Discipline episodes. Each date carries `afterGap`, true when the session before it had no reading for the role: the screen then says "first seen" and never names an earlier date. Passing a Stop's planned dollar amount without the condition crossed (A249's `crossed: false`) is not a crossing. D12's Stop Discipline episodes are the same runs and will reuse this. **From the full reading:** (1) the crossings are kept for each condition as well as for its role, since every condition keeps its own status under OR semantics (AC-CALC-003); the role's first crossing is the earliest of its conditions', and the screen's approved words (W64) name the role; (2) a crossing follows the status `evaluate` returns, so when Daily Bars arrive (D11) a same-date high or low proves one with no change here, and a session with no evidence still "proves neither breach, recovery, nor new extreme" (Market Data, AC-MARK-006); (3) a condition replaced or retired by a Management Revision ends its run, as the Trade Analysis spec says; no Trade can have one before D17, which adds the case; (4) the Process Scorecard's Stop and Target episodes (AC-RPT-004: "continuous episodes count once", "gaps cannot prove no episode") are these runs too. |
| A272 | **The views** (T9AR.6). `replayView` already spreads each replayed session and passes the Plan column whole, so the new fields reach `replayTrade` and the Review card's replay with no new code; the view types gain them. `DailyTradeReview.evaluation` is `evaluate`'s result, so the card's summary gets the odds and the weight the same way. `replayTrade` gains the capability variants `PlanComparison` and `Odds`, and `getTrade` gains `Odds`; the Trade Detail and Review routes require them. No operation is added. |
| A273 | **The overlay** (T9AR.7; decision 3). `ReplayOverlay` in `src/ui/cockpit/replay/overlay.tsx`, a presentational component with plain props (A216). It is a modal dialog named "Replay, BREN", drawn over the whole viewport, the sidebar and the bottom navigation included; the page behind is inert. Focus moves into it on open, Tab stays inside, Escape and Close call `onClose`, and focus returns to the control that opened it. Whether it is a native dialog element or an element with the dialog role is the task's choice; the cases hold either way. A modal is one of the containers the UI contract allows. The page under it keeps its own layout, which still switches between the sidebar and the bottom navigation on a live resize (AC-UI-001), and the overlay, its session and any unsaved form under it survive the resize; B9AR.7 checks the page after Close at the new width (full reading). What the overlay does with the shell's notices is P153. |
| A274 | **The address** (T9AR.8, T9AR.9; amends A257). The overlay is open while the address holds `replay=open`: `/trades/<id>?replay=open&session=2026-11-12`, and `/review?trade=<id>&panel=Action&replay=open&session=2026-11-12`. Opening pushes one history entry. Close and Escape go back one entry when this visit pushed it, and otherwise replace the address without `replay` (a reload, or a link straight into the overlay). The slider's session stays component state; `session` names the session to open on. The Review's "Price History" link is unchanged (`drawer=price-history`, the session, `from=review`), and "Back to the Review" returns to the card with `replay=open` and the session, so the trader lands where they left. `drawer=replay` names no drawer any more and is ignored, as any unknown drawer name is. |
| A275 | **The layout inside the overlay** (T9AR.7, T9AR.10). On a wide screen: the header across the top; under it the charts on the left and the readout on the right; under both, the Plan block and the session cards across the full width. On a phone: one column, the overlay filling the screen. The areas are placed by the overlay's stylesheet, so the frame's own markup does not change for it. The charts are drawn at their box's own width at every size, as they already are on a phone, so their text keeps its size on a wide screen. |
| A276 | **The reveal rule** (P145). The frame still passes only the sessions up to the slider's to the plot, and now to the cards. The header's P&L is the latest session's, by decision 3. The Plan block holds nothing of any session. |
| A277 | **Session cards** (T9AR.17; decision 5). `SessionCards` in `src/ui/cockpit/replay/session-cards.tsx`, with its adapter `cards.props.ts`. Newest first. Paging is the Journal's: ‹ "Newer sessions" and › "Earlier sessions", cards outside the page hidden, and focus handed to the other button at either end (tech debt item 24's fix). That paging is taken out of `journal-cards.tsx` into a shared `src/ui/cockpit/card-pager.tsx`, with the Journal's own tests passing unchanged. A page holds as many cards as fit side by side, found from the carousel's own width as the plot finds its width, and at least one. Each card's heading is a button named by its session; pressing it moves the slider. The slider's card carries `aria-current`. The charts are described by the cards' list, as they were by the table. The title "Session by session" stays as the carousel's heading. |
| A278 | **The readout's stake grid** (T9AR.13; suggestion 1). A real table inside the "At stake from here, whole Position" group: row groups "Current Risk" and "Remaining Reward", columns "From here", "R" and "P&L if hit", one figure to a cell, each cell unbreakable. Past a line, one row stands above the two headings and the row whose amount would be zero is left out. The group takes the readout's full width. Its figures are right-aligned in tabular numerals, as the UI contract's visual language asks of Money, ratios and counts (full reading). |
| A279 | **The "since" line** (T9AR.13, T9AR.21; decision 8). The adapter stops passing a change on the stake rows. `riskChange` and `rewardChange` then have no reader and are removed from Trade Analysis and the view types. No frozen fixture holds them (section 1.5). |
| A280 | **The chart's labels** (T9AR.10, T9AR.11, T9AR.12). A line is drawn with its label or not at all, break-even excepted, which the key names. The cursor's column is held free: no level label is placed over it. On a phone the drawing keeps its title, its axis figures and the slider's value; every other label goes to a strip of text under the drawing, which also lists any label the drawing left out. A256's rule stays: the axis is sized from the Plan's anchors and the revealed sessions, so an off-scale Worst case is tagged at the bottom edge and never stretches it. |
| A281 | **A session with no Mark** (T9AR.16, T9AR.13, T9AR.11, T9AR.17). The line "No Mark for the put on Tue Nov 10." is worded in `src/ui/calculation-words.ts`, the one module allowed to word a reason (the wording rule), as a new form of the Mark-missing reason. Other reasons keep their words at the same normal size. "Add the Mark" links to the Review's Marks row for that Instrument (`/review?trade=<id>&instrument=<key>`, the link Needs you already uses) and shows only while the Trade is Open. Each row or cell that needs the Mark shows a dash with the accessible name "No Mark", as Price History does. **A Mark the trader acknowledged as unavailable is not worded as a missing one** (full reading: the UI contract says "Acknowledged Unavailable is visibly a trader acknowledgment, not a price", and AC-UI-002 that the states "are not conflated"). Its top line keeps the acknowledgment's own words from `calculation-words.ts`, at the same normal size; its rows show the same dash; and "Add the Mark" still shows, since an acknowledged key stays open to a later Mark (Market Data). The link shows under the same conditions as Needs you's link to that row, and no others. |
| A282 | **The Review card** (T9AR.9; decision 3). The card's "Replay" button sits where the inline replay sat, directly above the Action form. The overlay draws `getTrade`'s replay, which already ends at the Review Date (A254); nothing new is read. The Review stays mounted while the overlay is open, so an Action form's unsaved choice and Intent survive; the task proves it. A card that only owes reflections, or whose facts cannot be replayed, has no button. |
| A283 | **Durable compatibility.** No schema, store, seed, migration or backup-version change. Every new view field is additive, and `compareSnapshot` compares only the keys a frozen snapshot holds, so the eight fixtures whose expected views hold `TradeEvaluation` objects are not affected. The one removal is A279's two fields, which no fixture holds. No previous-release harness task, upgrade case or critic update flow is added, as the drafting guide rules until tech debt item 10 is resolved (decision 76). |
| A284 | **Reading list.** No spec-map retag: a `D9A-R` tag would break `spec-reading-lists.py`'s `int(d[1:])`, as A218 and A244 found for D08P and D8R. The implementing session reads `plan/spec-reading/D09.md`, which already covers Trade Analysis's `evaluate` and `replay`, Trade Views' `replayTrade`, Daily Review's `getTrade`, the UI contract and the glossary. It adds one entry by hand: AC-REV-003 (`specs/acceptance/acceptance-contract.md`, lines 238 to 244), for T9AR.9. AC-JOUR-001 (only Save captures evidence), which T9AR.9 also answers to, is already in D9's list (lines 173 to 179). T9AR.7's brief also names AC-DEL-002 (lines 462 to 468), which D9's list leaves out, for its banner case; AC-DEL-004 is in it (full reading). |
| A285 | **No benchmark.** D9's A265 stands: the benchmark runs once, after D9's stage C. D9A-R changes neither the cold start nor the Open list, and I9AR.4 proves the replay's reads are unchanged. |
| A286 | **The adapter is split before the lanes start** (T9AR.2). `replay.props.ts` keeps the assembly; the session's words, the stake sentence, the readout and the plot's props move to `session-words.props.ts`, `stake-words.props.ts`, `readout.props.ts` and `plot.props.ts`; the readout's markup moves from `frame.tsx` to `readout.tsx`; its rules move from `replay-frame.css` to `replay-readout.css`. The cases move with their code and none changes. This gives each lane its own files; run one task at a time, it is still a tidier adapter than one file of 500 lines that every task edits. |
| A287 | **The full terms stay in accessibility text** (full reading; T9AR.13, T9AR.17, T9AR.20). The glossary allows a compact label only while "the full term remains available in help and accessibility text". Today the canonical terms "Ongoing Risk to Stop", "Worst-Case Ongoing Risk" and "Incremental Reward to Target" are on screen in one place, the Review card's summary, which decision 7 renames. So each stake row, in the readout, on a session card and on the Review card's summary, carries its canonical term as its accessible description and hover title: "Ongoing Risk to Stop" for At Stop, "Worst-Case Ongoing Risk" for At Worst case, "Incremental Reward to Target" for At Target, "Maximum Incremental Reward" for At Max reward, "Stop Overrun" and "Target Overrun" for the past-a-line row. These are the glossary's own terms, not new screen words, and nothing visible is added. |

### 1.4 Size check

The graph has **24 tasks** and **four open questions**. There is no schema change (A283). None of the guide's three limits is met, so **no split is proposed** and no checkpoint critic is added.

Two things keep it near the limit, and are worth knowing before agreeing:
- **If open question 2 is answered "bridge the gap"**, T9AR.11 gains one case and the spec amendment gains two sentences. The task count does not change.
- **If the user would rather see the overlay before the rest is built**, the natural pause is after T9AR.9 merges: the replay then opens over the whole page from both places, with stage A's content inside it. That is a pause for a look, not a gate.

**After the full reading.** Open question 5 makes five questions raised in all. Four are answered and one is open, so the guide's limit (five or more left at drafting) is still not met, and the task count is unchanged at 24: the reading added cases and checks to existing tasks, and no task.

### 1.5 Lookups (drafting guide)

Run on `bbc3ae28`. The commands and their full output are in the appendix; this section says what each hit means. A count is the number of matching lines in that file.

**Texts.** Each changing text, the test files that assert it, and the task that changes those lines. "Stays" marks a hit that is another screen's or the domain's own word.

| Text that changes | Test files that assert it (lines) | Task |
|---|---|---|
| The drawers per state, naming Replay | `src/ui/screens/trade-detail/drawer-request.ts:3`; `Cockpit.test.tsx` (lines 30, 40, 89, 104, 163, 170, 171, 185); `e2e/support/detail/index.ts:14,16`; `e2e/d8p/cockpit.spec.ts:11,81`; `e2e/d8p/states.spec.ts:11,46,67,111,132,152`; `e2e/d8p/responsive-a11y.spec.ts:11,133,134`; `e2e/d8r/support.ts:21`; `e2e/d8r/states.spec.ts:12,60,82` | T9AR.8 |
| Opening the replay as a drawer: `openDrawer(page, 'Replay')`, `#drawer-panel-replay`, `drawer=replay` | `e2e/d9/support.ts` (2); `e2e/d9/gaps.spec.ts` (3); `e2e/d9/replay.spec.ts` (5); `e2e/d9/responsive-a11y.spec.ts` (10); `e2e/d9/review.spec.ts` (5); `e2e/d9/states.spec.ts` (5); `src/ui/screens/TradeDetail.test.tsx` (`drawer=replay`, 7) | T9AR.8 |
| The Review card's inline replay: `section.review-card-replay`, `cardReplay(` , the "Replay" section | `e2e/d9/support.ts` (1); `e2e/d9/review.spec.ts` (2); `e2e/d9/responsive-a11y.spec.ts` (1, and its four Review-card cases); `e2e/d5r/durability.spec.ts:98`; `src/ui/screens/ReviewCard.test.tsx` (7); `src/ui/app.css:952,955` | T9AR.9 |
| The stake rows as "amount · R · P&L result" in one cell, and `readoutPnl` | `e2e/d9/support.ts` (1, the helper); `e2e/d9/gaps.spec.ts` (5); `e2e/d9/replay.spec.ts` (6); `src/ui/cockpit/replay/frame.test.tsx` (5); `src/ui/cockpit/replay/replay.props.test.ts` (4) | T9AR.13 |
| "Stop Overrun", "Target Overrun" as readout rows | `e2e/d9/gaps.spec.ts` (2); `e2e/d9/replay.spec.ts` (2); `e2e/d9/support.ts` (1, a comment); `frame.test.tsx` (3); `replay.props.test.ts` (6). **Stays:** `e2e/d4/breach-overrun.spec.ts`, `src/domain/trade-analysis/evaluate.test.ts`, `evaluate-option.test.ts`, `outcomes.test.ts` (the canonical term on other screens and in the domain). | T9AR.13 |
| "Past Stop's amount", "Past Target's amount", and the Reward to risk values "Stop breached", "Target reached", "Not triggered" | `replay.props.test.ts` (1, 1, 2, and the row's share of its 20 "Stop breached or Target reached" lines); `e2e/d9/gaps.spec.ts`, `e2e/d9/replay.spec.ts`, `e2e/d9/states.spec.ts` (the row's lines only). **Stays:** the headline's "Stop breached: …" and "Target reached…" (W37), and every hit outside `e2e/d9` and `src/ui/cockpit/replay`. | T9AR.13 |
| The change line under a stake row ("… since Fri Nov 13" under At Stop or At Target) | `frame.test.tsx` (6, of which the stake rows'); `replay.props.test.ts` (5, of which the stake rows'); `e2e/d9/gaps.spec.ts` (2) | T9AR.13 |
| "Banked" for a loss | `e2e/d9/gaps.spec.ts:54` (`readoutValue(scope, 'Banked')` reading "−$440.00"). No unit case asserts "Banked −". | T9AR.14 |
| An Underlying's Mark with no "$" in the replay ("BREN Mark" 97.20, the hover's "BREN Mark: 101.80") | `e2e/d9/gaps.spec.ts` (1); `e2e/d9/replay.spec.ts` (1); `corridor.test.tsx` (1, and 3 hover lines); `frame.test.tsx` (8, and 1 hover line); `price-strip.test.tsx` (2); `replay.props.test.ts` (8, and 4 hover lines) | T9AR.14 |
| Ratios without two decimals ("2 to 1", "0.1 to 1") | `e2e/d9/replay.spec.ts` (3); `replay.props.test.ts` (3). **Stays:** `src/domain/trade-analysis/evaluate-trigger.test.ts`, `replay-series.test.ts`, `tests/integration/d8r/detail.test.ts` (test titles and another screen). | T9AR.14 |
| The stake sentence and the Reward to risk row without odds ("… to 1 (the Plan was …)", "(Plan 2.95 to 1)") | `e2e/d9/replay.spec.ts` (2); `replay.props.test.ts` (3). **Stays:** `src/ui/cockpit/journal-cards.props.test.tsx` (another screen's "the Plan was"), `e2e/support/detail/plan.ts`. | T9AR.15 |
| The headline on a session with no Mark ("Mark missing: CORV Nov 20 $80 Put, Tue Nov 10", "No Mark.") | `replay.props.test.ts` (2 of "Mark missing"); `e2e/d9/gaps.spec.ts` (2); `e2e/d9/states.spec.ts` (1). **Stays:** every other "Mark missing" hit (40 files): other screens word the reason as before. | T9AR.16 |
| "No Mark" as a readout or table value | `frame.test.tsx` (5); `replay.props.test.ts` (12); `e2e/d9/gaps.spec.ts` (8); `e2e/d9/states.spec.ts` (1). **Stays:** `price-strip.test.tsx` (2, the chart's label), and Price History's, Today's and the Journal's. | T9AR.13 (readout), T9AR.17 (cards) |
| The hover box under the charts (`replay-hover`, the `hover` test id) | `frame.test.tsx` (3) | T9AR.16 |
| "Session by session" as a table: `openTable`, `tableRow(`, `replay-table`, the columns "Current Risk at Stop", "P&L at Stop" and the rest | `e2e/d9/support.ts` (1 and the two helpers); `e2e/d9/gaps.spec.ts` (8); `e2e/d9/replay.spec.ts` (7, and 3 of the columns); `e2e/d9/states.spec.ts` (5); `frame.test.tsx` (5 of the title, 5 of `replay-table`); `replay.props.test.ts` (2 of the title, 10 of the columns, 1 of `replay-table`); `corridor.test.tsx` (1) and `price-strip.test.tsx` (3), the `describedBy` id | T9AR.17 |
| The readout's Plan group: "At the Stop", "At the Target" | `frame.test.tsx` (1); `replay.props.test.ts` (2) | T9AR.18 |
| The P&L chart's long title ("… dollars for the whole Position …") | `e2e/d9/replay.spec.ts` (1); `e2e/d9/responsive-a11y.spec.ts` (1); `replay.props.test.ts` (1) | T9AR.10 |
| The time axis's end label (`axis-end`, `endLabel`) | `corridor.test.tsx` (1); `frame.test.tsx` (1); `price-strip.test.tsx` (4); `replay.props.test.ts` (2) | T9AR.10 |
| "Break-even" as a label on the line | `e2e/d9/replay.spec.ts` (1); `e2e/d9/responsive-a11y.spec.ts` (2); `corridor.test.tsx` (1) | T9AR.11 |
| The phone's labels on the drawing ("Risk $672", "Reward $928", "Sold 2", "Stop +$316" in the chart's text) | `e2e/d9/responsive-a11y.spec.ts` (`expectPhoneWords` and the "labels no phone chart may lose" line); `e2e/d9/replay.spec.ts` (2); `corridor.test.tsx` (8); `replay.props.test.ts` (4) | T9AR.12 |
| The Review card's summary: "Ongoing Risk to Stop", "Worst-Case Ongoing Risk", "Incremental Reward to Target", "Reward : risk now", "Reward : risk planned" | `src/ui/screens/CardFigures.test.tsx` (4, 3, 3, 5, 3); `src/ui/screens/ReviewCard.test.tsx` (6, 4, 4); `e2e/d4/review.spec.ts:47,48,49`; `e2e/d5r/review.spec.ts:28`; `e2e/d7sp/review-dated-line.spec.ts:33`. **Stays (checked line by line, as decision 7 asked):** `src/coordinators/daily-review/daily-review.test.ts`, `save-marks.test.ts`, `src/coordinators/trade-views/current-evaluation.test.ts`, `src/domain/trade-analysis/evaluate.test.ts`, `evaluate-conditions.test.ts`, `tests/integration/d5r/range-and-baseline.test.ts` (test titles naming the canonical figure), and `evaluate.ts:160`, `capabilities.ts:99`, `CardFigures.tsx:67` (comments). No field is renamed. | T9AR.20 |
| "Current Marked Trade P&L" on the card's summary (W70, if approved) | `CardFigures.test.tsx` (5); `ReviewCard.test.tsx` (5); `ReviewCards.test.tsx` (2); `e2e/d4/review.spec.ts` (1); `e2e/d5r/review.spec.ts` (1); `e2e/d7sp/review-dated-line.spec.ts` (1). **Stays:** `today.props.test.ts`, `pnl.props.test.tsx`, `CardMarks.test.tsx`, `TradeDetail.test.tsx`, `TradeList.test.tsx` (other screens). | T9AR.20 |

**Shapes.**
- **Added, all additive:** `rewardRiskOdds`, `planOdds` and `extremes` on `TradeEvaluation` and on a session's figures (T9AR.3); `terms` and `odds` on the Plan column and `againstPlan` on a marker's fill (T9AR.4); `crossings` on a replayed session (T9AR.5).
- **Frozen fixtures.** `grep -rlE 'riskChange|rewardChange|planColumn|positionChangeIds|"markers"' tests/fixtures bench tools` finds nothing: no fixture and no `verify:*` tool holds a replay view. Eight fixtures' `expected-views.json` hold `TradeEvaluation` objects (they hold `rewardRiskNow`: 9, 11, 26, 31, 34, 26, 31 and 34 times). `tools/fixtures/snapshot-compare.ts` walks only the snapshot's own keys, so added fields break none. T9AR.3 and T9AR.6 run `npm run verify:fixtures` to show it.
- **Removed (T9AR.21):** `riskChange` and `rewardChange`. Hits: `src/domain/trade-analysis/replay-series.ts` (6), `replay-series.test.ts` (5), `src/coordinators/trade-views/replay-view.ts` (2), `replay-trade.test.ts` (1), `src/ui/cockpit/replay/replay.props.ts` (2), `replay.props.test.ts` (2), `tests/integration/d9/gaps.test.ts` (10). None in `tools`, `e2e`, `.claude`, `bench` or `tests/fixtures`.
- **Stores and schema:** unchanged.

**Checks.**
- **`status.sh D09A-R`** (T9AR.1). A throwaway run on the current tree: `.claude/scripts/full-suite.sh --current-folder evidence/D09AR` prints `e2e/d9ar`; the same query with `evidence/D09A-R` exits 2 ("cannot derive an e2e folder"). So the evidence folder must be `D09AR`, and `status.sh D09A-R`, which finds this breakdown by its file name, then looks for `evidence/D09A-R/DECISIONS-PENDING.md` and reports "no decisions file". That one line is what T9AR.1 changes.
- **The browser folder.** `test:e2e:3` runs `e2e/d8p e2e/d8 e2e/d9`. Playwright matches a folder argument as a pattern, so `e2e/d9` also runs `e2e/d9ar`, as `e2e/d8` runs `e2e/d8r` (T9.1's note). No package change; T9AR.23 proves it with `npx playwright test --list e2e/d9`.
- **The cockpit stylesheet check** (`tools/cockpit-styles.test.ts`): every file under `src/ui/cockpit/styles/` must be imported from `src/ui/cockpit/index.css`. Current hits: none. T9AR.2 adds the three new files and their three import lines together.
- **The cockpit import rule** (`eslint.cockpit.config.js`): only a `*.props.ts` file under `src/ui/cockpit/` may import `app/types` or a coordinator. Current hits: none. The four new adapters are `*.props.ts`; the overlay and the cards take plain props.
- **The wording rule** (`eslint.wording.config.js`): no file under `src/ui/` but `calculation-words.ts` may hold a reason's words or branch on a reason code. Checked against section 1.6: no proposed text holds a guarded phrase, and "No Mark for the put on Tue Nov 10." is worded inside `calculation-words.ts` (A281). `'Mark missing'` is guarded, which is why the new line is not built in the adapter.
- **New browser measurements** (T9AR.23): a figure never breaks across lines; no chart label lies in the cursor's column; the chart's width at 1280, 1440 and 1920. Drafting may not start a browser, so no throwaway run was made. Their hits on the current build are the coach's own measurements: figures broken across lines in `d-corv-s10.png`, `d-bren-s00.png`, `d-axio-s05.png` and `p-daleloss-s05.png`; the cursor through the labels in `d-bren-s00.png`, `d-axio-s00.png` and `d-daleloss-s00.png`; a chart 553 pixels wide at 1280, 1440 and 1920. Each is expected to fail before its task and pass after.
- **The UI's "no arithmetic" rule** stays a review point, as in D9. The briefs for T9AR.13, T9AR.15, T9AR.17, T9AR.18 and T9AR.20 say so: the adapter formats and selects; a dollar figure, a percent or a distance is never worked out in `src/ui/`.

**Names.**
- **`DRAWERS` and the drawer name `'Replay'`** (T9AR.8): `src/ui/screens/trade-detail/drawer-request.ts` (3), `Cockpit.tsx` (2), and the readers in the Texts table's first row; `e2e/d8p/responsive-a11y.spec.ts` (2), `e2e/d8r/responsive-a11y.spec.ts` (2), `e2e/d8r/states.spec.ts` (2), `e2e/d8r/support.ts` (1). The other `'Replay'` hits stay: `src/app/routes.ts`, `capabilities.ts`, `workspace.test.ts`, `tests/integration/d9/capabilities.test.ts` (the `Replay` capability variant), and `src/modules/market-data/*` and `tests/integration/d4/responses.test.ts` (an unrelated word).
- **`ReplayDrawer`** (`src/ui/cockpit/drawers/replay.tsx`): imported by `Cockpit.tsx` and `ReviewCard.tsx`, with its test. It keeps its name and file; it is what the overlay shows. No case needs it renamed.
- **`tableRow`, `tableColumns`, `tableTitle`, `TableRow`** (T9AR.17): `replay.types.ts` (5), `replay.props.ts` (5), `frame.tsx` (7), `frame.test.tsx` (6), `replay.props.test.ts` (10), `e2e/d9/support.ts` (1), `e2e/d9/gaps.spec.ts` (6), `e2e/d9/replay.spec.ts` (4), `e2e/d9/states.spec.ts` (3). The hits in `src/domain/session-policy/` and `tests/integration/d4/policy-revision.test.ts` are an unrelated `tableRow` and stay.
- **`replay-table`** (the class and the `describedBy` id, T9AR.17): `frame.tsx` (3), `replay.props.ts` (1), `replay-frame.css` (10), and the tests in the Texts table.
- **`review-card-replay`** (T9AR.9): `ReviewCard.tsx` (1), `src/ui/app.css` (2), and the tests in the Texts table.
- **`pnlShortTitle`** (T9AR.10): `replay.types.ts`, `replay.props.ts`, `corridor-pnl.tsx`, `corridor.test.tsx` (2), `replay.props.test.ts`. With one title at every width the short form has no reader and is removed; `priceShortTitle` stays.
- **`status.sh`** (T9AR.1): `.claude/scripts/status.sh` (5), `status.test.sh` (2), `.claude/docs/implementing.md` (2, how it is called; unchanged).
- **The Journal's paging** (`PAGE_SIZE`, "Newer sessions", "Earlier sessions"; T9AR.17's refactor step): `src/ui/cockpit/journal-cards.tsx` (7) and its props test (6). The other hits are Price History's and the Review's own paging and stay.

### 1.6 Words

**Approved already, by the decisions.** Not proposed again: "Replay" on the button in both places and "Close" in the overlay (decision 3); "11.69 to 1 · about 8% : 92% (the Plan was 0.29 to 1 · 78% : 22%)" in the "From here" sentence and the Reward to risk row (decision 4); the session's date as each card's label, "Thu Nov 12" (decision 5); "Current Risk · At Stop", "Current Risk · At Worst case", "Remaining Reward · At Target" and "Reward to risk" on the Review card's summary (decision 7); "down $150.00 since Fri Nov 13" and "up $60.00 since Fri Nov 13" (decision 8); the headings "Current Risk" and "Remaining Reward" and the rows "At Stop", "At Worst case", "At Target", "At Max reward" (the user's own, 2026-11-18, in `evidence/D09/words-changed.md`); "Trade P&L" as the P&L chart's title at every width (decision 6, under P137).

**Proposed, for the user's approval** (open question 4). Each is short on purpose. Figures are the test Trades' own (D9's section 5). A task may shorten any of them under P137.

| # | Where | Proposed words | Replaces |
|---|---|---|---|
| W53 | The overlay's header, and its accessible name | "BREN · Trade P&L +$988.00". A finished Trade: "BREN · Final result +$1,138.00". With no Mark at the latest session: "CORV" alone. The dialog is named "Replay, BREN". | New (W35 named the drawer). |
| W54 | Trade Detail's drawers per state | Open, Settlement Due and Closed: Today, Position, Plan and Risk, Price History, Journal, Payoff, and the "Replay" button beside them. Planned and records-disagree: unchanged, with no button. | W1 as D9 amended it. |
| W55 | The readout grid's column headings | "From here", "R", "P&L if hit". R-BREN-U, Wed Nov 11: At Stop $844.00, 2.60R, −$324.00; At Worst case $1,164.00, 3.59R, −$644.00; At Target $436.00, 1.35R, +$956.00; At Max reward "No cap above". | The inline "· P&L −$324.00" of each stake row. |
| W56 | The one row for a Trade past a line, above the two headings | "Past the Stop by $300.00 (0.50R) · at Stop −$740.00" (R-AXIO-D, Mon Nov 16). "Past the Target by $32.00 (0.10R) · at Target +$956.00" (R-BREN-U, Mon Nov 16). Planned amount passed, condition not crossed: "Past the Stop's amount by $9.00 (0.01R) · at Stop −$1,263.00" (R-DALE-D, Thu Nov 12). No "Reward to risk" row when there is no ratio. The Review card's summary uses the first part: "Past the Stop by $300.00 (0.50R)". | W43's "Stop Overrun" and "Target Overrun" rows; the provisional "Past Stop's amount" and "Past Target's amount"; the Reward to risk values "Stop breached", "Target reached" and "Not triggered". |
| W57 | A realized loss, in the readout and on a card | "Realized −$440.00" (R-AXIO-D), where a gain reads "Banked +$478.00". On a final session: "−$440.00 of the result was realized before the end." | W43's "Banked" for a loss; W38's final sentence for a loss. |
| W58 | Every price in the replay | A dollar sign on each: "BREN Mark $104.00"; the hover's "BREN Mark: $101.80"; "DALE at or below $54.00". Convention C3 (an Underlying's price without "$" on an option Trade) no longer holds inside the replay; other screens keep it. | T9.14's provisional bare Underlying price. |
| W59 | Every reward-to-risk ratio in the replay and on the Review card's summary | Two decimals always: "2.00 to 1", "0.10 to 1", "11.69 to 1". | W38's and W43's "2 to 1", "0.1 to 1". |
| W60 | The odds at the edges, and what they are | When a side is under one percent: "under 1% : over 99%", with no "about" before it. Once, under the grid: "Odds: Target first : Stop first, estimated with no edge and no time limit." A screen reader hears "about 8% chance of the Target first, 92% of the Stop first". | New. |
| W61 | The top of the replay on a session with no Mark | "No Mark for the put on Tue Nov 10." at normal size, once, with the link "Add the Mark" while the Trade is Open. A stock: "No Mark for AXIO on Tue Nov 10." Each row and cell that needs the Mark: "—" (named "No Mark" for a screen reader). | W36's reason at the figure length ("Mark missing: CORV Nov 20 $80 Put, Tue Nov 10") in the largest type; T9.9's provisional "No Mark."; "No Mark" as a row's value. |
| W62 | The Plan block, fixed above the cards, titled "The Plan" | R-BREN-U: "Entry: 4 contracts at $1.61" · "Stop: call at or below $0.80 · P&L if hit −$324.00" · "Target: call at or above $4.00 · P&L if hit +$956.00" · "Reward to risk: 2.95 to 1 · 25% : 75%". R-DALE-D: "Entry: short 6 contracts at $0.94" · "Stop: DALE at or below $54.00 · P&L if hit −$1,536.00" · "Target: put at or below $0.20 · P&L if hit +$444.00" · "0.29 to 1 · 78% : 22%". R-AXIO-D: "Entry: 200 shares at $50.00" · "Stop: AXIO at or below $47.00 · P&L if hit −$600.00" · "Target: AXIO at or above $56.00 · P&L if hit +$1,200.00" · "2.00 to 1 · 33% : 67%". | W43's "The Plan" group ("At the Stop", "At the Target"); W45's "Stop" and "Target" columns. |
| W63 | Each Execution against the Plan, in the readout's Position group and in a card's Events | "Sold 100 at $45.60, $1.40 below the Stop" (R-AXIO-D, Mon Nov 9). "Sold 2 at $4.00, at the Target" (R-BREN-U, Thu Nov 12). "Bought 100 at $51.40, $1.40 above the Plan's entry" (R-AXIO-U, Fri Nov 6). "Bought 4 at $1.61, at the Plan's entry". "Sold 2 at $4.91, $0.91 above the Target" (K-sale). "Bought 3 at $2.59, $2.39 above the Target" (R-DALE-D, Tue Nov 10). The chart's markers keep W41. | Extends W41's words where they stand in the readout and the Events. |
| W64 | A condition's first crossing | After the status line, from that session on: "Target first reached Fri Nov 6." (R-CORV-D, also on Mon Nov 9 when the put is back under its Target). "Past the Stop since Mon Nov 9." (R-AXIO-D). A Stop crossed earlier and not now: "Stop first breached Mon Nov 9." After a session with no Mark: "Target reached, first seen Fri Nov 6." and "Past the Stop, first seen Mon Nov 9." In the Events of the card of that session: "Target first reached", "Stop first breached". On the chart, a flag at that session: "Target reached", "Stop breached". | New. |
| W65 | The session cards | Title "Session by session". Paging buttons named "Newer sessions" and "Earlier sessions", as the Journal's. Each card, top to bottom: "BREN Mark", "Call Mark", "Trade P&L", "Banked" or "Realized", "Open", "Held", "At Stop", "At Worst case", "At Target", "At Max reward" (each "$672.00 · 2.07R · P&L if hit +$316.00"), "Reward to risk", "Events". | W45: the table and its columns, T9.19-B4's "Current Risk at Stop", "P&L at Stop" and the six like them included. |
| W66 | The key, one line under the charts, listing only what is drawn so far | "Mark", "Open profit", "Open loss", "Banked", "Realized loss", "Past the Stop", "Past the Target", "At Stop", "At Target", "At Worst case", "At Max reward", "At stake", "Break-even", "Execution", "Stop breached", "Target reached", "No Mark". | W44: "Result at the Stop" becomes "At Stop", "Result at the Target" becomes "At Target", "At stake from here" becomes "At stake"; the rest are added or kept. |
| W67 | The time axis | The first session's date at the left: "Mon Nov 2". On an option, at the right: "Expires Fri Nov 20". On a stock, nothing at the right. The slider's session is named under the cursor: "Thu Nov 12". | The bare end label "Fri Nov 20", and on a stock "Mon Nov 16", which named a later session early. |
| W68 | The bottom edge of the P&L chart when the Worst case is below its range | "Worst case −$33,936 ↓" (R-DALE-D, Mon Nov 9). | New. |
| W69 | The strip under the phone's P&L drawing | The drawing's labels as one line of text: "Stop +$316 · Banked +$478 · Target +$956 · Sold 2" (R-BREN-U, Thu Nov 12). On the drawing itself: the title, the axis figures and the slider's "+$982". | W40's and W41's phone labels drawn on the lines. |
| W70 | The Review card's summary, its first figure | "Trade P&L", the replay's name for it. | "Current Marked Trade P&L" on the card. Decision 7 names the other four; this one is the same rule applied to the fifth. |

### 1.7 Coverage: every suggestion and every decision

| Coach suggestion | Shaped by | Delivered by |
|---|---|---|
| 1. The readout breaks figures across lines | — | T9AR.13 (the grid); T9AR.7 (the readout's width beside the charts); checked by B9AR.3 and B9AR.7 |
| 2. The replay is 592 pixels wide on any screen | Decision 3 (an overlay, not a folded rail) | T9AR.7, T9AR.8, T9AR.9; T9AR.10 (drawn at the box's width) |
| 3. No key and no dates; an unlabelled line | — | T9AR.10 |
| 4. The ratio flatters a losing Trade | Decision 4 (keep the ratio, add the odds) | T9AR.3, T9AR.15, T9AR.20 |
| 5. The Plan beside what happened | Decision 2 | T9AR.4, T9AR.5, T9AR.6, T9AR.18, T9AR.19 |
| 6. The rows for a Trade past a line | — | T9AR.13 (readout); T9AR.17 (cards: never "$0.00"); T9AR.20 (the Review card) |
| 7. The same change shown three times | Decision 8 | T9AR.13, T9AR.21 |
| 8. Different names for one thing | Decision 7 | T9AR.14 ("Realized", "$", decimals); T9AR.18 (what each Plan price is a price of); T9AR.10 (the key's names); T9AR.20 (the card's summary) |
| 9. Phone labels pile onto the drawing | — | T9AR.12 |
| 10. The cursor runs through the entry session's labels | — | T9AR.11 |
| 11. The table is too wide | Decision 5 (cards, not a shorter table) | T9AR.17, T9AR.18 |
| 12. A session with no Mark shouts and repeats | P146 for the bridge | T9AR.16 (the line and the link); T9AR.13 and T9AR.17 (the dash); T9AR.11 (the chart) |
| 13. The chart hides how far down a Trade can go | — | T9AR.11 |
| 14. The date and the best sentence are the quietest; the hover box moves the page | — | T9AR.16 |
| 15. The extremes get the Stop's weight; the long chart title | Decision 6 | T9AR.3, T9AR.15, T9AR.11 (the tag), T9AR.20; T9AR.10 (the title) |

| Decision | Delivered by |
|---|---|
| 1. When it runs | Section 9; the gate T9AR.24; D9's Progress note in section 10 |
| 2. All 15 suggestions; suggestion 5's domain first | The table above; T9AR.4 and T9AR.5 block T9AR.18 and T9AR.19 |
| 3. The overlay | T9AR.7, T9AR.8, T9AR.9 |
| 4. Reward to risk with the estimated odds | T9AR.3, T9AR.15, T9AR.20 |
| 5. Session cards | T9AR.17, T9AR.18; the pass condition's wording in section 10 |
| 6. The extremes' weight | T9AR.3, T9AR.15, T9AR.11, T9AR.20; the title in T9AR.10 |
| 7. The Review card's summary | T9AR.20 |
| 8. The "since" line | T9AR.13, T9AR.21 |

### 1.8 Carried from D9's Stage A gate (critic-2)

D9's Stage A gate critic-2 (`evidence/D09/critic-2.md`, FAIL: 1 high, 1 moderate, 2 low) found four defects. **The user chose, 2026-11-18, to close Stage A without fixing them and to carry all four into D9A-R** (an exception to the rule that every critic defect is fixed before its gate closes, since D9A-R replaces most of what they touch). Each is a case in the task named, written red first like any other, and D9A-R's gate critic checks each again. The cases below are also in each task's own case list in section 5, under a describe block "carried from D9's Stage A gate (critic-2, section 1.8)".

| Critic-2 defect | Severity | Task | Case to add |
|---|---|---|---|
| 1a. The chart's overrun labels ("$180 past the Stop", "$32 past the Target") are not in the table, whose "Current Risk at Stop" reads "$0.00" for a Trade past its Stop | High | T9AR.17 | it should show a session past a line on its card as W56's row ("Past the Stop by $180.00 (0.30R) · at Stop −$740.00", R-AXIO-D Mon 11-09), never "$0.00" at risk |
| 1b. The price chart's "Strike $100" line is in neither the readout nor the table | High | T9AR.18 | it should show an option's strike in "The Plan" block, in W40's words ("Strike $100", R-BREN-U; "Strike $57.50", R-DALE-D), so every chart figure is also off the chart |
| 2. The minus sign wraps away from its amount ("P&L –" / "$17,463.00", DALE-D at 1280 wide) | Moderate | T9AR.13 | it should keep a signed amount on one line in every grid cell at 1280, 375 and 320 wide (R-DALE-D Fri 11-13's At Worst case; R-BREN-U Mon 11-02) |
| 3. On a stock Trade the axis end label names the last session before it is revealed ("Tue Nov 17" at "1 of 12", R-AXIO-U) | Low | T9AR.10 | it should show nothing at the right end of a stock Trade's time axis at any session (W67) |
| 4. An Expiration is labelled "Execution, Fri Nov 20" in the readout's Position group (R-DALE-U) | Low | T9AR.18 | it should name an Expiration "Expiration, Fri Nov 20" with "Expired", never "Execution" (the glossary: an Expiration is a Position Change, not an Execution) |

Critic-2's minor observations already covered by D9A-R: the bare Underlying price (W58), the ratios' decimals (W59), crowded phone labels (W69), the leftover hover box (suggestion 14), the 16-column phone table (decision 5). Not covered, for D9A-R's critic to look at again: a final session's headline drops the R ("+$1,138.00", where W36 shows "· 3.05R"); "up $0.00 since Thu Nov 19" on an expired put's final session; focus lands on `<body>` after the Review card's Price History link returns; each revealed session is its own tab stop (11 on BREN).

---

## 2. Implementation boundaries extended in D9A-R

| Canonical boundary | Code location | D9A-R |
|---|---|---|
| Trade Analysis (pure) | `src/domain/trade-analysis/` | `evaluate`: the odds, the Plan's odds, the extremes' weight (A267, A268). `replay`: the Plan's terms, fills against the Plan, first crossings (A269, A270, A271); `riskChange` and `rewardChange` removed (A279). |
| Replay assembly (shared) | `src/coordinators/replay/` | No new code: the fields pass through (A272). |
| Trade Views, Daily Review | `src/coordinators/trade-views/replay-view.ts`, `src/coordinators/daily-review/types.ts` | View types only. |
| Workspace | `src/coordinators/workspace/capabilities.ts` | Capability variants only (T9AR.6). |
| Facade | `src/app/types.ts`, `src/app/routes.ts` | Types and variants; no new operation. |
| UI | `src/ui/cockpit/replay/`, `src/ui/cockpit/card-pager.tsx`, `src/ui/screens/` | The overlay, the readout grid, the cards, the chart, the Review card's button and summary. |
| Words | `src/ui/calculation-words.ts`, `src/ui/format.ts` | The no-Mark line (A281); a two-decimal ratio. |
| Tooling | `.claude/scripts/status.sh` | The evidence folder's name (T9AR.1). |

**Which tasks change code outside `src/ui/`.** T9AR.1 (tooling), T9AR.2 (types), T9AR.3, T9AR.4, T9AR.5 (Trade Analysis), T9AR.6 (the facade and the manifest), T9AR.21 (Trade Analysis and the view types). The other behavioral tasks are UI only.

---

## 3. Wall-clock, and why lanes

On D9's basis: a behavioral task about 35 minutes in `tdd-task`, ocr about 5, a lane tier about 4, a complete run about 13 to 20 with three browser stages. Critic defects and bug tasks are left out; in D8R and in D9's stage A they about doubled the estimate.

| | One task at a time | Lanes, at most 4 agents |
|---|---|---|
| Time | about 22 hours | about 9 hours |
| Merges | none | about 20, serial on the main session |

**Recommended: lanes** (P140). The reasons:
- **Three chains share no file.** The domain (T9AR.3, T9AR.4, T9AR.5, T9AR.6), the overlay and its two screens (T9AR.7, T9AR.8, T9AR.9), and the chart's drawing (T9AR.10, T9AR.11, T9AR.12) run at once from the start.
- **The readout and the cards wait for the overlay.** They are judged inside it (the readout beside the charts, the cards under both), so their lanes start when T9AR.8 has merged.
- **Unlike stage A, the lanes edit a built screen, not doubles.** Stage A's lanes built the frame and the plot against doubles and met in T9.14, which took twelve bug and follow-up tasks. Here every lane's unit tests and its `e2e/d9` lines run against the real replay.

**The risk, and how the plan meets it.** Every lane changes lines of the same `e2e/d9` spec files. Each lane edits only the lines its row of section 1.5 lists, and the helpers in `e2e/d9/support.ts` are owned by group (section 4.2), so rebases meet in different lines. If the user prefers no merges, section 15's order runs one task at a time with nothing else changed.

---

## 4. Task graph

Kind: **B** = behavioral (TDD, red then green per case), **S** = structural (exact verification).

### 4.1 Tasks

| Task | Title | Wave, lane | Kind | Blocked by | Public seam under test | Outside `src/ui/` |
|---|---|---|---|---|---|---|
| T9AR.1 | Tooling: the deliverable's evidence folder | 0, TL | S | — | `status.test.sh` | **tooling:** `.claude/scripts/status.sh` |
| T9AR.2 | Freeze the new types; split the replay adapter | 0, TY | S | — | `typecheck`; the replay's unit tests, unchanged | **types only** (A267 to A271, optional fields) |
| T9AR.3 | Trade Analysis: the estimated odds and the extremes' weight | 1, DM | B | T9AR.2 | `TradeAnalysis.evaluate` | **Trade Analysis:** A267, A268 |
| T9AR.4 | Trade Analysis: the Plan's terms, and each fill against the Plan | 1, DM | B | T9AR.3 (lane order) | `TradeAnalysis.replay` | **Trade Analysis:** A269, A270 |
| T9AR.5 | Trade Analysis: a condition's first crossing | 1, DM | B | T9AR.4 (lane order) | `TradeAnalysis.replay` | **Trade Analysis:** A271 |
| T9AR.6 | Facade and manifest | 1, DM | S | T9AR.5 (lane order) | `verify:capabilities`, `typecheck` | **Workspace, facade:** variants; test builders |
| T9AR.7 | The Replay overlay | 1, OV | B | T9AR.2 | `ReplayOverlay` | none |
| T9AR.8 | Trade Detail: Replay opens the overlay | 1, OV | B | T9AR.7 (lane order) | `TradeDetail` | none |
| T9AR.9 | Review card: the Replay button | 1, OV | B | T9AR.8 (lane order) | `ReviewCard`, `ReviewView` | none |
| T9AR.10 | Chart: the key, the dates, every line labelled | 1, PL | B | T9AR.2 | `CorridorPlot` | none |
| T9AR.11 | Chart: the entry session, an off-scale Worst case, a session with no Mark | 1, PL | B | T9AR.10 (lane order) | `CorridorPlot` | none |
| T9AR.12 | Chart on a phone: the labels in a strip | 1, PL | B | T9AR.11 (lane order) | `CorridorPlot` | none |
| T9AR.13 | Readout: the stake grid, a Trade past a line, the change line | 2, RO | B | T9AR.2, T9AR.8 | `readout.props`, `Readout` | none |
| T9AR.14 | One name per figure in the replay | 2, RO | B | T9AR.13 (lane order) | `readout.props`, `stake-words.props` | none |
| T9AR.15 | Reward to risk with the estimated odds; the extremes' weight | 2, RO | B | T9AR.14 (lane order), T9AR.6 | `stake-words.props`, `readout.props`, `Readout` | none |
| T9AR.16 | The top of the replay, a session with no Mark, the hover box | 2, SC | B | T9AR.2, T9AR.8 | `ReplayFrame`, `session-words.props` | none |
| T9AR.17 | Session cards replace the table | 2, SC | B | T9AR.16 (lane order), T9AR.14 | `ReplayFrame`, `cards.props` | none |
| T9AR.18 | The Plan beside what happened | 2, SC | B | T9AR.17 (lane order), T9AR.6, T9AR.15 | `ReplayFrame`, `cards.props`, `session-words.props` | none |
| T9AR.19 | Chart: a first crossing | 2, PL | B | T9AR.12 (lane order), T9AR.6 | `CorridorPlot`, `plot.props` | none |
| T9AR.20 | Review card: the summary in the replay's words | 2, RW | B | T9AR.9, T9AR.15 | `CardFigures` | none |
| T9AR.21 | Remove the stake rows' change fields | 2, DM | S | T9AR.13 | `typecheck`, a grep, `test:integration` | **Trade Analysis, view types:** two fields removed |
| T9AR.22 | Node integration suite | 3, IN | S | T9AR.6, T9AR.21 | `test:integration` | none (tests only) |
| T9AR.23 | Browser suite | 3, BR | S | T9AR.15, T9AR.18, T9AR.19, T9AR.20 | `test:e2e` | none (tests only) |
| T9AR.24 | Gate: fresh browser critic | 3, — | S | T9AR.22, T9AR.23 | critic report | none |

**Run order.**
- **Wave 0:** T9AR.1 and T9AR.2 at once.
- **Wave 1:** lanes DM, OV and PL at once, each in its listed order.
- **Wave 2:** lanes RO and SC start when T9AR.8 has merged. T9AR.15, T9AR.18 and T9AR.19 also wait for T9AR.6. T9AR.17 waits for T9AR.14, whose row builders its cards reuse. T9AR.20 starts when T9AR.9 and T9AR.15 have merged; T9AR.21 when T9AR.13 has. At most four agents run at once.
- **Wave 3:** T9AR.22 may start once T9AR.6 and T9AR.21 have merged; T9AR.23 after the last UI task; then T9AR.24.

### 4.2 Lanes and file ownership

A lane is one git worktree (`.claude/worktrees/d09ar-<lane>`) on one branch (`d09ar/<lane>`), set up by hand with `git worktree add` and `lane-setup.sh`. A file is owned by one lane at a time.

| Lane | Tasks | Owns |
|---|---|---|
| TL | T9AR.1 | `.claude/scripts/status.sh`, `status.test.sh` |
| TY | T9AR.2 | Types only in `src/domain/trade-analysis/evaluate.ts` and `replay-series.ts`, `src/coordinators/trade-views/replay-view.ts`, `src/app/types.ts`, `src/ui/cockpit/replay/replay.types.ts`; the split files of A286 and their moved tests; `src/ui/cockpit/index.css` (three import lines); the new, empty `styles/replay-overlay.css` and `styles/replay-cards.css`, and `styles/replay-readout.css` (rules moved) |
| DM | T9AR.3, T9AR.4, T9AR.5, T9AR.6, T9AR.21 | `src/domain/trade-analysis/` and its tests; `src/coordinators/trade-views/replay-view.ts`; `src/coordinators/workspace/capabilities.ts` and `workspace.test.ts`; `src/app/routes.ts`, `types.ts`; the replay builders in `tests/support/`; for T9AR.21 also `tests/integration/d9/gaps.test.ts` and the two lines of `replay.props.ts` and of its test that name the fields |
| OV | T9AR.7, T9AR.8, T9AR.9 | `src/ui/cockpit/replay/overlay.tsx` (new) and its test; `styles/replay-overlay.css`; `src/ui/screens/trade-detail/Cockpit.tsx`, `drawer-request.ts`, `Cockpit.test.tsx`; `src/ui/screens/TradeDetail.tsx` and its test; `src/ui/cockpit/drawers/replay.tsx` and its test; `src/ui/screens/ReviewCard.tsx`, `ReviewCard.test.tsx`, `ReviewCards.test.tsx`; `linkedCard` in `ReviewView.tsx`; the `.review-card-replay` rules in `src/ui/app.css`; `e2e/support/detail/index.ts`; the drawer lines of `e2e/d8p` and `e2e/d8r`; `e2e/d5r/durability.spec.ts:98`; in `e2e/d9`: the helpers that open and scope the replay (`replay`, `cardReplay`, `openDrawer`) and every line that calls them |
| PL | T9AR.10, T9AR.11, T9AR.12, T9AR.19 | `src/ui/cockpit/replay/corridor.tsx`, `corridor-pnl.tsx`, `price-strip.tsx`, `geometry.ts`, `plot.props.ts` and their tests; `styles/replay-plot.css`; in `e2e/d9`: the chart helpers (`priceStrip`, `pnlChart`, `chartText`, `hits`) and the lines that assert chart text |
| RO | T9AR.13, T9AR.14, T9AR.15 | `src/ui/cockpit/replay/readout.tsx`, `readout.props.ts`, `stake-words.props.ts` and their tests; `styles/replay-readout.css`; `src/ui/format.ts` (the ratio); in `e2e/d9`: `readoutValue`, `readoutPnl`, `stake`, and the lines that assert a readout row or the stake sentence |
| SC | T9AR.16, T9AR.17, T9AR.18 | `src/ui/cockpit/replay/frame.tsx`, `frame.test.tsx`, `session-words.props.ts`, `replay.props.ts` (the assembly) and their tests; `session-cards.tsx`, `cards.props.ts` (new); `src/ui/cockpit/card-pager.tsx` (new) and the paging lines of `journal-cards.tsx`; `styles/replay-frame.css`, `styles/replay-cards.css`; `src/ui/calculation-words.ts` (the no-Mark line) and its test; in `e2e/d9`: `headline`, `going`, `openTable`, `tableRow` (which become the cards' helpers) and their lines. For T9AR.18 only, after RO has finished: the Position and Plan groups of `readout.props.ts`. |
| RW | T9AR.20 | `src/ui/screens/CardFigures.tsx`, `CardFigures.test.tsx`; the summary's lines in `ReviewCard.test.tsx` and `ReviewCards.test.tsx`; `e2e/d4/review.spec.ts:47,48,49`; `e2e/d5r/review.spec.ts:28`; `e2e/d7sp/review-dated-line.spec.ts:33` |
| IN | T9AR.22 | `tests/integration/d9ar/` (new) |
| BR | T9AR.23 | `e2e/d9ar/` (new); `e2e/d1/support.ts` (one option: touch) |

**Shared files, and how they are split or sequenced.**
- **`replay.types.ts`:** TY freezes every new props type in wave 0. A lane that needs a type changed reports it; the main session routes the change to lane TY as a bug task, as stage A did.
- **`readout.props.ts`:** RO through T9AR.15; then SC for T9AR.18's two groups, which is why T9AR.18 is blocked by T9AR.15.
- **`ReviewCard.test.tsx`:** OV for the button's cases; RW for the summary's lines, after T9AR.9 has merged.
- **`e2e/d9/*.spec.ts` and `e2e/d9/support.ts`:** by helper group, as each lane's row says. No lane renames a helper another lane's lines call, except SC's `openTable` and `tableRow`, whose callers are all SC's.

---

## 5. Behavioral tasks

Every case runs **red → green** individually. A case that passes on its first run, or fails for a syntax, configuration, fixture or unrelated reason, is not valid red evidence. A genuine first-run pass needs a mutation check (an assertion failure or runtime exception, not a compile error) and is flagged. Cases are ordered so each needs behavior the earlier ones don't; where two facts would be met by one piece of code, they are one case. No test may be written after the code it covers.

**Quoted words.** A case that quotes screen text quotes section 1.6's wording or a decision's. Under P137 a task may shorten that text; the case then quotes the shorter text, asserts the same thing, and the change is recorded.

**Existing cases.** A task also changes the existing cases its row of section 1.5 lists. In each, the quoted words or the way the replay is opened change to match and nothing else does.

**The test Trades** are D9's (its section 5): R-AXIO-U, R-AXIO-D, R-BREN-U, K-sale, R-CORV-D, R-DALE-D and R-DALE-U, already in `src/domain/trade-analysis/reference-trade.ts` and `option-trade.ts`. Figures D9's table does not hold, used below:

| Series | Session | Trade P&L | Risk to stop | Reward to target | Ratio | Chance of the Target first |
|---|---|---|---|---|---|---|
| R-DALE-D (3 short after the buyback) | Wed 11-11, put $3.24 | −$1,185 | $78 | $912 | 11.69 to 1 | 78/990, 8% : 92% |
| R-BREN-U | Mon 11-02 | +$28 | $352 | $928 | 2.64 to 1 | 352/1,280 = 27.5%, 28% : 72% |
| R-BREN-U | Wed 11-11 | +$520 | $844 | $436 | 0.52 to 1 | 844/1,280, 66% : 34% |
| R-AXIO-D | Mon 11-16, $44.00 | −$1,040 (realized −$440) | past the Stop by $300 | — | none | none |
| The Plans | — | — | — | — | BREN 2.95, CORV 2.73, AXIO 2.00, DALE 0.29 | BREN 25% : 75%, CORV 27% : 73%, AXIO 33% : 67%, DALE 78% : 22% |

The coach's "DALE" was a plain hold on R-DALE-D's Marks (6 short, no buyback): Wed 11-11 reads $156 at risk and $1,824 to gain, the same 11.69 to 1 and 8% : 92%. The browser suite builds it as a fixture, **DALE-hold** (T9AR.23).

### T9AR.3 Trade Analysis: the estimated odds and the extremes' weight

Seam: `TradeAnalysis.evaluate` (new `odds.test.ts`). A267, A268.

```text
describe("evaluate: the estimated odds (A267)")
  it should give R-DALE-D on Wed 11-11 a chance of the Target first of 78/990 and of the Stop first of 912/990, from $78.00 at risk and $912.00 to gain
  it should give the pair as whole percents that add to 100, a half going to the Target: 8 and 92 for R-DALE-D on Wed 11-11, 28 and 72 for R-BREN-U on Mon 11-02 (27.5%)
  it should give the ratio's own result when the ratio is not a Value: Not applicable, No ongoing risk, for R-AXIO-D on Mon 11-09, and the Mark's Unavailable reason for R-CORV-D on Tue 11-10
  it should give the Plan's own odds from 1R and the Original Planned Reward, 1,536/1,980 for R-DALE-D (78 and 22), on a session with no Mark and after the buyback alike
describe("evaluate: the extremes' weight (A268)")
  it should call the extremes Remote for long stock (R-AXIO-U), a long Call (R-BREN-U) and a long Put (R-CORV-D)
  it should call them Main for the Cash-Secured Put (R-DALE-D)
```

Also runs `npm run verify:fixtures`: the eight frozen fixtures still compare (A283).

### T9AR.4 Trade Analysis: the Plan's terms, and each fill against the Plan

Seam: `TradeAnalysis.replay` (new `replay-plan.test.ts`). A269, A270.

```text
describe("replay: the Plan's terms (A269)")
  it should give each Plan's legs, Stops and Targets as confirmed: R-BREN-U long 4 of the $100 Call at $1.61, Stop the call at $0.80, Target the call at $4.00; R-DALE-D short 6 at $0.94, Stop DALE at $54.00, Target the put at $0.20
  it should give the Plan's odds beside its ratio: R-BREN-U 324/1,280, 25 and 75
  it should list every Stop and Target of a Plan that has two of a role, each with its own planned result (full reading): O-S2's Stop on MNO at $41.00 (−$560.00) and on the option at $3.60 (−$480.00), its Target on MNO at $44.50 (+$140.00) and on the option at $0.30 (+$180.00)
describe("replay: each fill against the Plan (A270)")
  it should measure an opening fill against the Plan's entry (R-BREN-U's Buy of 4 at $1.61 is At it), and give a fill with no price nothing (R-DALE-U's Expiration)
  it should measure an added lot against the Plan's entry: R-AXIO-U's Buy of 100 at $51.40 is Above it by $1.40
  it should measure a sale at or beyond the Stop against the Stop: R-AXIO-D's Sell of 100 at $45.60 is Below the Stop by $1.40
  it should measure any other reducing fill against the Target: R-BREN-U's Sell of 2 at $4.00 is At the Target, and K-sale's Sell of 2 at $4.91 is Above it by $0.91
  it should measure a buyback on the option's own price and pass over a Stop that is a price of the Underlying: R-DALE-D's Buy of 3 at $2.59 is Above the Target by $2.39
```

### T9AR.5 Trade Analysis: a condition's first crossing

Seam: `TradeAnalysis.replay` (new `replay-crossings.test.ts`). A271. The adapter's own reading of a crossed condition (`crossedCondition` in the session's words) stays until T9AR.18 reads this instead.

```text
describe("replay: a condition's first crossing (A271)")
  it should give no crossing before a condition is crossed, then its first session and the run's start: R-CORV-D's Target on Fri 11-06, and R-AXIO-D's Stop on Mon 11-09
  it should keep the first crossing and drop the run when the condition is Active again (R-CORV-D Mon 11-09: first Fri 11-06, no run)
  it should start a new run when it is crossed again, marked first seen after a session with no reading (R-CORV-D Wed 11-11: since Wed 11-11, after a gap; first still Fri 11-06)
  it should carry a run through a session with no reading (R-AXIO-D with no Mark on Tue 11-10: Wed 11-11 still since Mon 11-09)
  it should mark a first crossing first seen when the session before it had no reading (R-CORV-D with no put Mark on Thu 11-05: Fri 11-06, after a gap)
  it should read an option's Underlying condition from the Underlying's Mark alone: R-DALE-D with no put Mark on Fri 11-13 still gives the Stop first crossed that day, and Thu 11-12, where only the planned amount is passed, gives none
  it should keep each condition's own crossing when a role has two (full reading): O-S2 on Wed 10-14, the put at $3.70, gives its Stop on the option first crossed that day, its Stop on MNO none, and the Stop role first crossed that day
```

O-S2 is D7S's short put with two Stops and two Targets (`os2Record` in `option-trade.ts`): 1R $480, planned reward $140.

### T9AR.7 The Replay overlay

Seam: `ReplayOverlay` (`overlay.test.tsx`), plain props. A273, A275. W53.

```text
describe("Replay overlay (decision 3)")
  it should show its content in a modal dialog named "Replay, BREN", with the page behind it inert
  it should head it "BREN · Trade P&L +$988.00" with a Close button
  it should move focus into the dialog when it opens
  it should keep Tab and Shift+Tab inside the dialog
  it should call onClose from the Close button and from Escape
  it should leave Escape to a control inside it that handles Escape itself, and close on the next
  it should return focus to the control that opened it when it closes
  it should head a finished Trade "BREN · Final result +$1,138.00", and show the symbol alone when the latest session has no Mark
```

The wide layout (the readout beside the charts) and the phone's full screen are stylesheet rules with no unit case; B9AR.1 and B9AR.7 measure them.

**Open question 5 answered (b)** (P153, full reading): the shell's notices and banners stay in place underneath the overlay. One case is added here:

```text
  it should leave a shell banner present when the overlay opens (an update notice, the read-only banner) in place and unchanged, and readable again the moment the overlay closes
```

### T9AR.8 Trade Detail: Replay opens the overlay

Seam: `TradeDetail` against the facade double. P143, P144, A274. W54. Changes the lines of section 1.5's first two Texts rows.

```text
describe("Trade Detail: the Replay overlay (decision 3)")
  it should show six drawers on an Open, a Settlement Due and a Closed Detail (Today, Position, Plan and Risk, Price History, Journal, Payoff) and a "Replay" button beside them
  it should show no Replay button on a Planned Detail or one whose records disagree
  it should open the overlay from the button with the replay the Detail already read, with no second read, and put `replay=open` in the address
  it should close it on Close, on Escape and on the browser's Back, staying on the Trade, with focus back on the Replay button
  it should open in the overlay on load when the address holds `replay=open`, on the session it names, and close by replacing the address
  it should show "Loading the Trade…" in the overlay while the replay is pending, and "No replay." when it could not be read
  it should close the overlay and select the drawer when "Price History", "Position" or "Journal" is pressed, with focus on that session's place in it
  it should send "Back to the Review" to the card with `replay=open` and the slider's session
```

### T9AR.9 Review card: the Replay button

Seams: `ReviewCard` and `ReviewView` against the facade double. A282, A274. Changes the lines of section 1.5's third Texts row. The brief names AC-REV-003 (A284).

```text
describe("Review card: the Replay button (decision 3)")
  it should show a "Replay" button directly above the Action form, and no replay inside the card
  it should open the overlay from getTrade's replay, resting on the Review Date, and never call replayTrade
  it should keep the Action form's unsaved choice and Intent through opening and closing the overlay, and save nothing by either
  it should close on Close, on Escape and on the browser's Back, staying on the card with its Action panel open and focus on the Replay button
  it should show the new Mark's session in the overlay after Save Marks, from the save's result, without reading again
  it should link "Price History" in the overlay to the Trade's Detail with the drawer, the session and `from=review`
  it should reopen the overlay on the named session when the address names the card with `replay=open`
  it should show no Replay button on a card that only owes reflections, or one whose Trade's facts cannot be replayed
```

### T9AR.10 Chart: the key, the dates, every line labelled

Seam: `CorridorPlot` (`corridor.test.tsx`, `price-strip.test.tsx`) and `plot.props`. A275, A280. W66, W67. Decision 6's title.

```text
describe("Corridor: the key, the dates and the lines (suggestion 3)")
  it should title the P&L chart "Trade P&L" at every width
  it should show a one-line key under the charts naming each thing drawn so far and nothing else (R-BREN-U Mon 11-02 has no "Banked"; Thu 11-12 has)
  it should label the time axis with the first session's date at the left and "Expires Fri Nov 20" at the right on an option
  it should label nothing at the right on a stock Trade, and name the slider's session under the cursor
  it should draw a Worst case, Max reward or price line only with its label: one with no room for its label is not drawn (R-DALE-D's Max reward under the title)
  it should draw at its box's own width on a wide screen, the text the same size at 860 and at 1,400
describe("Chart: carried from D9's Stage A gate (critic-2, section 1.8)")
  it should show nothing at the right end of a stock Trade's time axis at any session, never the last session's date before it is revealed (defect 3: "Tue Nov 17" at "1 of 12", R-AXIO-U)
```

### T9AR.11 Chart: the entry session, an off-scale Worst case, a session with no Mark

Seam: `CorridorPlot`. A280, P146. W68. The case list follows P146's recommendation; if open question 2 is answered otherwise, one case is added for the connector and its label.

```text
describe("Corridor: labels clear of the cursor (suggestion 10)")
  it should keep every level label ("Strike $100", "Stop $54.00", "Break-even") out of the cursor's column, on the entry session and on the last one
describe("Corridor: a Worst case off the scale (suggestion 13)")
  it should tag the bottom edge "Worst case −$33,936 ↓" when the Worst case is below the chart's range (R-DALE-D Mon 11-09) without stretching the axis, and show no tag when its line is on the scale (R-BREN-U after the sale)
  it should give the tag the extremes' weight: grey for R-AXIO-D, full strength for R-DALE-D
describe("Corridor: a session with no Mark (suggestion 12)")
  it should shade that session's column in the P&L chart and label it "No Mark", as the price chart does
  it should run the area to the edge of that column on each side and end it upright, joining nothing across it
```

### T9AR.12 Chart on a phone: the labels in a strip

Seam: `CorridorPlot`. A280. W69. Changes `expectPhoneWords` and the "labels no phone chart may lose" line of `e2e/d9/responsive-a11y.spec.ts`: both read the strip.

```text
describe("Corridor on a phone (suggestion 9)")
  it should draw the phone's P&L chart at least 200 high
  it should take the line labels off the phone's drawing and list them in a strip under it: "Stop +$316 · Banked +$478 · Target +$956 · Sold 2" (R-BREN-U Thu 11-12)
  it should keep the slider's value on the drawing ("+$982"), with the title and the axis figures
  it should list in the strip a label the wide drawing would leave out for lack of room
```

If a P&L chart 200 high cannot fit one phone screen with the headline, the stake sentence and the price chart (B9AR.7's check at 320 by 667), the task reports it as a pending decision. It does not shorten the chart to pass.

### T9AR.13 Readout: the stake grid, a Trade past a line, the change line

Seams: `readout.props` (`readout.props.test.ts`) and `Readout` (`readout.test.tsx`). A278, A279, A281. W55, W56, W61 (the dash). Decision 8.

```text
describe("Readout: the stake grid (suggestion 1)")
  it should set R-BREN-U's Wed 11-11 stake as a grid under "Current Risk" and "Remaining Reward" with the columns "From here", "R" and "P&L if hit": At Stop $844.00, 2.60R, −$324.00
  it should give At Worst case $1,164.00, 3.59R, −$644.00 and At Target $436.00, 1.35R, +$956.00, one figure to a cell
  it should read an unbounded Max reward "No cap above" across its row, with no R and no ending
  it should mark every figure's cell as unbreakable, sign included
  it should give each stake row its canonical term as accessible text, with nothing added to see (A287, full reading): "Ongoing Risk to Stop" for At Stop, "Worst-Case Ongoing Risk" for At Worst case, "Incremental Reward to Target" for At Target, "Maximum Incremental Reward" for At Max reward, and "Stop Overrun" or "Target Overrun" for the row past a line
describe("Readout: a Trade past a line (suggestion 6)")
  it should say "Past the Stop by $300.00 (0.50R) · at Stop −$740.00" in one row above the two headings for R-AXIO-D on Mon 11-16, with no At Stop row and no "$0.00"
  it should say "Past the Target by $32.00 (0.10R) · at Target +$956.00" for R-BREN-U on Mon 11-16, with no At Target row
  it should say "Past the Stop's amount by $9.00 (0.01R) · at Stop −$1,263.00" when the planned amount is passed and the Stop is not crossed (R-DALE-D Thu 11-12)
  it should leave out the "Reward to risk" row when there is no ratio
describe("Readout: the change line (decision 8)")
  it should show "down $150.00 since Fri Nov 13" under Trade P&L and under each Mark, and under no stake row (R-BREN-U Mon 11-16)
describe("Readout: a session with no Mark (suggestion 12)")
  it should show a dash named "No Mark" in each cell that needs the Mark, and keep the endings and the Worst case, which need none (R-CORV-D Tue 11-10)
describe("Readout: carried from D9's Stage A gate (critic-2, section 1.8)")
  it should keep a signed amount on one line in every grid cell at 1280, 375 and 320 wide, never "P&L –" on one line and "$17,463.00" on the next (defect 2: R-DALE-D Fri 11-13's At Worst case; R-BREN-U Mon 11-02)
```

### T9AR.14 One name per figure in the replay

Seams: `readout.props`, `stake-words.props`, and `ratioToOne` in `src/ui/format.ts` (`format.test.ts`). W57, W58, W59. The shared `ratio` formatter is not changed: other screens read it (P152).

```text
describe("Replay: one name per figure (suggestion 8)")
  it should name a realized loss "Realized −$440.00" (R-AXIO-D Mon 11-09) and keep "Banked +$478.00" for a gain
  it should say "−$440.00 of the result was realized before the end." on a final session that follows a realized loss
  it should put "$" on every price: "BREN Mark $104.00" in the readout and "BREN Mark: $101.80" in the hover
  it should give every ratio two decimals: "2.00 to 1" for R-AXIO-U's Plan and "0.10 to 1" for its Mon 11-16
```

### T9AR.15 Reward to risk with the estimated odds; the extremes' weight

Seams: `stake-words.props`, `readout.props` and `Readout`. A267, A268. W60. Decisions 4 and 6.

```text
describe("Replay: reward to risk with the estimated odds (decision 4)")
  it should say "From here: $78.00 at risk to the Stop · $912.00 more to the Target · 11.69 to 1 · about 8% : 92% (the Plan was 0.29 to 1 · 78% : 22%)." for R-DALE-D on Wed 11-11
  it should read "11.69 to 1 · about 8% : 92%" with "(Plan 0.29 to 1 · 78% : 22%)" in the Reward to risk row
  it should say "under 1% : over 99%" when a side is under one percent
  it should speak the odds in full to a screen reader: "about 8% chance of the Target first, 92% of the Stop first"
  it should show "Odds: Target first : Stop first, estimated with no edge and no time limit." once, under the grid
describe("Readout: the extremes' weight (decision 6)")
  it should mark At Worst case and At Max reward remote for R-AXIO-D and R-CORV-D and main for R-DALE-D, and treat a view without the field as main
```

The smaller grey type is a stylesheet rule on that mark; B9AR.3 reads its computed style.

### T9AR.16 The top of the replay, a session with no Mark, the hover box

Seams: `ReplayFrame` (`frame.test.tsx`), `session-words.props`, `calculation-words` (its own test). A281. W61.

```text
describe("Replay: the top (suggestion 14)")
  it should show the session's date beside the headline figure: "Mon Nov 16", then "+$988.00 · 3.05R"
describe("Replay: a session with no Mark (suggestion 12)")
  it should say "No Mark for the put on Tue Nov 10." once, at normal size, where the headline figure would be (R-CORV-D)
  it should offer "Add the Mark" beside it on an Open Trade, linking to the Review's Marks row for that Instrument, and no link on a Trade that has ended
  it should keep the acknowledgment's own words, at the same normal size, on a session whose Mark the trader acknowledged as unavailable, and never say "No Mark for …" there (A281, full reading)
describe("Replay: the hover box (suggestion 14)")
  it should show the hovered session's lines in a box over the chart, with nothing between the chart and the readout
```

The "From here" sentence in normal ink is a stylesheet rule with no unit case; B9AR.3 compares its computed colour with the status line's.

### T9AR.17 Session cards replace the table

Seams: `ReplayFrame`, `SessionCards` (`session-cards.test.tsx`) and `cards.props` (`cards.props.test.ts`). A276, A277, P148. W65. Decision 5. The refactor step comes first and needs no new case: the Journal's paging moves to `card-pager.tsx`, and `journal-cards.props.test.tsx` and `journal-cards.test.tsx` pass unchanged.

```text
describe("Replay: session cards (decision 5)")
  it should show one card for each session up to the slider's, newest first, each headed by its date, under "Session by session", and no table
  it should hold every per-session figure on a card, top to bottom: the Marks, Trade P&L, Banked or Realized, Open, Held, the stake rows with their R and endings, Reward to risk, Stop, Target and Events (R-BREN-U Thu 11-12)
  it should read a session without a Mark as a dash in the cells that need it, never a carried value, and a Trade past its Stop as "Past the Stop by $300.00 (0.50R)", never "$0.00"
  it should mark the slider's session's card current
  it should move the slider to a card's session when the card's heading is pressed
  it should page with "Newer sessions" and "Earlier sessions", a page being the cards that fit side by side, handing focus on at either end
  it should turn back to the page holding the slider's card when the slider moves
  it should name the cards' list as the charts' description
describe("Session cards: carried from D9's Stage A gate (critic-2, section 1.8)")
  it should show a session past a line on its card as W56's row ("Past the Stop by $180.00 (0.30R) · at Stop −$740.00", R-AXIO-D Mon 11-09), never "$0.00" at risk (defect 1a)
```

The "Stop" and "Target" rows hold the two prices the table's last columns held. T9AR.18 moves them to the Plan block (P148).

### T9AR.18 The Plan beside what happened

Seams: `cards.props`, `session-words.props`, `readout.props` (the Position and Plan groups) and `ReplayFrame`. A269, A270, A271. W62, W63, W64. Decisions 2 and 5.

```text
describe("Replay: the Plan block (decisions 2 and 5)")
  it should show "The Plan" as one block above the cards: "Entry: 4 contracts at $1.61", "Stop: call at or below $0.80 · P&L if hit −$324.00", "Target: call at or above $4.00 · P&L if hit +$956.00", "Reward to risk: 2.95 to 1 · 25% : 75%" (R-BREN-U)
  it should name what each price is a price of: "Entry: short 6 contracts at $0.94", "Stop: DALE at or below $54.00", "Target: put at or below $0.20" (R-DALE-D)
  it should take "The Plan" out of the readout and the Stop and Target rows off the cards, the block being their one place
  it should give every Stop and Target its own row when the Plan has two of a role, each with its own P&L if hit (A269, full reading): O-S2 reads "Stop: MNO at or below $41.00 · P&L if hit −$560.00" and "Stop: put at or above $3.60 · P&L if hit −$480.00"
describe("Replay: each Execution against the Plan (decision 2)")
  it should read "Sold 100 at $45.60, $1.40 below the Stop" in the readout's Position group and in the card's Events (R-AXIO-D Mon 11-09)
  it should read "Sold 2 at $4.00, at the Target" (R-BREN-U Thu 11-12) and "Bought 100 at $51.40, $1.40 above the Plan's entry" (R-AXIO-U Fri 11-06)
describe("Replay: a condition's first crossing (decision 2)")
  it should say "Target first reached Fri Nov 6." after the status line from Fri 11-06 on, Mon 11-09 included, where the put is under its Target again (R-CORV-D)
  it should say "Past the Stop since Mon Nov 9." on each session of the run (R-AXIO-D), and "Stop first breached Mon Nov 9." once the Stop is no longer crossed
  it should say "first seen" after a session with no Mark: "Target reached, first seen Fri Nov 6."
  it should list "Target first reached" in the Events of the card of the session it happened in
describe("The Plan beside what happened: carried from D9's Stage A gate (critic-2, section 1.8)")
  it should show an option's strike in "The Plan" block in W40's words ("Strike $100", R-BREN-U; "Strike $57.50", R-DALE-D), so every chart figure is also off the chart (defect 1b)
  it should name an Expiration "Expiration, Fri Nov 20" with "Expired" in the readout's Position group, never "Execution" (defect 4: R-DALE-U; the glossary: an Expiration is a Position Change, not an Execution)
```

### T9AR.19 Chart: a first crossing

Seams: `CorridorPlot` and `plot.props`. A271. W64, W66.

```text
describe("Corridor: a first crossing (decision 2)")
  it should flag a line at the session its condition was first crossed, labelled "Target reached" (R-CORV-D Fri 11-06) or "Stop breached" (R-AXIO-D Mon 11-09), and keep the flag on later sessions
  it should name the flag in the key, and list its words in the phone's strip
```

### T9AR.20 Review card: the summary in the replay's words

Seam: `CardFigures` (`CardFigures.test.tsx`). Decision 7. W56, W59, W70. It reads the rows RO built, so the card and the replay cannot drift apart. Changes the lines of section 1.5's last two Texts rows. T-A is the D4 and D5R card Trade: $450.00 at risk (1.80R), $400.00 to gain (1.60R), 1R $250.00 and a planned reward of $600.00.

```text
describe("Review card: the summary in the replay's words (decision 7)")
  it should name the figures "Current Risk · At Stop", "Current Risk · At Worst case" and "Remaining Reward · At Target", with their amounts as before, in the Review-date group and the dated group alike
  it should read "Reward to risk" in one row, "0.89 to 1 · about 53% : 47% (Plan 2.40 to 1 · 29% : 71%)" for T-A, with no separate planned row
  it should use the replay's wording past a line: "Past the Target by $32.00 (0.10R)" in place of the At Target row, "Past the Stop by $300.00 (0.50R)" in place of At Stop, never "$0.00 · 0.00R", and no Reward to risk row
  it should give At Worst case the extremes' weight
  it should name the marked result "Trade P&L"
  it should keep each renamed figure's canonical term as accessible text: "Ongoing Risk to Stop", "Worst-Case Ongoing Risk", "Incremental Reward to Target" (A287, full reading)
```

The last case is built only if W70 is approved; if it is declined, the case is dropped and the term stays.

---

## 6. Structural tasks

| Task | Exact verification | Expected result | Notes |
|---|---|---|---|
| T9AR.1 Tooling | `.claude/scripts/status.test.sh`; `.claude/scripts/status.sh D09A-R`; `.claude/scripts/full-suite.sh --current-folder evidence/D09AR` | `status.test.sh` passes with one new case: a deliverable named with a hyphen, whose evidence folder has none, lists its open question. `status.sh D09A-R` prints this breakdown's open rows and reads `evidence/D09AR/DECISIONS-PENDING.md`. The folder query prints `e2e/d9ar`. | P141. `status.sh` is edited with the Edit tool; a hook blocks shell writes into `.claude/`. `status.sh` still exits 0 with "no decisions file" when neither folder exists. |
| T9AR.2 Types and the split | `.claude/scripts/it-titles.sh` before and after, compared; `npx vitest run src/ui/cockpit src/ui/screens tools/cockpit-styles.test.ts`; `npm run typecheck`; `npx tsc6 --noEmit`; `npm run lint`; `npm run build` | The list of case titles is identical before and after: cases moved, none changed. Every new domain and view field is optional. The new props types of A273, A277, A278 and A280 compile. Three stylesheets are added and imported. | A286. Lets every lane start on its own files. |
| T9AR.6 Facade and manifest | `npm run verify:capabilities`; `npx vitest run src/coordinators/workspace`; `npm run typecheck`; `npm run verify:fixtures` | `TradeViewsAndReporting.replayTrade` gains the variants `PlanComparison` and `Odds`; `DailyReview.getTrade` gains `Odds`; the Trade Detail and Review routes require them; the manifest test lists them. The replay builders in `tests/support/` can build the new fields. The fixtures still compare. | AC-CAP-001. No operation is added. A coordinator case would pass on its first run, since the fields pass through by spread (A272); I9AR.1 and I9AR.2 prove the pass-through end to end instead. |
| T9AR.21 Remove the change fields | `grep -rnE "riskChange\|rewardChange" tools src e2e tests .claude`; `npm run typecheck`; `npx vitest run src/domain/trade-analysis src/coordinators src/ui/cockpit/replay`; `npm run test:integration -- d9/gaps`; `npm run verify:fixtures` | The grep finds nothing. `replay-series.test.ts`'s two cases on the change in Risk to stop are deleted (the figure no longer exists); `tests/integration/d9/gaps.test.ts` keeps its case and loses the lines that read the two fields, measuring Wednesday from Monday by the Trade P&L's change, which it already asserts. | A279. After T9AR.13 removed the only reader. `evidence/D09AR/structural.md` lists each deleted or changed case. |
| T9AR.22 Node integration suite | `npm run test:integration`; `.claude/scripts/acceptance-commands.sh plan/D09A-R-stage-a-refactor.md` | I9AR.1, I9AR.2, I9AR.3, I9AR.4 and I9AR.5 pass; the script exits 0 for their rows. | |
| T9AR.23 Browser suite | `npm run test:e2e` (the full tier, through `suite-runner`); `npx playwright test --list e2e/d9`; the acceptance script | B9AR.1, B9AR.2, B9AR.3, B9AR.4, B9AR.5, B9AR.6 and B9AR.7 pass; the list names the `e2e/d9ar` files; no stage is above 8 minutes; the script exits 0 for every row. | Adds the DALE-hold fixture and a touch option to the launch helper. If `browser-3` passes 8 minutes, a `browser-4` stage is added for `e2e/d9` and `e2e/d9ar`, as `.claude/docs/implementing.md` says. |
| T9AR.24 Gate | A fresh critic per section 8, flows C9AR.1, C9AR.2, C9AR.3, C9AR.4, C9AR.5, C9AR.6 and C9AR.7, after a full-tier run | Every flow passes. Tag `claude-opus-5.5-d9ar`. | A light gate: no benchmark (A285). P151's critic limit applies. |

---

## 7. Mock-free integration tests

D1 to D9's disclosed substitutes still apply. D9A-R adds none.

### 7.1 Node application-stack suite (`tests/integration/d9ar/`)

| Case | File | Given / When | Then |
|---|---|---|---|
| I9AR.1 The Plan beside what happened, end to end | `plan-comparison.test.ts` | R-AXIO-D, R-BREN-U, R-CORV-D and R-DALE-D entered through the facade; `replayTrade`; restart; read again. | The Plan's terms as confirmed; each fill's line, side and distance (A270's six examples); the first crossings of A271 (R-CORV-D's Target Fri 11-06 and its new run first seen Wed 11-11; R-AXIO-D's Stop since Mon 11-09). Equal after restart. |
| I9AR.2 The odds, and the card agrees with the replay (AC-CALC-003, cumulative) | `odds.test.ts` | R-DALE-D to Wed 11-11; R-BREN-U; `replayTrade`, and the Review's `getTrade` for the same date. | Each session's odds and whole percents (section 5's table); Not applicable past the Stop; the Plan's odds on every session; the extremes Main for R-DALE-D and Remote for R-BREN-U; the card's evaluation holds the same odds as the replay's Review Date session. |
| I9AR.3 The manifest (AC-CAP-001) | `capabilities.test.ts` | The installed manifest and routes. | T9AR.6's variants, and every route's requirements installed. |
| I9AR.4 Query counts (AC-PERF-001, cumulative) | `query-count.test.ts` | R-BREN-U open; count the store requests of `replayTrade`, `getTrade` and `open`. | Each equals I9.6's count: the new figures read nothing. |
| I9AR.5 A finished Trade | `final.test.ts` | K-sale; R-DALE-U with its Expiration recorded. | The final session has no odds and nothing at stake; K-sale's last sale is Above the Target by $0.91; the Expiration's fill has nothing to measure; the Plan's terms and odds are as before the end. |

### 7.2 Browser suite (`e2e/d9ar/`, Playwright against the built app on `localhost:5175`, under the lock)

`e2e/d9ar/support.ts` re-exports `e2e/d9/support.ts` and adds: the overlay's opener and scope; the cards' helpers; **DALE-hold** (R-DALE-D's Marks, six short, no buyback); a Review holding BREN, AXIO (R-AXIO-D) and DALE-hold; `expectOneLine` (an element's text lies in one line box); `expectClearOfCursor` (no chart text overlaps the cursor's column); and the carried checks of `e2e/d9/responsive-a11y.spec.ts`: `expectFitsOneScreen`, `expectReadoutShownInFull`, `expectChartTextInside` and the smallest-chart-text check (at least 10 pixels).

| Case | File | Procedure | Expected |
|---|---|---|---|
| B9AR.1 The overlay on Trade Detail | `overlay.spec.ts` | R-BREN-U to Mon 11-16; press Replay; Escape; press Replay; Close; press Replay; the browser's Back; reload inside the overlay with the slider on Thu 11-12; press Price History. | Six drawers and the button. The dialog named "Replay, BREN" with the header of W53. Each way of closing leaves the Trade's page and puts focus on the button. The reload reopens it. Price History closes it and focuses that session's column. At 1280 the readout is beside the charts. |
| B9AR.2 The overlay in the Review, and the summary | `review.spec.ts` | The three-Trade Review. On BREN's card: choose Exit, type an Intent, press Replay, move the slider, Close; press Replay, Price History, Back to the Review; save the Action. Open AXIO's and DALE-hold's cards. | No replay inside a card. The draft Action survives the overlay. The return lands in the overlay on the same session. One press saves. The summaries read in the replay's words: AXIO "Past the Stop by $300.00 (0.50R)" with no "$0.00 · 0.00R"; DALE-hold "Past the Stop by $552.00 (0.36R)"; BREN "Past the Target by $32.00 (0.10R)". |
| B9AR.3 The readout | `readout.spec.ts` | R-BREN-U at Wed 11-11 and Mon 11-16; R-AXIO-D at Mon 11-09 and Mon 11-16; DALE-hold at Wed 11-11; R-CORV-D at Mon 11-09. | The grid of W55. The rows of W56 and no Reward to risk row past a line. "Realized −$440.00". "$" on every Mark. "11.69 to 1 · about 8% : 92%" with the Plan's. The change line only under Trade P&L and the Marks. At Worst case and At Max reward smaller and grey for AXIO and CORV, full strength for DALE-hold (computed style). The "From here" sentence in the status line's colour. `expectOneLine` on every figure. From the full reading: the grid's figures are right-aligned in tabular numerals; each stake row's accessible description is its canonical term (A287); and axe runs on AXIO's readout, so the smaller grey type still meets the UI contract's 4.5 to 1 contrast. |
| B9AR.4 The Plan block and the cards | `cards.spec.ts` | R-AXIO-D, R-BREN-U and R-CORV-D. Step the slider from the first session to the last; page the cards; press an earlier card's heading. | The Plan block of W62. One card per revealed session, newest first; none for a later session. The slider's card is current and on the shown page. Pressing a card moves the slider. Every figure the charts draw is in the readout and on the slider's card. W63's words on the sale sessions; W64's on R-CORV-D (Fri 11-06, Mon 11-09, Wed 11-11) and R-AXIO-D. |
| B9AR.5 The chart | `chart.spec.ts` | R-BREN-U at Mon 11-02 and Thu 11-12; R-AXIO-D at Mon 11-02; DALE-hold at Mon 11-02 and Mon 11-16; R-CORV-D at Wed 11-11; hover a session. | The key lists only what is drawn. "Mon Nov 2" at the left; "Expires Fri Nov 20" on the options, nothing at the right on AXIO. Every line has a label. `expectClearOfCursor` on each entry session. "Worst case −$33,936 ↓" on DALE-hold. A shaded "No Mark" column on R-CORV-D with nothing joined across it. The flags of W64. The readout's top does not move on hover. |
| B9AR.6 How a replay ends, and a session with no Mark | `states.spec.ts` | K-sale; R-DALE-U Settlement Due, then with its Expiration recorded; a Planned Trade; R-CORV-D at Tue 11-10; then Tue 11-10's put Mark acknowledged as unavailable in the Review (full reading). | "Final result" in the overlay, its header "BREN · Final result +$1,138.00", cards to the final session, nothing at stake. No Replay button on the Planned Trade. On Tue 11-10: "No Mark for the put on Tue Nov 10." once, "Add the Mark" opening the Review's Marks row, a dash in the cells that need the Mark. After the acknowledgment: the top line reads the acknowledgment's own words and no longer "No Mark for …", the dash stays, and no figure appears. |
| B9AR.7 Responsive, touch, accessible and offline (AC-UI-001, AC-UI-002, AC-DEL-001) | `responsive-a11y.spec.ts` | The overlay from Trade Detail and from the Review card at 1280, 1440 and 1920 by 800, and at 375 and 320 by 667; resize with the slider moved; axe at each; keyboard only; a touch context at 375 (tap a session in the chart, tap a card's heading); reload with the server stopped. | The header, the headline and both charts fit one screen at every size. The P&L chart is at least 800 wide at 1280 and wider at 1440 and 1920, its text the same size at each. No sideways scroll. The overlay and the slider's session survive each resize. On a phone: the overlay covers the bottom navigation, the labels are in the strip, the smallest chart text is at least 10 pixels, no chart text is cut. Tab never leaves the overlay. A tap moves the slider and leaves no hover box. No WCAG 2.1 AA violation. The overlay reads offline. From the full reading: after a resize across the breakpoint with the overlay open, Close shows the page in the new width's layout (the sidebar, or the bottom navigation), and an Action started on the Review card before opening is still there (AC-UI-001, AC-JOUR-001); on a phone the Close button, the Replay button, the paging buttons and each card's heading are at least 44 pixels high (the UI contract's touch targets). With a staged update's notice on the page, opening and closing the overlay leaves the notice in place and unchanged (open question 5, answered (b)). |

---

## 8. Browser-critic flows

The critic receives:
- the frozen `specs/` and the plan index;
- the D1 to D9 breakdowns and this one, with `plan/D09A-R-decisions.md`;
- `evidence/D09/coach-review-1.md`, as the list of what was wrong before: each of its 15 points is to be looked at again;
- the future capabilities that are not defects: Ribbon; spreads; Daily Bar candles; a moved Stop's marker; Deviation markers; the option estimates (D9's stage B) and the meter (stage C); the older names on screens other than the replay and the Review card's summary (P152); a real touch device (touch is emulated).

It runs `npm run build && npm run preview` (port 5175, under the lock) itself and does not edit code. Its setup helpers are `e2e/d9ar/support.ts`'s builders. It also checks the narrow layout (375 and 320 pixels) of everything D9A-R changes.

| Flow | Actions | Pass condition |
|---|---|---|
| C9AR.1 The overlay | From Trade Detail, open Replay on a winning option Trade, a losing one and a stock Trade. Close it with the button, with Escape and with the browser's Back. Reload while it is open. Use its Price History, Position and Journal links. | It covers the whole page; its header names the Trade and today's P&L; every way of closing returns to the Trade with focus on the button; Back never leaves the Trade; the links land on that session's place. |
| C9AR.2 The ten-second read on a wide screen | Open the overlay at 1280, 1440 and 1920 wide on each of the four Trades, without touching the slider. Then step to the entry session. | The charts use the width, and the readout sits beside them. No figure breaks across lines and no sign parts from its number. Every drawn line has a label; the key and the dates are there. On the entry session nothing is drawn through a label. |
| C9AR.3 Watching it unfold, with the cards | Slide from the first session to the last on a Trade with a second lot, one with a partial sale, one with a sale below its Stop and one with a missing Mark. Page the cards and choose earlier ones. | Nothing of a later session shows early, the header's P&L apart. The slider and the cards move together. Every figure in the charts is in the readout and the session cards. Each sale or buy says how it stood against the Plan. A first crossing is named from its session on. A session with no Mark is a gap, said once, with nothing carried or joined across it. |
| C9AR.4 A losing Trade is not flattered | DALE-hold on Wed Nov 11 and Mon Nov 16; AXIO on Fri Nov 6 and Mon Nov 9. | The ratio stands with its estimated odds and the Plan's. Past the Stop there is one plain row, no ratio and no "$0.00" risk. A loss is "Realized". The Worst case is at full strength for the short put and grey for the stock. The chart tags the Worst case when it is off the scale. |
| C9AR.5 In the Review | Walk a Review holding BREN, the losing AXIO and DALE-hold. On each card read the summary, start an Action, open Replay, move the slider, go to Price History and back, then save. | The card holds a "Replay" button and no chart. The summary uses the replay's names and wording. The overlay rests on the Review Date. The return restores the card, the panel, the overlay and the session. A started Action survives, and one press saves it. |
| C9AR.6 Finished Trades | A Trade sold out; a put expired, before and after its Expiration is recorded; a Planned Trade. | "Final result" reads the realized result with nothing at stake and no odds. The cards run to the final session. A Planned Trade has no Replay button. |
| C9AR.7 Phone, touch, keyboard and offline | The overlay at 375 and 320 wide in a touch context, from Trade Detail and from a Review card. Drive it by keyboard only. Stop the server and reload. | It fills the screen. The header, headline and both charts fit one screen, with no sideways scroll. The chart's labels are in the strip under it and nothing is cut. A tap moves the slider and leaves no hover box behind. Every control is reachable and named, and focus never leaves the overlay. It works offline. |

---

## 9. Process

- **When it runs** (decision 1). After D9's stage A has closed: T9.19-B3, T9.19-B11, the full run, critic-2 and the tag `claude-opus-5.5-d9a`. Before D9's stage B. Its own session, starting from `plan/D09A-R-handoff.md`, which the main session writes when the breakdown is agreed.
- **Decision 111's swarm rules** apply (P140), with stage A's tooling: lane worktrees set up by hand with `git worktree add` and `lane-setup.sh`, dispatched without the `isolation` option; the lane tier; merge runs; the browser lock; the full tier before the critic.
- **The wording rule, P137, carried from D9.** D9's text is: "**Each task that puts words on screen judges whether they should be shorter, and shortens them when it thinks so. The user has approved this in advance.** What a task may do: use fewer words for the same meaning; drop a label from the chart; move part of a sentence to the readout, the hover or the table. What it may not do: lengthen anything; change a figure or how it is worked out; take a figure off the page altogether (each stays in the readout or the table); or change what a planned case tests. When a planned case quotes words that are shortened, the case's quoted words change to match and nothing else in the case does. Every change is recorded with its before and after in `evidence/D09/words-changed.md`, by task, and listed in the stage's final report. Section 1.6 keeps the approved wording as the starting point."
- **D9A-R's copy, which goes word for word into the brief of every task that puts words on screen** (T9AR.7, T9AR.8, T9AR.9, T9AR.10, T9AR.11, T9AR.12, T9AR.13, T9AR.14, T9AR.15, T9AR.16, T9AR.17, T9AR.18, T9AR.19, T9AR.20). It differs from D9's only where the table and the file's place have changed:
  > Each task that puts words on screen judges whether they should be shorter, and shortens them when it thinks so. The user has approved this in advance. What a task may do: use fewer words for the same meaning; drop a label from the chart; move part of a sentence to the readout, the hover or the session cards. What it may not do: lengthen anything; change a figure or how it is worked out; take a figure off the page altogether (each stays in the readout or the session cards); or change what a planned case tests. When a planned case quotes words that are shortened, the case's quoted words change to match and nothing else in the case does. Every change is recorded with its before and after in `evidence/D09AR/words-changed.md`, by task, and listed in the deliverable's final report. Section 1.6 keeps the approved wording as the starting point.
- **Words no row covers** are used provisionally and listed in `evidence/D09AR/new-words.md` for approval in the final report, as in D9 (P135).
- **Run rules** (P151): the critic limit and the known flaky cases, as D9's P138.
- **A second coach review** is the user's instrument, not a gate step. The gate's critic checks each of the coach's 15 points again; whether to commission the coach again after the gate is the user's call.
- **Evidence** is under `evidence/D09AR/` (section 14).

---

## 10. What D9's stage B and stage C must change

Edits for the main session to make to `plan/D09-trade-replay.md` when this breakdown is agreed. Drafting did not edit that file. Every stage B and stage C task was checked; a task not named below needs no change (T9.26, T9.30, T9.31, T9.32, T9.34, T9.35, T9.36, T9.37, T9.38, T9.39, T9.40).

**The header and the sections stage A's tasks cite.**
- Under the status line, add: "**Amended by D9A-R (decision 118).** [D09A-R-stage-a-refactor.md](D09A-R-stage-a-refactor.md) runs between stage A and stage B. The replay opens as an overlay; the table is session cards; the readout's stake is a grid; reward to risk carries estimated odds."
- "In the trader's words", the bullet "It is in two places": add "Both open the replay as an overlay (D9A-R)."
- P128 (a seventh drawer): add "Superseded by D9A-R's decision 3: Replay is an overlay opened by a button."
- A255: "the readout, the table" becomes "the readout, the session cards". A256: "every figure is still in the readout and the table" becomes "… and the session cards". A257: add "D9A-R's A274 adds `replay=open`."
- Section 1.6: W1 (amended) and W35 gain "see D9A-R's W54 and W53"; W38 and W43's Reward to risk gain "with the estimated odds (D9A-R, decision 4)"; W39's P&L title is "Trade P&L" at every width; W44 gains "see D9A-R's W66"; W45 gains "replaced by session cards (D9A-R's W65)".
- Section 8, C9.2's pass condition: "every figure in the charts is in the readout and the table" becomes "… in the readout and the session cards" (decision 5). C9.3's actions: "use the replay before each Action" becomes "open the replay from the card's Replay button before each Action".
- Section 15: a line between T9.19 and T9.20: "D9A-R runs here: see [D09A-R-stage-a-refactor.md](D09A-R-stage-a-refactor.md), section 15."

**Stage B.**
- **T9.20 (Estimates stay apart).** Add a decision row for stage B's session to settle before T9.20's brief: decision 4's odds are worded as an estimate but are exact arithmetic (D9A-R's A267), held as fractions in Trade Analysis. Either they stay outside the `Estimate` type and the estimates rule, with a comment saying why, or they move under it. The planner's lean: they stay outside, since no pricing formula or assumed rate is behind them.
- **T9.21, T9.22 (volatility).** No change to the tasks. Add to section 10's follow-ons: "Refining the estimated odds with the chance that neither the Stop nor the Target is reached before expiration (D9A-R's decision 4). A new task with its own words, for the user to commission."
- **T9.23 (both views carry the estimates).** No change to its cases. Its note on the Review card: the card reads the replay in `getTrade` as before and shows it only in the overlay.
- **T9.24 (chips).** Its seam is unchanged; the chips render in the overlay. The case "… close it with Escape" becomes "… and close the small chart with Escape, leaving the overlay open; a second Escape closes the overlay" (D9A-R's T9AR.7 already leaves Escape to an inner control). B9.7's "focus returns to the chip" stands.
- **T9.25 (the "since the session before" line, and the estimates in the readout and table).** Retitle to "… in the readout and the session cards". Its last case, "it should add both as columns of the table, with 'Unavailable' where there is none", becomes "it should add both as rows of each session card, with 'Unavailable' where there is none". Its sentence builds on the Trade P&L's "since" line, the one place that line still stands on a figure (decision 8). W48's "the line under the charts" is placed under the charts' column of the overlay.
- **Section 4.2's two stage B rows.** T9.24 and T9.25 own "the estimate rows of `replay.props*`, `readout*` and `table*`": this becomes "of `readout.props*`, `readout*`, `cards.props*` and `session-cards*`" (D9A-R's A286 and A277).
- **T9.27 (browser suite), B9.6 and B9.7.** Each opens the replay through the overlay; B9.7's chips at 375 and 320 are measured inside the full-screen overlay.
- **T9.28 (gate), C9.5 and C9.6.** No change to the pass conditions; the critic opens the replay through the overlay.

**Stage C.**
- **T9.29 (the meter) and W51.** "Banked +$400.00" in the meter's name reads "Realized −$440.00" when what was realized is a loss, as everywhere else (D9A-R's W57). One case is added to T9.29 for it.
- **T9.33 (Review card: the meter replaces the slider).** Re-read against decision 3, as the decisions file asks. "The slider" there is the Stop-to-Target slider in the card's header (`StopTargetSlider`), not the replay's. Its four cases stand. Add a note: the card's body now holds a "Replay" button and no chart, so the meter is the only drawing on the card while the Action is written; and `e2e/d5r/review.spec.ts` is also changed by D9A-R's T9AR.20 (line 28, the summary), on different lines from T9.33's five.

---

## 11. Follow-ons and tech debt triggers

**Follow-ons (outline only; none is planned here).**
- **The other screens' names.** Plan and Risk's "Risk to stop", "Reward to target", "Worst case" and "Max reward", and the Review card's "At entry" group, keep the glossary's compact labels. Decision 7's "one name per figure across the app" could be carried to them.
- **Ratios and "$" outside the replay.** Plan and Risk, the Planned list, the exit receipt and the collapsed Review card still format a ratio without fixed decimals; Price History and Today keep convention C3.
- **The odds refined with volatility** (decision 4's note; D9's stage B).
- **A top-edge tag for an off-scale Max reward**, the mirror of W68.
- **A real touch device, a screen reader pass, dark mode and widths under 320**: the coach could not check them, and neither can the suites.
- **D12's Stop Discipline episodes** will reuse A271's runs, as will the Process Scorecard's Stop and Target episodes.
- **The extremes' weight for multi-leg Strategies** (D10): A268's rule covers the four single-leg Strategies only.

**Tech debt triggers.**
- **Item 28** (an Underlying condition reads "Breached" with no alert elsewhere while the contract's Mark is missing): **touched by T9AR.5.** A first crossing is now recorded from the Underlying's reading alone on such a session (A271), so the replay names the crossing while the P&L is Unavailable. It follows `evaluate`, and changes when item 28 is settled.
- **Item 24** (paging hands focus on at either end): its fix moves with the Journal's paging into `card-pager.tsx` (T9AR.17) and now serves two screens.
- **Item 11 and the `PositionChangeForm` focus case** (known flakes): not touched; P151 says what a failure means.
- **Item 25** (the Today table at 960 to 1100 pixels): not touched; with Replay no longer a drawer, the tab row is one tab shorter.
- **Items 3, 8 and 22** (the Review's open, its save cost, the D7S prefactor's slowdowns): not touched; I9AR.4 proves the reads are unchanged.

---

## 12. Open questions for the user

Asked one at a time, in this order. Each answer is recorded here.

1. **The spec amendments (P147).** The frozen specs do not yet know three things D9A-R shows.
   - **The estimated odds.** The glossary has no term for them, and its "Estimate" means a figure from a pricing formula that explains a past price, which the odds are not. Trade Views' invariants say "predictive claims" are absent from the MVP.
   - **The replay's names.** The glossary lists the compact labels a screen may use ("Risk to stop", "Worst case" and four more). "Current Risk · At Stop" and the others you chose are not on that list.
   - **The new results.** Trade Analysis's `evaluate` and `replay` paragraphs do not name the odds, the Plan's terms, the fills against the Plan or the first crossings.
   - **Options:** (a) approve section 1.2's text as written: one glossary term, "No-Edge Odds"; six compact labels; two Trade Analysis sentences; one clause in Trade Views saying the odds are arithmetic on the ratio and not a prediction about a Trade. (b) Edit the text or the term's name. (c) Add an acceptance scenario for the odds as well, as AC-CALC-005 was added for the option estimates.
   - **Recommended: (a).** The odds are one division on two figures AC-CALC-003 already proves, so they are tested under it and need no scenario of their own.
   - **Answered 2026-11-18: (a).** Section 1.2's text is approved as written, "No-Edge Odds" included.

2. **The hole in the P&L chart on a session with no Mark (P146).** The coach asked for "a dashed bridge across the hole", because the area's edges look as if the P&L fell to nothing and came back. Two spec sentences forbid it: the UI contract's "Lines never bridge a dependent missing value", and Trade Views' replay "does not … bridge a gap".
   - **Options:** (a) no bridge: shade the session's column and label it "No Mark" in the P&L chart, as the price chart already does, and run the area up to that column's edge on each side so it ends upright. (b) Reopen the two sentences to allow a dashed connector that is labelled as not a value, and draw it.
   - **Recommended: (a).** It removes the misreading without drawing anything where there is no Mark, and the rest of suggestion 12 is built as the coach asked.
   - **Answered 2026-11-18: (a).** No bridge; the column is shaded and labelled "No Mark", and the area ends upright on each side.

3. **The session cards and the reveal rule (P145).** D9 rests on your rule that nothing of a session after the slider's is on the page, so a Trade can be watched unfolding. Decision 5 says the slider's card is "highlighted and scrolled into view as the slider moves", which could mean every session's card is always there.
   - **Options:** (a) keep the rule: cards exist for the sessions up to the slider's. The slider's card is then the newest one. Choosing an earlier card moves the slider back; moving forward is the slider's or its buttons'. "Scrolled into view" means the cards turn back to the slider's card after you paged to older ones. (b) Every session's card is always there, and the highlight moves among them: the cards then show the ending while you step through.
   - **Recommended: (a).** It keeps the one rule the replay is built around. Today's P&L in the overlay's header stays the only later figure on the page, by your decision 3.
   - **Answered 2026-11-18: (a).** Cards exist only up to the slider's session.

4. **The words W53 to W70 (P149).** Eighteen rows in section 1.6, each with its place, the proposed text in the test Trades' figures, and what it replaces. The ones most worth a look: W56 (the one row for a Trade past a line), W61 (a session with no Mark), W62 (the Plan block), W63 (each Execution against the Plan), W64 (a first crossing) and W70 ("Trade P&L" on the Review card, which decision 7 did not name).
   - **Options:** approve; edit in place; or decline a row, in which case the text it would replace stays.
   - **Recommended: approve**, with P137 letting a task shorten any of them.
   - **Answered 2026-11-18: approved, W53, W54, W56, W57, W58, W59, W60, W61, W62, W63, W64, W65, W66, W67, W68, W69, W70 as written.** W55 is approved with its third heading changed by the user: **"P&L if hit"** (the Trade's P&L if that condition is reached; "P&L if hit", "P&L", "Projected P&L" and "Exit P&L" were weighed, "Projected" declined as reading like a forecast). The same words replace "ends" in W62's Plan block and W65's cards.

5. **The shell's warnings while the overlay is open (P153; raised by the full reading of `specs/`).** Your decision 3 has the replay cover the whole page. Four things the app shows on every screen would then be covered, and could not be pressed, for as long as the overlay is open:
   - **The storage-protection warning**, the icon in the navigation that says the browser may clear the data. The UI contract and the delivery contract both say the UI "keeps a visible warning", and AC-DEL-004 that it "keeps the not-protected warning visible".
   - **The update-available notice.** AC-DEL-002 says the trader "is notified" when a new release is ready.
   - **The read-only banner** ("this browser can't save right now"), which the UI contract asks to give "one clear reason".
   - **The "updated in another tab" and "replaced by a Restore" banners**, each with its Reload button.
   - **What is not in doubt:** the overlay is read-only, so nothing can be lost by saving while a warning is covered; and all four are back the moment it closes. The question is only whether "keeps a visible warning" allows a modal to cover it for a while.
   - **Options:** (a) the shell's notices and banners stay above the overlay, readable and usable, and the overlay's header carries the storage-protection icon with the navigation's own name and link. The overlay still covers the sidebar, the bottom navigation and the page; when no banner exists, which is the usual day, it fills the screen as you decided. Cost: two cases in T9AR.7, one check in B9AR.7, no new words. (b) Cover all four while the overlay is open, reading the spec sentences as "never dismissed" and treating a modal as a short look. Cost: nothing; a note in the UI contract would record the reading. (c) Only the storage icon in the header; the notices and banners are covered.
   - **Recommended: (a).** It keeps every spec sentence true as written, costs two cases, and changes nothing you would see on an ordinary day.
   - **Answered 2026-11-18: (b), in the user's words: "keep them in place, but underneath the replay overlay (it is an overlay)".** The warnings and banners stay where they are on the page, unchanged and never dismissed; the overlay covers them while it is open and they are there again the moment it closes. A note in the UI contract records the reading: a warning covered by a read-only overlay is still kept, not dismissed. The two conditional T9AR.7 cases and the conditional B9AR.7 check are dropped; one T9AR.7 case instead checks that a banner present when the overlay opens is still on the page, unchanged, after it closes.

---

## 13. Acceptance matrix rows

Status values: `planned`, `covered`, `intentionally not advertised`.

| Scenario | Deliverable | Tasks | Integration / browser | Critic | Command or procedure | Expected | Status |
|---|---|---|---|---|---|---|---|
| AC-CALC-003 (cumulative: the estimated odds from the headline risk and reward; each condition's first crossing; an Overrun never shown as zero risk) | D9A-R | T9AR.3, T9AR.5, T9AR.13, T9AR.15, T9AR.20 | I9AR.1, I9AR.2; B9AR.3 | C9AR.4 | `npm run test:integration -- d9ar/odds` | The odds follow the remaining Position's risk and reward and are Not applicable where the ratio is; a crossed Stop shows its Overrun | planned |
| AC-MARK-004 (cumulative: a session with no Mark is a gap in both charts and a dash on its card; nothing is carried or joined across it) | D9A-R | T9AR.11, T9AR.13, T9AR.16, T9AR.17 | B9AR.5, B9AR.6 | C9AR.3 | `npx playwright test e2e/d9ar/states.spec.ts` | "No Mark" is said once; the chart shades the gap and bridges nothing | planned |
| AC-JOUR-001, AC-REV-003 (cumulative: the Action still saves in one press with the Replay button above it; opening, resizing and closing the overlay over a started Action records nothing) | D9A-R | T9AR.9 | B9AR.2 | C9AR.5 | `npx playwright test e2e/d9ar/review.spec.ts` | A started Action survives the overlay; one Save creates one Action | planned |
| AC-CAP-001 (cumulative) | D9A-R | T9AR.6 | I9AR.3 | — | `npm run test:integration -- d9ar/capabilities` | The manifest lists what is reachable | planned |
| AC-PERF-001 (cumulative: reads counted) | D9A-R | T9AR.6 | I9AR.4 | — | `npm run test:integration -- d9ar/query-count` | The replay's and the Review's reads equal stage A's | planned |
| AC-UI-001, AC-UI-002 (cumulative: the overlay through a live resize; keyboard and focus inside it; the charts' text equivalent is the session cards) | D9A-R | T9AR.7, T9AR.8, T9AR.9, T9AR.10, T9AR.12, T9AR.17 | B9AR.1, B9AR.7 | C9AR.1, C9AR.7 | `npx playwright test e2e/d9ar/responsive-a11y.spec.ts` | No sideways scroll; axe clean; the overlay and its session survive a resize; every graphed number is in text | planned |
| AC-DEL-001 (cumulative: the overlay reads after a stopped, offline restart) | D9A-R | T9AR.8 | B9AR.7 | C9AR.7 | `npx playwright test e2e/d9ar/responsive-a11y.spec.ts` | The overlay opens offline | planned |

AC-CALC-005 gains nothing: D9A-R adds no option estimate (the odds are not one; open question 1). AC-RESP-001, AC-DEL-004 and AC-DEL-006 gain nothing: D9A-R adds no mutation. AC-REBUILD-001, AC-BACK-001 and AC-REST-001 gain nothing: D9A-R stores nothing new.

From the full reading: AC-MARK-006 and AC-RPT-004 gain nothing now (Daily Bars are D11's and the Scorecard a later deliverable's), and A271 is written so that both hold when they arrive. Open question 5 was answered (b), so AC-DEL-002 and AC-DEL-004 gain no row: the notices stay in place under the overlay and are unchanged by it.

---

## 14. Evidence recording

Under `evidence/D09AR/`:
- `tdd-log.md` (the note that its rows are single-case runs; `tdd.sh` refuses to run without it) and `tdd-log/<task>.md`;
- `structural.md` (T9AR.1, T9AR.2's before-and-after case titles, T9AR.6, T9AR.21's list of deleted and changed cases, the ocr tables, the suite runs, the critic-cost table), `provenance.md`;
- `critic-<n>.md`;
- `suite-runs/` (lane tiers and merge runs);
- `ocr/`;
- `DECISIONS-PENDING.md` (decision 113, as amended);
- `new-words.md` (words used provisionally);
- `words-changed.md` (P137: each shortened text, by task, with its before and after).

Each critic defect is first reproduced by a failing test.

---

## 15. Progress

Status, not plan: editing this section is not a plan revision (decision 100, amended by decision 111). The main session alone edits it. The rows are in run order, which is also a valid order for running one task at a time.

| Task | Wave | Lane | Status | Commits |
|---|---|---|---|---|
| T9AR.1 | 0 | TL | Done (from `90658cdf`) | `b271d709` |
| T9AR.2 | 0 | TY | Done (from `90658cdf`) | `a8fcaf67` |
| T9AR.3 | 1 | DM | Done (from `8245f6c6`) | `5187512d`; B1 `02b4f51c`; B2 `499751ed` |
| T9AR.4 | 1 | DM | Done (from `79b900d3`) | `955e3568`; F1 `70ddec48` |
| T9AR.5 | 1 | DM | In progress from `70ddec48` | |
| T9AR.6 | 1 | DM | Not started | |
| T9AR.7 | 1 | OV | In progress from `8245f6c6` | |
| T9AR.8 | 1 | OV | Not started | |
| T9AR.9 | 1 | OV | Not started | |
| T9AR.10 | 1 | PL | In progress from `8245f6c6` | |
| T9AR.11 | 1 | PL | Not started | |
| T9AR.12 | 1 | PL | Not started | |
| T9AR.13 | 2 | RO | Not started | |
| T9AR.14 | 2 | RO | Not started | |
| T9AR.15 | 2 | RO | Not started | |
| T9AR.16 | 2 | SC | Not started | |
| T9AR.17 | 2 | SC | Not started | |
| T9AR.18 | 2 | SC | Not started | |
| T9AR.19 | 2 | PL | Not started | |
| T9AR.20 | 2 | RW | Not started | |
| T9AR.21 | 2 | DM | Not started | |
| T9AR.22 | 3 | IN | Not started | |
| T9AR.23 | 3 | BR | Not started | |
| T9AR.24 | 3 | — | Not started | |

---

## Appendix: lookup output

Run on `bbc3ae28`. Each line of output is a count of matching lines and a file. Test files are those under `e2e/` or `tests/`, or named `*.test.*`.

**The reading done for this draft.** Read in full: `specs/README.md`, `specs/glossary.md`, `specs/design/ui-contract.md`, `trade-analysis.md`, `trade-views-and-reporting.md`, `daily-review.md`, ADR 0001 and ADR 0007, and the acceptance scenarios AC-REV-003, AC-MARK-004, AC-CALC-003, AC-CALC-004, AC-CALC-005, AC-UI-001 and AC-UI-002. Those were read for the first draft, and the rest only searched.

**The full reading, 2026-11-18, after the four answers.** Every text file under `specs/` has now been read in full: the files above, and `specs/design/overview.md`, `delivery-contract.md`, `journal.md`, `market-data.md`, `performance-analysis.md`, `reference-catalog.md`, `trade-record.md`, `trade-workflows.md` and `workspace.md`; ADR 0002, 0003, 0004, 0005, 0006, 0008, 0009, 0010 and 0011; `specs/evaluation/planning-protocol.md`, `traceability.md` and `kickoff-prompt.md`; `specs/reference/ui-screenshots/index.md`; and the whole of `specs/acceptance/acceptance-contract.md`. Of the 24 prototype screenshots, two were opened (`proto-add-fill-desktop.png`, a form over a dimmed page, and `proto-position-detail-stock.png`); the index says all 24 inform density and hierarchy only, and it lists no replay, Review or overlay reference. What the reading found, and where the draft changed:

| Spec passage | What it means for D9A-R | Change |
|---|---|---|
| UI contract, delivery contract, AC-DEL-004: the UI "keeps a visible warning" when storage is not Protected; AC-DEL-002: the trader "is notified" of an update; the read-only banner | A whole-page modal covers them while open. Answered (b): they stay in place underneath it; a note in the UI contract records the reading. | P153; open question 5; one case in T9AR.7 |
| Glossary: a compact label is allowed while "the full term remains available in help and accessibility text" | Decision 7 renames the one place the canonical risk and reward terms are on screen. | A287; one case each in T9AR.13 and T9AR.20; a check in B9AR.3 |
| Trade Analysis: conditions "remain independently visible even when a headline nearest boundary is available"; AC-CALC-003: each condition keeps its own status | The Plan block and the crossings must cover every Stop and Target, not the headline one. | A269, A271; one case each in T9AR.4, T9AR.5 and T9AR.18 |
| UI contract: "Acknowledged Unavailable is visibly a trader acknowledgment, not a price"; AC-UI-002: the states "are not conflated"; Market Data: an acknowledged key stays open to a later Mark | "No Mark for …" must not word an acknowledged Mark. | A281; one case in T9AR.16; a step in B9AR.6 |
| Market Data: ranges "never interpolate, carry forward, connect across absence" | A third sentence behind the answered "no bridge". | P146 |
| Market Data's Daily Bar rules, AC-MARK-006; Performance Analysis's Stop and Target episodes, AC-RPT-004; Trade Analysis: a run ends on "condition replacement/retirement" | A271's runs must hold when Daily Bars, the Scorecard and Management Revisions arrive. | A271; section 11; section 13's note |
| Reference Catalog: eleven Strategy shapes, the Covered Call among them | "Any short option leg" is right only for the single-leg Strategies. | A268; section 11 |
| Performance Analysis and traceability: no automated good or bad judgment, no composite score | A fill "against the Plan" states a side and a distance, never a verdict. | A270 |
| AC-UI-001 and AC-JOUR-001: a live resize keeps the route and unsaved fields; only Save captures evidence | The overlay, the page under it and a started Action must survive a resize. | A273; B9AR.7; section 13's AC-REV-003 row now names AC-JOUR-001 |
| UI contract: right-aligned tabular numerals; 4.5 to 1 contrast; touch targets | The grid's figures, the grey extremes and the overlay's buttons. | A278; B9AR.3; B9AR.7 |
| Planning protocol: the layer-only exception gate | D9A-R is a vertical deliverable, so no exception is needed. | P139 |
| Acceptance contract, lines 462 to 468 (AC-DEL-002) | Not in D9's reading list. | A284 |

Read and found to need no change: ADR 0002's rule that navigation is not a domain-changing command (the overlay's address); the Journal, Trade Record, Trade Workflows and Workspace contracts (D9A-R writes nothing and stores nothing; a backup already leaves out replay projections); the delivery contract's offline, update and rebuild-equivalence rules (the new figures are pure derivations); ADR 0009, 0010 and 0011; the kickoff prompt.

**Texts: the Review card's summary** (`grep -rnE 'Ongoing Risk to Stop|Worst-Case Ongoing Risk|Incremental Reward to Target|Reward : risk now|Reward : risk planned' src e2e tests tools`, code files only; `.claude` holds no hit outside session records):

```text
src/ui/screens/CardFigures.tsx:32,33,34,85,86   the five terms (changed by T9AR.20); :67 a comment
src/ui/screens/CardFigures.test.tsx             18 lines (changed)
src/ui/screens/ReviewCard.test.tsx              14 lines (changed)
e2e/d4/review.spec.ts:47,48,49                  (changed)
e2e/d5r/review.spec.ts:28                       (changed)
e2e/d7sp/review-dated-line.spec.ts:33           (changed)
src/coordinators/workspace/capabilities.ts:99                a comment (stays)
src/coordinators/daily-review/save-marks.test.ts:66          a test title (stays)
src/coordinators/daily-review/daily-review.test.ts:886,945   test titles (stay)
src/coordinators/trade-views/current-evaluation.test.ts:36   a test title (stays)
src/domain/trade-analysis/evaluate.test.ts:70,319,346,380,486,487,492   test titles (stay)
src/domain/trade-analysis/evaluate-conditions.test.ts:86,96  test titles (stay)
src/domain/trade-analysis/evaluate.ts:160                    a comment (stays)
tests/integration/d5r/range-and-baseline.test.ts:1           a comment (stays)
```

**Texts: the replay's own words** (each pattern over the folders in brackets):

```text
### Session by session   [e2e tests src]
1 e2e/d9/support.ts
5 src/ui/cockpit/replay/frame.test.tsx
2 src/ui/cockpit/replay/replay.props.test.ts
### Current Risk at|P&L at |Remaining Reward at   [e2e/d9 src/ui/cockpit/replay]
3 e2e/d9/replay.spec.ts
10 src/ui/cockpit/replay/replay.props.test.ts
### openTable|tableRow\(   [e2e/d9]
8 e2e/d9/gaps.spec.ts
7 e2e/d9/replay.spec.ts
5 e2e/d9/states.spec.ts
1 e2e/d9/support.ts
### Stop Overrun|Target Overrun   [e2e/d9 src/ui/cockpit/replay]
2 e2e/d9/gaps.spec.ts
2 e2e/d9/replay.spec.ts
1 e2e/d9/support.ts
3 src/ui/cockpit/replay/frame.test.tsx
6 src/ui/cockpit/replay/replay.props.test.ts
### Past Stop's amount / Past Target's amount / Not triggered   [e2e tests src]
1 / 1 / 2 src/ui/cockpit/replay/replay.props.test.ts
### Stop breached|Target reached   [e2e/d9 src/ui/cockpit/replay]
2 e2e/d9/gaps.spec.ts
3 e2e/d9/replay.spec.ts
1 e2e/d9/review.spec.ts
1 e2e/d9/states.spec.ts
20 src/ui/cockpit/replay/replay.props.test.ts
### Mark missing|No Mark   [e2e/d9 src/ui/cockpit/replay]
10 e2e/d9/gaps.spec.ts
2 e2e/d9/states.spec.ts
5 src/ui/cockpit/replay/frame.test.tsx
2 src/ui/cockpit/replay/price-strip.test.tsx
14 src/ui/cockpit/replay/replay.props.test.ts
### since (Mon|Tue|Wed|Thu|Fri) Nov   [e2e/d9 src/ui/cockpit/replay tests/integration/d9]
2 e2e/d9/gaps.spec.ts
6 src/ui/cockpit/replay/frame.test.tsx
5 src/ui/cockpit/replay/replay.props.test.ts
### 'Banked' as a readout row   [e2e/d9]
e2e/d9/gaps.spec.ts:54 (reads "−$440.00": changed); e2e/d9/replay.spec.ts:41,62,68, e2e/d9/review.spec.ts:48, e2e/d9/states.spec.ts:61 (gains: stay)
### (BREN|CORV|DALE|AXIO) Mark   [e2e/d9 src/ui/cockpit/replay]
1 e2e/d9/gaps.spec.ts
1 e2e/d9/replay.spec.ts
1 src/ui/cockpit/replay/corridor.test.tsx
8 src/ui/cockpit/replay/frame.test.tsx
2 src/ui/cockpit/replay/price-strip.test.tsx
8 src/ui/cockpit/replay/replay.props.test.ts
### Mark: [0-9$]  (the hover's lines)   [src/ui/cockpit/replay]
3 src/ui/cockpit/replay/corridor.test.tsx
1 src/ui/cockpit/replay/frame.test.tsx
4 src/ui/cockpit/replay/replay.props.test.ts
### [0-9] to 1   [e2e/d9 src/ui/cockpit/replay src/ui/screens]
3 e2e/d9/replay.spec.ts
3 src/ui/cockpit/replay/replay.props.test.ts
### At the Stop|At the Target   [e2e src/ui tests]
1 src/ui/cockpit/replay/frame.test.tsx
2 src/ui/cockpit/replay/replay.props.test.ts
### dollars for the whole Position   [e2e tests src]
1 e2e/d9/replay.spec.ts
1 e2e/d9/responsive-a11y.spec.ts
1 src/ui/cockpit/replay/replay.props.test.ts
### axis-end|endLabel   [e2e/d9 src/ui/cockpit/replay]
1 src/ui/cockpit/replay/corridor.test.tsx
1 src/ui/cockpit/replay/frame.test.tsx
4 src/ui/cockpit/replay/price-strip.test.tsx
2 src/ui/cockpit/replay/replay.props.test.ts
### Break-even   [e2e/d9 src/ui/cockpit/replay]
1 e2e/d9/replay.spec.ts
2 e2e/d9/responsive-a11y.spec.ts
1 src/ui/cockpit/replay/corridor.test.tsx
### Risk \$|Reward \$  (the phone's stake tags)   [e2e/d9 src/ui/cockpit/replay]
2 e2e/d9/replay.spec.ts
1 e2e/d9/responsive-a11y.spec.ts
8 src/ui/cockpit/replay/corridor.test.tsx
4 src/ui/cockpit/replay/replay.props.test.ts
### replay-hover|getByTestId('hover')   [e2e/d9 src/ui/cockpit/replay]
3 src/ui/cockpit/replay/frame.test.tsx
### Current Marked Trade P&L   [e2e src/ui tests]
1 e2e/d4/review.spec.ts
1 e2e/d5r/review.spec.ts
1 e2e/d7sp/review-dated-line.spec.ts
5 src/ui/screens/CardFigures.test.tsx
5 src/ui/screens/ReviewCard.test.tsx
2 src/ui/screens/ReviewCards.test.tsx
1 src/ui/cockpit/drawers/today.props.test.ts (stays)
1 src/ui/cockpit/rail/pnl.props.test.tsx (stays)
2 src/ui/screens/CardMarks.test.tsx (stays)
1 src/ui/screens/TradeDetail.test.tsx (stays)
3 src/ui/screens/TradeList.test.tsx (stays)
```

**Texts: how the replay is opened** (`openDrawer(<page>, 'Replay')`, `drawer-panel-replay`, `drawer-tab-replay`, `review-card-replay`, `cardReplay(`, over `e2e src tests`; and `drawer=replay`):

```text
1 e2e/d5r/durability.spec.ts
3 e2e/d9/gaps.spec.ts
5 e2e/d9/replay.spec.ts
10 e2e/d9/responsive-a11y.spec.ts
5 e2e/d9/review.spec.ts
5 e2e/d9/states.spec.ts
2 e2e/d9/support.ts
2 src/ui/app.css
1 src/ui/screens/ReviewCard.tsx
3 src/ui/screens/TradeDetail.test.tsx
7 src/ui/screens/TradeDetail.test.tsx   (drawer=replay)
```

**Shapes** (`grep -rlE 'riskChange|rewardChange|planColumn|positionChangeIds|"markers"' tests/fixtures bench tools`: no output). `rewardRiskNow`, showing which fixtures hold a `TradeEvaluation` (`grep -rc rewardRiskNow tests/fixtures`):

```text
tests/fixtures/backup-v3-blocked/expected-views.json:9
tests/fixtures/backup-v4-blocked/expected-views.json:11
tests/fixtures/backup-v5-blocked/expected-views.json:26
tests/fixtures/backup-v6-blocked/expected-views.json:31
tests/fixtures/backup-v7/expected-views.json:34
tests/fixtures/workspace-v5/expected-views.json:26
tests/fixtures/workspace-v6/expected-views.json:31
tests/fixtures/workspace-v7/expected-views.json:34
```

**Names** (`grep -rnE '<name>' tools src e2e tests .claude`, worktrees left out):

```text
### riskChange|rewardChange
1 src/coordinators/trade-views/replay-trade.test.ts
2 src/coordinators/trade-views/replay-view.ts
5 src/domain/trade-analysis/replay-series.test.ts
6 src/domain/trade-analysis/replay-series.ts
2 src/ui/cockpit/replay/replay.props.test.ts
2 src/ui/cockpit/replay/replay.props.ts
10 tests/integration/d9/gaps.test.ts
### DRAWERS
2 e2e/d8p/responsive-a11y.spec.ts
2 e2e/d8r/responsive-a11y.spec.ts
2 e2e/d8r/states.spec.ts
1 e2e/d8r/support.ts
2 src/ui/screens/trade-detail/Cockpit.tsx
3 src/ui/screens/trade-detail/drawer-request.ts
### ReplayDrawer
2 src/ui/cockpit/drawers/replay.test.tsx
2 src/ui/cockpit/drawers/replay.tsx
2 src/ui/screens/ReviewCard.tsx
2 src/ui/screens/trade-detail/Cockpit.tsx
### tableRow|tableColumns|tableTitle|TableRow
6 e2e/d9/gaps.spec.ts
4 e2e/d9/replay.spec.ts
3 e2e/d9/states.spec.ts
1 e2e/d9/support.ts
6 src/ui/cockpit/replay/frame.test.tsx
7 src/ui/cockpit/replay/frame.tsx
10 src/ui/cockpit/replay/replay.props.test.ts
5 src/ui/cockpit/replay/replay.props.ts
5 src/ui/cockpit/replay/replay.types.ts
2 src/domain/session-policy/digest.ts, policy.ts, table.ts, types.ts each; 2 tests/integration/d4/policy-revision.test.ts (an unrelated name: stay)
### replay-table
1 e2e/d9/support.ts
1 src/ui/cockpit/replay/corridor.test.tsx
5 src/ui/cockpit/replay/frame.test.tsx
3 src/ui/cockpit/replay/frame.tsx
3 src/ui/cockpit/replay/price-strip.test.tsx
1 src/ui/cockpit/replay/replay.props.test.ts
1 src/ui/cockpit/replay/replay.props.ts
10 src/ui/cockpit/styles/replay-frame.css
### review-card-replay
1 e2e/d5r/durability.spec.ts
1 e2e/d9/responsive-a11y.spec.ts
2 e2e/d9/review.spec.ts
1 e2e/d9/support.ts
2 src/ui/app.css
1 src/ui/screens/ReviewCard.tsx
### pnlShortTitle|priceShortTitle
1 src/ui/cockpit/replay/corridor-pnl.tsx
2 src/ui/cockpit/replay/corridor.test.tsx
1 src/ui/cockpit/replay/price-strip.test.tsx
1 src/ui/cockpit/replay/price-strip.tsx
2 src/ui/cockpit/replay/replay.props.test.ts
2 src/ui/cockpit/replay/replay.props.ts
2 src/ui/cockpit/replay/replay.types.ts
### status\.sh
2 .claude/docs/implementing.md
5 .claude/scripts/status.sh
2 .claude/scripts/status.test.sh
```

**Checks** (throwaway runs):

```text
$ .claude/scripts/full-suite.sh --current-folder evidence/D09AR
e2e/d9ar
$ .claude/scripts/full-suite.sh --current-folder evidence/D09A-R
cannot derive an e2e folder from: evidence/D09A-R        (exit 2)
$ .claude/scripts/status.sh D09A-R        (on this draft)
Open tasks (D09A-R): the 24 rows of section 15, each "Not started"
Open questions:
  no decisions file (…/evidence/D09A-R/DECISIONS-PENDING.md)        (the line T9AR.1 changes)
$ .claude/scripts/acceptance-commands.sh plan/D09A-R-stage-a-refactor.md        (on this draft, list mode only)
summary: 7 commands checked, 7 failed, 0 rows are procedures, not checked
```

The acceptance script reads all seven rows of section 13. Each fails today because its test file does not exist yet ("0 tests", "no tests"); T9AR.22 and T9AR.23 create them under the names section 7 gives.

**Texts: the stake row's format and the ratio's Plan part** (`readoutPnl|replay-pnl|pnl: \{|· P&L`, then `\(the Plan was|\(Plan [0-9]`, over `e2e/d9 src/ui/cockpit/replay`):

```text
5 e2e/d9/gaps.spec.ts
6 e2e/d9/replay.spec.ts
1 e2e/d9/support.ts
5 src/ui/cockpit/replay/frame.test.tsx
4 src/ui/cockpit/replay/replay.props.test.ts
---
2 e2e/d9/replay.spec.ts
3 src/ui/cockpit/replay/replay.props.test.ts
```
