# Design Overview — Trade Journal

> The standalone map of the system's module structure. Every later drill-down
> session loads this first. It captures the partition, the interaction rules,
> the who-calls-whom matrix, and the main-flow walkthroughs. A fresh
> implementation session (or a different model) should need nothing beyond this
> document plus the per-module design docs to build the system.

This overview is the output of Phase 2 (Partition) of the deep-interface-design
process, applied to the domain model in [`CONTEXT.md`](../../CONTEXT.md) and the
decisions in [`docs/adr/`](../adr/). The partition was chosen by generating three
radically different candidates (per-entity repos + service layer; one giant store
+ pure math; domain-area stores + pure calc + thin coordinators), comparing them
on depth, locality, and the deletion test, and adopting the third with two
refinements. See *Alternatives considered and rejected* at the end.

## How to read this

- **Interaction rules** (next section) are invariants every module and every
  caller must respect. They are non-negotiable; deviations need an ADR.
- **The module table** is the partition. Each row is a module with its
  responsibilities and an estimated method count (depth is leverage per unit of
  interface, not op count — the pure modules are tiny in methods and huge in
  depth).
- **Coordinator sketches** are illustrative signatures, not final interfaces.
  Each is pinned down in its own drill-down doc.
- **The who-calls-whom matrix** makes coordinator gaps visible: if a needed
  flow has no legal route, the finding is a missing coordinator, not a rule
  exception.
- **The walkthroughs** trace the main flows across modules.
- **Drill-down order + open-questions ledger** is what Phase 4 sessions import.

---

## Interaction rules (non-negotiable)

These rules govern every module and every caller. They were load-bearing in
choosing the partition and must survive drill-down.

1. **Stores hold facts; pure modules derive; coordinators join; the UI sees
   finished items.** TradingRecordStore, ReflectionStore, PriceMarkStore,
   AccountStore, and TaxonomyStore persist facts only. CalculationModule and
   PerformanceAnalytics derive all figures from those facts with no storage
   access. The four coordinators join facts across stores and call the pure
   modules to produce finished items the UI consumes. Nothing derivable is
   stored as a fact — with two deliberate, scoped exceptions (rules 3 and 4
   below), each recorded in its own ADR.

2. **Pure calculation is its own module(s) with no storage access.** Its
   parameter types *are* the data contract every store must serve. This is why
   CalculationModule is drilled down first: it pins every store's read shape.
   The two pure modules split on **mark-dependence** (ADR 0008), not single-vs-
   portfolio: `CalculationModule` derives figures from facts + marks — single
   (`evaluate`) or aggregate current exposure (`evaluateMany`) — and
   `PerformanceAnalytics` is a mark-free fold over already-derived closed-trade
   snapshots (`aggregate`). All figure arithmetic (null marks, dollars-only
   sums) lives in calc, tested in one place; PerformanceAnalytics is a trivially-
   testable fold. Both pure — testable with literal objects, no store, no mock,
   no binding.

3. **Lifecycle status is stored authoritatively (ADR 0006).** Planned/Open/
   Closed/Discarded is a field on the Trade record, not derived on read.
   Transitions fire when a fill is recorded — one exception: Planned →
   Discarded (the pre-fill exit, `discardPlan`) is the lone trader-declared
   transition, guarded by the zero-fills edge (a never-entered trade has no
   fill arithmetic to compute). `flat` (net-position-zero) is still a
   CalculationModule
   function — computed **once, at fill-record time, for the one Trade being
   modified** to detect the transition, never re-derived across all Trades on
   every query. This avoids O(all-trades) recomputation in the Daily Review's
   open-Trades query, which grows monotonically.

