# Trade Journal V3 — Vertical Deliverable Implementation Plan

**Approved Stack:** TypeScript 7 (`@typescript/native` / `tsgo` for typechecking, paired with Microsoft's side-by-side `"typescript": "npm:@typescript/typescript6@^6.0.2"` alias workaround for `typescript-eslint` compatibility), React 19, Vite (strict port `DEV_PORT` / `5180`), Tailwind CSS v4, Native IndexedDB (`idb`) behind the internal `Persistence/Transaction` seam, `decimal.js`, `Intl` + deterministic NYSE session calendar, custom versioned Service Worker + SHA-256 `Offline Release Inventory`, Vitest + `fake-indexeddb`, Playwright + `@axe-core/playwright`.
**Plan Location:** `plan/implementation-plan.md`

---

## Shared Resources Requiring Single-Owner Serialization

Across deliverables, the following shared resources force serialization whenever a deliverable modifies them:
1. **Persistence Schema & Migration Registry** (`Persistence/Transaction` IndexedDB store version, object-store definitions, and isolated candidate forward-migration step).
2. **Installed Capability Manifest** (`Workspace` immutable capability declaration of installed operations, strategy shapes, settlement variants, and report families).
3. **Seed & Default Manifests** (`ReferenceCatalog.seedDefaults` and `Journal.seedDefaults` versioned product keys, Strategy shapes, Reasons, and Entry Type Definitions).
4. **Navigation Shell & Route Registry** (Responsive narrow bottom-tab / wide left-sidebar shell and capability-gated navigation items).
5. **Core Trade Analysis Pipeline** (`TradeAnalysis.derive` and `TradeAnalysis.evaluate` shared state structures).

---

## Ordered Vertical Deliverables

### Deliverable 1: Foundation — PWA Runtime Readiness, Workspace Initialization, and First Institution & Account Onboarding

#### User Stories
1. **As a** trader launching the app, **I would like** the application to verify browser-neutral `Runtime Readiness`, display host storage protection status with an option to request stronger durability, and block writes whenever the runtime is not `Writable`, **so that** my local journal never accepts writes in an unsafe or unverified browser environment.
2. **As a** trader opening a fresh installation, **I would like** to initialize my device-local Workspace by choosing my rules-based time zone (and later update that time zone in settings), **so that** session cutoffs and calendar dates resolve consistently in my local time zone.
3. **As a** trader onboarding into an initialized Workspace, **I would like** to create my first `Institution` and brokerage `Account`, **so that** my Workspace transitions from `Needs Institution and Account` to `Ready for Trade Planning`.

#### High-Level Capability Set
Establishes the standards-based PWA shell, Web App Manifest, versioned Service Worker, digest-verified `Offline Release Inventory`, every-launch functional `Runtime Readiness` gate (`Writable`, `Recovery Only`, `Unsupported`, and `Integrity Blocked`), advisory storage protection banner and `Workspace.requestDurability`, and the persistence-level `RuntimeNotWritable` write gate. Delivers `Workspace.initialize`, `Workspace.getStatus`, `Workspace.saveSettings` (time zone), and the minimum `Reference Catalog` capability required for onboarding: creating and listing `Institutions` and `Accounts`. No Trade, Journal, or Market Data stores exist yet.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v1):**
  - IndexedDB stores: `workspace_meta`, `reference_catalog`, and `_diagnostic_probe`.
  - Internal `Persistence/Transaction` seam enforcing `RuntimeNotWritable` outside `Writable`, atomic multi-store transactions, optimistic revision bindings, and snapshot-consistent reads.
- **Seed & Default Additions:**
  - None in D1 (no fictional Institutions or Accounts are ever seeded).
- **Module Operations Introduced:**
  - `Workspace`: `initialize`, `getStatus`, `saveSettings`, `requestDurability` (plus Installed Capability Manifest v1).
  - `ReferenceCatalog`: `save` (create `Institution` and `Account` only), `query` (`Institution` and `Account`), `resolve` (`NewSelection` for `Account`).
- **Parallelism Within Deliverable:**
  - Once TypeScript interfaces for `Workspace`, `ReferenceCatalog`, and `Persistence/Transaction` are fixed, the PWA Service Worker / `Offline Release Inventory` build plugin, IndexedDB persistence seam, and responsive UI shell (narrow bottom nav / wide left sidebar) can be built in parallel.

#### Acceptance Scenarios Satisfied
- `AC-DEL-001` (Partial — stopped app reopens offline for D1 Workspace and Account onboarding; extended in each subsequent slice)
- `AC-DEL-002` (Full — update staging, digest verification, active-form deferral, and safe reload activation)
- `AC-DEL-003` (Full — Web App Manifest, Offline Release Inventory, browser-neutral functional readiness without allowlists)
- `AC-DEL-004` (Full — Runtime Readiness gates every write, simultaneous failure reporting, advisory protection warning & durability request, `RuntimeNotWritable` at UI and persistence boundaries)
- `AC-DEL-005` (Partial — `Recovery Only` read access and `Integrity Blocked` non-overwrite; backup export/verification completed in D8)
- `AC-DEL-006` (Partial — readiness re-established on every launch, update activation, and mid-session failure; post-Restore check completed in D8)
- `AC-RESP-001` (Partial — revision-bound post-commit results for `Workspace.initialize`, `Workspace.saveSettings`, and `ReferenceCatalog.save`)
- `AC-UI-001` (Full — live responsive adaptation between narrow bottom-nav and wide left-sidebar without losing route or unsaved form values)
- `AC-UI-002` (Partial — Loading, Ready, Empty, Error states and WCAG AA keyboard/contrast on D1 views)
- `AC-CAP-001` (Full — Installed Capability Manifest honestly declares only D1 capabilities; updated in each subsequent slice)

> **Declared Scope:** `AC-DEL-005` and `AC-DEL-006` cover launch/update/runtime failure here and complete backup/Restore coverage in `D8`. `ReferenceCatalog` covers `Institution` and `Account` creation here; full reference maintenance (`rename`, `archive`/`retire`, `reactivate`, `IdeaSource`, `Tags`, custom `Strategies`) completes in `D17`.

---

### Deliverable 2: Long Stock Plan Confirmation, Plan Reflection, and Planned Trade Views

#### User Stories
1. **As a** trader preparing a `Long Stock` trade, **I would like** to confirm a Plan with an intended entry price, share quantity, original Stop and Target boundaries, and a completed `Plan Reflection` (Thesis and Invalidation), **so that** my frozen `Plan Baseline` (`1R`) is verified and my Trade is saved atomically in the `Planned` Lifecycle State.
2. **As a** trader reviewing my setups, **I would like** to browse my `Planned` Trades and open a `Planned` Trade Detail view showing my frozen leg, Stop/Target boundaries, `1R`, and anchored `Plan Reflection`, **so that** I can inspect my trade plan before entering the market.

#### High-Level Capability Set
Introduces `Trade Record`, `Trade Analysis`, `Trade Workflows`, `Journal`, and `Trade Views and Reporting` for the first step of the `Long Stock` happy path. Seeds only the `Long Stock` Strategy and `Plan Reflection` Entry Definition. Validates `Long Stock` Plan coherence, computes `Plan Baseline` (`Original Planned Risk` = `1R`, `Original Planned Reward`, reward/risk ratio, independent-OR Stop/Target nearest monetary boundary), rejects incomplete/incoherent plans with zero writes (`AC-PLAN-002`), commits the Trade at `Planned` alongside its immutable `Plan Reflection` Entry in one transaction, and renders the `Planned` Trade list and detail views.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v2 + Migration v1→v2):**
  - Adds `trade_records`, `lifecycle_index`, `journal_definitions`, and `journal_entries` stores.
- **Seed & Default Additions:**
  - `ReferenceCatalog.seedDefaults` (v1): Seeds only `Long Stock` Strategy (the only selectable strategy in D2).
  - `Journal.seedDefaults` (v1): Seeds only `Plan Reflection` Entry Definition (required Thesis, required Invalidation, optional Conviction 1–5, optional Primary emotion) and Source `Plan Confirmation`.
- **Module Operations Introduced:**
  - `ReferenceCatalog`: `seedDefaults` (v1).
  - `Journal`: `seedDefaults` (v1), `getDefinitions`, `prepareEffects`, `applyPreparedEffects`, `query` (Trade narrative scope).
  - `TradeAnalysis`: `assessPlan` (`Long Stock` leg coherence, Stop/Target monetary boundaries, positive `1R`), `derive` (`Planned` expected state and lifecycle agreement).
  - `TradeRecord`: `prepareChange` (`ConfirmPlan`), `applyPreparedChange`, `getRecord`, `queryRecords` (`CurrentState: Planned`, `Summary` and `AnalysisInput` batches).
  - `TradeWorkflows`: `confirmPlan`.
  - `TradeViewsAndReporting`: `browseTrades` (`Planned`), `getTradeDetail` (`Planned`).
- **Parallelism Within Deliverable:**
  - Pure `TradeAnalysis.assessPlan` (`decimal.js` baseline math) and `TradeRecord`/`Journal` IndexedDB stores can proceed in parallel with the New Plan wizard and Planned Trade Detail UI once `ConfirmPlanCommand` and `TradeDetailView` contracts are fixed.

#### Acceptance Scenarios Satisfied
- `AC-PLAN-001` (Partial — `Long Stock` Plan confirmation freezes Plan, Planned Leg, original management, `Planned` state, positive `1R`, and `Plan Reflection` atomically; option strategies added in D6, D9, D12, D18)
- `AC-PLAN-002` (Full — incomplete/incoherent confirmation returns typed rejections and writes nothing)
- `AC-LIFE-001` (Partial — `Planned` lifecycle and index agreement; `Open` added in D3, `Closed` in D5)
- `AC-LIFE-003` (Partial — structured lifecycle disagreement blocks/surfaces on read without silent repair; Lot Match/Deviation/Restore repair completed in D3, D4, D8)
- `AC-REF-001` (Partial — `Long Stock` Strategy seeded; remaining strategies/reasons/tags added in D5, D6, D9, D12, D17, D18, D20)
- `AC-JOUR-001` (Partial — unsaved `Plan Reflection` form state records no evidence on cancel/resize/navigation)
- `AC-JOUR-007` (Partial — idempotent seeding of `Plan Reflection`)
- `AC-RESP-001` (Partial — post-commit result for `confirmPlan` renders Planned Trade Detail without read-back)

