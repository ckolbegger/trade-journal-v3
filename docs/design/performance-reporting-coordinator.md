# PerformanceReportingCoordinator — initial interface design

The read-only **reporting assembly** — the "how am I doing over time" view
(CONTEXT.md: Performance Reporting). Two operations share one request type:
`runOutcomeReport` joins TradingRecordStore (filtered closed reads) with
PerformanceAnalytics' mark-free fold (plus PriceMarkStore + calc for cold
snapshots); `runExposureReport` joins TradingRecordStore (filtered open
reads) with PriceMarkStore (marks) and calc's `evaluateMany` (ADR 0008).
Both resolve grouping labels via the reference stores. Owns **no writes** —
the second read-only coordinator, after DailyReview. Deliberately owns **no
figure arithmetic** (rule 2 — the pure modules'), **no temporal series**
(mark-dependent compositions over `evaluate`, owned by the consumer holding
the marks), and **no per-trade open detail** (DailyReview's charter).

The last of the four coordinators. Every dependency was pinned before this
session: `TradeFilters` and the snapshot contract by TradingRecordStore,
`PortfolioReport` by PerformanceAnalytics, `ExposureReport` by
CalculationModule (ADR 0008), label sources by the reference stores. This
session's genuine decisions were two, both owner-made: the **op shape**
(two operations sharing one input type — one per question the screen asks)
and **OQ 15** (the per-day revision rate: deferred, with the pooled-rate
analysis parked for the inheriting session). Both recorded below with their
alternatives.

```ts
// caller's-eye — "How did Q3 go on this account — and by strategy?"
const q3 = {
  filters: { accountId: 'ib-401', closedFrom: q3Start, closedTo: q3End },
  groupBy: 'strategy',
  asOf:    today,
}
const outcome = reporting.runOutcomeReport(q3)
outcome.portfolio.expectancy                    // +0.5R — headline tiles
outcome.groups.map(g => [g.label, g.portfolio.totalRealized])

// "And the open book on this account right now?" — same request shape
const exposure = reporting.runExposureReport({ filters: { accountId: 'ib-401' }, asOf: today })
exposure.report.totalUnrealized                // { dollars, missingMarkCount }
```

---

## Interface

### Operations

```ts
/** The closed-trade question: how do my completed trades distribute?
 *  Read-only: one filtered closed read, cold-snapshot computation where a
 *  snapshot is null, one mark-free fold per scope (+ per group). */
runOutcomeReport(request: ReportRequest): OutcomeReportView

/** The open-book question: what does my current exposure look like?
 *  Read-only: one filtered open read, one marks build, one mark-dependent
 *  fold per scope (+ per group). asOf is the lens. */
runExposureReport(request: ReportRequest): ExposureReportView
```

### Input type — ReportRequest (shared by both operations)

```ts
/** ONE request type, by owner decision — both ops take it verbatim, so a
 *  composite screen builds one request object and passes it twice. filters
 *  pass through to TradingRecordStore.listTrades VERBATIM — TradeFilters is
 *  the store's type, not a reporting copy (semantic 2). groupBy adds the
 *  grouping dimension (CONTEXT.md names strategy + underlying grouping;
 *  accountId rides along because TradeFilters already carries it). asOf is
 *  the exposure lens, caller-provided like every timestamp in the system
 *  (semantic 8 — runOutcomeReport ignores it). */
type ReportRequest = {
  filters?: TradeFilters        // status/strategy/accountId/underlying/opened*/closed*
  groupBy?: GroupDimension      // omit → the view's groups absent
  asOf:     Date                // REQUIRED — the coordinator is not a clock (semantic 8)
}

type GroupDimension = 'strategy' | 'underlying' | 'accountId'
```

### Output types

```ts
/** The finished outcome item — the closed-trade report. */
type OutcomeReportView = {
  portfolio: PortfolioReport     // PerformanceAnalytics.aggregate, verbatim —
                                 //   equity curve in the closedAt order fed in (semantic 4)
  trades:    ClosedTradeSummary[] // chart-drill-down rows, closedAt-ascending (semantic 12)
  groups?:   OutcomeGroup[]      // present iff groupBy requested; ordered by label ascending (semantic 5)
}

/** The finished exposure item — the open-book report. */
type ExposureReportView = {
  report: ExposureReport         // calc.evaluateMany, verbatim (ADR 0008) — aggregate only;
                                 //   per-trade open detail is DailyReview's (semantic 9)
  asOf:   Date                   // echoed — the lens actually used
  groups?: ExposureGroup[]       // present iff groupBy requested; same ordering as OutcomeGroup —
                                 //   the shared rule is what lets the UI align the two lists (semantic 5)
}

/** One per distinct group key in the op's own scope — a group with only
 *  closed trades appears in the outcome list only (and vice versa). */
type OutcomeGroup = {
  key:       StrategyId | InstrumentId | AccountId
  label:     string             // resolved (semantic 5): taxonomy value label incl. retired /
                                //   account name / instrument id; raw key on a resolution miss
  portfolio: PortfolioReport    // the group's closed set — zero report when empty
  trades:    ClosedTradeSummary[]
}

type ExposureGroup = {
  key:    StrategyId | InstrumentId | AccountId
  label:  string                // same resolution + ordering rule as OutcomeGroup
  report: ExposureReport        // the group's open set — zero report when empty
}

/** Lightweight rows for chart drill-down (click an equity-curve point / a
 *  distribution bar → which trades). Carries exactly the numbers the charts
 *  plot, in the same order fed to aggregate (semantic 12). */
type ClosedTradeSummary = {
  tradeId:       TradeId
  underlying:    InstrumentId
  strategyId:    StrategyId
  accountId:     AccountId
  closedAt:      Date
  rMultiple:     number       // ← finalFigures (or the cold-snapshot compute, semantic 6)
  realizedPnl:   number       // ← finalFigures.pnl.realized
  revisionCount: number       // ← finalFigures
}
```

`TradeFilters` and `TradeRecord` are defined in
[`trading-record-store.md`](trading-record-store.md); `PortfolioReport` in
[`performance-analytics.md`](performance-analytics.md); `ExposureReport` in
[`calculation-module.md`](calculation-module.md); `Account` /
`TaxonomyValue` in [`reference-stores.md`](reference-stores.md).

---

## Decided semantics

Each ruling cites the principle it derives from. Veto any during review.

1. **Two operations, one shared request type** (owner decision; design-it-twice
   candidate B). `runOutcomeReport` serves the closed-trade question
   (outcome metrics); `runExposureReport` serves the open-book question
   (current exposure) — one op per question, both taking `ReportRequest`
   verbatim. The two questions genuinely differ in inputs (ADR 0007: closed
   trades read frozen snapshots, open trades compute live; ADR 0008: the
   exposure fold needs marks, the outcome fold is mark-free), so they are
   separate calls; the request is shared so a composite screen builds one
   object and passes it twice. Each op conjoins its own status onto the
   filter — `runOutcomeReport` reads
   `listTrades({ ...filters, status:'Closed' })`, `runExposureReport` reads
   `listTrades({ ...filters, status:'Open' })` — status remains a filter, not
   a router argument. Naming is content-named (the ops differ by the question
   served, not by a status value); lifecycle-named alternatives
   (`runClosedReport`/`runOpenReport`) were considered and set aside — veto
   if you prefer them. Honest costs of the shape, accepted by the owner: a
   composite screen makes two calls, and the grouping lists split per op
   (aligned by the shared label ordering — semantic 5). Losing candidates
   (one op computing both sections; one op with a union return) in
   *Alternatives*. *(Owner decision; rule 1 — the UI sees finished items.)*

2. **Filters are `TradeFilters`, passed through verbatim — no reporting copy.**
   One filter vocabulary, evolving in one place. `closedFrom`/`closedTo` in
   effect scope to Closed trades (non-Closed trades carry no `closedAt` — the
   store's key), so a closed-dated `runExposureReport` request honestly
   returns a zero view. One gap exported: the store doc never pins the
   `openedFrom`/`openedTo` filter *key* (first-fill time vs plan
   `committedAt`) — see *Requirements exported*. *(Depth — one type, one
   owner; rule 8 — filtering is a store concern, the join is the
   coordinator's.)*

3. **Zero views, never nulls or throws.** An empty scope produces PA's valid
   zero report (its semantic 7) / a zero `ExposureReport`
   (`positionCount: 0` — calc semantic 25), never a null view — including
   `status:'Planned'`/`'Discarded'` requests, which have no outcomes and no
   positions and therefore zero honestly. The caller never null-checks a
   view. *(PA semantic 7; consumer ergonomics.)*

4. **Outcome reads snapshots; the ordering is owned here.** Closed-in-scope
   records are ordered by `closedAt` ascending *before* `aggregate` (so
   `equityCurveByR` is the chronological journey — PA semantic 4) and the
   same order serves the `trades` rows. `closedAt` is store-owned
   (TradingRecordStore semantic 4); PerformanceAnalytics holds no dates, so
   the ordering decision could live nowhere else. *(ADR 0007; PA semantic 4.)*

5. **Grouping is coordinator-side, one fold per group.** Each op partitions
   its own scope by the dimension key; the outcome folds are cheap mark-free
   calls, the exposure folds share the one marks map. Labels resolve via
   `taxonomy.listValues('strategy', false)` (retired included — historical
   trades carry retired tags) and `accounts.listAccounts()` (active +
   retired, per its semantic 3); `underlying` self-labels (an InstrumentId is
   its own label); a resolution miss (e.g. a restore whose taxonomy slice
   lags) falls back to the raw key. **Both ops order their group lists by
   label ascending** — the shared rule is what lets a composite screen align
   the outcome groups against the exposure groups without a coordinator-side
   join. A group present in one scope only appears in that op's list only.
   Grouping is **single-dimension today**; the wheel's compound view
   (CONTEXT: "a reporting grouping (by symbol + strategy)") extends
   `GroupDimension` to a key list — additive, deferred until the UI names
   the screen (audit finding F1, open items). *(PA semantic 3 — group-by is
   coordinator-side because FigureSet carries no filter dimension;
   CONTEXT.md: strategy "used for filtering and grouping in Performance
   Reporting", the wheel's "reporting grouping (by symbol + strategy)".)*

6. **Cold Closed snapshots are computed in place, never written back**
   (audit finding). A Closed trade can read with `finalFigures: null` — the
   import path blesses it ("lazy population on first read",
   TradingRecordStore semantic 13) and `correctFill` nulls it until
   FillEntryCoordinator's `correctFill` regenerates or the
   `regenerateSnapshots` sweep runs. The store cannot populate it itself (a
   snapshot needs `calc.evaluate` and marks — no calc in stores, stores never
   call each other), and this coordinator does not write (semantic 10). So a
   cold trade's figures are computed read-only, with **exactly
   `regenerateSnapshots`' recipe minus the write-back**:
   `finalFigures ?? calc.evaluate(record, priceMarks.buildMarksFromFills(record.fills, date(closedAt)), closedAt)`.
   Cost is bounded: cold trades only, and any later regeneration warms the
   cache permanently. `aggregate` and the summary rows consume the computed
   figures; nothing is persisted. The compute is **outcome-safe even when the
   close-date mark is missing**: the outcome fields the report consumes
   (`rMultiple`, `pnl.realized`, `revisionCount`) are fills-and-plan-derived —
   mark-free — which is exactly why PerformanceAnalytics is a mark-free fold;
   missing marks null only the current-figure fields this report never reads.
   *(ADR 0007's lazy-populate intent, served read-only; the populate-write
   remains FillEntryCoordinator's.)*

7. **OQ 15 — the per-day revision rate: deferred** (owner decision). The
   view carries no per-day rate; PerformanceAnalytics' `meanRevisions`
   (per-trade) remains the reported discipline signal, per its semantic 9.
   The decision that the inheriting session (reporting-feature design) will
   make is recorded here so it starts from the analysis, not from scratch —
   the pooled rate is `Σ revisionCount ÷ Σ spanDays` over closed-in-scope,
   `spanDays = calendar-day difference date(closedAt) −
   date(plan.committedAt), minimum 0`, `null` iff `Σ spanDays = 0`. Pooled
   (Σ÷Σ), *not* the mean of per-trade rates — same-day trades make per-trade
   rates undefined (÷0), and an unweighted mean answers a different
   question. If adopted, it lands additively on `OutcomeReportView` (and
   `OutcomeGroup`), computed here from record-level dates both sums of which
   the coordinator already holds — the in-hand derivation follows
   DailyReview's `marksDue` precedent, and a calc-side `FigureSet` field is
   the rejected path (see *Alternatives*). Worked example, parked for the
   inheriting session:

   | Trade | committedAt | closedAt | spanDays | revisions |
   |-------|-------------|----------|----------|-----------|
   | A | Mar 1 | Mar 10 | 9 | 1 |
   | B | Mar 2 | Mar 3  | 1 | 0 |
   | C | Feb 20 | Mar 5 | 13 | 2 |
   | D | Mar 4 | Mar 4  | 0 | 0 |
   | E | Mar 5 | Mar 12 | 7 | 1 |

   `4 ÷ 30 ≈ 0.13 revisions/day`; all-same-day scope → `null`. *(ADR 0001's
   named discipline signal, honestly partial; PA semantic 9; OQ 15 ledger
   entry updated in the overview.)*

8. **`asOf` is required — the coordinator is not a clock.** Every timestamp
   in the system is caller-provided (reference stores' rule;
   DailyReviewCoordinator's charter: "no clock"); both ops follow. For
   `runExposureReport`, `asOf` is the lens with exactly DailyReview semantic
   14's tense: membership reads *current* store state (the open-now set),
   marks evaluate as of the passed date; it is echoed on the view. For
   `runOutcomeReport`, `asOf` is **accepted and ignored** — the outcome fold
   is mark-free, and the cold-snapshot compute keys on each trade's own
   `closedAt`, not a passed date. The field stays on the shared request for
   call-site symmetry; splitting the request type would fork the vocabulary
   the owner chose to keep single. *(DailyReview semantic 14;
   caller-provided-timestamps convention; owner's shared-request decision.)*

9. **The exposure view is aggregate-only.** Per-trade open detail (records +
   live figures + `stopsHit`) is DailyReview's charter; the exposure report
   answers "what does the open book look like through this scope" — one
   `evaluateMany` call. No per-position rows here: they would force N
   duplicate `evaluate` calls and a second copy of the open-trade view the
   Daily Review already owns. *(ADR 0008; the coordinators' charter split.)*

10. **Read-only: no writes, no transaction, no StorageBinding** — the second
    read-only coordinator after DailyReview (correcting the overview's "the
    system's only read-only coordinator" claim — ripple applied there).
    There is no reporting-screen write today; if one emerges (e.g. saving a
    report definition) it is a direct store call per rule 8, not a
    coordinator write. *(Rule 8; DailyReview's structural finding.)*

11. **Discarded and Planned trades are not reportable.** Discarded never
    filled (no outcome, terminal); Planned has no position (no exposure).
    They are absorbed by semantic 3's zero-view convention rather than a
    narrowed filter type — `TradeFilters` stays the store's total type and
    reporting stays pass-through. *(Semantic 2 — no filter-type fork.)*

12. **`ClosedTradeSummary` is included — the drill-down rows.** The ordering
    semantic (4) and the snapshot reads (6) already live here; making the UI
    re-derive them via direct `listTrades` would duplicate both, including
    the cold-snapshot branch. The rows are deliberately lightweight:
    identity plus the three numbers the charts plot. *(Consumer ergonomics;
    depth — one read serves tiles, charts, and drill-down. Veto if the UI
    session would rather own the rows.)*

---

## Sequence: outcome report (a closed-only scope, one cold snapshot)

```
trader → PerformanceReportingCoordinator.runOutcomeReport({
            filters: { accountId:'ib-401', closedFrom: q3Start, closedTo: q3End },
            groupBy: 'strategy', asOf: today })          // asOf ignored (semantic 8)
  → closed = TradingRecordStore.listTrades({ accountId, closedFrom, closedTo, status:'Closed' })
  │        // closedAt-range filters de facto scope to Closed (semantic 2)
  → closed.sort(by closedAt ascending)                                   // semantic 4
  → figures = closed.map(r => r.finalFigures
  │                        ?? calc.evaluate(r,                          // cold snapshot —
  │                             priceMarkStore.buildMarksFromFills(      //   regenerateSnapshots'
  │                                 r.fills, date(r.closedAt)),          //   recipe, no write-back
  │                             r.closedAt))                             //   (semantic 6)
  → portfolio = PerformanceAnalytics.aggregate(figures)                  // the mark-free fold
  → trades = closed.map(summaryRow)                                      // semantic 12
  → labels = TaxonomyStore.listValues('strategy', false)                 // retired included
  → groups = partition(closed, by strategy) → per-group aggregate + rows // label-ascending
  ← OutcomeReportView { portfolio, trades, groups }
```

## Sequence: the open-book exposure report

```
trader → runExposureReport({ filters: { accountId:'ib-401' }, asOf: today })
  → open = TradingRecordStore.listTrades({ accountId:'ib-401', status:'Open' })
  → marks = PriceMarkStore.buildMarksFromFills(open.flatMap(r => r.fills), today)   // ONE map
  → report = calc.evaluateMany(open, marks, today)          // ADR 0008 — null-mark handling is calc's
  → groups = partition(open, by dimension) → per-group evaluateMany  // same marks map
  ← ExposureReportView { report, asOf: today, groups? }
```

## Sequence: the composite screen (both ops, one request)

```
trader → UI builds ONE request and passes it twice (semantic 1):
            req = { filters: { accountId:'ib-401' }, groupBy:'strategy', asOf: today }
  → outcome  = runOutcomeReport(req)     // closed read + aggregate + outcome groups
  → exposure = runExposureReport(req)    // open read + marks + evaluateMany + exposure groups
  → UI aligns outcome.groups ↔ exposure.groups by label — both lists use the
    same label-ascending ordering (semantic 5); a strategy in one scope only
    appears in that op's list only (honest, not a gap)
  ← the screen: outcome tiles + charts on one side, exposure tiles on the other
```

`listValues` and `listAccounts` are read once per report, not per group —
the coordinator resolves the whole label map in hand before folding.

---

## Audit findings (sequence-diagram audit)

The three sequences above are the instrument (ASCII, matching house style —
the arrows were checked against real ops and pinned types, the instructive
variants drawn, not the happy path). Yield test applied to the high-yield
flow types: **cold start** (empty store → valid zero views; PA semantic 7 +
semantic 3 absorb it, nothing unwritten), **gap/late** (marks missing at
`asOf` → `missingMarkCount`; past-date lens → semantic 8) — no findings.
Three findings did surface:

### Finding 1 — compound grouping (the wheel) unwritten

CONTEXT names the wheel's cross-cycle view as "a reporting grouping (by
symbol + strategy)" — a *compound* grouping. `GroupDimension` is
single-dimension; the doc said nothing about the wheel's named need. Applied:
semantic 5 now states single-dimension-today with the additive extension path
(`GroupDimension` → a key list), and an open item defers it until the UI
names the screen. Not adopted now: no screen has asked for it (YAGNI), and a
premature `GroupDimension[]` would ripple through the group-key typing for
zero consumers.

### Finding 2 — cold-snapshot compute vs missing close-date marks

Drawing the cold-snapshot arrow (`buildMarksFromFills(fills,
date(closedAt))`) forced the question: what if that date's mark is absent?
The answer was derivable but unwritten — the outcome fields are mark-free
(that is PA's whole charter), so the cold compute serves the report
regardless. Applied: a sentence in semantic 6, so no implementer adds a
marks-present precondition that the outcome path does not need.

### Finding 3 — `evaluateMany([])` was unwritten

The zero-view convention (semantic 3) draws an `evaluateMany([], {}, asOf)`
arrow for an empty open scope; calc had no empty-input semantic (PA wrote
its own empty-list semantic 7 for exactly this reason). Applied as a
**ripple**: decided semantic 25 added to
[`calculation-module.md`](calculation-module.md) — empty records → a valid
zero `ExposureReport`.

---

## Requirements fulfilled / exported

### Closed here

| Item | Resolution |
|---|---|
| **PerformanceReportingCoordinator interface (overview row 11)** | **Pinned: 2 ops sharing one request type** (`runOutcomeReport` / `runExposureReport`, both taking `ReportRequest` — owner decision). Grouping folded in on both ops with label resolution incl. retired values. |
| **PerformanceAnalytics export (a)–(d)** | Fulfilled: (a) pre-narrowing via `listTrades(filters)` (semantic 2); (b) `closedAt` ordering owned here (semantic 4); (c) routing — one op per path, literally the illustrative split PA drew (semantic 1); (d) group-by with id→label resolution incl. retired values (semantic 5). |
| **OQ 15 — per-day plan-revision-rate** | **Decided: deferred** to the reporting-feature (UI) session, with the pooled-rate analysis (formula, worked example, why per-trade rates cannot fold to it, and the additive landing spot on `OutcomeReportView`) parked in semantic 7 for the inheriting session. `meanRevisions` (per-trade) remains the reported signal. |
| **Cold-snapshot reads** | Ruled: in-place compute with `regenerateSnapshots`' recipe, no write-back (semantic 6). |
| **reference-stores export (labels)** | Strategy + account label joins served (semantic 5). The `providers.listProviders()` mention is parked — see exports. |
| **Ripple applied → calculation-module.md** | Decided semantic 25 added: `evaluateMany([])` → a valid zero `ExposureReport` (audit finding F3 — the zero-view convention leaned on an unwritten calc behavior). |

### Exported to downstream sessions (commitments)

- **→ reporting-feature design (UI session):** (a) **OQ 15's per-day
  revision rate** — deferred by owner decision; inherit the semantic-7
  analysis (pooled Σ÷Σ, additive on `OutcomeReportView`/`OutcomeGroup`,
  no calc/FigureSet change); (b) additional outcome metrics —
  PerformanceAnalytics' open item, additive on `PortfolioReport`, until the
  UI names them (YAGNI); (c) time-bucketed equity curve — a composition
  these ops already serve (bucket by `closedAt` month, `aggregate` per
  bucket); add a convenience only if the UI asks; (d) per-position exposure
  rows if a reporting screen needs them — additive on
  `ExposureReportView`, ruled out for now (semantic 9).
- **→ TradingRecordStore:** pin the `openedFrom`/`openedTo` filter **key**.
  `TradeFilters` carries the fields, but no decided semantic names what
  "opened" keys on (first-fill time, derivable from fills, vs plan
  `committedAt`, stored). Reporting passes through whichever the store rules,
  so the gap is the store's to close — one decided semantic, no interface
  change.
- **→ FillEntryCoordinator (cross-ref, no change):** reporting's cold-snapshot
  compute (semantic 6) is `regenerateSnapshots`' recipe minus the
  `replaceSnapshot` write-back. If that recipe ever drifts, both call sites
  drift together — keep the cross-reference.
- **→ future mark source-quality analytic:** no charter home today — CONTEXT's
  reporting section names no such analytic. When it emerges it is a read join
  over `getMarkSeries` + `providers.listProviders()` (the reference-stores
  session anticipated the label half); additive, and likely UI-direct rather
  than a coordinator section. Parked, not dropped.

---

## Open items

| Item | Owned by |
|---|---|
| **Per-day plan-revision-rate (OQ 15).** Deferred by owner decision; `meanRevisions` (per-trade) reported today. The inheriting session starts from semantic 7's parked analysis: pooled Σ÷Σ from record-level dates, additive on `OutcomeReportView`, no calc/FigureSet change. | reporting-feature design |
| **Additional outcome metrics** (median R, quartiles, max consecutive wins/losses, Sharpe-like ratios, average win ÷ average loss). Additive folds over `rMultiples` / `pnl.realized`; extend `PortfolioReport`, not the interface. Deferred until the reporting UI names which it needs. | reporting-feature design (imported from performance-analytics.md) |
| **Compound grouping — the wheel view** (CONTEXT: "a reporting grouping (by symbol + strategy)"). Single-dimension `GroupDimension` today; the extension is a key list (`groupBy: ['underlying','strategy']`) with a compound group key. Additive, non-breaking; deferred until the UI names the screen (audit finding F1). | reporting-feature design |
| **Time-bucketed equity curve** (monthly R etc.). Served today as a composition (bucket + `aggregate` per bucket); a convenience op earns existence only when the UI asks. | reporting-feature design |
| **`opened*` filter key** (first-fill time vs `committedAt`). | TradingRecordStore (exported above) |

---

## Alternatives considered

### Op shape (design-it-twice)

- **Candidate B — two ops, one shared request type (adopted; owner
  decision).** `runOutcomeReport` / `runExposureReport`, both taking
  `ReportRequest` verbatim. One op per question the screen asks; the
  mark-dependence split (ADR 0008) maps one-to-one onto the ops; the shared
  request keeps call sites symmetric (build one object, pass it twice); each
  op's empty-scope behavior is its own zero view. Costs, accepted by the
  owner: a composite screen makes two calls, and the grouping lists split
  per op — mitigated by the shared label-ascending ordering (semantic 5).

- **Candidate A — one op computing both sections (rejected).**
  `runReport(request)` → `{ outcome, exposure, groups? }`, the non-matching
  section a valid zero-report. Deepest on op count; PA semantic 7's
  "branch-free caller" rationale fully realized at the op boundary; grouping
  in one list. Rejected on the owner's preference for one-call-per-question
  with a shared request: the zero-section a closed-only screen receives is
  computed-but-unread work, and the union-free view type hides (rather than
  removes) the fact that two different reports are being built. The two
  questions' input asymmetry (ADR 0007 snapshots vs live marks; ADR 0008
  mark-free vs mark-dependent) is more honestly visible as two ops than as
  two sections of one return.

- **Candidate C — one op, union return (rejected).** Closest to the Phase-2
  sketch (`runReport(filters): PortfolioReport`). Every caller narrows a
  discriminated union; `status:'Planned'`/`'Discarded'` has no defined arm;
  the return type varies with filter state — the least stable shape for the
  UI seam. (The Phase-2 sketch also predates ADR 0008: it had no exposure
  path at all.)

### OQ 15 — the per-day revision rate

- **Keep deferring (adopted; owner decision).** No per-day field on the
  view; `meanRevisions` (per-trade) stays the reported discipline signal.
  The pooled-rate analysis is parked in semantic 7 — formula, worked
  example, the additive landing spot, and the rejection of the calc-field
  path — so the reporting-UI session inherits the decision made cheap
  rather than re-derived.

- **Path (b) — pooled rate in the coordinator (not adopted now).**
  `Σ revisionCount ÷ Σ spanDays`, null iff the denominator is 0. Both sums
  are record-level facts already in hand; FigureSet and calc's contract stay
  untouched; the in-hand derivation follows DailyReview's `marksDue`
  precedent. This remains the parked recommendation of semantic 7's
  analysis; adopting it is one additive field when the UI asks.

- **Path (a) — a calc-side `revisionRate` (or `durationDays`) field on
  FigureSet (rejected).** Reshapes the system-wide data contract — every
  snapshot, regeneration, and import ripples — for one metric; reverses calc
  semantic 8 ("rate is PerformanceAnalytics's job"); gives calc duration
  logic on record-level dates; and an open trade's duration is unfinished, so
  a live per-trade rate is ill-defined. Decisively: per-trade rates cannot
  fold back to the pooled Σ÷Σ aggregate anyway (mean-of-rates ≠ pooled rate,
  and same-day trades are ÷0 per-trade) — the contract change would buy the
  wrong number.

### Exposure per-position rows

- **Aggregate-only (adopted).** `ExposureReportView` carries
  `evaluateMany`'s report, not per-trade rows. DailyReview already owns the
  open-trade detail view (records + live figures + `stopsHit`); duplicating
  it here would force N redundant `evaluate` calls beside the one
  `evaluateMany`. Rejected: a `positions: []` field on
  `ExposureReportView` — additive later if a reporting screen names the
  need (exported above).
