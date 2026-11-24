# Trade Journal V3 — vertical deliverable plan (draft)

## Basis

**Approved stack (Phase 2):** TypeScript 7.0.2 (`@typescript/native`) + React + Vite + IndexedDB through a thin transaction adapter, `decimal.js`, injected clock + explicit U.S. trading calendar, custom versioned service worker with build-generated digest manifest, Vitest + fake-indexeddb + Playwright. typescript-eslint runs on the `@typescript/typescript6` alias because TypeScript 7 has no compiler API.

**Plan location:** `plan/vertical-deliverable-plan.md` in worktree `Hy4-Flash`.

**Phase 4 companion:** `plan/acceptance-evidence-matrix.md` maps every acceptance scenario to deliverable, task seam, TDD/structural check, mock-free integration, browser-critic flow, commands, expected durable-state proof and failure evidence.

**Phases:** 1 (comprehension) and 2 (stack choice) complete. This is the Phase 3 draft; it is not frozen.

## Decision log

- **D0 — prototype precedence — ACCEPTED (B).** Where a prototype differs from the spec, the prototype wins literally. Every concrete divergence is logged below and is a recorded product decision, not a silent reinterpretation. `review-coach-mockup` is *redesigned by* a coach (deterministic wording rules), not *as* a coach (no LLM judgment or automated coaching).
- **Boundary 1 — onboarding split — ACCEPTED.** Recording the institutions and accounts used is valid trader functionality and fundamental to later capabilities, so it is its own Deliverable 1 and carries the foundation.
- **Boundary 2 — D4/D5 split — ACCEPTED.** Daily Review is two deliverables: Phase I (current pricing, Marks, Risk/Reward) and Phase II (journaling and Action recording). Journaling is part of evaluating every trade in Phase II, not a standalone deliverable.
- **Boundary 3 — P1 and P2 — ACCEPTED BOTH.** P1: Action Save is gated until the day's Marks are resolved, with an explicit Unavailable Mark acknowledgment counting as resolved. P2: "Complete, settlement to record" is a disclosed sub-state of `Incomplete`, not a fourth domain state. Provisional AC-REV-007 must be added to `specs/acceptance/acceptance-contract.md` before freeze.
- **Standing design obligation — filtering later.** From the first slice, `browseTrades` requests carry optional filter dimensions, and list rows and report bindings expose stable identities for Lifecycle, Account, Institution, Strategy, Underlying, Tags, IdeaSource, Close Reason, Disposition and Entry/Exit Scaling. Adding filters later expands requests, projections and indexes only — never authoritative facts, schema or earlier semantics.
- **Placement — replay is mark-only — ACCEPTED.** Replay is complete using end-of-day Marks alone: a point per session and an explicit gap where absent. A provider Daily Bar may render as a candle when stored, but replay never requires one, and there is no manual OHLC entry.
- **Placement — single option legs before replay — ACCEPTED.** Step 8 precedes step 8a (Complete Trade Detail + mark-only replay), which precedes step 9 (automated EOD marks).
- **Placement — Management Revision and Rolls — ACCEPTED (deferred).** Inserted as step 15a, after metrics and multi-leg options; the trader almost never uses them.
- **Placement — corrections — ACCEPTED at step 11a.** Corrections come after spreads (10) and automated EOD marks (9), and after Backup/Restore (11).
- **Placement — reference taxonomy/form-definition config — ACCEPTED at step 12b.** Product defaults are installed by versioned, stable-keyed, idempotent seed manifests, never by ad hoc data insertion. A migration is used only when the durable representation changes; then schema and manifest versions move together through the staged candidate in step 11. Step 12b is the UI for trader-owned values and prospective form revisions.
- **P3 — implied volatility — ACCEPTED with spec reopening.** Deterministic implied-volatility inversion from observed Marks, IV/share-equivalent chips and the underlying/time/volatility price-move decomposition are implemented as **advisory explanation only**. They never feed valuation, P&L, risk/reward, Stop/Target, payoff, Daily Review completion or reports; no prediction, no LLM, no coaching. The prototype itself states "the result and what is at stake use no model." Required scope change, to be applied to `specs/README.md` and the payoff/analysis contracts before step 8a freezes: theoretical option pricing moves from outside the MVP to permitted *only* as this advisory deterministic derivation, with new acceptance scenarios and an Installed Capability Manifest entry.
- **P4 — Trade Detail figures — ACCEPTED (layout yes, composite score no).** The prototype's card hierarchy, density and figure placement are adopted. The slots are populated with canonical descriptive results — Planned Leg Fulfillment, Entry Quality, Realized R, the four fixed Deviation categories, Plan conformance and explicit coverage. No composite adherence percentage, weighted grade or good/bad judgment. The prototype's own index marks its adherence numbers non-authoritative.

## Precedence within this plan

1. Prototype for presentation, composition, interaction and workflow choreography, including literal divergences logged below.
2. Frozen `specs/` for facts, arithmetic, lifecycle, capability boundaries and acceptance semantics, except where a logged divergence overrides it.
3. A divergence that changes an acceptance scenario is recorded as an explicit scope change to the canonical specification before the affected deliverable is frozen.

## Prototype sources in this worktree

- `prototypes/trade-detail/index.html` — Trade Detail composition.
- `prototypes/replay/round-2.html` — session replay, six drawing variants, key moments.
- `prototypes/review-coach-mockup/index.html` — Daily Review with marks-first gating, settlement routing, Close Review overlay.
- `specs/reference/ui-screenshots/` — 24 canonical narrow/wide captures (visual only).

## Prototype divergences

