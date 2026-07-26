# Three distinct risk quantities: planned, current, maximum

## Context
"Risk" in a Trade is not a single number. A naive implementation treats it as
one — typically the loss-to-stop — and in doing so loses both the live
evolution that the R:R chart needs and the catastrophic-vs-disciplined
distinction that is the app's core options-vs-stock teaching moment.

## Decision
A Trade carries three distinct risk quantities, each shown in both ratio and
dollar form everywhere it appears:

- **Planned risk** = (initial entry − initial stop) × size. **Frozen at the
  initial Plan for the Trade's entire life.** Ignores later Plan Revisions. A
  stop revision changes current risk, never planned risk.
- **Current risk** = (current price − current stop) × size. Moves with price;
  steps when the stop is revised.
- **Maximum risk** = worst-case loss from current price (underlying to zero /
  option to worthless). Instrument-dependent: whole position value for stock;
  premium paid for long options; unbounded for naked short options; defined by
  the spread width for defined-risk spreads. Not discipline-dependent — it is
  the catastrophic loss the instrument itself permits.

The "current R:R" on the evolution chart pairs current risk : incremental
reward; maximum risk is shown alongside to expose the catastrophic exposure.

## Rationale
The pedagogical comparison the app drives lives between current risk and
maximum risk: a stock's current risk is discipline-dependent (the trader must
honor their stop), while its maximum risk is catastrophic (the whole position
if the underlying goes to zero). The same directional trade idea, expressed as
a long option, collapses maximum risk from "the whole position" to "the
premium paid," with no discipline required to enforce the cap. Surfacing this
gap is how the journal teaches that options reduce risk.

We rejected a single "risk" figure because it collapses two genuinely
different questions ("what will I lose if I'm disciplined?" vs "what's the
worst that could happen?") that options exist to separate.

We rejected updating planned risk on Plan Revisions because planned risk is
the *commitment baseline* — what the trader signed up to risk. A trader who
widens their stop is making a current-risk decision, not retroactively
changing what they committed to; preserving the original lets the journal
measure discipline drift (current risk vs the commitment).

## Consequences
- Three risk quantities must be computed and stored/derived distinctly; none
  is an alias for another.
- Maximum risk requires the calculator to know instrument type (stock vs long
  option vs naked short vs defined-risk spread) — instrument type is a
  first-class attribute of a leg, not an afterthought.
- The R:R evolution chart draws three risk series plus reward, all in ratio
  and dollars, stepping at Plan Revisions.
- The stock-vs-option maximum-risk gap is a deliberate teaching surface, not
  incidental.
