import { openDb, repo, transaction, type Db } from '../persistence/db'
import { guardWrite } from '../domain/write-gate'
import { resolveExpectedMarkDate } from '../domain/calendar'
import {
  saveMark, type MarkIntention, type MarkResolution, type ObservationRecord,
} from '../domain/market-data'
import { resolveFrames, type Frame } from '../domain/market-frames'
import { evaluate, type TradeEvaluation } from '../domain/evaluate'
import type { StoredOpenTrade } from '../domain/open-views'
import type { ReadinessEvidence, Result, RuntimeNotWritable } from '../domain/types'

export type SaveManualMarkRequest = {
  instrument: string
  date: string
  expectedRevision: string
  intention: MarkIntention
  price?: string
  reason?: string
  observedAt: string
  savedAt: string
  readiness: ReadinessEvidence
}
export type SaveManualMarkResult = {
  revision: string
  record: ObservationRecord
  resolution: MarkResolution
  postCommit: MarkResolution
}
export type SaveManualMarkError =
  | { kind: 'RuntimeNotWritable'; runtimeNotWritable: RuntimeNotWritable }
  | { kind: 'Validation'; issues: string[] }

// MarketData.save with its persistence boundary: one transaction, guarded by
// Runtime Readiness, returning the post-commit resolution without a read-back.
export async function saveManualMark(
  request: SaveManualMarkRequest,
  db?: Db,
): Promise<Result<SaveManualMarkResult, SaveManualMarkError>> {
  const gate = guardWrite(request.readiness, 'MarketData.save')
  if (!gate.ok) {
    return { ok: false, error: { kind: 'RuntimeNotWritable', runtimeNotWritable: gate.error.runtimeNotWritable } }
  }
  const handle = db ?? await openDb()
  const id = `${request.instrument}:${request.date}`
  const current = await repo.get<ObservationRecord>(handle, 'market', id)
  const prepared = saveMark({
    instrument: request.instrument, date: request.date, expectedRevision: request.expectedRevision,
    intention: request.intention, price: request.price, reason: request.reason,
    observedAt: request.observedAt, savedAt: request.savedAt,
  }, current)
  if (!prepared.ok) return { ok: false, error: { kind: 'Validation', issues: prepared.error.issues } }

  await transaction(handle, ['market'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'market', prepared.value.record)
  })
  return {
    ok: true,
    value: {
      revision: prepared.value.revision,
      record: prepared.value.record,
      resolution: prepared.value.resolution,
      postCommit: prepared.value.resolution,
    },
  }
}

export async function evaluateOpenTrade(trade: StoredOpenTrade, db: Db, now: Date) {
  const records = await repo.all<ObservationRecord>(db, 'market')
  const expectedDate = resolveExpectedMarkDate(now)
  const from = new Date(`${expectedDate}T12:00:00Z`)
  from.setUTCDate(from.getUTCDate() - 5)
  const frames = resolveFrames({
    instrument: trade.plan.underlying,
    fromDate: from.toISOString().slice(0, 10),
    toDate: expectedDate,
    now,
    records,
  })
  const frame: Frame = frames.frames.find(f => f.date === expectedDate) ?? {
    instrument: trade.plan.underlying, date: expectedDate, status: 'Missing',
  }
  const evaluation: TradeEvaluation = evaluate({
    tradeId: trade.id,
    plan: trade.plan,
    positions: trade.positions,
    lots: trade.lots,
    realizedToDate: trade.realizedToDate,
    frame,
  })
  const record = records.find(r => r.instrument === trade.plan.underlying && r.date === expectedDate)
  return {
    evaluation,
    frame,
    revision: record?.revision ?? '0',
    expectedDate,
    gaps: frames.gaps,
    snapshotId: frames.snapshotId,
    digest: frames.digest,
  }
}
