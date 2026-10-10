# Trade Journal V3 — Implementation Plan (branch `zcode-glm-5.3`)

Status: **FROZEN — approved by the user on 2026-10-10 (Phase 5 review complete: thin strategy-by-strategy vertical slices, VD4 insertion, MarketData.app provider at VD5). Phase 6 freeze: this file's commit revision is the immutable plan baseline; deviations require approval per the kickoff prompt.**
Stack approved by user on 2026-10-10: **Profile A** (TypeScript + React + Vite + IndexedDB).
Frozen product baseline: `specs/` at commit `79e8477`. This plan treats `specs/` as read-only.

---

## 1. Stack profile

| Concern | Choice | Version track (pinned at kickoff) |
|---|---|---|
| Language | TypeScript, `strict` | 5.x |
| UI | React + React Router | 19.x / 7.x |
| Styling | Tailwind CSS with CSS custom-property design tokens | v4 |
| View state | Zustand (domain modules are plain TS services) | 5.x |
| Persistence | IndexedDB (single database, object stores per module), custom promise wrapper | native |
| Decimals | decimal.js, fixed config, serialized as strings | 10.x |
| Time | Luxon (Intl/IANA zones) + bundled NYSE holiday table 2010–2036 | 3.x |
| PWA | Custom service worker + build-generated Offline Release Inventory (asset list + SHA-256 digests) | native |
| Charts | Hand-rolled SVG components (candles, points, explicit gaps) + textual equivalents | — |
| Unit tests | Vitest + Testing Library; fake-indexeddb for Node-side persistence tests | 3.x / 6.x |
| Browser tests | Playwright (Chromium + WebKit + Firefox) at `http://127.0.0.1:<DEV_PORT>` (browser-recognized secure context), `@axe-core/playwright` | 1.5x |
| Build | Vite; `vite.config.ts` reads `DEV_PORT` (5176 for this worktree) with `strictPort` per repo README | 7.x |
| Pricing provider | MarketData.app adapter (`api.marketdata.app` REST, token credential): stock candles `from`/`to` supply OHLC Daily Bars + closes; historical options quotes supply option closes | — |
| Hosting | Cloudflare Pages (static HTTPS origin for production delivery evidence) | — |

No ORM, no Redux, no Workbox, no chart library, no server runtime. Exact minor versions are pinned and recorded at kickoff; upgrades during implementation require a plan note.

## 2. Architecture mapping

One Vite app at the worktree root (harness files `specs/`, `scripts/`, `AGENTS.md`, `CLAUDE.md`, `README.md` coexist untouched).

```
src/
  domain/                      # pure, deterministic, zero I/O; imports nothing above it
    values/                    # Money, Price, Quantity, CalculationResult, ids, FactOrder
    tradeAnalysis/             # assessPlan, derive, evaluate, expirationPayoff, replay, assessChange
    performanceAnalysis/       # outcomes, exposure, scorecard, journalField
    sessionCalendar/           # NYSE session resolution from bundled holiday table + zone rules
  modules/
    persistence/               # INTERNAL SEAM: IDB open/migrate, transactions, revisions,
                               # snapshot bindings, write gate, projections/rebuild, export snapshot
    referenceCatalog/  journal/  marketData/  tradeRecord/   # authoritative fact modules
    tradeWorkflows/  dailyReview/  tradeViews/  workspace/   # coordinators
    pricingProvider/           # external port + MarketData.app adapter
  ui/                          # React app; imports module facades and domain types only
sw/                           # service worker source
scripts/build/                # release-inventory generation (build-time)
tests/                        # cross-deliverable integration suites
```

Dependency direction is enforced by an ESLint import-boundary rule (verified structurally): `ui → modules → domain`; `domain` imports nothing from `modules`/`ui`; fact modules never import coordinators; `performanceAnalysis` consumes supplied projections only; only `workspace` calls `seedDefaults`/restore prepare/apply of fact modules; `persistence` is imported by fact modules and coordinators but exposes no domain types.

Module → interface mapping is 1:1 with `specs/design/*`: each `src/modules/<name>` exports exactly the operations its contract lists, with the contract's result unions. Trade Analysis and Performance Analysis are pure function libraries matching their operation lists. The UI calls only: Trade Workflows, Daily Review, Trade Views and Reporting, Journal direct, Market Data direct, Reference Catalog settings, Workspace — never Trade Record, never Trade Analysis directly.

**Vertical-slice convention.** Deliverables grow capability along two axes at once: *breadth of instrument/strategy support* (stock → single options → spreads → covered call → PMCC) and *depth of feature* (plan → daily loop → lifecycle completion; later: rolls, corrections, provider, journal config, reports, backup). Each deliverable deepens the *same* module operations inside its advertised scope — e.g. `recordPositionChange` ships in VD2 for one stock execution, grows scaling/closing in VD4, multi-leg decisions in VD6, settlement members in VD5, and roll semantics in VD9 — never as parallel one-off paths. Strategy-shape validation, fulfillment, payoff, and risk derivations register per supported shape from a shared typed rule table so adding a strategy family is additive.

## 3. Cross-cutting mechanisms

### 3.1 Persistence/Transaction seam (`src/modules/persistence`)
- Single IndexedDB database `tj3`, versioned schema; object stores: `workspace`, `catalog`, `journalDefs`, `journalEntries`, `trades` (facts embedded per-trade with typed indexes), `tradeIndex` (authoritative lifecycle membership), `observations`, `providerConfig`, plus `__migrations`. Exact store split may evolve with migrations; the seam's guarantees do not.
- `runTxn(stores, mode, fn)`: promise wrapper; **all writes happen inside one `readwrite` txn with no `await` on non-IDB work inside it** — semantic commands gather snapshot reads (one `readonly` txn), compute via pure modules, then apply in one short write txn that rechecks expected revisions and stages everything. This matches both the spec's prepare→apply protocol and IndexedDB's auto-commit constraints.
- Durability hint `strict` where supported; commit durability verified by restart tests.
- Every mutating facade operation calls `assertWritable()` first; outside `Writable` it returns the cross-cutting `RuntimeNotWritable` branch before touching stores.
- Revisions: per-record opaque revision plus one `WorkspaceSnapshotBinding` (global content counter bumped in every committed write txn). Optimistic checks compare expected record revisions + digest at apply; cross-module reads carry the snapshot binding.
- Projections: authoritative lifecycle membership lives in `tradeIndex` (updated only in the same txn as lifecycle-causing facts, per ADR 0003); all other indexes are rebuildable from facts via `rebuildProjections()` used by Restore/migration/integrity paths.

