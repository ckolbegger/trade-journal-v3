import { useState } from 'react'
import { useTradeBook } from '../tradeBookContext'
import { dollarsToCents, optionLabel, todayISO } from '../format'
import { btnPrimary, field, input, num } from '../styles'
import { buildInstrumentKey } from '@/books/tradebook/types'
import type {
  ExecutionDraft,
  ExecutionTarget,
  Instrument,
  LegFacts,
  PlannedLeg,
  Position,
  Side,
  TradeRecord,
} from '@/books/tradebook/types'

// "Record fill" on the Trade detail page. Instrument and side pre-fill from the
// Planned Leg; the trader never picks a Leg directly for a single-leg Plan — the
// existing/new Leg target is resolved automatically. Money is entered in dollars
// and converted to whole cents; the trading date rides in the Execution
// timestamp.
//
// Multi-leg Plans (Slice 7, legging in): the trader instead picks WHICH Planned
// Leg this fill is for. A Planned Leg already matched by an existing Leg targets
// it (adding to that Leg, e.g. scaling in); an unmatched Planned Leg with a
// concrete instrument opens a new Leg directly; an unmatched TBD option Planned
// Leg (strike/expiration left open at plan time) asks the trader to complete it
// now — the fill is what turns "sell 1 call, TBD" into a real Leg, never an edit
// to the immutable Plan.

// The concrete Instrument a Planned Leg's instrument names, or undefined when an
// option leg's strike/expiration are still TBD.
function knownInstrument(instrument: PlannedLeg['instrument']): Instrument | undefined {
  if (instrument.kind === 'stock') return instrument
  if (instrument.strike === undefined || instrument.expiration === undefined) return undefined
  return {
    kind: 'option',
    ticker: instrument.ticker,
    type: instrument.type,
    strike: instrument.strike,
    expiration: instrument.expiration,
  }
}

// Which existing Leg (if any) already represents a Planned Leg — matched on
// instrument kind (+ ticker, + option type), not the exact strike/expiration,
// since a TBD Planned Leg only knows those two. One option Leg per Planned
// option Leg is the S7.1 assumption (a spread's two same-type legs are Slice
// 7.2's problem).
function matchingLeg(trade: TradeRecord, pl: PlannedLeg): LegFacts | undefined {
  return trade.legs.find((leg) => {
    if (leg.instrument.kind !== pl.instrument.kind) return false
    if (leg.instrument.kind === 'stock') return leg.instrument.ticker === pl.instrument.ticker
    const plOption = pl.instrument as Extract<PlannedLeg['instrument'], { kind: 'option' }>
    return leg.instrument.ticker === plOption.ticker && leg.instrument.type === plOption.type
  })
}

