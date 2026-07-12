import type { StorageBinding } from '@/storage/storage-binding'
import type {
  ISODate,
  InstrumentKey,
  Mark,
  MarkSet,
  MarkSeries,
  Money,
} from '@/domain/trademath/types'
import { datesInRange } from '@/domain/dates'
import type { DateRange, FetchReport, RecordResult } from './types'

const MARKS = 'marks'

// The price-observation Book. Knows nothing about Trades — callers name the
// instruments they care about; it answers about prices only. One Mark per
// (instrument, date), stored under a composite string `id` so it uses the same
// StorageBinding contract as every other Book. This slice implements the manual
// Mark subset — record / markSet / series; missingMarks / lastMarked / fetch
// arrive in Slice 1.6 and Slice 4.

// Records stored with a composite id + a queryable `instrument` field (ADR 0011's
// lazy per-instrument loading guardrail). The id is stripped on the way out.
interface StoredMark extends Mark {
  id: string
}

function markId(instrument: InstrumentKey, date: ISODate): string {
  return `${instrument}|${date}`
}

function toMark(stored: StoredMark): Mark {
  return {
    instrument: stored.instrument,
    date: stored.date,
    price: stored.price,
    origin: stored.origin,
  }
}

function inRange(date: ISODate, range?: DateRange): boolean {
  if (!range) return true
  return date >= range.from && date <= range.to
}

export class PriceBook {
  constructor(private binding: StorageBinding) {}

  async record(
    instrument: InstrumentKey,
    date: ISODate,
    price: Money,
    origin: 'manual' | 'fetched',
  ): Promise<RecordResult> {
    const id = markId(instrument, date)
    const existing = await this.binding.get<StoredMark>(MARKS, id)
    await this.binding.put<StoredMark>(MARKS, { id, instrument, date, price, origin })
    return existing ? { overwrote: toMark(existing) } : {}
  }

  async markSet(instruments: InstrumentKey[], date: ISODate): Promise<MarkSet> {
    const marks = new Map<InstrumentKey, Mark>()
    for (const instrument of instruments) {
      const stored = await this.binding.get<StoredMark>(MARKS, markId(instrument, date))
      if (stored) marks.set(instrument, toMark(stored))
    }
    return marks
  }

  // Collects Marks from the registered PricingSources. No sources are registered
  // this slice, so every instrument is unsupported, nothing is stored, and the
  // report routes the whole range to the manual per-Trade prompts. The UI calls
  // this unconditionally — the sources-vs-manual branch lives here, never there
  // (docs/design/review.md). PricingSource adapters arrive in Slice 4.
  async fetch(instruments: InstrumentKey[], _range: DateRange): Promise<FetchReport> {
    return { stored: [], skippedManual: [], unsupported: [...instruments], errors: [] }
  }

  // The unpriced (instrument, date) rows in a range — the authoritative remainder
  // after a fetch, and the Daily Review's per-Trade prompts. Every calendar date
  // in the range is needed: there is no trading calendar (docs/design/pricebook.md).
  async missingMarks(
    instruments: InstrumentKey[],
    range: DateRange,
  ): Promise<{ instrument: InstrumentKey; date: ISODate }[]> {
    const missing: { instrument: InstrumentKey; date: ISODate }[] = []
    for (const instrument of instruments) {
      const stored = await this.binding.where<StoredMark>(MARKS, 'instrument', instrument)
      const marked = new Set(stored.map((m) => m.date))
      for (const date of datesInRange(range.from, range.to)) {
        if (!marked.has(date)) missing.push({ instrument, date })
      }
    }
    return missing
  }

  // The gap start per instrument: the latest date each has a Mark for, or
  // undefined when it has never been marked (the caller supplies that fallback —
  // Review starts a never-marked instrument at its Trade's first Execution date).
  // Every requested instrument gets an entry, so absence is explicit.
  async lastMarked(instruments: InstrumentKey[]): Promise<Map<InstrumentKey, ISODate | undefined>> {
    const latest = new Map<InstrumentKey, ISODate | undefined>()
    for (const instrument of instruments) {
      const stored = await this.binding.where<StoredMark>(MARKS, 'instrument', instrument)
      const dates = stored.map((m) => m.date).sort()
      latest.set(instrument, dates[dates.length - 1])
    }
    return latest
  }

  async series(instruments: InstrumentKey[], range?: DateRange): Promise<MarkSeries> {
    const series = new Map<InstrumentKey, Mark[]>()
    for (const instrument of instruments) {
      const stored = await this.binding.where<StoredMark>(MARKS, 'instrument', instrument)
      const marks = stored
        .filter((m) => inRange(m.date, range))
        .map(toMark)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      series.set(instrument, marks)
    }
    return series
  }
}