### 3.2 Runtime Readiness (`src/modules/workspace/readiness`)
Five checks per ADR 0008 as amended by ADR 0009: (1) isolated diagnostic IDB transaction that leaves no authoritative fact; (2) `navigator.storage.estimate()` capacity ≥ plan-derived minimum (mature workspace + migration/backup headroom, derivation disclosed); (3) service-worker control by the intended release; (4) complete, digest-verified Offline Release Inventory; (5) protection query reported Protected/Best Effort/Unavailable — **advisory only, never gates**. Outcomes `Writable | RecoveryOnly | Unsupported`; `IntegrityBlocked` workspace status when an existing root cannot be read/validated (never treated as empty). Gate runs on every launch, after update activation, and after Restore; a later storage failure invalidates `Writable` immediately. No browser/OS/user-agent allowlist anywhere; versions appear only in evidence provenance.

### 3.3 Service worker + Offline Release Inventory
Build emits `release-inventory.json` (release identity + every built asset path + SHA-256 digest). SW precaches, verifies digests post-fetch, answers readiness probes, and refuses activation until its inventory is complete and valid. Update flow: new SW stages + verifies in background → posts `update-available` → activation only at user-approved reload (no `skipWaiting` mid-session), satisfying AC-DEL-002.

### 3.4 Decimal/time determinism
All Money/Price/Quantity are decimal.js values constructed from strings; floats never enter money paths (guard tested). Workspace time zone is a Luxon zone identity; `sessionCalendar` resolves U.S. trading dates from the bundled NYSE holiday table (2010–2036) with a disclosed conservative extension rule; clocks are injected (`now()` port) so every test controls time.

### 3.5 Backup/Restore/migration
Export: one `readonly` txn across all authoritative stores → canonical JSON (sorted keys, streaming serializer) → per-section + full SHA-256 digests (WebCrypto) → ordinary Blob download (`Downloaded`, no receipt) → `confirmBackup` reads the trader-selected `File` back and matches digest + source binding → `CompletedBackupReceipt`. Secrets (`providerConfig.credential`), diagnostics, reports, cursors, and rebuildable projections are excluded. Restore: in-memory validation of envelope/digests/sections → per-module `prepareRestore` → Trade Analysis rederivation → cross-section reference checks → one `readwrite` txn replacing every authoritative store atomically → readiness re-established. Migration: versioned steps applied to an isolated candidate (temp stores), validated by the same machinery, atomically swapped; failure leaves prior data intact.

### 3.6 Installed Capability Manifest
Generated at build from a typed capability registry in code (operations, strategy shapes, report families, provider adapters, backup schema ranges); stamped into the release; surfaced by `Workspace.getStatus`. Undelivered operations and unsupported strategy shapes are absent from the registry — never returned as domain `Unavailable`.

### 3.7 Performance approach
Ordinary paths use stored lifecycle index + bounded `AnalysisInput` batches; no all-history replay, no per-Trade child queries. Benchmark dataset generator is deterministic and disclosed (VD15). Cold start ≤ 2,500ms p95 and warm open-list ≤ 1,500ms p95 measured with Playwright traces + correctness assertions before/after.

## 4. Vertical deliverables

Each deliverable: runnable, reviewable, independently usable through the production UI; ends with cumulative unit + integration suites green and a **fresh browser-critic agent gate** (critic starts the dev server itself, exercises the listed flows against the production UI, returns structured pass/fail; every defect is reproduced test-first before fixing; loop until a fresh critic passes). Integration tests are mock-free through the real stack (fake-indexeddb in Node; real browser + real IDB in Playwright); the only test infrastructure replacements are fake-indexeddb, injected clocks, controlled readiness fault-injection points, and a local stub Pricing-Provider HTTP server (behaviorally compatible stand-in for the external provider port, disclosed per protocol).

Task IDs `T<VD>.<n>`. Every non-structural task lists its public seam and required `describe/it` TDD specs; evidence follows strict red→green per case (recorded per protocol). Structural tasks state exact verification.

---

### VD1 — Project scaffolding *(layer-only checkpoint)*

**Recorded exception (protocol §Phase 3 layer-only gate):** approved by the user on 2026-10-10, who specified this deliverable. It advertises no completed capability, is not an installed release boundary, and mutates no authoritative data. Verification: toolchain green + static shell served. Consumed by VD2 (blocking edge VD1 → VD2).

- **T1.1 (structural)** Vite + TS + React + Tailwind + Vitest + Playwright + fake-indexeddb scaffold; `vite.config.ts` reads `DEV_PORT` with `strictPort`; ESLint import-boundary rule (`ui → modules → domain`).
- **T1.2 (structural)** Static app shell (navigation skeleton, design tokens, narrow/wide layout switch) rendering placeholder content; fake-indexeddb test harness wired.
  - Verify: build serves at 5176; lint blocks a fixture violating boundaries; unit + Playwright empty suites run; shell passes axe scan; live resize switches layout.

---

### VD2 — Long Stock planning with first execution *(first mutating deliverable*

**User outcome:** trader launches the installed PWA, passes Runtime Readiness, initializes the Workspace, sets up an Institution/Account, plans a Long Stock trade with stops/targets and Plan Reflection, confirms it (frozen baseline and 1R visible), records the single opening execution, and sees the Planned→Open trade with its position in list and detail.
**Entry points:** first-launch onboarding; New Plan; Trades list; Trade detail.
**Capabilities:** full delivery foundation (Web App Manifest, SW + verified Offline Release Inventory, every-launch Runtime Readiness, persistence-level `RuntimeNotWritable` write gate); Workspace `initialize`/`getStatus`/`saveSettings`/`requestDurability`; Reference Catalog `save`/`query`/`resolve`/`seedDefaults`; Journal `seedDefaults` + workflow-effect path; Trade Analysis `assessPlan` + `derive` scoped to Long Stock with one opening Execution; Trade Workflows `confirmPlan` + `recordPositionChange` (single opening stock execution, complete/decline/defer reflection); Trade Record prepare/apply/query for that scope; `browseTrades`/`getTradeDetail` (Planned/Open stock projections); Entry-window basics + Entry Size deviation.
**Depends on:** VD1.

