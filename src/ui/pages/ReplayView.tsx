import { useEffect, useState } from 'react'
import { useValuations } from '../valuationsContext'
import { ReplayChart } from '../components/ReplayChart'
import { centsToDollars } from '../format'
import { card, num, subheading } from '../styles'
import type { Money } from '@/books/tradebook/types'
import type { ReplaySeriesPoint } from '@/coordinators/valuations'

function money(cents: Money): string {
  return `$${centsToDollars(cents)}`
}

function anchor(value: Money | 'unlimited' | 'undefined'): string {
  if (value === 'unlimited') return 'Unlimited'
  if (value === 'undefined') return 'Undefined'
  return money(value)
}

// The Trade's ACTUAL history, replayed on a slider (docs/design/trade-detail-sequence.md
// "Replay graph"): one `Valuations.replay(tradeId)` call supplies every
// ReplayPoint; the slider only picks an INDEX into what already came back —
// there is no "today" or "future" position on this control, so nothing here
// can ever show more than what already happened (ADR 0009).
export function ReplayView({
  tradeId,
  executionDates,
}: {
  tradeId: string
  executionDates: string[]
}) {
  const valuations = useValuations()
  const [points, setPoints] = useState<ReplaySeriesPoint[] | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    let active = true
    void (async () => {
      const result = await valuations.replay(tradeId)
      if (!active) return
      setPoints(result)
      setSelectedIndex(Math.max(result.length - 1, 0))
    })()
    return () => {
      active = false
    }
  }, [valuations, tradeId])

  if (!points) return <p className="text-sm text-stone-600">Loading…</p>

  if (points.length === 0) {
    return (
      <div className={`${card} space-y-2`}>
        <h3 className={subheading}>Replay</h3>
        <p className="text-sm text-stone-500">Nothing to replay yet.</p>
      </div>
    )
  }

  const selected = points[selectedIndex]

  return (
    <div className={`${card} space-y-4`}>
      <h3 className={subheading}>Replay</h3>

      <ReplayChart
        points={points.map((p) => ({
          date: p.date,
          totalPnL: p.valuation.totalPnL,
          plannedRisk:
            p.riskReward.plannedRisk === 'undefined' ? undefined : p.riskReward.plannedRisk,
          joinsPrevious: p.joinsPrevious,
        }))}
        selectedIndex={selectedIndex}
        executionDates={executionDates}
      />

      <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
        {selected.date}
        <input
          type="range"
          aria-label="replay date"
          min={0}
          max={points.length - 1}
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(Number(e.target.value))}
        />
      </label>

      <dl aria-label="replay profit and loss" className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Row label="Current value" value={money(selected.valuation.currentValue)} />
        <Row label="Unrealized P&L" value={money(selected.valuation.unrealizedPnL)} />
        <Row label="Realized P&L" value={money(selected.valuation.realizedPnL)} />
        <Row label="Fees" value={money(selected.valuation.fees)} />
        <Row label="Total P&L" value={money(selected.valuation.totalPnL)} />
      </dl>

      <dl
        aria-label="replay risk and reward"
        className="space-y-2 rounded-md border border-stone-200 p-3 text-sm"
      >
        <Anchor label="planned risk" value={anchor(selected.riskReward.plannedRisk)} />
        <Anchor label="worst-case risk" value={anchor(selected.riskReward.worstCaseRisk)} />
        <Anchor label="planned reward" value={anchor(selected.riskReward.plannedReward)} />
        <Anchor label="max reward" value={anchor(selected.riskReward.maxReward)} />
      </dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd className={`text-stone-900 ${num}`}>{value}</dd>
    </div>
  )
}

function Anchor({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd aria-label={label} className={`text-stone-900 ${num}`}>
        {value}
      </dd>
    </div>
  )
}
