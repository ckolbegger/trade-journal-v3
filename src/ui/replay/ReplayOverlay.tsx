import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { toMoneyString } from '../../shared/exact-number';
import type { ReplaySessionPoint } from '../../trade-analysis/replay';
import type { TradeReplayView } from '../../trade-views/trade-views';
import styles from '../shell/AppShell.module.css';
import { CorridorChart } from './CorridorChart';
import rpStyles from './Replay.module.css';
import { useModalDialog } from './useModalDialog';

interface ReplayOverlayProps {
  readonly view: TradeReplayView;
  readonly returnLabel: string;
  readonly onClose: () => void;
  readonly onOpenPriceHistory?: (tradeId: string) => void;
}

function buildHeroLine(session: ReplaySessionPoint): string {
  if (!session.hasEntered) {
    return 'Not entered yet.';
  }
  if (session.isClosed) {
    return 'Closed. Nothing held.';
  }
  if (session.standing === 'Oversold') {
    return 'Position oversold (derived integrity block).';
  }
  if (session.inProgress) {
    return "Session still open — waiting for today's close.";
  }
  if (session.totalPnl === null) {
    return session.unavailableAcknowledged
      ? 'No price for this session (acknowledged Unavailable).'
      : 'A Mark is missing for this session.';
  }
  if (session.standing === 'PastStop') {
    return session.stopOverrun && session.stopOverrun.num > 0n
      ? `Past the Stop by ${session.stopOverrunDisplay}.`
      : 'At the Stop.';
  }
  if (session.standing === 'AtTarget') {
    return session.targetOverrun && session.targetOverrun.num > 0n
      ? `Target reached, ${session.targetOverrunDisplay} past it.`
      : 'At the Target.';
  }
  if (session.standing === 'InsideStop' && session.standingPct !== null) {
    return `${session.standingPct}% of the way to the Stop.`;
  }
  if (session.standing === 'InsideTarget' && session.standingPct !== null) {
    return `${session.standingPct}% of the way to the Target.`;
  }
  return '';
}

function formatHeroFallbackFigure(session: ReplaySessionPoint): string {
  if (session.inProgress) return 'Market open';
  if (session.mark !== null) return 'Unavailable';
  return 'No Mark';
}

function buildStakeSentence(session: ReplaySessionPoint): string | null {
  if (session.isClosed || session.totalPnl === null) {
    return null;
  }
  if (session.standing === 'PastStop') {
    const pastClause =
      session.stopOverrun && session.stopOverrun.num > 0n && session.stopOverrunDisplay
        ? `already ${session.stopOverrunDisplay} past the Stop`
        : 'at the Stop';
    return `From here: ${pastClause}. Each $1.00 lower costs ${toMoneyString(session.openShares)} more.`;
  }
  const parts: string[] = [];
  if (session.riskToStopDisplay) {
    parts.push(`${session.riskToStopDisplay} at risk to the Stop`);
  }
  if (session.rewardToTargetDisplay) {
    parts.push(`${session.rewardToTargetDisplay} to gain to the Target`);
  }
  return parts.length > 0 ? `From here: ${parts.join(', ')}.` : null;
}

function getHeroToneClass(session: ReplaySessionPoint): string {
  if (session.totalPnl === null) return '';
  if (session.totalPnl.num > 0n) return rpStyles.heroUp ?? '';
  if (session.totalPnl.num < 0n) return rpStyles.heroDown ?? '';
  return '';
}

function getHeroFigureClass(session: ReplaySessionPoint): string {
  if (session.totalPnl === null) return styles.muted ?? '';
  if (session.totalPnl.num > 0n) return rpStyles.up ?? '';
  if (session.totalPnl.num < 0n) return rpStyles.down ?? '';
  return '';
}

function formatStopReadoutCell(session: ReplaySessionPoint): string {
  if (session.stopStatus === 'Breached') {
    return session.stopOverrun && session.stopOverrun.num > 0n && session.stopOverrunDisplay
      ? `${session.stopOverrunDisplay} past Stop`
      : 'At Stop';
  }
  if (session.riskToStopDisplay) {
    return `${session.riskToStopDisplay} to Stop`;
  }
  return session.atStopPnlDisplay ?? '—';
}