4. **Closed-trade figures are cached (ADR 0007).** A full figure-set snapshot
   (P&L + the entire `evaluate()` result: R-multiple, planned-vs-realized R:R,
   risk quantities as-of close) is computed once at close and stored on the
   Trade record. **Open Trades compute figures live** (marks change daily);
   **Closed Trades read the snapshot**, lazy-populating if null. The snapshot
   is authoritative for display but regeneratable — invalidated and regenerated
   when underlying facts (a fill or mark correction) or the calc (a bug fix)
   change (regeneration: FillEntryCoordinator's `regenerateSnapshots`).
   The honest price: a future calc-bug-fix requires a regeneration migration
   over all closed Trades.

5. **Storage is an internal seam.** Each store is a single domain implementation
   over an injected StorageBinding (in-memory for unit tests, realistic fake for
   integration, real for production). No per-backend business rules — if a store
   had per-backend implementations, every business rule would be written N times.

6. **Plain request/response.** No subscription semantics anywhere. The UI
   re-queries when it needs fresh data (after a fill, on Daily Review open).
   Every interface and every test fake is synchronous.

7. **UI is out of scope for this design.** The partition stops at the domain
   seam. The UI is a consumer of these interfaces, designed later per-feature;
   each screen is built against the stable shapes here. This is where the
   testing strategy lives — the domain is fully testable through its interfaces
   without a UI.

8. **Coordinators exist only where a real ≥2-store join occurs.** A workflow
   that touches one store is a direct store call, not a coordinator. PlanRevision
   is the canonical example: it appends a revision to TradingRecordStore only, so
   it is not a coordinator. The existence of zero-coordinator single-store
   workflows is evidence the seams are drawn at real boundaries.

---

## The module table

Twelve domain modules (eleven original plus PriceProviderStore, added by the
PriceMarkStore drill-down) plus StorageBinding (the persistence seam, not a domain
module).

| # | Module | Kind | Est. methods | Responsibilities |
|---|---|---|---|---|
| 1 | **TradingRecordStore** | store | 7 | The trading record itself: Trade identity + lifecycle status (Planned/Open/Closed/Discarded, stored per ADR 0006) + optional finalFigures snapshot (per ADR 0007) + Plan (original levels — per-direction stops + a single target, each a priced level with a quote basis, ADR 0010 — plus thesis, invalidation, entry emotion) + PlanRevision (append-only dated deltas, ADR 0001) + Fill (instrument, side, qty, price, time, instrument-type per leg, option contract facts when the leg is an option — optionType/strike/expiry, ADR 0009, fillId). Eleven ops: `commit`, `recordFill` (absorbs append + transition + close-snapshot; returns `fillId`; every status mutation is fill-arithmetic-guarded — no raw `setStatus` exists), `appendRevision`, `correctFill` (invalidates the snapshot, signals possible status invalidity), `getTradeRecord`, `listTrades` (collapses listOpenTrades + listTradeIds into one filtered op), `importTrade` (verbatim restore with derive-on-import, ADRs 0006/0007), plus the guarded correction family added by the FillEntryCoordinator session (OQs 12/13): `reopenTrade` (asserts fills ≠ 0; clears closedAt + snapshot), `closeTrade` (asserts fills = 0; the correction edge where a fixed fill flats an Open trade), `replaceSnapshot` (Closed-only regeneration write-back), plus `discardTrade` added by the PlanCommit session (audit finding F1: Planned-only, zero-fills guard → terminal snapshotless `Discarded` — the one trader-declared transition). Owns invariants: plan-before-fill, revisions append-only & dated, a Plan declares ≥1 stop side (the R-baseline precondition — PlanCommit session), recordFill/appendRevision reject on Closed and on Discarded. Owns lifecycle transitions (first fill → Open; flat → Closed + snapshot; discard → Discarded — the pre-fill exit). Returns a Trade as a cohesive bundle (trade + plan + all revisions + all fills). Carries three store-owned fields calc ignores: `strategy` (Reporting filter), `closedAt` (snapshot-regen asOf, OQ 11), `fillId` (correction + fill-level journal). Stores NO live P&L, position size, or risk — all derived (closed trades cache their final figures). Drilled down — see [design doc](trading-record-store.md). |
| 2 | **ReflectionStore** | store | 12 | Reflection + its self-describing form: Journal Entry (content, timestamp, 3-level attachment discriminator Trade/Fill/Market per ADR 0004, parent ref, optional market-entry↔trade links) + the Journal Placeholder (an entry in `'placeholder'` state — the owed-reflection mechanism; Required auto-created at plan-commit + close, Optional offered per fill) + Entry Schema definitions (versioned, immutable, forward-only, referenced by `schemaId` — ADR 0003 by reference, not embedded by value). Thirteen ops: eight entry ops (`createPlaceholder`, `createEntry`, `completePlaceholder`, `voidPlaceholder` — a discarded plan's owed bookend retires with it, `getEntry`, `listEntries`, `setMarketLinks`, `importEntry`) + five schema ops (`saveSchema`, `getSchema`, `getSchemaVersion`, `listSchemas`, `importSchema`). Candidate B write model: a placeholder IS an entry in `'placeholder'` state; `completePlaceholder` transitions the same record to `'complete'`. "What's owed" is a filter on a stored fact (`listEntries({ state:'placeholder' })`), NOT a derivation from lifecycle ∩ entries — OQ 5 dissolved. Journal-writing is a direct store call, not a coordinator (OQ 6 dissolved — convention C6 removes the only cross-store act). `schemaId` absent on placeholders, pinned at completion (audit finding). Drilled down — see [design doc](reflection-store.md). |
| 3 | **PriceMarkStore** | store | 5 | End-of-day Price Mark, keyed (instrument, date), shared/deduplicated across Trades (ADR 0002). Pure fact — no P&L, no risk, no derivation beyond assembling the `Marks` map calc consumes. Five ops: `upsertMark` (trader force-write; pushes prior to append-only `history`), `backfillMark` (automated write-if-absent — the no-op-on-present IS the set-once protection), `buildMarksFromFills` (the deep read → scalar `Marks` for calc, omitting instruments lacking a mark), `getMarkSeries` (chart price-axis + quality-analytic read, full records incl. provenance), `importMark` (verbatim restore preserving source + history). Carries `source: ProviderId` ('trader' or a provider id) and append-only `history` per mark — provenance for display, provider switching (forward-only retained), and source-quality analytics. The set-once override model: two write ops encode two rights (trader force / automated gentle) structurally, not by fetcher discipline. Drilled down — see [design doc](price-mark-store.md). |
| 4 | **AccountStore** | store | 4 | Account facts (broker, account identity). Slow-changing reference, referenced by ID from Trade. Four ops: `addAccount`, `listAccounts`, `getAccount`, `deactivateAccount`. Forward-only-retained (deactivated accounts stay valid on historical trades — the Taxonomy pattern; no delete op). No FK validation (convention C6) — provider-of-record, not validator. No import op (the live ops reproduce any backup faithfully; the first store in the partition to pass the import test cleanly). Drilled down — see [design doc](reference-stores.md). |
| 5 | **TaxonomyStore** | store | 4 | Forward-only categorical value sets (strategy, setup, etc.); retired values retained so existing records keep their tag. Trader-customizable. Four ops: `addValue(category, value)`, `listValues(category, activeOnly?)`, `retireValue(category, id, at)`, `listCategories()`. One store generic over category (Option A — every category shares the forward-only-retained invariant; a new category is data, not code). `TaxonomyValueId` IS `StrategyId` for the 'strategy' category. The canonical instance of the forward-only-retained pattern CONTEXT.md names (cited by PriceMark + Reflection schemas). No import op (passes the import test). Drilled down — see [design doc](reference-stores.md). |
| — | **PriceProviderStore** | store | 4 | Market-data provider configuration: which providers exist, which is active. Forward-only retained (retired provider ids stay valid on historical PriceMarks). The registry `source: ProviderId` on a PriceMark references — exactly as `strategy: StrategyId` on a Trade references TaxonomyStore. Four ops: `addProvider`, `listProviders`, `setActiveProvider` (the singleton the roadmap fetcher reads — exclusive active flag), `deactivateProvider`. **Credentials excluded** (charter-drift test applied to own scope: secrets-handling is a different invariant class than reference-data; the fetcher resolves credentials from its own secrets source). `'trader'` reserved (a fixed sentinel in PriceMarkStore, never minted here). A partition addition surfaced by the PriceMarkStore drill-down (provenance vs. configuration split). No import op (passes the import test). Drilled down — see [design doc](reference-stores.md). |
| 6 | **CalculationModule** | pure | 4 | Mark-dependent figure derivation from facts + marks, single or aggregate: `evaluate(record, marks, asOf) → FigureSet` (the full figure-set behind one call — P&L, position size, three risk quantities, reward, R:R, R-multiple, breakevens, lifecycle echo, revision count), `isFlat(fills)` (the cheap transition detector), `evaluateMany(records, marks, asOf) → ExposureReport` (aggregate current exposure across open positions — the multi-position analog of `evaluate`, same inputs, same mark-dependence; added by drill-down #6 / ADR 0008), and `stopsHit(record, marks, asOf) → StopsHit` (which declared stops the asOf marks crossed — per side, single-date EOD semantics; the stops session / ADR 0010). Structure-level quantities (`risk.maximum`, `breakevens`) are read off the position's **payoff curve** (ADR 0009) — one algorithm for every structure, no per-strategy formula catalog, no directional-bias input (which is also why `strategy` stays a calc-ignored store-owned tag). Declared levels are **per-direction stops + a single target, each a priced level with a quote basis** (underlying \| option position price — ADR 0010); **planned risk is the worst side's reading** (the single R baseline), with per-direction detail as additive FigureSet fields; `current`/`incremental` are whole-position mark-netting. Its **parameter and return types are the data contract** every store must serve. Drilled down first — see [design doc](calculation-module.md). |
| 7 | **PerformanceAnalytics** | pure | 1 | Closed-trade **outcome** aggregation — a mark-free fold over per-trade FigureSet snapshots: R-multiple distribution, equity curve by R, win rate/expectancy/profit factor, P&L total, plan-revision discipline (per-trade). One op: `aggregate(results: FigureSet[]) → PortfolioReport` (metrics are fields on the return, not separate ops — the `~3` estimate collapsed to one deep op). No marks, no filters (FigureSet carries no filter dimension; the coordinator pre-narrows via `listTrades(filters)`), no temporal series (those are compositions over calc's `evaluate`, owned by the consumer holding the marks). **Closed-trade-only:** `rMultiple` is realized-only, so an open trade's snapshot is a non-outcome zero that distorts every R-based metric; open-trade exposure is served by calc's `evaluateMany` (ADR 0008), not this module. Drilled down — see [design doc](performance-analytics.md). |
| 8 | **PlanCommitCoordinator** | coordinator | 2 | The start of every Trade and its pre-fill exit. `commitPlan(TradeInput) → {tradeId, figures, warnings}`: validates the Plan's R:R geometry via calc — the ADR 0010 charter (no declared stop side / misplaced side / non-profit target **blocks**; an in-tent stop **teaches** via `warnings`) — then commits Trade+Plan + creates the required pre-entry placeholder in ONE `StorageBinding.transaction` (OQ 9's recorded home); returns the plan-time FigureSet for the payoff visualization. `discardPlan(tradeId, at)`: retire a never-filled plan + void its owed placeholder in one transaction (audit finding F1 — the one trader-declared transition, terminal snapshotless `Discarded`). Joins TradingRecord + Reflection + calc — no PriceMarkStore (planned figures are mark-free). Drilled down — see [design doc](plan-commit-coordinator.md). |
| 9 | **FillEntryCoordinator** | coordinator | 3 | Everything that happens because a fill landed or was fixed. Three ops: `recordFill` (first fill → Open; the flat-detecting fill → Closed + snapshot + post-close bookend, in one `StorageBinding.transaction`; returns `fillId` + `closedFigures` — the UI resolves the optional fill-reflection offer now/later/none via direct ReflectionStore calls), `correctFill` (the OQ 12/13 branch map: price-only → regenerate via `replaceSnapshot`; un-flatted Closed → `reopenTrade`; flatted Open → `closeTrade` + bookend in a transaction), `regenerateSnapshots(scope?)` (idempotent sweep serving ADR 0007's calc-bug migration and OQ 14's mark-correction response — detection: Closed ∧ date(closedAt) = mark.date ∧ fill-instrument match). Joins TradingRecord + Reflection + PriceMark + calc. Drilled down — see [design doc](fill-entry-coordinator.md). |
| 10 | **DailyReviewCoordinator** | coordinator | 1 | The daily-review assembly — the widest READ join and the system's first read-only coordinator (PerformanceReporting is the second). `runDailyReview(asOf): DailyReviewView` — one op returns the whole day: open trades (records + live figures + `stopsHit` per ADR 0010 + owed + market context), the open-book exposure (`evaluateMany`, ADR 0008), `marksDue` (the mark-collection prompt's data, computed in hand from the marks map's omissions), every owed placeholder across ALL trades (one global read — Planned pre-entries and Closed post-closes included), and the day's interleaved journal stream (ADR 0004). Owns **no writes**: the review is a moment, not a transaction — every review-screen write is a single-store direct call (marks, revisions, entries, completions) or another coordinator's moment (`discardPlan`), performed by the UI (rule 8 — the session's structural finding, correcting the Phase-2 interactive-mark sketch). Present-tense assembly; `asOf` is a lens, not a time machine. Drilled down — see [design doc](daily-review-coordinator.md). |
| 11 | **PerformanceReportingCoordinator** | coordinator | 2 | The read-only reporting assembly — the "how am I doing over time" view. Two ops sharing one `ReportRequest` (owner decision — one op per question the screen asks): `runOutcomeReport` (closed-in-scope → `aggregate` over snapshots, O(1) per ADR 0007, + `closedAt`-ordered drill-down rows) and `runExposureReport` (open-in-scope → `evaluateMany`, ADR 0008, marks via `buildMarksFromFills`). Each op conjoins its own status onto the pass-through `TradeFilters` — status stays a filter, not a router argument; empty scopes are valid zero views. Both accept `groupBy` (single-dimension: strategy/underlying/accountId) with label resolution incl. retired values, group lists ordered label-ascending so the UI can align the two ops' lists. Cold Closed snapshots (null `finalFigures`) are computed in place with `regenerateSnapshots`' recipe minus the write-back. The second read-only coordinator (after DailyReview). Joins TradingRecord + PriceMark (exposure marks + cold-snapshot compute) + Reference (Account/Taxonomy) + Calc + PerformanceAnalytics. Drilled down — see [design doc](performance-reporting-coordinator.md). |
| — | **StorageBinding** | seam | ~5 | The internal persistence primitive behind all five stores: put/get/delete/range-query over opaque fact records. Two implementations — in-memory (unit tests) and real (prod). Zero business rules. |

---

## Coordinator and pure-module sketches

Illustrative, not final. Each signature is pinned in its own drill-down doc.
Types shown are TS-adjacent; the actual parameter shapes are dictated by
CalculationModule (rules 2 and the data-contract principle).

### CalculationModule (pure)

```ts
// The data contract every store must serve. Dictated here, consumed by stores.
// See calculation-module.md for the full, pinned interface.
type TradeRecord = {
  tradeId, accountId, underlying,
  strategy,                            // STORE-OWNED — calc ignores (Reporting filter)
  status: 'Planned'|'Open'|'Closed'|'Discarded',
  closedAt?,                           // STORE-OWNED (OQ 11) — present iff Closed; snapshot-regen asOf. Calc ignores.
  plan: { entry, stops: { downside?, upside? }, target, thesis, invalidation, entryEmotion, committedAt },  // levels per ADR 0010
  revisions: PlanRevision[],          // append-only, dated (ADR 0001)
  fills: Fill[],                       // each carries fillId + instrument-type per leg (ADR 0005) + option contract facts when the leg is an option (ADR 0009)
  finalFigures?: FigureSet,            // present iff Closed (ADR 0007)
}
type Marks = Map<InstrumentId, Price>  // plain data, not a function (OQ 1 → B)

// Four operations. evaluate returns the full figure-set behind one call;
// evaluateMany is its multi-position analog (aggregate current exposure).
evaluate(record: TradeRecord, marks: Marks, asOf: Date): FigureSet
isFlat(fills: Fill[]): boolean         // cheap transition detector (ADR 0006)
evaluateMany(records: TradeRecord[], marks: Marks, asOf: Date): ExposureReport  // ADR 0008
stopsHit(record: TradeRecord, marks: Marks, asOf: Date): StopsHit  // declared stops crossed (ADR 0010)

type FigureSet = {
  pnl:        { realized: number, unrealized: number | null },  // null if no mark
  positionSize: number,                // signed net from fills
  risk: {
    planned:  Dual,                    // frozen at initial Plan (ADR 0005); the WORST side's stop reading (ADR 0010)
    plannedByDirection?: { downside?: Dual, upside?: Dual },   // ADR 0010 — detail views
    current:  Dual | null,             // live, whole-position netting; null if no mark or Planned
    currentByDirection?: { downside?: Dual, upside?: Dual },   // ADR 0010 — detail views
    maximum:  MaxRisk | null,          // payoff-curve minimum (ADR 0009); null for Planned
  },
  reward: {
    planned:    Dual,
    incremental: Dual | null,          // live; null if no mark
  },
  rr: { planned: number, current: number | null },
  rMultiple: number,                   // realized ÷ planned-risk dollars (R units)
  breakevens: Price[] | null,          // zero-crossings of the payoff curve (ADR 0009); null for Planned
  lifecycle: 'Planned'|'Open'|'Closed'|'Discarded',// echoed from record.status (ADR 0006)
  revisionCount: number,               // raw count; rate is PerformanceAnalytics
}
type Dual = { ratio: number, dollars: number }                      // dual presentation rule
type MaxRisk = { bounded: true, amount: Dual } | { bounded: false } // OQ 2 → A
type ExposureReport = {                                              // evaluateMany's return (ADR 0008)
  positionCount: number,
  totalUnrealized:        { dollars: number, missingMarkCount: number },  // null marks counted, not zeroed
  totalCurrentRisk:       { dollars: number, missingMarkCount: number },  // dollars only (ratios don't sum across sizes)
  totalPlannedRisk:       { dollars: number },                            // mark-free
  totalIncrementalReward: { dollars: number, missingMarkCount: number },
}
```

### PerformanceAnalytics (pure)

```ts
// Closed-trade outcome aggregation over snapshots. No filters — FigureSet carries
// no filter dimension; the coordinator pre-narrows via listTrades(filters) and
// passes an already-scoped list. See performance-analytics.md.
aggregate(
  results: FigureSet[],                 // one per CLOSED Trade in scope (snapshots, ADR 0007)
): PortfolioReport                       // rMultiples, expectancy, winRate, equityCurveByR,
                                         //   totalRealized, profitFactor, totalRevisions, meanRevisions
```

### Coordinators

```ts
// PlanCommitCoordinator — see plan-commit-coordinator.md for the full, pinned interface
commitPlan(input: TradeInput): { tradeId: TradeId, figures: FigureSet, warnings: PlanWarning[] }
discardPlan(tradeId: TradeId, at: Date): void

// FillEntryCoordinator — see fill-entry-coordinator.md for the full, pinned interface
recordFill(tradeId: TradeId, fill: FillInput): {
  statusAfter: 'Planned'|'Open'|'Closed',
  fillId: FillId,                        // anchors the fill-reflection offer (UI resolves
                                         //   now/later/none via direct ReflectionStore calls)
  closedFigures?: FigureSet,             // present iff this fill closed the trade
}
correctFill(tradeId: TradeId, fillId: FillId, correction: FillInput): {
  statusAfter, reopened, closedByCorrection, snapshotRegenerated,   // OQ 12/13 branch map
}
regenerateSnapshots(scope?: RegenScope): { regenerated: TradeId[] }  // ADR 0007 migration + OQ 14

// DailyReviewCoordinator — see daily-review-coordinator.md for the full, pinned interface
runDailyReview(asOf: Date): DailyReviewView   // open trades + figures + stopsHit + owed + market
                                              //   context + exposure + marksDue + day stream —
                                              //   READ-ONLY, the only coordinator with no writes

// PerformanceReportingCoordinator — see performance-reporting-coordinator.md for the full, pinned interface
runOutcomeReport(request: ReportRequest): OutcomeReportView   // closed-in-scope → aggregate (mark-free)
runExposureReport(request: ReportRequest): ExposureReportView // open-in-scope → evaluateMany (ADR 0008)
// One shared request type; each op conjoins its own status — status is a
// filter, not a router argument.
```

---

## Who-calls-whom matrix

Caller (rows) → callee (columns). Stores never call each other. Pure modules
call nothing. Coordinators call stores + pure modules.

| | TradingRecord | Reflection | PriceMark | PriceProvider | Account | Taxonomy | Calc | PerfAnalytics |
|---|---|---|---|---|---|---|---|---|
| **PlanCommitCoordinator** | write (`commit` — asserts ≥1 declared stop side; `discardTrade` — the pre-fill exit, in the discard transaction) | read (`listEntries` — owed pre-entry) / write (`createPlaceholder` — pre-entry, required, in the commit transaction; `voidPlaceholder` — discard) | — | — | — | — | evaluate (planned-figure validation charter) | — |
| **FillEntryCoordinator** | write (`recordFill` — absorbs fill+status+snapshot, returns fillId; `correctFill`; `closeTrade`/`reopenTrade`/`replaceSnapshot` — the guarded correction family; `getTradeRecord`) | write (`createPlaceholder` — post-close required, in the close transaction; closed-by-correction bookend) | read (`buildMarksFromFills`, at close + regeneration) | — | — | — | isFlat, evaluate | — |
| **DailyReviewCoordinator** | read (`listTrades({status:'Open'})`) | read (`listEntries` ×3: global owed, per-trade market context, day stream) | read (`buildMarksFromFills` only — the review's mark WRITES are UI-direct, see below) | — | — | — | evaluate, evaluateMany, stopsHit | — |
| **market-data fetcher (roadmap)** | — | — | read (`getMarkSeries`) / write (`backfillMark`) | read (active provider) | — | — | — | — |
| **PerformanceReportingCoordinator** | read (`listTrades` — status conjoined per op) | — | read (`buildMarksFromFills` — exposure marks + cold-snapshot compute) | — | read (group labels) | read (group labels, incl. retired) | evaluateMany (`runExposureReport`, ADR 0008) | aggregate (`runOutcomeReport`) |
| **direct read callers (UI, backup)** | `getTradeRecord`, `listTrades` | `getEntry`, `listEntries`, `getSchema`, `listSchemas` | `getMarkSeries` | `listProviders` | listAccounts | getTaxonomy | evaluate | — |
| **restore tool (import path)** | `importTrade` (per historical trade, derive-on-import) | `importSchema` then `importEntry` (verbatim, two-phase) | `importMark` (verbatim, source+history intact) | live ops (add+deactivate) | live ops (add+retire) | live ops (add+setActive+deactivate) | — | — |

**Direct writes that need no coordinator** (rule 8):

- **PlanRevision** → TradingRecordStore only (`appendRevision`). Not a
  coordinator.
- **Fill correction** → TradingRecordStore only (`correctFill` — invalidates the
  snapshot, signals possible status invalidity). Single-store; the *response* to
  the signal (snapshot regen, possible re-open) is FillEntryCoordinator's
  (`correctFill` there — OQs 12/13 resolved; see
  [fill-entry-coordinator.md](fill-entry-coordinator.md)).
- **Explicit re-open (late-fill resolution)** → TradingRecordStore only
  (`reopenTrade` — guarded: fills must sum non-zero). Single store → rule 8;
  the FillEntryCoordinator rejects a late fill on a Closed trade and the UI
  confirms an explicit `reopenTrade` before re-recording. The third canonical
  zero-coordinator single-store workflow (after PlanRevision and
  JournalWriting).
- **JournalWriting** → ReflectionStore only (`createEntry` / `completePlaceholder`,
  optional market-link via `setMarketLinks`). **Not a coordinator** (OQ 6 resolved):
  convention C6 (no cross-store referential validation) removed its only cross-store
  act (validating a parent ref exists), so it touches one store → rule 8 applies.
  Journal-writing joins PlanRevision as the canonical zero-coordinator single-store
  workflows. Schema definition (`saveSchema`) is likewise a direct store call.
- **PriceMark entry during Daily Review** → PriceMarkStore only (`upsertMark`) —
  a single-store write, direct UI call (rule 8; refined by the DailyReview
  session, which corrected this bullet's original "handled inside
  DailyReviewCoordinator" wording). The coordinator's view resolves WHAT's due
  (`marksDue`, computed in hand); the UI writes each mark and re-queries. A mark
  *correction* from the review screen is the same path; an overwriting write is
  followed by the UI's direct `regenerateSnapshots` (OQ 14's trigger).
- **Automated price backfill (roadmap fetcher)** → PriceMarkStore only
  (`backfillMark`), reading the active provider from PriceProviderStore. Not a
  coordinator — it touches one fact store for writes (the provider read is a
  reference lookup, not a join producing a derived item). The set-once protection
  is structural (`backfillMark` no-ops on present slots).

**Backup/export/import** — TradingRecordStore exposes `importTrade` and
PriceMarkStore exposes `importMark` for the restore path (verbatim records,
provenance/history intact). Whether the *broader* backup architecture is a
storage-seam fan-out or a lifecycle coordinator is still open question 8; each
store's slice is served either way (the import ops are the API-level path; a
seam-level fan-out is orthogonal).

---

## Main-flow walkthroughs

### 1. Plan-commit (start a Trade)

```
trader → PlanCommitCoordinator.commitPlan(tradeInput)
  → figures = CalculationModule.evaluate(sketch, ∅, committedAt)
  │    // the validation charter (ADR 0010): no stop side / misplaced side /
  │    // non-profit target → THROW, nothing written; in-tent side → warning
  → StorageBinding.transaction:                 // the cross-store commit (OQ 9)
      TradingRecordStore.commit(tradeInput)     // write Trade (status=Planned) + Plan
      ReflectionStore.createPlaceholder({       // the required pre-entry bookend
          level:'trade', type:'pre-entry', tradeId, required:true, createdAt:committedAt
        })
← { tradeId, figures, warnings }
```

Trade is now `Planned`, no fills yet, a required pre-entry reflection placeholder
is owed. The pre-fill exit is the mirror transaction:
`discardPlan(tradeId, at)` → `discardTrade` (Planned-only, zero-fills guard →
terminal `Discarded`) + `voidPlaceholder` (the owed bookend retires).

### 2. Fill-entry (record a fill; includes trade-close as a sub-case)

```
trader → FillEntryCoordinator.recordFill(tradeId, fillInput)
  → existing = TradingRecordStore.getTradeRecord(tradeId)        // load current fills
  → [status Closed → throw: late-fill rejection; explicit reopen is the resolution]
  → simFills = [...existing.fills, fillInput]                    // simulate post-fill
  → CalculationModule.isFlat(simFills)                           // cheap, once, for this one trade (ADR 0006)
  → branch on result:
      not flat           → TradingRecordStore.recordFill(tradeId, fill)            // first fill → Open internally
      newly flat         → marks = PriceMarkStore.buildMarksFromFills(simFills, fill.at)
                            → figures = CalculationModule.evaluate({...existing, fills:simFills}, marks, fill.at)
                            → StorageBinding.transaction:                          // cross-store (OQ 9)
                                TradingRecordStore.recordFill(tradeId, fill, figures)  // ONE call: append +
                                │                                                     //   transition to Closed + closedAt +
                                │                                                     //   snapshot (defensively asserts net-zero)
                                ReflectionStore.createPlaceholder({                // required post-close bookend
                                      level:'trade', type:'post-close', tradeId, required:true, createdAt:fill.at
                                    })
  ← { statusAfter, fillId, closedFigures? }
  → the UI offers the optional fill-level reflection on fillId — resolved via
    DIRECT ReflectionStore calls: 'now' → createEntry; 'later' → createPlaceholder;
    'none' → nothing (offer precedes creation; see fill-entry-coordinator.md)
```

The split pays off here: N−1 fills do the cheap `isFlat` only; the one
flat-detecting fill pays the single `evaluate` to build the snapshot. The
flat-detecting fill closes the trade, snapshots its final figures (ADR 0007),
and owes the post-trade review placeholder — all in one transactional
workflow. The close path is a **single** `recordFill(tradeId, fill,
closeFigures)` call on the store side — append + status transition + `closedAt`
+ snapshot atomically, with **no separate `setStatus`**; status mutations are
fill-arithmetic-guarded ops only (see
[TradingRecordStore design doc](trading-record-store.md), decided semantics 2
and 17, and [FillEntryCoordinator design doc](fill-entry-coordinator.md) for
the correction branch map).

### 3. Daily review

The review is a two-phase loop: assemble → (UI collects + writes directly) →
re-assemble. The coordinator is the read join only — the widest in the system,
and read-only (rule 8: every review-screen write is a single-store direct call
or another coordinator's moment; pinned in
[daily-review-coordinator.md](daily-review-coordinator.md)).

```
trader → DailyReviewCoordinator.runDailyReview(today)              // phase 1 — assemble
  → openTrades = TradingRecordStore.listTrades({ status: 'Open' })   // cheap indexed filter (ADR 0006), full records
  → marks = PriceMarkStore.buildMarksFromFills(allOpenFills, today)  // ONE map serves every calc call
  → marksDue = distinct fill instruments − marks keys                 // in hand — the mark-collection prompt's data
  → per open trade: calc.evaluate(trade, marks, today)                // live figures, nulls honest
                    + calc.stopsHit(trade, marks, today)              // declared stops crossed (ADR 0010) — reports, never acts
  → calc.evaluateMany(openTrades, marks, today)                       // the open-book exposure (ADR 0008)
  → ReflectionStore.listEntries({ state:'placeholder' })              // ONE global owed read — all trades
  │    (grouped by tradeId in hand — Planned pre-entries + Closed post-closes included)
  → per open trade: ReflectionStore.listEntries({ linkedToTrade, level:'market' })   // market context
  → ReflectionStore.listEntries({ from: startOfDay, to: endOfDay, state:'complete' }) // the day's stream (ADR 0004)
  ← DailyReviewView (open trades + figures + hits + owed + market, exposure, marksDue, dayEntries)
trader enters missing marks → UI → PriceMarkStore.upsertMark(…) each  // DIRECT single-store write (rule 8)
UI → DailyReviewCoordinator.runDailyReview(today)                     // phase 2 — re-query (rule 6)
trader records observations → UI → ReflectionStore.createEntry(...)   // optional, journal-writing path (direct store call, OQ 6)
```

### 4. Performance reporting

Two ops share one `ReportRequest` — one per question the screen asks
(the pinned design; see
[performance-reporting-coordinator.md](performance-reporting-coordinator.md)).
The ops split on mark-dependence (ADR 0008): the outcome report is a
mark-free fold over closed snapshots (PerformanceAnalytics); the exposure
report is a mark-dependent fold over open records (calc). Open trades never
feed the outcome aggregate — `rMultiple` is realized-only, so an open
trade's snapshot is a non-outcome zero that would poison the R-based metrics
([performance-analytics.md](performance-analytics.md) decided semantic 2).

```
trader → PerformanceReportingCoordinator.runOutcomeReport({ filters, groupBy?, asOf })
  → closed = TradingRecordStore.listTrades({ ...filters, status:'Closed' })   // pre-narrowed HERE
  → figures = closed.sort(by closedAt)
                 .map(r => r.finalFigures                                      // O(1) cache reads (ADR 0007)
                         ?? calc.evaluate(r, priceMarks.buildMarksFromFills(   // cold snapshot — the
                              r.fills, date(r.closedAt)), r.closedAt))         //   regen recipe, no write-back
  → portfolio = PerformanceAnalytics.aggregate(figures)                        // one mark-free call
  ← OutcomeReportView { portfolio, trades: closedAt-ordered rows, groups? }    // labels via taxonomy/accounts

trader → PerformanceReportingCoordinator.runExposureReport({ ...sameRequest })
  → open = TradingRecordStore.listTrades({ ...filters, status:'Open' })
  → marks = PriceMarkStore.buildMarksFromFills(open.flatMap(r => r.fills), asOf)  // ONE map
  → exposure = calc.evaluateMany(open, marks, asOf)                            // one mark-dependent call
  ← ExposureReportView { report, asOf, groups? }                               // group lists align by label
```

Closed trades are O(1) reads from their snapshot (cold ones compute in place,
read-only); filtering (date/strategy/underlying/account) is the store's via
`listTrades(filters)`; group-by-strategy/account is coordinator-side with
label resolution. Empty scopes are valid zero views, never nulls — and the
per-day revision rate (OQ 15) is deferred to the reporting-UI session with
the pooled-rate analysis parked in the design doc.

### 5. Plan revision (no coordinator — direct store write, rule 8)

```
trader → TradingRecordStore.appendRevision(tradeId, { stop?, target?, reason, at })
```

Single-store. The revision changes *current* risk (derived) but never *planned*
risk (frozen at the initial plan — ADR 0001). No coordinator needed.

---

## Drill-down order

Per the deep-interface-design skill: pure calculation first (its types pin every
store's contract), then harvest modules whose contracts prior sessions pinned.

1. **CalculationModule** — first. Its parameter types (TradeRecord, Marks,
   FigureSet) become the contract every store serves. Resolved open questions
   1–3. ✓ [design doc](calculation-module.md)
2. **TradingRecordStore** — second. Its `getTradeRecord` returns exactly what
   Calc established (plus three store-owned fields calc ignores: `strategy`,
   `closedAt`, `fillId`). Resolved OQ 4 (per-Fill instrument-type; legs derived)
   and OQ 11 (`closedAt` on the record). Seven ops; `recordFill` absorbs the
   transition + snapshot (no raw `setStatus`); `importTrade` serves the
   ADR-mandated restore path. ✓ [design doc](trading-record-store.md)
3. **PriceMarkStore** — third. Serves the `Marks` contract and owns the exported
   `buildMarksFromFills` op (OQ 1 downstream closed: missing-mark = omission).
   Answered the API-seam shape: the store is API-ready now via `backfillMark` +
   provenance (`source`, `history`), not by deferring sourcing. Five ops
   (`upsertMark`, `backfillMark`, `buildMarksFromFills`, `getMarkSeries`,
   `importMark`); the set-once override model is encoded structurally in two write
   ops. Surfaced PriceProviderStore as a partition addition (provenance vs.
   configuration split) and OQ 14 (mark-correction snapshot invalidation).
   ✓ [design doc](price-mark-store.md)
4. **ReflectionStore** — fourth. Pins placeholders derivation (OQ 5 — dissolved:
   placeholders are stored facts, "owed" is a filter not a derivation),
   journal-writing (OQ 6 — dissolved: direct store call, no coordinator), and
   schema-location (OQ 10 → ReflectionStore owns the versioned schema registry;
   the split criterion for a separate reference store isn't met). Twelve ops (seven
   entry + five schema); the versioned-schema model (ADR 0003 by reference) grew
   the store from ~8 to 12. ✓ [design doc](reflection-store.md)
5. **AccountStore** + **TaxonomyStore** + **PriceProviderStore** — quick reference
   stores, designed together as one combined session (they share one structural
   pattern). 4 ops each (the overview's `~3`/`~4` estimates grew by one: the
   retirement op that forward-only-retained makes load-bearing). All three pass
   the import test without import ops (unlike the four prior stores) — the live
   write ops reproduce any backup faithfully. PriceProviderStore's credentials
   excluded by a charter-drift test. TaxonomyStore is one store generic over
   category (Option A). ✓ [design doc](reference-stores.md)
6. **PerformanceAnalytics** — second pure module; depends on the FigureSet type
   from step 1. Resolved the filter-seam question (no filters on `aggregate` —
   FigureSet carries no filter dimension; the coordinator pre-narrows via
   `listTrades(filters)`) and the closed/open scope question (closed-trade
   outcomes only; `rMultiple` is realized-only so open snapshots are non-outcome
   zeros; open exposure is a coordinator/UI sum). One op: `aggregate` (the
   overview's `~3` estimate collapsed to one deep op, metrics as fields on the
   return). Surfaced finding F3 (revision-rate denominator: per-trade now, per-
   day deferred — FigureSet carries no duration). ✓ [design doc](performance-analytics.md)
7. **The four coordinators** — last, each thin; their dependencies are fully
   pinned by then. FillEntry owned OQ 7 (fold confirmed), OQ 12/13 (the
   guarded correction family `reopenTrade`/`closeTrade`/`replaceSnapshot` +
   `correctFill`'s branch map), and OQ 14 (`regenerateSnapshots`).
   **FillEntryCoordinator ✓** [design doc](fill-entry-coordinator.md);
   **PlanCommitCoordinator ✓** [design doc](plan-commit-coordinator.md) —
   owned OQ 9's recorded home (the commit + discard transactions), the
   validation charter (ADR 0010's in-tent teaching pinned as `warnings`; the
   option-structure computation basis exported → OQ 18), the ≥1-stop-side
   store invariant, and the pre-fill exit `discardPlan` (audit finding F1:
   `discardTrade` + `voidPlaceholder`, terminal `Discarded`).
   Before PlanCommit, the interstitial **stops session** landed (ADR 0010,
   OQ 16): per-direction
   stops, single target, quote basis, worst-side R, whole-position netting
   for `current`/`incremental`, calc's fourth op `stopsHit`. PlanCommit's
   validation charter gains the in-tent stop teaching.
   **DailyReviewCoordinator ✓** [design doc](daily-review-coordinator.md) —
   the widest read join landed as the first of the two read-only coordinators:
   the review's writes ruled UI-direct (rule 8, correcting the Phase-2
   interactive-mark sketch), `marksDue` computed in hand, one global owed
   read, the ADR 0004 day stream, and `stopsHit`'s routing (ADR 0010).
   **PerformanceReportingCoordinator ✓** [design doc](performance-reporting-coordinator.md)
   — the last coordinator: two ops sharing one `ReportRequest` (owner
   decision — one op per question the screen asks), grouping folded in on
   both ops with label resolution incl. retired values, cold Closed
   snapshots computed in place read-only, OQ 15 visited and deferred to the
   reporting-UI session (pooled-rate analysis parked), and the second
   read-only coordinator.
   **The drill-down order is complete** — all twelve domain modules (eleven
   partition rows plus PriceProviderStore) are drilled down; remaining design
   work is the StorageBinding seam (OQ 9's deferred primitive shape, joining
   implementation) and the parked OQs (8, 15, 17, 18).

---

## Open-questions ledger

Each open question is owned by the drill-down that will resolve it. Between
sessions this list is the home of the **export ledger** — requirements one
drill-down discovers for another are recorded here as commitments the receiving
session must import.

| OQ | Question | Drilled down by |
|---|---|---|
| 1 | ~~MarkResolver shape: function `(instrument,date)→price`, pre-materialized map, or coordinator pre-fetch?~~ **RESOLVED** → `Marks: Map<InstrumentId, Price>` (plain data, caller-built). Also exported a deep `buildMarksFromFills(fills, date)` op to PriceMarkStore. **(Downstream closed by PriceMarkStore)** — `buildMarksFromFills` returns scalar `Marks`; missing-mark contract is omission (instrument absent from map → `undefined` → calc returns `null`). | CalculationModule ✓ / PriceMarkStore ✓ |
| 2 | ~~"Unbounded" maximum-risk return shape (sentinel / union / `isBounded` flag)~~ **RESOLVED** → discriminated union `{bounded:true, amount} \| {bounded:false}`. | CalculationModule ✓ |
| 3 | ~~Dual-presentation (ratio+dollars): returned by calc or computed in a presentation layer?~~ **RESOLVED** → calc returns `Dual` everywhere (the rule is domain-level, not UI). | CalculationModule ✓ |
| 4 | ~~Legs / instrument-type: per-Fill vs a derived leg view?~~ **RESOLVED** → per-Fill (instrumentType is a first-class Fill attribute, ADR 0005). A "leg" is a derivation (grouping fills by instrument), not a fact the store persists. No `getLegs` op. | TradingRecordStore ✓ |
| 5 | ~~Placeholders: derived how exactly (lifecycle ∩ existing entries)?~~ **RESOLVED** → dissolved by Candidate B. Placeholders are stored facts (entries in `'placeholder'` state the coordinators create); "what's owed" is `listEntries({ state:'placeholder' })` — a filter on a stored fact, NOT a derivation. The "lifecycle ∩ existing entries" computation does not exist. | ReflectionStore ✓ |
| 6 | ~~JournalWriting: separate coordinator or in-store parent-ref check?~~ **RESOLVED** → direct store call, no coordinator. Convention C6 (no cross-store referential validation) removes the only cross-store act; journal-writing touches one store → rule 8. Joins PlanRevision as a zero-coordinator workflow. | ReflectionStore ✓ |
| 7 | ~~Trade-close: folded into FillEntryCoordinator or split?~~ **RESOLVED** → folded, confirmed. Close is a *consequence* of a fill (CONTEXT's close rule: computable from fills, no trader-declared close event) — `recordFill` owns it. The store op `closeTrade` exists only inside the correction workflow, where the flat-making event is a correction instead of a fill. | FillEntryCoordinator ✓ |
| 8 | Backup/export/import: storage-seam fan-out or lifecycle coordinator? **(Partially served)** — TradingRecordStore exposes `importTrade`, PriceMarkStore exposes `importMark`, ReflectionStore exposes `importEntry` + `importSchema` for the restore path (verbatim records). The three reference stores (Account/Taxonomy/PriceProvider) need **no** import ops — their live write ops reproduce any backup faithfully (the first stores to pass the import test cleanly), *provided* OQ 8 guarantees id stability across restore. The *broader* backup architecture (storage-seam fan-out vs. coordinator) remains open. | overview / lifecycle |
| 9 | ~~Multi-fact write atomicity (commitPlan spans TradingRecord+Reflection): transaction story?~~ **RESOLVED** → one transaction mechanism, used at two levels (decided in the PlanCommitCoordinator session). **Cross-store**: the coordinator wraps its writes in a `StorageBinding.transaction(...)` — `commitPlan` = `tradingRecord.commit` + `reflection.createPlaceholder` in one transaction; only the coordinator can own this (no single store sees both writes). **Single-store multi-fact**: `commit` (Trade+Plan) and `recordFill`'s close branch (fill+status+closedAt+finalFigures) use the same primitive internally. Rejected: compensating-undo/saga (needs a delete op the system deliberately lacks); accept-torn-write (a Planned trade with a missing *required* pre-entry placeholder breaks the bookend invariant — the trader is never prompted). The primitive's exact API is deferred to the StorageBinding seam (its shape is TradingRecordStore's open item; StorageBinding is not in the drill-down order — design joins the coordinators step or implementation). | resolved — primitive shape: StorageBinding drill-down / implementation |
| 10 | ~~Entry Schema definitions: ReflectionStore (snapshot locality) vs ReferenceStore (customization symmetry)?~~ **RESOLVED** → ReflectionStore (Option A). The versioned schema registry is structurally a reference collection, but the PriceProviderStore split criterion (separate consumer + separate domain) is not met: entry schemas have one consumer (the journal) in one domain. ADR 0003 by reference (versioned `schemaId`, not embedded snapshot). | ReflectionStore ✓ |
| 11 | ~~**(exported from CalculationModule)** Snapshot `asOf`: regenerating a corrected closed-trade snapshot needs the original close date, but `TradeRecord` carries no `closedAt` and `evaluate` only takes `asOf`. Record needs a `closedAt` field, or `finalFigures` must carry its own `asOf`.~~ **RESOLVED** → `closedAt?: Date` on TradeRecord, present iff Closed, stored at transition time. Regeneration passes `record.closedAt` as `asOf`. | TradingRecordStore ✓ |
| 12 | ~~**(exported from CalculationModule)** Status-invalidating correction: a fill correction could change net position from zero to non-zero (Closed → should-be-Open).~~ **RESOLVED** → the guarded-transition family on TradingRecordStore: `reopenTrade` (asserts fills ≠ 0; clears `closedAt` + snapshot) and `closeTrade` (asserts fills = 0; takes snapshot + `closedAt`) — the mirror of the edge that no prior session had written: a correction can also flat an *Open* trade. FillEntryCoordinator's `correctFill` owns the branch map. Every status mutation remains fill-arithmetic-guarded; `recordFill` on Closed still rejects (late fills resolve via explicit `reopenTrade` then re-record). | FillEntryCoordinator ✓ / TradingRecordStore ✓ |
| 13 | ~~**(exported from TradingRecordStore)** Snapshot write-back after regeneration.~~ **RESOLVED** → `replaceSnapshot(tradeId, figures)`, Closed-only guard. Standalone rather than a widened `correctFill` — decisive reason: the mark-correction path (OQ 14) needs snapshot write-back with no fill being corrected. | FillEntryCoordinator ✓ (decision) → TradingRecordStore ✓ (op) |
| 14 | ~~**(exported from PriceMarkStore)** Mark correction invalidating a closed-trade snapshot.~~ **RESOLVED** → detection + response live in FillEntryCoordinator's `regenerateSnapshots(scope)`: affected = Closed trades where `date(closedAt) === mark.date` and some fill's instrument matches; response = recompute as-of `closedAt` + `replaceSnapshot`. Trigger convention: the UI calls the sweep after an `upsertMark` that *overwrote* an existing mark (history non-empty). Idempotent, so over-calling is harmless. Detection is a coordinator-side filter over `listTrades` — PriceMarkStore stays consumer-agnostic (ADR 0002, rule 1). | FillEntryCoordinator ✓ |
| 15 | **(surfaced by PerformanceAnalytics)** Per-day plan-revision-rate. ADR 0001 names revisions-over-duration; FigureSet carries `revisionCount` (raw count) but no trade duration (no `committedAt`/`closedAt`), so PerformanceAnalytics reports `meanRevisions` (per-trade) only. Two paths to the per-day rate: (a) calc adds a per-trade `revisionRate` field to FigureSet (reverses calc semantic 8's "rate is PA's job"); (b) the coordinator computes revisions/day from `closedAt − committedAt` it already holds, bypassing PerformanceAnalytics for that one metric. **Visited by the PerformanceReportingCoordinator session — deferred by owner decision**: no per-day field on the view yet; the pooled-rate analysis is parked in [performance-reporting-coordinator.md](performance-reporting-coordinator.md) semantic 7 (pooled `Σ revisionCount ÷ Σ spanDays` — per-trade rates cannot fold to the pooled figure, same-day trades are ÷0, so path (a) would buy the wrong number; path (b) is the parked recommendation, additive on `OutcomeReportView` when adopted). | reporting-feature design (reporting UI session) |
| 16 | ~~**(surfaced by the payoff-curve session, ADR 0009)** Plan stop/target representation for multi-directional structures.~~ **RESOLVED** → ADR 0010 (the stops session): stops are per risk direction (`{downside?, upside?}`, sides optional — one-stop-per-side is structural, two-on-a-side unexpressible); `target` is a single level; every level is a **price with a quote basis** (`'underlying'` \| `'option-position'` — the net over option legs, per unit, unsigned magnitude; the stop-vs-target role supplies direction). Planned risk = **the worst side's reading** (the single R baseline), per-direction detail as additive FigureSet fields; underlying-quoted stops read against the expiry curve (in-tent stops read as profits — PlanCommit surfaces the teaching); option-quoted levels compare against net option marks (no ADR 0009 boundary crossing); `current`/`incremental` amended to whole-position mark-netting; calc gains `stopsHit`. Deferred generalizations → OQ 17. | Stops session ✓ (ADR 0010) |
| 17 | **(surfaced by the stops session, ADR 0010)** Deferred level generalizations, parked until a requirement emerges: per-leg option quotes on multi-direction structures (a condor managed per side — single-direction option trades work today, the option position *is* that side); two-sided profit taking (`target` → per-direction sides mirroring `Stops`; figures stay single by fold policy, so FigureSet/PerformanceAnalytics/snapshots are untouched and any fold over a one-sided target is the identity — historical data stays valid); time stops (no requirement). | future session when a requirement emerges |
| 18 | **(surfaced by the PlanCommit session)** Pre-fill validation basis for option-structure plans. The in-tent teaching needs the planned structure (strikes locate the tent), which the `Plan` type does not carry — pre-fill, underlying-quoted levels on multi-leg option structures are incomputable, and linear arithmetic is basis-incoherent there (option-position entry $2.30 vs underlying stop $150). The charter and the `stop-reads-profit` warning shape are pinned now ([plan-commit-coordinator.md](plan-commit-coordinator.md) semantics 3 + 6); the MVP's validation is correct for everything exercisable (stock linear; option-position entry arithmetic). The options release decides: legs on Plan (additive `legs?`, no seam reshape — opens planned-quantity and entry-vs-legs-net questions) vs teach-at-first-fill (ADR 0005's freeze moves once). Joins the payoff-curve companion semantics parked in calculation-module.md's open items. | options-release drill-down |

---

## Releases implement subsets, not reshapes

The MVP (manual price entry, stock-only trades) is a **subset of operations on
these same shapes**, not a different architecture. Concretely:

- **Stock-only MVP**: TradingRecordStore fills carry instrument-type='stock'
  only; CalculationModule's maximum-risk branch exercises only the stock case;
  the option/short/spread branches exist but aren't reached. Stops and targets
  carry basis `'underlying'` only — the option-position basis exists in the
  shape (ADR 0010) but is unpopulated until options ship. No module is added,
  removed, or reshaped.
- **Manual price entry → automated pricing**: PriceMarkStore is populated by
  Daily Review entry in the first deliverable. The market-data API arrives in a
  subsequent deliverable *without changing the store's interface* — and this is
  true for the right reason now: the store already carries `source: ProviderId`
  (provenance), `backfillMark` (the automated write-if-absent path), and the
  set-once protection (the backfill no-op-on-present IS the override). A fetcher
  reads `getMarkSeries` to find missing dates, then `backfillMark` each. (The
  prior wording's premise — that the store was source-agnostic and sourcing was
  deferred — was wrong: it could not have honored the documented manual-override
  semantic.)
- **Single-leg → multi-leg → spreads → condors/butterflies → mixed (covered
  calls)**: each adds fills with richer instrument-type and leg structure. The
  shapes were designed for the full target up front; later releases exercise
  more of what's already there.

The principle: **shapes are stable; releases implement operation subsets.** A
seam that the later features break is a seam drawn wrong, and would have been
caught here.

---

## Alternatives considered and rejected

Recorded so nobody re-proposes them in six months.

- **Candidate A — per-entity repositories + service layer** (one store per
  entity: TradeStore, PlanStore, FillStore, etc. + a service layer). Rejected
  because per-entity seams don't match the read access pattern: consumers always
  need Trade+Plan+Revisions+Fills together (close rule, R:R chart, P&L, max-risk
  all do). Splitting per-entity forces every consumer into 4 coordinated reads
  to reassemble a record meaningless in pieces. Produces 15 modules where the
  chosen partition uses 11, with most stores being pass-throughs that fail the
  deletion test. Depth concentrates only in the pure module and reporting
  coordinators; the store layer adds no domain leverage.

- **Candidate B — one giant store + pure math** (a single ~30-op god store
  owning all facts). Rejected on the coordinator test: its headline virtue
  (one store swallows all coordination) holds only for *writes*. For read-side
  assembly — the Daily Review view needs open Trades + their unrealized P&L +
  pending placeholders + today's marks, interleaved by time — no single store
  op or pure function returns this. The coordinator doesn't vanish; it gets
  exiled into caller code, which couples the caller to store + calc + assembly
  logic: the worst of both worlds. Additionally untestable in pieces and a
  30-op interface too large to hold in your head.

- **ReferenceStore as a bundle** (within Candidate C itself, bundling Account +
  Taxonomy). Rejected because the two share no invariant — only "slow-changing
  categorical." Split into AccountStore + TaxonomyStore for seam honesty.

- **Portfolio aggregation inside the coordinator** (within Candidate C itself).
  Rejected because aggregation is pure and burying it in the coordinator hides
  testable logic behind a workflow module. Lifted into pure modules —
  PerformanceAnalytics (mark-free outcome fold over closed snapshots) and, per
  ADR 0008, calc's `evaluateMany` (mark-dependent current-exposure fold over open
  records). The split between the two pure aggregates tracks mark-dependence,
  not single-vs-portfolio: both exist so no coordinator re-implements figure
  arithmetic (null marks, dollars-only sums, outcome folds).

- **Lifecycle status derived-only** (the initial Candidate C load-bearing
  decision). Rejected in ADR 0006 after feedback that deriving on read makes the
  Daily Review's open-Trades query O(all-trades) and growing forever. Status is
  now stored authoritatively; `flat` is computed once at fill-record time.

- **Closed-trade figures recomputed on every read** (the default under "facts
  only"). Rejected in ADR 0007 after the same scaling argument applied to
  figures: closed trades have frozen inputs, so caching their figure-set once at
  close avoids O(N)-growing recomputation in reporting. The cache is
  regeneratable; the honest price is a regeneration migration on calc-bug-fix.