- **T2.1** Seam: `persistence.runTxn` / revisions / snapshot binding / `assertWritable` (specs as in draft v1: write-gate no-write proof, all-or-nothing staging, revision recheck, coherent snapshots).
- **T2.2** Readiness: five checks, outcomes, advisory protection, re-run boundaries, `IntegrityBlocked` (specs as in draft v1: Writable-only-when-all-pass, simultaneous failures reported together, unreadable root never empty, diagnostic txn leaves no fact, re-establishment after update/Restore, immediate invalidation).
- **T2.3 (structural+integration)** SW + inventory generation; offline stopped-app restart serves shell and data.
- **T2.4** Catalog `save`/`query`/`resolve` + `seedDefaults` (11 Strategies, reasons, IdeaSource; policies; identity/availability rules; `SeedConflict`).
- **T2.5** Workspace lifecycle ops (initialize-seed-atomicity, onboarding status, time-zone settings semantics, durability result shapes).
- **T2.6** Domain values + Long Stock `assessPlan` (baseline via nearest-boundary over original stops/targets, positive 1R, typed rejections enumerating every issue).
- **T2.7** Journal workflow path (definition snapshots, Thesis/Invalidation roles, prepared effects without identity reservation).
- **T2.8** Trade Record confirm-plan and single-execution position-change prepare/apply + lifecycle index at Planned/Open.
- **T2.9** `confirmPlan` + `recordPositionChange` coordinators (atomic Trade+Entry+index+reflection/Debt effects; revision-bound post-commit results with no follow-up read; defer creates snapshot-bearing Debt; abandoned form creates nothing).
- **T2.10** UI: onboarding, readiness/unsupported/recovery presentations, protection warning, Institution/Account settings, multi-step Plan form (Long Stock), execution entry, planned/open list + detail.
- **T2.11** Integration: fresh install → initialize → account → confirm plan → record opening → restart → equivalence; invalid plan / non-writable mutations leave all revisions unchanged.

**Critic flows:** launch+install; initialize; account CRUD; confirm a Long Stock plan; record the opening execution; offline reopen; live resize during the Plan form.
**Acceptance scenarios:** AC-DEL-003, AC-DEL-004, AC-DEL-005, AC-DEL-006, AC-DEL-001 (installed scope), AC-REF-001, AC-REF-002, AC-CAP-001, AC-UI-001, AC-UI-002, AC-PLAN-001 (Long Stock scope), AC-PLAN-002, AC-RESP-001, AC-JOUR-007, AC-JOUR-003, AC-JOUR-005.

---

### VD3 — Daily Review, Manual Marks, and live risk display for stock

**User outcome:** each completed session, the trader opens Daily Review for open stock trades, enters the stock's Manual Mark as a review task, writes the daily Action (one-click Hold) and Review Notes, and sees completion derive honestly; the Trade page shows frozen planned risk (1R), current total risk (Worst-Case Ongoing Risk), current unrealized P&L (marked remaining-open), and Incremental Reward to Target with per-condition Stop/Target status and overruns.
**Entry points:** Daily Review navigation; Trade detail risk/valuation sections.
**Capabilities:** Market Data `save` (Manual Mark intentions) + `query` (`ResolveFrames` + `ExpectedSnapshot`) scoped to stock Marks and acknowledgments; Expected Mark Date/Status + Stale context; Trade Analysis `evaluate` scoped to stock (marked valuation, ongoing/worst-case/incremental/max, OR conditions, overruns, Plan-R conversions); single-Instrument Stop-Discipline episodes over exact Marks with atomic reconciliation on Action save; Daily Review `open`/`getTrade`/`getDebt`/`save` (stock scope); Journal Daily Trade Review + Review Note entries; Debt queue in review. `recover` ships here in its provider-less form (honest `NotConfigured` context, Manual Mark tasks); the MarketData.app provider arrives with VD5.
**Depends on:** VD2.

- **T3.1** Observation model + Manual precedence + acknowledgments (Available/AcknowledgedUnavailable/Missing; prior completed session is normal evidence; no acknowledgment over an exact Mark; sticky Manual; distinct saved intentions with audit classification).
- **T3.2** Frames + `ExpectedSnapshot` (point frames for current review; `SnapshotChanged` with current frames; no interpolation).
- **T3.3** `evaluate` stock scope (remaining-exposure-only policy; independent `CalculationResult`s; realized-to-date stays a Value while marked components go Unavailable with exact Instrument/date; independent OR-condition status beside nearest-boundary headline; zero headline + disclosed Overrun on crossing without lifecycle change).
- **T3.4** Stop-Discipline episodes, single-Instrument exact-Mark case (episode begins at first observed breach, ends at exact unbreached observation or replacement; gap proves nothing; stable fingerprints for create/retain/supersede/Void reconciliation).
- **T3.5** Daily Review coordinator, stock scope (cutoff eligibility via `StateAtEconomicCutoff`; task order Marks→Debt→trade walk; attention bands evaluable for stock with stated bases and stable order; Hold preselected only as unsaved state; Intent required for Exit/Roll/Adjust; `ReviewChanged`/`Conflict` no-write paths; unique (Entry Type, Trade, Review Date) identity with edit-not-duplicate retry; completion Incomplete/Complete/CompleteWithUnavailableMarks; provider-less `recover` returning `NotConfigured` context with Manual Mark tasks).
- **T3.6** UI: review overview + task walk + Mark entry + action forms (one visible Save) + Review Note; trade-page risk/valuation panels with distinct Value/Unavailable/NotApplicable rendering, Stale context, and covered subtotals.
- **T3.7** Integration: open review → enter Mark → save Hold (with episode reconciliation when a stop was breached) → completion derives; stale-Mark save conflict; missed-review restart resumption from facts; acknowledgment path to CompleteWithUnavailableMarks.

