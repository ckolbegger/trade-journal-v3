import { openDb, repo, type Db } from '../persistence/db'
import { resolveExpectedMarkDate } from '../domain/calendar'
import { resolveFrames } from '../domain/market-frames'
import { resolveKey, type ObservationRecord } from '../domain/market-data'
import { canonicalInstrument, type OptionContract } from '../domain/option-contract'
import { resolveStrategyShape } from '../domain/strategy-shapes'
import { readSessionSeries, type SessionSeries } from '../domain/session-series'
import {
  buildCompleteTradeDetail, type CompleteDetail, type CompleteDetailTrade,
} from '../domain/complete-detail'
import type { NarrativeRow } from '../domain/journal-narrative'
import {
  advisoryImpliedVolatility, type AdvisoryIvResult,
} from '../domain/advisory-iv'
import {
  advisoryShareEquivalent, priceMoveDecomposition,
  type AdvisoryFrame, type Decomposition, type ShareEquivalent,
} from '../domain/advisory-decomposition'

// Read-only assembly. No store is written by any complete-detail or replay
// request; advisory outputs are computed per request and never persisted.
export type DetailAdvisory = {
  iv: AdvisoryIvResult | null
  shareEquivalent: ShareEquivalent | null
  decomposition: Decomposition | null
}

export type LoadedDetail =
  | { status: 'NotFound' }
  | { status: 'Ready'; detail: CompleteDetail; series: SessionSeries; advisory: DetailAdvisory | null }

export type LoadDetailRequest = {
  tradeId: string
  now: Date
  advisoryInstalled: boolean
}

type StoredDetailTrade = CompleteDetailTrade & {
  plan: CompleteDetailTrade['plan'] & {
    underlying?: string
    quantity?: number
    contract?: OptionContract
    strategyId?: string
  }
}

function contractOf(trade: StoredDetailTrade): OptionContract | undefined {
  // confirmOptionPlan freezes the Strategy id inside the Plan, not at the
  // Trade top level; both placements must resolve the same exact contract.
  const strategyId = trade.strategyId ?? trade.plan.strategyId
  return strategyId?.startsWith('seed-') && trade.plan.contract
    ? trade.plan.contract
    : undefined
}

function underlyingPrice(records: ObservationRecord[], underlying: string, date: string): string | undefined {
  const record = records.find(r => r.instrument === underlying && r.date === date)
  const resolution = resolveKey(record, date, records)
  return resolution.status === 'Available' ? resolution.price : undefined
}

function daysToExpiration(date: string, expiration?: string): number {
  if (!expiration) return 0
  return Math.max(0, Math.round((new Date(`${expiration}T00:00:00Z`).getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000))
}

function advisoryFrames(
  trade: StoredDetailTrade, series: SessionSeries, records: ObservationRecord[],
): AdvisoryFrame[] {
  const contract = contractOf(trade)
  const shape = resolveStrategyShape(trade.strategyId ?? trade.plan.strategyId ?? '')
  const kind = contract?.kind ?? (shape.ok ? shape.value.expectedKind : 'Call')
  const underlying = trade.plan.underlying ?? trade.underlying
  return series.sessions.map(session => ({
    date: session.date,
    kind,
    mark: session.price,
    underlying: underlyingPrice(records, underlying, session.date) ?? '',
    strike: contract?.strike ?? '0',
    days: daysToExpiration(session.date, contract?.expiration),
    multiplier: contract?.multiplier ?? 100,
    quantity: trade.plan.quantity ?? 1,
    side: shape.ok && shape.value.openingAction === 'Sell' ? -1 : 1,
  }))
}

export async function loadCompleteTradeDetail(
  request: LoadDetailRequest,
  db?: Db,
): Promise<LoadedDetail> {
  const handle = db ?? await openDb()
  const stored = await repo.get<StoredDetailTrade>(handle, 'trade', request.tradeId)
  if (!stored) return { status: 'NotFound' }

  const records = await repo.all<ObservationRecord>(handle, 'market')
  const journalRows = await repo.all<NarrativeRow>(handle, 'journal')
  const contract = contractOf(stored)
  const expectedDate = resolveExpectedMarkDate(request.now)
  const from = new Date(`${expectedDate}T12:00:00Z`)
  from.setUTCDate(from.getUTCDate() - 5)
  const framesResult = resolveFrames({
    instrument: contract ? canonicalInstrument(contract) : stored.plan.underlying ?? stored.underlying,
    fromDate: from.toISOString().slice(0, 10),
    toDate: expectedDate,
    now: request.now,
    records,
  })
  const series = readSessionSeries({
    tradeId: stored.id, stop: stored.plan.stop, framesResult,
  })
  // A Planned Trade has no fills yet; normalize the persisted projection so
  // read assembly works across every lifecycle without inventing facts.
  const normalized: CompleteDetailTrade = {
    ...stored,
    oneR: stored.oneR ?? stored.plan.oneR ?? '0.00',
    underlying: stored.underlying ?? stored.plan.underlying ?? '',
    strategyId: stored.strategyId ?? stored.plan.strategyId,
    executions: stored.executions ?? [],
    lots: stored.lots ?? [],
    positions: stored.positions ?? [],
    realizedToDate: stored.realizedToDate ?? '0.00',
    agreement: stored.agreement ?? { lifecycle: true, lots: true, findings: [] },
  }
  const detail = buildCompleteTradeDetail({
    trade: normalized, series, journalRows,
    coverage: {
      instrument: framesResult.frames.find(f => f.date === expectedDate)?.instrument ?? stored.underlying,
      date: expectedDate,
      status: framesResult.frames.find(f => f.date === expectedDate)?.status ?? 'Missing',
    },
  })

  if (!request.advisoryInstalled) return { status: 'Ready', detail, series, advisory: null }

  const frames = advisoryFrames(stored, series, records).filter(f => f.mark !== undefined && f.underlying)
  const last = frames.at(-1)
  const previous = frames.at(-2)
  const inputOf = (frame: AdvisoryFrame) => ({
    kind: frame.kind, mark: frame.mark, underlying: frame.underlying,
    strike: frame.strike, days: frame.days,
  })
  const iv = last ? advisoryImpliedVolatility(inputOf(last), true) : null
  return {
    status: 'Ready', detail, series,
    advisory: {
      iv,
      shareEquivalent: last ? advisoryShareEquivalent({ frame: last, installed: true }) : null,
      decomposition: last && previous
        ? priceMoveDecomposition({ before: previous, after: last, installed: true })
        : null,
    },
  }
}