> **Declared Scope:** `AC-PLAN-001` covers `Long Stock` here; single options (`D6`), vertical spreads (`D9`), multi-leg option strategies (`D12`), and `Covered Call` (`D18`) complete it.

---

### Deliverable 3: Opening Stock Execution, Position Derivation, Entry Conformance, and Position Change Reflection

#### User Stories
1. **As a** trader entering a confirmed `Long Stock` Plan, **I would like** to record an opening `Position Change` with my Execution price, share quantity, fee, and Economic Time, and either complete, decline, or defer the `Position Change Reflection`, **so that** my Trade transitions atomically to `Open` with derived Stock Position and `Open Lot` without ever blocking factual capture on deferred reflection.
2. **As a** trader inspecting my newly opened `Long Stock` Trade, **I would like** to see `Planned Leg Fulfillment` (`Filled as Planned`, `Partially Filled`, `Filled with Deviation`), deterministic entry `Deviations` (`Planned-Leg Terms`, `Entry Size`, `Unplanned Exposure`), and `Entry Quality` compared against my frozen `1R`, **so that** I can evaluate how my actual entry compared to my Plan.
3. **As a** trader who deferred a `Position Change Reflection` or wants to jot down a standalone note, **I would like** to answer or decline my outstanding `Journal Debt` and write voluntary `Trader Reflection` or `Review Note` entries, **so that** I can clear my reflection obligations and capture discretionary thoughts.

#### High-Level Capability Set
Advances the `Long Stock` happy path from `Planned` to `Open`: `TradeWorkflows.recordPositionChange` for opening Stock Executions, derived `Instrument Position` and `Open Lot` with unconsumed opening fee, `Entry Resolution Point` and `Entry Quality`, deterministic entry `Deviations`, `Position Change Reflection` (`Complete`, `Decline`, or `Defer` as `Journal Debt`), direct `Journal.save` for settling `Position Change Reflection` Debt and creating voluntary `Review Note` / `Trader Reflection` entries, and `Open` Stock Trade browse/detail views.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v3 + Migration v2→v3):**
  - Adds Position Change, Execution, Open Lot, and recorded Deviation structures to `trade_records`, plus `journal_debts`, `execution_anchors`, and `instrument_index`.
- **Seed & Default Additions:**
  - `Journal.seedDefaults` (v2): Seeds `Position Change Reflection`, `Review Note`, and `Trader Reflection` Entry Definitions, plus Sources `Position Change`, `Trade Detail`, and `Journal`.
- **Module Operations Introduced:**
  - `TradeWorkflows`: `recordPositionChange` (opening Stock executions, Planned-Leg intent, reflection disposition).
  - `TradeAnalysis`: extends `derive` for `Open` state, `InstrumentPosition`, `OpenLot`, unconsumed opening fees, `PlannedLegFulfillment`, `EntryResolutionPoint`, `EntryQuality`, and deterministic entry Deviations (`Planned-Leg Terms`, `Entry Size`, `Unplanned Exposure`).
  - `TradeRecord`: extends `prepareChange`/`applyPreparedChange` for `PositionChange`, adds `resolveAnchors` (Trade & Execution anchors).
  - `Journal`: `save` (direct `CreateEntry` for `Review Note`/`Trader Reflection` and `ResolveDebt` for `Position Change Reflection`), extends `query` for timeline and Outstanding Debt.
  - `TradeViewsAndReporting`: updates `browseTrades` and `getTradeDetail` for `Open` Stock Trades.
- **Parallelism Within Deliverable:**
  - Pure `TradeAnalysis.derive` (Position, Open Lot, Entry Quality, entry Deviations) and `Journal` Debt storage can run in parallel with the Add Execution sheet/drawer and Open Stock Detail UI.

#### Acceptance Scenarios Satisfied
- `AC-LIFE-001` (Partial — transitions `Planned` -> `Open` with index and derived agreement; `Closed` completed in D5)
- `AC-POS-001` (Partial — opening Stock Execution, Open Lot creation, lot-aware opening fee tracking; closing FIFO match completed in D5 and multi-entry scaling in D11)
- `AC-POS-005` (Partial — `FilledAsPlanned`, `PartiallyFilled`, `FilledWithDeviation`, `UnplannedExposure` on Stock entry; option `NotVerifiable` and multi-leg `NotEntered` completed in D6, D12)
- `AC-CALC-001` (Partial — frozen `1R` preserved and `Entry Quality` resolved at `Entry Resolution Point`; scaling and Management Revision invariance completed in D11, D21)
- `AC-JOUR-003` (Full — Defer creates `Journal Debt` with trigger-time snapshot and no placeholder Entry; factual capture succeeds)
- `AC-JOUR-005` (Partial — unique obligation key per Position Change prevents duplicate outcomes; Void reopen completed in D22)
- `AC-JOUR-007` (Partial — adds `Position Change Reflection`, `Review Note`, `Trader Reflection` definitions)
- `AC-RESP-001` (Partial — post-commit result for `recordPositionChange` and `Journal.save`)

> **Declared Scope:** `AC-POS-001` covers opening Executions and Open Lots here; closing FIFO Lot Matches complete in `D5` and multi-entry scaling in completes in `D11`.

---

### Deliverable 4: Signature Capability — Manual Marks, Ongoing Risk/Reward Valuation, and Daily Review Ritual

#### User Stories
1. **As a** trader holding an `Open` Stock Trade after the market close, **I would like** to record a `Manual Mark` (or `Unavailable Mark Acknowledgment`) on the `Expected Mark Date`, **so that** my Trade displays accurate `Mark-to-Market Valuation`, `Ongoing Risk to Stop`, `Worst-Case Ongoing Risk`, `Incremental Reward to Target`, `Overrun`, and `Plan-R` figures without ever substituting fill cost or stale prices.
2. **As a** trader conducting my after-close routine, **I would like** to open the guided `Daily Review` for a completed U.S. session, resolve Missing Marks and due Journal Debt, walk my eligible Open Trades in attention-ranked order, and save my Daily Trade Review `Action` (including the preselected one-click `Hold` path) with atomic `Stop Discipline` episode reconciliation, **so that** my daily review reaches an honest `Complete` or `Complete with Unavailable Marks` state.
3. **As a** trader inspecting the historical progression of an Open Trade or previewing a Manual Mark correction, **I would like** to view the session-by-session `Trade Replay` (preserving explicit gaps) and preview the impact of changing a shared Mark (`previewMarkChange`), **so that** I can see how my Trade's valuation and condition statuses evolved across completed sessions.

#### High-Level Capability Set
Delivers the product's signature after-close loop on an `Open` Stock Trade right before closing a position: `Market Data` manual observations (`Manual Mark`, override, correction with `previewMarkChange`, and `Unavailable Mark Acknowledgment`), `Expected Mark Date` session resolution (including prior completed session during an active day and `Stale` context), `TradeAnalysis.evaluate` and `replay` (Mark-to-Market valuation, `Ongoing Risk to Stop`, `Worst-Case Ongoing Risk`, `Incremental Reward to Target`, `Maximum Incremental Reward`, `Stop Overrun`, `Target Overrun`, continuous `Stop Discipline` breach episodes, and replay series with explicit gaps), and the full `Daily Review` ritual (`open`, `getTrade`, `getDebt`, `save` with one-click `Hold` and atomic `Stop Discipline` reconciliation). (`Management Revisions` are deferred to D21.)

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v4 + Migration v3→v4):**
  - Adds `market_observations` store (revision chains for Marks and Unavailable Acknowledgments per `InstrumentKey + TradingDate`) and narrow Deviation reconciliation support on `trade_records`.
- **Seed & Default Additions:**
  - `Journal.seedDefaults` (v3): Adds `Daily Trade Review` (Action: `Hold`, `Exit`, `Roll`, `Adjust`; conditional `RequireWhenOption` Intent text; optional Conviction, Considered, Note) Entry Definition and Source `Daily Review`.
- **Module Operations Introduced:**
  - `MarketData`: `save` (initial Manual Mark, override, correction, assert/withdraw unavailable acknowledgment), `query` (`ResolveFrames`, `InspectObservations`, `ReadSeries` with `MarketDataSnapshotId`).
  - `TradeAnalysis`: `evaluate`, `replay` (completed-session series, explicit gaps, continuous `Stop Discipline` episode fingerprints), `assessChange` (for Mark change preview).
  - `DailyReview`: `open`, `getTrade`, `getDebt`, `save` (`SaveTradeAction` with narrow `Stop Discipline` reconciliation and `ResolveReviewDebt`).
  - `TradeViewsAndReporting`: `replayTrade`, `previewMarkChange`, and enriched `Open` Trade browse/detail views with valuation & risk/reward cards.
- **Parallelism Within Deliverable:**
  - `MarketData` store + NYSE session calendar, pure `TradeAnalysis.evaluate`/`replay`, and `DailyReview` coordinator can be developed in parallel with the Daily Review UI and Replay view once `TradeEvaluation` and `OpenDailyReviewResult` types are fixed.

#### Acceptance Scenarios Satisfied
- `AC-MARK-001` (Full — prior completed session is `Available` during active session; older Mark is `Stale` context only)
- `AC-MARK-003` (Full — Unavailable Acknowledgment never becomes a price; superseded by later exact Mark while preserving history)
- `AC-MARK-004` (Partial — series and replay preserve explicit gaps and close-only Mark points without interpolation; Daily Bar candles completed in D7)
- `AC-CALC-002` (Full — independent calculation availability: realized P&L stays `Value` when Mark is `Missing`/`Unavailable`; no fill-cost or Stale substitution)
- `AC-CALC-003` (Full — independent-OR underlying and structure Stops/Targets, Ongoing Risk, Worst-Case Risk, Incremental Reward, Plan-R conversions, Overrun, and non-Deviation classification of Target)
- `AC-REV-001` (Partial — exact-date `StateAtEconomicCutoff(Open)` eligibility; correction restatement completed in D23)
- `AC-REV-002` (Partial — normative task ordering: Missing Marks -> Due Debt -> Eligible Trade walk, shared Mark resolution once across Trades, stateless resumption across restart; Settlement Due slot completed in D14)
- `AC-REV-003` (Full — preselected `Hold` in unsaved view state requires explicit Save; `Exit`/`Roll`/`Adjust` require Intent; saves intent only without creating Trade facts)
- `AC-REV-004` (Full — saving Daily Review Action atomically reconciles continuous `Stop Discipline` episode without daily duplicates)
- `AC-REV-005` (Full — changed Market Data snapshot, Trade revision, or existing Action rejects stale Save with `ReviewChanged`/`Conflict` and no write)
- `AC-REV-006` (Full — `Incomplete`, `Complete`, and `CompleteWithUnavailableMarks` derived states and reversibility)
- `AC-CORR-005` (Partial — `previewMarkChange` is nonmutating and evidence-bound; Trade fact `previewCorrection` completed in D23)

