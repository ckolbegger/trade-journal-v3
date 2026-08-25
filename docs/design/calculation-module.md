# CalculationModule — initial interface design

The pure position-figure derivation module. Owns every figure the journal shows
for a Trade — P&L, position size, the three risk quantities, reward, R:R, R-multiple,
breakevens, lifecycle echo, and revision count — computed from fills + plan + revisions + price
marks. Structure-level quantities (`risk.maximum`, `breakevens`) are read off
the position's **payoff curve** (ADR 0009) — P&L as a piecewise-linear function
of underlying price at expiry, built from the filled legs. Also owns the
**aggregate of current exposure across a list of open
positions** (`evaluateMany`) — the multi-position analog of `evaluate`, same
inputs (records + marks + asOf), same mark-dependence. Deliberately owns **no
storage access, no presentation logic, and no lifecycle-status derivation.** Its
parameter and return types are the **data contract every store must serve and
every coordinator reads**; this is why it was drilled down first (overview rule
2).

The mark-dependent figure math — single and aggregate — lives here so it is all
tested in one place. The mark-free portfolio *outcome* fold (R-distribution,
win rate, etc. over closed-trade snapshots) is the **PerformanceAnalytics**
module, a clean mark-free seam.

Four operations, all pure — testable with literal objects, no store, no mock, no
binding:

```ts
/** Every figure for one Trade at one point in time. The headline entry point.
 *  Open trades: called live on every read (marks change daily).
 *  Closed trades: called ONCE at close to build the snapshot (ADR 0007),
 *  then never again — readers use the cached finalFigures. */
evaluate(record: TradeRecord, marks: Marks, asOf: Date): FigureSet

/** Transition detector — is the net position zero across all legs?
 *  Cheap (sums signed fill quantities). No marks, no plan, no evaluate.
 *  Called once per fill by FillEntryCoordinator to detect the Open→Closed
 *  transition (ADR 0006). */
isFlat(fills: Fill[]): boolean

/** Aggregate CURRENT exposure across a list of open positions. The multi-
 *  position analog of evaluate — same inputs (records + marks + asOf), same
 *  mark-dependence. Internally map(evaluate) + fold, where the fold handles
 *  null marks (Σ non-null, with a missingMarkCount) and sums dollars only.
 *  Used by DailyReview / PerformanceReporting for the open-book view. */
evaluateMany(records: TradeRecord[], marks: Marks, asOf: Date): ExposureReport

/** Which declared stops were crossed by the asOf marks — per side (ADR 0010).
 *  Single-date (EOD) semantics: underlying-quoted sides compare the
 *  underlying's mark; option-quoted sides compare the option position price
 *  (net over option legs' marks). A side with incomplete marks is
 *  unevaluated — reported, never coerced. Called by the Daily Review. */
stopsHit(record: TradeRecord, marks: Marks, asOf: Date): StopsHit
```

---

## Interface

### Operations

```ts
evaluate(record: TradeRecord, marks: Marks, asOf: Date): FigureSet

isFlat(fills: Fill[]): boolean

evaluateMany(records: TradeRecord[], marks: Marks, asOf: Date): ExposureReport

stopsHit(record: TradeRecord, marks: Marks, asOf: Date): StopsHit
```

### Input types — the data contract every store must serve

```ts
/** Identifiers (type aliases for readability; backing type is string). */
type TradeId = string
type FillId = string               // store-assigned; calc ignores (needed by TradingRecordStore.correctFill + ReflectionStore fill-level journal)
type AccountId = string
type StrategyId = string           // store-owned tag; calc ignores (Performance Reporting filters on it)
type InstrumentId = string
type Price = number

/** The complete record for one Trade, as a store must return it.
 *  This type is the contract: every field here is something a store supplies
 *  and calc consumes. Nothing in FigureSet requires a field not listed here. */
type TradeRecord = {
  tradeId: TradeId
  accountId: AccountId
  underlying: InstrumentId          // risk keyed off this; Price Marks looked up by it
  strategy: StrategyId             // STORE-OWNED — calc ignores; Performance Reporting filters on it
  status: Lifecycle                 // stored authoritatively (ADR 0006); echoed, not derived
  closedAt?: Date                   // STORE-OWNED (resolved OQ 11) — present iff Closed; snapshot-regen asOf. Calc ignores.
  plan: Plan                        // original levels, committed before first fill
  revisions: PlanRevision[]        // append-only, dated (ADR 0001)
  fills: Fill[]                     // each carries instrument-type per leg (ADR 0005)
  finalFigures?: FigureSet         // present iff status === 'Closed' (ADR 0007)
}

type Plan = {
  entry:  Price                 // planned net entry price per unit — load-bearing for option-quoted readings (ADR 0010)
  stops:  Stops                 // per risk direction, each side optional (ADR 0010)
  target: Level                 // ONE profit exit — the role supplies direction (ADR 0010)
  thesis: string
  invalidation: string
  entryEmotion: string
  committedAt: Date
}

/** Declared exit levels guarding risk directions (ADR 0010). A directional
 *  Trade declares one side (long stock: downside; short stock: upside); a
 *  neutral structure (an Iron Condor) may declare both. An absent side means
 *  no declared level there — NOT "no risk." Two stops on the same side are
 *  unexpressible: the invariant is structural. */
type Stops = {
  downside?: Level
  upside?:   Level
}

/** Every declared level is a price (ADR 0010) — never a time, never prose
 *  (qualitative exit conditions live in `invalidation`). Option-position
 *  quotes are per-unit unsigned magnitudes; the stop-vs-target role supplies
 *  the direction ("stop at 4.00" = cost reaches; "target at 0.50" = cost
 *  falls to). */
type Level =
  | { basis: 'underlying',      at: Price }   // the underlying's own price
  | { basis: 'option-position', at: Price }   // the option position price — net over
                                               //   OPTION legs only; stocks never in this sum

type PlanRevision = {               // never overwrites; appends (ADR 0001)
  at: Date
  stops?:  { downside?: Level, upside?: Level }  // per-side REPLACE; absent side = unchanged;
                                                 //   removal inexpressible (ADR 0010)
  target?: Level                                  // replaces the target
  reason: string
}

type Fill = {
  fillId: FillId                    // STORE-OWNED — calc ignores; needed by TradingRecordStore.correctFill + ReflectionStore fill-level journal
  instrument: InstrumentId
  side: 'buy' | 'sell'
  quantity: number                  // unsigned; sign derived from side
  price: Price
  at: Date
  instrumentType: InstrumentType    // per leg — drives maximum risk (ADR 0005)
  contract?: OptionContract         // present iff this leg is an option (ADR 0009)
}

/** The option facts the payoff curve hinges on (ADR 0009). Present as a group
 *  or absent as a group — a stock fill carries no contract; an option fill
 *  carries all three. Never parsed out of the InstrumentId. */
type OptionContract = {
  optionType: 'call' | 'put'        // the curve's hinge direction
  strike:     Price                 // the hinge point
  expiry:     Date                  // anchors the at-expiry construction
}

type InstrumentType = 'stock' | 'long-option' | 'short-option' | 'spread'
// MVP exercises 'stock' only. Option sub-types expand when options ship —
// the shape is stable, the values grow.

type Lifecycle = 'Planned' | 'Open' | 'Closed' | 'Discarded'
// 'Discarded' (added by the PlanCommit session): committed, never entered —
// the pre-fill exit (trading-record-store semantic 19). Echoed like the rest;
// a Discarded trade evaluates like a Planned one (fills empty → planned fields
// computable, live fields null). No consumer ever does — every status filter
// excludes it.

/** Price marks for a single asOf date, keyed by instrument.
 *  The caller builds this from the fills it holds (the distinct instruments)
 *  by looking up PriceMarkStore per instrument. Plain data — serializable,
 *  portable across any boundary (IPC, web worker, snapshot/replay, native). */
type Marks = Map<InstrumentId, Price>
```

