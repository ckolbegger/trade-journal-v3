import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTradeBook } from '../tradeBookContext'
import { StatusBadge } from '../components/Badge'
import { btnPrimary, heading } from '../styles'
import type { TradeRecord, TradeStatus } from '@/books/tradebook/types'

// The Trades page: start a new Plan, and list planned and open Trades in
// insertion order (newest last). Status is derived — the list asks TradeBook for
// each status bucket rather than computing status itself, so a filled Trade's
// badge flips planned → open with no manual status control anywhere.

interface Row {
  trade: TradeRecord
  status: TradeStatus
}

export function TradesPage() {
  const tradeBook = useTradeBook()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    let active = true
    Promise.all([
      tradeBook.query({}),
      tradeBook.query({ status: 'planned' }),
      tradeBook.query({ status: 'open' }),
      tradeBook.query({ status: 'closed' }),
    ]).then(([all, planned, open, closed]) => {
      if (!active) return
      const plannedIds = new Set(planned.map((t) => t.id))
      const openIds = new Set(open.map((t) => t.id))
      const closedIds = new Set(closed.map((t) => t.id))
      const next: Row[] = []
      for (const trade of all) {
        if (plannedIds.has(trade.id)) next.push({ trade, status: 'planned' })
        else if (openIds.has(trade.id)) next.push({ trade, status: 'open' })
        else if (closedIds.has(trade.id)) next.push({ trade, status: 'closed' })
      }
      setRows(next)
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
        {rows.map(({ trade, status }) => {
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
              <StatusBadge status={status} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
