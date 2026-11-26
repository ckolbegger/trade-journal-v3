import { openDb, repo, type Db } from '../persistence/db'
import { resolveExpectedMarkDate } from '../domain/calendar'
import { resolveFrames } from '../domain/market-frames'
import { type ObservationRecord } from '../domain/market-data'
import { canonicalInstrument, type OptionContract } from '../domain/option-contract'
import { readSessionSeries, type SessionSeries } from '../domain/session-series'
import {
  buildCompleteTradeDetail, type CompleteDetail, type CompleteDetailTrade,
} from '../domain/complete-detail'
import type { NarrativeRow } from '../domain/journal-narrative'
import { readStoredTrade } from './trade-read'
import {
  buildAdvisory, resolveContract, type AdvisoryResult,
} from '../domain/advisory-frames'

// Read-only assembly. No store is written by any complete-detail or replay
// request; advisory outputs are computed per request and never persisted.

export type LoadedDetail =
  | { status: 'NotFound' }
  | { status: 'Ready'; detail: CompleteDetail; series: SessionSeries; advisory: AdvisoryResult | null }

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

export async function loadCompleteTradeDetail(
  request: LoadDetailRequest,
  db?: Db,
): Promise<LoadedDetail> {
  const handle = db ?? await openDb()
  const stored = await readStoredTrade<StoredDetailTrade>(handle, request.tradeId)
  if (!stored) return { status: 'NotFound' }

  const records = await repo.all<ObservationRecord>(handle, 'market')
  const journalRows = await repo.all<NarrativeRow>(handle, 'journal')
  const contract = resolveContract(stored)
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
  // Canonical normalisation lives in the Trade read module; this adapter only
  // lifts the frozen Planned Leg from the Plan to the payoff seam's input.
  const tradeForDetail = stored.plan.plannedLeg && !stored.plannedLeg
    ? { ...stored, plannedLeg: stored.plan.plannedLeg }
    : stored
  const detail = buildCompleteTradeDetail({
    trade: tradeForDetail, series, journalRows,
    coverage: {
      instrument: framesResult.frames.find(f => f.date === expectedDate)?.instrument ?? stored.underlying,
      date: expectedDate,
      status: framesResult.frames.find(f => f.date === expectedDate)?.status ?? 'Missing',
    },
  })

  return {
    status: 'Ready', detail, series,
    advisory: buildAdvisory({
      trade: stored, series, records, installed: request.advisoryInstalled,
    }),
  }
}