### Output type — FigureSet (the universal contract)

```ts
/** The full figure-set for one Trade at one point in time. This is the single
 *  type every coordinator reads, the closed-trade snapshot caches (ADR 0007),
 *  and PerformanceAnalytics aggregates (as a list). */
type FigureSet = {
  pnl: {
    realized: number                // from closed fills — always computable
    unrealized: number | null       // open position × (mark − avg cost); null if no mark
  }

  positionSize: number              // signed net quantity, from fills

  risk: {
    planned: Dual                   // WORST side's level reading — the single R baseline (ADR 0010); frozen at initial Plan (ADR 0005)
    plannedByDirection?: {          // per-side readings, honestly signed (ADR 0010) — detail views; PerformanceAnalytics ignores
      downside?: Dual, upside?: Dual
    }
    current: Dual | null            // position price at the current stop vs now — whole-position netting (ADR 0010); live; null if no mark or no position
    currentByDirection?: {          // the same netting per declared side (ADR 0010) — detail views
      downside?: Dual, upside?: Dual
    }
    maximum: MaxRisk | null         // payoff-curve minimum (ADR 0009), instrument-type-aware (ADR 0005); null for Planned (no fills → no curve)
  }

  reward: {
    planned: Dual                   // underlying-quoted: curve at the target (ADR 0009); option-quoted: entry-price arithmetic (ADR 0010); frozen at initial Plan
    incremental: Dual | null        // position price at the target vs now — whole-position netting (ADR 0010); live; null if no mark
  }

  rr: {
    planned: number                 // reward.planned ÷ risk.planned — always computable
    current: number | null          // reward.incremental ÷ risk.current; null if no mark
  }

  rMultiple: number                 // pnl.realized ÷ risk.planned.dollars (in R units)

  breakevens: Price[] | null        // zero-crossings of the payoff curve, ascending (ADR 0009); null for Planned (no fills → no curve)

  lifecycle: Lifecycle              // echoed from record.status — NOT derived (ADR 0006)

  revisionCount: number             // raw count of PlanRevisions
}

/** The dual presentation rule (CONTEXT.md), captured at the type level:
 *  every risk and reward figure carries both forms everywhere it appears. */
type Dual = {
  ratio: number                     // per-unit, size-independent: 1-share and 100-share
  dollars: number                   // trades share the same ratio; dollars scale with size
}

/** Maximum risk — the payoff curve's minimum (ADR 0009), instrument-type-aware
 *  (ADR 0005). A discriminated union so
 *  the type system enforces "narrow before reading amount." The unbounded case
 *  (naked short options) carries no amount — there is no finite number. */
type MaxRisk =
  | { bounded: true,  amount: Dual }   // stock (whole position), long-option (premium), defined-risk spread (width − premium, net)
  | { bounded: false }                  // naked short option — catastrophic loss has no cap

/** Aggregate CURRENT exposure across a list of open positions (evaluateMany's
 *  return). The multi-position analog of FigureSet's current fields. Every
 *  mark-dependent field carries a `missingMarkCount` — the number of positions
 *  whose mark was absent (FigureSet field null), so the UI can show "$X
 *  unrealized across N positions, M missing a mark" (the Daily Review mark-
 *  collection prompt at portfolio scale). Dollars only: ratios across mixed
 *  instruments/sizes are meaningless, so Dual is not used here. */
type ExposureReport = {
  positionCount: number

  totalUnrealized: {                   // Σ pnl.unrealized across positions with a mark
    dollars: number                    //   (FigureSet.pnl.unrealized is null iff no mark — calc semantic 4)
    missingMarkCount: number           //   positions skipped because their mark was absent
  }

  totalCurrentRisk: {                  // Σ risk.current.dollars across positions with a mark
    dollars: number                    //   (risk.current is null iff no mark or no position)
    missingMarkCount: number
  }

  totalPlannedRisk: {                  // Σ risk.planned.dollars — the commitment baseline across open trades
    dollars: number                    //   (planned risk is always computable — frozen at plan, no mark needed)
  }

  totalIncrementalReward: {            // Σ reward.incremental.dollars across positions with a mark
    dollars: number                    //   (reward.incremental is null iff no mark)
    missingMarkCount: number
  }
}
// Absent by design: positionSize, risk.maximum, rMultiple, revisionCount, pnl.realized.
//   - positionSize / risk.maximum don't aggregate across mixed instruments/types.
//   - rMultiple / pnl.realized are outcome-only (realized) — not exposure.
//   - revisionCount is a PerformanceAnalytics discipline metric, not a current figure.

/** Which declared stops the asOf marks crossed (stopsHit's return, ADR 0010).
 *  A point-in-time event check on OPEN trades — the Daily Review's question —
 *  not a figure and never cached in a close snapshot. */
type StopsHit = {
  hit: {                            // present iff evaluated AND crossed
    downside?: { level: Level, mark: Price }
    upside?:   { level: Level, mark: Price }
  }
  unevaluated: Array<'downside' | 'upside'>   // sides whose marks were incomplete —
}                                              //   counted, not coerced (semantic 4)
```

