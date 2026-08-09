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
   `CalculationModule` is single-trade; `PerformanceAnalytics` is
   portfolio-level aggregation over lists of single-trade results. Both are
   pure — testable with literal objects, no store, no mock, no binding.

3. **Lifecycle status is stored authoritatively (ADR 0006).** Planned/Open/Closed
   is a field on the Trade record, not derived on read. Transitions fire when a
   fill is recorded. `flat` (net-position-zero) is still a CalculationModule
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
   when underlying facts (a fill correction) or the calc (a bug fix) change.
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
| 1 | **TradingRecordStore** | store | 7 | The trading record itself: Trade identity + lifecycle status (Planned/Open/Closed, stored per ADR 0006) + optional finalFigures snapshot (per ADR 0007) + Plan (original levels, thesis, invalidation, entry emotion) + PlanRevision (append-only dated deltas, ADR 0001) + Fill (instrument, side, qty, price, time, instrument-type per leg, underlying, fillId). Seven ops: `commit`, `recordFill` (the only status-mutating op — absorbs append + transition + close-snapshot; no raw `setStatus` exists), `appendRevision`, `correctFill` (invalidates the snapshot, signals possible status invalidity), `getTradeRecord`, `listTrades` (collapses listOpenTrades + listTradeIds into one filtered op), `importTrade` (verbatim restore with derive-on-import, ADRs 0006/0007). Owns invariants: plan-before-fill, revisions append-only & dated, recordFill-on-Closed rejects, appendRevision-on-Closed rejects. Owns lifecycle transitions (first fill → Open; flat → Closed + snapshot). Returns a Trade as a cohesive bundle (trade + plan + all revisions + all fills). Carries three store-owned fields calc ignores: `strategy` (Reporting filter), `closedAt` (snapshot-regen asOf, OQ 11), `fillId` (correction + fill-level journal). Stores NO live P&L, position size, or risk — all derived (closed trades cache their final figures). Drilled down — see [design doc](trading-record-store.md). |
| 2 | **ReflectionStore** | store | 12 | Reflection + its self-describing form: Journal Entry (content, timestamp, 3-level attachment discriminator Trade/Fill/Market per ADR 0004, parent ref, optional market-entry↔trade links) + the Journal Placeholder (an entry in `'placeholder'` state — the owed-reflection mechanism; Required auto-created at plan-commit + close, Optional offered per fill) + Entry Schema definitions (versioned, immutable, forward-only, referenced by `schemaId` — ADR 0003 by reference, not embedded by value). Twelve ops: seven entry ops (`createPlaceholder`, `createEntry`, `completePlaceholder`, `getEntry`, `listEntries`, `setMarketLinks`, `importEntry`) + five schema ops (`saveSchema`, `getSchema`, `getSchemaVersion`, `listSchemas`, `importSchema`). Candidate B write model: a placeholder IS an entry in `'placeholder'` state; `completePlaceholder` transitions the same record to `'complete'`. "What's owed" is a filter on a stored fact (`listEntries({ state:'placeholder' })`), NOT a derivation from lifecycle ∩ entries — OQ 5 dissolved. Journal-writing is a direct store call, not a coordinator (OQ 6 dissolved — convention C6 removes the only cross-store act). `schemaId` absent on placeholders, pinned at completion (audit finding). Drilled down — see [design doc](reflection-store.md). |
| 3 | **PriceMarkStore** | store | 5 | End-of-day Price Mark, keyed (instrument, date), shared/deduplicated across Trades (ADR 0002). Pure fact — no P&L, no risk, no derivation beyond assembling the `Marks` map calc consumes. Five ops: `upsertMark` (trader force-write; pushes prior to append-only `history`), `backfillMark` (automated write-if-absent — the no-op-on-present IS the set-once protection), `buildMarksFromFills` (the deep read → scalar `Marks` for calc, omitting instruments lacking a mark), `getMarkSeries` (chart price-axis + quality-analytic read, full records incl. provenance), `importMark` (verbatim restore preserving source + history). Carries `source: ProviderId` ('trader' or a provider id) and append-only `history` per mark — provenance for display, provider switching (forward-only retained), and source-quality analytics. The set-once override model: two write ops encode two rights (trader force / automated gentle) structurally, not by fetcher discipline. Drilled down — see [design doc](price-mark-store.md). |
| 4 | **AccountStore** | store | ~3 | Account facts (broker, account identity). Slow-changing reference, referenced by ID from Trade. |
| 5 | **TaxonomyStore** | store | ~4 | Forward-only categorical value sets (strategy, setup, etc.); retired values retained so existing records keep their tag. Trader-customizable. |
| — | **PriceProviderStore** | store | ~3 | Market-data provider configuration: which providers exist, which is active, credentials. Forward-only retained (retired provider ids stay valid on historical PriceMarks). The registry `source: ProviderId` on a PriceMark references — exactly as `strategy: StrategyId` on a Trade references TaxonomyStore. A partition addition surfaced by the PriceMarkStore drill-down (provenance vs. configuration split). To be drilled down in the step-5 reference-session cluster alongside AccountStore + TaxonomyStore. |
| 6 | **CalculationModule** | pure | 2 | Single-trade derivation: `evaluate(record, marks, asOf) → FigureSet` (the full figure-set behind one call — P&L, position size, three risk quantities, reward, R:R, R-multiple, lifecycle echo, revision count) and `isFlat(fills)` (the cheap transition detector). Its **parameter and return types are the data contract** every store must serve. Drilled down first — see [design doc](calculation-module.md). |
| 7 | **PerformanceAnalytics** | pure | ~3 | Portfolio-level aggregation over lists of per-trade results: R-multiple distribution, equity curve by R, aggregate plan-revision-rate, P&L summaries. Pure functions over lists. |
| 8 | **PlanCommitCoordinator** | coordinator | 1 | plan-commit workflow: validates planned R:R via CalculationModule, commits Trade+Plan to TradingRecordStore, creates the required pre-entry reflection placeholder in ReflectionStore. Joins TradingRecord + Reflection + calc. |
| 9 | **FillEntryCoordinator** | coordinator | 1 | fill-entry workflow: appends Fill to TradingRecordStore, runs flat detection via calc; transitions status if needed (first fill → Open; flat → Closed + finalFigures snapshot per ADR 0007); on close, creates the required post-close placeholder; offers the optional fill-level placeholder (now/later/none). Folds trade-close in. Joins TradingRecord + Reflection + calc. |
| 10 | **DailyReviewCoordinator** | coordinator | 1 | daily-review workflow: pulls open Trades (cheap indexed filter on stored status), resolves underlyings lacking a mark for the date, computes live risk/P&L via calc, surfaces placeholders due and in-range market entries. The widest join. |
| 11 | **PerformanceReportingCoordinator** | coordinator | 1 | aggregate stats over Trades (via PerformanceAnalytics), filterable by date/strategy/status/underlying/account. Joins TradingRecord + Reference (Account/Taxonomy) + PerformanceAnalytics. |
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
  status: 'Planned'|'Open'|'Closed',
  closedAt?,                           // STORE-OWNED (OQ 11) — present iff Closed; snapshot-regen asOf. Calc ignores.
  plan: { entry, stop, target, thesis, invalidation, entryEmotion, committedAt },
  revisions: PlanRevision[],          // append-only, dated (ADR 0001)
  fills: Fill[],                       // each carries fillId + instrument-type per leg (ADR 0005)
  finalFigures?: FigureSet,            // present iff Closed (ADR 0007)
}
type Marks = Map<InstrumentId, Price>  // plain data, not a function (OQ 1 → B)

