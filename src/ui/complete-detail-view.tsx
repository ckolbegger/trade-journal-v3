import { Fragment, useState } from 'react'
import type { LoadedDetail } from './detail-controller'
import {
  comparisonRows, hasObservedMark, payoffPolyline, trackBounds,
  trackPercent, visibleDrawers, type Drawer, type TrackBounds,
} from './detail-visual'
import type { CompleteDetail } from '../domain/complete-detail'
import type { SessionSeries } from '../domain/session-series'

type Props = {
  loaded: LoadedDetail
  replayIndex: number
  onSelectReplay: (index: number) => void
  onOpenReview: () => void
}

function figure(label: string, value: string) {
  return (
    <div key={label}>
      <p className="section-label">{label}</p>
      <p className="figure-value">{value}</p>
    </div>
  )
}

function Track({
  title, bounds, entry, previous, current, note,
}: {
  title: string
  bounds: TrackBounds
  entry?: number
  previous?: number
  current?: number
  note?: string
}) {
  const marker = (value: number | undefined, kind: string, label: string) => value === undefined
    ? null
    : (
      <span className={`mk ${kind}`} style={{ left: `${trackPercent(value, bounds)}%` }}>
        <span className="dot" /><span className="lab">{label}</span>
      </span>
    )
  return (
    <div className="track-block">
      <h4>{title}</h4>
      <div className="track" role="img" aria-label={`${title}: Stop ${bounds.min}, Target ${bounds.max}`}>
        <span className="zone z-stop" style={{ width: `${trackPercent(bounds.min, bounds)}%` }} />
        <span className="zone z-target" style={{ left: `${trackPercent(bounds.max, bounds)}%` }} />
        <span className="edge e-stop" style={{ left: `${trackPercent(bounds.min, bounds)}%` }} />
        <span className="edge e-target" style={{ left: `${trackPercent(bounds.max, bounds)}%` }} />
        {marker(entry, 'entry', 'entry')}
        {marker(previous, 'prev', 'previous')}
        {marker(current, 'now', 'now')}
      </div>
      <div className="track-ends"><span>{bounds.min}</span><span>{bounds.max}</span></div>
      {note && <p className="muted">{note}</p>}
    </div>
  )
}

