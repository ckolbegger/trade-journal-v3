# Trade Journal V3 — Vertical Deliverable Implementation Plan

**Status:** DRAFT for review — not frozen. Review proceeds one consequential decision at a time; accepted decisions are recorded here in place. Decision 12 states the current canonical order and supersedes the VD numbering cited in earlier decisions.

**Basis:**
- Frozen product baseline: `specs/` at commit `700a953` (index, glossary, ten ADRs, overview, all module contracts, UI/delivery contracts, acceptance contract).
- Approved stack (Phase 2, Profile A): TypeScript 5.9.3, React 19.3.0, React Router 7.18.4, Vite 7.3.7, Tailwind 4.3.3, Zustand 5.0.9, decimal.js 10.6.0, Luxon 3.7.2, Vitest 5.0.3, fake-indexeddb 6.2.5, Playwright 1.64.0; IndexedDB behind a custom promise wrapper; Cloudflare Pages hosting; canonical-JSON SHA-256 backup artifacts; NYSE holidays 2010–2036; MarketData.app pricing provider (first delivered at VD4).
- Process: `specs/evaluation/planning-protocol.md` (Phases 3–6). Detailed task breakdowns are NOT in this document; they live in one living working file per VD (`plan/VD<n>-<slug>.md`), written just-in-time and user-reviewed before that VD starts. This file becomes read-only after freeze.

**Accepted sequencing decisions (chronological; VD numbers in 1–12 are as accepted at the time — see 13 for the current order):**
1. (2026-10-10) Verified backup lands early (originally VD3, now VD6 per decision 13, after Closing); replace-only Restore lands late (VD18).
2. (2026-10-10) Replace/Void/Rebuild corrections land as the **last major trader capability** (VD17).
3. (2026-10-10) Locked signature ordering: Daily Review and ongoing risk/reward follow plan creation and opening execution, and precede closing a position (VD3 before VD6).
4. (2026-10-11) Trade closure is implemented before trade management; the full happy-path lifecycle (plan → open → evaluate → review → close) completes by VD6.
5. (2026-10-10/11) Settlements and rolls are deferred to VD16, after replay and analytics (confirmed after reviewing an earlier alternative). Consequence accepted: until VD16, options trades can close only by execution; expiration/assignment/exercise cannot be recorded and affected trades surface Settlement Due; the structure families (VD9/VD10) and the scorecard's disposition-timing section ship partial until VD16.
6. (2026-10-11) Single-leg option positions are their own deliverable (VD5), after Daily Review and before closing, bundling the MarketData.app provider — manual option marks become impractical exactly when option positions begin. Daily Bars and replay remain a separate later deliverable (VD7). VD1's strategy selector is Long Stock only.
7. (2026-10-11) Current Exposure reporting is its own deliverable (VD8), before Settlement & Rolls.
8. (2026-10-11) Post-core-loop order: bars & replay → current exposure → structure families → trade management → outcomes → journal ownership → reference management → process analytics.
9. (2026-10-11) Trade Tag and IdeaSource filtering is wanted, delivered by widening the existing filter UI when the tag taxonomy arrives (VD14) — no deliverable reordering. VD14 owns the activation of these dimensions across analytics and browse surfaces.
10. (2026-10-11) Trade management moves after the multi-leg structure families (now VD11), so management revision machinery is built only once happy-path functionality exists for every option structure. Consequence accepted: until VD11, evaluated views and Daily Review run against frozen original management (no mid-trade stop/target revision), and replay's management markers wait for VD11.
11. (2026-10-11) Voluntary journal entry creation (Review Note / Trader Reflection) moves into Daily Review (Source Daily Review; creates no Debt). Timeline browsing, Edit/Addendum/Void, and Entry Definition configuration remain in Journal ownership (VD13).
12. (2026-10-11) Manual mark entry joins Daily Review: the former marks-and-evaluated-views deliverable merges into the review as **VD3** — marks are entered as part of the ritual (Missing Marks is its first task family) and evaluated open-trade views arrive with the attention machinery that needs them. Backup moves after the merged deliverable, so every core data entity (plan, execution, journal, mark) is populated before the first export. Single-leg options onward shift one earlier; the plan is now **18 deliverables**.
13. (2026-10-11) Single-leg options + provider (VD4) and Closing (VD5) slide one earlier; backup becomes **VD6**. The first representative export now also contains closed trades, FIFO Lot Matches, and Close Reviews, and — with the provider already installed — AC-BACK-001's credentials-excluded evidence completes at backup itself. Amends the backup placement in decisions 1 and 12.

---

## Deliverables

### VD1 — Workspace & first Plan

**Stories**
- As a trader, I would like the app to verify on every launch that this environment can reliably hold my journal (working storage, offline assets, update safety), so that my data is never written somewhere it could be lost or corrupted.
- As a trader, I would like to set up my workspace with my brokerage institution and account, so that my trades are recorded against the right account.
- As a trader, I would like to confirm a complete trading plan with its thesis and invalidation, so that every trade starts from a deliberate, frozen decision.
- As a trader, I would like to see my confirmed plan in a list with its baseline risk and reward, so that I can track what I committed to.

**Capability set.** First run to confirmed plan: installable app shell (narrow bottom-nav / wide sidebar, live resize), Runtime Readiness gate with all outcome views, workspace initialization with time-zone selection, onboarding (create Institution + Account), plan composition (strategy, planned legs, original stops/targets), Plan Reflection with required Thesis/Invalidation, frozen Plan Baseline and 1R at confirmation, planned-trade browsing and plan detail.

