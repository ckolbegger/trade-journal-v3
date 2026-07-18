import { useCallback, useContext, useEffect, useState } from 'react'
import { useValuations } from '../valuationsContext'
import { WorkspaceContext } from '../workspaceContext'
import { MarkEntry } from './MarkEntry'
import { centsToDollars, optionLabel } from '../format'
import { card, num, subheading } from '../styles'
import { buildInstrumentKey } from '@/books/tradebook/types'
import type { Instrument, Money, RiskReward } from '@/books/tradebook/types'
import type { TradeDetailView } from '@/coordinators/valuations'

// A held instrument rendered for display — a stock is just its ticker; an
// option shows its contract label ("AAPL Jun'27 200C").
function instrumentLabel(instrument: Instrument): string {
  return instrument.kind === 'option' ? optionLabel(instrument) : instrument.ticker
}

// The Trade dashboard: P&L and all four mark-to-market Risk/Reward anchors, with
// the original Plan's risk/reward alongside for contrast (ADR 0010). Every number
// comes from ONE Valuations.detail snapshot. 'unlimited'/'undefined' anchors are
// rendered as words. When no Mark exists yet, it prompts for one (MarkEntry)
// instead of showing numbers.

function money(cents: Money): string {
  return `$${centsToDollars(cents)}`
}

function anchor(value: Money | 'unlimited' | 'undefined'): string {
  if (value === 'unlimited') return 'Unlimited'
  if (value === 'undefined') return 'Undefined'
  return money(value)
}

