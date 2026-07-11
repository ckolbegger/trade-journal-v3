import { useState } from 'react'
import { useTradeBook } from '../tradeBookContext'
import { dollarsToCents, todayISO } from '../format'
import { btnPrimary, field, input, num } from '../styles'
import type { ExecutionDraft, ExecutionTarget, Side, TradeRecord } from '@/books/tradebook/types'

// "Record fill" on the Trade detail page. Instrument and side pre-fill from the
// Planned Leg; the trader never picks a Leg — the existing/new Leg target is
// resolved automatically from the Trade's Legs. Money is entered in dollars and
// converted to whole cents; the trading date rides in the Execution timestamp.

export function RecordFillForm({
  trade,
  onRecorded,
}: {
  trade: TradeRecord
  onRecorded: () => void
}) {
  const tradeBook = useTradeBook()
  const plannedLeg = trade.plan.plannedLegs[0]
  const ticker = plannedLeg?.instrument.ticker ?? ''

  const [side, setSide] = useState<Side>(plannedLeg?.side ?? 'buy')
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [fees, setFees] = useState('')
  const [date, setDate] = useState(todayISO())
  const [errors, setErrors] = useState<{ qty?: string; price?: string }>({})

  async function submit() {
    const nextErrors: { qty?: string; price?: string } = {}
    const qtyNumber = Number(qty)
    if (!Number.isInteger(qtyNumber) || qtyNumber <= 0) {
      nextErrors.qty = 'Quantity must be a positive whole number'
    }
    if (price.trim() === '') {
      nextErrors.price = 'Price is required'
    } else if (dollarsToCents(price) < 0) {
      nextErrors.price = 'Price cannot be negative'
    }
    setErrors(nextErrors)
    if (nextErrors.qty || nextErrors.price) return

    // Resolve the target: an existing Leg for this instrument, or a new Leg.
    const existing = trade.legs.find((leg) => leg.instrument.ticker === ticker)
    const target: ExecutionTarget = existing
      ? { tradeId: trade.id, legId: existing.id }
      : { tradeId: trade.id, newLeg: ticker }

    const draft: ExecutionDraft = {
      side,
      qty: qtyNumber,
      price: dollarsToCents(price),
      fees: fees.trim() === '' ? 0 : dollarsToCents(fees),
      timestamp: new Date(`${date}T12:00:00`).getTime(),
    }
    await tradeBook.recordExecution(target, draft)
    onRecorded()
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Instrument
        </span>
        <p className={`text-sm font-medium text-slate-900 ${num}`}>{ticker}</p>
      </div>

      <label className={field}>
        Side
        <select className={input} value={side} onChange={(e) => setSide(e.target.value as Side)}>
          <option value="buy">buy</option>
          <option value="sell">sell</option>
        </select>
      </label>

      <label className={field}>
        Quantity
        <input
          className={`${input} ${num}`}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="numeric"
        />
      </label>
      {errors.qty && <p className="text-sm text-red-600">{errors.qty}</p>}

      <label className={field}>
        Price
        <input
          className={`${input} ${num}`}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
        />
      </label>
      {errors.price && <p className="text-sm text-red-600">{errors.price}</p>}

      <label className={field}>
        Fees
        <input
          className={`${input} ${num}`}
          value={fees}
          onChange={(e) => setFees(e.target.value)}
          inputMode="decimal"
        />
      </label>

      <label className={field}>
        Date
        <input
          type="date"
          className={input}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <button type="submit" className={btnPrimary}>
        Record fill
      </button>
    </form>
  )
}