function ComparisonTable({ detail }: { detail: CompleteDetail }) {
  const breakEven = detail.payoff.kind === 'Value' ? detail.payoff.value.breakEven[0] : undefined
  const rows = comparisonRows(detail.todayAgainst, breakEven)
  return (
    <table className="cmp">
      <thead><tr><th scope="col" /><th scope="col">Previous</th><th scope="col">Today</th><th scope="col">Change</th></tr></thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th><td>{row.previous}</td><td>{row.today}</td><td>{row.change}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PayoffChart({ detail }: { detail: CompleteDetail }) {
  if (detail.payoff.kind !== 'Value') {
    return <p data-testid="detail-payoff">{detail.payoff.kind}: {'reason' in detail.payoff ? detail.payoff.reason : ''}</p>
  }
  const strike = Number(detail.payoff.value.segments[0]?.to ?? 0)
  const toX = Number.isFinite(strike) && strike > 0 ? strike * 1.6 : 300
  const points = payoffPolyline(detail.payoff, toX) ?? ''
  const ys = points.split(' ').map(p => Number(p.split(',')[1])).filter(Number.isFinite)
  const lowY = ys.length ? Math.min(...ys) : -1
  const highY = ys.length ? Math.max(...ys) : 1
  const span = highY - lowY || 1
  const mapped = points.split(' ').map(p => {
    const [x, y] = p.split(',').map(Number)
    return `${20 + (x / toX) * 340},${170 - ((y - lowY) / span) * 140}`
  }).join(' ')
  return (
    <>
      <svg data-testid="payoff-chart" viewBox="0 0 380 190" role="img" aria-label="Intrinsic payoff at expiration">
        <line x1="20" y1="170" x2="360" y2="170" className="axis" />
        <line x1="20" y1="15" x2="20" y2="170" className="axis" />
        <polyline points={mapped} className="payoff-line" />
      </svg>
      <p>Payoff available</p>
      <p>Break-even: {detail.payoff.value.breakEven.join(', ') || '—'}</p>
      <ul className="detail-list">
        {detail.payoff.value.extrema.map((e, i) => <li key={i}>{e.kind}: {e.value} on {e.attainedOn}</li>)}
      </ul>
    </>
  )
}

function SessionRail({
  series, index, onSelect,
}: { series: SessionSeries; index: number; onSelect: (index: number) => void }) {
  const shift = (delta: number) => onSelect(Math.max(0, Math.min(series.sessions.length - 1, index + delta)))
  return (
    <>
      <div className="tl-head">
        <button type="button" aria-label="Newer sessions" onClick={() => shift(-1)}>‹</button>
        <h3>Sessions, newest first</h3>
        <button type="button" aria-label="Earlier sessions" onClick={() => shift(1)}>›</button>
      </div>
      <div className="rail-x" data-testid="session-rail">
        {series.sessions.map((session, i) => (
          <article key={session.date} className={`day${session.gap ? ' gap' : ''}`} aria-label={session.date}>
            <div className="when">{session.date}</div>
            <h4>{session.gap ? 'No Mark' : session.price}</h4>
            {session.keyMoments.map(m => <p key={m} className="muted">{m}</p>)}
            <button type="button" onClick={() => onSelect(i)}>View</button>
          </article>
        ))}
      </div>
    </>
  )
}

export function CompleteDetailView({ loaded, replayIndex, onSelectReplay, onOpenReview }: Props) {
  const [drawer, setDrawer] = useState<Drawer>('Today')
  if (loaded.status !== 'Ready') return <p role="status">Trade not found.</p>
  const { detail, series, underlyingSeries, advisory } = loaded
  const current = series.sessions[Math.min(replayIndex, Math.max(0, series.sessions.length - 1))]
  const { figures } = detail
  const drawers = visibleDrawers(detail.integrity.agreement)
  const activeDrawer = drawers.includes(drawer) ? drawer : drawers[0]
  const hasMark = hasObservedMark(detail.earlierMarks)
  const underlyingMark = underlyingSeries.sessions.find(
    s => s.status === 'Available' && s.price !== undefined,
  )
  const values = [
    detail.stopsAndTargets.stop, detail.stopsAndTargets.target,
    detail.todayAgainst.entry, detail.todayAgainst.previous, detail.todayAgainst.current,
  ]
  const bounds = trackBounds(values)
  const num = (v?: string) => v === undefined || v === '' ? undefined : Number(v)
  const counts: Record<Drawer, number> = {
    Today: series.sessions.length,
    Position: detail.positionAndPlan.lots.length,
    'Plan and Risk': 0,
    'Price History': detail.earlierMarks.length,
    Journal: detail.journal.length,
    Payoff: detail.payoff.kind === 'Value' ? 1 : 0,
  }
  const integrityLabel = detail.integrity.agreement ? 'Agreement' : `Findings: ${detail.integrity.findings.join(', ')}`

  return (
    <section aria-label="Complete Trade Detail" data-testid="complete-detail" className="card">
      <p className="section-label">Complete Trade Detail</p>
      <div className="cockpit">
        {!detail.integrity.agreement && (
          <div className="c-banner" role="region" aria-label="Facts can't be replayed">
            <h3>Facts can&apos;t be replayed</h3>
            <p>Viewing this Trade does not change its records.</p>
            <p data-testid="detail-integrity">{integrityLabel}</p>
          </div>
        )}

        <aside className="c-rail" aria-label="State of play">
          <div className="card">
            <h4>Identity</h4>
            <p data-testid="detail-identity">
              {detail.identity.underlying} · {detail.identity.strategy} · {detail.identity.lifecycle} · revision {detail.identity.revision}
            </p>
            <span className="badge badge-open">{detail.identity.strategy}, {detail.identity.lifecycle}</span>
            <h4>Integrity</h4>
            <p data-testid="detail-integrity">{integrityLabel}</p>
          </div>
          <div className="card">
            <div className="c-pnl">{figures.realizedR}R</div>
            <p className="small">{hasMark ? `Since last Mark: ${detail.todayAgainst.current}` : 'No Mark yet'}</p>
            <p className="small muted">
              {detail.positionAndPlan.positions[0]?.netQuantity ?? '0'} open · {detail.positionAndPlan.lots.length} lots
            </p>
            {detail.integrity.agreement ? (
              <div className="figure-grid" data-testid="detail-figures">
                {figure('Planned Leg Fulfillment', figures.plannedLegFulfillment)}
                {figure('Entry Quality', figures.entryQuality)}
                {figure('Realized R', figures.realizedR)}
                {figure('Plan conformance', figures.planConformance)}
                {figure('Coverage', figures.coverage)}
                {figure('Deviation categories', Object.entries(figures.deviations)
                  .map(([name, count]) => {
                    const labels: Record<string, string> = {
                      plannedLegTerms: 'PlannedLegTerms', entrySize: 'EntrySize',
                      unplannedExposure: 'UnplannedExposure', stopDiscipline: 'StopDiscipline',
                    }
                    return `${labels[name] ?? name} ${count}`
                  }).join(' · '))}
              </div>
            ) : (
              <p data-testid="figures-unavailable">Figures unavailable — facts can&apos;t be replayed.</p>
            )}
            {detail.integrity.agreement && (
              <>
                <p data-testid="detail-payoff">
                  {detail.payoff.kind === 'Value' ? 'Available' : `${detail.payoff.kind}: ${'reason' in detail.payoff ? detail.payoff.reason : ''}`}
                </p>
                {detail.payoff.kind === 'Value' && (
                  <p data-testid="detail-payoff-break-even">
                    Break-even: {detail.payoff.value.breakEven.join(', ') || '—'}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="card">
            <h3 className="sec-title">Conditions</h3>
            <h4>Stops and Targets</h4>
            <ul className="c-conds">
              <li><span className="badge b-stop">Stop</span><span className="what">{detail.stopsAndTargets.stop}</span></li>
              <li><span className="badge b-target">Target</span><span className="what">{detail.stopsAndTargets.target}</span></li>
            </ul>
            {underlyingMark && (
              <p className="small">Underlying Mark: {underlyingMark.price} on {underlyingMark.date}</p>
            )}
            <div className="tracks">
              <Track title="Option price" bounds={bounds} entry={num(detail.todayAgainst.entry)} previous={hasMark ? num(detail.todayAgainst.previous) : undefined} current={hasMark ? num(detail.todayAgainst.current) : undefined} />
              <Track title="Underlying" bounds={trackBounds([])} note={underlyingMark ? undefined : 'Underlying Mark is not available in this view.'} />
            </div>
          </div>
          <div className="card">
            <h3 className="sec-title">Needs you</h3>
            <ul className="todo" aria-label="Needs you">
              {detail.needsYou.length === 0
                ? <li>Nothing outstanding</li>
                : detail.needsYou.map(key => <li key={key}>{key}</li>)}
            </ul>
          </div>
        </aside>

        <section>
          <div className="drawer-tabs" role="tablist" aria-label="Detail">
            {drawers.map(name => (
              <button
                key={name}
                type="button"
                role="tab"
                id={`dt-${name.replace(/\W/g, '')}`}
                aria-selected={activeDrawer === name}
                aria-controls="drawer"
                onClick={() => setDrawer(name)}
              >{name}{counts[name] > 0 && <span className="count">{counts[name]}</span>}</button>
            ))}
          </div>
          <div className="card" id="drawer" role="tabpanel" aria-labelledby={`dt-${activeDrawer.replace(/\W/g, '')}`}>
            {activeDrawer === 'Today' && (
              <>
                <h3 className="sec-title">Today against yesterday/entry</h3>
                {hasMark ? (
                  <ComparisonTable detail={detail} />
                ) : (
                  <p className="waiting">No Marks yet. The first Marks are due once today&apos;s session ends. The entry price is a plan term, not an observed Mark.</p>
                )}
                <div className="tracks">
                  <Track title="Option price" bounds={bounds} entry={num(detail.todayAgainst.entry)} previous={hasMark ? num(detail.todayAgainst.previous) : undefined} current={hasMark ? num(detail.todayAgainst.current) : undefined} />
                  <Track title="Underlying" bounds={trackBounds([])} note="Underlying Mark is not available in this view." />
                </div>
              </>
            )}
            {activeDrawer === 'Position' && (
              <>
                <h3 className="sec-title">Position and Plan/entry</h3>
                <table className="lots">
                  <thead><tr><th>Open lot</th><th>Quantity</th><th>Basis</th><th>Fee left</th></tr></thead>
                  <tbody>
                    {detail.positionAndPlan.lots.map(lot => (
                      <tr key={lot.id}>
                        <td>{lot.instrument}</td><td>{lot.quantity}</td><td>{lot.basis}</td><td>{lot.allocatedOpeningFee}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h4>Executions</h4>
                <ol className="journal">
                  {detail.positionAndPlan.executions.map(exec => (
                    <li key={exec.id}>{exec.economicTime} · {exec.action} {exec.instrument} {exec.quantity} @ {exec.price}, fee {exec.fee}</li>
                  ))}
                </ol>
                <p>Net {detail.positionAndPlan.positions[0]?.netQuantity ?? '0'} · {detail.positionAndPlan.lots.length} lots · {detail.positionAndPlan.executions.length} executions</p>
              </>
            )}
            {activeDrawer === 'Plan and Risk' && (
              <>
                <h3 className="sec-title">Plan and Risk</h3>
                <div className="kv-group">
                  <h4>Plan, set {detail.identity.revision}</h4>
                  <dl className="kv">
                    <dt>Contract</dt><dd>{detail.identity.underlying} · {detail.identity.strategy}</dd>
                    <dt>Intended entry</dt><dd>{detail.positionAndPlan.plan.entry}</dd>
                    <dt>Stop</dt><dd>{detail.positionAndPlan.plan.stop}</dd>
                    <dt>Target</dt><dd>{detail.positionAndPlan.plan.target}</dd>
                  </dl>
                </div>
                <div className="kv-group">
                  <h4>Entry, resolved</h4>
                  <dl className="kv">
                    {detail.positionAndPlan.executions.length === 0 ? (
                      <><dt>Fill</dt><dd>Not entered</dd></>
                    ) : detail.positionAndPlan.executions.map(exec => (
                      <Fragment key={exec.id}>
                        <dt>{exec.action} {exec.instrument}</dt><dd>{exec.quantity} @ {exec.price}, fee {exec.fee}</dd>
                      </Fragment>
                    ))}
                    <dt>Size</dt><dd>{detail.positionAndPlan.positions[0]?.netQuantity ?? '0'}</dd>
                    <dt>Realized R</dt><dd>{figures.realizedR}</dd>
                  </dl>
                </div>
              </>
            )}
            {activeDrawer === 'Price History' && (
              <>
                <h3 className="sec-title">Earlier Marks</h3>
                <div className="history-scroll">
                  <table className="history-grid" data-testid="earlier-marks">
                    <thead>
                      <tr>
                        <th scope="col" />
                        {[...detail.earlierMarks].reverse().map(session => (
                          <th key={session.date} scope="col">{session.date}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Underlying Mark</th>
                        {[...underlyingSeries.sessions].reverse().map(session => (
                          <td key={session.date}>{session.status === 'Available' ? session.price : '—'}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Call Mark</th>
                        {[...detail.earlierMarks].reverse().map(session => (
                          <td key={session.date}>{session.status === 'Available' ? session.price : '—'}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Status</th>
                        {[...detail.earlierMarks].reverse().map(session => (
                          <td key={session.date}>{session.status}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Trade P&amp;L</th>
                        {detail.earlierMarks.map(session => <td key={session.date}>—</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <button type="button" className="detail-link" onClick={onOpenReview}>Enter Marks in the Review</button>
              </>
            )}
            {activeDrawer === 'Journal' && (
              <>
                <h3 className="sec-title">Journal narrative</h3>
                <ul className="detail-list" data-testid="complete-journal">
                  {detail.journal.length === 0
                    ? <li>No journal entries yet.</li>
                    : detail.journal.map(item => (
                      <li key={item.id}>{item.obligationKey} · {item.kind} · {item.source}</li>
                    ))}
                </ul>
                <h3 className="sec-title">Session timeline</h3>
                <SessionRail series={series} index={replayIndex} onSelect={onSelectReplay} />
                <ul className="detail-list" data-testid="session-timeline">
                  {series.sessions.map(session => (
                    <li key={session.date} data-gap={session.gap}>
                      <span>{session.date}</span>
                      <span>{session.gap ? `gap · ${session.status}` : session.price}</span>
                      {session.keyMoments.length > 0 && <span className="muted">{session.keyMoments.join(', ')}</span>}
                    </li>
                  ))}
                </ul>
                <input
                  aria-label="Replay session" data-testid="replay-slider" type="range"
                  min={0} max={Math.max(0, series.sessions.length - 1)} value={replayIndex}
                  onChange={e => onSelectReplay(Number(e.target.value))}
                />
                <p data-testid="replay-session">{current?.date ?? 'No sessions'} · {current?.gap ? `gap · ${current.status}` : current?.price ?? '—'}</p>
              </>
            )}
            {activeDrawer === 'Payoff' && (
              <>
                <h3 className="sec-title">Payoff at expiration</h3>
                <PayoffChart detail={detail} />
              </>
            )}
          </div>
          <div className="detail-footer">
            {detail.integrity.agreement
              ? `${figures.plannedLegFulfillment} · ${figures.entryQuality} · ${figures.planConformance}`
              : 'Figures unavailable — facts can’t be replayed.'}
          </div>
        </section>
      </div>
      {advisory && (
        <div data-testid="advisory-explanation" className="advisory-block">
          <p>Advisory implied volatility: {advisory.iv?.kind === 'Value'
            ? advisory.iv.vol.toFixed(4)
            : advisory.iv?.kind === 'Unavailable' ? advisory.iv.reason : 'Not available'}</p>
          <p>Share equivalent: {advisory.shareEquivalent?.kind === 'Value'
            ? advisory.shareEquivalent.shares
            : advisory.shareEquivalent?.kind === 'Unavailable' ? advisory.shareEquivalent.reason : 'Not available'}</p>
          {advisory.decomposition?.kind === 'Value' ? (
            <ul className="detail-list">
              <li>Estimate · Underlying {advisory.decomposition.fromUnderlying.toFixed(2)}</li>
              <li>Estimate · Time {advisory.decomposition.fromTime.toFixed(2)}</li>
              <li>Estimate · Volatility {advisory.decomposition.fromVolatility.toFixed(2)}</li>
            </ul>
          ) : (
            <p>{advisory.decomposition?.kind === 'Unavailable' ? advisory.decomposition.reason : 'Not available'}</p>
          )}
          <p className="muted">Estimate only. Never used for valuation, risk or the expiration payoff.</p>
        </div>
      )}
    </section>
  )
}