// `onDetail`, when supplied, hands the whole detail() snapshot back to the
// caller as it loads and refreshes (S5.1) — e.g. TradeDetail's Position line
// reads `valuation.perLeg` for average cost off the SAME snapshot, rather
// than a second round trip that could disagree about which Marks exist.
export function TradeDashboard({
  tradeId,
  onDetail,
}: {
  tradeId: string
  onDetail?: (detail: TradeDetailView) => void
}) {
  const valuations = useValuations()
  // Optional: most render trees (and older tests) never provide a Workspace —
  // IV simply never computes then (detail()'s riskFreeRate param is optional).
  const workspace = useContext(WorkspaceContext)
  const [detail, setDetail] = useState<TradeDetailView | null>(null)

  const load = useCallback(() => {
    let active = true
    void (async () => {
      const riskFreeRate = workspace ? await workspace.settings.get('riskFreeRate') : undefined
      const d = await valuations.detail(tradeId, riskFreeRate)
      if (active) {
        setDetail(d)
        onDetail?.(d)
      }
    })()
    return () => {
      active = false
    }
  }, [valuations, tradeId, workspace, onDetail])

  useEffect(load, [load])

  if (!detail) return null

  // plannedLegs[0] is always concrete: a single-leg Strategy requires its sole
  // Planned Leg's strike/expiration up front (PlanForm), and a multi-leg
  // Strategy's own first leg is Slice 7's stock leg — no strike/expiration to
  // be TBD about. Only a LATER Planned Leg can be TBD, never read here.
  const plannedInstrument = detail.record.plan.plannedLegs[0]?.instrument as Instrument | undefined
  // Assignment/exercise (S3.4) can land a Leg the original Plan never named
  // (the paired stock Leg, with the option Leg now flat) — when the Trade
  // currently holds exactly one Leg, both the Mark prompt and the "at
  // intrinsic" labeling below follow it; otherwise (nothing held yet — the
  // common first-fill case) they fall back to the Planned Leg's instrument
  // (bit-identical to every pre-assignment flow). Mirrors RecordFillForm's
  // same fix.
  const heldInstrument =
    detail.position.holdings.length === 1 ? detail.position.holdings[0].instrument : undefined
  const activeInstrument = heldInstrument ?? plannedInstrument
  const instrument = activeInstrument ? buildInstrumentKey(activeInstrument) : ''

  // An underlyingPrice Exit Level on a held OPTION Leg values the structure at
  // intrinsic (no pricing model exists to value time, ADR 0009) — the display
  // says so wherever that projection feeds a risk/reward anchor. Once
  // assignment/exercise replaces the held Leg with stock, `priceAtLevel`
  // (risk-reward.ts) resolves the same Exit Level as a plain price instead —
  // the label must follow what is actually held, not the original Plan.
  const exitLevels = detail.record.plan.exitLevels
  const atIntrinsic = (side: 'stop' | 'target'): boolean =>
    activeInstrument?.kind === 'option' &&
    exitLevels.some((l) => l.side === side && l.kind === 'underlyingPrice')

  if (detail.marksMissing || !detail.valuation || !detail.riskReward) {
    // A multi-leg Trade (covered call: stock + call) can need more than one
    // Mark before valuation succeeds — one entry per missing instrument, not
    // just the first (Slice 7).
    const missing = detail.marksMissing ?? (instrument ? [instrument] : [])
    return (
      <div className={`${card} space-y-3`}>
        <h3 className={subheading}>Valuation</h3>
        <p className="text-sm text-slate-500">
          Enter today's price to see P&amp;L and risk/reward.
        </p>
        {missing.map((key) => (
          <div key={key} className="space-y-2">
            {missing.length > 1 && <p className="text-sm font-medium text-slate-700">{key}</p>}
            <MarkEntry instrument={key} onRecorded={() => load()} />
          </div>
        ))}
      </div>
    )
  }

  const v = detail.valuation
  const rr: RiskReward = detail.riskReward

  return (
    <div className={`${card} space-y-4`}>
      <h3 className={subheading}>Valuation</h3>

      <dl aria-label="profit and loss" className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Row label="Current value" value={money(v.currentValue)} />
        <Row label="Unrealized P&L" value={money(v.unrealizedPnL)} />
        <Row label="Realized P&L" value={money(v.realizedPnL)} />
        <Row label="Fees" value={money(v.fees)} />
        <Row label="Total P&L" value={money(v.totalPnL)} />
      </dl>

      {/* IV is display-only (ADR 0009) — never fed back into P&L or R/R. Shown
          per option Leg that has its own contract Mark; the percentage is
          omitted when the underlying is unmarked or no vol reproduces the
          Mark (Valuations.detail's impliedVols, computed from TradeMath.impliedVol). */}
      {detail.impliedVols && detail.impliedVols.length > 0 && (
        <dl aria-label="option marks" className="space-y-1 text-sm">
          {detail.impliedVols.map((entry) => {
            const leg = detail.record.legs.find((l) => l.id === entry.legId)
            if (!leg) return null
            return (
              <div key={entry.legId} className="flex justify-between">
                <dt className="text-slate-500">{instrumentLabel(leg.instrument)}</dt>
                <dd className={`text-slate-900 ${num}`}>
                  {centsToDollars(entry.markPrice)}
                  {entry.iv !== undefined && ` · IV ${Math.round(entry.iv * 100)}%`}
                </dd>
              </div>
            )
          })}
        </dl>
      )}

      {/* Multiple Legs only after an assignment/exercise landed a paired stock
          Leg alongside the option (S3.4) — a single-Leg Trade already shows
          this same total above, so the per-Leg breakdown stays hidden then. */}
      {v.perLeg.length > 1 && (
        <dl aria-label="per-leg profit and loss" className="space-y-1 text-sm">
          <p className={subheading}>Per Leg</p>
          {v.perLeg.map((leg, i) => (
            <div key={i} className="flex justify-between">
              <dt className="text-slate-500">{instrumentLabel(leg.instrument)}</dt>
              <dd className={`text-slate-900 ${num}`}>
                realized {money(leg.realized)} · unrealized {money(leg.unrealized)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="grid grid-cols-2 gap-4">
        <dl
          aria-label="ongoing risk and reward"
          className="space-y-2 rounded-md border border-slate-200 p-3 text-sm"
        >
          <p className={subheading}>Ongoing (from today's Mark)</p>
          <Anchor
            label="planned risk"
            title={atIntrinsic('stop') ? 'Planned risk (at intrinsic)' : 'Planned risk'}
            value={anchor(rr.plannedRisk)}
          />
          <Anchor
            label="worst-case risk"
            title="Worst-case risk"
            value={anchor(rr.worstCaseRisk)}
          />
          <Anchor
            label="planned reward"
            title={atIntrinsic('target') ? 'Planned reward (at intrinsic)' : 'Planned reward'}
            value={anchor(rr.plannedReward)}
          />
          <Anchor label="max reward" title="Max reward" value={anchor(rr.maxReward)} />
        </dl>

        <dl
          aria-label="original plan risk and reward"
          className="space-y-2 rounded-md border border-slate-200 p-3 text-sm"
        >
          <p className={subheading}>Original plan</p>
          <Anchor label="original risk" title="Risk" value={anchor(rr.original.risk)} />
          <Anchor label="original reward" title="Reward" value={anchor(rr.original.reward)} />
        </dl>
      </div>

      <MarkEntry instrument={instrument} onRecorded={() => load()} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-slate-900 ${num}`}>{value}</dd>
    </div>
  )
}

function Anchor({ label, title, value }: { label: string; title: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{title}</dt>
      <dd aria-label={label} className={`text-slate-900 ${num}`}>
        {value}
      </dd>
    </div>
  )
}