---

## Decided semantics

Each ruling cites the principle or ADR it derives from. Veto any during review.

1. **Two operations only: `evaluate` and `isFlat`.** The monolith shape (design-
   it-twice candidate A). One `evaluate` returns the entire FigureSet behind a
   single call; `isFlat` is the separate cheap transition detector. The
   alternatives (static/live split; series-native) were rejected — see
   *Alternatives considered*. *(Overview rule 2; depth principle.)*

2. **`isFlat` is separate from `evaluate`, and boolean ops use the `is`/`has`
   prefix.** `isFlat(fills)` is a cheap sum of signed quantities — called on
   every fill by FillEntryCoordinator. Only the flat-detecting fill triggers
   the expensive `evaluate` to build the close snapshot. If `isFlat` were a
   boolean inside FigureSet, the coordinator would have to call `evaluate`
   (which needs marks) on every fill just to read one bit. *(ADR 0006, 0007;
   Java boolean-naming convention.)*

3. **`lifecycle` is echoed from `record.status`, never derived.** Calc reads
   the stored status field (ADR 0006); it does not compute Planned/Open/Closed
   from fills. The field exists in FigureSet so consumers reading a snapshot
   (ADR 0007) see the status without re-loading the record. *(ADR 0006.)*

4. **Mark-dependent fields are `null` (not `0`) when the mark is missing.** `0`
   means "no unrealized P&L" (a flat position); `null` means "can't compute —
   no mark." The distinction drives the Daily Review's "enter missing marks"
   prompt: `null` unresolved P&L is a signal to collect the mark, not a zero.
   *(CONTEXT.md: Daily Review.)*

5. **Marks is a plain `Map<InstrumentId, Price>`, not a function.** A function
   resolver would be lazier (a generic forwarder need not enumerate instruments
   up front) — on the enumeration axis, the function wins. But a function-typed
   parameter is a *live computation* that can't cross serialization, IPC,
   web-worker, or native-compile boundaries, and calc's interface is the
   system's data contract — the seam where inert data is worth more than lazy
   lookup. We chose the deliberately weaker map interface because "it's just a
   bag of numbers, populated once" is the *guarantee* we want at this seam. The
   caller's enumeration cost (it must pre-populate the map) is cheap and will be
   absorbed by a deep PriceMarkStore op (`buildMarksFromFills`), so no caller
   duplicates the logic. *(OQ 1 → B; data-over-functions at the data-contract
   seam, overriding A's enumeration advantage.)*

6. **`Dual` everywhere — calc returns both ratio and dollars for every risk and
   reward figure.** The dual presentation rule is a domain rule (CONTEXT.md),
   not a UI feature. Calc is the derivation authority; returning both forms
   means every consumer gets the dual view for free, with no re-derivation
   scattered across presentation code. *(OQ 3 → A; CONTEXT.md: dual
   presentation rule.)*

7. **Maximum risk is a discriminated union, not a sentinel or flag.**
   `{bounded: true, amount: Dual}` for stock/long-option/spread;
   `{bounded: false}` for naked short options. The type system forces callers
   to narrow before reading `amount` — the "unbounded" teaching moment
   (CONTEXT.md: stock-vs-option maximum-risk gap) can't be silently rendered
   as a number. Rejected: `Infinity` sentinel (silent divide-by-zero, no
   compiler help); `isBounded` flag (type permits reading amount when
   unbounded). *(OQ 2 → A; ADR 0005.)*

8. **`revisionCount` (raw count), not `planRevisionRate`.** Calc counts
   revisions — a fact about the record. Normalizing to a rate is the aggregator's
   job. The overview's `planRevisionRate` field is renamed here. **(Forward note
   from PerformanceAnalytics drill-down:)** the *per-trade* rate
   (`meanRevisions`) is PerformanceAnalytics's; the *per-day* rate is not
   computable from FigureSet (it carries no duration) and is open — OQ 15.
   *(ADR 0001; depth — one fact, rate is its aggregation.)*

9. **"Current" levels = the latest revision's levels (or the original Plan's
   if no revisions exist).** Planned levels are always the original Plan's
   (ADR 0001, frozen); current stop/target walk forward through the revision
   history — **per side**: each side's level walks its own revision history
   independently (ADR 0010). A stop revision changes current risk, never
   planned risk. *(ADR 0001, 0005, 0010.)*

10. **`positionSize` is signed net from fills** (buy positive, sell negative),
    summed across all legs. Derived, not stored. Determines the dollar scaling
    of every `Dual` figure. *(CONTEXT.md: position size.)*

11. **No separate "planned-vs-realized R:R" field.** It's `rr.planned` vs
    `rMultiple` — both already present. The comparison is a presentation
    juxtaposition, not a new figure. *(Depth — existing fields compose.)*

12. **`rMultiple` = `pnl.realized ÷ risk.planned.dollars`.** The classic
    trading-literature convention: outcome as a multiple of planned risk (the
    commitment baseline, ADR 0005). Signed: a loss is negative R.

13. **Planned-state figures — `maximum` and `current` are null before the first
    fill (audit finding, resolved).** A Planned trade has zero fills, so
    `instrumentType` (a Fill attribute, ADR 0005) doesn't exist yet — therefore
    `risk.maximum` is null. `risk.current` is also null: with no position there's
    nothing live at risk (current risk is meaningful only once entered). What
    *is* computable at plan-commit — `risk.planned`, `reward.planned`, `rr.planned`
    — is exactly what validates the plan before entry. The maximum-risk teaching
    moment (current vs maximum, the stock-vs-option gap) lands *after* entry,
    when the actual position's instrument type is known, not before. instrumentType
    stays on the Fill (ADR 0005 unchanged); we rejected deriving it from strategy
    because strategy→instrumentType is ambiguous for multi-instrument/multi-form
    strategies (breakout = stock or option; wheel spans puts/shares/calls) and
    strategy is trader-customizable (requiring user-maintained mapping data the
    calc would depend on, breaking purity). *(ADR 0005; rule 2.)*