**Operations & mechanisms.** `Workspace.initialize/getStatus/saveSettings/requestDurability`; `ReferenceCatalog.seedDefaults/save(create Institution, Account)/query/resolve`; `Journal.seedDefaults/getDefinitions`; `TradeWorkflows.confirmPlan`; `TradeRecord.prepareChange/applyPreparedChange/getRecord/queryRecords`; `TradeAnalysis.assessPlan`; `Journal.prepareEffects/applyPreparedEffects` (completed Plan Reflection). Mechanisms: Web App Manifest identity; versioned service worker with complete digest-verified Offline Release Inventory; the four readiness checks (isolated diagnostic transaction, capacity headroom, SW control, inventory) and persistence-level `RuntimeNotWritable` write gate; semantic transactions, optimistic revisions, immutable fact versions; canonical decimal money; advisory storage-protection warning + durability request; schema-version/migration framework; Installed Capability Manifest.

**Seeds / defaults.** All spec-exact seeds land atomically at initialization: 7 Entry Types with initial definitions, 7 Sources, 11 Strategies, 5 Close Reasons, 5 Abandonment Reasons, 1 empty IdeaSource Tag Type. The plan form's strategy selector offers only **Long Stock** (single-leg options enter at VD4, two-leg structures at VD9, complex structures at VD10).

**Durable representation.** Initial schema v1 for Workspace metadata/settings, Journal (types/definitions/entries/debt), Reference Catalog, Trade Record (plans, facts, versions, lifecycle index), and an empty Market Data section; capability manifest; SW release inventory.

**Acceptance scenarios.** Full: AC-PLAN-001, AC-PLAN-002, AC-DEL-001, AC-DEL-003, AC-DEL-004, AC-REF-001, AC-JOUR-007, AC-UI-001. Partial: AC-UI-002 (grows every VD); AC-RESP-001 (creation operations now — declared scope: update and multi-subject workflows complete at VD16); AC-DEL-005 (Unsupported + Integrity Blocked halves — declared scope: Recovery-Only export completes at VD5); AC-DEL-006 (launch/update boundaries — declared scope: post-Restore boundary completes at VD18); AC-DEL-002 (deferral machinery now; evidence accrues with each release, completes at VD18).

*Note:* VD1 is deliberately the largest deliverable. The PWA identity, Offline Release Inventory, Runtime Readiness, and write gate are mandatory inside the first mutating deliverable per the frozen contracts; they cannot be deferred or split out as a layer-only slice.

### VD2 — Opening execution

**Stories**
- As a trader, I would like to record all the fills from one entry decision as a single position change, so that my journal reflects the decision I actually made.
- As a trader, I would like to see my open position, lots, and fees after entry, so that I know exactly what I hold.
- As a trader, I would like to complete, defer, or decline the after-trade reflection without blocking the factual record, so that capturing the trade never waits on writing.

**Capability set.** Record an opening Position Change (one decision, multiple Executions serving planned legs, single Trade, single-leg stock); derived Instrument Position and open Lots with fee handling; entry-window tracking; lifecycle Planned→Open with index changes; Position Change Reflection completed/deferred (Debt with trigger-time snapshot)/declined; fact-only Deviations (Planned-Leg Terms, Entry Size, Unplanned Exposure); open-trade browsing and detail (facts, lots, fulfillment, journal narrative); basic Debt list with resolve form.

**Operations & mechanisms.** `TradeWorkflows.recordPositionChange` (opening variant); `TradeAnalysis.derive` (positions, lots, entry window, fulfillment, fact-only deviations); `Journal.save` (Debt resolution), `Journal.query` (debt, narrative); `TradeRecord` AnalysisInput projection. Mechanisms: FIFO opening-lot construction; Economic Time + Recorded Sequence ordering; obligation-key uniqueness; revision-bound post-commit results.

**Seeds / defaults.** None (selector widening only in later VDs).

**Durable representation.** Executions, Position Changes and membership, open lots, deviation occurrences, Debt/decline records, lifecycle index entries.

**Acceptance scenarios.** Partial: AC-POS-001 (opening half — declared scope: closing, FIFO matches, and full fee allocation complete at VD5); AC-POS-002 (multi-fill single decision — declared scope: multi-leg conformance completes at VD9); AC-POS-005 (single-leg fulfillment values — declared scope: Not-Entered at trade end completes at VD5; multi-leg completes at VD9/VD10); AC-LIFE-001 (Planned→Open — declared scope: full lifecycle completes at VD5); AC-JOUR-003 (defer→Debt with no placeholder — declared scope: due-Debt-blocks-Review completes at VD3); AC-JOUR-005 (basic uniqueness; full retry/void-reopen completes at VD13); AC-RESP-001 (multi-fact single-Trade commands — declared scope: cross-Trade multi-subject completes at VD16).

### VD3 — Daily Review with marks & evaluated views

**Stories**
- As a trader, I would like to enter today's closing price for what I hold as part of my review, so that my positions are valued on real evidence every day.
- As a trader, I would like to see current risk to stop, worst case, and incremental reward for my open trades, so that I can manage each exit against its plan.
- As a trader, I would like a guided after-close review that ranks my open trades by what needs attention and records a Hold/Exit/Roll/Adjust intention for each, so that every open position gets a deliberate daily decision and nothing — missing marks, overdue debt — silently slips.
- As a trader, I would like to jot a voluntary observation or reflection during the review, so that what I noticed about the day or a trade is captured while it's fresh.

