import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTradeBook } from '../tradeBookContext'
import { useJournal } from '../journalContext'
import { useValuations } from '../valuationsContext'
import { RecordFillForm } from './RecordFillForm'
import { CloseForm } from './CloseForm'
import { TradeDashboard } from './TradeDashboard'
import { ReplayView } from './ReplayView'
import { centsToDollars, optionLabel, timestampToISODate, todayISO } from '../format'
import { StatusBadge } from '../components/Badge'
import { AddAddendum } from '../components/AddAddendum'
import { AnsweredPrompts } from '../components/AnsweredPrompts'
import { buildEntryThreads } from '../components/entryThread'
import { btnSecondary, card, heading, link, num, subheading } from '../styles'
import { buildInstrumentKey } from '@/books/tradebook/types'
import type {
  Instrument,
  Position,
  TradeRecord,
  TradeStatus,
  Valuation,
} from '@/books/tradebook/types'
import type { Entry } from '@/books/journal/types'
import type { FetchReport } from '@/books/pricebook/types'
import type { TradeDetailView } from '@/coordinators/valuations'

// An instrument rendered for display: a stock is just its ticker; an option
// shows its contract label ("AAPL Jun'27 200C") — display-only, never a key.
function instrumentLabel(instrument: Instrument): string {
  return instrument.kind === 'option' ? optionLabel(instrument) : instrument.ticker
}

// A Planned Leg's instrument rendered for display — same as `instrumentLabel`
// for a concrete instrument, but a TBD option leg (strike/expiration left
// open at plan time, Slice 7) reads "AAPL call (strike TBD)" until a fill
// completes it.
function plannedInstrumentLabel(
  instrument: TradeRecord['plan']['plannedLegs'][number]['instrument'],
): string {
  if (instrument.kind !== 'option') return instrument.ticker
  const { ticker, type, strike, expiration } = instrument
  if (strike === undefined || expiration === undefined) return `${ticker} ${type} (strike TBD)`
  return optionLabel({ ticker, type, strike, expiration })
}

// An Exit Level rendered for display: a dollar value for underlyingPrice, or
// structureValue's per-unit "Position price" quote. A level whose `kind`
// matches neither — a pre-ruling (2026-07-19) stored Plan's `pctOfMaxProfit`
// level, removed from the type but tolerated on read — renders inert rather
// than crashing on a field that no longer exists.
function exitLevelDisplay(level: TradeRecord['plan']['exitLevels'][number]): string {
  if (level.kind === 'underlyingPrice') return `$${centsToDollars(level.price)}`
  if (level.kind === 'structureValue') return `$${centsToDollars(level.value)}`
  return 'unsupported target'
}

// The unit an Exit Level's number is quoted in, in the same wording PlanForm
// already uses (exitTemplateLabel) — the hero was the one place that dropped
// it. A level whose `kind` matches neither current variant (the tolerated
// legacy pctOfMaxProfit) has no unit to name.
function exitLevelUnit(level: TradeRecord['plan']['exitLevels'][number]): string | undefined {
  if (level.kind === 'underlyingPrice') return 'underlying price'
  if (level.kind === 'structureValue') return 'position price'
  return undefined
}

// A held Position row: a stock reads "100 AAPL long"; an option reads the
// contract position ("1 × AAPL Jun'27 200C"), signed negative when short
// ("-1 × XYZ Aug'26 100P"). `avgCost` (cents), when known, appends the
// weighted average across every opening fill on the Leg — S5.1's "building
// blocks" summary alongside the per-fill execution history below.
function holdingLabel(h: Position['holdings'][number], avgCost?: number): string {
  const base =
    h.instrument.kind === 'option'
      ? `${h.side === 'short' ? '-' : ''}${h.qty} × ${optionLabel(h.instrument)}`
      : `${h.qty} ${h.instrument.ticker} ${h.side}`
  return avgCost === undefined ? base : `${base} · avg $${centsToDollars(avgCost)}`
}

