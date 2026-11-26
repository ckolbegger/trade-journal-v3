import { repo, type Db } from '../persistence/db'
import { recordClose, type CloseResult, type ClosingExecutionInput } from '../domain/record-close'
import type { SeededReason } from '../domain/close'
import type { ReflectionDisposition } from '../domain/position-change-reflection'
import {
  commitPositionChange, type PositionChangeError, type PreparedPositionChange,
} from './position-change-commit'
import type { ReadinessEvidence } from '../domain/types'

export type RecordCloseRequest = {
  tradeId: string
  expectedRevision: string
  positionChangeId: string
  economicTime: string
  executions: ClosingExecutionInput[]
  closeReason: string
  reflection: { definitionRevision: string; disposition: ReflectionDisposition }
  readiness: ReadinessEvidence
}

export type RecordCloseError = PositionChangeError

// Stock close fact adapter. The terminal subset of the shared commit seam
// stages the Closed Trade, Journal outcome and Open→Closed index together.
export async function recordClosePositionChange(
  request: RecordCloseRequest,
  db?: Db,
): Promise<{ ok: true; value: CloseResult } | { ok: false; error: RecordCloseError }> {
  return commitPositionChange<CloseResult>({
    db,
    readiness: request.readiness,
    operation: 'TradeWorkflows.recordPositionChange',
    prepare: async handle => {
      const stored = await repo.get<Parameters<typeof recordClose>[0]['trade']>(handle, 'trade', request.tradeId)
      if (!stored) return { ok: false, error: { kind: 'Validation', issues: ['NotFound'] } }
      const catalog = await repo.get<{ closeReasons: SeededReason[] }>(handle, 'catalog', 'catalog-1')
      const prepared = recordClose({
        trade: stored,
        expectedRevision: request.expectedRevision,
        positionChangeId: request.positionChangeId,
        economicTime: request.economicTime,
        executions: request.executions,
        closeReason: request.closeReason,
        catalog,
        reflection: request.reflection,
      })
      if (!prepared.ok) {
        return { ok: false, error: { kind: 'Validation', issues: prepared.error.issues } }
      }
      const result = prepared.value
      const change: PreparedPositionChange<CloseResult> = {
        trade: { id: result.trade.id, ...result.trade },
        journalOutcome: { id: result.receipt.journalOutcomeId, ...result.journalOutcome },
        bucket: 'Closed',
        result,
      }
      return { ok: true, value: change }
    },
  })
}
