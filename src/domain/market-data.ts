import type { Result } from './types'

// Market Data owns exact Instrument + Trading Date observations. It knows no
// Trades, Positions, P&L or calculations.
export type MarkSource = 'Manual' | 'Provider'
export type MarkIntention =
  | 'RecordManualMark' | 'ManualOverride' | 'CorrectMark'
  | 'ProviderClose' | 'AcknowledgeUnavailable' | 'WithdrawAcknowledgment'

export type MarkVersion = {
  revision: string
  price?: string
  source: MarkSource
  intention: MarkIntention
  observedAt: string
  savedAt: string
  reason?: string
}
export type AcknowledgmentVersion = {
  revision: string
  reason: string
  observedAt: string
  savedAt: string
  withdrawn?: boolean
}
export type ObservationRecord = {
  id: string
  instrument: string
  date: string
  revision: string
  marks: MarkVersion[]
  acknowledgments: AcknowledgmentVersion[]
}

export type MarkResolution =
  | { status: 'Available'; price: string; revision: string; source: MarkSource; stale?: StaleContext }
  | { status: 'Missing'; stale?: StaleContext }
  | { status: 'AcknowledgedUnavailable'; reason: string; revision: string; stale?: StaleContext }
export type StaleContext = { price: string; date: string; revision: string }

export type SaveMarkCommand = {
  instrument: string
  date: string
  expectedRevision: string
  intention: MarkIntention
  price?: string
  reason?: string
  observedAt: string
  savedAt: string
  source?: MarkSource
}
export type SaveMarkResult = { record: ObservationRecord; revision: string; resolution: MarkResolution }

export function recordId(instrument: string, date: string): string {
  return `${instrument}:${date}`
}

export function resolveKey(
  record: ObservationRecord | undefined,
  date: string,
  records: ObservationRecord[],
): MarkResolution {
  const instrument = record?.instrument ?? records[0]?.instrument ?? ''
  const stale = nearestEarlierMark(instrument, date, records)
  const mark = record?.marks.at(-1)
  if (mark?.price !== undefined) {
    return { status: 'Available', price: mark.price, revision: mark.revision, source: mark.source, ...(stale ? { stale } : {}) }
  }
  const ack = record?.acknowledgments.at(-1)
  if (ack && !ack.withdrawn) {
    return { status: 'AcknowledgedUnavailable', reason: ack.reason, revision: ack.revision, ...(stale ? { stale } : {}) }
  }
  return { status: 'Missing', ...(stale ? { stale } : {}) }
}

function nearestEarlierMark(instrument: string, date: string, records: ObservationRecord[]): StaleContext | undefined {
  const earlier = records
    .filter(r => r.instrument === instrument && r.date < date && r.marks.some(m => m.price !== undefined))
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  const mark = earlier?.marks.at(-1)
  if (!earlier || !mark?.price) return undefined
  return { price: mark.price, date: earlier.date, revision: mark.revision }
}

export function saveMark(
  command: SaveMarkCommand,
  current: ObservationRecord | undefined,
): Result<SaveMarkResult, { issues: string[] }> {
  const issues: string[] = []
  const base: ObservationRecord = current ?? {
    id: recordId(command.instrument, command.date), instrument: command.instrument,
    date: command.date, revision: '0', marks: [], acknowledgments: [],
  }
  if (base.revision !== command.expectedRevision) issues.push('StaleRevision')

  const priced = ['RecordManualMark', 'ManualOverride', 'CorrectMark', 'ProviderClose'].includes(command.intention)
  if (priced) {
    const price = Number(command.price)
    if (!command.price || !Number.isFinite(price) || price <= 0) issues.push('InvalidPrice')
    if (command.intention === 'CorrectMark' && !command.reason?.trim()) issues.push('MissingCorrectionReason')
  }
  if (command.intention === 'AcknowledgeUnavailable') {
    if (!command.reason?.trim()) issues.push('MissingReason')
    if (command.price !== undefined) issues.push('AcknowledgmentHasPrice')
    if (base.marks.some(m => m.price !== undefined)) issues.push('ExactMarkExists')
  }
  if (command.intention === 'WithdrawAcknowledgment' && !base.acknowledgments.some(a => !a.withdrawn)) {
    issues.push('NothingToWithdraw')
  }
  if (command.intention === 'ProviderClose' && base.marks.some(m => m.source === 'Manual' && m.price !== undefined)) {
    issues.push('ManualSticky')
  }
  if (issues.length) return { ok: false, error: { issues } }

  const revision = String(Number(base.revision) + 1)
  const record: ObservationRecord = { ...base, revision, marks: [...base.marks], acknowledgments: [...base.acknowledgments] }
  if (priced) {
    record.marks.push({
      revision,
      price: command.price,
      source: command.intention === 'ProviderClose' ? (command.source ?? 'Provider') : 'Manual',
      intention: command.intention,
      observedAt: command.observedAt,
      savedAt: command.savedAt,
      ...(command.reason ? { reason: command.reason } : {}),
    })
  } else if (command.intention === 'AcknowledgeUnavailable') {
    record.acknowledgments.push({ revision, reason: command.reason!, observedAt: command.observedAt, savedAt: command.savedAt })
  } else {
    // Withdrawal is an immutable history version, never a rewrite of the
    // original acknowledgment.
    const last = record.acknowledgments.at(-1)!
    record.acknowledgments.push({ ...last, withdrawn: true, revision })
  }

  return { ok: true, value: { record, revision, resolution: resolveKey(record, command.date, [record]) } }
}
