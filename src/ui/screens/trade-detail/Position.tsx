import { useState } from 'react';
import type { ClosedTradeDetail, ExecutionFact, ExpirationFact, NarrativeItem, OpenTradeDetail, PositionChangeFact, TradeDetailNarrativeItem } from '../../../app/types.ts';
import { Badge } from '../../Badge.tsx';
import { instrumentLabel } from '../../calculation-words.ts';
import { decimalMoney as price, localTime, money, quantity } from '../../format.ts';
import { ChevronIcon } from '../../icons.tsx';
import { executionWhat } from '../execution-line.ts';
import { LotMatchesTable } from '../LotMatchesTable.tsx';
import { Figure } from './figure.tsx';
import { answerText, positionText, type PlannedLeg } from './words.ts';

// The Open form's Position: what is held, its opening fees, and its Open Lots.
export function PositionSection({ view, timeZone }: { readonly view: OpenTradeDetail; readonly timeZone: string }) {
  const executions = view.positionChanges.flatMap((change) => change.executions);
  const openedAt = (executionId: string) => localTime(executions.find((e) => e.factId === executionId)?.economicTime ?? '', timeZone);
  return (
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
  );
}

// The derived Lot Matches, once any sale has been recorded. Amounts are the exact rationals the read
// model carries, rounded to cents only here, for display (A80).
export function LotMatchesSection({ view, timeZone }: { readonly view: OpenTradeDetail | ClosedTradeDetail; readonly timeZone: string }) {
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
export function FeeReconciliationSection({ view }: { readonly view: OpenTradeDetail | ClosedTradeDetail }) {
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

// The Executions list shows each Position Change's recorded outcome; an owed Debt is shown in the Journal.
export const outcomesOnly = (journal: readonly TradeDetailNarrativeItem[]): NarrativeItem[] =>
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
export function ExecutionsSection({
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
export function SettlementSection({ positionChanges, timeZone }: { readonly positionChanges: readonly PositionChangeFact[]; readonly timeZone: string }) {
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
