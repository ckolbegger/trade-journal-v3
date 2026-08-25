# PerformanceAnalytics — initial interface design

The pure **closed-trade outcome** aggregation module. Owns the portfolio roll-up
— R-multiple distribution, equity curve by R, win rate, expectancy, profit
factor, P&L total, and plan-revision discipline — computed as one fold over a
list of closed-trade `FigureSet` snapshots. Deliberately owns **no storage
access, no marks, no temporal/series computation, and no filtering.**

The mark-dependent figure math — single *and* aggregate current exposure — lives
in **CalculationModule** (`evaluate` and `evaluateMany`; ADR 0008). The clean
split between the two pure modules is **mark-dependence**, not single-vs-
portfolio: PerformanceAnalytics is a mark-free fold over already-derived
snapshots; calc derives figures from facts + marks, at single or aggregate
scope. This keeps every figure-arithmetic decision (null marks, dollars-only
sums) tested in one place — calc — and leaves PerformanceAnalytics a trivially-
testable fold over a stable snapshot type.

Its input type is already pinned: `FigureSet` (the universal contract from
[`calculation-module.md`](calculation-module.md)). One operation, pure —
testable with literal `FigureSet` objects, no store, no mock, no binding.

```ts
/** The one operation. A pure, mark-free fold over closed-trade snapshots.
 *  Processes the list in the order given (the coordinator orders by closedAt;
 *  this module is order-oblivious about *why*, but the equity curve depends on
 *  *what* order it receives). Empty list → a valid zero report (decided
 *  semantics 7). */
aggregate(results: FigureSet[]): PortfolioReport
```

---

## Interface

### Operations

```ts
aggregate(results: FigureSet[]): PortfolioReport
```

### Output type — PortfolioReport

```ts
/** The portfolio outcome roll-up over closed-trade snapshots. Every field is a
 *  fold over the input list; the one caller (PerformanceReportingCoordinator)
 *  wants the whole report every time, so the metrics are fields on one return
 *  type rather than separate ops. */
type PortfolioReport = {
  tradeCount: number               // input length; the "no data" signal (0 → empty report)

  // --- R-multiple distribution (the signature portfolio metric, CONTEXT.md) ---
  rMultiples: number[]             // the raw multiset, sorted ascending — for the distribution chart
  expectancy: number               // mean rMultiple — R per trade (ΣrMultiples ÷ tradeCount)
  winRate: number                  // fraction with rMultiple > 0 (breakeven 0R is not a win)

  // --- Equity curve by R (CONTEXT.md: "the equity curve by R") ---
  equityCurveByR: number[]         // cumulative sum of rMultiples; length === tradeCount; order = input order

  // --- P&L summary (CONTEXT.md: Performance Reporting) ---
  totalRealized: number            // Σ pnl.realized (dollars)
  profitFactor: number | null      // Σgains ÷ |Σlosses|; null iff no losing trades (÷0)

  // --- Plan-revision discipline (ADR 0001; calc semantic 8) ---
  totalRevisions: number           // Σ revisionCount
  meanRevisions: number            // totalRevisions ÷ tradeCount (per-trade; the per-DAY rate is open — see Open items)
}
```

`FigureSet`, `Dual`, `MaxRisk`, and `ExposureReport` are defined in
[`calculation-module.md`](calculation-module.md). PerformanceAnalytics consumes
`FigureSet.rMultiple`, `FigureSet.pnl.realized`, and
`FigureSet.revisionCount`; the other FigureSet fields are single-trade
quantities this aggregate does not roll up.

---

## Relationship to calc's `evaluateMany` (the mark-dependence split)

PerformanceAnalytics and calc's `evaluateMany` together cover portfolio
aggregation, split cleanly on **mark-dependence**:

| | PerformanceAnalytics `aggregate` | calc `evaluateMany` |
|---|---|---|
| **Input** | `FigureSet[]` (already-derived snapshots) | `TradeRecord[] + Marks + asOf` |
| **Marks?** | **No** — mark-free fold | **Yes** — derives current figures from marks |
| **Trades** | Closed (outcomes) | Open (current exposure) |
| **Returns** | `PortfolioReport` (outcomes) | `ExposureReport` (current exposure) |
| **Why it's pure** | trivially — a fold over inert data | pure given its inputs (testable with literal records + a marks map) |

