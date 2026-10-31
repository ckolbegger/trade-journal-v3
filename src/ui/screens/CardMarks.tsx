import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { ExpectedResolutionRevision, MarkResolution, MarkRow, MarketDataPrepareEntry, ReviewFamily, SaveReviewMarksResult } from '../../app/types.ts';
import { shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { fieldIssues } from './form-issues.tsx';
import { MarkEntry, type MarkEntryProps } from './MarkEntry.tsx';
import { describeMarkIssues } from './mark-issues.ts';
import type { FieldIssue } from './plan-issues.ts';

export type GapGroup = Extract<ReviewFamily, { family: 'Marks' }>['earlier'][number];

// The Marks a card owns: its Review-date rows, and its earlier sessions without Marks.
export interface CardMarkRows {
  readonly today: readonly MarkRow[];
  readonly earlier: readonly GapGroup[];
}

export type EntryDirty = (id: string, dirty: boolean) => void;

// A Mark entry that reports whether it holds a value under its own id; a saved one tells the card.
function ReviewMarkEntry({ instrumentKey, tradingDate, onEntryDirty, onMarkSaved, ...entry }: Omit<MarkEntryProps, 'onDirtyChange' | 'onSaved'> & { readonly onEntryDirty: EntryDirty; readonly onMarkSaved: MarkEntryProps['onSaved'] }) {
  const id = `${instrumentKey}:${tradingDate}`;
  const report = useCallback((dirty: boolean) => onEntryDirty(id, dirty), [id, onEntryDirty]);
  return <MarkEntry {...entry} instrumentKey={instrumentKey} tradingDate={tradingDate} onDirtyChange={report} onSaved={onMarkSaved} />;
}

// A typed price, or "Can't get a price" with its reason, held in the panel until Save Marks (A153).
interface Draft {
  readonly price: string;
  readonly unavailable: boolean;
  readonly reason: string;
}
const NO_DRAFT: Draft = { price: '', unavailable: false, reason: '' };
const isDraft = (draft: Draft | undefined): draft is Draft => draft !== undefined && (draft.price !== '' || draft.unavailable);
const CANT_GET_A_PRICE = "Can't get a price";

// Where a key stands: its resolution and the revision a save of it binds to.
interface Standing {
  readonly resolution: MarkResolution;
  readonly revision: ExpectedResolutionRevision;
}
const rank = (revision: ExpectedResolutionRevision): number => (revision === 'None' ? 0 : revision);

// What every row of the panel shares: the drafts and the controls over them.
interface Panel {
  readonly facade: UiFacade;
  readonly writable: boolean;
  readonly uid: string;
  readonly drafts: Readonly<Record<string, Draft>>;
  // What a refused save said about each row's key, shown beside it.
  readonly issues: Readonly<Record<string, readonly FieldIssue[]>>;
  // What a Conflict said about a row's key: nothing was saved, and the Mark shown is the current one.
  readonly notices: Readonly<Record<string, string>>;
  readonly setDraft: (id: string, draft: Draft) => void;
  // A key's standing: what this panel learned from its own saves, unless the Review has since shown a newer revision.
  readonly standing: (id: string, listed: Standing) => Standing;
  readonly setStanding: (id: string, standing: Standing) => void;
  readonly onEntryDirty: EntryDirty;
  readonly onMarkSaved: () => void;
  // Enter in a price moves on to the next price, and from the last to Save Marks (A153).
  readonly onPriceEnter: (price: HTMLInputElement) => void;
}

const rowId = (instrumentKey: string, tradingDate: string): string => `${instrumentKey}:${tradingDate}`;
const without = <T,>(record: Readonly<Record<string, T>>, id: string): Record<string, T> => Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));

// The element ids of a row's fields, under the panel's own prefix since several panels share a page.
const fieldIds = (uid: string, id: string) => ({ price: `${uid}-${id}-price`, reason: `${uid}-${id}-reason`, key: `${uid}-${id}-key` });

