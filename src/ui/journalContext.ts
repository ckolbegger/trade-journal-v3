import { createContext, useContext } from 'react'
import type { Journal } from '@/books/journal/journal'

export const JournalContext = createContext<Journal | null>(null)

export function useJournal(): Journal {
  const journal = useContext(JournalContext)
  if (!journal) throw new Error('Journal not provided')
  return journal
}