> **Declared Scope:** `AC-MARK-004` covers close-only Mark points and explicit gaps here; Daily Bar candles complete in `D7`. `AC-REV-002` covers Marks, Debt, and Trade walk here; `Settlement Due` completes in `D14`.

---

### Deliverable 5: Closing a Long Stock Position, FIFO Lot Matching, Realized P&L/R, and Close Review

#### User Stories
1. **As a** trader exiting an `Open` Long Stock Trade, **I would like** to record a closing `Execution` with a required `Close Reason` and a `Close Review` disposition (`Complete`, `Decline`, or `Defer`), **so that** my Trade transitions atomically to `Closed` with exact FIFO `Lot Matches`, lot-aware fee allocation, final realized P&L, `Realized R`, and derived `Terminal Disposition`.
2. **As a** trader reviewing my completed trades, **I would like** to filter and sort my `Closed` Trades by `Terminal Time` and inspect the `Closed` Trade Detail view (showing FIFO `Lot Matches`, incurred fees, `Realized R`, `Closed via` Terminal Disposition vs. `Close Reason`, and `Close Review`), **so that** I have a complete end-to-end record of my closed stock trade.

#### High-Level Capability Set
Completes the **full happy-path lifecycle for the `Long Stock` strategy** (`Planned` -> `Open` -> Daily Review / Ongoing Risk -> `Closed`). Seeds the 5 canonical `Close Reasons` and the `Close Review` Entry Definition. Implements FIFO `Lot Match` generation, proportional opening and disposing fee allocation across lots without double counting, final realized P&L and `Realized R` (`net P&L / 1R`), required `Close Reason` on trader-agency exit, derived `Terminal Disposition`, and `Close Review` obligation handling (`Complete`, `Decline`, or `Defer` as `Journal Debt`).

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v5 + Migration v4→v5):**
  - Adds active `LotMatch` links, `CloseReason` reference, and `TerminalTime` index to `trade_records`.
- **Seed & Default Additions:**
  - `ReferenceCatalog.seedDefaults` (v2): Seeds the 5 canonical `Close Reasons` (`Target Reached`, `Stop Triggered`, `Thesis Invalidated`, `Time-Based Exit`, `Rolled`) with `SeededValuesRemainSelectable` protection.
  - `Journal.seedDefaults` (v4): Seeds `Close Review` Entry Definition and Source `Trade Close`.
- **Module Operations Introduced:**
  - `TradeAnalysis`: extends `derive` for FIFO `LotMatch` creation, proportional opening/closing fee consumption, `Closed` expected state, `TerminalDisposition`, `Realized R`, and `Entry/Exit Scaling` (`SingleEntrySingleExit`).
  - `TradeWorkflows`: extends `recordPositionChange` for closing Executions, `CloseReason` validation, and separate `Close Review` obligation key (`Source: Trade Close`).
  - `TradeViewsAndReporting`: updates `browseTrades` (`Closed` filter and `TerminalTime` sort) and `getTradeDetail` (FIFO Lot Matches table, realized P&L/R, `Closed via` Terminal Disposition vs. `Close Reason`).
- **Parallelism Within Deliverable:**
  - Pure FIFO `LotMatch` and fee allocation in `TradeAnalysis.derive` can proceed in parallel with the Close Position modal/drawer and Closed Trade Detail UI.

#### Acceptance Scenarios Satisfied
- `AC-LIFE-001` (Full — complete `Planned` -> `Open` -> `Closed` lifecycle, index membership, derived agreement, and separation of `Terminal Disposition` from `Close Reason`)
- `AC-POS-001` (Partial — single-entry and closing Executions, exact FIFO Lot Matches, lot-aware fee allocation without double-counting; multi-entry scaling in completed in D11)
- `AC-POS-004` (Partial — terminal trader-agency exit requires one active `Close Reason`, derives `Terminal Disposition`, and never blocks on deferred/declined `Close Review`; non-agency settlement part completed in D14)
- `AC-JOUR-007` (Partial — 6 of 7 fixed Entry Types seeded; `Management Revision` completed in D21)

> **Declared Scope:** `AC-POS-004` covers trader-directed exits here; non-agency terminal settlement without a `Close Reason` completes in `D14`.

---

### Deliverable 6: Single-Option Strategies (`Long Call`, `Long Put`, `Cash-Secured Put`)

#### User Stories
1. **As a** trader planning a single-leg option trade, **I would like** to confirm a Plan using `Long Call`, `Long Put`, or `Cash-Secured Put` with exact option contract terms or complete objective selection criteria (and optional `Exercise Intent` for long options), **so that** my option `Plan Baseline` (`1R`) and frozen monetary Stop/Target boundaries are validated before entry.
2. **As a** trader executing and managing single-leg option trades, **I would like** to record opening and closing option Executions (with contract multiplier `100`), mark my option Positions in `Daily Review`, and verify conformance against exact or objective Planned Leg criteria, **so that** my option Positions, FIFO lots, ongoing risk/reward, and `Planned-Leg Terms` Deviations are tracked accurately through closure.

#### High-Level Capability Set
Extends the happy-path trade lifecycle (`Planned` -> `Open` -> Daily Review / Mark-to-Market -> `Closed`) to pure single-leg option strategies: introduces option instruments (Underlying, Expiration Date, Strike, Call/Put, multiplier `100`), seeds `Long Call`, `Long Put`, and `Cash-Secured Put`, and supports exact-contract and objective-criteria Planned Legs (yielding `FilledAsPlanned`, `FilledWithDeviation`, or `NotVerifiable` when external chain evidence is absent) plus underlying-price option Stop frozen monetary loss boundaries. (`Expiration Payoff` is sequenced in D13 after Vertical Spreads and Legging In, and `Covered Call` is sequenced in D18.)

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v6 + Migration v5→v6):**
  - Extends Instrument keys and Planned Leg / Execution schemas in `trade_records` and `market_observations` for option contracts (`underlying`, `expirationDate`, `strike`, `optionType`, `multiplier: 100`, objective selector criteria, and `exerciseIntent`).
- **Seed & Default Additions:**
  - `ReferenceCatalog.seedDefaults` (v3): Adds Strategy seeds `Long Call`, `Long Put`, and `Cash-Secured Put`.
- **Module Operations Introduced:**
  - `TradeAnalysis`: extends `assessPlan`, `derive`, and `evaluate` for option multipliers (`100`), underlying-price option Stop frozen monetary boundary, and objective-criteria `NotVerifiable` vs. `FilledWithDeviation`.
- **Parallelism Within Deliverable:**
  - Option `assessPlan`/`derive`/`evaluate` logic in `TradeAnalysis` can be built in parallel with the Option Plan form and Option Trade Detail UI.

#### Acceptance Scenarios Satisfied
- `AC-PLAN-001` (Partial — adds `Long Call`, `Long Put`, `Cash-Secured Put`, objective leg criteria, and underlying-price option Stop frozen monetary loss boundary)
- `AC-POS-005` (Partial — adds option contract term mismatch grouping into one `Planned-Leg Terms` occurrence and `NotVerifiable` for objective selectors lacking chain evidence)
- `AC-REF-001` (Partial — adds the 3 pure single-option Strategy seeds)

> **Declared Scope:** `AC-PLAN-001` and `AC-REF-001` cover `Long Stock` and the 3 single-option strategies here; vertical spreads (`D9`), `PMCC`/`Iron Condor` (`D12`), and `Covered Call` (`D18`) complete the 11 Strategy seeds.

---

### Deliverable 7: Automated Mark Retrieval, Pricing Provider Port, and Daily Bars

#### User Stories
1. **As a** trader configuring market data, **I would like** to enable or disable a `Pricing Provider` with write-only credential protection, **so that** my Workspace can automatically recover closing observations without ever exposing or exporting my API secret in plain text, diagnostics, or backups.
2. **As a** trader opening `Daily Review`, **I would like** the system to automatically recover missing closing `Marks` and `Daily Bars` (`OHLC`) for relevant Instruments while keeping my `Manual Marks` sticky and treating provider errors as non-blocking transient diagnostics, **so that** routine after-close valuation is automated without compromising Manual precedence.
3. **As a** trader evaluating trailing or price-range conditions and viewing Trade Replay, **I would like** single-instrument conditions to use same-date `Daily Bar` highs/lows and replay charts to render `Daily Bars` as candles alongside close-only Mark points and explicit gaps, **so that** intraday range breaches and historical price action are represented honestly.

#### High-Level Capability Set
Completes `Market Data` and the external `Pricing Provider` port: provider configuration (`Disabled`, `Enabled` with redacted credential status, `Needs Setup`), automatic bounded gap recovery (`MarketData.recover`) triggered during `DailyReview.open`, `Daily Bar` (`OHLC`) storage and validation, `Manual Mark` stickiness when provider closes and Daily Bars arrive, Daily Bar high/low range evaluation for single-instrument conditions in `Trade Analysis` (while multi-instrument structures strictly use synchronized same-date exact Marks), and candle rendering in `replayTrade`.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v7 + Migration v6→v7):**
  - Adds `provider_config` store (separating non-exportable local secret storage from exportable non-secret provider metadata) and `DailyBar` revision chains in `market_observations`.