| ID | Prototype behaviour | Spec position | Resolution | Status |
|---|---|---|---|---|
| P1 | Review blocks Action until the day's Marks are in | Spec derives Review incomplete with Missing Marks but states no Action-save block | `Missing` is a hard gate; `Acknowledged Unavailable` counts as resolved | ACCEPTED (Boundary 3) |
| P2 | Review day card has "Complete, settlement to record" | Spec states `Incomplete`, `Complete`, `CompleteWithUnavailableMarks` | Disclosed sub-state of `Incomplete`; new AC-REV-007 before freeze | ACCEPTED (Boundary 3) |
| P3 | Replay derives IV from observed Marks and shows IV/share-equivalent chips and a price-move split | Spec forbids theoretical option pricing | Derive IV deterministically from Marks; advisory explanation only, never used in valuation, risk, payoff, Review or reports. Spec reopening recorded | ACCEPTED (P3 reopening) |
| P4 | Trade Detail shows "adherence"-styled figures | Spec forbids a composite adherence score | Adopt card hierarchy and density; populate with canonical descriptive results, no composite grade | ACCEPTED (layout yes, score no) |
| P5 | Deferred Close Review carried to "next Review" | Spec allows Defer to Debt due at review time | Deferred Close Review becomes due Debt at the next Review | ACCEPTED (step 7) |

## Capability sequence

| # | Deliverable | Notes |
|---|---|---|
| 1 | Record institutions and accounts | carries the PWA/readiness/schema foundation |
| 2 | Plan only — Long Stock | |
| 3 | Open a Long Stock position | |
| 4 | Daily Review Phase I — current pricing, Marks, Risk/Reward | |
| 5 | Daily Review Phase II — journaling and Actions | P1/P2 here |
| 6 | Close a Long Stock position | |
| 7 | Close Review | P5 here |
| 8 | Single option legs — open and close | Long Call, Long Put, Cash-Secured Put; payoff here |
| 8a | Complete Trade Detail + mark-only replay | after 8, before 9 |
| 9 | Automated EOD mark retrieval | provider recovery |
| 10 | Vertical option spreads — open and close | debit/credit |
| 11 | Backup / Restore / migration | |
| 11a | Corrections and visible audit | after spreads and automated marks |
| 12 | Multi-leg option strategies — Butterflies, Iron Condors | |
| 12b | Reference taxonomy and form-definition config | trader-owned values and prospective forms |
| 13 | Aggregate Trade performance metrics | Outcomes, Exposure, Scorecard, Journal Field |
| 14 | Filters for trade list and metrics | extensibility built in from step 1 |
| 15 | Aggregate Account metrics | Account/Institution breakdowns |
| 15a | Management Revision and Rolls | deferred |
| 16 | Options expiration and assignment | explicit settlement facts |
| 17 | Covered Call and Poor Man's Covered Call | final strategy step |

## Shared resources with a single owner at a time

Schema/durable representation, seed/default manifest, Installed Capability Manifest, navigation shell, and the shared `TradeAnalysis` operations (`derive`, `evaluate`, `replay`, `assessChange`). Only one deliverable changes each at a time; later deliverables add to them in place.

---

## Deliverable 1 — Record the institutions and accounts you trade

**User stories**
1. As a trader, I want to open a safe, offline-ready journal on my device and record the institutions and accounts I actually use, so that every later trade and report refers to my real trading records.
2. As a trader, I want to see my recorded institutions and accounts with their current and historical labels, so that my reference list stays accurate and honest.

**Capability set.** The first mutating vertical slice and the reference spine for everything later. It carries the minimum foundation: Web App Manifest, versioned service worker and complete digest-valid Offline Release Inventory, every-launch and post-update Runtime Readiness with the persistence-level `RuntimeNotWritable` branch, Installed Capability Manifest, schema version 1 and the atomic transaction seam. The trader creates an Institution, creates an Account under it, and browses both with current/historical labels. PWA installation affordance, storage-protection warning and the `requestDurability` gesture exist because the readiness gate requires them. No Plan, Trade, Journal Entry, Mark, reflection, report, backup or Restore is usable yet.

**Operations / mechanisms.** `Workspace.initialize`, `getStatus`, `saveSettings` (time zone), `requestDurability`; `ReferenceCatalog.seedDefaults`, `query`, `resolve`, `save` (Institution create, Account create under a selectable Institution, typed history views). Presentation calls `ReferenceCatalog` directly for reference settings, which the dependency shape permits.

**Seeds / defaults.** Via the versioned seed manifest, atomically at initialization: all eleven canonical Strategy shapes, one IdeaSource Tag Type, five Close Reasons, five Abandonment Reasons, seven fixed Journal Entry Types with initial definitions and seven Sources, and the Workspace time zone. These are durable data, not advertised capabilities. No Institution or Account is seeded; onboarding stays `Needs Institution and Account` until the trader records a real Account.

**Durable representation.** Workspace metadata and settings; schema v1 object stores for Trade Record, Journal, Market Data and Catalog; optimistic revision tokens; immutable Institution→Account parent with rename/history revisions; seed-manifest state; indexed reference queries with stable identities.

**Acceptance scenarios.** AC-DEL-001 **full** for installed workflows, AC-DEL-003 **full**, AC-DEL-004 **full**, AC-REF-001 **full** for seed contents and `seedDefaults` idempotence, AC-RESP-001 **full** for `ReferenceCatalog.save`, AC-CAP-001 **full** for declared capabilities, AC-JOUR-007 **partial** (definitions seeded; revision in 12b), AC-DEL-005 **partial** (no backup until 11).

**Declared scope.** Only Institution/Account creation and typed browsing are installed. Rename/archive/retire, custom Strategies, Tag Types and form-definition revision are step 12b. Seeded Strategies, reasons and definitions have no selector until their using deliverable.

**Parallelism.** Domain/persistence (readiness, seeding, schema v1, catalog transaction) and UI (navigation shell, onboarding, account list) proceed in parallel once catalog command/result interfaces are fixed. Single ownership of schema v1, both seed manifests, capability manifest and navigation shell.

---

## Deliverable 2 — Plan only — Long Stock

**User stories**
1. As a trader, I want to fill a Plan form for a Long Stock with a thesis, invalidation, intended entry, Stop and Target, so that I have a frozen baseline before I risk capital.
2. As a trader, I want to confirm the Plan with one completed Plan Reflection, so that the decision and its reasoning are held together.

