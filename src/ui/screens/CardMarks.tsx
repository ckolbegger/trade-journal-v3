import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { MarkResolution, MarkRow, ObservationKey, MarketDataPrepareEntry, SaveReviewMarksResult } from '../../app/types.ts';
import type { Instrument } from '../../domain/instrument/index.ts';
import { instrumentLabel } from '../calculation-words.ts';
import { shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { fieldIssues } from './form-issues.tsx';
import { earlierMarksOf, standing as heldStanding, type CardMarkRows, type Held, type HeldResult, type Standing } from './held-review.ts';
import { CANT_GET_A_PRICE, gridModel, NOT_HELD } from './marks-grid.ts';
import { MarkEntry, type MarkEntryProps } from './MarkEntry.tsx';
import { MarksGrid } from './MarksGrid.tsx';
import { describeMarkIssues, ZERO_MARK_NOTE } from './mark-issues.ts';
import type { FieldIssue } from './plan-issues.ts';
import { clearDraft, discardAll, draftAt, emptyDrafts, saveEntries, setDraft as setDraftAt, type Drafts, type DraftValue } from './review-drafts.ts';

export type EntryDirty = (id: string, dirty: boolean) => void;

// A Mark entry that reports whether it holds a value under its own id; a saved one tells the card.
function ReviewMarkEntry({ instrumentKey, tradingDate, onEntryDirty, onMarkSaved, ...entry }: Omit<MarkEntryProps, 'onDirtyChange' | 'onSaved'> & { readonly onEntryDirty: EntryDirty; readonly onMarkSaved: MarkEntryProps['onSaved'] }) {
  const id = `${instrumentKey}:${tradingDate}`;
  const report = useCallback((dirty: boolean) => onEntryDirty(id, dirty), [id, onEntryDirty]);
  return <MarkEntry {...entry} instrumentKey={instrumentKey} tradingDate={tradingDate} onDirtyChange={report} onSaved={onMarkSaved} />;
}

// A typed price, or "Can't get a price" with its reason, held in the panel until Save Marks (A153).
// A Mark task only a Trade with a due settlement needs (A112, T7.24): recording the expiration removes it.
const SETTLEMENT_ONLY_NOTE = 'Needed only while settlement is due';

// What the cell editor under the grid shares: the drafts and the controls over them.
interface Panel {
  readonly facade: UiFacade;
  readonly writable: boolean;
  readonly uid: string;
  readonly draftOf: (key: ObservationKey) => DraftValue | undefined;
  readonly hold: (key: ObservationKey, value: DraftValue | undefined) => void;
  // What a refused save said about each key, shown in its editor.
  readonly issues: Readonly<Record<string, readonly FieldIssue[]>>;
  // What a Conflict said about a key: nothing was saved, and the Mark shown is the current one.
  readonly notices: Readonly<Record<string, string>>;
  // A key's standing, from the held Review; the cell's listed values when the Review knows nothing of the key (A172).
  readonly standing: (key: ObservationKey, listed: Standing) => Standing;
  // A per-row save reaches the held Review through the fold (P51).
  readonly onResult: (result: HeldResult) => void;
  readonly onEntryDirty: EntryDirty;
  // The saved Mark's draft id: once saved it is no longer an unsaved draft.
  readonly onMarkSaved: (draftId: string) => void;
  // The walked Trades whose settlement is due: a Mark only they need goes away once the expiration is recorded (A112).
  readonly settlementTrades: ReadonlySet<string>;
}

const rowId = (instrumentKey: string, tradingDate: string): string => `${instrumentKey}:${tradingDate}`;
const without = <T,>(record: Readonly<Record<string, T>>, id: string): Record<string, T> => Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));

// The element ids of a key's fields, under the panel's own prefix since several panels share a page.
const fieldIds = (uid: string, id: string) => ({ price: `${uid}-${id}-price`, reason: `${uid}-${id}-reason`, key: `${uid}-${id}-key` });

