# D09 — Trade replay: task breakdown

Definition: [implementation plan, D9](implementation-plan.md#d9--trade-replay), as amended by decision 110. Requirements: `research/replay-requirements.md` (the interview and two rounds of prototypes) and `plan/D09-drafting-handoff.md`. The pictures are `prototypes/replay/round-2.html` (the Corridor tab) and `prototypes/replay/trade-list.html` (the meter). Drafted on `claude-opus-5.5` at `85a7630e` (`claude-opus-5.5-d8r`), after D8R's gate, so every lookup below was run on the tree D9 is built on.

Status: **breakdown agreed by the user on 2026-11-17** (plan revision 106, decision 117). The ten open questions in section 12 were answered that day, one at a time, and the breakdown was updated to match before it was agreed. The amendments in section 1.2 were applied in revision 106. The next plan decision is 118. Numbering continues from D8R: P118, A247 and W35.

**Amended by D9A-R (decision 118).** [D09A-R-stage-a-refactor.md](D09A-R-stage-a-refactor.md) runs between stage A and stage B. The replay opens as an overlay; the table is session cards; the readout's stake is a grid; reward to risk carries estimated odds.

**In the trader's words.**
- **Replay** is one screen that says how a Trade is going. On top, the Underlying's price. Under it, the Trade's profit or loss as a green or red area, drawn between two lines: what the Trade would make at its Stop and at its Target. A sentence above them reads the trade-off: what you risk from here, and what is left to gain.
- **A slider** steps back through the sessions, so you can watch the Trade unfold. It opens on the session you are reviewing, so it reads without touching anything.
- **Buying more or selling part shows.** The two lines step, and profit you have banked becomes a solid band no later Mark can change.
- **It is in two places:** in the Daily Review card, just before the Action, and in Trade Detail. Both open the replay as an overlay (D9A-R).
- **For options, three estimates** sit under the chart: implied volatility, how many shares the Position behaves like, and how much of the option's move came from the Underlying, from time passing and from volatility. They are labelled estimates. They help you catch a wrong Mark and learn how options move. They never change a P&L or a risk figure.
- **A Stop-to-Target meter** shows where each Trade stands at a glance: on each Review card, on each row of the Open list, and on Trade Detail. The Open list goes into the Review's order, so the Trades that need you are at the top.

---

## 1. Decisions and clarifications

### 1.1 Decisions for this breakdown

The user has already decided (handoff section 4): D9 builds Corridor; the result leads and the stake follows; colour follows the result; price and P&L are on screen together at 1280, 375 and 320 px; a slider reveals sessions and nothing later is on the page; Executions show; the option's Mark is not a charted line; the chart is in the Review card and in Trade Detail; Ribbon is deferred but planned for; implied volatility, the share equivalent and the split are in D9, by the textbook formula, as estimates; the meter goes in three places; the Open list leans toward attention order. The rows below are the planner's proposals.

| # | Question | Recommendation | Alternatives and tradeoff |
|---|---|---|---|
| P118 | **Size.** 40 tasks, and ten questions for the user (section 12). The drafting guide's limit is 25 tasks or five questions. (Open question 1; **answered 2026-11-17: as recommended**.) | **One breakdown, run as three stages, each with its own session, suites and fresh critic** (section 1.4): **A**, the replay chart; **B**, the option estimates; **C**, the meter and the Open list's order. The benchmark runs once, after stage C. | (a) One run of 39 tasks with a checkpoint critic: no stage gates, but D8R's 28 tasks took 16.6 hours and three critics. (b) Three separate deliverables with their own files and names: the same work, with three sets of handoffs and tags. |
| P119 | **Swarm or serial.** (Open question 2; **answered 2026-11-17: a swarm for stage A only**, the user's choice over the recommendation.) | **Stage A is a swarm** (decision 111), agent cap 4: its wave 1 runs Trade Analysis, the chart's frame and the chart's plot at once. **Stages B and C run one task at a time** (decision 100). | A swarm in every stage, the draft's recommendation: about 3 hours less on B and 4 on C, with the merge work a swarm brings. Serial throughout: about twice the time on A. |
| P120 | **Who works out each per-session figure** (handoff section 5, item 1). | **Trade Analysis.** `evaluate` gains the Trade's result at the Stop, at the Target, at the Worst case and at the Max reward, and where the result stands between them (A248, A249). `replay` returns `evaluate`'s figures and condition status for every session (A250), the markers and the Plan column (A251, A252). The coordinators pass them through. | Trade Views does the sums: it would put arithmetic in a coordinator and give the meter a second copy of it. |
| P121 | **Keeping estimates apart from exact figures** (item 2). | **A separate pure module in floating point, `src/domain/option-pricing/`, read by one file, `replay-estimates.ts`. Its results have their own type, `Estimate`, which holds a plain number and never a `Rational`.** An ESLint rule keeps both files from being imported anywhere else and from building an exact value (A258). `Rational` has no constructor from a number, so the type system already blocks the direct path. | Estimates as `CalculationResult<Rational>`: nothing would stop one from being added to a P&L. |
| P122 | **The interest rate** (item on rates; the interview gave 4% short-term and 5.25% long-term). (Open question 3; **answered 2026-11-17: the two rates and the 365-day line as recommended; the rates are not shown beside the estimates, only on the About page**.) | **Two constants in code, chosen by days to expiration: 4% up to 365 days, 5.25% beyond.** The About page states both rates and the formula's limits once (W50). The chart shows no rate: each estimate carries only its "estimate" tag. The rate used still comes back with each estimate, for the tests and the evidence. | A Workspace setting: a schema change that reaches every layer, and a specialist input the trader shouldn't have to supply. A dated rate table: more accurate for old Trades, but the rate moves a short-dated option's implied volatility very little. |
| P123 | **The spec amendments** (items 3 and 4). (Open questions 4 and 5; **answered 2026-11-17: the amendments approved as written, and AC-CALC-005 added**.) | **Amend ADR 0007, the spec index, the glossary, Trade Analysis's `replay` and `evaluate` paragraphs and the UI contract, and add one acceptance scenario, AC-CALC-005** (section 1.2 holds the text). The UI contract's sentence "Mark-to-Market replay and Expiration Payoff remain separate views" needs no change: Corridor draws no payoff line. | No acceptance scenario: the estimates would be an advertised capability with no row in the matrix. |
| P124 | **The expiration session.** The prototype reads every figure as "Settled" on the expiration session. | **Keep the app's rule.** The expiration session has a Mark and is valued with it (P25). After it, an unrecorded contract is Settlement Due and the replay ends at that session (revision 98). Once the outcome is recorded, the Trade is Closed and its last session reads "Final result". | The prototype's rule: it would have replay disagree with Today and the Review on the same session. |
| P125 | **A Closed Trade's replay** (interview decision 11). | **The last session shows the final result and how the Trade ended** (sold, or expired). Nothing is at stake. No payoff line. | A payoff line on a Closed Trade: it needs the UI contract amended, and the user did not ask for it after round 2. |
| P126 | **A moved Stop** (item 6). | **Nothing to build now.** The two lines are worked out for each session from the conditions in force that session, so a Management Revision will step them where it happens, as a sale does. D17 adds the revision's marker and its test, since no Trade can have one before D17. | Planning the marker now: it could not be tested through the UI. |
| P127 | **Where the Review card's replay comes from.** `replayTrade` takes a Trade Detail's binding and ends at the latest session. The card needs the replay to end at the Review Date. | **`DailyReview.getTrade` returns the replay, ending at the Review Date**, as `specs/design/daily-review.md` already says it does. Both coordinators call one shared assembly, `src/coordinators/replay/`, as they share `valuation/` today. | The card calling `replayTrade`: a second read with a different end date and no Detail binding to give it. |
| P128 | **Replay on Trade Detail.** | **A seventh drawer, "Replay", second after Today**, on every Detail that has Today (W1 amended, W35). | Inside Today: Today would no longer fit one screen. Replacing Price History: Price History holds each Mark's source and correction, which replay leaves out. Superseded by D9A-R's decision 3: Replay is an overlay opened by a button. |
| P129 | **Leaving the Review and coming back.** | **The address carries it.** The card's "Price History" link opens Trade Detail with the drawer, the session and `from=review` in the address; "Back to the Review" returns to that Trade's card, its Action panel and the slider's session (A257). The Review Date needs nothing: the Review opens the latest completed session, the only one installed. | Held state in memory: lost on reload. |
| P130 | **The meter on Trade Detail** (item 7). (Open question 6; **answered 2026-11-17: as recommended**.) | **At the top of the rail's Conditions card.** That card already holds each condition's distance. | In the P&L card: beside the figure it describes, but away from the Stop and Target it runs between. |
| P131 | **The Open list in attention order** (item 8; the user's lean). (Open question 7; **answered 2026-11-17: attention order for now, built so that sorting and filtering can be added to the Trades list later**.) | **Do it, with one spec sentence** (section 1.2). The cost is small: the Open list is already read and valued in full, so the order is a sort in Trade Views with no extra read (section 1.5, "The Open list's order"). A262 says how it stays open to later sorting and filtering. | Keep Last Activity order: no spec change, and the meter is then only a status cue. |
| P132 | **What the meter reads** (item 9). (Open question 8; **answered 2026-11-17: remove `rangePosition` now**, the user's choice over the recommendation.) | **A new finished value, the meter reading (A260), replaces `rangePosition`, which T9.40 removes.** `rangePosition` is in eight frozen fixtures' expected views (84 places). T9.40 deletes exactly those 84 entries, with a diff check that nothing else in the files changed, as T8R.20 did for `nearest`. The backup data itself does not change. | Keep it returned and unread, the draft's recommendation: no frozen file changes, and a figure no screen shows. |
| P133 | **The faint mark for the session before, on the list and the Review cards.** It needs each Trade's P&L at the session before. (Open question 9; **answered 2026-11-17: as recommended**. If the benchmark after stage C fails, decision 114 applies and the user chooses between a fix and taking the mark off the list.) | **Build it as accepted, and prove the cost.** One more date's Marks are read per page, never per Trade, and each Trade is valued a second time. Integration cases count the reads; the benchmark after stage C checks the budget. | Leave the mark off the list and the collapsed cards, keeping it on Trade Detail, where the replay already holds it. Open question 9. |
| P134 | **Left out of D9.** | **Deviation markers** (Stop Discipline episodes arrive with D12); **the lowest and highest result so far** (neither Corridor nor the accepted meter draws them); **the Plan's Worst case and Max reward** (Corridor's Plan column draws only the two lines); **spreads** (D10); **Daily Bar candles** (D11). | Each is a field nothing in D9 would show. |
| P135 | **Words.** (Open question 10; **answered 2026-11-17: W1 as amended and W35 to W52 are all approved**, built as the prototype has them, under P137.) | **Section 1.6 holds W35 to W52, from the prototype's own text.** During the run, D8R's rule applies: words no row covers are used provisionally and listed for approval. | — |
| P138 | **Run rules** (the user, 2026-11-17, after agreeing the breakdown: "take both of those D8R rules"; part of revision 106). D8R's advance answers, decision 116 (3) and (4), were for D8R only. | **Both apply to every stage of D9.** (1) **The critic limit:** if three critics at one gate leave only moderate or lower defects, the session closes that gate, records each remaining defect as a tech debt item in `plan/implementation-plan.md`, and lists them in the stage's report. A remaining high defect, or a FAIL, still stops the run. This replaces `.claude/docs/critic-brief.md`'s cap for D9. (2) **Known flaky cases:** if tech debt item 11's case (`TradeList.test.tsx`, the Ready state) fails a run, the runner reruns it alone once; a pass is logged as a flake, with the run, and the run continues; two failures in a row are a pending decision. The planner's reading, for the user to correct: the same holds for the `PositionChangeForm` focus case that D8R's final report names as a suspected flake. Any other failing test is a failure. | Stopping for each: the default the handoff first carried. |
| P137 | **Too much text** (the user's rule, 2026-11-17, with open question 10: "err on the side of being too concise, not too verbose"). | **Each task that puts words on screen judges whether they should be shorter, and shortens them when it thinks so. The user has approved this in advance.** What a task may do: use fewer words for the same meaning; drop a label from the chart; move part of a sentence to the readout, the hover or the table. What it may not do: lengthen anything; change a figure or how it is worked out; take a figure off the page altogether (each stays in the readout or the table); or change what a planned case tests. When a planned case quotes words that are shortened, the case's quoted words change to match and nothing else in the case does. Every change is recorded with its before and after in `evidence/D09/words-changed.md`, by task, and listed in the stage's final report. Section 1.6 keeps the approved wording as the starting point. | Leave every word as approved and judge the built chart at each gate: the chart would reach the user crowded first. |
| P136 | **A third browser stage.** `browser-2` took 8.9 minutes at D8R's gate, and D9's folder would join it. | **T9.1 adds `browser-3`** for `e2e/d8p`, `e2e/d8`, `e2e/d8r` and `e2e/d9`, as `.claude/docs/implementing.md` says to do above 8 minutes. | Leave it: the stage would pass the Bash tool's 10-minute limit during stage A. |

### 1.2 Amendments to other plan sections (applied in revision 106, except where a task is named)

- **Implementation plan.** The D9 definition gains: the three stages; the estimates (decision 117); the meter and the Open list's order; `DailyReview.getTrade`'s replay. The deliverable summary's D9 row is renamed "Trade replay, option estimates and the Stop-to-Target meter". The Parallelism section's "D9 ∥ D13" and "D9 ∥ D14" lines gain a note: stage C changes the shared Trade List read model, so only stages A and B are safe beside them.
- **`specs/adr/0007-observed-valuation-and-expiration-payoff.md`.** The second paragraph's sentence becomes: "The application does not project tomorrow's option value, and no valuation requires volatility, rate, or dividend assumptions." A new paragraph is added at the end:
  > Amended by plan revision 106. The application may read an option's implied volatility back from an observed Mark, using the same session's Underlying Mark, the contract's terms and a stated interest rate, to explain a past change in that Mark. That figure, and any figure worked out from it (the Share Equivalent and the Mark Change Split), is an Estimate. An Estimate is labelled as one wherever it shows. It is never a Mark, and it never enters a valuation, a risk or reward figure, a condition's status, a Deviation, a report or a stored fact. The textbook formula is used (Black-Scholes: exercise at expiration only, no dividends), and its limits and assumed rates are stated in the application.
- **`specs/README.md`**, line 37: "theoretical option pricing" becomes "theoretical option pricing as valuation or projection (ADR 0007 allows labelled Estimates that explain an observed Mark)".
- **`specs/glossary.md`**, under "Market observations and valuation", four terms:
  - **Estimate**: a figure worked out from observed Marks through a pricing formula and stated assumptions, to explain a past price. Always labelled; never a Mark and never an input to an exact calculation. Avoid: theoretical price, fair value, forecast.
  - **Implied Volatility**: the Estimate of the volatility at which the formula returns an option's exact Mark, given the same session's Underlying Mark. Unavailable when either Mark is missing or no volatility fits. Avoid: historical volatility, a trader-entered volatility.
  - **Share Equivalent**: the Estimate of how many shares of the Underlying an option Position's value currently moves like. Exact for stock. Avoid: delta as a risk figure.
  - **Mark Change Split**: the Estimate that divides one session's change in an option's Mark between the Underlying's move, time passing and Implied Volatility changing. The parts and any unexplained remainder add up to the real change. Avoid: P&L attribution as fact.
- **`specs/design/trade-analysis.md`.**
  - `evaluate`'s list gains: "the Trade's result at its headline Stop, at its headline Target, at its structural worst case and at its structural maximum, and where the marked result stands between them".
  - `replay`'s paragraph gains: "For an option it also returns each session's labelled Estimates: Implied Volatility, Share Equivalent and Mark Change Split. No other result reads them."
- **`specs/design/ui-contract.md`**, "Numbers, availability, and graphs", one sentence: "An Estimate is labelled as an estimate, is drawn unlike a Mark, and is Unavailable with its reason when it can't be worked out."
- **`specs/design/trade-views-and-reporting.md`**, `browseTrades` (open question 7): after "with fixed factual sorts and bounded pagination", add "The Open list is a single page that is valued in full, and its default order is the Daily Review's attention order at the current Expected Mark Date; Planned and Closed keep their factual sorts." It says "default" so that a later sort choice adds to the sentence and doesn't contradict it.
- **`specs/acceptance/acceptance-contract.md`**, after AC-CALC-004, a new scenario:
  > **AC-CALC-005 — Estimates explain and never value.** **Given:** an option Trade with exact Marks for its contract and its Underlying over several sessions, one session with the contract's Mark missing, and one Mark at the contract's exercise value. **When:** its replay is read. **Then:** each session's Implied Volatility reproduces that session's Mark through the stated formula and rate; the Share Equivalent and the Mark Change Split are returned as Estimates, and the split's parts add up to the Mark's real change; each is Unavailable with a stable reason where it can't be worked out; a stock Trade's are Not Applicable or exact; and every Trade P&L, risk, reward and condition status is the same whether or not an Estimate is available. **Evidence:** the per-session results, the formula's inputs, and the exact figures compared with and without the Estimates.
- **Spec map.** The line ranges and character counts of the six amended files are recalculated. D9's tags are added to: Trade Analysis `evaluate`; Daily Review's "Date, eligibility, and ordering" and `getTrade`; Trade Views' `browseTrades`; AC-CALC-003 (S052); AC-CALC-005. The reading lists are regenerated with `.claude/scripts/spec-reading-lists.py`.
- **Acceptance matrix.** Rows in section 13; one new row for AC-CALC-005.
- **D08P and D8R breakdowns.** A note under each status line names what D9 changes: W1's drawers per state gain Replay (T9.14); `StopTargetSlider` and its words (D5R's P39) are replaced by the meter (T9.33), and P39's range position is removed (T9.40), with D5R's cases that assert it re-pointed at the meter reading; A211's "no condition status, Deviations or markers" is now met for condition status and markers.
- **`.claude/docs/implementing.md`, `.claude/agents/suite-runner.md`, `.claude/scripts/`:** the `browser-3` stage (T9.1).

### 1.3 Working assumptions

These are implementation-level choices. They stand unless you object.

| # | Assumption |
|---|---|
| A247 | **Scope by instrument.** D9 covers what the app can hold today: stock, a long Call, a long Put and a Cash-Secured Put. `evaluate` values one Instrument per Trade, so the prototype's two spreads wait for D10, which extends `replay` to several legs. |
| A248 | **The Trade's result at each boundary** (`evaluate`, T9.3). `TradeEvaluation` gains `outcomes: { atStop, atTarget, atWorstCase, atMaxReward }`, each a Calculation Result in dollars. Each is the realized P&L to date plus the remaining Position priced at that boundary, less its unconsumed opening fees. The Stop and Target are the role's headline condition at its measurement value (A197; for an option's Underlying-price condition, the contract's value at expiration at the trigger, decision 31). None of the four reads a Mark, so they hold on a session whose Mark is missing. `atMaxReward` is Unbounded above for stock and a long Call. All four are Not Applicable once nothing is held. They are additive. |
| A249 | **Standing** (`evaluate`, T9.3). `TradeEvaluation` gains `standing`, a Calculation Result holding: the zone (`Between`, `PastStop` or `PastTarget`); `pastBy`, the dollars and R beyond that line, with `crossed` saying whether the condition itself is Breached or Reached (it is false when an Underlying-price Stop's dollar amount is passed while the Underlying has not reached the trigger, the prototype's decision B7); `share`, present only in the `Between` zone: the result as a fraction of the result at the Target when it is above break-even, or of the result at the Stop when it is below, and absent at break-even; and `openProfitAtRisk`, the part of the Risk to stop that is open profit. It is Unavailable with the evaluation's own reason when there is no Mark. |
| A250 | **Each session's figures** (`replay`, T9.4). `ReplayedSession` gains `figures`: that session's Risk to stop, Reward to target, Worst case and Max reward with their R, the reward to risk, `conditions`, `outcomes` and `standing`, exactly as `evaluate` returns them for the Position held at that session's Mark. `replay` now passes the Underlying's frame to `evaluate`, which it left out while only the Trade P&L was read. A condition's status is the status at that session's Mark: a session after a gap says "first seen", never an earlier date. It also gains `riskChange` and `rewardChange`, the change in each since the previous session that had the figure, with that session's date. |
| A251 | **Markers** (`replay`, T9.5). `ReplayedSession` gains `markers`, one per Position Change in the session, in fact order: its id, its kind (`Execution` or `Expiration`), its effect on the Position (`Opened`, `Added`, `Reduced` or `Closed`), and each fill's Instrument, action, quantity and price. The words are the screen's. |
| A252 | **The Plan column** (`replay`, T9.5). The result gains `plan: { atStop, atTarget, rewardRisk }`: minus 1R, plus the Original Planned Reward, and the Plan Baseline's ratio. Later fills never change it. |
| A253 | **A final session.** When the Trade is Closed, the view's last session carries `final`, with how the Trade ended: `Sold`, or `Expired` with the contract. Its Trade P&L is the realized result and its figures are Not Applicable, No remaining Position. A Settlement Due Trade has no final session (P124). |
| A254 | **The Review's replay** (T9.7; P127). `DailyTradeReview` gains `replay?`, the same view type as `replayTrade`'s, ending at the Review Date. It is absent when the Trade's facts can't be replayed. `open` does not read it. The card a Save Marks result returns is built as `getTrade` builds it, so it carries the replay with the new Mark and the screen reads nothing again; the implementing session confirms this in `daily-review.ts` before T9.7's brief. |
| A255 | **The chart's parts** (the seam for Ribbon). Everything lives in `src/ui/cockpit/replay/` as presentational components with plain props (A216). `replay.props.ts` turns the view into `ReplayProps`. `ReplayFrame` owns the headline, the slider, the reveal rule, the hover, the readout, the session cards and the slots for the chips and the "since" line. `geometry.ts` owns the time axis. `CorridorPlot` is the only plot. **Ribbon is a second plot component taking the same `ReplayPlotProps`**, with a control in the frame to choose between them; nothing else changes. |
| A256 | **Geometry is presentation** (A215). Turning a finished dollar figure or price into an SVG coordinate is drawing, not calculating. The time axis runs from the first session to the contract's expiration (to the last session for stock), with later sessions blank. Each vertical axis is sized from the Plan's anchors (entry, Stop, Target, strike; the Plan column's two results) and the sessions revealed so far, never from a later session. A label with no free spot is left out; every figure is still in the readout and the session cards. |
| A257 | **The address.** Trade Detail reads `drawer`, `session` and `from` from the address once, on load: `/trades/<id>?drawer=price-history&session=2026-11-12&from=review`. The Review reads `trade`, `panel` and `session` beside the parameters `linkedCard` reads today. The slider's session is otherwise component state, kept while the same Trade's replay is read again. D9A-R's A274 adds `replay=open`. |
| A258 | **The estimates** (stage B). `option-pricing` exports the price of a European option without dividends, its implied volatility by bisection between 0.01% and 500%, and its sensitivity to the Underlying. Time is `daysToExpiration` (the Instrument module's existing count of calendar days) over 365. `replay-estimates.ts` turns the exact inputs into numbers, one way, and returns for each session: `impliedVolatility`, `shareEquivalent` and `split`, each an `Estimate` holding a number, or Unavailable with one of `MarkMissing`, `ExpirationSession`, `AtOrBelowExerciseValue`, `NoVolatilityFits`, `InsensitiveToVolatility` or `NoEarlierFigure`, or Not Applicable for stock. A stock Position's share equivalent is its shares, marked exact. The rate and the days used come back with them. The reasons and thresholds are the prototype's (`prototypes/replay/checks/model.js`): half a cent above the floor, and half a cent of price per volatility point. |
| A259 | **The split.** It is worked out per share in the order Underlying, then time, then volatility, from the earlier session's implied volatility. The remainder is the real change less the three parts, so the four always add up. When the later session has no implied volatility, time and volatility are returned as one part. When the earlier session has none, or either Mark is missing, the move is not split and the reason says why. The change is measured from the last session that had a Mark. |
| A260 | **The meter reading** (stage C, T9.30). One finished value: the two rails (`outcomes.atStop` and `outcomes.atTarget`, which need no Mark); `banked`, the realized P&L to date; `now`, a Calculation Result holding the Trade P&L with `standing`'s zone and `pastBy`; and `previous`, the Trade P&L at the session before with its date, or absent. With no Mark, `now` is Unavailable and the rails and `previous` still come back, so the track can be drawn empty. Placing these on a track is presentation (A215): the track always includes break-even, and stretches by a third at most past a rail. |
| A261 | **Attention moves to the shared valuation module** (T9.30). `attentionOf`, `byAttention` and their types move from `src/coordinators/daily-review/attention.ts` to `src/coordinators/valuation/attention.ts`, which both coordinators already import from. Daily Review re-exports the types, so no reader changes. The Open list then calls the same functions at the current Expected Mark Date, and does not depend on the Review. |
| A262 | **The Open list's order** (T9.32). Trade Record still returns the Open book by Last Activity. Trade Views sorts that one page with `byAttention` after valuing it. Each item gains `attention` (band and reasons) and `meter`. A Trade whose facts can't be replayed is in the Blocker band, first. Planned and Closed keep their orders. A scaled-out Trade's order and its meter may disagree, as the user accepted. **Room for later sorting and filtering (the user's condition, 2026-11-17):** (1) attention is the default order, one named sort step applied after the page is selected and valued, so a later `order` choice on the request picks another step and a filter narrows the page before it; (2) nothing in Trade Record's query, its index or its cursor changes, so its filters and factual sorts are untouched; (3) every item carries what a sort would need (`attention`, `lastActivity`, the P&L and the meter reading), and the screen never sorts for itself; (4) no test or fixture names attention order as the only order: cases say "the default order". One limit to know: attention order works because the Open list is one page of at most 200; a paged Open list could not use it as a cursor order. |
| A263 | **Durable compatibility.** No schema, store, seed, migration or backup-version change. Every new view field is additive, and `compareSnapshot` allows added fields. No frozen fixture holds a replay view. The one exception to "additive" is P132's removal of `rangePosition`, which edits eight fixtures' expected views (T9.40). The Installed Capability Manifest changes variants only (T9.8, T9.40); no operation is added. |
| A264 | **Reading list.** The implementing session reads `plan/spec-reading/D09.md`, regenerated with the retag in section 1.2. |
| A265 | **The benchmark** (decision 114) runs once, after stage C's gate. Stages A and B change neither the cold start nor the Open list. Query-count cases cover each stage's reads (I9.6, I9.11). |

### 1.4 Size check and the stages

The graph has **40 tasks** and **ten open questions**. There is no schema change. Two of the guide's three criteria are met.

**Proposed: three stages, in this order, in one breakdown.**

| Stage | What the trader gets | Tasks | Ends with |
|---|---|---|---|
| **A. The replay chart** | Corridor, with its headline, slider, readout and table, in Trade Detail and the Review card, for stock and single options. | T9.1, T9.2, T9.3, T9.4, T9.5, T9.6, T9.7, T9.8, T9.9, T9.10, T9.11, T9.12, T9.13, T9.14, T9.15, T9.16, T9.17, T9.18, T9.19 | The cumulative suites and a fresh critic. Tag `claude-opus-5.5-d9a`. |
| **B. The option estimates** | Implied volatility, the share equivalent and the split, under the chart. | T9.20, T9.21, T9.22, T9.23, T9.24, T9.25, T9.26, T9.27, T9.28 | The same. Tag `claude-opus-5.5-d9b`. |
| **C. The meter** | The meter on Review cards, the Open list and Trade Detail; the Open list in attention order. | T9.29, T9.30, T9.31, T9.32, T9.33, T9.34, T9.35, T9.40, T9.36, T9.37, T9.38, T9.39 | The suites, the gate critic, then the benchmark. Tag `claude-opus-5.5-d9`. |

- **What stage A leaves unfinished, and why that is acceptable.** After A, the replay is whole for stock and readable for options, but an option's wrong Mark is still hard to spot: it looks like a plausible P&L move. Stage B is what catches it (a wrong Mark shows as a spike in implied volatility). So B follows A at once and must not drift. Nothing is released for real use between stages.
- **Why B comes before C.** B sits on A's chart, so the chart's words and layout are still fresh when its chips and line are added. C needs nothing from B. It needs only T9.3's results at the Stop and the Target, which stage A builds.
- **Each stage starts a new session** from its own handoff, so no session carries three stages' work in one context.
- **If the user keeps one run:** the same 40 tasks, with stage A's gate as a checkpoint critic and one gate at the end.
- **If the user wants C first or beside A:** move T9.3 into stage C. C's Open-list change touches a shared screen and the benchmark's expected rows, so it runs alone, never beside another deliverable.

### 1.5 Lookups (drafting guide)

Run on `85a7630e`. If the branch moves before D9 starts, rerun them.

**Texts.** Each changing text, the files that assert it, and the task that changes them.

| Text | Files | Task |
|---|---|---|
| The drawers per state: "Today, Position, Plan and Risk, Price History, Journal, Payoff" | `src/ui/screens/trade-detail/drawer-request.ts:3`; `Cockpit.test.tsx`; `e2e/support/detail/index.ts:14,16`; `e2e/d8p/cockpit.spec.ts:11,81`; `e2e/d8p/states.spec.ts:11`; `e2e/d8p/responsive-a11y.spec.ts:11`; `e2e/d8r/states.spec.ts:12,60,82` | T9.14 |
| The slider's name: "53% of the way from the Stop to the Target, entry at 32%. Risk to stop …", "Past the Stop, entry at 25%. …" | `src/ui/screens/StopTargetSlider.test.tsx`; `e2e/d5r/sliders.spec.ts` (13 lines); `e2e/d5r/review.spec.ts` (5); `e2e/d5r/responsive-a11y.spec.ts` (4); `e2e/d5r/marks.spec.ts` (3); `e2e/d5r/support.ts` (`sliderOf`); `e2e/d7p/layout.spec.ts:120,149` | T9.33 |
| The slider's classes: `.slider`, `.slider-now`, `.slider-entry`, `.slider-pinned`, `.slider-none`, `.slider-track` | `e2e/d5r/sliders.spec.ts:70,71,76,81,89,92,93` | T9.33 |
| The Open list's columns "Underlying, Trade, Net cost, P&L, Entry, Account" | `src/ui/screens/TradeList.test.tsx:515` | Unchanged: the meter sits under the P&L figure and adds no column (T9.34). |

**The Open list's order** (handoff section 5, item 8).
- **Where the order is asserted.** No test names Last Activity order for the Open list. These read an Open item by its position, and each is checked when the order changes: `src/coordinators/trade-views/open-views.test.ts` (4 lines), `option-views.test.ts` (2), `tests/integration/d2/integrity.test.ts` (3), `d2/trade-summary.test.ts` (2), `d2/write-gate.test.ts` (1), `d2/open-position.test.ts` (1), `d2/integrity-incoherent.test.ts` (1), `tests/integration/d4/conditions.test.ts` (1). Most hold one Open Trade, so their order can't change.
- **The frozen list.** `bench/expected-open-rows.json` holds the benchmark's Open rows in order. `tools/bench-run.ts` compares the rendered list with it position by position, and `tools/bench-generate.ts` and `tools/bench-expected-rows.ts` write it. T9.36 regenerates it.
- **Where attention is worked out, and where the list is read.** `src/coordinators/daily-review/attention.ts` (175 lines, pure, imported only by `daily-review.ts` and its own test) against `browseTrades` in `src/coordinators/trade-views/trade-views.ts:924`. They share it through `src/coordinators/valuation/` (A261).
- **The latency budget.** The Open list is one unpaged page of up to 200 Trades (`trade-views.ts:929`), and every one is already valued through one read session. The order adds one sort of 200 items and no read. The meter's mark for the session before adds one more date's Marks per page and a second valuation per Trade (P133). The benchmark after stage C measures both against AC-PERF-001.
- **Planned and Closed** keep their orders (A262).

**Shapes.**
- **Added, all additive:** `outcomes` and `standing` on `TradeEvaluation` (T9.3); `figures`, `riskChange`, `rewardChange` and `markers` on a replayed session, and `plan` on the result (T9.4, T9.5); `final` on the view's last session (T9.6); `replay` on `DailyTradeReview` (T9.7); `estimates` on a replayed session (T9.23); `meter` on a walked Trade and `attention` and `meter` on an Open item (T9.31, T9.32).
- **Frozen fixtures.** `grep -rl positionChangeIds tests/fixtures bench` finds nothing: no fixture holds a replay view. The fixtures' expected views hold `TradeEvaluation` objects, and `compareSnapshot` allows added fields, so `outcomes` and `standing` break none.
- **Removed (T9.40, P132):** `rangePosition`, in eight fixtures' `expected-views.json`: `backup-v3-blocked` 6, `backup-v4-blocked` 6, `backup-v5-blocked` 10, `backup-v6-blocked` 12, `backup-v7` 14, `workspace-v5` 10, `workspace-v6` 12, `workspace-v7` 14, 84 entries in all. Each entry is an object of several lines, so the count is of entries, not lines. `compareSnapshot` fails a field the views no longer have (through `verify:fixtures` and `tests/integration/d8/round-trip.test.ts`), which is why the task owns both the code and the fixtures. No fixture holds the `RangePosition` capability variant (`grep -rl RangePosition tests/fixtures bench tools` finds nothing), so the variant is replaced in `routes.ts:47`, `capabilities.ts:103` and `workspace.test.ts:417`.
- **Stores and schema:** unchanged.

**Checks.**
- **New ESLint rule, the estimates rule (T9.20).** A throwaway run on the current tree has no hits: `grep -rn option-pricing src tools` finds nothing, and `grep -rnE "Math\.(log|exp|sqrt|pow)" src/domain src/coordinators` finds nothing outside tests. The rule's own cases go in `tools/estimate-rules.test.ts`, beside `tools/cockpit-rules.test.ts`.
- **The cockpit import rule** (A216, `eslint.cockpit.config.js`) already covers `src/ui/cockpit/replay/` and `src/ui/cockpit/meter/`: only a `*.props.ts` adapter may import a view's types.
- **`eslint.wording.config.js`:** the new words hold no Mark-or-close phrase the rule guards. T9.9 checks "session" and "Mark" wording by running `npm run verify:wording`.
- **The UI's "no arithmetic" rule** stays a review point, as in D08P and D8R. The briefs for T9.9, T9.12 and T9.13 say so: a coordinate is drawing; a dollar figure is never worked out in `src/ui/`.
- **Playwright folders.** `test:e2e:2` lists `e2e/d5 e2e/d5r e2e/d6 e2e/d7p e2e/d7 e2e/d8p e2e/d8`. `e2e/d9` matches none, so T9.18 adds it to T9.1's new third stage with its first spec. `full-suite.sh` maps `evidence/D09` to `e2e/d9`, and `tdd.sh` maps `T9.n` to `evidence/D09`, with no change.

**Names.**
- **`browser-2` and `test:e2e:2`** (T9.1): `package.json`, `.claude/scripts/full-suite.sh`, `run-complete.sh`, `run-complete.test.sh`, `acceptance-commands.sh`, `.claude/agents/suite-runner.md`, `.claude/docs/implementing.md`. Each gains the third stage; `run-complete.sh` then expects six stage files for the full tier.
- **`attention.ts`** (T9.30): imported by `src/coordinators/daily-review/daily-review.ts:14` and `attention.test.ts:6`. Both move to the new path. `src/ui/screens/review-attention.ts` is a different file and stays.
- **`StopTargetSlider`** (T9.33): `src/ui/screens/ReviewCard.tsx:15,124`, its own file and test. The component and its test are deleted. `SliderFigures` (`daily-review/types.ts:91`, re-exported as `SliderEvaluation` at `src/app/types.ts:219`) stays: the meter's name speaks the same figures.
- **`rangePosition`, `RangePlacement`, `RangePositionResult`, `rangePositionOf`** (T9.40):
  - code: `src/coordinators/daily-review/attention.ts` (8 places; by then moved to `valuation/`), `types.ts:51,59,72`, `daily-review.ts:77`, `index.ts:2`, `src/app/types.ts:216,217`;
  - unit tests: `daily-review.test.ts` (11), `save-marks.test.ts` (4), `attention.test.ts` (3), `option-attention.test.ts` (1), `src/ui/screens/ReviewCards.test.tsx` (6), `CardMarks.test.tsx` (2), and one each in `ReviewCard.test.tsx`, `ReviewView.test.tsx`, `ReviewOwed.test.tsx`, `ReviewOptionMarks.test.tsx`, `ReviewSettlement.test.tsx`, `ReviewExpiration.test.tsx`, `held-review.test.ts`;
  - integration tests: `tests/integration/d5r/shared-mark.test.ts` (2), `save-marks.test.ts` (1), `range-and-baseline.test.ts` (1), `query-count.test.ts` (1);
  - the `RangePosition` variant: `routes.ts:47`, `capabilities.ts:103`, `workspace.test.ts:417`.
- **`DRAWERS`** (T9.14): `drawer-request.ts:3` and its readers in the Texts table.
- **`TradeReplayView` readers** (unchanged by the added fields): `rail/pnl.props.ts`, `drawers/price-history.props.ts`, `drawers/journal.props.ts`, `drawers/today.props.ts`, `Cockpit.tsx`, and their tests.

### 1.6 Approved words

Approved by the user on 2026-11-17 (open question 10), as the starting point: a task may shorten them under P137, recording the before and after. Taken from `round-2.html` and `trade-list.html`. Conventions C1 to C8 of the D7 approved words apply, and a price is a Mark. Examples use section 5's Trades.

| # | Where | Words |
|---|---|---|
| W1 (amended) | Drawers per state | Open, Settlement Due and Closed: Today, **Replay**, Position, Plan and Risk, Price History, Journal, Payoff. Planned and records-disagree are unchanged. See D9A-R's W54 and W53. |
| W35 | The drawer, and the Review card's section | "Replay". See D9A-R's W54 and W53. |
| W36 | Headline figure | "+$988.00 · 3.05R", green above break-even and red below. With no Mark: the reason at the `figure` length, and no figure. |
| W37 | How it is going | "Ahead: 85% of the way to the Target." "Behind: 63% of the way to the Stop." "At break-even." "Target reached, $32.00 past it." "Target reached." "Past the Stop by $180.00 (0.30R)." "Past the Stop's planned amount by $9.00, though DALE is still above $54.00." "Past the Target's planned amount by $40.00, though XYZ is still below $60.00." "Final result: sold out Thu Nov 12." "Final result: the put expired Fri Nov 20." |
| W38 | What is at stake | "From here: $352.00 at risk to the Stop · $928.00 more to the Target · 2.64 to 1 (the Plan was 2.95 to 1)." After the Target: "From here: $672.00 at risk back to the Stop ($510.00 of it open profit) · no cap above." or "… · at most $90.00 more." Past the Stop: "From here: Worst case $4,520.00 more · $1,080.00 back up to the Target." Then, when true: "Even at the Stop this Trade would end $316.00 ahead." Final: "Nothing is at risk and nothing is left to gain. +$478.00 of the result was banked before the end." Reward to risk: with the estimated odds (D9A-R, decision 4). |
| W39 | Chart titles | "BREN price · one Mark per session". "Trade P&L · dollars for the whole Position, between the result at the Stop and at the Target". On a phone: "BREN price", "Trade P&L". D9A-R (decision 6): the P&L title is "Trade P&L" at every width. |
| W40 | Labels in the P&L chart | "Stop −$324", "Target +$956", "Break-even", "Realized +$478", "Realized −$495" (decision 120: "Realized" for a gain and a loss), "Worst case +$156", "Max reward +$564", "$32 past the Target", "$180 past the Stop", "Risk to stop $672", "Reward to target $928" ("Risk $672", "Reward $928" on a phone). In the price chart: "Strike $100", "Stop $54.00", "Target $56.00". |
| W41 | Markers | "Bought 100 at $50.00", "Bought 100 at $51.40", "Sold 2 at $4.00", "Sold 6 at $0.94", "Bought 3 at $2.59", "Expired". On a phone: "Sold 2". |
| W42 | The slider | Its label "Session". Its value: "Mon Nov 16 · 11 of 15". Buttons "Previous session", "Next session". A screen reader hears the value and then the headline. |
| W43 | The readout | Groups "How it is going", "At stake from here, whole Position", "Marks", "Position", "The Plan"; "Final result" on a final session. Rows "Trade P&L", "Realized" (decision 120; was "Banked"), "Open", "Risk to stop", "Result at the Stop", "Worst case", "Reward to target", "Stop Overrun", "Target Overrun", "Result at the Target", "Max reward" ("No cap above"), "Reward to risk" ("Target reached", "Stop breached", "Plan 2.95 to 1"), with the estimated odds (D9A-R, decision 4). Changes: "down $150.00 since Fri Nov 13", "up $60.00 since Fri Nov 13". |
| W44 | The key | "Mark", "Open profit", "Open loss", "Realized" (decisions 120 and 121; was "Banked" and "Realized loss": one name, the swatch's colour shows gain or loss), "Past the Stop", "Past the Target", "Result at the Stop", "Result at the Target", "At stake from here", "Execution". A session without a Mark: "No Mark". See D9A-R's W66. |
| W45 | The table | Folded, titled "Session by session". Columns "Session", "<Underlying> Mark", "<Contract> Mark", "Trade P&L", "Banked", "Risk to stop", "Reward to target", "Result at the Stop", "Result at the Target", "Stop", "Target", "Events". Replaced by session cards (D9A-R's W65). |
| W46 | Links | "Price History", "Position", "Journal", "Back to the Review". |
| W47 | Stage B: chips | "Implied volatility 27.7%", "Implied volatility Unavailable", "Behaves like ≈ 183 shares", "Behaves like ≈ short 122 shares", "Behaves like 200 shares" (stock, exact), "4 days to expiration", "Expiration session", "Long 2 contracts", "Short 3 contracts". The tag: "estimate". |
| W48 | Stage B: the line under the charts | "Since Fri Nov 13: Trade P&L −$150.00. The call moved −$0.75 a share: BREN's move −$0.52 · time −$0.22 · volatility −$0.01". Together: "BREN's move +$1.13 · time and volatility together −$0.04". Not split: "The put's move is not split: no implied volatility for Tue Nov 10. Its Mark changed +$0.87 since Mon Nov 9." Stock: "Since Fri Nov 13: Trade P&L +$280.00. AXIO moved +$1.40 a share." |
| W49 | Stage B: why an estimate is Unavailable | "A Mark is missing." "On the expiration session the price no longer depends on volatility." "The Mark is at or below the option's exercise value, so no volatility fits." "No volatility fits this Mark." "This far from the strike, or this close to expiration, the price barely depends on volatility." |
| W50 | Stage B: the About page, under a heading "Option estimates" | "Implied volatility, the share equivalent and the split of an option's move are estimates. They use the textbook option formula (Black-Scholes): no dividends, and exercise only at expiration. Interest rate: 4% for a contract with up to 365 days to expiration, 5.25% beyond. The option's Mark and the Underlying's Mark may not be from the same moment. An estimate never changes a P&L or a risk figure." Nothing of this shows beside the chart (open question 3). |
| W51 | Stage C: the meter's name and hover | "P&L +$990.00, 62% of the way to the Target. Realized +$400.00. Stop −$600.00, Target +$1,600.00. Up from +$850.00 on Thu Nov 12." "P&L −$920.00, past the Stop by $180.00. …" With no Mark: the reason, then the rails. The meter shows no visible words. Decision 120: what was realized reads "Realized" whatever its sign ("Realized +$400.00", "Realized −$440.00"), replacing D9A-R's W57 rule of "Banked" for a gain. |
| W52 | Stage C: the Open list | The heading "Open Trades" gains the line "In the Review's order". |

---

## 2. Implementation boundaries extended in D9

| Canonical boundary | Code location | D9 |
|---|---|---|
| Trade Analysis (pure) | `src/domain/trade-analysis/` | `evaluate`: `outcomes`, `standing` (A248, A249). `replay`: each session's figures, markers, the Plan column (A250, A251, A252); in stage B, the estimates (`replay-estimates.ts`, A258). |
| Option pricing (pure, new) | `src/domain/option-pricing/` | The formula, implied volatility, sensitivity (A258). Read only by `replay-estimates.ts`. |
| Replay assembly (shared, new) | `src/coordinators/replay/` | The lifetime, the series reads and the call to `replay`, moved from `trade-views/replay-trade.ts` (P127). |
| Trade Views | `src/coordinators/trade-views/` | `replayTrade`: the new fields and `final`. Stage C: the Open list's order, `attention` and `meter` (A262). |
| Daily Review | `src/coordinators/daily-review/` | `getTrade`: `replay` (A254). Stage C: `meter` on each walked Trade. |
| Valuation (shared) | `src/coordinators/valuation/` | Stage C: `attention.ts` and the meter reading (A260, A261). |
| Workspace | `src/coordinators/workspace/capabilities.ts` | Capability variants only (T9.8). |
| Facade | `src/app/compose.ts`, `src/app/types.ts`, `src/app/routes.ts` | Types and variants; no new operation. |
| UI | `src/ui/cockpit/replay/`, `src/ui/cockpit/meter/`, `src/ui/screens/` | The chart, the meter and their wiring. |
| Lint | `eslint.config.js` and a new `eslint.estimates.config.js` | The estimates rule (T9.20). |
| Tooling | `package.json`, `.claude/scripts/`, `.claude/agents/suite-runner.md`, `.claude/docs/implementing.md` | The third browser stage (T9.1). |

Persistence, migrations, Market Data, Trade Record, Journal, the Reference Catalog and Trade Workflows need no change. `ReadSeries` already returns what the chart needs.

**Which tasks change code outside `src/ui/`.** T9.1 (tooling), T9.2 (types), T9.3, T9.4, T9.5 (Trade Analysis), T9.6, T9.7, T9.8 (coordinators and the facade), T9.20 (lint), T9.21, T9.22, T9.23 (the estimates), T9.30, T9.31, T9.32 (attention and the two reads), T9.40 (the range position removed, with its fixture entries), T9.36 (the benchmark's expected rows). The other behavioral tasks are UI only.

---

## 3. Wall-clock

On D8R's basis: a behavioral task about 35 minutes in `tdd-task`, ocr about 5, a lane tier about 4, a complete run about 13 with three browser stages. Critic defects and their bug tasks are left out, and in D8R they doubled the estimate.

| Stage | Serial | Swarm | Chosen (open question 2) |
|---|---|---|---|
| A | about 16 hours | about 7 hours | **Swarm.** Wave 1's three lanes at once; the two wiring tasks at once; then the suites and the critic. |
| B | about 7 hours | about 4 hours | **Serial.** Mostly a chain of four tasks, so a swarm saves little. |
| C | about 9 hours | about 5 hours | **Serial.** |

---

## 4. Task graph

Kind: **B** = behavioral (TDD, red then green per case), **S** = structural (exact verification). "Outside `src/ui/`" names every change beyond the UI.

### 4.1 Tasks

| Task | Title | Stage, wave, lane | Kind | Blocked by | Public seam under test | Outside `src/ui/` |
|---|---|---|---|---|---|---|
| T9.1 | A third browser stage | A, 0, TL | S | — | a full-tier run | **tooling:** `package.json`, `.claude/` (section 1.5, Names) |
| T9.2 | Freeze the replay view and chart props types | A, 0, TY | S | — | `typecheck` | **types only:** `outcomes?`, `standing?` on `TradeEvaluation`; `figures?`, `markers?`, changes on a replayed session; `plan?`; `final?`; `replay?` on `DailyTradeReview`. No behavior. |
| T9.3 | Trade Analysis: the Trade's result at each boundary, and its standing | A, 1, TA | B | T9.2 | `TradeAnalysis.evaluate` | **Trade Analysis:** A248, A249 |
| T9.4 | Trade Analysis: each session's risk, reward and condition status | A, 1, TA | B | T9.3 (lane order) | `TradeAnalysis.replay` | **Trade Analysis:** A250 |
| T9.5 | Trade Analysis: markers and the Plan column | A, 1, TA | B | T9.4 (lane order) | `TradeAnalysis.replay` | **Trade Analysis:** A251, A252 |
| T9.6 | The shared replay assembly; `replayTrade` carries the new fields | A, 2, RV | B | T9.5 | `TradeViews.replayTrade` | **coordinators:** `src/coordinators/replay/` (new), Trade Views |
| T9.7 | Daily Review: the card's replay, to the Review Date | A, 2, RV | B | T9.6 (lane order) | `DailyReview.getTrade` | **Daily Review:** A254 |
| T9.8 | Facade and manifest | A, 2, RV | S | T9.7 (lane order) | `verify:capabilities`, `typecheck` | **Workspace, facade:** variants |
| T9.9 | Replay adapter: the headline and the stake sentence | A, 1, CF | B | T9.2 | `replay.props` | none |
| T9.10 | Replay frame: the slider reveals sessions | A, 1, CF | B | T9.9 (lane order) | `ReplayFrame` | none |
| T9.11 | Replay frame: the readout, the table, hover and tap | A, 1, CF | B | T9.10 (lane order) | `ReplayFrame` | none |
| T9.12 | Corridor: the Underlying's price strip | A, 1, CP | B | T9.2 | `CorridorPlot` | none |
| T9.13 | Corridor: the Trade P&L area, the two lines, the banked band and markers | A, 1, CP | B | T9.12 (lane order) | `CorridorPlot` | none |
| T9.14 | Trade Detail: the Replay drawer | A, 2, DW | B | T9.6, T9.11, T9.13 | `TradeDetail` | none |
| T9.15 | Review card: the replay before the Action | A, 2, RW | B | T9.7, T9.11, T9.13 | `ReviewCard` | none |
| T9.16 | Audit navigation, and the round trip to the Review | A, 2, DW | B | T9.14 (lane order), T9.15 | `TradeDetail`, `ReviewView` | none |
| T9.17 | Stage A: Node integration suite | A, 3 | S | T9.8 | `test:integration` | none (tests only) |
| T9.18 | Stage A: browser suite | A, 3 | S | T9.16 | `test:e2e` | none (tests only) |
| T9.19 | Stage A gate: fresh browser critic | A, 3 | S | T9.17, T9.18 | critic report | none |
| T9.20 | Estimates stay apart: their types and the lint rule | B, serial | B | T9.19 | `tools/estimate-rules.test.ts`, `typecheck` | **lint; types:** `estimates?` on a replayed session |
| T9.21 | Option pricing and implied volatility | B, serial | B | T9.20 | `option-pricing` | **new pure module** |
| T9.22 | The share equivalent and the split | B, serial | B | T9.21 | `replay-estimates` | **Trade Analysis:** A258, A259 |
| T9.23 | `replay` and both views carry each session's estimates | B, serial | B | T9.22 | `TradeAnalysis.replay`; `replayTrade`; `getTrade` | **Trade Analysis; replay assembly** |
| T9.24 | Chips: implied volatility and the share equivalent | B, serial | B | T9.23 | `ReplayFrame` | none |
| T9.25 | The "since the session before" line, and the estimates in the readout and the session cards | B, serial | B | T9.24 | `ReplayFrame`, `replay.props` | none |
| T9.26 | Stage B: Node integration suite | B, serial | S | T9.23 | `test:integration` | none (tests only) |
| T9.27 | Stage B: browser suite | B, serial | S | T9.25 | `test:e2e` | none (tests only) |
| T9.28 | Stage B gate: fresh browser critic | B, serial | S | T9.26, T9.27 | critic report | none |
| T9.29 | The meter | C, serial | B | T9.28 | `Meter` | none |
| T9.30 | Attention shared, and the meter's reading | C, serial | B | T9.28 | `attentionOf`, `meterReadingOf` (valuation module) | **valuation, Daily Review:** A260, A261 |
| T9.31 | Daily Review: each walked Trade's meter reading | C, serial | B | T9.30 | `DailyReview.open`, `save` | **Daily Review** |
| T9.32 | Trade Views: the Open list in attention order, with each row's meter reading | C, serial | B | T9.31 | `TradeViews.browseTrades` | **Trade Views:** A262 |
| T9.33 | Review card: the meter replaces the slider | C, serial | B | T9.29, T9.31 | `ReviewCard` | none |
| T9.34 | Open list: the meter under the P&L, in the read's order | C, serial | B | T9.29, T9.32 | `TradeList` | none |
| T9.35 | Trade Detail: the meter on the Conditions card | C, serial | B | T9.29, T9.30 | `ConditionsCard`, `conditions.props` | none |
| T9.40 | Remove the range position (runs after T9.35) | C, serial | S | T9.33 | `typecheck`, `verify:fixtures`, `verify:capabilities`, `test:integration` | **Daily Review, valuation, facade:** the field, its types and its variant removed; **fixtures:** 84 entries deleted (P132) |
| T9.36 | The benchmark's expected Open rows, in the new order | C, serial | S | T9.34 | `bench:expected`, `git diff` | **tools:** `bench/expected-open-rows.json` |
| T9.37 | Stage C: Node integration suite | C, serial | S | T9.32 | `test:integration` | none (tests only) |
| T9.38 | Stage C: browser suite | C, serial | S | T9.34, T9.35 | `test:e2e` | none (tests only) |
| T9.39 | Deliverable gate: fresh browser critic | C, serial | S | all | critic report | none |

**Run order.**
- **Stage A.** Wave 0: T9.1 and T9.2 at once. Wave 1: lanes TA, CF and CP at once, each in its listed order; CF and CP test against doubles built from T9.2's types. Wave 2: lane RV (T9.6, T9.7, T9.8) starts when T9.5 merges; T9.14 and T9.15 run at once when their blockers merge; T9.16 last. Wave 3: T9.17 may start once T9.8 merges; T9.18 after T9.16; then T9.19.
- **Stage B, serial** (decision 100; open question 2): T9.20, T9.21, T9.22, T9.23, T9.24, T9.25, T9.26, T9.27, T9.28, one at a time on the deliverable branch, each ending with its own complete run.
- **Stage C, serial:** T9.29, T9.30, T9.31, T9.32, T9.33, T9.34, T9.35, T9.40, T9.36, T9.37, T9.38, T9.39, the same way. The benchmark follows the gate (decision 114).

### 4.2 Lanes and file ownership

In stage A, a lane is one git worktree (`.claude/worktrees/d09-<lane>`) on one branch (`d09/<lane>`), set up by `lane-setup.sh`, and a file is owned by one lane per wave. Stages B and C are serial and have no lanes; their rows (marked B or C) list the files each task changes, for the briefs.

| Lane | Tasks | Owns |
|---|---|---|
| TL | T9.1 | `package.json` (the e2e scripts); `.claude/scripts/full-suite.sh`, `run-complete.sh`, `run-complete.test.sh`, `acceptance-commands.sh`; `.claude/agents/suite-runner.md`; `.claude/docs/implementing.md` |
| TY | T9.2 | Types only, in `src/domain/trade-analysis/evaluate.ts` and `replay-series.ts`, `src/coordinators/trade-views/replay-view.ts`, `src/coordinators/daily-review/types.ts`, `src/app/types.ts`; new `src/ui/cockpit/replay/replay.types.ts` |
| TA | T9.3, T9.4, T9.5 | `src/domain/trade-analysis/` and its tests; the test Trades of section 5 in `option-trade.ts` and `reference-trade.ts` |
| CF | T9.9, T9.10, T9.11 | `src/ui/cockpit/replay/replay.props*`, `frame*`, `readout*`, `table*`; `src/ui/cockpit/styles/replay-frame.css` |
| CP | T9.12, T9.13 | `src/ui/cockpit/replay/geometry*`, `price-strip*`, `corridor*`; `src/ui/cockpit/styles/replay-plot.css` |
| RV | T9.6, T9.7, T9.8 | `src/coordinators/replay/` (new); `src/coordinators/trade-views/replay-trade.ts`, `replay-view.ts`, and `replayTrade` in `trade-views.ts`; `getTrade` in `src/coordinators/daily-review/daily-review.ts`; `src/coordinators/workspace/capabilities.ts` and `workspace.test.ts`; `src/app/routes.ts`, `compose.ts`, `types.ts`; `tests/support/` builders it extends |
| DW | T9.14, T9.16 | `src/ui/screens/trade-detail/Cockpit.tsx`, `drawer-request.ts`, `Cockpit.test.tsx`; `src/ui/screens/TradeDetail.tsx` and its test; `e2e/support/detail/index.ts`; the drawer lines of the specs in section 1.5. For T9.16 only: `linkedCard` in `src/ui/screens/ReviewView.tsx`, after RW has merged. |
| RW | T9.15 | `src/ui/screens/ReviewCard.tsx`, `ReviewCard.test.tsx`, `ReviewCards.test.tsx`; the card's styles |
| B | T9.20, T9.21, T9.22, T9.23 | `eslint.estimates.config.js`, `eslint.config.js` (one merge line), `tools/estimate-rules.test.ts`; `src/domain/option-pricing/` (new); `src/domain/trade-analysis/replay-estimates.ts` (new) and `replay-series.ts`; `src/coordinators/replay/` (the pass-through) |
| B | T9.24, T9.25 | `src/ui/screens/AboutView.tsx` and its test (T9.24); `src/ui/cockpit/replay/chips*`, `since-line*`; the estimate rows of `readout.props*`, `readout*`, `cards.props*` and `session-cards*` (D9A-R's A286 and A277); `styles/replay-estimates.css` |
| C | T9.29 | `src/ui/cockpit/meter/` (new); `src/ui/cockpit/styles/meter.css` |
| C | T9.30, T9.31, T9.32 | `src/coordinators/valuation/attention.ts` (moved) and `meter.ts` (new); `src/coordinators/daily-review/` (`open`, `save`, types, the re-exports); `browseTrades` and the Open item types in `src/coordinators/trade-views/trade-views.ts`; the positional reads listed in section 1.5 |
| C | T9.33 | `src/ui/screens/ReviewCard.tsx` (its header); `StopTargetSlider.tsx` and its test (deleted); `e2e/d5r/sliders.spec.ts`, `review.spec.ts`, `marks.spec.ts`, `responsive-a11y.spec.ts`, `support.ts`; `e2e/d7p/layout.spec.ts` (its slider lines) |
| C | T9.34 | `src/ui/screens/TradeList.tsx`, `TradeList.test.tsx`, `TradeListOptions.test.tsx`; the list's styles |
| C | T9.35 | `src/ui/cockpit/rail/conditions*`; `styles/rail-b.css` |
| C | T9.40 | Every file in section 1.5's Names entry for `rangePosition`; the eight fixtures' `expected-views.json` |

**Shared files, and how they are split or sequenced.**
- **`replay-series.ts`:** TY in wave 0 (types), TA in stage A, T9.23 in stage B.
- **`replay.props.ts`, `readout`, `table`:** CF in stage A, T9.25 in stage B.
- **`ReviewCard.tsx`:** RW in stage A (the body), T9.33 in stage C (the header).
- **`trade-views.ts` and `daily-review.ts`:** RV in stage A (`replayTrade`, `getTrade`); T9.31 and T9.32 in stage C (`open`, `browseTrades`).
- **`Cockpit.tsx`:** DW only.

---

## 5. Behavioral tasks

Every case runs **red → green** individually. A case that passes on its first run, or fails for a syntax, configuration, fixture or unrelated reason, is not valid red evidence. A genuine first-run pass needs a mutation check (an assertion failure or runtime exception, not a compile error) and is flagged. Cases are ordered so each needs behavior the earlier ones don't. No test may be written after the code it covers.

**Quoted words.** A case that quotes screen text quotes section 1.6's wording. Under P137 a task may shorten that text; the case then quotes the shorter text, asserts the same thing, and the change is recorded.

**The test Trades.** They are four of the prototype's six, entered as Marks. All dates are 2026, New York time. Every entry is Mon 11-02 at 10:00, every fee is $0.00, and every option is the Fri 11-20 contract. The figures are those `prototypes/replay/checks/verify.js` checks; the prototype's Marks came from a model, and here they are observed Marks.

| Trade | Plan | Stop | Target | 1R | Planned reward |
|---|---|---|---|---|---|
| **R-AXIO** long stock | 200 shares at $50.00 | AXIO at or below $47.00 | AXIO at or above $56.00 | $600 | $1,200 |
| **R-BREN** long Call, $100 strike | 4 contracts at $1.61 | call at or below $0.80 | call at or above $4.00 | $324 | $956 |
| **R-CORV** long Put, $80 strike | 3 contracts at $2.11 | put at or below $1.05 | put at or above $5.00 | $318 | $867 |
| **R-DALE** Cash-Secured Put, $57.50 strike | short 6 contracts at $0.94 | DALE at or below $54.00 (the put worth $3.50 at expiration) | put at or below $0.20 | $1,536 | $444 |

The series and the sessions the cases name (Underlying Mark; held Instrument's Mark; quantity held; Trade P&L; Risk to stop; Reward to target; result at the Stop; result at the Target):

| Series | Session | Marks | Held | Trade P&L | Risk to stop | Reward to target | At the Stop | At the Target |
|---|---|---|---|---|---|---|---|---|
| **R-AXIO-U** (buys 100 at $50.00 Mon 11-02, 100 at $51.40 Fri 11-06) | Mon 11-02 | $50.40 | 100 | +$40 | $340 | $560 | −$300 | +$600 |
| | Fri 11-06 | $51.80 | 200 | +$220 | $960 | $840 | −$740 | +$1,060 |
| | Tue 11-17 | $56.30 | 200 | +$1,120 | $1,860 | $0, Overrun $60 | −$740 | +$1,060 |
| **R-AXIO-D** (buys 200 at $50.00; sells 100 at $45.60 Mon 11-09) | Fri 11-06 | $48.10 | 200 | −$380 | $220 | $1,580 | −$600 | +$1,200 |
| | Mon 11-09 | $45.20 | 100 | −$920 (banked −$440) | $0, Overrun $180 | $1,080 | −$740 | +$160 |
| **R-BREN-U** (sells 2 at $4.00 Thu 11-12) | Mon 11-02 | $97.20; $1.68 | 4 | +$28 | $352 | $928 | −$324 | +$956 |
| | Wed 11-11 | $101.80; $2.91 | 4 | +$520 | $844 | $436 | −$324 | +$956 |
| | Thu 11-12 | $103.60; $4.13 | 2 | +$982 (banked +$478) | $666 | $0, Overrun $26 | +$316 | +$956 |
| | Fri 11-13 | $104.60; $4.91 | 2 | +$1,138 | $822 | $0, Overrun $182 | +$316 | +$956 |
| | Mon 11-16 | $104.00; $4.16 | 2 | +$988 | $672 ($510 open profit) | $0, Overrun $32 | +$316 | +$956 |
| | Tue 11-17 | $105.20; $5.25 | 2 | +$1,206 | $890 | $0, Overrun $250 | +$316 | +$956 |
| **R-CORV-D** (a plain hold; no put Mark on Tue 11-10) | Fri 11-06 | $76.50; $5.20 | 3 | +$927 | $1,245 | $0, Overrun $60 | −$318 | +$867 |
| | Mon 11-09 | $76.80; $4.25 | 3 | +$642 | $960 | $225 | −$318 | +$867 |
| | Tue 11-10 | $76.20; no Mark | 3 | Unavailable | Unavailable | Unavailable | −$318 | +$867 |
| | Wed 11-11 | $75.40; $5.12 | 3 | +$903 | $1,221 | $0, Overrun $36 | −$318 | +$867 |
| **R-DALE-D** (buys back 3 at $2.59 Tue 11-10) | Mon 11-09 | $56.90; $2.14 | −6 | −$720 | $816 | $1,164 | −$1,536 | +$444 |
| | Tue 11-10 | $55.80; $2.84 | −3 | −$1,065 (banked −$495) | $198 | $792 | −$1,263 | −$273 |
| | Thu 11-12 | $54.60; $3.53 | −3 | −$1,272 | $0, $9 past the planned amount, Stop Active | $999 | −$1,263 | −$273 |
| | Fri 11-13 | $53.70; $4.21 | −3 | −$1,476 | $0, Overrun $213, Stop Breached | $1,203 | −$1,263 | −$273 |
| **R-DALE-U** (a plain hold; Marks to Thu 11-19; Expiration recorded Fri 11-20) | Mon 11-16 | $60.90; $0.05 | −6 | +$534 | $2,070 | $0, Overrun $90 | −$1,536 | +$444 |
| | Fri 11-20 | — | 0 | +$564, final | — | — | — | — |

Every session of each series is in `prototypes/replay/round-2.html`'s model block; a task that needs another session takes it from there. **K-sale** is R-BREN-U with the last 2 contracts sold at $4.91 on Fri 11-13.

Test support: the four records join `src/domain/trade-analysis/option-trade.ts` and `reference-trade.ts`; a replay view builder joins `tests/support/`.

### T9.3 Trade Analysis: the Trade's result at each boundary, and its standing

Seam: `TradeAnalysis.evaluate` (new `outcomes.test.ts`). A248, A249.

```text
describe("evaluate: the Trade's result at each boundary (A248)")
  it should give R-AXIO-U on Mon 11-02 a result of −$300.00 at the Stop and +$600.00 at the Target, for the 100 shares held
  it should step both when the second lot is bought, to −$740.00 and +$1,060.00 on Fri 11-06
  it should include what is banked: R-BREN-U after the sale gives +$316.00 at the Stop and +$956.00 at the Target
  it should measure an Underlying-price Stop at its frozen amount: R-DALE-D gives −$1,536.00 at the Stop on Mon 11-09
  it should give the same two results on a session whose Mark is missing (R-CORV-D Tue 11-10: −$318.00 and +$867.00)
  it should give a result at the Worst case of −$5,000.00 for R-AXIO-U on Mon 11-02 and −$33,936.00 for R-DALE-D on Mon 11-09
  it should give a result at the Max reward that is Unbounded above for stock and a long Call, and +$564.00 for R-DALE-D
  it should give all four Not applicable, No remaining Position, once nothing is held
describe("evaluate: standing (A249)")
  it should place R-BREN-U on Mon 11-02 between the lines, 28/956 of the way to the Target
  it should place R-AXIO-D on Fri 11-06 380/600 of the way to the Stop
  it should give past the Stop by the Overrun once breached: R-AXIO-D Mon 11-09, $180.00 and 0.30R, crossed
  it should give past the Target by the Target Overrun: R-BREN-U Thu 11-12, $26.00, crossed
  it should give past an Underlying Stop's planned amount while the Stop is still Active: R-DALE-D Thu 11-12, $9.00, not crossed
  it should give no share at break-even, or once the result is past a line
  it should give the open profit inside the Risk to stop: R-BREN-U Mon 11-16, $510.00 of $672.00
  it should be Unavailable with the evaluation's own reason when the Mark is missing
```

### T9.4 Trade Analysis: each session's risk, reward and condition status

Seam: `TradeAnalysis.replay` (`replay-series.test.ts`). A250.

```text
describe("replay: each session's risk, reward and condition status (A250)")
  it should give R-BREN-U's Mon 11-02 session a Risk to stop of $352.00 (1.09R) and a Reward to target of $928.00, both conditions Active
  it should read an option Trade's Underlying condition from that session's Underlying Mark: R-DALE-D Fri 11-13, the Stop Breached, DALE $0.30 past $54.00
  it should carry each session's results at the Stop and the Target, stepping on the session of a sale (R-BREN-U: −$324.00 on Wed 11-11, +$316.00 on Thu 11-12)
  it should give each session its own status and never an earlier date across a gap (R-CORV-D: Target Reached Fri 11-06, Active Mon 11-09, Reached Wed 11-11)
  it should leave Tue 11-10's Mark-dependent figures Unavailable naming the put, and keep its two results
  it should give the change in Risk to stop since the previous session with the figure (R-BREN-U Mon 11-16: down $150.00 since 11-13)
  it should measure a change across a gap from the last session that had the figure (R-CORV-D Wed 11-11: since 11-09)
```

### T9.5 Trade Analysis: markers and the Plan column

Seam: `TradeAnalysis.replay`. A251, A252.

```text
describe("replay: markers (A251)")
  it should mark R-AXIO-U's Mon 11-02 session Opened, with a Buy of 100 at 50.00
  it should mark Fri 11-06 Added with the second lot, and give a session without a Position Change no marker
  it should mark R-BREN-U's Thu 11-12 Reduced, with a Sell of 2 at 4.00 and the Position Change's id
  it should mark K-sale's Fri 11-13 Closed
  it should mark R-DALE-U's recorded Expiration as an Expiration naming the contract, Closed
  it should give a session with two Position Changes two markers, in fact order
describe("replay: the Plan column (A252)")
  it should give R-BREN-U's Plan −$324.00 at the Stop, +$956.00 at the Target and 2.95 to 1
  it should leave the Plan column unchanged after a second lot (R-AXIO-U: −$600.00 and +$1,200.00)
```

### T9.6 The shared replay assembly; `replayTrade` carries the new fields

Seam: `TradeViews.replayTrade` (`replay-trade.test.ts`). P127, A253. The assembly moves to `src/coordinators/replay/` first, with the existing cases passing unchanged; that move is this task's refactor step and needs no new case.

```text
describe("replayTrade: the D9 fields (A250 to A253)")
  it should replay R-BREN-U to the Expected Mark Date with each session's figures, condition status, results at the lines and markers
  it should carry the Plan column
  it should flag K-sale's last session final, Sold, with its Trade P&L the realized result
  it should flag R-DALE-U's last session final, Expired, naming the contract
  it should end a Settlement Due Trade at its expiration session with that session's Mark-based figures, and flag nothing final
  it should read each Instrument's series once, as before
```

### T9.7 Daily Review: the card's replay, to the Review Date

Seam: `DailyReview.getTrade` (`daily-review.test.ts`). A254.

```text
describe("getTrade: the card's replay (A254)")
  it should return R-BREN-U's replay ending at the Review Date, with that session's figures
  it should end at the Review Date even when a later session already has Marks
  it should give the same sessions as replayTrade when the Review Date is the Expected Mark Date
  it should leave out the replay when the Trade's facts cannot be replayed
  it should read no series in `open`: the replay is read by getTrade alone
  it should carry the replay, with the new Mark, on the card a Save Marks result returns
```

### T9.9 Replay adapter: the headline and the stake sentence

Seam: `replay.props` (`replay.props.test.ts`). W36, W37, W38. The adapter selects and formats; it works out no figure.

```text
describe("replay.props: how it is going (W36, W37)")
  it should head R-BREN-U's Mon 11-02 "+$28.00 · 0.09R" and "Ahead: 3% of the way to the Target."
  it should say "Behind: 63% of the way to the Stop." for R-AXIO-D on Fri 11-06
  it should say "Past the Stop by $180.00 (0.30R)." once the Stop is breached
  it should say "Target reached, $32.00 past it." for R-BREN-U on Mon 11-16
  it should say "Past the Stop's planned amount by $9.00, though DALE is still above $54.00." for R-DALE-D on Thu 11-12
  it should head a session without a Mark with the reason at the figure length, and no figure of another session
  it should head a final session "Final result: sold out Fri Nov 13." or "Final result: the put expired Fri Nov 20."
describe("replay.props: what is at stake (W38)")
  it should say "From here: $352.00 at risk to the Stop · $928.00 more to the Target · 2.64 to 1 (the Plan was 2.95 to 1)."
  it should say "$672.00 at risk back to the Stop ($510.00 of it open profit) · no cap above." after the Target, and "at most" a bounded Max reward
  it should add "Even at the Stop this Trade would end $316.00 ahead." when the result at the Stop is above break-even
  it should name the Worst case and the way back up to the Target once past the Stop
  it should say "Nothing is at risk and nothing is left to gain." with what was banked, on a final session
```

### T9.10 Replay frame: the slider reveals sessions

Seam: `ReplayFrame` (`frame.test.tsx`). W42. A plot double stands in for Corridor.

```text
describe("Replay frame: the slider (W42)")
  it should open resting on the last session, with its headline
  it should show an earlier session's headline when the slider moves to it
  it should keep every later session out of the DOM: no figure, date or point of a session after the slider's
  it should move one session with the Left and Right keys and to either end with Home and End
  it should name the slider "Session" and speak "Mon Nov 16 · 11 of 15", then the headline, as its value
  it should start from a given session when one is passed in
  it should keep the slider's session when the same Trade's replay is passed in again with one more session
  it should edge the card in the result's colour and say the result in words, never by colour alone
```

### T9.11 Replay frame: the readout, the table, hover and tap

Seam: `ReplayFrame`. W43, W44, W45.

```text
describe("Replay frame: the readout (W43)")
  it should list the slider's session under "How it is going", "At stake from here, whole Position", "Marks", "Position" and "The Plan", with every figure the charts draw
  it should read an Unbounded Max reward as "No cap above", an Unavailable figure as its reason, and a Not applicable one differently from both
  it should give each figure's change since the session it is measured from, "down $150.00 since Fri Nov 13"
  it should show "Final result" in place of the first two groups on a final session
describe("Replay frame: the text equivalent (W45)")
  it should fold a table titled "Session by session" under the charts, one row per revealed session
  it should read a session without a Mark as "No Mark" in its cells, never a carried value
  it should name each session's events in the Events column
describe("Replay frame: hover and tap")
  it should show a revealed session's Marks and result on hover and on focus
  it should move the slider to a session when it is clicked or tapped
  it should show nothing for a session not yet revealed
```

### T9.12 Corridor: the Underlying's price strip

Seam: `CorridorPlot` (`price-strip.test.tsx`). W39, W40, A256.

```text
describe("Corridor: the Underlying's price (W39)")
  it should draw one point for each revealed session with an Underlying Mark, joined in order
  it should break the line at a session without a Mark, shade that session and label it "No Mark"
  it should draw the strike on an option Trade, and a condition's line where the condition is on the Underlying's price ("Stop $54.00")
  it should run the time axis to the contract's expiration, leaving later sessions blank
  it should size the price axis from the Plan's anchors and the revealed sessions, unchanged by a more extreme later session
  it should mark the slider's session and label its Mark
  it should give the chart an accessible name, and describe it by the table
```

### T9.13 Corridor: the Trade P&L area, the two lines, the banked band and markers

Seam: `CorridorPlot` (`corridor.test.tsx`). W40, W41, A256.

```text
describe("Corridor: the Trade P&L (W40, W41)")
  it should fill from break-even to each revealed session's Trade P&L, as profit above and loss below
  it should break the area at a session without a figure
  it should draw the result at the Stop and at the Target as two lines that step on the session of a Position Change, labelled "Stop +$316" and "Target +$956"
  it should start both lines from the Plan column, at the Plan's results
  it should draw what is banked as a solid band from the sale's session, labelled "Banked +$478", and a realized loss as "Realized −$495"
  it should hatch the area past a line and label it "$32 past the Target"
  it should draw what is at stake once, at the slider's session, in neutral ink, tagged with the Risk to stop and the Reward to target
  it should draw a dashed line through both charts at each Position Change after the entry, labelled "Sold 2 at $4.00"
  it should draw the Worst case and the Max reward only when they fall inside the chart's range
  it should leave out a label that has no free spot, and never the result or the stake tags
```

### T9.14 Trade Detail: the Replay drawer

Seam: `TradeDetail` against the facade double. P128, W1 (amended), W35, A257.

```text
describe("Trade Detail: the Replay drawer (W1 amended)")
  it should show Replay second, after Today, on an Open, a Settlement Due and a Closed Detail
  it should show no Replay drawer on a Planned Detail or one whose records disagree
  it should draw the chart from the replay the Detail already read, with no second read
  it should show "Loading the Trade…" in the drawer while the replay is pending
  it should select the drawer and the session named in the address on load
```

### T9.15 Review card: the replay before the Action

Seam: `ReviewCard` against the facade double. W35, A254.

```text
describe("Review card: the replay (W35)")
  it should show the replay in a section named "Replay" directly above the Action form, resting on the Review Date
  it should draw it from getTrade's result and never call replayTrade
  it should show the new Mark's session after Save Marks, from the save's result, without reading again
  it should show no replay on a card that only owes reflections
  it should show the card's other panels and the Action form when the Trade's facts cannot be replayed
```

### T9.16 Audit navigation, and the round trip to the Review

Seams: `TradeDetail` and `ReviewView`. P129, W46, A257.

```text
describe("Replay: audit navigation (W46)")
  it should offer "Price History" for the slider's session, selecting that drawer with the session's column in focus
  it should offer "Position" on a session with a marker, with the Execution's row in focus
  it should offer "Journal" on a session with Journal items, with that session's card in focus
describe("Replay: the round trip from the Review (P129)")
  it should link the card's "Price History" to the Trade's Detail with the drawer, the session and `from=review` in the address
  it should show "Back to the Review" on a Detail opened that way, and not otherwise
  it should return to that Trade's card with its Action panel open and the slider on the same session
```

### T9.20 Estimates stay apart: their types and the lint rule

Seams: the rule's cases in `tools/estimate-rules.test.ts`, run against small source samples as `tools/cockpit-rules.test.ts` does; `npm run typecheck` for the types. P121, A258.

**Decision for stage B's session to settle before T9.20's brief (D9A-R, decision 118).** Decision 4's odds are worded as an estimate but are exact arithmetic (D9A-R's A267), held as fractions in Trade Analysis. Either they stay outside the `Estimate` type and the estimates rule, with a comment saying why, or they move under it. The planner's lean: they stay outside, since no pricing formula or assumed rate is behind them.

```text
describe("the estimates rule (P121)")
  it should reject an import of `domain/option-pricing` from any file but `trade-analysis/replay-estimates.ts`
  it should reject an import of `replay-estimates` from any file but `replay-series.ts`
  it should reject `parseDecimal` and `Rational` in `option-pricing` and in a value `replay-estimates.ts` returns
  it should allow the About page to import `option-pricing/assumptions.ts`, which holds the two rates and the 365-day line and no formula
  it should pass every file of the current tree
```

### T9.21 Option pricing and implied volatility

Seam: `src/domain/option-pricing/` (`option-pricing.test.ts`). A258, P122.

```text
describe("option pricing (A258)")
  it should price a Call and a Put so that Call − Put = Underlying − strike discounted, to nine decimal places
  it should price an option at 0 days at its exercise value
describe("implied volatility (A258)")
  it should read 32.0% for R-BREN-U on Mon 11-02: BREN $97.20, the call $1.68, 18 days, 4%
  it should return a volatility that prices back to the Mark within half a cent
  it should be Unavailable, expiration session, at 0 days
  it should be Unavailable, at or below exercise value, when the Mark is within half a cent of its floor
  it should be Unavailable, no volatility fits, when the Mark is above the price at 500%
  it should be Unavailable, insensitive to volatility, when one volatility point moves the price by under half a cent (R-BREN-U Tue 11-17)
describe("the assumed rate (P122)")
  it should use 4% up to 365 days to expiration and 5.25% beyond
```

### T9.22 The share equivalent and the split

Seam: `replay-estimates` (`replay-estimates.test.ts`). A258, A259.

```text
describe("share equivalent (A258)")
  it should give R-BREN-U's 4 contracts on Mon 11-02 about 147 shares
  it should be negative for a long Put (R-CORV-D Mon 11-02, about −122) and positive for a short Put (R-DALE-D Mon 11-02, about 189)
  it should be Unavailable with the implied volatility's reason when there is none
describe("the Mark Change Split (A259)")
  it should split R-CORV-D's Mon 11-09 change of −$0.95 a share into −$0.19 from CORV, −$0.32 from time and −$0.44 from volatility
  it should return a remainder so that the four parts add to the Mark's real change exactly
  it should use the real days between sessions over a weekend (R-BREN-U Mon 11-09: time −$0.27)
  it should return the Underlying's part and one part for time and volatility together when the later session has no implied volatility (R-BREN-U Tue 11-17: +$1.13 and −$0.04)
  it should not split when the earlier session has no implied volatility, naming that session
  it should not split across a missing Mark, and measure the change from the last session that had one (R-CORV-D Wed 11-11, since 11-09)
```

### T9.23 `replay` and both views carry each session's estimates

Seams: `TradeAnalysis.replay`, `TradeViews.replayTrade`, `DailyReview.getTrade`. A258. The Review card (D9A-R): the card reads the replay in `getTrade` as before and shows it only in the overlay.

```text
describe("replay: estimates per session (A258)")
  it should give each of R-BREN-U's sessions its implied volatility, share equivalent and split, with the rate and the days used
  it should give a stock Trade an implied volatility that is Not applicable and a share equivalent equal to its shares, marked exact
  it should give R-CORV-D's Tue 11-10 an implied volatility Unavailable, Mark missing
  it should give the same Trade P&L, risk, reward and condition status for a session whether or not its estimates can be worked out
describe("the views: estimates passed through")
  it should carry each session's estimates in replayTrade and in the Review card's replay, unchanged
```

### T9.24 Chips: implied volatility and the share equivalent

Seams: `ReplayFrame` (`chips.test.tsx`) and `AboutView`. W47, W49, W50. The seam is unchanged by D9A-R; the chips render in the overlay, and D9A-R's T9AR.7 already leaves Escape to an inner control.

```text
describe("Replay: chips (W47)")
  it should show "Implied volatility 27.7%" tagged "estimate" for R-BREN-U on Mon 11-16
  it should open a small chart of the revealed sessions' implied volatility on click, on Enter and on focus, and close the small chart with Escape, leaving the overlay open; a second Escape closes the overlay
  it should draw an Unavailable session in that chart as a gap, and say why under the chip (W49)
  it should show "Behaves like ≈ 183 shares", "≈ short 122 shares" for a long Put, and "Behaves like 200 shares" with no tag for stock
  it should show "4 days to expiration" and "Long 2 contracts", and "Expiration session" at 0 days
  it should show no interest rate and no formula note beside the chart
describe("About: option estimates (W50)")
  it should state the formula's limits under "Option estimates"
  it should state both rates and the 365-day line, read from the constants the estimates use
```

### T9.25 The "since the session before" line, and the estimates in the readout and the session cards

Seams: `ReplayFrame` and `replay.props`. W48. Amended by D9A-R: the sentence builds on the Trade P&L's "since" line, the one place that line still stands on a figure (decision 8); W48's "the line under the charts" is placed under the charts' column of the overlay.

```text
describe("Replay: since the session before (W48)")
  it should read "Since Fri Nov 13: Trade P&L −$150.00. The call moved −$0.75 a share: BREN's move −$0.52 · time −$0.22 · volatility −$0.01", tagged "estimate"
  it should draw the parts as a small bar whose text equivalent is the sentence
  it should read "time and volatility together" when they can't be told apart
  it should say the move is not split, why, and the Mark's real change
  it should read "AXIO moved +$1.40 a share" for stock, with no tag
describe("Replay: estimates in the readout and the table")
  it should add "Implied volatility" under Marks and the share equivalent under Position, each tagged "estimate"
  it should add both as rows of each session card, with "Unavailable" where there is none
```

### T9.29 The meter

Seam: `Meter` (`src/ui/cockpit/meter/meter.test.tsx`), plain props. W51, A260. The examples are `trade-list.html`'s rows.

```text
describe("Meter (W51)")
  it should draw a track from the result at the Stop to the result at the Target with a tick at break-even
  it should fill from break-even to the pointer, as profit or loss, outlined for the open part
  it should fill the banked part solid
  it should draw a faint mark at the session before's result
  it should stretch the track past a line by a third at most, hatch that part and make the pointer square
  it should draw the Stop's line to the right of break-even when profit is banked beyond it
  it should draw a dashed, empty track with no pointer when there is no Mark, keeping the faint mark
  it should show no visible words, and carry its name and its hover text
  it should name what was realized "Realized", for a loss as for a gain: "Realized −$440.00" (decision 120)
  it should draw the same parts at each of its three sizes
```

### T9.30 Attention shared, and the meter's reading

Seams: `attentionOf` and `meterReadingOf` in `src/coordinators/valuation/`. A260, A261. The move comes first, with `attention.test.ts`'s cases passing unchanged from the new path; that is the refactor step.

```text
describe("meter reading (A260)")
  it should give R-BREN-U on Mon 11-16 the lines +$316.00 and +$956.00, the result +$988.00, banked +$478.00 and past the Target by $32.00
  it should give the session before's result with its date (+$1,138.00 on 11-13)
  it should give no earlier result when the session before has no figure
  it should keep the lines and the earlier result when today's Mark is missing, with the reason
  it should give R-DALE-D on Thu 11-12 past the Stop's line by $9.00 while the Stop is Active
```

### T9.31 Daily Review: each walked Trade's meter reading

Seams: `DailyReview.open` and `save`. P133.

```text
describe("open: the meter reading (A260)")
  it should give each walked Trade its meter reading at the Review Date, with the session before as the earlier result
  it should read one more date's Marks for the whole Review and none per Trade
  it should refresh the reading of every card that shares a saved Mark's Instrument, in the Save Marks result
```

### T9.32 Trade Views: the Open list in attention order, with each row's meter reading

Seam: `TradeViews.browseTrades`. A262, P131.

```text
describe("browseTrades: the Open list's default order (A262)")
  it should list a Trade past its Stop before one that is not, whatever their Last Activity
  it should order Trades in the same band by the share of their range used, a losing side before a winning one, then Last Activity
  it should list a Trade whose facts cannot be replayed first, with the blockers
  it should give the same order as the Review's walk for the same Trades when the Review Date is the Expected Mark Date
  it should carry each item's band, reasons and meter reading
  it should leave the Planned and Closed lists in their orders
  it should read one more date's Marks for the page and none per Trade
```

### T9.33 Review card: the meter replaces the slider

Seam: `ReviewCard`. W51. Replaces D5R's slider cases; section 1.5 lists the specs that change. Re-read against D9A-R's decision 3: "the slider" here is the Stop-to-Target slider in the card's header (`StopTargetSlider`), not the replay's, and the four cases stand. The card's body now holds a "Replay" button and no chart, so the meter is the only drawing on the card while the Action is written; and `e2e/d5r/review.spec.ts` is also changed by D9A-R's T9AR.20 (line 28, the summary), on different lines from T9.33's five.

```text
describe("Review card: the meter (W51)")
  it should show the meter in the card's header, named by its figures, and no slider
  it should show the dashed track named by the reason when the Mark is missing
  it should follow a Save Marks result without reading again
  it should keep the header's other parts and their order
```

### T9.34 Open list: the meter under the P&L, in the read's order

Seam: `TradeList`. W51, W52.

```text
describe("Open list: the meter (W51, W52)")
  it should show each Open row's meter under its P&L figure, with no new column
  it should show the rows in the order the read returns them, under "In the Review's order"
  it should show the dashed track on a row with no Mark or a Settlement Due contract
  it should show no meter on the Planned and Closed lists
```

### T9.35 Trade Detail: the meter on the Conditions card

Seams: `ConditionsCard` and `conditions.props`. P130, W51.

```text
describe("Conditions card: the meter (P130)")
  it should show the meter at the top of the card on an Open Detail, above the conditions
  it should take the session before's result from the replay
  it should show the dashed track when today's Mark is missing
  it should show no meter on a Planned or a Closed Detail
```

---

## 6. Structural tasks

| Task | Exact verification | Expected result | Notes |
|---|---|---|---|
| T9.1 A third browser stage | `npm run test:e2e`; `.claude/scripts/run-complete.test.sh`; one full-tier run through `suite-runner`, then `.claude/scripts/run-complete.sh evidence/D09 <label>` | `test:e2e:3` runs `e2e/d8p` and `e2e/d8` (the `e2e/d8` pattern also matches `e2e/d8r`); `test:e2e:2` keeps `e2e/d5`, `e2e/d5r`, `e2e/d6`, `e2e/d7p`, `e2e/d7`; every test still runs once (the three stages' counts add to gate-full1's 262); the full tier writes six stage files and prints "run complete"; no stage is above 8 minutes. | P136. `e2e/d9` joins `test:e2e:3` with its first spec, in T9.18: Playwright fails on a folder with no tests. Every file in section 1.5's Names list is changed or says why not. |
| T9.2 Types | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint` | Types compile; every new field is optional. | Lets CF and CP write doubles before TA finishes. |
| T9.8 Facade and manifest | `npm run verify:capabilities`; `npx vitest run src/coordinators/workspace`; `npm run typecheck` | `TradeViewsAndReporting.replayTrade` gains the variants `ConditionStatus` and `Markers`; `DailyReview.getTrade` gains `Replay`; the Trade Detail and Review routes require them; the manifest test lists them. | AC-CAP-001. No operation is added. |
| T9.17 Stage A: Node integration suite | `npm run test:integration`, then `.claude/scripts/acceptance-commands.sh plan/D09-trade-replay.md` | I9.1, I9.2, I9.3, I9.4, I9.5, I9.6 and I9.7 pass; the script exits 0 for their rows. | |
| T9.18 Stage A: browser suite | `npm run test:e2e`; the acceptance script | B9.1, B9.2, B9.3, B9.4 and B9.5 pass; the script exits 0 for stage A's rows. | Adds `e2e/d9` to `test:e2e:3`. |
| T9.19 Stage A gate | A fresh critic per section 8, flows C9.1, C9.2, C9.3 and C9.4, after a full-tier run | Every flow passes. Tag `claude-opus-5.5-d9a`. | A light gate: no benchmark. |
| T9.26 Stage B: Node integration suite | `npm run test:integration`; the acceptance script | I9.8 and I9.9 pass. | |
| T9.27 Stage B: browser suite | `npm run test:e2e`; the acceptance script | B9.6 and B9.7 pass. | D9A-R: B9.6 and B9.7 each open the replay through the overlay; B9.7's chips at 375 and 320 are measured inside the full-screen overlay. |
| T9.28 Stage B gate | A fresh critic, flows C9.5 and C9.6, after a full-tier run | Every flow passes. Tag `claude-opus-5.5-d9b`. | D9A-R: no change to C9.5's and C9.6's pass conditions; the critic opens the replay through the overlay. |
| T9.40 Remove the range position | `npm run typecheck`; `npx vitest run src/coordinators src/ui`; `npm run verify:capabilities`; `npm run verify:fixtures`; `npm run test:integration`; `git diff --stat tests/fixtures` and `git diff -U0 tests/fixtures`; `grep -rn "rangePosition\|RangePosition\|RangePlacement" src tests tools e2e` | `rangePosition`, `RangePlacement`, `RangePositionResult` and `rangePositionOf` are gone, and the grep finds nothing. The fixture diff deletes exactly the 84 `rangePosition` entries (and the comma each leaves) in the eight files and nothing else. `DailyReview.open`'s `RangePosition` variant becomes `Meter`, and `browseTrades` gains `AttentionOrder` and `Meter`. `verify:fixtures` and the D8 round trip pass. | P132. After T9.33 removed the only reader. Each D5R case that asserts the range position is re-pointed at the meter reading for the same Trades, or deleted where T9.30 or T9.31 already asserts the same fact; `evidence/D09/structural.md` lists each one and which it was. |
| T9.36 Expected Open rows | `npm run bench:expected`; `git diff --stat bench/`; a sorted comparison of the old and new rows | `bench/expected-open-rows.json` holds the same rows in attention order, with the same headers; any change to a row's text is only the meter's name, if the comparison reads it. | If the generator orders the rows itself, its sort changes here too; the task's file list comes from `grep -rn "expected-open-rows" tools`. |
| T9.37 Stage C: Node integration suite | `npm run test:integration`; `npm run verify:fixtures`; the acceptance script | I9.10 and I9.11 pass; every frozen fixture's views still compare. | |
| T9.38 Stage C: browser suite | `npm run test:e2e`; the acceptance script | B9.8, B9.9, B9.10 and B9.11 pass; the script exits 0 for every row. | |
| T9.39 Deliverable gate | A fresh critic, flows C9.7, C9.8 and C9.9, after a full-tier run | Every flow passes. Then the benchmark (decision 114), then the tag `claude-opus-5.5-d9`. | |

---

## 7. Mock-free integration tests

D1 to D8R's disclosed substitutes still apply. D9 adds none.

### 7.1 Node application-stack suite (`tests/integration/d9/`)

| Case | File | Given / When | Then |
|---|---|---|---|
| I9.1 The replay's figures, end to end (AC-CALC-003, per session) | `replay.test.ts` | R-BREN-U entered through the facade, Marks to Mon 11-16; `replayTrade`; restart; read again. | Section 5's figures on each named session: Trade P&L, banked, Risk to stop, Reward to target, the two results, each condition's status. Equal after restart. |
| I9.2 Gaps stay gaps (AC-MARK-004) | `gaps.test.ts` | R-CORV-D with no put Mark on Tue 11-10; then an acknowledgment for it. | Tuesday's Mark-dependent figures Unavailable, its two results kept; Wednesday's changes measured from Monday; the acknowledgment never becomes a price. |
| I9.3 Buying more, selling part, and a sale below the Stop | `scaling.test.ts` | R-AXIO-U and R-AXIO-D. | The two results step on Fri 11-06 and Mon 11-09; the banked −$440.00; the Overrun $180.00; the markers Opened, Added and Reduced. |
| I9.4 The Review's replay | `review.test.ts` | R-BREN-U; the Review for Thu 11-12 opened on Fri 11-13 before Friday's Marks, and again after them. | `getTrade`'s replay ends at Thursday both times; it equals `replayTrade`'s through Thursday. |
| I9.5 How a replay ends | `lifetime.test.ts` | K-sale; R-DALE-U before and after its Expiration is recorded; a Planned Trade. | Final, Sold; Settlement Due ends at Fri 11-20 with nothing final; then final, Expired; Not applicable. |
| I9.6 Query counts (AC-PERF-001, cumulative) | `query-count.test.ts` | R-BREN-U open; count the store requests of `replayTrade`, `getTrade` and `open`. | `replayTrade`'s requests are unchanged from D8R. `getTrade` adds one series read per Instrument. `open` is unchanged. |
| I9.7 The manifest (AC-CAP-001) | `capabilities.test.ts` | The installed manifest and routes. | The variants of T9.8, and every route's requirements installed. |
| I9.8 Estimates explain and never value (AC-CALC-005) | `estimates.test.ts` | R-BREN-U, R-CORV-D and R-DALE-D through the facade. | Each session's implied volatility prices back to its Mark; the split's parts add to the Mark's change; Tuesday's are Unavailable; the reasons are stable codes; a stock Trade's are Not applicable or exact. |
| I9.9 The exact figures don't read the estimates | `estimates.test.ts` | R-BREN-U with Mon 11-16's call Mark saved at its exercise value, then corrected to $4.16. | With the first Mark, no implied volatility and every exact figure a Value; after the correction, the estimates appear and the exact figures are those of section 5. |
| I9.10 The meter and the order | `meter.test.ts` | The four Trades open at Fri 11-13; `browseTrades`; the Review for Fri 11-13. | The Open list's order equals the Review's walk; each item's reading matches A260; no view holds a `rangePosition`. |
| I9.11 Query counts with the meter (AC-PERF-001) | `query-count.test.ts` | The same four Trades; count the requests of `browseTrades` and `open`. | Each reads one more date's observations than in stage A, and nothing per Trade. |

### 7.2 Browser suite (`e2e/d9/`, Playwright against the built app on `localhost:5175`, under the lock)

| Case | File | Procedure | Expected |
|---|---|---|---|
| B9.1 Replay in Trade Detail | `replay.spec.ts` | R-BREN-U through the UI to Mon 11-16; open Replay; move the slider back to Thu 11-12 and to Mon 11-02 by keyboard. | W36, W37 and W38 for each session; the two lines step at the sale; the banked band from Thu 11-12; nothing of a later session in the page. |
| B9.2 A gap, a breach and a sale below the Stop | `gaps.spec.ts` | R-CORV-D to Wed 11-11; R-AXIO-D to Mon 11-09. | "No Mark" on Tuesday and a broken area; "Past the Stop by $180.00 (0.30R)."; "Realized −$440"; the table's rows say the same. |
| B9.3 Replay in the Review, and the round trip | `review.spec.ts` | R-BREN-U; open the Review card; move the slider; press Price History; press Back to the Review. | The section sits above the Action form; Price History opens on that session; the return lands on the same card, panel and session. |
| B9.4 How a replay ends | `states.spec.ts` | K-sale; R-DALE-U Settlement Due, then with its Expiration recorded; a Planned Trade. | W1 (amended) per state; the "Final result" headline; no Replay drawer on the Planned Trade. |
| B9.5 Responsive, accessible and offline (AC-UI-001, AC-UI-002, AC-DEL-001) | `responsive-a11y.spec.ts` | Replay in Detail and in the Review card at 1280, 375 and 320 px; resize with the slider moved; axe on each; reload with the server stopped. | The headline and both charts fit one screen (800 px high at 1280; 667 px at 375 and 320); no sideways scroll; the slider's session survives the resize; no WCAG 2.1 AA violation; the replay reads offline. Decision 119 (revision 108): the offline reload is made by `e2e/d9ar/responsive-a11y.spec.ts` (B9AR.7), which T9.20-D1 found duplicates it; this file keeps the rest. |
| B9.6 The estimates | `estimates.spec.ts` | R-BREN-U and R-CORV-D; open the replay through the overlay (D9A-R); open each chip by keyboard; read the line under the charts at Mon 11-09 and Wed 11-11. | W47, W48 and W49; every estimate tagged; the not-split sentence after the gap; no rate beside the chart; W50 on the About page. |
| B9.7 The estimates, accessible | `estimates-a11y.spec.ts` | The chips' small charts at 375 and 320 px, measured inside the full-screen overlay (D9A-R); axe with a chart open; Escape. | No sideways scroll; focus returns to the chip; no violation. |
| B9.8 The meter on Review cards | `meter-review.spec.ts` | D5R's card fixture; the Review at its date; save a Mark. | W51 on each card; the dashed track on the card without a Mark; the meter follows the save. |
| B9.9 The Open list | `open-list.spec.ts` | The four Trades at Fri 11-13; open the list; compare with the Review's order. | The rows in the Review's order under "In the Review's order"; each row's meter named per W51. |
| B9.10 The meter on Trade Detail | `meter-detail.spec.ts` | R-BREN-U at Mon 11-16; a day with a missing Mark. | The meter at the top of the Conditions card; the dashed track. |
| B9.11 The meter, responsive and accessible | `meter-a11y.spec.ts` | The list, a Review card and the rail at 1280, 375 and 320 px; axe. | The meter under the figures line on a phone; no sideways scroll; no violation; no meaning by colour alone. |

---

## 8. Browser-critic flows

The critic receives:
- the frozen `specs/` and the plan index;
- the D1 to D8R breakdowns and this one;
- `prototypes/replay/round-2.html` (the Corridor tab) and `prototypes/replay/trade-list.html` as the design, and `research/replay-requirements.md`;
- the future capabilities that are not defects: Ribbon; spreads; Daily Bar candles; a moved Stop's marker; Deviation markers; in stage A, the estimates and the meter; in stage B, the meter.

It runs `npm run build && npm run preview` (port 5175, under the lock) itself and does not edit code.

| Flow | Stage | Actions | Pass condition |
|---|---|---|---|
| C9.1 The ten-second read | A | Open Replay on a winning and a losing option Trade and a stock Trade, without touching the slider. | The headline says how the Trade is going and what is at stake; a winner reads green and a loser red, whatever its Reward to target; price and P&L are on screen together. |
| C9.2 Watching it unfold | A | Slide from the first session to the last on a Trade with a second lot, one with a partial sale and one with a missing Mark. | Nothing later shows early; the two lines step at each Position Change; banked profit is a solid band; a gap is a gap; every figure in the charts is in the readout and the session cards. |
| C9.3 In the Review | A | Walk a Review with three Trades; open the replay from the card's Replay button before each Action; go to Price History and back. | The replay rests on the Review Date; the return restores the card, the panel and the session; the Action still saves in one press. |
| C9.4 Narrow, keyboard and offline | A | Replay at 375 and 320 px; drive it by keyboard only; stop the server and reload. | One screen; no sideways scroll; every control reachable and named; works offline. |
| C9.5 The estimates explain | B | An option Trade over a session where the Underlying barely moves and the option does; a session with a missing Mark; the last sessions before expiration. | Implied volatility, the share equivalent and the split are labelled estimates and drawn unlike Marks; no interest rate shows beside them, and the About page states the rates and the formula's limits; each is Unavailable with a reason where it can't be worked out; no P&L or risk figure changes when one is Unavailable. |
| C9.6 A wrong Mark shows | B | Correct one option Mark to a plausible but wrong price, then back. | The implied volatility jumps on that session and settles when corrected; the exact figures follow the Mark alone. |
| C9.7 The meter reads the same everywhere | C | One Trade's meter on its Review card, its Open-list row and its Detail. | The same reading in all three; no visible words; the hover and the screen-reader name carry the figures. |
| C9.8 The Open list's order | C | Six Open Trades: one past its Stop, one with no Mark, the rest at different distances. | The list is in the Review's order; Planned and Closed are unchanged. |
| C9.9 The whole deliverable, narrow and offline | C | The list, the Review and Trade Detail at 375 and 320 px; offline reload. | No sideways scroll; everything reads offline. |

---

## 9. Process

- **Decision 111's swarm rules** apply in stage A only (stages B and C follow decision 100: one task at a time, each ending with a complete run), with D08P's and D8R's tooling: lane worktrees set up by hand with `git worktree add` and `lane-setup.sh`, the lane tier, merge runs, the browser lock, and the full tier before every critic.
- **One session per stage.** Each starts from its own handoff, takes the session lock, and ends with its final report. Stage B's and stage C's handoffs are written when the stage before them ends.
- **The wording rule (P137)** goes into every brief for a task that puts words on screen, word for word: what the task may shorten, what it may not, and that its summary must list each change with its before and after. The main session copies each one into `evidence/D09/words-changed.md`.
- **Run rules (P138), carried into every stage's handoff:** provisional words listed for approval (P135); moderate or lower defects left after three critics at a gate become tech debt, while a high defect or a FAIL still stops the run; a known flaky case that fails a run is rerun alone once.
- **Evidence** for all three stages is under `evidence/D09/`, since `tdd.sh` maps `T9.n` there.

---

## 10. Follow-ons (outline only)

- **Ribbon**, as a second plot beside Corridor (A255).
- **Spreads** in replay and the estimates, one implied volatility per leg (D10).
- **Daily Bar candles** in the price strip (D11).
- **Stop Discipline episodes** as markers (D12), **a moved Stop's marker** (D17), **correction markers** (D15).
- **Sorting and filtering on the Trades list** (the user, 2026-11-17; filters are D22's). Attention stays the default order, and a sort choice is added to the request (A262).
- **A Review for an earlier date**, which the round trip's address would then carry.
- Refining the estimated odds with the chance that neither the Stop nor the Target is reached before expiration (D9A-R's decision 4). A new task with its own words, for the user to commission.

---

## 11. Tech debt triggers

- **Item 3** (the Review's open grows with history): **touched by T9.31**, which values each walked Trade a second time, at the session before. I9.11 counts the reads, and the benchmark after stage C measures the open. T9.7's replay is read by `getTrade`, one card at a time, and not by `open`.
- **Item 8** (the Review's save cost): not touched; a Save Marks result gains the card's replay, built by the code `getTrade` uses.
- **Item 22** (the D7S prefactor's slowdowns): measured again by the benchmark after stage C.
- **Item 28** (an Underlying condition reads "Breached" on the rail with no alert elsewhere): **not fixed, and now also visible in replay.** A session where the Underlying is past its trigger and the contract's Mark is missing shows the crossing in the price strip while the P&L is Unavailable. The replay follows `evaluate`, so it changes when item 28 is settled.
- **Item 11 and the `PositionChangeForm` focus case** (D8R's suspected flake, not yet a tech debt item): not touched.
- **Item 25** (the Today table at 960 to 1100 px): not touched; T9.14 adds a drawer and leaves Today alone.
- **The other items:** none names the files D9 changes.

---

## 12. Open questions

Asked one at a time, in this order. Each answer is recorded here.

1. **Three stages or one run (P118).** Recommended: three stages (A the chart, B the estimates, C the meter), each with its own session and critic. **Answered 2026-11-17: three stages in one deliverable**, as recommended.
2. **A swarm in each stage (P119).** Recommended: yes, with an agent cap of 4. **Answered 2026-11-17: a swarm for stage A only.** Stages B and C run one task at a time.
3. **The interest rate (P122).** Two fixed rates chosen by days to expiration, 4% up to 365 days and 5.25% beyond, shown on screen. Recommended: yes, with the line at one year. **Answered 2026-11-17: the rates and the line as recommended. The rates are not shown with the estimates; they are stated on the About page.** The planner's reading, for the user to correct: the formula's other limits (no dividends, exercise only at expiration) move to the About page with them, and the chart keeps only the "estimate" tag.
4. **The spec amendments (P123).** ADR 0007, the spec index, four glossary terms, two Trade Analysis sentences and one UI contract sentence, worded as in section 1.2. Recommended: approve as written. **Answered 2026-11-17: approved as written.**
5. **A new acceptance scenario, AC-CALC-005 (P123).** Recommended: add it, so the estimates have a row in the matrix. **Answered 2026-11-17: add it, as recommended.**
6. **The meter on Trade Detail (P130).** Recommended: at the top of the Conditions card. **Answered 2026-11-17: at the top of the Conditions card, as recommended.**
7. **The Open list in attention order (P131).** It costs one sort, one sentence in the Trade Views spec, the benchmark's expected rows regenerated, and a check of 15 positional test lines. Recommended: yes. **Answered 2026-11-17: attention order for now. Sorting and filtering will be added to the Trades list later, and nothing here may prevent that** (A262 lists how).
8. **`rangePosition` (P132).** Keep it returned and unread, or remove it and delete 84 entries from eight frozen fixtures. Recommended: keep it. **Answered 2026-11-17: remove it now.** It became T9.40.
9. **The session-before mark on the list and the Review cards (P133).** It costs one more date of Marks per page and a second valuation per Trade. Recommended: build it, and let the benchmark decide; the fallback is to keep it on Trade Detail only. **Answered 2026-11-17: build it everywhere, and let the benchmark decide.**
10. **The words W35 to W52, and W1's amended drawers (P135).** Recommended: approve, or edit in place. **Answered 2026-11-17: stage A's words are approved** (W1 as amended, W35, W36, W37, W38, W39, W40, W41, W42, W43, W44, W45, W46). The user's concern, recorded with the answer: too much text on the chart. **Follow-up, answered 2026-11-17:** build the text as the prototype has it; each task judges whether its words should be shorter, erring toward concise, and may shorten them with the user's approval given in advance, keeping the before and after (P137). On that basis **stage B's words (W47, W48, W49, W50) and stage C's (W51, W52) are approved too.**

---

## 13. Acceptance matrix rows

Status values: `planned`, `covered`, `intentionally not advertised`.

| Scenario | Deliverable | Tasks | Integration / browser | Critic | Command or procedure | Expected | Status |
|---|---|---|---|---|---|---|---|
| AC-MARK-004 (partial: points and gaps in the chart and its table; Daily Bar candles in D11) | D9 | T9.4, T9.11, T9.12, T9.13 | I9.2; B9.2 | C9.2 | `npx playwright test e2e/d9/gaps.spec.ts` | A session without a Mark is a gap in both charts and "No Mark" in the table; nothing is carried or joined across it | planned |
| AC-CALC-003 (re-proven per session: each condition's status, the risk and reward, and the Overrun) | D9 | T9.3, T9.4 | I9.1; B9.1 | C9.2 | `npm run test:integration -- d9/replay` | Each session's conditions keep their own status; a crossing shows its Overrun | planned |
| AC-CALC-005 (new: Estimates explain and never value) | D9 | T9.20, T9.21, T9.22, T9.23, T9.24, T9.25 | I9.8, I9.9; B9.6 | C9.5, C9.6 | `npm run test:integration -- d9/estimates` | Estimates labelled, Unavailable with reasons, and read by no exact figure | covered (stage B, T9.28) |
| AC-CALC-004 (cumulative: no payoff line in replay; no theoretical price shown as a value) | D9 | T9.13, T9.23 | I9.9; B9.4 | C9.5 | `npx playwright test e2e/d9/states.spec.ts` | Replay draws no Expiration Payoff; an estimate is never shown as a price | covered (stage B, T9.28) |
| AC-CAP-001 (cumulative) | D9 | T9.8 | I9.7 | — | `npm run test:integration -- d9/capabilities` | The manifest lists what is reachable | planned |
| AC-PERF-001 (cumulative: reads counted; the benchmark after stage C) | D9 | T9.6, T9.7, T9.31, T9.32 | I9.6, I9.11 | — | `npm run test:integration -- d9/query-count`; then decision 114's benchmark | Reads grow by dates and Instruments, never by Trades; both latency budgets hold | planned |
| AC-UI-001, AC-UI-002 (cumulative: the chart's gaps, its text equivalent, live resize, keyboard) | D9 | T9.10, T9.11, T9.12, T9.13, T9.14, T9.15, T9.24, T9.29, T9.34 | B9.5, B9.7, B9.11 | C9.4, C9.9 | `npx playwright test e2e/d9/responsive-a11y.spec.ts` | No sideways scroll; axe clean; every graphed number in text | planned |
| AC-DEL-001 (cumulative: the replay reads after a stopped, offline restart) | D9 | T9.14 | B9.5 (its offline reload is B9AR.7's since T9.20-D1, decision 119) | C9.4 | `npx playwright test e2e/d9ar/responsive-a11y.spec.ts` | Replay opens offline | planned |
| AC-REV-002 (cumulative: the Review's order and resumption unchanged by the meter) | D9 | T9.31, T9.33 | I9.10; B9.8 | C9.7 | `npx playwright test e2e/d9/meter-review.spec.ts` | The walk's order and saved outcomes are as before | planned |

AC-RESP-001, AC-DEL-004 and AC-DEL-006 gain nothing: D9 adds no mutation. AC-REBUILD-001 gains nothing: D9 adds no index or projection. AC-BACK-001 and AC-REST-001 gain nothing: D9 stores nothing new.

---

## 14. Evidence recording

Under `evidence/D09/`:
- `tdd-log/<task>.md` (red and green per case, one file per task);
- `structural.md` (T9.1's stage counts, T9.2, T9.8, T9.36's diff), `provenance.md`;
- `critic-<n>.md` (each stage's gate);
- `suite-runs/` (lane tiers and merge runs);
- `ocr/`;
- `DECISIONS-PENDING.md` (decision 113, as amended);
- `new-words.md` (words used provisionally);
- `words-changed.md` (P137: each shortened text, by task, with its before and after);
- `bench.md` (the benchmark after stage C).

Each critic defect is first reproduced by a failing test.

---

## 15. Progress

Status, not plan: editing this section is not a plan revision (decision 100, amended by decision 111). The main session alone edits it. Stage A's rows have a wave and a lane and run as a swarm; stage B's and stage C's have none and run one at a time, in this order.

| Task | Stage | Wave | Lane | Status | Commits |
|---|---|---|---|---|---|
| T9.1 | A | 0 | TL | Done | `adcc6abb` |
| T9.2 | A | 0 | TY | Done | `7251c72b` |
| T9.3 | A | 1 | TA | Done | `ad1ffc33`; B1 `8df5d829`; B2 `6791f5db`; B3 `2a9c512d` |
| T9.4 | A | 1 | TA | Done | `7ee4e93a`; B1 `b565f15e` |
| T9.5 | A | 1 | TA | Done | `1bbca00d`; B1 `f9b9172f`; B2 `f670c081` |
| T9.9 | A | 1 | CF | Done | `1687f447`; B1 `516ba4c3` (lane TA); B2 `486c719d`; B3 `e52bbe37` |
| T9.10 | A | 1 | CF | Done | `0e0a8efb`; B1 `b3f0a4c7`; B2 `62e57929` |
| T9.11 | A | 1 | CF | Done | `b6701de5`; B1 `1b092cdd`; B2 `691b16b8`; B3 `bf9d8758`; B4 `82154dd3`; B5 `65b5ba3c`; B6 `69cd07c8`; B7 `a9183904` (B5, B6, B7 in lane CP) |
| T9.12 | A | 1 | CP | Done | `9fbdd2f3`; B1 `523decd4` |
| T9.13 | A | 1 | CP | Done | `622301c9`; B1 `51ec9e0d`; B2 `d3acb89b`; B3 `f3e996c3`; B4 `e263efa1` |
| T9.6 | A | 2 | RV | Done | `8c810c83`; B1 `40b6263e` |
| T9.7 | A | 2 | RV | Done | `09025961`; B1 `93b4518d`; B2 `1e0cc8cd`; F2 `b7420080`; F3 `42c9a72b` |
| T9.8 | A | 2 | RV | Done | `484db753` |
| T9.14 | A | 2 | DW | Done | `55693c1b`; B1 `3673b133`; B2 `47cc47a8`; B3 `be72b96d`; F2 `522ea0d5`; B6 `3f600a19`; B7 `a6574548`; B8 `9f7ba7b0`; B4 `a23674b0`; B9 `8042ce81`; B5 `8fc85691`; F1 `5d74779e`; B10 `d52de7fc` |
| T9.15 | A | 2 | RW | Done | `6218d5e0`; B1 `5e617641` |
| T9.16 | A | 2 | DW | Done | `8cbdd619`; B1 `f4e9b8a6`; B2 `ecaa8bbd` |
| T9.17 | A | 3 | IN | Done | `416d52df`; B1 `749aff06`; B2 `d2732e30`; B3 `e216f70a` |
| T9.18 | A | 3 | BR | Done | `2266321b`; F2 `561635ef`; B1 `de7818ac`; F1 `7a653e1b`; F3 `7ed4d0ff`; B2 `a58f0858`; B3 `e00066ac`; F4 `8773200f` |
| T9.19 | A | 3 | — | Done (closed by the user's decision with critic-2's four defects carried into D9A-R, section 1.8) | B1 `ae55b7e6`; B2 `e718c280`; B5 `24473015`, `12d7c4a7`; B9 `ddcb01c7`; B10 `8a9a3c14`; B12 `c8aab4cb`; F1 `b0c1c0e3`; B6 `7a4f37b1`; B7 `c30e4da6`; B13 `dd84dec5`; B8 `806857e7`; F2 `c4187556`; B4 `4ea73e48`, `55388096`; B14 `e70946fe`; B3 `f84a9391`; B11 `1047b81a`; full run `2b9497c7`; critic-2 `946e2257` |
| D9A-R | — | — | — | Done, after T9.19 and before T9.20: see [D09A-R-stage-a-refactor.md](D09A-R-stage-a-refactor.md), section 15. Tagged `claude-opus-5.5-d9ar` | gate critic-3 at `7a776e7e`; evidence `evidence/D09AR/report.md` |
| T9.20 | B | — | — | Done | `aa5a5c79`; B1 `273df21d`; B2 `4228114d` |
| T9.20-D1 | B | — | — | Done (the user's SB-Q2 answer: remove the `e2e/d9` cases `e2e/d9ar` duplicates; one found; decision 119) | `f1209b94` |
| T9.20-D2 | B | — | — | Done (the user's SB-Q2 answer: a `browser-4` stage for `e2e/d9` and `e2e/d9ar`) | `8d8f37c2` |
| T9.21 | B | — | — | Done | `0ac934d0` |
| T9.22 | B | — | — | Done | `7291900a`; B1 `5f08db60` |
| T9.23 | B | — | — | Done | `4bf2c557`; B1 (suite failure) `9c2a0b35` |
| T9.24 | B | — | — | Done | `d96f7ae8` |
| T9.25 | B | — | — | Done | `4e30a157`; B1 `119880de`; B2 (suite failure) `5268e5ac` |
| T9.26 | B | — | — | Done | `7d0c3c08`; B1 `48aa665f`; B2 `d7f2b65e` |
| T9.27 | B | — | — | Done | `ad16f6b7`; B1 `855ad380` |
| T9.28 | B | — | — | Done | critic-b1 (1 moderate, 1 low); B1 `db89563a`; critic-b2 PASS, no defects |
| T9.28-D1 | B | — | — | Done (`224043dd`) | Decision 120: "Realized" for a gain and a loss |
| T9.28-D2 | B | — | — | Done (`bf3e10bd`) | The user's word review, item B7: the not-split sentence shortened (P137) |
| T9.29 | C | — | — | Done | `52b83cb5`; B1 `934fd967`; B2 `d9a75703` |
| T9.29-D1 | C | — | — | Done (the user, 2026-11-20: fix the test that flaked in run `t9.29`, tech debt item 7) | `610fe293` |
| T9.30 | C | — | — | Done | `349ad6ec` |
| T9.31 | C | — | — | Done | `7b73e835`; B1 `479c7635`; D1 `4d7e2f2d` |
| T9.31-D1 | C | — | — | Done (the user's SC-Q1 answer (a): the six older Review-open request lists gain the one date's read) | `4d7e2f2d` |
| T9.32 | C | — | — | Done | `7fe75de2` |
| T9.33 | C | — | — | Done | `e2b082c8` |
| T9.34 | C | — | — | Done | `12ed0a9f`; B1 `ffa14452`; B2 `4026dfd1` |
| T9.35 | C | — | — | Done (raised to Full; its run's only failures are SC-Q1's six) | `6c31fc93`; B1 `930e2f73` |
| T9.40 | C | — | — | Done | `ae057f91` |
| T9.36 | C | — | — | Not started | |
| T9.37 | C | — | — | Not started | |
| T9.38 | C | — | — | Not started | |
| T9.39 | C | — | — | Not started | |
