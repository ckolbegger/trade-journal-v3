import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTradeBook } from '../tradeBookContext'
import { useValuations } from '../valuationsContext'
import { StatusBadge } from '../components/Badge'
import { centsToDollars } from '../format'
import { btnPrimary, heading, num } from '../styles'
import type { Money, TradeRecord, TradeStatus } from '@/books/tradebook/types'

// The Trades page: start a new Plan, and list planned and open Trades in
// insertion order (newest last). Status is derived — the list asks TradeBook for
// each status bucket rather than computing status itself, so a filled Trade's
// badge flips planned → open with no manual status control anywhere. Open Trades
// with a Mark show their total P&L (via Valuations.value).

interface Row {
  trade: TradeRecord
  status: TradeStatus
  pnl?: Money
}

export function TradesPage() {
  const tradeBook = useTradeBook()
  const valuations = useValuations()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    let active = true
    async function load() {
      const [all, planned, open, closed] = await Promise.all([
        tradeBook.query({}),
        tradeBook.query({ status: 'planned' }),
        tradeBook.query({ status: 'open' }),
        tradeBook.query({ status: 'closed' }),
      ])
      const plannedIds = new Set(planned.map((t) => t.id))
      const openIds = new Set(open.map((t) => t.id))
      const closedIds = new Set(closed.map((t) => t.id))
      const next: Row[] = []
      for (const trade of all) {
        if (plannedIds.has(trade.id)) next.push({ trade, status: 'planned' })
        else if (openIds.has(trade.id)) next.push({ trade, status: 'open' })
        else if (closedIds.has(trade.id)) next.push({ trade, status: 'closed' })
      }
      await Promise.all(
        next.map(async (row) => {
          if (row.status !== 'open') return
          const value = await valuations.value(row.trade.id)
          if (value.valuation) row.pnl = value.valuation.totalPnL
        }),
      )
      if (active) setRows(next)
    }
    void load()
    return () => {
      active = false
    }
  }, [tradeBook, valuations])

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={heading}>Trades</h2>
        <Link to="/trades/new" className={btnPrimary}>
          New Trade
        </Link>
      </div>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {rows.map(({ trade, status, pnl }) => {
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
              <div className="flex items-center gap-3">
                {pnl !== undefined && (
                  <span aria-label="pnl" className={`text-sm text-slate-600 ${num}`}>
                    ${centsToDollars(pnl)}
                  </span>
                )}
                <StatusBadge status={status} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
