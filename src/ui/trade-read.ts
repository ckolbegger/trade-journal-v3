import { repo, type Db } from '../persistence/db'
import type { ConfirmPlanResult } from '../domain/confirm-plan'
import type { StoredOpenTrade, StoredClosedTrade } from '../domain/open-views'

// D8aR R1 — the one stored-to-displayed Trade read. Controllers are adapters
// over this module; no caller invents defaults or joins stores itself.
export type TradeAgreement = { lifecycle: boolean; lots: boolean; findings: string[] }

export type StoredTradeRow = {
  id: string
  lifecycle?: string
  revision?: string
  strategyId?: string
  underlying?: string
  oneR?: string
  economicTime?: string
  plan?: unknown
  positions?: unknown[]
  lots?: unknown[]
  executions?: unknown[]
  realizedToDate?: string
  fulfillment?: string
  deviations?: unknown[]
  agreement?: TradeAgreement
  positionChangeId?: string
  closeReason?: unknown
}

export type CanonicalTradeFields = {
  lifecycle: string
  revision: string
  strategyId?: string
  underlying: string
  oneR: string
  economicTime: string
  plan: Record<string, unknown>
  positions: unknown[]
  lots: unknown[]
  executions: unknown[]
  realizedToDate: string
  agreement: TradeAgreement
}

const present = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  return typeof value === 'string' ? value : String(value)
}

export function normalizeStoredTrade<T extends StoredTradeRow>(row: T): T & CanonicalTradeFields {
  const plan = (row.plan ?? {}) as Record<string, unknown>
  return {
    ...row,
    lifecycle: present(row.lifecycle) ?? 'Planned',
    revision: present(row.revision) ?? '1',
    strategyId: present(row.strategyId) ?? present(plan.strategyId),
    underlying: present(row.underlying) ?? present(plan.underlying) ?? '',
    oneR: present(row.oneR) ?? present(plan.oneR) ?? '0.00',
    economicTime: present(row.economicTime) ?? '',
    plan,
    positions: row.positions ?? [],
    lots: row.lots ?? [],
    executions: row.executions ?? [],
    realizedToDate: present(row.realizedToDate) ?? '0.00',
    agreement: row.agreement ?? { lifecycle: true, lots: true, findings: [] },
  }
}

export async function readStoredTrade<T extends StoredTradeRow = StoredTradeRow>(
  db: Db, tradeId: string,
): Promise<(T & CanonicalTradeFields) | undefined> {
  const row = await repo.get<T>(db, 'trade', tradeId)
  return row ? normalizeStoredTrade(row) : undefined
}

export function plannedResultFrom(
  trade: StoredTradeRow,
  entry: ConfirmPlanResult['value']['entry'],
): ConfirmPlanResult['value'] {
  const normalized = normalizeStoredTrade(trade)
  return {
    trade: {
      id: normalized.id,
      lifecycle: 'Planned',
      plan: normalized.plan as ConfirmPlanResult['value']['trade']['plan'],
      economicTime: normalized.economicTime,
    },
    entry,
    revisions: { trade: normalized.revision, entry: '1', catalog: '1' },
    postCommit: { trade: normalized, entry },
    affectedScopes: [],
  }
}

export async function readPlannedTrades(db: Db): Promise<ConfirmPlanResult['value'][]> {
  // Planned Trades are not added to the lifecycle index (only open/close
  // maintains it), so the authoritative source is the stored Trade rows.
  const rows = await repo.all<StoredTradeRow>(db, 'trade')
  const result: ConfirmPlanResult['value'][] = []
  for (const row of rows) {
    if (!row.plan || normalizeStoredTrade(row).lifecycle !== 'Planned') continue
    const entry = (await repo.get<ConfirmPlanResult['value']['entry']>(db, 'journal', `entry-${row.id}`))
      ?? { snapshot: {} }
    result.push(plannedResultFrom(row, entry))
  }
  return result
}

export function toStoredOpenTrade(row: StoredTradeRow): StoredOpenTrade {
  return normalizeStoredTrade(row) as unknown as StoredOpenTrade
}

export function toStoredClosedTrade(row: StoredTradeRow): StoredClosedTrade {
  return normalizeStoredTrade(row) as unknown as StoredClosedTrade
}

export function strategyIdOf(plan: unknown): string | undefined {
  const value = (plan as { strategyId?: unknown } | null)?.strategyId
  return typeof value === 'string' && value ? value : undefined
}

export async function readCloseReasonLabels(db: Db): Promise<string[]> {
  const catalog = await repo.get<{ closeReasons?: { label: string }[] }>(db, 'catalog', 'catalog-1')
  return (catalog?.closeReasons ?? []).map(r => r.label)
}
