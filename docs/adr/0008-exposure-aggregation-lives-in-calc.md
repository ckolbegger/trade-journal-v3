# Open-position exposure aggregation lives in CalculationModule (`evaluateMany`)

## Context
PerformanceAnalytics owns the portfolio outcome fold (`aggregate` — R-distribution,
win rate, etc.) over closed-trade `FigureSet` snapshots. The natural question:
where does the aggregate of **current exposure** across open positions live
(total unrealized P&L, total current risk, etc.)?

Three candidates were considered (see
[performance-analytics.md](../design/performance-analytics.md) alternatives):
(a) the coordinator/UI as a sum over live `evaluate` results; (b) a second op
in PerformanceAnalytics; (c) a new op `evaluateMany` in CalculationModule.

## Decision
**CalculationModule owns open-position exposure aggregation via
`evaluateMany(records, marks, asOf) → ExposureReport`.** It is the multi-
position analog of `evaluate` — same inputs (`TradeRecord[] + marks + asOf`),
same mark-dependence — returning aggregate current figures.

The split between the two pure modules tracks **mark-dependence**, not single-
vs-portfolio: calc derives figures from facts + marks (single or aggregate
current); PerformanceAnalytics is a mark-free fold over already-derived closed
snapshots.

## Rationale
- The "coordinator sum" ruling was rejected because it contradicts the
  overview's own stated reason for lifting aggregation into a pure module
  (testable logic buried in a workflow), and because the "sum" hides real
  arithmetic: `pnl.unrealized` is `null` on a missing mark (not `0`), and
  dollars — not ratios — are the only aggregatable form across mixed sizes.
  Those conventions originate in calc and deserve tested implementations there.
- The "PerformanceAnalytics second op" ruling was rejected because exposure
  needs marks, and `FigureSet[]` is the wrong input for a mark-dependent
  aggregate. It would force PerformanceAnalytics to take `TradeRecord[] + marks`
  (abandoning its pinned input) or re-evaluate internally (pulling calc's job
  in).
- Deletion test, applied honestly: delete `evaluateMany` → the null-handling and
  dollars-only sum scatter into N coordinator/UI callers. Complexity reappearing
  across callers is the pass condition.

## Consequences
- Calc widens from 2 to 3 ops; its charter widens from "single-trade derivation"
  to "mark-dependent figure derivation from facts + marks, single or aggregate
  current." This is a real charter change to a pinned module.
- `ExposureReport` is deliberately narrower than `FigureSet` — `positionSize`,
  `risk.maximum`, `rMultiple`, `pnl.realized`, `revisionCount` are absent
  (don't aggregate across mixed instruments/types, or are outcome-only).
- The single-vs-portfolio proxy for the calc/PerformanceAnalytics split is
  replaced by the mark-dependence distinction. Future figure math joins calc if
  it needs marks, PerformanceAnalytics if it's a mark-free fold.
- Temporal series (daily P&L over time) remain out of both pure modules — they're
  time compositions over `evaluate`, owned by the consumer holding the date
  range.
