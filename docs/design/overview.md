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

Eleven domain modules plus StorageBinding (the persistence seam, not a domain
module).

| # | Module | Kind | Est. methods | Responsibilities |
|---|---|---|---|---|
| 1 | **TradingRecordStore** | store | ~7 | The trading record itself: Trade identity + lifecycle status (Planned/Open/Closed, stored per ADR 0006) + optional finalFigures snapshot (per ADR 0007) + Plan (original levels, thesis, invalidation, entry emotion) + PlanRevision (append-only dated deltas, ADR 0001) + Fill (instrument, side, qty, price, time, instrument-type per leg, underlying). Owns invariants: plan-before-fill, revisions append-only & dated. Owns lifecycle transitions (first fill → Open; flat → Closed + snapshot). Returns a Trade as a cohesive bundle (trade + plan + all revisions + all fills). Stores NO live P&L, position size, or risk — all derived (closed trades cache their final figures). |
| 2 | **ReflectionStore** | store | ~8 | Reflection + its self-describing form: Journal Entry (content, timestamp, 3-level attachment discriminator Trade/Fill/Market per ADR 0004, parent ref, optional market-entry↔trade links) + Entry Schema definitions (live templates, forward-only) + the schema snapshot embedded per entry (ADR 0003). Stores NO "placeholder due" — derived from lifecycle ∩ existing entries. |
| 3 | **PriceMarkStore** | store | ~4 | End-of-day Price Mark, keyed (instrument, date), shared/deduplicated across Trades (ADR 0002). Pure fact. The clean seam for the deferred market-data API (manual now → API default later). Serves the chart's underlying-price axis and unrealized-P&L marking. |
| 4 | **AccountStore** | store | ~3 | Account facts (broker, account identity). Slow-changing reference, referenced by ID from Trade. |
| 5 | **TaxonomyStore** | store | ~4 | Forward-only categorical value sets (strategy, setup, etc.); retired values retained so existing records keep their tag. Trader-customizable. |
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
  tradeId, accountId, underlying, status: 'Planned'|'Open'|'Closed',
  plan: { entry, stop, target, thesis, invalidation, entryEmotion, committedAt },
  revisions: PlanRevision[],          // append-only, dated (ADR 0001)
  fills: Fill[],                       // each carries instrument-type per leg (ADR 0005)
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

| | TradingRecord | Reflection | PriceMark | Account | Taxonomy | Calc | PerfAnalytics |
|---|---|---|---|---|---|---|---|
| **PlanCommitCoordinator** | write | write (placeholder) | — | — | — | validate R:R | — |
| **FillEntryCoordinator** | write (fill, status, finalFigures) | write (placeholders) | read (buildMarksFromFills, at close) | — | — | isFlat, evaluate | — |
| **DailyReviewCoordinator** | read (open trades) | read (placeholders, market entries) | read/write (marks, buildMarksFromFills) | — | — | evaluate | — |
| **PerformanceReportingCoordinator** | read (list/get) | — | — | read (group) | read (group) | — | aggregate |
| **direct read callers (UI, backup)** | getTradeRecord, listTradeIds | getEntry, listEntries | getMarkSeries | listAccounts | getTaxonomy | evaluate | — |

**Direct writes that need no coordinator** (rule 8):

- **PlanRevision** → TradingRecordStore only (append a dated revision). Not a
  coordinator.
- **JournalWriting** → ReflectionStore only (create entry, embed snapshot,
  optional market-link). Borderline — its only cross-store act is validating a
  parent ref exists; flagged as the coordinator-that-might-not-be in open
  question 6.
- **PriceMark entry during Daily Review** → handled inside DailyReviewCoordinator
  (it owns the mark-collecting step).

**Backup/export/import** fans out across all five stores at the StorageBinding
seam — it serializes a consistent snapshot of all facts. Whether it's a storage-
seam fan-out or a thin lifecycle coordinator is open question 8.

---

## Main-flow walkthroughs

### 1. Plan-commit (start a Trade)

```
trader → PlanCommitCoordinator.commitPlan(planInput)
  → CalculationModule.evaluate(recordSketch)   // validate planned R:R is sane
  → TradingRecordStore.commit(planInput)        // write Trade (status=Planned) + Plan
  → ReflectionStore.createPlaceholder(tradeId, type='pre-entry', required=true)
← { tradeId }
```

Trade is now `Planned`, no fills yet, a required pre-entry reflection placeholder
is owed.

### 2. Fill-entry (record a fill; includes trade-close as a sub-case)

```
trader → FillEntryCoordinator.recordFill(tradeId, fillInput)
  → TradingRecordStore.appendFill(tradeId, fill)
  → CalculationModule.isFlat(trade's fills)     // cheap, once, for this one trade (ADR 0006)
  → branch on result:
      first fill ever      → TradingRecordStore.setStatus(tradeId, 'Open')
      newly flat           → marks = PriceMarkStore.buildMarksFromFills(fills, now)
                             → figures = CalculationModule.evaluate(record, marks, now)
                             → TradingRecordStore.setStatus(tradeId, 'Closed')
                             → TradingRecordStore.storeFinalFigures(tradeId, figures)   // ADR 0007
                             → ReflectionStore.createPlaceholder(tradeId, type='post-close', required=true)
      otherwise            → (no status change)
  → ReflectionStore.offerPlaceholder(fillId, type='fill', required=false)  // now/later/none
← { statusAfter, placeholdersOffered }
```

