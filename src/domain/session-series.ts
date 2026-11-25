import type { Frame, FrameResult } from './market-frames'
import { replay, type StopEpisode } from './replay'

// TradeViewsAndReporting.replayTrade(MarkOnly). One point per completed
// session comes from that session's exact end-of-day Mark alone. Absent Marks
// are explicit gaps; nothing is interpolated or carried forward. A provider
// Daily Bar is never required and is not part of this read.
export type SessionPoint = {
  date: string
  status: Frame['status']
  price?: string
  gap: boolean
  keyMoments: string[]
}

export type SessionSeries = {
  expectedDate: string
  sessions: SessionPoint[]
  gaps: string[]
  episodes: StopEpisode[]
  snapshotId: string
  digest: string
  sessionPolicy: string
}

export type SessionSeriesInput = {
  tradeId: string
  stop: string
  framesResult: FrameResult
}

export function readSessionSeries(input: SessionSeriesInput): SessionSeries {
  const { expectedDate, frames, snapshotId, digest, sessionPolicy } = input.framesResult
  const capped = frames.filter(f => f.date <= expectedDate)
    .sort((a, b) => a.date.localeCompare(b.date))
  const played = replay({ tradeId: input.tradeId, stop: input.stop, frames: capped })
  const gaps = [...new Set([...played.gaps, ...capped.filter(f => f.status !== 'Available').map(f => f.date)])]
    .sort((a, b) => a.localeCompare(b))

  const keyByDate = new Map<string, string[]>()
  for (const episode of played.episodes) {
    keyByDate.set(episode.start, [...(keyByDate.get(episode.start) ?? []), 'Stop breached'])
    if (episode.end) {
      keyByDate.set(episode.end, [...(keyByDate.get(episode.end) ?? []), 'Stop recovered'])
    }
  }

  const sessions: SessionPoint[] = capped.map(f => ({
    date: f.date,
    status: f.status,
    ...(f.status === 'Available' && f.price !== undefined ? { price: f.price } : {}),
    gap: gaps.includes(f.date),
    keyMoments: keyByDate.get(f.date) ?? [],
  }))

  return {
    expectedDate,
    sessions,
    gaps,
    episodes: played.episodes,
    snapshotId,
    digest,
    sessionPolicy,
  }
}
