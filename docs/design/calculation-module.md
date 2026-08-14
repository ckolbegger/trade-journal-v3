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

Three operations, all pure — testable with literal objects, no store, no mock, no
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
```

---

## Interface

### Operations

```ts
evaluate(record: TradeRecord, marks: Marks, asOf: Date): FigureSet

isFlat(fills: Fill[]): boolean

evaluateMany(records: TradeRecord[], marks: Marks, asOf: Date): ExposureReport
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
  entry:  Price
  stop:   Price
  target: Price
  thesis: string
  invalidation: string
  entryEmotion: string
  committedAt: Date
}

type PlanRevision = {               // never overwrites; appends (ADR 0001)
  at: Date
  stop?:   Price                    // absent = unchanged
  target?: Price                    // absent = unchanged
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

type Lifecycle = 'Planned' | 'Open' | 'Closed'

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
    planned: Dual                   // read against the payoff curve at the declared stop (ADR 0009); frozen at initial Plan (ADR 0005)
    current: Dual | null            // (mark − currentStop) × size — live; null if no mark or no position
    maximum: MaxRisk | null         // payoff-curve minimum (ADR 0009), instrument-type-aware (ADR 0005); null for Planned (no fills → no curve)
  }

  reward: {
    planned: Dual                   // read against the payoff curve at the declared target (ADR 0009); frozen at initial Plan
    incremental: Dual | null        // (target − mark) × size — live; null if no mark
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
   history. A stop revision changes current risk, never planned risk.
   *(ADR 0001, 0005.)*

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
    yields $0 planned risk — though their *representation* on `Plan` for
    multi-directional structures is open (OQ 16). **Boundary:** the curve is an
    *expiry* (intrinsic-value) construction. It serves maximum/planned risk and
    breakevens — not live option P&L or live risk, which are mark-to-market
    (extrinsic value at the daily mark; semantic 4's mark-dependence) and
    which the options release must own as a separate computation. For the
    stock-only MVP nothing changes: the curve is trivially linear (breakeven
    = cost basis; maximum = whole position to zero). *(ADR 0009.)*

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

### Stock trade — AAPL, buy 100 @ $150, stop $147, target $156

**Mid-trade, mark at $152 (Open):**

| field | computation | value |
|---|---|---|
| `positionSize` | +100 | `100` |
| `pnl.realized` | no closing fills | `$0` |
| `pnl.unrealized` | (152−150)×100 | `+$200` |
| `risk.planned` | ratio: 150−147=$3, dollars: 3×100 | `{3, $300}` |
| `risk.current` | ratio: 152−147=$5, dollars: 5×100 | `{5, $500}` |
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
trader → DailyReviewCoordinator.runDailyReview(today)
  → TradingRecordStore.listOpenTrades()                    // cheap indexed filter (ADR 0006)
  → for each open trade:
      → record = TradingRecordStore.getTradeRecord(tradeId)
      → [resolve underlyings lacking a PriceMark for today]
      → marks = PriceMarkStore.buildMarksFromFills(record.fills, today)
      → figures = calc.evaluate(record, marks, today)      // live figures
      → [assemble into DailyReviewView]
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
across all open positions, then makes one calc call. (Coordinator internals
are illustrative; pinned in its own drill-down.)

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
