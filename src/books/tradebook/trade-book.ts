import type { LegFacts, TradeId, TradeRecord } from '@/domain/trademath/types'
import type { StorageBinding } from '@/storage/storage-binding'
import { statusOf } from '@/domain/trademath/status'
import { parseInstrumentKey } from '@/domain/trademath/instrument'
import { ListRegistry } from '../list-registry'
import type {
  Account,
  ExecutionDraft,
  ExecutionOutcome,
  ExecutionTarget,
  IdeaSource,
  Institution,
  PlanDraft,
  StrategyTemplate,
  TradeFilter,
} from './types'

const TRADES = 'trades'

// The system of record for Trades. Stores facts, never does arithmetic on them
// (netting, status, P&L all live in TradeMath). This slice implements the plan
// lifecycle's first step — confirmPlan / get / query — plus the trader-managed
// registries the plan form reads. Later slices add operations on this same
// instance without reshaping it.

export class TradeBook {
  readonly registries: {
    institutions: ListRegistry<Institution>
    accounts: ListRegistry<Account>
    strategies: ListRegistry<StrategyTemplate>
    ideaSources: ListRegistry<IdeaSource>
  }

  constructor(private binding: StorageBinding) {
    this.registries = {
      institutions: new ListRegistry<Institution>(binding, 'institutions'),
      accounts: new ListRegistry<Account>(binding, 'accounts', async (account) => {
        const institution = await binding.get<Institution>('institutions', account.institutionId)
        if (!institution) {
          throw new Error(`Account references unknown institution ${account.institutionId}`)
        }
      }),
      strategies: new ListRegistry<StrategyTemplate>(binding, 'strategies'),
      ideaSources: new ListRegistry<IdeaSource>(binding, 'ideaSources'),
    }
  }

  async confirmPlan(draft: PlanDraft): Promise<TradeId> {
    const account = await this.binding.get<Account>('accounts', draft.accountId)
    if (!account) throw new Error(`Plan references unknown account ${draft.accountId}`)
    if (!draft.thesis.trim()) throw new Error('A Plan needs a thesis')
    if (draft.plannedLegs.length === 0) throw new Error('A Plan needs at least one Planned Leg')

    const record: TradeRecord = {
      id: crypto.randomUUID(),
      accountId: draft.accountId,
      plan: {
        thesis: draft.thesis,
        strategyId: draft.strategyId,
        ideaSourceId: draft.ideaSourceId,
        plannedLegs: draft.plannedLegs,
        exitLevels: draft.exitLevels,
        plannedAt: draft.plannedAt,
        ...(draft.chartLink ? { chartLink: draft.chartLink } : {}),
      },
      legs: [],
    }
    await this.binding.put(TRADES, structuredClone(record))
    return record.id
  }

  // Records a fill against an existing Leg or a new Leg in an existing Trade.
  // Stores the fact only — netting, status, and nowFlat are derived by TradeMath
  // (never stored, ADR 0005). No target can create a Trade (plan-first, ADR 0003).
  async recordExecution(target: ExecutionTarget, exec: ExecutionDraft): Promise<ExecutionOutcome> {
    if (!Number.isInteger(exec.qty) || exec.qty <= 0)
      throw new Error('Execution qty must be a positive integer')
    if (exec.price < 0) throw new Error('Execution price cannot be negative')
    if (exec.fees < 0) throw new Error('Execution fees cannot be negative')

    const record = await this.binding.get<TradeRecord>(TRADES, target.tradeId)
    if (!record) throw new Error(`No Trade ${target.tradeId}`)

    const leg = resolveLeg(record, target)
    leg.executions.push({ ...exec })
    await this.binding.put(TRADES, structuredClone(record))

    return {
      record: structuredClone(record),
      newDeviations: [],
      nowFlat: statusOf(record) === 'closed',
    }
  }

  async get(tradeId: TradeId): Promise<TradeRecord> {
    const record = await this.binding.get<TradeRecord>(TRADES, tradeId)
    if (!record) throw new Error(`No Trade ${tradeId}`)
    return structuredClone(record)
  }

  async query(filter: TradeFilter): Promise<TradeRecord[]> {
    const all = await this.binding.list<TradeRecord>(TRADES)
    return all
      .filter((t) => (filter.accountId ? t.accountId === filter.accountId : true))
      .filter((t) => (filter.status ? statusOf(t) === filter.status : true))
      .map((t) => structuredClone(t))
  }
}

// Finds the Leg an Execution targets, creating a new Leg when the target names an
// instrument rather than an existing Leg id. The returned Leg is the live object
// inside `record`, so the caller mutates it in place.
function resolveLeg(record: TradeRecord, target: ExecutionTarget): LegFacts {
  if ('legId' in target) {
    const leg = record.legs.find((l) => l.id === target.legId)
    if (!leg) throw new Error(`No Leg ${target.legId} on Trade ${record.id}`)
    return leg
  }
  const leg: LegFacts = {
    id: crypto.randomUUID(),
    instrument: parseInstrumentKey(target.newLeg),
    executions: [],
  }
  record.legs.push(leg)
  return leg
}