**Capability set.** Builds on the Accounts from step 1. The trader selects an Account and the Long Stock Strategy, completes the Plan form and Plan Reflection, confirms, and sees the resulting Planned Trade in the list and detail. The frozen Plan, positive 1R and stored `Planned` Lifecycle State commit atomically with the completed Entry.

**Operations / mechanisms.** `ReferenceCatalog.query`/`resolve` (Account and Long Stock Strategy); `Journal.getDefinitions`, `prepareEffects`/`applyPreparedEffects` (Plan Reflection); `TradeAnalysis.assessPlan`; `TradeWorkflows.confirmPlan`; `TradeRecord.prepareChange`/`applyPreparedChange`/`getRecord`/`queryRecords`; `TradeViewsAndReporting.browseTrades`/`getTradeDetail` (Planned presentation).

**Seeds / defaults.** None new; uses the step 1 seed set. The selector offers only Long Stock.

**Durable representation.** Stored `Planned` Lifecycle State; frozen Planned Legs and original management; Plan Baseline and 1R; Plan Reflection Entry with definition snapshot.

**Acceptance scenarios.** AC-PLAN-001 **full**, AC-PLAN-002 **full**, AC-DEL-001 **full** for installed workflows, AC-RESP-001 **full** for `confirmPlan`, AC-CAP-001 **full**, AC-JOUR-007 **partial**.

**Declared scope.** Only the Long Stock shape. No Execution, Mark, reflection beyond Plan Reflection, report, backup or Restore.

**Parallelism.** Domain/persistence (`assessPlan`, transaction, lifecycle binding) and UI (Plan form, Planned list/detail) in parallel once command/result interfaces are fixed. `TradeAnalysis.assessPlan` is owned here and reused by later strategy steps.

---

## Deliverable 3 — Open a Long Stock position

**User stories**
1. As a trader, I want to record the fills that opened my Long Stock Plan as one decision, so that the journal shows my real position, basis and fees.
2. As a trader, I want to answer, decline or defer the Position Change Reflection, so that recording a fact is not blocked by writing.

**Capability set.** From Planned Trade detail, record one or more opening Executions with exact instrument, quantity, price, fee and Economic Time. The system derives Instrument Position, open Lots, allocated opening fees and realized-to-date, verifies lifecycle agreement, and stores `Open`. The Reflection is completed, declined or deferred as Journal Debt without a blank Entry.

**Operations / mechanisms.** `TradeWorkflows.recordPositionChange` (opening subset); `TradeAnalysis.derive`; `TradeRecord.prepareChange`/`applyPreparedChange`/`getRecord`/`queryRecords`/`history`; `Journal.prepareEffects`/`applyPreparedEffects`/`query`; `TradeViewsAndReporting.browseTrades`/`getTradeDetail` (Open presentation).

**Seeds / defaults.** None.

**Durable representation.** Execution facts with Economic Time and Recorded Sequence; open Lot records; lifecycle index membership `Open`; Reflection Entry, decline or Debt with trigger-time definition snapshot.

**Acceptance scenarios.** AC-JOUR-003 **full**, AC-RESP-001 **full**, AC-LIFE-001 **partial** (Planned→Open only), AC-POS-002 **partial** (one decision group), AC-JOUR-005 **partial**.

**Declared scope.** No valuation or Mark until step 4; no disposal or closing Lot Matches until step 6.

**Parallelism.** Candidate records/derivation/journal transaction and the Add Execution form/reflection UI in parallel once the command contract is fixed.

---

## Deliverable 4 — Daily Review Phase I: current pricing, Marks and ongoing Risk/Reward

**User stories**
1. As a trader, I want to enter exact-date closing Marks for my instruments, so that my position's P&L reflects observed evidence rather than my fill price.
2. As a trader, I want to see ongoing risk to Stop, worst case, incremental reward and overruns update as Marks arrive, so that I can judge the trade while it is still open.

**Capability set.** Manual Mark entry with sticky precedence, deliberate override, correction and "no price" acknowledgment; exact Expected Mark Date resolution, Stale context, explicit gaps, and per-calculation `Value`/`Unbounded`/`Unavailable`/`NotApplicable`. Open Trade detail and list show Mark-to-Market valuation, independent Stop/Target conditions, ongoing Risk/Reward and covered subtotals. This is the first signature calculation, immediately after opening execution and before any close or Review ritual.

**Operations / mechanisms.** `MarketData.save`, `query` (`ResolveFrames`, `InspectObservations`); `TradeAnalysis.evaluate`; `TradeViewsAndReporting.getTradeDetail`/`browseTrades` with evaluation; `TradeAnalysis.derive` reused.

**Seeds / defaults.** Session-policy revision. No provider configuration until step 9.

**Durable representation.** Market Data store: Mark, acknowledgment and resolution revision chains with source/intention classification; evidence digest and snapshot binding.

**Acceptance scenarios.** AC-MARK-001 **full**, AC-MARK-002 **full**, AC-MARK-003 **full**, AC-CALC-001 **full**, AC-CALC-002 **full**, AC-CALC-003 **full**, AC-DEL-001 **full** for installed manual workflows, AC-MARK-004 **partial** (replay in 8a).

**Declared scope.** No provider recovery (9), no replay (8a), no Review ritual (5), no correction of a Mark (11a).

**Parallelism.** Market Data persistence and `TradeAnalysis.evaluate` in parallel with Mark-entry UI and Risk/Reward presentation once frame/result contracts are fixed.

---

## Deliverable 5 — Daily Review Phase II: journaling and Action recording

**User stories**
1. As a trader, I want a guided review of the last completed session that puts Marks first, then Debt, then settlement, then my trades, so that I finish the day with every obligation explicitly resolved.
2. As a trader, I want one-click Hold with a clear "no Action until Marks are in" gate, so that the fast path stays honest.
3. As a trader, I want reflecting on each open trade to be part of the review, so that my journal grows naturally as I evaluate positions.

