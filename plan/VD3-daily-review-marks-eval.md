# VD3 — Daily Review with marks & evaluated views

Working file for VD3 of `plan/implementation-plan.md` @ `477c8cd` (branch `zcode-glm-5.3`). Scope, sequence, and acceptance markings are the plan's; this file owns the detailed breakdown and living progress. Environment facts: see VD1 working file. Built and proven on open stock trades; option trades join automatically from VD4 (plan §VD3).

## Scope recap (authoritative source: plan §VD3)

- **User-visible outcome:** the after-close chapter in one deliverable — Manual Marks with revision history and sticky Manual precedence; Unavailable-Mark Acknowledgments; Expected Mark Date resolution (latest completed NYSE session; Luxon + holiday calendar 2010–2036); Stale as context only; evaluated open-trade views on stock positions (dated MTM valuation, Ongoing Risk to Stop, Worst-Case Ongoing Risk, Incremental/Maximum Reward, Stop/Target condition status under independent OR semantics with Overruns, Plan-R conversions, covered subtotals — in trade detail, open-list columns, and the review's per-trade view); the full Daily Review ritual (correction-aware eligibility at cutoff; normative task order Missing Marks → due Debt → Settlement Due routing → attention-ranked walk; transparent attention bands; one-click Hold; Exit/Roll/Adjust with required Intent; Stop-Discipline episode derivation and atomic Deviation reconciliation on save; due-Debt answering in context; Complete / Complete With Unavailable Marks / Incomplete; close-and-resume from facts); voluntary Review Note and Trader Reflection capture (Source Daily Review; Standalone/Trade/Execution anchors; saving voluntary, creates no Debt).
- **Operations exercised:** `MarketData.save` (initial Manual Mark, valuation override, correction-of-believed-wrong, acknowledgment, withdrawal) and `MarketData.query` (ResolveFrames, InspectObservations); `TradeAnalysis.evaluate`; `TradeAnalysis.replay`; extended `TradeViewsAndReporting.getTradeDetail` and browse; `DailyReview.open/getTrade/getDebt/save`; `Journal.save` direct authoring; `TradeRecord.queryRecords` with `StateAtEconomicCutoff`; `TradeRecord.prepareChange` narrow Deviation-reconciliation variant; `MarketData` ExpectedSnapshot transaction-time check.
- **Mechanisms:** exhaustive Mark resolution precedence; per-calculation Value/Unbounded/Unavailable/NotApplicable; nearest nonnegative monetary boundary headline; no substitution of fill cost/zero/stale evidence; attention bands (blocker → boundary-reached → evidence-limited → quantified pressure → routine) with every reason and basis returned; snapshot-bound saves rejecting stale evidence; Actions record intent only.
- **Seeds:** none — Action selector offers Hold/Exit/Roll/Adjust as intents; Review Note and Trader Reflection definitions exist from VD1 seeds.
- **Durable representation:** Mark and acknowledgment revision chains; effective-head indexes; session-policy version; Daily Trade Review Action entries (unique per Trade + Review Date); voluntary Review Note / Trader Reflection entries (Source Daily Review); recorded Stop-Discipline occurrences with evidence bindings; review completion derived, not stored.
- **Acceptance (plan markings):** Full: AC-MARK-001, AC-MARK-002, AC-MARK-003, AC-REV-002, AC-REV-003, AC-REV-004, AC-REV-005, AC-REV-006, AC-JOUR-003 (completes), AC-POS-005 mark-dependent Stop-Discipline occurrences. Partial: AC-CALC-001 (frozen-baseline and current-risk-vs-frozen-plan aspects; Entry Quality resolution completes VD5), AC-CALC-002 (single-instrument availability; multi-Instrument at VD9), AC-CALC-003 (headline risk/reward and underlying-price conditions; structure-value conditions complete VD4), AC-MARK-004 (frame/gap semantics; rendering completes VD7), AC-REV-001 (cutoff eligibility; correction restatement completes VD17), AC-SET-003 (review-blocker half; explicit settlement recording completes VD16), AC-JOUR-001 (entry forms on the review surface; all-surface coverage completes VD13).

## Interface-freeze gate and parallel split

- **T1 pins the VD3 command/result types** (MarketData save intentions + ResolveFrames/InspectObservations results; evaluate/replay result trees; DailyReview's four operations; Journal authoring variant; `StateAtEconomicCutoff` query; the narrow Deviation-reconciliation change). After T1:
  - **Track D (domain/persistence):** T2–T12.
  - **Track U (UI):** T13–T14, against frozen interfaces.
- Serialize at T16 (integration gate) and T17 (critic gate).

## Tasks

### T1 — VD3 interface freeze
**Type:** structural. **Depends:** VD2 complete.

**Verification:** `npm run typecheck` clean; type fixtures compile against module-contract vocabulary (MarkResolution, Expected-Mark Status, attention-band structures, DailyReviewSaveCommand union).

### T2 — Session policy and Expected Mark Date resolution
**Type:** behavior-bearing. **Depends:** T1.

Latest completed regular NYSE session as of an instant, in the workspace time zone convention for wall-clock resolution with exchange-defined session dates; NYSE holidays 2010–2036 as a disclosed static data module; session-policy version recorded durably.

**Seam:** session-policy module (pure over instant + policy inputs).

```
describe("Expected Mark Date resolution")
- it should resolve Monday 2026-10-05 as the Expected Mark Date at noon Tuesday 2026-10-06 (active session ⇒ latest completed session, normal not Stale)
- it should resolve Friday to Thursday 2026-07-02 when Friday 2026-07-03 is the observed Independence Day holiday
- it should resolve the Thanksgiving Thursday 2026-11-26 to Wednesday 2026-11-25
- it should resolve a weekend instant to the preceding Friday completed session
- it should expose the exact Review Cutoff instant for a resolved completed session
```

### T3 — MarketData.save: the five Manual intentions
**Type:** behavior-bearing. **Depends:** T2.

Initial Manual Mark; deliberate valuation override (distinct saved intention); correction of believed-wrong Mark with reason (records correction metadata); assert unavailable only when no exact Mark exists; visibly withdraw a mistaken acknowledgment. Every write uses the current resolution revision and appends immutable history; result returns the complete effective resolution for every changed key with new revision and intention classification.

**Seam:** `MarketData.save` over the real store.

```
describe("Manual Mark writes")
- it should make an initial Manual Mark effective for its Instrument/Trading Date and return Available with the new resolution revision
- it should append a valuation override as a distinct saved intention without correction metadata, keeping history visible
- it should record a believed-wrong correction with its reason and correction metadata while preserving the prior version in history
- it should reject an acknowledgment for a key that already has an exact Mark, as a typed no-write result
- it should reject withdrawing an acknowledgment when none is effective, writing nothing
- it should return the complete effective resolution and classification for each directly changed key without a follow-up query
```

### T4 — MarketData.query: ResolveFrames, InspectObservations, ExpectedSnapshot
**Type:** behavior-bearing. **Depends:** T3.

Point and completed-session-range frames (current / Daily Review / historical / candidate-manual); exhaustive precedence (exact Mark → asserted acknowledgment → Missing; closest-earlier Mark only as Stale context); frames bound to normalized request + session-policy revision + evidence digest via opaque `MarketDataSnapshotId`; ranges enumerate completed sessions and emit explicit gaps (no interpolation/carry-forward); `ExpectedSnapshot` transaction-time check returning SnapshotUnchanged / SnapshotChanged with current frames; `InspectObservations` returns immutable Mark/acknowledgment audit histories.

**Seam:** `MarketData.query` over the real store.

```
describe("Mark resolution precedence")
- it should resolve Available from an exact-date Mark even when an acknowledgment also exists in history
- it should resolve AcknowledgedUnavailable (with any older Mark only as Stale context) when no Mark exists but an acknowledgment is asserted
- it should resolve Missing (with optional Stale context) otherwise, never substituting fill cost, zero, another date's close, or a carried Mark

describe("frames and snapshot binding")
- it should bind each frame to the normalized request, session-policy revision, and evidence digest through one opaque MarketDataSnapshotId
- it should enumerate a completed-session range with an explicit gap at each interior missing date, fabricating nothing
- it should return visibly hypothetical frames for Candidate Manual Mark evidence that never count as committed evidence

describe("ExpectedSnapshot")
- it should return SnapshotUnchanged when no Mark, acknowledgment, or material absence changed since the bound snapshot
- it should return SnapshotChanged with current frames when any Mark, acknowledgment, or material absence changed, never blessing stale reconciliation
```

### T5 — TradeAnalysis.evaluate: evaluated open-trade views (stock)
**Type:** behavior-bearing. **Depends:** T2 (fixture dates), VD2 derive.

Dated MTM valuation with per-Instrument coverage; Ongoing Risk to each effective Stop, Worst-Case Ongoing Risk, Incremental Reward, Plan-R conversions; per-condition Stop/Target status under independent OR semantics; Overrun; realized-to-date, remaining-open marked, combined current P&L, and incurred fees independently returned with covered subtotals; only remaining open exposure + effective management + eligible exact-date Marks; Stale never enters calculation.

**Seam:** `TradeAnalysis.evaluate` (pure; DerivedTradeState from real command fixtures).

```
describe("dated valuation and P&L components")
- it should value the fixture (100 AAPL @ 50 entry, opening fee 1.00, Mark 55.00) as remaining-open marked P&L $499.00, realized-to-date $0.00, combined $499.00, and incurred fees $1.00, each independently returned
- it should return the marked/combined total as Unavailable(MissingMark, instrument+date) when the expected Mark is Missing, while realized-to-date stays a Value and the covered subtotal is labelled (AC-CALC-002 single-instrument aspect)

describe("risk, reward, and conditions")
- it should compute Ongoing Risk to Stop = $1,000.00 (2.0R) for the fixture (stop 45) and Incremental Reward to Target = $500.00 (target 60), with Worst-Case Ongoing Risk = $5,500.00 (full marked value of the remaining shares) and Maximum Incremental Reward = Unbounded(Above)
- it should keep every Stop and Target condition independently visible with its own basis even when a headline nearest boundary exists
- it should make the headline Ongoing Risk zero and disclose Stop Overrun ($100.00 = 0.2R) when the Mark (44.00) has crossed the stop (45) without flattening, changing no Lifecycle State
- it should keep a valid dollar Value visible when its Plan-R conversion is unavailable
- it should never use a Stale Mark as valuation evidence, showing it only as returned context
```

### T6 — TradeAnalysis.replay: condition history and Stop-Discipline episodes
**Type:** behavior-bearing. **Depends:** T5.

Corrected snapshot + ordered explicit Mark frames over the caller-specified lifetime; condition status at each point with explicit gaps proving nothing; continuous Stop-Discipline episodes against effective Stop revisions (episode begins at first exact observation demonstrating breach after activation or an observed unbreached state; ends only at an exact unbreached observation or condition replacement/retirement; preceding gap means "first observed"); stable episode fingerprints for atomic create/retain/supersede/Void reconciliation.

**Seam:** `TradeAnalysis.replay` (pure).

```
describe("Stop-Discipline episode derivation")
- it should derive one continuous episode from marks 50 → 44 → 43 → 46 against stop 45 (breach D2–D3, ended by D4's unbreached observation), not one occurrence per breached date
- it should treat a breach following a gap as "first observed," never fabricating a crossing date inside the gap
- it should start a new episode only after an intervening unbreached observation or condition replacement, retaining superseded episodes as history
- it should produce stable episode fingerprints such that rederivation over unchanged evidence yields create/retain/supersede decisions with no daily duplicates
- it should prove neither breach, recovery, nor new extreme from a missing-evidence date
```

### T7 — TradeRecord: cutoff queries and the narrow Deviation-reconciliation variant
**Type:** behavior-bearing. **Depends:** VD2-T4.

`queryRecords(StateAtEconomicCutoff(Open))` — exact completed-session eligibility from corrected effective facts, not current membership; `prepareChange` narrow Deviation-reconciliation variant (cannot change economic facts or Lifecycle State; requires exact Trade and Market Data bindings and complete occurrence fingerprints).

**Seam:** `TradeRecord` operations over the real store.

```
describe("StateAtEconomicCutoff")
- it should return the trades whose corrected effective facts place them Open at the supplied cutoff, excluding trades opened only after the cutoff and including trades open then but closed since (eligibility ≠ current Open membership)

describe("narrow Deviation reconciliation")
- it should accept a reconciliation carrying exact Trade/Fact revisions, Market Data bindings, and complete occurrence fingerprints, staging occurrence create/retain/supersede effects only
- it should reject any attempt to change economic facts or Lifecycle State through this variant, as a typed no-write result
```

### T8 — Journal.save: voluntary direct authoring
**Type:** behavior-bearing. **Depends:** VD1-T8.

Voluntary creation limited to Review Note and Trader Reflection; Source Daily Review; Standalone/Trade/Execution anchors resolved through Trade Record; exact rendered definition revision + stable prompt identities; saving voluntary — no Debt ever created by these types or by declining to write.

**Seam:** `Journal.save` over the real store.

```
describe("voluntary entry authoring")
- it should save a Review Note with Source Daily Review and a Standalone or Trade anchor, validated against the exact rendered definition revision, returning the effective Entry projection at its new revision
- it should save a Trader Reflection with its optional emotion/energy prompts unanswered (Unanswered valid optional snapshots)
- it should reject anchor references that do not resolve to a committed Trade or Execution (Unknown), writing nothing
- it should create no Debt under any path, including abandonment without Save (no draft/keystroke evidence exists — AC-JOUR-001 review-surface aspect)
```

### T9 — DailyReview.open and getDebt
**Type:** behavior-bearing. **Depends:** T2, T4, T7, VD2-T5.

Date resolution (`LatestCompleted`/`ExactCompleted`) and cutoff; correction-aware eligibility via `StateAtEconomicCutoff`; derive each eligible Trade; aggregate exact Instrument requirements with earliest relevant condition dates; (provider recovery slot: no provider exists at VD3 — current Missing keys surface directly as Manual-resolution tasks; VD4 inserts bounded recovery here); assemble one coherent read of trades, evidence, Journal outcomes/Debt, and labels; stable attention order; no write at open. `getDebt` pages global due Debt (due ≤ cutoff, not restricted to Open Trades; workflow-bound before Journal-only, then oldest due, then stable identity).

**Seam:** `DailyReview.open/getDebt` over real participants.

```
describe("DailyReview.open")
- it should return a Ready overview for an exact completed session with eligible trades ranked in the attention order, task families in the normative order (current Missing Marks → due Debt → Settlement Due → trade walk), progress, and next step — with zero writes (only provider recovery may ever write at open, and none is installed)
- it should return a Ready Empty (no eligible trades and no other required task) distinct from an error, and keep a completed review Ready on reopen
- it should make a shared current Missing Mark a single task naming every affected Trade, resolved once for all of them
- it should produce one attention order with every band reason and quantified basis returned, comparable pressure sorted descending, then Last Activity descending, then stable Trade identity
- it should rank boundary-reached trades in their higher band even after risk distance becomes zero

describe("DailyReview.getDebt")
- it should page due Debt (due time at or before the Review cutoff) with workflow-bound debt before Journal-only debt, then oldest due time, then stable identity
```

### T10 — DailyReview attention bands
**Type:** behavior-bearing. **Depends:** T9.

Transparent bands: factual/management blocker → boundary-reached → evidence-limited → quantified pressure → routine; pressure = Monetary Ongoing Risk to Stop when Value, otherwise evaluable Worst-Case Ongoing Risk; reward = Incremental Reward to Target when Value, otherwise evaluable Maximum Incremental Reward; positive-or-Unbounded risk with zero/nonpositive reward ranks Highest; finite risk against Unbounded reward ranks Zero; missing inputs Not Comparable; reasons and selected basis returned, never a stored severity.

**Seam:** attention-ranking function exposed through `DailyReview.open` results (pure ranking over derived states).

```
describe("attention band assignment")
- it should place an unresolved factual/management blocker above every other band (settlement-due routing slot holds this position once option trades exist — machinery lands here, first real exercise VD4)
- it should place a breached-stop trade in boundary-reached above quantified pressure even when its risk distance is zero
- it should place an evidence-limited trade (required Mark Missing, calculations Unavailable) above routine with the missing instrument/date as its reason
- it should rank positive-or-Unbounded risk with zero/nonpositive reward as Highest within the quantified-pressure comparison and finite risk against Unbounded reward as Zero
- it should mark trades with missing inputs Not Comparable and return that reason rather than inventing a position
```

### T11 — DailyReview.save: Actions, debt resolution, reconciliation, completion
**Type:** behavior-bearing. **Depends:** T6, T7, T8, T9.

`SaveTradeAction`: re-reads the exact Trade revision, re-resolves normalized Market evidence with `ExpectedSnapshot`, reruns derivation/replay, compares recorded vs expected Stop-Discipline occurrences, atomically stages the narrow Deviation reconciliation and the dated Action Entry; Action unique per Entry Type + Trade + Review Date (retry edits the same identity under expected revision); moment time = Review cutoff, authored = Save time; Exit/Roll/Adjust require nonblank Intent, Hold does not; saving records intent only. `ResolveReviewDebt`: journal-only Debt answered (Entry + settlement together) or declined in context; workflow-routed Debt returns `NeedsTradeWorkflow` with no write. Completion derived: Incomplete / Complete / CompleteWithUnavailableMarks (naming Instruments, Trades, affected calculation families); result returns saved outcome, reconciled occurrences, revised progress/completion, and next step under the same post-commit facts. `ReviewChanged`/`Conflict` on changed evidence with no write.

**Seam:** `DailyReview.save` over real participants and the real transaction.

```
describe("SaveTradeAction")
- it should save a one-click Hold (preselected only in view state; one explicit Save) as exactly one Daily Trade Review Entry with Source Daily Review, Trade Anchor, origin (Trade, Review Date), moment time = cutoff and authored time = save time
- it should reject Exit, Roll, or Adjust with blank Intent as typed validation, and save with Intent as intent only — creating no Trade fact and inferring no Position Change
- it should commit the dated Action and the complete create/retain/supersede Stop-Discipline reconciliation together when bound evidence establishes one new episode (AC-REV-004), recording one continuous episode with no separate explanation Debt or Entry Type
- it should retry an already-saved Action for the same Trade+Review Date as an edit of the same Entry identity under expected revision, never a duplicate
- it should return ReviewChanged with refreshed evidence and no write when a Mark, acknowledgment, Trade fact, or existing Action changed since the view binding (AC-REV-005)

describe("ResolveReviewDebt in context")
- it should answer a due Journal-only Debt by creating the settling Entry and settling the Debt in the same transaction, from the Debt's trigger-time snapshot
- it should record an allowed explicit decline in context

describe("derived completion")
- it should derive Incomplete while any eligible Trade lacks a saved Action, a required current Mark is Missing, due Debt remains, settlement or management is due, or a deterministic Deviation awaits reconciliation
- it should derive Complete when every obligation is resolved with exact current Marks
- it should derive CompleteWithUnavailableMarks when all obligations are resolved but at least one required Instrument has only an explicit acknowledgment, listing the Instruments, Trades, and affected calculation families
- it should never let an older-than-Expected-Date Mark produce a completed state
- it should resume from facts on reopen (saved Actions and Debt outcomes found; no Review Session, stage, progress-save, or finish flag exists) — AC-REV-002
```

### T12 — Trade Views: evaluated-view widening
**Type:** behavior-bearing. **Depends:** T4, T5.

`getTradeDetail` extended with evaluated sections (dated valuation, risk/reward tree with per-condition basis and Overruns, Plan-R conversions, coverage/Stale context, observation dates/source); open-list columns carry the headline evaluated figures; distinct rendering of Value/Unbounded/Unavailable/NotApplicable and covered subtotals.

**Seam:** `TradeViewsAndReporting` over the real store.

```
describe("evaluated trade detail and columns")
- it should assemble one snapshot-bound detail whose evaluated sections cite exact observation dates and source per figure
- it should keep Value, Unbounded, Unavailable, and Not Applicable visually and semantically distinct in the read model, with covered subtotals labelled
- it should expose headline risk/reward figures as list columns with their availability intact (no silent zeros)
```

### T13 — UI: the Daily Review surface and marks entry
**Type:** behavior-bearing. **Depends:** T9–T11 (built against frozen interfaces from T1).

Review landing (LatestCompleted default, exact completed dates selectable); overview with task families in normative order and progress; Missing-Marks task UI (enter Manual Mark for the exact Instrument/date, or acknowledge unavailability with a reason); attention-ranked trade list with bands, reasons, and quantified basis; per-trade review view (factual summary, evaluated results with stale context, action form with Hold preselected as unsaved view state only, Intent required for Exit/Roll/Adjust); due-Debt answering/declining in context; voluntary Review Note / Trader Reflection forms; completion banner in the three honest states; close-and-resume.

**Seam:** review surface against real modules.

```
describe("Daily Review surface")  — seam: review UI
- it should present task families in the normative order with shared Missing Marks resolved once for all affected trades
- it should complete the one-click Hold path with a single visible Save and show Missing Action as visibly incomplete, never rendered as Hold
- it should require Intent for Exit/Roll/Adjust and reject blank Intent inline without saving
- it should render the three completion states honestly (Complete / Complete With Unavailable Marks naming instruments and affected calculations / Incomplete with the blocking reasons)
- it should resume the same exact date after reload from facts, finding saved Actions and Debt outcomes without any session restore
- it should record nothing on open, select, navigate-away, or form abandonment (AC-JOUR-001 review-surface aspect)
- it should display Stale context clearly as context, never as current valuation, alongside the exact missing instrument/date
```

### T14 — UI: marks management and evaluated views in list/detail
**Type:** behavior-bearing. **Depends:** T3, T4, T12.

Manual mark entry from review and from trade detail; override/correct/acknowledge/withdraw flows with their distinct intentions; observation history inspection; evaluated columns in the open list and evaluated sections in trade detail with availability rendered distinctly.

**Seam:** marks surfaces + trade list/detail against real modules.

```
describe("marks management UI")  — seam: mark entry/history surfaces
- it should offer initial mark, override, correction-with-reason, acknowledge-with-reason, and withdraw as distinct intentions with typed validation (acknowledge rejected when a Mark exists)
- it should show immutable observation history with effective/revised versions distinguishable
- it should render open-list evaluated columns and detail evaluated sections with Missing/Stale/Unavailable/Not Applicable and covered subtotals not conflated
```

### T15 — Schema migration v1→v2
**Type:** structural. **Depends:** T3, T7.

Durable additions: Mark/acknowledgment stores with effective-head indexes, session-policy version, Daily Trade Review Action entries, Stop-Discipline occurrence records with evidence bindings.

**Verification:** migration test v1→v2 over a VD2-populated fixture store: isolated candidate, atomic activation, VD1/VD2 data intact and re-queryable, failed-migration case leaves v1 usable.

### T16 — VD3 integration suite additions + cumulative gate
**Type:** structural. **Depends:** T2–T15.

### T17 — Fresh browser-critic gate
**Type:** structural gate. **Depends:** T16.

## Progress table

| Task | Status | Evidence |
|---|---|---|
| T1 interface freeze | planned | |
| T2 session policy | planned | |
| T3 MarketData.save | planned | |
| T4 MarketData.query | planned | |
| T5 evaluate (stock) | planned | |
| T6 replay + episodes | planned | |
| T7 cutoff query + reconciliation variant | planned | |
| T8 voluntary authoring | planned | |
| T9 open/getDebt | planned | |
| T10 attention bands | planned | |
| T11 save + completion | planned | |
| T12 evaluated views | planned | |
| T13 review UI | planned | |
| T14 marks UI + columns | planned | |
| T15 migration v1→v2 | planned | |
| T16 integration gate | planned | |
| T17 critic gate | planned | |

## Mock-free real-stack integration cases (cumulative suite)

Disclosed infrastructure: `fake-indexeddb`; NYSE holiday table data module; fixtures through authoritative commands only (VD1 confirmPlan → VD2 opening → VD3 marks/review). Clock inputs are explicit Luxon instants.

| ID | Case | Real-stack path and durable-state proof |
|---|---|---|
| INT-VD3-01 | Full ritual, happy path | Fixture trade + Tuesday open → Missing-Marks family first → Manual Mark entered → debt family (VD2-deferred reflection due) answered → attention walk: one-click Hold on one trade, Exit-with-Intent on another → derived Complete; restart (fresh connection) → same date reopens with both Actions found and completion rederived Complete (AC-REV-002, AC-REV-003 aspects) |
| INT-VD3-02 | Expected-Mark normalcy (AC-MARK-001) | Noon Tue 2026-10-06 with Mon 2026-10-05 Mark → Expected Mark Date Monday, status Available, not Stale; remove Monday Mark → Friday 2026-10-02 appears as Stale context only |
| INT-VD3-03 | Acknowledgment lifecycle (AC-MARK-003) | No Mark + older evidence → acknowledge with reason → AcknowledgedUnavailable, calculations Unavailable, history visible; later exact Mark → Available; acknowledgment history retained |
| INT-VD3-04 | Atomic Action + Deviation reconciliation (AC-REV-004) | Bound evidence establishing one new stop-breach episode → save Hold → Action Entry and one continuous Stop-Discipline occurrence commit together; re-save/retry reconciles by fingerprint without duplicates |
| INT-VD3-05 | Stale-evidence rejection (AC-REV-005) | Mark changed between getTrade and save → ReviewChanged, refreshed evidence, zero Action/Deviation/Debt writes; retry on refreshed binding succeeds |
| INT-VD3-06 | Completion states (AC-REV-006) | Complete with exact Marks; CompleteWithUnavailableMarks after acknowledgment (result names Instruments/Trades/calculation families); Incomplete while a current Mark Missing; due Debt blocks completion (AC-JOUR-003 completes) |
| INT-VD3-07 | Attention ordering | Multi-trade fixture (boundary-reached / evidence-limited / quantified-pressure / routine) → returned order, reasons, and bases match the band rules; shared Missing Mark single task |
| INT-VD3-08 | Evaluated views (AC-CALC-002 single-instrument, AC-CALC-003 stock aspects) | Missing expected Mark → realized-to-date Value, marked/combined Unavailable with exact instrument/date, covered subtotal labelled; crossed stop → per-condition status + $ Overrun + zero headline; 1R frozen (AC-CALC-001 baseline aspect) |
| INT-VD3-09 | Voluntary entries | Review Note (Standalone + Trade anchors) and Trader Reflection saved with Source Daily Review; no Debt created; unresolved-form abandonment leaves Journal revisions unchanged (AC-JOUR-001 aspect) |
| INT-VD3-10 | Cutoff eligibility (AC-REV-001 aspect) | Trade opened after cutoff excluded; trade open at cutoff but since closed included in that date's eligibility; exact-date reopen stable |

## Browser-critic flows

| ID | Flow | Pass condition |
|---|---|---|
| CRIT-VD3-01 | Full happy review | Latest-completed date → enter Manual Mark → one-click Hold → Exit-with-Intent → Complete banner; reopening the same date resumes from facts |
| CRIT-VD3-02 | Missing mark → acknowledgment | Acknowledge unavailable with reason → Complete With Unavailable Marks banner naming instrument/trades/affected calculations; acknowledged state visibly a trader acknowledgment, not a price |
| CRIT-VD3-03 | Due Debt in review | VD2-deferred reflection Debt appears in the debt family before the walk; answered in context from its snapshotted form |
| CRIT-VD3-04 | Stop-breach reconciliation | Breaching mark entered during review; saving the Action surfaces the reconciled Stop-Discipline occurrence in the trade's detail |
| CRIT-VD3-05 | Voluntary capture | Review Note and Trader Reflection written from the review surface; abandonment of the form records nothing |
| CRIT-VD3-06 | Evaluated surfaces | Open-list columns and detail sections show risk/reward with distinct availability states and Stale context labeled as context; no payoff surface offered (VD4) |
| CRIT-VD3-07 | Marks management | Override and correction-with-reason behave as distinct intentions; history inspection shows immutable revisions |
| CRIT-VD3-08 | Resize + keyboard + zoom | Review walk completable keyboard-only at both widths; states distinguishable; focus logical after validation |

## Acceptance-scenario coverage

| Scenario | Plan marking @VD3 | VD3 owns | Tasks | Integration | Critic |
|---|---|---|---|---|---|
| AC-MARK-001 | Full | entire scenario | T2, T4 | INT-VD3-02 | CRIT-VD3-01/06 |
| AC-MARK-002 | Full | see Flag F6 — Manual-vs-Manual precedence machinery fully proven; provider-interaction half's evidence completes at VD4 (adapter + recover) | T3, T4 | INT-VD3-03 ( Manual precedence aspects) | CRIT-VD3-07 |
| AC-MARK-003 | Full | entire scenario | T3, T4 | INT-VD3-03 | CRIT-VD3-02 |
| AC-REV-002 | Full | task order, shared-mark-once, restart resumption, no session artifacts | T9, T11 | INT-VD3-01 | CRIT-VD3-01 |
| AC-REV-003 | Full | one-click Hold requires Save; Exit/Roll/Adjust Intent rules; intent creates no fact | T11, T13 | INT-VD3-01 | CRIT-VD3-01 |
| AC-REV-004 | Full | atomic Action + episode reconciliation, one continuous episode, fingerprints | T6, T7, T11 | INT-VD3-04 | CRIT-VD3-04 |
| AC-REV-005 | Full | changed-evidence no-write rejection with refreshed evidence | T4, T11 | INT-VD3-05 | — |
| AC-REV-006 | Full | three completion states + reversibility; void-sub-case per Flag F7 | T11 | INT-VD3-06 | CRIT-VD3-01/02 |
| AC-JOUR-003 | Completes at VD3 | due-Debt-blocks-Review now proven (blocking + never blocking factual recording) | T9, T11 | INT-VD3-06 | CRIT-VD3-03 |
| AC-POS-005 (mark-dependent Stop-Discipline occurrences aspect) | Full (aspect) | mark-dependent occurrences derived, fingerprinted, reconciled | T6, T11 | INT-VD3-04 | CRIT-VD3-04 |
| AC-CALC-001 | Partial | frozen baseline + current-risk-vs-frozen-plan; Entry Quality at VD5 | T5 | INT-VD3-08 | CRIT-VD3-06 |
| AC-CALC-002 | Partial | single-instrument availability; multi-Instrument at VD9 | T5 | INT-VD3-08 | CRIT-VD3-06 |
| AC-CALC-003 | Partial | headline + underlying-price conditions; structure-value at VD4 | T5 | INT-VD3-08 | CRIT-VD3-06 |
| AC-MARK-004 | Partial | frame/gap semantics in ranges; candle/point/gap rendering at VD7 | T4 | INT-VD3-02 (gap aspects) | — |
| AC-REV-001 | Partial | cutoff eligibility mechanics; correction restatement at VD17 | T7, T9 | INT-VD3-10 | — |
| AC-SET-003 | Partial (review-blocker half) | blocker machinery + completion rule land here; first real exercise with option trades VD4; recording at VD16 | T10, T11 | — (machinery-level unit evidence) | — |
| AC-JOUR-001 | Partial | review-surface entry forms record nothing without Save; all-surface coverage at VD13 | T8, T13 | INT-VD3-09 | CRIT-VD3-05 |

## Flagged for review (cited passages; no silent choice made)

- **F6 — AC-MARK-002 marked Full at VD3, but the provider lands at VD4.** Plan §VD3 acceptance line lists AC-MARK-002 as Full; its Given ("a provider Mark later overridden manually … recovery returns a different provider close") requires `MarketData.recover` and a provider adapter, both delivered at VD4 (plan §VD4 operations; decision 6 bundled the provider with single-leg options). VD3 as drafted proves the full Manual-precedence machinery over Manual-vs-Manual revisions (override/correction/history/withdrawal — T3/T4). Proposed resolution: VD3 delivers the machinery; AC-MARK-002's provider-interaction evidence completes at VD4 (whose review walk exercises sticky Manual marks against real recovery). Alternatively, pull a minimal `recover` with a test-only provider into VD3. Recommend the former.
- **F7 — AC-REV-006's void-reversal sub-case.** The scenario's Then includes "Voiding an Action … can make a past date Incomplete again"; Journal Void/Edit/Addendum are VD13 capabilities (decision 11; plan §VD13). VD3 proves the three completion states and fact-derived resumption; the completion derivation treats an absent Action identically to a voided one, but end-to-end void evidence can only accrue at VD13. Proposed resolution: record this sub-case as accruing at VD13 rather than claiming it at VD3.
- **F8 — Settlement Due routing has no creatable trigger at VD3.** Stock-only trades cannot produce Settlement Due; the routing slot, its top-band position, and its completion blocking are implemented and unit-proven at the module level (T10/T11), with first end-to-end exercise at VD4 when option trades exist. This matches the plan's "built and proven on open stock trades; option trades join automatically from VD4."