14. **`evaluateMany` is the multi-position analog of `evaluate` — aggregate
    *current* exposure across open positions.** Same inputs (`TradeRecord[] +
    marks + asOf`), same mark-dependence: current P&L and current risk move with
    the mark. It is `map(evaluate) + fold` internally. The honest reason it
    earns an op (rather than living in a coordinator) is that the fold is not a
    plain sum — it applies calc's own null/`Dual` conventions at portfolio scale
    (semantics 15–17 below), and that tested arithmetic belongs in the module
    where the conventions originate, not scattered across coordinator/UI code.
    It does **not** produce a `FigureSet`-shaped roll-up: `positionSize`,
    `risk.maximum`, `rMultiple`, `pnl.realized` don't aggregate across mixed
    instruments/types or are outcome-only (realized) — see semantic 17. *(ADR
    0008; deletion test — deleting it scatters the null-handling + dollars-only
    sum into N callers.)*

15. **Null marks are counted, not coerced to zero.** `pnl.unrealized`,
    `risk.current`, and `reward.incremental` are `null` when a position's mark
    is absent (semantic 4). `evaluateMany` sums the **non-null** values and
    records a `missingMarkCount` per field. `$0 unrealized` (a flat open
    position) and `null unrealized` (no mark) are different facts; the aggregate
    preserves the distinction so the UI can surface "M positions are missing a
    mark" — the Daily Review mark-collection prompt at portfolio scale. *(Calc
    semantic 4 extended to the aggregate.)*

16. **Dollars only — `Dual` ratios are not summed across positions.** The
    per-unit ratio is size-independent but instrument-specific; summing ratios
    across AAPL shares and SPY calls is meaningless. `ExposureReport` fields
    carry `dollars` only (no `ratio`). `totalPlannedRisk.dollars` is meaningful
    because dollars share a unit; the corresponding ratio would not. *(CONTEXT.md:
    dual presentation rule — the dollar side is the aggregatable form.)*

