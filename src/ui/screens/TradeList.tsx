import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { ClosedTradeItem, IncoherentClosedTradeItem, IncoherentOpenTradeItem, IncoherentPlannedTradeItem, OpenTradeItem, PlannedTradeItem } from '../../app/types.ts';
import { PageTitle } from '../PageTitle.tsx';
import { Badge } from '../Badge.tsx';
import { TradeText } from '../TradeText.tsx';
import { isMarkLacking, isMarkMissing } from '../calculation-words.ts';
import { calculation, FACTS_INCOHERENT_FIGURE, FACTS_INCOHERENT_LABEL, pnlText, signed, unavailableLabel } from '../figures.ts';
import { localTime, money, netCost, quantity, ratio, rMultiple, shortDate, tradeSummary } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { closedByExpiration, closedViaOptionShort, timingLabel } from './option-disposition.ts';

export interface TradeListProps {
  readonly facade: UiFacade;
}

// The lifecycles a Trade list can show (A32, A95); Open is the default.
const LIFECYCLES = ['Open', 'Planned', 'Closed'] as const;
type Lifecycle = (typeof LIFECYCLES)[number];

// The Closed list pages by 50 (A95): its Ready state keeps the cursor of the next page and how the last
// "Show more" went. Open and Planned do not page.
type Paging =
  | { readonly kind: 'Loading' }
  | { readonly kind: 'Failed' }
  // `focused`: the Show more button held focus when the page arrived, before it could be removed.
  | { readonly kind: 'Refreshed'; readonly focused: boolean }
  // The index of the first row the last page added.
  | { readonly kind: 'Appended'; readonly from: number; readonly focused: boolean };
type ReadyState = { readonly kind: 'Ready'; readonly items: readonly unknown[]; readonly nextCursor?: string; readonly paging?: Paging };
type ListState = { readonly kind: 'Loading' } | ReadyState | { readonly kind: 'Error' };

// The Trades view: lifecycle tabs over one list each, with Loading, Ready, Empty, and Error kept
// distinct: never a false Empty while loading or after a failure. The selected tab lives in the
// URL, so it survives navigation to a Trade and back.
export function TradeList({ facade }: TradeListProps) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('lifecycle');
  const lifecycle: Lifecycle = LIFECYCLES.find((l) => l === requested) ?? 'Open';
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
      (result) => settle(result.kind === 'Ready' ? { kind: 'Ready', items: result.view.items, ...(result.view.nextCursor ? { nextCursor: result.view.nextCursor } : {}) } : { kind: 'Error' }),
      () => settle({ kind: 'Error' }),
    );
    return () => {
      current = false;
    };
  }, [facade, lifecycle, key]);

  const state: ListState = settled?.key === key ? settled.state : { kind: 'Loading' };
  // Closed only. A page is shown only for the request that asked for it: the key changes with a tab
  // switch or a full Retry, so a late page for an earlier key finds nothing to change.
  const showMore = (cursor: string, holdsFocus: () => boolean) => {
    const change = (to: (ready: ReadyState) => ReadyState) => setSettled((now) => (now?.key === key && now.state.kind === 'Ready' ? { key, state: to(now.state) } : now));
    const failed = () => change((ready) => ({ ...ready, paging: { kind: 'Failed' } }));
    change((ready) => ({ ...ready, paging: { kind: 'Loading' } }));
    const browse = facade.TradeViewsAndReporting.browseTrades;
    browse({ lifecycle: 'Closed', cursor })
      .then(async (result) => {
        // A commit since the first page ends its cursors (trade-record): start again from page one.
        const refreshed = result.kind === 'Rejected' && result.reason === 'CursorExpired';
        const page = refreshed ? await browse({ lifecycle: 'Closed' }) : result;
        if (page.kind !== 'Ready') return failed();
        const { items, nextCursor } = page.view;
        // Asked before the update, while the pressed button is still on the page.
        const focused = holdsFocus();
        change((ready) => ({
          kind: 'Ready',
          items: refreshed ? items : [...ready.items, ...items],
          ...(nextCursor ? { nextCursor } : {}),
          paging: refreshed ? { kind: 'Refreshed', focused } : { kind: 'Appended', from: ready.items.length, focused },
        }));
      })
      .catch(failed);
  };
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
        {lifecycle === 'Open' && <OpenList state={state} retry={() => setAttempt((n) => n + 1)} showPlanned={() => select('Planned')} />}
        {lifecycle === 'Planned' && <PlannedList state={state} retry={() => setAttempt((n) => n + 1)} />}
        {lifecycle === 'Closed' && <ClosedList state={state} retry={() => setAttempt((n) => n + 1)} showMore={showMore} />}
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
  const { writable, timeZone } = useRuntime();
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
                    disagreement={disagreementBadge(item.integrity, derived)}
                    text={derived?.summary ? tradeSummary(derived.summary, timeZone) : NOT_AVAILABLE}
                    line={
                      <>
                        Net cost {derived && derived.netCost.kind === 'Value' ? netCost(derived.netCost.value) : NOT_AVAILABLE}
                        {derived && (
                          <>
                            {' · P&L '}
                            <Pnl current={derived.current} tradeId={item.tradeId} />
                          </>
                        )}
                      </>
                    }
                    badges={derived && <StatusBadges current={derived.current} settlement={derived.settlement} />}
                  />
                </td>
                <td className="number wide-only">{derived && derived.netCost.kind === 'Value' ? netCost(derived.netCost.value) : NOT_AVAILABLE}</td>
                <td className="number wide-only">{derived ? <Pnl current={derived.current} tradeId={item.tradeId} /> : NOT_AVAILABLE}</td>
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

