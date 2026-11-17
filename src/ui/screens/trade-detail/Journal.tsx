import { useState } from 'react';
import type { UiFacade } from '../../../app/compose.ts';
import type { TradeDetailNarrativeItem } from '../../../app/types.ts';
import { Badge } from '../../Badge.tsx';
import { entryLine } from '../../cockpit/drawers/journal-line.ts';
import { OwedDebtItem } from '../OwedDebtItem.tsx';
import { answerText } from './words.ts';

// The Trade's narrative: each saved Entry with the Prompt and option labels saved with it, and each
// decline with its reason, at its moment time.
export function JournalSection({
  facade,
  journal,
  timeZone,
  onDirtyChange,
}: {
  readonly facade: UiFacade;
  readonly journal: readonly TradeDetailNarrativeItem[];
  // Not read since the Journal line dropped the Trade Anchor (P112); `Composed.tsx` is another lane's file and still passes it.
  readonly symbol?: string;
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
          return (
          <li key={item.id}>
            <h3>
              <Badge tone="neutral">{item.entryType}</Badge>
              {item.kind === 'Entry' && item.edited && <Badge tone="info">Edited</Badge>}
              {item.kind === 'Entry' && item.answeredLater && <Badge tone="info">Deferred, answered</Badge>}
            </h3>
            <p className="journal-line">{entryLine(item.source, item.momentTime, item.authoredTime, timeZone)}</p>
            {item.kind === 'Entry' ? (
              <dl className="answers">
                {item.responses.filter((response) => response.answer.kind !== 'Unanswered').map((response) => (
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