// Average cost for a held instrument: TradeMath's own per-unit LegValuation.avgCost
// (never re-derived here — the UI doesn't know the contract multiplier basis
// bakes in, so dividing basis/qty would be wrong by 100× for options). `undefined`
// when the valuation isn't available yet (a Mark is missing) — the position line
// just shows quantity then, same as before this slice.
function avgCostFor(
  instrument: Instrument,
  perLeg: Valuation['perLeg'] | undefined,
): number | undefined {
  if (!perLeg) return undefined
  const key = buildInstrumentKey(instrument)
  return perLeg.find((l) => buildInstrumentKey(l.instrument) === key)?.avgCost
}

// The Trade detail page. A hero card leads with the strategy, the Trade's total
// P&L and its exit levels; below it the Plan facts (thesis, Idea Source, Planned
// Legs, chart link), the Legs & Executions card, and the valuation. There is
// deliberately no way to edit the confirmed Plan: its immutability is the
// product.

const STATUS_BUCKETS: TradeStatus[] = ['planned', 'open', 'closed']

export function TradeDetail() {
  const tradeBook = useTradeBook()
  const journal = useJournal()
  const valuations = useValuations()
  const { id } = useParams()
  const [trade, setTrade] = useState<TradeRecord | null>(null)
  const [status, setStatus] = useState<TradeStatus | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [strategyName, setStrategyName] = useState('')
  const [ideaSourceName, setIdeaSourceName] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [detail, setDetail] = useState<TradeDetailView | null>(null)
  const [showFill, setShowFill] = useState(false)
  const [closeDismissed, setCloseDismissed] = useState(false)
  const [abandoning, setAbandoning] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [refreshReport, setRefreshReport] = useState<FetchReport | null>(null)
  const [showReplay, setShowReplay] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    async function load(tradeId: string) {
      const record = await tradeBook.get(tradeId)
      const strategies = await tradeBook.registries.strategies.list(true)
      const ideaSources = await tradeBook.registries.ideaSources.list(true)
      const journalEntries = await journal.entriesFor({ trade: tradeId })
      const holdings = await valuations.position(tradeId)
      // Status is derived — find which status bucket holds this Trade.
      let found: TradeStatus | null = null
      for (const bucket of STATUS_BUCKETS) {
        const trades = await tradeBook.query({ status: bucket })
        if (trades.some((t) => t.id === tradeId)) {
          found = bucket
          break
        }
      }
      if (!active) return
      setTrade(record)
      setStatus(found)
      setPosition(holdings)
      setStrategyName(strategies.find((s) => s.id === record.plan.strategyId)?.name ?? '')
      setIdeaSourceName(ideaSources.find((s) => s.id === record.plan.ideaSourceId)?.name ?? '')
      setEntries(journalEntries)
    }
    void load(id)
    return () => {
      active = false
    }
  }, [tradeBook, journal, valuations, id, refresh])

  // The whole Valuations.detail snapshot (S5.1) rides the SAME fetch
  // TradeDashboard already makes — one computation, not a second round trip
  // that could disagree about which Marks exist. It feeds both the Position
  // line's average cost (below) and the hero's Current/large-P&L figures.
  // Stable across renders (empty deps) so TradeDashboard's own effect never
  // re-fires because of it.
  const handleDetail = useCallback((d: TradeDetailView) => setDetail(d), [])

  if (!trade) return <p>Loading…</p>

  const { plan } = trade

  // Target/Stop for the hero: the trade's Exit Levels are facts already read
  // for the (now-removed) Exit Levels list — a Trade carries at most one of
  // each side today (the risk/reward model is single-target/single-stop, the
  // assumption TradeMath's own risk-reward makes), so picking the first of
  // each side loses nothing.
  const targetLevel = plan.exitLevels.find((l) => l.side === 'target')
  const stopLevel = plan.exitLevels.find((l) => l.side === 'stop')

  // The hero's one "current" price: the underlying's own Mark, always a stock
  // and always the same quantity regardless of strategy — unlike a contract
  // quote (a CSP's Mark) or a multi-leg Trade's net structure value, neither of
  // which is comparable to the Plan's Exit Levels (2026-08-25 ruling). Built
  // from the Trade's ticker (every Planned Leg shares one underlying), not from
  // whatever happens to be held — a multi-leg Trade holds only option Legs, but
  // the stock's own Mark is still what the hero shows.
  //
  // Marks come from `detail`, the same snapshot TradeDashboard fetches — no
  // second Book round trip that could disagree on which Marks exist
  // (docs/design/trade-detail-sequence.md).
  const ticker = plan.plannedLegs[0]?.instrument.ticker
  const underlyingKey = ticker ? buildInstrumentKey({ kind: 'stock', ticker }) : undefined
  const underlyingMark = detail && underlyingKey ? detail.marks.get(underlyingKey) : undefined
  const targetUnit = targetLevel && exitLevelUnit(targetLevel)
  const stopUnit = stopLevel && exitLevelUnit(stopLevel)

  // A flat Trade with no reason yet is awaiting its Close Reason (the flattening
  // fill just landed). The prompt is non-blocking: it can be dismissed and
  // completed later. A planned Trade can be abandoned with a reason on demand.
  const flatNeedsReason = status === 'closed' && !trade.closeReason
  const showCloseForm = (flatNeedsReason && !closeDismissed) || abandoning

  // Every Execution across the Trade's Legs, oldest first — the fact history.
  const executions = trade.legs
    .flatMap((leg) => leg.executions.map((e) => ({ ...e, label: instrumentLabel(leg.instrument) })))
    .sort((a, b) => a.timestamp - b.timestamp)

  // Ad-hoc refresh (S4.3): today's Marks only, for whatever this Trade currently
  // holds (Valuations.refresh — heldInstrumentsOf, mirroring marksNeeded). The
  // dashboard remount (via `refresh`) re-derives valuation and R/R from the
  // Marks the fetch just stored; the report itself renders inline below — a
  // manual Mark for today stays untouched (skippedManual), and any per-source
  // error is shown with its reason rather than silently dropped.
  async function refreshPrices() {
    if (!trade) return
    const report = await valuations.refresh(trade.id, todayISO())
    setRefreshReport(report)
    setRefresh((n) => n + 1)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={heading}>Trade</h2>
        {status && <StatusBadge status={status} aria-label="status" />}
      </div>

      {/* Hero card: strategy, the large total P&L, and the underlying's current
          price beside it — the one "current" that means the same thing for
          every strategy (2026-08-25 ruling). Below, Target and Stop, each
          labelled with the unit its Exit Level is quoted in. The "away"/
          "cushion" deltas the prototype shows under Target/Stop are arithmetic
          over these facts and nothing in TradeDetailView carries either value
          yet (scoped 2026-08-25) — the levels are shown, the deltas are not.
          The P&L figure is gated on detail.record.legs.length (mirroring
          TradeDashboard's card guard): a planned Trade has no legs, so
          valuation(record, marks) still returns a truthy, all-zero Valuation
          (no legs means nothing is "missing") — without this gate it would
          print a meaningless "+$0.00" (found 2026-08-25, after removing the
          `status !== 'planned'` mount gate exposed this hero to planned
          Trades). */}
      <div className={`${card} space-y-4`}>
        {strategyName && <p className={subheading}>{strategyName}</p>}
        <div className="flex items-start justify-between gap-4">
          {detail?.valuation && detail.record.legs.length > 0 && (
            <p
              className={`text-3xl font-bold ${num} ${
                detail.valuation.totalPnL >= 0 ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {detail.valuation.totalPnL >= 0 ? '+' : ''}$
              {centsToDollars(detail.valuation.totalPnL)}
            </p>
          )}
          {/* ml-auto pins this line right even when there is no P&L beside it (a
              planned Trade with no legs, or an open one whose Mark is
              missing), so it does not jump left between renders. */}
          {ticker && (
            <p
              aria-label="underlying"
              className={`mt-1 ml-auto text-sm font-semibold text-stone-900 ${num}`}
            >
              {ticker}{' '}
              {underlyingMark === undefined
                ? '—'
                : underlyingMark.date === todayISO()
                  ? `$${centsToDollars(underlyingMark.price)}`
                  : `$${centsToDollars(underlyingMark.price)} (${underlyingMark.date})`}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className={subheading}>Target{targetUnit && ` (${targetUnit})`}</p>
            <p className={`mt-1 text-sm font-semibold text-green-700 ${num}`}>
              {targetLevel ? exitLevelDisplay(targetLevel) : '—'}
            </p>
          </div>
          <div>
            <p className={subheading}>Stop{stopUnit && ` (${stopUnit})`}</p>
            <p className={`mt-1 text-sm font-semibold text-red-700 ${num}`}>
              {stopLevel ? exitLevelDisplay(stopLevel) : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className={`${card} space-y-4`}>
        <div>
          <h3 className={subheading}>Thesis</h3>
          <p className="mt-1 text-sm text-stone-800">{plan.thesis}</p>
        </div>

        {/* Strategy itself now leads the hero card above — shown once there,
            not repeated here. */}
        <div>
          <h3 className={subheading}>Idea Source</h3>
          <p className="mt-1 text-sm text-stone-800">{ideaSourceName}</p>
        </div>

        <div>
          <h3 className={subheading}>Planned Legs</h3>
          <ul className="mt-1 space-y-1">
            {plan.plannedLegs.map((leg, i) => (
              <li key={i} className={`text-sm text-stone-800 capitalize ${num}`}>
                {leg.side} {leg.qty} {plannedInstrumentLabel(leg.instrument)}
              </li>
            ))}
          </ul>
        </div>

        {plan.chartLink && (
          <p>
            <a href={plan.chartLink} target="_blank" rel="noreferrer" className={link}>
              Chart
            </a>
          </p>
        )}
      </div>

      <div className={`${card} space-y-3`}>
        <div className="flex items-center justify-between">
          <h3 className={subheading}>Legs &amp; Executions</h3>
          {/* A closed Trade offers no record-fill — adding to a closed campaign
              is impossible; a new campaign is a new Plan (S5.1). */}
          {!showFill && status !== 'closed' && (
            <button type="button" className={btnSecondary} onClick={() => setShowFill(true)}>
              Record fill
            </button>
          )}
        </div>
        <p aria-label="position" className={`text-sm text-stone-800 ${num}`}>
          {position && position.holdings.length > 0
            ? position.holdings
                .map((h) => holdingLabel(h, avgCostFor(h.instrument, detail?.valuation?.perLeg)))
                .join(' · ')
            : 'No position'}
        </p>
        {showFill && (
          <RecordFillForm
            trade={trade}
            position={position}
            onRecorded={() => {
              setShowFill(false)
              setRefresh((n) => n + 1)
            }}
          />
        )}
        {executions.length === 0 ? (
          <p className="text-sm text-stone-500">No executions yet</p>
        ) : (
          <ul aria-label="execution history" className="divide-y divide-stone-100">
            {executions.map((e, i) => (
              <li key={i} className={`flex flex-wrap gap-x-3 py-2 text-sm text-stone-800 ${num}`}>
                <span>{timestampToISODate(e.timestamp)}</span>
                <span className="capitalize">{e.side}</span>
                <span>{e.qty}</span>
                <span>{e.label}</span>
                <span>${centsToDollars(e.price)}</span>
                <span className="text-stone-500">fees ${centsToDollars(e.fees)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {status && status !== 'planned' && (
        <div className={`${card} space-y-2`}>
          <div className="flex items-center justify-between">
            <h3 className={subheading}>Prices</h3>
            <button type="button" className={btnSecondary} onClick={() => void refreshPrices()}>
              Refresh prices
            </button>
          </div>
          {refreshReport &&
            refreshReport.stored.length === 0 &&
            refreshReport.skippedManual.length === 0 &&
            refreshReport.unsupported.length === 0 &&
            refreshReport.errors.length === 0 && (
              <p aria-label="refresh empty" className="text-sm text-stone-500">
                No new price for today — the source has nothing yet (market may still be open, or
                closed with no update).
              </p>
            )}
          {refreshReport && refreshReport.skippedManual.length > 0 && (
            <p aria-label="refresh sticky" className="text-sm text-stone-500">
              Kept today&apos;s manual mark for {refreshReport.skippedManual.join(', ')} — a refresh
              never overwrites a price you typed yourself.
            </p>
          )}
          {refreshReport && refreshReport.unsupported.length > 0 && (
            <p aria-label="refresh unsupported" className="text-sm text-stone-500">
              No pricing source covers {refreshReport.unsupported.join(', ')} — enter it manually
              below.
            </p>
          )}
          {refreshReport && refreshReport.errors.length > 0 && (
            <ul aria-label="refresh errors" className="space-y-1">
              {refreshReport.errors.map((err) => (
                <li key={err.instrument} className="text-sm text-red-600">
                  {err.instrument}: {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Keyed on the page's refresh counter: an Execution (or a Close Reason)
          changes what the Trade holds, so the valuation must be re-fetched — it
          may never keep numbers the Position and the badge have already moved
          past. Mounted for a planned Trade too (not just open/closed) —
          TradeDashboard itself renders nothing then, but its `detail()` fetch
          is what feeds the hero's underlying price through `onDetail`; a
          second, UI-owned Book round trip is exactly what
          docs/design/trade-detail-sequence.md rules out. */}
      {status && <TradeDashboard key={refresh} tradeId={trade.id} onDetail={handleDetail} />}

      {status && status !== 'planned' && (
        <div className="flex justify-end">
          <button type="button" className={btnSecondary} onClick={() => setShowReplay((v) => !v)}>
            {showReplay ? 'Hide replay' : 'Replay'}
          </button>
        </div>
      )}
      {showReplay && (
        <ReplayView
          key={`replay-${refresh}`}
          tradeId={trade.id}
          executionDates={[...new Set(executions.map((e) => timestampToISODate(e.timestamp)))]}
        />
      )}

      <div className={`${card} space-y-3`}>
        <div className="flex items-center justify-between">
          <h3 className={subheading}>Close</h3>
          {status === 'planned' && !abandoning && (
            <button type="button" className={btnSecondary} onClick={() => setAbandoning(true)}>
              Abandon
            </button>
          )}
          {flatNeedsReason && closeDismissed && !abandoning && (
            <button type="button" className={btnSecondary} onClick={() => setCloseDismissed(false)}>
              Add close reason
            </button>
          )}
        </div>
        {trade.closeReason ? (
          <p aria-label="close reason" className="text-sm text-stone-800">
            {trade.closeReason.name}
          </p>
        ) : showCloseForm ? (
          <CloseForm
            tradeId={trade.id}
            onDone={() => {
              setAbandoning(false)
              setCloseDismissed(false)
              setRefresh((n) => n + 1)
            }}
            onDismiss={() => {
              setAbandoning(false)
              setCloseDismissed(true)
            }}
          />
        ) : (
          <p className="text-sm text-stone-500">No close reason</p>
        )}
      </div>

      <div className={`${card} space-y-3`}>
        <div className="flex items-center gap-2">
          <h3 className={subheading}>Journal</h3>
          <span
            aria-label="journal entries"
            className="inline-flex min-w-5 items-center justify-center rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 tabular-nums"
          >
            {entries.length}
          </span>
        </div>
        {buildEntryThreads(entries).map(({ root, addenda }) => (
          <div key={root.id} className="space-y-2">
            {root.placeholder && root.settledAt === undefined ? (
              <p
                aria-label="journal owed"
                className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
              >
                Journal entry owed
              </p>
            ) : (
              <AnsweredPrompts answered={root.answered} promptClass={subheading} />
            )}
            <AddAddendum entry={root} onAdded={() => setRefresh((n) => n + 1)} />
            {addenda.length > 0 && (
              <ul aria-label="addenda" className="ml-4 space-y-3 border-l border-stone-200 pl-4">
                {addenda.map((addendum) => (
                  <li key={addendum.id} className="space-y-2">
                    <p className="text-xs text-stone-500">{timestampToISODate(addendum.at)}</p>
                    <AnsweredPrompts answered={addendum.answered} promptClass={subheading} />
                    <AddAddendum entry={addendum} onAdded={() => setRefresh((n) => n + 1)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
