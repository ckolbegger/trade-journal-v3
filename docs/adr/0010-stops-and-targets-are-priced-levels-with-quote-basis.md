# Stops and targets are price levels with an explicit quote basis

**Status:** accepted

Stops are declared **per risk direction** — a `Stops` object with optional
`downside` and `upside` sides — and the target is a **single level**. Every
level (stop or target) is a *price* carrying a **quote basis**: either the
underlying's own price (`'underlying'`) or the **option position price** — the
net price over the Trade's option legs, per unit, as an unsigned magnitude
(`'option-position'`; the stop-vs-target role supplies the direction). The
position's **planned risk — the R baseline — is the worst (largest-dollar)
side's reading**; per-direction detail is exposed, not folded away. Resolves
OQ 16; amends the calc + TradingRecordStore contracts and adds a fourth calc
op, `stopsHit`.

## Why

ADR 0009 left the representation open: a single stock trade has one stop; a
neutral structure (an Iron Condor) has stops on both risk directions; an
income strategy's "target" may not look like a price at all. Three domain
facts pick the shape:

1. **Risk directions are exactly two, and always down/up.** A Trade has one
   underlying; its price can only move two ways. A fixed two-sided object
   with optional sides therefore encodes "one stop per risk direction"
   *structurally* — two stops on the same side are unexpressible, and an
   absent side means "no declared level there," not "no risk."
2. **Spreads exit on the net.** For any spread (debit or credit), the exit
   condition is the cost to close the spread — a net over its option legs.
   Single-leg option trades (wheel put, covered call) collapse to that leg's
   price. One basis serves both; quoting a single instrument would lose the
   long leg's contribution to the exit cost.
3. **"Hold to expiry" is a price in disguise.** An income trader's "hold to
   expiry for credit" is the degenerate option-quoted target: take profit
   when the position costs ~$0 to close. Modeling it as a time-based kind
   would foreground a dimension the trader isn't thinking in. Time stops have
   no requirement and are not modeled.

## Level readings

- **Underlying-quoted stops** read against the **expiry payoff curve**
  (ADR 0009) — honestly signed: a stop inside a neutral structure's profit
  tent reads as a *profit*, and PlanCommit validation surfaces that teaching
  moment ("your downside stop reads +$200 — it's inside your profit tent").
  The mark-to-market reading (what stopping costs *today*) requires an
  option-pricing model — ADR 0009's explicit boundary — and is the options
  release's refinement.
- **Option-quoted levels** are evaluated by **comparison against net option
  marks** — a fact lookup, not a valuation; this does not cross ADR 0009's
  mark-to-market boundary. Planned figures for option-quoted levels are
  arithmetic off the planned entry price (credit $2.00, stop $4.00 ⇒ $2.00
  planned risk — no curve, no marks). Any missing option-leg mark leaves the
  level unevaluated (null, not zero).
- **`stopsHit(record, marks, asOf)`** — the fourth calc op — reports which
  declared sides the `asOf` marks crossed, single-date (EOD) semantics;
  "was it hit any day since declaration" composes caller-side over
  `getMarkSeries`.

## What this leaves open (deferred, no current requirement)

- **Per-leg option quotes on multi-direction structures** (a condor managed
  per side, or per-leg stops). Single-direction option trades work today:
  the option position *is* that side.
- **Two-sided profit taking.** `target` stays single. Promoted shape recorded
  for the future session: `target → {downside?, upside?}` mirroring `Stops`;
  figures stay single by fold policy (the worst-side pattern already used for
  risk), so FigureSet, PerformanceAnalytics, and closed-trade snapshots are
  untouched by construction — and any fold over a one-sided target is the
  identity, so historical data stays valid.
- **Time stops.** No requirement; add only if one emerges.
- **Mark-to-market level readings.** Options release; an ADR 0007-style
  regeneration when it arrives.

## Considered options

- **Two-sided optional stops (adopted).** The direction enum is provably
  closed (one underlying) and the one-stop-per-side invariant is structural,
  in the same spirit as PriceMarkStore's set-once override: nonsense is
  unexpressible rather than forbidden by rule.
- **Free array of levels (`stops: Price[]`) (rejected).** Nothing ties the
  count to the structure's geometry; every consumer re-derives which side a
  level guards; revision deltas can't name which stop moved.
- **No declared stops for neutral structures (rejected).** Traders do declare
  adjustment levels on condors; relying on structure max risk quietly
  redefines the R baseline and weakens the plan-vs-realized discipline the
  product teaches.
- **Hold-to-expiry / time as union kinds (rejected).** Time isn't the
  trader's dimension here, and the expiry case is expressible as a price
  (buy back at ~$0).
- **Single-instrument option quoting (rejected).** A spread's exit cost is
  the net over its legs; watching only the short leg approximates it and
  loses the hedge.
- **Unsigned magnitude with role-supplied direction (adopted, for
  option-position quotes).** "Stop at 4.00" = cost *reaches* 4.00; "target
  at 0.50" = cost *falls to* 0.50. Rejected the signed alternative: targets
  as negative numbers for debit structures is alien to trader speech. Cost:
  side-of-entry sanity checks are validation/UI's job, not the type's.
- **Rejecting in-tent stops structurally (rejected).** "Inside the tent" is
  only knowable from planned strikes — the store cannot evaluate it
  pre-fills. The check belongs to PlanCommit validation, which owns
  planned-R:R validation anyway.

## Consequences

- `Plan`/`PlanRevision` reshape: `stops: {downside?: Level, upside?: Level}`,
  `target: Level`, `Level = {basis:'underlying'|'option-position', at:
  Price}` — calc + TradingRecordStore docs amended; one canonical contract
  across both.
- Revision deltas are per-side replace; a revision cannot *un-declare* a side
  (matching the pre-existing no-removal model).
- FigureSet gains **additive optional** `risk.plannedByDirection` and
  `risk.currentByDirection`; `risk.planned` is redefined as the worst side's
  reading. PerformanceAnalytics and the snapshot cache are unaffected.
- **`risk.current` and `reward.incremental` are amended to whole-position
  mark-netting** (position price at the stop/target vs now) — the prior
  `(mark − stop) × size` forms are stock-era and misstate any multi-leg
  trade (a covered call's live risk includes the short call's remaining
  value: $275, not the stock-only $300). `risk.maximum` and the planned
  readings were already whole-position via the payoff curve (ADR 0009 sums
  all legs).
- Calc gains its fourth op `stopsHit`; the who-calls-whom matrix routes it to
  the Daily Review.
- PlanCommitCoordinator (not yet drilled) gains the in-tent stop teaching as
  part of its planned-R:R validation charter.