The split pays off here: N−1 fills do the cheap `isFlat` only; the one
flat-detecting fill pays the single `evaluate` to build the snapshot. The
flat-detecting fill closes the trade, snapshots its final figures (ADR 0007),
and owes the post-trade review placeholder — all in one workflow.

### 3. Daily review

```
trader → DailyReviewCoordinator.runDailyReview(today)
  → TradingRecordStore.listOpenTrades()         // cheap indexed filter on stored status (ADR 0006)
  → for each open trade:
      resolve underlyings lacking a PriceMark for `today`
      → prompt trader for marks → PriceMarkStore.upsertMark(instrument, today, price)   // deduped, ADR 0002
      → marks = PriceMarkStore.buildMarksFromFills(record.fills, today)
      → CalculationModule.evaluate(trade, marks, today)   // live figures; marks fresh
      → ReflectionStore.listPlaceholdersDue(tradeId, inRange)
      → ReflectionStore.listMarketEntriesLinkedTo(tradeId, inRange)
      ← assembled DailyReviewView (open trades + live P&L/risk + placeholders + market entries, interleaved by time)
trader records observations → ReflectionStore.createEntry(...)   // optional, journal-writing path
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
2. **TradingRecordStore** — second. Its `getTradeRecord` must return exactly
   what Calc established; resolves OQ 4 (and OQ 11, the `closedAt` field
   exported from CalculationModule). The deepest, most-touched store; owns
   status transitions and the finalFigures snapshot.
3. **PriceMarkStore** — third. Small; serves the `Marks` contract and owns the
   exported `buildMarksFromFills` op (OQ 1 downstream); answers the API-seam
   shape.
4. **ReflectionStore** — fourth. Pins placeholders derivation (OQ 5),
   journal-writing (OQ 6), and schema-location (OQ 10).
5. **AccountStore** + **TaxonomyStore** — quick, mostly trivial after the above;
   can be a combined session.
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
| 1 | ~~MarkResolver shape: function `(instrument,date)→price`, pre-materialized map, or coordinator pre-fetch?~~ **RESOLVED** → `Marks: Map<InstrumentId, Price>` (plain data, caller-built). Also exported a deep `buildMarksFromFills(fills, date)` op to PriceMarkStore. | CalculationModule ✓ |
| 2 | ~~"Unbounded" maximum-risk return shape (sentinel / union / `isBounded` flag)~~ **RESOLVED** → discriminated union `{bounded:true, amount} \| {bounded:false}`. | CalculationModule ✓ |
| 3 | ~~Dual-presentation (ratio+dollars): returned by calc or computed in a presentation layer?~~ **RESOLVED** → calc returns `Dual` everywhere (the rule is domain-level, not UI). | CalculationModule ✓ |
| 4 | Legs / instrument-type: per-Fill vs a derived leg view? | TradingRecordStore |
| 5 | Placeholders: derived how exactly (lifecycle ∩ existing entries)? | ReflectionStore (+ FillEntryCoordinator for when owed) |
| 6 | JournalWriting: separate coordinator or in-store parent-ref check? | ReflectionStore |
| 7 | Trade-close: folded into FillEntryCoordinator or split? | FillEntryCoordinator |
| 8 | Backup/export/import: storage-seam fan-out or lifecycle coordinator? | overview / lifecycle |
| 9 | Multi-fact write atomicity (commitPlan spans TradingRecord+Reflection): transaction story? | overview / StorageBinding |
| 10 | Entry Schema definitions: ReflectionStore (snapshot locality) vs ReferenceStore (customization symmetry)? | ReflectionStore |
| 11 | **(exported from CalculationModule)** Snapshot `asOf`: regenerating a corrected closed-trade snapshot needs the original close date, but `TradeRecord` carries no `closedAt` and `evaluate` only takes `asOf`. Record needs a `closedAt` field, or `finalFigures` must carry its own `asOf`. | TradingRecordStore |
| 12 | **(exported from CalculationModule)** Status-invalidating correction: a fill correction could change net position from zero to non-zero (Closed → should-be-Open). `isFlat` detects the forward transition; the backward path is unwritten. ADR 0006 requires stored status agree with derived status. | FillEntryCoordinator |

---

## Releases implement subsets, not reshapes

The MVP (manual price entry, stock-only trades) is a **subset of operations on
these same shapes**, not a different architecture. Concretely:

- **Stock-only MVP**: TradingRecordStore fills carry instrument-type='stock'
  only; CalculationModule's maximum-risk branch exercises only the stock case;
  the option/short/spread branches exist but aren't reached. No module is added,
  removed, or reshaped.
- **Manual price entry**: PriceMarkStore is populated by Daily Review entry
  rather than the API. The API adapter (a third StorageBinding-side concern, or
  a fetcher that writes marks) arrives later without changing the store's
  interface.
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
