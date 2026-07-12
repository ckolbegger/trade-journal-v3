import { useEffect, useState } from 'react'
import { useReview } from '../reviewContext'
import { useTradeBook } from '../tradeBookContext'
import { WalkCheckpoint } from './WalkCheckpoint'
import { btnPrimary, card, num, subheading } from '../styles'
import type { ISODate } from '@/books/pricebook/types'
import type { TradeMarksNeeded } from '@/coordinators/valuations'

// The walk: the open Trades, one checkpoint at a time, in the order Review.walk
// gave at session start. That order is SNAPSHOTTED — Marks landing mid-walk never
// reshuffle it (review.md: fetch → rank → walk, then the order holds). A Trade
// already reviewed today counts toward progress without being re-asked, and a
// Trade the trader steps past simply stays unreviewed: skipping is visible, never
// nagged (same philosophy as Journal Debt).

interface Checkpoint {
  tradeId: string
  ticker: string
  reviewedToday: boolean
  marks?: TradeMarksNeeded
}

export function WalkSession({
  asOf,
  marksNeeded,
}: {
  asOf: ISODate
  marksNeeded: TradeMarksNeeded[]
}) {
  const review = useReview()
  const tradeBook = useTradeBook()
  const [checkpoints, setCheckpoints] = useState<Checkpoint[] | null>(null)
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let active = true
    async function start() {
      const items = await review.walk(asOf)
      const loaded: Checkpoint[] = []
      for (const item of items) {
        const record = await tradeBook.get(item.tradeId)
        loaded.push({
          tradeId: item.tradeId,
          ticker: record.plan.plannedLegs[0]?.instrument.ticker ?? '',
          reviewedToday: item.reviewedToday,
          marks: marksNeeded.find((m) => m.tradeId === item.tradeId),
        })
      }
      if (!active) return
      setCheckpoints(loaded)
      setReviewed(new Set(loaded.filter((c) => c.reviewedToday).map((c) => c.tradeId)))
    }
    void start()
    return () => {
      active = false
    }
    // The walk runs once per session: this is the order snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review, tradeBook, asOf])

  if (!checkpoints) return <p className="text-sm text-slate-500">Loading…</p>

  const current = checkpoints[index]

  return (
    <div className="space-y-4">
      <p aria-label="progress" className={`text-sm text-slate-600 ${num}`}>
        Reviewed {reviewed.size} of {checkpoints.length}
      </p>

      {current ? (
        <>
          <WalkCheckpoint
            key={current.tradeId}
            tradeId={current.tradeId}
            ticker={current.ticker}
            instruments={current.marks?.instruments ?? []}
            range={current.marks?.range}
            asOf={asOf}
            reviewedToday={current.reviewedToday}
            onReviewed={(tradeId) => setReviewed((done) => new Set(done).add(tradeId))}
          />
          <button type="button" className={btnPrimary} onClick={() => setIndex((n) => n + 1)}>
            Next trade
          </button>
        </>
      ) : (
        <div className={`${card} space-y-3`}>
          <h3 className={subheading}>Review complete</h3>
          <ul aria-label="walk summary" className="divide-y divide-slate-100">
            {checkpoints.map((checkpoint) => (
              <li
                key={checkpoint.tradeId}
                aria-label={checkpoint.ticker}
                className="flex items-center justify-between py-2 text-sm text-slate-800"
              >
                <span>{checkpoint.ticker}</span>
                {reviewed.has(checkpoint.tradeId) ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    Reviewed
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    Not reviewed
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
