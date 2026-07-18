import type { InstrumentKey, ISODate, Mark, Money } from '@/domain/trademath/types'

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

// The adapter seam (ADR 0008, pricebook.md). Adapters are injected into
// PriceBook in priority order; the first source whose supports() accepts an
// instrument handles it. `close` is the only SourceObservation field this
// slice uses — `ohlc`/`iv` stay unadded until Daily Bars (Slice 17) and IV
// feed need them (JIT, docs/plan/slice-04-automated-pricing.md).
export interface PricingSource {
  id: string
  supports(instrument: InstrumentKey): boolean
  fetch(instruments: InstrumentKey[], range: DateRange): Promise<SourceObservation[]>
}

export interface SourceObservation {
  instrument: InstrumentKey
  date: ISODate
  close: Money
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
