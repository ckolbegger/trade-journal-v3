import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTradeBook } from '../tradeBookContext'
import { useJournal } from '../journalContext'
import { centsToDollars } from '../format'
import { StatusBadge } from '../components/Badge'
import { card, heading, link, num, subheading } from '../styles'
import type { TradeRecord, TradeStatus } from '@/books/tradebook/types'
import type { Entry } from '@/books/journal/types'

// The Trade detail page renders Plan facts only — thesis, Strategy, Idea Source,
// Planned Legs, Exit Levels, chart link, and the derived status badge. No
// valuation numbers (those arrive in S1.5) and, deliberately, no way to edit the
// confirmed Plan: its immutability is the product.

const STATUS_BUCKETS: TradeStatus[] = ['planned', 'open', 'closed']

export function TradeDetail() {
  const tradeBook = useTradeBook()
  const journal = useJournal()
  const { id } = useParams()
  const [trade, setTrade] = useState<TradeRecord | null>(null)
  const [status, setStatus] = useState<TradeStatus | null>(null)
  const [strategyName, setStrategyName] = useState('')
  const [ideaSourceName, setIdeaSourceName] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])

  useEffect(() => {
    if (!id) return
    let active = true
    async function load(tradeId: string) {
      const record = await tradeBook.get(tradeId)
      const strategies = await tradeBook.registries.strategies.list(true)
      const ideaSources = await tradeBook.registries.ideaSources.list(true)
      const journalEntries = await journal.entriesFor({ trade: tradeId })
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
      setStrategyName(strategies.find((s) => s.id === record.plan.strategyId)?.name ?? '')
      setIdeaSourceName(ideaSources.find((s) => s.id === record.plan.ideaSourceId)?.name ?? '')
      setEntries(journalEntries)
    }
    void load(id)
    return () => {
      active = false
    }
  }, [tradeBook, journal, id])

  if (!trade) return <p>Loading…</p>

  const { plan } = trade

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
        <div className="flex items-center gap-2">
          <h3 className={subheading}>Journal</h3>
          <span
            aria-label="journal entries"
            className="inline-flex min-w-5 items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 tabular-nums"
          >
            {entries.length}
          </span>
        </div>
        {entries.map((entry) => (
          <div key={entry.id}>
            {entry.placeholder ? (
              <p
                aria-label="journal owed"
                className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
              >
                Journal entry owed
              </p>
            ) : (
              <dl className="space-y-2">
                {entry.answered.map((a, i) => (
                  <div key={i}>
                    <dt className={subheading}>{a.prompt.text}</dt>
                    <dd className="mt-0.5 text-sm text-slate-800">
                      {a.answer ? String(a.answer.value) : '—'}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