**Capability set.** The after-close chapter in one deliverable. Manual Marks for any instrument/date with revision history and sticky Manual precedence; Unavailable-Mark Acknowledgments; Expected Mark Date resolution (latest completed NYSE session; Luxon + holiday calendar 2010–2036); Stale as context only. Evaluated open-trade views on stock positions: dated Mark-to-Market valuation, Ongoing Risk to Stop, Worst-Case Ongoing Risk, Incremental/Maximum Reward, Stop/Target condition status with independent OR semantics and Overruns, Plan-R conversions, covered subtotals — in trade detail, open-list columns, and the review's per-trade view. The full Daily Review ritual for an exact completed session: correction-aware eligibility at the cutoff; normative task order (current Missing Marks → due Debt → Settlement Due routing → attention-ranked trade walk); transparent attention bands with reasons and quantified pressure; one-click Hold; Exit/Roll/Adjust with required Intent; Stop-Discipline episode derivation and atomic Deviation reconciliation on save; due-Debt answering/declining in context; honest completion states (Complete / Complete With Unavailable Marks / Incomplete); close-and-resume from facts. Voluntary Review Note and Trader Reflection capture (Source Daily Review, Standalone/Trade/Execution anchors, saving is voluntary and creates no Debt). Expiration Payoff is deferred to VD4 where option structures first exist. Built and proven on open stock trades; option trades join automatically from VD4.

**Operations & mechanisms.** `MarketData.save` (initial Manual Mark, valuation override, correction-of-believed-wrong, acknowledgment, withdrawal) and `MarketData.query` (ResolveFrames, InspectObservations); `TradeAnalysis.evaluate`; extended `TradeViewsAndReporting.getTradeDetail` and browse; `DailyReview.open/getTrade/getDebt/save`; `Journal.save` direct authoring (voluntary Review Note / Trader Reflection with Source Daily Review and resolved anchors); `TradeRecord.queryRecords` with `StateAtEconomicCutoff`; `TradeAnalysis.replay` (condition history, continuous Stop-Discipline episodes, stable fingerprints); `TradeRecord.prepareChange` narrow Deviation-reconciliation variant; `MarketData` ExpectedSnapshot transaction-time check. Mechanisms: exhaustive Mark resolution precedence; per-calculation `Value/Unbounded/Unavailable/NotApplicable`; nearest nonnegative monetary boundary headline; no substitution of fill cost/zero/stale evidence; attention bands (blocker → boundary-reached → evidence-limited → quantified pressure → routine) with every reason and basis returned; snapshot-bound saves rejecting stale evidence; Actions record intent only.

**Seeds / defaults.** None (Action selector offers Hold/Exit/Roll/Adjust — all four deliverable as intents; Review Note and Trader Reflection definitions exist from VD1 seeds).

**Durable representation.** Mark and acknowledgment revision chains; effective-head indexes; session-policy version; Daily Trade Review Action entries (unique per Trade + Review Date); voluntary Review Note / Trader Reflection entries (Source Daily Review); recorded Stop-Discipline occurrences with evidence bindings; review completion is derived, not stored.

**Acceptance scenarios.** Full: AC-MARK-001, AC-MARK-002, AC-MARK-003, AC-REV-002, AC-REV-003, AC-REV-004, AC-REV-005, AC-REV-006, AC-JOUR-003 (completes), AC-POS-005 mark-dependent Stop-Discipline occurrences. Partial: AC-CALC-001 (frozen baseline and current-risk-vs-frozen-plan aspects — declared scope: Entry Quality resolution completes at VD5); AC-CALC-002 (per-calculation availability for single-instrument trades — declared scope: the multi-Instrument variant completes at VD9); AC-CALC-003 (headline risk/reward and underlying-price conditions — declared scope: structure-value conditions complete at VD4); AC-MARK-004 (frame/gap semantics — declared scope: candle/point/gap rendering completes at VD7); AC-REV-001 (cutoff eligibility — declared scope: correction restatement completes at VD17); AC-SET-003 (review-blocker half — declared scope: explicit settlement recording completes at VD16); AC-JOUR-001 (entry forms on the review surface — declared scope: coverage across all entry surfaces completes at VD13).

### VD4 — Single-leg option positions & pricing provider

**Stories**
- As a trader, I would like to plan a long call, long put, or cash-secured put trade on an exact contract, so that my option trades start from the same frozen-plan discipline as my stock trades.
- As a trader, I would like to record my option fills and see my option position, lots, and fees, so that I know exactly which contracts I hold.
- As a trader, I would like closing option prices fetched automatically for my open contracts, so that I don't have to hand-source option quotes every night.
- As a trader, I would like to see my option position's current value, worst case, and expiration payoff, so that I understand what I hold and where it ends up.

**Capability set.** Single-leg option trading end to end: the strategy selector adds **Long Call, Long Put, Cash-Secured Put** (exact contract terms — underlying, type, strike, expiration — as Planned Leg selection); option opening Position Changes with position/lots/fees under the contract multiplier; the MarketData.app Pricing Provider adapter (write-only credential, Disabled/Enabled/Needs Setup configuration) with automatic bounded mark recovery honoring Manual precedence; evaluated option views — mark-to-market, Ongoing Risk to Stop, Worst-Case Ongoing Risk (bounded long-premium and short-put cases; `Unbounded` short-call where it arises), Incremental/Maximum Reward, independent underlying-price and structure-value conditions under OR semantics; Planned and Current Expiration Payoff for the single expiration anchor (piecewise-linear segments, zero set, signed extrema, attainment sets); Daily Review walks open option trades automatically with option marks.

