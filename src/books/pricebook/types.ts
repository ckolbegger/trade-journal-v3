import type { ISODate, Mark } from '@/domain/trademath/types'

// PriceBook-owned shapes TradeMath never computes over. `RecordResult.overwrote`
// carries the prior Mark so the UI can compose the shared-Mark edit warning (with
// TradeBook.tradesHolding). DateRange bounds a series/lookup by trading date.

export interface RecordResult {
  overwrote?: Mark
}

export interface DateRange {
  from: ISODate
  to: ISODate
}

// Re-export the domain shapes callers hand to / receive from PriceBook, so the UI
// imports Mark types through the Book rather than the domain layer.
export type {
  ISODate,
  InstrumentKey,
  Money,
  Mark,
  MarkSet,
  MarkSeries,
} from '@/domain/trademath/types'