**Capability set.** The second signature capability, after Phase I and before any close. Exact-date corrected eligibility; attention-ranked walk; one-click Hold with Intent required for Exit/Roll/Adjust; Action saved against exact Trade/Market bindings; due Debt routing; Settlement Due; narrow Stop-Discipline reconciliation; completion derived each time. Action Save is gated by P1; the day card uses P2. Journaling is part of evaluating each trade: the dated Daily Trade Review Entry is the journal record of the Action. Choreography follows `review-coach-mockup`.

**Operations / mechanisms.** `DailyReview.open`/`getTrade`/`getDebt`/`save`; `TradeAnalysis.replay`; `MarketData.query`; `Journal.save` and `prepareEffects`/`applyPreparedEffects` (Action Entry, Debt resolution); `TradeRecord.queryRecords` (`StateAtEconomicCutoff`) and `prepareChange`/`applyPreparedChange` (narrow Deviation reconciliation). Provider recovery is NOT called here (manual Marks only).

**Seeds / defaults.** None new; uses the initial Daily Trade Review Action definition (Hold/Exit/Roll/Adjust, Hold preselected only as unsaved view state).

**Durable representation.** Dated Action Entries keyed by Entry Type, Trade and Review Date; Debt outcomes; reconciled Stop-Discipline occurrences with stable fingerprints. No Review Session, stage, finish flag or placeholder.

**Acceptance scenarios.** AC-REV-002 **full**, AC-REV-003 **full**, AC-REV-004 **full**, AC-REV-005 **full**, AC-REV-006 **full** with P1/P2, AC-JOUR-001 **full**, AC-REV-007 **(new, provisional)** full, AC-REV-001 **partial** (corrections restate eligibility in 11a). AC-REV-007 must be added to the acceptance contract before freeze.

**Declared scope.** No provider recovery (9), corrections (11a), full replay (8a). P5 applies to step 7.

**Parallelism.** Eligibility/cutoff queries, replay, reconciliation and save transaction in parallel with the Review day card, marks table and overlay once `open`/`save` contracts are fixed. `TradeAnalysis.replay` is owned here; later steps reuse it unchanged.

---

## Deliverable 6 — Close a Long Stock position

**User stories**
1. As a trader, I want to record my exit as one Position Change with a Close Reason, so that the Trade closes with correct realized P&L and an honest Terminal Disposition.
2. As a trader, I want FIFO Lot Matches and lot-aware fees computed exactly, so that my result is reproducible.

**Capability set.** Closing Executions, FIFO Lot Matches, lot-aware opening/disposal fees, realized P&L, exactly one Close Reason for trader agency, derived Terminal Disposition, and the stored `Closed` Lifecycle State with index update. Positional conformance is assessed against the frozen Plan.

**Operations / mechanisms.** `TradeWorkflows.recordPositionChange` (terminal Long Stock subset); `TradeAnalysis.derive`; `TradeRecord.prepareChange`/`applyPreparedChange`/`getRecord`/`history`; `Journal.prepareEffects`/`applyPreparedEffects` (Position Change Reflection); `ReferenceCatalog.resolve` (Close Reason).

**Seeds / defaults.** None; Close Reasons were seeded in step 1.

**Durable representation.** Lot Match links and allocated fees; `Closed` Lifecycle State; Terminal Disposition derivation inputs; Position Change Reflection outcome.

**Acceptance scenarios.** AC-LIFE-001 **full**, AC-POS-001 **full**, AC-POS-004 **partial** (Close Reason complete; option disposition not applicable), AC-JOUR-003 **full**, AC-RESP-001 **full**.

**Declared scope.** Close Review is step 7. No options, no settlement, no management revision.

**Parallelism.** Trade Record/Analysis arithmetic and transaction work in parallel with the close form and reflection UI once the command contract is fixed.

---

## Deliverable 7 — Close Review

**User stories**
1. As a trader, I want to write, defer or decline a Close Review after a Trade closes, so that factual closure never waits on reflection.
2. As a trader, I want a deferred Close Review to become due Debt at the next Review, so that it is not silently lost.

**Capability set.** The Close Review obligation uses its own Journal obligation key, distinct from the Position Change Reflection. Completion saves an immutable Entry against the exact rendered definition revision; deferral creates Debt with the trigger-time snapshot; decline records a distinct `JournalDecline`. Closure itself never waits for this reflection. P5: a deferred Close Review becomes due Debt at the next Review.

**Operations / mechanisms.** `Journal.save`/`query`/`getDefinitions` (complete, decline, resolve Debt); `DailyReview.getDebt` surfaces the due Debt; `TradeViewsAndReporting.getTradeDetail` shows the deduplicated Journal narrative. No new Trade fact is written.

**Seeds / defaults.** None; the initial Close Review definition was seeded in step 1.

**Durable representation.** Close Review Entry with definition snapshot, decline, or Debt with due semantics; obligation-key uniqueness and settlement history.

**Acceptance scenarios.** AC-JOUR-002 **partial** (Entry versions; Addendum/Void surface in 12b/11a), AC-JOUR-005 **full**, AC-JOUR-001 **full**, AC-POS-004 **full**, AC-JOUR-003 **full**.

**Declared scope.** No new trade facts. Void/Addendum of any Entry is elaborated in later steps; the obligation semantics are complete here.

**Parallelism.** Journal obligation storage and the Close Review form UI in parallel once the save contract is fixed.

---

## Deliverable 8 — Single option leg strategies — open and close

**User stories**
1. As a trader, I want to plan and open a single option leg — Long Call, Long Put or Cash-Secured Put — so that I can trade defined-risk option ideas.
2. As a trader, I want to close a single option leg and see its payoff at expiration, so that I understand how the position ends.

**Capability set.** Extends Plan confirmation and Position Change to the three single-leg option Strategies, with exact contract selection, management coverage, a positive numeric Plan Baseline, derived Positions/Lots/Fees/P&L, Planned Leg fulfillment, and independent Planned/Current Expiration Payoff. Closing remains one explicit Position Change; no calendar inference.

**Operations / mechanisms.** `TradeWorkflows.confirmPlan`, `recordPositionChange`; `TradeAnalysis.assessPlan`, `derive`, `expirationPayoff`; `ReferenceCatalog.resolve` (Strategy shape); `Journal.prepareEffects`/`applyPreparedEffects`.