The split tracks the real distinction (needs-marks vs mark-free), not the proxy
(single-vs-portfolio). Both are pure; both are tested through their interfaces
with literal inputs. No coordinator re-implements figure arithmetic: outcome
folds live here, current-figure folds (including null-mark handling and
dollars-only sums) live in calc. See ADR 0008.

---

## Decided semantics

Each ruling cites the principle it derives from. Veto any during review.

1. **One operation: `aggregate`.** Mirrors CalculationModule's monolith shape
   (calc design-it-twice candidate A). The metrics are *fields on the return
   type, not separate ops* — the single caller
   (PerformanceReportingCoordinator) wants every metric every time, so per-metric
   ops would re-pass the same list N times for no gain. Adding a metric later
   extends the return type (additive, non-breaking); it does not grow the
   interface. *(Overview rule 2; depth principle; consistency with calc.)*

2. **Closed-trade snapshots only — `aggregate` is an outcome fold.**
   `rMultiple` is realized-only (`= pnl.realized ÷ risk.planned.dollars`, calc
   semantic 12), so an open trade with unrealized gains reads `rMultiple: 0` —
   a non-outcome zero indistinguishable from a breakeven closed trade. Feeding
   open snapshots into the R-distribution, win rate, expectancy, equity-by-R,
   and profit factor poisons every outcome metric with numbers that mean
   "outcome unknown," not "outcome was zero." **Open-trade exposure is served by
   calc's `evaluateMany`** (ADR 0008) — a mark-dependent current-figure fold over
   `TradeRecord[] + Marks`, not a mark-free fold over snapshots. The coordinator
   routes on the status filter: `status: 'Closed'` → `aggregate`; `status:
   'Open'` → `evaluateMany`. *(Type-driven from the pinned FigureSet; the mark-
   dependence split — outcomes are mark-free, exposure is mark-dependent.)*

3. **No filters on `aggregate` — the overview sketch does not survive the pinned
   contract.** The overview's illustrative `aggregate(results, filters)` puts
   `{dateRange?, strategy?, status?, underlying?, account?}` on the op, but
   `FigureSet` carries **none** of those dimensions — calc *deliberately* ignores
   `strategy` and `accountId` (they are store-owned reference tags; calc semantic
   / TradeRecord comment), and carries no date and no underlying. The only
   filter-relevant field FigureSet carries is `lifecycle`. PerformanceAnalytics
   therefore *cannot* filter on date/strategy/underlying/account: its input type
   doesn't hold them. The coordinator pre-narrows via
   `listTrades(filters)` (TradingRecordStore) and passes an already-scoped list.
   Group-by-strategy or group-by-account is likewise coordinator-side: it builds
   one FigureSet list per group and calls `aggregate` per group. *(Pinned data
   contract — this is a consequence, not a choice.)*

4. **Order-oblivious about *why*, dependent on *what*.** `equityCurveByR` is a
   cumulative sum over the list *as given*. The coordinator orders the input by
   `closedAt` (which it holds); PerformanceAnalytics holds no dates and makes no
   ordering decision of its own. The shape of the curve therefore depends on the
   caller's ordering, which is the intended seam: ordering is a record-level
   concern (store-owned `closedAt`), not a snapshot-level one. *(FigureSet
   carries no timestamp.)*

5. **`winRate` counts `rMultiple > 0`.** A 0R (breakeven) closed trade is not a
   win. *(Convention — veto if breakeven should count as a win (`≥ 0`).)*

6. **`profitFactor` is `null` iff there are no losing trades.** Otherwise
   `Σ(gains) ÷ |Σ(losses)|`, where gains/losses are split on `pnl.realized`
   sign. `null` follows calc's convention (semantic 4 in calculation-module.md):
   a missing value is `null`, not `0` or `Infinity` — "no losses to divide by"
   is not "profit factor of zero" or "infinite profit." *(Calc null-for-not-
   meaningful convention.)*

7. **Empty list → a valid zero report, not null-spam.** `tradeCount: 0`, empty
   `rMultiples` / `equityCurveByR`, `0` for `expectancy` / `winRate` /
   `totalRealized` / `totalRevisions` / `meanRevisions`, and `profitFactor: null`.
   The UI shows "no closed trades in scope" off `tradeCount`. This keeps the one
   caller branch-free: it never null-checks the report. *(Consumer ergonomics.)*

