# TradeMath — initial interface design

Pure computation module: no storage, no side effects, no clock. Every operation takes facts in and returns results. Its parameter types are the data contract the Books must be able to serve (TradeBook → `TradeRecord`, PriceBook → `MarkSet` / `MarkSeries`). Only coordinators (Valuations, Analytics) and TradeBook ever hand it records; the UI sees finished items (`Position`, `Valuation`, `RiskReward`), never events. See [overview.md](./overview.md) for how the modules interact.

## Operations

```typescript
interface TradeMath {
  positionOf(trade: TradeRecord, asOf?: ISODate): Position
  instrumentsOf(trade: TradeRecord): InstrumentKey[]   // every instrument the Trade ever held (legs + underlyings)
  heldInstrumentsOf(trade: TradeRecord): InstrumentKey[]   // instruments still needing Marks: held Legs only + their underlyings — a flat Leg never prompts
  statusOf(trade: TradeRecord): 'planned' | 'open' | 'closed'
  valuation(trade: TradeRecord, marks: MarkSet): Valuation
  riskReward(trade: TradeRecord, marks: MarkSet): RiskReward
  replay(trade: TradeRecord, series: MarkSeries): ReplayPoint[]
  detectDeviations(trade: TradeRecord, series?: MarkSeries): DetectedDeviation[]
  attentionScore(trade: TradeRecord, marks: MarkSet): number
  impliedVol(contract: OptionInstrument, mark: Mark, underlying: Mark, riskFreeRate: number): number | undefined
}
```

Deliberate omission: no `payoffCurve()`. Payoff evaluation exists internally (it computes the structural extremes) but is not exposed — visualizations are reflective, not predictive (ADR 0009).

## Input types (the fact contract)

```typescript
interface TradeRecord {
  id: TradeId
  accountId: AccountId
  plan: PlanFacts                 // original, immutable
  revisions: PlanRevisionFacts[]  // dated; current Exit Levels = original overlaid by revisions
  legs: LegFacts[]
  closeReason?: CloseReason       // present once closed/abandoned
}

interface PlanFacts {
  plannedLegs: PlannedLeg[]       // side, instrument kind, qty; strike/expiration exact or TBD
  exitLevels: ExitLevel[]         // typed: scope (trade | leg) × kind
  plannedAt: ISODate
}

interface LegFacts {
  instrument: Instrument          // stock | option (type, strike, expiration)
  executions: ExecutionFacts[]    // side, qty, price, fees, timestamp; incl. expiration/assignment events
  transfersIn: TransferFacts[]    // qty + the Lots (original basis) that arrived
  transfersOut: TransferFacts[]
}

type ExitLevel =
  | { scope: Scope; side: 'stop' | 'target'; kind: 'underlyingPrice'; price: Money }
  | { scope: Scope; side: 'stop' | 'target'; kind: 'structureValue';  value: Money }
  | { scope: Scope; side: 'stop';            kind: 'trailing';       offset: Money | { pct: number } }
type Scope = { level: 'trade' } | { level: 'leg'; legId: LegId }
```

**Exit-level semantics (user ruling 2026-07-19, supersedes earlier readings):**

- **`underlyingPrice`** — the underlying's price that triggers the level ("AAPL at or below 390"). Applicable to any strategy. Unchanged.
- **`structureValue`** — displayed to the trader as **"Position price"**: the net per-spread-unit QUOTED price of the option legs (the number a broker chain shows — "the 400/420 debit spread trades for 15.00", "the put can be bought back for 0.50"). Always entered as a positive quote; the crossing direction is inferred from the structure's net direction (credit vs debit, from the entry composition) plus stop/target side. Quantity scales internally (2 lots of a 15.00 spread = level still typed 15.00; the math multiplies by lot count × contract multiplier — lot count = the option legs' common quantity factor). Applicable to option-only structures (a structure holding stock offers `underlyingPrice` only). This makes the per-unit scale canonical for single- AND multi-leg — S7.3's transient whole-structure-dollars reading is superseded. The kind string `structureValue` is retained for stored-Plan compatibility; all display copy says "Position price".
- **`pctOfMaxProfit` — REMOVED by the same ruling.** Every target is a typed price ("price only"); the old 75%-of-credit convenience is expressed directly as a buy-back Position price (75% of a 2.00 credit ≡ target 0.50). Legacy stored Plans carrying a pctOfMaxProfit level are tolerated on read (displayed inert), never produced.
- **`trailing`** — unchanged, arrives with Slice 10.