- **Module Operations Introduced:**
  - `PricingProvider`: `fetchClosingObservations` (external port + HTTP adapter and deterministic local loopback/test provider adapter).
  - `MarketData`: `recover`, `getProviderConfiguration`, `configureProvider`.
  - `DailyReview`: wires `open` to invoke `MarketData.recover` for aggregated earliest Instrument relevance bounds.
  - `TradeAnalysis`: extends `evaluate` and `replay` to apply `Daily Bar` high (long single-instrument) and low (short single-instrument) rules while preserving synchronized exact-Mark evaluation for multi-instrument structures.
- **Parallelism Within Deliverable:**
  - `PricingProvider` adapter + `MarketData.recover` gap compression and `TradeAnalysis` Daily Bar condition logic can proceed in parallel with the Provider Settings UI and Replay Candlestick renderer.

#### Acceptance Scenarios Satisfied
- `AC-MARK-002` (Full — `Manual Mark` remains sticky when provider recovery returns a different close and valid `Daily Bar`; Bar is retained independently)
- `AC-MARK-004` (Full — series and replay render explicit gaps, close-only Mark points, and Daily Bar candles without interpolation)
- `AC-MARK-005` (Full — bounded provider recovery skips Manual keys, recovers acknowledged/missing gaps, turns current Missing keys into Manual tasks, and keeps provider failures as transient diagnostics only)
- `AC-MARK-006` (Full — long single-instrument uses Bar high, short uses Bar low, multi-instrument uses synchronized exact Marks, and gaps prove neither breach nor recovery)

---

### Deliverable 8: Full Workspace Backup, Read-Back Verification Receipt, Migration Verification, and Atomic Replace-Only Restore

#### User Stories
1. **As a** trader protecting my device-local journal, **I would like** to export a full, digest-valid Workspace backup as a browser file download (excluding any provider credentials) and verify my saved file by selecting it for read-back check, **so that** I receive a `CompletedBackupReceipt` proving my saved file is complete and matches the exact Workspace snapshot.
2. **As a** trader restoring or transferring my Workspace, **I would like** to preview an untrusted backup artifact without mutating live data—seeing exact record counts, schema migrations, derived-state repairs, or validation errors—and then atomically replace my entire Workspace after confirming replacement and satisfying the safety-backup requirement, **so that** my journal is portable and recoverable without ever risking a partial or merged state.

#### High-Level Capability Set
Placed immediately after Automated Mark Retrieval (where provider credentials first exist so secrets exclusion is immediately tested and enforced): delivers `Workspace.exportBackup`, `Workspace.confirmBackup` (`CompletedBackupReceipt`), `Workspace.prepareRestore`, and `Workspace.applyPreparedRestore`, along with `exportSnapshot`, `prepareRestore`, and `applyPreparedRestore` across all four authoritative fact modules (`TradeRecord`, `Journal`, `MarketData`, `ReferenceCatalog`). Enforces secrets exclusion, SHA-256 section and full-artifact digests, isolated candidate forward migration from older schema versions, analytical agreement verification/repair via `TradeAnalysis.derive`, safety-backup enforcement (requiring an exact-target `CompletedBackupReceipt` or explicit warning-acknowledged decline when live data exists), all-section atomic replacement, and private index/projection rebuild equivalence.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation:**
  - Adds `WorkspaceBackupManifest` envelope, section digest canonicalizer, `CompletedBackupReceipt` verification binding, and full-store atomic replacement + index reconstruction in `Persistence/Transaction`.
- **Module Operations Introduced:**
  - `Workspace`: `exportBackup`, `confirmBackup`, `prepareRestore`, `applyPreparedRestore`.
  - `TradeRecord`: `exportSnapshot`, `prepareRestore`, `applyPreparedRestore`.
  - `Journal`: `exportSnapshot`, `prepareRestore`, `applyPreparedRestore`.
  - `MarketData`: `exportSnapshot`, `prepareRestore`, `applyPreparedRestore` (excluding credentials; active provider becomes `Needs Setup` on restore).
  - `ReferenceCatalog`: `exportSnapshot`, `prepareRestore`, `applyPreparedRestore`.
- **Parallelism Within Deliverable:**
  - Per-module `exportSnapshot`/`prepareRestore` validators can be implemented in parallel with the Backup Download/Verify & Restore Preview/Apply UI flows.

#### Acceptance Scenarios Satisfied
- `AC-BACK-001` (Full — coherent single-snapshot backup across all 4 sections, concurrent mutation exclusion, secrets exclusion, `Downloaded` vs. `Completed` with `CompletedBackupReceipt` on read-back verification, and `Not Completed`/`Not Verified` failure states)
- `AC-REST-001` (Full — non-mutating `prepareRestore` validates digests, versions, cross-section references, isolated forward migrations, and disclosed repair of stale derived agreement vs. rejection of incoherent facts)
- `AC-REST-002` (Full — replace-only confirmation and safety-backup gate: rejects unverified download or stale receipt; accepts only exact-target `CompletedBackupReceipt` or explicit decline with warning acknowledgment)
- `AC-REST-003` (Full — all-section atomic replacement rolls back completely on injected section failure; invalidates pre-Restore views and returns fresh status/landing state on success)
- `AC-REST-004` (Full — startup update migration failure preserves prior Workspace uncorrupted and recoverable; retry activates atomically)
- `AC-DEL-005` (Full — completes `Recovery Only` backup export and read-back verification coverage)
- `AC-DEL-006` (Full — completes Runtime Readiness re-evaluation immediately after Restore)
- `AC-REBUILD-001` (Partial — proves rebuild equivalence after Restore and private index reconstruction for all capabilities through D8; extended as new domain facts and reports are added in D10–D23)

> **Declared Scope:** `AC-REBUILD-001` covers all facts and views through D8 here; `D10` extends rebuild equivalence to all 4 deterministic report families and later slices extend their backup schemas accordingly.

---

### Deliverable 9: Vertical Spreads & Multi-Leg Simultaneous Execution

#### User Stories
1. **As a** trader planning a defined-risk vertical spread, **I would like** to confirm a Plan using `Vertical Call Debit Spread`, `Vertical Call Credit Spread`, `Vertical Put Debit Spread`, or `Vertical Put Credit Spread`, **so that** strike order, common underlying, equal contract ratio, co-expiration constraints, and multi-leg `Plan Baseline` (`1R`) are enforced.
2. **As a** trader entering or exiting a vertical spread in a single order, **I would like** to record both option legs as multiple Executions inside one decision-level `Position Change` with a single `Position Change Reflection`, **so that** my spread legs are grouped under one decision identity and evaluated with synchronized multi-leg Marks.

#### High-Level Capability Set
Seeds the 4 vertical spread Strategies (`Vertical Call Debit Spread`, `Vertical Call Credit Spread`, `Vertical Put Debit Spread`, `Vertical Put Credit Spread`), validates multi-leg structural constraints (strike ordering, common underlying, equal expiration, equal contract quantities) and net debit/credit `Plan Baseline` (`1R`) in `TradeAnalysis.assessPlan`, supports multi-Execution grouped entry/exit in `TradeWorkflows.recordPositionChange`, and computes multi-leg synchronized valuation and structure-value Stops/Targets.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation:** Updates seed/capability manifest version to v9.
- **Seed & Default Additions:**
  - `ReferenceCatalog.seedDefaults` (v4): Adds `Vertical Call Debit Spread`, `Vertical Call Credit Spread`, `Vertical Put Debit Spread`, and `Vertical Put Credit Spread`.
- **Module Operations Introduced:**
  - `TradeAnalysis`: extends `assessPlan`, `derive`, and `evaluate` for 2-leg vertical debit/credit spreads, structure-value Stops/Targets, and partial-coverage subtotal disclosure when one leg's Mark is missing.
  - `TradeWorkflows`: extends `recordPositionChange` UI and coordinator validation for multi-leg grouped Executions in a single decision.
- **Parallelism Within Deliverable:**
  - Vertical spread shape validation and multi-leg `TradeAnalysis` math can be developed in parallel with the multi-leg Plan builder and multi-row Add Execution form.

#### Acceptance Scenarios Satisfied
- `AC-POS-002` (Full — multi-leg option decision recorded as one `Position Change` with shared decision identity, distinct Execution identities, per-leg conformance, and a single `Position Change Reflection` outcome)
- `AC-PLAN-001` (Partial — adds the 4 Vertical Spread strategies)
- `AC-REF-001` (Partial — adds the 4 Vertical Spread Strategy seeds)

---

### Deliverable 10: Deterministic Performance Reporting (`Outcomes`, `Current Exposure`, `Process Scorecard`, `Journal Field`) & Target-Scale Verification

#### User Stories
1. **As a** trader evaluating my financial results and current portfolio risk across stock, option, and vertical spread trades, **I would like** to run deterministic `Outcomes` and `Current Exposure` reports across approved `Report Periods` (`All Time`, `Year to Date`, `Quarter to Date`, `Month to Date`, `This Week`, `Last Week`), filters, and single-dimension `Break Down By` groupings, **so that** I can inspect win rates, Profit Factor, realized dollar/R curves, covered exposure subtotals, and contributor drill-downs with full coverage disclosure.
2. **As a** trader auditing my trading process and psychological patterns, **I would like** to run the descriptive `Process Scorecard` and categorical `Journal Field` reports, **so that** I can review Plan outcomes, `Below-Plan Entry Rate`, Deviation frequencies, Stop/Target episodes, and reflection completion without opaque composite grades or causal claims.
3. **As a** trader with a mature 5-year journal (25,000 Trades, up to 200 Open Trades, ~200,000 facts), **I would like** cold startup to complete in $\le 2,500\text{ ms}$ (p95) and warm open-list navigation in $\le 1,500\text{ ms}$ (p95) offline with full rebuild equivalence, **so that** my journal remains fast and trustworthy over years of use.

#### High-Level Capability Set
Placed right after Vertical Spreads so the trader has rich reporting over stock, single-option, and spread trades as soon as core trading and backup are in place: delivers `PerformanceAnalysis` (`outcomes`, `exposure`, `scorecard`, `journalField`) and `TradeViewsAndReporting.runReport`, all 6 `Report Period` calendar presets in the Workspace time zone, filter dimensions and single-dimension `Break Down By` groupings (keeping `Overall` visible, report-only `Unspecified` last), contributor navigation to exact Trades/Entries, and deterministic 25,000-Trade / 200,000-fact scale and latency verification (`AC-PERF-001`, `AC-REBUILD-001`). Later deliverables (`D11` Scaling, `D13` Expiration Payoff, `D14` Option Disposition Timing, `D17` Tags/IdeaSource, `D20` Abandoned Plans, `D22` Journal Edit/Void, `D23` Corrections) automatically feed their new dimensions and sensitivity disclosures into these installed report families.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation:**
  - Adds secondary query/report acceleration indexes in `Persistence/Transaction` (verified rebuildable from authoritative facts alone) and updates Installed Capability Manifest to v10.
