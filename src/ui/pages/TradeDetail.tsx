import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTradeBook } from '../tradeBookContext'
import { useJournal } from '../journalContext'
import { useValuations } from '../valuationsContext'
import { RecordFillForm } from './RecordFillForm'
import { CloseForm } from './CloseForm'
import { TradeDashboard } from './TradeDashboard'
import { centsToDollars, timestampToISODate } from '../format'
import { StatusBadge } from '../components/Badge'
import { AddAddendum } from '../components/AddAddendum'
import { AnsweredPrompts } from '../components/AnsweredPrompts'
import { buildEntryThreads } from '../components/entryThread'
import { btnSecondary, card, heading, link, num, subheading } from '../styles'
import type { Position, TradeRecord, TradeStatus } from '@/books/tradebook/types'
import type { Entry } from '@/books/journal/types'

// The Trade detail page renders Plan facts only — thesis, Strategy, Idea Source,
// Planned Legs, Exit Levels, chart link, and the derived status badge. No
// valuation numbers (those arrive in S1.5) and, deliberately, no way to edit the
// confirmed Plan: its immutability is the product.

const STATUS_BUCKETS: TradeStatus[] = ['planned', 'open', 'closed']

export function TradeDetail() {
  const tradeBook = useTradeBook()
  const journal = useJournal()
  const valuations = useValuations()
  const { id } = useParams()
  const [trade, setTrade] = useState<TradeRecord | null>(null)
  const [status, setStatus] = useState<TradeStatus | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [strategyName, setStrategyName] = useState('')
  const [ideaSourceName, setIdeaSourceName] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [showFill, setShowFill] = useState(false)
  const [closeDismissed, setCloseDismissed] = useState(false)
  const [abandoning, setAbandoning] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (!id) return
    let active = true
    async function load(tradeId: string) {
      const record = await tradeBook.get(tradeId)
      const strategies = await tradeBook.registries.strategies.list(true)
      const ideaSources = await tradeBook.registries.ideaSources.list(true)
      const journalEntries = await journal.entriesFor({ trade: tradeId })
      const holdings = await valuations.position(tradeId)
      // Status is derived — find which status bucket holds this Trade.
      let found: TradeStatus | null = null
      for (const bucket of STATUS_BUCKETS) {
        const trades = await tradeBook.query({ status: bucket })
        if (trades.some((t) => t.id === tradeId)) {
          found = bucket
          break
        }
      }
      if (!active) return
      setTrade(record)
      setStatus(found)
      setPosition(holdings)
      setStrategyName(strategies.find((s) => s.id === record.plan.strategyId)?.name ?? '')
      setIdeaSourceName(ideaSources.find((s) => s.id === record.plan.ideaSourceId)?.name ?? '')
      setEntries(journalEntries)
    }
    void load(id)
    return () => {
      active = false
    }
  }, [tradeBook, journal, valuations, id, refresh])

  if (!trade) return <p>Loading…</p>

  const { plan } = trade

  // A flat Trade with no reason yet is awaiting its Close Reason (the flattening
  // fill just landed). The prompt is non-blocking: it can be dismissed and
  // completed later. A planned Trade can be abandoned with a reason on demand.
  const flatNeedsReason = status === 'closed' && !trade.closeReason
  const showCloseForm = (flatNeedsReason && !closeDismissed) || abandoning

  // Every Execution across the Trade's Legs, oldest first — the fact history.
  const executions = trade.legs
    .flatMap((leg) => leg.executions.map((e) => ({ ...e, ticker: leg.instrument.ticker })))
    .sort((a, b) => a.timestamp - b.timestamp)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={heading}>Trade</h2>
        {status && <StatusBadge status={status} aria-label="status" />}
      </div>

      <div className={`${card} space-y-4`}>
        <div>
          <h3 className={subheading}>Thesis</h3>
          <p className="mt-1 text-sm text-slate-800">{plan.thesis}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className={subheading}>Strategy</h3>
            <p className="mt-1 text-sm text-slate-800">{strategyName}</p>
          </div>
          <div>
            <h3 className={subheading}>Idea Source</h3>
            <p className="mt-1 text-sm text-slate-800">{ideaSourceName}</p>
          </div>
        </div>

        <div>
          <h3 className={subheading}>Planned Legs</h3>
          <ul className="mt-1 space-y-1">
            {plan.plannedLegs.map((leg, i) => (
              <li key={i} className={`text-sm text-slate-800 capitalize ${num}`}>
                {leg.side} {leg.qty} {leg.instrument.ticker}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className={subheading}>Exit Levels</h3>
          <ul className="mt-1 space-y-1">
            {plan.exitLevels.map((level, i) => (
              <li key={i} className={`text-sm text-slate-800 capitalize ${num}`}>
                {level.side}: ${centsToDollars(level.price)}
              </li>
            ))}
          </ul>
        </div>

        {plan.chartLink && (
          <p>
            <a href={plan.chartLink} target="_blank" rel="noreferrer" className={link}>
              Chart
            </a>
          </p>
        )}
      </div>

      <div className={`${card} space-y-3`}>
        <div className="flex items-center justify-between">
          <h3 className={subheading}>Position</h3>
          {!showFill && (
            <button type="button" className={btnSecondary} onClick={() => setShowFill(true)}>
              Record fill
            </button>
          )}
        </div>
        <p aria-label="position" className={`text-sm text-slate-800 ${num}`}>
          {position && position.holdings.length > 0
            ? position.holdings.map((h) => `${h.qty} ${h.instrument.ticker} ${h.side}`).join(', ')
            : 'No position'}
        </p>
        {showFill && (
          <RecordFillForm
            trade={trade}
            onRecorded={() => {
              setShowFill(false)
              setRefresh((n) => n + 1)
            }}
          />
        )}
      </div>

      {/* Keyed on the page's refresh counter: an Execution (or a Close Reason)
          changes what the Trade holds, so the valuation must be re-fetched — it
          may never keep numbers the Position and the badge have already moved past. */}
      {status && status !== 'planned' && <TradeDashboard key={refresh} tradeId={trade.id} />}

      <div className={`${card} space-y-3`}>
        <div className="flex items-center justify-between">
          <h3 className={subheading}>Close</h3>
          {status === 'planned' && !abandoning && (
            <button type="button" className={btnSecondary} onClick={() => setAbandoning(true)}>
              Abandon
            </button>
          )}
          {flatNeedsReason && closeDismissed && !abandoning && (
            <button type="button" className={btnSecondary} onClick={() => setCloseDismissed(false)}>
              Add close reason
            </button>
          )}
        </div>
        {trade.closeReason ? (
          <p aria-label="close reason" className="text-sm text-slate-800">
            {trade.closeReason.name}
          </p>
        ) : showCloseForm ? (
          <CloseForm
            tradeId={trade.id}
            onDone={() => {
              setAbandoning(false)
              setCloseDismissed(false)
              setRefresh((n) => n + 1)
            }}
            onDismiss={() => {
              setAbandoning(false)
              setCloseDismissed(true)
            }}
          />
        ) : (
          <p className="text-sm text-slate-500">No close reason</p>
        )}
      </div>

      <div className={`${card} space-y-3`}>
        <h3 className={subheading}>Execution history</h3>
        {executions.length === 0 ? (
          <p className="text-sm text-slate-500">No executions yet</p>
        ) : (
          <ul aria-label="execution history" className="divide-y divide-slate-100">
            {executions.map((e, i) => (
              <li key={i} className={`flex flex-wrap gap-x-3 py-2 text-sm text-slate-800 ${num}`}>
                <span>{timestampToISODate(e.timestamp)}</span>
                <span className="capitalize">{e.side}</span>
                <span>{e.qty}</span>
                <span>{e.ticker}</span>
                <span>${centsToDollars(e.price)}</span>
                <span className="text-slate-500">fees ${centsToDollars(e.fees)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`${card} space-y-3`}>
        <div className="flex items-center gap-2">
          <h3 className={subheading}>Journal</h3>
          <span
            aria-label="journal entries"
            className="inline-flex min-w-5 items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 tabular-nums"
          >
            {entries.length}
          </span>
        </div>
        {buildEntryThreads(entries).map(({ root, addenda }) => (
          <div key={root.id} className="space-y-2">
            {root.placeholder && root.settledAt === undefined ? (
              <p
                aria-label="journal owed"
                className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
              >
                Journal entry owed
              </p>
            ) : (
              <AnsweredPrompts answered={root.answered} promptClass={subheading} />
            )}
            <AddAddendum entry={root} onAdded={() => setRefresh((n) => n + 1)} />
            {addenda.length > 0 && (
              <ul aria-label="addenda" className="ml-4 space-y-3 border-l border-slate-200 pl-4">
                {addenda.map((addendum) => (
                  <li key={addendum.id} className="space-y-2">
                    <p className="text-xs text-slate-500">{timestampToISODate(addendum.at)}</p>
                    <AnsweredPrompts answered={addendum.answered} promptClass={subheading} />
                    <AddAddendum entry={addendum} onAdded={() => setRefresh((n) => n + 1)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
