# Trade Journal V3 — Implementation Plan (Vertical Deliverables)

> **Status:** Draft — Vertical Deliverables List (Phase 3a). Task-level breakdowns, TDD `describe`/`it should` specifications, integration test lists, browser-critic flow scripts, and the Phase 4 acceptance-to-evidence matrix will be added in place after this deliverable list is reviewed and approved.

---

## 1. Approved Basis

- **Stack (Profile A):** TypeScript 7 (`@typescript/native`: `npm:typescript@^7.0.2`) with Microsoft's side-by-side ESLint workaround (`typescript`: `npm:@typescript/typescript6@^6.0.2` + `eslint` + `typescript-eslint` `^8`), React `^19.3`, Vite `^8.3` (`DEV_PORT=5181`, `strictPort: true`), `pnpm`, CSS Modules + CSS custom properties, bespoke accessible SVG charts, direct typed IndexedDB `Persistence/Transaction` seam (generation-isolated migrations/Restore, single-transaction multi-store atomicity, rebuildable `AnalysisInput` projection), custom digest-verified Service Worker + build-emitted SHA-256 `Offline Release Inventory`, zero-dependency `BigInt` exact `Rational` math, explicit `Clock` + `Intl.DateTimeFormat` (IANA) + versioned NYSE session calendar, Vitest `^5.1` + `fake-indexeddb`, Playwright `^1.65` (`http://localhost:5181`), and `@axe-core/playwright`.
- **Canonical product baseline:** [specs/README.md](../specs/README.md) and all indexed ADRs, module contracts, UI/delivery contracts, and acceptance scenarios.
- **Visual & behavioral prototypes:**
  - [prototypes/trade-detail/index.html](../prototypes/trade-detail/index.html) (`C. Cockpit` layout)
  - [prototypes/replay/round-2.html](../prototypes/replay/round-2.html) (`1. Corridor` visualization)
  - [prototypes/review-coach-mockup/index.html](../prototypes/review-coach-mockup/index.html) (Daily Review Coach ritual & Replay-guided Close Review)

---

## 2. Recorded Prototype & User Overrides of `specs/`

Per explicit user approval, where the copied prototypes or agreed trader priorities differ from the frozen `specs/`, the prototype / user decision governs and is recorded here for traceability:

