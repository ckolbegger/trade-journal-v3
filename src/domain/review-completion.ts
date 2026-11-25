export const COMPLETION_STATES = ['Incomplete', 'Complete', 'CompleteWithUnavailableMarks'] as const
export type CompletionState = (typeof COMPLETION_STATES)[number]
export const SETTLEMENT_SUBSTATE = 'Complete, settlement to record'
export const REASON_CODES = [
  'MarkMissing', 'AcknowledgedUnavailable', 'ActionMissing', 'DebtDue',
  'SettlementDue', 'DeviationPending', 'IntegrityBlocked',
] as const

export type CompletionTrade = {
  tradeId: string
  actionSaved: boolean
  markStatus?: 'Available' | 'Missing' | 'AcknowledgedUnavailable'
  instrument?: string
}

export type CompletionInput = {
  missingMarks: string[]
  dueDebt: string[]
  settlementDue: { instrument: string; tradeId: string }[]
  unreconciledEpisodes: string[]
  integrityBlocked: boolean
  trades: CompletionTrade[]
}

export type CompletionResult = {
  state: CompletionState
  blockers: string[]
  unavailable: { instrument: string; tradeId: string }[]
  settlementSubState?: { text: string; instruments: string[]; trades: string[] }
}

export function deriveCompletion(input: CompletionInput): CompletionResult {
  const blockers: string[] = []
  if (input.missingMarks.length) blockers.push('MarkMissing')
  if (input.dueDebt.length) blockers.push('DebtDue')
  if (input.trades.some(t => !t.actionSaved)) blockers.push('ActionMissing')
  if (input.unreconciledEpisodes.length) blockers.push('DeviationPending')
  if (input.integrityBlocked) blockers.push('IntegrityBlocked')

  const unavailable = input.trades
    .filter(t => t.markStatus === 'AcknowledgedUnavailable' && t.instrument)
    .map(t => ({ instrument: t.instrument!, tradeId: t.tradeId }))

  if (input.settlementDue.length) blockers.push('SettlementDue')
  const settlementOnly = blockers.length === 1 && blockers[0] === 'SettlementDue'
  if (blockers.length && !settlementOnly) return { state: 'Incomplete', blockers, unavailable }
  if (settlementOnly) {
    return {
      state: 'Incomplete',
      blockers,
      unavailable,
      settlementSubState: {
        text: SETTLEMENT_SUBSTATE,
        instruments: input.settlementDue.map(s => s.instrument),
        trades: input.settlementDue.map(s => s.tradeId),
      },
    }
  }
  if (unavailable.length) return { state: 'CompleteWithUnavailableMarks', blockers: [], unavailable }
  return { state: 'Complete', blockers: [], unavailable: [] }
}

export type AttentionInput = {
  tradeId: string
  markStatus: 'Available' | 'Missing' | 'AcknowledgedUnavailable'
  stopCrossed: boolean
  risk?: number | 'Unbounded'
  reward?: number | 'Unbounded'
  lastActivity: string
}

export type AttentionBand = 'Blocker' | 'Boundary' | 'EvidenceLimited' | 'QuantifiedPressure' | 'Routine'
export type AttentionResult = {
  tradeId: string
  band: AttentionBand
  reasons: string[]
  pressure: number | null
  basis: { risk: AttentionInput['risk']; reward: AttentionInput['reward'] }
}

const BAND_ORDER: AttentionBand[] = ['Blocker', 'Boundary', 'EvidenceLimited', 'QuantifiedPressure', 'Routine']

export function rankTrades(inputs: AttentionInput[]): AttentionResult[] {
  return inputs.map(input => {
    let band: AttentionBand = 'Routine'
    const reasons: string[] = []
    if (input.markStatus === 'Missing') {
      band = 'Blocker'
      reasons.push('CurrentMarkMissing')
    } else if (input.stopCrossed) {
      band = 'Boundary'
      reasons.push('StopCrossed')
    } else if (input.markStatus === 'AcknowledgedUnavailable') {
      band = 'EvidenceLimited'
      reasons.push('AcknowledgedUnavailable')
    } else if (input.risk !== undefined && input.reward !== undefined) {
      band = 'QuantifiedPressure'
      reasons.push('MonetaryRiskAvailable')
    }
    const pressure = typeof input.risk === 'number' ? input.risk : input.risk === 'Unbounded' ? Number.POSITIVE_INFINITY : null
    return { tradeId: input.tradeId, band, reasons, pressure, basis: { risk: input.risk, reward: input.reward } }
  }).sort((a, b) => {
    const byBand = BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band)
    if (byBand) return byBand
    const byPressure = (b.pressure ?? -1) - (a.pressure ?? -1)
    if (byPressure) return byPressure
    const inputA = inputs.find(i => i.tradeId === a.tradeId)!
    const inputB = inputs.find(i => i.tradeId === b.tradeId)!
    const byActivity = inputB.lastActivity.localeCompare(inputA.lastActivity)
    return byActivity || a.tradeId.localeCompare(b.tradeId)
  })
}