- **Module Operations Introduced:**
  - `PerformanceAnalysis`: `outcomes`, `exposure`, `scorecard`, `journalField`.
  - `TradeViewsAndReporting`: `runReport`.
- **Parallelism Within Deliverable:**
  - The four pure `PerformanceAnalysis` report functions (`outcomes`, `exposure`, `scorecard`, `journalField`) have zero shared mutable state and can be implemented in parallel with the Reports UI (KPI cards, breakdown tables, cumulative dollar/R charts, and contributor drill-down links) once `ReportViewRequest` and `DeterministicReportView` types are fixed.

#### Acceptance Scenarios Satisfied
- `AC-RPT-001` (Full — all 6 Report Period calendar presets resolved in Workspace time zone; `This Week` = Monday–today, `Last Week` = prior Monday–Sunday; holidays/weekends preserved; `Current Exposure` has no Report Period)
- `AC-RPT-002` (Partial — `Outcomes` headlines, Win/Breakeven/Loss, Profit Factor edge cases, exact median, cumulative realized-dollar curve, Closed-Trade-R curve, and deterministic tie-breaking; partial Open realization and correction sensitivity completed in D11 and D23)
- `AC-RPT-003` (Full — `Current Exposure` finite covered subtotals, named `Unbounded` and `Unavailable` cohorts, independent P&L components, single-count OR condition Overrun, and like-covered portfolio ratio)
- `AC-RPT-004` (Partial — `Process Scorecard` metric-specific natural dates and denominators, Plan outcome cohorts, `Below-Plan Entry Rate`, 4 Deviation categories, Stop/Target episodes vs. gaps, and reflection outcomes; `Option Disposition Timing`, `Abandoned`, and correction sensitivity completed in D14, D20, D23)
- `AC-RPT-005` (Partial — `Journal Field` categorical partition for Single Select and Scale; Tag Select, Edit/Void disclosure completed in D17, D22)
- `AC-RPT-006` (Partial — AND-across / OR-within filters, Institution expansion, `Break Down By` Strategy/Underlying/Account/Institution, `Overall` preservation, page exhaustion proof, and contributor navigation; `Entry/Exit Scaling`, `Option Disposition Timing`, and `Tag`/`IdeaSource` breakdowns completed in D11, D14, D17)
- `AC-REBUILD-001` (Full — proves target-scale rebuild equivalence across lists, details, replays, reviews, and all 4 report families)
- `AC-PERF-001` (Full — 25,000 Trades, 200 Open Trades, ~200,000 facts benchmark proving cold startup p95 $\le 2,500\text{ ms}$ and warm open-list navigation p95 $\le 1,500\text{ ms}$ offline without N+1 queries or all-history replay)

> **Declared Scope:** `AC-RPT-002`, `AC-RPT-004`, `AC-RPT-005`, and `AC-RPT-006` deliver all 4 report families here for the domain concepts installed through D9, and gain `Entry/Exit Scaling` (`D11`), `Option Disposition Timing` (`D14`), `Tag`/`IdeaSource` breakdowns (`D17`), `Abandoned` cohort (`D20`), `Edit`/`Void` disclosure (`D22`), and `Correction Footprint` sensitivity (`D23`) as those capabilities are introduced.

---

### Deliverable 11: Scaling In & Partial Exits Across Multiple Position Changes

#### User Stories
1. **As a** trader scaling into a Trade across multiple decisions, **I would like** to record additional opening `Position Changes` at different times, prices, and fees, **so that** my `Entry Resolution Point` and `Entry Quality` aggregate all opening fills and fees until planned quantity is met or cut off by the first exposure reduction, while `Entry Size` Deviations detect over-sizing or entry shortfall.
2. **As a** trader scaling out of a Position in stages, **I would like** to record partial closing `Position Changes` before my final exit, **so that** FIFO `Lot Matches` consume my earliest `Open Lots` and proportional fees first, partial realized P&L is included in `Outcomes` cumulative dollar curves and `Current Exposure` realized-to-date P&L, and my Closed Trade is classified as `Scaled` under `Entry/Exit Scaling` (including in report filters and breakdowns).

#### High-Level Capability Set
Completes multi-decision scaling in and scaling out: multi-lot FIFO consumption across sequential opening and disposing `Position Changes`, exact `Entry Resolution Point` cutoff semantics (window closes when all Planned Legs are filled or immediately before the first exposure-reducing Position Change), `Entry Size` Deviation detection (excess quantity on entry or shortfall at resolution), and `Entry/Exit Scaling` classification (`SingleEntrySingleExit` vs. `Scaled` by counting decision-level Position Changes, not fills or legs) across Trade Detail and `Performance Analysis` reports.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation:** Updates capability manifest to v11; persists `Entry/Exit Scaling` and multi-decision `Entry Resolution Point` derivations in `DerivedTradeReconciliation`.
- **Module Operations Introduced:**
  - `TradeAnalysis` & `PerformanceAnalysis`: completes `derive` and report breakdown/filtering for multi-decision scaling in/out, `Entry Resolution Point` cutoff before first reduction, `Entry Size` shortfall/excess Deviations, and `Entry/Exit Scaling` (`Scaled` vs. `SingleEntrySingleExit`).
- **Parallelism Within Deliverable:**
  - Pure `TradeAnalysis` entry-window cutoff and multi-lot FIFO scaling logic can proceed in parallel with Trade Detail lot-consumption and `Entry/Exit Scaling` report filter/breakdown UI updates.

#### Acceptance Scenarios Satisfied
- `AC-POS-001` (Full — multi-entry opening Executions at different prices/fees followed by partial and final closing Executions, exact FIFO Lot Matches, single fee allocation, and partial realization while `Open`)
- `AC-CALC-001` (Partial — scaled actual entry resolves `Entry Quality` once at `Entry Resolution Point` against frozen `1R` and is never rewritten by later adds after cutoff; Management Revision invariance completed in D21)
- `AC-RPT-002` (Partial — adds partial realization from still-`Open` Trades to the cumulative realized-dollar curve)
- `AC-RPT-006` (Partial — enables `Entry/Exit Scaling` filter and `Break Down By` dimension in reports)

---

### Deliverable 12: Legging In & Multi-Leg Strategies (`PMCC` & `Iron Condor`)

#### User Stories
1. **As a** trader planning complex multi-leg option structures, **I would like** to confirm Plans for `Iron Condor` (4 legs in ascending strike order with independent put/call wing widths) and `PMCC` (diagonal call spread with later-expiration lower-strike long Call and nearer-expiration higher-strike short Call), **so that** multi-leg option strategies are supported with frozen `Plan Baselines` (`1R`).
2. **As a** trader legging into a multi-leg Plan across separate `Position Changes`, **I would like** each entered leg to be tracked independently while untouched legs show `Unfilled` while open and transition to `Not Entered` if the Trade closes before they are entered, **so that** multi-decision leg fulfillment and `Entry Resolution Point` work accurately across 2-leg and 4-leg structures.

#### High-Level Capability Set
Adds `PMCC` and `Iron Condor` Strategy seeds (10 of 11 canonical Strategy seeds; `Covered Call` is sequenced in D18) and delivers multi-decision legging into multi-leg Plans (including `Not Entered` fulfillment status when a partially entered Trade closes before all Planned Legs are touched).

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation:** Updates seed/capability manifest to v12.
- **Seed & Default Additions:**
  - `ReferenceCatalog.seedDefaults` (v5): Adds `PMCC` and `Iron Condor` Strategy seeds.
- **Module Operations Introduced:**
  - `TradeAnalysis`: extends `assessPlan` for `PMCC` and `Iron Condor` (4-leg ascending strike order, independent wing widths) and `derive` for multi-leg legging-in and `NotEntered` leg fulfillment.
- **Parallelism Within Deliverable:**
  - `PMCC` and `Iron Condor` shape validation and legging-in fulfillment logic in `TradeAnalysis` can be developed in parallel with the 4-leg Plan form and per-leg fulfillment status badges in Trade Detail.

#### Acceptance Scenarios Satisfied
- `AC-PLAN-001` (Partial — all pure stock and option multi-leg strategies supported in Plan confirmation; `Covered Call` completed in D18)
- `AC-POS-005` (Full — completes `NotEntered` for untouched leg when a legged-in Trade closes, alongside `PartiallyFilled`, `FilledAsPlanned`, `FilledWithDeviation`, `UnplannedExposure`, and `NotVerifiable`)

---

### Deliverable 13: Mark-Free Expiration Payoff Curve & Structural Risk/Reward Extrema

#### User Stories
1. **As a** trader evaluating a planned or open option Trade (single-option, `Vertical Spread`, `Iron Condor`, or `PMCC`), **I would like** to view independent `Planned` and `Current` piecewise-linear `Expiration Payoff` curves alongside dated `Mark-to-Market Valuation`, **so that** I can inspect exact breakeven zero crossings/touches/ranges, signed payoff extrema, attainment sets, and realized-to-date offsets (while `PMCC` mixed expirations honestly report `Unavailable` and flat/stock-only Trades report `Not Applicable`).
2. **As a** trader viewing ongoing risk/reward across Trade Detail, Trade Browse, Daily Review, and `Current Exposure` reports, **I would like** `Maximum Incremental Reward` and `Worst-Case Ongoing Risk` on co-expiring option structures to integrate structural payoff extrema with current marked P&L and realized-to-date offsets, **so that** all places displaying incremental reward and worst-case risk reflect exact structural boundaries.