// A row without derived figures has facts that cannot be replayed: its figures read as FactsIncoherent's figure (A186).
const NOT_AVAILABLE = FACTS_INCOHERENT_FIGURE;

// "Records disagree" labels only an integrity disagreement of a Trade whose facts replay; one whose facts cannot be replayed gets FactsIncoherent's label (P72).
const disagreementBadge = (integrity: 'Agrees' | 'Disagrees' | undefined, derived: unknown): string | undefined =>
  integrity !== 'Disagrees' ? undefined : derived ? 'Records disagree' : FACTS_INCOHERENT_LABEL;

type Current = OpenTradeItem['current'];

// The Instrument lacking an exact Mark; absent when the P&L has its Mark or the reason is another one (a date outside coverage, a close not yet come).
function missingMark(current: Current) {
  const pnl = current.currentMarkedPnl;
  return pnl.kind === 'Unavailable' && isMarkLacking(pnl) ? { instrument: pnl.instrument } : undefined;
}

// Current Marked Trade P&L: the figure, or in its place the words for what is missing; the Mark missing
// words link to this Trade's own card in the Review (A161). The dated line's P&L follows, labelled with its date.
function Pnl({ current, tradeId }: { readonly current: Current; readonly tradeId: string }) {
  const { currentMarkedPnl: pnl, currentMarkedPnlInPlanR: planR, datedLine } = current;
  const missing = missingMark(current);
  const text = pnlText(pnl, planR);
  return (
    <>
      {missing ? <Link to={`/review?trade=${encodeURIComponent(tradeId)}&instrument=${encodeURIComponent(missing.instrument.symbol)}`}>{text}</Link> : text}
      {datedLine && ` ${shortDate(datedLine.tradingDate)} close ${pnlText(datedLine.evaluation.currentMarkedPnl, datedLine.evaluation.currentMarkedPnlInPlanR)}`}
    </>
  );
}