| # | Area | `specs/` baseline | Adopted override (prototype / user decision) | First applied |
|---|---|---|---|---|
| **OV-01** | Trade Detail layout | Layout container flexible | **`C. Cockpit`** from `prototypes/trade-detail/index.html`: sticky left State-of-Play rail + conditional tabbed drawers (`Today`, `Position`, `Plan and Risk`, `Price History`, `Journal`, `Payoff`), each figure shown once, read-only `Price History` linking to `Review`, combined Planned+Current payoff chart. | `D2` |
| **OV-02** | Daily Review Action preselection & Intent rules (`AC-REV-003`) | Always preselect `Hold` (Intent optional); `Exit`/`Roll`/`Adjust` always require Intent | From `review-coach-mockup/index.html`: inside the lines, `Hold` is preselected with optional reason; **past a Stop, at/past a Target, or with a stale unrecorded prior decision**, nothing is preselected and `Hold` **requires** a reason. A **Plan-following `Exit`** (full size at Stop/Target with no prior Hold past the line) needs **no reason**; leaving the Plan requires a reason and carries forward yesterday's `Exit` reason when recording the sale. | `D5` (`Hold`), `D6` (`Exit`) |
| **OV-03** | Marks-before-Action gate & unified Marks grid | Missing Marks block Review completion | From `review-coach-mockup/index.html`: an Open Trade's Action form is **locked** until today's Marks for that Trade are entered or acknowledged `Can't get a price`. Marks are entered in one unified top-of-Review grid with typo/outlier sanity checks (`>5%` stock, `+100%/-50%` option, `$0.00` pre-expiration, decimal-slip confirmation) and in-place correction (no correction reason required) for Marks saved in the same Review. | `D4`, `D5`, `D9` |
| **OV-04** | Prior-session dated meter & risk fallback when today's Mark is missing (`AC-CALC-002`) | Missing expected Mark yields `Unavailable`; nearest older Mark shown only as Stale context | Today's authoritative valuation stays `Unavailable` (never mixing dates across legs and locking today's Action), **while the Gauge meter and risk/reward display** evaluate the most recent completely marked prior session (synchronized across all legs) and display those values explicitly dated and muted (`At the <prior date> Marks`, faded header meter + `Marks needed` / `No price today` badge). | `D4`, `D5`, `D9`, `D11` |
| **OV-05** | Yesterday's unrecorded decision accountability & attention order | Attention bands start with factual/management blocker, boundary reached, evidence limited, pressure, routine | From `review-coach-mockup/index.html`: an unrecorded prior `Exit` (and later `Roll`/`Adjust`) ranks **#1** (above expiration and past-Stop), shows a call-out banner with inline exit recording or `Still holding`, and displays `"Your last decisions"` + consecutive-sessions-held-past-line streak. | `D5` (trail), `D6` (`Exit` accountability) |
| **OV-06** | Guided Close Review & required Key Lesson (`AC-JOUR-007`) | Close Review `What is the key lesson?` is optional; no Replay gate | From `review-coach-mockup/index.html`: Close Review opens inside the **Replay overlay** and gates the form until every derived **Key Moment** has been viewed; **`What is the key lesson?` is required**; `Decline…` is a quiet secondary action; Close Review for a newly closed Trade is due in the **next** Review. | `D8` |
| **OV-07** | ITM expiration bridge in Daily Review (`AC-SET-003`, `AC-REV-006`) | Any unsettled expired option keeps Review `Incomplete` | Until full Assignment/Exercise Stock allocation lands in `D23`, an ITM expired option offers **`Exercised / Assigned: record later`** inside Review (matching `review-coach-mockup/index.html`), letting today's Review finish as **`Complete, settlement to record`** while re-asking on the next Review; OTM options offer one-click `Record expiration` and ITM `Expired worthless` requires a confirmation reason. | `D13` |
| **OV-08** | Option Replay math (no Black-Scholes estimates) | ADR 0007 forbids theoretical option pricing | Follow `review-coach-mockup/index.html` and ADR 0007 strictly: **`1. Corridor`** Replay uses observed Marks only — `replay/round-2.html`'s optional Black-Scholes IV, share-equivalent delta, and move-split estimates are **excluded** (and could only be added later via an explicit ADR 0007 amendment). | `D7`, `D9` |
| **OV-09** | MarketData.app pricing provider | Provider-agnostic port | Concrete adapter targets **MarketData.app** (`/v1/stocks/candles/D/{symbol}/` for Underlying OHLC Daily Bars + closing Marks; `/v1/options/quotes/{occSymbol}/` for option EOD closing Marks; HTTP `200`/`203`; `Authorization: Bearer` with browser CORS confirmed by an explicit verification task in `D10`). | `D10` |

---

## 3. Shared Resources & Cross-Cutting Obligations

### Cross-cutting obligations (never standalone deliverables)
Every deliverable that touches durable state, UI, or capabilities owns these obligations internally:
- **Schema & seed migration:** Any durable-representation change in `D<N>` includes a versioned forward migration from `D<N-1>` via the generation-isolated database protocol, leaving the prior generation intact on failure.
- **Honest capability manifest:** Each deliverable updates the immutable `Installed Capability Manifest` to advertise only its newly completed, UI-reachable, dependency-closed capabilities.
- **PWA, offline, & write gate:** Every mutating command goes through the single `Persistence/Transaction` choke point (returning `RuntimeNotWritable` outside `Writable`), every asset change updates the SHA-256 `Offline Release Inventory`, and all installed manual flows work offline after cold restart.
- **Responsive & accessible UI:** Every new view supports live narrow/wide resize without losing unsaved state (`AC-UI-001`), WCAG AA contrast, keyboard-only operation, and `Loading` / `Ready` / `Empty` / `Error` states (`AC-UI-002`).
- **One-call post-commit mutation results:** Every accepted mutation returns revision-bound post-commit state sufficient to present success without a mandatory follow-up read (`AC-RESP-001`).

### Shared resources requiring a single owner at a time
Changes to any of the following serialize deliverables or branches unless explicitly coordinated:
1. **IndexedDB schema & generation-migration registry** (`Persistence/Transaction` store definitions & migration table)
2. **Seed / default manifests** (`ReferenceCatalog` Strategy/reason/taxonomy seeds; `Journal` Entry Type/Source seeds)
3. **`Installed Capability Manifest`** (immutable capability registry & version identity)
4. **Primary navigation shell & responsive chrome** (wide sidebar / narrow bottom bar / route registry)
5. **Shared `TradeAnalysis` core** (`derive`, `evaluate`, `replay` data structures)
6. **Unified Marks grid component & `Review` screen layout** (extended incrementally by `D4`, `D5`, `D6`, `D7`, `D8`, `D9`, `D10`, `D11`, `D13`)
7. **`C. Cockpit` Trade Detail shell & drawer registry** (extended incrementally by `D2`, `D3`, `D4`, `D6`, `D7`, `D9`, `D11`, `D13`, `D14`, `D19`, `D20`)

---

## 4. Ordered Vertical Deliverables

---

### D1 — Foundation: Installable PWA, Runtime Readiness, Workspace Initialization, & Brokerage Accounts

**User stories:**
1. As a trader opening the app on my laptop or phone, I would like the app to verify my browser's storage, capacity, service worker, and offline assets before allowing any writes — and warn me if storage is best-effort — so that I never risk losing journal data to an unsafe environment.
2. As a trader starting a fresh journal, I would like to select my Workspace time zone and later adjust it with a clear explanation of its effect, so that my calendar dates and review boundaries match my location without rewriting historical facts.
3. As a trader setting up my brokerage structure, I would like to create, rename, archive, and reactivate Institutions and Accounts, so that my Workspace is ready for Trade planning with real brokerage records rather than fictional placeholders.

**Capability set:**
- Standards-based installable PWA (Web App Manifest, custom versioned Service Worker with build-emitted SHA-256 `Offline Release Inventory`, safe update notice/deferral without mid-form takeover, offline cold restart).
- Browser-neutral 4-check **Runtime Readiness** gate on every launch and after update activation (isolated diagnostic transaction, plan-derived capacity/headroom, service-worker control, complete digest-valid Offline Release Inventory) producing `Writable`, `Unsupported` (reporting all simultaneous failures), `Recovery Only` (reads preserved, writes blocked), or `Unsupported` + `Integrity Blocked` (unreadable existing root never treated as empty).
- Advisory host storage-protection reporting (`Protected` / `Best Effort` / `Unavailable`), persistent non-blocking warning when not `Protected`, and explicit `requestDurability` gesture (`About` / Workspace status view).
- Persistence-level `RuntimeNotWritable` write gate enforced before every write transaction.
- Responsive navigation shell (wide left sidebar / narrow bottom bar: `Accounts`, `About`), Workspace first-run time-zone initialization & settings edit, and Institution/Account management transitioning onboarding from *Needs Institution and Account* → *Ready for Trade Planning*.

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `Workspace.initialize`, `Workspace.getStatus`, `Workspace.saveSettings`, `Workspace.requestDurability`; `ReferenceCatalog.save` (Institutions & Accounts), `ReferenceCatalog.query`, `ReferenceCatalog.resolve`, `ReferenceCatalog.seedDefaults` (empty manifest — zero fictional Institutions/Accounts).
- **Mechanisms:** TypeScript 7 (`@typescript/native`) + `@typescript/typescript6` ESLint shim; Vite 8 (`DEV_PORT=5181`, `strictPort: true`); Playwright harness; direct typed IndexedDB `Persistence/Transaction` seam (`tjv3_bootstrap` generation pointer + `tjv3_ws_gen_1` + isolated `diagnostics` store); SHA-256 `release-inventory.json` build emitter; `Installed Capability Manifest` v1.
- **Seeds:** None (no fictional brokerage records).
- **Durable representation:** Schema v1 — `workspace_meta`, `catalog_institutions`, `catalog_accounts` (immutable `institutionId`, label/availability revision history, optimistic revisions).

**Acceptance scenarios:**
- `AC-DEL-003` — **full** (local secure loopback; production HTTPS evidence recorded as an explicit external release verification gate)
- `AC-DEL-004` — **full**
- `AC-DEL-001` — **partial** — *Declared scope:* offline cold restart verified for Workspace status, settings, and Institutions/Accounts; later workflows verify offline parity as they land, completed with provider-offline resilience in `D10` and local Restore in `D12`.
- `AC-DEL-002` — **partial** — *Declared scope:* SW update staging, digest check, notice, and safe activation with active Accounts form; completed with active Trade/Review forms in `D2` and `D5`.
- `AC-DEL-005` — **partial** — *Declared scope:* `Recovery Only` reads/history, `Integrity Blocked` unreadable root, and `RuntimeNotWritable` rejections; completed with `Recovery Only` backup export & read-back verification in `D12`.
- `AC-DEL-006` — **partial** — *Declared scope:* repeated launch, update activation, and mid-session runtime fault invalidation; completed with post-Restore readiness re-establishment in `D12`.
- `AC-REF-002` — **partial** — *Declared scope:* Institution/Account rename, archive/reactivate, and blocking archive of an Institution with selectable Accounts; completed across Strategies in `D21` and Tags/reasons/historical Journal labels in `D22`.
- `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* covered for Workspace & Catalog surfaces in `D1`; expanded with each subsequent deliverable through `D24`.

**Within-deliverable parallelism:** Once the `Workspace` / `ReferenceCatalog` / `RuntimeReadiness` TypeScript contracts are fixed, (a) the IndexedDB seam + domain modules, (b) the custom Service Worker + manifest/inventory Vite plugin, and (c) the responsive shell + `Accounts` / `About` / readiness UI can proceed in parallel.

---

### D2 — Trade Planning (Long Stock)

**User stories:**
1. As a trader preparing a deliberate stock entry, I would like to create and confirm a Long Stock Plan with intended entry, Stop, Target, and Plan Reflection — seeing live `1R`, planned reward, and reward:risk — so that my Thesis, Invalidation, and Plan Baseline are frozen before I put money at risk.
2. As a trader reviewing upcoming ideas, I would like to browse my Planned Trades and inspect any Planned Trade in the `C. Cockpit` layout, so that I can see my frozen Plan terms, conditions, and Plan Reflection without clutter or repeated figures.

**Capability set:**
- `New Plan` workflow (added to primary nav alongside `Trades`) for **Long Stock** (the sole Strategy in the selector): selectable Account, symbol, share quantity, intended entry price, Stop, Target, and completed **Plan Reflection** (`Why this trade, why now?` [Thesis], `What would invalidate the thesis?` [Invalidation], optional Conviction 1–5 and Primary emotion).
- Exact `BigInt` `Rational` Plan Baseline (`1R` Original Planned Risk > 0, Original Planned Reward, planned reward:risk ratio); incomplete or incoherent Plans return typed field-level rejections with zero writes.
- Atomic persistence of Trade + frozen Plan + stored `Planned` Lifecycle State + completed immutable `Plan Reflection` (Thesis/Invalidation entered once, shared by Plan and Entry).
- `Trades` browse view (`Planned` Trades) and `C. Cockpit` Trade Detail (`Planned` state: left rail identity, `0 of N shares open`, conditions list; `Plan and Risk` and `Journal` drawers).

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `TradeAnalysis.assessPlan`; `TradeWorkflows.confirmPlan`; `TradeRecord.prepareChange`, `TradeRecord.applyPreparedChange` (`ConfirmPlan`), `TradeRecord.getRecord`, `TradeRecord.queryRecords` (`CurrentState: Planned`); `Journal.prepareEffects`, `Journal.applyPreparedEffects`, `Journal.query`, `Journal.getDefinitions`, `Journal.seedDefaults`; `TradeViewsAndReporting.browseTrades`, `TradeViewsAndReporting.getTradeDetail` (`Planned`).
- **Mechanisms:** Zero-dependency `BigInt` exact `Rational` (`ExactNumber`) module; first generation-isolated schema migration (`v1 → v2`); `Installed Capability Manifest` v2.
- **Seeds:** `ReferenceCatalog` seeds `Long Stock`; `Journal` seeds `Plan Reflection` Entry Type and `Plan Confirmation` Source.
- **Durable representation:** Schema v2 — `trades` (authoritative `lifecycleState` + sort indexes), `trade_facts` (Plan & Planned Leg versions with `EconomicTime` + `RecordedSequence`), `journal_definitions`, `journal_entries` (immutable versions + exact definition snapshot + `TradeAnchor` + `Source`).

**Acceptance scenarios:**
- `AC-PLAN-001` — **partial** — *Declared scope:* full for Long Stock; extended to Single-Leg Options in `D9`, Vertical Spreads in `D11`, and all 11 Strategies + custom shapes in `D21` (with optional Tags/`IdeaSource` in `D22`).
- `AC-PLAN-002` — **partial** — *Declared scope:* full for Long Stock; extended alongside option/spread shapes in `D9`, `D11`, `D21`.
- `AC-LIFE-001` — **partial** — *Declared scope:* `Planned` lifecycle & agreement; completed across `Open` (`D3`), `Closed` (`D6`, `D13`), `Abandoned` (`D22`), and Assignment/Exercise (`D23`).
- `AC-JOUR-001` — **partial** — *Declared scope:* unsaved Plan form writes nothing; completed across Position Change (`D3`) and Daily Review (`D5`).
- `AC-JOUR-007` — **partial** — *Declared scope:* `Plan Reflection` & `Plan Confirmation` seeded idempotently; remaining fixed Entry Types/Sources complete in `D3`, `D5`, `D8`, `D22`, `D24`.
- `AC-REF-001` — **partial** — *Declared scope:* `Long Stock` seed; remaining canonical seeds complete across `D6`, `D9`, `D11`, `D21`, `D22`, `D24`.
- `AC-REST-004` — **partial** — *Declared scope:* first generation-isolated `v1 → v2` migration & rollback on controlled failure; full recovery/export path completed in `D12`.
- `AC-DEL-002` — **partial** — *Declared scope:* update deferral preserves active unsaved Plan form; completed with Review form in `D5`.
- `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* expanded to Planning & `C. Cockpit` Planned view; ongoing through `D24`.

**Within-deliverable parallelism:** Once `TradeWorkflows.confirmPlan`, `TradeAnalysis.assessPlan`, and `TradeViewsAndReporting` types are fixed, (a) pure `ExactNumber` + `TradeAnalysis.assessPlan`, (b) `TradeRecord`/`Journal` IndexedDB persistence + `v1 → v2` migration, and (c) `New Plan`, `Trades` browse, and `C. Cockpit` Planned UI can proceed in parallel.

---

### D3 — Opening Execution (Long Stock)

**User stories:**
1. As a trader who just entered or scaled into a stock position during market hours, I would like to record my opening fill(s) as one decision with `Defer` preselected for reflection, so that I capture exact basis and fees quickly without slowing down to journal while markets are open.
2. As a trader checking an open stock Trade, I would like to see my Open Lots, proportional opening fees, Entry Quality against my frozen Plan, and any deferred reflection Debt, so that I know my exact exposure and what I owe in after-close Review.

**Capability set:**
- **`Record entry`** workflow from `C. Cockpit` (`Planned` or `Open` Long Stock Trade): record one decision-level opening `Position Change` (one or more buy Executions with share quantity, fill price, Economic Time, actual fee, and explicit Planned-Leg intent — serving the Planned Leg or `ExplicitlyUnplanned`).
- Atomic **`Position Change Reflection`** disposition: **Complete** (`Decision mode`, `Primary emotion`, `Decision confidence 1–5`, optional `Note`), **Defer** (preselected in UI → creates durable `Journal Debt` snapshotting trigger-time prompts, never a blank Entry; settled later in after-close Daily Review `D5`), or **Decline** (optional reason → distinct `JournalDecline`).
- Atomic `Planned → Open` stored Lifecycle State transition (staying `Open` on scale-ins), Open Lots with lot-proportional unconsumed opening fees, **Entry Resolution Point** & **Entry Quality** (average fill, actual initial risk/reward/R:R, slippage, size vs. planned), Planned-Leg fulfillment (`Partially Filled`, `Filled as Planned`, `Filled with Deviation`, `Unplanned Exposure`), and fact-only Deviations (`Entry Size` excess, `Unplanned Exposure`).
- `C. Cockpit` gains the **`Position`** drawer (Open Lots, Executions, fees paid, honest `"No Marks yet"` state), populated Entry Quality in **`Plan and Risk`**, Debt display (*"Deferred · Due in next Review"*) in **`Needs you`** & **`Journal`**, and the read-only **`Facts can't be replayed`** integrity banner (`AC-LIFE-003`) if stored vs. derived state disagrees.
- `Trades` browse supports `Planned` / `Open` lifecycle filtering via the stored authoritative lifecycle index.

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `TradeWorkflows.recordPositionChange` (opening Long Stock variant); `TradeAnalysis.derive`; `TradeRecord.prepareChange`/`applyPreparedChange` (`PositionChange`), `TradeRecord.resolveAnchors`; `Journal` Debt & Decline creation inside `prepareEffects`/`applyPreparedEffects`.
- **Mechanisms:** Rebuildable private `proj_trade_analysis_input` projection updated atomically with facts (foundation for `AC-PERF-001` batched Open-list loads); migration `v2 → v3`; `Installed Capability Manifest` v3.
- **Seeds:** `Journal` seeds `Position Change Reflection` Entry Type and `Position Change` Source.
- **Durable representation:** Schema v3 — `position_changes`, `executions`, `deviations`, `journal_debt`, `journal_declines`, and rebuildable `proj_trade_analysis_input`.

**Acceptance scenarios:**
- `AC-POS-001` — **partial** — *Declared scope:* opening & scaling-in Executions, Open Lots, and proportional opening fee allocation; completed with partial/final closing Executions and FIFO Lot Matches in `D6`.
- `AC-POS-005` — **partial** — *Declared scope:* Long Stock `Partially Filled`, `Filled as Planned`, `Entry Size`, and `Unplanned Exposure`; completed with multi-leg `Planned-Leg Terms`, `Not Entered`, and `Not Verifiable` in `D11`.
- `AC-CALC-001` — **partial** — *Declared scope:* frozen `1R` and Entry Quality resolved at Entry Resolution Point; completed with invariance under Management Revisions in `D24`.
- `AC-LIFE-001` — **partial** — *Declared scope:* `Planned → Open` transition and index update; completed across `D6`, `D13`, `D22`, `D23`.
- `AC-LIFE-003` — **partial** — *Declared scope:* read-time integrity disagreement detection & `Facts can't be replayed` banner with no auto-repair; completed with Restore candidate repair/rejection in `D12`.
- `AC-JOUR-003` — **partial** — *Declared scope:* `Defer` creates durable Debt with prompt snapshot, no placeholder Entry, never blocks later factual capture; completed with due-Debt Review blocking & settlement in `D5`.
- `AC-JOUR-005` — **partial** — *Declared scope:* single obligation outcome for Position Change Reflection; completed across `D5`, `D8`, and Debt-reopen on Entry Void in `D22`.
- `AC-JOUR-001`, `AC-JOUR-007`, `AC-PERF-001`, `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* expanded for Opening Execution & `proj_trade_analysis_input`; completed in `D5`, `D16`, and `D24`.

**Within-deliverable parallelism:** Once `PositionChangeCommand` and `DerivedTradeState` types are fixed, (a) `TradeAnalysis.derive`, (b) `TradeRecord`/`Journal` IndexedDB persistence + `v2 → v3` migration, and (c) `Record entry` form + `C. Cockpit` `Position`/Entry Quality/integrity UI can proceed in parallel.

---

### D4 — After-Close Marks (in `Review`) & Ongoing Risk/Reward

**User stories:**
1. As a trader after the market closes, I would like to enter closing Marks (or explicitly mark `"Can't get a price"`) for my open stocks in one keyboard-friendly grid inside `Review` with typo checks, so that I can update all prices quickly without accidentally saving a mistyped price.
2. As a trader monitoring open stock Trades, I would like to see my current Mark-to-Market P&L, Ongoing Risk to Stop, Worst-Case Risk, Incremental Reward to Target, Overruns, and Stop/Target price tracks — or clearly dated prior-session context when today's Mark isn't entered yet — so that I always know exactly what is at stake from here.

**Capability set:**
- Adds **`Review`** to the primary navigation (`Trades`, `Review`, `New Plan`, `Accounts`, `About`), opening directly onto Step 1: the **unified Marks grid** (`review-coach-mockup/index.html`) for the latest completed U.S. session (`Expected Mark Date`), plus a live marked summary of Open Trades below it.
- Marks grid ergonomics (OV-03): desktop table + narrow phone block layout, keyboard flow (`Enter` → next/Save, `↑`/`↓`, `N` for `Can't get a price`, `Escape` revert), stock outlier (`>5%`) & decimal-slip (`440` → `$44.00 or $440.00?`) confirmations, `$0.00` stock rejection, `Can't get a price` (`Unavailable Mark Acknowledgment`) + Undo, in-place correction of Marks saved in the same Review, and collapsed `Saved · Edit` state.
- `C. Cockpit` completes **`Today`** (`Marks: Today against Prior` + `Where the prices sit` Stop/Target visual price track) and **`Price History`** (read-only completed-session grid with explicit `—` gaps and permanent `Enter Marks in the Review` link), plus left-rail P&L, daily change, independent OR Conditions (`Active` / `Breached` / `Reached`, `nearest` pill, dollar & Plan-R impact, Overrun), and `Worst case` / `Max reward`.
- Honest valuation & prior-session dated fallback (OV-04): Monday's close during Tuesday's open session is normal `Available` evidence (not `Stale`); missing/acknowledged today's Mark keeps today's authoritative valuation `Unavailable` while rendering risk/meter context explicitly dated to the most recent completely marked prior session (`At the <prior date> Marks`).

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `MarketData.save` (Manual Mark, deliberate override, correction with reason, assert unavailable, withdraw acknowledgment), `MarketData.query` (`ResolveFrames`, `InspectObservations`, `ReadSeries` with `MarketDataSnapshotId` & `ExpectedSnapshot`); `TradeAnalysis.evaluate`; `TradeViewsAndReporting.browseTrades` & `getTradeDetail` upgraded with snapshot-bound Market Data frames.
- **Mechanisms:** Versioned U.S. market session calendar (`America/New_York`, regular 16:00 & early-close 13:00 cutoffs, deterministic NYSE holiday table with `sessionPolicyRevision`); migration `v3 → v4`; `Installed Capability Manifest` v4.
- **Seeds:** None.
- **Durable representation:** Schema v4 — `market_marks` (revision chains, source, saved intention, effective head), `market_acknowledgments`, `market_session_meta`.

**Acceptance scenarios:**
- `AC-MARK-001` — **full**
- `AC-MARK-002` — **partial** — *Declared scope:* Manual Mark revision history and override vs. correction intent; completed with provider-recovery stickiness & independent Bar refresh in `D10`.
- `AC-MARK-003` — **partial** — *Declared scope:* Manual acknowledgment, `Unavailable` calculations, optional `Stale` context, and later Manual Mark superseding while preserving history; completed with provider diagnostics/recovery in `D10`.
- `AC-MARK-004` — **partial** — *Declared scope:* `Price History` completed-session series preserving explicit gaps; completed with Replay points (`D7`) and OHLC candles (`D10`).
- `AC-CALC-002` — **partial** — *Declared scope:* independent calculation availability on Stock Trades (plus OV-04 dated prior-session meter context); completed across multi-leg option covered subtotals in `D11`.
- `AC-CALC-003` — **partial** — *Declared scope:* Stock Stop/Target status, Ongoing/Worst-Case Risk, Incremental Reward, Overruns, Plan-R conversions, Target not a Deviation; completed with dual Underlying+Option OR conditions in `D9` (and Management Revision not a Deviation in `D24`).
- `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* expanded to Marks grid, `Today`/`Price History` drawers, and Missing/Stale/Unavailable presentation; ongoing through `D24`.

**Within-deliverable parallelism:** Once `MarketData` and `TradeEvaluation` contracts are fixed, (a) U.S. session calendar + `MarketData` IndexedDB store (`v3 → v4`), (b) pure `TradeAnalysis.evaluate`, and (c) the unified Marks grid component + `C. Cockpit` `Today`/`Price History`/price-track UI can proceed in parallel.

---

### D5 — Daily Review Core (`Hold` Action, Due Debt Settlement, Gauge Walk, & Day Summary)

**User stories:**
1. As a trader doing my after-close ritual, I would like `Review` to guide me through `1 Marks → 2 Trades → 3 The day`, prioritizing my open Trades by urgency with a visual Gauge meter comparing my Plan to where each Trade stands now, so that I focus attention where it matters most.
2. As a trader with deferred reflections from market hours, I would like due Journal Debt to surface inside `Review` so I can answer or explicitly decline each owed reflection against its original prompts before finishing the day.
3. As a trader deciding to stay in a position, I would like one-click `Save Hold` when a Trade is inside its lines — and a required explanation with no preselected default when it is past a Stop or Target — so that staying in a trade is always a deliberate, saved decision.

**Capability set:**
- Expands **`Review`** into the complete 3-step ritual (`review-coach-mockup/index.html`) for the latest or any exact completed U.S. session (`StateAtEconomicCutoff(Open)`), resuming cleanly from saved facts with zero Review Session entity or finish flag.
- **`The day` card:** `1 Marks → 2 Trades → 3 The day` progress pills, smart `Next: ...` jump button, `Day so far` P&L delta, missed-Review banner (`Add them` exposes optional skipped-session Mark columns in the Marks grid), clickable Trade jump list, and derived **`Complete` / `Complete with Unavailable Marks`** Day Summary (`The day`, `Past a line`, `You chose`, `Tomorrow`, `Next Review`).
- **Due Journal Debt payoff:** Surfaces due Outstanding `Position Change Reflection` Debt; lets the trader answer (creating an immutable Entry against the trigger-time prompt snapshot and marking Debt Settled atomically) or explicitly decline; blocks Review completion until resolved.
- **Attention-ranked Trade cards with Gauge meter:** Collapsed header shows symbol, position, standing chips, P&L & R, daily change, mini Gauge meter, status. Expanded card shows **`Plan` vs `Now`** with full **Gauge meter** (OV-04 prior-session dated meter when today's Mark is missing), **Marks-before-Action gate** (OV-03), **`Your last decisions`** trail, unsaved-change guardrails on card switch/navigation, and **`Hold` Action** (sole Action option in `D5`; OV-02 strict-when-past-a-line rule; `Exit` arrives with Closing in `D6`; `Adjust`/`Roll` deferred to `D24`).
- Saved `Daily Trade Review` Entries appear in `C. Cockpit`'s `Journal` drawer.

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `DailyReview.open`, `DailyReview.getTrade`, `DailyReview.getDebt`, `DailyReview.save` (`SaveTradeAction` [`Hold`] and `ResolveReviewDebt`); `TradeRecord.queryRecords(StateAtEconomicCutoff)`.
- **Mechanisms:** Snapshot-bound `ExpectedSnapshot` recheck on `DailyReview.save` (`ReviewChanged` / `Conflict` writes nothing); migration `v4 → v5`; `Installed Capability Manifest` v5.
- **Seeds:** `Journal` seeds `Daily Trade Review` Entry Type (with `Hold` option active; `Exit` added in `D6`, `Adjust`/`Roll` in `D24`) and `Daily Review` Source.
- **Durable representation:** Schema v5 — `DailyReview` origin & unique `(EntryType, TradeId, ReviewDate)` obligation-key indexing; cutoff lifecycle query support.

**Acceptance scenarios:**
- `AC-JOUR-001` — **full** (Plan, Position Change, and Review Action forms; leaving without Save writes nothing)
- `AC-JOUR-003` — **full** (due Debt blocks Review completion until answered or declined; never creates blank Entry)
- `AC-DEL-002` — **full** (safe SW update deferral verified across active Trade & Review forms)
- `AC-REV-001` — **partial** — *Declared scope:* `StateAtEconomicCutoff(Open)` for Open Stock Trades; completed with later-closed Trades in `D6` and post-correction restatement in `D19`.
- `AC-REV-002` — **partial** — *Declared scope:* Marks → Debt → Trade ordering & cold-restart resumption; completed with shared multi-Trade Marks in `D11` and Settlement Due in `D13`.
- `AC-REV-003` — **partial** — *Declared scope:* `Hold` one-click inside lines & strict unpreselected/reason-required past line (OV-02); completed with `Exit` in `D6` (and `Roll`/`Adjust` in `D24`).
- `AC-REV-005` — **partial** — *Declared scope:* changed Mark/Trade/Action rejects stale `Hold` Save with zero writes; completed with Deviation/Close races in `D6`.
- `AC-REV-006` — **partial** — *Declared scope:* `Incomplete`, `Complete`, `CompleteWithUnavailableMarks`; completed with ITM `Complete, settlement to record` in `D13` and reversible completion on Void/correction in `D19`/`D22`.
- `AC-JOUR-005`, `AC-JOUR-007`, `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* expanded to Daily Review; completed across `D6`, `D8`, `D22`, `D24`.

**Within-deliverable parallelism:** Once `DailyReview` contracts and Gauge meter view-model types are fixed, (a) `DailyReview` coordinator + `StateAtEconomicCutoff` + `v4 → v5` migration and (b) the Gauge SVG component + `The day` card + attention-ranked Trade cards + Debt resolution UI can proceed in parallel.

---

### D6 — Closing & Partial Exits (Long Stock), `Exit` Action, & Stop-Discipline Reconciliation

**User stories:**
1. As a trader taking partial profits or closing out a stock Trade, I would like to record closing Executions (from `C. Cockpit` or inline in `Review`) with exact FIFO Lot Matches, lot-aware fees, derived Terminal Disposition, and a required Close Reason, so that my realized P&L and `Realized R` are exact and auditable.
2. As a trader deciding to get out of a position during Daily Review, I would like an `Exit` Action (requiring no reason when following my Plan, and holding me accountable the next day if I still haven't sold), so that my review intent and actual execution stay aligned.
3. As a trader holding past an active Stop, I would like each continuous Stop breach recorded once as a Stop-Discipline Deviation atomically when I save my Review Action, so that my process history is accurate without daily duplicate noise.

**Capability set:**
- **Closing & partial exits (`Record exit` in `C. Cockpit` + inline `Record the sale` in `Review`):** Exact FIFO **Lot Matches** (linking opening & disposing facts without duplicating price/P&L onto the link), lot-proportional opening + disposal fee allocation counted once (with collapsible `Fee reconciliation`), partial realization while `Open`, atomic `Open → Closed` Lifecycle State transition, derived **`Terminal Disposition`**, required **`Close Reason`** (4 stock-applicable seeds), `Realized R`, and **`Entry/Exit Scaling`** (`SingleEntrySingleExit` / `Scaled`).
- **Inline Review Plan-conformance check (OV-02):** Detects *"Follows the Plan"* vs *"Leaves the Plan: early / late / partial"*, carries forward yesterday's `Exit` Action reason automatically, and asks only what's missing.
- **`Exit` Action & yesterday's accountability (OV-02, OV-05):** Adds `Exit` to `Review`'s Action selector, ranks unrecorded prior `Exit` decisions #1 in attention order with a top & per-Trade banner (`I sold: record it` / `Still holding`), and updates `Tomorrow`'s checklist.
- **Atomic Stop-Discipline Deviation reconciliation (`AC-REV-004`):** `DailyReview.save` runs pure `TradeAnalysis.replay` internally against bound `ExpectedSnapshot` frames to create/retain/supersede/Void continuous Stop-Discipline episodes atomically with the dated Action (zero daily duplicates), surfaced in `Review`'s streak warning and `C. Cockpit`.
- `Closed` Trades browsable in `Trades` list (`Planned` / `Open` / `Closed`) and rendered in `C. Cockpit`'s `Closed` layout (`Result` in left rail, `Lot Matches` + `Fee reconciliation`, `Plan vs. What happened`).
- *(Deliberately deferred: `abandonPlan` & `Abandonment Reasons` → `D22`; `Close Review` → `D8`; `Rolled` Close Reason → `D24`.)*

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `TradeWorkflows.recordPositionChange` (closing/partial-exit Stock variant); `TradeAnalysis.derive` (FIFO Lot Matches, disposal fees, Terminal Disposition, `Realized R`, `Entry/Exit Scaling`), `TradeAnalysis.replay` (pure engine for continuous Stop-Discipline episodes); `TradeRecord.prepareChange`/`applyPreparedChange` (narrow Deviation reconciliation); `DailyReview.save` upgraded with `Exit` Action + atomic Deviation reconciliation.
- **Mechanisms:** Continuous Stop-Discipline episode fingerprinting; migration `v5 → v6`; `Installed Capability Manifest` v6.
- **Seeds:** `ReferenceCatalog` seeds 4 Close Reasons (`Target Reached`, `Stop Triggered`, `Thesis Invalidated`, `Time-Based Exit` — `Rolled` deferred to `D24`); `Journal` adds `Exit` option to `Daily Trade Review` definition.
- **Durable representation:** Schema v6 — `lot_matches`, Close Reason trade facts, Stop-Discipline episode records with fact/Mark evidence bindings.

**Acceptance scenarios:**
- `AC-POS-001` — **full**
- `AC-REV-003` — **full** (under OV-02 prototype rules for `Hold` & `Exit`; `Roll`/`Adjust` deferred to `D24`)
- `AC-REV-004` — **full**
- `AC-REV-005` — **full**
- `AC-POS-004` — **partial** — *Declared scope:* trader-directed close requires one active Close Reason & derives Terminal Disposition; completed with non-agency Expiration (no Close Reason) in `D13` (and non-blocking Close Review in `D8`).
- `AC-LIFE-001` — **partial** — *Declared scope:* `Planned → Open → Closed` by Execution; completed across Expiration (`D13`), `Abandoned` (`D22`), and Assignment/Exercise (`D23`).
- `AC-REV-001` — **partial** — *Declared scope:* later-closed Trades remain eligible at earlier cutoffs; completed with post-correction restatement in `D19`.
- `AC-REF-001`, `AC-JOUR-007`, `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* expanded to Closing, `Exit`, & 4 Close Reasons; completed across `D8`, `D21`, `D22`, `D24`.

**Within-deliverable parallelism:** Once FIFO Lot Match, Close Reason, and Stop-Discipline reconciliation types are fixed, (a) pure `TradeAnalysis` FIFO + Stop-Discipline episode engine, (b) `TradeRecord`/`TradeWorkflows`/`DailyReview` persistence + `v5 → v6` migration, and (c) `Record exit` / inline Review sale form + `Exit` Action + `C. Cockpit` `Closed` UI can proceed in parallel.

---

### D7 — Interactive Trade Replay (`1. Corridor`)

**User stories:**
1. As a trader reviewing an open or closed Trade, I would like to launch an interactive session-by-session Replay showing price above Trade P&L between Stop and Target rails — with solid banked profit, light open profit, shrinking rails after partial exits, and explicit missing-Mark gaps — so that I can see how the Trade actually evolved.
2. As a trader studying how I managed a Trade, I would like to jump directly to derived Key Moments (`Entry`, `Low`, `Stop`, `Target`, `High`, `Sale`, `Now`/`End`), scrub across sessions, and inspect an accessible session table, so that every decision and price movement is clear and keyboard-navigable.

**Capability set:**
- **`Replay` strip + P&L sparkline** on every Open & Closed Trade card in `Review` and launchable from `C. Cockpit` Trade Detail.
- Full-screen **Replay overlay** (preserving scroll, open card, and Review state on `Back to the Review` / `Back to Trade`):
  - **`1. Corridor` SVG visualization** (`prototypes/replay/round-2.html` & `review-coach-mockup/index.html`, OV-08 pure Mark-based): stacked Underlying Mark strip above filled Trade P&L area running between Stop & Target step-rails (solid realized/banked layer, light open layer, hatched overrun zones, execution markers, `Action` row `H` / `E` / `–`, and explicit breaks at missing-Mark sessions with zero interpolation).
  - **Key Moments** selector (`Entry`, `Low`, `Stop`, `Target`, `High`, `Sale`, `Now` / `End`), session slider + `‹`/`›` buttons + keyboard arrows, hover/tap tooltip, sticky session readout (`What you did that day` + `How it stood`), and expandable **accessible session table** linking to `C. Cockpit` `Price History`.

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `TradeViewsAndReporting.replayTrade` (automatic corrected-fact lifetime span; `NotApplicable` for unentered `Planned` Trades); `TradeAnalysis.replay` extended to emit per-session Corridor rails, banked/open splits, and derived Key Moments.
- **Mechanisms:** Bespoke accessible Corridor SVG chart & sparkline components; `Installed Capability Manifest` v7.
- **Seeds:** None.
- **Durable representation:** **None** (pure read over existing authoritative Trade, Market Data, and Journal facts — no schema migration).

**Acceptance scenarios:**
- `AC-MARK-004` — **partial** — *Declared scope:* close-only Mark points and explicit missing-Mark gaps in Replay with zero interpolation; completed with OHLC Daily Bar candles in `D10`.
- `AC-UI-002` — **partial** — *Declared scope:* accessible SVG Replay with readable textual/tabular equivalent and keyboard scrubbing; completed with destructive Restore states in `D12`.
- `AC-UI-001`, `AC-CAP-001` — **partial** — *Declared scope:* responsive Replay layout across desktop & phone widths; ongoing through `D24`.

**Within-deliverable parallelism:** Pure read-only deliverable — once `TradeReplayView` types are fixed, `TradeAnalysis.replay` / `TradeViewsAndReporting.replayTrade` and the Corridor SVG + overlay UI can proceed in parallel.

---

### D8 — Guided Close Review

**User stories:**
1. As a trader whose Trade just closed, I would like its Close Review obligation created automatically and scheduled for my next Review (without blocking me from closing the Trade now), so that closing stays fast during market hours and reflection happens with fresh perspective after close.
2. As a trader completing a Close Review, I would like to walk through every Key Moment in Replay before answering — including a required key lesson, or an explicit secondary Decline — so that my post-trade takeaways are grounded in what actually happened.

**Capability set:**
- Terminal close in `TradeWorkflows.recordPositionChange` atomically creates a distinct **`Close Review`** obligation (due in the **next** Review, optional right away, never blocking factual closure, separate obligation key from `Position Change Reflection`).
- **`Closed · Close Review`** section in `Review` showing `Plan vs. What happened` comparison table, Replay strip, **`Write the Close Review`**, and quiet secondary **`Decline…`**.
- Clicking **`Write the Close Review`** opens `D7`'s Replay overlay in **Close Review mode** (OV-06): unlocks the Close Review form once all derived Key Moments are viewed (`Next moment`, `N of M seen`), saves `Would you take this Trade again under similar conditions?` [required], `What worked, and what did not?` [optional], and **`What is the key lesson?` [required per OV-06]**, or records a distinct `JournalDecline` with optional reason.
- Due Close Reviews block Review completion until completed or declined; saved/declined Close Reviews appear in `C. Cockpit`'s `Journal` drawer.

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `TradeWorkflows.recordPositionChange` (emits `Close Review` obligation on terminal close); `DailyReview.open`, `getDebt`, `save(ResolveReviewDebt)` extended for Close Review settlement & decline; `Journal.seedDefaults`.
- **Mechanisms:** Migration `v6 → v7` (`D7` introduces no schema change); `Installed Capability Manifest` v8. Trades closed prior to `D8` disclose historical coverage honestly rather than fabricating backfill.
- **Seeds:** `Journal` seeds `Close Review` Entry Type (with OV-06 required `What is the key lesson?`) and `Trade Close` Source.
- **Durable representation:** Schema v7 — `Close Review` Entry Definition & obligation key records.

**Acceptance scenarios:**
- `AC-POS-004` — **partial** — *Declared scope:* Close Review completion/deferral/decline never blocks factual closure; completed with non-agency Expiration in `D13`.
- `AC-JOUR-005` — **partial** — *Declared scope:* unique `Close Review` obligation outcome; completed with Debt-reopen on Entry Void in `D22`.
- `AC-JOUR-007`, `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* adds `Close Review` & `Trade Close` (4 of 7 fixed Entry Types); completed across `D22` and `D24`.

**Within-deliverable parallelism:** Once the Close Review obligation & Review view-model fields are fixed, (a) `Journal` seed + `TradeWorkflows`/`DailyReview` obligation wiring (`v6 → v7`) and (b) the `Closed · Close Review` card + Replay Close-Review gating UI can proceed in parallel.

---

### D9 — Single-Leg Options (`Long Call`, `Long Put`, `Cash-Secured Put`)

**User stories:**
1. As an options trader planning a single-leg trade, I would like to confirm a `Long Call`, `Long Put`, or `Cash-Secured Put` Plan with exact contract terms (or objective selection criteria), optional `Exercise Intent`, and independent Underlying-price and Option-price Stops and Targets, so that my `1R` baseline and thesis are frozen before entry.
2. As an options trader managing open calls and puts, I would like to record opening/closing option Executions (100× multiplier), enter both Underlying and Option Marks in `Review`'s unified grid with option sanity checks, and see dual price tracks, expiration countdowns, `Option Disposition Timing`, and option `Corridor` Replay, so that single-leg options work seamlessly inside my daily workflow.

**Capability set:**
- Strategy selector adds **`Long Call`**, **`Long Put`**, and **`Cash-Secured Put`** (exact OCC contract: Underlying, expiration date, strike, Call/Put — plus objective selection criteria where used; optional **`Exercise Intent`** on long options defaulting to *Not authorized in advance*).
- Independent **Underlying-price AND Option-price OR Stops & Targets** (with frozen monetary loss boundary on Underlying-price option Stops so `1R` is exact).
- `Buy to open` / `Sell to close` (long) and `Sell to open` / `Buy to close` (short put), 100× multiplier, FIFO Lot Matches & lot-aware fees, `Option Disposition Timing` (`FullyDisposedPreExpiration` on pre-expiration closes), and honest **`Settlement Due`** indicator if an open option passes expiration (explicit Expiration recording lands in `D13`; Assignment/Exercise in `D23`).
- Unified Marks grid adds Option rows grouped under their Underlying with option outlier checks (`+100% / -50%`, pre-expiration `$0.00` `"Worth nothing?"` confirmation, OV-03) and OV-04 prior-session dated meter fallback.
- `C. Cockpit` (`Strike` & `Expires … (N days)`, dual tracks in `Today`, dual rows in `Price History`, long & short `Worst case` / `Max reward`), `Review` cards (`Expiration` countdown + intrinsic-value-at-expiration note), and pure Mark-based `Corridor` Replay (OV-08, no Black-Scholes estimates). *(Expiration Payoff deferred to `D14`.)*

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `TradeAnalysis` (`assessPlan`, `derive`, `evaluate`, `replay`), `TradeWorkflows` (`confirmPlan`, `recordPositionChange`), `MarketData`, `DailyReview`, `TradeViewsAndReporting` extended for single-leg option contracts.
- **Mechanisms:** OCC option instrument key normalization; migration `v7 → v8`; `Installed Capability Manifest` v9.
- **Seeds:** `ReferenceCatalog` seeds `Long Call`, `Long Put`, and `Cash-Secured Put`.
- **Durable representation:** Schema v8 — option contract fields (`expirationDate`, `strike`, `right`, `multiplier: 100`), `exerciseIntent`, dual condition targets (`underlying` vs. `structure`), and 3 single-leg option Strategy seeds.

**Acceptance scenarios:**
- `AC-CALC-003` — **full** (dual Underlying-price & Option-price independent OR conditions, Ongoing/Worst-Case Risk, Incremental Reward, Overruns, Target not a Deviation; Management Revision verified in `D24`)
- `AC-PLAN-001`, `AC-PLAN-002` — **partial** — *Declared scope:* expanded to Single-Leg Options; completed across Vertical Spreads (`D11`) and Complex Multi-Leg (`D21`).
- `AC-SET-003` — **partial** — *Declared scope:* `Settlement Due` indicator shown on expired option with no inferred Expiration; completed with explicit Expiration in `D13` and Assignment/Exercise in `D23`.
- `AC-SET-004` — **partial** — *Declared scope:* `Exercise Intent` captured on long-option Plans; completed with Assignment/Exercise & Management Debt in `D23`/`D24`.
- `AC-CALC-002` — **partial** — *Declared scope:* dual Underlying+Option partial availability + OV-04 prior-session meter context; completed with multi-leg covered subtotals in `D11`.
- `AC-REF-001`, `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* 4 of 11 Strategy seeds; completed across `D11`, `D21`, `D22`, `D24`.

**Within-deliverable parallelism:** Once option Instrument & dual-condition types are fixed, (a) pure `TradeAnalysis` option math, (b) persistence/migration `v7 → v8` + Catalog seeds, and (c) option Plan form + dual Marks rows + dual `Today`/`Price History` UI can proceed in parallel.

---

### D10 — Automated Mark Retrieval (MarketData.app) & Underlying OHLC Daily Bars

**User stories:**
1. As a trader with growing open positions, I would like to configure my personal MarketData.app API token once (kept write-only and excluded from backups) and have `Review` automatically fetch missing closing Marks for my stocks and options, so that I don't have to type every price by hand — especially before adding multi-leg spreads.
2. As a trader overriding a questionable provider close or working offline, I would like my Manual Marks to remain sticky over later provider refreshes and any partial/offline failures to fall back smoothly to manual entry in the Marks grid, so that automation never corrupts my overrides or blocks my Review.
3. As a trader replaying a Trade, I would like to see real OHLC candlesticks on the Underlying price strip wherever Daily Bars exist (and close-only dots or explicit gaps where they don't), so that I can see intraday range context honestly without fabricated candles.

**Capability set:**
- **Provider configuration UI (`Settings` / `Pricing Provider`):** Enable, configure, test, or disable **MarketData.app** (`Disabled`, `Enabled` with redacted credential status, `Needs Setup`); Bearer token stored write-only in a dedicated non-exported credential store (strictly excluded from reads, diagnostics, and backups).
- **MarketData.app `PricingProvider` adapter (OV-09):** Fetches Stock Daily OHLC Bars (`/v1/stocks/candles/D/{symbol}/`, seeding closing Mark on empty keys) and historical Option EOD Marks (`/v1/options/quotes/{occSymbol}/`, `mid` preferred / `last` fallback), treating HTTP `200` and `203` as valid, with an explicit live browser **CORS confirmation** verification task.
- **Automatic bounded recovery in `DailyReview.open`:** Computes completed-session gaps per open Instrument, skips **sticky Manual Marks** (while allowing independent Daily Bars to refresh without altering the Manual Mark), keeps `Acknowledged Unavailable` keys eligible for factual recovery, pre-populates `Review`'s unified Marks grid with clear `Provider` vs `Manual` provenance, and surfaces partial/unsupported/offline issues strictly as non-blocking transient diagnostics (never fabricating Marks, acknowledgments, or Journal evidence).
- **OHLC candlesticks in `Corridor` Replay:** Renders real OHLC candles for Underlying sessions with Daily Bars, close-only points for Mark-only sessions, and explicit gaps for missing sessions (`AC-MARK-004`).

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** External port `PricingProvider.fetchClosingObservations`; `MarketData.getProviderConfiguration`, `MarketData.configureProvider`, `MarketData.recover`; `DailyReview.open` wired to `MarketData.recover`.
- **Mechanisms:** Isolated non-exported credential store; real local HTTP test-provider server for mock-free integration & browser-critic tests + explicit live MarketData.app CORS check; migration `v8 → v9`; `Installed Capability Manifest` v10.
- **Seeds:** None.
- **Durable representation:** Schema v9 — `market_bars` (OHLC revision chains), `market_provider_config` (nonsecret revisioned config), isolated `local_provider_secrets` store (excluded from Workspace backup snapshots).

**Acceptance scenarios:**
- `AC-MARK-002` — **full** (sticky Manual Mark over provider close + independent Daily Bar refresh)
- `AC-MARK-003` — **full** (provider error never creates acknowledgment; provider Mark supersedes acknowledgment while retaining history)
- `AC-MARK-004` — **full** (OHLC Daily Bar candles, close-only Mark points, and explicit gaps across series & Replay)
- `AC-MARK-005` — **full**
- `AC-MARK-006` — **partial** — *Declared scope:* single-Instrument Stock OHLC Daily Bars persisted & displayed honestly; completed with multi-Instrument synchronized Mark enforcement in `D11` and trailing-stop OHLC rules in `D24`.
- `AC-DEL-001` — **partial** — *Declared scope:* offline cold restart verified with configured provider reporting safe operational context while all Manual paths work; completed with local Restore in `D12`.
- `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* expanded to Provider configuration & OHLC Replay; ongoing through `D24`.

**Within-deliverable parallelism:** Once `PricingProvider` and `MarketData.recover` contracts are fixed, (a) MarketData.app HTTP adapter + local HTTP test server, (b) `MarketData` Bar/config/recovery persistence (`v8 → v9`), and (c) Provider Settings UI + Marks-grid provenance badges + Replay OHLC candlestick renderer can proceed in parallel.

---

### D11 — Vertical Option Spreads

**User stories:**
1. As an options trader entering defined-risk spreads, I would like to plan and execute `Vertical Call Debit`, `Vertical Call Credit`, `Vertical Put Debit`, and `Vertical Put Credit` spreads as one grouped decision with one reflection outcome, so that my spread legs stay united under a single Trade with exact spread-width risk bounds.
2. As a trader checking spreads across multiple legs and Trades, I would like shared Underlyings and contracts deduplicated in `Review`'s Marks grid (and auto-fetched by MarketData.app) with honest covered subtotals if one leg lacks today's Mark — plus clearly dated prior-session meter context — so that partial data never misleads me.

**Capability set:**
- Strategy selector adds all **4 Vertical Spread seeds** (`Vertical Call Debit Spread`, `Vertical Call Credit Spread`, `Vertical Put Debit Spread`, `Vertical Put Credit Spread`), validating same Underlying, same expiration, strike order, and equal contract ratio; supports net debit/credit entry, Underlying-price and **net spread-value** OR Stops/Targets, and exact Plan Baseline (`1R` & reward).
- **Multi-leg single-decision Position Changes (`AC-POS-002`):** One opening, scaling, or closing `Position Change` groups both leg Executions with individual Execution identities and **one** `Position Change Reflection` outcome.
- **Complete Planned-Leg fulfillment (`AC-POS-005`):** Per-leg `Unfilled`, `Partially Filled`, `Filled as Planned`, `Filled with Deviation` (single `Planned-Leg Terms` occurrence aggregating all mismatched fields on a served leg), `Unplanned Exposure`, `Not Entered`, and `Not Verifiable` (when objective-selector evidence is absent).
- **Completes the manual Marks grid component** for multi-leg & shared-Instrument deduplication (shared Underlyings/contracts appear once and resolve for all affected Trades atomically).
- Synchronized multi-Instrument valuation (`AC-CALC-002`): realized-to-date stays a `Value`, marked legs show as a labeled **covered subtotal**, net marked P&L / ongoing risk return `Unavailable` naming the exact missing leg & date, and the Gauge meter / risk display shows the OV-04 dated prior-session synchronized context (`At the <prior date> Marks`). Spread-width-capped `Worst case` & `Max reward` across `C. Cockpit`, `Review`, and `Corridor` Replay.

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `TradeAnalysis` (`assessPlan`, `derive`, `evaluate`, `replay`), `TradeWorkflows`, `DailyReview`, `MarketData.recover`, and `TradeViewsAndReporting` extended for 2-leg spread structures, synchronized multi-Instrument frames, and full Planned-Leg fulfillment.
- **Mechanisms:** Migration `v9 → v10`; `Installed Capability Manifest` v11.
- **Seeds:** `ReferenceCatalog` seeds the 4 Vertical Spread Strategies (8 of 11 total Strategy seeds).
- **Durable representation:** Schema v10 — multi-leg Planned Leg & Position Change member storage, `Planned-Leg Terms` Deviation occurrences, 4 vertical spread seeds.

**Acceptance scenarios:**
- `AC-POS-002` — **full** (extended to 3–4 legs in `D21`)
- `AC-POS-005` — **full**
- `AC-CALC-002` — **full** (multi-Instrument missing leg + realized-to-date + labeled covered subtotal + OV-04 prior-session dated meter context)
- `AC-PLAN-001`, `AC-PLAN-002` — **partial** — *Declared scope:* expanded to 4 Vertical Spreads; completed with Complex Multi-Leg in `D21`.
- `AC-REV-002` — **partial** — *Declared scope:* shared Mark resolves once across multiple Trades/legs; completed with Settlement Due ordering in `D13`.
- `AC-MARK-006` — **partial** — *Declared scope:* multi-Instrument structures enforce synchronized same-date Marks (never combining independent intraday extrema); completed with trailing-stop OHLC in `D24`.
- `AC-REF-001`, `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* 8 of 11 Strategy seeds; completed across `D21`, `D22`, `D24`.

**Within-deliverable parallelism:** Once multi-leg Plan, Position Change member, and covered-subtotal contracts are fixed, (a) pure `TradeAnalysis` multi-leg math & fulfillment, (b) persistence/migration `v9 → v10` + 4 seeds, and (c) multi-leg Plan/Execution forms + spread `C. Cockpit`/Marks/Replay UI can proceed in parallel.

---

### D12 — Portable Backup, Read-Back Verification, Replace-Only Restore, & Rebuild Equivalence

**User stories:**
1. As a trader storing my only journal copy locally in a browser, I would like to download a complete, secret-free backup artifact and verify it by selecting the saved file back, so that I have a `CompletedBackupReceipt` proving my backup is intact on disk — even if my browser enters `Recovery Only`.
2. As a trader moving to a new device or recovering from a mistake, I would like Restore to validate and preview the entire replacement impact without touching live data, require either an exact-target verified safety backup or explicit warning acknowledgment, and replace the entire Workspace atomically — rolling back completely if anything fails.

**Capability set:**
- Adds **`Backup`** to the primary navigation (`Trades`, `Review`, `New Plan`, `Accounts`, `Backup`, `About`), available in both `Writable` and `Recovery Only` modes.
- **Two-step verified backup (ADR 0010):**
  1. `Download backup` (`Workspace.exportBackup`): single `readonly` full-Workspace snapshot across `TradeRecord`, `Journal`, `MarketData`, `ReferenceCatalog`, and Workspace metadata — **strictly excluding** `local_provider_secrets` (MarketData.app Bearer token), transient diagnostics, unsaved forms, and rebuildable projections — emitting canonical UTF-8 JSON with per-section & full SHA-256 digests (`Workspace Backup Manifest`), returning `Downloaded` (never a receipt; expected binding & digest live only in transient view state).
  2. `Verify backup` (`Workspace.confirmBackup`): trader selects the saved file via `<input type="file">`; app reads back bytes and verifies completeness, section/full SHA-256 digests, and exact source `WorkspaceSnapshotBinding`, returning `Completed` with `CompletedBackupReceipt` or typed `Not Verified`.
- **Validation-first, atomic replace-only Restore (`AC-REST-001`–`004`):**
  - `Workspace.prepareRestore`: non-mutating validation of envelope/digests, version support, isolated forward migration of supported older backups, all 4 fact-module `prepareRestore` checks, `TradeAnalysis` lifecycle/Lot-Match/Deviation verification (disclosing repairable stale derived state vs. rejecting incoherent facts), cross-section reference closure, zero provider calls, and `Needs Setup` outcome for restored provider configs (since credentials are excluded).
  - `Workspace.applyPreparedRestore`: requires `Writable` readiness, sufficient capacity headroom, explicit *Replace Entire Workspace* confirmation, and (when live data exists) either an exact-target `CompletedBackupReceipt` or explicit decline after warning; replaces all authoritative sections atomically via generation swap, rebuilds private projections (`proj_trade_analysis_input`), re-establishes Runtime Readiness, invalidates all pre-Restore views, and returns fresh status & landing state with zero follow-up read.
- **Private-projection rebuild equivalence (`AC-REBUILD-001`):** Proves deleting and reconstructing `proj_trade_analysis_input` and secondary indexes reproduces identical observable lists, details, replays, and reviews.

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `Workspace.exportBackup`, `Workspace.confirmBackup`, `Workspace.prepareRestore`, `Workspace.applyPreparedRestore`; `exportSnapshot`, `prepareRestore`, `applyPreparedRestore` on `TradeRecord`, `Journal`, `MarketData`, and `ReferenceCatalog`.
- **Mechanisms:** Canonical JSON serializer + Web Crypto SHA-256 section/full digester; generation-isolated atomic Restore swap (`tjv3_ws_gen_<n+1>` + pointer flip); controlled section-failure & unreadable-store fault hooks for `AC-REST-003`/`AC-DEL-005`; `Installed Capability Manifest` v12.
- **Seeds:** None.
- **Durable representation:** No breaking domain schema change (Schema v10 backup envelope format v1 + rebuildable projection rebuilder).

**Acceptance scenarios:**
- `AC-BACK-001` — **full** (including proof that MarketData.app credentials are absent)
- `AC-REST-001` — **full**
- `AC-REST-002` — **full**
- `AC-REST-003` — **full**
- `AC-REST-004` — **full** (failed-migration recoverability & backup export path)
- `AC-LIFE-003` — **full** (Restore candidate repair vs. incoherent rejection)
- `AC-DEL-001`, `AC-DEL-005`, `AC-DEL-006`, `AC-UI-002` — **full** (offline local Restore, `Recovery Only` backup/verify, post-Restore readiness re-establishment, destructive-Restore accessibility)
- `AC-REBUILD-001` — **partial** — *Declared scope:* reconstruction equivalence verified across Trades, Journal, Market Data, Review, and Replay; completed across all 4 deterministic report families in `D15`–`D18`.
- `AC-RESP-001`, `AC-UI-001`, `AC-CAP-001` — **partial** — *Declared scope:* expanded to Backup/Restore surfaces; ongoing through `D24`.

**Within-deliverable parallelism:** Once the Backup envelope v1 schema and per-module `exportSnapshot`/`prepareRestore`/`applyPreparedRestore` signatures are fixed, the 4 fact-module export/restore implementations and the `Backup` / Restore preview & confirmation UI can proceed in parallel.

---

### D13 — Simple Option Expiration (`Record expiration` & ITM `Record later` Bridge)

**User stories:**
1. As an options trader whose out-of-the-money option or spread expired worthless, I would like to confirm `Record expiration` directly from `Review` or `C. Cockpit` — with no manufactured Close Reason and accurate `Option Disposition Timing` — so that expired options close cleanly without faking a zero-price fill.
2. As an options trader whose option finished in the money before full Assignment/Exercise Stock allocation is built, I would like `Review` to show how much it finished in the money and let me mark `Exercised / Assigned: record later` (or record a pre-close sale, or guarded `Expired worthless` with a reason), so that today's Review can finish honestly while reminding me next session.

**Capability set:**
- Explicit **`Expiration` Settlement Fact** inside `TradeWorkflows.recordPositionChange` (disposes option quantity without synthesizing a zero-price Execution; closes Trade with `Terminal Disposition` = Expiration and **no** Close Reason; derives full `Option Disposition Timing`: `FullyDisposedPreExpiration`, `FullyHeldToExpirationSettlement`, or `Mixed`).
- **`Review` expiration UX (`review-coach-mockup/index.html`, OV-07):**
  - Expiration-day Marks grid adds `"Expired worth nothing: enter 0"` hint and auto-accepts `$0.00` on expiration date without triggering the pre-expiration `"Worth nothing?"` prompt; past-expired contracts omit future Mark rows.
  - OTM expiration card: shows Underlying vs. strike and primary one-click **`Record expiration`** (plus secondary `Sold / Bought back before the close`).
  - ITM expiration card: shows exact ITM amount & expiration P&L, primary **`Exercised / Assigned: record later`** (lets today's Review finish as **`Complete, settlement to record`** while re-asking next Review until settled or `D23` lands), secondary `Sold / Bought back before the close`, and guarded `It expired worthless` requiring a reason.
- **`C. Cockpit` `Settlement Due` & `Closed by expiration` states (`trade-detail/index.html`):** `Settlement Due` panel leading `Needs you` with `Record expiration`; `Closed by expiration` shows `Expired <date>`, `Settlement` list apart from `Executions`, and `Option Disposition Timing`.
- `Corridor` Replay renders `Expired` markers and final settled state.

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `TradeWorkflows.recordPositionChange` (`Expiration` Settlement Fact variant); `TradeAnalysis.derive` (`Expiration` disposal, `Mixed` / `FullyHeldToExpirationSettlement` Option Disposition Timing, non-agency no-Close-Reason check); `DailyReview` (`open`/`getTrade`/`save` extended for `Settlement Due` priority band, OTM expiration, and ITM `record later` deferral state).
- **Mechanisms:** Migration `v10 → v11` (plus Backup envelope v2 / v1→v2 Restore migration); `Installed Capability Manifest` v13.
- **Seeds:** None (explicitly never seeds `"Expired"` as a Close Reason).
- **Durable representation:** Schema v11 — `settlement_facts` (`Expiration` kind) and `settlement_deferrals` (non-authoritative Review ITM `record later` reminder).

**Acceptance scenarios:**
- `AC-POS-004` — **full** (non-agency Expiration manufactures no Close Reason; Close Review never blocks closure)
- `AC-REV-002` — **full** (Marks → Debt → Settlement Due → Trade ordering & resumption)
- `AC-SET-003` — **partial** — *Declared scope:* explicit `Expiration` settlement & `Settlement Due` blocker/bridge (OV-07); completed with explicit `Assignment`/`Exercise`/cash settlement in `D23`.
- `AC-LIFE-001` — **partial** — *Declared scope:* `Closed` via Expiration; completed across `Abandoned` (`D22`) and Assignment/Exercise (`D23`).
- `AC-REV-006` — **partial** — *Declared scope:* adds prototype `Complete, settlement to record` completion state; completed with reversible completion on correction/Void in `D19`/`D22`.
- `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* expanded to Expiration flows; ongoing through `D24`.

**Within-deliverable parallelism:** Once `Expiration` Settlement Fact and Review settlement-card types are fixed, (a) `TradeAnalysis`/`TradeWorkflows`/`DailyReview` settlement persistence + `v10 → v11` migration and (b) `Review` expiration cards + `C. Cockpit` `Settlement Due`/`Closed by expiration` UI can proceed in parallel.

---

### D14 — Expiration Payoff (Single-Leg & Vertical Spreads)

**User stories:**
1. As an options trader evaluating a planned or open single-leg option or vertical spread, I would like to view Planned (dashed) and Current (solid, offset by realized P&L) Expiration Payoff curves together on one chart with exact breakevens, max profit, and max loss, so that I understand my structural payoff independently of today's option Mark.
2. As a trader checking an option inside Daily Review, I would like an expandable `More figures` summary showing at-expiration breakeven, max profit, and max loss, so that I can sanity-check payoff bounds without leaving Review.

**Capability set:**
- **`C. Cockpit` `Payoff` drawer (`trade-detail/index.html`):** Combined accessible SVG chart overlaying **Planned (dashed)** and **Current (solid, including realized-to-date offset while Open; `Not Applicable` when flat; `Not Applicable` for Stock-only Trades)** piecewise-linear curves over nonnegative Underlying price through `+∞`, plus exact zero crossings / touches / zero ranges, signed maximum profit & minimum loss (or `Unbounded`), complete attainment sets, current Underlying line, and tabular textual equivalent.
- **`Review` `More figures` fold:** Concise at-expiration breakeven, max profit, and max loss right inside each option Trade's `Now` box.

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `TradeAnalysis.expirationPayoff` (general co-expiring piecewise-linear solver over exact `BigInt` `Rational` breakpoints — ready with zero rewrite for `D21`'s Covered Call, Iron Condor, and mixed-expiration PMCC `Unavailable`); `TradeViewsAndReporting.getTradeDetail` & `DailyReview.getTrade` attach Planned & Current payoff views.
- **Mechanisms:** Bespoke accessible Payoff SVG component; `Installed Capability Manifest` v14.
- **Seeds:** None.
- **Durable representation:** **None** (pure analysis & presentation — zero schema migration).

**Acceptance scenarios:**
- `AC-CALC-004` — **partial** — *Declared scope:* independent Planned & Current Expiration Payoff curves, zero sets, extrema, attainment sets, flat/Stock `NotApplicable`, and strict separation from Mark-to-Market valuation across Single-Leg & Vertical Spreads; completed with mixed-expiration `Unavailable` (PMCC) and Stock+Option co-expiring payoff (Covered Call / Iron Condor) in `D21`.
- `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* accessible SVG payoff chart + textual equivalent; ongoing through `D24`.

**Within-deliverable parallelism:** Zero schema change — once `ExpirationPayoffViews` types are fixed, pure `TradeAnalysis.expirationPayoff` and the Payoff SVG / `C. Cockpit` / Review `More figures` UI can proceed in parallel. *(Also safe to run in parallel across deliverables with `D13` or `D15`–`D18` — see Section 6.)*

---

### D15 — Aggregate Metrics: Outcomes Report

**User stories:**
1. As a trader evaluating my trading results over time, I would like an **Outcomes** report across the 6 fixed Report Periods (`All Time`, `YTD`, `QTD`, `MTD`, `This Week`, `Last Week`) showing Closed-Trade P&L, Win/Breakeven/Loss counts, Win Rate, Profit Factor, Realized R distribution, and cumulative dollar & Closed-R curves, so that I can measure real performance with exact arithmetic.
2. As a trader slicing performance by book or setup, I would like to filter and apply one **`Break Down By`** dimension (`Strategy`, `Underlying`, `Account`, `Institution`, `Option Disposition Timing`, `Entry/Exit Scaling`) while keeping `Overall` visible and drilling straight into contributing Trades, so that every aggregate number is traceable.

**Capability set:**
- Adds **`Reports`** to primary navigation with shared Report Period controls (6 fixed calendar presets in Workspace time zone — no custom date range), filter bar (`Lifecycle State`, `Account`, `Institution` [expanded through Accounts], `Strategy`, `Underlying`, `Option Disposition Timing`, `Entry/Exit Scaling` — AND across dimensions, OR within), optional 1D **`Break Down By`** (retaining `Overall`, explicit non-additive disclosure for multi-Underlying, report-only `Unspecified` last), and contributor drill-down navigation.
- **`Outcomes` (`PerformanceAnalysis.outcomes`):** Exact unrounded net P&L Win/Breakeven/Loss classification; Win Rate; mean & exact median P&L and Realized R; Profit Factor (no losers → `Unavailable`, losses with no gains → `0`); cumulative realized-dollar SVG curve (including partial realization from still-Open Trades at Lot-Match Economic Time) & cumulative Closed-Trade-R SVG curve (planned Closed Trades with positive `1R`) with deterministic tie-breaking and tabular textual equivalents (**no saved reports, no nested grouping, no Insights/coaching**).

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `PerformanceAnalysis.outcomes`; `TradeViewsAndReporting.runReport` (`Outcomes` family, snapshot-bound complete-page population exhaustion).
- **Mechanisms:** Workspace-local calendar Report Period resolver; bespoke accessible cumulative-curve SVG charts; `Installed Capability Manifest` v15.
- **Seeds:** None.
- **Durable representation:** **None** (ephemeral deterministic report — zero schema migration).

**Acceptance scenarios:**
- `AC-RPT-001` — **partial** — *Declared scope:* all 6 fixed calendar Report Period presets on Outcomes; completed with Current Exposure rejecting/omitting Report Period in `D16`.
- `AC-RPT-002` — **partial** — *Declared scope:* full Outcomes populations, exact arithmetic, Profit Factor, and cumulative curves; completed with corrected realization points & correction-free sensitivity in `D19`.
- `AC-RPT-006` — **partial** — *Declared scope:* filters, 1D breakdowns, Institution expansion, `Overall`, page exhaustion, and drill-down for Strategy, Underlying, Account, Institution, Option Disposition Timing, and Entry/Exit Scaling; completed with Tag & `IdeaSource` dimensions in `D22`.
- `AC-REBUILD-001` — **partial** — *Declared scope:* extended to Outcomes; completed across Current Exposure (`D16`), Scorecard (`D17`), and Journal Field (`D18`).
- `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* expanded to `Reports` shell & Outcomes SVG curves; ongoing through `D24`.

**Within-deliverable parallelism:** Zero schema change — once `PerformanceAnalysis.outcomes` and `DeterministicReportView` contracts are fixed, (a) pure `PerformanceAnalysis.outcomes` + Report Period resolver, (b) `TradeViewsAndReporting.runReport` population exhaustion, and (c) `Reports` shell, filter/breakdown bar, and cumulative SVG charts can proceed in parallel.

---

### D16 — Aggregate Metrics: Current Exposure Report & Mature-Scale Benchmark

**User stories:**
1. As a trader monitoring live portfolio risk, I would like a **Current Exposure** report showing Open Trade count, realized-to-date vs. open-marked vs. combined P&L, aggregate Plan Risk, Ongoing Risk, Worst-Case Risk, Incremental Reward, and breached/reached counts with explicit finite, `Unbounded`, `Missing`, and `Acknowledged Unavailable` coverage, so that missing Marks or unbounded legs never distort portfolio totals.
2. As a trader with years of history in my local browser journal, I would like cold startup and warm open-list navigation to remain fast offline at mature scale (25,000 Trades / 200 Open / 200,000 facts), so that the journal never slows down as my history grows.

**Capability set:**
- **`Current Exposure` (`PerformanceAnalysis.exposure`):** Reuses `D15`'s `Reports` shell, filter bar, and 1D `Break Down By`; explicitly omits/rejects Report Period (`AC-RPT-001` full); Open Trades only (Lifecycle filter excluding Open → `Not Applicable`); independent realized-to-date, open-marked, and combined P&L; finite covered subtotals + exact `Unbounded`, `Missing`, and `Acknowledged Unavailable` contributor cohorts; at most one breach/overrun contribution per Trade; optional like-covered portfolio reward-to-risk ratio (never averaging Trade ratios).
- **Mature-scale latency & correctness verification (`AC-PERF-001`):** Deterministic 25,000-Trade / 200-Open / 200,000-fact dataset generator, offline cold startup (`p95 <= 2,500 ms`) & warm open-list navigation (`p95 <= 1,500 ms`) benchmarks in the disclosed local environment with query-count traces and before/after correctness checks.

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `PerformanceAnalysis.exposure`; `TradeViewsAndReporting.runReport` (`CurrentExposure` family).
- **Mechanisms:** Deterministic 25k-Trade / 200k-fact benchmark generator & latency harness; `Installed Capability Manifest` v16.
- **Seeds:** None.
- **Durable representation:** **None** (ephemeral report; any optional private index tuning stays rebuildable and proven equivalent under `AC-REBUILD-001`).

**Acceptance scenarios:**
- `AC-RPT-001` — **full** (Current Exposure omits/rejects Report Period alongside `D15`'s 6 dated presets)
- `AC-RPT-003` — **full**
- `AC-PERF-001` — **full**
- `AC-REBUILD-001` — **partial** — *Declared scope:* extended to Current Exposure; completed with Scorecard (`D17`) and Journal Field (`D18`).
- `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* expanded to Current Exposure UI; ongoing through `D24`.

**Within-deliverable parallelism:** Zero schema change — once `PerformanceAnalysis.exposure` types are fixed, pure `PerformanceAnalysis.exposure`, the Current Exposure UI, and the 25k-Trade benchmark generator can proceed in parallel. *(Also safe in parallel across deliverables with `D14`, `D17`, and `D18` after `D15` merges.)*

---

### D17 — Aggregate Metrics: Process Scorecard Report

**User stories:**
1. As a trader focused on process over outcome luck, I would like a strictly descriptive **Process Scorecard** across the 6 Report Periods showing Plan outcomes, Entry Quality coverage & rates, Deviation categories, Stop/Target overrun episodes, reflection completion/decline/due rates, and Option Disposition Timing — with no composite grade — so that I can see where my process holds or breaks down.

**Capability set:**
- **`Process Scorecard` (`PerformanceAnalysis.scorecard`):** Strictly descriptive (zero composite adherence percentage or automated judgment) across metric-specific natural dates and denominators inside `Reports`:
  - Plan outcomes (confirmed cohort partitioned into Entered / Still Planned; Abandoned joins in `D22`);
  - Entry Quality (`Applicable`, `Below Plan`, `Met or Exceeded`, `Pending`, `Unavailable`, `Not Applicable`, `Below-Plan Entry Rate`, `Comparison Coverage`);
  - Conformance across installed Deviation categories (`Planned-Leg Terms`, `Entry Size`, `Unplanned Exposure`, `Stop Discipline`);
  - Stop/Target behavior (evaluable opportunities including zero-event overlapping Trades, distinct continuous episodes, max observed Overrun per episode, explicit missing-observation gap disclosure);
  - Reflection outcomes for obligated moments (`Plan Reflection`, `Position Change Reflection`, `Close Review`, `Daily Trade Review` — `Completed`, `Explicitly Declined`, `Due`, `Retired`);
  - Option Disposition Timing partition, quantities, mechanisms, and coverage;
  - *(Management activity section activates when Management Revisions land in `D24`.)*

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `PerformanceAnalysis.scorecard`; `TradeViewsAndReporting.runReport` (`ProcessScorecard` family).
- **Mechanisms:** `Installed Capability Manifest` v17.
- **Seeds:** None.
- **Durable representation:** **None** (ephemeral deterministic report — zero schema migration).

**Acceptance scenarios:**
- `AC-RPT-004` — **partial** — *Declared scope:* full Scorecard semantics across all installed capabilities; completed with correction disclosure/sensitivity (`D19`), Abandoned Plans (`D22`), and Management Revisions (`D24`).
- `AC-REBUILD-001` — **partial** — *Declared scope:* extended to Process Scorecard; completed with Journal Field in `D18`.
- `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* expanded to Process Scorecard UI; ongoing through `D24`.

**Within-deliverable parallelism:** Zero schema change — once `ProcessScorecard` contracts are fixed, pure `PerformanceAnalysis.scorecard` and the Scorecard UI can proceed in parallel. *(Also safe in parallel across deliverables with `D14`, `D16`, and `D18` after `D15` merges.)*

---

### D18 — Aggregate Metrics: Categorical Journal Field Report

**User stories:**
1. As a trader reviewing my journaled emotions, decision modes, convictions, and actions, I would like a **Journal Field** report grouping one Entry Type and one categorical Prompt (`Single Select` or `Scale`) by stable option identity — distinguishing answered, optional unspecified, due, declined, and retired outcomes — so that I can inspect behavioral patterns honestly without nested breakdowns or false causal claims.

**Capability set:**
- **`Journal Field` (`PerformanceAnalysis.journalField`):** Select one installed Entry Type and one categorical Prompt (`Single Select` or `Scale`; `Text`/`Number`/`Date` return `Not Applicable`; `Tag Select` joins in `D22`), grouping each effective Entry identity once by stable response identity over its moment/origin Economic Date, disclosing Answered / optional Unspecified / Due / Declined / Retired counts with Entry and distinct related-Trade drill-down navigation.

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `PerformanceAnalysis.journalField`; `TradeViewsAndReporting.runReport` (`JournalField` family).
- **Mechanisms:** `Installed Capability Manifest` v18.
- **Seeds:** None.
- **Durable representation:** **None** (ephemeral deterministic report — zero schema migration).

**Acceptance scenarios:**
- `AC-REBUILD-001` — **full** (all 4 deterministic report families verified under private-projection rebuild)
- `AC-RPT-005` — **partial** — *Declared scope:* Single Select & Scale across obligated Entry Types, distinct outcome counts, non-categorical `Not Applicable`; completed with `Tag Select`, Edit/Voided Entry disclosure, and Standalone Entries in `D22`.
- `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* expanded to Journal Field UI; ongoing through `D24`.

**Within-deliverable parallelism:** Zero schema change — once `JournalFieldReport` contracts are fixed, pure `PerformanceAnalysis.journalField` and the Journal Field UI can proceed in parallel. *(Also safe in parallel across deliverables with `D14`, `D16`, and `D17` after `D15` merges.)*

---

### D19 — Execution & Settlement Corrections (`Replace`, `Void`, `View history`, & Report Sensitivity)

**User stories:**
1. As a trader who mistyped a fill price, quantity, fee, or time — or entered a duplicate fill — I would like to `Replace` or `Void` that Execution or Expiration (with a plain-language preview of material impacts before committing) and inspect `View history`, so that my economic history stays accurate while every prior saved value remains auditable.
2. As a trader reviewing historical Daily Reviews and performance reports after fixing a fact, I would like affected Review eligibility restated and `Outcomes`, `Current Exposure`, and `Process Scorecard` to show structured Correction Footprints with optional correction-free sensitivity, so that historical restatements are completely transparent.

**Capability set:**
- **`Edit → Save` and `View history`** on Executions and Expiration Settlements in `C. Cockpit`:
  - **`Replace`:** Appends an immutable version under the same `TradeFactId`, keeps `RecordedSequence` stable even if `EconomicTime` changes, and restates FIFO Lot Matches, fees, P&L, Lifecycle State, Deviations, Replay, and reports at original Economic Time.
  - **`Void`:** Appends a visible reasoned Void version removing economic effect (never deleting or hiding history); retires Outstanding Position Change Reflection Debt as *Underlying Fact Voided* if no effective members remain, while keeping completed Reflections visible and marked as Voided-origin (excluded from real-event counts).
  - **Materiality-gated preview (`previewCorrection` → `commitCorrection`):** Non-mutating **Correction Footprint** disclosing affected Trades/facts, lifecycle/disposition/Lot Match/P&L/Deviation/Journal/Debt consequences, and affected replay/review intervals; stale preview bindings reject with zero writes.
- **Historical restatement & report sensitivity:** `DailyReview` restates exact-date historical eligibility & completion (`AC-REV-001`, `AC-REV-006`); `Outcomes`, `Current Exposure`, and `Process Scorecard` display structured **Correction Footprints** and optional **correction-free sensitivity** (`AC-RPT-002`, `AC-RPT-004`).

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `TradeAnalysis.assessChange` (`Replace` & `Void`); `TradeWorkflows.previewCorrection`, `TradeWorkflows.commitCorrection`; `TradeRecord.history`, `TradeRecord.prepareChange`/`applyPreparedChange` (`ReplaceFact`, `VoidFact`).
- **Mechanisms:** Preview canonical digest & optimistic multi-revision binding; atomic multi-module correction rollback; `Installed Capability Manifest` v19; Backup envelope v3 (`v1`/`v2 → v3` Restore migration).
- **Seeds:** None.
- **Durable representation:** Schema v12 (migration `v11 → v12`) — explicit correction metadata (`correctionReason`, `correctionFootprint`, Voided-origin Debt retirement status).

**Acceptance scenarios:**
- `AC-CORR-001` — **full**
- `AC-CORR-002` — **full**
- `AC-REV-001` — **full** (historical eligibility restated by correction)
- `AC-RPT-002` — **full** (corrected realization points at original Economic Time + correction-free sensitivity)
- `AC-CORR-005` — **partial** — *Declared scope:* non-mutating evidence-bound fact-correction preview & stale rejection; completed with shared-Mark preview in `D20`.
- `AC-CORR-004` — **partial** — *Declared scope:* atomic all-or-nothing rollback on single-Trade & multi-leg Position Change corrections; completed with cross-Trade linked Assignment/Exercise/Roll corrections in `D23`–`D24`.
- `AC-REV-006`, `AC-RPT-004`, `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* reversible Review completion & Scorecard correction sensitivity; completed across `D22`–`D24`.

**Within-deliverable parallelism:** Once `CorrectionPreview` and `CorrectionFootprint` contracts are fixed, (a) pure `TradeAnalysis.assessChange`, (b) `TradeRecord.history` + `TradeWorkflows` `Replace`/`Void` commit + `v11 → v12` migration, and (c) `Edit` / impact preview modal + `View history` + report sensitivity UI can proceed in parallel.

---

### D20 — Trade `Rebuild` & Shared-Mark Impact Preview (`previewMarkChange`)

**User stories:**
1. As a trader fixing a tangled Trade record that cannot be repaired cleanly by single-fact edits, I would like to `Rebuild` the Trade under its same stable `TradeId` while keeping historical Execution Anchors navigable as `Superseded`, so that my Journal narrative is never lost or silently redirected.
2. As a trader correcting a believed-wrong historical Mark shared across multiple Trades, I would like to preview every affected Trade's P&L, Replay, and Deviation impact before committing the Mark correction, so that I see the full cross-Trade ripple before saving.

**Capability set:**
- **`Rebuild` (`TradeRecord.prepareChange`/`applyPreparedChange` [`RebuildTrade`]):** Preserves stable `TradeId`, assigns new fact identities and `RecordedSequence` values in explicit reconstruction order, retains superseded Execution identities for history & `resolveAnchors` as `Superseded` (never silently redirected), and commits atomically via `previewCorrection` → `commitCorrection`.
- **Shared-Mark correction impact preview (`TradeViewsAndReporting.previewMarkChange`):** Non-mutating paired current/hypothetical frame evaluation across every bounded candidate Trade holding that exact Instrument (distinguishing relevant vs. unaffected Trades, per-Trade calculation/Replay/Deviation impact, and projected Correction Footprint), returning the exact `MarketData.save` precondition without mutating evidence-bound Deviation history.

**Operations, mechanisms, seeds, & durable changes:**
- **Operations:** `TradeWorkflows.previewCorrection`/`commitCorrection` (`Rebuild` variant); `TradeRecord.prepareChange`/`applyPreparedChange` (`RebuildTrade`), `TradeRecord.resolveAnchors` (`Superseded`); `TradeViewsAndReporting.previewMarkChange`; `MarketData.query` (hypothetical Candidate Manual Mark frames).
- **Mechanisms:** `Installed Capability Manifest` v20; Backup envelope v4 (`v1`–`v3 → v4` Restore migration).
- **Seeds:** None.
- **Durable representation:** Schema v13 (migration `v12 → v13`) — `supersededByRebuild` historical fact-identity tombstones for `resolveAnchors`.

**Acceptance scenarios:**
- `AC-CORR-003` — **full**
- `AC-CORR-005` — **full** (both fact and shared-Mark non-mutating evidence-bound preview & stale rejection)
- `AC-RESP-001`, `AC-UI-001`, `AC-UI-002`, `AC-CAP-001` — **partial** — *Declared scope:* expanded to `Rebuild` and Mark-impact preview; ongoing through `D24`.

**Within-deliverable parallelism:** Once `RebuildTrade` and `MarkChangeImpactView` contracts are fixed, (a) `Rebuild` persistence/anchor resolution (`v12 → v13`), (b) `TradeViewsAndReporting.previewMarkChange` + Candidate Manual Mark frames, and (c) `Rebuild` editor + Mark-impact preview UI can proceed in parallel.

---

## 5. Deferred Deliverables (Placeholders — `TODO` to Flesh Out Later)

> **Scope note:** The four deliverables below complete the remaining canonical `specs/` capabilities that you explicitly deferred behind the near-term wave (`D1`–`D20`). None of their capabilities are advertised in `Installed Capability Manifest` until fleshed out, approved, and implemented. Each carries a `TODO` marker so we can drill into user stories, exact operations, migrations, and task breakdowns when you are ready for them.

### D21 — Complex Multi-Leg Option Strategies & Custom Strategy Shapes *(Placeholder — TODO)*
- **TODO:** Flesh out full user stories, UI entry points, migration details, and review decisions when prioritized.
- **Planned capability scope:** Final 3 canonical Strategy seeds (**`Covered Call`** [mixed Stock + Option share-coverage], **`PMCC`** [mixed-expiration], **`Iron Condor`** [4-leg ascending strikes with asymmetric wings]), trader-created custom typed Strategy shapes, and Strategy rename/retirement (`ReferenceCatalog.save`). Extends `TradeAnalysis.expirationPayoff` to Stock+Option co-expiring payoff and explicit `Unavailable` for mixed expirations (`PMCC`).
- **Completes scenarios:** `AC-PLAN-001` (full), `AC-PLAN-002` (full), `AC-CALC-004` (full), `AC-REF-002` (partial — Strategies), `AC-REF-001` (partial — all 11 Strategy seeds).

### D22 — Direct Journaling, Taxonomies (`Tags` / `IdeaSource`), Runtime Form Definitions, & `Abandon Plan` *(Placeholder — TODO)*
- **TODO:** Flesh out full user stories, UI entry points, migration details, and review decisions when prioritized.
- **Planned capability scope:** Voluntary **`Trader Reflection`** & **`Review Note`** Entries (`Journal.save`, `Standalone` / `Trade` / `Execution` Anchors, `Trade Detail` & `Journal` Sources), global Journal timeline & filters, **`Edit` / `Addendum` / `Void`** on Journal Entries (with atomic Debt reopen when Voiding a sole settlement Entry), **`Tag Types` / `Tag Values` / `IdeaSource`** management (Plan & Journal `Tag Select` binding, filter & 1D report breakdown), runtime **`Journal.reviseDefinition`** (prospective prompt/option changes preserving historical & Debt snapshots), and **`TradeWorkflows.abandonPlan`** (with 5 seeded `Abandonment Reasons`, `Abandoned` lifecycle state, and Void-restored eligibility).
- **Completes scenarios:** `AC-LIFE-002` (full), `AC-JOUR-002` (full), `AC-JOUR-004` (full), `AC-JOUR-005` (full), `AC-RPT-005` (full), `AC-RPT-006` (full), `AC-REF-002` (full), `AC-REV-006` (full), `AC-REF-001` (partial — Abandonment Reasons & `IdeaSource`), `AC-JOUR-007` (partial — 6 of 7 Entry Types).

### D23 — Full Physical & Cash Option Settlement (`Assignment` & `Exercise`) *(Placeholder — TODO)*
- **TODO:** Flesh out full user stories, UI entry points, migration details, and review decisions when prioritized.
- **Planned capability scope:** Explicit **`Assignment`**, **`Exercise`**, and **cash-settlement** facts inside `TradeWorkflows.recordPositionChange`: separate `Settlement Price` vs. adjusted Stock basis/proceeds (option premium counted once), explicit allocation to compatible existing Stock Trade (`NeedsResolution` when ambiguous — never guessed) with residual exposure creating a settlement-origin successor Stock Trade, advance **`Exercise Intent`** semantics vs. unplanned automatic exercise, and atomic creation of workflow-routed **`Management Debt`** for unmanaged settlement-created Stock exposure (refusing prose-only settlement). Replaces the `D13` ITM `record later` bridge with full Assignment/Exercise recording.
- **Completes scenarios:** `AC-SET-001` (full), `AC-SET-002` (full), `AC-SET-003` (full), `AC-LIFE-001` (full), `AC-SET-004` (partial), `AC-JOUR-006` (partial), `AC-CORR-004` (partial — linked Assignment/Exercise corrections).

### D24 — Management Revisions (`Adjust`) & Option Rolls (`Roll`) *(Placeholder — TODO)*
- **TODO:** Flesh out full user stories, UI entry points, migration details, and review decisions when prioritized.
- **Planned capability scope:**
  - **`TradeWorkflows.reviseManagement`** + **`Management Revision`** Entry Type & Source + **`Adjust`** Daily Review Action: prospective Stop/Target/thesis revisions (paired `AllOrNone` revised Thesis/Invalidation, required Revision Rationale, resolving `Management Debt`, never altering frozen Plan Baseline `1R`, never classified as a Deviation; adds single-Instrument trailing-stop Daily Bar OHLC range rules if included).
  - **Partial & full Option Rolls** inside `TradeWorkflows.recordPositionChange` + **`Roll`** Daily Review Action + **`Rolled`** Close Reason seed: closes selected predecessor quantity, leaves untouched holdings intact, confirms successor Plan & Plan Reflection, assigns new Executions exclusively to successor, writes typed predecessor/successor lineage atomically.
- **Completes scenarios:** `AC-POS-003` (full), `AC-SET-004` (full), `AC-JOUR-006` (full), `AC-JOUR-007` (full — all 7 Entry Types & 7 Sources), `AC-REF-001` (full — all 11 Strategies, 5 Close Reasons, 5 Abandonment Reasons, `IdeaSource`), `AC-CALC-001` (full), `AC-MARK-006` (full), `AC-CORR-004` (full), `AC-RPT-004` (full), `AC-RESP-001` (full), `AC-CAP-001` (full).

---

## 6. Parallelism Map

### Within-deliverable parallelism
Inside every deliverable (`D1`–`D20`), once the deliverable's public TypeScript request/response & view-model interfaces are frozen in its opening interface step, up to **three tracks** can proceed concurrently before integration:
1. **Pure Analysis Track** (`ExactNumber`, `TradeAnalysis`, `PerformanceAnalysis`, session calendar) — zero I/O, pure TDD.
2. **Persistence & Coordinator Track** (IndexedDB stores, generation migration, fact modules, coordinators, `PricingProvider` adapter) — Vitest + `fake-indexeddb`.
3. **Production UI Track** (React components, CSS Modules, bespoke SVG charts, keyboard/ARIA) — coded against the frozen view-model types and integrated with the real coordinator before running mock-free integration & browser-critic gates.

### Across-deliverable parallelism (genuinely safe pairs only)
Because most deliverables serialize on the shared resources in Section 3 (IndexedDB schema/migrations, seed manifests, `Installed Capability Manifest`, primary nav shell, `Review` screen, and `C. Cockpit`), **only pure-read / zero-migration deliverables with disjoint UI surfaces can safely overlap** once their prerequisite deliverable is committed (still serializing the tiny final `Installed Capability Manifest` registration commit):

| Safe parallel pair / group | Prerequisite | Why it is safe | Single-owner merge points |
|---|---|---|---|
| **`D13` (Simple Expiration) ∥ `D14` (Expiration Payoff)** | `D12` merged | `D14` has **zero schema/migration/seed changes**, touches only `TradeAnalysis.expirationPayoff` and `C. Cockpit`'s new `Payoff` drawer + `Review`'s `More figures`, while `D13` owns schema `v11`, `Settlement` facts, and expiration cards. | `Installed Capability Manifest` bump + `C. Cockpit` drawer tab registration. |
| **`D14` (Expiration Payoff) ∥ `D15` (Outcomes Report)** | `D12` merged | Both are **zero-migration pure-analysis + read** deliverables on completely disjoint UI surfaces (`C. Cockpit` `Payoff` drawer vs. new `Reports` page) and disjoint pure modules (`TradeAnalysis.expirationPayoff` vs. `PerformanceAnalysis.outcomes`). | `Installed Capability Manifest` bump. |
| **`D16` (Current Exposure) ∥ `D17` (Process Scorecard) ∥ `D18` (Journal Field)** *(and ∥ `D14` if still open)* | `D15` merged | All three add independent `PerformanceAnalysis` functions (`exposure`, `scorecard`, `journalField`) and independent tabs inside `D15`'s existing `Reports` shell with **zero schema/migration/seed changes**. | `Installed Capability Manifest` bump + `Reports` tab list registration. |

All other pairs in `D1`–`D20` touch overlapping schema migrations, seed manifests, `TradeAnalysis.derive`/`evaluate`, `Review`, or `C. Cockpit` and **must run sequentially**.

---

## 7. Review Decisions Log

| # | Decision | Resolution |
|---|---|---|
| **RD-01** | Keep `D13` (Simple Option Expiration) and `D14` (Expiration Payoff) separate vs. combined | **Accepted as drafted (separate):** User prefers smaller deliverables; keeps `D14` zero-migration and parallelizable. |
| **RD-02** | Split Aggregate Metrics into 4 single-report deliverables vs. 2 paired deliverables | **Accepted (split into 4):** `D15` Outcomes, `D16` Current Exposure + `AC-PERF-001`, `D17` Process Scorecard, `D18` Categorical Journal Field (shifting Corrections and placeholders down). |
| **RD-03** | Split Economic Corrections into everyday `Replace`/`Void` vs. `Rebuild` & `previewMarkChange` | **Accepted (split into 2):** `D19` Execution & Settlement Corrections (`Replace`, `Void`, `View history`, report sensitivity) and `D20` Trade `Rebuild` & Shared-Mark Impact Preview (`previewMarkChange`), shifting deferred `TODO` placeholders to `D21`–`D24`. |

---

## 8. Future Plan Sections (Not Yet Drafted)

- **Task-Level Breakdowns (Phase 3b):** *Pending approval of the ordered deliverables list above.*
- **Acceptance-to-Evidence Matrix (Phase 4):** *Pending task-level breakdowns.*
- **Frozen Revision & Kickoff Binding (Phase 6):** *Pending final review.*
