import { useState } from 'react'
import { useTradeBook } from '../tradeBookContext'
import { dollarsToCents, optionLabel, todayISO } from '../format'
import { btnPrimary, field, input, num } from '../styles'
import { buildInstrumentKey } from '@/books/tradebook/types'
import type {
  ExecutionDraft,
  ExecutionTarget,
  Position,
  Side,
  TradeRecord,
} from '@/books/tradebook/types'

// "Record fill" on the Trade detail page. Instrument and side pre-fill from the
// Planned Leg; the trader never picks a Leg — the existing/new Leg target is
// resolved automatically from the Trade's Legs. Money is entered in dollars and
// converted to whole cents; the trading date rides in the Execution timestamp.

export function RecordFillForm({
  trade,
  position,
  onRecorded,
}: {
  trade: TradeRecord
  position?: Position | null
  onRecorded: () => void
}) {
  const tradeBook = useTradeBook()
  const plannedLeg = trade.plan.plannedLegs[0]
  // Assignment/exercise (S3.4) can land a Leg the original Plan never named
  // (the paired stock Leg) — when the Trade currently holds exactly one Leg,
  // fills target it; otherwise (nothing held yet — the common first-fill case)
  // fall back to the Planned Leg's instrument.
  const heldInstrument =
    position && position.holdings.length === 1 ? position.holdings[0].instrument : undefined
  const activeInstrument = heldInstrument ?? plannedLeg?.instrument
  const instrumentKey = activeInstrument ? buildInstrumentKey(activeInstrument) : ''
  const instrumentDisplay =
    activeInstrument?.kind === 'option' ? optionLabel(activeInstrument) : instrumentKey

  const [side, setSide] = useState<Side>(plannedLeg?.side ?? 'buy')
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [fees, setFees] = useState('')
  const [date, setDate] = useState(todayISO())
  const [errors, setErrors] = useState<{ qty?: string; price?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

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
    setSubmitError(null)
    if (nextErrors.qty || nextErrors.price) return

    // Resolve the target: an existing Leg for this instrument, or a new Leg.
    const existing = trade.legs.find((leg) => buildInstrumentKey(leg.instrument) === instrumentKey)
    const target: ExecutionTarget = existing
      ? { tradeId: trade.id, legId: existing.id }
      : { tradeId: trade.id, newLeg: instrumentKey }

    const draft: ExecutionDraft = {
      side,
      qty: qtyNumber,
      price: dollarsToCents(price),
      fees: fees.trim() === '' ? 0 : dollarsToCents(fees),
      timestamp: new Date(`${date}T12:00:00`).getTime(),
    }
    // An oversized close (crosses through zero, S5.2) is rejected by the Book
    // rather than pre-validated here — the held quantity it names comes from
    // TradeMath's own FIFO accounting, not a re-derivation in the UI.
    try {
      await tradeBook.recordExecution(target, draft)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error))
      return
    }
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
        <p className={`text-sm font-medium text-slate-900 ${num}`}>{instrumentDisplay}</p>
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

      {submitError && (
        <p role="alert" className="text-sm text-red-600">
          {submitError}
        </p>
      )}

      <button type="submit" className={btnPrimary}>
        Record fill
      </button>
    </form>
  )
}