// What the editor holds of a key that can still take a Mark: why no price can be had, and a price over an acknowledgment. A price for a
// Missing key is typed in its cell. Both stay drafts until Save Marks.
function DraftFields({ panel, tradeKey, resolution }: { readonly panel: Panel; readonly tradeKey: ObservationKey; readonly resolution: MarkResolution }) {
  const id = rowId(tradeKey.instrumentKey, tradeKey.tradingDate);
  const draft = panel.draftOf(tradeKey);
  const { fieldError, describedBy } = fieldIssues(panel.issues[id] ?? []);
  const field = fieldIds(panel.uid, id);
  // An issue about the Mark as a whole has no field to sit beside.
  const keyIssue = (panel.issues[id] ?? []).find((issue) => issue.field === field.key);
  if (resolution.kind === 'Available' && draft === undefined) return null;
  return (
    <>
      {draft !== undefined && (
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
      {draft?.kind === 'CantGetPrice' ? (
        <div className="field">
          <label>
            Reason (required)
            <textarea id={field.reason} value={draft.reason} onChange={(e) => panel.hold(tradeKey, { kind: 'CantGetPrice', reason: e.target.value })} {...describedBy(field.reason)} />
          </label>
          {fieldError(field.reason)}
          <button type="button" className="pill secondary" onClick={() => panel.hold(tradeKey, undefined)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="field">
          {resolution.kind !== 'Missing' && (
            <label>
              Price
              <input id={field.price} inputMode="decimal" value={draft?.kind === 'Price' ? draft.price : ''} onChange={(e) => panel.hold(tradeKey, { kind: 'Price', price: e.target.value })} {...describedBy(field.price)} />
            </label>
          )}
          {fieldError(field.price)}
          <p className="hint">{ZERO_MARK_NOTE}</p>
          {resolution.kind === 'Missing' && (
            <button type="button" className="pill secondary" onClick={() => panel.hold(tradeKey, { kind: 'CantGetPrice', reason: '' })}>
              {CANT_GET_A_PRICE}
            </button>
          )}
        </div>
      )}
    </>
  );
}

// The chosen cell's editor (P160), under the grid: its Mark status and the actions on a saved one (Correct, Withdraw), then the draft
// fields. Its region is named after the cell, as the cell is.
function CellEditor({ panel, instrumentKey, instrument, tradingDate, listed, withdraw, children }: { readonly panel: Panel; readonly instrumentKey: string; readonly instrument: Instrument; readonly tradingDate: string; readonly listed: Standing; readonly withdraw: boolean; readonly children?: ReactNode }) {
  const key = { instrumentKey, tradingDate };
  const id = rowId(instrumentKey, tradingDate);
  const now = panel.standing(key, listed);
  const saved: MarkEntryProps['onSaved'] = ({ resolution: next, resolutionRevision: revision }) => {
    panel.onResult({ kind: 'MarkSaved', key, resolution: next, resolutionRevision: revision });
    panel.onMarkSaved(id);
  };
  return (
    <ReviewMarkEntry facade={panel.facade} instrumentKey={instrumentKey} instrument={instrument} tradingDate={tradingDate} resolution={now.resolution} resolutionRevision={now.revision} withdraw={withdraw} offerEntry={false} onEntryDirty={panel.onEntryDirty} onMarkSaved={saved}>
      {children}
      {panel.writable && <DraftFields panel={panel} tradeKey={key} resolution={now.resolution} />}
    </ReviewMarkEntry>
  );
}

export interface CardMarksProps {
  readonly facade: UiFacade;
  readonly tradeId: string;
  readonly marks: CardMarkRows;
  // The Review the screen holds: every key's standing is read from it (P51).
  readonly held: Held;
  // Folds a per-row save and a Save Marks Conflict into the held Review.
  readonly onResult: (result: HeldResult) => void;
  // A Trade's summary line, or its Underlying when it has none.
  readonly tradeLine: (tradeId: string) => string;
  readonly onEntryDirty: EntryDirty;
  readonly onMarkSaved: (draftId: string) => void;
  // Saves the drafts as one command (P37); the host applies a saved result to the Review.
  readonly onSaveMarks: (entries: readonly MarketDataPrepareEntry[]) => Promise<SaveReviewMarksResult>;
  // The Marks are saved but the figures were not read under them (A157).
  readonly outOfDate: boolean;
  // Reads the Review and the card again; false when that could not be done.
  readonly onRefresh: () => Promise<boolean>;
  // A link to an Instrument's Mark (A161): its Review Date cell's editor opens and takes focus.
  readonly link?: { readonly count: number; readonly instrument?: string };
}

// The Marks panel of an open card (A153, P158): the Trade's Marks grid. A typed price or a "Can't get a price" is a draft until
// Save Marks; the chosen cell's editor keeps the per-key Correct and Withdraw of a Mark.
export function CardMarks({ facade, tradeId, marks, held: heldReview, onResult, tradeLine, onEntryDirty, onMarkSaved, onSaveMarks, outOfDate, onRefresh, link }: CardMarksProps) {
  const uid = useId();
  const { writable, report, timeZone } = useRuntime();
  // The earlier sessions as the card opened: a session filled meanwhile stays a column, with its saved Mark, until the card is closed.
  const [opened] = useState(marks.earlier);
  const [drafts, setDrafts] = useState<Drafts>(emptyDrafts);
  const [chosen, setChosen] = useState<ObservationKey>();
  const [issues, setIssues] = useState<Readonly<Record<string, readonly FieldIssue[]>>>({});
  const [notices, setNotices] = useState<Readonly<Record<string, string>>>({});
  const [refreshFailed, setRefreshFailed] = useState(false);
  // Why nothing was saved when no cell can say it: the Review changed since it was read, or the write failed.
  const [failure, setFailure] = useState<'changed' | 'failed'>();
  const [saving, setSaving] = useState(false);
  // A correction in progress holds paging (A296); the editor's entries report it.
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(new Set());
  const reportDirty = onEntryDirty;
  // Choosing another cell was refused because a correction is in progress (A297); the words show until it ends.
  const [refused, setRefused] = useState(false);
  const entryDirty = useCallback<EntryDirty>(
    (id, dirty) => {
      if (!dirty) setRefused(false);
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
  // Changing a draft answers what a refused save said about its key. An empty price is no draft.
  const hold = useCallback(
    (key: ObservationKey, value: DraftValue | undefined) => {
      const id = rowId(key.instrumentKey, key.tradingDate);
      setDrafts((current) => (value === undefined || (value.kind === 'Price' && value.price === '') ? clearDraft(current, key) : setDraftAt(current, key, value, tradeId)));
      setIssues((current) => without(current, id));
      setNotices((current) => without(current, id));
    },
    [tradeId],
  );
  // A refused save takes focus to its first issue.
  const [focusField, setFocusField] = useState<{ readonly field: string }>();
  useEffect(() => {
    if (focusField) document.getElementById(focusField.field)?.focus();
  }, [focusField]);
  const section = useRef<HTMLElement>(null);
  // A correction in progress holds the editor: another cell is not chosen, and the correction takes the focus back (A297).
  const choose = (key: ObservationKey) => {
    if (dirtyIds.size > 0 && (chosen?.instrumentKey !== key.instrumentKey || chosen.tradingDate !== key.tradingDate)) {
      setRefused(true);
      section.current?.querySelector<HTMLElement>('form input, form textarea')?.focus();
      return;
    }
    setChosen(key);
  };
  const reviewDate = heldReview.review.reviewDate;
  const model = gridModel({ reviewDate, tradeId, today: marks.today, earlier: opened, earlierMarks: earlierMarksOf(heldReview, tradeId), standing: (key) => heldStanding(heldReview, key) });
  // A link names the Instrument: its Review Date cell is chosen, and its editor's first control takes focus.
  const { count: linked, instrument: linkedInstrument } = link ?? { count: 0 };
  const [handledLink, setHandledLink] = useState(0);
  if (linked !== handledLink) {
    setHandledLink(linked);
    if (linkedInstrument !== undefined) setChosen({ instrumentKey: linkedInstrument, tradingDate: reviewDate });
  }
  // The cell is found by its name: the Instrument's label, which a contract's key is not (K18).
  const linkedInstrumentLabel = model.instruments.find((i) => i.instrumentKey === linkedInstrument)?.instrument;
  const linkedCell = linkedInstrumentLabel && `${instrumentLabel(linkedInstrumentLabel, timeZone)} Mark, ${shortDate(reviewDate)}`;
  useEffect(() => {
    if (handledLink === 0 || linkedCell === undefined) return;
    [...(section.current?.querySelectorAll<HTMLElement>('table input, table button') ?? [])].find((control) => control.getAttribute('aria-label') === linkedCell)?.focus();
  }, [handledLink, linkedCell]);
  const standing = (key: ObservationKey, listed: Standing): Standing => heldStanding(heldReview, key) ?? listed;
  const count = Object.keys(drafts).length;
  // The card holds while any draft does (A156); leaving the panel abandons them. A read-only card shows no draft
  // fields and no Discard, so it holds nothing: the drafts stay unsaved in state, but they cannot keep the card open.
  const held = writable && count > 0;
  useEffect(() => onEntryDirty('marks', held), [held, onEntryDirty]);
  useEffect(() => () => onEntryDirty('marks', false), [onEntryDirty]);
  const saveButton = useRef<HTMLButtonElement>(null);
  // The walked Trades with a due settlement, from their card progress: a Mark only they need is said so in its editor (A112).
  const walkedTrades = heldReview.review.families.flatMap((family) => (family.family === 'Trades' ? family.trades : []));
  const settlementTrades = new Set(walkedTrades.filter((trade) => trade.progress.panels.some((p) => p.panel === 'Settlement' && !p.done)).map((trade) => trade.tradeId));
  const panel: Panel = { facade, writable, uid, draftOf: (key) => draftAt(drafts, key)?.value, hold, issues, notices, standing, onResult, onEntryDirty: entryDirty, onMarkSaved, settlementTrades };
  const instrumentOf = (instrumentKey: string): Instrument => model.instruments.find((i) => i.instrumentKey === instrumentKey)!.instrument;
  const revisionOf = (key: ObservationKey) => {
    const cell = model.cellAt(key.instrumentKey, key.tradingDate);
    return cell === undefined || cell === NOT_HELD ? undefined : cell.revision;
  };
  const save = async () => {
    const sent = Object.values(drafts);
    const prepared = saveEntries(drafts, revisionOf);
    // Market Data takes 100 entries at once: the words for more are T9R2.13's.
    if (prepared.kind === 'TooMany') return;
    setSaving(true);
    let result: SaveReviewMarksResult | undefined;
    try {
      result = await onSaveMarks(prepared.entries);
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
        const draft = sent[conflicted.entryIndex];
        return draft ? [{ id: rowId(draft.key.instrumentKey, draft.key.tradingDate), key: draft.key, conflicted }] : [];
      });
      onResult({ kind: 'MarksConflict', moved: moved.map(({ key, conflicted }) => ({ key, resolution: conflicted.resolution, resolutionRevision: conflicted.resolutionRevision })) });
      setNotices(Object.fromEntries(moved.map(({ id, conflicted }) => [id, conflicted.code === 'MarkExists' ? 'A Mark already exists for this date, so it cannot be marked unavailable. Nothing was saved.' : 'This Mark changed after you opened it. Nothing was saved. The current Mark is shown above, and your values are kept.'])));
      if (moved[0]) setChosen(moved[0].key);
    } else if (result.kind === 'MarksSaved') {
      // A draft typed or changed while the save was pending is not what was sent, so it stays.
      setDrafts((current) =>
        sent.reduce((rest, draft) => {
          const now = draftAt(rest, draft.key);
          return now && JSON.stringify(now.value) === JSON.stringify(draft.value) ? clearDraft(rest, draft.key) : rest;
        }, current),
      );
    } else if (result.kind === 'Rejected') {
      // Each entry's issues sit with its key, in the order the entries were sent in.
      const found = result.issues.flatMap((issue) => {
        const draft = 'entryIndex' in issue && issue.entryIndex !== undefined ? sent[issue.entryIndex] : undefined;
        if (!draft || !('field' in issue)) return [];
        const id = rowId(draft.key.instrumentKey, draft.key.tradingDate);
        return describeMarkIssues([issue], `${uid}-${id}`, instrumentOf(draft.key.instrumentKey)).map((described) => ({ id, key: draft.key, issue: draft.value.kind === 'CantGetPrice' && described.code === 'ReasonRequired' ? { ...described, message: "Enter why you can't get a price." } : described }));
      });
      setIssues(Object.fromEntries([...new Set(found.map((f) => f.id))].map((id) => [id, found.filter((f) => f.id === id).map((f) => f.issue)])));
      const first = found[0];
      if (first) {
        // The first refused key opens its editor and takes focus (A294); the others show on their cells.
        setChosen(first.key);
        setFocusField({ field: first.issue.field });
      } else setFailure('failed');
    } else setFailure(result.kind === 'ReviewChanged' ? 'changed' : 'failed');
  };
  // Discard drops every draft, and with them what a refused save said about them.
  const discard = () => {
    setDrafts(discardAll());
    setIssues({});
    setNotices({});
    setFailure(undefined);
  };
  if (marks.today.length === 0 && opened.length === 0) return null;
  // The chosen cell's editor, when the cell holds a Mark or can take one.
  const chosenCell = chosen && model.cellAt(chosen.instrumentKey, chosen.tradingDate);
  const todayRow: MarkRow | undefined = chosen && chosen.tradingDate === heldReview.review.reviewDate ? marks.today.find((row) => row.instrumentKey === chosen.instrumentKey) : undefined;
  // A shared Instrument names the other Trades that hold it, by their summary line (A153, decision 67).
  const others = todayRow?.trades.filter((id) => id !== tradeId) ?? [];
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
      <MarksGrid
        model={model}
        writable={writable}
        draftOf={panel.draftOf}
        onPrice={(key, price) => hold(key, { kind: 'Price', price })}
        fieldOf={(key) => ({ id: fieldIds(uid, rowId(key.instrumentKey, key.tradingDate)).price, invalid: (issues[rowId(key.instrumentKey, key.tradingDate)] ?? []).some((issue) => issue.field === fieldIds(uid, rowId(key.instrumentKey, key.tradingDate)).price) })}
        chosen={chosen}
        onChoose={choose}
        onLastEnter={() => saveButton.current?.focus()}
        pagingHeld={dirtyIds.size > 0}
      />
      {opened.length > 0 && <p>Earlier sessions don't block the Review.</p>}
      {refused && dirtyIds.size > 0 && <p role="status">Save or cancel the correction to choose another cell.</p>}
      {chosen && chosenCell && chosenCell !== NOT_HELD && (
        <CellEditor key={rowId(chosen.instrumentKey, chosen.tradingDate)} panel={panel} instrumentKey={chosen.instrumentKey} instrument={instrumentOf(chosen.instrumentKey)} tradingDate={chosen.tradingDate} listed={chosenCell} withdraw={todayRow !== undefined}>
          {todayRow?.task === 'Manual' && todayRow.trades.every((id) => settlementTrades.has(id)) && <p>{SETTLEMENT_ONLY_NOTE}</p>}
          {others.length > 0 && (
            <p>
              also held by{' '}
              {others.map((id, i) => (
                <span key={id}>
                  {i > 0 && ', '}
                  <Link to={`/trades/${id}`}>{tradeLine(id)}</Link>
                </span>
              ))}
            </p>
          )}
        </CellEditor>
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
