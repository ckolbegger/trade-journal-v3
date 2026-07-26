# Trade lifecycle status is stored authoritatively, not derived on read

## Context
The "stores hold facts; a pure module derives" rule naturally suggests that
Trade lifecycle status (Planned/Open/Closed) — which is computable from fills
via flat-detection — should be derived, never stored. The three candidate
partitions all assumed this.

But the Daily Review's first step is "show me my open Trades." If status is
derived-only, that query must evaluate `flat(fills)` against every Trade that
ever existed to filter down to the open ones. The closed-Trades set grows
monotonically and never levels out — a trader with years of history has
hundreds of closed Trades all re-evaluated every morning just to be filtered
out. That is O(all-trades) per review, growing forever, for an answer that
changes rarely.

There is also a second, subtler reason: "Closed" is not just a query filter —
it is the *trigger* for the required post-trade review placeholder (owed the
moment a Trade goes flat). An event the app acts on is properly recorded, not
re-derived and diffed against last-seen state.

## Decision
All three lifecycle states (Planned/Open/Closed) are **stored authoritatively**
in TradingRecordStore. Transitions happen when a fill is recorded:

- First fill → Planned to Open.
- The fill that flats the position → Open to Closed.

`flat` (net-position-zero) remains a CalculationModule function — it is
computed **once, at fill-record time, for the one Trade being modified**, to
detect the transition. It is not re-derived across all Trades on every query.
The Daily Review's open-Trades query is a cheap indexed filter on stored status.

## Rationale
The "never store a derivation" rule holds *when the derivation is cheap and
its inputs are already loaded.* Lifecycle status fails the second condition
for the open-Trades query: the whole point of the query is to avoid loading
every Trade's fills. The rule's premise doesn't hold, so storing the status is
correct, not a violation.

We rejected **storing as a denormalized cache with derivation as source of
truth** because it requires two code paths kept in sync (cache update +
derivation) and a periodic reconciliation step. Authoritative storage is
simpler: one write at transition time, one indexed read at query time.

## Consequences
- TradingRecordStore carries a status field and owns the transition logic.
- The transition path is a new thing to test (it isn't free): first-fill and
  flat-detection transitions must be exercised explicitly.
- Stored status must agree with derived status; this is cheap to assert in
  tests (sample Trades: assert stored == derived).
- The import/restore path must set status correctly — either trust an imported
  field (risky) or **derive-on-import** by evaluating each imported Trade's
  fills once. Derive-on-import is the safe choice and is cheap (one-time, per
  Trade, at import — not per query).
- This is a deliberate exception to the "facts only" rule, scoped to lifecycle
  status. Other derivations (P&L, position size, risk quantities, R:R) remain
  derived-only — they are either cheap at read time or their inputs are
  already loaded for the Trade being viewed.