**Operations & mechanisms.** `confirmPlan`/`recordPositionChange`/`derive` extended to option instruments (option instrument keys); `TradeAnalysis.evaluate` structure-value condition paths and `TradeAnalysis.expirationPayoff`; `PricingProvider.fetchClosingObservations`; `MarketData.recover/configureProvider/getProviderConfiguration`; `MarketData.save/query` on option instruments. Mechanisms: contract multiplier in money calculations; provider response validation and partial-response handling as transient diagnostics; provider close seeds the initial Mark on empty keys; Manual marks remain authoritative and sticky.

**Seeds / defaults.** Selector additions only (three option seeds already exist from VD1). Provider configuration records (credential excluded from all exports by construction — AC-BACK-001 completes at VD6 backup, which runs with credentials present).

**Durable representation.** Option instrument keys in facts and observations; nonsecret provider settings; provider provenance on recovered marks.

**Acceptance scenarios.** Full: AC-MARK-005 (provider recovery is partial and nonbehavioral), AC-CALC-003 (completes — both condition kinds), AC-CALC-004 (completes — single-expiration anchor structures). Partial: the VD2 partial chains (AC-POS-001/002/005, AC-LIFE-001) are now exercised on option instruments with unchanged completion points (VD5/VD9/VD10); Stop-Discipline episodes against option marks join Daily Review with no new review machinery.

### VD5 — Closing positions

**Stories**
- As a trader, I would like to record my exits as decisions with a close reason, so that my closed trades explain themselves.
- As a trader, I would like FIFO matching and fee allocation computed exactly, so that my realized P&L is correct to the cent.
- As a trader, I would like a close-review prompt at closure, so that I capture the lesson while it's fresh — without blocking the factual close.

**Capability set.** Closing/reducing Position Changes for stock and single-leg option trades alike: FIFO Lot Matches consuming open lots, lot-aware opening/disposal fee allocation applied exactly once, realized P&L, partial closes leaving the trade Open; terminal agency requires exactly one Close Reason; non-agency closes derive Terminal Disposition without one; Close Review completed/deferred/declined atomically with closure; lifecycle Open→Closed; Entry Resolution Point finalization and one-time Entry Quality; Entry/Exit Scaling classification; closed-trade browsing and detail.

**Operations & mechanisms.** `TradeWorkflows.recordPositionChange` (closing/terminal variants); `TradeAnalysis.derive` completion (lot matches, terminal disposition, entry quality, scaling classification). Mechanisms: decision-level scaling classification (not fill counts); Close Reason cardinality by agency; Close Review never blocks closure.

**Seeds / defaults.** Close Reason selector offers **four** of five seeds (Target Reached, Stop Triggered, Thesis Invalidated, Time-Based Exit) — declared scope: `Rolled` is added at VD16 when rolls exist.

**Durable representation.** Lot-Match links, terminal facts, Close Reason/Close Review outcomes, lifecycle index transitions to Closed.

**Acceptance scenarios.** Full: AC-POS-001, AC-POS-004, AC-LIFE-001 (completes), AC-CALC-001 (completes), AC-POS-005 (completes for single-leg strategies — declared scope: multi-leg completes at VD9/VD10). Partial: Option Disposition Timing classification is limited to `Fully Disposed Pre-Expiration` — declared scope: `Fully Held to Expiration Settlement` and `Mixed` classifications complete at VD16 when settlement facts exist.

### VD6 — Verified backup

**Stories**
- As a trader, I would like to export my entire workspace as a file and verify the saved copy, so that I have a trustworthy backup outside the browser.

**Capability set.** Two-step backup: full-snapshot export as an ordinary file download (artifact + Workspace Backup Manifest with section/full digests, canonical JSON, SHA-256), then read-back verification of the trader-selected file producing a `CompletedBackupReceipt` — or honest Not Verified/Not Completed results. Works in Recovery Only. The UI never presents an unverified download as completed. Lands after Closing so the first representative export contains every core data entity — plans, executions, journal entries and Debt, marks, and now closed trades with Lot Matches and Close Reviews — and, with the provider already installed, credentials are present and provably excluded.

**Operations & mechanisms.** `Workspace.exportBackup/confirmBackup`; `exportSnapshot` for Trade Record, Journal, Market Data, and Reference Catalog bound to one snapshot. Mechanisms: concurrent-mutation exclusion (later mutation wholly outside the artifact); secrets exclusion by construction; expected digest/binding held in view state only.

**Seeds / defaults.** None.

**Durable representation.** Backup artifact schema (versioned); receipt as non-authoritative result evidence.

**Acceptance scenarios.** Full: AC-DEL-005 (completes — Recovery-Only reads + export + verification), AC-BACK-001 (completes — concurrent mutation, digest validation, Not Verified paths, and provider credentials provably excluded).

### VD7 — Daily Bars & replay

**Stories**
- As a trader, I would like to see my trade replayed across its lifetime with daily bars and explicit gaps, so that I can study how the position actually developed.
- As a trader, I would like trailing stop and target checks to use each day's full high and low range, so that episodes are detected from real extrema rather than closes alone.

