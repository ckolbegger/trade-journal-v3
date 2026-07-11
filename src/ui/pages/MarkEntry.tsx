import { useState } from 'react'
import { useTradeBook } from '../tradeBookContext'
import { usePriceBook } from '../priceBookContext'
import { dollarsToCents, todayISO } from '../format'
import { btnPrimary, btnSecondary, field, input, num } from '../styles'

// Enter or edit today's Mark for a Trade's instrument, inline on the detail page.
// A Mark is shared by every Trade holding the instrument, so editing one already
// present warns first when other Trades consumed it (pricebook.md correction
// sequence): peek markSet → tradesHolding → confirm → record. The warning is
// skipped when only this Trade holds the instrument.

export function MarkEntry({
  instrument,
  onRecorded,
  currentPrice,
}: {
  instrument: string
  onRecorded: () => void
  currentPrice?: number
}) {
  const tradeBook = useTradeBook()
  const priceBook = usePriceBook()
  const [price, setPrice] = useState(
    currentPrice === undefined ? '' : (currentPrice / 100).toFixed(2),
  )
  const [sharedCount, setSharedCount] = useState<number | null>(null)

  async function store() {
    await priceBook.record(instrument, todayISO(), dollarsToCents(price), 'manual')
    setSharedCount(null)
    onRecorded()
  }

  async function submit() {
    if (price.trim() === '') return
    const date = todayISO()
    const existing = await priceBook.markSet([instrument], date)
    if (existing.has(instrument)) {
      const holders = await tradeBook.tradesHolding(instrument)
      if (holders.length > 1) {
        setSharedCount(holders.length)
        return
      }
    }
    await store()
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label className={field}>
        Today's mark
        <input
          className={`${input} ${num}`}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
        />
      </label>

      {sharedCount !== null ? (
        <div role="alert" className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            This price is shared — changing it revalues {sharedCount} Trades.
          </p>
          <div className="flex gap-2">
            <button type="button" className={btnPrimary} onClick={() => void store()}>
              Change it
            </button>
            <button type="button" className={btnSecondary} onClick={() => setSharedCount(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="submit" className={btnPrimary}>
          Save mark
        </button>
      )}
    </form>
  )
}