// Two operations. evaluate returns the full figure-set behind one call.
evaluate(record: TradeRecord, marks: Marks, asOf: Date): FigureSet
isFlat(fills: Fill[]): boolean         // cheap transition detector (ADR 0006)

type FigureSet = {
  pnl:        { realized: number, unrealized: number | null },  // null if no mark
  positionSize: number,                // signed net from fills
  risk: {
    planned:  Dual,                    // frozen at initial Plan (ADR 0005)
    current:  Dual | null,             // live; null if no mark or Planned
    maximum:  MaxRisk | null,          // instrument-type-aware; null for Planned
  },
  reward: {
    planned:    Dual,
    incremental: Dual | null,          // live; null if no mark
  },
  rr: { planned: number, current: number | null },
  rMultiple: number,                   // realized ÷ planned-risk dollars (R units)
  lifecycle: 'Planned'|'Open'|'Closed',// echoed from record.status (ADR 0006)
  revisionCount: number,               // raw count; rate is PerformanceAnalytics
}
type Dual = { ratio: number, dollars: number }                      // dual presentation rule
type MaxRisk = { bounded: true, amount: Dual } | { bounded: false } // OQ 2 → A
```

### PerformanceAnalytics (pure)

```ts
aggregate(
  results: FigureSet[],                 // one per closed Trade in scope
  filters: { dateRange?, strategy?, status?, underlying?, account? },
): PortfolioReport
```

### Coordinators

```ts
// PlanCommitCoordinator
commitPlan(input: PlanInput): { tradeId }