**Capability set.** Daily Bars as independent range evidence fetched alongside closing observations by the existing provider; `ReadSeries` with explicit gaps (no interpolation, carry-forward, or fabricated candles); corrected-lifetime trade replay view (fact/management/correction markers, candles/points/gaps, calculated tracks, coverage); bar-extrema evidence rules in evaluation and replay (long → same-date high, short → same-date low, multi-instrument structures → synchronized same-date marks; missing evidence proves nothing); bar-seeds-mark on otherwise-empty keys.

**Operations & mechanisms.** `MarketData.query` ReadSeries and bar storage; `TradeViewsAndReporting.replayTrade`; bar-extrema rules in `TradeAnalysis.evaluate/replay`. Manual marks remain fully usable when the provider is absent or fails.

**Seeds / defaults.** None.

**Durable representation.** Daily Bar revision chains; bar-derived provenance on seeded marks.

**Acceptance scenarios.** Full: AC-MARK-006, AC-MARK-004 (completes). Partial: management-revision markers in the replay timeline — declared scope: activate at VD11 when Management Revisions exist.

### VD8 — Current Exposure reporting

**Stories**
- As a trader, I would like a current snapshot of my open book — open-trade count, marked P&L components, and aggregate ongoing risk — so that I can see my portfolio's exposure at a glance.
- As a trader, I would like that exposure view to name exactly which trades and figures are unavailable or unbounded, so that I never mistake partial coverage for the whole picture.

**Capability set.** The Current Exposure report family: current-only (no Report Period); Open Trade count; realized-to-date, remaining-open marked, and combined current P&L as independent components; aggregate Plan Risk; Monetary Ongoing Risk, Worst-Case Ongoing Risk, Incremental Reward; Stop/Target affected counts and maximum simultaneous active-condition Overrun per trade (OR conditions never double-count one exposure); related Plan-R distributions; the optional portfolio reward-to-risk ratio only for exact like-covered finite cohorts — never an average of per-Trade ratios; finite covered subtotals retained alongside named Unbounded contributors and separate unavailable cohorts; filters and one-dimensional breakdown with contributor navigation.

**Operations & mechanisms.** `PerformanceAnalysis.exposure`; `TradeViewsAndReporting.runReport` current-family orchestration with one `EvaluationSetBinding` (common valuation date, Expected Mark Date, Trade revisions, Market evidence snapshot).

**Seeds / defaults.** None.

**Durable representation.** None (ephemeral deterministic reports).

**Acceptance scenarios.** Full: AC-RPT-003. Partial: AC-PERF-001 (open-list/report scale measurements continue — declared scope: consolidated benchmark evidence completes at VD18).

### VD9 — Two-leg structures: vertical spreads & Covered Call

**Stories**
- As a trader, I would like to plan and trade vertical spreads and covered calls as single decisions, so that multi-leg trades are journaled as coherently as single legs.

**Capability set.** Multi-leg planned-leg conformance: legs of one structure entered in one Position Change with per-leg fulfillment (all six values reachable), per-leg Planned-Leg Terms occurrences aggregated per served leg, entry-window and Entry Quality across legs; strategy selector adds **Vertical Call Debit, Vertical Call Credit, Vertical Put Debit, Vertical Put Credit, Covered Call**; payoff/valuation/conditions verified for co-expiring two-leg structures and stock+option structures; rolls and settlements operate over two-leg trades.

**Operations & mechanisms.** No new module operations — completion of `recordPositionChange`/`derive`/`evaluate`/`expirationPayoff` multi-leg variants and selector widening.

**Seeds / defaults.** Selector additions only (five seeds already exist from VD1).

**Durable representation.** None beyond existing fact shapes.

**Acceptance scenarios.** Full: AC-POS-002 (completes), AC-POS-005 (completes for ≤2 legs), AC-CALC-002 (completes — multi-Instrument availability), AC-CALC-004 for co-expiring and stock-participating structures. Partial: close-by-execution only — declared scope: expiration/assignment-based closure of two-leg structures completes at VD16.

### VD10 — Iron Condor & PMCC

**Stories**
- As a trader, I would like to plan and trade iron condors and PMCCs, so that my complex structures get the same conformance and payoff treatment as simpler ones.

**Capability set.** Four-leg same-expiration conformance (Iron Condor, ascending strikes, equal absolute quantities, asymmetric wings allowed) and expiration-order-constrained diagonals (PMCC); multi-expiration payoff honestly `Unavailable` (PMCC) rather than a misleading combined curve; all four Deviation categories and scaling classification exercised across four legs.

**Operations & mechanisms.** No new module operations — completion of multi-leg variants at four legs and mixed expirations.

**Seeds / defaults.** Selector additions only (Iron Condor, PMCC — selector now offers all eleven seeds).

**Durable representation.** None beyond existing fact shapes.

**Acceptance scenarios.** Full: AC-POS-005 (completes for all seeded strategies), AC-CALC-004 multi-expiration Unavailable path. Partial: close-by-execution only — declared scope: expiration/assignment-based closure completes at VD16.

### VD11 — Trade management

**Stories**
- As a trader, I would like to revise my stop or target mid-trade and record why, so that my ongoing risk reflects my current thesis rather than a stale plan.
- As a trader, I would like to abandon a plan I never entered, with a reason, so that my record distinguishes discipline from inaction.

**Capability set.** Management Revisions (prospective stop/target/structure/thesis changes with completed Management Revision reflection — Revision Rationale required, AllOrNone revised-thesis pairing, frozen into both fact and Entry); evaluated views honor effective management while the Plan Baseline never changes; Abandonment of never-entered plans with an active reason, retiring applicable Plan Debt, no Close Reason or Terminal Disposition. Delivered after the multi-leg structure families so management revision machinery arrives once happy-path functionality exists for every option structure; management applies to single-leg and multi-leg trades alike, and replay's management markers activate here.