// The controls of a key that can still take a Mark: its price, or why no price can be had. Both stay drafts until Save Marks.
function DraftFields({ panel, id, resolution }: { readonly panel: Panel; readonly id: string; readonly resolution: MarkResolution }) {
  const draft = panel.drafts[id] ?? NO_DRAFT;
  const held = isDraft(draft);
  const { fieldError, describedBy } = fieldIssues(panel.issues[id] ?? []);
  const field = fieldIds(panel.uid, id);
  // An issue about the Mark as a whole has no field to sit beside.
  const keyIssue = (panel.issues[id] ?? []).find((issue) => issue.field === field.key);
  if (resolution.kind === 'Available' && !held) return null;
  return (
    <>
      {held && (
        <p>
          <strong>Unsaved</strong>
        </p>
      )}
      {panel.notices[id] && (
        <div role="alert" className="banner warning">
          <p>{panel.notices[id]}</p>
        </div>
      )}
      {keyIssue && (
        <p id={field.key} tabIndex={-1} className="field-error">
          {keyIssue.message}
        </p>
      )}
      {draft.unavailable ? (
        <div className="field">
          <label>
            Reason (required)
            <textarea id={field.reason} value={draft.reason} onChange={(e) => panel.setDraft(id, { ...draft, reason: e.target.value })} {...describedBy(field.reason)} />
          </label>
          {fieldError(field.reason)}
          <button type="button" className="pill secondary" onClick={() => panel.setDraft(id, NO_DRAFT)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="field">
          <label>
            Price
            <input
              id={field.price}
              data-mark-price
              inputMode="decimal"
              value={draft.price}
              onChange={(e) => panel.setDraft(id, { ...draft, price: e.target.value })}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                panel.onPriceEnter(e.currentTarget);
              }}
              {...describedBy(field.price)}
            />
          </label>
          {fieldError(field.price)}
          {resolution.kind === 'Missing' && (
            <button type="button" className="pill secondary" onClick={() => panel.setDraft(id, { price: '', unavailable: true, reason: '' })}>
              {CANT_GET_A_PRICE}
            </button>
          )}
        </div>
      )}
    </>
  );
}

// One key's row: its Mark status and the actions on a saved one (Correct, Withdraw), then the draft fields.
function KeyRow({ panel, instrumentKey, tradingDate, resolution, resolutionRevision, withdraw }: { readonly panel: Panel; readonly instrumentKey: string; readonly tradingDate: string; readonly resolution: MarkResolution; readonly resolutionRevision: ExpectedResolutionRevision; readonly withdraw: boolean }) {
  const id = rowId(instrumentKey, tradingDate);
  const now = panel.standing(id, { resolution, revision: resolutionRevision });
  const saved: MarkEntryProps['onSaved'] = ({ resolution: next, resolutionRevision: revision }) => {
    panel.setStanding(id, { resolution: next, revision });
    panel.onMarkSaved();
  };
  return (
    <ReviewMarkEntry facade={panel.facade} instrumentKey={instrumentKey} tradingDate={tradingDate} resolution={now.resolution} resolutionRevision={now.revision} withdraw={withdraw} offerEntry={false} onEntryDirty={panel.onEntryDirty} onMarkSaved={saved}>
      {panel.writable && <DraftFields panel={panel} id={id} resolution={now.resolution} />}
    </ReviewMarkEntry>
  );
}

