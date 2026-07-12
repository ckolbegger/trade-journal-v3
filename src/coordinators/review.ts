import type { Journal } from '@/books/journal/journal'
import type { Entry } from '@/books/journal/types'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { DateRange } from '@/books/pricebook/types'
import type { ISODate, TradeId } from '@/domain/trademath/types'
import type { TradeMarksNeeded, Valuations } from './valuations'

// The behavioral-session coordinator. Review stores nothing: both operations are
// compositions — `agenda` = Valuations.marksNeeded (the Trade↔Marks join) +
// Journal's outstanding debt; `walk` = the open Trades joined with Journal's
// review entries for the date. What a session must cover, and which Trades still
// owe an Action, are always recomputed from Marks and entries, never from a
// session record (docs/design/review.md).
//
// The Trade↔Journal join lives here — "which open Trades lack a review entry
// today" belongs to no other module. `expiredLegs` (Slice 3) and
// `accountsForSnapshot` (Slice 14) join the agenda in their own slices;
// WalkItem gains its `attentionScore` in Slice 8 (this slice walks in insertion
// order).

export interface ReviewAgenda {
  marksNeeded: TradeMarksNeeded[] // via Valuations.marksNeeded
  fetchRange: DateRange // earliest gap .. asOf, for the one bulk fetch
  journalDebt: Entry[] // unsettled placeholders (Journal)
}

export interface WalkItem {
  tradeId: TradeId
  reviewedToday: boolean // a review-anchored entry with an Action exists for asOf
  outstandingDebt: number // this Trade's unsettled placeholders
}

export class Review {
  constructor(
    private valuations: Valuations,
    private journal: Journal,
    private tradeBook: TradeBook,
  ) {}

  async agenda(asOf: ISODate): Promise<ReviewAgenda> {
    const marks = await this.valuations.marksNeeded(asOf)
    const journalDebt = await this.journal.outstandingDebt()
    return { marksNeeded: marks.perTrade, fetchRange: marks.fetchRange, journalDebt }
  }

  // The session's checkpoint list: the open Trades (planned and closed ones hold
  // nothing to decide about), each flagged with whether its Action is already
  // recorded for asOf and how much journal it owes. Reviewing a Trade IS
  // recording its Action, so `reviewedToday` is simply "a {kind:'review'} entry
  // exists for this date" — there is no stored reviewed state (ADR 0005).
  async walk(asOf: ISODate): Promise<WalkItem[]> {
    const open = await this.tradeBook.query({ status: 'open' })

    const items: WalkItem[] = []
    for (const record of open) {
      const entries = await this.journal.entriesFor({ trade: record.id })
      items.push({
        tradeId: record.id,
        reviewedToday: entries.some((e) => e.anchor.kind === 'review' && e.anchor.date === asOf),
        outstandingDebt: entries.filter((e) => e.placeholder && e.settledAt === undefined).length,
      })
    }
    return items
  }
}
