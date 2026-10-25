import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type {
  CalculationResult,
  IncoherentFactFinding,
  IncoherentTradeDetail,
  IntegrityFinding,
  NarrativeAnswer,
  NarrativeItem,
  OpenTradeDetail,
  PlannedTradeDetail,
  PositionChangeFact,
  TradeDetailView,
} from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { Badge } from '../Badge.tsx';
import { decimalMoney as price, localTime, money, netCost, quantity, ratio, rMultiple, tradeSummary } from '../format.ts';
import { BackIcon } from '../icons.tsx';
import { useRuntime } from '../runtime.tsx';

export interface TradeDetailProps {
  readonly facade: UiFacade;
  readonly timeZone: string;
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

export function TradeDetail({ facade, timeZone }: TradeDetailProps) {
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
        <h1>Trade not found</h1>
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
        <h1>{view.plan.underlying}</h1>
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
        <dl>
          <dt>Leg</dt>
          <dd>{leg ? `${leg.side} ${leg.quantity} shares of ${leg.instrument.symbol}` : ''}</dd>
          <dt>Intended entry</dt>
          <dd className="number">{leg ? price(leg.intendedEntry) : ''}</dd>
          <dt>Stop</dt>
          <dd className="number">{stop ? price(stop.price) : ''}</dd>
          <dt>Target</dt>
          <dd className="number">{target ? price(target.price) : ''}</dd>
          <dt>Plan time</dt>
          <dd>{localTime(view.plan.planTime, timeZone)}</dd>
          <dt>Account</dt>
          <dd>{`${view.labels.institution} — ${view.labels.account}`}</dd>
        </dl>
      </section>
      {'baseline' in view && (
        <section className="card" aria-labelledby="baseline-heading">
          <h2 id="baseline-heading">Plan Baseline</h2>
          <dl>
            <dt>1R (original risk)</dt>
            <dd className="number">{money(view.baseline.oneR)}</dd>
            <dt>Original reward</dt>
            <dd className="number">{money(view.baseline.originalPlannedReward)}</dd>
            <dt>Reward : risk</dt>
            <dd className="number">{ratio(view.baseline.rewardRiskRatio)}</dd>
          </dl>
        </section>
      )}
      {'positionChanges' in view && <OpenSections view={view} timeZone={timeZone} />}
      {'recordedPositionChanges' in view && (
        <>
          <PositionChangesSection positionChanges={view.recordedPositionChanges} timeZone={timeZone} />
          <JournalSection journal={view.journal} timeZone={timeZone} />
        </>
      )}
      {!('findings' in view) && entry && 'responses' in entry && (
        <section className="card" aria-labelledby="reflection-heading">
          <h2 id="reflection-heading">{entry.entryType}</h2>
          <dl>
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

// The Trade at a glance, from values the Detail already holds. Stop and Target carry their colour
// and always their label.
function SummaryCard({ view }: { readonly view: PlannedTradeDetail | OpenTradeDetail }) {
  const leg = view.plan.legs[0];
  const stop = view.plan.stops[0];
  const target = view.plan.targets[0];
  return (
    <section className="card summary-card" aria-label="Summary">
      {view.summary && <p className="summary-text number">{tradeSummary(view.summary)}</p>}
      {'deviations' in view && view.deviations.some((d) => d.versions.at(-1)?.status === 'Active') && <Badge tone="warning">Deviation active</Badge>}
      <dl>
        {'netCost' in view && view.netCost.kind === 'Value' && (
          <>
            <dt>Net cost</dt>
            <dd className="number">{netCost(view.netCost.value)}</dd>
          </>
        )}
        {'positionChanges' in view && (
          <>
            <dt>Quantity</dt>
            <dd className="number">{`${quantity(view.positions.reduce((total, p) => total.add(p.quantity), Rational.of(0n)))} of ${leg?.quantity ?? ''} shares`}</dd>
            <dt>Entry</dt>
            <dd>{view.entryStatus}</dd>
            <dt>Opening fees</dt>
            <dd className="number">{money(view.fees.incurredOpening)}</dd>
          </>
        )}
        {'positionChanges' in view && view.entryQuality.kind === 'Value' && (
          <>
            <dt>Average entry</dt>
            <dd className="number">{shown(view.entryQuality.value.averageEntry, money)}</dd>
            <dt>Actual initial risk</dt>
            <dd className="number">{shown(view.entryQuality.value.actualInitialRisk, money)}</dd>
          </>
        )}
        {!('positionChanges' in view) && (
          <>
            <dt>Intended entry</dt>
            <dd className="number">{leg ? price(leg.intendedEntry) : ''}</dd>
          </>
        )}
        <dt className="stop-label">Stop</dt>
        <dd className="number stop">{stop ? price(stop.price) : ''}</dd>
        <dt className="target-label">Target</dt>
        <dd className="number target">{target ? price(target.price) : ''}</dd>
        {!('positionChanges' in view) && (
          <>
            <dt>1R</dt>
            <dd className="number">{money(view.baseline.oneR)}</dd>
            <dt>Reward : risk</dt>
            <dd className="number">{ratio(view.baseline.rewardRiskRatio)}</dd>
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

// The Open form's derived Position and its recorded Position Changes (D2).
function OpenSections({ view, timeZone }: { readonly view: OpenTradeDetail; readonly timeZone: string }) {
  const executions = view.positionChanges.flatMap((change) => change.executions);
  const openedAt = (executionId: string) => localTime(executions.find((e) => e.factId === executionId)?.economicTime ?? '', timeZone);
  return (
    <>
      <section className="card" aria-labelledby="position-heading">
        <h2 id="position-heading">Position</h2>
        <dl>
          <dt>Position</dt>
          <dd className="number">{view.positions.map((p) => `${quantity(p.quantity)} shares of ${p.instrument.symbol}`).join(', ')}</dd>
          <dt>Opening fees</dt>
          <dd className="number">{money(view.fees.incurredOpening)}</dd>
        </dl>
        {/* Tables scroll inside their own focusable region on a narrow screen, never the page. */}
        <div className="table-scroll" role="region" aria-label="Open Lots" tabIndex={0}>
          <table className="trades">
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
      <PositionChangesSection positionChanges={view.positionChanges} timeZone={timeZone} />
      <EntryQualitySection view={view} timeZone={timeZone} />
      <FulfillmentSection view={view} />
      <DeviationsSection view={view} timeZone={timeZone} />
      <JournalSection journal={view.journal} timeZone={timeZone} />
    </>
  );
}

// The recorded Position Changes, each with its Executions.
function PositionChangesSection({
  positionChanges,
  timeZone,
}: {
  readonly positionChanges: readonly PositionChangeFact[];
  readonly timeZone: string;
}) {
  return (
    <section className="card" aria-labelledby="changes-heading">
      <h2 id="changes-heading">Position Changes</h2>
      {positionChanges.map((change) => (
        <section key={change.factId} aria-labelledby={`change-${change.factId}`}>
          <h3 id={`change-${change.factId}`}>{`Position Change at ${localTime(change.economicTime, timeZone)}`}</h3>
          <div
            className="table-scroll"
            role="region"
            aria-label={`Executions, Position Change at ${localTime(change.economicTime, timeZone)}`}
            tabIndex={0}
          >
            <table className="trades">
              <caption>Executions</caption>
              <thead>
                <tr>
                  <th scope="col">Economic time</th>
                  <th scope="col">Action</th>
                  <th scope="col">Instrument</th>
                  <th scope="col" className="number">
                    Quantity
                  </th>
                  <th scope="col" className="number">
                    Price
                  </th>
                  <th scope="col" className="number">
                    Fee
                  </th>
                </tr>
              </thead>
              <tbody>
                {change.executions.map((e) => (
                  <tr key={e.factId}>
                    <td>{localTime(e.economicTime, timeZone)}</td>
                    <td>{e.action}</td>
                    <td>{e.instrument.symbol}</td>
                    <td className="number">{e.quantity}</td>
                    <td className="number">{price(e.price)}</td>
                    <td className="number">{price(e.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
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
      <dl>
        {view.legFulfillment.map((f) => {
          const leg = view.plan.legs.find((l) => l.factId === f.plannedLegId);
          return (
            <div key={f.plannedLegId}>
              <dt>{leg ? `${leg.side} ${leg.quantity} shares of ${leg.instrument.symbol}` : f.plannedLegId}</dt>
              <dd>{FULFILLMENT[f.fulfillment]}</dd>
            </div>
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
            return (
              <li key={occurrence.occurrenceId}>
                {`Entry Size (Excess): ${current.quantityAbovePlan} shares above plan, caused by the Position Change at ${timeOf(current.causingPositionChangeId)}.`}{' '}
                <Badge tone={current.status === 'Active' ? 'warning' : 'neutral'}>{current.status}</Badge>
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
function JournalSection({ journal, timeZone }: { readonly journal: readonly NarrativeItem[]; readonly timeZone: string }) {
  return (
    <section className="card" aria-labelledby="journal-heading">
      <h2 id="journal-heading">Journal</h2>
      <ul className="narrative">
        {journal.map((item) => (
          <li key={item.id}>
            <h3>{item.entryType}</h3>
            <p>{`${item.source} at ${localTime(item.momentTime, timeZone)}`}</p>
            {item.kind === 'Entry' ? (
              <dl>
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
                  <Badge tone="warning">Reflection declined</Badge>
                </p>
                {item.reason !== undefined && <p>{`Reason: ${item.reason}`}</p>}
              </>
            )}
          </li>
        ))}
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
  return result.kind === 'Value' ? format(result.value) : `Not applicable: ${NOT_APPLICABLE[result.reason] ?? result.reason}`;
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
        <dl>
          <dt>Resolved at</dt>
          <dd>{resolvedAt ? `Position Change at ${localTime(resolvedAt.economicTime, timeZone)}` : ''}</dd>
          <dt>Average entry</dt>
          <dd className="number">{shown(quality.value.averageEntry, money)}</dd>
          <dt>Actual initial risk</dt>
          <dd className="number">{`${shown(quality.value.actualInitialRisk, money)} (${shown(quality.value.riskInPlanR, rMultiple)})`}</dd>
          <dt>Actual initial reward</dt>
          <dd className="number">{shown(quality.value.actualInitialReward, money)}</dd>
          <dt>Reward : risk</dt>
          <dd className="number">{`${shown(quality.value.actualRewardRisk, ratio)} (planned ${shown(quality.value.plannedRewardRisk, ratio)})`}</dd>
          <dt>Slippage</dt>
          <dd className="number">{shown(quality.value.slippage, money)}</dd>
          <dt>Size</dt>
          <dd className="number">{`${shown(quality.value.sizeRatio, ratio)}× planned quantity`}</dd>
        </dl>
      ) : (
        <p>{`Entry not yet resolved: ${quantity(entered)} of ${planned} entered`}</p>
      )}
    </section>
  );
}
