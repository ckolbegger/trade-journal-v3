// The fact contract TradeMath computes over. Defined in the domain layer so
// Books import their record shapes from here, never the reverse — that
// direction is what keeps "TradeMath imports nothing" enforceable.
//
// Slice 1 defines only the subset the stock lifecycle needs: stock Instruments,
// underlyingPrice Exit Levels, and the records confirmPlan / statusOf read.

export type Money = number // integer cents
export type Qty = number // positive integer
export type ISODate = string // 'YYYY-MM-DD'
export type Timestamp = number // epoch ms
export type Side = 'buy' | 'sell'

export type TradeId = string
export type AccountId = string
export type LegId = string

export type InstrumentKey = string // canonical string, e.g. "AAPL"

export type TradeStatus = 'planned' | 'open' | 'closed'

// Stock only this slice; option instruments arrive in Slice 3.
export interface Instrument {
  kind: 'stock'
  ticker: string
}

export interface CloseReason {
  id: string
  name: string
}

// underlyingPrice stop/target only this slice; the other kinds (structureValue,
// pctOfMaxProfit, trailing) and leg-scope arrive with the slices that offer them.
export type Scope = { level: 'trade' }
export interface ExitLevel {
  scope: Scope
  side: 'stop' | 'target'
  kind: 'underlyingPrice'
  price: Money
}

// A leg the Plan intends to hold: side, instrument, and quantity.
export interface PlannedLeg {
  side: Side
  instrument: Instrument
  qty: Qty
}

export interface ExecutionFacts {
  side: Side
  qty: Qty
  price: Money
  fees: Money
  timestamp: Timestamp
}

export interface LegFacts {
  id: LegId
  instrument: Instrument
  executions: ExecutionFacts[]
}

// The current holdings of a Trade — the net open quantity per Leg at a point in
// time. Always derived from Executions, never stored (ADR 0005). Qty is a
// positive integer; direction lives on `side` (long/short). Long-only this
// slice; short holdings arrive with short option legs in Slice 3.
export interface Holding {
  instrument: Instrument
  qty: Qty
  side: 'long' | 'short'
}

export interface Position {
  holdings: Holding[]
}

// PlanFacts groups the immutable statement of intent. The math-relevant fields
// (plannedLegs, exitLevels, plannedAt) are what TradeMath reads; thesis,
// strategyId, ideaSourceId and chartLink are stored on the Plan for display and
// analytics (TradeMath never reads Strategy).
export interface PlanFacts {
  thesis: string
  strategyId: string
  ideaSourceId: string
  plannedLegs: PlannedLeg[]
  exitLevels: ExitLevel[]
  plannedAt: ISODate
  chartLink?: string
}

export interface TradeRecord {
  id: TradeId
  accountId: AccountId
  plan: PlanFacts // original, immutable
  legs: LegFacts[]
  closeReason?: CloseReason // present once closed/abandoned
}

// A Mark is the price an instrument is valued at for a given date — exactly one
// per (instrument, date), shared by every Trade holding that instrument. Origin
// records how it arrived; 'manual' only this slice ('fetched' arrives Slice 4).
export interface Mark {
  instrument: InstrumentKey
  date: ISODate
  price: Money
  origin: 'manual' | 'fetched'
}

// One valuation date's Marks, and date-ordered history per instrument. These are
// the PriceBook-served halves of TradeMath's fact contract.
export type MarkSet = ReadonlyMap<InstrumentKey, Mark>
export type MarkSeries = ReadonlyMap<InstrumentKey, Mark[]>

// Valuation results (money in integer cents). Realized P&L is net of every fee on
// the Trade; unrealized is gross (no projected exit fees); totalPnL = realized +
// unrealized (docs/plan/README.md decided semantics). currentValue is the signed
// structure value at these Marks.
export interface LegValuation {
  instrument: Instrument
  basis: Money // cost of the currently-open quantity
  realized: Money
  unrealized: Money
}

export interface Valuation {
  realizedPnL: Money
  unrealizedPnL: Money
  totalPnL: Money
  fees: Money
  currentValue: Money
  perLeg: LegValuation[]
}

// All four numbers measure from today's Marks (ADR 0010); `original` measures from
// the actual entry basis to the ORIGINAL Plan's stop/target, and is 'undefined'
// until the first Execution exists. 'unlimited'/'undefined' are literal anchors.
export interface RiskReward {
  plannedRisk: Money | 'undefined'
  worstCaseRisk: Money | 'unlimited'
  plannedReward: Money | 'undefined'
  maxReward: Money | 'unlimited'
  original: {
    risk: Money | 'unlimited' | 'undefined'
    reward: Money | 'unlimited' | 'undefined'
  }
}