**Seeds / defaults.** None; the three Strategy shapes were seeded in step 1 and become selectable here.

**Durable representation.** Option Execution facts with exact contract; Leg intent; derived Payoff views (not stored); option Lot Matches and fees.

**Acceptance scenarios.** AC-PLAN-001 **full** for the three shapes, AC-CALC-004 **full** for payoff, AC-LIFE-001 **full**, AC-POS-002 **full**, AC-POS-005 **partial** (single-leg deviations; multi-leg in 10).

**Declared scope.** No spreads, no settlement (16), no management revision (15a), no replay view (8a). P3/P4 must be resolved before step 8a.

**Parallelism.** Option plan/analysis/transaction work in parallel with the option Plan and close forms once contracts are fixed.

---

## Deliverable 8a — Complete Trade Detail + mark-only replay

**User stories**
1. As a trader, I want one complete Trade Detail with the Plan, position, Lots, conditions, Journal narrative and integrity findings, so that I can see the whole record in one place.
2. As a trader, I want a session-by-session replay built only from end-of-day Marks with explicit gaps, so that I can see how the trade evolved without ever entering OHLC data.

**Capability set.** Production Trade Detail follows `trade-detail/index.html`: identity and badges, "Today against yesterday/entry", Stops and Targets, Position and Plan/entry, Payoff at expiration, Earlier Marks, deduplicated Journal, "Needs you", session timeline, and integrity banner. With P4 accepted, its figure slots carry canonical descriptive results — Planned Leg Fulfillment, Entry Quality, Realized R, the four Deviation categories, Plan conformance and coverage — not a composite adherence score. Replay follows `replay/round-2.html`: session slider, per-session Marks and key moments, point per session, explicit gap where absent, no interpolation. A stored provider Daily Bar may render as a candle, but is never required. With P3 accepted, replay also derives implied volatility by deterministic inversion of Black-Scholes from each observed Mark, shows IV and share-equivalent chips, and decomposes a session's option-price change into underlying / time / volatility contributions, with `Unavailable` where no volatility fits or the price barely depends on it. These are advisory explanation only. Read-only; no new facts.

**Operations / mechanisms.** `TradeViewsAndReporting.getTradeDetail`/`replayTrade`; `TradeAnalysis.replay`/`derive`/`expirationPayoff` (reused) plus the new advisory implied-volatility derivation seam; `MarketData.query` (`ReadSeries`); `Journal.query`; `ReferenceCatalog.resolve` (label lenses).

**Seeds / defaults.** None.

**Durable representation.** None authoritative; private replay/projection caches with invalidation and rebuild.

**Acceptance scenarios.** AC-CALC-004 **full**, AC-MARK-004 **full**, AC-MARK-006 **partial** (Daily Bar range evidence only when a provider Bar exists), AC-UI-002 **partial**, AC-RESP-001 **full**, **AC-IV-001 (new, provisional)** for deterministic IV inversion, `Unavailable` cases, and advisory-only separation. All prototype divergences are resolved; the new IV scenario and the P3 scope change must be added to `specs/` before step 8a freezes.

**Declared scope.** No required candles, no manual OHLC, no custom replay range, no combining replay with payoff, no composite adherence score or weighted grade. IV derivation is advisory only: no theoretical price is used for valuation, P&L, risk/reward, Stop/Target, payoff, Daily Review or reports, and no prediction or coaching is claimed.

**Parallelism.** Read assembly/analysis and SVG visualization UI in parallel once view contracts are fixed. `TradeAnalysis.replay` is reused from step 5; `expirationPayoff` from step 8.

---

## Deliverable 9 — Automated EOD mark retrieval

**User stories**
1. As a trader, I want an optional price provider to fetch eligible closing observations automatically, so that I spend less time entering Marks manually.
2. As a trader, I want provider failures and partial responses to be safe diagnostics, so that missing evidence is never turned into a fake price.

**Capability set.** Zero-or-one provider configuration with write-only credential; bounded `recover` over actual gaps and earliest relevance; Manual keys stay sticky; acknowledgments remain recoverable gaps; partial responses append only valid eligible observations; unsupported instruments and failures are transient diagnostics creating no Journal or provider-performance fact. A valid provider Daily Bar's close may seed an initial provider Mark on an empty key, but never overwrites a Manual Mark.

**Operations / mechanisms.** `MarketData.recover`, `configureProvider`, `getProviderConfiguration`; `PricingProvider.fetchClosingObservations` (the single external port); `DailyReview.open` invokes recovery in bounded batches.

**Seeds / defaults.** None product-owned; provider configuration starts Disabled/NotConfigured.

**Durable representation.** Provider configuration (nonsecret) and provenance; recovered Mark/Bar revision chains. Credentials are never returned, exported or placed in diagnostics.

**Acceptance scenarios.** AC-MARK-005 **full**, AC-MARK-006 **full**, AC-MARK-002 **full** (Manual precedence after recovery), AC-DEL-003 **full** for provider provenance, AC-CAP-001 **full**.

**Declared scope.** No streaming, webhooks, provider ranking or provider-performance analytics. Manual alternatives remain complete.

**Parallelism.** Provider adapter and Market Data recovery work in parallel with the provider settings UI once the port contract is fixed.

---

## Deliverable 10 — Vertical option spread strategies — open and close

**User stories**
1. As a trader, I want to open and close vertical debit and credit spreads on calls and puts, so that I can trade defined-risk spread structures.
2. As a trader, I want conformance assessed against both Planned Legs, so that deviations reflect the actual structure rather than a single leg.

**Capability set.** The four vertical spread Strategy shapes become selectable, with immutable strike/expiration/ratio constraints, combined Plan Baseline, per-leg fulfillment, FIFO Lot Matches per leg, allocation of fees, and Planned/Current Expiration Payoff for the co-expiring structure. One decision-level Position Change may contain all legs.

