import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTradeBook } from '../tradeBookContext'
import { useValuations } from '../valuationsContext'
import { StatusBadge } from '../components/Badge'
import { centsToDollars, optionLabel } from '../format'
import { btnPrimary, heading, num } from '../styles'
import type { Money, PlannedLeg, TradeRecord, TradeStatus } from '@/books/tradebook/types'

// The row's monogram: the underlying ticker's first two letters, uppercased —
// string formatting over an already-loaded fact, not domain derivation.
function monogram(ticker: string): string {
  return ticker.slice(0, 2).toUpperCase()
}

// The Planned Leg rendered for the list row: a stock reads its ticker; an
// option reads the contract position ("1 × AAPL Jun'27 200C") — or, when
// strike/expiration are still TBD (a legging plan, Slice 7), "1 × AAPL call
// (strike TBD)".
function planLabel(leg: PlannedLeg | undefined): string {
  if (!leg) return ''
  if (leg.instrument.kind !== 'option') return leg.instrument.ticker
  const { ticker, type, strike, expiration } = leg.instrument
  if (strike === undefined || expiration === undefined) {
    return `${leg.qty} × ${ticker} ${type} (strike TBD)`
  }
  return `${leg.qty} × ${optionLabel({ ticker, type, strike, expiration })}`
}

// The Trades page: start a new Plan, and list planned and open Trades in
// insertion order (newest last). Status is derived — the list asks TradeBook for
// each status bucket rather than computing status itself, so a filled Trade's
// badge flips planned → open with no manual status control anywhere. Open Trades
// with a Mark show their total P&L (via Valuations.value).

interface Row {
  trade: TradeRecord
  status: TradeStatus
  pnl?: Money
  strategyName: string
}

export function TradesPage() {
  const tradeBook = useTradeBook()
  const valuations = useValuations()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    let active = true
    async function load() {
      const [all, planned, open, closed, strategies] = await Promise.all([
        tradeBook.query({}),
        tradeBook.query({ status: 'planned' }),
        tradeBook.query({ status: 'open' }),
        tradeBook.query({ status: 'closed' }),
        tradeBook.registries.strategies.list(true),
      ])
      const plannedIds = new Set(planned.map((t) => t.id))
      const openIds = new Set(open.map((t) => t.id))
      const closedIds = new Set(closed.map((t) => t.id))
      const next: Row[] = []
      for (const trade of all) {
        const strategyName = strategies.find((s) => s.id === trade.plan.strategyId)?.name ?? ''
        if (plannedIds.has(trade.id)) next.push({ trade, status: 'planned', strategyName })
        else if (openIds.has(trade.id)) next.push({ trade, status: 'open', strategyName })
        else if (closedIds.has(trade.id)) next.push({ trade, status: 'closed', strategyName })
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
      <ul className="divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {rows.map(({ trade, status, pnl, strategyName }) => {
          const label = planLabel(trade.plan.plannedLegs[0])
          const ticker = trade.plan.plannedLegs[0]?.instrument.ticker ?? ''
          return (
            <li
              key={trade.id}
              aria-label={label}
              className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-700"
              >
                {monogram(ticker)}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/trades/${trade.id}`}
                  className="block truncate font-semibold text-stone-900 hover:text-stone-600"
                >
                  {label}
                </Link>
                {strategyName && <p className="truncate text-sm text-stone-500">{strategyName}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                {pnl !== undefined && (
                  <span
                    aria-label="pnl"
                    className={`text-sm font-medium ${num} ${pnl >= 0 ? 'text-green-700' : 'text-red-700'}`}
                  >
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