#### High-Level Capability Set
Dedicated deliverable for `TradeAnalysis.expirationPayoff` and structural option extrema across the application: computes independent `Planned` and `Current` piecewise-linear settlement curves over nonnegative underlying prices $[0, +\infty)$, derives the normalized `Payoff Zero Set` (`Crossing`, `Touch`, `Zero Range`), `Payoff Maximum`, and `Payoff Minimum` with complete attainment sets or `Unbounded Above`/`Below`, incorporates realized-to-date net P&L and unconsumed opening fees into the `Current` curve, returns `Unavailable` for mixed-expiration structures (`PMCC`) and `Not Applicable` for flat or stock-only positions, and updates Trade Detail, Trade Browse, Daily Review attention/risk cards, and `Current Exposure` with structural `Maximum Incremental Reward` and `Worst-Case Ongoing Risk`.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation:** Updates capability manifest to v13.
- **Module Operations Introduced:**
  - `TradeAnalysis`: `expirationPayoff`; updates `evaluate` so `Maximum Incremental Reward` and `Worst-Case Ongoing Risk` on co-expiring multi-leg option structures use exact structural payoff extrema.
  - `TradeViewsAndReporting` & `DailyReview`: adds `ExpirationPayoffViews` to `getTradeDetail` and `DailyReview.getTrade` (with accessible payoff graph + tabular zero/extrema readout) and updates incremental reward / worst-case risk displays across browse, detail, review, and `Current Exposure`.
- **Parallelism Within Deliverable:**
  - Pure `TradeAnalysis.expirationPayoff` piecewise-linear solver can be built and unit-tested in parallel with the accessible Expiration Payoff SVG chart/table component and incremental-reward UI updates.

#### Acceptance Scenarios Satisfied
- `AC-CALC-004` (Partial — independent `Planned` and `Current` Expiration Payoff curves with zero crossings/touches/ranges, extrema, attainment sets, realized offset while open, `Not Applicable` when flat or stock-only, and `Unavailable` for multiple expirations; mixed stock + option `Covered Call` payoff completed in D18)

---

### Deliverable 14: Explicit Option Expiration, Cash Settlement, Settlement Due, and Option Disposition Timing

#### User Stories
1. **As a** trader holding an option at or past expiration, **I would like** `Daily Review` and Trade Detail to flag `Settlement Due` without ever inferring expiration from the calendar, and allow me to record explicit `Expiration` or cash-settlement `Position Changes` without requiring a trader-agency `Close Reason`, **so that** non-agency option settlements close my Position honestly and derive accurate `Terminal Disposition`.
2. **As a** trader analyzing my closed option trades in Trade Detail and `Performance Analysis` reports, **I would like** each closed option Trade to be classified under `Option Disposition Timing` as `Fully Disposed Pre-Expiration`, `Fully Held to Expiration Settlement`, or `Mixed`, **so that** I can filter, break down, and score my option trades by how their quantities were disposed.

#### High-Level Capability Set
Delivers explicit non-physical option settlement facts (`Expiration` and `CashSettlement`), the `Settlement Due` blocker task family (#3 in normative `Daily Review` order), non-agency terminal closure (requiring no `Close Reason` while deriving `Terminal Disposition` from mechanisms), and `Option Disposition Timing` classification across `TradeAnalysis.derive`, `Process Scorecard`, and `Break Down By` report groupings.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v8 + Migration v7→v8 + Backup Section Update):**
  - Adds `Expiration` and `CashSettlement` settlement members and `OptionDispositionTiming` reconciliation to `trade_records`.
- **Module Operations Introduced:**
  - `TradeAnalysis`: extends `derive` for `Expiration` and `CashSettlement` facts, `Settlement Due` detection, and `OptionDispositionTiming` (`FullyDisposedPreExpiration`, `FullyHeldToExpirationSettlement`, `Mixed`).
  - `TradeWorkflows`: extends `recordPositionChange` for explicit `Expiration` and cash settlement (requiring no `Close Reason` when non-agency settlement closes the Trade).
  - `DailyReview`: enables the `Settlement Due` blocker task family (#3 in normative order).
  - `PerformanceAnalysis` & `TradeViewsAndReporting`: enables the `Option Disposition Timing` section in `Process Scorecard` and the `Option Disposition Timing` filter and `Break Down By` dimension in reports.
- **Parallelism Within Deliverable:**
  - `Expiration`/`CashSettlement` derivation and `OptionDispositionTiming` classification can run in parallel with the Explicit Expiration modal and Daily Review `Settlement Due` blocker UI.

#### Acceptance Scenarios Satisfied
- `AC-SET-003` (Full — passed expiration date is never auto-expired from the calendar; shows `Settlement Due` and keeps Daily Review `Incomplete` until explicit settlement is recorded)
- `AC-POS-004` (Full — completes non-agency terminal settlement requiring no `Close Reason` while deriving `Terminal Disposition` from actual mechanisms)
- `AC-REV-002` (Full — completes all 4 normative Daily Review task families in exact order: Missing Marks -> Due Debt -> Settlement Due -> Eligible Trade walk)
- `AC-RPT-004` & `AC-RPT-006` (Partial — completes `Option Disposition Timing` scorecard section, filter, and `Break Down By` dimension)

---

### Deliverable 15: Physical Option Assignment & Exercise, Stock Allocation, and Management Debt

#### User Stories
1. **As a** trader experiencing physical `Assignment` or `Exercise` on an option, **I would like** to record the settlement with its `Settlement Price` and explicitly allocate the resulting Stock quantity to a compatible existing Stock Trade or a residual settlement-origin Stock Trade (never guessed when ambiguous), **so that** my option premium adjusts Stock basis/proceeds exactly once and all linked Trades commit atomically.
2. **As a** trader whose physical option settlement creates new unmanaged Stock exposure, **I would like** the workflow to atomically create workflow-routed `Management Debt` (and block prose-only settlement in `Daily Review` and `Journal` with `NeedsTradeWorkflow`), **so that** I am routed to establish complete management or close the Stock exposure.

#### High-Level Capability Set
Completes physical option settlements (`Assignment` and `Exercise`): physical delivery Stock basis/proceeds adjustment (short-put assignment buys at strike minus premium; short-call assignment sells at strike plus premium; long-call exercise buys at strike plus premium; long-put exercise sells at strike minus premium, each applied once while keeping `Settlement Price` distinct), explicit destination Stock Trade allocation (`NeedsResolution` when multiple compatible Stock Trades exist and none is specified), residual settlement-origin Stock Trade creation without a duplicate Plan Reflection, `Exercise Intent` conformance vs. unplanned automatic exercise lineage, and workflow-routed `Management Debt`.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v9 + Migration v8→v9 + Backup Section Update):**
  - Adds `Assignment` and `Exercise` settlement members, settlement-origin Plan context, cross-Trade Stock allocation links, and workflow-routed `Management Debt` metadata in `trade_records` and `journal_debts`.
- **Module Operations Introduced:**
  - `TradeAnalysis`: extends `derive` for physical `Assignment` and `Exercise`, strike + single-premium basis/proceeds math, and `Exercise Intent` conformance.
  - `TradeRecord`: extends `prepareChange` to return bounded `NeedsResolution` with eligible Stock Trade identities when physical settlement allocation is omitted/ambiguous.
  - `TradeWorkflows`: extends `recordPositionChange` for physical settlement allocations, residual Stock Trade creation, and atomic `Management Debt` creation.
  - `DailyReview` & `Journal`: rejects prose-only settlement of workflow-routed `Management Debt` with `NeedsTradeWorkflow`.
- **Parallelism Within Deliverable:**
  - Pure `TradeAnalysis` physical-settlement basis/proceeds math can be built in parallel with the Assignment/Exercise Allocation workflow UI.

#### Acceptance Scenarios Satisfied
- `AC-SET-001` (Full — physical Assignment/Exercise updates allocated existing Stock Trade and creates residual Stock Trade only for remainder; keeps `Settlement Price` distinct from adjusted basis/proceeds; applies option premium once; updates all linked Trades atomically)
- `AC-SET-002` (Full — ambiguous Stock allocation is never guessed; returns `NeedsResolution` with eligible identities and writes nothing)
- `AC-SET-004` (Full — short-option physical assignment is planned settlement; long-option voluntary exercise is authorized only with explicit `Exercise Intent`; unmanaged new Stock exposure creates workflow-routed `Management Debt`; cash settlement creates no Stock successor)
- `AC-JOUR-006` (Partial — workflow-routed `Management Debt` rejects direct Journal/Review prose settlement with `NeedsTradeWorkflow` and settles when exposure is removed; settlement via `reviseManagement` completed in D21)

> **Declared Scope:** `AC-JOUR-006` covers `Management Debt` creation, `NeedsTradeWorkflow` rejection, and resolution via exposure removal here; resolution via `reviseManagement` completes in `D21`.

---

### Deliverable 16: Full Option Rolls & Predecessor/Successor Lineage

#### User Stories
1. **As a** trader rolling an entire open option position to a new expiration or strike, **I would like** to record a full `Roll` as a single `Position Change` that closes the predecessor Trade with the required `Rolled` `Close Reason`, confirms a successor Plan with its own frozen `1R` and `Plan Reflection`, assigns new opening Executions exclusively to the successor Trade, and records one originating-Trade `Position Change Reflection`, **so that** the predecessor closure and successor opening commit atomically.
2. **As a** trader inspecting a Trade that was rolled or created by a Roll, **I would like** to view and navigate the typed predecessor/successor lineage on Trade Detail, **so that** I can trace my rolled positions without conflating their separate Trade records and `1R` baselines.

#### High-Level Capability Set
Delivers full-position `Roll` workflows through `TradeWorkflows.recordPositionChange`: closes the full predecessor exposure, enforces the workflow-role `Rolled` `Close Reason` on the predecessor, confirms the successor Plan with its own frozen `Plan Baseline` (`1R`) and `Plan Reflection`, assigns new Executions exclusively to the successor, writes typed predecessor/successor lineage, and commits both Trades and Journal outcomes in one transaction.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v10 + Migration v9→v10 + Backup Section Update):**
  - Adds cross-Trade `PositionChange` participation links and typed `Roll` predecessor/successor lineage records in `trade_records`.
- **Module Operations Introduced:**
  - `TradeAnalysis`: extends `assessChange` and `derive` for cross-Trade full `Roll` reconciliation.
  - `TradeWorkflows`: extends `recordPositionChange` for full `Roll` (predecessor close with `Rolled` Close Reason + successor Plan confirmation + one originating-Trade `Position Change Reflection`).
  - `TradeViewsAndReporting`: displays predecessor/successor Roll lineage navigation on `getTradeDetail`.
