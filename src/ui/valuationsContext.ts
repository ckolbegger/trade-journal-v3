import { createContext, useContext } from 'react'
import type { Valuations } from '@/coordinators/valuations'

export const ValuationsContext = createContext<Valuations | null>(null)

export function useValuations(): Valuations {
  const valuations = useContext(ValuationsContext)
  if (!valuations) throw new Error('Valuations not provided')
  return valuations
}