**Critic flows:** open latest completed review for an open stock trade; enter the Manual Mark; one-click Hold; write a Review Note; observe completion states; open trade page and read risk/reward/unrealized P&L panels; resize.
**Acceptance scenarios:** AC-MARK-001, AC-MARK-003, AC-REV-001 (stock scope), AC-REV-002 (stock scope; settlement family completes in VD5), AC-REV-003, AC-REV-004, AC-REV-005, AC-REV-006, AC-CALC-001, AC-CALC-002 (stock scope), AC-CALC-003 (price-condition scope).

---

### VD4 — Stock lifecycle completion: scaling, closing, FIFO, audit-ready history

**User outcome:** trader records scaling adds and partial/final closing executions as decision-level Position Changes; FIFO lot matches, lot-aware fee allocation, realized P&L, Planned→Open→Closed transitions, Close Reason on trader-agency exits, Close Review deferral, and Abandonment of unentered plans all work and display.
**Entry points:** Record Position Change (add/reduce/close); Abandon plan; reflection prompts.
**Capabilities:** `recordPositionChange` full stock semantics; `derive` FIFO/fees/realized/Terminal Disposition/Entry Resolution Point + Entry Quality; Abandonment workflow; Close Review obligation; Unplanned Exposure deviation; `getTradeDetail` factual sections (lots, matches, fees, P&L).
**Depends on:** VD3.

- **T4.1** FIFO engine + fee allocation (exact-quantity matches; opening fee proportional across lots with unconsumed remainder; disposing fee across matches exactly once; no price/P&L copied onto links).
- **T4.2** Lifecycle/terminal/entry derivations (expected state agreement findings; Close Reason cardinality by agency; mixed-mechanism Terminal Disposition; Entry Quality resolved once at Entry Resolution Point; `ExplicitlyUnplanned` as sole Unplanned Exposure source; Abandonment eligibility factual incl. voided-false-execution rederivation — void path lands fully in VD10, eligibility rule ships now).
- **T4.3** Multi-execution position-change prepare/apply + one-reflection-per-command anchoring.
- **T4.4** Abandonment coordinator (active reason; Debt retirement; no Close Reason/Terminal Disposition; rejection once real exposure existed).
- **T4.5** UI: grouped execution entry for scaling/closing, Close Reason capture, Close Review defer/complete, abandonment flow, detail sections for lots/matches/fees/P&L, lifecycle-specific list rows.
- **T4.6** Integration: two opens at different prices/fees → partial close (Trade stays Open) → final close (Closed) with exact fee/P&L reconciliation; agency vs non-agency terminal; defer→restart→complete; abandonment accept/reject.

**Critic flows:** scale into and out of a stock trade; close with a Close Reason; defer then complete Close Review; abandon an unentered plan; inspect lots/matches/P&L.
**Acceptance scenarios:** AC-LIFE-001, AC-LIFE-002, AC-POS-001, AC-POS-004, AC-JOUR-003 (full), AC-JOUR-005 (retry/concurrency).

---

### VD5 — Single option positions with the MarketData.app provider: Long Call, Long Put, Cash-Secured Put

**User outcome:** trader plans and trades single-option strategies with exact contracts; option Marks arrive automatically once the MarketData.app token is configured (Manual Marks remain available and sticky); structural worst case, planned/current Expiration Payoff, and per-leg fulfillment work; explicit Expiration/Assignment/Exercise recording (never calendar inference), including stock successor creation with Management Debt and basic `reviseManagement`.
**Entry points:** New Plan (option shapes); settlement recording; Settlement Due in review; management prompt; Settings → Provider.
**Capabilities:** option instruments + Planned Legs with exact contracts; option Marks (Manual + provider); `PricingProvider` port + MarketData.app adapter; Market Data `recover`/`configureProvider`/`getProviderConfiguration` with provider-refresh Mark revisions and Daily Bar storage from provider responses; `assessPlan`/`derive`/`evaluate`/`expirationPayoff` for single-option shapes (single expiration); fulfillment classification; settlement members in `recordPositionChange` with allocation rules; `reviseManagement`; Management Debt; Exercise Intent; review settlement routing and automatic mark recovery.
**Depends on:** VD4.

- **T5.1** Option instrument model + single-shape `assessPlan` (underlying-price stop monetary boundary; objective criteria completeness).
- **T5.2** Option valuation + payoff (single-expiration curves with zero sets/extrema/attainment sets; current offset by realized-to-date; no theoretical pricing; structural worst case).
- **T5.3** `PricingProvider` port + MarketData.app adapter (token write-only, never returned/exported/copied into diagnostics; stock candles `from`/`to` → OHLC Daily Bars + closes; historical options quotes → option closes; rate limits and partial responses → transient diagnostics creating no Mark, acknowledgment, provider-performance fact, or Journal evidence).
- **T5.4** Provider configuration + recovery (`configureProvider` Disabled/Enabled-redacted/NeedsSetup views at a configuration revision; `recover` over bounded actual gaps by earliest relevance, skipping Manual keys, keeping acknowledged keys recoverable, turning current Missing keys into Manual tasks, seeding an initial provider Mark from a valid Bar close on an otherwise empty key, and returning snapshot-bound frames so no second query is needed; identical provider price creates no redundant revision; honest `NotConfigured` context with none enabled).
- **T5.5** Fulfillment + Planned-Leg Terms (five outcomes incl. NotVerifiable without evidence; one occurrence per served leg; no Unplanned inference from mismatch).
- **T5.6** Settlement economics (four physical cases exactly-once premium; Settlement Price separate; cash settlement creates no stock successor) + allocation (explicit first, residual successor, `NeedsResolution` no-write) + planned-settlement vs Exercise Intent semantics + Management Debt creation.
- **T5.7** `reviseManagement` coordinator (atomic values+Entry; Debt resolution on completeness; baseline untouched; prose cannot settle workflow Debt).
- **T5.8** Settlement Due in review (explicit-only; review stays incomplete until recorded; workflow response suffices without read-back).
- **T5.9** UI: provider settings, recovery status/diagnostics in review, option plan forms, option Manual-Mark override path, payoff views, settlement forms with allocation, management revision form, settlement-due/management-debt indicators.
- **T5.10** Integration: configure against the stub server → run recovery with a partial response → precedence holds (Manual sticky, Bars refresh independently, acknowledgments respected); CSP assignment exceeding chosen allocation across linked trades atomically; needs-resolution no-write; explicit expiration after date passed (no inference); exercise with/without Intent; management debt created→resolved.

