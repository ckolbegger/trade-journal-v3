import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type {
  CalculationResult,
  ExecutionFact,
  IncoherentFactFinding,
  IncoherentTradeDetail,
  IntegrityFinding,
  NarrativeAnswer,
  NarrativeItem,
  OpenTradeDetail,
  PlannedTradeDetail,
  PositionChangeFact,
  TradeDetailNarrativeItem,
  TradeDetailView,
} from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { PageTitle } from '../PageTitle.tsx';
import { Badge } from '../Badge.tsx';
import { WithSecondLine } from '../SecondLine.tsx';
import { TradeText } from '../TradeText.tsx';
import { decimalMoney as price, localTime, money, netCost, quantity, ratio, rMultiple, shortDate, tradeSummary } from '../format.ts';
import { BackIcon, ChevronIcon } from '../icons.tsx';
import { useRuntime } from '../runtime.tsx';
import { calculation, dollarsAndR, pnlText, signed } from '../figures.ts';
import { OwedDebtItem } from './OwedDebtItem.tsx';

export interface TradeDetailProps {
  readonly facade: UiFacade;
  readonly timeZone: string;
  // The page holds an unsaved reflection (only one form is open at a time).
  readonly onDirtyChange?: (dirty: boolean) => void;
}

// Why an incoherent Trade offers no Record entry; the entry route shows the same words.
export const INCOHERENT_ENTRY_NOTE = 'New entries cannot be recorded for this Trade until its records agree.';

type DetailState =
  | { readonly kind: 'Loading' }
  | { readonly kind: 'Ready'; readonly view: TradeDetailView }
  | { readonly kind: 'NotFound' }
  | { readonly kind: 'Error' };

function answerText(answer: NarrativeAnswer): string {
  if (answer.kind === 'Text') return answer.text;
  if (answer.kind === 'Scale') return String(answer.value);
  if (answer.kind === 'Option') return answer.label;
  return 'Not answered';
}

// Returns to the Trades tab the Trade is listed under; where the lifecycle is unknown, the default tab.
function BackToTrades({ lifecycle }: { readonly lifecycle?: string }) {
  return (
    <Link className="back-link" to={lifecycle === 'Planned' ? '/?lifecycle=Planned' : '/'}>
      <BackIcon />
      Back to Trades
    </Link>
  );
}

