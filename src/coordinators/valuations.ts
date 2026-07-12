import type { TradeBook } from '@/books/tradebook/trade-book'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { DateRange } from '@/books/pricebook/types'
import type {
  ISODate,
  InstrumentKey,
  Mark,
  MarkSet,
  MarkSeries,
  Position,
  RiskReward,
  TradeId,
  TradeRecord,
  Valuation,
} from '@/domain/trademath/types'
import { isoDateOf, nextISODate } from '@/domain/dates'
import { positionOf } from '@/domain/trademath/position'
import { instrumentsOf, valuation, MissingMarkError } from '@/domain/trademath/valuation'
import { riskReward } from '@/domain/trademath/risk-reward'

// The only place TradeBook facts meet TradeMath and PriceBook. Returns finished
// items the UI renders directly. `detail` assembles the whole Trade-detail bundle
// from ONE TradeRecord fetch + ONE series fetch (docs/design/trade-detail-sequence.md):
// the series' latest date is the valuation MarkSet, so holdings, P&L, and R/R can
// never disagree about which Executions exist. When a held instrument has no Mark
// yet, it returns a marks-missing signal (the instruments needing a Mark) instead
// of numbers, so the UI prompts for a price.

// The Trade-detail page bundle. `valuation`/`riskReward` are present together, or
// absent with `marksMissing` naming the instruments still needing a Mark.
export interface TradeDetailView {
  record: TradeRecord
  position: Position
  valuation?: Valuation
  riskReward?: RiskReward
  marksMissing?: InstrumentKey[]
}

// The lighter list-row pair: P&L only (no facts/position/R-R).
export interface TradeValue {
  valuation?: Valuation
  marksMissing?: InstrumentKey[]
}

// The collection half of Review's agenda (a Trade↔Marks join). Per open Trade:
// the instruments still missing Marks and the range they are missing them over —
// day after the instrument's last Mark, or the Trade's first Execution date when
// it has never been marked, through asOf. `fetchRange` spans the earliest gap
// through asOf, for the one bulk fetch.
export interface TradeMarksNeeded {
  tradeId: TradeId
  instruments: InstrumentKey[]
  range: DateRange
}

export interface MarksNeeded {
  perTrade: TradeMarksNeeded[]
  fetchRange: DateRange
}

export class Valuations {
  constructor(
    private tradeBook: TradeBook,
    private priceBook?: PriceBook,
  ) {}

  async position(tradeId: TradeId): Promise<Position> {
    const record = await this.tradeBook.get(tradeId)
    return positionOf(record)
  }

  async detail(tradeId: TradeId): Promise<TradeDetailView> {
    const record = await this.tradeBook.get(tradeId)
    const marks = await this.latestMarks(record)
    const position = positionOf(record)
    try {
      return {
        record,
        position,
        valuation: valuation(record, marks),
        riskReward: riskReward(record, marks),
      }
    } catch (error) {
      if (error instanceof MissingMarkError) {
        return { record, position, marksMissing: error.instruments }
      }
      throw error
    }
  }

  // Which instruments need Marks, per open Trade, over which ranges. Planned and
  // closed Trades hold nothing, so they need nothing. An instrument whose last
  // Mark is asOf (or later) has no gap and drops out; a Trade with no gap at all
  // drops out. Skipped review days are inside the ranges by construction — the
  // gap is "since the last date with Marks", so a missed Tuesday can never
  // silently become interior history (docs/design/pricebook.md).
  async marksNeeded(asOf: ISODate): Promise<MarksNeeded> {
    if (!this.priceBook) throw new Error('Valuations needs a PriceBook for marksNeeded')
    const open = await this.tradeBook.query({ status: 'open' })

    const perTrade: TradeMarksNeeded[] = []
    for (const record of open) {
      const instruments = instrumentsOf(record)
      const lastMarked = await this.priceBook.lastMarked(instruments)
      const firstExecution = firstExecutionDate(record)

      const gaps = instruments
        .map((instrument) => {
          const last = lastMarked.get(instrument)
          return { instrument, from: last ? nextISODate(last) : firstExecution }
        })
        .filter((gap) => gap.from <= asOf)

      if (gaps.length === 0) continue
      const from = gaps.map((gap) => gap.from).reduce((a, b) => (a < b ? a : b))
      perTrade.push({
        tradeId: record.id,
        instruments: gaps.map((gap) => gap.instrument),
        range: { from, to: asOf },
      })
    }

    const starts = perTrade.map((item) => item.range.from)
    const earliest = starts.length === 0 ? asOf : starts.reduce((a, b) => (a < b ? a : b))
    return { perTrade, fetchRange: { from: earliest, to: asOf } }
  }

  async value(tradeId: TradeId): Promise<TradeValue> {
    const record = await this.tradeBook.get(tradeId)
    const marks = await this.latestMarks(record)
    try {
      return { valuation: valuation(record, marks) }
    } catch (error) {
      if (error instanceof MissingMarkError) return { marksMissing: error.instruments }
      throw error
    }
  }

  // One series fetch per Trade; its latest date is the valuation MarkSet.
  private async latestMarks(record: TradeRecord): Promise<MarkSet> {
    if (!this.priceBook) throw new Error('Valuations needs a PriceBook for valuation')
    const series = await this.priceBook.series(instrumentsOf(record))
    return latestMarkSet(series)
  }
}

// The date the Trade first held anything — where a never-marked instrument's gap
// starts (an open Trade always has at least one Execution).
function firstExecutionDate(record: TradeRecord): ISODate {
  const timestamps = record.legs.flatMap((leg) => leg.executions.map((e) => e.timestamp))
  return isoDateOf(Math.min(...timestamps))
}

function latestMarkSet(series: MarkSeries): MarkSet {
  let latest: string | undefined
  for (const marks of series.values()) {
    const last = marks[marks.length - 1]
    if (last && (latest === undefined || last.date > latest)) latest = last.date
  }
  const set = new Map<InstrumentKey, Mark>()
  if (latest === undefined) return set
  for (const [key, marks] of series) {
    const mark = marks.find((m) => m.date === latest)
    if (mark) set.set(key, mark)
  }
  return set
}
