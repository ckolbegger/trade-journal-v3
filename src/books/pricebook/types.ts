import type { InstrumentKey, ISODate, Mark } from '@/domain/trademath/types'

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

// What a fetch actually did — diagnostics, not the todo list (the authoritative
// remainder after a fetch is missingMarks). With no PricingSource registered
// (this slice), every requested instrument comes back `unsupported` and the rest
// is empty; PricingSource adapters arrive in Slice 4 and fill the other fields.
export interface FetchReport {
  stored: Mark[]
  skippedManual: InstrumentKey[]
  unsupported: InstrumentKey[]
  errors: { instrument: InstrumentKey; source: string; message: string }[]
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
