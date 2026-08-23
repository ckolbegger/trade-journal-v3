import type { StorageBinding } from '@/storage/storage-binding'
import type {
  ISODate,
  InstrumentKey,
  Mark,
  MarkSet,
  MarkSeries,
  Money,
} from '@/domain/trademath/types'
import { datesInRange, isMarketClosed } from '@/domain/dates'
import type { DateRange, FetchReport, PricingSource, RecordResult } from './types'

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
  // Sources are injected in priority order (docs/design/pricebook.md) — the
  // composition root builds this list from Settings.pricingSources
  // (bootstrap.ts). Empty by default: the Slice 1 no-op fetch path.
  constructor(
    private binding: StorageBinding,
    private sources: PricingSource[] = [],
  ) {}

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

  // Collects Marks from the registered PricingSources — the first source whose
  // supports() accepts an instrument handles it (priority order). An instrument
  // no registered source accepts is `unsupported`; a source that throws reports
  // a per-instrument error. Manual-sticky: an observation landing on a date that
  // already carries a manual Mark is never stored (`skippedManual` reports it);
  // a previously *fetched* Mark on that date is freely replaced (re-fetch is the
  // whole point of gap recovery). A source simply omitting a date (market closed,
  // or nothing new) stores nothing for it — the feed is the calendar.
  async fetch(instruments: InstrumentKey[], range: DateRange): Promise<FetchReport> {
    const stored: Mark[] = []
    const skippedManual = new Set<InstrumentKey>()
    const unsupported: InstrumentKey[] = []
    const errors: { instrument: InstrumentKey; source: string; message: string }[] = []

    for (const instrument of instruments) {
      const source = this.sources.find((s) => s.supports(instrument))
      if (!source) {
        unsupported.push(instrument)
        continue
      }
      try {
        const observations = await source.fetch([instrument], range)
        for (const obs of observations) {
          const existing = await this.binding.get<StoredMark>(
            MARKS,
            markId(obs.instrument, obs.date),
          )
          if (existing?.origin === 'manual') {
            skippedManual.add(obs.instrument)
            continue
          }
          const mark: Mark = {
            instrument: obs.instrument,
            date: obs.date,
            price: obs.close,
            origin: 'fetched',
          }
          await this.binding.put<StoredMark>(MARKS, {
            id: markId(obs.instrument, obs.date),
            ...mark,
          })
          stored.push(mark)
        }
      } catch (err) {
        errors.push({
          instrument,
          source: source.id,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return { stored, skippedManual: [...skippedManual], unsupported, errors }
  }

  // The unpriced (instrument, date) rows in a range — the authoritative remainder
  // after a fetch, and the Daily Review's per-Trade prompts. Every calendar date
  // in the range is needed except weekends, which are never marks-needed
  // (S4.4, docs/design/pricebook.md, amended 2026-07-19) — unconditionally, for
  // fetched and manual instruments alike.
  async missingMarks(
    instruments: InstrumentKey[],
    range: DateRange,
  ): Promise<{ instrument: InstrumentKey; date: ISODate }[]> {
    const missing: { instrument: InstrumentKey; date: ISODate }[] = []
    for (const instrument of instruments) {
      const stored = await this.binding.where<StoredMark>(MARKS, 'instrument', instrument)
      const marked = new Set(stored.map((m) => m.date))
      for (const date of datesInRange(range.from, range.to)) {
        if (isMarketClosed(date)) continue
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