- **Parallelism Within Deliverable:**
  - Cross-Trade `Roll` preparation in `TradeRecord`/`TradeWorkflows` can proceed in parallel with the Roll wizard UI and Trade Detail lineage card.

#### Acceptance Scenarios Satisfied
- `AC-POS-003` (Partial — full Roll closes predecessor with `Rolled` Close Reason, confirms successor Plan and `1R`, assigns new Executions exclusively to successor, and commits lineage and reflections atomically; partial Roll quantity preservation completed in D19)

> **Declared Scope:** `AC-POS-003` covers full Rolls here; partial Rolls leaving untouched holdings in the predecessor complete in `D19`.

---

### Deliverable 17: Reference Catalog Maintenance (`IdeaSource`, `Trade Tags`, Rename, Archive/Retire, and Reactivate)

#### User Stories
1. **As a** trader organizing my setups and journal responses, **I would like** to create, rename, and retire `IdeaSource` values and custom `Tag Types` / `Tag Values`, and attach them to my Plans and Journal prompts, **so that** I can classify, filter, and break down my Trades and `Journal Field` reports by idea origin and custom taxonomies.
2. **As a** trader maintaining my `Institutions`, `Accounts`, `Strategies`, and `Reasons` over time, **I would like** to rename, archive or retire, and reactivate reference items while enforcing parent/child and seeded protection rules, **so that** retired items are blocked for new selections while historical Trades, Journal Entries, and reports remain valid and display both historical and current labels.

#### High-Level Capability Set
Dedicated deliverable completing all `Reference Catalog` maintenance capabilities: seeds the `IdeaSource` Tag Type, enables full create/rename/archive/retire/reactivate across `Institution`, `Account`, `Strategy` (including retiring seeded Strategies and creating custom typed Strategy shapes), `Tag Type`, `Tag Value`, `Close Reason`, and `Abandonment Reason`, enforces namespace distinguishability and `SeededValuesRemainSelectable` / `Rolled` / `IdeaSource` protections, and implements `HistoricalSnapshot` / `RetainedReference` / `DisplayOnly` label lenses and `Tag`/`IdeaSource` report breakdowns in `Trade Views and Reporting`, `Performance Analysis`, and `Journal`.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v11 + Migration v10→v11 + Backup Section Update):**
  - Adds full label/availability revision history and `TagType`/`TagValue` records to `reference_catalog`.
- **Seed & Default Additions:**
  - `ReferenceCatalog.seedDefaults` (v6): Seeds the semantic `IdeaSource` Tag Type.
- **Module Operations Introduced:**
  - `ReferenceCatalog`: completes `save` (rename, archive/retire, reactivate, custom Tag Types/Values, custom Strategy creation), `query` (`Selectable-only` vs. `Include-inactive` + item history), and `resolve` (`NewSelection`, `NewTagValueSelectionUnderExistingBinding`, `RetainedReference`, `HistoricalSnapshot`, `DisplayOnly`).
  - `TradeViewsAndReporting` & `PerformanceAnalysis`: expands filters and `Break Down By` for `Tag` (non-additive multi-membership) and `Idea Source`, and enables `Tag Select` prompts in `journalField` reports.
- **Parallelism Within Deliverable:**
  - `ReferenceCatalog` revision/protection rules can proceed in parallel with the Reference Catalog Settings UI and Tag/IdeaSource pickers.

#### Acceptance Scenarios Satisfied
- `AC-REF-001` (Partial — 10 Strategy seeds, 5 Close Reasons, and `IdeaSource` Tag Type verified with exact role order and retirement policies; `Covered Call` completed in D18 and 5 Abandonment Reasons completed in D20)
- `AC-REF-002` (Partial — historical/retained references remain valid with historical and current labels while new selection is blocked and concurrent retirement between resolve and commit conflicts; correction retention completed in D23)
- `AC-RPT-005` & `AC-RPT-006` (Full — completes `Tag Select` Journal Field reports and `Tag` / `Idea Source` filter and `Break Down By` dimensions with current/historical label lenses)

> **Declared Scope:** `AC-REF-001` covers Strategies through D17, Close Reasons, and `IdeaSource` here; `Covered Call` completes in `D18` and the 5 `Abandonment Reasons` complete in `D20`.

---

### Deliverable 18: Covered Call Strategy (Mixed Stock + Short Call)

#### User Stories
1. **As a** trader planning a covered-stock trade, **I would like** to confirm a `Covered Call` Plan combining a long Stock leg and a short Call leg on the same underlying with enforced share coverage (`100` shares per short Call contract) and a frozen `Plan Baseline` (`1R`), **so that** all 11 canonical Strategy shapes are supported.
2. **As a** trader executing, marking, and settling a `Covered Call` Trade, **I would like** my mixed Stock + short Call position to compute combined Mark-to-Market valuation, combined `Expiration Payoff` (capped upside above the short Call strike, downside offset by collected call premium), and physical short-call `Assignment` share delivery, **so that** my covered call lifecycle is tracked accurately from entry through expiration or call-away.

#### High-Level Capability Set
Dedicated deliverable isolating the mixed-asset complexity of `Covered Call` (the only canonical Strategy combining a `Stock` leg and an `Option` leg in a single Plan): seeds `Covered Call` (completing all 11 canonical Strategy seeds), enforces the `100` shares per short Call contract coverage constraint in `TradeAnalysis.assessPlan`, extends `TradeAnalysis.derive`, `evaluate`, and `expirationPayoff` for mixed Stock + short Call positions, and supports `Covered Call` multi-leg entry/legging-in and short-call assignment share delivery.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation:** Updates seed/capability manifest to v18.
- **Seed & Default Additions:**
  - `ReferenceCatalog.seedDefaults` (v7): Adds `Covered Call` Strategy seed (completing all 11 canonical Strategy seeds).
- **Module Operations Introduced:**
  - `TradeAnalysis`: extends `assessPlan`, `derive`, `evaluate`, and `expirationPayoff` for mixed long Stock + short Call positions and `100`-share contract coverage.
- **Parallelism Within Deliverable:**
  - Pure `TradeAnalysis` mixed stock+option baseline, valuation, and payoff math can proceed in parallel with the Covered Call Plan builder and Trade Detail mixed-leg UI.

#### Acceptance Scenarios Satisfied
- `AC-PLAN-001` (Full — all 11 canonical Strategy shapes, including `Covered Call`, supported in Plan confirmation)
- `AC-CALC-004` (Full — completes `Planned` and `Current` `Expiration Payoff` curves across all option and covered-stock structures)
- `AC-REF-001` (Partial — all 11 canonical Strategy seeds complete; 5 Abandonment Reasons completed in D20)

---

### Deliverable 19: Partial Option Rolls

#### User Stories
1. **As a** trader rolling only part of my open option quantity or rolling one leg/wing of a multi-leg structure while keeping the rest open, **I would like** to record a partial `Roll` `Position Change` that disposes only of the selected predecessor quantity and opens the rolled quantity in a new successor Trade, **so that** my untouched predecessor holdings remain open in the predecessor Trade while the rolled contracts live exclusively in the successor Trade.
2. **As a** trader viewing a partially rolled predecessor Trade and its successor Trade, **I would like** the predecessor to remain `Open` (requiring no `Close Reason`) with accurate remaining lots, basis, and ongoing risk/reward while linked to the successor via typed Roll lineage, **so that** both open Trades can be independently managed and reviewed in `Daily Review`.

#### High-Level Capability Set
Completes `Roll` support by handling partial quantity and partial-leg Rolls: closes only the explicitly selected predecessor quantity via FIFO `Lot Matches`, leaves the predecessor in `Open` Lifecycle State with its untouched holdings and unconsumed opening fees intact, requires no `Close Reason` on the still-open predecessor, confirms the successor Plan and opening Executions for the rolled portion, and links both Trades via typed Roll lineage.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation:** Updates capability manifest to v19.
- **Module Operations Introduced:**
  - `TradeAnalysis` & `TradeWorkflows`: extends `recordPositionChange` and `assessChange` for partial predecessor disposal during a `Roll`, preserving untouched predecessor lots and `Open` state.
- **Parallelism Within Deliverable:**
  - Partial Roll lot/fee split verification in `TradeAnalysis` can run in parallel with partial-quantity selector controls in the Roll UI.

#### Acceptance Scenarios Satisfied
- `AC-POS-003` (Full — partial Roll closes only selected predecessor quantity, keeps untouched holdings in predecessor, assigns new Executions only to successor, and commits successor Plan, `1R`, lineage, and reflection atomically)

---

### Deliverable 20: Abandoning Unentered Plans (`abandonPlan`)

#### User Stories
1. **As a** trader who decides not to enter a confirmed `Planned` Trade that has never had an effective real Position Change, **I would like** to abandon the Plan with an active `Abandonment Reason` (`abandonPlan`), **so that** the Trade transitions to `Abandoned`, retires any Plan-related Debt, is included in the `Abandoned` cohort of the `Process Scorecard`, and is rejected if any real Execution has ever occurred.

#### High-Level Capability Set
Placed after all happy-path stock, option, spread, scaling, legging, settlement, covered call, and roll workflows: delivers `TradeWorkflows.abandonPlan`, seeds the 5 canonical `Abandonment Reasons`, transitions eligible `Planned` Trades to `Abandoned` without creating a `Close Reason` or `Terminal Disposition`, retires Plan-related Debt, and adds the `Abandoned` filter/tab, detail presentation, and `Process Scorecard` cohort partition.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v12 + Migration v11→v12 + Backup Section Update):**
  - Adds `AbandonmentReason` facts to `trade_records`.
- **Seed & Default Additions:**
  - `ReferenceCatalog.seedDefaults` (v8 — Complete): Seeds the 5 canonical `Abandonment Reasons` (`Entry Criteria Never Met`, `Thesis Invalidated Before Entry`, `Opportunity Missed`, `Chose Not to Enter`, `Plan Superseded`) with `SeededValuesRemainSelectable` protection (completing all `ReferenceCatalog` seeds).
