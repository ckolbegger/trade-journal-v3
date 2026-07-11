import { useCallback, useEffect, useState } from 'react'
import { useValuations } from '../valuationsContext'
import { MarkEntry } from './MarkEntry'
import { centsToDollars } from '../format'
import { card, num, subheading } from '../styles'
import type { Money, RiskReward } from '@/books/tradebook/types'
import type { TradeDetailView } from '@/coordinators/valuations'

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

export function TradeDashboard({ tradeId }: { tradeId: string }) {
  const valuations = useValuations()
  const [detail, setDetail] = useState<TradeDetailView | null>(null)

  const load = useCallback(() => {
    let active = true
    void valuations.detail(tradeId).then((d) => {
      if (active) setDetail(d)
    })
    return () => {
      active = false
    }
  }, [valuations, tradeId])

  useEffect(load, [load])

  if (!detail) return null

  const instrument = detail.record.plan.plannedLegs[0]?.instrument.ticker ?? ''

  if (detail.marksMissing || !detail.valuation || !detail.riskReward) {
    return (
      <div className={`${card} space-y-3`}>
        <h3 className={subheading}>Valuation</h3>
        <p className="text-sm text-slate-500">
          Enter today's price to see P&amp;L and risk/reward.
        </p>
        <MarkEntry instrument={instrument} onRecorded={() => load()} />
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

      <div className="grid grid-cols-2 gap-4">
        <dl
          aria-label="ongoing risk and reward"
          className="space-y-2 rounded-md border border-slate-200 p-3 text-sm"
        >
          <p className={subheading}>Ongoing (from today's Mark)</p>
          <Anchor label="planned risk" title="Planned risk" value={anchor(rr.plannedRisk)} />
          <Anchor
            label="worst-case risk"
            title="Worst-case risk"
            value={anchor(rr.worstCaseRisk)}
          />
          <Anchor label="planned reward" title="Planned reward" value={anchor(rr.plannedReward)} />
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
