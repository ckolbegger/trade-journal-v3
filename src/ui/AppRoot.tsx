import { useEffect, useState } from 'react'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Journal } from '@/books/journal/journal'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { Valuations } from '@/coordinators/valuations'
import type { Review } from '@/coordinators/review'
import { TradeBookContext } from './tradeBookContext'
import { JournalContext } from './journalContext'
import { PriceBookContext } from './priceBookContext'
import { ValuationsContext } from './valuationsContext'
import { ReviewContext } from './reviewContext'
import { App } from './App'
import { Onboarding } from './Onboarding'

// Composition wiring's React entry: provides the TradeBook, Journal, PriceBook,
// and the Valuations and Review coordinators, and gates on whether any
// non-archived Account exists. None → onboarding; otherwise → the app shell.

export function AppRoot({
  tradeBook,
  journal,
  priceBook,
  valuations,
  review,
}: {
  tradeBook: TradeBook
  journal: Journal
  priceBook: PriceBook
  valuations: Valuations
  review: Review
}) {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    tradeBook.registries.accounts.list().then((accounts) => {
      if (active) setNeedsOnboarding(accounts.length === 0)
    })
    return () => {
      active = false
    }
  }, [tradeBook])

  return (
    <TradeBookContext.Provider value={tradeBook}>
      <JournalContext.Provider value={journal}>
        <PriceBookContext.Provider value={priceBook}>
          <ValuationsContext.Provider value={valuations}>
            <ReviewContext.Provider value={review}>
              {needsOnboarding === null ? (
                <p className="p-6 text-sm text-slate-500">Loading…</p>
              ) : needsOnboarding ? (
                <Onboarding onComplete={() => setNeedsOnboarding(false)} />
              ) : (
                <App />
              )}
            </ReviewContext.Provider>
          </ValuationsContext.Provider>
        </PriceBookContext.Provider>
      </JournalContext.Provider>
    </TradeBookContext.Provider>
  )
}