// FillEntryCoordinator
recordFill(tradeId: TradeId, fill: FillInput): {
  statusAfter: 'Planned'|'Open'|'Closed',
  placeholdersOffered: PlaceholderPrompt[],   // now/later/none prompts
}

// DailyReviewCoordinator
runDailyReview(asOf: Date): DailyReviewView   // open trades, marks due, placeholders, observations

// PerformanceReportingCoordinator
runReport(filters: ReportFilters): PortfolioReport
```

---

## Who-calls-whom matrix

Caller (rows) → callee (columns). Stores never call each other. Pure modules
call nothing. Coordinators call stores + pure modules.

| | TradingRecord | Reflection | PriceMark | PriceProvider | Account | Taxonomy | Calc | PerfAnalytics |
|---|---|---|---|---|---|---|---|---|
| **PlanCommitCoordinator** | write (`commit`) | write (`createPlaceholder` — pre-entry, required) | — | — | — | — | validate R:R | — |
| **FillEntryCoordinator** | write (`recordFill` — absorbs fill+status+snapshot; `correctFill`) | write (`createPlaceholder` — post-close required + optional fill-level; drives now/later/none) | read (`buildMarksFromFills`, at close) | — | — | — | isFlat, evaluate | — |
| **DailyReviewCoordinator** | read (`listTrades({status:'Open'})`) | read (`listEntries` — owed placeholders + linked market entries) | read/write (`upsertMark`, `buildMarksFromFills`) | — | — | — | evaluate | — |
| **market-data fetcher (roadmap)** | — | — | read (`getMarkSeries`) / write (`backfillMark`) | read (active provider) | — | — | — | — |
| **PerformanceReportingCoordinator** | read (`listTrades(filters)`, `getTradeRecord`) | — | — | — | read (group) | read (group) | — | aggregate |
| **direct read callers (UI, backup)** | `getTradeRecord`, `listTrades` | `getEntry`, `listEntries`, `getSchema`, `listSchemas` | `getMarkSeries` | `listProviders` | listAccounts | getTaxonomy | evaluate | — |
| **restore tool (import path)** | `importTrade` (per historical trade, derive-on-import) | `importSchema` then `importEntry` (verbatim, two-phase) | `importMark` (verbatim, source+history intact) | (TBD) | (TBD) | (TBD) | — | — |

**Direct writes that need no coordinator** (rule 8):

- **PlanRevision** → TradingRecordStore only (`appendRevision`). Not a
  coordinator.
- **Fill correction** → TradingRecordStore only (`correctFill` — invalidates the
  snapshot, signals possible status invalidity). Single-store; the *response* to
  the signal (snapshot regen, possible re-open) is FillEntryCoordinator's (OQ 12).
- **JournalWriting** → ReflectionStore only (`createEntry` / `completePlaceholder`,
  optional market-link via `setMarketLinks`). **Not a coordinator** (OQ 6 resolved):
  convention C6 (no cross-store referential validation) removed its only cross-store
  act (validating a parent ref exists), so it touches one store → rule 8 applies.
  Journal-writing joins PlanRevision as the canonical zero-coordinator single-store
  workflows. Schema definition (`saveSchema`) is likewise a direct store call.
- **PriceMark entry during Daily Review** → handled inside DailyReviewCoordinator
  (it owns the mark-collecting step: resolve missing underlyings → `upsertMark`
  each → `buildMarksFromFills` per trade).
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
trader → PlanCommitCoordinator.commitPlan(planInput)
  → CalculationModule.evaluate(recordSketch)   // validate planned R:R is sane
  → TradingRecordStore.commit(planInput)        // write Trade (status=Planned) + Plan
  → ReflectionStore.createPlaceholder({         // the required pre-entry bookend
      level:'trade', type:'pre-entry', tradeId, required:true, createdAt:now
    })
← { tradeId }
```

