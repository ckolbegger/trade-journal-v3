# D08P — The Trade Detail cockpit: task breakdown

Definition: [implementation plan, D08P](implementation-plan.md#d08p--the-trade-detail-cockpit). D08P is the **D8 prefactor**: Trade Detail is rebuilt to match the "C. Cockpit" tab of `prototypes/trade-detail/index.html` before any more functionality is built. It builds on D7S's Trade Detail (T7S.9, every condition), the D7S prefactor's Mark-to-Market Valuation and read session (decisions 101, 104 to 106), D5R's precedent for a prototype-driven redesign (decision 65), and D7's approved words ([`D07-approved-words.md`](D07-approved-words.md), conventions C1 to C8). It is drafted from `claude-opus-5.5-pre-d8p`.

Status: **breakdown agreed by the user on 2026-11-12** (plan revision 84, decisions 110 and 111). P94 to P102 were agreed as recommended: one breakdown with a checkpoint critic (P101), one port behind a lock (P98), and the answers in section 12. A206 to A224 stand. The words in section 1.6 are approved, with W1's third tab renamed "Plan and Risk" in the user's words. The process amendments in section 9 are decision 111. Drafted from `plan/D08P-handoff.md`; numbering continues from D7S (P90 to P93, A195 to A205). The next plan decision is 112.

The prototype is a picture of the screen, not a specification. Where it differs from the specs or the plan, this breakdown says which wins (P96, section 1.6).

---

## 1. Decisions and clarifications

### 1.1 Decisions for this breakdown

**Agreed 2026-11-12 (decision 110):** all nine as recommended.

| # | Question | Recommendation | Alternatives and tradeoff |
|---|---|---|---|
| P94 | **How do the four history parts get earlier sessions' data?** (the P&L card's change, the Today drawer's comparison, Price History, the Journal cards; handoff section 5.2, left to the planner) | **Option A: build a slice of D9's read model inside D08P.** Market Data's `ReadSeries`, a cut-down `TradeAnalysis.replay` (Position, realized and marked P&L per completed session, with gaps), and Trade Views' `replayTrade`. D9 later adds condition status per session, Position Change and settlement markers, the chart, its text equivalent and audit navigation, on the same three operations. Nothing is thrown away. D8 is unaffected and keeps its place after D08P (D8 ∥ D9 stays a safe pair). Section 3 gives each option's cost. | B (Marks only), C (UI only), D (split D9 before D8), E (all of D9 before D8): section 3. |
| P95 | **Where does the history read live?** | **A separate read, `replayTrade(tradeId, binding)`**, as the Trade Views contract already names it. Trade Detail reads `getTradeDetail` first and then `replayTrade` with the Detail's binding. `replayTrade` answers `ChangedDuringAssembly` when the Workspace has moved since that binding, and the screen then reads both again, as it does today for one read. So the rail, the drawers and the cards always show one snapshot, and the coherence check stays in the coordinator. The spec says "UI layout does not shape these interfaces" and "audit history and corrected economic replay remain distinct"; a `history` field on `getTradeDetail` would break both, and D9 would then have to move it. The ordinary list path never replays (AC-PERF-001). | A `history` field on the Open and Closed `getTradeDetail` views: one read and no binding check, but the interface would be shaped by the cockpit, every Detail open would pay for the history even when only the rail is wanted, and D9's `replayTrade` would duplicate it. |
| P96 | **Whose words win for content that only moves?** The prototype relabels some existing figures ("Average fill", "Realized", "Fees paid", "Plan, set …"). | **Moved content keeps its approved headings, labels and wording.** The prototype wins for the layout, and for the new texts in section 1.6. So "Plan Baseline", "Entry Quality", "Lot Matches", "Fee reconciliation", "Executions (n)", "Realized to date", "Incurred fees", "Planned-Leg Fulfillment" and "Deviations" stay as they are. This keeps C1 (one wording per concept): the exit receipt also says "Realized to date". It also keeps about 60 browser and unit expectations unchanged (section 1.5). | Adopt the prototype's labels: shorter, but C1 then needs the receipts changed too, and every moved expectation changes with them. W17 offers this as a choice. |
| P97 | **How does the swarm run?** (handoff sections 5.3 and 5.4) | **Waves of lanes.** Wave 0 is serial and removes the hot spots. Wave 1 runs up to 6 `tdd-task` agents at once, each in its own git worktree on its own branch, and each lane owns disjoint files. Wave 2 wires the history read and runs the gate. The main session merges each finished lane task and runs the complete cumulative run once per merge batch. The rules this changes are in section 9, as amendment text. | Serial, as decision 100 says: about 2.5 to 3 times longer (section 3.3). |
| P98 | **Ports for parallel browser runs.** | **One port, 5175, behind a lock.** Lanes run only the browser specs their task changes. Merge runs and critics use the full tier. Every browser run on 5175, wherever it starts, takes `.claude/scripts/with-browser-lock.sh`. The lock is a directory in `$TMPDIR` keyed by the port, and it also covers the `tj-release` cache and the CDP ports 9341 and 9342. No port is invented. | **The user assigns a second port:** each merge run's `browser-1` and `browser-2` stages then run at once, saving about 5 minutes per full run (about 30 minutes over D08P). It costs a tooling task: a `TJ_E2E_PORT` setting read in seven places, a CDP base offset, per-run `--output` folders and one build per merge. Open question 3. |
| P99 | **A LEAP's Price History.** A two-year contract has about 500 sessions. | **All sessions in one table, newest on the left, with no paging.** Today is always at the left edge, so nothing scrolls to reach it. Three rows by 500 columns is about 1,500 cells, which renders quickly. The read returns a few figures per session. **The table includes the latest session**, which the rail and the Today drawer also show. This is a second accepted exception to "one figure, one place", beside the Journal cards' Marks. | (a) Show the newest 60 sessions, with "Show earlier sessions": more controls and words, for a problem not yet seen. (b) Leave out the latest session: the grid then starts one session back, which reads as a gap. Open question 4. |
| P100 | **"Today's Action is not recorded"** in Needs you. Trade Detail's view does not carry it. | **Drop it from D08P and list it as a follow-on** (section 10.3). Adding it would mean either reading the Review from Trade Detail, or a Trade Views field that copies Daily Review's eligibility rule. | Read `DailyReview.getTrade` from Detail: a second coordinator on one screen, and the Review's eligibility on every Detail open. |
| P101 | **Size check** (section 1.4). | **Keep one breakdown, with a checkpoint critic (T8P.23)** after the wiring and before the structural tail, as D7S did. | Split at the history seam: D08P-1 (the cockpit on today's reads) and D08P-2 (history). |
| P102 | **"Close" for a Mark, in moved texts.** The user's rule is "Mark", never "close", for a session's closing price. Two moved texts break it, and the Review card shares one of them. | **Change both now, on Trade Detail and on the Review card together, so C1 holds** (W18, W19). "Value at expiration at MNO's latest close" becomes "… latest Mark". The dated heading "At Mon Oct 12 close" becomes "At the Mon Oct 12 Marks". "Awaiting close" (`calculation-words.ts`, shared by every screen) names a moment, not a price, so it stays. | Leave both texts for the sharing phase: Detail then keeps "close" until later, which goes against the user's rule. |

### 1.2 Amendments to other plan sections (agreed 2026-11-12 and applied in revision 84, except where a task is named)

- **D9 definition.** Its "Introduces" line names `replay`, `query` (`ReadSeries`) and `replayTrade`. Note under it: D08P builds a slice of each (P94, P95, A210 to A213). D9 extends them with condition status per session, markers, the chart and its text equivalent, and audit navigation. D9's AC-MARK-004 claim ("partial: points and gaps") is shared: D08P proves the read and the grid, and D9 the chart.
- **Deliverable summary.** A D08P row before D8: "The Trade Detail cockpit (decision 110) | 0 (refactor)".
- **Decision 100, `implementing.md`, `tdd-task.md`, `suite-runner.md`, `tdd.sh`, `full-suite.sh` and the full-run rule.** These are amended for swarm deliverables (section 9), as decision 111. Decision 100's row carries the amendment note now. **T8P.1** applies section 9's text to the `.claude/` files, together with the tooling that text names.
- **Tech debt.** Items 21 and 23 carry notes naming the tasks that fix them: T8P.19 and T8P.9.
- **Acceptance matrix.** AC-MARK-004 gains a D08P entry (section 13), and its "Later" note now names only D9's chart and D11's Daily Bars.
- **D8 breakdown.** No change. D08P changes no schema, store or fixture (section 1.5, shapes), so D8's schema-7 note (decision 107) stands as it is.
- **Spec map.** No retag (A218).

### 1.3 Working assumptions

These are implementation-level choices that do not reopen product semantics. They stand unless you object.

| # | Assumption |
|---|---|
| A206 | **Conditions card figures come finished.** Row 1's figure is the condition's `distance.dollars`, with the role's sign glyph: "−" for a Stop, "+" for a Target. Row 3's R is `distance.planR`, and a breach uses `overrun`. Every amount is a non-negative Measure from `evaluate`. Putting a glyph in front of it is formatting, not arithmetic (ADR 0001), as `signedMoney` does for realized P&L. The glossary's "avoid negative risk to stop" stands: the figure is labelled as a change in Trade P&L (W5), never as risk. |
| A207 | **The nearest condition:** `ConditionStatus` gains `nearest?: true`. It is set on the one condition per role whose Value distance sets that role's headline, and only when the headline is a positive Value. A tie goes to the earlier condition in Plan order (A197). With a zero headline (something crossed) or an Unavailable one (P91), no condition of that role is marked. This is additive in Trade Analysis. |
| A208 | **Days to expiration:** `ContractExpiration` gains `days?: number`, present only for "Expires". It is the count of calendar days from the View Moment's exchange-local date to the contract's expiration date: 36 from Thu 2026-11-12 to Fri 2026-12-18, and 0 on the expiration date. The count is a pure helper in `src/domain/instrument/`, because only the Instrument module may compare a date with a contract expiration (the D7S prefactor's lint rule). |
| A209 | **Tech debt item 23's cause:** `confirmedDetail()` (`src/ui/screens/confirmed-detail.ts`) builds the just-confirmed Planned Detail from `confirmPlan`'s post-commit result, which has no expiration line, so the line shows only after a reload. The fix: the post-commit result carries `contractExpiration`, built by Trade Views' existing `expirationLineOf`, and `confirmedDetail` passes it on. A browser case reproduces the bug first (B8P.3). If the case shows another cause, the task stops and reports it. |
| A210 | **`ReadSeries`:** the read session answers `series(instrument, from, to)`. For each completed regular session from `from` to `to`, it gives the effective Mark (price and revision), a Missing gap, or an Acknowledged gap. It never carries a value forward. It shares the session's one gaps scan per Instrument (decision 106), so a Detail read plus a replay read never scan an Instrument twice in one session. The facade's `query` gains the `ReadSeries` member over the same code. |
| A211 | **The `replay` slice:** input is one derived snapshot plus the ordered series frames. Output, per completed session, is: the Position held at that session's Mark (via `derive` at the cutoff); realized P&L; Trade P&L (realized plus open, from the valuation module's dated-line path); the change since the previous session with a figure, with that session's date; each Instrument's Mark change since its previous Mark; and the Position Change ids whose Economic Time falls in the session. No condition status, Deviations or markers: D9 adds them. |
| A212 | **`replayTrade`:** request `{ tradeId, binding }`. The lifetime runs from the first exposure's session to the Expected Mark Date (Open), or to the final session (Closed). A Planned or never-exposed Trade gives `NotApplicable(NeverExposed)`. Facts that cannot be replayed give `NotApplicable(FactsIncoherent)`. A Workspace moved since `binding` gives `ChangedDuringAssembly`. It reads through one read session, and adds one Installed Capability Manifest operation. |
| A213 | **Journal items by session** (Trade Views, since only Market Data knows the session policy, decision 62). A Daily Trade Review Action belongs to its Review Date's session. Any other item belongs to the first session whose close time is at or after its moment time, using the session close times Market Data returned. An item before the first exposure goes in a "Plan" list. An item after the newest completed session belongs to the session not yet ended (W12). |
| A214 | **Merged cards without Marks:** consecutive sessions in which no Instrument has an Available Mark merge into one card. This is a pure presentational grouping in `src/ui/cockpit/journal-cards.ts`, with no arithmetic. **For the later filter** (section 10.3): filter the sessions first, then merge runs of the kept sessions that are consecutive and without Marks. A merged card is shown only when one of its sessions holds an entry the filter keeps; otherwise the filter drops the whole run. |
| A215 | **Track geometry is presentation.** Placing a price on a horizontal track maps a finished price to a CSS percentage, as `PayoffView` maps Rationals to SVG coordinates and `StopTargetSlider` takes a percentage. Range and position follow the existing chart precedent. No figure is derived. |
| A216 | **Presentational components:** every new rail card and drawer lives in `src/ui/cockpit/` and takes plain props. Each has a small adapter (`<name>.props.ts`) from the views, owned by the same lane. An ESLint `no-restricted-imports` rule (`eslint.cockpit.config.js`) bars `src/ui/cockpit/**` (excluding `*.props.ts`) from importing `app/types` or `coordinators/**`, so sharing them later is a move, not a rewrite (handoff section 5.5, condition 1). |
| A217 | **Drawer state:** the selected drawer is component state, not part of the URL. The default drawer is Today on an Open Trade, Plan and Risk on a Planned one, and Position on a Closed, Settlement Due or incoherent one. "Reflect now" in Needs you selects the Journal drawer and opens that Debt's form on its card. The existing one-form-at-a-time rule holds. |
| A218 | **Reading list:** the implementing session reads `plan/spec-reading/D07.md`, plus these entries of `plan/spec-reading/D09.md`: Trade Analysis `replay`, Market Data's query contract, Trade Views' `replayTrade` and invariants, AC-MARK-004 (S047), and the UI contract's replay line. There is no retag: a `D8P` tag would break `spec-reading-lists.py` (A205's reason). |
| A219 | **No benchmark task.** AC-PERF-001's gated paths are the cold start and the open list, and neither reads `replayTrade`. A query-count proof (I8P.4) shows that the replay reads each Instrument's series once, and that the Detail's own reads are unchanged. Tech debt item 22 is not triggered. |
| A220 | **No schema, store, fixture or migration change.** The new view fields are additive, and `compareSnapshot` compares only the keys a snapshot holds (section 1.5, shapes), so no frozen view changes. A changed one stops the task. |
| A221 | **A stock Trade's identity card** shows the symbol, "Long Stock, Open" and the account, with no strike or expiration line. Its P&L card reads "100 of 100 shares open". The quantity against plan comes from the existing `summary`, which the Summary card uses today. |
| A222 | **Unavailable figures:** a figure that is Unavailable or Not Applicable shows its reason at the `figure` length once, where the figure lives, and at the `label` length wherever the cockpit refers to it again (`calculation-words.ts`). |
| A223 | **The per-condition Underlying figures:** the value at expiration and the distance on the Underlying (row 23.17's columns, D7S W7) leave the conditions table. They move to the Today drawer, one line under the Underlying's price track per Underlying condition, in their existing words. Open question 5. |
| A224 | **Settlement Due:** the existing panel moves into Needs you, with Record expiration. The P&L card names the contract (W4). The Position drawer's Open P&L reads "Settlement Due" at the `label` length (A222). |

### 1.4 Size check and the split proposal

The graph (section 4) has **26 tasks**, more than 25. Five of the decisions need the user (open questions 1 to 5, section 12). There is no schema change. So two of the guide's criteria are met, and here is a split.

**Proposed seam: D08P-1, the cockpit on today's reads, then D08P-2, history.**
- **D08P-1** covers wave 0, every rail card and drawer except Price History and the Journal cards, the nearest flag, days to expiration, and tech debt item 23. The rail's change line and the Today comparison stay out. The Journal drawer is a newest-first list. Its gate is light: the cumulative suites and a browser critic.
- **D08P-2** covers `ReadSeries`, the `replay` slice, `replayTrade`, Price History, the Journal session cards, the change line, the Today comparison, and the full structural tail.
- **What D08P-1 leaves unfinished:** the four history parts. Nothing is released for real use between the parts.

**Agreed 2026-11-12: keep one breakdown (P101).** In the swarm, the history lane already runs beside the UI lanes, so a split would add a gate (a full run and a critic) to the middle of the critical path, and build the Journal drawer twice. The checkpoint critic (T8P.23) gives the same early browser look.

### 1.5 Lookups (drafting guide)

All run on `claude-opus-5.5-pre-d8p` plus the prototype additions. The full inventory is in the appendix.

**Reach.** Moving content into drawers is not a text change, but it breaks every read of content the selected drawer hides. **44 browser spec files read Trade Detail beyond its heading.** 2 more (d1/offline, d1/readiness) read only the h1, and the rest only pass through Detail in setup. Helpers that end on Detail or read it: `confirmPlan`, `confirmReference`, `openEntryForm`, `recordEntry`, `backToTrade`, `openTradeFromOpenList`, `createTrades`, `createTradeAt`, `answerDebt`/`declineDebt` (with `card` undefined), `openExitForm`, `valueOf` (page-wide), `confirmOptionPlan`, `expectPayoffChart`, `expectPayoffNotApplicable`, `fillOptionExit`, `confirmBothKinds`, `createOs2Trade` and `expectShownInFull`. They move in T8P.4 (section 6.3).

| Destination | Spec files whose Detail reads move there (line ranges in the appendix) |
|---|---|
| Rail: identity (h1, lifecycle badge, Record entry, Record exit) | d1/plan, d2/after-save, d2/durability, d2/integrity, d2/runtime-failure, d2/responsive-a11y, d2/ui-alignment (:212, :828), d6/exit, d6/runtime-failure, d6/responsive-a11y, d7/plan-open, d7/settlement-due, d7/short-put, d7/runtime-failure, d7/responsive-a11y |
| Rail: P&L card ("Current Marked Trade P&L", the Result) | d4/expected-mark :32, :44; d4/breach-overrun :40; d4/correct-mark :25; d7/settlement-due :47; d6/exit :65–71; d6/kill :41–48; d6/offline :51–53; d6/runtime-failure :44–47; d6/responsive-a11y :161–166, :236–240; d7/settlement-due :59–60, :68; d7/kill :31–36; d7/offline :34–35 |
| Rail: Conditions ("Risk to stop", "Reward to target", the "Conditions" table, Worst case, Max reward) | d4/breach-overrun :25–30, :41–43; d4/expected-mark :33; d4/responsive-a11y :172; d7/settlement-due :47–48; d7s/conditions :48–57; d7s/responsive-a11y :53–60 |
| Rail: Needs you (Settlement Due panel, Record expiration, "Reflection owed", Reflect now, Decline) | d5/detail-debt, d5/faults, d5/kill-offline, d5/responsive, d5/review-debt :21, d6/update :36–37, d6/runtime-failure :49–51, d7/settlement-due :31–37, :54, d7/runtime-failure, d7/responsive-a11y :99–133, d7/kill, d7/offline, d7/no-save |
| Today (Valuation's Mark and provenance, "At … close", "At entry") | d4/expected-mark, d4/breach-overrun :24, :47–56, d4/correct-mark :22–24, d4/responsive-a11y :171–225, d4/runtime-failure :59, d7p/layout :94–111 |
| Position (Position, Open Lots, Open P&L, Realized to date, Lot Matches, Fee reconciliation, Executions, Settlement) | d2/offline :41–44, d2/open-position :40–45, d2/ui-alignment :986–1066, :1214, :1678, :1849, d2/durability :44, d4/runtime-failure :58, d6/exit :33–35, d6/exit-requirements :92–93, d6/kill, d6/offline, d6/responsive-a11y :195–329, d6/runtime-failure :60–63, d7/short-put :29–55, d7/plan-open :34, d7p/layout :98–111 |
| Plan and Risk (Plan, Plan Baseline, Entry Quality, 1R, the Summary's duplicates) | d1/plan :24, d1/responsive-a11y :179, d2/offline :34, :45, d2/open-position :46–113, d2/narrow :80, d2/runtime-failure :39, d2/ui-alignment :1100–1176, :1336–1369, :1736–1757, d7/plan-open :7, :13, :35, d7/confirm-option-plan :15, d7s/plan :14–26, d7s/entry-beyond-stop :20–21, d7s/responsive-a11y :111 |
| Journal (Plan Reflection, Journal items, debts on the card) | d1/plan :25, :52–53, d1/recovery-only :25, d2/durability :45, d2/open-position :85–87, d2/ui-alignment :1181–1207, :1293–1316, :1780–1801 |
| Payoff ("Planned/Current Expiration Payoff", "Value at expiration at … latest close") | d7/plan-open :14, :36, d7/confirm-option-plan :16, d7/payoff-chart-layout, d7/responsive-a11y :17–157, d7/settlement-due :50, d7/runtime-failure :28–33 |
| Footer (Planned-Leg Fulfillment, Deviations) | d2/open-position :81, :84, :105, d2/responsive-a11y :121, d2/ui-alignment :1766–1779, d4/breach-overrun :31 |
| Full-width banner (Records disagree, Facts can't be replayed) | d2/integrity :46–50, :82–84, :110–113, d2/narrow :93–96, d7p/layout :56–64 |
| Page-wide or order-dependent reads that must be scoped | d1/responsive-a11y :86–88 (axe), d2/narrow :83, :170 (all tables), d2/ui-alignment :356–411 (every `.card`), :1340–1352 (`main dl`), d4/breach-overrun :39 (`getByText`), d7s/plan :15, :24–26 and d7s/entry-beyond-stop :21 (`.first()`/`.last()` across the Summary and Plan cards, which the cockpit shows once) |

**Unit tests.** `TradeDetail.test.tsx` holds 77 cases and `TradeDetailOptions.test.tsx` 21. T8P.2 moves each case, unchanged, into its section's test file. T8P.5 adds the drawer step to each one (a mechanical change only, section 6.3). Each wave-1 lane then owns its section's file. Cases whose expectations change, by task:
- T8P.12: Summary-region cases :48, :457–:521, :823, :1432; TradeDetailOptions :45, :284–:301, :330.
- T8P.13: Valuation "Current Marked Trade P&L" cases :856, :879, :953, :969, :982.
- T8P.14: "risk and reward" :901, :919; TradeDetailOptions :262, :298, :313.
- T8P.17: realized, open and fee figures move from the Valuation region to the Position drawer (:856, :879).
- T8P.19: TradeDetailOptions :72, :90, :104; TradeDetail :1513, :1539.

`PlanForm.test.tsx:973` renders `PayoffView` on the Plan receipt, which is unchanged. `PositionChangeForm.tsx:27` imports `EXIT_ACTION` and `INCOHERENT_ENTRY_NOTE` from `TradeDetail.tsx`: T8P.2 moves them to `src/ui/screens/trade-detail/words.ts` and updates the import.

**Texts.** Each changing text, grepped in `e2e/`, `tests/` and `src/**/*.test.*`. Every hit is an expectation that changes, in the task named.

| Old text | Hits | Changes in |
|---|---|---|
| `aria-label="Summary"` region | e2e d2/ui-alignment :1119, :1140, :1330, :1363, :1565, :1790; src TradeDetail.test :52, :455, :524, :823, :1432; TradeDetailOptions.test :48, :284, :301, :332, :340 | T8P.12 to T8P.14, T8P.18 (the Summary card is dissolved, one figure in one place) |
| "Current Marked Trade P&L" (Detail) | e2e d4/expected-mark :32, :44; d4/breach-overrun :40; d4/correct-mark :25; d7/settlement-due :47; src TradeDetail.test :856, :861, :869, :877, :959, :964, :975, :1014, :1029, :1030 | T8P.13 (the rail's "Trade P&L", W4); the Review's hits (d5r/review :27, d4/review :46, d7sp :33, CardFigures, ReviewCard) are unchanged |
| "Risk to stop", "Reward to target" (Detail) | e2e d7/settlement-due :47–48; d7s/conditions :48–57; src TradeDetail.test :901 | T8P.14 (the nearest condition's figure, A207) |
| Table "Conditions" with its columns | e2e d4/breach-overrun :25–30, :42–43; d7s/conditions :48–57; d7s/responsive-a11y :53–60; src TradeDetail.test :919; TradeDetailOptions.test :262–276, :313 | T8P.14 (W5) |
| "Planned Expiration Payoff", "Current Expiration Payoff" regions | e2e d7/support `expectPayoffChart` :156–163 (7 calls), `expectPayoffNotApplicable` :166–172 (4 calls), d7/plan-open :14, :36, d7/confirm-option-plan :16, d7/payoff-chart-layout :37–82, d7/runtime-failure :28–33, d7/responsive-a11y :17–22, :65–68, :153–157; src TradeDetailOptions.test :72, :104; TradeDetail.test :1513, :1539 | T8P.19 (one chart; the two text-equivalent tables keep their names, W14) |
| "Value at expiration at MNO's latest close" | e2e d7/settlement-due :50; src TradeDetailOptions.test :93, :99; CardFigures.test :96, :100, :106 | T8P.19 (W18; with CardFigures.tsx:94, for C1) |
| "At Mon Oct 12 close" (dated heading) | e2e d4/breach-overrun :46; d4/expected-mark :31, :36; d4/responsive-a11y :220; src TradeDetail.test :953; tests/integration/d7/missing-mark.test.ts :82 (builds the string itself) | T8P.16 (W19); the integration test's own string is unchanged, since it doesn't read the screen |
| `header .badge` reading "Open" or "Closed" | e2e d2/durability :43; d2/open-position :39; d2/responsive-a11y :247; d6/exit :36, :65; d7/settlement-due :38, :46; d7/short-put :56 | T8P.4 (the helper reads the identity card's lifecycle, which now reads "Long Call, Open") |

**Shapes.** `ConditionStatus` gains `nearest?`, and `ContractExpiration` gains `days?`. `confirmPlan`'s post-commit result gains `contractExpiration`, and `replayTrade` is new. No field is removed or retyped. Grep of `tests/fixtures/` and the verify tools:

```text
contractExpiration: workspace-v1..v6 expected-views.json 0 hits; workspace-v7 3
"nearest", "days", replay: 0 hits in every expected-views.json
"conditions": workspace-v3..v7 (9, 11, 26, 31, 34)
tools: verify-fixtures.ts:46-48 and :134-137 read conditions[].id/result and the StructureValue count;
       fixture-views.ts:153 counts StructureValue conditions; bench-run.ts:24 "nearest-rank p95" (unrelated)
```

`compareSnapshot` (`tools/fixtures/snapshot-compare.ts:9`) compares only the keys a snapshot holds. The new optional fields are therefore ignored for v1 to v7, and `verify-fixtures.ts`'s condition checks read only `id` and `result`. **No expected view changes**, and no fixture is frozen.

**Checks.** A216's rule (`no-restricted-imports` on `src/ui/cockpit/**` without `*.props.ts`, barring `**/app/types*` and `**/coordinators/**`) was run as a throwaway config on the current tree. **0 hits**: the folder doesn't exist yet. T8P.3 adds the rule with the folder. Its verification plants an import in a non-props cockpit file and expects `lint` to fail, as `tools/condition-rules.test.ts` does.

**CSS.** Detail-only selectors in `src/ui/app.css`:
- `.card.integrity` :621–625
- `ul.narrative` :627–637, :953–956
- `.back-link` :725–730
- `.summary-card`, `.summary-text` :732–756, :906–910
- the execution disclosure rules :798–884
- `dl.figure-grid` :886–929
- `.trade-detail dl…` :900–904
- `dl.answers` :931–961
- `table.lots` :978–998

T8P.2 moves them to `src/ui/cockpit/styles/legacy-detail.css`. Selectors shared with other screens stay in `app.css`: `ul.executions`, `.execution-price`, `.chart-scroll`, `.payoff-chart`, `.second-line`, `.nowrap`, `.table-scroll` and `table.trades`.

### 1.6 Approved words

**Approved by the user on 2026-11-12** (decision 110): W2 to W20 as proposed, with W17's recommended choice (keep "Realized to date" and "Incurred fees"). W1 is approved with its third tab renamed **"Plan and Risk"**, the user's words, in place of the proposed "Plan and entry"; the prototype's C. Cockpit tab is renamed to match. Task briefs name the rows they use, and words no row covers still need approval.

Examples use the prototype's NVDA Long Call, D7S's O-S2 (MNO, Cash-Secured Put) and O-C3 (section 5). Conventions C1 to C8 of the D7 approved words apply. An option price has a "$" and two decimals; an Underlying price keeps C3 ("140.00"). Dates use the existing `shortDate` ("Thu Nov 12"). `verify:wording` still applies. Moved content keeps its words (P96).

| # | Where | Proposed words |
|---|---|---|
| W1 | Drawer tab list (label "Detail"); rail landmark | Tabs "Today", "Position", "Plan and Risk", "Price History", "Journal", "Payoff", in that order, with only the drawers a state shows (A217). Rail landmark: "State of play". A tab may carry a count: Price History the number of sessions without Marks ("2"), and Journal the number owed ("1 owed"). |
| W2 | Identity card | Heading: the symbol, "NVDA". Badge: "<Strategy>, <Lifecycle>" ("Long Call, Open"; "Long Stock, Closed"). Lines: "Strike 150"; "Expires Fri 18 Dec 2026 (36 days)", with "(1 day)" and "(today)"; "Expired Fri 20 Nov 2026"; then the account as the current Detail names it. The actions "Record entry" and "Record exit" keep their words. |
| W3 | P&L card, Open | Accessible name "Trade P&L". Figure "$188.05". Line "+$169.35 since Mon Oct 12". Then "1 of 2 contracts open" (stock: "100 of 100 shares open"; one: "1 of 1 contract open"). With an unavailable Trade P&L, the reason at the `figure` length and no change line. Before any Marks: "—" and "Trade P&L once today's session ends". |
| W4 | P&L card, other states | Planned: "—", "Trade P&L once the entry is recorded and marked", "0 of 2 contracts open". Settlement Due: "Settlement Due: NVDA 18 Dec 2026 150 Call", then "Trade P&L once the expiration is recorded". Closed: the realized P&L, "+1.10R realized, final", then the Result rows with their existing labels (Terminal Disposition, Option Disposition Timing, Close Reason). Incoherent: "Not available", then "Trade P&L". |
| W5 | Conditions card (heading "Conditions"), one block per condition | Row 1: pill "Stop" or "Target", the badge "nearest", and the figure "−$360.00" or "+$260.00". Row 2: the full condition on one line, in D7S's W6 words ("Option at or above $3.60", "MNO at or below 41.00"; stock "XYZ at or below $47.50"). Row 3, muted: "Change in Trade P&L from the Tue Oct 13 Marks if the option's Mark is $3.60 (−0.75R)." / "… if MNO is at 41.00 at expiration (−0.92R)." / stock "… from the Thu Nov 12 Mark if XYZ's Mark is $47.50 (−1.92R)." Breached: figure "Breached", row 3 "The Wed Oct 14 Mark is $20.00 (0.04R) of Trade P&L past this Stop." Reached: figure "Reached", row 3 "The Thu Oct 15 Mark is $0.00 (0.00R) of Trade P&L past this Target." Unavailable: row 1 shows the reason at the `label` length. No Marks yet, or Closed: rows 1 and 2 only. |
| W6 | Conditions card, beneath | "Worst case: $2,320.00 · 2.09R if the call expires worthless" (a put "… if the put expires worthless"; a Cash-Secured Put "… if MNO goes to zero"; stock "… if XYZ goes to zero"). "Max reward: Unbounded above" (the existing words for an unbounded result, C1), or the amount and R. Before Marks: "Distances to each condition and the worst case arrive with the first Marks." Planned: "Distances to each condition arrive with the first Marks after entry." Settlement Due: "The contract expired, so its conditions are no longer measured." |
| W7 | Needs you (heading "Needs you") | Empty: "Nothing needs you now." Debt: its existing owed heading and due text ("Reflection owed. Due in the next Review"), with "Reflect now" (A217). Alert: "Stop breached: the option's Mark is $3.70, at or above $3.60" / "Target reached: MNO's Mark is 44.60, at or above 44.50". Before Marks: "First Marks are due once today's session ends." Mark missing: the existing "Mark missing" link to the Review. The Settlement Due panel keeps its words. |
| W8 | Today drawer | Heading "Marks: Thu Oct 15 against Wed Oct 14". Comparison table columns: empty, "<earlier date>", "<date>", "Change". Rows "MNO Mark", "Put Mark" (or "Call Mark"; stock "XYZ Mark"). Note: "Wed Oct 14 has no Marks, so Thu Oct 15 is compared with Tue Oct 13." Heading "Where the prices sit" (stock: "Where the price sits"). Track titles "Option price" and the symbol, with markers "entry", "now" and the earlier date. Each track's accessible name lists the Stop, Target and now prices. Before Marks: "No Marks yet. This Trade opened today at 10:20 am. Its first Marks, and every figure that needs them, are due once today's session ends." The Valuation's Mark provenance, the dated line and At entry keep their words (W19 aside). |
| W9 | Price History drawer | Header row "Session", then one column per session, headed "Thu" over "Oct 15", newest on the left. Rows: "<symbol> Mark", "Call Mark" or "Put Mark", "Trade P&L". A gap reads "—" with the accessible name "No Mark". Under the table: "2 sessions without Marks. Enter Marks in the Review" (a link; the count line only when there are gaps). Empty: "No sessions yet: the first ends once the Trade's first session ends." |
| W10 | Journal drawer | Heading "Sessions, newest first". Buttons "‹" ("Newer sessions") and "›" ("Earlier sessions"). Card heading "Today, Thu Nov 12", "Yesterday, Wed Nov 11", "Mon Nov 9" or "Fri Nov 13, final session". Card body: the Trade P&L, "+$90.00 since Mon Nov 9" or "First Mark", the Marks ("XYZ Mark $52.30"), then the session's items in their existing words, with an owed one keeping "Reflect now" and "Decline". |
| W11 | Journal drawer, merged and special cards | "Tue Nov 10 without Marks"; "Tue Nov 10 to Thu Nov 12 without Marks". Plan card: "Planned Thu Nov 12, 1:40 pm", heading "Plan". |
| W12 | Journal drawer, the session not yet ended | Heading "Today, Thu Nov 12" (or the next session's date), title "Session not ended yet", note "Its Marks are due once this session ends." |
| W13 | Journal drawer, incoherent | One card: "Every entry, newest first", heading "Journal", note "Without a replay there are no sessions, so the entries are one list." |
| W14 | Payoff drawer | One chart titled "Expiration Payoff". Legend "Planned" (dashed) and "Now". The two text-equivalent tables keep their names "Planned Expiration Payoff" and "Current Expiration Payoff". Closed: "Now: Not applicable: no open position". Stock: one line, "Expiration Payoff: Not applicable: no option expiration". |
| W15 | Position drawer, Settlement Due | Open P&L reads "Settlement Due". |
| W16 | Footer | Planned-Leg Fulfillment and Deviations in their existing words, below the drawers. |
| W17 | Position drawer labels (choice, P96) | Keep "Realized to date" and "Incurred fees" (recommended, C1 with the exit receipt), or adopt the prototype's "Realized" and "Fees paid" on Detail and the receipts together. |
| W18 | Payoff and Review card (P102) | "Value at expiration at MNO's latest Mark" replaces "… latest close", on Trade Detail and the Review card. |
| W19 | Today drawer (P102) | "At the Mon Oct 12 Marks" replaces the heading "At Mon Oct 12 close". |
| W20 | Price History and Journal, loading | While `replayTrade` is pending, the drawer shows the existing Loading words, and the rail shows no change line until it arrives. |

---

## 2. Implementation boundaries extended in D08P

| Canonical boundary | Code location | D08P operations |
|---|---|---|
| Trade Analysis (pure) | `src/domain/trade-analysis/` | `evaluate`: `nearest` (A207); `replay`, the slice (A211) |
| Instrument (pure) | `src/domain/instrument/` | days to expiration (A208) |
| Market Data | `src/modules/market-data/` | read session `series` and `query` `ReadSeries` (A210) |
| Trade Views | `src/coordinators/trade-views/` | `ContractExpiration.days`; `replayTrade` with Journal items by session (A212, A213) |
| Trade Workflows | `src/coordinators/trade-workflows/` | `confirmPlan`'s post-commit `contractExpiration` (A209) |
| Workspace | `src/coordinators/workspace/` | Installed Capability Manifest: `replayTrade` |
| Facade | `src/app/compose.ts`, `src/app/types.ts` | `TradeViews.replayTrade`; `MarketData.query` `ReadSeries` |
| UI | `src/ui/cockpit/`, `src/ui/screens/trade-detail/` | the cockpit |
| Lint | `eslint.cockpit.config.js` merged into `eslint.config.js` | A216's rule |
| Tooling | `.claude/scripts/`, `eslint.config.js` ignores | the swarm tooling (T8P.1) |

Persistence, migrations, the Reference Catalog, Journal, Daily Review and the valuation module need no code change. Journal is queried as today, and the valuation module's dated-line path is called per session by `replay`.

**The user's intuition, step by step.** "No backend change" **holds** for wave 0 apart from T8P.3's type file. It holds for all ten UI tasks in wave 1, for the wiring (T8P.22) and for the structural tail. It is **denied** for six tasks:
- T8P.6: `nearest`, Trade Analysis, additive;
- T8P.7: the `replay` slice;
- T8P.8: `ReadSeries`;
- T8P.9: days to expiration, and the confirm result's expiration line;
- T8P.10: `replayTrade`;
- T8P.11: the facade and manifest.

None changes the schema or stored data.

---

## 3. History options, and D8 and D9

### 3.1 The options (P94)

| Option | What D08P ships | Cost and risk |
|---|---|---|
| **A. Slice of D9 inside D08P** (recommended) | All four history parts, as decided. | 4 backend tasks (T8P.7, T8P.8, T8P.10, T8P.11) plus T8P.3's shared types, one parallel lane, off the UI's critical path until wiring. D9 extends the same three operations, so nothing is thrown away. Spec risk is low, because `replayTrade` stays its own read (P95). |
| B. Marks only | Price History's Mark rows and the Journal cards' Marks; no Trade P&L per session; the rail's change shows only the Mark's change. | About 2 tasks fewer, but the P&L row, the P&L change and the cards' P&L wait for D9. The rail's change line changes meaning later, and three components are reworked. |
| C. UI only | No Price History, no change line, no comparison, and a flat Journal list. | No backend work, but four of the cockpit's parts are missing, and the Journal drawer is built twice. The user's design is only half met. |
| D. Split D9 before D8 | Same code as A, under D9's name. | D9 needs its own breakdown, drafted first after a full read of `specs/`, its own gate, and a second planning session. D08P's start slips by that work. D8 is unaffected technically. |
| E. All of D9 before D8 | A, plus the chart, markers, condition status per session and audit navigation, before D08P or D8. | The largest delay, about D9's full size before the cockpit. D8 needs no change (no schema change in D9), but it moves back on the calendar. |

### 3.2 The D8 and D9 order

**Recommended: D08P, then D8, with D9 later**, as the plan stands. D08P changes no schema, store, seed or fixture, so D8's agreed breakdown and its schema-7 note (decision 107) need no amendment. Since D9 no longer has to build the read model, it gets smaller, and it stays a safe pair with D8.

### 3.3 Wall-clock against serial

These are estimates. A behavioral task takes about 35 minutes in `tdd-task`, ocr about 5, and a complete cumulative run about 12 (unit, integration, the two browser stages and the checks). A lane tier (unit, integration and checks only) takes about 4.

| Plan | Estimate | Where the time goes |
|---|---|---|
| **Serial** (decision 100) | About 26 tasks × 52 minutes, plus 3 critics: **about 24 hours** | Every task waits for the one before it, and ends with its own browser run. |
| **Swarm** (section 4.2) | **About 9 to 10.5 hours** | **Wave 0:** about 3 h; T8P.1, then T8P.2, then T8P.3 ∥ T8P.4, then T8P.5. **Wave 1:** about 3 h; 16 tasks at up to 6 at once, with the backend chain T8P.8 ∥ T8P.6 → T8P.7 → T8P.10 → T8P.11 as its longest lane. Merge runs overlap the lanes' work. **Wave 2:** about 3.5 h; the wiring, the checkpoint critic, the two suites at once, then the gate. |

The gain, about 2.5 times, comes from two places. Wave 1's 16 tasks run in parallel. And the per-task browser run (about 8 minutes, 16 times) is replaced by one run per merge batch.

---

## 4. Task graph

Kind: **B** = behavioral (TDD, red then green per case), **S** = structural (exact verification). Lanes are named in section 4.2. Every row states its backend change.

### 4.1 Tasks

| Task | Title | Wave, lane | Kind | Blocked by | Public seam under test | Backend change |
|---|---|---|---|---|---|---|
| T8P.1 | Swarm tooling: per-task TDD logs, the browser lock, the lane setup and the lane tier | 0 | S | — | `tdd.sh`, `with-browser-lock.sh`, `lane-setup.sh`, `full-suite.sh lane` | none (tooling only) |
| T8P.2 | Split Trade Detail into one file per section, with its tests and styles | 0 | S | — | unchanged tests | none |
| T8P.3 | Freeze the cockpit's props and the replay view types; the cockpit import rule | 0 | S | T8P.2 | `typecheck`, `lint` | **types only:** a new `replay-view.ts` in Trade Views; `nearest?` on `ConditionStatus`; `days?` on `ContractExpiration`. No behavior. |
| T8P.4 | Drawer-reach helpers, and the earlier browser cases moved onto them | 0 | S | T8P.1 | full browser tier | none |
| T8P.5 | Cockpit shell: the rail, the drawer tabs and each state's drawers | 0 | B | T8P.2–T8P.4 | `TradeDetail` | none |
| T8P.6 | Trade Analysis: each role's nearest condition | 1, BA | B | T8P.3 | `TradeAnalysis.evaluate` | **Trade Analysis**: `nearest` (A207) |
| T8P.7 | Trade Analysis: `replay`, the D08P slice | 1, BA | B | T8P.3 | `TradeAnalysis.replay` | **Trade Analysis**: new operation (A211) |
| T8P.8 | Market Data: `ReadSeries` | 1, BM | B | T8P.3 | read session `series`; `MarketData.query` | **Market Data**: new query (A210) |
| T8P.9 | Expiration line: days to expiration, and the line on a just-confirmed Plan (tech debt item 23) | 1, BV | B | T8P.3 | `getTradeDetail`; `confirmPlan` | **Instrument** helper, **Trade Views** field, **Trade Workflows** post-commit result; `confirmed-detail.ts` |
| T8P.10 | Trade Views: `replayTrade` | 1, BV | B | T8P.7, T8P.8, T8P.9 | `TradeViews.replayTrade` | **Trade Views**: new read (A212, A213) |
| T8P.11 | Facade and Installed Capability Manifest | 1, BV | S | T8P.10 | `verify:capabilities` | **facade** and **manifest**: `replayTrade`, `ReadSeries` |
| T8P.12 | Rail: identity card | 1, R1 | B | T8P.5 | `IdentityCard`, `identity.props` | none |
| T8P.13 | Rail: P&L card | 1, R1 | B | T8P.12 (lane order) | `PnlCard`, `pnl.props` | none |
| T8P.14 | Rail: Conditions card | 1, R2 | B | T8P.5 | `ConditionsCard`, `conditions.props` | none (reads T8P.6's field; absent until it merges) |
| T8P.15 | Rail: Needs you | 1, R2 | B | T8P.14 (lane order) | `NeedsYou`, `needs-you.props` | none |
| T8P.16 | Today drawer | 1, D1 | B | T8P.5 | `TodayDrawer`, `today.props` | none |
| T8P.17 | Position drawer | 1, D2 | B | T8P.5 | `PositionDrawer`, `position.props` | none |
| T8P.18 | Plan and Risk drawer, and the footer | 1, D3 | B | T8P.5 | `PlanRiskDrawer`, `DetailFooter` | none |
| T8P.19 | Payoff drawer: one chart (tech debt item 21) | 1, D4 | B | T8P.5 | `PayoffDrawer` | none |
| T8P.20 | Price History drawer | 1, D5 | B | T8P.5 | `PriceHistory`, `price-history.props` | none |
| T8P.21 | Journal drawer: session cards | 1, D6 | B | T8P.5 | `JournalCards`, `journal-cards` | none |
| T8P.22 | Trade Detail reads `replayTrade` | 2 | B | T8P.10–T8P.21 | `TradeDetail` | none (consumes T8P.10, T8P.11) |
| T8P.23 | Checkpoint browser critic (P101) | 2 | S | T8P.22 | fresh critic report | none |
| T8P.24 | Node mock-free integration suite | 2 | S | T8P.6–T8P.11 | `test:integration` | none (tests only) |
| T8P.25 | Browser integration suite (Chromium) | 2 | S | T8P.22 | `test:e2e` | none (tests only) |
| T8P.26 | Independent browser-critic gate | 2 | S | all | fresh critic report | none |

**Run order.**
- **Wave 0:** T8P.1 alone and first, in the main worktree. The pre-commit hook runs `eslint .`, and until T8P.1's ignore lands, any worktree under `.claude/worktrees/` would be linted with every commit. Then T8P.2, then T8P.3 ∥ T8P.4, then T8P.5. (Corrected in revision 84 before commit; the draft had T8P.1 ∥ T8P.2.)
- **Wave 1:** every lane at once, up to 6 agents, each lane in its listed order.
  - Backend lanes start first, since they are the longest: BV starts T8P.9 at once and T8P.10 when T8P.7 and T8P.8 are merged.
  - The UI lanes fill the remaining slots in this order: R2, R1, D2, D1, D4, D3, D5, D6.
- **Wave 2:** T8P.22, the checkpoint critic T8P.23, then T8P.24 ∥ T8P.25, then T8P.26.

T8P.24 is a Node suite and may start as soon as T8P.11 merges. Every UI task takes its words from section 1.6.

### 4.2 Lanes and file ownership

A lane is one git worktree (`.claude/worktrees/d08p-<lane>`) on one branch (`d08p/<lane>`). Its tasks run one at a time, in order. Files are owned by exactly one lane per wave. A file not listed below is touched by no wave-1 task.

| Lane | Tasks | Owns |
|---|---|---|
| BA | T8P.6, T8P.7 | `src/domain/trade-analysis/` |
| BM | T8P.8 | `src/modules/market-data/` |
| BV | T8P.9, T8P.10, T8P.11 | `package.json`'s `test:e2e:2` (T8P.9); `e2e/d8p/planned.spec.ts`; `src/domain/instrument/`; `src/coordinators/trade-views/`, `trade-workflows/`, `workspace/`; `src/app/`; `src/ui/screens/confirmed-detail.ts`; `tests/integration/` support files it extends |
| R1 | T8P.12, T8P.13 | `src/ui/cockpit/rail/identity*`, `rail/pnl*`, `styles/rail-a.css`; `e2e/support/detail/rail-a.ts` |
| R2 | T8P.14, T8P.15 | `src/ui/cockpit/rail/conditions*`, `rail/needs-you*`, `styles/rail-b.css`; `e2e/support/detail/rail-b.ts` |
| D1 | T8P.16 | `src/ui/cockpit/drawers/today*`, `track*`, `styles/today.css`; `e2e/support/detail/today.ts` |
| D2 | T8P.17 | `drawers/position*`, `styles/position.css`; `e2e/support/detail/position.ts` |
| D3 | T8P.18 | `drawers/plan-risk*`, `footer*`, `styles/plan.css`; `e2e/support/detail/plan.ts` |
| D4 | T8P.19 | `drawers/payoff*`, `styles/payoff.css`; `src/ui/screens/payoff-text.ts`, `CardFigures.tsx:94` (W18); `e2e/support/detail/payoff.ts`, `e2e/d7/support.ts` payoff helpers |
| D5 | T8P.20 | `drawers/price-history*`, `styles/history.css` |
| D6 | T8P.21 | `drawers/journal*`, `journal-cards.ts`, `styles/journal.css`; `e2e/support/detail/journal.ts` |

T8P.5 creates every path above as the current section re-exported behind its future name, with its own test file and empty stylesheet. So a lane replaces the content behind a path, and never edits the shell, `src/ui/cockpit/index.css` or a shared helper index.

**Three old sections give figures to several lanes:**
- the Summary card, to the identity, P&L and Conditions cards, Plan and Risk, and Position;
- Valuation, to the P&L card, Position and Today;
- Risk and reward, to the Conditions card, Plan and Risk, and Today.

T8P.5 renders these three as legacy blocks beside the new components: the Summary card in the rail, and the other two in the Today drawer. No wave-1 task deletes them, so a figure never disappears between two lanes' merges. **T8P.22 retires all three** and their CSS, and moves any expectation still reading them to the figure's one place. Specs whose expected values change are listed per task in section 1.5. Where two lanes change the same spec file, they change different lines, which git merges. The main session resolves the rare overlap at merge.

---

## 5. Behavioral tasks

Every case runs **red → green** individually. A case that passes on its first run, or fails for a syntax, configuration, fixture or unrelated reason, is not valid red evidence. A genuine first-run pass needs a mutation check (an assertion failure or runtime exception, not a compile error) and is flagged. Cases are ordered so each needs behavior the earlier ones don't.

All dates are 2026, New York time.

- **O-S2** is D7S's Cash-Secured Put (D7S section 4), with its Tuesday to Thursday Marks.
- **O-C3** is new: a Long Call on XYZ, 18 Dec 2026 55 Call.
  - Plan: 2 contracts at 2.00, Stop "option at or below 1.00", Target "XYZ at or above 60.00".
  - Executions: Buy 2 @ 2.00 Mon 10-12 10:00, fee 1.30; Sell 1 @ 3.00 Wed 10-14 11:00, fee 0.65.
  - Marks:

| Session | XYZ | Call | Held | Realized | Trade P&L | Change |
|---|---|---|---|---|---|---|
| Mon 10-12 | 56.00 | 2.10 | 2 | $0.00 | $18.70 (420 − 400 − 1.30) | — (first Mark) |
| Tue 10-13 | — | — | 2 | $0.00 | Unavailable, Mark missing: XYZ, call | — |
| Wed 10-14 | 57.40 | 2.90 | 1 | $98.70 (100 − 0.65 − 0.65) | $188.05 (98.70 + 290 − 200.65) | +$169.35 since Mon Oct 12 |
| Thu 10-15 | 57.90 | 3.20 | 1 | $98.70 | $218.05 | +$30.00 since Wed Oct 14 |

The call's Mark changes are +$0.80 since Mon Oct 12 (Wed) and +$0.30 since Wed Oct 14 (Thu). Journal:
- O-C3's Plan Reflection, Mon 09:00;
- an entry reflection, Mon 10:05;
- a Daily Action Hold with Review Date Tue 10-13, saved Wed 08:00;
- an exit reflection deferred and owed, Wed 11:00;
- a Daily Action Hold for Thu 10-15, saved Thu 18:00.

Test support: `oc3Record` joins `src/domain/trade-analysis/option-trade.ts`; a cockpit fixture builder joins `tests/support/`.

### T8P.5 Cockpit shell

Seam: `TradeDetail` against the facade double. New file `src/ui/screens/trade-detail/Cockpit.test.tsx`. Words W1. Its structural part: every moved unit case gains only an `await openDrawer(…)` line (section 6.3).

```text
describe("Trade Detail cockpit (W1, A217)")
  it should show an Open Trade's rail with the identity, P&L, Conditions and Needs you cards beside a Detail tab list of Today, Position, Plan and Risk, Price History, Journal and Payoff in that order, with Today selected
  it should show only Plan and Risk, Journal and Payoff on a Planned Detail, with Plan and Risk selected
  it should leave out Today on a Closed or Settlement Due Detail, and select Position
  it should show the Facts can't be replayed region across the page above the rail on an incoherent Detail, with only Position, Plan and Risk and Journal
  it should move between the shown drawers with the arrow keys, Home and End, and keep focus on the selected tab
```

### T8P.6 Trade Analysis: each role's nearest condition

Seam: `TradeAnalysis.evaluate` (`evaluate.test.ts`), A207, O-S2.

```text
describe("evaluate: the nearest condition (A207)")
  it should mark O-S2's option-price Stop and its MNO Target as nearest on Tuesday, and no other condition
  it should mark no Stop as nearest on Wednesday, when the option-price Stop is Breached and the headline is zero
  it should mark no condition of a role as nearest when its headline is Unavailable
  it should mark the earlier in Plan order when two conditions of a role are equally near
```

### T8P.7 Trade Analysis: `replay`, the D08P slice

Seam: `TradeAnalysis.replay` (new `replay-series.test.ts`), A211, O-C3.

```text
describe("replay: per-session results (A211)")
  it should give O-C3's Monday session a Trade P&L of $18.70 with 2 contracts held and no change, as its first session with a figure
  it should give Tuesday Unavailable Mark missing naming the call, with no change and no value carried from Monday
  it should give Wednesday a Trade P&L of $188.05 from realized $98.70 and the remaining contract, +$169.35 since Monday, with the sale's Position Change id
  it should give each Mark its change since that Instrument's previous Mark, the call +$0.80 since Monday on Wednesday
  it should give a Long Stock Trade one Mark per session and its Trade P&L (D6's T-A)
  it should return Not applicable for a Trade never exposed
```

### T8P.8 Market Data: `ReadSeries`

Seam: the read session's `series` and `MarketData.query` (`market-data.test.ts`), A210.

```text
describe("ReadSeries (A210, AC-MARK-004)")
  it should return each completed session from the earliest exposure to the end date with the Available Mark, a Missing gap or an Acknowledged gap
  it should end at the last completed session, return nothing after the end date, and never carry a value forward
  it should give a corrected Mark's effective revision only
  it should read an Instrument's stored Marks once per read session, sharing the gaps scan with the Detail's frames
```

### T8P.9 Expiration line: days, and a just-confirmed Plan

Seams: `getTradeDetail`, `confirmPlan`, and `confirmedDetail`. A208, A209. Tech debt item 23's browser case (B8P.3) is written first and must fail. It is the first D08P spec (`e2e/d8p/planned.spec.ts`), so this task also adds `e2e/d8p` to `test:e2e:2`.

```text
describe("expiration line: days (A208)")
  it should give an Open O-S2's line "Expires" 2026-12-18 with 66 days on Tue 10-13
  it should give 0 days on the expiration date, before the contract is Settlement Due
  it should give no days on an Expired line
describe("just-confirmed Plan: expiration line (A209, tech debt item 23)")
  it should carry the expiration line in confirmPlan's post-commit result, equal to the Planned Detail read afterwards
  it should show "Expires" on the handed-over Planned Detail without a read
```

### T8P.10 Trade Views: `replayTrade`

Seam: `TradeViews.replayTrade` (`replay-trade.test.ts`), A212, A213, O-C3 at Thu 10-15 17:00.

```text
describe("replayTrade (A212, A213)")
  it should replay O-C3 from Monday to the Expected Mark Date Thursday with section 5's figures, both Instruments' Marks and the Tuesday gap
  it should place each Journal item in its session: the Tuesday Action by its Review Date, the exit reflection in Wednesday's, the Plan Reflection in the Plan list
  it should place an entry saved after Thursday's Mark in the session not yet ended
  it should end a Closed Trade at its final session
  it should return Not applicable for a Planned Trade and for facts that can't be replayed
  it should return ChangedDuringAssembly when a Mark is saved after the Detail's binding
```

### T8P.12 Rail: identity card

Seam: `IdentityCard` with plain props, and `identity.props` from each view form. W2.

```text
describe("identity card (W2)")
  it should show the symbol once as the page heading, "Long Call, Open", "Strike 150", "Expires Fri 18 Dec 2026 (36 days)" and the account
  it should show "(1 day)" and "(today)", "Expired Fri 20 Nov 2026" on a Closed option Trade, and no strike or expiration line on stock
  it should show the expiration line on a Planned option Trade
  it should offer Record entry and Record exit only while Writable, and neither on an incoherent Detail
```

### T8P.13 Rail: P&L card

Seam: `PnlCard` and `pnl.props`. W3, W4, A221, A222.

```text
describe("P&L card (W3, W4)")
  it should show O-C3's Trade P&L $188.05 with "+$169.35 since Mon Oct 12" and "1 of 2 contracts open"
  it should show the reason at the figure length and no change line when the current Trade P&L is unavailable
  it should show "—" and "Trade P&L once today's session ends" before any Marks, and the Planned words on a Planned Detail
  it should show a Closed Trade's realized P&L, its R, and the Result rows
  it should name the contract on a Settlement Due Detail, and show "Not available" on an incoherent one
```

### T8P.14 Rail: Conditions card

Seam: `ConditionsCard` and `conditions.props`. W5, W6, A206, A207, O-S2.

```text
describe("Conditions card (W5, W6)")
  it should list O-S2's four conditions in Plan order with the role, and the full condition on one line that does not wrap
  it should show Tuesday's option-price Stop as "−$360.00" with "nearest" and "Change in Trade P&L from the Tue Oct 13 Marks if the option's Mark is $3.60 (−0.75R)."
  it should explain an Underlying condition as "… if MNO is at 41.00 at expiration (−0.92R)."
  it should show Wednesday's option-price Stop as "Breached" with "The Wed Oct 14 Mark is $20.00 (0.04R) of Trade P&L past this Stop."
  it should show an Unavailable condition's reason at the label length on row 1
  it should show only rows 1 and 2 before any Marks and on a Closed Detail
  it should show Worst case and Max reward beneath the conditions
```

### T8P.15 Rail: Needs you

Seam: `NeedsYou` and `needs-you.props`. W7, A217, A224.

```text
describe("Needs you (W7)")
  it should say "Nothing needs you now." when nothing is owed, due or crossed
  it should list each Outstanding Debt with its owed heading and due text, and Reflect now opening its form on its Journal card
  it should alert "Stop breached: the option's Mark is $3.70, at or above $3.60" on O-S2's Wednesday
  it should say "First Marks are due once today's session ends." before any Marks
  it should link a Mark missing at the Expected Mark Date to the Review
  it should hold the Settlement Due panel, with Record expiration only while Writable
```

### T8P.16 Today drawer

Seam: `TodayDrawer` and `today.props`. W8, W19, A215, A223.

```text
describe("Today drawer (W8)")
  it should show "Marks: Thu Oct 15 against Wed Oct 14" with each Mark, its change and its provenance, Corrected with its reason
  it should compare with the latest earlier session with Marks, and name the session that had none
  it should place each price track's Stop and Target zones, entry, the earlier Mark and now, with an accessible name listing the prices
  it should list each Underlying condition's value at expiration and distance on the Underlying under its track
  it should show "At the Mon Oct 12 Marks" and At entry in their existing figures
  it should show "No Marks yet." before any Marks
```

### T8P.17 Position drawer

Seam: `PositionDrawer` and `position.props`. W15, W17, P96.

```text
describe("Position drawer (P96)")
  it should show the open lots, then Open P&L including the open lot's opening fee, Realized to date and Incurred fees, O-C3's Wednesday $89.35 and $98.70
  it should show the Trade Summary and Last activity
  it should list Lot Matches with the rounding note, fold the fee reconciliation, and list the Executions and the Settlement section
  it should show "Settlement Due" as the Open P&L on a Settlement Due Detail
```

### T8P.18 Plan and Risk drawer, and the footer

Seam: `PlanRiskDrawer` and `DetailFooter`. W16, P96.

```text
describe("Plan and Risk drawer and footer (P96)")
  it should show the Plan, the Plan Baseline with 1R and the original reward once, and Entry Quality, with no Summary duplicate on the page
  it should show the entry as not entered on a Planned Detail
  it should show Planned-Leg Fulfillment and Deviations below the drawers
```

### T8P.19 Payoff drawer: one chart

Seam: `PayoffDrawer`. W14, W18. Tech debt item 21: the sentence comes from `valueAtCloseText`.

```text
describe("Payoff drawer (W14)")
  it should draw one chart with the planned line dashed and the current line solid, each with its text-equivalent table
  it should draw only the planned line with "Now: Not applicable: no open position" on a Closed Detail
  it should state the value at expiration at the latest Mark through valueAtCloseText, as "Value at expiration at MNO's latest Mark" on Detail and the Review card
  it should show one Not applicable line for a stock Trade
```

### T8P.20 Price History drawer

Seam: `PriceHistory` and `price-history.props` against a `TradeReplayView` double. W9, P99.

```text
describe("Price History (W9, P99)")
  it should show sessions as columns, newest on the left, with rows for each Instrument's Mark and Trade P&L
  it should show a gap as "—" named "No Mark", count sessions without Marks on the tab, and link to the Review
  it should say "No sessions yet" before the first session ends
  it should render a 500-session history in one table
```

### T8P.21 Journal drawer: session cards

Seam: `JournalCards` and `journal-cards` against a `TradeReplayView` double. W10 to W13, A214.

```text
describe("Journal session cards (W10–W13, A214)")
  it should show one card per session, newest first, with its Trade P&L, change, Marks and items
  it should merge back-to-back sessions without Marks into one card
  it should keep an owed reflection's Reflect now and Decline on its card, one form at a time
  it should page by about one screen with ‹ and ›, and disable each at its end
  it should show the Plan card and the card of the session not yet ended
  it should show one list of every entry on an incoherent Detail
```

### T8P.22 Trade Detail reads `replayTrade`

Seam: `TradeDetail` against the facade double. P95, W20.

```text
describe("Trade Detail: the replay read (P95)")
  it should read replayTrade with the Detail's binding and fill the change line, the Today comparison, Price History and the Journal cards from it
  it should read both again when replayTrade answers ChangedDuringAssembly
  it should not read replayTrade for a Planned or incoherent Detail
  it should show the rest of the cockpit while the replay is pending
  it should show a saved reflection on its card without reading again
  it should show no Summary card, Valuation section or Risk and reward section, with each of their figures in its one place
```

The last case retires the three legacy blocks (section 4.2).

---

## 6. Structural tasks

| Task | Exact verification | Expected result | Notes |
|---|---|---|---|
| T8P.1 Swarm tooling | `tdd.sh` run twice for two task IDs; two concurrent `with-browser-lock.sh true` calls; `lane-setup.sh` on a scratch worktree; `full-suite.sh <dir> <label> lane`; `npm run lint` with a scratch worktree under `.claude/worktrees/` | Rows land in `evidence/D08P/tdd-log/<task>.md`; the second lock waits for the first; the worktree has `node_modules` (an APFS clone, `cp -c`) and the hooks path set; the lane tier writes unit, integration and checks files; `lint` ignores the nested worktree. | Section 9. No product code. It also applies section 9's text to `implementing.md`, `tdd-task.md` and `suite-runner.md` (decision 111). `tdd.sh` already maps `T8P.3` to `evidence/D08P`, and `full-suite.sh` maps `evidence/D08P` to `e2e/d8p`. The per-task logs stay in that folder. |
| T8P.2 Split | `npm run typecheck`, `npm run lint`, `npm run lint:deps`; `npx vitest run src`; `.claude/scripts/it-titles.sh` before and after; full browser tier | The multiset of `it` titles is unchanged (77 plus 21, in per-section files); every unit and browser test passes unchanged; `app.css` loses only section 1.5's Detail-only selectors. `EXIT_ACTION` and `INCOHERENT_ENTRY_NOTE` move to `trade-detail/words.ts`. The task adds `it-titles.sh`, which lists every `it` title under `src/` sorted. |
| T8P.3 Types and rule | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint` with and without a planted import | Types compile; the planted import fails `lint`; without it, `lint` exits 0. | `TradeReplayView`, `ReplaySession`, the props of section 4.2's components; `nearest?`, `days?`. |
| T8P.4 Drawer reach | Full browser tier; `rg -c "openDrawer\|detail\." e2e` | Every case passes before the shell exists (`openDrawer` returns at once when there is no tab list), and every Detail read in section 1.5's reach table goes through `e2e/support/detail/*.ts`. | D5R's decision 65 rule: mechanical only, no expectation changes. |
| T8P.11 Manifest | `npm run verify:capabilities` | The manifest lists `replayTrade` and equals the reachable operations. | |
| T8P.23 Checkpoint critic | Fresh critic per section 8, flows C8P.1 to C8P.4 | A structured report. Defects become bug tasks before the tail. | P101. |
| T8P.24 Node integration suite | `npm run test:integration`, then `.claude/scripts/acceptance-commands.sh plan/D08P-trade-detail-cockpit.md` | Every section 6.1 case of D1 to D08P passes; the script exits 0 for the Node rows. | |
| T8P.25 Browser integration suite | `npm run test:e2e`; the acceptance script | Every section 6.2 case of D1 to D08P passes; the script exits 0 for every row. | No existing filter matches `e2e/d8p`. T8P.9 adds it to `test:e2e:2` with the first D08P spec (B8P.3), so every merge run after T8P.9 includes D08P's specs. |
| T8P.26 Browser critic | Fresh critic per section 8 | Every flow passes. | Deliverable gate. |

### 6.3 Moving the earlier cases (the D5R rule)

- **Browser.** T8P.4 adds `e2e/support/detail/index.ts` with `openDrawer(page, name)`, plus one file per lane (section 4.2). Each file reads its content through the current layout, and each wave-1 lane rewrites only its own file's helpers. A helper scopes every read to its card or drawer, so the page-wide and order-dependent reads in section 1.5 become scoped ones. An expected value changes only where section 1.5's texts table says so, in the task named.
- **Unit.** T8P.5 adds `openDrawer(user, name)` to `src/ui/screens/trade-detail/test-support.ts`. Each moved case gains only that line. A script shows that each changed file's diff adds only those lines.

---

## 7. Mock-free integration tests

### 7.0 Disclosed test substitutes

D1 to D7S's substitutes still apply. D08P adds none.

### 7.1 Node application-stack suite (`tests/integration/d8p/`)

| Case | File | Given / When | Then |
|---|---|---|---|
| I8P.1 Replay with a gap (AC-MARK-004, partial) | `replay.test.ts` | O-C3 with section 5's Marks; clock Thu 10-15 17:00; `getTradeDetail`, then `replayTrade` with its binding; restart; again. | Four sessions with section 5's figures, the Tuesday gap explicit for both Instruments, nothing carried forward; equal after restart. |
| I8P.2 Journal by session | `replay.test.ts` | Same, with section 5's Journal. | Each item's session follows A213. The owed exit reflection is in Wednesday's, and the Plan Reflection is in the Plan list. |
| I8P.3 Coherence | `replay.test.ts` | `getTradeDetail`; save a Thursday correction through the Review; `replayTrade` with the old binding; then read both again. | `ChangedDuringAssembly`, then a pair whose newest session equals the Detail's current figures. |
| I8P.4 Query count (AC-PERF-001, cumulative) | `replay-query-count.test.ts` | O-C3 and O-S2 open; record the store requests of `getTradeDetail`, then of `replayTrade`. | The Detail's requests are unchanged from D7S. The replay reads each Instrument's observations once. |
| I8P.5 Nearest and days | `detail.test.ts` | O-S2 at Tue 10-13 17:00; `getTradeDetail`. | `nearest` on `stop-2` and `target-1` only; `contractExpiration` "Expires" 2026-12-18, 66 days. |
| I8P.6 Confirmed Plan (AC-RESP-001, re-proven) | `detail.test.ts` | Confirm O-C3's Plan; `getTradeDetail`. | The post-commit `contractExpiration` equals the read's. |
| I8P.7 Closed, Planned and incoherent replay | `replay.test.ts` | O-C3 sold out Fri 10-16; a Planned Trade; D2's incoherent fixture. | Ends Fri 10-16; `NotApplicable(NeverExposed)`; `NotApplicable(FactsIncoherent)`. |

### 7.2 Browser suite (`e2e/d8p/`, Playwright against the built app on `localhost:5175`)

| Case | File | Procedure | Expected |
|---|---|---|---|
| B8P.1 The cockpit | `cockpit.spec.ts` | O-C3 created through the UI with section 5's Marks; clock Thu 10-15 18:00; open Detail. | The rail shows W2, W3, W5 and W7. The tabs follow W1's order; arrow keys move between them; each drawer holds its content once. |
| B8P.2 Price History and Journal | `history.spec.ts` | Same Trade; open Price History, then Journal; page with › and ‹; Reflect now on Wednesday's card; reload. | Newest on the left, Tuesday "—", the Review link. Cards newest first, Tuesday's card without Marks, the reflection answered and still shown after reload. |
| B8P.3 Expires right after confirm (tech debt item 23) | `planned.spec.ts` | Confirm an option Plan; read the Detail; reload. | "Expires Fri 18 Dec 2026 (… days)" before and after the reload. Written first, red against the pre-fix build. |
| B8P.4 States | `states.spec.ts` | D7's Settlement Due fixture, a Closed Trade by sale, D7's expired put, D2's incoherent fixture, a stock Trade, a Trade with two open lots. | Each state shows the drawers A217 names and W4's P&L card. |
| B8P.5 Responsive and accessible (AC-UI-001, AC-UI-002) | `responsive-a11y.spec.ts` | Every drawer at 1280, 375 and 320 px; axe on the rail and each drawer; the cockpit by keyboard. | No sideways scroll; a condition row 2 never wraps; no WCAG 2.1 AA violations. |

---

## 8. Browser-critic flows

The critic receives:
- the frozen `specs/` and the plan index;
- the D1 to D7S breakdowns and this one;
- the prototype's C. Cockpit tab;
- the list of future capabilities that must not be treated as defects: D9's chart, markers and condition status per session, the Review's Price History grid, the trimmed Journal, Today's Action in Needs you, and the sharing phase.

It runs `npm run build && npm run preview` (port 5175, under the lock) itself, and does not edit code. The checkpoint (T8P.23) runs C8P.1 to C8P.4; the gate (T8P.26) runs all six.

| Flow | Actions | Pass condition |
|---|---|---|
| C8P.1 State of play | Open an Open option Trade with Marks. | The rail answers "what do I hold, how is it doing, what's near, what needs me" without opening a drawer. |
| C8P.2 Drawers | Open each drawer by mouse and keyboard. | The order is W1's. Each figure appears once, apart from the two accepted exceptions. |
| C8P.3 History | Open Price History and Journal on a Trade with a gap. | Gaps are gaps; newest on the left and first; cards page by about a screen. |
| C8P.4 States | Planned, Settlement Due, Closed by sale, Closed by expiration, incoherent, stock, several lots. | Each matches the prototype's state, and the Planned Trade shows Expires right after confirm. |
| C8P.5 Narrow | Each state at 375 and 320 px. | The rail becomes the top of the page; no sideways scroll; conditions don't wrap. |
| C8P.6 Offline and About | Stop the server and reload; open About. | The Detail works offline; About lists D1 to D08P capabilities. |

---

## 9. Process amendments for the swarm (decision 111)

Agreed as **decision 111** (revision 84). It applies only to deliverables whose breakdown has a lane column. Decision 100's amendment note is in the plan. **T8P.1 applies the rest** to the files named, together with the tooling they describe, so each file's text is true when it lands. Until T8P.1 merges, wave 0 runs as the D08P implementing handoff says. Each paragraph names the protection it keeps.

**Decision 100, amended.** Insert after "The next task is the first row not marked 'Done'":
> In a swarm deliverable, the Progress table also has Wave and Lane columns. Tasks run wave by wave. Within a wave, every lane runs at once, up to the breakdown's agent cap, and each lane runs its own rows one at a time in order. A task starts when every task it is blocked by is merged into the deliverable branch. The next task of a lane is its first row not marked "Done". Only the main session edits the table.

*Keeps:* the Progress section as the one source of status, and the plan's blocking edges.

**`implementing.md`, new section "Running a swarm deliverable".**
> - Dispatch each lane task to a fresh `tdd-task` with `isolation: "worktree"`, on a lane worktree `.claude/worktrees/<dnn>-<lane>` and branch `<dnn>/<lane>`, set up by `.claude/scripts/lane-setup.sh`. These worktrees belong to this implementation. Never open any other worktree.
> - The brief adds the lane, its owned files (the breakdown's section 4.2), and the lane's base commit.
> - Review each lane commit with `ocr-review` as today. ocr bug tasks run in the same lane.
> - A lane task is mergeable when its ocr is clean and its lane tier (unit, integration and checks, run in the lane worktree) passed. Rebase the lane branch onto the deliverable branch and fast-forward it there. If the rebase changed any file the task didn't own, rerun the lane tier first.
> - **Merge runs:** when no merge is pending and at least one task has merged since the last run, send the complete cumulative run to `suite-runner` on the deliverable branch with `browser-auto <last run's commit>`. A failure is pinned to a merged task by a targeted run, and fixed in that task's lane.
> - Run the full tier before every critic, unchanged.
> - Merges, merge runs and critics are serial on the main session. Lanes keep working meanwhile.

*Keeps:* ocr per commit; a complete cumulative run covering every commit before the next wave and before every critic; fresh subagents for all development.

**`tdd-task.md`, Boundaries and Working rules.**
- Replace "Work in this repository's root on its current branch" with: "Work in the root `git rev-parse --show-toplevel` gives you, on its current branch. In a swarm this is your lane worktree and lane branch. Edit only the files your brief's lane owns."
- Replace the browser bullet "one browser run at a time, since every server uses port 5175" with: "Run every browser command through `.claude/scripts/with-browser-lock.sh`, which serializes all users of port 5175. In a lane, run only the spec files your task changes."
- Change the Checks step to: "In a swarm, also run `.claude/scripts/full-suite.sh <evidence-dir> <task> lane` and report its result."
- Change `tdd.sh`'s note to: "It writes to `evidence/<Dnn>/tdd-log/<task>.md`."

*Keeps:* red then green per case, the first-run mutation check, the Edit-only rule, and the clean-tree check.

**`suite-runner.md`.** Add the input `lane <worktree>`, which runs the unit, integration and checks stages in that worktree, with no browser. Steps 1 and 4's port checks run inside the lock. *Keeps:* one runner per run, completeness checking, and no suite output in the main session.

**`tdd.sh` and `full-suite.sh`.**
- `tdd.sh` writes one log file per task, so lanes never edit one file.
- `full-suite.sh` gains a `lane` tier, and wraps its browser stages in the lock.
- `run-complete.sh` accepts the lane tier (unit, integration, checks).

*Keeps:* the evidence trail per case and per run.

**The user's full-run rule** (memory "record-full-suite-runs"), amended:
> In a swarm deliverable, a lane task ends with its lane tier recorded in `evidence/<Dnn>/suite-runs/`. The complete cumulative run (with the browser tier `browser-auto` picks) runs once per merge batch on the deliverable branch, and every critic is still preceded by a full-tier run.

*Keeps:* no commit reaches a critic, or the next wave, without a complete run recorded.

**`eslint.config.js`.** Ignore `.claude/worktrees/**`, so lint in the main worktree does not lint the lanes' copies.

---

## 10. Afterwards: sharing, and the follow-ons (outline only)

### 10.1 The sharing phase

Planned only after D08P's gate, with **the user's visual sign-off for each screen it touches** (handoff section 5.5).

- **Candidate components:**
  - the price track;
  - the Conditions card's block;
  - the P&L figure with its change;
  - Price History's grid;
  - the session card;
  - the drawer tab list.
- **Candidate screens:**
  - the Review card, which shows conditions, the dated line and Marks;
  - the Open list row, for the conditions badge;
  - the exit and expiration receipts, for the Position figures.

It gets its own breakdown and gate. The Review's tests are the largest in the UI (`ReviewCard.test.tsx`, 1,662 lines). Re-styling the Review is a design decision, so its prototype comes first.

### 10.2 Review Price History grid for entering Marks

A Price History-style grid on the daily Review page, for entering several sessions' Marks at once. It reads through D08P's `ReadSeries`, and saves through the Review's existing Mark saving (`DailyReview.save`, `SaveReviewMarks`) with its validation, corrections and acknowledgments.
- **Backend change:** probably none. The Review already asks for earlier sessions' missing Marks (D4 A56, D5R P37). To be confirmed when it is drafted: whether one save may carry several sessions' Marks for one Instrument.

### 10.3 Other follow-ons

- **A trimmed Journal**: only the sessions whose Daily Action was not Hold, or that hold a reflection. A214 says how merged cards behave. Whether "matters" is a Trade Views field or a UI filter over entry types is decided when it is drafted.
- **"Today's Action is not recorded"** in Needs you (P100), with Daily Review's eligibility rule.
- **The remaining "close" wording**: "Awaiting close", if the user wants it changed.
- **D9:** condition status per session, markers, the chart and its text equivalent, and audit navigation, on D08P's three operations.

---

## 11. Tech debt triggers

- **Item 21** (the payoff sentence built twice): triggered by T8P.19, which changes the payoff wording, and fixed there (`PayoffDrawer` and the Review card both use `valueAtCloseText`).
- **Item 23** (a Planned option Trade's missing Expires line): triggered by this refactor, and fixed by T8P.9 with B8P.3 first.
- **Item 22** (the D7S prefactor's slowdowns): not triggered, since D08P runs no benchmark (A219).
- **Item 3** (the Review open grows with history): not touched. `ReadSeries` shares the read session's gaps scan instead of adding a second history scan.
- **The other items:** none names Trade Detail's files or the paths above.

---

## 12. Open questions (resolved 2026-11-12)

All resolved as recommended when the user approved the plan (decision 110):

1. P94 and P95: option A, with `replayTrade` as a separate read.
2. P96 and W17: moved content keeps its words, including "Realized to date" and "Incurred fees".
3. P98: one port, 5175, behind the lock; no second port.
4. P99: Price History unpaged, including the latest session.
5. A223: the per-condition value at expiration and the distance on the Underlying move to the Today drawer.

The words W1 to W20 are approved (W1 with "Plan and Risk"), and P101 keeps one breakdown.

---

## 13. Acceptance matrix rows

Status values: `planned`, `covered`, `intentionally not advertised`.

| Scenario | Deliverable | Tasks | Integration / browser | Critic | Command or procedure | Expected | Status |
|---|---|---|---|---|---|---|---|
| AC-MARK-004 (partial: series and replay keep explicit gaps; the grid shows them) | D08P | T8P.7, T8P.8, T8P.10, T8P.20 | I8P.1; B8P.2 | C8P.3 | `npm run test:integration -- d8p/replay` | Gaps explicit, no interpolation or carry-forward | planned (the chart in D9, candles in D11) |
| AC-RESP-001 (re-proven: a just-confirmed option Plan's expiration line) | D08P | T8P.9 | I8P.6; B8P.3 | C8P.4 | `npm run test:integration -- d8p/detail` | The result equals the later read | planned |
| AC-PERF-001 (cumulative: no replay on the ordinary path; one series read per Instrument) | D08P | T8P.10 | I8P.4 | — | `npm run test:integration -- d8p/replay-query-count` | Detail requests unchanged; one read per Instrument | planned |
| AC-CAP-001 (cumulative) | D08P | T8P.11 | — | C8P.6 | `npm run verify:capabilities` | The manifest equals the reachable operations | planned |
| AC-UI-001, AC-UI-002 (cumulative) | D08P | T8P.5, T8P.12–T8P.22 | B8P.5 | C8P.5 | `npx playwright test e2e/d8p/responsive-a11y.spec.ts` | No sideways scroll; axe clean | planned |
| AC-CALC-003 (glossary: every condition remains visible; re-proven on the cockpit) | D08P | T8P.14 | B8P.1 | C8P.1 | `npx playwright test e2e/d8p/cockpit.spec.ts` | Every condition listed with its status | planned |

---

## 14. Evidence recording

As in earlier deliverables, under `evidence/D08P/`:
- `tdd-log/<task>.md` (red and green per case, one file per task);
- `structural.md`, `provenance.md`;
- `critic-<n>.md` (the checkpoint and the gate);
- `suite-runs/` (lane tiers and merge runs);
- `ocr/`.

Each critic defect is first reproduced by a failing test.

---

## 15. Progress

Status, not plan: editing this section is not a plan revision (decision 100, amended by decision 111). The main session alone edits it.

| Task | Wave | Lane | Status | Commits |
|---|---|---|---|---|
| T8P.1 | 0 | — | Done | `cac803c2`; B1 `f003e616`; B1-R1 `fd732662`; B2 `2e7ab770`; B9 `b5f8cc46`; B12 `7da860a1`; B16 `a87e8aed`; B19 `c6b51bc3`; B3 `d8a39865`; B20 `7775984a`; B4 `e68ab797` |
| T8P.2 | 0 | — | In progress from `f2ab6560` | |
| T8P.3 | 0 | — | Not started | |
| T8P.4 | 0 | — | Not started | |
| T8P.5 | 0 | — | Not started | |
| T8P.6 | 1 | BA | Not started | |
| T8P.7 | 1 | BA | Not started | |
| T8P.8 | 1 | BM | Not started | |
| T8P.9 | 1 | BV | Not started | |
| T8P.10 | 1 | BV | Not started | |
| T8P.11 | 1 | BV | Not started | |
| T8P.14 | 1 | R2 | Not started | |
| T8P.15 | 1 | R2 | Not started | |
| T8P.12 | 1 | R1 | Not started | |
| T8P.13 | 1 | R1 | Not started | |
| T8P.17 | 1 | D2 | Not started | |
| T8P.16 | 1 | D1 | Not started | |
| T8P.19 | 1 | D4 | Not started | |
| T8P.18 | 1 | D3 | Not started | |
| T8P.20 | 1 | D5 | Not started | |
| T8P.21 | 1 | D6 | Not started | |
| T8P.22 | 2 | — | Not started | |
| T8P.23 | 2 | — | Not started | |
| T8P.24 | 2 | — | Not started | |
| T8P.25 | 2 | — | Not started | |
| T8P.26 | 2 | — | Not started | |

---

## Appendix: lookup output

From the read-only text lookup run during drafting (an Explore agent, grep only, no edits). Line numbers are on `claude-opus-5.5-pre-d8p`. "Setup-only" means a spec reaches Detail only through a helper that waits for the h1 or clicks a Record link. FROZEN reads are of the frozen release builds, which this does not change.

**Browser spec files reaching Detail**, by folder, with their Detail reads:
- **d1:**
  - plan: :20 to :25 and :52–53;
  - recovery-only: :24–25;
  - responsive-a11y: :86–88, :177–179;
  - h1 only: offline, readiness.
- **d2:**
  - after-save: :5–11;
  - durability: :43–45;
  - integrity: :44–50, :82–84, :110–119;
  - offline: :34–45;
  - open-position: :39–113;
  - narrow: :80–96, :170–171;
  - runtime-failure: :38–74;
  - responsive-a11y: :116–124, :211–215, :246–247;
  - ui-alignment: :212–290, :356–411, :828–837, :877–882, :986–1066, :1100–1226, :1293–1371, :1547–1577, :1678–1683, :1736–1807, :1848–1886;
  - setup-only: no-save;
  - FROZEN: migration.
- **d4:**
  - breach-overrun: :5–56;
  - expected-mark: :15–50;
  - correct-mark: :22–25;
  - responsive-a11y: :171–225;
  - runtime-failure: :56–59;
  - setup-only: acknowledge, gaps, hold, kill, no-save, offline, review.
- **d5:**
  - detail-debt: :13–27;
  - faults: :45–50;
  - kill-offline: :57–85;
  - responsive: :12–14, :44–108;
  - review-debt: :21, :98–101;
  - setup-only: due-timing, no-save;
  - FROZEN: update.
- **d5r:** all setup-only.
- **d6:**
  - exit: :16–71;
  - exit-requirements: :19–93;
  - kill: :9–48;
  - offline: :23–54;
  - responsive-a11y: :28–329;
  - runtime-failure: :11–96;
  - update: :36–42;
  - setup-only: close-review, exit-action, no-save.
- **d7:**
  - settlement-due: :10–68;
  - short-put: :20–56;
  - plan-open: :7–80;
  - confirm-option-plan: :15–16;
  - payoff-chart-layout: :37–82;
  - responsive-a11y: :17–157;
  - runtime-failure: :11–63;
  - kill: :15–36;
  - offline: :23–35;
  - no-save: :77–78;
  - setup-only: marks-zero, review-expiration.
- **d7p:** layout: :52–64, :85–111.
- **d7s:**
  - conditions: :48–57;
  - plan: :14–26;
  - entry-beyond-stop: :18–21;
  - responsive-a11y: :53–60, :111.
- **d7sp:** setup-only.

**Helpers**, with the number of spec files that call each one:
- `e2e/d1/support.ts`: `confirmPlan` (4).
- `e2e/d2/support.ts`:
  - `confirmReference` (16);
  - `openEntryForm` (6);
  - `recordEntry` (15);
  - `backToTrade` (8);
  - `openTradeFromOpenList` (21).
- `e2e/d4/support.ts`:
  - `setClock`;
  - `currentTradeId` (6);
  - `createTrades` (15);
  - `createTradeAt` (4).
- `e2e/d5/support.ts`:
  - `startEntry`;
  - `deferEntry` (8);
  - `debtForm`;
  - `fillDebtAnswers`;
  - `expectSavedReflection`;
  - `answerDebt` and `declineDebt`.
- `e2e/d6/support.ts`:
  - `createTA`;
  - `openExitForm` (12);
  - `valueOf` (page-wide, 19).
- `e2e/d7/support.ts`:
  - `confirmOptionPlan`;
  - `createSettlementFixture`;
  - `expectPayoffChart` (7 calls);
  - `expectPayoffNotApplicable` (4);
  - `createShortPutTrade`;
  - `recordOptionEntry`;
  - `fillOptionExit`.
- `e2e/d7s/support.ts`: `confirmBothKinds`, `createOs2Trade`.
- `e2e/d7p/support.ts`: `expectShownInFull` (8), `setWidth`, `expectNoSidewaysScroll`.

**Unit tests**, by describe block, with each block's case count:
- `TradeDetail.test.tsx` (77 cases):
  - Trade Detail (3);
  - Open Trade Detail (10);
  - incoherent (2);
  - badge meanings (2);
  - back to the list (2);
  - summary card (6);
  - Executions (9);
  - Journal entries (5);
  - R lines (3);
  - fulfillment row (1);
  - journal prose (2);
  - deviations (3);
  - valuation (3);
  - risk and reward (2);
  - missing or later evidence (6);
  - Actions (1);
  - Debt on Trade Detail (10);
  - Closed (1);
  - Closed option (1);
  - Closed owed Debts (1);
  - after a reload (1);
  - just confirmed (1);
  - after a partial exit (2).
- `TradeDetailOptions.test.tsx` (21 cases), across these blocks:
  - option Trade Detail;
  - Underlying Mark;
  - payoff sections;
  - value at expiration without a number;
  - Long Stock payoff;
  - Settlement Due panel (2);
  - expiration line;
  - closed option (2);
  - incoherent;
  - Lot Matches;
  - Deviations and Fulfillment (2);
  - At entry;
  - conditions;
  - triggers;
  - every condition (3);
  - Net cost.
- **Other files:**
  - `PlanForm.test.tsx:973` renders `TradeDetail` for the receipt route. Its expectations are unchanged.
  - `AppShell.test.tsx` uses a stub.

**String counts**, as e2e / tests / src tests:

| String | e2e | tests | src tests |
|---|---|---|---|
| Valuation | 22 | 9 | 31 |
| Risk and reward | 4 | 0 | 6 |
| Plan Baseline | 5 | 2 | 8 |
| Open Lots | 12 | 0 | 7 |
| Lot Matches | 27 | 4 | 36 |
| Fee reconciliation | 1 | 0 | 1 |
| Entry Quality | 19 | 13 | 40 |
| Planned-Leg Fulfillment | 2 | 0 | 9 |
| Current Marked Trade P&L | 8 | 0 | 32 |
| Realized to date | 6 | 0 | 10 |
| Open P&L | 7 | 0 | 5 |
| Incurred fees | 0 | 0 | 5 |
| Opening fees | 0 | 0 | 5 |
| Expected Mark Date | 3 | 10 | 18 |
| Underlying Mark | 0 | 2 | 8 |
| Last activity | 0 | 0 | 3 |
| Record entry | 21 | 0 | 32 |
| Record exit | 19 | 0 | 10 |
| Record expiration | 15 | 0 | 15 |
| "Expires " | 2 | 1 | 4 |
| "Expired " | 0 | 5 | 9 |

Only the e2e lines and the UI-test lines read the screen.
