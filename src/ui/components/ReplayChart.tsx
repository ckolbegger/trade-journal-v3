import { isWeekend } from '@/domain/dates'
import { num } from '../styles'

// A small hand-rolled inline SVG (no charting library — ADR 0009 keeps this
// surface reflective, so it's a polyline + gap segmentation + a slider, not a
// charting problem): total P&L across a Trade's ACTUAL history, one point per
// marked date the Trade held quantity. A gap between two points (a date with
// no ReplayPoint — S15.1.T1) is visibly BROKEN — a new polyline segment,
// never bridged — UNLESS every calendar date strictly between them is a
// Saturday or Sunday: a weekend is an expected absence, not a gap (S4.4's
// weekend-quiet ruling, amended into S15.1's TestSpec 2026-07-19), so Friday
// joins straight to Monday while a skipped weekday still breaks the line.
// The optional planned-risk reference line plots `totalPnL - plannedRisk` per
// point — "if stopped out that day" (named in its own legend below, never
// left to read as a projection: ADR 0009) — since `plannedRisk` is itself
// mark-to-market (ADR 0010), so this reference moves with the Trade's value
// rather than sitting as a fixed band pinned at Plan time. Every number is
// ALSO available as plain text below the chart (docs/design/ui-style.md) —
// the chart is secondary, the selected-date dashboard is primary.
export interface ReplayChartPoint {
  date: string
  totalPnL: number // cents
  plannedRisk?: number // cents; absent when that date's stop projection is 'undefined'
}

export function ReplayChart({
  points,
  selectedIndex,
  executionDates,
}: {
  points: ReplayChartPoint[]
  selectedIndex: number
  executionDates: string[]
}) {
  const width = 600
  const height = 160
  const padding = 12

  const hasRiskLine = points.some((p) => p.plannedRisk !== undefined)

  const values = points.flatMap((p) => [
    p.totalPnL,
    ...(p.plannedRisk === undefined ? [] : [p.totalPnL - p.plannedRisk]),
  ])
  const minV = Math.min(0, ...values)
  const maxV = Math.max(0, ...values)
  const span = maxV - minV || 1

  const x = (i: number) => padding + (i / Math.max(points.length - 1, 1)) * (width - padding * 2)
  const y = (v: number) => height - padding - ((v - minV) / span) * (height - padding * 2)

  // Consecutive points join into one segment when nothing but a weekend lies
  // between their dates; any weekday absence in between starts a new segment
  // — that break IS the gap.
  const segments: number[][] = []
  let current: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    if (bridgesOnlyWeekend(points[i - 1].date, points[i].date)) {
      current.push(i)
    } else {
      segments.push(current)
      current = [i]
    }
  }
  segments.push(current)

  const indexOfDate = new Map(points.map((p, i) => [p.date, i]))
  const executionIndices = executionDates
    .map((d) => indexOfDate.get(d))
    .filter((i): i is number => i !== undefined)

  return (
    <div className="space-y-2">
      <svg
        role="img"
        aria-label={
          hasRiskLine
            ? 'Trade P&L replay over its actual history, with a reference line for the level if stopped out that day'
            : 'Trade P&L replay over its actual history'
        }
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
      >
        <line x1={padding} y1={y(0)} x2={width - padding} y2={y(0)} stroke="#e2e8f0" />
        {segments.map((segment, i) => (
          <polyline
            key={`pnl-${i}`}
            className="pnl-segment"
            points={segment.map((idx) => `${x(idx)},${y(points[idx].totalPnL)}`).join(' ')}
            fill="none"
            stroke="#4f46e5"
            strokeWidth={2}
          />
        ))}
        {segments.map((segment, i) => {
          const risky = segment.filter((idx) => points[idx].plannedRisk !== undefined)
          if (risky.length === 0) return null
          return (
            <polyline
              key={`risk-${i}`}
              className="risk-segment"
              points={risky
                .map((idx) => `${x(idx)},${y(points[idx].totalPnL - points[idx].plannedRisk!)}`)
                .join(' ')}
              fill="none"
              stroke="#f59e0b"
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
          )
        })}
        {executionIndices.map((idx) => (
          <circle key={idx} cx={x(idx)} cy={y(points[idx].totalPnL)} r={3} fill="#0f172a" />
        ))}
        {points[selectedIndex] && (
          <circle
            cx={x(selectedIndex)}
            cy={y(points[selectedIndex].totalPnL)}
            r={4}
            fill="#4f46e5"
            stroke="white"
            strokeWidth={1.5}
          />
        )}
      </svg>

      {/* A visible, named legend — never left anonymous, so the dashed
          reference line can't be misread as a projection (ADR 0009). */}
      <p className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0.5 w-3 bg-indigo-600" />
          Total P&amp;L
        </span>
        {hasRiskLine && (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-0 w-3 border-t-2 border-dashed border-amber-500"
            />
            If stopped out that day
          </span>
        )}
      </p>

      <ul aria-label="execution dates" className={`text-xs text-slate-500 ${num}`}>
        {executionDates.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </div>
  )
}

// True when every calendar date strictly between `from` and `to` is a
// Saturday or Sunday (including when there are none — adjacent days) — the
// only case a gap between two REPLAYED points still joins into one segment.
// Weekend detection defers to `isWeekend` (domain/dates.ts) — the same
// source of truth PriceBook.missingMarks uses (S4.4) — rather than a second,
// independently-maintained day-of-week check.
function bridgesOnlyWeekend(from: string, to: string): boolean {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const dayMs = 24 * 60 * 60 * 1000
  const fromMs = Date.UTC(fy, fm - 1, fd)
  const toMs = Date.UTC(ty, tm - 1, td)
  for (let ms = fromMs + dayMs; ms < toMs; ms += dayMs) {
    const date = new Date(ms).toISOString().slice(0, 10)
    if (!isWeekend(date)) return false
  }
  return true
}
