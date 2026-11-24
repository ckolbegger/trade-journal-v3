import Decimal from 'decimal.js'
import { repo, type Db } from '../persistence/db'
import type { OpenTradeProjection } from './record-position-change'

// TradeViewsAndReporting + Trade Record reads for the Open presentation.
export const LIFECYCLE_INDEX_ID = 'lifecycle-index'
export type LifecycleMembers = { Planned: string[]; Open: string[]; Closed: string[]; Abandoned: string[] }
export type LifecycleIndex = { id: typeof LIFECYCLE_INDEX_ID; members: LifecycleMembers }
export type StoredOpenTrade = OpenTradeProjection & {
  agreement?: { lifecycle: boolean; lots: boolean; findings: string[] }
}

const emptyMembers = (): LifecycleMembers => ({ Planned: [], Open: [], Closed: [], Abandoned: [] })
const fixed = (d: Decimal) => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)

export function toAnalysisInput(trade: StoredOpenTrade) {
  return {
    tradeId: trade.id,
    factRevision: trade.revision,
    lifecycle: trade.lifecycle,
    executions: trade.executions,
    lots: trade.lots,
  }
}

export function toBrowseRows(trades: StoredOpenTrade[]) {
  return trades.map(t => ({
    id: t.id,
    lifecycle: t.lifecycle,
    underlying: t.plan.underlying,
    netQuantity: t.positions[0]?.netQuantity ?? '0',
    allocatedOpeningFees: fixed(t.lots.reduce((sum, l) => sum.plus(l.allocatedOpeningFee), new Decimal(0))),
    factRevision: t.revision,
  }))
}

export function toHistoryView(trade: StoredOpenTrade) {
  return trade.executions.map(e => ({
    id: e.id, tradeId: e.tradeId, positionChangeId: e.positionChangeId,
    economicTime: e.economicTime, recordedSequence: e.recordedSequence,
    effective: true,
  }))
}

export function toDetail(trade: StoredOpenTrade | undefined) {
  if (!trade) return { status: 'NotFound' as const }
  const findings = trade.agreement?.findings ?? []
  return {
    status: 'Ready' as const,
    trade,
    history: toHistoryView(trade),
    integrity: { agreement: findings.length === 0, findings },
  }
}

export async function readLifecycleIndex(db: Db): Promise<LifecycleIndex> {
  const stored = await repo.get<LifecycleIndex>(db, 'trade', LIFECYCLE_INDEX_ID)
  return stored ?? { id: LIFECYCLE_INDEX_ID, members: emptyMembers() }
}

export async function writeLifecycleIndexInTx(tx: IDBTransaction, members: LifecycleMembers): Promise<void> {
  await repo.putInTx(tx, 'trade', { id: LIFECYCLE_INDEX_ID, members })
}

export async function queryOpenTrades(db: Db): Promise<StoredOpenTrade[]> {
  const index = await readLifecycleIndex(db)
  const rows: StoredOpenTrade[] = []
  for (const id of index.members.Open) {
    const trade = await repo.get<StoredOpenTrade>(db, 'trade', id)
    if (trade && trade.lifecycle === 'Open') rows.push(trade)
  }
  return rows
}

export async function getOpenTradeDetail(db: Db, id: string) {
  const trade = await repo.get<StoredOpenTrade>(db, 'trade', id)
  if (!trade || trade.lifecycle !== 'Open') return { status: 'NotFound' as const }
  return toDetail(trade)
}