// Today's Mark tasks: one row per Instrument with the eligible Trades that hold it.
function TodayRow({ panel, row, cardTradeId, underlying }: { readonly panel: Panel; readonly row: MarkRow; readonly cardTradeId: string; readonly underlying: (tradeId: string) => string }) {
  // A shared Instrument names the other Trades that hold it (A153).
  const others = row.trades.filter((tradeId) => tradeId !== cardTradeId);
  return (
    <li>
      <h4>{row.instrumentKey}</h4>
      {others.length > 0 && (
        <p>
          also held by{' '}
          {others.map((tradeId, i) => (
            <span key={tradeId}>
              {i > 0 && ', '}
              <Link to={`/trades/${tradeId}`}>{underlying(tradeId)}</Link>
            </span>
          ))}
        </p>
      )}
      <KeyRow panel={panel} instrumentKey={row.instrumentKey} tradingDate={row.tradingDate} resolution={row.resolution} resolutionRevision={row.resolutionRevision} withdraw />
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
// An Instrument's earlier sessions, newest first.
const sessionsOf = (group: GapGroup): string[] => [...group.missing, ...group.acknowledged].sort((a, b) => (a < b ? 1 : -1));

// One Instrument's earlier sessions without an effective Mark, newest first, a page at a time.
function GapList({ panel: shared, group }: { readonly panel: Panel; readonly group: GapGroup }) {
  const [page, setPage] = useState(0);
  // Paging would unmount the rows and drop what was typed, so it waits while any row holds a value: a correction in
  // progress, reported by its entry, or a draft of this Instrument's.
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(new Set());
  const reportDirty = shared.onEntryDirty;
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
  const panel = { ...shared, onEntryDirty };
  const blocked = dirtyIds.size > 0 || Object.entries(shared.drafts).some(([id, draft]) => id.startsWith(`${group.instrumentKey}:`) && isDraft(draft));
  const holdId = useId();
  const sessions = sessionsOf(group);
  const first = page * GAPS_PER_PAGE;
  const shown = sessions.slice(first, first + GAPS_PER_PAGE);
  return (
    <section aria-label={`${group.instrumentKey} earlier sessions`}>
      <h4>{group.instrumentKey}</h4>
      <ul className="review-rows">
        {shown.map((date) => (
          <li key={date}>
            <p>{shortDate(date)}</p>
            <KeyRow panel={panel} instrumentKey={group.instrumentKey} tradingDate={date} resolution={resolutionOf(group, date)} resolutionRevision={group.revisions[date] ?? 'None'} withdraw={false} />
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

export interface CardMarksProps {
  readonly facade: UiFacade;
  readonly tradeId: string;
  readonly marks: CardMarkRows;
  readonly underlying: (tradeId: string) => string;
  readonly onEntryDirty: EntryDirty;
  readonly onMarkSaved: () => void;
  // Saves the drafts as one command (P37); the host applies a saved result to the Review.
  readonly onSaveMarks: (entries: readonly MarketDataPrepareEntry[]) => Promise<SaveReviewMarksResult>;
  // The Marks are saved but the figures were not read under them (A157).
  readonly outOfDate: boolean;
  // Reads the Review and the card again; false when that could not be done.
  readonly onRefresh: () => Promise<boolean>;
}

// The Marks panel of an open card (A153): its Review-date rows, then its earlier sessions. A typed price or a
// "Can't get a price" is a draft until Save Marks; a row with a Mark keeps its own Correct and Withdraw.
export function CardMarks({ facade, tradeId, marks, underlying, onEntryDirty, onMarkSaved, onSaveMarks, outOfDate, onRefresh }: CardMarksProps) {
  const uid = useId();
  const { writable, report } = useRuntime();
  // The earlier sessions as the card opened: a session filled meanwhile stays listed with its saved Mark until the card is closed.
  const [earlier] = useState(marks.earlier);
  const [drafts, setDrafts] = useState<Readonly<Record<string, Draft>>>({});
  const [issues, setIssues] = useState<Readonly<Record<string, readonly FieldIssue[]>>>({});
  const [notices, setNotices] = useState<Readonly<Record<string, string>>>({});
  const [refreshFailed, setRefreshFailed] = useState(false);
  // Why nothing was saved when no row can say it: the Review changed since it was read, or the write failed.
  const [failure, setFailure] = useState<'changed' | 'failed'>();
  const [saving, setSaving] = useState(false);
  // Changing a draft answers what a refused save said about its row.
  const setDraft = useCallback((id: string, draft: Draft) => {
    setDrafts((current) => ({ ...current, [id]: draft }));
    setIssues((current) => without(current, id));
    setNotices((current) => without(current, id));
  }, []);
  // A refused save takes focus to its first issue.
  const [focusField, setFocusField] = useState<{ readonly field: string }>();
  useEffect(() => {
    if (focusField) document.getElementById(focusField.field)?.focus();
  }, [focusField]);
  const [standings, setStandings] = useState<Readonly<Record<string, Standing>>>({});
  const setStanding = useCallback((id: string, standing: Standing) => setStandings((current) => ({ ...current, [id]: standing })), []);
  const standing = (id: string, listed: Standing): Standing => {
    const own = standings[id];
    return own !== undefined && rank(own.revision) >= rank(listed.revision) ? own : listed;
  };
  const count = Object.values(drafts).filter(isDraft).length;
  // The card holds while any draft does (A156); leaving the panel abandons them. A read-only card shows no draft
  // fields and no Discard, so it holds nothing: the drafts stay unsaved in state, but they cannot keep the card open.
  const held = writable && count > 0;
  useEffect(() => onEntryDirty('marks', held), [held, onEntryDirty]);
  useEffect(() => () => onEntryDirty('marks', false), [onEntryDirty]);
  const section = useRef<HTMLElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const onPriceEnter = (price: HTMLInputElement) => {
    const prices = [...(section.current?.querySelectorAll<HTMLInputElement>('input[data-mark-price]') ?? [])];
    (prices[prices.indexOf(price) + 1] ?? saveButton.current)?.focus();
  };
  const panel: Panel = { facade, writable, uid, drafts, issues, notices, setDraft, standing, setStanding, onEntryDirty, onMarkSaved, onPriceEnter };
  // Every drafted key becomes an entry, in the order the rows are shown, bound to the revision it stands at.
  const keys = [
    ...marks.today.map((row) => ({ instrumentKey: row.instrumentKey, tradingDate: row.tradingDate, listed: { resolution: row.resolution, revision: row.resolutionRevision } })),
    ...earlier.flatMap((group) => sessionsOf(group).map((date) => ({ instrumentKey: group.instrumentKey, tradingDate: date, listed: { resolution: resolutionOf(group, date), revision: group.revisions[date] ?? ('None' as const) } }))),
  ];
  const save = async () => {
    const sent = keys.flatMap(({ instrumentKey, tradingDate, listed }) => {
      const id = rowId(instrumentKey, tradingDate);
      const draft = drafts[id];
      if (!isDraft(draft)) return [];
      const intention = draft.unavailable ? ({ kind: 'AssertUnavailable', reason: draft.reason } as const) : ({ kind: 'RecordInitialManualMark', price: draft.price.trim() } as const);
      const entry: MarketDataPrepareEntry = { key: { instrumentKey, tradingDate }, expectedRevision: standing(id, listed).revision, intention };
      return [{ id, entry }];
    });
    setSaving(true);
    let result: SaveReviewMarksResult | undefined;
    try {
      result = await onSaveMarks(sent.map((s) => s.entry));
    } catch {
      result = undefined;
    } finally {
      setSaving(false);
    }
    // A refusal to write switches the whole shell to read only; the drafts stay.
    if (result) report(result);
    setIssues({});
    setNotices({});
    setFailure(undefined);
    if (result === undefined) setFailure('failed');
    else if (result.kind === 'Conflict' && result.keys) {
      // Each key that moved shows what it is now, so the retry binds to it; the drafts stay.
      const moved = result.keys.flatMap((conflicted) => {
        const row = sent[conflicted.entryIndex];
        return row ? [{ id: row.id, conflicted }] : [];
      });
      setStandings((current) => ({ ...current, ...Object.fromEntries(moved.map(({ id, conflicted }) => [id, { resolution: conflicted.resolution, revision: conflicted.resolutionRevision }])) }));
      setNotices(Object.fromEntries(moved.map(({ id, conflicted }) => [id, conflicted.code === 'MarkExists' ? 'A Mark already exists for this date, so it cannot be marked unavailable. Nothing was saved.' : 'This Mark changed after you opened it. Nothing was saved. The current Mark is shown above, and your values are kept.'])));
    } else if (result.kind === 'MarksSaved') {
      setStandings((current) => ({ ...current, ...Object.fromEntries(result.marks.map((m) => [rowId(m.key.instrumentKey, m.key.tradingDate), { resolution: m.resolution, revision: m.resolutionRevision }])) }));
      // A draft typed or changed while the save was pending is not what was sent, so it stays.
      const unchanged = (id: string, current: Draft | undefined) => {
        const was = drafts[id];
        return current !== undefined && was !== undefined && current.price === was.price && current.unavailable === was.unavailable && current.reason === was.reason;
      };
      const sentIds = new Set(sent.map((s) => s.id));
      setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id, draft]) => !(sentIds.has(id) && unchanged(id, draft)))));
    } else if (result.kind === 'Rejected') {
      // Each entry's issues sit beside its row, in the row order the entries were sent in.
      const found = result.issues.flatMap((issue) => {
        const row = 'entryIndex' in issue && issue.entryIndex !== undefined ? sent[issue.entryIndex] : undefined;
        if (!row || !('field' in issue)) return [];
        const draft = drafts[row.id]!;
        return describeMarkIssues([issue], `${uid}-${row.id}`).map((described) => ({ id: row.id, issue: draft.unavailable && described.code === 'ReasonRequired' ? { ...described, message: "Enter why you can't get a price." } : described }));
      });
      setIssues(Object.fromEntries([...new Set(found.map((f) => f.id))].map((id) => [id, found.filter((f) => f.id === id).map((f) => f.issue)])));
      const first = found[0];
      if (first) setFocusField({ field: first.issue.field });
      else setFailure('failed');
    } else setFailure(result.kind === 'ReviewChanged' ? 'changed' : 'failed');
  };
  // Discard drops every draft, and with them what a refused save said about them.
  const discard = () => {
    setDrafts({});
    setIssues({});
    setNotices({});
    setFailure(undefined);
  };
  if (marks.today.length === 0 && earlier.length === 0) return null;
  return (
    <section aria-label="Marks" ref={section}>
      {outOfDate && (
        <div role="alert" className="banner warning">
          <p>
            <strong>The Marks are saved, but the figures are out of date.</strong> {refreshFailed && 'We couldn’t refresh the Review. Nothing was changed. '}Refresh to read them again.
          </p>
          <button type="button" className="pill secondary" onClick={() => void onRefresh().then((ok) => setRefreshFailed(!ok))}>
            Refresh
          </button>
        </div>
      )}
      <h3>Today's Marks</h3>
      <ul aria-label="Today's Marks" className="review-rows">
        {marks.today.map((row) => (
          <TodayRow key={rowId(row.instrumentKey, row.tradingDate)} panel={panel} row={row} cardTradeId={tradeId} underlying={underlying} />
        ))}
      </ul>
      {earlier.length > 0 && (
        <div role="group" aria-labelledby={`${uid}-earlier`}>
          <h3 id={`${uid}-earlier`}>{EARLIER_HEADING}</h3>
          <p>These sessions do not block the Review.</p>
          {earlier.map((group) => (
            <GapList key={group.instrumentKey} panel={panel} group={group} />
          ))}
        </div>
      )}
      {failure && (
        <div role="alert" className="banner warning">
          <p>
            {failure === 'changed' ? (
              <>
                <strong>The Review changed after you opened it.</strong> Nothing was saved, and your values are kept. Refresh to read it again.
              </>
            ) : (
              <>
                <strong>These Marks could not be saved.</strong> Nothing was saved, and your values are kept, so you can try again.
              </>
            )}
          </p>
          {failure === 'changed' && (
            <button type="button" className="pill secondary" onClick={() => void onRefresh().then((ok) => setFailure(ok ? undefined : 'changed'))}>
              Refresh
            </button>
          )}
        </div>
      )}
      {writable && (
        <p>
          <button type="button" ref={saveButton} className="pill primary" disabled={count === 0 || saving} onClick={() => void save()}>
            Save Marks ({count})
          </button>
          <button type="button" className="pill secondary" disabled={count === 0} onClick={discard}>
            Discard
          </button>
        </p>
      )}
    </section>
  );
}
