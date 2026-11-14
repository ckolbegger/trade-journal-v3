import { useState } from 'react';
import type { ExecutionFact, ExpirationFact, NarrativeItem, PositionChangeFact, TradeDetailNarrativeItem } from '../../../app/types.ts';
import { Badge } from '../../Badge.tsx';
import { instrumentLabel } from '../../calculation-words.ts';
import { decimalMoney as price, localTime } from '../../format.ts';
import { ChevronIcon } from '../../icons.tsx';
import { executionWhat } from '../execution-line.ts';
import { answerText, type PlannedLeg } from './words.ts';

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
