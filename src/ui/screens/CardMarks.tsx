import { useCallback, useId, useState } from 'react';
import { Link } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { MarkResolution, MarkRow, ReviewFamily } from '../../app/types.ts';
import { shortDate } from '../format.ts';
import { MarkEntry, type MarkEntryProps } from './MarkEntry.tsx';

export type GapGroup = Extract<ReviewFamily, { family: 'Marks' }>['earlier'][number];

// The Marks a card owns: its Review-date rows, and its earlier sessions without Marks.
export interface CardMarkRows {
  readonly today: readonly MarkRow[];
  readonly earlier: readonly GapGroup[];
}

export type EntryDirty = (id: string, dirty: boolean) => void;

// A Mark entry that reports whether it holds a value under its own id; a saved one tells the card.
function ReviewMarkEntry({ facade, instrumentKey, tradingDate, resolution, resolutionRevision, withdraw, onEntryDirty, onMarkSaved }: Omit<MarkEntryProps, 'onDirtyChange' | 'onSaved'> & { readonly onEntryDirty: EntryDirty; readonly onMarkSaved: () => void }) {
  const id = `${instrumentKey}:${tradingDate}`;
  const report = useCallback((dirty: boolean) => onEntryDirty(id, dirty), [id, onEntryDirty]);
  return <MarkEntry facade={facade} instrumentKey={instrumentKey} tradingDate={tradingDate} resolution={resolution} resolutionRevision={resolutionRevision} withdraw={withdraw} onDirtyChange={report} onSaved={onMarkSaved} />;
}

interface Hooks {
  readonly facade: UiFacade;
  readonly onEntryDirty: EntryDirty;
  readonly onMarkSaved: () => void;
}

// Today's Mark tasks: one row per Instrument with the eligible Trades that hold it.
function TodayRow({ facade, row, underlying, onEntryDirty, onMarkSaved }: Hooks & { readonly row: MarkRow; readonly underlying: (tradeId: string) => string }) {
  return (
    <li>
      <h4>{row.instrumentKey}</h4>
      <p>
        Trades:{' '}
        {row.trades.map((tradeId, i) => (
          <span key={tradeId}>
            {i > 0 && ', '}
            <Link to={`/trades/${tradeId}`}>{underlying(tradeId)}</Link>
          </span>
        ))}
      </p>
      <ReviewMarkEntry facade={facade} instrumentKey={row.instrumentKey} tradingDate={row.tradingDate} resolution={row.resolution} resolutionRevision={row.resolutionRevision} onEntryDirty={onEntryDirty} onMarkSaved={onMarkSaved} />
    </li>
  );
}

const GAPS_PER_PAGE = 20;
// A gap row has no effective Mark; one constant keeps the prop stable across renders.
const MISSING: MarkResolution = { kind: 'Missing' };
// The resolution an earlier-session row starts from: acknowledged when its date holds an acknowledgment.
function resolutionOf(group: GapGroup, date: string): MarkResolution {
  const acknowledgment = group.acknowledgments[date];
  return acknowledgment ? { kind: 'AcknowledgedUnavailable', acknowledgment } : MISSING;
}
const EARLIER_HEADING = 'Earlier sessions without Marks — optional';

// One Instrument's earlier sessions without an effective Mark, newest first, a page at a time.
function GapList({ facade, group, onEntryDirty: reportDirty, onMarkSaved }: Hooks & { readonly group: GapGroup }) {
  const [page, setPage] = useState(0);
  // Paging would unmount the rows and drop what was typed, so it waits while any row holds a value.
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(new Set());
  const onEntryDirty = useCallback<EntryDirty>(
    (id, dirty) => {
      setDirtyIds((prev) => {
        if (prev.has(id) === dirty) return prev;
        const next = new Set(prev);
        if (dirty) next.add(id);
        else next.delete(id);
        return next;
      });
      reportDirty(id, dirty);
    },
    [reportDirty],
  );
  const blocked = dirtyIds.size > 0;
  const holdId = useId();
  const sessions = [...group.missing, ...group.acknowledged].sort((a, b) => (a < b ? 1 : -1));
  const first = page * GAPS_PER_PAGE;
  const shown = sessions.slice(first, first + GAPS_PER_PAGE);
  return (
    <section aria-label={`${group.instrumentKey} earlier sessions`}>
      <h4>{group.instrumentKey}</h4>
      <ul className="review-rows">
        {shown.map((date) => (
          <li key={date}>
            <p>{shortDate(date)}</p>
            <ReviewMarkEntry
              facade={facade}
              instrumentKey={group.instrumentKey}
              tradingDate={date}
              resolution={resolutionOf(group, date)}
              resolutionRevision={group.revisions[date] ?? 'None'}
              withdraw={false}
              onEntryDirty={onEntryDirty}
              onMarkSaved={onMarkSaved}
            />
          </li>
        ))}
      </ul>
      {sessions.length > GAPS_PER_PAGE && (
        <p>
          Sessions {first + 1} to {first + shown.length} of {sessions.length}
          {blocked && <span id={holdId}> Save or clear the value you entered on this page to change pages.</span>}
          {page > 0 && (
            <button type="button" className="pill secondary" disabled={blocked} aria-describedby={blocked ? holdId : undefined} onClick={() => setPage(page - 1)}>
              Previous page
            </button>
          )}
          {first + GAPS_PER_PAGE < sessions.length && (
            <button type="button" className="pill secondary" disabled={blocked} aria-describedby={blocked ? holdId : undefined} onClick={() => setPage(page + 1)}>
              Next page
            </button>
          )}
        </p>
      )}
    </section>
  );
}

// The Marks inside an open card (T5R.8): its Review-date rows, then its earlier sessions, each row saved on its own.
// T5R.9 replaces the per-row save with drafts and Save Marks.
export function CardMarks({ facade, marks, underlying, onEntryDirty, onMarkSaved }: Hooks & { readonly marks: CardMarkRows; readonly underlying: (tradeId: string) => string }) {
  const uid = useId();
  // The earlier sessions as the card opened: a session filled meanwhile stays listed with its saved Mark until the card is closed.
  const [earlier] = useState(marks.earlier);
  if (marks.today.length === 0 && earlier.length === 0) return null;
  return (
    <section aria-label="Marks">
      <h3>Today's Marks</h3>
      <ul aria-label="Today's Marks" className="review-rows">
        {marks.today.map((row) => (
          <TodayRow key={`${row.instrumentKey}:${row.tradingDate}`} facade={facade} row={row} underlying={underlying} onEntryDirty={onEntryDirty} onMarkSaved={onMarkSaved} />
        ))}
      </ul>
      {earlier.length > 0 && (
        <div role="group" aria-labelledby={`${uid}-earlier`}>
          <h3 id={`${uid}-earlier`}>{EARLIER_HEADING}</h3>
          <p>These sessions do not block the Review.</p>
          {earlier.map((group) => (
            <GapList key={group.instrumentKey} facade={facade} group={group} onEntryDirty={onEntryDirty} onMarkSaved={onMarkSaved} />
          ))}
        </div>
      )}
    </section>
  );
}