Trade is now `Planned`, no fills yet, a required pre-entry reflection placeholder
is owed.

### 2. Fill-entry (record a fill; includes trade-close as a sub-case)

```
trader → FillEntryCoordinator.recordFill(tradeId, fillInput)
  → existing = TradingRecordStore.getTradeRecord(tradeId)        // load current fills
  → simFills = [...existing.fills, fillInput]                    // simulate post-fill
  → CalculationModule.isFlat(simFills)                           // cheap, once, for this one trade (ADR 0006)
  → branch on result:
      not flat           → TradingRecordStore.recordFill(tradeId, fill)            // first fill → Open internally
      newly flat         → marks = PriceMarkStore.buildMarksFromFills(simFills, now)
                            → figures = CalculationModule.evaluate({...existing, fills:simFills}, marks, now)
                            → TradingRecordStore.recordFill(tradeId, fill, figures)  // ONE call: append + transition
                            │                                                         //   to Closed + closedAt + snapshot
                            │                                                         //   (defensively asserts net-zero)
                            → ReflectionStore.createPlaceholder({                    // required post-close bookend
                                  level:'trade', type:'post-close', tradeId, required:true, createdAt:now
                                })
  → ReflectionStore.createPlaceholder({                              // optional fill-level, now/later/none
        level:'fill', type:'fill', tradeId, fillId, required:false    // 'none' = never created (coordinator-side)
      })
← { statusAfter, placeholdersOffered }
```

The split pays off here: N−1 fills do the cheap `isFlat` only; the one
flat-detecting fill pays the single `evaluate` to build the snapshot. The
flat-detecting fill closes the trade, snapshots its final figures (ADR 0007),
and owes the post-trade review placeholder — all in one workflow. Note the close
path is now a **single** `recordFill(tradeId, fill, closeFigures)` call — the
store absorbs append + status transition + `closedAt` + snapshot atomically.
There is no separate `setStatus` or `storeFinalFigures`; the only status-mutating
op is `recordFill`, which keeps the lifecycle invariant structurally unbreakable
(see [TradingRecordStore design doc](trading-record-store.md), decided semantics 2).

### 3. Daily review

```
trader → DailyReviewCoordinator.runDailyReview(today)
  → openTrades = TradingRecordStore.listTrades({ status: 'Open' })  // cheap indexed filter on stored status (ADR 0006)
  → underlyings = distinct instruments across openTrades' fills
  → for each instrument lacking a mark for `today`:
      → prompt trader → PriceMarkStore.upsertMark(instrument, today, price, now)   // deduped, ADR 0002
  → for each open trade:
      → marks = PriceMarkStore.buildMarksFromFills(record.fills, today)   // distinct instruments → scalar map
      → CalculationModule.evaluate(trade, marks, today)   // live figures; marks fresh
      → ReflectionStore.listEntries({ tradeId, state:'placeholder' })     // owed (OQ 5: a filter, not a derivation)
      → ReflectionStore.listEntries({ linkedToTrade:tradeId, level:'market' })  // market context
      ← assembled DailyReviewView (open trades + live P&L/risk + placeholders + market entries, interleaved by time)
trader records observations → ReflectionStore.createEntry(...)   // optional, journal-writing path (direct store call, OQ 6)
```

### 4. Performance reporting

```
trader → PerformanceReportingCoordinator.runReport(filters)
  → TradingRecordStore.listTrades(filters)      // by date/strategy/status/underlying/account
  → for each closed trade: read finalFigures snapshot (ADR 0007) — NO recomputation
  → for each open trade (if in scope): CalculationModule.evaluate(...) for live figures
  → PerformanceAnalytics.aggregate(allFigures, filters)
  ← PortfolioReport (R-multiple distribution, equity-by-R, revision-rate, P&L summary)
```

Closed trades are O(1) reads from their snapshot; only open trades in scope
incur live computation.

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
   stores, mostly trivial after the above; can be a combined session.
   PriceProviderStore (provider config: list/activate/configure) was added by the
   PriceMarkStore drill-down and joins this cluster.
6. **PerformanceAnalytics** — second pure module; depends on the FigureSet type
   from step 1.
