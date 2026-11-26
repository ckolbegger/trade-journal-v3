import type { LoadedDetail } from './detail-controller'

type Props = {
  loaded: LoadedDetail
  replayIndex: number
  onSelectReplay: (index: number) => void
}

function figure(label: string, value: string, testId?: string) {
  return (
    <div key={label}>
      <p className="section-label">{label}</p>
      <p className="figure-value" {...(testId ? { 'data-testid': testId } : {})}>{value}</p>
    </div>
  )
}

export function CompleteDetailView({ loaded, replayIndex, onSelectReplay }: Props) {
  if (loaded.status !== 'Ready') return <p role="status">Trade not found.</p>
  const { detail, series, advisory } = loaded
  const current = series.sessions[Math.min(replayIndex, Math.max(0, series.sessions.length - 1))]
  const { figures } = detail

  return (
    <section aria-label="Complete Trade Detail" data-testid="complete-detail" className="card">
      <p className="section-label">Complete Trade Detail</p>
      <h4>Identity</h4>
      <p data-testid="detail-identity">
        {detail.identity.underlying} · {detail.identity.strategy} · {detail.identity.lifecycle} · revision {detail.identity.revision}
      </p>

      <h4>Today against yesterday/entry</h4>
      <p>Entry {detail.todayAgainst.entry} · previous {detail.todayAgainst.previous} · current {detail.todayAgainst.current}</p>

      <h4>Stops and Targets</h4>
      <p>Stop {detail.stopsAndTargets.stop} · Target {detail.stopsAndTargets.target}</p>

      <h4>Position and Plan/entry</h4>
      <p>Net {detail.positionAndPlan.positions[0]?.netQuantity ?? '0'} · {detail.positionAndPlan.lots.length} lots · {detail.positionAndPlan.executions.length} executions</p>

      <h4>Payoff at expiration</h4>
      <p data-testid="detail-payoff">{detail.payoff.kind === 'Value' ? 'Available' : `${detail.payoff.kind}: ${'reason' in detail.payoff ? detail.payoff.reason : ''}`}</p>
      {detail.payoff.kind === 'Value' && (
        <>
          <p data-testid="detail-payoff-break-even">Break-even: {detail.payoff.value.breakEven.join(', ') || '—'}</p>
          <ul className="detail-list">
            {detail.payoff.value.extrema.map((e, index) => (
              <li key={index}>{e.kind}: {e.value} on {e.attainedOn}</li>
            ))}
          </ul>
        </>
      )}

      <div className="figure-grid" data-testid="detail-figures">
        {figure('Planned Leg Fulfillment', figures.plannedLegFulfillment)}
        {figure('Entry Quality', figures.entryQuality)}
        {figure('Realized R', figures.realizedR)}
        {figure('Plan conformance', figures.planConformance)}
        {figure('Coverage', figures.coverage)}
        {figure('Deviation categories', Object.entries(figures.deviations).map(([name, count]) => {
          const labels: Record<string, string> = {
            plannedLegTerms: 'PlannedLegTerms', entrySize: 'EntrySize',
            unplannedExposure: 'UnplannedExposure', stopDiscipline: 'StopDiscipline',
          }
          return `${labels[name] ?? name} ${count}`
        }).join(' · '))}
      </div>

      <h4>Earlier Marks</h4>
      <ul className="detail-list" data-testid="earlier-marks">
        {detail.earlierMarks.map(m => (
          <li key={m.date}>
            <span>{m.date}</span>
            <span>{m.status === 'Available' ? m.price : `gap · ${m.status}`}</span>
          </li>
        ))}
      </ul>

      <h4>Journal narrative</h4>
      <ul className="detail-list" data-testid="complete-journal">
        {detail.journal.map(item => (
          <li key={item.id}>{item.obligationKey} · {item.kind} · {item.source}</li>
        ))}
      </ul>

      <h4>Needs you</h4>
      <ul className="detail-list">
        {detail.needsYou.length === 0 ? <li>Nothing outstanding</li> : detail.needsYou.map(key => <li key={key}>{key}</li>)}
      </ul>

      <h4>Integrity</h4>
      <p data-testid="detail-integrity">{detail.integrity.agreement ? 'Agreement' : `Findings: ${detail.integrity.findings.join(', ')}`}</p>

      <h4>Session timeline</h4>
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
        aria-label="Replay session"
        data-testid="replay-slider"
        type="range"
        min={0}
        max={Math.max(0, series.sessions.length - 1)}
        value={replayIndex}
        onChange={e => onSelectReplay(Number(e.target.value))}
      />
      <p data-testid="replay-session">{current?.date ?? 'No sessions'} · {current?.gap ? `gap · ${current.status}` : current?.price ?? '—'}</p>

      <h4>Advisory explanation</h4>
      <div data-testid="advisory-explanation">
        <p>Advisory implied volatility: {advisory?.iv?.kind === 'Value'
          ? advisory.iv.vol.toFixed(4)
          : advisory?.iv?.kind === 'Unavailable' ? advisory.iv.reason : 'Not available'}</p>
        <p>Share equivalent: {advisory?.shareEquivalent?.kind === 'Value'
          ? advisory.shareEquivalent.shares
          : advisory?.shareEquivalent?.kind === 'Unavailable' ? advisory.shareEquivalent.reason : 'Not available'}</p>
        {advisory?.decomposition?.kind === 'Value' ? (
          <ul className="detail-list">
            <li>Estimate · Underlying {advisory.decomposition.fromUnderlying.toFixed(2)}</li>
            <li>Estimate · Time {advisory.decomposition.fromTime.toFixed(2)}</li>
            <li>Estimate · Volatility {advisory.decomposition.fromVolatility.toFixed(2)}</li>
          </ul>
        ) : (
          <p>{advisory?.decomposition?.kind === 'Unavailable'
            ? advisory.decomposition.reason : 'Not available'}</p>
        )}
        <p className="muted">Estimate only. Never used for valuation, risk or the expiration payoff.</p>
      </div>
    </section>
  )
}