**Critic flows:** configure the provider (stub) and run recovery from review; plan + enter a long call; record its expiration explicitly; record a CSP assignment with allocation; revise management on the resulting stock; observe payoff views.
**Acceptance scenarios:** AC-POS-002 (single-leg scope), AC-POS-005, AC-SET-001, AC-SET-002, AC-SET-003, AC-SET-004, AC-JOUR-006, AC-CALC-004 (single-expiration scope), AC-REV-002 (settlement family), AC-MARK-002 (full), AC-MARK-005, AC-DEL-001 (manual+recovery scope).

---

### VD6 — Multileg option positions: vertical spreads and Iron Condor

**User outcome:** trader plans and trades four vertical spreads and Iron Condor as one-decision multi-fill Position Changes; synchronized same-date exact Marks drive structure conditions; structural worst case and co-expiring payoff work; per-leg fulfillment displays.
**Entry points:** New Plan (multileg shapes); Record Position Change with multiple legs/fills.
**Capabilities:** multileg shapes in the strategy rule table; multi-execution/multi-leg commands with one reflection; synchronized-Mark condition evaluation; co-expiring structure payoff; share-coverage/strike-order constraint validation.
**Depends on:** VD5.

- **T6.1** Multileg `assessPlan` (shape constraints: common underlying, expiration equality/order, strike order, equal ratios; typed rejections).
- **T6.2** Multi-leg `derive` (per-leg positions/lots; one decision identity with stable member order; fulfillment per leg).
- **T6.3** Structure evaluation (synchronized same-date exact Marks — never independently timed extrema; per-condition OR status; structural worst case; covered subtotals).
- **T6.4** Co-expiring payoff (structure with one expiration anchor; stock legs may participate).
- **T6.5** UI: multileg plan forms, grouped multi-fill entry, per-leg fulfillment display, structure risk panels.
- **T6.6** Integration: one decision with several fills across legs (one Position Change, one reflection); synchronized-mark condition scenario; iron condor plan→open→close.

**Critic flows:** plan and enter a vertical debit spread; enter an iron condor as one decision; read structure risk and payoff; record a partial leg close.
**Acceptance scenarios:** AC-POS-002 (full), AC-CALC-003 (structure-value conditions), AC-CALC-004 (co-expiring structures), AC-MARK-006 (synchronized-Mark portion).

---

### VD7 — Covered Call

**User outcome:** trader plans a Covered Call against held/-planned stock (share coverage through the multiplier), trades it, and sees combined stock+option position, risk, and assignment allocation into the stock trade.
**Entry points:** New Plan (Covered Call); assignment allocation picker.
**Capabilities:** two-leg stock+option shape; combined position derivation; covered-call short-call assignment allocated first to the compatible stock Trade.
**Depends on:** VD6 (spread machinery) and VD4 (stock trades).

- **T7.1** Covered-call shape validation (long Stock + short Call, same underlying, share coverage; no DTE/delta/width defaults).
- **T7.2** Combined derivation/evaluation (stock+option positions, worst case with coverage, mixed payoff participation at one expiration anchor).
- **T7.3** Assignment allocation into existing stock trade (explicit selection; residual rules; atomic linked update).
- **T7.4** UI: covered-call plan form, combined position/risk display, allocation picker defaulting to the unambiguous destination (stored allocation stays explicit).
- **T7.5** Integration: covered call over held stock; assignment allocated to the stock trade with basis/proceeds reconciliation.

**Critic flows:** plan a covered call over existing stock; record the short call; record its assignment and allocate to the stock trade.
**Acceptance scenarios:** AC-SET-001 (covered-call allocation), AC-CALC-003/004 (stock+option structure scope).

---

### VD8 — PMCC (poor man's covered call)

**User outcome:** trader plans and trades a PMCC (long later-expiration lower-strike call + short nearer-expiration higher-strike call); near-leg expiry management, mixed-expiration honesty (payoff `Unavailable`, valuation per exact Marks), and roll groundwork behave correctly.
**Entry points:** New Plan (PMCC); near-leg management.
**Capabilities:** diagonal shape with expiration-order constraint; mixed-expiration availability rules; near-leg settlement/management flows.
**Depends on:** VD7.

- **T8.1** PMCC shape validation (expiration order, strike order, equal ratio, common underlying).
- **T8.2** Mixed-expiration availability (payoff Unavailable rather than a misleading single curve; dated Mark-to-Market remains available per exact Marks; near-leg expiration produces Settlement Due for that leg only).
- **T8.3** UI: PMCC plan form, per-leg expiration display, near-leg settlement prompts.
- **T8.4** Integration: PMCC plan→enter→near-leg expires explicitly→remaining long leg valued; payoff shows honest Unavailable.

**Critic flows:** plan and enter a PMCC; let the short leg reach settlement-due; record its expiration; observe remaining-leg valuation and payoff unavailability.
**Acceptance scenarios:** AC-CALC-004 (mixed-expiration rule), AC-SET-003 (per-leg scope).

---

### VD9 — Rolls and typed lineage

**User outcome:** trader performs partial and full Rolls (close selected predecessor quantity, confirm successor plan, successor executions exclusive, typed lineage, `Rolled` Close Reason) across any installed strategy shape.
**Entry points:** Roll flow from an open trade.
**Capabilities:** Roll semantics inside `recordPositionChange`; lineage storage/display; originating-Trade reflection.
**Depends on:** VD8 (all shapes installed).

- **T9.1** Roll coordinator semantics (predecessor-only-included quantity; untouched holdings remain; successor baseline + required reflection; typed lineage; `Rolled` required).
- **T9.2** UI: roll flow with successor plan form, lineage display on both trades.
- **T9.3** Integration: partial roll of a multicontract position (ownership/lineage/baseline atomic in one receipt).

**Critic flows:** roll half of an open position to a later expiration; inspect lineage on both trades.
**Acceptance scenarios:** AC-POS-003.

---

### VD10 — Corrections and visible audit

