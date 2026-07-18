import type { TradeBook } from '@/books/tradebook/trade-book'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { DateRange, FetchReport } from '@/books/pricebook/types'
import type {
  ISODate,
  InstrumentKey,
  LegId,
  Mark,
  MarkSet,
  MarkSeries,
  Money,
  OptionInstrument,
  Position,
  Qty,
  RiskReward,
  TradeId,
  TradeRecord,
  Valuation,
} from '@/domain/trademath/types'
import { isoDateOf, nextISODate } from '@/domain/dates'
import { positionOf } from '@/domain/trademath/position'
import { buildInstrumentKey, underlyingKeyOf } from '@/domain/trademath/instrument'
import {
  heldInstrumentsOf,
  instrumentsOf,
  valuation,
  MissingMarkError,
} from '@/domain/trademath/valuation'
import { riskReward } from '@/domain/trademath/risk-reward'
import { impliedVol } from '@/domain/trademath/implied-vol'

// The only place TradeBook facts meet TradeMath and PriceBook. Returns finished
// items the UI renders directly. `detail` assembles the whole Trade-detail bundle
// from ONE TradeRecord fetch + ONE series fetch (docs/design/trade-detail-sequence.md):
// the series' latest date is the valuation MarkSet, so holdings, P&L, and R/R can
// never disagree about which Executions exist. When a held instrument has no Mark
// yet, it returns a marks-missing signal (the instruments needing a Mark) instead
// of numbers, so the UI prompts for a price.

// One option Leg's contract Mark and the IV implied from it (display only,
// ADR 0009) — present per option Leg that itself has a Mark; `iv` is undefined
// when the underlying is unmarked or no volatility reproduces the contract's
// Mark (domain/trademath/implied-vol.ts).
export interface LegImpliedVol {
  legId: LegId
  markPrice: Money
  iv?: number
}

// The Trade-detail page bundle. `valuation`/`riskReward` are present together, or
// absent with `marksMissing` naming the instruments still needing a Mark.
// `impliedVols` is populated only when a riskFreeRate is supplied to `detail()`.
export interface TradeDetailView {
  record: TradeRecord
  position: Position
  valuation?: Valuation
  riskReward?: RiskReward
  marksMissing?: InstrumentKey[]
  impliedVols?: LegImpliedVol[]
}

// The lighter list-row pair: P&L only (no facts/position/R-R).
export interface TradeValue {
  valuation?: Valuation
  marksMissing?: InstrumentKey[]
}

// The collection half of Review's agenda (a Trade↔Marks join). Per open Trade,
// per INSTRUMENT it still needs Marks for: its own range — day after that
// instrument's last Mark, or the Trade's first Execution date when it has never
// been marked, through asOf. Ranges are per instrument (not per Trade) because a
// contract and its underlying gap independently: a shared per-Trade range would
// union the gaps and resurface one instrument's deliberately-skipped dates as the
// other's (docs/plan/slice-03-single-leg-options.md). `fetchRange` spans the
// earliest gap across every instrument through asOf, for the one bulk fetch.
export interface InstrumentMarksNeeded {
  instrument: InstrumentKey
  range: DateRange
}

export interface TradeMarksNeeded {
  tradeId: TradeId
  needs: InstrumentMarksNeeded[]
}

export interface MarksNeeded {
  perTrade: TradeMarksNeeded[]
  fetchRange: DateRange
}

// A Leg whose option contract's expiration date has passed but still holds
// quantity — nothing else in the system notices expiration on its own (Marks
// simply stop existing past expiration), so Review's agenda surfaces these for
// the trader to record an outcome for (docs/design/review.md). `side` names
// which direction closes the Leg (buy to close a short, sell to close a long).
export interface ExpiredHolding {
  tradeId: TradeId
  legId: LegId
  instrument: OptionInstrument
  qty: Qty
  side: 'long' | 'short'
  expiredOn: ISODate
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

  // `riskFreeRate` is optional and, when supplied (a Workspace setting), adds
  // `impliedVols` computed from the SAME MarkSet as `valuation`/`riskReward` —
  // one snapshot, no second Book round trip that could disagree on dates.
  async detail(tradeId: TradeId, riskFreeRate?: number): Promise<TradeDetailView> {
    const record = await this.tradeBook.get(tradeId)
    const marks = await this.latestMarks(record)
    const position = positionOf(record)
    try {
      const view: TradeDetailView = {
        record,
        position,
        valuation: valuation(record, marks),
        riskReward: riskReward(record, marks),
      }
      if (riskFreeRate !== undefined) {
        view.impliedVols = impliedVolsFor(record, marks, riskFreeRate)
      }
      return view
    } catch (error) {
      if (error instanceof MissingMarkError) {
        return { record, position, marksMissing: error.instruments }
      }
      throw error
    }
  }