**Operations / mechanisms.** `TradeWorkflows.confirmPlan`, `recordPositionChange`; `TradeAnalysis.assessPlan`, `derive`, `expirationPayoff`; `ReferenceCatalog.resolve`; `Journal.prepareEffects`/`applyPreparedEffects`.

**Seeds / defaults.** None; the four shapes were seeded in step 1 and become selectable here.

**Durable representation.** Multi-leg option Trades with leg-linked Executions, lot matches, fees and conformance evidence.

**Acceptance scenarios.** AC-POS-002 **full**, AC-POS-005 **full**, AC-CALC-004 **full**, AC-PLAN-001 **full** for the four shapes.

**Declared scope.** No Butterflies/Iron Condors (12), no management revision (15a), no settlement (16).

**Parallelism.** Spread analysis/transaction work in parallel with the spread Plan and close forms once contracts are fixed.

---

## Deliverable 11 — Backup / Restore / migration

**User stories**
1. As a trader, I want to download a full backup and then verify the file I selected, so that I can move or protect my journal with a proven artifact.
2. As a trader, I want to restore a verified backup atomically, so that replacement is complete, reversible on failure, and never a merge.

**Capability set.** One snapshot-bound file download; read-back verification producing a `CompletedBackupReceipt`; nonmutating Restore preparation with validation, disclosed repair and isolated migration; replace-only apply gated by explicit replacement authorization and an exact-target completed receipt or explicit declined-backup acknowledgment; all sections replaced in one transaction; readiness re-established after update/Restore; schema migration through an isolated candidate with rollback and rebuild-equivalent private state.

**Operations / mechanisms.** `Workspace.exportBackup`/`confirmBackup`/`prepareRestore`/`applyPreparedRestore`; each fact module's `exportSnapshot`/`prepareRestore`/`applyPreparedRestore`; `TradeAnalysis.derive` verification; the persistence full-snapshot/atomic-replace/migration seam.

**Seeds / defaults.** None.

**Durable representation.** Backup envelope and manifest at the file boundary only; atomic all-section replacement; migration receipts; rebuilt private indexes/projections. No secrets in backup.

**Acceptance scenarios.** AC-BACK-001 **full**, AC-REST-001 **full**, AC-REST-002 **full**, AC-REST-003 **full**, AC-REST-004 **full**, AC-REBUILD-001 **full**, AC-DEL-002 **full**, AC-DEL-005 **full**, AC-DEL-006 **full**, AC-DEL-001 **full**.

**Declared scope.** Restored provider configuration becomes Needs Setup until reauthorized (step 9 contract). Migration is a task inside this deliverable, never a layer-only checkpoint.

**Parallelism.** Module section validators and the restore transaction in parallel with the download/verify/prepare/apply UI once artifact and receipt contracts are fixed. Single ownership of durable schema and capability manifest.

---

## Deliverable 11a — Corrections and visible audit

**User stories**
1. As a trader, I want to preview and then commit a correction, so that one economic history changes while the earlier version stays inspectable.
2. As a trader, I want to Void or Rebuild a fact, so that mistakes remain addressable without hiding history or reminting Trade identity.

**Capability set.** Replace keeps fact identity and adds an immutable version; Void keeps identity visible and removes economic effect; Rebuild preserves Trade identity while reconstructed facts get new identities and old Anchors resolve as historical. Correction Footprint, affected intervals, linked Trade atomicity, audit navigation and evidence-bound nonmutating preview, with visible impact acknowledgment for material changes. Mark corrections use the same audit path.

**Operations / mechanisms.** `TradeWorkflows.previewCorrection`/`commitCorrection`; `TradeAnalysis.assessChange`; `MarketData.save` (correction intention); `TradeRecord.history`/`getRecord`; `TradeViewsAndReporting.getTradeDetail` (View history); `Journal.query`.

**Seeds / defaults.** None.

**Durable representation.** Immutable fact version chains; Correction Footprints; Void versions; Rebuild facts with new identities; Journal Anchors to superseded/Voided facts; rebuilt indexes/projections.

**Acceptance scenarios.** AC-CORR-001 **full**, AC-CORR-002 **full**, AC-CORR-003 **full**, AC-CORR-004 **full**, AC-CORR-005 **full**, AC-LIFE-003 **full**, AC-REV-001 **full**.

**Declared scope.** Replay of corrected history uses the step 8a seam; no new replay behavior here.

**Parallelism.** Analysis/preview and transaction work in parallel with the impact-preview and View-history UI once preview/commit contracts are fixed. `TradeAnalysis.assessChange` is owned here and reused by later steps.

---

## Deliverable 12 — Multi-leg option strategies — Butterflies, Iron Condors

**User stories**
1. As a trader, I want to open and close Butterflies and Iron Condors, so that I can trade multi-leg defined-risk structures.
2. As a trader, I want the form to check strike order, shared expiration and equal absolute contract quantities, so that an incoherent structure is rejected before I commit.

**Capability set.** The Butterfly and Iron Condor shapes become selectable with immutable typed structural shapes (ascending strike order, one Underlying and one expiration, equal absolute quantities; put/call wing widths may differ). Plan Baseline, per-leg fulfillment, lot matches, fees, payoff with one expiration anchor, and explicit close are all handled by existing operations.

**Operations / mechanisms.** `TradeWorkflows.confirmPlan`, `recordPositionChange`; `TradeAnalysis.assessPlan`, `derive`, `expirationPayoff`; `ReferenceCatalog.resolve`; `Journal.prepareEffects`/`applyPreparedEffects`.

**Seeds / defaults.** None; the shapes were seeded in step 1.

**Durable representation.** Four-leg option Trades with leg intent, lot matches and conformance evidence.

**Acceptance scenarios.** AC-PLAN-001 **full** for both shapes, AC-POS-002 **full**, AC-CALC-004 **full**, AC-POS-005 **full**.

**Declared scope.** No management revision (15a), no settlement (16). Zero days to expiration remains a per-Plan criterion, never a Strategy identity.

**Parallelism.** Shape validation/analysis work in parallel with the multi-leg Plan and close forms once contracts are fixed.