// The Mark status and a crossed Stop or reached Target are said in text, at every width; an active condition says nothing.
function StatusBadges({ current, settlement }: { readonly current: Current; readonly settlement: OpenTradeItem['settlement'] }) {
  return (
    <>
      {current.currentMarkedPnl.kind === 'Unavailable' && isMarkMissing(current.currentMarkedPnl) && (
        <>
          {' '}
          <Badge tone="warning">{unavailableLabel(current.currentMarkedPnl)}</Badge>
        </>
      )}
      {/* Whenever a contract is due, as Detail's panel says, from the expiration date after the settlement time (K4, A113). */}
      {settlement[0] && (
        <>
          {' '}
          <Badge tone="warning">{unavailableLabel({ reason: 'SettlementDue', instrument: settlement[0].instrument, expiration: settlement[0].expiration })}</Badge>
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
  disagreement,
  line,
  badges,
  indicators,
}: {
  readonly text: string;
  // The badge's words when the row's records disagree or its facts cannot be replayed; absent when they agree.
  readonly disagreement: string | undefined;
  readonly line: ReactNode;
  readonly badges?: ReactNode;
  // Badges that belong to the first line, with the summary text.
  readonly indicators?: ReactNode;
}) {
  return (
    <>
      <TradeText text={text} />
      {/* Text, not colour alone, carries the meaning; an agreeing row shows nothing. The spaces keep
          the cell's text and accessible name from running the parts together. */}
      {disagreement && (
        <>
          {' '}
          <Badge tone="warning">{disagreement}</Badge>
        </>
      )}
      {indicators}
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

// A Closed row's Disposition cell: "Closed via sale" for stock; for an option the mechanisms by the side it held, then its
// Option Disposition Timing after a middle dot (row 23.14).
function dispositionCell(item: ClosedTradeItem): string {
  const { terminalDisposition: disposition, optionDispositionTiming: timing, summary } = item;
  if (disposition.kind !== 'Value') return NOT_AVAILABLE;
  if (summary?.kind !== 'Option') return 'Closed via sale';
  const via = closedViaOptionShort(summary.direction, disposition.value);
  return timing?.kind === 'Value' ? `${via} · ${timingLabel(timing.value)}` : via;
}

// An Expiration closes a Trade with no Close Reason to give (row 23.15).
const closedByExpirationOf = ({ terminalDisposition: disposition }: ClosedTradeItem): boolean => disposition.kind === 'Value' && closedByExpiration(disposition.value);

const GAIN_LOSS = signed(money);
const R_MULTIPLE = signed(rMultiple);

// The read model pages by 50 (A95): "Show more closed trades" appends the next page while a cursor remains.
function ClosedList({ state, retry, showMore }: ListProps & { readonly showMore: (cursor: string, holdsFocus: () => boolean) => void }) {
  const { timeZone } = useRuntime();
  const rows = useRef<HTMLTableSectionElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const statusLine = useRef<HTMLParagraphElement>(null);
  const emptyMessage = useRef<HTMLParagraphElement>(null);
  const appendedFrom = state.kind === 'Ready' && state.paging?.kind === 'Appended' ? state.paging.from : undefined;
  const refreshed = state.kind === 'Ready' && state.paging?.kind === 'Refreshed';
  // Focus on the page (body) does not prove the button held it, so the page's arrival recorded that.
  const buttonHadFocus = state.kind === 'Ready' && (state.paging?.kind === 'Appended' || state.paging?.kind === 'Refreshed') && state.paging.focused;
  const buttonGone = state.kind === 'Ready' && !state.nextCursor;
  useEffect(() => {
    // Focus moves only when the button that held it was removed; a trader who moved on while the page
    // loaded, or whose focus was never on the button, keeps where they are.
    if (!buttonGone || !buttonHadFocus) return;
    // The button is gone: focus goes to the first new row, not to the page start. After a refresh the
    // old position means nothing, so it goes to the refreshed status line, or to the empty message.
    if (appendedFrom !== undefined) rows.current?.rows[appendedFrom]?.querySelector('a')?.focus();
    else if (refreshed) (statusLine.current ?? emptyMessage.current)?.focus();
  }, [appendedFrom, refreshed, buttonGone, buttonHadFocus]);
  if (state.kind === 'Loading') return <p role="status">Loading closed trades…</p>;
  if (state.kind === 'Error') {
    return (
      <section className="card">
        <p>We couldn’t load your closed trades. Nothing was changed.</p>
        <button type="button" className="pill secondary" onClick={retry}>
          Retry
        </button>
      </section>
    );
  }
  const items = state.items as readonly (ClosedTradeItem | IncoherentClosedTradeItem)[];
  if (items.length === 0) {
    return (
      <section className="card empty">
        <p tabIndex={-1} ref={emptyMessage}>
          No closed trades yet. A Trade appears here once its exit is recorded.
        </p>
      </section>
    );
  }
  const { nextCursor, paging } = state;
  const added = paging?.kind === 'Appended' ? items.length - paging.from : 0;
  const message =
    paging?.kind === 'Failed'
      ? 'We couldn’t load more closed trades. Nothing was changed.'
      : paging?.kind === 'Refreshed'
        ? 'The list was refreshed because your journal changed. Showing from the first page.'
        : paging?.kind === 'Appended'
          ? `${added} more closed ${added === 1 ? 'trade' : 'trades'} shown.`
          : '';
  const loading = paging?.kind === 'Loading';
  const table = (
    // The columns scroll inside their own focusable region on a narrow screen (Underlying pinned), never the page.
    <div className="table-scroll" role="region" aria-label="Closed Trades" tabIndex={0}>
      <table className="trades">
        <caption>Closed Trades</caption>
        <thead>
          <tr>
            <th scope="col">Underlying</th>
            <th scope="col">Trade</th>
            <th scope="col" className="number wide-only">
              Realized P&amp;L
            </th>
            <th scope="col" className="number wide-only">
              Realized R
            </th>
            <th scope="col">Disposition</th>
            <th scope="col">Close Reason</th>
            <th scope="col">Close date</th>
            <th scope="col">Account</th>
          </tr>
        </thead>
        <tbody ref={rows}>
          {items.map((item) => {
            // Facts that cannot be replayed leave the realized figures and disposition unavailable, never a number.
            const derived = 'netRealizedPnl' in item ? item : undefined;
            const pnl = derived ? GAIN_LOSS(derived.netRealizedPnl) : NOT_AVAILABLE;
            const r = derived ? calculation(derived.realizedR, R_MULTIPLE) : NOT_AVAILABLE;
            return (
              <tr key={item.tradeId}>
                <td>
                  <Link to={`/trades/${item.tradeId}`}>{item.underlying}</Link>
                </td>
                <td>
                  <TradeCell
                    disagreement={disagreementBadge(item.integrity, derived)}
                    text={derived?.summary ? tradeSummary(derived.summary, timeZone) : NOT_AVAILABLE}
                    indicators={
                      <>
                        {item.reflectionOwed && (
                          <>
                            {' '}
                            <Badge tone="info">Reflection owed</Badge>
                          </>
                        )}
                        {item.deviationCount > 0 && (
                          <>
                            {' '}
                            <Badge tone="neutral">{`${item.deviationCount} ${item.deviationCount === 1 ? 'Deviation' : 'Deviations'}`}</Badge>
                          </>
                        )}
                      </>
                    }
                    line={`Realized P&L ${pnl} · Realized R ${r}`}
                  />
                </td>
                <td className="number wide-only">{pnl}</td>
                <td className="number wide-only">{r}</td>
                <td>{derived ? dispositionCell(derived) : NOT_AVAILABLE}</td>
                <td>{item.closeReason?.label ?? (derived && closedByExpirationOf(derived) ? 'Not needed' : 'Not recorded')}</td>
                <td>{timeZone ? localTime(item.terminalTime, timeZone).slice(0, 10) : NOT_AVAILABLE}</td>
                <td>{`${item.institution} — ${item.account}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      {table}
      {(nextCursor || message) && (
        <div className="paging">
          <p role="status" tabIndex={-1} ref={statusLine}>
            {message}
          </p>
          {nextCursor && (
            // aria-disabled, not disabled, so the pressed button keeps focus while its page loads.
            <button
              type="button"
              className="pill secondary"
              ref={moreButton}
              aria-busy={loading}
              aria-disabled={loading}
              onClick={() => !loading && showMore(nextCursor, () => moreButton.current === document.activeElement)}
            >
              {loading ? 'Loading more closed trades…' : paging?.kind === 'Failed' ? 'Retry' : 'Show more closed trades'}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function PlannedList({ state, retry }: ListProps) {
  const { timeZone } = useRuntime();
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
                    disagreement={disagreementBadge(item.integrity, derived)}
                    text={derived ? tradeSummary(derived.summary, timeZone) : NOT_AVAILABLE}
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
