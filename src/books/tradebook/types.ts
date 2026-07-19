// Trader-managed records the TradeBook owns. TradeMath never computes over
// these, so they live in the TradeBook module (not the domain fact contract).

import type {
  AccountId,
  ExecutionKind,
  ExitLevel,
  InstrumentKey,
  ISODate,
  LegId,
  Money,
  PlannedLeg,
  Qty,
  Side,
  Timestamp,
  TradeId,
  TradeRecord,
  TradeStatus,
} from '@/domain/trademath/types'

export interface Institution {
  id: string
  name: string
  archived?: boolean
}

export interface Account {
  id: string
  name: string
  institutionId: string
  archived?: boolean
}

// Where a trade idea came from — a trader-managed list, chosen at Plan time.
export interface IdeaSource {
  id: string
  name: string
  archived?: boolean
}

// A Strategy is a template: it pre-fills the Plan's Planned Legs and names which
// Exit Levels the plan form asks for. TradeMath never reads Strategy — it stays a
// TradeBook-owned analytics label. `optionType` is present iff instrumentKind is
// 'option' (the option leg's call/put is fixed by the Strategy, not asked).
// `tbdAllowed` marks an option leg whose strike/expiration the plan form may
// leave blank — a LEGGING leg, completed by its later fill, never by editing
// the Plan (Slice 7). Only a legging Strategy sets it (Covered Call's call);
// a Strategy whose legs are all concrete at plan time (Bull Put Spread) never
// does, so the plan form requires strike/expiration on every leg instead.
export interface StrategyLegTemplate {
  side: Side
  instrumentKind: 'stock' | 'option'
  optionType?: 'call' | 'put'
  tbdAllowed?: boolean
}

export interface StrategyExitTemplate {
  side: 'stop' | 'target'
  kind: 'underlyingPrice' | 'structureValue'
}

export interface StrategyTemplate {
  id: string
  name: string
  legs: StrategyLegTemplate[]
  exitLevels: StrategyExitTemplate[]
  archived?: boolean
}

// The statement of intent the trader confirms. Becomes an immutable PlanFacts on
// the created TradeRecord (plus the Account binding).
export interface PlanDraft {
  accountId: AccountId
  thesis: string
  strategyId: string
  ideaSourceId: string
  plannedLegs: PlannedLeg[]
  exitLevels: ExitLevel[]
  plannedAt: ISODate
  chartLink?: string
}

export interface TradeFilter {
  status?: TradeStatus
  accountId?: AccountId
}

// A Trade holding a given instrument — the shared-Mark edit warning composes over
// these (naming how many Trades a Mark change revalues). Minimal by design: the
// warning needs the count, not the facts.
export interface TradeSummary {
  id: TradeId
}

// Where an Execution lands: an existing Leg, or a new Leg in an existing Trade.
// Deliberately no { newTrade } shape — plan-first is structural (ADR 0003): a
// spontaneous entry is a 30-second confirmPlan first.
export type ExecutionTarget =
  { tradeId: TradeId; legId: LegId } | { tradeId: TradeId; newLeg: InstrumentKey }

// One fill the trader recorded. Qty is a positive integer; direction lives on
// `side`. Money is integer cents. The trading date rides in `timestamp`. `kind`
// defaults to 'fill' when absent — 'expire'/'assign'/'exercise' are the option
// lifecycle events (Slice 3/4).
export interface ExecutionDraft {
  side: Side
  qty: Qty
  price: Money
  fees: Money
  timestamp: Timestamp
  kind?: ExecutionKind
}

// The result of recording a fill. `nowFlat` tells the UI the fill flattened the
// Trade (prompt for a Close Reason — consumed in S1.4). `newDeviations` is in the
// design signature but stays empty until detection arrives in Slice 9.
export interface ExecutionOutcome {
  record: TradeRecord
  newDeviations: never[]
  nowFlat: boolean
}

// The fact-read shapes the UI renders come through the Book, never straight from
// the domain layer (module-boundary rule): re-export them here.
export type {
  CloseReason,
  ExecutionKind,
  ExitLevel,
  Instrument,
  LegFacts,
  Money,
  PlanFacts,
  PlannedLeg,
  Position,
  RiskReward,
  Side,
  TradeRecord,
  TradeStatus,
  Valuation,
} from '@/domain/trademath/types'

// The InstrumentKey codec: pure serialization of the Instrument shape (not
// TradeMath's derived math), needed by the UI to name the Leg an Execution
// targets (`ExecutionTarget.newLeg`) for instruments beyond a stock's own ticker.
export { buildInstrumentKey } from '@/domain/trademath/instrument'
