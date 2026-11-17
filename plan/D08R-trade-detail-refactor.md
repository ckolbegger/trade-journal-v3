# D08R — The Trade Detail refactor: task breakdown

Definition: [implementation plan, D8R](implementation-plan.md#d8r--the-trade-detail-refactor), added by plan revision 104 (decision 115). D8R carries out the Trade Detail audit (`research/trade-detail-audit.html`, written 2026-11-14 from `ca839e70`). It removes the leftovers of the pre-cockpit page, moves misplaced parts to their views, gives every Trade with a Position a Today view, and names every contract in the broker style. It runs after D8 (`claude-opus-5.5-d8`, `be736f8b`) and before D9. It is drafted from `plan/D08R-drafting-handoff.md` on `claude-opus-5.5` at `6b11c8bc`.

Status: **breakdown agreed by the user on 2026-11-17** (plan revision 104, decision 115). The six open questions in section 12, and question 5's follow-up, were answered on 2026-11-15, one at a time, and the breakdown was updated to match before it was agreed. The next plan decision is 116. Numbering continues from D8: P108 and A230. The approved words continue from D08P's W20.

**In the trader's words.** Each part of Trade Detail shows each thing once, in the place you'd look for it:
- **Today** becomes one Marks table (Today, Yesterday, Change) on every Trade that holds or held a Position, including Settlement Due and Closed ones.
- **The rail** shows how far each price is from its trigger, and the latest dated P&L when today's isn't in yet.
- **Plan and Risk** holds every dollar figure about risk and reward, the new lots since the last Marks, Planned-Leg Fulfillment and Deviations.
- **Position** names the contract on every row.
- **Journal** entries shrink to one dated line, with a pointer to active Deviations.
- **Price History** shows each Mark's source, saved time and correction.
- **Every contract** reads "NVDA Dec 18 $150 Call" everywhere in the app.

---

## 1. Decisions and clarifications

### 1.1 Decisions for this breakdown

The user has already decided (handoff section 4): D8R is a swarm; the whole audit is in scope; every word in audit sections 15 and 19 is approved; a Closed Trade sold before expiration shows the Underlying's Mark on the session of the final sale; the section 17 items are out of scope; revision 98 stands. The rows below are the planner's proposals.

| # | Question | Recommendation | Alternatives and tradeoff |
|---|---|---|---|
| P108 | **The swarm's shape.** | **Three waves, eleven lanes over the deliverable, an agent cap of 6** (section 4). Wave 0 runs four lanes at once: the view types, the shell, the contract names and Price History. Wave 1 runs seven lanes, at most six at a time. Wave 2 holds the before-Marks words, the two suites and the two critics. No wave-1 lane edits `Cockpit.tsx` except one line (T8R.11), and no wave-1 lane edits `calculation-words.ts`. | Cap 7: wave 1's seven lanes all start at once, saving about 30 minutes. It costs more load on one machine and more merge batches queued behind the one browser port. |
| P109 | **Contract names first, not tenth.** The audit puts them tenth (section 18). | **Wave 0 (T8R.3).** The change touches about 45 test files across every lane's area. In wave 0 it lands before any lane branches, so every wave-1 test is written in the new style and no lane rebases over it. It runs beside the other wave-0 lanes, so it costs no wall-clock time. | Tenth, as the audit orders it: it would have to wait until every UI lane merged (wave 2), then edit the expectations those lanes had just written. |
| P110 | **Where the Today table's column dates come from.** (Open question 1; **answered 2026-11-15: as recommended**.) | **Market Data's read session names the session before its trading date, and the as-of exchange date. Trade Views gives the column dates on every Detail with a Position** (A232). This amends `specs/design/market-data.md`'s read-session paragraph, as revision 92 did for `nextSessionDate`. | The audit's suggestion, `replay.pending.date`. It is wrong once a session ends: at Thu 6:00 pm `pending` is Friday, but the column must read "Today, Thu Oct 15". The UI can't work the dates out itself (ADR 0001; only Market Data knows the calendar, decision 62). |
| P111 | **Removing `nearest` edits frozen fixtures.** (Open question 2; **answered 2026-11-15: as recommended**.) | **Remove it, and delete exactly the `"nearest": true` lines from the five backup fixtures** that hold them. A diff check proves those 90 deletions are the only change. | Keep `nearest` in the view, unread, as a tech-debt item: no fixture changes, but the view keeps a field that nothing reads. |
| P112 | **The Journal's one dated line drops the Anchor**, which the UI contract lists. (Open question 3; **answered 2026-11-15: as recommended**.) | **Amend `specs/design/ui-contract.md` line 88:** Trade Detail's Journal leaves out a Trade Anchor, since the page names the Trade. Any other Anchor still shows (Execution Anchors arrive with D13). | Keep "Trade XYZ" on each line. It meets the spec as written, but it repeats the page's subject on every entry, which the approved words drop. |
| P113 | **The before-Marks words** (audit item 14). "Awaiting the close after Fri Oct 9" should name the session that brings the Marks. (Open question 4; **answered 2026-11-15: "Awaiting the Mon Oct 12 close"**, the user's choice over the recommendation.) | **Trade Analysis's `AwaitingClose` gains `due`, the session after `after`, passed in from the read session's `nextSessionDate` (T8R.19). The words become "Awaiting the Mon Oct 12 close" (figure and sentence). The label stays "Awaiting close"** (W34). The user's rule: "close" names the end of a market session and is correct there; a stock's or option's price is a Mark, never a close. `calculation-words.ts` is shared, so the Trades list and the Review change too, which keeps C1. | (a) "Due once the Mon Oct 12 session ends", the draft's recommendation, which wrongly treated "close" here as a price. (b) Change only Trade Detail, from `firstMarksDue`: no backend change, but it misses lots added after earlier Marks, and the list would still say "after Fri Oct 9". |
| P114 | **The year in a contract name, on screen and for screen readers.** (Open question 5; **answered 2026-11-15, the user's rule, replacing the audit's "'27" and spoken-year words**.) | **The screen reader reads exactly what the screen shows; there is no hidden text.** A contract expiring in the current year has no year: "XYZ Dec 18 $55 Call". A contract expiring in a later year shows the full year: "XYZ Jan 15 2027 $55 Call". | The draft's options, all rejected: the year spoken only where the name stands alone; spoken everywhere through hidden text; or no year for screen readers. |
| P115 | **Size check** (section 1.4; open question 6, **answered 2026-11-15: one breakdown**). | **One breakdown, with a checkpoint critic (T8R.25)** after the UI tasks and before the tail. | Split at the backend seam (section 1.4). Open question 6. |
| P116 | **No figure disappears between merges.** | **A task that removes a figure is blocked by the task that gives it its new home** (section 4.1). T8R.9 removes Today's At entry, dated card and condition lines only after Plan and Risk and the rail show them. T8R.6 merges only after Price History shows the provenance it removes from Today. | Remove and add in one task: fewer edges, but one task then owns files in two lanes. |

### 1.2 Amendments to other plan sections (applied in revision 104)

- **Implementation plan.**
  - A D8R row in the deliverable summary, after D8: "The Trade Detail refactor (decision 115) | 0 (refactor)".
  - A D8R definition after D8 and before D9.
  - **Decision 113 (3)**, amended: pending questions are asked one at a time and the others queued, as `.claude/docs/implementing.md` "Pending decisions" now says (D8 retro finding 3).
  - Tech debt item 24 carries a note naming T8R.16, which fixes it.
- **Specs** (agreed in section 12, and applied by revision 104 itself, so no task edits `specs/`):
  - `specs/design/market-data.md`, the read-session paragraph (line 99): the session also names the session before its trading date from the calendar alone, and carries the as-of exchange date (P110).
  - `specs/design/ui-contract.md` line 88: Trade Detail's Journal leaves out a Trade Anchor (P112).
  - The spec map's line ranges and character counts for both files, and the regenerated reading lists.
- **D08P breakdown.** These are reversed or amended, as a note under D08P's status line says:
  - **Assumptions:** A206 (the rail's figure is now a price distance: A230); A207 (`nearest` removed: T8R.20); A217 (the drawers per state: section 1.6, W1 amended); A223 (reversed: the value at expiration moves to Plan and Risk, the distance on the Underlying to the rail).
  - **Words:** W1 (drawers per state), W3 (the dated line), W4 and W18 (contract names), W5 and W6 (the rail's conditions), W8 and W19 (Today), W10 (Journal items), W16 (footer).
  - **Tasks and their cases:** T8P.5 (its "leave out Today" case), T8P.6 (reversed), T8P.13, T8P.14, T8P.15 (Max reward's R in the rail), T8P.16 (cases 1 and 5), T8P.17 (case 2), T8P.18 (case 3), T8P.29, T8P.31 (cases 1, 2, 3, 4, 6 and 7). Each D8R task names the earlier cases it changes.
  - **C8P.2's accepted repeats.** These go: each condition's distance on the rail and in Plan and Risk (now different figures: a price distance and a dollar figure); the Position drawer's Opening fees; Today's At entry block; the Mark repeated by Today's Stale context line, comparison and dated block. These stay: the Journal cards' Marks; Price History's latest session; each Journal card's Trade P&L and change; Incurred fees beside the Fee reconciliation; Entry Quality's reward : risk beside the Plan Baseline's; the Trade Summary line's repeats. C8R.1 carries the new list.
- **D7 approved words.** Conventions C2, C5 and C6 (the contract names in the holding line, the Execution line and `instrumentLabel`) take the broker style. The handoff and audit section 16 call these "C1 and C3"; C1 is one wording per concept and C3 the Underlying price, which stand.
- **Acceptance matrix.** Rows in section 13.

### 1.3 Working assumptions

These are implementation-level choices that don't reopen product semantics. They stand unless you object.

| # | Assumption |
|---|---|
| A230 | **Trigger distance** (Trade Analysis, T8R.18). `ConditionReading` gains `trigger: { distance: Rational; beyond: Rational \| null }` in the condition's own price: \|Mark − boundary\| toward the boundary, zero once crossed, and `beyond` the distance past it once crossed. A stock condition and an option-price condition measure their own Mark; an option condition on the Underlying copies its existing `underlying` pair. Trade Views passes it through, so dated distances come from `current.datedLine.evaluation.conditions` with no extra work. `underlying` stays: the frozen `backup-v7` and `workspace-v7` expected views hold it. Nothing reads it once T8R.9 removes Today's condition lines. |
| A231 | **The rail's dated figures.** When today's Trade P&L is unavailable and the Detail has a dated line, the P&L card's second line is "+$340.00 at the Tue Nov 10 Marks" from `current.datedLine.evaluation` (W22). Each condition row whose current reading is unavailable shows its dated distance with "· Tue Nov 10 Marks" (W21), one date per row. With no dated line, the row shows its reason at the `label` length (A222). An Underlying condition stays unavailable when the Underlying had no Mark at the dated session either (A110). |
| A232 | **Today's column dates** (T8R.21; P110). Each Open, Settlement Due and Closed Detail gains `marksColumns: { today: { date, next: boolean }, yesterday: date }`. When the as-of exchange date is a session, Today is that date. Otherwise it is the next session, and `next` is true ("Next session, Mon Oct 19"). Yesterday is always the session just before Today's column, never an earlier one with Marks. At Thu 10-15 12:00: Today Thu, Yesterday Wed. At Thu 18:00: the same. On Sat 10-17: Today Mon 10-19 (next), Yesterday Fri. Outside session-policy coverage the field is absent and the table shows no dates. |
| A233 | **The Open table's cells are selected, never computed.** A Mark comes from the replay session whose date is the column's date. Change is the replay's Mark change for Today's session, shown only when its "since" date is Yesterday's column date; otherwise "—". A session that hasn't ended, or has no Mark, shows "—". |
| A234 | **Settlement Due** (T8R.22). The Settlement Due Detail gains `settlementUnderlying: { today?, yesterday?, change? }`, the Underlying's Mark resolutions at the two column dates read through the read session's `series`, with the change only when both are Available (Trade Views does the subtraction). The option's cell is "Expired" when the column's date is after its expiration session; otherwise the option's Mark comes from the replay (revision 98 ends it at the expiration session). |
| A235 | **Closed.** The second column is headed "Exit Fri Nov 13" (by sale) or "Expired Fri Nov 20" (by expiration), dated by the replay's last session. By sale, the option's or stock's cell is the final exit Execution's price, and the Underlying's cell its Mark at that session (section 19). By expiration, the option's cell reads "Expired" and the Underlying's its Mark at the expiration session. The Today column is headed by `marksColumns.today`, with empty cells. Change is "—". Picking the last Execution is selection, not arithmetic. |
| A236 | **The open lots' average** (T8R.23) is one Trade Views field, `openAverage`, on every Open Detail, stock and option alike, so the track reads one field. For a stock Trade it equals the Trade Summary's price. Settlement Due and Closed Details have no tracks and no field. |
| A237 | **Lot ticks** are presentation (A215): one per open lot from `positions[].openLots`, at its price, with the accessible name "$2.00 · Mon Oct 12" and the same text on hover. Closed lots get none. |
| A238 | **Contract names** (T8R.3). `instrumentLabel` returns "NVDA Dec 18 $150 Call", and "XYZ Jan 15 2027 $55 Call" for a later year (P114), reusing `summaryStrike` and the current-year rule of `summaryExpiration` (`format.ts`, the Workspace zone). Every unit test that asserts a name pins the clock, as `trade-detail/test-support.ts` does. The "Expires …" and "Expired …" lines keep the long date (W2): they name a date, not a contract. No hidden text: the accessible name is the visible name. The Trade Summary line takes the same rule ("Long 1 Jan 21 2028 $250 Call" in place of "'28"; open question 5, follow-up), through `summaryExpiration` itself. |
| A239 | **The Journal's dated line** (T8R.15) is the Source, then the moment in the app's date-and-time format, then "· written Thu Nov 12" only when the entry was written, answered or declined on a later Workspace-zone date. The Edited and "Deferred, answered" badges, declines and their reasons, and answered prompts stay. Empty prompts leave. The old list kept as the fallback takes the same line (audit L11). |
| A240 | **The Journal's Deviation line** counts occurrences whose current version is Active, the test `identity.props.ts:38` uses today, and moves with the badge into `journal.props.ts`. The button selects Plan and Risk and moves focus to its Deviations heading through the shell's drawer request (T8R.2), since the selected tab is not part of the address. |
| A241 | **Price History's provenance** (T8R.4) is in each Mark cell's accessible name and its hover text: "Manual · saved 2026-10-14 17:00", then "Corrected: <reason>" on a corrected Mark, which also keeps its visible "Corrected" marker. The cells stay out of the tab order (about 1,500 on a LEAP, P99); a keyboard user reads them with the screen reader's table navigation. |
| A242 | **Closed Today is greyed** with text that still meets WCAG AA contrast. The "Closed" stamp is real text, announced by screen readers. The rail and the other drawers aren't greyed. |
| A243 | **The before-Marks `due`** (T8R.19; P113). `TradeEvaluationInput` gains `nextSessionDate?`, which the valuation coordinator passes from the read session. `AwaitingClose` gains `due?: string`, set when the input has it. It is additive, so frozen views holding `AwaitingClose` still compare. |
| A244 | **Reading list.** No spec-map retag: a `D8R` tag would break `spec-reading-lists.py`'s `int(d[1:])`, as A218 found for D08P. The implementing session reads `plan/spec-reading/D07.md`, plus these entries of `plan/spec-reading/D09.md`: Trade Views' `replayTrade`, Market Data's query contract and read session, AC-MARK-004, and the UI contract's Trade Detail and Journal-timeline lines. |
| A245 | **Durable compatibility.** No schema, store, migration or backup-version change. Every new view field is additive, and `compareSnapshot` allows added fields. The one exception is P111's removal of `nearest`. |
| A246 | **No benchmark task** (decision 114). The gated paths are the cold start and the open list. The Open Detail's reads don't change. The Settlement Due Detail gains one `series` read for its Underlying, proven by I8R.7. |

### 1.4 Size check and the split proposal

The graph has **28 tasks**, more than 25, and **six open questions** (section 12). There is no schema change. Two of the guide's criteria are met, so here is a split.

**Proposed seam: D8R-1, the moves on today's reads, then D8R-2, the parts that need new backend fields.**
- **D8R-1:** contract names (T8R.3), Price History's provenance (T8R.4), Position (T8R.5), Deviations and Fulfillment into Plan and Risk with the Journal line (T8R.11, T8R.17), Since the last Marks (T8R.12), the Journal's dated line and tech debt item 24 (T8R.15, T8R.16), and the identity badge. A light gate: the cumulative suites and a browser critic.
- **D8R-2:** the trigger distance and the conditions redesign, the Today table on every state, the column dates, the Settlement Due Marks, the track, the before-Marks words, the removal of `nearest`, and the full tail.
- **What D8R-1 leaves unfinished:** the rail still shows dollars, Today keeps its cards, and Settlement Due and Closed Trades have no Today. Nothing is released for real use between the parts.

**Agreed 2026-11-15: keep one breakdown (P115).** The backend lanes run beside the UI lanes from wave 1, so a split would put a gate (a full run and a critic, about 1.5 hours) in the middle of the critical path. It would also rebuild the Today drawer twice. The checkpoint critic (T8R.25) gives the same early look.

### 1.5 Lookups (drafting guide)

Run on `6b11c8bc`. Line numbers are on that commit. The full Names list is in the appendix.

**The audit's citations, checked.** Every file and line the audit cites in `today.props.ts`, `Cockpit.tsx`, `evaluate.ts`, `calculation-words.ts`, `journal.props.ts` and `position.props.ts` still matches after D8, apart from small shifts: `drawersOf` at `Cockpit.tsx:26–31`, the `CurrentMarksOnly` branch at 105, `<DetailFooter>` at 168; `conditionOf` at `evaluate.ts:339–353`, `nearest` at 72 and 396–401, `AwaitingClose` built at 256; `itemOf` at `journal.props.ts:78–104`. The audit counts 47 files with long-form dates; 43 test and spec files remain after leaving out fixtures, and the Names lookup sorts them below.

**Texts.** Each changing text, the files that assert it on Trade Detail, and the task that changes them. Files outside Trade Detail that share the words (the Review card, the Trades list) are left alone unless named.

| Text | Files (Trade Detail) | Task |
|---|---|---|
| Tabs per state: "no Today", "Position selected" | `e2e/d8p/states.spec.ts:46,62,101`; `trade-detail/Cockpit.test.tsx:82–96` | T8R.2 |
| "Deviation active" | `TradeDetail.test.tsx:253,256`; `trade-detail/Placed.test.tsx:139,168,175` | T8R.13 |
| "nearest" badge, "Change in Trade P&L" | `rail/conditions.props.test.ts:24–61,194`; `e2e/d8p/cockpit.spec.ts:59–72` | T8R.14 |
| "Worst case", "Max reward" (rail) | `rail/conditions.props.test.ts` (many); `e2e/support/detail/rail-b.ts:1–19`; `e2e/d4/breach-overrun.spec.ts:42`; `e2e/d4/responsive-a11y.spec.ts:169,170`; `e2e/d7s/conditions.spec.ts:50,56`; `e2e/d8p/cockpit.spec.ts:74`; `TradeDetail.test.tsx:231`; `drawers/today.props.test.ts:173` | T8R.14 (rail), T8R.10 (their new home), T8R.9 (Today's) |
| "Expected Mark Date", "Stale context", "Underlying Mark" in Today | `e2e/support/detail/today.ts:6,7`; `e2e/d4/expected-mark.spec.ts:11,26,27,46,50`; `e2e/d4/responsive-a11y.spec.ts:179–182`; `Placed.test.tsx:69–111,249,274`; `Result.test.tsx:52,54`; `TradeDetail.test.tsx:242,250`; `today.props.test.ts:222` | T8R.6 (Expected Mark Date, Source and Saved go; Stale context and the acknowledgment move under the table). `needs-you.props.test.tsx:93–107` and `conditions.props.test.ts:106` are Needs you and the rail, unchanged. |
| "Marks: Thu Oct 15 against Wed Oct 14", "has no Marks, so" | `today.props.test.ts:48–101,214`; `today.test.tsx:19–30`; `e2e/support/detail/today.ts:13`; `e2e/d8p/states.spec.ts:129`; `e2e/d7s/responsive-a11y.spec.ts:61`; `e2e/d7s/conditions.spec.ts:9`; `Placed.test.tsx:67`; `TradeDetail.test.tsx:142` | T8R.6. The Review's "Marks:" (`e2e/d4/review.spec.ts`, `e2e/d5r/review.spec.ts`) and `needs-you.props.test.tsx:109` are not Today and stay. |
| "At entry", "Average entry", "Risk from entry", "Reward from entry" | `today.props.test.ts:158–184`; `e2e/support/detail/today.ts:1,17,18`; `e2e/d4/breach-overrun.spec.ts:11,58,59`; `e2e/d7s/entry-beyond-stop.spec.ts:13,21`; `Placed.test.tsx:239–245`; `Today.test.tsx:12–35` | T8R.12 (new home), T8R.9 (removal). Entry Quality's "Average entry" in `plan-risk.test.tsx` and `Plan.test.tsx` stays. |
| "At the <date> Marks" (dated card) | `today.props.test.ts:147–164,251–274`; `e2e/support/detail/today.ts:1`; `e2e/d4/breach-overrun.spec.ts:48`; `e2e/d4/expected-mark.spec.ts:28,39`; `e2e/d4/responsive-a11y.spec.ts:222`; `Today.test.tsx:23` | T8R.13 (the rail's line), T8R.9 (removal) |
| "Distance on", "Value at expiration" (Today) | `today.props.test.ts:193–197,281–304`; `Placed.test.tsx:242,243` | T8R.14 and T8R.10 (new homes), T8R.9 (removal). The Payoff drawer's "Value at expiration" (`payoff.test.tsx`, `Payoff.test.tsx`, `e2e/support/detail/payoff.ts`) stays. |
| "Risk to stop", "Reward to target" (Plan and Risk) | `plan-risk.test.tsx:91–109`; `Placed.test.tsx:178–210`; `TradeDetail.test.tsx:236–241`; `today.props.test.ts:172–174,257,258`; `e2e/support/detail/rail-b.ts:1–10`; `e2e/d4/breach-overrun.spec.ts:11,28,53`; `e2e/d7s/conditions.spec.ts:25` | T8R.10. The Review's (`e2e/d5r/*.spec.ts`) stay. |
| "Opening fees" | `position.props.test.tsx:73,84`; `Position.test.tsx:37`; `Result.test.tsx:33–35` | T8R.5. `plan-risk.test.tsx:29,33` is Entry Quality's figure and stays. |
| "No Deviations recorded.", "Planned-Leg Fulfillment" (footer) | `cockpit/footer.test.tsx`; `trade-detail/Footer.test.tsx`; `Banner.test.tsx:133`; `e2e/support/detail/plan.ts:1,16`; `e2e/d4/breach-overrun.spec.ts:29` | T8R.11 |
| "Anchor", "Authored", "Moment", "Review Date", "Not answered" (Journal items) | `trade-detail/Journal.test.tsx` (many); `cockpit/journal-cards.props.test.tsx:44,93,94,232,279,286`; `Cockpit.test.tsx:161`; `TradeDetail.test.tsx:33`; `Position.test.tsx:76–82,181`; `e2e/support/detail/journal.ts:14`; `e2e/d8p/history.spec.ts:7,66,75,79`; `e2e/d8p/support.ts:4`; `e2e/d2/ui-alignment.spec.ts:1141` | T8R.15. Each line is checked: `needs-you.props.test.tsx:155` and `e2e/d4/review.spec.ts:77` are not Journal items. |
| "Awaiting the close after" | `e2e/d4/breach-overrun.spec.ts:11,39,40,42`; `e2e/d4/responsive-a11y.spec.ts:220,230`; `e2e/d7p/layout.spec.ts:98,103`; `pnl.props.test.tsx:90`; `Today.test.tsx:25`; outside Trade Detail `calculation-words.test.ts`, `figures.test.ts`, `StopTargetSlider.test.tsx`, `TradeList.test.tsx` (7) | T8R.24 |
| Contract names | the appendix | T8R.3 |

**Shapes.**
- **Added, view fields:** `trigger` on `ConditionReading` (T8R.18); `due` on `AwaitingClose` (T8R.19); `marksColumns` (T8R.21), `settlementUnderlying` (T8R.22) and `openAverage` (T8R.23) on the Detail; `previousSessionDate` and `exchangeDate` on `MarketDataReadSession` (T8R.21). `compareSnapshot` (`tools/fixtures/snapshot-compare.ts`) allows added fields, so no frozen view fails.
- **Removed:** `nearest` on `ConditionStatus`. It is in five frozen expected views, 18 lines each: `tests/fixtures/backup-v3-blocked`, `backup-v4-blocked`, `backup-v5-blocked`, `backup-v6-blocked` and `backup-v7`, `expected-views.json`. `compareSnapshot` fails a field the views no longer have, through `verify:fixtures` and `tests/integration/d8/round-trip.test.ts:111` (P111). No `workspace-v*` fixture holds it. `tools/bench-run.ts` mentions "nearest" in another sense and is not touched.
- **Kept, unread:** `underlying` on `ConditionReading` (A230), in `backup-v7` and `workspace-v7`.
- **Stores and schema:** unchanged.

**Checks.**
- **No new ESLint rule.** The cockpit import rule (A216) covers every new props file. The UI's "no arithmetic" rule stays a review point, as in D08P.
- **`eslint.wording.config.js`:** `PHRASES` holds "Awaiting the close" and "Awaiting the next close". W34's figure splits its fixed words around the date ("Awaiting the … close"), so T8R.24 extends the rule to match "Awaiting the <date> close", and keeps "Awaiting close" (the label). Only `calculation-words.ts` may then write them.
- **`verify:fixtures`** fails until T8R.20's fixture edit, which is why T8R.20 owns both.
- **Playwright filter:** `test:e2e:2` passes `e2e/d8`, which also matches `e2e/d8r/`, so no `package.json` change is needed. `tdd.sh` maps `T8R.n` to `evidence/D08R`, and `full-suite.sh` maps `evidence/D08R` to `e2e/d8r`.

**Names.** `instrumentLabel` (`src/ui/calculation-words.ts:22–25`) has these callers:
- **UI (the new style reaches them all):** `rail/needs-you.props.ts:82`, `drawers/plan-risk.props.ts:35`, `screens/execution-line.ts:5,14`, `ReviewSettlement.tsx:46,50`, `CardFigures.tsx:77`, `PositionChangeForm.tsx:456,471,477`, `ExpirationForm.tsx:155`, `CardMarks.tsx:156,212,213`, `MarkEntry.tsx:155` (an `aria-label`), `ReviewView.tsx:163`, `option-words.ts:20`, `trade-detail/Position.tsx:90,154,165`.
- **Not UI:** `tools/bench/compare.ts:6,67` and `compare.test.ts` import it dynamically and compare rendered rows. They keep working, and the bench's expected rows are regenerated only when decision 114's end-of-plan benchmark runs.
- **The appendix** lists the expectation lines, split into contract names (changed) and "Expires" lines (kept).

### 1.6 Approved words

Approved by the user during and after the audit (sections 15 and 19). Task briefs name the rows they use. Words no row covers still need approval. Examples use O-C3 (D08P section 5), O-S2 and the audit's NVDA call. Conventions C1 to C8 of the D7 approved words apply, with C2, C5 and C6 in the broker style. Moved content keeps its words (P96).

| # | Where | Words |
|---|---|---|
| W1 (amended) | Drawers per state | Planned: Plan and Risk, Journal, Payoff (opens on Plan and Risk). Open, Settlement Due and Closed: Today, Position, Plan and Risk, Price History, Journal, Payoff (opens on Today). Records disagree: Position, Plan and Risk, Journal (opens on Position). Tab counts unchanged; no tab counts Deviations. |
| W21 | Rail, Conditions card | Row 1: "Stop · $2.82 away" (an option-price or stock condition), "Stop · 2.10 away" (an option Trade's Underlying condition). "Breached · $0.30 past", "Reached · 0.50 past". Dated: "Stop · $4.20 away · Tue Nov 10 Mark" (stock), "… · Tue Nov 10 Marks" (option). Row 2: the full condition, as W5. Before the first Marks, on a Planned, Settlement Due or Closed Trade: the role and the trigger only. No "nearest" badge, no row 3, no Worst case or Max reward. |
| W22 | Rail, P&L card | When today's figure isn't available: the reason as now, then "+$340.00 at the Tue Nov 10 Marks" ("Mark" for stock). |
| W23 | Plan and Risk, "Since the last Marks" | Heading "Since the last Marks"; rows "New lots", "Average price of new lots", "Risk from that price", "Reward from that price". Shown only when lots were bought after earlier Marks. |
| W24 | Journal | "1 active Deviation. See Plan and Risk." ("2 active Deviations. See Plan and Risk."); "See Plan and Risk" is a button. |
| W25 | An expired option's Marks cell | "Expired", with the screen-reader name "Expired Fri Nov 20". |
| W26 | Closed Today, second column heading | "Exit Fri Nov 13"; "Expired Fri Nov 20". |
| W27 | Journal entry line | "Daily Review · Tue Nov 10, 4:12 pm", with "· written Thu Nov 12" when written later. |
| W28 (amended 2026-11-15) | Contract names | "XYZ Dec 18 $55 Call" for a contract expiring in the current year; "XYZ Jan 15 2027 $55 Call" for a later year. Screen readers read the same text (P114). |
| W29 | Today's column headings | "Today, Thu Oct 15", "Yesterday, Wed Oct 14", "Change"; on a weekend or holiday "Next session, Mon Oct 19". Rows "XYZ Mark", "Call Mark" (stock "XYZ Mark"). A cell without a Mark reads "—". |
| W30 | Closed Today | The stamp "Closed". |
| W31 | Plan and Risk, Conditions group | Heading "Conditions"; columns "Condition", "Distance", "Risk or reward", "Value at expiration". Cells "$2.20 away", "Risk to stop $220.00 · 1.10R", "Reward to target $180.00 · 0.90R", "$5.00". Beneath: Worst case, Max reward and the short notes in W6's words. When today's Mark is missing, the last Marks' figures labelled with their date, as W21. |
| W32 | Plan and Risk, a breached Stop | "Risk to stop $60.00 · 0.24R past" (and "Breached · $0.50 past" in the Distance cell). |
| W33 | Price History, each Mark cell | "Manual · saved 2026-10-14 17:00"; on a corrected Mark, then "Corrected: <reason>". |
| — | Kept words | Under the Today table: the Stale context line and "Mark unavailable for XYZ on Wed Oct 14: your acknowledgment, not a price", in their existing words (revision 98 kept "close" there). Deviations and Planned-Leg Fulfillment keep their words as Plan and Risk's last groups; Deviations is hidden when there are none, and superseded ones stay, struck through. |
| **W34 (approved 2026-11-15)** | `AwaitingClose` (P113) | Label "Awaiting close" (unchanged). Figure and sentence "Awaiting the Mon Oct 12 close". Without `due` (no calendar), the existing words. |

---

## 2. Implementation boundaries extended in D8R

- **Trade Analysis** (`src/domain/trade-analysis/evaluate.ts`, `src/domain/calculation-result/index.ts`): `trigger` (T8R.18), `AwaitingClose.due` and the `nextSessionDate` input (T8R.19), `nearest` removed (T8R.20).
- **Valuation coordinator** (`src/coordinators/valuation/`): passes `nextSessionDate` into the evaluation (T8R.19).
- **Market Data** (`src/modules/market-data/market-data.ts`): the read session's `previousSessionDate` and `exchangeDate`, from the calendar alone (T8R.21).
- **Trade Views** (`src/coordinators/trade-views/`): `marksColumns`, `settlementUnderlying`, `openAverage` on the Detail (T8R.21, T8R.22, T8R.23).
- **No facade, manifest, persistence or schema change.** `getTradeDetail` gains fields only; no operation is added (AC-CAP-001 unchanged).
- **Fixtures:** only T8R.20's `nearest` deletions (P111).

---

## 3. Wall-clock against serial

Estimates on D08P's basis: a behavioral task takes about 35 minutes in `tdd-task`, ocr about 5, a complete cumulative run about 12, and a lane tier about 4. Critic defects and their bug tasks are left out of both rows.

| Plan | Estimate | Where the time goes |
|---|---|---|
| **Serial** (decision 100) | 22 behavioral tasks × 52 minutes, 4 structural tasks at about 45 minutes, 2 critics at about 75 minutes: **about 25 hours** | Every task waits for the one before it and ends with its own complete run. |
| **Swarm** (section 4) | **About 8 to 9 hours** | **Wave 0, about 1.25 h:** four lanes at once, bounded by T8R.3 (wide but mechanical), then one merge run. **Wave 1, about 3.5 h:** seven lanes, six at a time. The longest is TD (T8R.6, T8R.7, T8R.8, T8R.9), with T8R.9 waiting for its homes. BV's three backend tasks run beside it. Merge runs overlap lane work. **Wave 2, about 3.5 h:** T8R.24, then the checkpoint critic beside the two suites, then a full run and the gate. |

The gain, about 3 times, comes from wave 1's parallel lanes and from one complete run per merge batch instead of one per task.

---

## 4. Task graph

Kind: **B** = behavioral (TDD, red then green per case), **S** = structural (exact verification). "Outside `src/ui/`" names every change beyond the UI.

### 4.1 Tasks

| Task | Title | Wave, lane | Kind | Blocked by | Public seam under test | Outside `src/ui/` |
|---|---|---|---|---|---|---|
| T8R.1 | Freeze the new view and props types | 0, TY | S | — | `typecheck` | **types only:** `trigger?` on `ConditionReading`; `due?` on `AwaitingClose`; `nextSessionDate?` on `TradeEvaluationInput`; `previousSessionDate?`, `exchangeDate` on `MarketDataReadSession`; `marksColumns?`, `settlementUnderlying?`, `openAverage?` on the Detail views. No behavior. |
| T8R.2 | Shell: Today on every Trade with a Position | 0, SH | B | — | `TradeDetail` | none |
| T8R.3 | Contract names in the broker style (audit item 9) | 0, CN | B | — | `instrumentLabel`; the screens that show it | none (two code comments outside `src/ui/` keep their examples) |
| T8R.4 | Price History: each Mark's source, saved time and correction (item 10) | 0, PH | B | — | `PriceHistory`, `price-history.props` | none |
| T8R.5 | Position: the Instrument column, one row per leg, no Opening fees (items 1, 12) | 1, PO | B | wave 0 | `PositionDrawer`, `LotMatchesTable`, the exit and expiration receipts | none |
| T8R.6 | Today: one Marks table on an Open Trade (item 2) | 1, TD | B | wave 0; merges after T8R.4 | `TodayDrawer`, `today.props` | none (reads T8R.21's field; a double until it merges) |
| T8R.7 | Today on Settlement Due and Closed Trades (item 8) | 1, TD | B | T8R.6 (lane order) | `TodayDrawer`, `today.props` | none (reads T8R.22's field) |
| T8R.8 | Price track: the entry at the open lots' average, a tick per open lot (item 13) | 1, TD | B | T8R.7 (lane order) | `TodayDrawer`, `Track` | none (reads T8R.23's field) |
| T8R.9 | Today: At entry, the dated card and the condition lines go (items 4, 5, 7) | 1, TD | B | T8R.8 (lane order), T8R.10, T8R.12, T8R.13, T8R.14 | `TodayDrawer`, `today.props` | none |
| T8R.10 | Plan and Risk: the Conditions group (item 7) | 1, PR | B | wave 0 | `PlanRiskDrawer`, `plan-risk.props` | none (reads T8R.18's field) |
| T8R.11 | Plan and Risk: Fulfillment and Deviations as its last groups; the footer goes (item 3) | 1, PR | B | T8R.10 (lane order) | `PlanRiskDrawer`; `TradeDetail` | none |
| T8R.12 | Plan and Risk: Since the last Marks (item 4) | 1, PR | B | T8R.11 (lane order) | `PlanRiskDrawer` | none |
| T8R.13 | Rail: no Deviation active badge; the P&L card's dated line (items 3, 5) | 1, RA | B | wave 0 | `IdentityCard`, `PnlCard` | none |
| T8R.14 | Rail: the Conditions card shows distances (item 7) | 1, RA | B | T8R.13 (lane order); merges after T8R.10 | `ConditionsCard`, `conditions.props` | none (reads T8R.18's field) |
| T8R.15 | Journal: one dated line per entry (item 11) | 1, JR | B | wave 0 | `JournalCards`, `journal.props`; the fallback list | none |
| T8R.16 | Journal paging keeps keyboard focus (tech debt item 24) | 1, JR | B | T8R.15 (lane order) | `JournalCards` | none |
| T8R.17 | Journal: "1 active Deviation. See Plan and Risk." (item 3) | 1, JR | B | T8R.16 (lane order), T8R.11 | `TradeDetail` | none |
| T8R.18 | Trade Analysis: the distance to each trigger (item 6) | 1, BA | B | T8R.1 | `TradeAnalysis.evaluate`; `getTradeDetail` | **Trade Analysis:** `trigger` (A230) |
| T8R.19 | Trade Analysis: `AwaitingClose` names the session that brings the Marks (item 14) | 1, BA | B | T8R.18 (lane order), T8R.21 | `TradeAnalysis.evaluate`; `getTradeDetail` | **Trade Analysis:** `due`; **valuation coordinator:** passes `nextSessionDate` (A243) |
| T8R.20 | Remove `nearest` (item 6) | 1, BA | S | T8R.19 (lane order), T8R.14 | `typecheck`, `verify:fixtures`, `test:integration` | **Trade Analysis:** field removed; **fixtures:** 90 lines deleted (P111) |
| T8R.21 | Today's column dates (items 2, 8) | 1, BV | B | T8R.1 | read session; `getTradeDetail` | **Market Data:** `previousSessionDate`, `exchangeDate`, as `market-data.md` says since revision 104 (P110); **Trade Views:** `marksColumns` (A232) |
| T8R.22 | Trade Views: the Underlying's Marks on a Settlement Due Trade (item 8) | 1, BV | B | T8R.21 (lane order) | `getTradeDetail` | **Trade Views:** `settlementUnderlying` (A234) |
| T8R.23 | Trade Views: the open lots' average (item 13) | 1, BV | B | T8R.22 (lane order) | `getTradeDetail` | **Trade Views:** `openAverage` (A236) |
| T8R.24 | The before-Marks words (item 14) | 2 | B | T8R.19, every wave-1 UI task | `calculation-words`; the screens that show it | none |
| T8R.25 | Checkpoint browser critic (P115) | 2 | S | T8R.24 | fresh critic report | none |
| T8R.26 | Node integration suite | 2 | S | T8R.18 to T8R.23 (may start in wave 1) | `test:integration` | none (tests only) |
| T8R.27 | Browser suite | 2 | S | T8R.24 | `test:e2e` | none (tests only) |
| T8R.28 | Independent browser-critic gate | 2 | S | all | fresh critic report | none |

**Run order.**
- **Wave 0:** T8R.1, T8R.2, T8R.3 and T8R.4 at once, each in its own lane. The main session merges each, then runs one complete run.
- **Wave 1:** up to 6 lanes at once, each in its listed order. Start TD, BV, PR, RA, BA and JR first; PO takes the first free slot. T8R.6 merges only after T8R.4 (already in from wave 0), T8R.14 only after T8R.10, and T8R.9 starts only when T8R.10, T8R.12, T8R.13 and T8R.14 have merged. T8R.26 may start once T8R.23 merges.
- **Wave 2:** T8R.24, then T8R.25 beside T8R.27, then T8R.28 once T8R.25's bug tasks and T8R.27 have merged.

### 4.2 Lanes and file ownership

A lane is one git worktree (`.claude/worktrees/d08r-<lane>`) on one branch (`d08r/<lane>`), set up by `lane-setup.sh`. Its tasks run one at a time, in order. A file is owned by exactly one lane per wave. A file not listed is touched by no task of that wave.

| Lane | Tasks | Owns |
|---|---|---|
| TY | T8R.1 | `src/domain/trade-analysis/evaluate.ts` and `calculation-result/index.ts` (types only); `src/modules/market-data/market-data.ts` (the read-session type only); `src/coordinators/trade-views/trade-views.ts` (the Detail types only); `src/app/types.ts` if it re-exports them |
| SH | T8R.2 | `src/ui/screens/trade-detail/Cockpit.tsx`, `Cockpit.test.tsx`; `e2e/d8p/states.spec.ts` (its drawer lines); `src/ui/screens/trade-detail/test-support.ts`; `e2e/support/detail/index.ts` |
| CN | T8R.3 | `src/ui/calculation-words.ts` and its test; `src/ui/format.ts` and `format.test.ts` (`summaryExpiration`'s later-year form); the call sites of section 1.5's Names; every expectation line in the appendix (contract names only). Not `Cockpit.tsx` or `test-support.ts` (SH). In `states.spec.ts`, only line 48. |
| PH | T8R.4 | `src/ui/cockpit/drawers/price-history*`, `styles/history.css`; `e2e/d8p/history.spec.ts` (its Price History lines) |
| PO | T8R.5 | `drawers/position*`, `styles/position.css`; `src/ui/screens/LotMatchesTable.tsx`, `ExitReceipt.tsx` and `ExpirationReceipt.tsx` with their tests; `trade-detail/Position.test.tsx`, `Result.test.tsx`; `e2e/support/detail/position.ts` |
| TD | T8R.6, T8R.7, T8R.8, T8R.9 | `drawers/today*`, `src/ui/cockpit/track*`, `styles/today.css`; `trade-detail/Today.test.tsx`, `Placed.test.tsx` (its Today lines), `SettlementDue.test.tsx`; `e2e/support/detail/today.ts`; the Today lines of `e2e/d4/expected-mark.spec.ts`, `e2e/d4/breach-overrun.spec.ts`, `e2e/d4/responsive-a11y.spec.ts`, `e2e/d7s/*.spec.ts`, `e2e/d8p/today-narrow.spec.ts`, `e2e/d8p/first-marks-pending.spec.ts`, `e2e/d8p/states.spec.ts:129` |
| PR | T8R.10, T8R.11, T8R.12 | `drawers/plan-risk*`, `src/ui/cockpit/footer*` (deleted by T8R.11), `styles/plan.css`; `trade-detail/Plan.test.tsx`, `Footer.test.tsx` (deleted), `Banner.test.tsx:133`; `e2e/support/detail/plan.ts`; for T8R.11 only, the one `<DetailFooter>` line of `Cockpit.tsx` and its import |
| RA | T8R.13, T8R.14 | `src/ui/cockpit/rail/identity*`, `rail/pnl*`, `rail/conditions*`, `styles/rail-a.css`, `styles/rail-b.css`; `e2e/support/detail/rail-a.ts`, `rail-b.ts`; `e2e/d8p/cockpit.spec.ts`; the rail lines of `TradeDetail.test.tsx` and `Placed.test.tsx` |
| JR | T8R.15, T8R.16, T8R.17 | `drawers/journal*`, `src/ui/cockpit/journal-cards*`, `styles/journal.css`; `trade-detail/Journal.test.tsx`, `Journal.tsx`; `e2e/support/detail/journal.ts`; the Journal lines of `e2e/d8p/history.spec.ts`, `e2e/d8p/support.ts:4`, `e2e/d2/ui-alignment.spec.ts:1141`, `Position.test.tsx:76–82,181`, `Cockpit.test.tsx:161`, `TradeDetail.test.tsx:33` |
| BA | T8R.18, T8R.19, T8R.20 | `src/domain/trade-analysis/`, `src/domain/calculation-result/`, `src/coordinators/valuation/`; `tests/integration/d8p/detail.test.ts` (its `nearest` lines); the five backup fixtures' `expected-views.json` (T8R.20 only) |
| BV | T8R.21, T8R.22, T8R.23 | `src/modules/market-data/market-data.ts` and its tests (T8R.21); `src/coordinators/trade-views/`; `tests/integration/` support files it extends |

**Shared files, and how they are split or sequenced.**
- **`Cockpit.tsx`.** T8R.2 makes every shell change in wave 0: the drawers per state, the Settlement Due current-Marks branch moved from Position into Today (T8R.7 then replaces it), and a drawer request (select a drawer, focus a heading) beside the existing `ReflectRequestContext`, which T8R.17 uses. In wave 1, only T8R.11 touches it, to delete one line.
- **`calculation-words.ts`.** T8R.3 owns it in wave 0, and T8R.24 in wave 2. No wave-1 task changes it.
- **The contract-name callers.** All change in wave 0, before any lane branches (P109).
- **`today.props.ts`.** One lane (TD) owns it. The removals wait for their homes (P116) instead of other lanes editing it.
- **`TradeDetail.test.tsx`, `Placed.test.tsx` and `Position.test.tsx`.** Several lanes change different lines of them, as in D08P, which git merges. The main session resolves the rare overlap at merge.

---

## 5. Behavioral tasks

Every case runs **red → green** individually. A case that passes on its first run, or fails for a syntax, configuration, fixture or unrelated reason, is not valid red evidence. A genuine first-run pass needs a mutation check (an assertion failure or runtime exception, not a compile error) and is flagged. Cases are ordered so each needs behavior the earlier ones don't. A **gone** check proves absence from the DOM, hidden drawer panels included (T8P.30).

All dates are 2026, New York time. **O-C3** and **O-S2** are D08P section 5's. **O-C3+** is O-C3 with one more contract bought Fri 10-16 11:00 at $3.30 (fee $0.65), which also gives an Entry Size Deviation. **O-S2X** is D7's expired put: MNO 20 Nov 2026 45 Put, Settlement Due from Sat 11-21. **K1** is the audit's NVDA Dec 18 $150 Call, Closed by sale with its final exit Fri 11-13 at $12.40; **K2** is O-C3 sold out Fri 10-16.

### T8R.2 Shell: Today on every Trade with a Position

Seam: `TradeDetail` against the facade double. W1 (amended). Reverses T8P.5's case "should leave out Today on a Closed or Settlement Due Detail, and select Position" and B8P.4's drawer lines for those states.

```text
describe("Trade Detail cockpit: drawers per state (W1, amended)")
  it should show Today first and select it on a Settlement Due Detail
  it should show Today first and select it on a Closed Detail
  it should show the Settlement Due current Marks in Today, not in Position
  it should select a requested drawer and move focus to the requested heading in it
```

### T8R.3 Contract names in the broker style

Seam: `instrumentLabel`, then each screen through its existing tests. W28, A238, P114. The appendix lists every expectation line; each changes only its contract name. An "Expires" or "Expired" line is not a contract name and does not change.

```text
describe("instrumentLabel (W28)")
  it should name a contract "NVDA Dec 18 $150 Call" in the current year
  it should show the full year for a contract expiring in a later year, "XYZ Jan 15 2027 $55 Call"
  it should keep the strike's decimals as the Trade Summary does ("XYZ Dec 18 $52.50 Put")
describe("Trade Summary line: the year rule (open question 5, follow-up)")
  it should show the full year for a later year, "Long 1 Jan 21 2028 $250 Call"
```

The Trade Summary case changes the one existing expectation, `src/ui/format.test.ts:51` ("Jan 21 '28"); no other test or spec asserts the "'28" form.

### T8R.4 Price History: each Mark's source, saved time and correction

Seam: `PriceHistory` and `price-history.props`. W33, A241. O-C3, with Wednesday's XYZ Mark corrected.

```text
describe("Price History: Mark provenance (W33)")
  it should give each Mark cell "Manual · saved 2026-10-14 17:00" as hover text and in its accessible name
  it should add "Corrected: <reason>" after the saved time on a corrected Mark
  it should give a gap no provenance
```

### T8R.5 Position: the Instrument column, one row per leg, no Opening fees

Seams: `PositionDrawer`, `LotMatchesTable` (and so the exit and expiration receipts). W28. Changes T8P.17's case 2 (no Opening fees row) and T8P.31's Opening fees pairing.

```text
describe("Position drawer: naming each contract")
  it should name each open lot's contract in a first column "Instrument"
  it should name each Lot Match's contract in a first column "Instrument", on the drawer and on the exit and expiration receipts
  it should show one Position row per leg
  it should not show Opening fees, which the Fee reconciliation already shows
```

### T8R.6 Today: one Marks table on an Open Trade

Seam: `TodayDrawer` and `today.props`. W29, A232, A233. O-C3 and O-C3+. Replaces T8P.16's case 1 and the comparison note, and T8P.31's cases 1, 3 and 4 (the current-Marks card).

```text
describe("Today drawer: the Marks table (W29)")
  it should show "Today, Thu Oct 15", "Yesterday, Wed Oct 14" and "Change" with each Instrument's Mark and change at Thu 18:00
  it should show "—" in every Today cell and in Change while the session hasn't ended, at Fri 12:00
  it should show "Next session, Mon Oct 19" and Friday as Yesterday on a Saturday
  it should show "—" for Yesterday when that session had no Marks, never an earlier session's
  it should show dashes in both columns beside the No Marks yet note before the first Marks
  it should show the Stale context and an acknowledgment under the table only when they apply
  it should not show Expected Mark Date, Source, Saved or a Mark-missing link (gone)
```

### T8R.7 Today on Settlement Due and Closed Trades

Seam: `TodayDrawer` and `today.props`. W25, W26, W29, W30, A234, A235, A242. O-S2X, K1, K2.

```text
describe("Today drawer: Settlement Due and Closed (W25, W26, W30)")
  it should show the Underlying's Marks for Today and Yesterday on a Settlement Due Trade, and no price tracks
  it should show "Expired" for the option on a session after its expiration, named "Expired Fri Nov 20"
  it should show a Closed by sale Trade's final exit price under "Exit Fri Nov 13", and the Underlying's Mark at that session
  it should show "Expired" for the option and the Underlying's expiration Mark under "Expired Fri Nov 20"
  it should leave the Today column empty and Change as "—" on a Closed Trade, with the "Closed" stamp
```

### T8R.8 Price track: the open lots' average and a tick per lot

Seam: `TodayDrawer`'s tracks and `Track`. A236, A237. O-C3+ (open lots at $2.00 and $3.30).

```text
describe("Price track: open lots")
  it should place the entry dot at the open lots' average, $2.65, not the first entry's $2.00
  it should place one tick per open lot at its price, named "$3.30 · Fri Oct 16"
  it should not tick a lot that was sold
```

### T8R.9 Today: At entry, the dated card and the condition lines go

Seam: `TodayDrawer`. Retires T8P.16's case 5, T8P.16's case 4 (A223 reversed) and the dated card's figures, each now shown in its new home (T8R.10, T8R.12, T8R.13, T8R.14). The audit's L1, L2 and L12. The removed code: `atEntryOf`, `valuedAtOf`, `conditionLineOf`, `FigureCard`, `CurrentMarksCard`.

```text
describe("Today drawer: one place for each figure")
  it should not show the At entry card (gone)
  it should not show the "At the Thu Oct 15 Marks" card (gone)
  it should not show a condition's value at expiration or distance on the Underlying under its track (gone)
```

### T8R.10 Plan and Risk: the Conditions group

Seam: `PlanRiskDrawer` and `plan-risk.props`. W31, W32, W6's words for Worst case, Max reward and the notes. A206 (amended), A230. O-C3 at Thu 18:00; O-S2's Wednesday breach. Replaces T8P.31's case 7 and T8P.18's conditions group (`conditionFiguresGroup`).

```text
describe("Plan and Risk: Conditions (W31)")
  it should list each condition with its trigger, "$2.20 away" and "Risk to stop $220.00 · 1.10R"
  it should show an Underlying condition's value at expiration in its row
  it should show a breached Stop as "Breached · $0.50 past" and "Risk to stop $60.00 · 0.24R past"
  it should show Worst case, Max reward and the short notes under the rows
  it should show the last Marks' figures with their date when today's Mark is missing
```

### T8R.11 Plan and Risk: Fulfillment and Deviations as its last groups

Seams: `PlanRiskDrawer` and `TradeDetail`. W16 reversed. Retires T8P.18's case 3 and the footer's tests.

```text
describe("Plan and Risk: Fulfillment and Deviations")
  it should show Planned-Leg Fulfillment and Deviations as the drawer's last two groups
  it should not show Deviations when there are none (gone)
  it should list a superseded Deviation struck through
  it should not show a footer under any drawer (gone)
```

### T8R.12 Plan and Risk: Since the last Marks

Seam: `PlanRiskDrawer`. W23. O-C3+ on Fri 10-16, with the Thu 10-15 Marks. The figures come from `evaluation.atEntry`.

```text
describe("Plan and Risk: Since the last Marks (W23)")
  it should show New lots 1 contract, Average price of new lots $3.30, Risk from that price and Reward from that price
  it should not show the group before the first Marks, when Entry Quality covers the entry (gone)
```

### T8R.13 Rail: no Deviation active badge; the P&L card's dated line

Seams: `IdentityCard`, `PnlCard`. W22, A231. Retires T8P.31's case 6 badge. Changes T8P.13's unavailable case.

```text
describe("Rail: identity and P&L")
  it should not show the Deviation active badge (gone)
  it should show "+$218.05 at the Thu Oct 15 Marks" under the reason when today's figure isn't available
  it should say "Mark" for a stock Trade's dated line
```

### T8R.14 Rail: the Conditions card shows distances

Seam: `ConditionsCard` and `conditions.props`. W21, A230, A231. Replaces T8P.14's cases 2, 3 and 4, its case 7 (Worst case and Max reward), T8P.15's Max reward R case, T8P.29's Conditions case and the `nearest` badge.

```text
describe("Conditions card: distances (W21)")
  it should show an option-price Stop as "Stop · $2.20 away" and an Underlying Target as "Target · 2.10 away"
  it should show a crossed condition as "Breached · $0.50 past" or "Reached · 0.50 past"
  it should show a dated distance "· Thu Oct 15 Marks" when today's Mark is missing
  it should not show "nearest", a Change in Trade P&L sentence, Worst case or Max reward (gone)
```

### T8R.15 Journal: one dated line per entry

Seams: `JournalCards`, `journal.props`, and the fallback list. W27, A239, P112. Replaces W10's items and the details grid.

```text
describe("Journal entries: one dated line (W27)")
  it should show "Daily Review · Thu Oct 15, 4:00 pm" under an entry's type
  it should add "· written Fri Oct 16" when the entry was answered on a later date
  it should not show Review Date, Anchor, Source, Moment or Authored rows (gone)
  it should not show a row for an unanswered prompt (gone)
  it should show the same line in the fallback list
```

### T8R.16 Journal paging keeps keyboard focus (tech debt item 24)

Seam: `JournalCards`. Item 24's trigger, "the next change to the Journal drawer's paging or session cards", fires with T8R.15. B8R.6's paging case is written first, red against the current build.

```text
describe("Journal paging: keyboard focus")
  it should keep focus on the paging button pressed while it stays enabled
  it should move focus to the other paging button when the pressed one becomes disabled
```

### T8R.17 Journal: the active Deviation line

Seam: `TradeDetail`. W24, A240. O-C3+.

```text
describe("Journal: active Deviations (W24)")
  it should show "1 active Deviation. See Plan and Risk." above the sessions
  it should select Plan and Risk and move focus to its Deviations heading when See Plan and Risk is pressed
  it should not show the line when no Deviation is active (gone)
```

### T8R.18 Trade Analysis: the distance to each trigger

Seam: `TradeAnalysis.evaluate`. A230. Stock, option-price and option Underlying conditions.

```text
describe("evaluate: trigger distance (A230)")
  it should give a stock Stop's distance in the stock's price, $2.82 from a $50.32 Mark to a $47.50 Stop
  it should give an option-price Stop's distance in the option's price, $2.20 from $3.20 to $1.00
  it should give an option's Underlying condition its Underlying distance, 2.10 from 57.90 to 60.00
  it should give zero distance and the distance beyond once a condition is crossed
```

### T8R.19 Trade Analysis: `AwaitingClose` names its session

Seams: `TradeAnalysis.evaluate`; `getTradeDetail`. A243.

```text
describe("evaluate: AwaitingClose due (A243)")
  it should give AwaitingClose the session after its date as due, Mon Oct 12 for a Trade opened Mon 10:00 after Friday's Marks
  it should give lots added after earlier Marks the next session as due, Fri Oct 16
  it should leave due out when the evaluation has no next session date
```

### T8R.21 Today's column dates

Seams: the read session; `getTradeDetail`. A232, P110.

```text
describe("Read session: the session before (P110)")
  it should name the session before its trading date and the as-of exchange date
describe("getTradeDetail: Today's column dates (A232)")
  it should give Thursday and Wednesday at Thu 12:00, and again at Thu 18:00
  it should give Monday as the next session and Friday on a Saturday
  it should give the next session after a holiday
  it should leave the dates out outside session-policy coverage
```

### T8R.22 Trade Views: the Underlying's Marks on a Settlement Due Trade

Seam: `getTradeDetail`. A234. O-S2X with MNO Marks entered for Fri 11-20 and Mon 11-23.

```text
describe("getTradeDetail: Settlement Due Underlying Marks (A234)")
  it should give the Underlying's Marks at the Today and Yesterday columns with their change
  it should give a missing Mark as a gap and no change
```

### T8R.23 Trade Views: the open lots' average

Seam: `getTradeDetail`. A236.

```text
describe("getTradeDetail: open lots' average (A236)")
  it should give O-C3+'s open lots' average, $2.65
  it should give a stock Trade the Trade Summary's price
```

### T8R.24 The before-Marks words

Seams: `calculation-words`, then each screen through its tests. W34, P113. Every "Awaiting the close after" expectation in section 1.5's Texts table changes, on Trade Detail, the Trades list and the Review alike (C1).

```text
describe("AwaitingClose words (W34)")
  it should word a figure and a sentence "Awaiting the Mon Oct 12 close"
  it should keep the existing words when due is absent
```

---

## 6. Structural tasks

| Task | Exact verification | Expected result | Notes |
|---|---|---|---|
| T8R.1 Types | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint` | Types compile; every new field is optional where section 1.5 says it is additive. | No behavior. Lets the UI lanes write doubles before the backend lanes finish. |
| T8R.20 Remove `nearest` | `npm run typecheck`; `npx vitest run src/domain`; `npm run verify:fixtures`; `npm run test:integration`; `git diff --stat` and `git diff -U0 tests/fixtures` | `nearest` and `nearestOf` are gone; T8P.6's four cases and revision 88's `nearest: true` lines in `current-evaluation.test.ts` go with them; the fixture diff deletes exactly the 90 `"nearest": true` lines (and the comma each leaves) and nothing else; `verify:fixtures` and the D8 round trip pass. | Per P111, after T8R.14 removed the only reader. The role headline (A197) and BUG-3's per-lot nearest condition are different things and stay (`entry.test.ts`, `tests/integration/d7/entry-window.test.ts`). Also corrects the comment at `plan-risk.props.ts:49` (PR lane is done by then). |
| T8R.25 Checkpoint critic | A fresh critic per section 8, flows C8R.1 to C8R.4, after a full-tier run | A structured report. Defects become bug tasks before the tail. | P115. |
| T8R.26 Node integration suite | `npm run test:integration`, then `.claude/scripts/acceptance-commands.sh plan/D08R-trade-detail-refactor.md` | Every section 7.1 case passes; the script exits 0 for the Node rows. | |
| T8R.27 Browser suite | `npm run test:e2e`; the acceptance script | Every section 7.2 case passes; the script exits 0 for every row. | B8R.6's focus case is written by T8R.16. |
| T8R.28 Browser critic | A fresh critic per section 8, all flows, after a full-tier run | Every flow passes. | Deliverable gate. |

---

## 7. Mock-free integration tests

D1 to D8's disclosed substitutes still apply. D8R adds none.

### 7.1 Node application-stack suite (`tests/integration/d8r/`)

| Case | File | Given / When | Then |
|---|---|---|---|
| I8R.1 Trigger distance and dated distances (AC-CALC-003, re-proven) | `detail.test.ts` | O-C3 at Thu 10-15 18:00; then Fri 10-16 12:00 with Friday's call Mark missing; a stock Trade with a breached Stop. | `trigger` matches T8R.18's figures; the dated line's conditions carry Thursday's distances; the breached Stop's `beyond`. No `nearest` anywhere. |
| I8R.2 Column dates | `columns.test.ts` | O-C3 at Thu 12:00, Thu 18:00, Sat 10-17 10:00, and the day after a holiday; restart between reads. | `marksColumns` per A232; equal after restart. |
| I8R.3 Settlement Due | `settlement.test.ts` | O-S2X at Mon 11-23 18:00, MNO Marks for Fri and Mon; then Wed 11-25 with none. | `settlementUnderlying` with both Marks and the change; then gaps and no change. |
| I8R.4 Open lots' average | `detail.test.ts` | O-C3+ at Fri 18:00; a stock Trade. | $2.65; the stock's equals its Trade Summary price. |
| I8R.5 Before-Marks due | `detail.test.ts` | O-C3 at Mon 10-12 12:00; O-C3+ at Fri 10-16 12:00. | Every `AwaitingClose` carries `due` 2026-10-12, then 2026-10-16. |
| I8R.6 Frozen backups still restore | `restore.test.ts` | Each of the five backup fixtures restored, then its views read. | Every view equals its edited expected views (P111). |
| I8R.7 Query count (AC-PERF-001, cumulative) | `query-count.test.ts` | O-C3 and O-S2X open; record the store requests of `getTradeDetail`. | The Open Detail's requests are unchanged from D8. The Settlement Due Detail adds one `series` read for its Underlying. |

### 7.2 Browser suite (`e2e/d8r/`, Playwright against the built app on `localhost:5175`, under the lock)

| Case | File | Procedure | Expected |
|---|---|---|---|
| B8R.1 Today on an Open Trade | `today.spec.ts` | O-C3 through the UI; open Detail at Thu 18:00, Fri 12:00, Sat 10:00, and Mon 10-12 12:00 before the first Marks. | W29's headings and cells per A232 and A233; the notes under the table only when they apply. |
| B8R.2 Today on every state | `states.spec.ts` | O-S2X at Mon 11-23; K1 by sale; O-S2X expired and recorded; a Planned Trade; D2's incoherent fixture. | W1 (amended) per state; W25, W26, W30; the "Closed" stamp read by the accessibility tree. |
| B8R.3 Rail | `rail.spec.ts` | O-C3 at Thu 18:00, then Fri 12:00 with a missing Mark; a stock Trade with its Stop breached. | W21 and W22; no nearest, Worst case or Max reward on the rail. |
| B8R.4 Plan and Risk and the Journal line | `plan-risk.spec.ts` | O-C3+ at Fri 12:00; press See Plan and Risk in Journal. | W23, W31 and W32 groups in order; Deviations last, focused after the press. |
| B8R.5 Contract names | `names.spec.ts` | O-C3 through the Plan form, entry form, Detail, Review card and the exit receipt; one contract in 2027. | W28 on every screen; "2027" in full for the 2027 contract; each name's accessible text equals its visible text. |
| B8R.6 Journal and Price History | `history.spec.ts` | O-C3 with a corrected Mark; open Price History, then Journal; page with the keyboard. | W27 and W33; focus stays on a paging button (tech debt item 24). |
| B8R.7 Responsive and accessible (AC-UI-001, AC-UI-002) | `responsive-a11y.spec.ts` | Today on every state, Plan and Risk and Position at 1280, 375 and 320 px; axe on each; the greyed Closed Today. | No sideways scroll; no WCAG 2.1 AA violations, contrast included. |

---

## 8. Browser-critic flows

The critic receives:
- the frozen `specs/` and the plan index;
- the D1 to D8 breakdowns, D08P and this one;
- the audit (`research/trade-detail-audit.html`), as the design;
- the future capabilities that are not defects: D9's chart, markers and condition status per session; the Trade Summary line's two-leg form; the Daily Review card's At entry block; two contracts sharing a short name; dashes in a Settlement Due Today column (revision 98).

It runs `npm run build && npm run preview` (port 5175, under the lock) itself and does not edit code. The checkpoint (T8R.25) runs C8R.1 to C8R.4; the gate (T8R.28) runs all six.

| Flow | Actions | Pass condition |
|---|---|---|
| C8R.1 One place for each figure | Open each drawer of an Open option Trade with Marks, then of O-C3+. | Each figure appears once, apart from these accepted repeats: the Journal cards' Marks; Price History's latest session; each Journal card's Trade P&L and change; Incurred fees beside the Fee reconciliation; Entry Quality's reward : risk beside the Plan Baseline's; the Trade Summary line's repeats; a condition's distance on the rail and in Plan and Risk (one price distance shown twice, by design). No "Expected Mark Date", footer or "Deviation active". |
| C8R.2 Today on every state | Open, Settlement Due, Closed by sale, Closed by expiration, at a weekday evening, midday and a weekend. | The columns follow W29 and A232; every cell is a Mark, "—", "Expired" or empty, never a carried-forward value. |
| C8R.3 Rail and Plan and Risk | An option Trade with an Underlying Target; a stock Trade with a breached Stop; a day with a missing Mark. | The rail shows distances only; Plan and Risk shows every dollar figure with its R; dated figures name their session. |
| C8R.4 Journal and Deviations | O-C3+: open Journal, press See Plan and Risk. | Each entry is one dated line; the button lands on Deviations. |
| C8R.5 Contract names | The Plan form, entry and exit forms, the Review, Trade Detail and the receipts. | Every contract reads in the broker style, with the full year only for a later year; a screen reader hears the same. |
| C8R.6 Narrow and offline | Each state at 375 and 320 px; stop the server and reload. | No sideways scroll; the Today table fits; the Detail works offline. |

---

## 9. Process

Decision 111's swarm rules apply unchanged, with D08P's tooling: lane worktrees, `lane-setup.sh`, the lane tier, merge runs, the browser lock and the full tier before every critic. Decision 113 (3) as amended in revision 104: pending questions during the run are asked one at a time. No `.claude/` change is planned.

---

## 10. Follow-ons (outline only)

- The Trade Summary line's two-leg form, with the multi-leg work after D8.
- The Daily Review card's At entry block, with the Review page work.
- Two contracts sharing a short name, when such contracts are supported.
- `underlying` on `ConditionReading`, unread after T8R.9 (A230): remove it with the next fixture refreeze, if the user wants.

---

## 11. Tech debt triggers

- **Item 24** (Journal paging drops keyboard focus): triggered by T8R.15, which changes the session cards, and fixed by T8R.16, with B8R.6's case written first.
- **Items 21 and 23:** fixed in D08P; not touched.
- **Item 22** (the D7S prefactor's slowdowns): not triggered; D8R runs no benchmark (A246).
- **Item 3** (the Review open grows with history): not touched. T8R.22's read is one `series` call over two dates on a Settlement Due Detail only.
- **The other items:** none names the files D8R changes.

---

## 12. Open questions (all answered 2026-11-15)

Asked one at a time, in this order; each answer is recorded here. None is open.

1. **Today's column dates (P110).** Should Market Data's read session name the session before its date and the as-of exchange date, with a spec amendment, so Trade Views can give Today's column dates? Recommended: yes. **Answered 2026-11-15: yes (a).** The user's rule: reviewing on Thu Nov 19 after the close, Today is Thu Nov 19, not the Friday session that hasn't started; the audit's `pending.date` would give Friday.
2. **`nearest` and the frozen fixtures (P111).** Remove the field and delete its 90 lines from five frozen backup fixtures, or keep it unread? Recommended: remove. **Answered 2026-11-15: remove (a).** Only the expected-views files change; the backup data does not.
3. **The Anchor on Journal lines (P112).** Amend the UI contract so Trade Detail's Journal leaves out the Trade Anchor? Recommended: yes. **Answered 2026-11-15: yes (a).** Any other Anchor, such as an Execution's from D13, still shows.
4. **The before-Marks words (P113, W34).** "Due once the Mon Oct 12 session ends", with Trade Analysis naming the session? Recommended: yes. **Answered 2026-11-15: "Awaiting the Mon Oct 12 close"** (option b), with Trade Analysis naming the session. The user's rule: "close" is correct for the end of a market session; a stock's or option's price is a Mark, never a close. The label "Awaiting close" stays.
5. **The spoken year (P114).** Only where a contract name stands alone, or in every sentence too? Recommended: where it stands alone. **Answered 2026-11-15: neither.** The screen reader works the same as the screen: no year for a contract expiring in the current year ("XYZ Dec 18 $55 Call"), the full year for a later one ("XYZ Jan 15 2027 $55 Call"). This replaces the audit's "'27" form.
   - **Follow-up, answered 2026-11-15: yes.** The Trade Summary line takes the same rule: "Long 1 Jan 21 2028 $250 Call", not "'28".
6. **One breakdown or a split (P115).** Recommended: one breakdown with a checkpoint critic. **Answered 2026-11-15: one breakdown, with the checkpoint critic (a).**

---

## 13. Acceptance matrix rows

Status values: `planned`, `covered`, `intentionally not advertised`.

| Scenario | Deliverable | Tasks | Integration / browser | Critic | Command or procedure | Expected | Status |
|---|---|---|---|---|---|---|---|
| AC-CALC-003 (re-proven: each condition's distance and overrun, on the rail and in Plan and Risk) | D8R | T8R.10, T8R.14, T8R.18 | I8R.1; B8R.3 | C8R.3 | `npm run test:integration -- d8r/detail` | Every condition listed with its distance; a breach shows how far past | planned |
| AC-MARK-003 (re-proven: an acknowledgment and an expired contract never read as a price) | D8R | T8R.6, T8R.7 | B8R.1; B8R.2 | C8R.2 | `npx playwright test e2e/d8r/states.spec.ts` | The acknowledgment note and "Expired" cells, never a figure | planned |
| AC-MARK-004 (cumulative: Today's columns never carry a Mark forward) | D8R | T8R.6, T8R.21 | I8R.2; B8R.1 | C8R.2 | `npx playwright test e2e/d8r/today.spec.ts` | A session without a Mark reads "—" | planned |
| AC-PERF-001 (cumulative: the Open Detail's reads unchanged) | D8R | T8R.22 | I8R.7 | — | `npm run test:integration -- d8r/query-count` | Open unchanged; Settlement Due adds one series read | planned |
| AC-UI-001, AC-UI-002 (cumulative) | D8R | T8R.2, T8R.5 to T8R.17 | B8R.7 | C8R.6 | `npx playwright test e2e/d8r/responsive-a11y.spec.ts` | No sideways scroll; axe clean, greyed text included | planned |

---

## 14. Evidence recording

Under `evidence/D08R/`, as in D08P:
- `tdd-log/<task>.md` (red and green per case, one file per task);
- `structural.md` (T8R.1, T8R.20's fixture diff), `provenance.md`;
- `critic-<n>.md` (the checkpoint and the gate);
- `suite-runs/` (lane tiers and merge runs);
- `ocr/`;
- `DECISIONS-PENDING.md` (decision 113, as amended).

Each critic defect is first reproduced by a failing test.

---

## 15. Progress

Status, not plan: editing this section is not a plan revision (decision 100, amended by decision 111). The main session alone edits it.

| Task | Wave | Lane | Status | Commits |
|---|---|---|---|---|
| T8R.1 | 0 | TY | Not started | |
| T8R.2 | 0 | SH | Not started | |
| T8R.3 | 0 | CN | Not started | |
| T8R.4 | 0 | PH | Not started | |
| T8R.5 | 1 | PO | Not started | |
| T8R.6 | 1 | TD | Not started | |
| T8R.7 | 1 | TD | Not started | |
| T8R.8 | 1 | TD | Not started | |
| T8R.9 | 1 | TD | Not started | |
| T8R.10 | 1 | PR | Not started | |
| T8R.11 | 1 | PR | Not started | |
| T8R.12 | 1 | PR | Not started | |
| T8R.13 | 1 | RA | Not started | |
| T8R.14 | 1 | RA | Not started | |
| T8R.15 | 1 | JR | Not started | |
| T8R.16 | 1 | JR | Not started | |
| T8R.17 | 1 | JR | Not started | |
| T8R.18 | 1 | BA | Not started | |
| T8R.19 | 1 | BA | Not started | |
| T8R.20 | 1 | BA | Not started | |
| T8R.21 | 1 | BV | Not started | |
| T8R.22 | 1 | BV | Not started | |
| T8R.23 | 1 | BV | Not started | |
| T8R.24 | 2 | — | Not started | |
| T8R.25 | 2 | — | Not started | |
| T8R.26 | 2 | — | Not started | |
| T8R.27 | 2 | — | Not started | |
| T8R.28 | 2 | — | Not started | |

---

## Appendix: the Names lookup

From a read-only grep on `6b11c8bc` of long-form contract dates ("18 Dec 2026", "20 Nov 2026" and the like) in `e2e/`, `tests/` and `src/**/*.test.*`, fixtures excluded. Each line was read to tell a contract name from an "Expires" line.

**Contract names (T8R.3 changes them):**
- **Browser:** `e2e/d8p/states.spec.ts:48`, `e2e/d8p/today-narrow.spec.ts:7`, `e2e/d7s/support.ts:13`, `e2e/d8p/support.ts:21`, `e2e/d7/plan-open.spec.ts:37`, `e2e/d7/settlement-due.spec.ts:8`, `e2e/d7/review-expiration.spec.ts:26,27,32`, `e2e/d7/runtime-failure.spec.ts:28,45`, `e2e/d7/short-put.spec.ts:30,56`, `e2e/d7/responsive-a11y.spec.ts:104,118`, `e2e/d7/marks-zero.spec.ts:11`, `e2e/d7sp/review-dated-line.spec.ts:8`.
- **Unit:** `src/ui/calculation-words.test.ts` (14 lines), `drawers/payoff.test.tsx`, `drawers/plan-risk.test.tsx` (3), `drawers/position.props.test.tsx`, `rail/needs-you.props.test.tsx`, `rail/pnl.props.test.tsx` (3), `ExpirationForm.test.tsx` (2), `PositionChangeFormOptions.test.tsx` (7), `ReviewExpiration.test.tsx`, `ReviewOptionMarks.test.tsx` (9), `ReviewOwed.test.tsx` (2), `ReviewSettlement.test.tsx` (5), `trade-detail/Footer.test.tsx`, `trade-detail/Payoff.test.tsx`, `trade-detail/Position.test.tsx` (6), `trade-detail/SettlementDue.test.tsx`.
- **Source comments:** `src/ui/cockpit/rail/pnl.types.ts:7` changes with the code it describes. `src/domain/trade-analysis/option-trade.ts:197` is a domain comment and stays.

**"Expires" and "Expired" lines, and other dates (kept):** `e2e/d8p/planned.spec.ts:6`, `e2e/d8p/states.spec.ts:64`, `e2e/d8p/cockpit.spec.ts:50`, `e2e/d7/plan-open.spec.ts:61,85`, `rail/identity.props.test.tsx` (11 lines), `tests/integration/d8/restore.test.ts:68`; comments in backend and integration tests.

`src/ui/screens/trade-detail/Footer.test.tsx`'s line is changed by T8R.3 and then deleted with the file by T8R.11.
