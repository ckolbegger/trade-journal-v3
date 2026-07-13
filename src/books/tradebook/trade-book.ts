import type {
  CloseReason,
  ExecutionFacts,
  InstrumentKey,
  LegFacts,
  TradeId,
  TradeRecord,
} from '@/domain/trademath/types'
import type { StorageBinding } from '@/storage/storage-binding'
import { statusOf } from '@/domain/trademath/status'
import { positionOf } from '@/domain/trademath/position'
import { buildInstrumentKey, parseInstrumentKey } from '@/domain/trademath/instrument'
import { contractMultiplierOf } from '@/domain/trademath/multiplier'
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
  TradeSummary,
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
    closeReasons: ListRegistry<CloseReason>
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
      closeReasons: new ListRegistry<CloseReason>(binding, 'closeReasons'),
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
  //
  // kind 'assign' / 'exercise' is the one exception: the closing Execution this
  // call appends to the option Leg is paired, in the SAME call, with an opening
  // Execution on a brand-new stock Leg at the strike price (ADR 0002 — schema
  // already allows multiple Legs per Trade; docs/plan/slice-03-single-leg-options.md).
  // Both land in the one TradeRecord document written by the single `put` below,
  // so a failure building the stock Leg (thrown before that `put`) leaves NEITHER
  // Execution persisted — the in-memory mutations are discarded with the record.
  async recordExecution(target: ExecutionTarget, exec: ExecutionDraft): Promise<ExecutionOutcome> {
    if (!Number.isInteger(exec.qty) || exec.qty <= 0)
      throw new Error('Execution qty must be a positive integer')
    if (exec.price < 0) throw new Error('Execution price cannot be negative')
    if (exec.fees < 0) throw new Error('Execution fees cannot be negative')

    const fetched = await this.binding.get<TradeRecord>(TRADES, target.tradeId)
    if (!fetched) throw new Error(`No Trade ${target.tradeId}`)
    // A deep clone before any mutation: some bindings (in-memory) return nested
    // arrays by reference, and a kind assign/exercise call may throw AFTER
    // mutating a Leg's executions in memory (building the paired stock Leg) —
    // mutating only our own clone keeps stored facts untouched until the one
    // `put` below actually commits.
    const record = structuredClone(fetched)

    const leg = resolveLeg(record, target)
    leg.executions.push({ ...exec })

    if (exec.kind === 'assign' || exec.kind === 'exercise') {
      record.legs.push(openAssignedStock(leg, exec))
    }

    await this.binding.put(TRADES, structuredClone(record))

    return {
      record: withDefaultKinds(structuredClone(record)),
      newDeviations: [],
      nowFlat: statusOf(record) === 'closed',
    }
  }

  // Attaches a Close Reason to an already-flat Trade or abandons a planned one.
  // No status is written — statusOf reads 'closed' from the reason (ADR 0005).
  // Rejects a reason not in the registry and refuses to close a Trade that still
  // holds quantity (flatten it with a closing Execution first).
  async setCloseReason(tradeId: TradeId, reason: CloseReason): Promise<void> {
    const record = await this.binding.get<TradeRecord>(TRADES, tradeId)
    if (!record) throw new Error(`No Trade ${tradeId}`)

    const known = await this.registries.closeReasons.list(true)
    if (!known.some((r) => r.id === reason.id)) {
      throw new Error(`Unknown Close Reason ${reason.id}`)
    }
    if (statusOf(record) === 'open') {
      throw new Error(`Cannot close an open Trade ${tradeId} — flatten it first`)
    }

    record.closeReason = reason
    await this.binding.put(TRADES, structuredClone(record))
  }

  async get(tradeId: TradeId): Promise<TradeRecord> {
    const record = await this.binding.get<TradeRecord>(TRADES, tradeId)
    if (!record) throw new Error(`No Trade ${tradeId}`)
    return withDefaultKinds(structuredClone(record))
  }

  // Every Trade with an open (nonzero net) position in the instrument. Powers the
  // shared-Mark edit warning: changing a Mark revalues exactly these Trades. Held
  // is derived from Executions (TradeMath.positionOf) — never stored.
  async tradesHolding(instrument: InstrumentKey): Promise<TradeSummary[]> {
    const all = await this.binding.list<TradeRecord>(TRADES)
    return all
      .filter((t) =>
        positionOf(t).holdings.some((h) => buildInstrumentKey(h.instrument) === instrument),
      )
      .map((t) => ({ id: t.id }))
  }

  async query(filter: TradeFilter): Promise<TradeRecord[]> {
    const all = await this.binding.list<TradeRecord>(TRADES)
    return all
      .filter((t) => (filter.accountId ? t.accountId === filter.accountId : true))
      .filter((t) => (filter.status ? statusOf(t) === filter.status : true))
      .map((t) => withDefaultKinds(structuredClone(t)))
  }
}

// Every record persisted before this slice has no `kind` on its Executions —
// no migration runs (docs/plan/slice-03-single-leg-options.md), so reads
// default the absent field to 'fill' rather than leaving it undefined.
function withDefaultKinds(record: TradeRecord): TradeRecord {
  return {
    ...record,
    legs: record.legs.map((leg) => ({
      ...leg,
      executions: leg.executions.map((e) => ({ ...e, kind: e.kind ?? 'fill' })),
    })),
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

// The stock Leg an assignment/exercise pairs with the option Leg's close: 100
// shares per contract (the multiplier), at the strike, in whichever direction
// the option obligates — short put assigned or long call exercised both buy;
// short call assigned or long put exercised both sell (option mechanics, not a
// stored field). `closingExec` is the just-appended closing Execution, so its
// `side` names the direction that FLATTENED the option Leg — the opposite of
// how it was held. The new Leg carries no fee of its own (`closingExec.fees` is
// the option Leg's close fee); a trader-entered assignment fee is a correction
// this slice doesn't need.
function openAssignedStock(optionLeg: LegFacts, closingExec: ExecutionFacts): LegFacts {
  if (optionLeg.instrument.kind !== 'option') {
    throw new Error(`Cannot ${closingExec.kind} a non-option Leg`)
  }
  const instrument = optionLeg.instrument
  const heldSide: 'long' | 'short' = closingExec.side === 'buy' ? 'short' : 'long'
  const stockSide = (heldSide === 'short') === (instrument.type === 'put') ? 'buy' : 'sell'
  return {
    id: crypto.randomUUID(),
    instrument: { kind: 'stock', ticker: instrument.ticker },
    executions: [
      {
        side: stockSide,
        qty: closingExec.qty * contractMultiplierOf(instrument),
        price: instrument.strike,
        fees: 0,
        timestamp: closingExec.timestamp,
      },
    ],
  }
}