export function TradeDetail({ facade, timeZone, onDirtyChange }: TradeDetailProps) {
  const { tradeId = '' } = useParams();
  // A Plan just confirmed arrives with its post-commit view, so it is shown without a read.
  const confirmed = (useLocation().state as { confirmed?: PlannedTradeDetail } | null)?.confirmed;
  const { writable } = useRuntime();
  const [state, setState] = useState<DetailState>(confirmed?.tradeId === tradeId ? { kind: 'Ready', view: confirmed } : { kind: 'Loading' });

  // State is set only when the read settles; Retry resets to Loading itself.
  const request = useCallback(() => {
    facade.TradeViewsAndReporting.getTradeDetail({ tradeId }).then(
      (result) =>
        setState(
          result.kind === 'Ready' ? { kind: 'Ready', view: result.view } : result.kind === 'NotFound' ? { kind: 'NotFound' } : { kind: 'Error' },
        ),
      () => setState({ kind: 'Error' }),
    );
  }, [facade, tradeId]);

  const retry = () => {
    setState({ kind: 'Loading' });
    request();
  };

  const alreadyShown = confirmed?.tradeId === tradeId;
  useEffect(() => {
    if (!alreadyShown) request();
  }, [alreadyShown, request]);

  if (state.kind === 'Loading') {
    return (
      <>
        <BackToTrades />
        <p role="status">Loading the Trade…</p>
      </>
    );
  }
  if (state.kind === 'NotFound') {
    return (
      <section className="card">
        <BackToTrades />
        <PageTitle>Trade not found</PageTitle>
        <p>No Trade with this identity exists in this journal.</p>
      </section>
    );
  }
  if (state.kind === 'Error') {
    return (
      <section className="card">
        <BackToTrades />
        <p>We couldn’t load this trade. Nothing was changed.</p>
        <button type="button" className="pill secondary" onClick={retry}>
          Retry
        </button>
      </section>
    );
  }

  const { view } = state;
  const leg = view.plan.legs[0];
  const stop = view.plan.stops[0];
  const target = view.plan.targets[0];
  const entry = view.journal[0];
  return (
    <article className="trade-detail">
      <header>
        <BackToTrades lifecycle={view.lifecycle.stored} />
        <PageTitle>{view.plan.underlying}</PageTitle>
        <p>
          {view.labels.strategy} · <Badge tone="info">{view.lifecycle.stored}</Badge>
        </p>
        {/* Recording an entry is an authoritative write, offered only while the runtime is Writable and
            the Trade's facts can be replayed; on incoherent facts it could only fail. */}
        {writable && !('recordedPositionChanges' in view) && (
          <Link className="pill primary" to={`/trades/${view.tradeId}/record-entry`}>
            Record entry
          </Link>
        )}
      </header>
      {!('recordedPositionChanges' in view) && <SummaryCard view={view} />}
      {'positionChanges' in view && view.findings.length > 0 && <IntegrityPanel view={view} timeZone={timeZone} />}
      {'recordedPositionChanges' in view && <IncoherentPanel view={view} timeZone={timeZone} />}
      <section className="card" aria-labelledby="plan-heading">
        <h2 id="plan-heading">Plan</h2>
        <dl className="figure-grid">
          <Figure term="Leg" plain>{leg ? `${leg.side} ${leg.quantity} shares of ${leg.instrument.symbol}` : ''}</Figure>
          <Figure term="Intended entry">{leg ? price(leg.intendedEntry) : ''}</Figure>
          <Figure term="Stop">{stop ? price(stop.price) : ''}</Figure>
          <Figure term="Target">{target ? price(target.price) : ''}</Figure>
          <Figure term="Plan time" plain>{localTime(view.plan.planTime, timeZone)}</Figure>
          <Figure term="Account" plain>{`${view.labels.institution} — ${view.labels.account}`}</Figure>
        </dl>
      </section>
      {'baseline' in view && (
        <section className="card" aria-labelledby="baseline-heading">
          <h2 id="baseline-heading">Plan Baseline</h2>
          <dl className="figure-grid">
            <Figure term="1R (original risk)">{money(view.baseline.oneR)}</Figure>
            <Figure term="Original reward">{money(view.baseline.originalPlannedReward)}</Figure>
            <Figure term="Reward : risk">{ratio(view.baseline.rewardRiskRatio)}</Figure>
          </dl>
        </section>
      )}
      {'positionChanges' in view && <OpenSections facade={facade} view={view} timeZone={timeZone} onDirtyChange={onDirtyChange} />}
      {'recordedPositionChanges' in view && (
        <>
          <ExecutionsSection positionChanges={view.recordedPositionChanges} journal={outcomesOnly(view.journal)} timeZone={timeZone} />
          <JournalSection facade={facade} journal={view.journal} symbol={view.plan.underlying} timeZone={timeZone} onDirtyChange={onDirtyChange} />
        </>
      )}
      {!('findings' in view) && entry && 'responses' in entry && (
        <section className="card" aria-labelledby="reflection-heading">
          <h2 id="reflection-heading">{entry.entryType}</h2>
          <dl className="answers">
            {entry.responses.map((response) => (
              <div key={response.prompt}>
                <dt>{response.prompt}</dt>
                <dd>{answerText(response.answer)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </article>
  );
}

// One label and value in a figure grid; a row never grows wider than its cap (app.css).
function Figure({ term, plain, tone, children }: { readonly term: string; readonly plain?: boolean; readonly tone?: 'stop' | 'target'; readonly children: ReactNode }) {
  return (
    <div>
      <dt className={tone && `${tone}-label`}>{term}</dt>
      <dd className={[plain ? '' : 'number', tone ?? ''].filter(Boolean).join(' ') || undefined}>{children}</dd>
    </div>
  );
}

// The Trade at a glance, from values the Detail already holds. Stop and Target carry their colour
// and always their label.
function SummaryCard({ view }: { readonly view: PlannedTradeDetail | OpenTradeDetail }) {
  const leg = view.plan.legs[0];
  const stop = view.plan.stops[0];
  const target = view.plan.targets[0];
  return (
    <section className="card summary-card" aria-label="Summary">
      {view.summary && <p className="summary-text number"><TradeText text={tradeSummary(view.summary)} /></p>}
      {'deviations' in view && view.deviations.some((d) => d.versions.at(-1)?.status === 'Active') && <Badge tone="warning">Deviation active</Badge>}
      <dl className="figure-grid">
        {'netCost' in view && view.netCost.kind === 'Value' && <Figure term="Net cost">{netCost(view.netCost.value)}</Figure>}
        {'positionChanges' in view && (
          <>
            <Figure term="Quantity">{`${quantity(view.positions.reduce((total, p) => total.add(p.quantity), Rational.of(0n)))} of ${leg?.quantity ?? ''} shares`}</Figure>
            <Figure term="Entry" plain>{view.entryStatus}</Figure>
            <Figure term="Opening fees">{money(view.fees.incurredOpening)}</Figure>
          </>
        )}
        {'positionChanges' in view && view.entryQuality.kind === 'Value' && (
          <>
            <Figure term="Average entry">{shown(view.entryQuality.value.averageEntry, money)}</Figure>
            <Figure term="Actual initial risk">{shown(view.entryQuality.value.actualInitialRisk, money)}</Figure>
          </>
        )}
        {!('positionChanges' in view) && <Figure term="Intended entry">{leg ? price(leg.intendedEntry) : ''}</Figure>}
        <Figure term="Stop" tone="stop">{stop ? price(stop.price) : ''}</Figure>
        <Figure term="Target" tone="target">{target ? price(target.price) : ''}</Figure>
        {!('positionChanges' in view) && (
          <>
            <Figure term="1R">{money(view.baseline.oneR)}</Figure>
            <Figure term="Reward : risk">{ratio(view.baseline.rewardRiskRatio)}</Figure>
          </>
        )}
      </dl>
      {'positionChanges' in view && view.entryQuality.kind !== 'Value' && <p>Entry not yet resolved</p>}
    </section>
  );
}

// A Position Change's Economic Time in the Workspace zone, which is how the Detail names it.
function changeTime(view: OpenTradeDetail, positionChangeId: string, timeZone: string): string {
  return localTime(view.positionChanges.find((c) => c.factId === positionChangeId)?.economicTime ?? '', timeZone);
}

// The Mark that valued the figures at the Expected Mark Date: its price, source, and save time, and
// the reason when the effective revision is a Correction.
function ValuationSection({ current, timeZone }: { readonly current: OpenTradeDetail['current']; readonly timeZone: string }) {
  const { mark, markResolution, evaluation } = current;
  const symbol = evaluation.observation.instrument.symbol;
  const stale = evaluation.staleContext;
  return (
    <section className="card" aria-labelledby="valuation-heading">
      <h2 id="valuation-heading">Valuation</h2>
      {markResolution?.kind === 'Missing' && (
        <p>
          <Link to={`/review?instrument=${encodeURIComponent(symbol)}`}>{`Mark missing for ${symbol} on ${shortDate(evaluation.valuationDate)}`}</Link>
        </p>
      )}
      {markResolution?.kind === 'AcknowledgedUnavailable' && <p>{`Acknowledged unavailable for ${symbol} on ${shortDate(evaluation.valuationDate)}: your acknowledgment, not a price`}</p>}
      {stale && <p>{`Stale context: ${price(stale.price)} from ${shortDate(stale.tradingDate)} close (stale, not used in any current figure)`}</p>}
      <dl className="figure-grid">
        {current.expectedMarkDate && <Figure term="Expected Mark Date" plain>{shortDate(current.expectedMarkDate)}</Figure>}
        {mark && (
          <>
            <Figure term="Mark">{price(mark.price)}</Figure>
            <Figure term="Source" plain>{mark.source}</Figure>
            <Figure term="Saved" plain>{localTime(mark.savedAt, timeZone)}</Figure>
          </>
        )}
        <ValuationFigures evaluation={current.evaluation} />
      </dl>
      {mark?.correctionReason !== undefined && (
        <p>
          <Badge tone="info">Corrected</Badge> {mark.correctionReason}
        </p>
      )}
    </section>
  );
}

const measureText = (measure: { readonly dollars: Rational; readonly planR: Rational }) => `${money(measure.dollars)} · ${rMultiple(measure.planR)}`;

type Evaluation = OpenTradeDetail['current']['evaluation'];

// Realized, open, and Current Marked Trade P&L and incurred fees, each its own figure; the dated line uses the same.
function ValuationFigures({ evaluation }: { readonly evaluation: Evaluation }) {
  return (
    <>
      <Figure term="Realized to date">{calculation(evaluation.realizedToDate, signed(money))}</Figure>
      <Figure term="Open P&L">{calculation(evaluation.remainingOpenPnl, signed(money))}</Figure>
      <Figure term="Current Marked Trade P&L">{pnlText(evaluation.currentMarkedPnl, evaluation.currentMarkedPnlInPlanR)}</Figure>
      <Figure term="Incurred fees">{calculation(evaluation.incurredFees, money)}</Figure>
    </>
  );
}

// The Mark-dependent risk and reward in dollars and R.
function ExposureFigures({ evaluation }: { readonly evaluation: Evaluation }) {
  return (
    <>
      <Figure term="Risk to stop">{dollarsAndR(evaluation.ongoingRiskToStop, evaluation.ongoingRiskToStopInPlanR)}</Figure>
      <Figure term="Worst case">{dollarsAndR(evaluation.worstCaseOngoingRisk, evaluation.worstCaseOngoingRiskInPlanR)}</Figure>
      <Figure term="Reward to target">{dollarsAndR(evaluation.incrementalRewardToTarget, evaluation.incrementalRewardToTargetInPlanR)}</Figure>
    </>
  );
}

// The Position held at an earlier close, valued with that session's own exact Mark (P12, P13).
function DatedSection({ line }: { readonly line: NonNullable<OpenTradeDetail['current']['datedLine']> }) {
  const mark = line.evaluation.observation.mark;
  return (
    <section className="card" aria-labelledby="dated-heading">
      <h2 id="dated-heading">{`At ${shortDate(line.tradingDate)} close`}</h2>
      <dl className="figure-grid">
        {mark && <Figure term="Mark">{price(mark.price)}</Figure>}
        <ValuationFigures evaluation={line.evaluation} />
        <ExposureFigures evaluation={line.evaluation} />
      </dl>
    </section>
  );
}

// Lots bought after the last close with an exact Mark: risk and reward measured from their prices, never a P&L (A54).
function AtEntrySection({ atEntry, oneR }: { readonly atEntry: NonNullable<Evaluation['atEntry']>; readonly oneR: Rational }) {
  const inR = (dollars: Rational) => `${money(dollars)} · ${rMultiple(dollars.div(oneR))}`;
  return (
    <section className="card" aria-labelledby="at-entry-heading">
      <h2 id="at-entry-heading">At entry</h2>
      <dl className="figure-grid">
        <Figure term="Quantity">{`${quantity(atEntry.quantity)} shares`}</Figure>
        <Figure term="Average entry">{money(atEntry.averageEntry)}</Figure>
        <Figure term="Risk from entry">{inR(atEntry.riskFromEntry)}</Figure>
        <Figure term="Reward from entry">{inR(atEntry.rewardFromEntry)}</Figure>
      </dl>
    </section>
  );
}

// Original risk and reward from the frozen Plan, beside the current Mark-dependent risk and reward; a
// figure the Mark cannot give says why, never a zero.
function RiskRewardSection({ evaluation, baseline }: { readonly evaluation: OpenTradeDetail['current']['evaluation']; readonly baseline: OpenTradeDetail['baseline'] }) {
  return (
    <section className="card" aria-labelledby="risk-reward-heading">
      <h2 id="risk-reward-heading">Risk and reward</h2>
      <dl className="figure-grid">
        <Figure term="Original risk">{dollarsAndR(evaluation.oneR, { kind: 'Value', value: Rational.of(1n) })}</Figure>
        <ExposureFigures evaluation={evaluation} />
        <Figure term="Max reward">{calculation(evaluation.maximumIncrementalReward, money)}</Figure>
        <Figure term="Original reward">{`${money(baseline.originalPlannedReward)} · ${rMultiple(baseline.rewardRiskRatio)}`}</Figure>
      </dl>
      <div className="table-scroll" role="region" aria-label="Stop and Target conditions" tabIndex={0}>
        <table className="trades">
          <caption>Conditions</caption>
          <thead>
            <tr>
              <th scope="col">Condition</th>
              <th scope="col" className="number">Boundary</th>
              <th scope="col">Status</th>
              <th scope="col" className="number">Distance</th>
              <th scope="col" className="number">Overrun</th>
            </tr>
          </thead>
          <tbody>
            {evaluation.conditions.map((condition) => {
              const { result } = condition;
              const reading = result.kind === 'Value' ? result.value : undefined;
              return (
                <tr key={condition.id}>
                  <td>{condition.role}</td>
                  <td className="number">{price(condition.boundary)}</td>
                  <td>{reading ? reading.status : calculation(result, () => '')}</td>
                  <td className="number">{reading ? measureText(reading.distance) : '—'}</td>
                  <td className="number">{reading ? (reading.overrun ? measureText(reading.overrun) : 'None') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// The Open form's derived Position and its recorded Position Changes (D2).
function OpenSections({ facade, view, timeZone, onDirtyChange }: { readonly facade: UiFacade; readonly view: OpenTradeDetail; readonly timeZone: string; readonly onDirtyChange?: (dirty: boolean) => void }) {
  const executions = view.positionChanges.flatMap((change) => change.executions);
  const openedAt = (executionId: string) => localTime(executions.find((e) => e.factId === executionId)?.economicTime ?? '', timeZone);
  return (
    <>
      <ValuationSection current={view.current} timeZone={timeZone} />
      {view.current.datedLine && <DatedSection line={view.current.datedLine} />}
      {view.current.evaluation.atEntry && <AtEntrySection atEntry={view.current.evaluation.atEntry} oneR={view.baseline.oneR} />}
      <RiskRewardSection evaluation={view.current.evaluation} baseline={view.baseline} />
      <section className="card" aria-labelledby="position-heading">
        <h2 id="position-heading">Position</h2>
        <dl className="figure-grid">
          <Figure term="Position">{view.positions.map((p) => `${quantity(p.quantity)} shares of ${p.instrument.symbol}`).join(', ')}</Figure>
          <Figure term="Opening fees">{money(view.fees.incurredOpening)}</Figure>
          <Figure term="Last activity" plain>{localTime(view.lastActivity, timeZone)}</Figure>
        </dl>
        {/* Tables scroll inside their own focusable region on a narrow screen, never the page. */}
        <div className="table-scroll lots-scroll" role="region" aria-label="Open Lots" tabIndex={0}>
          <table className="trades lots">
            <caption>Open Lots</caption>
            <thead>
              <tr>
                <th scope="col">Opened</th>
                <th scope="col" className="number">
                  Quantity
                </th>
                <th scope="col" className="number">
                  Price
                </th>
                <th scope="col" className="number">
                  Unconsumed opening fee
                </th>
              </tr>
            </thead>
            <tbody>
              {view.positions.flatMap((p) =>
                p.openLots.map((lot) => (
                  <tr key={lot.openingExecutionId}>
                    <td>{openedAt(lot.openingExecutionId)}</td>
                    <td className="number">{quantity(lot.quantity)}</td>
                    <td className="number">{money(lot.price)}</td>
                    <td className="number">{money(lot.unconsumedOpeningFee)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>
      <ExecutionsSection positionChanges={view.positionChanges} journal={outcomesOnly(view.journal)} timeZone={timeZone} />
      <EntryQualitySection view={view} timeZone={timeZone} />
      <FulfillmentSection view={view} />
      <DeviationsSection view={view} timeZone={timeZone} />
      <JournalSection facade={facade} journal={view.journal} symbol={view.plan.underlying} timeZone={timeZone} onDirtyChange={onDirtyChange} />
    </>
  );
}

// The Executions list shows each Position Change's recorded outcome; an owed Debt is shown in the Journal.
const outcomesOnly = (journal: readonly TradeDetailNarrativeItem[]): NarrativeItem[] =>
  journal.filter((item): item is NarrativeItem => item.kind !== 'Debt');

// The Reflection on an Execution's Position Change: its answers, the decline, or none.
function ExecutionReflection({ reflection }: { readonly reflection: NarrativeItem | undefined }) {
  if (reflection === undefined) return <p>No reflection</p>;
  if (reflection.kind === 'Entry') {
    return (
      <>
        <h3>{reflection.entryType}</h3>
        <dl>
          {reflection.responses.map((response) => (
            <div key={response.prompt}>
              <dt>{response.prompt}</dt>
              <dd>{answerText(response.answer)}</dd>
            </div>
          ))}
        </dl>
      </>
    );
  }
  return (
    <>
      <p>
        <Badge tone="warning">Reflection declined</Badge>
      </p>
      {reflection.reason !== undefined && <p>{`Reason: ${reflection.reason}`}</p>}
    </>
  );
}

// One Execution as a compact row; its disclosure button is the only control. Expansion is view
// state: it is neither stored nor put in the URL.
function ExecutionRow({
  execution: e,
  change,
  reflection,
  timeZone,
}: {
  readonly execution: ExecutionFact;
  readonly change: PositionChangeFact;
  readonly reflection: NarrativeItem | undefined;
  readonly timeZone: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const time = localTime(e.economicTime, timeZone);
  const group = change.executions.length > 1;
  const what = `${e.action} ${e.quantity} ${e.instrument.symbol}`;
  return (
    <li data-group={group ? change.factId : undefined}>
      <button
        type="button"
        className="execution-toggle"
        aria-expanded={expanded}
        aria-controls={`execution-details-${e.factId}`}
        aria-labelledby={`execution-summary-${e.factId} execution-hint-${e.factId}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span id={`execution-summary-${e.factId}`} className="execution-summary">
          {/* The spaces between the spans keep the name "Buy 60 XYZ @ $50.10 time", the visible text: inline spans trim their own. */}
          <span className="execution-what">{what}</span>{' '}
          <span className="execution-price number">{`@ ${price(e.price)}`}</span>{' '}
          <span className="nowrap">{time}</span>
        </span>
        <span id={`execution-hint-${e.factId}`} className="visually-hidden">
          details
        </span>
        <ChevronIcon />
      </button>
      {group && (
        <span className="execution-group-mark">{`Same Position Change · ${change.executions.indexOf(e) + 1} of ${change.executions.length}`}</span>
      )}
      {expanded && (
        <div id={`execution-details-${e.factId}`} className="execution-details">
          <dl>
            <dt>Instrument</dt>
            <dd>{e.instrument.symbol}</dd>
            <dt>Economic Time</dt>
            <dd>{time}</dd>
            <dt>Fee</dt>
            <dd className="number">{price(e.fee)}</dd>
            <dt>Position Change</dt>
            <dd>{`${localTime(change.economicTime, timeZone)} · ${change.executions.length} ${change.executions.length === 1 ? 'Execution' : 'Executions'}`}</dd>
          </dl>
          <div className="execution-reflection">
            <ExecutionReflection reflection={reflection} />
          </div>
        </div>
      )}
    </li>
  );
}

// Every recorded Execution in Fact Order, one compact row each.
function ExecutionsSection({
  positionChanges,
  journal,
  timeZone,
}: {
  readonly positionChanges: readonly PositionChangeFact[];
  readonly journal: readonly NarrativeItem[];
  readonly timeZone: string;
}) {
  const executions = positionChanges.flatMap((change) => change.executions.map((execution) => ({ execution, change })));
  return (
    <section className="card" aria-labelledby="executions-heading">
      <h2 id="executions-heading">{`Executions (${executions.length})`}</h2>
      <ul className="executions">
        {executions.map(({ execution, change }) => (
          <ExecutionRow
            key={execution.factId}
            execution={execution}
            change={change}
            reflection={journal.find((item) => item.positionChangeId === change.factId)}
            timeZone={timeZone}
          />
        ))}
      </ul>
    </section>
  );
}

const FULFILLMENT: Record<string, string> = {
  Unfilled: 'Unfilled',
  PartiallyFilled: 'Partially filled',
  FilledAsPlanned: 'Filled as planned',
  FilledWithDeviation: 'Filled with Deviation',
};

// Each Planned Leg's fulfillment under the frozen Plan (A25).
function FulfillmentSection({ view }: { readonly view: OpenTradeDetail }) {
  return (
    <section className="card" aria-labelledby="fulfillment-heading">
      <h2 id="fulfillment-heading">Planned-Leg Fulfillment</h2>
      <dl className="figure-grid one-column">
        {view.legFulfillment.map((f) => {
          const leg = view.plan.legs.find((l) => l.factId === f.plannedLegId);
          return (
            <Figure key={f.plannedLegId} term={leg ? `${leg.side} ${leg.quantity} shares of ${leg.instrument.symbol}` : f.plannedLegId} plain>
              {FULFILLMENT[f.fulfillment]}
            </Figure>
          );
        })}
      </dl>
    </section>
  );
}

// Each recorded Deviation occurrence in its current version, with the Position Change that caused it.
function DeviationsSection({ view, timeZone }: { readonly view: OpenTradeDetail; readonly timeZone: string }) {
  const timeOf = (positionChangeId: string) => changeTime(view, positionChangeId, timeZone);
  return (
    <section className="card" aria-labelledby="deviations-heading">
      <h2 id="deviations-heading">Deviations</h2>
      {view.deviations.length === 0 ? (
        <p>No Deviations recorded.</p>
      ) : (
        <ul>
          {view.deviations.map((occurrence) => {
            const current = occurrence.versions.at(-1)!;
            const text = `Entry Size (Excess): ${current.quantityAbovePlan} shares above plan, caused by the Position Change at ${timeOf(current.causingPositionChangeId)}.`;
            return (
              <li key={occurrence.occurrenceId}>
                {current.status === 'Active' ? (
                  text
                ) : (
                  <>
                    <span className="visually-hidden">Superseded</span>{' '}
                    <del>{text}</del>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Where stored records disagree with what the recorded facts imply (AC-LIFE-003): each stored value
// beside the expected one. A read surfaces the disagreement and never repairs it.
function IntegrityPanel({ view, timeZone }: { readonly view: OpenTradeDetail; readonly timeZone: string }) {
  const timeOf = (positionChangeId: string) => changeTime(view, positionChangeId, timeZone);
  const recorded = (occurrenceId: string) => view.deviations.find((d) => d.occurrenceId === occurrenceId)?.versions.at(-1)?.quantityAbovePlan;
  const row = (finding: IntegrityFinding): readonly [string, string, string] => {
    if (finding.kind === 'LifecycleDisagreement') return ['Lifecycle', finding.stored, finding.expected];
    const record = `Entry Size Deviation, Position Change at ${timeOf(finding.fingerprint.positionChangeId)}`;
    switch (finding.kind) {
      case 'DeviationMissing':
        return [record, 'None', `${quantity(finding.expected.quantityAbovePlan)} shares`];
      case 'DeviationQuantityDisagreement':
        return [record, `${quantity(finding.recorded)} shares`, `${quantity(finding.expected)} shares`];
      case 'DeviationUnexpected':
        return [record, `${recorded(finding.occurrenceId) ?? ''} shares`, 'None'];
    }
  };
  return (
    <section className="card integrity" aria-labelledby="integrity-heading">
      <h2 id="integrity-heading">Records disagree</h2>
      <p>Viewing this Trade does not change its records.</p>
      <div className="table-scroll" role="region" aria-label="Stored versus expected" tabIndex={0}>
        <table className="trades">
          <caption>Stored versus expected</caption>
          <thead>
            <tr>
              <th scope="col">Record</th>
              <th scope="col">Stored</th>
              <th scope="col">Expected</th>
            </tr>
          </thead>
          <tbody>
            {view.findings.map((finding, index) => (
              <tr key={index}>
                {row(finding).map((cell, column) => (
                  <td key={column}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const UNREPLAYABLE: Record<IncoherentFactFinding['reason'], string> = {
  UnknownPlannedLeg: 'Names a Planned Leg that is not in the Plan',
  NonpositiveQuantity: 'Quantity is not positive',
  DuplicateFactId: 'Shares its identity with another fact',
};

// Recorded facts that cannot be replayed (AC-LIFE-003): each named with its problem. Nothing is
// derived from them, so no Position, entry, or fulfillment figure is shown.
function IncoherentPanel({ view, timeZone }: { readonly view: IncoherentTradeDetail; readonly timeZone: string }) {
  const changes = view.recordedPositionChanges;
  const record = (factId: string) => {
    const change = changes.find((c) => c.factId === factId);
    if (change) return `Position Change at ${localTime(change.economicTime, timeZone)}`;
    const execution = changes.flatMap((c) => c.executions).find((e) => e.factId === factId);
    return execution ? `Execution at ${localTime(execution.economicTime, timeZone)}` : factId;
  };
  return (
    <section className="card integrity" aria-labelledby="integrity-heading">
      <h2 id="integrity-heading">Records disagree</h2>
      <p>Viewing this Trade does not change its records.</p>
      <p>These recorded facts cannot be replayed, so the Position, entry, and fulfillment figures are unavailable.</p>
      <p>{INCOHERENT_ENTRY_NOTE}</p>
      <div className="table-scroll" role="region" aria-label="Facts that cannot be replayed" tabIndex={0}>
        <table className="trades">
          <caption>Facts that cannot be replayed</caption>
          <thead>
            <tr>
              <th scope="col">Record</th>
              <th scope="col">Problem</th>
            </tr>
          </thead>
          <tbody>
            {view.findings.map((finding, index) => (
              <tr key={index}>
                <td>{record(finding.factId)}</td>
                <td>{UNREPLAYABLE[finding.reason]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// The Trade's narrative: each saved Entry with the Prompt and option labels saved with it, and each
// decline with its reason, at its moment time.
function JournalSection({
  facade,
  journal,
  symbol,
  timeZone,
  onDirtyChange,
}: {
  readonly facade: UiFacade;
  readonly journal: readonly TradeDetailNarrativeItem[];
  readonly symbol: string;
  readonly timeZone: string;
  readonly onDirtyChange?: (dirty: boolean) => void;
}) {
  // At most one Debt form is open at a time; a resolved one stays as the result rendered it.
  const [active, setActive] = useState<{ readonly debtId: string; readonly resolved: boolean }>();
  return (
    <section className="card" aria-labelledby="journal-heading">
      <h2 id="journal-heading">{`Journal (${journal.length})`}</h2>
      <ul className="narrative">
        {journal.map((item) => {
          if (item.kind === 'Debt') {
            return (
              <OwedDebtItem
                key={item.id}
                facade={facade}
                debt={item}
                timeZone={timeZone}
                blocked={active !== undefined && !active.resolved && active.debtId !== item.id}
                onOpen={() => setActive({ debtId: item.id, resolved: false })}
                onClose={() => setActive(undefined)}
                onResolved={() => setActive({ debtId: item.id, resolved: true })}
                onDirtyChange={onDirtyChange}
              />
            );
          }
          const moment = localTime(item.momentTime, timeZone);
          const authored = localTime(item.authoredTime, timeZone);
          // A reflection resolved after it was deferred always shows when the trader resolved it.
          const settledLater = item.kind === 'Entry' ? item.answeredLater : item.declinedLater;
          const laterTimeLabel = settledLater && (item.kind === 'Entry' ? 'Answered' : 'Declined');
          return (
          <li key={item.id}>
            <h3>
              <Badge tone="neutral">{item.entryType}</Badge>
              {item.kind === 'Entry' && item.edited && <Badge tone="info">Edited</Badge>}
              {item.kind === 'Entry' && item.answeredLater && <Badge tone="info">Deferred, answered</Badge>}
            </h3>
            <dl>
              {item.kind === 'Entry' && item.reviewDate !== undefined && (
                <>
                  <dt>Review Date</dt>
                  <dd>{shortDate(item.reviewDate)}</dd>
                </>
              )}
              <dt>Anchor</dt>
              <dd>{`Trade ${symbol}`}</dd>
              <dt>Source</dt>
              <dd>{item.source}</dd>
              <dt>Moment</dt>
              <dd>{moment}</dd>
              {(authored !== moment || laterTimeLabel) && (
                <>
                  <dt>{laterTimeLabel ?? 'Authored'}</dt>
                  <dd>{authored}</dd>
                </>
              )}
            </dl>
            {item.kind === 'Entry' ? (
              <dl className="answers">
                {item.responses.map((response) => (
                  <div key={response.prompt}>
                    <dt>{response.prompt}</dt>
                    <dd>{answerText(response.answer)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <>
                <p>
                  <Badge tone="warning">{item.declinedLater ? 'Declined later' : 'Reflection declined'}</Badge>
                </p>
                <dl>
                  <dt>Reason</dt>
                  <dd>{item.reason ?? 'No reason given'}</dd>
                </dl>
              </>
            )}
          </li>
          );
        })}
      </ul>
    </section>
  );
}

// Why a figure does not apply, in words: never shown as a number or zero.
const NOT_APPLICABLE: Record<string, string> = {
  EntryAtOrBeyondStop: 'entry at or beyond the Stop',
  EntryAtOrBeyondTarget: 'entry at or beyond the Target',
};

function shown<T>(result: CalculationResult<T>, format: (value: T) => string): string {
  if (result.kind === 'Value') return format(result.value);
  if (result.kind === 'Unbounded') return `Unbounded ${result.direction.toLowerCase()}`;
  return `Not applicable: ${NOT_APPLICABLE[result.reason] ?? result.reason}`;
}

// Entry Quality once the Entry Resolution Point is reached, and progress toward it before (A24).
function EntryQualitySection({ view, timeZone }: { readonly view: OpenTradeDetail; readonly timeZone: string }) {
  const quality = view.entryQuality;
  const resolution = view.entryResolution;
  const entered = view.positions.reduce((total, p) => total.add(p.quantity), Rational.of(0n));
  const planned = view.plan.legs[0]?.quantity ?? '';
  const resolvedAt = resolution.kind === 'Resolved' ? view.positionChanges.find((c) => c.factId === resolution.positionChangeId) : undefined;
  return (
    <section className="card" aria-labelledby="entry-quality-heading">
      <h2 id="entry-quality-heading">Entry Quality</h2>
      {quality.kind === 'Value' ? (
        <dl className="figure-grid">
          <Figure term="Resolved at" plain>
            {resolvedAt ? `Position Change at ${localTime(resolvedAt.economicTime, timeZone)}` : ''}
          </Figure>
          <Figure term="Average entry">{shown(quality.value.averageEntry, money)}</Figure>
          <Figure term="Actual initial risk"><WithSecondLine amount={shown(quality.value.actualInitialRisk, money)} second={shown(quality.value.riskInPlanR, rMultiple)} /></Figure>
          <Figure term="Actual initial reward">{shown(quality.value.actualInitialReward, money)}</Figure>
          <Figure term="Reward : risk"><WithSecondLine amount={shown(quality.value.actualRewardRisk, ratio)} second={`planned ${shown(quality.value.plannedRewardRisk, ratio)}`} /></Figure>
          <Figure term="Slippage">{shown(quality.value.slippage, money)}</Figure>
          <Figure term="Size">{`${shown(quality.value.sizeRatio, ratio)}× planned quantity`}</Figure>
        </dl>
      ) : (
        <p>{`Entry not yet resolved: ${quantity(entered)} of ${planned} entered`}</p>
      )}
    </section>
  );
}
