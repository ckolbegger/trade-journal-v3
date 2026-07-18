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

export interface StockInstrument {
  kind: 'stock'
  ticker: string
}

// An option contract: underlying ticker, expiration, call/put, strike (Money —
// integer cents representing dollars, same scale as a Mark price). The contract
// multiplier (100) is never stored here — it lives in TradeMath, keyed off `kind`.
export interface OptionInstrument {
  kind: 'option'
  ticker: string // underlying ticker
  expiration: ISODate
  type: 'call' | 'put'
  strike: Money
}

export type Instrument = StockInstrument | OptionInstrument

export interface CloseReason {
  id: string
  name: string
}

// underlyingPrice (stock or, projected at intrinsic, option), structureValue
// (option), and pctOfMaxProfit (short credit structures, Slice 3) this slice;
// `trailing` and leg-scope arrive with the slices that offer them. `pct` is a
// whole percentage (80 means 80%), matching how discipline Deviations resolve
// it (docs/plan/slice-10-deviations-discipline.md).
export type Scope = { level: 'trade' }
export type ExitLevel =
  | { scope: Scope; side: 'stop' | 'target'; kind: 'underlyingPrice'; price: Money }
  | { scope: Scope; side: 'stop' | 'target'; kind: 'structureValue'; value: Money }
  | { scope: Scope; side: 'stop' | 'target'; kind: 'pctOfMaxProfit'; pct: number }

// A Planned Leg's instrument description. A stock leg is always concrete; an
// option leg's strike/expiration may be TBD at plan time (legging plans,
// Slice 7) — completed by the fill that opens the Leg, never by editing the
// Plan. LegFacts.instrument (an actual, filled Leg) is always the concrete
// `Instrument` — only a Planned Leg can be TBD.
export interface PlannedOptionInstrument {
  kind: 'option'
  ticker: string
  type: 'call' | 'put'
  strike?: Money // TBD until the fill
  expiration?: ISODate // TBD until the fill
}
export type PlannedInstrument = StockInstrument | PlannedOptionInstrument

// A leg the Plan intends to hold: side, instrument, and quantity.
export interface PlannedLeg {
  side: Side
  instrument: PlannedInstrument
  qty: Qty
}

// An ordinary fill, or an Execution recording what happened to an expiring
// option contract: 'expire' closes the Leg at price 0 (Slice 3); 'assign' /
// 'exercise' do the same and open a paired stock Leg (Slice 4). Absent on every
// record persisted before this slice existed — no migration runs, so readers
// treat a missing kind as 'fill' (docs/plan/slice-03-single-leg-options.md).
export type ExecutionKind = 'fill' | 'expire' | 'assign' | 'exercise'

export interface ExecutionFacts {
  side: Side
  qty: Qty
  price: Money
  fees: Money
  timestamp: Timestamp
  kind?: ExecutionKind
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
  avgCost: Money // per-unit average open price (no contract multiplier) — S5.1
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