**Operations & mechanisms.** `TradeWorkflows.reviseManagement/abandonPlan`; `Journal.prepareEffects/applyPreparedEffects` (Management Revision entry, obligation revise-by-exact-revision, Plan-related Debt retirement). Mechanisms: effective-condition timeline; abandonment eligibility from effective facts only.

**Seeds / defaults.** None (Abandonment Reason selector offers all five seeds — all five are deliverable here).

**Durable representation.** Management Revision facts; abandonment facts; effective-management projection inputs.

**Acceptance scenarios.** Partial: AC-LIFE-002 (valid abandonment and rejection of entered plans — declared scope: Void-false-execution rederivation completes at VD17); AC-JOUR-006 (resolution route and no-prose rule — declared scope: Management-Debt creation sources complete at VD16); AC-CALC-001 aspects (revision never rewrites baseline) fully exercised.

### VD12 — Outcomes reporting

**Stories**
- As a trader, I would like outcome reports over my closed trades — win rate, P&L distribution, R multiples, and curves — so that I can see what my trading actually produces.

**Capability set.** The Outcomes report family end to end: Report Period presets resolved in the workspace time zone; stable-identity filters (AND across / OR within); one Break-Down-By dimension with non-additive disclosure and retained Overall; closed-trade headline metrics, realized-dollar and closed-R cumulative curves (realization increments at original Economic Time), exact contributor navigation; empty populations honestly Not Applicable. Arriving after the structure families, it measures the full strategy set from day one.

**Operations & mechanisms.** `PerformanceAnalysis.outcomes`; `TradeViewsAndReporting.runReport`; `TradeRecord.queryRecords` population exhaustion with binding proof.

**Seeds / defaults.** None (report surface; no stored reports).

**Durable representation.** None (ephemeral deterministic reports).

**Acceptance scenarios.** Full: AC-RPT-001. Partial: AC-RPT-002 (populations/arithmetic/curves — declared scope: correction sensitivity and Correction-Footprint disclosure complete at VD17); AC-RPT-006 (identity-based membership — declared scope: renamed/inactive label lenses complete at VD14); AC-PERF-001 (production-scale open-list measurements begin — declared scope: consolidated benchmark evidence completes at VD18).

### VD13 — Journal ownership

**Stories**
- As a trader, I would like to browse, edit, append to, and void journal entries with full history visible, so that my writing stays honest and correctable.
- As a trader, I would like to configure the prompts on my forms, so that the journal asks what I actually want to track.

**Capability set.** Full journal timeline browsing with filters and Timeline/Analysis/Full-History projections over workflow-created and review-created entries alike; Entry Edit (appended version under original definition snapshot), Addendum (new entry, preserved anchor, parent link), Void (visible, reasoned, reopens sole-settled Debt); runtime Entry Definition revision (`reviseDefinition`) with prospective-only effect and exact snapshot retention on history; historical prompt/option labels preserved. Voluntary entry creation itself lives in Daily Review from VD3.

**Operations & mechanisms.** `Journal.save` (Edit, Addendum, Void); `Journal.query` full projection set; `Journal.reviseDefinition`. Mechanisms: definition-revision validation; obligation-key lifecycle incl. reopen-on-void.

**Seeds / defaults.** None (fixed types unchanged by construction).

**Durable representation.** Entry version chains, addendum links, void reasons; definition revisions.

**Acceptance scenarios.** Full: AC-JOUR-001, AC-JOUR-002, AC-JOUR-004, AC-JOUR-005 (completes).

### VD14 — Reference management

**Stories**
- As a trader, I would like to rename, archive, and retire my institutions, accounts, strategies, and tags, so that my reference data stays current without rewriting history.

**Capability set.** Full Reference Catalog management: typed create/rename/archive/retire/reactivate with expected revisions and immutable parent/shape rules; trader-defined Tag Types/Values including IdeaSource values; Archived vs Retired presentation; historical and current label lenses across trade/journal/report surfaces; concurrent retirement conflicts at commit; protected seeded values per policy. This deliverable owns activating **Trade Tag and IdeaSource filter and Break-Down-By dimensions** on the already-shipped analytics reports (VD8/VD12/VD15 surfaces as installed) and Tag filters on trade browsing, by widening the existing filter UI — no reordering of analytics deliverables.

**Operations & mechanisms.** `ReferenceCatalog.save` full variant set; `resolve` modes (NewSelection, NewTagValueSelectionUnderExistingBinding, RetainedReference, HistoricalSnapshot, DisplayOnly) consumed across views.

**Seeds / defaults.** None new; trader-created tag taxonomy begins here (Trade tag + IdeaSource selectors gain values).

**Durable representation.** Label/availability revision chains; tag taxonomy records.

**Acceptance scenarios.** Full: AC-REF-002, AC-RPT-006 (completes).

### VD15 — Process analytics

**Stories**
- As a trader, I would like a process scorecard showing plan outcomes, entry quality, deviations, and reflection discipline, so that I can judge my process rather than only my P&L.
- As a trader, I would like to report on any categorical journal answer, so that I can see how my emotions and convictions distribute across my trading.