These levels feed exactly two consumers: risk/reward projections (original and ongoing) and attention ("this Trade is approaching its stop/target").

```

type MarkSet    = ReadonlyMap<InstrumentKey, Mark>            // one valuation date
type MarkSeries = ReadonlyMap<InstrumentKey, Mark[]>          // date-ordered, for replay/discipline/trailing
```

Note: TradeMath never reads Strategy. The Strategy template matters at plan-form time (pre-filling Planned Legs, choosing which Exit Levels to ask for); by the time math runs, Exit Levels are already typed. Strategy remains an analytics label.

## Result types

```typescript
interface Valuation {
  realizedPnL: Money; unrealizedPnL: Money; totalPnL: Money; fees: Money
  currentValue: Money                       // signed structure value at these Marks
  perLeg: LegValuation[]                    // basis (FIFO lots), avgCost, realized, unrealized per Leg
}
```

`LegValuation.avgCost` (added S5.1, ruling 2026-07-18; wording clarified S5.2): per-unit
average open price across the Lots still open — after a FIFO partial close it averages the
REMAINING Lots only (worked example: 12,800/80 = 160.00, not the all-fills 155.00) —
WITHOUT the contract multiplier `basis` bakes in — the UI renders it
directly (e.g. a stock's "avg $155.00") without knowing the multiplier, which only TradeMath
reads (docs/plan/slice-03-single-leg-options.md). An option Leg's `avgCost` is therefore a
per-contract-unit premium (e.g. 500 cents = "$5.00"), matching how contracts are quoted, not
`basis`'s already-multiplied total.

```typescript
interface RiskReward {
  plannedRisk: Money | 'undefined'          // to current stop (trailing resolved from series when needed)
  worstCaseRisk: Money | 'unlimited'        // structural extreme
  plannedReward: Money | 'undefined'        // to current target
  maxReward: Money | 'unlimited'            // structural extreme
  original: { risk: Money | 'unlimited' | 'undefined'; reward: Money | 'unlimited' | 'undefined' }  // from the original Plan, for contrast; 'undefined' until the first Execution exists
}

interface ReplayPoint { date: ISODate; valuation: Valuation; riskReward: RiskReward }

type DetectedDeviation =
  | { type: 'structure'; legId: LegId; detail: string }
  | { type: 'sizing';    legId: LegId; plannedQty: Qty; actualQty: Qty }
  | { type: 'discipline'; exitLevel: ExitLevel; crossedOn: ISODate }
```

## Decided semantics

- **Mark-to-market anchors (ADR 0010)**: all four R/R numbers measure from today's Marks; unrealized gains count.
- **Structural extremes**: intrinsic value evaluated at S→0, **at every held strike**, and in the S→∞ limit (the finite slope-zero asymptote equals the value at the largest held strike) — a piecewise-linear payoff's extremes live at its kinks, so endpoint-only sampling would misprice non-monotone structures like ratio writes or straddles (amended S7.1 review, 2026-07-18; identical results for all monotone/single-kink shapes). Well-defined for multi-expiration structures, no pricing model (reflective-only).
- **FIFO lots (ADR 0015)**: partial closes and Transfers consume oldest Lots first; Transfers carry original basis (ADR 0004).
- **Trailing high-water**: running max of the scoped structure's signed daily value (shorts negative, same-day sums only); derived from MarkSeries, never stored.
- **Deviations**: `detectDeviations` is pure; recording at detection moments is the Books' job (ADR 0012).
- **Replay**: each ReplayPoint computed with knowledge as of its date (Exit Levels from Plan + revisions up to that date; trailing high-water up to that date).
- **attentionScore v1**: ongoing-risk-to-incremental-reward ratio; more signals later.

## Open items

- Risk-free rate for IV display: caller-supplied (likely a Workspace setting); no dividend modeling (accepted error, display-only).
- Trailing stops track daily closes until Daily Bars provide highs.
