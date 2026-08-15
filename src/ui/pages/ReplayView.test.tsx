import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReplayView } from './ReplayView'
import { ValuationsContext } from '../valuationsContext'
import { Valuations } from '@/coordinators/valuations'
import type {
  Account,
  ExecutionDraft,
  ExitLevel,
  Institution,
  PlanDraft,
} from '@/books/tradebook/types'
import { Workspace } from '@/workspace/workspace'
import { inMemoryBooks } from '../../../tests/support/trade-book'

// A single-lot stock Trade, still open (no close): buy 100 AAPL @ 150.00 fees
// 1.00 on 2026-07-10 (a Friday). Marks on 07-10 (Fri) and 07-13 (Mon) — a
// weekend gap the chart BRIDGES (S4.4's weekend-quiet ruling) — then 07-14
// (Tue) is skipped, a real weekday gap the chart BREAKS on, before 07-15
// (Wed). The worked example at the last Mark (160.00) is the Slice 1 worked
// example's own numbers (docs/plan/slice-01-stock-lifecycle.md): unrealized
// 1000.00, fees 1.00, total 999.00; plannedRisk 2000.00, worstCaseRisk
// 16000.00, plannedReward 1000.00, maxReward unlimited.

async function seededReplay(): Promise<{ valuations: Valuations; tradeId: string }> {
  const { tradeBook: book, journal, priceBook } = inMemoryBooks()
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  await new Workspace(book, journal).ensureSeeded()

  const stop: ExitLevel = {
    scope: { level: 'trade' },
    side: 'stop',
    kind: 'underlyingPrice',
    price: 14000,
  }
  const target: ExitLevel = {
    scope: { level: 'trade' },
    side: 'target',
    kind: 'underlyingPrice',
    price: 17000,
  }
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [stop, target],
    plannedAt: '2026-07-10',
  }
  const tradeId = await book.confirmPlan(draft)
  const buy100: ExecutionDraft = {
    side: 'buy',
    qty: 100,
    price: 15000,
    fees: 100,
    timestamp: new Date('2026-07-10T12:00:00').getTime(),
  }
  await book.recordExecution({ tradeId, newLeg: 'AAPL' }, buy100)

  await priceBook.record('AAPL', '2026-07-10', 15000, 'manual') // Friday
  await priceBook.record('AAPL', '2026-07-13', 15500, 'manual') // Monday — bridges the weekend
  // 2026-07-14 (Tuesday) deliberately has no Mark — the real, weekday gap.
  await priceBook.record('AAPL', '2026-07-15', 16000, 'manual') // Wednesday

  return { valuations: new Valuations(book, priceBook), tradeId }
}

function renderReplay(valuations: Valuations, tradeId: string) {
  return render(
    <ValuationsContext.Provider value={valuations}>
      <ReplayView tradeId={tradeId} executionDates={['2026-07-10']} />
    </ValuationsContext.Provider>,
  )
}

describe('ReplayView', () => {
  it('renders the series with visible gaps, bridging only the weekend', async () => {
    const { valuations, tradeId } = await seededReplay()
    const { container } = renderReplay(valuations, tradeId)

    await screen.findByLabelText('replay date')
    // Three points (Fri 07-10, Mon 07-13, Wed 07-15). Friday joins straight
    // to Monday (only a weekend lies between) — one segment of two vertices —
    // then the skipped Tuesday breaks the line before Wednesday — a second,
    // single-vertex segment. Two segments, never bridging the real gap.
    const segments = container.querySelectorAll('.pnl-segment')
    expect(segments).toHaveLength(2)
    const verticesOf = (el: Element) => (el.getAttribute('points') ?? '').trim().split(/\s+/).length
    expect(verticesOf(segments[0])).toBe(2) // Friday + Monday, bridged
    expect(verticesOf(segments[1])).toBe(1) // Wednesday, alone after the real gap
  })

  it("shows the selected date's Valuation and four R/R numbers", async () => {
    const { valuations, tradeId } = await seededReplay()
    renderReplay(valuations, tradeId)

    // Defaults to the latest point (07-15, mark 160.00).
    const pnl = await screen.findByLabelText('replay profit and loss')
    expect(pnl).toHaveTextContent(/1000\.00/) // unrealized
    expect(pnl).toHaveTextContent(/999\.00/) // total

    const rr = screen.getByLabelText('replay risk and reward')
    expect(within(rr).getByLabelText('planned risk')).toHaveTextContent('2000.00')
    expect(within(rr).getByLabelText('worst-case risk')).toHaveTextContent('16000.00')
    expect(within(rr).getByLabelText('planned reward')).toHaveTextContent('1000.00')
    expect(within(rr).getByLabelText('max reward')).toHaveTextContent(/unlimited/i)
  })

  it('marks execution dates on the timeline', async () => {
    const { valuations, tradeId } = await seededReplay()
    renderReplay(valuations, tradeId)

    const executions = await screen.findByLabelText('execution dates')
    expect(executions).toHaveTextContent('2026-07-10')
  })

  it('names the planned-risk reference line so it never reads as a projection', async () => {
    const { valuations, tradeId } = await seededReplay()
    renderReplay(valuations, tradeId)

    await screen.findByLabelText('replay date')
    expect(screen.getByText(/if stopped out that day/i)).toBeInTheDocument()
  })

  it('contains no forward-looking element', async () => {
    const { valuations, tradeId } = await seededReplay()
    const { container } = renderReplay(valuations, tradeId)

    const slider = await screen.findByLabelText('replay date')
    // Three points — the slider can never move past the last one that
    // actually happened.
    expect(slider).toHaveAttribute('max', '2')
    expect(screen.queryByText(/forecast|predict|project/i)).not.toBeInTheDocument()

    // Nothing rendered in the chart sits right of the last replayed point —
    // no circle, no segment vertex extends past it.
    const svg = container.querySelector('svg')!
    const segmentX = Array.from(svg.querySelectorAll('polyline')).flatMap((el) =>
      (el.getAttribute('points') ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((pair) => Number(pair.split(',')[0])),
    )
    const circleX = Array.from(svg.querySelectorAll('circle')).map((c) =>
      Number(c.getAttribute('cx')),
    )
    const lastPointX = Math.max(...segmentX) // the rightmost plotted P&L vertex
    expect(Math.max(...circleX)).toBeLessThanOrEqual(lastPointX)
  })
})
