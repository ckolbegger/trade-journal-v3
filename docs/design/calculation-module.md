# CalculationModule — initial interface design

The pure single-trade derivation module. Owns every figure the journal shows for
one Trade — P&L, position size, the three risk quantities, reward, R:R, R-multiple,
lifecycle echo, and revision count — computed from fills + plan + revisions + price
marks. Deliberately owns **no storage access, no cross-Trade aggregation, no
presentation logic, and no lifecycle-status derivation**. Its parameter and return
types are the **data contract every store must serve and every coordinator read**;
this is why it was drilled down first (overview rule 2).

Two operations, both pure — testable with literal objects, no store, no mock, no
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
```

---

## Interface

### Operations

```ts
evaluate(record: TradeRecord, marks: Marks, asOf: Date): FigureSet

isFlat(fills: Fill[]): boolean
```

### Input types — the data contract every store must serve

```ts
/** Identifiers (type aliases for readability; backing type is string). */
type TradeId = string
type AccountId = string
type InstrumentId = string
type Price = number

/** The complete record for one Trade, as a store must return it.
 *  This type is the contract: every field here is something a store supplies
 *  and calc consumes. Nothing in FigureSet requires a field not listed here. */
type TradeRecord = {
  tradeId: TradeId
  accountId: AccountId
  underlying: InstrumentId          // risk keyed off this; Price Marks looked up by it
  status: Lifecycle                 // stored authoritatively (ADR 0006); echoed, not derived
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
  instrument: InstrumentId
  side: 'buy' | 'sell'
  quantity: number                  // unsigned; sign derived from side
  price: Price
  at: Date
  instrumentType: InstrumentType    // per leg — drives maximum risk (ADR 0005)
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
    planned: Dual                   // (entry − stop) × size — frozen at initial Plan (ADR 0005)
    current: Dual | null            // (mark − currentStop) × size — live; null if no mark or no position
    maximum: MaxRisk | null         // instrument-type-aware (ADR 0005); null for Planned (no fills → no instrumentType)
  }

  reward: {
    planned: Dual                   // (target − entry) × size — frozen at initial Plan
    incremental: Dual | null        // (target − mark) × size — live; null if no mark
  }

  rr: {
    planned: number                 // reward.planned ÷ risk.planned — always computable
    current: number | null          // reward.incremental ÷ risk.current; null if no mark
  }

  rMultiple: number                 // pnl.realized ÷ risk.planned.dollars (in R units)

  lifecycle: Lifecycle              // echoed from record.status — NOT derived (ADR 0006)

  revisionCount: number             // raw count of PlanRevisions
}

/** The dual presentation rule (CONTEXT.md), captured at the type level:
 *  every risk and reward figure carries both forms everywhere it appears. */
type Dual = {
  ratio: number                     // per-unit, size-independent: 1-share and 100-share
  dollars: number                   // trades share the same ratio; dollars scale with size
}

/** Maximum risk — instrument-type-aware (ADR 0005). A discriminated union so
 *  the type system enforces "narrow before reading amount." The unbounded case
 *  (naked short options) carries no amount — there is no finite number. */
type MaxRisk =
  | { bounded: true,  amount: Dual }   // stock (whole position), long-option (premium), defined-risk spread
  | { bounded: false }                  // naked short option — catastrophic loss has no cap
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
   revisions — a fact about the record. Normalizing to a rate (per day, across
   trades) is PerformanceAnalytics' job. The overview's `planRevisionRate`
   field is renamed here. *(ADR 0001; depth — one fact, rate is its
   aggregation.)*

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
- **→ PerformanceAnalytics:** aggregates `FigureSet[]` (one per trade in
  scope). The per-trade FigureSet carries everything the portfolio roll-up
  needs: `rMultiple` (for R-distribution), `revisionCount` (for aggregate
  plan-revision-rate), `pnl.realized` (for P&L summaries), `risk.planned`
  (for equity-by-R). Closed trades read the snapshot; open trades compute
  live — **PerformanceAnalytics consumes both uniformly.**
- **→ FillEntryCoordinator:** owns the `isFlat` → `evaluate` → `storeFinalFigures`
  close path (sequence above). It builds the `Marks` map via the
  `priceMarkStore.buildMarksFromFills(fills, date)` op (exported to
  PriceMarkStore above) — not coordinator-side logic.
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
| `InstrumentType` value expansion for options sub-types (naked vs covered, put vs call, spread width) | Options-release drill-down. The `InstrumentType` union grows; the `MaxRisk` discriminated union shape is stable. |
| Spread-width input for defined-risk spread `maximum` | Options-release. A spread's max risk = width − premium; the fill structure must carry strike/width. Deferred until options ship. |

---

## Alternatives considered

### Module shape (design-it-twice)

- **Candidate A — Monolith** (adopted). `evaluate()` + `isFlat()`. One universal
  FigureSet type; the chart composes its per-day series by calling `evaluate`
  per day. Deepest on op count; one type pins every store's contract. Cost:
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