**User outcome:** trader previews and commits Replace/Void/Rebuild with full impact disclosure and Correction Footprints; history views show version chains; anchors resolve as historical; integrity disagreement blocks honestly.
**Entry points:** Edit → Save on facts; Replace/Void/Rebuild actions; View history.
**Capabilities:** Trade Workflows `previewCorrection`/`commitCorrection`; Trade Record version chains + `history` + `resolveAnchors`; footprint; integrity findings; void-driven Debt retirement/reopen and abandonment rederivation.
**Depends on:** VD9.

- **T10.1** Version chains (Replace keeps identity+sequence; Void visible-but-inert; Rebuild new identities in explicit order; old anchors Superseded, never redirected).
- **T10.2** Preview + materiality gate + stale-binding rejection (nonmutating; acknowledgment for material effects).
- **T10.3** Commit coordinator (multi-Trade linked atomicity; Journal consequences incl. Debt reopen on sole-settlement void; anchored Entries stay navigable).
- **T10.4** Integrity agreement (read surfaces without repair; authorized preparation derives disclosed repairs or rejects incoherence).
- **T10.5** UI: impact previews in plain language, acknowledgment, history timeline, audit navigation.
- **T10.6** Integration: replace-with-anchored-evidence reconciliation; void changing lifecycle and rederiving abandonment eligibility; rebuild preserving anchors; linked rollback under stale revision.

**Critic flows:** replace an execution price via preview; void a false execution; view history chains and footprint.
**Acceptance scenarios:** AC-CORR-001, AC-CORR-002, AC-CORR-003, AC-CORR-004, AC-CORR-005, AC-LIFE-003, AC-LIFE-002 (void path).

---

### VD11 — Daily Bar evidence, series, replay, and mark-change preview

