// Trader-managed records the TradeBook owns. TradeMath never computes over
// these, so they live in the TradeBook module (not the domain fact contract).

import type {
  AccountId,
  ExitLevel,
  ISODate,
  PlannedLeg,
  Side,
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
// Exit Levels the plan form asks for. Stock-only this slice. TradeMath never
// reads Strategy — it stays a TradeBook-owned analytics label.
export interface StrategyLegTemplate {
  side: Side
  instrumentKind: 'stock'
}

export interface StrategyExitTemplate {
  side: 'stop' | 'target'
  kind: 'underlyingPrice'
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

// The fact-read shapes the UI renders come through the Book, never straight from
// the domain layer (module-boundary rule): re-export them here.
export type {
  ExitLevel,
  Instrument,
  PlanFacts,
  PlannedLeg,
  TradeRecord,
  TradeStatus,
} from '@/domain/trademath/types'