---

## Deliverable 12b — Reference taxonomy and form-definition config

**User stories**
1. As a trader, I want to create and maintain my own Strategies, Tag Types and Tag Values, so that my trades and reports use my own vocabulary.
2. As a trader, I want to revise Journal prompts and options for future entries, so that my journal forms evolve without rewriting saved answers.

**Capability set.** Full typed `ReferenceCatalog.save`/`query`: create, rename, archive/retire, reactivate and inspect history for Institutions, Accounts, custom Strategies, Tag Types and Tag Values; stable identity and immutable parent/shape/role/policy; protected taxonomy and Rolled policies. `Journal.reviseDefinition` replaces the complete future form atomically after expected revision, with stable Prompt/Option identities and prospective effect. Product defaults still enter only through the versioned seed manifest from step 1; a new fixed shape or value before this UI exists ships as a new manifest version inside its using deliverable, never as ad hoc data insertion. A migration is used only when the durable representation changes, with schema and manifest versions moving together through the step 11 candidate.

**Operations / mechanisms.** `ReferenceCatalog.save`/`query`/`resolve`; `Journal.reviseDefinition`/`getDefinitions`.

**Seeds / defaults.** None product-owned; trader-created Strategies, Tag Types/Values and reference values become available here.

**Durable representation.** Catalog definition and revision history; Journal definition revisions; historical labels retained for old records.

**Acceptance scenarios.** AC-REF-001 **full**, AC-REF-002 **full**, AC-JOUR-004 **full**, AC-JOUR-007 **full**, AC-CAP-001 **full**.

**Declared scope.** No generic Custom strategy seed, no settlement-as-reason seeds, no arbitrary grouping, no retrospective rewrite of saved forms.

**Parallelism.** Catalog/definition persistence and form-revision analysis in parallel with the settings UI once contracts are fixed.

---

## Deliverable 13 — Aggregate Trade performance metrics

**User stories**
1. As a trader, I want Outcomes and Current Exposure reports with the six period presets, so that I can track realized performance and live risk across my journal.
2. As a trader, I want a Process Scorecard and a categorical Journal Field report with full coverage, so that I can see behavioral patterns without a composite grade.

**Capability set.** All four report families with fixed populations, natural dates, denominators, coverage, correction sensitivity, contributor navigation, `Unspecified` handling, stable identities and one Break Down By dimension with Overall retained. Report Period presets resolve in the Workspace time zone. Reports are ephemeral; none is stored.

**Operations / mechanisms.** `TradeViewsAndReporting.runReport`; `PerformanceAnalysis.outcomes`/`exposure`/`scorecard`/`journalField`; `Journal.query` (analysis projections); `MarketData.query` (Exposure binding); `ReferenceCatalog.resolve` (labels).

**Seeds / defaults.** None new; uses seed defaults and step 12b taxonomy.

**Durable representation.** None authoritative; target-scale projections with invalidation, correction, Restore and reconstruction behavior.

**Acceptance scenarios.** AC-RPT-001 **full**, AC-RPT-002 **full**, AC-RPT-003 **full**, AC-RPT-004 **full**, AC-RPT-005 **full**, AC-RPT-006 **full**, AC-REF-002 **full**, AC-CAP-001 **full** for declared report families.

**Declared scope.** No custom ranges, nested grouping, saved reports, causal claims or advisory Insights. Filter UI arrives in step 14; request shapes already accept optional filters from step 1.

**Parallelism.** The pure fold in `PerformanceAnalysis` in parallel with population assembly in `TradeViewsAndReporting` and the report UI once input/output contracts are fixed.

---

## Deliverable 14 — Filters for trade list and metrics

**User stories**
1. As a trader, I want to filter my trade list and reports by Lifecycle, Account, Institution, Strategy, Underlying, Tag, IdeaSource and other stable identities, so that I can focus on the subset I care about.
2. As a trader, I want one Break Down By dimension with Overall retained, so that I can compare groups without nested or arbitrary grouping.

**Capability set.** The filter UI and query expansion over the optional dimensions designed in from step 1. Nonempty dimensions combine with AND; values within one combine with OR; Institution expands through Accounts under one Catalog snapshot; `Unspecified` is report-only and last; inactive identities remain valid historically but blocked for new selection. Stable identities, never labels, determine membership.

**Operations / mechanisms.** `TradeViewsAndReporting.browseTrades`/`runReport` with filters; `ReferenceCatalog.resolve`/`query` for filter expansion; `PerformanceAnalysis` semantics unchanged.

**Seeds / defaults.** None; uses step 12b taxonomy and seeded defaults.

**Durable representation.** No authoritative change; expanded filter indexes/projections, rebuildable and invalidated by reference/correction/Restore changes.

**Acceptance scenarios.** AC-RPT-006 **full**, AC-UI-002 **partial**, AC-CAP-001 **full**.

**Declared scope.** No custom date ranges, nested grouping, general Boolean query, report builder or arbitrary metric.

**Parallelism.** Filter expansion and projection work in parallel with filter UI once request contracts are fixed.

---

## Deliverable 15 — Aggregate Account metrics

**User stories**
1. As a trader, I want to see performance grouped by my Accounts and Institutions, so that I can compare where my trading happens.
2. As a trader, I want Institution membership to expand through its Accounts, so that the grouping uses stable identities and historical labels remain valid.

**Capability set.** Account and Institution breakdowns over the existing four report families, using step 12b taxonomy and step 14 filters; inactive and renamed references keep historical validity while blocked for new selection; non-additive groups and coverage remain explicit.

**Operations / mechanisms.** `TradeViewsAndReporting.runReport` with Account/Institution dimensions; `PerformanceAnalysis` folds; `ReferenceCatalog.resolve` (label lenses and Account expansion).

**Seeds / defaults.** None.

**Durable representation.** None authoritative; breakdown projections with rebuild semantics.

**Acceptance scenarios.** AC-RPT-006 **full**, AC-REF-002 **full**, AC-CAP-001 **full**.

