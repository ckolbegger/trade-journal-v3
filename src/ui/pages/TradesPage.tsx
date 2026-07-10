import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTradeBook } from '../tradeBookContext'
import type { TradeRecord } from '@/books/tradebook/types'

// The Trades page: start a new Plan, and list planned Trades in insertion order
// (newest last). Status is derived — the list asks TradeBook for the 'planned'
// bucket rather than computing status itself.

export function TradesPage() {
  const tradeBook = useTradeBook()
  const [planned, setPlanned] = useState<TradeRecord[]>([])

  useEffect(() => {
    let active = true
    tradeBook.query({ status: 'planned' }).then((trades) => {
      if (active) setPlanned(trades)
    })
    return () => {
      active = false
    }
  }, [tradeBook])

  return (
    <section>
      <h2>Trades</h2>
      <Link to="/trades/new">New Trade</Link>
      <ul>
        {planned.map((trade) => {
          const ticker = trade.plan.plannedLegs[0]?.instrument.ticker ?? ''
          return (
            <li key={trade.id} aria-label={ticker}>
              <Link to={`/trades/${trade.id}`}>{ticker}</Link>
              <span> planned</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