**Capability set.** Process Scorecard (plan-outcome partition, Entry Quality rates and coverage, all four Deviation families, management-activity distribution including zeros, Stop/Target episode behavior with max overrun per episode, reflection outcomes incl. voided-origin disclosure, Option Disposition Timing, correction-process disclosure — descriptive only, no composite grade) and the categorical Journal Field report (one stable Single-Select/Scale/Tag-Select field at a time, moment-date populations, distinct Due/Declined/Retired/Voided groups, one effective Entry identity counted once). Both use Report Periods, filters, one-dimensional breakdown, contributor navigation.

**Operations & mechanisms.** `PerformanceAnalysis.scorecard/journalField`; `TradeViewsAndReporting.runReport` family expansion; `Journal.query` analysis projections.

**Seeds / defaults.** None.

**Durable representation.** None (ephemeral deterministic reports).

**Acceptance scenarios.** Full: AC-RPT-005. Partial: AC-RPT-004 — declared scope: Option Disposition Timing section is limited to pre-expiration disposal until VD16; correction-process disclosure section completes at VD17.

### VD16 — Settlement & rolls

**Stories**
- As a trader, I would like to record expiration, assignment, exercise, or cash settlement explicitly, so that my options trades end with the truth rather than calendar guesses.
- As a trader, I would like assignment or exercise stock routed to the trade I choose, so that basis and proceeds stay with the right position.
- As a trader, I would like to roll part of a position into a new plan with visible lineage, so that the continuation is connected to what it replaced.

**Capability set.** Explicit settlement facts (Expiration/Assignment/Exercise/cash settlement) with physical/cash outcome and Settlement Price kept separate from adjusted basis/proceeds, option premium applied exactly once; allocation to an explicitly selected compatible existing Stock Trade with residual-only successor creation under settlement-origin Plan context (never a fabricated second Plan Reflection); `NeedsResolution` when allocation is ambiguous — never guessed; Management Debt created atomically for unmanaged settlement stock and resolved through the existing `reviseManagement`; partial Rolls (close selected predecessor quantity, confirm successor Plan, exclusive Execution ownership, typed lineage, `Rolled` Close Reason); cross-Trade atomic commands. Completes: Daily Review Settlement Due routing, `Rolled` close reason, expiration/Mixed Option Disposition Timing classifications, and expiration/assignment-based closure for all strategy families.

**Operations & mechanisms.** `TradeWorkflows.recordPositionChange` (settlement and Roll variants, bounded multi-Trade); `Journal` Management-Debt effects; `TradeAnalysis.derive/assessChange` settlement accounting rules. Mechanisms: U.S. physical-settlement basis/proceeds rules; planned-settlement vs unplanned-exercise honesty (Exercise Intent); successor Plan assessment inside the Roll command.

**Seeds / defaults.** Close Reason selector adds `Rolled` (completes all five).

**Durable representation.** Settlement facts, allocation records, Roll lineage, Management Debt records, settlement-origin plan context.

**Acceptance scenarios.** Full: AC-SET-001, AC-SET-002, AC-SET-003 (completes), AC-SET-004, AC-POS-003, AC-JOUR-006 (completes), AC-RESP-001 (completes — bounded multi-subject cross-Trade workflows), AC-REV-001 settlement-routing aspect, AC-RPT-004 disposition-timing section.

### VD17 — Corrections (Replace, Void, Rebuild)

**Stories**
- As a trader, I would like to correct a wrongly recorded fill and see exactly what the correction changes before committing, so that my history becomes true without losing the audit trail.
- As a trader, I would like to void a fill that never happened and have everything linked to it reconcile, so that a data-entry error doesn't distort my economics.

**Capability set.** The full correction workflow: `previewCorrection` (typed Replace/Void/Rebuild, Correction Footprint across trades, calculations, lifecycle/disposition, lots, deviations, observation/report/review intervals, Journal/Debt consequences, materiality-based acknowledgment requirement) and `commitCorrection` (exact preview binding, atomic linked reconciliation, visible audit, historical anchors preserved). Rebuild keeps Trade identity with new fact identities; Review Impact acknowledgment for material changes; preview of proposed Mark corrections (`previewMarkChange`); retrofits: review-eligibility restatement, report correction sensitivity and scorecard correction disclosure, Void-false-execution abandonment rederivation.

**Operations & mechanisms.** `TradeWorkflows.previewCorrection/commitCorrection`; `TradeAnalysis.assessChange`; `TradeViewsAndReporting.previewMarkChange`; integrity-disagreement surfacing and authorized repair paths. Mechanisms: version-chain append; Correction Footprint; linked all-or-nothing reconciliation across every participant module.

**Seeds / defaults.** None.

**Durable representation.** Fact versions/Void revisions with reasons; correction metadata and footprints; superseded-fact retention.

**Acceptance scenarios.** Full: AC-CORR-001, AC-CORR-002, AC-CORR-003, AC-CORR-004 (settlement/Roll linked corrections — settlement facts available since VD16), AC-CORR-005, AC-LIFE-003, and completion of AC-LIFE-002, AC-REV-001, AC-RPT-002, AC-RPT-004.

*Accepted consequence (user, 2026-10-10):* until VD17 there is no in-product remedy for a mis-entered trade fact — the development-period fallback is re-entering a fresh workspace. All earlier VDs store facts correction-ready (version chains, Recorded Sequence, evidence bindings are core from VD1); only corrections-aware UI and analytics sensitivity arrive late.

### VD18 — Restore & at-scale evidence

**Stories**
- As a trader, I would like to restore a verified backup onto this device as a deliberate full replacement, so that I can recover or move my workspace safely.