**Declared scope.** No Account Snapshots, brokerage cash reconciliation or account-equity curve; those are outside the MVP.

**Parallelism.** Dimension expansion work in parallel with the Account metrics UI once report contracts are fixed.

---

## Deliverable 15a — Management Revision and Rolls

**User stories**
1. As a trader, I want to revise a Stop or Target with a rationale, so that a management change is explicit without rewriting the frozen Plan.
2. As a trader, I want to roll part of a position into a successor Plan with typed lineage, so that ownership and the successor baseline remain clear.

**Capability set.** Immutable Management Revision fact with its Entry, resolution of Management Debt, unchanged Plan Baseline and 1R; partial Roll that closes only selected predecessor quantity, confirms a successor Plan, assigns new Executions exclusively to the successor, writes typed lineage and the Rolled Close Reason, and records one originating-Trade Position Change Reflection. Deferred per user because rarely used.

**Operations / mechanisms.** `TradeWorkflows.reviseManagement`, `recordPositionChange` (Roll subset); `TradeAnalysis.assessPlan`/`derive`/`assessChange`; `Journal.prepareEffects`/`applyPreparedEffects`; `ReferenceCatalog.resolve`.

**Seeds / defaults.** None.

**Durable representation.** Management Revision facts and Entry snapshots; Debt retirement; successor Trade and typed lineage; lifecycle bindings.

**Acceptance scenarios.** AC-CALC-001 **full**, AC-POS-003 **full**, AC-JOUR-006 **full**, AC-SET-004 **full**, AC-POS-005 **full**.

**Declared scope.** Corrections already available from step 11a; no new correction semantics here.

**Parallelism.** Roll transaction/analysis in parallel with the Plan-and-Risk management UI once command contracts are fixed.

---

## Deliverable 16 — Options expiration and assignment

**User stories**
1. As a trader, I want to record Expiration, Assignment, Exercise or cash settlement explicitly, so that the calendar never closes a Trade for me.
2. As a trader, I want allocation to a chosen Stock Trade with only residual exposure creating a successor, so that adjusted basis and premium are applied exactly once.

**Capability set.** Explicit settlement facts with Settlement Price held separately from adjusted basis/proceeds; physical delivery may establish, increase, reduce, close or reverse Stock exposure; allocation is explicit, never guessed, with bounded Needs Resolution when absent; unplanned automatic exercise is recorded honestly with Exercise lineage; settlement-created unmanaged Stock gets Management Debt; cash settlement creates no Stock successor; cash settlement plans and Exercise Intent are distinct from ordinary plans.

**Operations / mechanisms.** `TradeWorkflows.recordPositionChange` (settlement subset); `TradeAnalysis.derive`; `TradeRecord.prepareChange`/`applyPreparedChange`; `Journal.prepareEffects`/`applyPreparedEffects`; `ReferenceCatalog.resolve`.

**Seeds / defaults.** None; reasons seeded in step 1, Rolled available since step 15a.

**Durable representation.** Settlement facts with lineage and allocation; adjusted basis/proceeds; successor Stock Trades; Management Debt.

**Acceptance scenarios.** AC-SET-001 **full**, AC-SET-002 **full**, AC-SET-003 **full**, AC-SET-004 **full**, AC-LIFE-002 **full**, AC-POS-003 **full**, AC-JOUR-006 **full**.

**Declared scope.** No Account Snapshots, no cash reconciliation, no inferred Expiration, no zero-price Execution as settlement.

**Parallelism.** Settlement arithmetic/transaction in parallel with the settlement and allocation UI once command contracts are fixed.

---

## Deliverable 17 — Covered Call and Poor Man's Covered Call

**User stories**
1. As a trader, I want to plan and trade Covered Calls and Poor Man's Covered Calls, so that I can use those income structures.
2. As a trader, I want share coverage and expiration-order constraints checked before confirmation, so that the structure is coherent.

**Capability set.** The Covered Call shape (long Stock and short Call on the same Underlying, shares covering contract quantity through the multiplier) and PMCC (long later-expiration lower-strike Call and short nearer-expiration higher-strike Call, equal contract ratio) become selectable. Existing operations handle baseline, conformance, Lot Matches, payoff with one expiration anchor, close, correction, and optional Roll from step 15a. Cash-Secured Put's intent naming remains a Plan fact without claiming cash proof.

**Operations / mechanisms.** `TradeWorkflows.confirmPlan`, `recordPositionChange`; `TradeAnalysis.assessPlan`, `derive`, `expirationPayoff`; `ReferenceCatalog.resolve`; `Journal.prepareEffects`/`applyPreparedEffects`.

**Seeds / defaults.** None; both shapes were seeded in step 1.

**Durable representation.** Stock-plus-short-call and LEAPS-plus-short-call Trades with leg intent and coverage evidence.

**Acceptance scenarios.** AC-PLAN-001 **full** for both shapes, AC-CALC-004 **full**, AC-POS-002 **full**, AC-REF-001 **full** for immutable shapes.

**Declared scope.** Final strategy step. No further product capability is added after it; remaining work is evidence and hardening inside earlier deliverables.

**Parallelism.** Shape validation/analysis in parallel with the strategy Plan and close forms once contracts are fixed.

---

## Cross-deliverable obligations (not deliverables)

- Runtime Readiness, complete Offline Release Inventory, `RuntimeNotWritable` and production HTTPS evidence are obligations inside step 1 and rechecked at update/Restore boundaries in step 11.
- Seed-manifest and schema changes are tasks inside the deliverable that first needs them; new fixed data uses a new manifest version, and only representation changes use migration.
- Target-scale indexes/projections, latency benchmarks, accessibility and failure-injection evidence are obligations inside the deliverables whose capabilities they protect, especially steps 1, 4, 5, 11, 13 and 14.
- The independent browser-critic gate closes every deliverable after cumulative unit and mock-free integration suites pass.
- All prototype divergences (P1–P5) are resolved. The P3 scope change, AC-IV-001 and AC-REV-007 must be added to `specs/` before steps 8a and 5 are frozen.
