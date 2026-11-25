import Decimal from 'decimal.js'

// TradeAnalysis.replay — D5 owns this operation; later deliverables reuse it
// unchanged. Exact observations only: a gap is never a fabricated crossing.
export type ReplayFrame = {
  date: string
  status: 'Available' | 'Missing' | 'AcknowledgedUnavailable'
  price?: string
}

export type StopEpisode = {
  fingerprint: string
  conditionId: 'stop-underlying'
  start: string
  end?: string
  active: boolean
  dates: string[]
}

export type ReplayResult = {
  episodes: StopEpisode[]
  gaps: string[]
  coveredDates: string[]
}

export function replay(input: { tradeId: string; stop: string; frames: ReplayFrame[] }): ReplayResult {
  const stop = new Decimal(input.stop)
  const episodes: StopEpisode[] = []
  const gaps: string[] = []
  const coveredDates: string[] = []
  let active: StopEpisode | undefined

  for (const frame of [...input.frames].sort((a, b) => a.date.localeCompare(b.date))) {
    if (frame.status !== 'Available' || frame.price === undefined) {
      gaps.push(frame.date)
      continue
    }
    coveredDates.push(frame.date)
    const breached = new Decimal(frame.price).lt(stop)
    if (breached) {
      if (!active) {
        active = {
          fingerprint: `${input.tradeId}:stop-underlying:${frame.date}`,
          conditionId: 'stop-underlying', start: frame.date, active: true, dates: [],
        }
        episodes.push(active)
      }
      active.dates.push(frame.date)
    } else if (active) {
      active.end = frame.date
      active.active = false
      active = undefined
    }
  }

  return { episodes, gaps, coveredDates }
}
