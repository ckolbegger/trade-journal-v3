import { createContext, useContext } from 'react'
import type { TradeBook } from '@/books/tradebook/trade-book'

export const TradeBookContext = createContext<TradeBook | null>(null)

export function useTradeBook(): TradeBook {
  const tradeBook = useContext(TradeBookContext)
  if (!tradeBook) throw new Error('TradeBook not provided')
  return tradeBook
}
