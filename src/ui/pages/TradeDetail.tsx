import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTradeBook } from '../tradeBookContext'
import { centsToDollars } from '../format'
import type { TradeRecord, TradeStatus } from '@/books/tradebook/types'

// The Trade detail page renders Plan facts only — thesis, Strategy, Idea Source,
// Planned Legs, Exit Levels, chart link, and the derived status badge. No
// valuation numbers (those arrive in S1.5) and, deliberately, no way to edit the
// confirmed Plan: its immutability is the product.

const STATUS_BUCKETS: TradeStatus[] = ['planned', 'open', 'closed']

export function TradeDetail() {
  const tradeBook = useTradeBook()
  const { id } = useParams()
  const [trade, setTrade] = useState<TradeRecord | null>(null)
  const [status, setStatus] = useState<TradeStatus | null>(null)
  const [strategyName, setStrategyName] = useState('')
  const [ideaSourceName, setIdeaSourceName] = useState('')

  useEffect(() => {
    if (!id) return
    let active = true
    async function load(tradeId: string) {
      const record = await tradeBook.get(tradeId)
      const strategies = await tradeBook.registries.strategies.list(true)
      const ideaSources = await tradeBook.registries.ideaSources.list(true)
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
    }
    void load(id)
    return () => {
      active = false
    }
  }, [tradeBook, id])

  if (!trade) return <p>Loading…</p>

  const { plan } = trade

  return (
    <section>
      <h2>Trade</h2>
      {status && <span aria-label="status">{status}</span>}

      <h3>Thesis</h3>
      <p>{plan.thesis}</p>

      <h3>Strategy</h3>
      <p>{strategyName}</p>

      <h3>Idea Source</h3>
      <p>{ideaSourceName}</p>

      <h3>Planned Legs</h3>
      <ul>
        {plan.plannedLegs.map((leg, i) => (
          <li key={i}>
            {leg.side} {leg.qty} {leg.instrument.ticker}
          </li>
        ))}
      </ul>

      <h3>Exit Levels</h3>
      <ul>
        {plan.exitLevels.map((level, i) => (
          <li key={i}>
            {level.side}: ${centsToDollars(level.price)}
          </li>
        ))}
      </ul>

      {plan.chartLink && (
        <p>
          <a href={plan.chartLink} target="_blank" rel="noreferrer">
            Chart
          </a>
        </p>
      )}
    </section>
  )
}
