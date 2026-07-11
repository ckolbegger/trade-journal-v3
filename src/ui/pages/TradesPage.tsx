import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTradeBook } from '../tradeBookContext'
import { StatusBadge } from '../components/Badge'
import { btnPrimary, heading } from '../styles'
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
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={heading}>Trades</h2>
        <Link to="/trades/new" className={btnPrimary}>
          New Trade
        </Link>
      </div>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {planned.map((trade) => {
          const ticker = trade.plan.plannedLegs[0]?.instrument.ticker ?? ''
          return (
            <li
              key={trade.id}
              aria-label={ticker}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <Link
                to={`/trades/${trade.id}`}
                className="font-medium text-slate-900 hover:text-indigo-600"
              >
                {ticker}
              </Link>
              <StatusBadge status="planned" />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