**Capability set.** Validate-first, replace-only Restore: artifact verification (envelope, digests, versions, migrations) without mutation; per-section module validation with Trade Analysis rederivation and cross-section reference closure; preview with exact impact, migrations/repairs, warnings, and safety-backup offer satisfied only by an exact-target `CompletedBackupReceipt` or explicit warned decline; atomic all-section application with fresh status/landing state and pre-Restore view invalidation. This deliverable also carries the consolidated evidence obligations for the whole product: rebuild equivalence after Restore/private-state reconstruction, target-scale deterministic benchmarks (cold start p95 ≤ 2,500 ms; warm open-list p95 ≤ 1,500 ms; 25,000 Trades / ~200,000 facts / 200 Open), and accumulated update-safety evidence across prior releases.

**Operations & mechanisms.** `Workspace.prepareRestore/applyPreparedRestore`; `prepareRestore/applyPreparedRestore` for every fact module; isolated migration candidates; private index/projection rebuild. Mechanisms: nondurable preview tokens bound to artifact digest + live target; `RuntimeNotWritable` rejection outside Writable; benchmark dataset generator (deterministic, disclosed provenance).

**Seeds / defaults.** None.

**Durable representation.** Restore receipts; migration framework already shipping since VD1 exercises full-artifact version transitions here.

**Acceptance scenarios.** Full: AC-REST-001, AC-REST-002, AC-REST-003, AC-REST-004, AC-REBUILD-001, AC-PERF-001 (completes), AC-DEL-002 (completes), AC-DEL-006 (completes).

---

## Scope discipline applied

- **Selectors offer only deliverable values.** Strategy selector: Long Stock (VD1) → +3 single-leg options (VD4) → +5 two-leg (VD9) → +2 complex (VD10). Close Reason: 4 seeds (VD5) → +`Rolled` (VD16). Tag/IdeaSource values: from VD14. All eleven strategies, five reasons, and the IdeaSource type exist as seeds from VD1 (AC-REF-001 is exact) — only selector membership widens.
- **Analytics filter dimensions activate when meaningful.** Lifecycle, Account, Institution, Strategy, and Underlying are live from each report family's first release (VD8/VD12/VD15). Entry/Exit Scaling is live from VD5 (fully from VD9/VD10). Option Disposition Timing is partial from VD5 (pre-expiration classifications only) and full at VD16. Trade Tag and Plan IdeaSource activate at VD14, when trader-defined tag taxonomy first exists. Break-Down-By dimensions follow the same activation; Overall is always retained.
- **Manual before automated.** Manual stock marks inside the review (VD3) precede the provider (VD4); manual option marks remain available after the provider lands; manual everything precedes Restore automation (VD18).
- **Migration is never its own deliverable.** Every durable-representation change above is a task inside the VD that introduces it; the schema/migration framework itself is a VD1 task; VD18 exercises migration end-to-end at the full-artifact boundary.
- **No layer-only deliverables.** Every VD above is reachable and operable through the production UI; VD9/VD10 add no new operations because their capability is completion of existing operation variants at new structure widths — their user-visible capability is the widened selector and conformance behavior.

## Parallelism

**Within a deliverable.** Every VD begins by fixing its command/result interfaces (module contracts already fix the vocabulary); from that point UI work and domain/persistence work proceed in parallel. Richest splits: VD1 (readiness/persistence/PWA track vs app-shell/onboarding/plan-form track), VD3 (mark/evaluate machinery vs review UI), VD4 (provider adapter + option domain semantics vs plan/execution forms + evaluated views), VD16 (settlement/roll domain semantics vs allocation/roll forms), VD18 (restore validation vs benchmark harness).

**Genuinely safe pairs across deliverables** (disjoint modules and disjoint shared resources at any moment; release boundaries still serialize):
- VD9 (two-leg conformance: Trade Analysis variants + plan forms) ∥ VD13 (Journal ownership: Journal + journal UI).
- VD10 (IC/PMCC conformance) ∥ VD14 (Reference management: Catalog + label lenses).

Not safe despite surface appeal: VD4 ∥ VD8 (both touch evaluated views/report surfaces); VD15 ∥ VD17 (corrections retrofit report sensitivity — direct conflict); VD17 ∥ VD18 (Restore validators must validate correction history).

**Shared resources requiring a single owner at a time:** durable schema + persistence/transaction core; seed/default manifest and catalog seed set; Installed Capability Manifest and each release boundary; navigation/app shell; shared Trade Analysis operations (`derive`/`evaluate`/`replay`/`assessChange`); Trade Views and Reporting report/browse surfaces; workspace time/session-policy calendar.

## Cross-cutting obligations inside every deliverable

- TDD red→green per task through public seams; per-task evidence recorded in that VD's working file (not here).
- Cumulative unit + mock-free real-stack integration suites; fresh browser-critic gate before the deliverable counts as complete.
- Honest Installed Capability Manifest delta (AC-CAP-001); navigation exposes only installed capabilities.
- Migration/compatibility task for every durable-representation change.
- AC-UI-001/AC-UI-002 obligations grow with every UI-bearing surface; AC-RESP-001 post-commit-result discipline applies to every new mutation variant.

## Review decisions pending

None — the deliverable list is settled per decisions 12–13. Next steps before freeze: just-in-time task breakdowns in per-VD working files (`plan/VD<n>-<slug>.md`) on request before each VD starts, the Phase 4 acceptance-to-evidence matrix, final review, and freeze.