function formatTargetReadoutCell(session: ReplaySessionPoint): string {
  if (session.targetStatus === 'Reached') {
    return session.targetOverrun && session.targetOverrun.num > 0n && session.targetOverrunDisplay
      ? `${session.targetOverrunDisplay} past Target`
      : 'At Target';
  }
  if (session.rewardToTargetDisplay) {
    return `${session.rewardToTargetDisplay} to Target`;
  }
  return session.atTargetPnlDisplay ?? '—';
}

function renderActionReadout(session: ReplaySessionPoint) {
  const act = session.reviewAction;
  switch (act.kind) {
    case 'Hold':
    case 'Exit':
      return (
        <p className={rpStyles.readoutLine}>
          Action: <strong>{act.kind}</strong>
          {act.reason ? (
            <> · &ldquo;{act.reason}&rdquo;</>
          ) : (
            <span className={styles.muted}> · no reason given</span>
          )}
          {act.conviction ? ` · Conviction ${act.conviction}/5` : ''}
        </p>
      );
    case 'NoReview':
      return <p className={`${rpStyles.amber} ${rpStyles.readoutLine}`}>No Review this session.</p>;
    case 'Pending':
      return <p className={`${styles.muted} ${rpStyles.readoutLine}`}>Action: not chosen yet.</p>;
    case 'Closed':
      if (session.executionsToday.length > 0) return null;
      return <p className={`${styles.muted} ${rpStyles.readoutLine}`}>Nothing recorded.</p>;
  }
}

function formatActionCell(session: ReplaySessionPoint): string {
  switch (session.reviewAction.kind) {
    case 'Hold':
      return 'Hold';
    case 'Exit':
      return 'Exit';
    case 'NoReview':
      return 'No Review';
    case 'Closed':
      return 'Closed';
    case 'Pending':
      return '—';
  }
}

