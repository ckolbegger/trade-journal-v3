# Risk/reward computed via the position payoff curve

**Status:** accepted

The system computes a position's risk and reward by constructing its **payoff
curve** — P&L as a piecewise-linear function of underlying price at expiry —
from the filled legs, then reading quantities off that curve. Maximum risk is
the curve's minimum (or `{bounded: false}` if unbounded below); maximum reward
is its maximum (or unbounded above); breakevens are the zero-crossings of the
curve's segments. This is one algorithm that serves every structure — single
stock, single option, spread, condor, combo — regardless of directional bias or
complexity, instead of a per-strategy formula catalog.

## Why

A prior assumption — that strategy is a free-form taxonomy tag calc ignores,
with risk/reward derivable from three declared price levels (entry/stop/target)
via an implied-long formula — does not survive contact with the domain. Two
facts broke it:

1. **Shorts are in scope** (stocks and options). The implied-long formula
   `(entry − stop) × size` computes negative risk for a legitimate short, so
   direction cannot be left implicit in the levels.
2. **Spreads and neutral structures have no single stop/target** in the stock
   sense. A Call Debit Spread's risk is its net debit (a function of two
   strikes); an Iron Condor's risk is its spread width minus credit. There is no
   generic three-levels formula that covers these.

Strategy therefore cannot be "just a Reporting filter" — at minimum its
directional bias must reach calc to select a formula, and for multi-leg
structures no three-levels formula exists at all.

The payoff curve dissolves both problems. It needs no directional-bias input
(the curve's shape *is* the bias — a long stock's curve slopes up, a short's
slopes down). It handles every structure uniformly because every structure *is*
a payoff curve: a single stock is a straight line; a spread is a piecewise-linear
curve hinged at its strikes; a condor is the sum of two spreads. Max risk, max
reward, and breakevens all fall out of the one construction. The trader's
declared stop/target levels (when present) are *read against the curve* — a stop
at a breakeven yields $0 planned risk; a stop toward max loss yields positive
risk — rather than driving a separate formula.

## What this replaces and what it leaves open

**Replaces** the "three levels, implied-long formula" model of planned risk for
multi-leg / non-directional structures. For those, the payoff curve is the
computation.

**Leaves open** the full representation of stops and targets on the `Plan` type
(ADR 0001 / the calc drill-down): a single stock trade has one stop; a neutral
structure may have stops on both risk directions; an income strategy's "target"
may be "hold to expiry for full credit" rather than a price level. The current
single `stop: Price`, `target: Price` shape on `Plan` is known-insufficient for
multi-directional structures and is deferred to a dedicated session. **Until
that session, the payoff-curve ADR records the computation; the stop
*representation* is unsettled.**

**Out of scope here:** mark-to-market (live) P&L and live risk for options,
which require an option-pricing model (time value / extrinsic) applied to the
daily mark. The payoff curve is an *expiry* (intrinsic-value-at-settlement)
construction; it serves maximum/planned risk and breakevens, not the daily
mark-to-market figure. That computation is owned by CalculationModule's
mark-dependent path and is not changed by this ADR.

## Considered options

- **Payoff curve as the universal mechanism (adopted).** Construct the curve
  from filled legs; read max/min/breakevens off it; evaluate the trader's
  declared stops/targets against it. One algorithm, all structures, no
  per-strategy branching in calc. Cost: even a trivial single-stock trade
  builds/samples a (linear) curve — mild ceremony for the simple case, accepted
  for uniformity. The curve's leg inputs ride the `Fill` contract:
  `instrumentType` per ADR 0005, plus the option facts (`optionType`, `strike`,
  `expiry`) as an optional `contract` group, present iff the leg is an option —
  fill-level facts, on the contract from the start rather than deferred.

- **Directional bias as a formula selector (rejected).** Add `bias:
  'bullish'|'bearish'|'neutral'` to the strategy; calc picks one of two level
  formulas by bias. Handles directional stock/option/spread trades cleanly, but
  *fails on neutral structures* (Iron Condor, Straddle) which have no
  single-direction stop/target and whose risk is a function of the spread
  geometry, not of declared levels. Bias would still need a fallback for the
  neutral case — which is the payoff curve. Adopting it for half the structures
  leaves two mechanisms where one suffices.

- **Fixed strategy catalog with a built-in method per entry (rejected).** Ship a
  finite list of named strategies (Long Stock, Short Stock, Call Debit Spread,
  Iron Condor, …), each with a hand-coded risk/reward method in calc. Works and
  keeps methods finite/tested, but calc grows one method per catalog entry
  indefinitely, and a trader using a structure not in the catalog has no path.
  The payoff curve makes the catalog unnecessary: the curve *is* the method, and
  it covers any leg combination without enumeration.

## Consequences

- **CalculationModule's risk computation becomes leg-aware, not level-only.**
  `evaluate` consumes the `fills` (each carries `instrumentType` per ADR 0005)
  to build the payoff curve; `risk.maximum` and `reward.maximum` (and
  breakevens) come from the curve, not from a formula over `plan.stop`/`target`.
  This amends the calculation-module design doc (drill-down #1): the
  `// STORE-OWNED — calc ignores` comment on `strategy` holds, but `fills`
  become load-bearing for risk in a way the prior "three levels" model did not
  require. The curve's option inputs — `optionType`, `strike`, `expiry` — are
  fill-level *facts*, and join the contract now as an optional
  `contract?: OptionContract` group on `Fill` (present iff the leg is an
  option; never parsed out of `InstrumentId`). Stock fills carry none; the
  MVP's curve is unaffected.

- **Strategy stays a Reporting filter; it does not become a calc input.** Because
  the curve needs no bias input, strategy need not reach calc. This *preserves*
  the existing `strategy` decision (store-owned, calc ignores) rather than
  reversing it — the opposite of what a bias-selector would have required.

- **A new derived quantity: breakevens.** The payoff curve yields them for free;
  they are a display quantity (CONTEXT.md: signature visualizations), not
  stored. They join the `FigureSet` return or a related projection.

- **The `Plan.stop`/`Plan.target` representation is unsettled (see "leaves
  open").** This ADR does not commit a shape; it records that the current
  single-`Price` shape is insufficient for multi-directional structures.