  // Which instruments need Marks, per open Trade, over which ranges. Planned and
  // closed Trades hold nothing, so they need nothing; within an open Trade only
  // held Legs' instruments prompt — a flat Leg (an assigned Trade's expired
  // option) never nags for a Mark again. An instrument whose last Mark is asOf
  // (or later) has no gap and drops out; a Trade with no gap at all drops out.
  // Skipped review days are inside the ranges by construction — the gap is
  // "since the last date with Marks", so a missed Tuesday can never silently
  // become interior history (docs/design/pricebook.md).
  async marksNeeded(asOf: ISODate): Promise<MarksNeeded> {
    if (!this.priceBook) throw new Error('Valuations needs a PriceBook for marksNeeded')
    const open = await this.tradeBook.query({ status: 'open' })

    const perTrade: TradeMarksNeeded[] = []
    for (const record of open) {
      const instruments = heldInstrumentsOf(record)
      const lastMarked = await this.priceBook.lastMarked(instruments)
      const firstExecution = firstExecutionDate(record)

      const needs = instruments
        .map((instrument) => {
          const last = lastMarked.get(instrument)
          const from = last ? nextISODate(last) : firstExecution
          return { instrument, range: { from, to: asOf } }
        })
        .filter((need) => need.range.from <= asOf)

      if (needs.length === 0) continue
      perTrade.push({ tradeId: record.id, needs })
    }

    const starts = perTrade.flatMap((item) => item.needs.map((need) => need.range.from))
    const earliest = starts.length === 0 ? asOf : starts.reduce((a, b) => (a < b ? a : b))
    return { perTrade, fetchRange: { from: earliest, to: asOf } }
  }

  // Legs whose option contract's expiration has passed while still holding
  // quantity — facts + positionOf only, no Marks (docs/design/overview.md).
  // `asOf` is the review date, not the expiration date: a contract expiring
  // today is not yet past expiration.
  async expiredHoldings(asOf: ISODate): Promise<ExpiredHolding[]> {
    const open = await this.tradeBook.query({ status: 'open' })
    const expired: ExpiredHolding[] = []
    for (const record of open) {
      for (const holding of positionOf(record).holdings) {
        if (holding.instrument.kind !== 'option') continue
        if (holding.instrument.expiration >= asOf) continue
        const key = buildInstrumentKey(holding.instrument)
        const leg = record.legs.find((l) => buildInstrumentKey(l.instrument) === key)
        if (!leg) continue
        expired.push({
          tradeId: record.id,
          legId: leg.id,
          instrument: holding.instrument,
          qty: holding.qty,
          side: holding.side,
          expiredOn: holding.instrument.expiration,
        })
      }
    }
    return expired
  }

  // Ad-hoc refresh from the Trade detail page (pricebook.md's named secondary
  // FetchReport consumer): today's Marks only, and only for what this Trade
  // currently holds — a flat Leg's instrument never needs a fresh price, the
  // same held filter `marksNeeded` reads. `today` comes from the UI (todayISO),
  // mirroring how Review passes `asOf` in rather than each layer computing its
  // own date.
  async refresh(tradeId: TradeId, today: ISODate): Promise<FetchReport> {
    if (!this.priceBook) throw new Error('Valuations needs a PriceBook for refresh')
    const record = await this.tradeBook.get(tradeId)
    const instruments = heldInstrumentsOf(record)
    return this.priceBook.fetch(instruments, { from: today, to: today })
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

// IV per option Leg that itself has a Mark in the snapshot — `iv` is undefined
// when the underlying is unmarked or TradeMath.impliedVol can't reproduce the
// contract's Mark (domain/trademath/implied-vol.ts).
function impliedVolsFor(
  record: TradeRecord,
  marks: MarkSet,
  riskFreeRate: number,
): LegImpliedVol[] {
  const result: LegImpliedVol[] = []
  for (const leg of record.legs) {
    if (leg.instrument.kind !== 'option') continue
    const key = buildInstrumentKey(leg.instrument)
    const contractMark = marks.get(key)
    if (!contractMark) continue
    const underlyingMark = marks.get(underlyingKeyOf(key))
    const iv = underlyingMark
      ? impliedVol(leg.instrument, contractMark, underlyingMark, riskFreeRate)
      : undefined
    result.push({ legId: leg.id, markPrice: contractMark.price, iv })
  }
  return result
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
