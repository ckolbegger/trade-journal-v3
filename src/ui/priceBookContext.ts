import { createContext, useContext } from 'react'
import type { PriceBook } from '@/books/pricebook/price-book'

export const PriceBookContext = createContext<PriceBook | null>(null)

export function usePriceBook(): PriceBook {
  const priceBook = useContext(PriceBookContext)
  if (!priceBook) throw new Error('PriceBook not provided')
  return priceBook
}
