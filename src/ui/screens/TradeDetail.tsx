import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type {
  ClosedTradeDetail,
  ExecutionFact,
  ExpirationFact,
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
import { decimalMoney as price, decimalUnderlyingPrice, localTime, money, netCost, quantity, ratio, rMultiple, shortDate, tradeSummary, underlyingPrice } from '../format.ts';
import { BackIcon, ChevronIcon } from '../icons.tsx';
import { useRuntime } from '../runtime.tsx';
import type { UnavailableReason } from '../../domain/calculation-result/index.ts';
import { findingWords, instrumentLabel, text, unavailableWords } from '../calculation-words.ts';
import { calculation, closedViaSale, dollarsAndR, FACTS_INCOHERENT_LABEL, pnlText, signed, unavailableLabel } from '../figures.ts';
import { conditionDirection, contractCount, exerciseIntentText, expirationDate, holdingText, settlementTime } from './option-words.ts';
import { executionWhat } from './execution-line.ts';
import { clearHandedOver, handedOverConfirmed } from './confirmed-handoff.ts';
import { closedViaOption, timingWords } from './option-disposition.ts';
import { LotMatchesTable } from './LotMatchesTable.tsx';
import { OwedDebtItem } from './OwedDebtItem.tsx';
import { PayoffView } from './PayoffView.tsx';

export interface TradeDetailProps {
  readonly facade: UiFacade;
  readonly timeZone: string;
  // The page holds an unsaved reflection (only one form is open at a time).
  readonly onDirtyChange?: (dirty: boolean) => void;
}

// Why an incoherent Trade offers no Record entry; the entry route shows the same words.
export const INCOHERENT_ENTRY_NOTE = 'New entries cannot be recorded for this Trade until its records agree.';

// The query parameter that opens the entry form as an exit: `/trades/:tradeId/record-entry?action=Sell`.
// Defined here, which the form already imports from, so the two screens do not import each other.
export const EXIT_ACTION = 'Sell';

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

type PlannedLeg = PlannedTradeDetail['plan']['legs'][number];

// A Planned Leg in words: an option leg by contracts and contract (C2), a stock leg by shares.
const legText = (leg: PlannedLeg): string =>
  leg.instrument.kind === 'Option' ? holdingText(leg.side, leg.quantity, leg.instrument) : `${leg.side} ${leg.quantity} shares of ${leg.instrument.symbol}`;

type PlannedCondition = PlannedTradeDetail['plan']['stops'][number];

// A Plan's Stops or Targets, one line per condition in Plan order (W6). A stock's is its price in dollars; an option's
// reads "MNO at or below 41.00" for an Underlying price (C3) and "Option at or above $3.60" for an option price.
function ConditionLines({ role, conditions, leg, symbol }: { readonly role: 'Stop' | 'Target'; readonly conditions: readonly PlannedCondition[]; readonly leg: PlannedLeg | undefined; readonly symbol: string }) {
  const option = leg?.instrument.kind === 'Option' ? { right: leg.instrument.right, side: leg.side } : undefined;
  return (
    <>
      {conditions.map((condition) => (
        <div key={condition.factId}>
          {option
            ? condition.kind === 'StructureValue'
              ? `Option at or ${conditionDirection(role, condition.kind, option)} ${price(condition.price)}`
              : `${symbol} at or ${conditionDirection(role, condition.kind, option)} ${decimalUnderlyingPrice(condition.price)}`
            : price(condition.price)}
        </div>
      ))}
    </>
  );
}

const abs = (value: Rational): Rational => (value.compare(Rational.of(0n)) < 0 ? Rational.of(0n).sub(value) : value);

// An open position: an option by its direction, contracts and contract (23.4), a stock by shares.
const positionText = (p: OpenTradeDetail['positions'][number]): string =>
  p.instrument.kind === 'Option'
    ? holdingText(p.quantity.compare(Rational.of(0n)) < 0 ? 'Short' : 'Long', quantity(abs(p.quantity)), p.instrument)
    : `${quantity(p.quantity)} shares of ${p.instrument.symbol}`;

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
  // It is handed over in memory (not in history state, which the browser structured-clones and strips the Rational
  // values of), taken once; a reload, a back/forward or a later visit takes the normal read.
  const [confirmed] = useState(() => handedOverConfirmed(tradeId));
  useEffect(() => {
    clearHandedOver();
  }, []);
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
  const entry = view.journal[0];
  const closed = 'terminalDisposition' in view;
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
        {writable && !('recordedPositionChanges' in view) && !closed && (
          <Link className="pill primary" to={`/trades/${view.tradeId}/record-entry`}>
            Record entry
          </Link>
        )}
        {/* An exit needs a Position to sell: the Open form only (the Closed form has none to record against). */}
        {writable && 'positionChanges' in view && !closed && (
          <Link className="pill secondary" to={`/trades/${view.tradeId}/record-entry?action=${EXIT_ACTION}`}>
            Record exit
          </Link>
        )}
      </header>
      {!('recordedPositionChanges' in view) && <SummaryCard view={view} timeZone={timeZone} />}
      {'settlement' in view && view.settlement.length > 0 && <SettlementDuePanel tradeId={view.tradeId} items={view.settlement} timeZone={timeZone} />}
      {!('recordedPositionChanges' in view) && <PayoffSections view={view} />}
      {'positionChanges' in view && view.findings.length > 0 && <IntegrityPanel view={view} timeZone={timeZone} />}
      {'recordedPositionChanges' in view && <IncoherentPanel view={view} timeZone={timeZone} />}
      <section className="card" aria-labelledby="plan-heading">
        <h2 id="plan-heading">Plan</h2>
        <dl className="figure-grid">
          {leg?.instrument.kind === 'Option' && <Figure term="Contract" plain>{instrumentLabel(leg.instrument)}</Figure>}
          <Figure term="Leg" plain>{leg ? legText(leg) : ''}</Figure>
          {view.plan.exerciseIntent && <Figure term="Exercise Intent" plain>{exerciseIntentText(view.plan.exerciseIntent)}</Figure>}
          <Figure term="Intended entry">{leg ? price(leg.intendedEntry) : ''}</Figure>
          <Figure term="Stop"><ConditionLines role="Stop" conditions={view.plan.stops} leg={leg} symbol={view.plan.underlying} /></Figure>
          <Figure term="Target"><ConditionLines role="Target" conditions={view.plan.targets} leg={leg} symbol={view.plan.underlying} /></Figure>
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
      {'positionChanges' in view &&
        ('terminalDisposition' in view ? (
          <ClosedSections facade={facade} view={view} timeZone={timeZone} onDirtyChange={onDirtyChange} />
        ) : (
          <OpenSections facade={facade} view={view} timeZone={timeZone} onDirtyChange={onDirtyChange} />
        ))}
      {'recordedPositionChanges' in view && (
        <>
          <ExecutionsSection positionChanges={view.recordedPositionChanges} journal={outcomesOnly(view.journal)} legs={view.plan.legs} timeZone={timeZone} />
          <SettlementSection positionChanges={view.recordedPositionChanges} timeZone={timeZone} />
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

// A contract still held at or past its expiration date, due for settlement (rows 23.9 and 23.10). Whether it was
// assigned or exercised is worded by the sign of its quantity, never by the Strategy (decision 88); Record expiration
// is an authoritative write, so it is offered only while Writable.
function SettlementDuePanel({ tradeId, items, timeZone }: { readonly tradeId: string; readonly items: OpenTradeDetail['settlement']; readonly timeZone: string }) {
  const { writable } = useRuntime();
  return (
    <section className="card" aria-labelledby="settlement-due-heading">
      {/* The calculation-words module owns the words "Settlement Due" (conflict K4). */}
      <h2 id="settlement-due-heading">{unavailableLabel({ reason: 'SettlementDue', instrument: items[0]!.instrument, expiration: items[0]!.expiration })}</h2>
      {items.map((item) => {
        const short = item.quantity.compare(Rational.of(0n)) < 0;
        return (
          <div key={`${item.instrument.symbol}-${item.expiration}-${item.instrument.strike}`}>
            <dl className="figure-grid">
              <Figure term="Contract" plain>{instrumentLabel(item.instrument)}</Figure>
              <Figure term="Quantity" plain>{`${short ? 'Short' : 'Long'} ${contractCount(quantity(abs(item.quantity)))}`}</Figure>
              <Figure term="Expired" plain>{shortDate(item.expiration)}</Figure>
              <Figure term="Settlement time" plain>{calculation(item.settlementTime, (instant) => settlementTime(instant, timeZone))}</Figure>
            </dl>
            <p>
              {short
                ? "If it was assigned, this release can't record the assignment yet, so this Trade stays open until a later release can."
                : "If it was exercised, this release can't record the exercise yet, so this Trade stays open until a later release can."}
            </p>
          </div>
        );
      })}
      {/* A date outside the market calendar has no settlement time to record at (D7 Q1). */}
      {writable && items.every((item) => item.settlementTime.kind === 'Value') && (
        <Link className="pill primary" to={`/trades/${tradeId}/record-expiration`}>
          Record expiration
        </Link>
      )}
    </section>
  );
}

// The Planned and Current Expiration Payoff, each its own section and apart from every Mark-dependent figure
// (A119). The Current chart marks the value at expiration at the Underlying's latest close (A122), once it has a number.
function PayoffSections({ view }: { readonly view: PlannedTradeDetail | OpenTradeDetail }) {
  const symbol = view.plan.underlying;
  const atClose = 'current' in view ? view.current.evaluation.expirationValueAtUnderlyingClose : undefined;
  return (
    <>
      <PayoffView kind="Planned" symbol={symbol} result={view.payoff.planned} />
      <PayoffView kind="Current" symbol={symbol} result={view.payoff.current} {...(atClose?.kind === 'Value' && { latestClose: atClose.value })} />
      {/* Where the figure has no number, the module says why (row 23.11); a flat or stock Trade shows none. */}
      {atClose?.kind === 'Unavailable' && (
        <section className="card">
          <dl className="figure-grid">
            <Figure term={`Value at expiration at ${symbol}'s latest close`} plain>{calculation(atClose, () => '')}</Figure>
          </dl>
        </section>
      )}
    </>
  );
}

// The Trade at a glance, from values the Detail already holds. Stop and Target carry their colour
// and always their label.
function SummaryCard({ view, timeZone }: { readonly view: PlannedTradeDetail | OpenTradeDetail | ClosedTradeDetail; readonly timeZone: string }) {
  const leg = view.plan.legs[0];
  const contract = leg?.instrument.kind === 'Option' ? leg.instrument : undefined;
  const held = 'heldQuantity' in view ? view.heldQuantity : Rational.of(0n);
  const expiration = view.contractExpiration;
  return (
    <section className="card summary-card" aria-label="Summary">
      {view.summary && <p className="summary-text number"><TradeText text={tradeSummary(view.summary, timeZone)} /></p>}
      {/* A contract due for settlement has its panel. A Closed Trade shows "Expired" only when its Terminal Disposition
          includes an expiration; one only the trader's Executions disposed of shows no line (decision 94, row 23.19). */}
      {expiration && <p>{`${expiration.status} ${expirationDate(expiration.date)}`}</p>}
      {'deviations' in view && view.deviations.some((d) => d.versions.at(-1)?.status === 'Active') && <Badge tone="warning">Deviation active</Badge>}
      <dl className="figure-grid">
        {'netCost' in view && view.netCost.kind === 'Value' && <Figure term="Net cost">{netCost(view.netCost.value)}</Figure>}
        {'positionChanges' in view && (
          <>
            {/* A Closed Trade holds no shares, so its quantity against the plan would read as none. */}
            {!('terminalDisposition' in view) && (
              <Figure term="Quantity">{contract ? `${quantity(abs(held))} of ${contractCount(leg?.quantity ?? 0)}` : `${quantity(held)} of ${leg?.quantity ?? ''} shares`}</Figure>
            )}
            <Figure term="Entry" plain>{view.entryStatus}</Figure>
            <Figure term="Opening fees">{money(view.fees.incurredOpening)}</Figure>
          </>
        )}
        {'positionChanges' in view && view.entryQuality.kind === 'Value' && (
          <>
            <Figure term="Average entry">{calculation(view.entryQuality.value.averageEntry, money)}</Figure>
            <Figure term="Actual initial risk">{calculation(view.entryQuality.value.actualInitialRisk, money)}</Figure>
          </>
        )}
        {!('positionChanges' in view) && <Figure term="Intended entry">{leg ? price(leg.intendedEntry) : ''}</Figure>}
        <Figure term="Stop" tone="stop"><ConditionLines role="Stop" conditions={view.plan.stops} leg={leg} symbol={view.plan.underlying} /></Figure>
        <Figure term="Target" tone="target"><ConditionLines role="Target" conditions={view.plan.targets} leg={leg} symbol={view.plan.underlying} /></Figure>
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
function ValuationSection({ tradeId, current, timeZone }: { readonly tradeId: string; readonly current: OpenTradeDetail['current']; readonly timeZone: string }) {
  const { mark, markResolution, evaluation } = current;
  const { instrument } = evaluation.observation;
  const symbol = instrument.symbol;
  const date = evaluation.valuationDate;
  const sentence = (reason: UnavailableReason) => text(unavailableWords(reason, 'sentence', timeZone));
  const stale = evaluation.staleContext;
  return (
    <section className="card" aria-labelledby="valuation-heading">
      <h2 id="valuation-heading">Valuation</h2>
      {markResolution?.kind === 'Missing' && (
        <p>
          <Link to={`/review?trade=${encodeURIComponent(tradeId)}&instrument=${encodeURIComponent(symbol)}`}>{sentence({ reason: 'MarkMissing', instrument, date })}</Link>
        </p>
      )}
      {markResolution?.kind === 'AcknowledgedUnavailable' && <p>{`${sentence({ reason: 'AcknowledgedUnavailable', instrument, date })}: your acknowledgment, not a price`}</p>}
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
        {current.underlyingMark && <Figure term="Underlying Mark">{`${price(current.underlyingMark.price)} · ${current.underlyingMark.source}`}</Figure>}
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
function AtEntrySection({ atEntry, option }: { readonly atEntry: NonNullable<Evaluation['atEntry']>; readonly option: boolean }) {
  const inR = (dollars: Rational, planR: Rational) => `${money(dollars)} · ${rMultiple(planR)}`;
  return (
    <section className="card" aria-labelledby="at-entry-heading">
      <h2 id="at-entry-heading">At entry</h2>
      <dl className="figure-grid">
        <Figure term="Quantity">{option ? contractCount(quantity(abs(atEntry.quantity))) : `${quantity(atEntry.quantity)} shares`}</Figure>
        <Figure term="Average entry">{money(atEntry.averageEntry)}</Figure>
        <Figure term="Risk from entry">{inR(atEntry.riskFromEntry, atEntry.riskFromEntryInPlanR)}</Figure>
        <Figure term="Reward from entry">{inR(atEntry.rewardFromEntry, atEntry.rewardFromEntryInPlanR)}</Figure>
      </dl>
    </section>
  );
}

// Original risk and reward from the frozen Plan, beside the current Mark-dependent risk and reward; a
// figure the Mark cannot give says why, never a zero.
function RiskRewardSection({
  evaluation,
  baseline,
  option,
  symbol,
}: {
  readonly evaluation: OpenTradeDetail['current']['evaluation'];
  readonly baseline: OpenTradeDetail['baseline'];
  // An option's conditions are Underlying prices, read against the contract's value at expiration there (rows 23.17, C3).
  readonly option: boolean;
  readonly symbol: string;
}) {
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
              {option && (
                <>
                  <th scope="col" className="number">Value at expiration</th>
                  <th scope="col" className="number">{`Distance on ${symbol}`}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {evaluation.conditions.map((condition) => {
              const { result } = condition;
              const reading = result.kind === 'Value' ? result.value : undefined;
              const optionPrice = condition.kind === 'StructureValue';
              // The frozen basis of this Stop or Target: its id is its role and 1-based position.
              const basis = (condition.role === 'Stop' ? baseline.stopBasis : baseline.targetBasis)[Number(condition.id.split('-')[1]) - 1];
              return (
                <tr key={condition.id}>
                  <td>{option ? `${condition.role} on ${optionPrice ? 'the option price' : symbol}` : condition.role}</td>
                  <td className="number">{option && !optionPrice ? decimalUnderlyingPrice(condition.boundary) : price(condition.boundary)}</td>
                  <td>{reading ? reading.status : calculation(result, () => '')}</td>
                  <td className="number">{reading ? measureText(reading.distance) : '—'}</td>
                  <td className="number">{reading ? (reading.overrun ? measureText(reading.overrun) : 'None') : '—'}</td>
                  {option && (
                    <>
                      <td className="number">{basis?.valueAtExpiration ? money(basis.valueAtExpiration) : '—'}</td>
                      <td className="number">{reading?.underlying ? underlyingPrice(reading.underlying.distance) : '—'}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// The derived Lot Matches, once any sale has been recorded. Amounts are the exact rationals the read
// model carries, rounded to cents only here, for display (A80).
function LotMatchesSection({ view, timeZone }: { readonly view: OpenTradeDetail; readonly timeZone: string }) {
  if (view.lotMatches.length === 0) return null;
  return (
    <section className="card" aria-labelledby="lot-matches-heading">
      <h2 id="lot-matches-heading">Lot Matches</h2>
      <p id="lot-matches-note">Each match’s amount is rounded to the cent for display.</p>
      <div className="table-scroll" role="region" aria-label="Matched lots" tabIndex={0}>
        <LotMatchesTable
          caption="Lot Matches"
          describedBy="lot-matches-note"
          rows={view.lotMatches}
          executions={view.positionChanges.flatMap((change) => change.executions)}
          settlements={view.positionChanges.flatMap((change) => change.settlements ?? [])}
          option={view.plan.legs[0]?.instrument.kind === 'Option'}
          timeZone={timeZone}
        />
      </div>
    </section>
  );
}

// How the Trade's fees reconcile, as the read model states them (A80): the plain sum incurred, and where
// each opening and disposal fee went. Shown once a sale has been matched.
function FeeReconciliationSection({ view }: { readonly view: OpenTradeDetail }) {
  if (view.lotMatches.length === 0) return null;
  const { feeReconciliation: fees } = view;
  return (
    <section className="card" aria-labelledby="fee-reconciliation-heading">
      <h2 id="fee-reconciliation-heading">Fee reconciliation</h2>
      <dl className="figure-grid">
        <Figure term="Incurred fees">{money(fees.incurred)}</Figure>
        <Figure term="Opening fees incurred">{money(fees.incurredOpening)}</Figure>
        <Figure term="Opening fees allocated to Lot Matches">{money(fees.allocatedOpening)}</Figure>
        <Figure term="Opening fees unconsumed">{money(fees.unconsumedOpening)}</Figure>
        <Figure term="Disposal fees incurred">{money(fees.incurredDisposal)}</Figure>
        <Figure term="Disposal fees allocated to Lot Matches">{money(fees.allocatedDisposal)}</Figure>
      </dl>
    </section>
  );
}

// "Closed via sale of 100 shares": how the exposure ended, with the Close Reason (why the trader closed)
// as its own field. Realized figures are the read model's, with no Mark behind them (A92).
function ClosedResultSection({ view }: { readonly view: ClosedTradeDetail }) {
  const side = view.plan.legs[0]?.instrument.kind === 'Option' ? view.plan.legs[0].side : undefined;
  return (
    <section className="card" aria-labelledby="result-heading">
      <h2 id="result-heading">Result</h2>
      <dl className="figure-grid">
        <Figure term="Realized P&L">{signed(money)(view.realizedToDate)}</Figure>
        <Figure term="Realized R">{calculation(view.realizedR, signed(rMultiple))}</Figure>
        <Figure term="Terminal Disposition" plain>
          {calculation(view.terminalDisposition, side ? (mechanisms) => closedViaOption(side, mechanisms) : closedViaSale)}
        </Figure>
        {view.optionDispositionTiming && (
          <Figure term="Option Disposition Timing" plain>
            {calculation(view.optionDispositionTiming, timingWords)}
          </Figure>
        )}
        {view.closeReason && (
          <Figure term="Close Reason" plain>
            {view.closeReason.label}
          </Figure>
        )}
      </dl>
    </section>
  );
}

// The Closed form: how the Trade ended and what it realized, and its record. It shows no valuation, Mark,
// Expected Mark Date, risk, or Open Lot, since none remains to value (A92).
function ClosedSections({ facade, view, timeZone, onDirtyChange }: { readonly facade: UiFacade; readonly view: ClosedTradeDetail; readonly timeZone: string; readonly onDirtyChange?: (dirty: boolean) => void }) {
  return (
    <>
      <ClosedResultSection view={view} />
      <LotMatchesSection view={view} timeZone={timeZone} />
      <FeeReconciliationSection view={view} />
      <ExecutionsSection positionChanges={view.positionChanges} journal={outcomesOnly(view.journal)} legs={view.plan.legs} timeZone={timeZone} />
      <SettlementSection positionChanges={view.positionChanges} timeZone={timeZone} />
      <EntryQualitySection view={view} timeZone={timeZone} />
      <FulfillmentSection view={view} />
      <DeviationsSection view={view} timeZone={timeZone} />
      <JournalSection facade={facade} journal={view.journal} symbol={view.plan.underlying} timeZone={timeZone} onDirtyChange={onDirtyChange} />
    </>
  );
}

// The Open form's derived Position and its recorded Position Changes (D2).
function OpenSections({ facade, view, timeZone, onDirtyChange }: { readonly facade: UiFacade; readonly view: OpenTradeDetail; readonly timeZone: string; readonly onDirtyChange?: (dirty: boolean) => void }) {
  const executions = view.positionChanges.flatMap((change) => change.executions);
  const openedAt = (executionId: string) => localTime(executions.find((e) => e.factId === executionId)?.economicTime ?? '', timeZone);
  return (
    <>
      <ValuationSection tradeId={view.tradeId} current={view.current} timeZone={timeZone} />
      {view.current.datedLine && <DatedSection line={view.current.datedLine} />}
      {view.current.evaluation.atEntry && <AtEntrySection atEntry={view.current.evaluation.atEntry} option={view.plan.legs[0]?.instrument.kind === 'Option'} />}
      <RiskRewardSection evaluation={view.current.evaluation} baseline={view.baseline} option={view.plan.legs[0]?.instrument.kind === 'Option'} symbol={view.plan.underlying} />
      <section className="card" aria-labelledby="position-heading">
        <h2 id="position-heading">Position</h2>
        <dl className="figure-grid">
          <Figure term="Position">{view.positions.map(positionText).join(', ')}</Figure>
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
      <LotMatchesSection view={view} timeZone={timeZone} />
      <FeeReconciliationSection view={view} />
      <ExecutionsSection positionChanges={view.positionChanges} journal={outcomesOnly(view.journal)} legs={view.plan.legs} timeZone={timeZone} />
      <SettlementSection positionChanges={view.positionChanges} timeZone={timeZone} />
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
  legs,
  timeZone,
}: {
  readonly execution: ExecutionFact;
  readonly change: PositionChangeFact;
  readonly reflection: NarrativeItem | undefined;
  readonly legs: readonly PlannedLeg[];
  readonly timeZone: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const time = localTime(e.economicTime, timeZone);
  const group = change.executions.length > 1;
  // An option is named by its label and its role's action (C5, C6); a stock Execution reads as it always has.
  const what = executionWhat(e, legs);
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
            <dd>{instrumentLabel(e.instrument)}</dd>
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
  legs,
  timeZone,
}: {
  readonly positionChanges: readonly PositionChangeFact[];
  readonly journal: readonly NarrativeItem[];
  readonly legs: readonly PlannedLeg[];
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
            legs={legs}
            timeZone={timeZone}
          />
        ))}
      </ul>
    </section>
  );
}

// One Expiration as a compact row with its own disclosure (row 23.7): it has no price, fee or reflection.
function SettlementRow({ settlement: s, change, timeZone }: { readonly settlement: ExpirationFact; readonly change: PositionChangeFact; readonly timeZone: string }) {
  const [expanded, setExpanded] = useState(false);
  const time = localTime(s.economicTime, timeZone);
  return (
    <li>
      <button
        type="button"
        className="execution-toggle"
        aria-expanded={expanded}
        aria-controls={`settlement-details-${s.factId}`}
        aria-labelledby={`settlement-summary-${s.factId} settlement-hint-${s.factId}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span id={`settlement-summary-${s.factId}`} className="execution-summary">
          <span className="execution-what">{`Expiration of ${s.quantity} ${instrumentLabel(s.instrument)}`}</span> <span className="nowrap">{time}</span>
        </span>
        <span id={`settlement-hint-${s.factId}`} className="visually-hidden">
          details
        </span>
        <ChevronIcon />
      </button>
      {expanded && (
        <div id={`settlement-details-${s.factId}`} className="execution-details">
          <dl>
            <dt>Instrument</dt>
            <dd>{instrumentLabel(s.instrument)}</dd>
            <dt>Settlement time</dt>
            <dd>{time}</dd>
            <dt>Position Change</dt>
            <dd>{localTime(change.economicTime, timeZone)}</dd>
          </dl>
        </div>
      )}
    </li>
  );
}

// Every recorded Expiration, apart from the Executions: an Expiration is a settlement, not an Execution (row 23.7).
function SettlementSection({ positionChanges, timeZone }: { readonly positionChanges: readonly PositionChangeFact[]; readonly timeZone: string }) {
  const settlements = positionChanges.flatMap((change) => (change.settlements ?? []).map((settlement) => ({ settlement, change })));
  if (settlements.length === 0) return null;
  return (
    <section className="card" aria-labelledby="settlement-heading">
      <h2 id="settlement-heading">{`Settlement (${settlements.length})`}</h2>
      <ul className="executions">
        {settlements.map(({ settlement, change }) => (
          <SettlementRow key={settlement.factId} settlement={settlement} change={change} timeZone={timeZone} />
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
            <Figure key={f.plannedLegId} term={leg ? legText(leg) : f.plannedLegId} plain>
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
  const optionLeg = view.plan.legs[0]?.instrument.kind === 'Option';
  return (
    <section className="card" aria-labelledby="deviations-heading">
      <h2 id="deviations-heading">Deviations</h2>
      {view.deviations.length === 0 ? (
        <p>No Deviations recorded.</p>
      ) : (
        <ul>
          {view.deviations.map((occurrence) => {
            const current = occurrence.versions.at(-1)!;
            const unit = optionLeg ? contractCount(current.quantityAbovePlan ?? 0) : `${current.quantityAbovePlan} shares`;
            const text = `Entry Size (Excess): ${unit} above plan, caused by the Position Change at ${timeOf(current.causingPositionChangeId)}.`;
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
  const recordedVersion = (occurrenceId: string) => view.deviations.find((d) => d.occurrenceId === occurrenceId)?.versions.at(-1);
  // A Shortfall's fingerprint has no cause, so its time is its own causing Position Change's, or
  // its Economic Time when that change is not among the recorded ones.
  const shortfallTime = (cause: { readonly causingPositionChangeId: string; readonly economicTime: string } | undefined) =>
    localTime(view.positionChanges.find((c) => c.factId === cause?.causingPositionChangeId)?.economicTime ?? cause?.economicTime ?? '', timeZone);
  const row = (finding: IntegrityFinding): readonly [string, string, string] => {
    if (finding.kind === 'LifecycleDisagreement') return ['Lifecycle', finding.stored, finding.expected];
    const shortfall = finding.fingerprint.form === 'Shortfall';
    const stored = finding.kind === 'DeviationMissing' ? finding.expected : recordedVersion(finding.occurrenceId);
    const at = shortfall ? shortfallTime(stored) : timeOf(finding.fingerprint.positionChangeId ?? '');
    const record = `Entry Size Deviation, Position Change at ${at}`;
    const optionLeg = view.plan.legs[0]?.instrument.kind === 'Option';
    const shares = (amount: string) => `${optionLeg ? contractCount(amount) : `${amount} shares`}${shortfall ? ' below plan' : ''}`;
    switch (finding.kind) {
      case 'DeviationMissing':
        return [record, 'None', shares(quantity(finding.expected.quantityAbovePlan ?? finding.expected.quantityBelowPlan))];
      case 'DeviationQuantityDisagreement':
        return [record, shares(quantity(finding.recorded)), shares(quantity(finding.expected))];
      case 'DeviationUnexpected': {
        const version = recordedVersion(finding.occurrenceId);
        return [record, shares(version?.quantityAbovePlan ?? version?.quantityBelowPlan ?? ''), 'None'];
      }
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

// Recorded facts that cannot be replayed (AC-LIFE-003): each finding in its own sentence. Nothing is
// derived from them, so no Position, entry, or fulfillment figure is shown.
function IncoherentPanel({ view, timeZone }: { readonly view: IncoherentTradeDetail; readonly timeZone: string }) {
  return (
    <section className="card integrity" aria-labelledby="integrity-heading">
      <h2 id="integrity-heading">{FACTS_INCOHERENT_LABEL}</h2>
      <p>Viewing this Trade does not change its records.</p>
      <p>These recorded facts cannot be replayed, so the Position, entry, and fulfillment figures are unavailable.</p>
      <p>{INCOHERENT_ENTRY_NOTE}</p>
      <div className="table-scroll" role="region" aria-label="Facts that cannot be replayed" tabIndex={0}>
        <table className="trades">
          <caption>Facts that cannot be replayed</caption>
          <thead>
            <tr>
              <th scope="col">Finding</th>
            </tr>
          </thead>
          <tbody>
            {view.findings.map((finding, index) => (
              <tr key={index}>
                <td>{text(findingWords(finding, timeZone))}</td>
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

// Entry Quality once the Entry Resolution Point is reached, and progress toward it before (A24).
function EntryQualitySection({ view, timeZone }: { readonly view: OpenTradeDetail; readonly timeZone: string }) {
  const quality = view.entryQuality;
  const resolution = view.entryResolution;
  const entered = view.heldQuantity;
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
          <Figure term="Average entry">{calculation(quality.value.averageEntry, money)}</Figure>
          <Figure term="Actual initial risk"><WithSecondLine amount={calculation(quality.value.actualInitialRisk, money)} second={calculation(quality.value.riskInPlanR, rMultiple)} /></Figure>
          <Figure term="Actual initial reward">{calculation(quality.value.actualInitialReward, money)}</Figure>
          <Figure term="Reward : risk"><WithSecondLine amount={calculation(quality.value.actualRewardRisk, ratio)} second={`planned ${calculation(quality.value.plannedRewardRisk, ratio)}`} /></Figure>
          <Figure term="Slippage">{calculation(quality.value.slippage, money)}</Figure>
          <Figure term="Size">{`${calculation(quality.value.sizeRatio, ratio)}× planned quantity`}</Figure>
        </dl>
      ) : (
        <p>{`Entry not yet resolved: ${quantity(entered)} of ${planned} entered`}</p>
      )}
    </section>
  );
}
