import { useState } from 'react';
import type { UiFacade } from '../../../app/compose.ts';
import type { NarrativeEntry, TradeDetailNarrativeItem } from '../../../app/types.ts';
import { Badge } from '../../Badge.tsx';
import { localTime, shortDate } from '../../format.ts';
import { OwedDebtItem } from '../OwedDebtItem.tsx';
import { answerText } from './words.ts';

// The Plan Reflection a Planned Trade carries: the answers saved with the Plan, under their snapshot prompts.
export function PlanReflectionSection({ entry }: { readonly entry: NarrativeEntry }) {
  return (
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
  );
}

// The Trade's narrative: each saved Entry with the Prompt and option labels saved with it, and each
// decline with its reason, at its moment time.
export function JournalSection({
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