**User outcome:** Daily Bars (stored since VD5's provider recovery) supply range evidence for trailing Stop/Target evaluation — long conditions use same-date highs, short use lows, structures use synchronized exact Marks; series render candles/points/explicit gaps; replay views work for every installed shape; Mark corrections preview their impact.
**Entry points:** replay tab; Mark correction preview; series views.
**Capabilities:** Bar evidence rules in Trade Analysis evaluation; Stop-Discipline episode extension to Bar evidence; Market Data `ReadSeries`/`InspectObservations`; `replayTrade`; `previewMarkChange`.
**Depends on:** VD10.

- **T11.1** Series + gaps (completed-session enumeration; candle/point/gap; never bridge or fabricate).
- **T11.2** Bar evidence rules (same-date high/low per direction; synchronized Marks for structures; a gap proves neither breach, recovery, nor a new extreme) + episode extension over Bar evidence.
- **T11.3** `replayTrade` + `previewMarkChange` (caller-derived lifetimes; corrected tracks; paired current/hypothetical frame consequences + exact Save precondition; writes nothing).
- **T11.4** UI: replay tab with SVG charts + accessible tables, Mark-change preview, series views.
- **T11.5** Integration: replay across a corrected interval with gaps; Bar-evidence condition scenario per direction and for a structure; preview-then-save Mark correction.

**Critic flows:** open replay with mixed candle/point/gap dates; preview a Mark correction.
**Acceptance scenarios:** AC-MARK-004, AC-MARK-006 (full).

---

### VD12 — Journal completion: direct workflows, definitions, timeline

**User outcome:** trader writes voluntary Trader Reflections, edits/addends/Voids entries with correct semantics, resolves/declines Journal-only Debt directly, revises prompt definitions prospectively, and browses a full journal timeline.
**Entry points:** Journal surface; Debt queues; Settings → Entry forms.
**Capabilities:** Journal `save` direct paths, `query` projections, `getDefinitions`, `reviseDefinition`; obligation-key uniqueness under concurrency; prospective definition semantics.
**Depends on:** VD11 (may parallel VD11 after VD10).

- **T12.1** Direct save paths + anchor/origin rules (voluntary types only; anchor resolution modes; Edit under original snapshot; Addendum semantics; void-reopens-sole-settlement Debt).
- **T12.2** Obligation + definition revisioning (one current outcome per key; Debt answered against its original snapshot; complete-future-form atomic replace; unchanged-returns-existing).
- **T12.3** Query projections + filters (AND-across/OR-within; effective version + indicators + full history).
- **T12.4** UI: timeline (narrow/wide), entry forms per rendered definition, edit/addendum/void flows, debt resolution, definition editor with prospective-effect explanation.
- **T12.5** Integration: edit→addendum→void chain; Debt answered under D1 after D2 revision; concurrent duplicate submission → one outcome; unsaved-form abandonment stores nothing across restart.

**Critic flows:** write/edit/add/void a Trader Reflection; answer and decline Debt; revise a definition and observe prospective-only effect; browse timeline.
**Acceptance scenarios:** AC-JOUR-001, AC-JOUR-002, AC-JOUR-004, AC-JOUR-005 (direct paths).

---

### VD13 — Deterministic reports: Outcomes and Current Exposure

**User outcome:** trader runs Outcomes and Current Exposure with the six Report Period presets, one Break Down By dimension, filters, coverage, correction sensitivity, and contributor navigation.
**Entry points:** Reports navigation.
**Capabilities:** `runReport` (Outcomes, Current Exposure); Performance Analysis `outcomes`/`exposure`; period resolution; population exhaustion + bindings; label lenses.
**Depends on:** VD12.

- **T13.1** Population/period/breakdown engine (preset resolution in workspace zone; Current Exposure rejects periods; AND/OR identity filters with Institution-through-Account expansion; Overall + one dimension; non-additive Tag/multi-Underlying; `Unspecified` last).
- **T13.2** `outcomes` metrics (terminal-date Closed headlines; open trades never zero observations; realization curves with fixed tie order; exact-sign classification; Profit Factor Unavailable-with-no-losers / zero-with-no-gains; corrected points at original Economic Time + sensitivity).
- **T13.3** `exposure` metrics (independent realized/open/combined; covered subtotals with named unavailable/unbounded cohorts; Unbounded propagation; per-Trade-once condition counts with max simultaneous Overrun; like-covered-only portfolio ratio; NotApplicable when Open excluded).
- **T13.4** Report UI (family tabs, controls, metric cards/tables, coverage panels, contributor navigation).
- **T13.5** Integration: mixed population with corrections and partial realization; breakdown+filter matrix; exhaustion proof in bindings.

**Critic flows:** run Outcomes (LastWeek) with Institution filter + Strategy breakdown; open Current Exposure; navigate from a metric to a Trade.
**Acceptance scenarios:** AC-RPT-001, AC-RPT-002, AC-RPT-003, AC-RPT-006.

---

### VD14 — Process Scorecard and Journal Field reports

**User outcome:** trader runs the Process Scorecard (per-family denominators, no composite grade) and one categorical Journal Field report.
**Entry points:** Reports navigation.
**Capabilities:** Performance Analysis `scorecard`/`journalField`; reflection-outcome projection; current-identity grouping.
**Depends on:** VD13.

- **T14.1** `scorecard` families (confirmed-Plan cohort partition at cutoff; Below-Plan Entry Rate + coverage; zero-event opportunities; one-episode-once; four Deviation categories separate; reflection outcomes by moment/origin with completed-on-voided-origin disclosure; no composite judgment).
- **T14.2** `journalField` partition (one effective identity once; distinct Unspecified/Due/Declined/Retired/Voided; NotApplicable Text/Number/Date; Standalone exclusion under Trade filters; no causation claims).
- **T14.3** UI + integration (scorecard sections with coverage; journal-field selector; drill-down; population with gaps/episodes/corrections).

**Critic flows:** run scorecard Month to Date; run a Journal Field report on a Scale prompt; drill into a group.
**Acceptance scenarios:** AC-RPT-004, AC-RPT-005.

---

### VD15 — Backup, Restore, migration, rebuild equivalence, target scale

**User outcome:** trader downloads a backup, verifies it by selecting the saved file (receipt), and Restores it replace-only with validation preview and safety-backup enforcement; the product proves rebuild equivalence and target-scale latency with disclosed benchmarks.
**Entry points:** Settings → Backup/Restore; update/migration on launch.
**Capabilities:** Workspace `exportBackup`/`confirmBackup`/`prepareRestore`/`applyPreparedRestore`; migration machinery; `rebuildProjections`; integrity recovery; benchmark harness.
**Depends on:** all prior VDs (full authoritative content).

- **T15.1** Export artifact + digests + exclusions (one snapshot; section/full digests; secrets/diagnostics/projections excluded with manifest disclosure; `Downloaded` never a receipt; concurrent later mutation wholly outside).
- **T15.2** `confirmBackup` read-back verification (trader-selected file; completeness + digest + binding match; `Completed`/`NotVerified`; nothing stored pending; available in `Recovery Only`).
- **T15.3** `prepareRestore` (untrusted artifact; envelope/digests/versions/capability footprint; isolated candidate migration; disclosed repairs vs rejection; preview with counts/impact/safety offer; nondurable token bound to artifact+target; no provider call).
- **T15.4** `applyPreparedRestore` (Writable + explicit authorization + exact-target receipt or acknowledged decline; unverified/stale rejected with no writes; one-transaction full replacement returning fresh status + landing state; controlled failure leaves prior Workspace intact; provider config → Needs Setup).
- **T15.5** Migration + startup integrity (isolated staged migration with module validation + analytical verification; never Ready over partial migration; unreadable root → Integrity Blocked).
- **T15.6** Rebuild equivalence + benchmarks (projection removal/Restore → observationally identical lists/details/replays/reviews/reports; deterministic 25k-Trade/200-Open/200k-fact generator; cold p95 ≤ 2,500ms, warm open-list p95 ≤ 1,500ms, network disabled, provenance + percentile method disclosed, correctness before/after, no per-Trade query patterns).
- **T15.7** UI (two-step backup flow with honest unverified state; Restore wizard; migration/blocked presentations).
- **T15.8** Integration (populate → export → verify → restore → equivalence; export-isolation under concurrent mutation; injected section-failure rollback; migration-failure recoverability; secrets non-presence scan).

**Critic flows:** backup download + verify + receipt; Restore from verified file with preview/safety flow; rejection with unverified download; offline restart after Restore.
**Acceptance scenarios:** AC-BACK-001, AC-REST-001, AC-REST-002, AC-REST-003, AC-REST-004, AC-REBUILD-001, AC-PERF-001, AC-DEL-002 (update-safety consolidation).

---

## 5. Task graph (blocking edges)

Backbone: VD1 → VD2 → VD3 → VD4 → VD5 → VD6 → VD7 → VD8 → VD9 → VD10 → VD11 → VD12 → VD13 → VD14 → VD15.

Notes: VD7 requires VD4+VD6; VD12 may proceed in parallel with VD11 once VD10 completes; VD15 requires all. Within each VD, tasks run in listed order unless marked parallel. Every deliverable ends with: cumulative unit suite → mock-free integration suite → fresh browser-critic gate (protocol §Phase 3).

**Layer-only exception record (approved):** VD1 scaffolding — user-specified and approved 2026-10-10; advertises no capability; not a release boundary; verified by T1.1/T1.2 structural checks; consumed by VD2.

## 6. Acceptance scenario → evidence matrix

Evidence codes: **U** = task-level TDD (red/green, per §4), **I** = mock-free integration case, **B** = browser-critic flow, **P** = Playwright browser/automation evidence, **S** = structural verification. Statuses are `planned` until the delivering VD completes. Scenarios marked "(scope)" complete their full normative meaning at the listed VD; earlier partial coverage is noted where applicable.

| Scenario | VD | Evidence |
|---|---|---|
| AC-RESP-001 | VD2, re-asserted each mutating VD | U,I,B |
| AC-PLAN-001 | VD2 (Long Stock scope; option shapes at VD5+) | U,I,B |
| AC-PLAN-002 | VD2 | U,I,B |
| AC-LIFE-001 | VD4 | U,I,B |
| AC-LIFE-002 | VD4 (void path at VD10) | U,I |
| AC-LIFE-003 | VD10 | U,I |
| AC-POS-001 | VD4 | U,I,B |
| AC-POS-002 | VD5 (single-leg), VD6 (full) | U,I,B |
| AC-POS-003 | VD9 | U,I,B |
| AC-POS-004 | VD4 | U,I,B |
| AC-POS-005 | VD5 | U,I |
| AC-SET-001 | VD5 (CSP), VD7 (covered call) | U,I,B |
| AC-SET-002 | VD5 | U,I |
| AC-SET-003 | VD5 (full), VD8 (per-leg scope) | U,I,B |
| AC-SET-004 | VD5 | U,I |
| AC-CORR-001 | VD10 | U,I,B |
| AC-CORR-002 | VD10 | U,I |
| AC-CORR-003 | VD10 | U,I,B |
| AC-CORR-004 | VD10 | U,I |
| AC-CORR-005 | VD10 | U,I |
| AC-JOUR-001 | VD12 | U,I,B |
| AC-JOUR-002 | VD12 | U,I,B |
| AC-JOUR-003 | VD2 (defer), VD4 (full) | U,I,B |
| AC-JOUR-004 | VD12 | U,I |
| AC-JOUR-005 | VD2/VD4 (workflow), VD12 (direct) | U,I |
| AC-JOUR-006 | VD5 | U,I,B |
| AC-JOUR-007 | VD2 (seed+form), VD12 (revision) | U,I |
| AC-REV-001 | VD3 (stock scope) | U,I |
| AC-REV-002 | VD3 (stock), VD5 (settlement family) | U,I,B |
| AC-REV-003 | VD3 | U,I,B |
| AC-REV-004 | VD3 | U,I |
| AC-REV-005 | VD3 | U,I |
| AC-REV-006 | VD3 | U,I,B |
| AC-MARK-001 | VD3 | U,I,B |
| AC-MARK-002 | VD3 (core), VD5 (full) | U,I |
| AC-MARK-003 | VD3 | U,I |
| AC-MARK-004 | VD11 | U,I,B |
| AC-MARK-005 | VD5 | U,I |
| AC-MARK-006 | VD6 (synchronized Marks), VD11 (Bars, full) | U,I |
| AC-CALC-001 | VD3 | U,I |
| AC-CALC-002 | VD3 (stock scope, full at VD6) | U,I,B |
| AC-CALC-003 | VD3 (price conditions), VD6 (structure conditions, full) | U,I |
| AC-CALC-004 | VD5 (single), VD6 (co-expiring), VD8 (mixed rule) | U,I,B |
| AC-RPT-001 | VD13 | U,I,B |
| AC-RPT-002 | VD13 | U,I |
| AC-RPT-003 | VD13 | U,I,B |
| AC-RPT-004 | VD14 | U,I,B |
| AC-RPT-005 | VD14 | U,I |
| AC-RPT-006 | VD13 | U,I,B |
| AC-REF-001 | VD2 | U,I,B |
| AC-REF-002 | VD2 | U,I,B |
| AC-BACK-001 | VD15 | U,I,B |
| AC-REST-001 | VD15 | U,I,B |
| AC-REST-002 | VD15 | U,I,B |
| AC-REST-003 | VD15 | U,I |
| AC-REST-004 | VD15 | U,I |
| AC-REBUILD-001 | VD15 | I,S |
| AC-DEL-001 | VD2 (installed scope), VD5 (manual+recovery scope), VD15 (offline restart consolidation) | P,B |
| AC-DEL-002 | VD2 (SW staging), VD15 (consolidation) | P |
| AC-DEL-003 | VD2 | P,B |
| AC-DEL-004 | VD2 | U,I,P |
| AC-DEL-005 | VD2, VD15 (backup cases) | U,I,P |
| AC-DEL-006 | VD2 (+post-Restore at VD15) | U,I,P |
| AC-UI-001 | VD1 (shell), re-checked per VD | P,B |
| AC-UI-002 | VD1 + per-VD views | P,B |
| AC-PERF-001 | VD15 | P |
| AC-CAP-001 | VD2 + every release boundary | S,B |

No scenario is intentionally unadvertised; every canonical capability is planned. Foundational scenarios (atomicity, audit, backup/Restore, offline, reconstruction) are never deferred past their owning VD.

## 7. Per-deliverable evidence procedure (binding)

1. Every non-structural task: strict red→green per `it should` case through the named public seam; commands + outcomes recorded in `tests/evidence/`.
2. Every deliverable: cumulative unit suite green → mock-free integration cases green (real stack; disclosed replacements only: fake-indexeddb, injected clock, readiness fault-injection points, stub provider server) → fresh browser-critic agent starts the dev server itself and exercises the listed flows at the production UI; defects are reproduced test-first, fixed, suites rerun, and a **fresh** critic repeats until clean.
3. Release boundary: Installed Capability Manifest updated to exactly the delivered operations, strategy shapes, and report families; navigation exposes only advertised capabilities.

## 8. Test-environment provenance

Local automation uses `http://127.0.0.1:5176` (loopback = browser-recognized secure context; SW + IDB available in Chromium/WebKit/Firefox). Exact browser and OS versions are recorded with every delivery run as provenance, never as support conditions. Production HTTPS evidence is captured against the Cloudflare Pages deployment; the loopback accommodation never substitutes for it. Playwright runs with `context.setOffline(true)` for offline cases; cold/warm definitions and percentile method are fixed in the VD15 harness before benchmarking.

## 9. Resolved decisions and standing assumptions

Resolved by the user on 2026-10-10:
1. **Hosting:** Cloudflare Pages for the production HTTPS origin.
2. **Pricing provider:** MarketData.app adapter wired in VD5 with single-option positions (port + config UI + stub-server tests; token credential write-only).
3. **Backup artifact:** canonical JSON with SHA-256 digests, streamed during build/read-back.
4. **Holiday table:** bundled NYSE closures 2010–2036 with a disclosed conservative extension rule.

Standing assumptions (flag in review if wrong):
5. App lives at the worktree root alongside harness files (no monorepo).
6. Decimal rules fixed in T-task tests: decimal.js precision 40; prices validated to 6dp, money to 2dp, quantities integral per instrument kind.

## 10. Freeze checklist (protocol Phase 6)

Upon Phase 5 completion: commit this file on `zcode-glm-5.3`, record commit hash + digest as the immutable plan revision, pin exact dependency versions, instantiate `specs/evaluation/kickoff-prompt.md` with this path/revision, and mark todos complete. Deviations during implementation pause work and require approval per the kickoff prompt.
