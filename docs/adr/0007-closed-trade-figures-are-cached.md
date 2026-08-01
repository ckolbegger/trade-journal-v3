# Closed-trade figures are computed once at close and cached

## Context
P&L and the full figure-set (R-multiple, planned-vs-realized R:R, risk quantities
as-of close) are computed by CalculationModule from fills + marks. For an Open
Trade this is unavoidable — marks change daily, so the figures must be live.

For a Closed Trade the inputs are frozen: fills are immutable, the position is
flat, the final mark is fixed. Recomputing on every view, and especially on
every Performance Report over years of closed Trades, is O(N)-growing — the
same scaling defect we rejected for lifecycle status in ADR 0006.

## Decision
A **figure-set snapshot** (the full `CalculationModule.evaluate()` result) is
computed **once at close** and stored on the Trade record as a regeneratable
cache. The discriminator is lifecycle status:

- **Open Trades** → figures computed live on every read (marks change daily).
- **Closed Trades** → figures read from the stored snapshot. If the snapshot is
  null (import-without-snapshot, or a bug), it is computed and populated
  **once** on read, not computed live forever.

The snapshot is authoritative for display.

## Rationale
The "never store a derivation" rule holds when a derivation is cheap or its
inputs are volatile. Closed-trade figures are neither: their inputs are frozen
and recomputing them over a growing corpus is the exact scaling defect ADR 0006
addressed for status. Consistent reasoning argues for caching here too.

We snapshot the **full figure-set**, not just P&L, because every reporting
number for a closed Trade is equally immutable (R-multiple, planned-vs-realized
R:R, risk quantities as-of close). Caching only P&L would leave the same
recomputation burden for the other figures in Performance Reporting.

## The cache is regeneratable, not immutable truth — and the cost that exposes
Unlike ADR 0006's lifecycle status (an event recorded as truth), this is a
cache. The snapshot can go stale if a fill is later corrected (typo fix) or a
calc bug is fixed. So the contract is: **authoritative for display, but
invalidated and regenerated when underlying facts or the calc change.**

The honest price: **a future calc-bug-fix requires a regeneration migration
over all closed Trades.** That is the trade-off for O(1) reporting reads, and
it is worth paying — the regeneration is a one-time batch job per fix, whereas
the alternative is perpetual recomputation on every report run.

## Consequences
- TradingRecordStore gains an optional `finalFigures: FigureSet | null` field
  on the Trade record, populated at close.
- The close-time compute-and-store is part of the FillEntryCoordinator's
  flat-detection path (it already runs `flat` once per fill; it runs `evaluate`
  once more at the flat-detecting fill and stores the result).
- The import/restore path must populate the snapshot on import for closed
  Trades — derive-once-at-import, mirroring ADR 0006's derive-on-import for
  status.
- A calc-bug-fix or a fill-correction triggers a regeneration migration over
  closed Trades (batch job).
- Open Trades never use the snapshot; their figures are always live.
- This is a second scoped exception to the "facts only" rule, parallel to
  ADR 0006. Both are caches/recorded-events; both are invalidated/regenerated
  when underlying facts change; both trade a small write-path and migration
  obligation for O(1) reads over a growing corpus.
