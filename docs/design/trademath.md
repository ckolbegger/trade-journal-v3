# TradeMath — initial interface design

Pure computation module: no storage, no side effects, no clock. Every operation takes facts in and returns results. Its parameter types are the data contract the Books must be able to serve (TradeBook → `TradeRecord`, PriceBook → `MarkSet` / `MarkSeries`). Only coordinators (Valuations, Analytics) and TradeBook ever hand it records; the UI sees finished items (`Position`, `Valuation`, `RiskReward`), never events. See [overview.md](./overview.md) for how the modules interact.

## Operations

```typescript
interface TradeMath {
  positionOf(trade: TradeRecord, asOf?: ISODate): Position
  instrumentsOf(trade: TradeRecord): InstrumentKey[]   // every instrument the Trade needs Marks for (legs + underlyings)
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
  | { scope: Scope; side: 'stop' | 'target'; kind: 'pctOfMaxProfit'; pct: number }
  | { scope: Scope; side: 'stop';            kind: 'trailing';       offset: Money | { pct: number } }
type Scope = { level: 'trade' } | { level: 'leg'; legId: LegId }

type MarkSet    = ReadonlyMap<InstrumentKey, Mark>            // one valuation date
type MarkSeries = ReadonlyMap<InstrumentKey, Mark[]>          // date-ordered, for replay/discipline/trailing
```

Note: TradeMath never reads Strategy. The Strategy template matters at plan-form time (pre-filling Planned Legs, choosing which Exit Levels to ask for); by the time math runs, Exit Levels are already typed. Strategy remains an analytics label.

## Result types

```typescript
interface Valuation {
  realizedPnL: Money; unrealizedPnL: Money; totalPnL: Money; fees: Money
  currentValue: Money                       // signed structure value at these Marks
  perLeg: LegValuation[]                    // basis (FIFO lots), realized, unrealized per Leg
}

interface RiskReward {
  plannedRisk: Money | 'undefined'          // to current stop (trailing resolved from series when needed)
  worstCaseRisk: Money | 'unlimited'        // structural extreme
  plannedReward: Money | 'undefined'        // to current target
  maxReward: Money | 'unlimited'            // structural extreme
  original: { risk: Money | 'unlimited'; reward: Money | 'unlimited' }  // from the original Plan, for contrast
}

interface ReplayPoint { date: ISODate; valuation: Valuation; riskReward: RiskReward }

type DetectedDeviation =
  | { type: 'structure'; legId: LegId; detail: string }
  | { type: 'sizing';    legId: LegId; plannedQty: Qty; actualQty: Qty }
  | { type: 'discipline'; exitLevel: ExitLevel; crossedOn: ISODate }
```

## Decided semantics

- **Mark-to-market anchors (ADR 0010)**: all four R/R numbers measure from today's Marks; unrealized gains count.
- **Structural extremes**: intrinsic value in the limits S→0 and S→∞ — well-defined for multi-expiration structures, no pricing model (reflective-only).
- **FIFO lots (ADR 0015)**: partial closes and Transfers consume oldest Lots first; Transfers carry original basis (ADR 0004).
- **Trailing high-water**: running max of the scoped structure's signed daily value (shorts negative, same-day sums only); derived from MarkSeries, never stored.
- **Deviations**: `detectDeviations` is pure; recording at detection moments is the Books' job (ADR 0012).
- **Replay**: each ReplayPoint computed with knowledge as of its date (Exit Levels from Plan + revisions up to that date; trailing high-water up to that date).
- **attentionScore v1**: ongoing-risk-to-incremental-reward ratio; more signals later.

## Open items

- Risk-free rate for IV display: caller-supplied (likely a Workspace setting); no dividend modeling (accepted error, display-only).
- Trailing stops track daily closes until Daily Bars provide highs.