7. **The four coordinators** — last, each thin; their dependencies are fully
   pinned by then. FillEntry owns OQ 7.

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
| 7 | Trade-close: folded into FillEntryCoordinator or split? | FillEntryCoordinator |
| 8 | Backup/export/import: storage-seam fan-out or lifecycle coordinator? **(Partially served)** — TradingRecordStore now exposes `importTrade` for the restore path (verbatim record, derive-on-import). The *broader* backup architecture (storage-seam fan-out vs. coordinator) remains open. | overview / lifecycle |
| 9 | Multi-fact write atomicity (commitPlan spans TradingRecord+Reflection): transaction story? | overview / StorageBinding |
| 10 | ~~Entry Schema definitions: ReflectionStore (snapshot locality) vs ReferenceStore (customization symmetry)?~~ **RESOLVED** → ReflectionStore (Option A). The versioned schema registry is structurally a reference collection, but the PriceProviderStore split criterion (separate consumer + separate domain) is not met: entry schemas have one consumer (the journal) in one domain. ADR 0003 by reference (versioned `schemaId`, not embedded snapshot). | ReflectionStore ✓ |
| 11 | ~~**(exported from CalculationModule)** Snapshot `asOf`: regenerating a corrected closed-trade snapshot needs the original close date, but `TradeRecord` carries no `closedAt` and `evaluate` only takes `asOf`. Record needs a `closedAt` field, or `finalFigures` must carry its own `asOf`.~~ **RESOLVED** → `closedAt?: Date` on TradeRecord, present iff Closed, stored at transition time. Regeneration passes `record.closedAt` as `asOf`. | TradingRecordStore ✓ |
| 12 | **(exported from CalculationModule)** Status-invalidating correction: a fill correction could change net position from zero to non-zero (Closed → should-be-Open). `isFlat` detects the forward transition; the backward path is unwritten. ADR 0006 requires stored status agree with derived status. **(Updated)** — TradingRecordStore's `correctFill` returns `statusPossiblyInvalid` as a signal but does not re-open (rejects `recordFill` on Closed); the re-open decision is still FillEntryCoordinator's. A snapshot write-back op (`replaceSnapshot` or a widened `correctFill`) is owed to that session. | FillEntryCoordinator |
| 13 | **(exported from TradingRecordStore)** Snapshot write-back after regeneration. `correctFill` nulls the snapshot; the regen sequence recomputes one, but no op writes it back onto an already-Closed trade (`recordFill` on Closed rejects). Provisional shape: `replaceSnapshot(tradeId, figures)` or widening `correctFill` to accept a recomputed snapshot. | FillEntryCoordinator (decision) → TradingRecordStore (op) |
| 14 | **(exported from PriceMarkStore)** Mark correction invalidating a closed-trade snapshot. A mark correction changes the unrealized-P&L a closed trade's snapshot was computed against (ADR 0007), but PriceMarkStore has no back-reference to consuming trades (marks are shared, ADR 0002) and must not call across stores (rule 1). ADR 0007 currently scopes invalidation to fill corrections + calc fixes; whether *mark* corrections join is open. Detection (which closed trades used the old mark?) and response (regenerate via `record.closedAt` as `asOf`) belong to the snapshot-regeneration owner. | FillEntryCoordinator / TradingRecordStore (OQ 12 owner) |

---

## Releases implement subsets, not reshapes

The MVP (manual price entry, stock-only trades) is a **subset of operations on
these same shapes**, not a different architecture. Concretely:

- **Stock-only MVP**: TradingRecordStore fills carry instrument-type='stock'
  only; CalculationModule's maximum-risk branch exercises only the stock case;
  the option/short/spread branches exist but aren't reached. No module is added,
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
  Rejected because aggregation is pure (functions over lists of FigureSets) and
  burying it in the coordinator hides testable logic behind a workflow module.
  Lifted into a second pure module, PerformanceAnalytics.

- **Lifecycle status derived-only** (the initial Candidate C load-bearing
  decision). Rejected in ADR 0006 after feedback that deriving on read makes the
  Daily Review's open-Trades query O(all-trades) and growing forever. Status is
  now stored authoritatively; `flat` is computed once at fill-record time.

- **Closed-trade figures recomputed on every read** (the default under "facts
  only"). Rejected in ADR 0007 after the same scaling argument applied to
  figures: closed trades have frozen inputs, so caching their figure-set once at
  close avoids O(N)-growing recomputation in reporting. The cache is
  regeneratable; the honest price is a regeneration migration on calc-bug-fix.
