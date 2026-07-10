import type { StorageBinding } from '@/storage/storage-binding'
import type { TradeId, TradeRecord } from '@/domain/trademath/types'
import { statusOf } from '@/domain/trademath/status'
import { ListRegistry } from '../list-registry'
import type {
  Account,
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
