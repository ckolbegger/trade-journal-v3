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