17. **`ExposureReport` is deliberately narrower than `FigureSet`.** Absent by
    design: `positionSize` and `risk.maximum` (don't aggregate across mixed
    instruments/types), `rMultiple` and `pnl.realized` (outcome-only, realized —
    not current exposure), `revisionCount` (a PerformanceAnalytics discipline
    metric). The report carries exactly the current-figure aggregates that are
    meaningful across a mixed open book: unrealized P&L, current risk, planned
    risk, incremental reward — all dollars, each mark-dependent one with a
    missing-mark count. *(Depth — don't carry fields that would be N/A.)*

18. **The payoff curve derives the structure-level quantities (ADR 0009).** Calc
    constructs the position's payoff curve — P&L as a piecewise-linear function
    of underlying price at expiry, summed across the filled legs — and reads:
    `risk.maximum` = the curve's minimum (`{bounded: false}` when unbounded
    below — naked shorts); `breakevens` = its zero-crossings, interpolated
    within segments, ascending; maximum reward = its maximum (computed
    internally; exposed on FigureSet when a consumer needs one — none does
    today). One construction serves every structure — a single stock is a
    straight line, a spread is hinged at its strikes, a condor is the sum of
    two spreads — so calc holds **no per-strategy formula catalog** and needs
    **no directional-bias input**: the curve's shape *is* the bias (this is why
    `strategy` remains a calc-ignored store-owned tag — ADR 0009 *preserves*
   the existing decision rather than reversing it). The trader's declared
   stop/target levels are read against the curve — a stop at a breakeven
   yields $0 planned risk. Their representation is settled by ADR 0010:
   per-direction stops, a single target, each a priced level with an explicit
   quote basis (semantics 19–21 below). **Boundary:** the curve is an
    *expiry* (intrinsic-value) construction. It serves maximum/planned risk and
    breakevens — not live option P&L or live risk, which are mark-to-market
    (extrinsic value at the daily mark; semantic 4's mark-dependence) and
   which the options release must own as a separate computation. For the
   stock-only MVP nothing changes: the curve is trivially linear (breakeven
   = cost basis; maximum = whole position to zero). *(ADR 0009.)*

19. **Declared levels: per-direction stops, single target, explicit quote
   basis (ADR 0010).** `Stops = {downside?, upside?}` — the direction enum is
   provably closed (one underlying, price moves two ways), so the
   one-stop-per-side invariant is *structural*; two stops on the same side
   are unexpressible, and an absent side means "no declared level," not "no
   risk." `target` is a single level — under the role-supplies-direction
   convention, a profit exit is one number whichever way the trade profits
   (a condor's "buy back at $0.50" has no direction to belong to); two-sided
   profit taking is deferred with its promoted shape recorded (ADR 0010).
   Every level is a **price** — time is not modeled, and qualitative exit
   conditions already live in `invalidation`. Levels are **per-unit, not
   dollars** (declared at plan-commit, before fills establish a size); the
   option-position basis sums **option legs only** ("buy back the call at
   $0.20" netted with 100 shares is nonsense), and single-leg option
   positions collapse to that leg's price. *(ADR 0010.)*

20. **`risk.planned` = the worst side's reading — the single R baseline.**
   With stops on both directions, each side has its own reading and
   `rMultiple` divides by **one** figure: the worst (largest-dollar) side.
   `plannedByDirection` / `currentByDirection` carry the per-side detail as
   **additive optional** FigureSet fields — detail views display each
   direction separately; PerformanceAnalytics folds the singles and ignores
   them; snapshots cache them harmlessly. No consumer changes. *(ADR 0010;
   the metrics-are-fields precedent from PerformanceAnalytics.)*
   **Clarified by the PlanCommit session:** under ADR 0010's honest signing a
   side's reading can be a *profit* (in-tent); the worst side is the
   largest-dollar **loss** — a profit-reading side is never worst, and a plan
   whose every side reads as profit has no baseline (blocked at commit —
   plan-commit-coordinator.md decided semantics 3). A plan with zero declared
   sides is structurally unreachable: `commit`/`importTrade` reject it
   (trading-record-store semantic 18), so `evaluate` never sees empty `Stops`.

21. **Level readings split by basis.** *Underlying-quoted stops* read
   against the **expiry payoff curve** (semantic 18), honestly signed: a
   stop inside a neutral structure's profit tent reads as a *profit*, and
   PlanCommit validation surfaces that teaching moment — calc holds one
   computation with no special cases, and the store accepts the fact
   (validation is the coordinator's). *Option-quoted levels* are evaluated
   by **comparison against net option marks** — a fact lookup, not a
   valuation; this does not cross ADR 0009's mark-to-market boundary.
   Planned figures for option-quoted levels are arithmetic off the planned
   entry price (credit $2.00, stop $4.00 ⇒ $2.00 planned risk — no curve,
   no marks). A missing option-leg mark leaves the level **unevaluated**
   (`null`, semantic 4 — "costs $0 to close" and "no mark" are different
   facts). *(ADR 0009, 0010.)*

22. **`current` risk and `incremental` reward are whole-position
   mark-netting.** Replaces the stock-era `(mark − stop) × size` /
   `(target − mark) × size` formulas, which misstate any multi-leg trade: a
   covered call's live risk includes the short call's remaining value
   (stock 48 → stop 45 reads $275 whole-position, not $300 stock-only).
   Both figures = **position price** (net over ALL legs) at the stop/target
   vs position price now. `risk.maximum` and the planned readings were
   already whole-position via the payoff curve (ADR 0009 sums every leg);
   single-leg positions collapse to the old formulas. *(ADR 0010 — the
   covered-call finding.)*

23. **`stopsHit` — single-date, per-side, unevaluated-not-coerced.** "Hit" =
   the `asOf` mark crossed the declared level (EOD marks are all the system
   has; a gap through a level and back intraday is invisible and honestly
   unreported). Underlying-quoted sides compare the underlying's mark;
   option-quoted sides compare the option position price from option marks.
   "Was it hit any day since declaration" composes caller-side over
   `getMarkSeries` — calc stays per-date. A hit on a multi-direction
   structure reports the *side*; it does not close the Trade (the universal
   flat-close rule is untouched — CONTEXT.md: close rule). *(ADR 0010.)*

24. **Revision deltas: per-side replace; removal inexpressible.** A revision
   replaces a side's level (`stops: {downside: …}`) or the target; an absent
   side = unchanged. A revision cannot *un-declare* a side — matching the
   pre-existing model (a stop revision could only ever move the stop).
   "Moving a stop away" is a revision to a farther level, which the
   discipline metrics then see. *(ADR 0001, 0010.)*

---

## Worked examples

### Planned trade — AAPL, plan: entry $150, stop $147, target $156 (no fills yet)

| field | computation | value |
|---|---|---|
| `positionSize` | no fills | `0` |
| `pnl.realized` | no fills | `$0` |
| `pnl.unrealized` | no position | `null` |
| `risk.planned` | ratio: 150−147=$3, dollars: 3×0 (no size) | `{3, $0}` |
| `risk.current` | no position → not at risk yet | `null` |
| `risk.maximum` | no fills → no instrumentType | `null` |
| `reward.planned` | ratio: 156−150=$6 | `{6, $0}` |
| `reward.incremental` | no mark | `null` |
| `rr.planned` | 6÷3 | `2.0` |
| `rr.current` | no current risk | `null` |
| `rMultiple` | no realized P&L | `0R` |
| `breakevens` | no fills → no curve | `null` |

Note: planned dollars are `$0` because position size is zero pre-entry — the
*ratio* (1:2) is what validates the plan. Dollar figures gain meaning once fills
establish a position size. This is exactly the plan-commit validation scope:
planned R:R is enough to validate the plan before entry (decided semantics 13).

Under ADR 0010, this plan declares `stops: { downside: {basis:'underlying',
at:147} }` and `target: {basis:'underlying', at:156}` — a directional stock
trade exercises the underlying basis only. `plannedByDirection` is
`{downside: {3, $0}}`; the worst side is the only side.

### Stock trade — AAPL, buy 100 @ $150, stop $147, target $156

**Mid-trade, mark at $152 (Open):**

| field | computation | value |
|---|---|---|
| `positionSize` | +100 | `100` |
| `pnl.realized` | no closing fills | `$0` |
| `pnl.unrealized` | (152−150)×100 | `+$200` |
| `risk.planned` | ratio: 150−147=$3, dollars: 3×100 | `{3, $300}` |
| `risk.plannedByDirection` | downside declared, upside absent | `{downside: {3, $300}}` |
| `risk.current` | whole-position netting, one leg → (152−147)×100 | `{5, $500}` |
| `risk.currentByDirection` | netting at the downside stop vs now | `{downside: {5, $500}}` |
| `risk.maximum` | stock to zero: 152×100 | `{bounded, {15200, $15200}}` |
| `reward.planned` | ratio: 156−150=$6, dollars: 6×100 | `{6, $600}` |
| `reward.incremental` | ratio: 156−152=$4, dollars: 4×100 | `{4, $400}` |
| `rr.planned` | 600÷300 | `2.0` |
| `rr.current` | 400÷500 | `0.8` |
| `rMultiple` | 0÷300 | `0R` |
| `breakevens` | curve (a line, slope +100/$) crosses zero at cost basis | `[150]` |
| `revisionCount` | zero revisions | `0` |

**After closing — sell 100 @ $156 (Closed, snapshot cached per ADR 0007):**

| field | computation | value |
|---|---|---|
| `pnl.realized` | (156−150)×100 | `+$600` |
| `pnl.unrealized` | flat — no open position | `$0` |
| `risk.planned` | unchanged — frozen | `{3, $300}` |
| `risk.current` | flat — nothing at risk | `{0, $0}` |
| `rMultiple` | 600÷300 | `+2R` |

### Covered call — long 100 AAPL @ $150 + short 1 AAPL-$155 call @ $3.00

Marks at $152 / call $1.50. The caller builds the map from the fills' instruments:

```ts
const marks = new Map([
  ['AAPL',      152],    // from PriceMarkStore.get('AAPL', asOf)
  ['AAPL-155C', 1.50],   // from PriceMarkStore.get('AAPL-155C', asOf)
])
evaluate(record, marks, asOf)
```

Inside calc, the leg combination is fully internal (never in the caller):

```
sharePnl = (152 - 150) × 100    = +$200      // long stock leg
optPnl   = (3.00 - 1.50) × 100  = +$150      // short call leg (sold 3.00, buyback 1.50)
unrealized = $200 + $150        = +$350
```

### Open book — evaluateMany across three open positions

Three open trades; the caller has already resolved marks for the day (one of
the three lacks a mark):

| Trade | positionSize | unrealized | risk.current | risk.planned | reward.incremental |
|-------|-------------|------------|--------------|--------------|--------------------|
| AAPL (100 @ $150) | +100 | +$200 (mark $152) | $500 | $300 | $400 |
| MSFT (50 @ $300, stop $294) | +50 | +$250 (mark $305) | $550 | $300 | $250 |
| TSLA (—, no mark today) | +20 | **null** | **null** | $160 | **null** |

```ts
const records = tradingRecord.listTrades({ status: 'Open' })
const marks = priceMarks.buildMarksFromFills(allOpenFills, today)  // AAPL, MSFT present; TSLA absent
calc.evaluateMany(records, marks, today)
// → {
//     positionCount: 3,
//     totalUnrealized:      { dollars: +$450, missingMarkCount: 1 },  // 200+250; TSLA null → counted
//     totalCurrentRisk:     { dollars: $1050, missingMarkCount: 1 },  // 500+550
//     totalPlannedRisk:     { dollars: $760 },                         // 300+300+160 (no mark needed)
//     totalIncrementalReward:{ dollars: +$650, missingMarkCount: 1 }, // 400+250
//   }
```

The TSLA position is **counted in `positionCount` and `totalPlannedRisk`**
(both mark-free) but **absent from the mark-dependent sums** and reflected in
`missingMarkCount: 1` — surfacing "1 position is missing a mark" for the Daily
Review prompt.

### Caller's-eye usage

```ts
// 1. FillEntryCoordinator — the cheap/rare split (ADR 0006 + 0007)
const fills = store.getFills(tradeId)
if (calc.isFlat(fills)) {                                // cheap: every fill
  const marks = priceMarks.buildMarksFromFills(fills, now)    // deep PriceMarkStore op
  const figures = calc.evaluate(record, marks, now)           // expensive: only at close
  store.setStatus(tradeId, 'Closed')
  store.storeFinalFigures(tradeId, figures)                   // ADR 0007 snapshot
}

// 2. Daily Review — live figures for an open trade
const marks = priceMarks.buildMarksFromFills(fills, today)
const figures = calc.evaluate(record, marks, today)
// figures.pnl.unrealized, figures.risk.current, figures.rr.current ...

// 3. Evolution chart — series via composition (the monolith bet)
for (const day of dateRange) {
  const dayMarks = priceMarks.buildMarksFromFills(fills, day)
  series.push(calc.evaluate(record, dayMarks, day).risk)
}

// 4. Performance report on a closed trade — NO calc call
const figures = trade.finalFigures                             // O(1) snapshot read (ADR 0007)

// 5. Open-book exposure (Daily Review / Performance Reporting) — evaluateMany
const openRecords = tradingRecord.listTrades({ status: 'Open' })
const allFills = openRecords.flatMap(r => r.fills)
const marks = priceMarks.buildMarksFromFills(allFills, today)  // one marks map for all open positions
const exposure = calc.evaluateMany(openRecords, marks, today)  // one call → aggregate current exposure
// exposure.totalUnrealized.dollars, exposure.totalCurrentRisk.dollars,
// exposure.totalUnrealized.missingMarkCount → "N positions missing a mark"

// 6. Daily Review — which declared stops did today's marks cross (ADR 0010)
const hits = calc.stopsHit(record, marks, today)
// hits.hit.downside → "your downside stop was hit today" (level + crossing mark)
// hits.unevaluated → sides with incomplete marks — the mark-collection prompt
```

---

## Sequence: fill-entry close path

The most instructive flow — `isFlat` and `evaluate` cooperate with the
coordinator. (Coordinator internals are illustrative; pinned in its own
drill-down.)

```
trader → FillEntryCoordinator.recordFill(tradeId, fill)
  → TradingRecordStore.appendFill(tradeId, fill)
  → fills = TradingRecordStore.getFills(tradeId)
  → calc.isFlat(fills)                                     // cheap — no marks needed
      └─ false → return { statusAfter: 'Open' }            // common case: no evaluate call
      └─ true  →                                           // rare: the closing fill
          → marks = PriceMarkStore.buildMarksFromFills(fills, now)
          → figures = calc.evaluate(record, marks, now)    // expensive — builds snapshot
          → TradingRecordStore.setStatus(tradeId, 'Closed')
          → TradingRecordStore.storeFinalFigures(tradeId, figures)
          → ReflectionStore.createPlaceholder(tradeId, 'post-close', required=true)
          → return { statusAfter: 'Closed' }
```

The split pays off here: N−1 fills do the cheap `isFlat` only; the one
flat-detecting fill pays the single `evaluate`. No per-fill full-figure
recomputation.

## Sequence: daily-review live evaluation

```
trader → DailyReviewCoordinator.runDailyReview(today)      // pinned: daily-review-coordinator.md
  → openRecords = TradingRecordStore.listTrades({ status:'Open' })   // cheap indexed filter (ADR 0006), full records
  → marks = PriceMarkStore.buildMarksFromFills(allOpenFills, today)  // ONE map for every calc call
  → for each open trade:
      → figures = calc.evaluate(record, marks, today)      // live figures
      → hits = calc.stopsHit(record, marks, today)         // declared stops crossed by today's marks (ADR 0010)
  → exposure = calc.evaluateMany(openRecords, marks, today)           // the open-book rollup (ADR 0008)
  → [assemble into DailyReviewView — figures, hits, owed, market, exposure, marksDue, dayEntries]
```

## Sequence: evolution chart series

```
chart → for each day in trade duration:
    → dayMarks = PriceMarkStore.buildMarksFromFills(fills, day)
    → figures = calc.evaluate(record, dayMarks, day)
    → collect figures.risk (planned, current, maximum) + figures.reward
← series arrays for the chart's risk/reward bands
```

The monolith bet: the per-day series is a natural composition of point-
evaluates. Planned figures are recomputed per day (date-invariant but cheap
arithmetic over already-loaded fills); the alternative of a calc-owned
`evolution()` op was rejected for absorbing chart projection into calc.

## Sequence: open-book exposure (evaluateMany)

The aggregate-current-exposure flow. The coordinator resolves one marks map
across all open positions, then makes one calc call. (Pinned in
[daily-review-coordinator.md](daily-review-coordinator.md) semantic 4.)

```
trader → DailyReviewCoordinator.runDailyReview(today)
  → openRecords = TradingRecordStore.listTrades({ status:'Open' })
  → allFills = openRecords.flatMap(r => r.fills)
  → marks = PriceMarkStore.buildMarksFromFills(allFills, today)  // one map for all open positions
  → exposure = calc.evaluateMany(openRecords, marks, today)       // one call → ExposureReport
  ← exposure (totalUnrealized, totalCurrentRisk, totalPlannedRisk, totalIncrementalReward + missingMarkCount)
```

The portfolio-exposure read is a single calc call over a list, mirroring how the
single-trade read is a single calc call over one record. The mark-resolution
loop stays in the coordinator (it owns the marks map); the figure-arithmetic
fold (null-handling, dollars-only) is calc's. Contrast the per-trade daily-
review loop above, which calls `evaluate` per trade for the per-trade detail
view — both are mark-dependent calc calls, one point-shaped, one list-shaped.

---

## Requirements fulfilled / exported

### Closed here (open questions resolved)

| OQ | Resolution |
|---|---|
| **1 — MarkResolver shape** | **`Marks: Map<InstrumentId, Price>`.** Plain data, caller-built. Portable across any boundary. |
| **2 — Unbounded max risk** | **Discriminated union** `{bounded:true, amount} \| {bounded:false}`. |
| **3 — Dual presentation** | **`Dual` everywhere** in FigureSet. Calc is the derivation authority. |

### Exported to downstream sessions (the data contract)

These are commitments — downstream drill-downs must serve these shapes:

- **→ TradingRecordStore:** `getTradeRecord()` must return exactly `TradeRecord`
  (tradeId, accountId, underlying, status, plan, revisions, fills,
  finalFigures?). `getFills()` must return `Fill[]` for `isFlat`. The
  `finalFigures?: FigureSet` field and `storeFinalFigures()` write are the
  ADR 0007 cache seam.
- **→ PriceMarkStore:** must serve per-instrument, per-date lookups so callers
  can build `Marks` maps. The `(instrument, date)` keying (ADR 0002) maps
  directly. **Exported requirement:** a deep op `buildMarksFromFills(fills,
  date): Marks` (or a shape projecting to scalar) that returns the marks map
  for the distinct instruments in `fills` — one op absorbing the build-marks
  step for FillEntry, DailyReview, and the chart. Exact return shape (scalar
  `Price` map vs full `PriceMark`) is the PriceMarkStore drill-down's call.
- **→ PerformanceAnalytics:** aggregates `FigureSet[]` (one per **closed** trade
  in scope). The per-trade FigureSet carries everything the portfolio *outcome*
  roll-up needs: `rMultiple` (for R-distribution), `revisionCount` (for aggregate
  plan-revision-rate), `pnl.realized` (for P&L summaries). Closed trades read
  the snapshot; **open trades do not feed the outcome aggregate** — `rMultiple`
  is realized-only (semantic 12), so an open trade's snapshot is a non-outcome
  zero that would distort every R-based metric. Open-trade **exposure** is a
  mark-dependent current-figure aggregate — served by calc's `evaluateMany`
  (semantic 14), *not* by PerformanceAnalytics (which is a mark-free fold).
  PerformanceAnalytics and calc's `evaluateMany` split cleanly on mark-
  dependence: outcome statistics (closed snapshots, no marks) vs current
  exposure (open positions, marks required). *(See performance-analytics.md +
  ADR 0008.)*
- **→ FillEntryCoordinator:** owns the `isFlat` → `evaluate` → `storeFinalFigures`
  close path (sequence above). It builds the `Marks` map via the
  `priceMarkStore.buildMarksFromFills(fills, date)` op (exported to
  PriceMarkStore above) — not coordinator-side logic.
- **→ DailyReviewCoordinator / PerformanceReportingCoordinator:** use
  `evaluateMany(openRecords, marks, today)` for the open-book exposure view
  (sequence above). One calc call over the open-position list — the mark-
  resolution stays coordinator-side, the figure fold is calc's. No coordinator
  re-implements the null-handling or dollars-only-sum arithmetic.
- **→ All four coordinators:** consume `FigureSet` as the read shape. No
  coordinator re-derives figures; all read either a live `evaluate()` result
  or a cached `finalFigures` snapshot.

---

## Open items

| Item | Owned by |
|---|---|
| `buildMarksFromFills(fills, date): Marks` — a deep op on **PriceMarkStore** that returns the marks map for the distinct instruments in `fills`. Decided as the home for this logic (one op absorbs it for FillEntry, DailyReview, and the chart — no caller duplicates it). Exact return shape (scalar `Price` map vs full `PriceMark` projected to scalar) deferred to the PriceMarkStore drill-down. | PriceMarkStore drill-down |
| **Planned-state figures — RESOLVED** (audit finding, now decided semantics 13). `risk.maximum` and `risk.current` are null before the first fill (no fills → no instrumentType; no position → nothing live at risk). Planned R:R is the plan-commit validation scope. instrumentType stays on the Fill (ADR 0005). Resolved in this session. | — |
| **Snapshot `asOf` / `closedAt` (audit finding).** `evaluate` takes `asOf: Date`, but regenerating a corrected closed-trade snapshot needs the *original close date* — and nothing in `TradeRecord` carries it. Either the record needs `closedAt`, or the snapshot (`finalFigures`) must carry its own `asOf`. Surface during TradingRecordStore drill-down. | TradingRecordStore drill-down |
| **Correction invalidating stored status (audit finding).** A fill correction could change net position from zero to non-zero (Closed → should-be-Open). `isFlat` detects the forward transition (Open→Closed); the backward path (status-invalidating correction) is unwritten. ADR 0006 requires stored status agree with derived status. | FillEntryCoordinator drill-down |
| Exact P&L accounting for multi-leg options (cost-basis tracking across legs) | Implementation; calc's internal seam, not interface. The `Fill[]` input carries enough; the algorithm is internal. |
| `InstrumentType` value expansion for options sub-types (naked vs covered, single-leg vs spread) | Options-release drill-down. The `InstrumentType` union grows; the `MaxRisk` discriminated union shape is stable. Put/call, strike, and expiry are NOT part of this — they live on `OptionContract` (ADR 0009). |
| **Payoff-curve companion semantics (ADR 0009).** The contract inputs are settled: option legs carry `contract: { optionType, strike, expiry }` on `Fill`, present as a group iff the leg is an option — calc must never parse `InstrumentId` conventions like `'AAPL-155C'`. Still open, as computation semantics (not contract facts): multi-expiry anchoring (which expiry defines "the" curve when legs differ), anchor reconciliation (the curve's minimum is from cost basis net of premium; CONTEXT.md states maximum risk from current price — bridging the two needs the mark-to-market model), and exact multi-leg cost-basis accounting (row below). | Options-release drill-down |
| **Deferred level generalizations (ADR 0010 leaves-open).** Per-leg option quotes on multi-direction structures (a condor managed per side — single-direction option trades work today); two-sided profit targets (promoted shape recorded in ADR 0010: `target → {downside?, upside?}` mirroring `Stops`; figures stay single by fold policy, so FigureSet/PerformanceAnalytics/snapshots are untouched and historical data stays valid); time stops (no requirement); mark-to-market level readings (options release; an ADR 0007-style regeneration when it arrives). | When a requirement emerges / options-release drill-down |

---

## Alternatives considered

### Module shape (design-it-twice)

- **Candidate A — Monolith** (adopted). `evaluate()` + `isFlat()` +
  `evaluateMany()`. One universal FigureSet type for the single-trade result;
  the chart composes its per-day series by calling `evaluate` per day.
  `evaluateMany` (added by the PerformanceAnalytics drill-down, ADR 0008) is the
  multi-position analog of `evaluate` — same inputs, same mark-dependence —
  returning `ExposureReport` for the open-book aggregate. Deepest on op count
  relative to behavior; one FigureSet type pins every store's contract. Cost:
  static figures recomputed per chart-day (cheap arithmetic over loaded fills);
  every consumer receives the whole FigureSet even if it wants one number
  (local projection by consumers is the depth payoff).

- **Candidate B — Static/Live split** (rejected). `realizedFigures()` +
  `markFigures()` + `isFlat()`. Splits mark-independent figures from
  mark-dependent ones so the closed-trade snapshot skips mark resolution
  entirely. Rejected because mark resolution is a cheap map lookup and a flat
  position zeroes the live figures anyway — the "wasted" work is nearly free,
  while B's cost (two contract types; callers must choose a subset) is real
  and permanent. Two types downstream fractures the "one data contract"
  principle.

- **Candidate C — Series-native** (rejected). `evaluate()` + `evolution()` +
  `isFlat()`. Calc owns the per-day risk/reward series as a first-class op.
  Tempting because the R:R evolution chart is the signature visualization, but
  a per-day series is a natural composition of point-evaluates, and pushing it
  into calc risks calc absorbing chart-specific projection logic. Extra series
  type in the contract. Rejected on the depth/seam principle.

### MarkResolver shape (OQ 1)

- **Option A — Function resolver** (rejected, despite winning on enumeration).
  `marks: (instrument, date) => Price`. A function is a *pull* interface — it
  can be a generic forwarder (`priceMarkStore.asResolver()`) that knows nothing
  about which instruments will be asked, so the caller need not enumerate them.
  In this respect A generalizes B: a hard-coded per-instrument function is "a
  map wearing a function costume" (enumeration-equivalent to B), but a generic
  forwarder is lazier and keeps "which instruments?" inside calc. **On the
  enumeration axis, A wins.** Rejected anyway because a function-typed parameter
  is a *live computation* that can't cross serialization, IPC, web-worker, or
  native-compile boundaries — and calc's interface is the system's data
  contract, the seam where "it's just data" is worth more than lazy lookup.

- **Option B — Pre-materialized map** (adopted). `Marks: Map<InstrumentId,
  Price>`. A map is a *push* interface — empty until populated, so the caller
  must enumerate the instruments up front. **This is B's real cost vs A.** But
  B is inert data: serializable, portable across any boundary, native-safe. We
  chose the deliberately weaker interface because, at the data-contract seam,
  A's extra power ("this value might be computed or deferred per call") is a
  hazard, not a feature. The enumeration cost is cheap — the instruments are in
  the fills the caller already holds — and will be absorbed by a deep
  PriceMarkStore op (`buildMarksFromFills`, see open items) so no caller
  duplicates it.

- **Option C — Coordinator pre-fetch** (rejected). Coordinator resolves marks
  and passes resolved values into evaluate. Rejected because the evolution
  chart is also a caller but not a coordinator — it would duplicate resolution
  logic — and calc's signature would grow with every new mark-requiring
  figure.

### Unbounded maximum risk (OQ 2)

- **Option A — Discriminated union** (adopted). `{bounded:true, amount} |
  {bounded:false}`. Type system enforces narrow-before-read.

- **Option B — Infinity sentinel** (rejected). `{ratio: Infinity, dollars:
  Infinity}`. Silent divide-by-zero downstream; no compiler reminder; easy to
  render as $∞ by mistake.

- **Option C — isBounded flag** (rejected). `{amount: Dual, isBounded:
  boolean}`. Type permits reading amount when unbounded; `isBounded: false`
  with `amount: {0, $0}` is an inconsistent state the type allows.

### Dual presentation (OQ 3)

- **Option A — Calc returns Dual** (adopted). Every risk/reward figure is
  `{ratio, dollars}`. The dual rule is domain-level; calc is the authority.

- **Option B — Calc returns ratios; presentation derives dollars** (rejected).
  Single canonical form, no redundancy. But every consumer wanting dollars
  must call a helper; the dual rule's enforcement scatters to presentation.

- **Option C — Calc returns dollars; presentation derives ratios** (rejected).
  Dollars are the "real money" figure, but ratios are the primary pedagogical
  view (trade quality is size-independent). Making ratios secondary works
  against the app's teaching purpose.

### Exposure-aggregate home (ADR 0008)

- **Option A — `evaluateMany` in CalculationModule (adopted).** The aggregate of
  current exposure across open positions lives in calc as the multi-position
  analog of `evaluate` — same inputs (`TradeRecord[] + marks + asOf`), same
  mark-dependence. Chosen because (a) the fold is not a plain sum — it applies
  calc's null-mark and dollars-only conventions at portfolio scale, and that
  tested arithmetic belongs where the conventions originate; (b) deleting it
  scatters the null-handling into N coordinator/UI callers (deletion test pass
  condition); (c) it keeps all mark-dependent figure math in one tested module.
  Cost: calc widens from single-trade to single + aggregate current figures, and
  gains a list-shaped op (charter change — recorded in ADR 0008).

- **Option B — exposure in PerformanceAnalytics (rejected).** A second op
  `exposure(FigureSet[])` alongside `aggregate`. Rejected because exposure needs
  marks (current figures move with the mark), and PerformanceAnalytics is a
  mark-free fold over already-derived snapshots. `FigureSet[]` is the wrong input
  for a mark-dependent aggregate — it would force PerformanceAnalytics to either
  take `TradeRecord[] + marks` (abandoning its pinned input type) or re-evaluate
  internally (pulling calc's job in). The mark-dependence split puts exposure
  with `evaluate`, not with `aggregate`.

- **Option C — exposure in the coordinator/UI (rejected).** A coordinator-side
  sum over live `evaluate` results. Rejected because it directly contradicts the
  overview's stated reason for lifting aggregation into a pure module ("burying
  it in the coordinator hides testable logic behind a workflow module"), and
  because the "sum" hides real decisions (null-mark handling, dollars-only)
  that deserve tested arithmetic, not ad-hoc coordinator code.