8. **`rMultiples` returns the sorted raw multiset, not a binned histogram.** The
   distribution chart plots points; binning is presentation. Percentile
   projections (median, quartiles) are local derivations over the sorted array.
   *(Depth — don't store what the caller can derive by projecting the return.)*

9. **Revision rate is per-trade (`meanRevisions`), not per-day — for now.** ADR
   0001 names "plan-revision-rate" as a discipline signal; calc deferred the rate
   to PerformanceAnalytics (calc semantic 8: "rate is PerformanceAnalytics's
   job"). But `FigureSet.revisionCount` is a raw count and FigureSet carries no
   trade duration (no `committedAt` / `closedAt`) — so a revisions-per-day rate
   is not computable from the pinned input type. PerformanceAnalytics reports
   `meanRevisions` (revisions per trade, e.g. 1.4) as an honest discipline signal
   today (a trade revised three times is fiddling regardless of duration). The
   per-day rate is deferred — see Open items. *(ADR 0001; pinned FigureSet.)*

---

## Worked examples

### Five closed trades — the headline example

| Trade | rMultiple | revisionCount | pnl.realized |
|-------|-----------|---------------|--------------|
| A | +2.0 | 0 | +$600 |
| B | −1.0 | 3 | −$300 |
| C | +1.5 | 1 | +$450 |
| D | +0.5 | 2 | +$150 |
| E | −0.5 | 1 | −$150 |

```ts
aggregate([fsA, fsB, fsC, fsD, fsE])
// → {
//     tradeCount:     5,
//     rMultiples:     [-1.0, -0.5, +0.5, +1.5, +2.0],   // sorted ascending
//     expectancy:     +0.5,                              // (2.0−1.0+1.5+0.5−0.5) ÷ 5
//     winRate:        0.6,                               // A,C,D positive → 3/5
//     equityCurveByR: [+2.0, +1.0, +2.5, +3.0, +2.5],    // cumsum in INPUT order (A,B,C,D,E)
//     totalRealized:  +$750,                             // 600−300+450+150−150
//     profitFactor:   8.0,                               // (600+450+150) ÷ |−300−150| = 1200/150
//     totalRevisions: 7,
//     meanRevisions:  1.4,                               // 7 ÷ 5
//   }
```

Note `equityCurveByR` follows *input* order, not the sorted order of
`rMultiples`: the curve is a chronological journey (the coordinator passes
trades ordered by `closedAt`), the distribution is a sorted statistical view.
They are different projections of the same multiset.

### Empty list

```ts
aggregate([])
// → {
//     tradeCount: 0, rMultiples: [], expectancy: 0, winRate: 0,
//     equityCurveByR: [], totalRealized: 0, profitFactor: null,
//     totalRevisions: 0, meanRevisions: 0,
//   }
```

### All-winners (profitFactor null case)

```ts
aggregate([fsPlus2R, fsPlus1R])   // both rMultiple > 0, both pnl.realized > 0
// → { …, profitFactor: null, … }   // no losing trades → null, not Infinity
```

### Caller's-eye usage

```ts
// PerformanceReportingCoordinator (drill-down #7) — the one caller
// CLOSED path → outcome aggregate (this module):
const records = tradingRecord.listTrades({ ...filters, status: 'Closed' })
const snapshots = records.map(r => r.finalFigures)    // O(1) cache reads (ADR 0007) — no recompute
const report = analytics.aggregate(snapshots)         // one mark-free call → whole report
// UI projects: report.rMultiples → distribution chart;
//              report.equityCurveByR → equity curve;
//              report.expectancy / winRate / profitFactor → headline tiles.

// OPEN path → current exposure (calc's evaluateMany, NOT this module):
const openRecords = tradingRecord.listTrades({ ...filters, status: 'Open' })
const marks = priceMarks.buildMarksFromFills(openRecords.flatMap(r => r.fills), today)
const exposure = calc.evaluateMany(openRecords, marks, today)   // ExposureReport (ADR 0008)

// Group-by-strategy is coordinator-side (FigureSet carries no strategy):
const byStrategy = group(records, r => r.strategy)    // TaxonomyValueId the coordinator holds
for (const [stratId, groupRecords] of byStrategy) {
  const groupReport = analytics.aggregate(groupRecords.map(r => r.finalFigures))
  // resolve stratId → label via taxonomy.listValues('strategy', false)
}
```

---

## Audit findings (sequence-diagram audit)

The audit applies the yield test: *would a sequence diagram expose a missing op,
an undefined type, or an unwritten semantic?* For a pure module with one
synchronous op, no internal multi-step flow, and no cross-store joins, the
answer is no — there is no flow to draw. The two ordering-/edge-concerns a
diagram *might* surface (empty-list behavior, equity-curve ordering) are already
decided semantics (7 and 4), not sequence findings. **Diagrams skipped with
reason**, per the skill's allowance for pure modules where the audit would
yield nothing.

The audit's value here was upstream of diagrams: it surfaced the three findings
below *while sketching the return type*, by forcing the question "what does each
metric actually reduce to over a FigureSet?" The writing was the audit.

### Finding 1 — filters dropped from the signature

The overview's illustrative `aggregate(results, filters)` does not survive the
pinned `FigureSet` type: it carries no date, strategy, underlying, or account
(calc ignores `strategy`/`accountId` deliberately). PerformanceAnalytics
*cannot* filter on those dimensions. The coordinator pre-narrows via
`listTrades(filters)` and passes an already-scoped list. Recorded as decided
semantic 3; the overview sketch and walkthrough are amended (see *What changed
at the overview*).

### Finding 2 — closed-trade-only (and where open exposure lives)

The handoff and the `calculation-module.md` export both said PerformanceAnalytics
"consumes [closed + open] uniformly." Tracing `rMultiple = realized-only` through
the outcome metrics shows that is wrong: an open trade's `0R` is a non-outcome
zero that distorts every R-based aggregate. Open trades don't feed the outcome
aggregate.

**Where open exposure lives** evolved across this session — recorded honestly:
the first ruling ("coordinator/UI sum") was rejected (it contradicts the
overview's stated reason for lifting aggregation into a pure module, and
misapplies the deletion test — the null-handling and dollars-only sum are real
tested arithmetic, not a nothing-burger). The second ruling ("a second op in
PerformanceAnalytics") was also rejected (exposure needs marks;
PerformanceAnalytics is a mark-free fold). The resolved home is **calc's
`evaluateMany`** (ADR 0008) — the multi-position analog of `evaluate`, same
inputs (`TradeRecord[] + marks + asOf`), same mark-dependence. This keeps the
two pure modules split on the real distinction (mark-dependence) rather than the
proxy (single-vs-portfolio), and keeps all figure arithmetic in tested modules.
Recorded as decided semantic 2. **Ripple: the "consumes both uniformly"
sentence in calculation-module.md is amended** (see Ripples).

### Finding 3 — revision-rate denominator

ADR 0001 assigns "plan-revision-rate" to PerformanceAnalytics, but `FigureSet`
carries `revisionCount` (raw) and no duration. Per-day rate is not computable
from the pinned input; `meanRevisions` (per-trade) is reported instead, and the
per-day rate is an open item. Recorded as decided semantic 9 and Open items.

---

## Sequence: performance reporting (the closed-trade flow this module sits in)

Included not because the pure module has internal steps, but to pin where
ordering, filtering, and the closed/open routing all live — which is entirely
coordinator-side. (Coordinator internals are illustrative; pinned in its own
drill-down.)

```
trader → PerformanceReportingCoordinator.runOutcomeReport({ ...filters, groupBy?, asOf })
  → records = TradingRecordStore.listTrades({ ...filters, status:'Closed' })   // pre-narrowed HERE
  → snapshots = records.map(r => r.finalFigures)                               // O(1) reads (ADR 0007)
  → report = PerformanceAnalytics.aggregate(snapshots)                         // one pure mark-free call
  ← PortfolioReport (R-distribution, equity-by-R, win rate, expectancy, P&L, revision discipline)
```

The open-trade exposure path does not touch this module — it calls calc's
`evaluateMany` (ADR 0008):

```
trader → PerformanceReportingCoordinator.runExposureReport({ ...filters, asOf })
  → records = TradingRecordStore.listTrades({ ...filters, status:'Open' })
  → marks = PriceMarkStore.buildMarksFromFills(records.flatMap(r => r.fills), today)
  → exposure = CalculationModule.evaluateMany(records, marks, today)           // mark-dependent fold
  ← ExposureReport (totalUnrealized, totalCurrentRisk, totalPlannedRisk, totalIncrementalReward + missingMarkCount)
```

The two paths share the coordinator and the stores but diverge at the pure
module: closed trades hit PerformanceAnalytics (a mark-free fold over
snapshots); open trades hit calc (a mark-dependent fold over records). This is
the mark-dependence split decided semantic 2 + ADR 0008 draw.

*Pinned since (PerformanceReportingCoordinator drill-down): the routing
became the interface — two ops sharing one request type,
`runOutcomeReport` (closed-in-scope → this module) and `runExposureReport`
(open-in-scope → calc), each conjoining its own status onto the store filter.
Empty scopes are valid zero views, so semantic 7's branch-free payoff holds
per op. See
[performance-reporting-coordinator.md](performance-reporting-coordinator.md)
semantic 1.*

---

## Requirements fulfilled / exported

### Closed here

| Item | Resolution |
|---|---|
| **PerformanceAnalytics interface (overview row 7)** | **Pinned: 1 op** (`aggregate`). The overview's `~3` estimate collapses to one deep op with a rich return type — the metrics are fields, not ops. |
| **Filter seam (the one genuine shape question)** | **Resolved: no filters on `aggregate`** (finding 1). FigureSet carries no filter dimension; the coordinator pre-narrows via `listTrades(filters)`. Group-by-strategy/account is coordinator-side. |
| **Closed vs open scope** | **Resolved: closed-trade outcome analytics only** (finding 2). Open-trade exposure is served by calc's `evaluateMany` (ADR 0008), not this module. |
| **Revision-rate denominator (F3)** | **Resolved for this session: per-trade (`meanRevisions`) now; per-day deferred** (decided semantic 9). |

### Exported to downstream sessions (commitments)

- **→ PerformanceReportingCoordinator (drill-down #7):** the one caller of
  `aggregate`. Owns (a) pre-narrowing via `listTrades(filters)` — date/strategy/
  status/underlying/account filtering is *its* job; (b) ordering the input by
  `closedAt` so `equityCurveByR` is chronological; (c) routing on the status
  filter — `Closed` → `aggregate(snapshots)` (this module); `Open` →
  `calc.evaluateMany(openRecords, marks, today)` (ADR 0008); (d) group-by
  strategy/account (build per-group lists, call `aggregate` per group, resolve
  ids to labels via `taxonomy.listValues('strategy', false)` /
  `accounts.listAccounts()`). *(Overview who-calls-whom: PerformanceReporting →
  TradingRecord read + Account/Taxonomy read group + PerfAnalytics aggregate +
  calc evaluateMany.)*
- **→ ADR 0001 (plan-revision-rate):** the per-day rate remains unfulfilled by
  this module. It needs trade duration (committedAt → closedAt), which FigureSet
  does not carry. See Open items for the two paths (calc field vs coordinator
  computation).

---

## Open items

| Item | Owned by |
|---|---|
| **Per-day plan-revision-rate.** ADR 0001 names revisions-over-duration; FigureSet carries `revisionCount` but no duration, so PerformanceAnalytics reports `meanRevisions` (per-trade) only. Two paths to the per-day rate, neither chosen now: (a) calc adds a per-trade `revisionRate` field to FigureSet (reverses calc semantic 8's "rate is PA's job" — calc would need duration logic, and `committedAt`/`closedAt` are record-level not figure-level); (b) the coordinator computes revisions/day from `closedAt − committedAt` it already holds, bypassing this module for that one metric. Decision deferred until the discipline-metric design is real. | ADR 0001 owner / PerformanceReportingCoordinator drill-down |
| **Additional outcome metrics** (median R, quartiles, max consecutive wins/losses, Sharpe-like ratios, average win ÷ average loss). All are folds over the same `rMultiples` / `pnl.realized` arrays; adding them extends `PortfolioReport` (additive, non-breaking), not the interface. Deferred until the reporting UI names which it needs — YAGNI on the metric set. | PerformanceReportingCoordinator drill-down / reporting-feature design |
| **Time-bucketed equity curve** (e.g. monthly R instead of per-trade). Would need bucket boundaries the coordinator holds (dates), not the snapshot. If needed, the coordinator buckets and calls `aggregate` per bucket — no module change. | PerformanceReportingCoordinator drill-down |

---

## Alternatives considered

### Module shape (design-it-twice)

- **Candidate A — one deep `aggregate` (adopted).** `aggregate(FigureSet[]):
  PortfolioReport`. One op; metrics are fields on the return type. Mirrors
  CalculationModule's monolith (calc design-it-twice candidate A). Deepest on op
  count; adding a metric extends the type, not the interface. The one caller
  (PerformanceReportingCoordinator) wants every metric every time, so the depth
  payoff (local projection by the consumer) is fully realized. Cost: the caller
  receives the whole report even when projecting one field — but there is exactly
  one caller and it projects the whole report, so the cost is theoretical.

- **Candidate B — per-metric ops (rejected).** `rMultipleDistribution()`,
  `equityCurveByR()`, `revisionRate()`, `pnlSummary()` — each a thin fold. A
  single-metric consumer would call one op. Rejected because (a) the one caller
  wants all metrics every time — composability is moot; (b) N ops where A has 1,
  re-passing the same list N times; (c) the coordinator would assemble the
  report from N calls, adding assembly logic with no depth payoff. The
  independently-testable virtue is real but already served: A is one pure op
  testable with literal FigureSets, same as calc.

- **Candidate C — aggregate + series split (rejected).** `aggregate()` returns
  scalar roll-ups (distribution, rates, totals); `series()` returns the equity
  curve. Splits order-independent folds from the order-dependent cumsum. Rejected
  because the equity curve is a trivial cumsum — not complex enough to earn its
  own op and return type — and both are folds over the same list, so the seam
  separates nothing structurally. Two types where one serves.

### Closed vs open scope

- **Closed-only, with exposure in calc (adopted).** `rMultiple` is realized-only
  (calc semantic 12), so open-trade snapshots are non-outcome zeros that distort
  every R-based metric. Open-trade exposure is served by calc's `evaluateMany`
  (ADR 0008) — a mark-dependent current-figure fold. Chosen because the type
  *forces* closed-only for outcomes (you cannot honestly aggregate open + closed
  R-multiples), and because exposure is mark-dependent, putting it in the mark-
  free fold module would be the wrong seam. See ADR 0008.

- **Two aggregates in PerformanceAnalytics (rejected).** A second
  `exposure(FigureSet[])` op alongside `aggregate`. Rejected because exposure
  needs marks, and `FigureSet[]` is the wrong input for a mark-dependent
  aggregate — it would force PerformanceAnalytics to take `TradeRecord[] + marks`
  (abandoning its pinned input type) or re-evaluate internally (pulling calc's
  job in). Mark-dependence puts exposure with `evaluate`, not `aggregate`.

- **Exposure in the coordinator/UI (rejected).** A coordinator-side sum over
  live `evaluate` results. Rejected because it contradicts the overview's stated
  reason for lifting aggregation into a pure module ("burying it in the
  coordinator hides testable logic behind a workflow module"), and because the
  "sum" hides real decisions (null-mark handling, dollars-only) that deserve
  tested arithmetic, not ad-hoc coordinator code.

### Mark-dependent temporal series (the charter boundary)

- **Out of scope (adopted).** Daily P&L over time, current-risk / incremental-
  reward time series, portfolio equity curve over calendar time — all need
  per-day marks, which FigureSet (a snapshot) does not carry. They are
  compositions over `CalculationModule.evaluate` per day, owned by the consumer
  that holds the marks and date range (the Daily Review loop, at portfolio
  scale). This is the *same* ruling CalculationModule's drill-down made when it
  rejected a series-native `evolution()` op: "a per-day series is a natural
  composition of point-evaluates." Note calc's `evaluateMany` is a *space*
  composition (many positions, one instant, one marks map) — a single clean pure
  op — not a *time* composition (N marks maps, one per day), which stays a
  caller-orchestrated loop. Cost: the temporal-series visualizations are
  coordinator-assembled loops, not single pure calls — the honest price of
  keeping both pure modules mark-free across time.

### Revision-rate denominator (F3)

- **Per-trade now, per-day deferred (adopted).** Report `meanRevisions`
  (revisions/trade); leave per-day as an open item. Honest about what the pinned
  FigureSet supports; doesn't reshape calc's contract to grab one metric.

- **Add per-day rate to calc now (rejected, for this session).** Would put a
  `revisionRate` field on FigureSet, reversing calc semantic 8 and giving calc
  duration logic (record-level `committedAt`/`closedAt` are not figure-level).
  Reshapes the system's data contract for one metric — too heavy before the
  discipline-metric design is real.

- **Drop revision metrics (rejected).** Would leave the discipline signal (ADR
  0001's headline metric) out of the module whose job ADR 0001 said it was.
  `meanRevisions` is an honest partial fulfillment; dropping it abdicates the
  commitment.