- **Module Operations Introduced:**
  - `TradeWorkflows`: `abandonPlan`.
  - `TradeAnalysis`: extends `derive` for `Abandoned` state and Abandonment eligibility checks.
  - `TradeViewsAndReporting` & `PerformanceAnalysis`: adds `Abandoned` tab/filter, detail presentation, and `Abandoned` Plan outcome partition in `scorecard`.
- **Parallelism Within Deliverable:**
  - `TradeWorkflows.abandonPlan` and `TradeAnalysis` eligibility checks can be built in parallel with the Abandon Plan modal and `Abandoned` browse/detail UI.

#### Acceptance Scenarios Satisfied
- `AC-REF-001` (Full — completes all 11 canonical Strategy seeds, 5 Close Reasons, 5 Abandonment Reasons, and `IdeaSource` Tag Type)
- `AC-LIFE-002` (Partial — `abandonPlan` transitions unentered Plan to `Abandoned`, retires applicable Plan Debt without Close Reason or Terminal Disposition, and rejects Plans with an effective Execution; Void re-eligibility completed in D23)

> **Declared Scope:** `AC-LIFE-002` covers unentered Abandonment and post-Execution rejection here; restoring Abandonment eligibility by Voiding a false data-entry Execution completes in `D23`.

---

### Deliverable 21: Prospective Management Revisions (`reviseManagement`)

#### User Stories
1. **As a** trader adapting to new information on an `Open` Trade (or resolving workflow-routed `Management Debt` from physical option settlement), **I would like** to record a `Management Revision` (`reviseManagement`) to prospectively update my active Stops, Targets, or Thesis with a required Revision Rationale, **so that** ongoing risk/reward uses my revised management and settles `Management Debt` while my original `Plan Baseline` (`1R`) and `Entry Quality` remain frozen.

#### High-Level Capability Set
Delivers `TradeWorkflows.reviseManagement`, seeds the `Management Revision` Entry Definition (completing all 7 fixed Entry Types and 7 Sources), prospectively updates effective Stops, Targets, and Thesis (`AllOrNone` Revised Thesis & Invalidation) from the revision's `Economic Time` without altering `1R` or `Entry Quality`, resolves workflow-routed `Management Debt` when management becomes complete, and populates the management-activity distribution in `Process Scorecard`.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v13 + Migration v12→v13 + Backup Section Update):**
  - Adds `ManagementRevision` facts to `trade_records`.
- **Seed & Default Additions:**
  - `Journal.seedDefaults` (v5 — Complete): Seeds `Management Revision` Entry Definition (Revision Rationale, `AllOrNone` Revised Thesis & Invalidation, Adapting/Rationalizing, Conviction) and Source `Management Revision` (all 7 fixed Entry Types and 7 Sources are now complete).
- **Module Operations Introduced:**
  - `TradeWorkflows`: `reviseManagement`.
  - `TradeAnalysis` & `PerformanceAnalysis`: extends `derive`, `evaluate`, `replay`, and `scorecard` for prospective `Management Revision` timelines and activity counts.
  - `TradeViewsAndReporting`: adds Management Revision timeline cards on `getTradeDetail`.
- **Parallelism Within Deliverable:**
  - Prospective `Management Revision` evaluation in `TradeAnalysis` can run in parallel with the Revise Management modal and timeline UI.

#### Acceptance Scenarios Satisfied
- `AC-CALC-001` (Full — confirms `Management Revision` updates ongoing risk/reward while leaving `1R` and `Entry Quality` unchanged)
- `AC-JOUR-006` (Full — completes resolution of workflow-routed `Management Debt` by establishing complete management via `reviseManagement`)
- `AC-JOUR-007` (Full — all 7 fixed Entry Types and 7 Sources seeded idempotently)

---

### Deliverable 22: Journal History (`Edit`, `Addendum`, `Void`) & Runtime Definition Customization

#### User Stories
1. **As a** trader refining my saved Journal Entries, **I would like** to `Edit` an Entry under its original definition snapshot, attach a later `Addendum` Entry, or `Void` an Entry with a required reason (atomically reopening its `Journal Debt` when the Voided Entry was its sole settlement), **so that** my reflective history remains immutable and transparent in `View history` and `Journal Field` reports.
2. **As a** trader evolving my journaling routine, **I would like** to customize the prompts, options, and conditional rules of any fixed `Entry Type` at runtime (`reviseDefinition`) while preserving workflow-critical semantic roles, **so that** future forms use my updated prompts while existing Entries and Outstanding Debt retain their original snapshots.

#### High-Level Capability Set
Completes all remaining `Journal` capabilities: `Edit` (appending a version under the same Entry identity and original definition snapshot, without writing backward into frozen Trade facts), `Addendum` (new Entry preserving parent Anchor and parent link), `Void` (visible Void version with reason, reopening Debt when sole settlement), and `Journal.reviseDefinition` (prospective-only runtime prompt customization).

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v14 + Migration v13→v14 + Backup Section Update):**
  - Adds Entry version chains (`Edit`/`Void`), `Addendum` parent links, and `EntryDefinition` revision chains in `journal_*` stores.
- **Module Operations Introduced:**
  - `Journal`: extends `save` for `Edit`, `Addendum`, and `Void` (with atomic Debt reopen); adds `reviseDefinition`.
- **Parallelism Within Deliverable:**
  - `Journal.save` (`Edit`/`Addendum`/`Void`) and `Journal.reviseDefinition` can be built in parallel with the Entry Version History drawer and Prompt Definition Editor UI.

#### Acceptance Scenarios Satisfied
- `AC-JOUR-001` (Full — only explicit Save across all Journal, Review, and Definition forms records evidence)
- `AC-JOUR-002` (Full — `Edit`, `Addendum`, and `Void` retain distinct identities, snapshots, parent links, and visible history)
- `AC-JOUR-004` (Full — runtime `reviseDefinition` changes are strictly prospective; existing Entries and Outstanding Debt retain original definition snapshot)
- `AC-JOUR-005` (Full — one obligation key has one explicit outcome; Voiding sole settlement Entry atomically reopens Debt)

---

### Deliverable 23: Economic History Corrections (`Replace`, `Void`, `Rebuild`) & Visible Audit Trail

#### User Stories
1. **As a** trader who made a data-entry mistake on an Execution, Settlement, or Management Revision, **I would like** to preview the exact `Correction Footprint` (`previewCorrection`) and commit a `Replace` or `Void` correction (`commitCorrection`), **so that** my Trade's economic history is restated at the original `Economic Time`, linked Trades, Journal obligations, and report correction-sensitivity disclosures reconcile atomically, and prior versions remain inspectable in `View history`.
2. **As a** trader reconstructing a Trade whose fact sequence needs structural repair, **I would like** to `Rebuild` the Trade under the same `TradeId`, **so that** reconstructed facts receive new identities in explicit sequence while superseded Executions and their historical Journal `Execution Anchors` remain intact and navigable.

#### High-Level Capability Set
Delivers `TradeWorkflows.previewCorrection` and `TradeWorkflows.commitCorrection` across single and linked Trades (including Roll and Assignment/Exercise linked sets): `ReplaceFact` (retaining `TradeFactId` and `RecordedSequence`), `VoidFact` (removing economic effect with a required reason, restoring Abandonment eligibility when no real facts remain, and retiring Outstanding reflection Debt whose underlying Position Change has no remaining real members while keeping completed Entries visible with Voided-origin metadata), `RebuildTrade` (retaining `TradeId` and `Superseded` Execution anchors), material impact acknowledgment gating, and structured `Correction Footprint` generation and report correction-free sensitivity comparison.

#### Operations, Mechanisms, Seeds & Durable-Representation Changes
- **Durable Representation (Schema v15 + Migration v14→v15 + Backup Section Update):**
  - Finalizes multi-Trade correction version chains, `Superseded` fact anchor statuses, Voided-origin Journal flags, and stored `CorrectionFootprint` metadata in `trade_records` and `journal_*`. Sets the Installed Capability Manifest to the complete v1.0 MVP footprint (all 67 public operations across 10 modules + 1 external port).
- **Module Operations Introduced:**
  - `TradeAnalysis` & `PerformanceAnalysis`: completes `assessChange` for `ReplaceFact`, `VoidFact`, and `RebuildTrade` across linked Trades and historical observation frames, and correction-sensitivity comparison in `outcomes`, `exposure`, and `scorecard`.
  - `TradeRecord`: completes `prepareChange`/`applyPreparedChange` for `CorrectionChange`, `history` (`FullAudit`), and `resolveAnchors` (`Effective`, `Superseded`, `Voided`).
  - `TradeWorkflows`: `previewCorrection`, `commitCorrection`.
- **Parallelism Within Deliverable:**
  - Multi-Trade `assessChange` footprint derivation and `TradeRecord` version-chain staging can run in parallel with the Correction Preview impact modal and `View history` audit drawer UI.

#### Acceptance Scenarios Satisfied
- `AC-CORR-001` (Full — `Replace` preserves fact identity and `RecordedSequence`, restates economics at `Economic Time`, keeps Execution Anchor attached, and preserves prior value in `View history`)
- `AC-CORR-002` (Full — `Void` removes economic effect, reconciles lifecycle/lots/Journal Debt atomically, and keeps identity and reason visible)
- `AC-CORR-003` (Full — `Rebuild` preserves `TradeId`, assigns new fact identities in explicit sequence, resolves old Execution Anchors as `Superseded` without silent redirection)
- `AC-CORR-004` (Full — linked multi-Trade correction across Roll/Assignment/Exercise commits all participants or rolls back completely on stale revision or Journal rejection)
- `AC-CORR-005` (Full — `previewCorrection` writes nothing and binds to exact fact and observation revisions; stale commit is rejected)
- `AC-LIFE-002` (Full — completes restoration of Abandonment eligibility after Voiding a false data-entry Execution)
- `AC-REV-001` (Full — completes historical Daily Review eligibility and progress restatement after a past Trade fact correction)
- `AC-REF-002` (Full — completes unchanged correction retaining a now-retired reference while blocking new selection)
- `AC-RPT-002` & `AC-RPT-004` (Full — completes `Correction Footprint` disclosure, Voided-origin reflection disclosure, and correction-free sensitivity across reports)
- `AC-DEL-001` & `AC-UI-002` (Full — complete offline and accessibility verification across all 23 deliverables)
