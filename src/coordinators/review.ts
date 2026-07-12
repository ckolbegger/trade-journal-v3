import type { Journal } from '@/books/journal/journal'
import type { Entry } from '@/books/journal/types'
import type { DateRange } from '@/books/pricebook/types'
import type { ISODate } from '@/domain/trademath/types'
import type { TradeMarksNeeded, Valuations } from './valuations'

// The behavioral-session coordinator. Review stores nothing: `agenda` is pure
// composition — Valuations.marksNeeded (the Trade↔Marks join) + Journal's
// outstanding debt — so what a session must cover is always recomputed from
// Marks and entries, never from a session record (docs/design/review.md).
//
// This slice implements the agenda's collection half. `walk` arrives in S1.7;
// `expiredLegs` (Slice 3) and `accountsForSnapshot` (Slice 14) join the agenda
// in their own slices.

export interface ReviewAgenda {
  marksNeeded: TradeMarksNeeded[] // via Valuations.marksNeeded
  fetchRange: DateRange // earliest gap .. asOf, for the one bulk fetch
  journalDebt: Entry[] // unsettled placeholders (Journal)
}

export class Review {
  constructor(
    private valuations: Valuations,
    private journal: Journal,
  ) {}

  async agenda(asOf: ISODate): Promise<ReviewAgenda> {
    const marks = await this.valuations.marksNeeded(asOf)
    const journalDebt = await this.journal.outstandingDebt()
    return { marksNeeded: marks.perTrade, fetchRange: marks.fetchRange, journalDebt }
  }
}
