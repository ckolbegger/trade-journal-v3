import { completedSessionsBetween, resolveExpectedMarkDate } from './calendar'
import { recordId, resolveKey, type ObservationRecord } from './market-data'

export const SESSION_POLICY_REVISION = 'v1'

export type Frame = {
  instrument: string
  date: string
  status: 'Available' | 'Missing' | 'AcknowledgedUnavailable'
  price?: string
  revision?: string
  stale?: { price: string; date: string; revision: string }
}

export type FrameQuery = {
  instrument: string
  fromDate: string
  toDate: string
  now: Date
  records: ObservationRecord[]
}

export type FrameResult = {
  expectedDate: string
  frames: Frame[]
  gaps: string[]
  snapshotId: string
  digest: string
  sessionPolicy: string
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `fnv1a-${hash.toString(16).padStart(8, '0')}`
}

export function resolveFrames(query: FrameQuery): FrameResult {
  const expectedDate = resolveExpectedMarkDate(query.now)
  // Only completed regular sessions belong in a frame range; at noon Tuesday
  // Tuesday's session is not complete even if the caller's range includes it.
  const through = query.toDate < expectedDate ? query.toDate : expectedDate
  const sessions = completedSessionsBetween(query.fromDate, through)
  const frames: Frame[] = sessions.map(date => {
    const record = query.records.find(r => r.id === recordId(query.instrument, date))
    const resolution = resolveKey(record, date, query.records)
    return {
      instrument: query.instrument,
      date,
      status: resolution.status,
      price: 'price' in resolution ? resolution.price : undefined,
      revision: 'revision' in resolution ? resolution.revision : undefined,
      stale: 'stale' in resolution ? resolution.stale : undefined,
    }
  })
  const gaps = frames.filter(f => f.status === 'Missing').map(f => f.date)
  const digest = fnv1a(JSON.stringify({ expectedDate, frames, gaps, sessionPolicy: SESSION_POLICY_REVISION }))
  return {
    expectedDate,
    frames,
    gaps,
    digest,
    snapshotId: `frames-${query.instrument}-${digest.slice(-8)}`,
    sessionPolicy: SESSION_POLICY_REVISION,
  }
}
