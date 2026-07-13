import { useState } from 'react'
import { useReview } from '../reviewContext'
import { usePriceBook } from '../priceBookContext'
import { useTradeBook } from '../tradeBookContext'
import { WalkSession } from './WalkSession'
import { CloseForm } from './CloseForm'
import { optionLabel, todayISO } from '../format'
import { btnPrimary, btnSecondary, card, heading, num, subheading } from '../styles'
import type { ISODate, InstrumentKey } from '@/books/pricebook/types'
import type { ExpiredHolding, TradeMarksNeeded } from '@/coordinators/valuations'

// The Daily Review start page: the session's agenda. Starting a session asks the
// Review coordinator what today must cover, then ALWAYS calls PriceBook.fetch —
// the UI has exactly one collection path and never knows whether pricing sources
// exist (docs/design/review.md); with none registered the call is an instant
// no-op and everything routes to the manual rows below. What is still missing
// after the fetch is the authoritative remainder (PriceBook.missingMarks), shown
// per Trade so a skipped day's rows are visible rather than silently lost.
//
// "Begin walk" hands the agenda's per-Trade Mark gaps to the walk (WalkSession),
// which asks Review for the session order and steps through the checkpoints.

interface AgendaTrade {
  tradeId: string
  ticker: string
  missing: { instrument: InstrumentKey; date: ISODate }[]
}

interface Session {
  asOf: ISODate
  trades: AgendaTrade[]
  marksNeeded: TradeMarksNeeded[]
  expiredLegs: ExpiredHolding[]
  debt: number
}

export function ReviewPage() {
  const review = useReview()
  const priceBook = usePriceBook()
  const tradeBook = useTradeBook()
  const [session, setSession] = useState<Session | null>(null)
  const [walking, setWalking] = useState(false)
  // A Trade the "expired worthless" action just flattened — the normal Close
  // Reason flow triggers here rather than waiting for the trader to open the
  // Trade's own detail page (docs/design/review.md's expiration sequence).
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null)

  async function startSession() {
    const asOf = todayISO()
    const agenda = await review.agenda(asOf)

    const instruments = [
      ...new Set(agenda.marksNeeded.flatMap((item) => item.needs.map((n) => n.instrument))),
    ]
    await priceBook.fetch(instruments, agenda.fetchRange)

    const trades = await Promise.all(
      agenda.marksNeeded.map(async (item) => {
        const record = await tradeBook.get(item.tradeId)
        const missing = (
          await Promise.all(
            item.needs.map((need) => priceBook.missingMarks([need.instrument], need.range)),
          )
        ).flat()
        return {
          tradeId: item.tradeId,
          ticker: record.plan.plannedLegs[0]?.instrument.ticker ?? '',
          missing,
        }
      }),
    )
    setSession({
      asOf,
      trades,
      marksNeeded: agenda.marksNeeded,
      expiredLegs: agenda.expiredLegs,
      debt: agenda.journalDebt.length,
    })
  }

  // Records the option Leg's expiration at price 0 through the ordinary
  // Execution path (review.md) — the same recordExecution any fill goes
  // through, deviation-free until Slice 9. A short holding closes by buying
  // back; a long holding closes by selling.
  async function recordExpiredWorthless(leg: ExpiredHolding) {
    const outcome = await tradeBook.recordExecution(
      { tradeId: leg.tradeId, legId: leg.legId },
      {
        side: leg.side === 'short' ? 'buy' : 'sell',
        qty: leg.qty,
        price: 0,
        fees: 0,
        kind: 'expire',
        timestamp: new Date(`${leg.expiredOn}T16:00:00`).getTime(),
      },
    )
    setSession((s) =>
      s ? { ...s, expiredLegs: s.expiredLegs.filter((l) => l.legId !== leg.legId) } : s,
    )
    if (outcome.nowFlat) setClosingTradeId(leg.tradeId)
  }

  if (!session) {
    return (
      <section className="space-y-4">
        <h2 className={heading}>Review</h2>
        <p className="text-sm text-slate-600">
          Collect the day&apos;s Marks — including any days you skipped — and settle what you owe.
        </p>
        <button type="button" className={btnPrimary} onClick={() => void startSession()}>
          Start review
        </button>
      </section>
    )
  }

  if (walking) {
    return (
      <section className="space-y-6">
        <h2 className={heading}>Review</h2>
        <WalkSession asOf={session.asOf} marksNeeded={session.marksNeeded} />
      </section>
    )
  }

  const caughtUp =
    session.trades.length === 0 && session.debt === 0 && session.expiredLegs.length === 0

  return (
    <section className="space-y-6">
      <h2 className={heading}>Review</h2>

      {closingTradeId && (
        <CloseForm
          tradeId={closingTradeId}
          onDone={() => setClosingTradeId(null)}
          onDismiss={() => setClosingTradeId(null)}
        />
      )}

      {caughtUp ? (
        <div className={card}>
          <p className="text-sm text-slate-600">All caught up — nothing to collect today.</p>
        </div>
      ) : (
        <>
          {session.expiredLegs.length > 0 && (
            <div className={`${card} space-y-3`}>
              <h3 className={subheading}>Expired options</h3>
              <ul aria-label="expired options" className="space-y-2">
                {session.expiredLegs.map((leg) => (
                  <li
                    key={leg.legId}
                    aria-label={`${leg.qty} ${optionLabel(leg.instrument)}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm text-slate-800"
                  >
                    <span>
                      {leg.side === 'short' ? '-' : ''}
                      {leg.qty} × {optionLabel(leg.instrument)}
                      <span className={`ml-2 text-slate-500 ${num}`}>expired {leg.expiredOn}</span>
                    </span>
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => void recordExpiredWorthless(leg)}
                    >
                      Expired worthless
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <h3 className={subheading}>Marks needed</h3>
            {session.trades.length === 0 ? (
              <p className="text-sm text-slate-600">Every open Trade is marked through today.</p>
            ) : (
              <ul className="space-y-4">
                {session.trades.map((trade) => (
                  <li key={trade.tradeId} aria-label={trade.ticker} className={card}>
                    <p className="font-medium text-slate-900">{trade.ticker}</p>
                    <ul className="mt-2 divide-y divide-slate-100">
                      {trade.missing.map(({ instrument, date }) => (
                        <li
                          key={`${instrument}|${date}`}
                          aria-label={`${instrument} ${date}`}
                          className="flex items-center justify-between py-1.5 text-sm text-slate-600"
                        >
                          <span>{instrument}</span>
                          <span className={num}>{date}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={card}>
            <h3 className={subheading}>Journal debt</h3>
            <p aria-label="journal debt" className={`mt-1 text-sm text-slate-600 ${num}`}>
              {session.debt} {session.debt === 1 ? 'entry' : 'entries'} owed
            </p>
          </div>
        </>
      )}

      {/* Marks are the fuel; the walk is the point — every open Trade still owes
          today's Action even when nothing is left to collect. */}
      <button type="button" className={btnPrimary} onClick={() => setWalking(true)}>
        Begin walk
      </button>
    </section>
  )
}
