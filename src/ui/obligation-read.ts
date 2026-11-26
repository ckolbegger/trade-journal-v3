import { repo, type Db } from '../persistence/db'
import { closeReviewObligationKey, type CloseReviewOutcome } from '../domain/close-review'
import { buildTradeNarrative, type NarrativeRow } from '../domain/journal-narrative'

// D8aR R5 — one read for one Close Review obligation. Closed detail and Daily
// Review both use it; effective-outcome precedence and due semantics live
// here, and storage nouns never escape into the result.
export type ObligationRow = {
  id: string
  kind: string
  status?: string
  obligationKey?: string
  revision?: string
  reason?: string
  dueSemantics?: string
  dueAt?: string
  settlementRoute?: string
  [key: string]: unknown
}

export type ObligationStatus = 'Saved' | 'Declined' | 'Outstanding Debt' | ''

export type ObligationRead = {
  obligationKey: string
  status: ObligationStatus
  effective?: CloseReviewOutcome
  debt?: CloseReviewOutcome
  dueSemantics?: string
  dueAt?: string
  needsTradeWorkflow: boolean
}

export function obligationStatus(outcome: ObligationRow | undefined): ObligationStatus {
  if (!outcome) return ''
  if (outcome.kind === 'Entry') return 'Saved'
  if (outcome.kind === 'JournalDecline') return 'Declined'
  if (outcome.kind === 'Debt' && outcome.status !== 'Settled') return 'Outstanding Debt'
  return ''
}

function clean(outcome: ObligationRow): CloseReviewOutcome {
  const copy: ObligationRow = { ...outcome }
  delete copy.settlementRoute
  return copy as unknown as CloseReviewOutcome
}

function isTradeWorkflowDebt(row: ObligationRow): boolean {
  return String(row.settlementRoute ?? '').includes('TradeWorkflows')
    || String(row.obligationKey ?? '').startsWith('ManagementRevision:')
}

export function resolveObligation(rows: ObligationRow[], obligationKey: string): ObligationRead {
  const own = rows.filter(r => r.obligationKey === obligationKey || r.id === `entry-${obligationKey}`
    || r.id === `debt-${obligationKey}` || r.id === `decline-${obligationKey}`)
  // A settled Debt and its settlement Entry/Decline share the key; the
  // effective outcome wins over the historical obligation row.
  const effective = own.find(r => r.kind === 'Entry' && r.status === 'Saved')
    ?? own.find(r => r.kind === 'JournalDecline')
    ?? own.find(r => r.kind === 'Debt' && r.status !== 'Settled')
  const debt = own.find(r => r.kind === 'Debt' && r.status !== 'Settled')
  return {
    obligationKey,
    status: obligationStatus(effective),
    ...(effective ? { effective: clean(effective) } : {}),
    ...(debt ? { debt: clean(debt) } : {}),
    ...(debt?.dueSemantics ? { dueSemantics: debt.dueSemantics } : {}),
    ...(debt?.dueAt ? { dueAt: debt.dueAt } : {}),
    needsTradeWorkflow: debt ? isTradeWorkflowDebt(debt) : false,
  }
}

export async function readObligation(db: Db, obligationKey: string): Promise<ObligationRead> {
  const rows = await repo.all<ObligationRow>(db, 'journal')
  return resolveObligation(rows, obligationKey)
}

export async function readCloseReviewState(
  db: Db,
  trade: { id: string; executions: { id: string }[] },
): Promise<{ status: ObligationStatus; narrative: ReturnType<typeof buildTradeNarrative> }> {
  const rows = await repo.all<ObligationRow>(db, 'journal')
  const obligation = resolveObligation(rows, closeReviewObligationKey(trade.id))
  return {
    status: obligation.status,
    narrative: buildTradeNarrative(
      rows as NarrativeRow[], trade.id, trade.executions.map(e => e.id),
    ),
  }
}
