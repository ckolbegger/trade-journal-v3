import { Fragment, useState, type MouseEvent, type ReactNode } from 'react'
import type { LoadedDetail } from './detail-controller'
import {
  replayX, replayY, sparkline, splitSegments,
} from './replay-visual'

type Props = {
  loaded: LoadedDetail
  index: number
  onSelect: (index: number) => void
  onBack: () => void
}

const VISUALIZATIONS = [
  'Corridor', 'Sessions', 'Move', 'At stake', 'Plan', 'Sources',
] as const

function Chart({
  loaded, index, onSelect, tone,
}: {
  loaded: LoadedDetail
  index: number
  onSelect: (index: number) => void
  tone: string
}) {
  if (loaded.status !== 'Ready') return null
  const { series, detail } = loaded
  const sessions = series.sessions
  const width = 360
  const height = 130
  const stop = detail.stopsAndTargets.stop
  const target = detail.stopsAndTargets.target
  const seek = (event: MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const fraction = (event.clientX - box.left) / box.width
    onSelect(Math.max(0, Math.min(sessions.length - 1, Math.round(fraction * (sessions.length - 1)))))
  }
  return (
    <svg
      data-testid="corridor-chart" className={`corridor ${tone}`}
      viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label="Trade result between Stop and Target, one point per session"
      onClick={seek}
    >
      <defs>
        <pattern id="replay-gap" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#b8b1a0" strokeWidth="2" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={width} height={height} className="plot-bg" />
      <line className="rail rail-target" x1="0" x2={width} y1="8" y2="8" />
      <line className="rail rail-stop" x1="0" x2={width} y1={height - 8} y2={height - 8} />
      <text x="4" y="20" className="rail-label">Target {target}</text>
      <text x="4" y={height - 2} className="rail-label">Stop {stop}</text>
      {sessions.map((session, i) => session.gap && (
        <rect
          key={`gap-${session.date}`} className="gap-band"
          x={Math.max(0, replayX(i, sessions.length, width) - 4)} y="0"
          width="8" height={height} fill="url(#replay-gap)"
        />
      ))}
      <polyline
        className="mark-line"
        points={sessions.map((session, i) => {
          const y = replayY(session.price, stop, target, height)
          return y === null ? null : `${replayX(i, sessions.length, width)},${y}`
        }).filter((point): point is string => point !== null).join(' ')}
      />
      {sessions.map((session, i) => {
        const y = replayY(session.price, stop, target, height)
        return y === null ? null : (
          <circle
            key={session.date} className="mark-dot"
            cx={replayX(i, sessions.length, width)} cy={y} r="3.5"
          />
        )
      })}
      <line
        className="cursor" x1={replayX(index, sessions.length, width)}
        x2={replayX(index, sessions.length, width)} y1="0" y2={height}
      />
    </svg>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="kv-group">
      <h4>{title}</h4>
      {children}
    </div>
  )
}

