import { repo, type Db } from '../persistence/db'
import {
  recordPositionChange, type OpeningExecutionInput,
  type OpenTradeProjection, type PositionChangeCommand, type PositionChangeResult,
} from '../domain/record-position-change'
import type { ReflectionDisposition } from '../domain/position-change-reflection'
import {
  commitPositionChange, type PositionChangeError, type PreparedPositionChange,
} from './position-change-commit'
import type { ReadinessEvidence } from '../domain/types'

export type RecordOpeningRequest = {
  tradeId: string
  expectedRevision: string
  positionChangeId: string
  economicTime: string
  executions: OpeningExecutionInput[]
  reflection: { definitionRevision: string; disposition: ReflectionDisposition }
  readiness: ReadinessEvidence
}

export type RecordOpeningError = PositionChangeError

// Stock opening fact adapter. The pure command builds the candidate; the
// shared commit seam gates, persists and moves the lifecycle index.
export async function recordOpeningPositionChange(
  request: RecordOpeningRequest,
  db?: Db,
): Promise<{ ok: true; value: PositionChangeResult } | { ok: false; error: RecordOpeningError }> {
  return commitPositionChange<PositionChangeResult>({
    db,
    readiness: request.readiness,
    operation: 'TradeWorkflows.recordPositionChange',
    prepare: async handle => {
      const stored = await repo.get<OpenTradeProjection & { plan: PositionChangeCommand['trade']['plan'] }>(
        handle, 'trade', request.tradeId,
      )
      if (!stored) return { ok: false, error: { kind: 'Validation', issues: ['NotFound'] } }

      const command: PositionChangeCommand = {
        trade: {
          id: stored.id, lifecycle: stored.lifecycle,
          revision: stored.revision ?? '1', economicTime: stored.economicTime,
          plan: stored.plan,
        },
        expectedRevision: request.expectedRevision,
        positionChangeId: request.positionChangeId,
        economicTime: request.economicTime,
        executions: request.executions,
        reflection: request.reflection,
      }
      const prepared = recordPositionChange(command)
      if (!prepared.ok) {
        return { ok: false, error: { kind: 'Validation', issues: prepared.error.issues } }
      }
      const result = prepared.value
      const change: PreparedPositionChange<PositionChangeResult> = {
        trade: { id: result.trade.id, ...result.trade },
        journalOutcome: { id: result.receipt.journalOutcomeId, ...result.journalOutcome },
        bucket: 'Open',
        result,
      }
      return { ok: true, value: change }
    },
  })
}
