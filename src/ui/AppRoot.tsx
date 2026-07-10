import { useEffect, useState } from 'react'
import type { TradeBook } from '@/books/tradebook/trade-book'
import { TradeBookContext } from './tradeBookContext'
import { App } from './App'
import { Onboarding } from './Onboarding'

// Composition wiring's React entry: provides the TradeBook and gates on whether
// any non-archived Account exists. None → onboarding; otherwise → the app shell.

export function AppRoot({ tradeBook }: { tradeBook: TradeBook }) {
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
      {needsOnboarding === null ? (
        <p>Loading…</p>
      ) : needsOnboarding ? (
        <Onboarding onComplete={() => setNeedsOnboarding(false)} />
      ) : (
        <App />
      )}
    </TradeBookContext.Provider>
  )
}
