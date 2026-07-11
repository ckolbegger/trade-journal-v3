import type { TradeBook } from '@/books/tradebook/trade-book'
import type { PriceBook } from '@/books/pricebook/price-book'
import type {
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