export function ReplayOverlay({
  view,
  returnLabel,
  onClose,
  onOpenPriceHistory,
}: ReplayOverlayProps) {
  const { replay, trade } = view;
  const uid = useId().replace(/:/g, '');
  const momentsId = `replay-moments-${uid}`;
  const sliderId = `replay-slider-${uid}`;
  const maxIdx = replay.sessions.length - 1;
  const [selectedIndex, setSelectedIndex] = useState<number>(() => replay.initialSelectedIndex);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const prevBtnRef = useRef<HTMLButtonElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const pendingStepFocusRef = useRef<'prev' | 'next' | null>(null);

  useEffect(() => {
    setSelectedIndex(replay.initialSelectedIndex);
  }, [replay.tradeId, replay.initialSelectedIndex]);

  useModalDialog({
    dialogRef,
    initialFocusRef: sliderRef,
    onClose,
    focusKey: replay.tradeId,
  });

  const clampIndex = useCallback(
    (idx: number) => Math.max(0, Math.min(maxIdx, idx)),
    [maxIdx],
  );

  useEffect(() => {
    const pending = pendingStepFocusRef.current;
    if (!pending) return;
    pendingStepFocusRef.current = null;
    const currentIdx = clampIndex(selectedIndex);
    if (pending === 'next' && currentIdx <= 0) {
      if (maxIdx > 0 && nextBtnRef.current) {
        nextBtnRef.current.focus();
      } else {
        sliderRef.current?.focus();
      }
    } else if (pending === 'prev' && currentIdx >= maxIdx) {
      if (maxIdx > 0 && prevBtnRef.current) {
        prevBtnRef.current.focus();
      } else {
        sliderRef.current?.focus();
      }
    }
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIndex((cur) => clampIndex(cur - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIndex((cur) => clampIndex(cur + 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setSelectedIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setSelectedIndex(maxIdx);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clampIndex, maxIdx]);

  const session = replay.sessions[clampIndex(selectedIndex)] ?? replay.sessions[0]!;
  const activeMomentIdx = replay.keyMoments.findIndex((m) => m.sessionIndex === session.index);
  const activeMoment = activeMomentIdx >= 0 ? replay.keyMoments[activeMomentIdx]! : null;

  const headerPositionText = replay.isClosed
    ? (view.terminalDisposition ?? 'Closed')
    : `Long ${replay.sessions[maxIdx]?.openSharesDisplay ?? '0'} shares`;

  const heroToneClass = getHeroToneClass(session);
  const heroFigureClass = getHeroFigureClass(session);

  const stakeSentence = buildStakeSentence(session);
  const matchingEpisode = replay.stopDisciplineEpisodes.find(
    (ep) =>
      session.sessionDate >= ep.startSessionDate && session.sessionDate <= ep.endSessionDate,
  );

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className={rpStyles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Replay, ${replay.symbol}`}
    >
      <header className={rpStyles.overlayHeader}>
        <span className={rpStyles.overlayTitle}>
          Replay · {replay.symbol} · {headerPositionText}
        </span>
        <button type="button" className={styles.btnSecondary} onClick={onClose}>
          {returnLabel}
        </button>
      </header>

      <div className={rpStyles.overlayBody}>
        <div className={rpStyles.mainCol}>
          {/* Hero summary card */}
          <section className={`${styles.card} ${rpStyles.hero} ${heroToneClass} ${rpStyles.cardTight}`}>
            <div className={rpStyles.heroHeader}>
              <span className={rpStyles.heroDate}>{session.sessionDateShort}</span>
              <span className={`${rpStyles.heroFig} ${heroFigureClass}`}>
                {session.totalPnlDisplay
                  ? `${session.totalPnlDisplay}${session.totalPnlRDisplay ? ` · ${session.totalPnlRDisplay}` : ''}`
                  : formatHeroFallbackFigure(session)}
              </span>
            </div>
            <p className={rpStyles.heroLine}>{buildHeroLine(session)}</p>
            {stakeSentence && <p className={rpStyles.heroLine}>{stakeSentence}</p>}
          </section>

          {/* Corridor chart + controls */}
          <section className={`${styles.card} ${rpStyles.cardTight}`}>
            <div className={rpStyles.momentsRow}>
              <label htmlFor={momentsId} className={rpStyles.momentsLabel}>
                Key moments
              </label>
              <select
                id={momentsId}
                className={rpStyles.momentsSelect}
                value={activeMomentIdx >= 0 ? String(activeMomentIdx) : ''}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  const km = replay.keyMoments[idx];
                  if (km) {
                    setSelectedIndex(km.sessionIndex);
                  }
                }}
              >
                {activeMomentIdx < 0 && <option value="">Choose a moment</option>}
                {replay.keyMoments.map((m, idx) => (
                  <option key={`${m.sessionDate}-${idx}`} value={String(idx)}>
                    {idx + 1}. {m.label} · {m.sessionDateShort}
                  </option>
                ))}
              </select>
            </div>

            <p
              className={`${rpStyles.momentCallout} ${
                activeMoment ? '' : rpStyles.momentCalloutNone
              }`}
            >
              {activeMoment ? (
                <>
                  <strong>{activeMoment.sessionDateShort}.</strong> {activeMoment.text}
                </>
              ) : (
                'No key moment this session.'
              )}
            </p>

            <div className={rpStyles.scrubRow}>
              <button
                ref={prevBtnRef}
                type="button"
                className={rpStyles.stepBtn}
                aria-label="Earlier session"
                disabled={session.index <= 0}
                onClick={() => {
                  const nextIdx = clampIndex(session.index - 1);
                  if (nextIdx <= 0) pendingStepFocusRef.current = 'next';
                  setSelectedIndex(nextIdx);
                }}
              >
                ‹
              </button>
              <input
                ref={sliderRef}
                id={sliderId}
                type="range"
                className={rpStyles.slider}
                min={0}
                max={maxIdx}
                step={1}
                value={session.index}
                aria-label="Session shown"
                aria-valuetext={`${session.sessionDateShort}, ${session.index + 1} of ${replay.sessions.length}`}
                onChange={(e) => setSelectedIndex(clampIndex(Number(e.target.value)))}
              />
              <button
                ref={nextBtnRef}
                type="button"
                className={rpStyles.stepBtn}
                aria-label="Later session"
                disabled={session.index >= maxIdx}
                onClick={() => {
                  const nextIdx = clampIndex(session.index + 1);
                  if (nextIdx >= maxIdx) pendingStepFocusRef.current = 'prev';
                  setSelectedIndex(nextIdx);
                }}
              >
                ›
              </button>
              <span className={rpStyles.when}>
                {session.sessionDateShort} · {session.index + 1} of {replay.sessions.length}
              </span>
            </div>

            <CorridorChart
              model={replay}
              selectedIndex={session.index}
              onSelectIndex={(idx) => setSelectedIndex(clampIndex(idx))}
            />

            <div className={rpStyles.legend}>
              <span className={rpStyles.legendItem}>
                <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true">
                  <rect x="1" y="1" width="14" height="9" fill="#c2e2c9" />
                  <path d="M1 1H15" stroke="#1d6b34" strokeWidth="2" />
                </svg>
                Open profit
              </span>
              <span className={rpStyles.legendItem}>
                <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true">
                  <rect x="1" y="1" width="14" height="9" fill="#f2c6c0" />
                  <path d="M1 10H15" stroke="#a3261b" strokeWidth="2" />
                </svg>
                Open loss
              </span>
              <span className={rpStyles.legendItem}>
                <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true">
                  <rect x="1" y="1" width="14" height="9" fill="#1d6b34" />
                </svg>
                Banked
              </span>
              <span className={rpStyles.legendItem}>
                <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true">
                  <defs>
                    <pattern id={`leg-hat-${uid}`} width="5" height="5" patternUnits="userSpaceOnUse">
                      <rect width="5" height="5" fill="#f2c6c0" />
                      <path d="M0 0L5 5M5 0L0 5" stroke="#a3261b" strokeWidth="1.1" />
                    </pattern>
                  </defs>
                  <rect x="1" y="1" width="14" height="9" fill={`url(#leg-hat-${uid})`} stroke="#a3261b" />
                </svg>
                Overrun past line
              </span>
              <span className={rpStyles.legendItem}>
                <svg width="18" height="11" viewBox="0 0 18 11" aria-hidden="true">
                  <path d="M0 5.5H18" stroke="#a3261b" strokeWidth="1.5" strokeDasharray="5 3" />
                </svg>
                Stop rail
              </span>
              <span className={rpStyles.legendItem}>
                <svg width="18" height="11" viewBox="0 0 18 11" aria-hidden="true">
                  <path d="M0 5.5H18" stroke="#1d6b34" strokeWidth="1.5" strokeDasharray="2 3" />
                </svg>
                Target rail
              </span>
              <span className={rpStyles.legendItem}>▲ execution</span>
              <span className={rpStyles.legendItem}>
                Action row: H Hold · E Exit · – No Review
              </span>
            </div>
          </section>

          {/* Expandable accessible session table */}
          <section className={`${styles.card} ${rpStyles.cardTight}`}>
            <details className={rpStyles.fold}>
              <summary>
                Accessible session table{' '}
                <span className={styles.muted}>
                  ({replay.sessions.length} {replay.sessions.length === 1 ? 'session' : 'sessions'})
                </span>
              </summary>
              <div className={rpStyles.scrollX}>
                <table className={rpStyles.sessionTable} aria-label="Replay sessions">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>{replay.symbol} Mark</th>
                      <th>Executions</th>
                      <th>Action</th>
                      <th>Held</th>
                      <th>Realized</th>
                      <th>Open</th>
                      <th>Trade P&amp;L</th>
                      <th>At Stop</th>
                      <th>At Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {replay.sessions.map((row) => {
                      const isSel = row.index === session.index;
                      const execSummary =
                        row.executionsToday.length > 0
                          ? row.executionsToday
                              .map((ex) => `${ex.side} ${ex.quantityDisplay} @ ${ex.fillPriceDisplay}`)
                              .join('; ')
                          : '—';
                      return (
                        <tr key={row.sessionDate} className={isSel ? rpStyles.rowActive : undefined}>
                          <td>
                            <button
                              type="button"
                              className={rpStyles.rowJumpBtn}
                              onClick={() => setSelectedIndex(row.index)}
                            >
                              {row.sessionDateShort}
                            </button>
                          </td>
                          <td>{row.markDisplay ?? (row.inProgress ? 'Market open' : 'No Mark')}</td>
                          <td>{execSummary}</td>
                          <td>{formatActionCell(row)}</td>
                          <td>{row.openSharesDisplay}</td>
                          <td>{row.realizedPnlDisplay}</td>
                          <td>{row.openPnlDisplay ?? 'Unavailable'}</td>
                          <td>{row.totalPnlDisplay ?? 'Unavailable'}</td>
                          <td>{row.atStopPnlDisplay ?? '—'}</td>
                          <td>{row.atTargetPnlDisplay ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {onOpenPriceHistory && (
                <div className={rpStyles.tableActions}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => onOpenPriceHistory(trade.id)}
                  >
                    Open Price History in Trade Detail
                  </button>
                </div>
              )}
            </details>
          </section>
        </div>

        {/* Sticky right readout column */}
        <aside className={`${styles.card} ${rpStyles.readout}`} aria-label="Session readout">
          <h2 className={`${rpStyles.readoutHeading} ${rpStyles.readoutHeadingFirst}`}>
            What you did that day
          </h2>
          {session.executionsToday.length > 0 && (
            <p className={rpStyles.readoutLineBold}>
              {session.executionsToday
                .map((ex) => `${ex.side === 'Buy' ? 'Bought' : 'Sold'} ${ex.quantityDisplay} at ${ex.fillPriceDisplay}`)
                .join('. ')}
              .
            </p>
          )}
          {renderActionReadout(session)}

          {matchingEpisode && (
            <div className={`${styles.alertError} ${rpStyles.episodeAlert}`}>
              <strong>StopDiscipline:</strong> {matchingEpisode.message}
            </div>
          )}

          <h2 className={rpStyles.readoutHeading}>How it stood</h2>
          <dl className={rpStyles.kv}>
            <dt>Trade P&amp;L</dt>
            <dd className={heroFigureClass}>
              {session.totalPnlDisplay
                ? `${session.totalPnlDisplay}${session.totalPnlRDisplay ? ` · ${session.totalPnlRDisplay}` : ''}`
                : 'Unavailable'}
            </dd>
            {session.changeSincePriorPnlDisplay && session.priorMarkedSessionDateShort && (
              <dd className={rpStyles.kvSub}>
                {session.changeSincePriorPnlDisplay} since {session.priorMarkedSessionDateShort}
              </dd>
            )}
            <dt>Realized</dt>
            <dd>{session.realizedPnlDisplay}</dd>
            <dt>Open</dt>
            <dd>{session.openPnlDisplay ?? 'Unavailable'}</dd>
            <dt>{replay.symbol} Mark</dt>
            <dd>{session.markDisplay ?? (session.inProgress ? 'Market open' : 'No Mark')}</dd>
            <dt>Held</dt>
            <dd>
              {session.openSharesDisplay} of {replay.plannedQuantityDisplay} shares
            </dd>
            {!session.isClosed && (
              <>
                <dt>Stop ({replay.stopPriceDisplay})</dt>
                <dd className={session.stopStatus === 'Breached' ? rpStyles.down : ''}>
                  {formatStopReadoutCell(session)}
                </dd>
                <dt>Target ({replay.targetPriceDisplay})</dt>
                <dd className={session.targetStatus === 'Reached' ? rpStyles.up : ''}>
                  {formatTargetReadoutCell(session)}
                </dd>
              </>
            )}
            {replay.isClosed && view.closeReasonLabel && (
              <>
                <dt>Close Reason</dt>
                <dd>{view.closeReasonLabel}</dd>
              </>
            )}
          </dl>
        </aside>
      </div>
    </div>
  );
}