export function ReplayView({ loaded, index, onSelect, onBack }: Props) {
  const [priceAction, setPriceAction] = useState<'Bullish' | 'Bearish'>('Bullish')
  const [visualization, setVisualization] = useState<string>('Corridor')
  const [popover, setPopover] = useState<string | null>(null)
  if (loaded.status !== 'Ready') return <p role="status">Trade not found.</p>
  const { detail, series, advisory, advisorySeries, underlyingSeries } = loaded
  const sessions = series.sessions
  const current = sessions[Math.min(index, Math.max(0, sessions.length - 1))]
  const figure = `${detail.figures.realizedR}R`
  const tone = detail.figures.realizedR.startsWith('-') ? 'down' : 'up'
  const state = current?.gap
    ? `No Mark for ${current.date}. Nothing is carried over from the session before.`
    : current?.price
      ? `Mark ${current.price}. The Stop is ${detail.stopsAndTargets.stop} and the Target is ${detail.stopsAndTargets.target}.`
      : 'No sessions to replay.'
  const stake = 'One exact Mark per session. Gaps stay gaps: no interpolation, no provider candle.'
  const iv = advisory?.iv?.kind === 'Value' ? advisory.iv.vol : null
  const shares = advisory?.shareEquivalent?.kind === 'Value' ? advisory.shareEquivalent.shares : null
  const ivPoints = sparkline(advisorySeries.map(a => a.iv).filter((v): v is number => v !== null), 52, 18)
  const sharePoints = sparkline(advisorySeries.map(a => a.shares).filter((v): v is number => v !== null), 52, 18)
  const ivPopover = sparkline(advisorySeries.map(a => a.iv).filter((v): v is number => v !== null), 300, 100)
  const sharePopover = sparkline(advisorySeries.map(a => a.shares).filter((v): v is number => v !== null), 300, 100)
  const parts = advisory?.decomposition ? splitSegments(advisory.decomposition) : []
  const total = Math.max(...parts.map(p => Math.abs(p.value)), 0.005)
  const chip = (id: string, label: ReactNode, popoverContent: ReactNode) => (
    <span className="chip-wrap" key={id}>
      <button
        type="button" className="chip" aria-expanded={popover === id}
        aria-controls={`pop-${id}`} onClick={() => setPopover(popover === id ? null : id)}
      >{label}</button>
      <div className={`pop${popover === id ? ' open' : ''}`} id={`pop-${id}`}>{popoverContent}</div>
    </span>
  )

  return (
    <section aria-label="Session replay" data-testid="replay-view" className="card">
      <button type="button" className="detail-link" onClick={onBack}>Back to detail</button>
      <p className="section-label">Session replay</p>

      <div className="replay-controls">
        <div className="seg" role="group" aria-label="Price action">
          {(['Bullish', 'Bearish'] as const).map(action => (
            <button
              key={action} type="button" aria-pressed={priceAction === action}
              onClick={() => setPriceAction(action)}
            >{action}</button>
          ))}
        </div>
        <button type="button" aria-label="Earlier session" onClick={() => onSelect(Math.max(0, index - 1))}>‹</button>
        <input
          aria-label="Replay session" data-testid="replay-slider" type="range"
          min={0} max={Math.max(0, sessions.length - 1)} value={index}
          onChange={e => onSelect(Number(e.target.value))}
        />
        <button type="button" aria-label="Later session" onClick={() => onSelect(Math.min(sessions.length - 1, index + 1))}>›</button>
        <span data-testid="replay-session">{current?.date ?? 'No sessions'} · {index + 1} of {sessions.length}</span>
      </div>
      <div className="viz-tabs" role="tablist" aria-label="Visualization">
        {VISUALIZATIONS.map(name => (
          <button
            key={name} type="button" role="tab" aria-selected={visualization === name}
            aria-disabled={name !== 'Corridor'}
            onClick={() => { if (name === 'Corridor') setVisualization(name) }}
          >{name}</button>
        ))}
      </div>

      <div className="replay-layout">
        <div className="replay-hero">
          <div className={`replay-status ${tone}`} data-testid="replay-status">
            <strong>{figure}</strong>
            <p>{state}</p>
            <p className="muted">{stake}</p>
          </div>
          <Chart loaded={loaded} index={index} onSelect={onSelect} tone={priceAction.toLowerCase()} />
          <p className="replay-move">
            Since the previous session: Trade P&amp;L change is not stored, so no number is invented.
            {parts.length > 0 && (
              <span className="split-bar" data-testid="split-bar">
                {parts.map(part => (
                  <Fragment key={part.name}>
                    <span
                      className={`segment seg-${part.name.toLowerCase()}`}
                      style={{ width: `${Math.max(2, Math.abs(part.value) / total * 50)}%` }}
                      title={`${part.name} ${part.value.toFixed(2)}`}
                    />
                    <span className="part">{part.name} {part.value.toFixed(2)}</span>
                  </Fragment>
                ))}
                <span className="badge b-est">estimate</span>
              </span>
            )}
          </p>
          <div className="replay-chips">
            {chip('iv', (
              <>
                Implied volatility {iv !== null ? iv.toFixed(4) : 'Unavailable'}
                {ivPoints && <svg viewBox="0 0 52 18"><polyline points={ivPoints} /></svg>}
              </>
            ), (
              <div>
                <h4>Implied volatility <span className="badge b-est">Estimate</span></h4>
                {ivPopover && <svg viewBox="0 0 300 100"><polyline points={ivPopover} /></svg>}
                <p className="muted">Read back from each session&apos;s Mark. Gaps are omitted.</p>
                <p className="muted">Never used for valuation, P&amp;L, risk or the expiration payoff.</p>
              </div>
            ))}
            {chip('shares', (
              <>
                Share equivalent {shares === null ? 'Unavailable' : shares}
                {sharePoints && <svg viewBox="0 0 52 18"><polyline points={sharePoints} /></svg>}
              </>
            ), (
              <div>
                <h4>Share equivalent <span className="badge b-est">Estimate</span></h4>
                {sharePopover && <svg viewBox="0 0 300 100"><polyline points={sharePopover} /></svg>}
                <p className="muted">A $1.00 move in {detail.identity.underlying} is worth about this much.</p>
                <p className="muted">Never used for valuation, P&amp;L, risk or the expiration payoff.</p>
              </div>
            ))}
            <span className="chip">Mark-only replay</span>
            <span className="chip">{detail.identity.strategy} · {detail.identity.lifecycle}</span>
          </div>
          <p className="replan-line">
            Plan: {detail.identity.underlying} · {detail.identity.strategy} ·
            entry {detail.positionAndPlan.plan.entry} · stop {detail.stopsAndTargets.stop} ·
            target {detail.stopsAndTargets.target}
          </p>
        </div>

        <aside className="replay-readout" data-testid="replay-readout">
          <h3 className="sec-title">
            {current?.date ?? 'No sessions'} · session {index + 1} of {sessions.length}
          </h3>
          {current?.gap && <span className="badge b-quiet">No Mark</span>}
          <Group title="How it is going">
            <dl className="kv">
              <dt>Realized R</dt><dd>{detail.figures.realizedR}</dd>
              <dt>Mark</dt><dd>{current?.gap || !current?.price ? 'No Mark' : current.price}</dd>
              <dt>Plan conformance</dt><dd>{detail.figures.planConformance}</dd>
            </dl>
          </Group>
          <Group title="At stake from here, whole Position">
            <dl className="kv">
              <dt>Stop</dt><dd>{detail.stopsAndTargets.stop}</dd>
              <dt>Target</dt><dd>{detail.stopsAndTargets.target}</dd>
              <dt>Distance to Stop</dt><dd>{detail.todayAgainst.current} → {detail.stopsAndTargets.stop}</dd>
              <dt>Distance to Target</dt><dd>{detail.todayAgainst.current} → {detail.stopsAndTargets.target}</dd>
            </dl>
          </Group>
          <Group title="Marks">
            <dl className="kv">
              <dt>Call Mark</dt><dd>{current?.gap || !current?.price ? 'No Mark' : current.price}</dd>
              <dt>Underlying Mark</dt><dd>{underlyingSeries.sessions.find(s => s.date === current?.date && s.status === 'Available')?.price ?? 'No Mark'}</dd>
            </dl>
          </Group>
          <Group title="Position">
            <dl className="kv">
              <dt>Held</dt><dd>{detail.positionAndPlan.positions[0]?.netQuantity ?? '0'}</dd>
              <dt>Executions</dt><dd>{detail.positionAndPlan.executions.length}</dd>
              <dt>Share equivalent</dt><dd>{shares === null ? 'Unavailable' : `about ${shares} (estimate)`}</dd>
            </dl>
          </Group>
          <Group title="Why the call moved">
            {advisory?.decomposition?.kind === 'Value' ? (
              <dl className="kv">
                {parts.map(part => <Fragment key={part.name}><dt>{part.name} (estimate)</dt><dd>{part.value.toFixed(2)}</dd></Fragment>)}
              </dl>
            ) : <p>{advisory?.decomposition?.kind === 'Unavailable' ? advisory.decomposition.reason : 'Not available'}</p>}
          </Group>
          <Group title="The Plan">
            <dl className="kv">
              <dt>Entry</dt><dd>{detail.positionAndPlan.plan.entry}</dd>
              <dt>Stop</dt><dd>{detail.stopsAndTargets.stop}</dd>
              <dt>Target</dt><dd>{detail.stopsAndTargets.target}</dd>
              <dt>Strategy</dt><dd>{detail.identity.strategy}</dd>
            </dl>
          </Group>
        </aside>
      </div>

      <h3 className="sec-title">Every session so far, as a table</h3>
      <div className="history-scroll">
        <table className="session-table">
          <thead>
            <tr>
              <th scope="col">Session</th><th scope="col">Call Mark</th>
              <th scope="col">Status</th><th scope="col">Key moments</th>
            </tr>
          </thead>
          <tbody>
            <tr className="plan-row">
              <th scope="row">Plan</th>
              <td>{detail.positionAndPlan.plan.entry}</td>
              <td>{detail.stopsAndTargets.stop} / {detail.stopsAndTargets.target}</td>
              <td>Stop {detail.stopsAndTargets.stop} · Target {detail.stopsAndTargets.target}</td>
            </tr>
            {sessions.map(session => (
              <tr key={session.date}>
                <th scope="row">{session.date}</th>
                <td>{session.status === 'Available' ? session.price : '—'}</td>
                <td>{session.status}</td>
                <td>{session.keyMoments.length ? session.keyMoments.join(', ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Sources and corrections live in Price History. Advisory figures are estimates and never
        used for valuation, P&amp;L, risk or the expiration payoff.
      </p>
    </section>
  )
}
