import { Fragment, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { IncoherentOpenTradeItem, IncoherentPlannedTradeItem, OpenTradeItem, PlannedTradeItem } from '../../app/types.ts';
import { PageTitle } from '../PageTitle.tsx';
import { Badge } from '../Badge.tsx';
import { TradeText } from '../TradeText.tsx';
import { pnlText } from '../figures.ts';
import { money, netCost, quantity, ratio, shortDate, tradeSummary } from '../format.ts';
import { useRuntime } from '../runtime.tsx';

export interface TradeListProps {
  readonly facade: UiFacade;
}

// Only the lifecycles this release can produce (A32); Open is the default.
const LIFECYCLES = ['Open', 'Planned'] as const;
type Lifecycle = (typeof LIFECYCLES)[number];

type ListState = { readonly kind: 'Loading' } | { readonly kind: 'Ready'; readonly items: readonly unknown[] } | { readonly kind: 'Error' };

// The Trades view: lifecycle tabs over one list each, with Loading, Ready, Empty, and Error kept
// distinct: never a false Empty while loading or after a failure. The selected tab lives in the
// URL, so it survives navigation to a Trade and back.
export function TradeList({ facade }: TradeListProps) {
  const [params, setParams] = useSearchParams();
  const lifecycle: Lifecycle = params.get('lifecycle') === 'Planned' ? 'Planned' : 'Open';
  // Every request gets its own key, so a result is shown only for the request that asked for it.
  // A tab switch is a navigation, which carries a fresh location key; Retry counts attempts.
  const navigation = useLocation().key;
  const [attempt, setAttempt] = useState(0);
  const key = `${lifecycle}:${navigation}:${attempt}`;
  const [settled, setSettled] = useState<{ readonly key: string; readonly state: ListState }>();

  useEffect(() => {
    let current = true;
    const settle = (state: ListState) => {
      if (current) setSettled({ key, state });
    };
    facade.TradeViewsAndReporting.browseTrades({ lifecycle }).then(
      (result) => settle(result.kind === 'Ready' ? { kind: 'Ready', items: result.view.items } : { kind: 'Error' }),
      () => settle({ kind: 'Error' }),
    );
    return () => {
      current = false;
    };
  }, [facade, lifecycle, key]);

  const state: ListState = settled?.key === key ? settled.state : { kind: 'Loading' };
  // Every switch asks again: a page shown earlier is never presented as current.
  const select = (next: Lifecycle) => setParams(next === 'Open' ? {} : { lifecycle: next }, { replace: true });
  // The tablist pattern: one tab stop, with the arrow, Home, and End keys moving between tabs.
  const moveBetweenTabs = (event: KeyboardEvent) => {
    const at = LIFECYCLES.indexOf(lifecycle);
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: LIFECYCLES.length - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    const next = LIFECYCLES[(to + LIFECYCLES.length) % LIFECYCLES.length]!;
    select(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <section>
      <PageTitle>Trades</PageTitle>
      <div role="tablist" aria-label="Trades by lifecycle" className="tabs" onKeyDown={moveBetweenTabs}>
        {LIFECYCLES.map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            id={`tab-${l}`}
            aria-selected={l === lifecycle}
            // Only the selected tab's panel is rendered, so only it is referenced.
            aria-controls={l === lifecycle ? `panel-${l}` : undefined}
            tabIndex={l === lifecycle ? 0 : -1}
            onClick={() => select(l)}
          >
            {l}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${lifecycle}`} aria-labelledby={`tab-${lifecycle}`}>
        {lifecycle === 'Open' ? (
          <OpenList state={state} retry={() => setAttempt((n) => n + 1)} showPlanned={() => select('Planned')} />
        ) : (
          <PlannedList state={state} retry={() => setAttempt((n) => n + 1)} />
        )}
      </div>
    </section>
  );
}

interface ListProps {
  readonly state: ListState;
  readonly retry: () => void;
}

// The benchmark (T2.21) times the complete Open list to `tj:open-list-ready`, and a cold start to
// `tj:interactive`: the first complete Open list while the runtime is Writable.
function markOpenListReady(writable: boolean) {
  performance.mark('tj:open-list-ready');
  if (writable && performance.getEntriesByName('tj:interactive', 'mark').length === 0) performance.mark('tj:interactive');
}

function OpenList({
  state,
  retry,
  showPlanned,
}: ListProps & {
  readonly showPlanned: () => void;
}) {
  const { writable } = useRuntime();
  useEffect(() => {
    if (state.kind === 'Ready') markOpenListReady(writable);
  }, [state, writable]);

  if (state.kind === 'Loading') return <p role="status">Loading open trades…</p>;
  if (state.kind === 'Error') {
    return (
      <section className="card">
        <p>We couldn’t load your open trades. Nothing was changed.</p>
        <button type="button" className="pill secondary" onClick={retry}>
          Retry
        </button>
      </section>
    );
  }
  const items = state.items as readonly (OpenTradeItem | IncoherentOpenTradeItem)[];
  if (items.length === 0) {
    return (
      <section className="card empty">
        <p>No open trades. Recording an entry on a Planned Trade opens it.</p>
        <button type="button" className="pill primary" onClick={showPlanned}>
          Show Planned Trades
        </button>
      </section>
    );
  }
  return (
    // The columns scroll inside their own focusable region on a narrow screen (Underlying pinned), never the page.
    <div className="table-scroll" role="region" aria-label="Open Trades" tabIndex={0}>
      <table className="trades">
        <caption>Open Trades</caption>
        <thead>
          <tr>
            <th scope="col">Underlying</th>
            <th scope="col">Trade</th>
            <th scope="col" className="number wide-only">
              Net cost
            </th>
            <th scope="col" className="number wide-only" aria-label="Current Marked Trade P&L">
              P&amp;L
            </th>
            <th scope="col">Entry</th>
            <th scope="col">Account</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            // Facts that cannot be replayed leave the Position and entry figures unavailable, never a number.
            const derived = 'openQuantity' in item ? item : undefined;
            return (
              <tr key={item.tradeId}>
                <td>
                  <Link to={`/trades/${item.tradeId}`}>{item.underlying}</Link>
                </td>
                <td>
                  <TradeCell
                    disagrees={item.integrity === 'Disagrees'}
                    text={derived?.summary ? tradeSummary(derived.summary) : NOT_AVAILABLE}
                    line={
                      <>
                        Net cost {derived && derived.netCost.kind === 'Value' ? netCost(derived.netCost.value) : NOT_AVAILABLE}
                        {derived && (
                          <>
                            {' · P&L '}
                            <Pnl current={derived.current} />
                          </>
                        )}
                      </>
                    }
                    badges={derived && <StatusBadges current={derived.current} />}
                  />
                </td>
                <td className="number wide-only">{derived && derived.netCost.kind === 'Value' ? netCost(derived.netCost.value) : NOT_AVAILABLE}</td>
                <td className="number wide-only">{derived ? <Pnl current={derived.current} /> : NOT_AVAILABLE}</td>
                <td>{derived ? `${derived.entryStatus} · ${quantity(derived.openQuantity)} of ${quantity(item.plannedQuantity)}` : NOT_AVAILABLE}</td>
                <td>{`${item.institution} — ${item.account}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const NOT_AVAILABLE = 'Not available';

type Current = OpenTradeItem['current'];

// The Instrument and date lacking an exact Mark; absent when the P&L has its Mark, the date is outside coverage (decision 54) or the reason is not a known one.
function missingMark(current: Current) {
  const pnl = current.currentMarkedPnl;
  return pnl.kind === 'Unavailable' && (pnl.reason === 'MarkMissing' || pnl.reason === 'AcknowledgedUnavailable') && 'date' in pnl.detail ? pnl.detail : undefined;
}

// Current Marked Trade P&L: the figure, or in its place the words for what is missing; the Mark missing
// words link to the Review's Marks family. The dated line's P&L follows, labelled with its date.
function Pnl({ current }: { readonly current: Current }) {
  const { currentMarkedPnl: pnl, currentMarkedPnlInPlanR: planR, datedLine } = current;
  const missing = missingMark(current);
  const text = pnlText(pnl, planR);
  return (
    <>
      {missing ? <Link to={`/review?instrument=${encodeURIComponent(missing.instrument.symbol)}`}>{text}</Link> : text}
      {datedLine && ` ${shortDate(datedLine.tradingDate)} close ${pnlText(datedLine.evaluation.currentMarkedPnl, datedLine.evaluation.currentMarkedPnlInPlanR)}`}
    </>
  );
}

// The Mark status and a crossed Stop or reached Target are said in text, at every width; an active condition says nothing.
function StatusBadges({ current }: { readonly current: Current }) {
  return (
    <>
      {current.currentMarkedPnl.kind === 'Unavailable' && current.currentMarkedPnl.reason === 'MarkMissing' && (
        <>
          {' '}
          <Badge tone="warning">Mark missing</Badge>
        </>
      )}
      {current.conditions.map((c) => {
        if (c.result.kind !== 'Value') return null;
        const { status } = c.result.value;
        const badge = c.role === 'Stop' && status === 'Breached' ? <Badge tone="warning">Stop breached</Badge> : c.role === 'Target' && status === 'Reached' ? <Badge tone="info">Target reached</Badge> : null;
        return (
          badge && (
            <Fragment key={c.id}>
              {' '}
              {badge}
            </Fragment>
          )
        );
      })}
    </>
  );
}

// The Trade cell: the summary text, then on a narrow screen a second line with the figures whose
// columns are hidden there (plan section 2a). The wide layout hides the line instead.
function TradeCell({
  text,
  disagrees,
  line,
  badges,
}: {
  readonly text: string;
  readonly disagrees: boolean;
  readonly line: ReactNode;
  readonly badges?: ReactNode;
}) {
  return (
    <>
      <TradeText text={text} />
      {/* Text, not colour alone, carries the meaning; an agreeing row shows nothing. The spaces keep
          the cell's text and accessible name from running the parts together. */}
      {disagrees && (
        <>
          {' '}
          <Badge tone="warning">Records disagree</Badge>
        </>
      )}
      {line && (
        <>
          {' '}
          <span className="trade-line">{line}</span>
        </>
      )}
      {badges}
    </>
  );
}

function PlannedList({ state, retry }: ListProps) {
  if (state.kind === 'Loading') return <p role="status">Loading planned trades…</p>;
  if (state.kind === 'Error') {
    return (
      <section className="card">
        <p>We couldn’t load your planned trades. Nothing was changed.</p>
        <button type="button" className="pill secondary" onClick={retry}>
          Retry
        </button>
      </section>
    );
  }
  const items = state.items as readonly (PlannedTradeItem | IncoherentPlannedTradeItem)[];
  if (items.length === 0) {
    return (
      <section className="card empty">
        <p>No planned trades yet. Start by planning one before you enter it.</p>
        <Link className="pill primary" to="/plans/new">
          New Plan
        </Link>
      </section>
    );
  }
  return (
    // The columns scroll inside their own focusable region on a narrow screen (Underlying pinned), never the page.
    <div className="table-scroll" role="region" aria-label="Planned Trades" tabIndex={0}>
      <table className="trades">
        <caption>Planned Trades</caption>
        <thead>
          <tr>
            <th scope="col">Underlying</th>
            <th scope="col">Trade</th>
            <th scope="col" className="number wide-only">
              1R
            </th>
            <th scope="col" className="number wide-only">
              Reward : risk
            </th>
            <th scope="col">Entry</th>
            <th scope="col">Account</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            // Facts that cannot be replayed leave the Baseline figures and entry readiness not available, never a number.
            const derived = 'oneR' in item ? item : undefined;
            return (
              <tr key={item.tradeId}>
                <td>
                  <Link to={`/trades/${item.tradeId}`}>{item.underlying}</Link>
                </td>
                <td>
                  <TradeCell
                    disagrees={item.integrity === 'Disagrees'}
                    text={derived ? tradeSummary(derived.summary) : NOT_AVAILABLE}
                    line={`1R ${derived ? money(derived.oneR) : NOT_AVAILABLE} · Reward : risk ${derived ? ratio(derived.rewardRiskRatio) : NOT_AVAILABLE}`}
                  />
                </td>
                <td className="number wide-only">{derived ? money(derived.oneR) : NOT_AVAILABLE}</td>
                <td className="number wide-only">{derived ? ratio(derived.rewardRiskRatio) : NOT_AVAILABLE}</td>
                <td>{derived ? derived.entryReadiness : NOT_AVAILABLE}</td>
                <td>{`${item.institution} — ${item.account}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