function plannedLegLabel(pl: PlannedLeg, existing: LegFacts | undefined): string {
  const instrument = existing?.instrument ?? knownInstrument(pl.instrument)
  const instrumentText = instrument
    ? instrument.kind === 'option'
      ? optionLabel(instrument)
      : instrument.ticker
    : `${pl.instrument.ticker} ${(pl.instrument as { type?: string }).type ?? ''} — strike TBD`.trim()
  return `${pl.side} ${pl.qty} ${instrumentText}`
}

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
  const plannedLegs = trade.plan.plannedLegs
  const multiLeg = plannedLegs.length > 1

  // --- multi-leg picker (used only when the Plan names more than one Leg) ---
  const defaultLegIndex = Math.max(
    plannedLegs.findIndex((pl) => !matchingLeg(trade, pl)),
    0,
  )
  const [selectedLegIndex, setSelectedLegIndex] = useState(defaultLegIndex)
  const [tbdExpiration, setTbdExpiration] = useState('')
  const [tbdStrike, setTbdStrike] = useState('')

  const selectedPlannedLeg = multiLeg ? plannedLegs[selectedLegIndex] : undefined
  const selectedExistingLeg = selectedPlannedLeg
    ? matchingLeg(trade, selectedPlannedLeg)
    : undefined
  const selectedKnown = selectedPlannedLeg
    ? knownInstrument(selectedPlannedLeg.instrument)
    : undefined
  const needsTbdInputs = multiLeg && !selectedExistingLeg && !selectedKnown

  // --- single-leg (unchanged): Planned Legs of a single-leg Plan are always
  // concrete — PlanForm requires strike/expiration whenever there is exactly
  // one Planned Leg; TBD only exists on a multi-leg Plan's later legs, handled
  // above. Assignment/exercise (S3.4) can land a Leg the original Plan never
  // named (the paired stock Leg) — when the Trade currently holds exactly one
  // Leg, fills target it; otherwise (nothing held yet) fall back to the
  // Planned Leg's instrument.
  const plannedLeg = plannedLegs[0]
  const heldInstrument =
    position && position.holdings.length === 1 ? position.holdings[0].instrument : undefined
  const activeInstrument = heldInstrument ?? (plannedLeg?.instrument as Instrument | undefined)
  const singleInstrumentKey = activeInstrument ? buildInstrumentKey(activeInstrument) : ''
  const singleInstrumentDisplay =
    activeInstrument?.kind === 'option' ? optionLabel(activeInstrument) : singleInstrumentKey

  const instrumentKey = multiLeg
    ? (selectedExistingLeg && buildInstrumentKey(selectedExistingLeg.instrument)) ||
      (selectedKnown && buildInstrumentKey(selectedKnown)) ||
      ''
    : singleInstrumentKey
  const instrumentDisplay = multiLeg
    ? (selectedExistingLeg &&
        (selectedExistingLeg.instrument.kind === 'option'
          ? optionLabel(selectedExistingLeg.instrument)
          : instrumentKey)) ||
      (selectedKnown &&
        (selectedKnown.kind === 'option' ? optionLabel(selectedKnown) : instrumentKey)) ||
      (selectedPlannedLeg ? plannedLegLabel(selectedPlannedLeg, undefined) : '')
    : singleInstrumentDisplay

  const [side, setSide] = useState<Side>(
    (multiLeg ? selectedPlannedLeg?.side : plannedLeg?.side) ?? 'buy',
  )
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [fees, setFees] = useState('')
  const [date, setDate] = useState(todayISO())
  const [errors, setErrors] = useState<{ qty?: string; price?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  function selectPlannedLeg(index: number) {
    setSelectedLegIndex(index)
    setSide(plannedLegs[index].side)
    setTbdExpiration('')
    setTbdStrike('')
  }

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

    let target: ExecutionTarget
    if (multiLeg) {
      if (selectedExistingLeg) {
        target = { tradeId: trade.id, legId: selectedExistingLeg.id }
      } else if (selectedKnown) {
        target = { tradeId: trade.id, newLeg: buildInstrumentKey(selectedKnown) }
      } else {
        if (tbdExpiration.trim() === '' || tbdStrike.trim() === '') {
          setSubmitError('Enter the expiration and strike to complete this leg')
          return
        }
        const plOption = selectedPlannedLeg!.instrument as { ticker: string; type: 'call' | 'put' }
        const completed: Instrument = {
          kind: 'option',
          ticker: plOption.ticker,
          type: plOption.type,
          expiration: tbdExpiration,
          strike: dollarsToCents(tbdStrike),
        }
        target = { tradeId: trade.id, newLeg: buildInstrumentKey(completed) }
      }
    } else {
      const existing = trade.legs.find(
        (leg) => buildInstrumentKey(leg.instrument) === singleInstrumentKey,
      )
      target = existing
        ? { tradeId: trade.id, legId: existing.id }
        : { tradeId: trade.id, newLeg: singleInstrumentKey }
    }

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
      {multiLeg && (
        <label className={field}>
          Planned leg
          <select
            className={input}
            value={selectedLegIndex}
            onChange={(e) => selectPlannedLeg(Number(e.target.value))}
          >
            {plannedLegs.map((pl, i) => (
              <option key={i} value={i}>
                {plannedLegLabel(pl, matchingLeg(trade, pl))}
              </option>
            ))}
          </select>
        </label>
      )}

      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Instrument
        </span>
        <p className={`text-sm font-medium text-slate-900 ${num}`}>{instrumentDisplay}</p>
      </div>

      {needsTbdInputs && (
        <>
          <label className={field}>
            Expiration
            <input
              type="date"
              className={input}
              value={tbdExpiration}
              onChange={(e) => setTbdExpiration(e.target.value)}
            />
          </label>
          <label className={field}>
            Strike
            <input
              className={`${input} ${num}`}
              value={tbdStrike}
              onChange={(e) => setTbdStrike(e.target.value)}
              inputMode="decimal"
            />
          </label>
        </>
      )}

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
