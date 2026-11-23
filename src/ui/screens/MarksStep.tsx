import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { MarkResolution, MarkRow, ObservationKey } from '../../app/types.ts';
import type { Instrument } from '../../domain/instrument/index.ts';
import { instrumentLabel } from '../calculation-words.ts';
import { shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { fieldIssues } from './form-issues.tsx';
import { holdersOf, instrumentOf as heldInstrument, standing as heldStanding, type Held, type HeldResult, type Standing } from './held-review.ts';
import { CANT_GET_A_PRICE, gridModel, NOT_HELD } from './marks-grid.ts';
import { stepMarks } from './marks-step.ts';
import { MarkEntry, type MarkEntryProps } from './MarkEntry.tsx';
import { MarksGrid } from './MarksGrid.tsx';
import { describeMarkIssues, ZERO_MARK_NOTE } from './mark-issues.ts';
import type { FieldIssue } from './plan-issues.ts';
import { draftAt, type DraftValue } from './review-drafts.ts';
import type { MarkDrafts } from './useMarkDrafts.ts';

export type EntryDirty = (id: string, dirty: boolean) => void;

// A Mark entry that reports whether it holds a value under its own id; a saved one tells the card.
function ReviewMarkEntry({ instrumentKey, tradingDate, onEntryDirty, onMarkSaved, ...entry }: Omit<MarkEntryProps, 'onDirtyChange' | 'onSaved'> & { readonly onEntryDirty: EntryDirty; readonly onMarkSaved: MarkEntryProps['onSaved'] }) {
  const id = `${instrumentKey}:${tradingDate}`;
  const report = useCallback((dirty: boolean) => onEntryDirty(id, dirty), [id, onEntryDirty]);
  return <MarkEntry {...entry} instrumentKey={instrumentKey} tradingDate={tradingDate} onDirtyChange={report} onSaved={onMarkSaved} />;
}

// A Mark task only a Trade with a due settlement needs (A112, T7.24): recording the expiration removes it.
// A typed price, or "Can't get a price" with its reason, is a draft the Review holds until Save Marks (A153, P156).
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
  // Takes focus to a field by its element id, once it has rendered: a pressed control that goes hands focus on.
  readonly focus: (field: string) => void;
  // The saved Mark's draft id: once saved it is no longer an unsaved draft.
  readonly onMarkSaved: (draftId: string) => void;
  // The walked Trades whose settlement is due: a Mark only they need goes away once the expiration is recorded (A112).
  readonly settlementTrades: ReadonlySet<string>;
}

// Market Data takes 100 entries at once: Save Marks sends nothing and says so (W76).
export const tooManyWords = ({ entered, limit, over }: { readonly entered: number; readonly limit: number; readonly over: number }): string => `Save Marks takes up to ${limit} at once; ${entered} are entered. Clear ${over}, then save.`;

const rowId = (instrumentKey: string, tradingDate: string): string => `${instrumentKey}:${tradingDate}`;

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
            <button type="button" className="pill secondary" onClick={() => {
                panel.hold(tradeKey, { kind: 'CantGetPrice', reason: '' });
                panel.focus(field.reason);
              }}>
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
    // A withdrawn acknowledgment leaves the cell a price input, and the pressed Withdraw is gone: focus goes to the cell.
    if (now.resolution.kind === 'AcknowledgedUnavailable' && next.kind === 'Missing') panel.focus(fieldIds(panel.uid, id).price);
  };
  return (
    <ReviewMarkEntry facade={panel.facade} instrumentKey={instrumentKey} instrument={instrument} tradingDate={tradingDate} resolution={now.resolution} resolutionRevision={now.revision} withdraw={withdraw} offerEntry={false} titled draftStatus={panel.draftOf(key)?.kind === 'CantGetPrice' ? CANT_GET_A_PRICE : undefined} onEntryDirty={panel.onEntryDirty} onMarkSaved={saved}>
      {children}
      {panel.writable && <DraftFields panel={panel} tradeKey={key} resolution={now.resolution} />}
    </ReviewMarkEntry>
  );
}

// Where a link into the Review sends the step (A161): an Instrument's Review Date cell, chosen and focused, or the skipped sessions' columns.
// The count grows with each link, so a step that is already shown answers the next one too.
export interface MarksGo {
  readonly count: number;
  readonly instrument?: string;
  // Open the skipped sessions' columns, and focus the first one with a gap.
  readonly skipped?: true;
}

export interface MarksStepProps {
  readonly facade: UiFacade;
  // The Review the screen holds: every key's standing is read from it (P51).
  readonly held: Held;
  // Folds a per-row save and a Save Marks Conflict into the held Review.
  readonly onResult: (result: HeldResult) => void;
  // A Trade's summary line, or its Underlying when it has none.
  readonly tradeLine: (tradeId: string) => string;
  readonly onEntryDirty: EntryDirty;
  readonly onMarkSaved: (draftId: string) => void;
  // The Review's Mark drafts and its one Save Marks (P156, P157).
  readonly markDrafts: MarkDrafts;
  // The Marks are saved but the figures were not read under them (A157).
  readonly outOfDate: boolean;
  // Reads the Review and the card again; false when that could not be done.
  readonly onRefresh: () => Promise<boolean>;
  readonly go?: MarksGo;
}

// What a failed Save Marks says, with Refresh when the Review changed.
export function SaveFailure({ drafts, onRefresh }: { readonly drafts: MarkDrafts; readonly onRefresh: () => Promise<boolean> }) {
  const { failure, setFailure } = drafts;
  if (!failure) return null;
  return (
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
  );
}


// The Marks step (A153, P158): the one grid for the page. A typed price or a "Can't get a price" is a draft until Save Marks; the chosen
// cell's editor keeps the per-key Correct and Withdraw of a Mark.
export function MarksStep({ facade, held: heldReview, onResult, tradeLine, onEntryDirty, onMarkSaved, markDrafts, outOfDate, onRefresh, go }: MarksStepProps) {
  const uid = useId();
  const { writable, timeZone } = useRuntime();
  const trades = heldReview.review.families.flatMap((family) => (family.family === 'Trades' ? family.trades.map((trade) => trade.tradeId) : []));
  const marks = stepMarks(heldReview, trades);
  // The earlier sessions as the step opened: a session filled meanwhile stays a column, with its saved Mark, until the page is read again.
  const [opened] = useState(marks.earlier);
  const [showEarlier, setShowEarlier] = useState(false);
  const [chosen, setChosen] = useState<ObservationKey>();
  const [refreshFailed, setRefreshFailed] = useState(false);
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
  // The drafts are the Review's; a draft belongs to the first Trade that holds its Instrument. An empty price is no draft.
  const { drafts, count, rejections, notices, failure, tooMany, saving, reveal, settleReveal } = markDrafts;
  const holdDraft = markDrafts.hold;
  const holder = (key: ObservationKey) => holdersOf(heldReview.review, key)[0] ?? trades[0] ?? '';
  const hold = (key: ObservationKey, value: DraftValue | undefined) => holdDraft(key, value, holder(key));
  // What a refused save said about each key, worded under this step's field ids.
  const issues: Readonly<Record<string, readonly FieldIssue[]>> = Object.fromEntries(
    Object.entries(rejections).flatMap(([id, rejection]) => {
      const key = drafts[id]?.key;
      if (key === undefined) return [];
      const described = describeMarkIssues(rejection.issues, `${uid}-${id}`, heldInstrument(heldReview, key.instrumentKey)).map((issue) => (rejection.draft === 'CantGetPrice' && issue.code === 'ReasonRequired' ? { ...issue, message: "Enter why you can't get a price." } : issue));
      return [[id, described]];
    }),
  );
  // A refused save takes focus to its first issue.
  const [focusField, setFocusField] = useState<{ readonly field: string }>();
  useEffect(() => {
    if (focusField) document.getElementById(focusField.field)?.focus();
  }, [focusField]);
  const focus = useCallback((field: string) => setFocusField({ field }), []);
  const section = useRef<HTMLElement>(null);
  // A correction in progress holds the editor: another cell is not chosen, and the correction takes the focus back (A297).
  const correctionHolds = (key: ObservationKey) => dirtyIds.size > 0 && (chosen?.instrumentKey !== key.instrumentKey || chosen.tradingDate !== key.tradingDate);
  const focusCorrection = () => section.current?.querySelector<HTMLElement>('form input, form textarea')?.focus();
  const choose = (key: ObservationKey) => {
    if (correctionHolds(key)) {
      setRefused(true);
      focusCorrection();
      return;
    }
    setChosen(key);
  };
  const reviewDate = heldReview.review.reviewDate;
  // A refused save, or a Conflict, shows its first key's cell (A294): an earlier session's column opens for it. It is answered once.
  const [handledReveal, setHandledReveal] = useState(0);
  const [revealHeld, setRevealHeld] = useState(false);
  if (reveal !== undefined && reveal.count !== handledReveal) {
    setHandledReveal(reveal.count);
    // A correction in progress holds the editor as it holds a press (A297): the key stays reported by its cell, and the correction keeps the focus.
    const held = correctionHolds(reveal.key);
    setRevealHeld(held);
    if (!held) {
      setChosen({ ...reveal.key });
      if (reveal.key.tradingDate !== reviewDate) setShowEarlier(true);
      // A key with no issue (a Conflict) takes focus in its draft's input.
      const row = rowId(reveal.key.instrumentKey, reveal.key.tradingDate);
      const draftKind = draftAt(drafts, reveal.key)?.value.kind;
      const field = issues[row]?.[0]?.field ?? (draftKind === undefined ? undefined : fieldIds(uid, row)[draftKind === 'Price' ? 'price' : 'reason']);
      if (reveal.focus && field !== undefined) setFocusField({ field });
    }
  }
  const answered = reveal?.count === handledReveal ? reveal.count : undefined;
  useEffect(() => {
    if (answered !== undefined) settleReveal(answered);
  }, [answered, settleReveal]);
  useEffect(() => {
    if (revealHeld) focusCorrection();
  }, [handledReveal, revealHeld]);
  const model = gridModel({ reviewDate, today: marks.today, earlier: opened, earlierMarks: marks.earlierMarks, standing: (key) => heldStanding(heldReview, key) });
  // A link names the Instrument: its Review Date cell is chosen and takes focus. Another way names the skipped sessions: their columns open.
  const { count: linked, instrument: linkedInstrument, skipped } = go ?? { count: 0 };
  const [handledLink, setHandledLink] = useState(0);
  // A link is refused as a press is, and the correction keeps the focus.
  const [linkRefused, setLinkRefused] = useState(false);
  if (linked !== handledLink) {
    setHandledLink(linked);
    const key = linkedInstrument === undefined ? undefined : { instrumentKey: linkedInstrument, tradingDate: reviewDate };
    setLinkRefused(key !== undefined && correctionHolds(key));
    if (skipped) setShowEarlier(true);
    if (key !== undefined) {
      if (correctionHolds(key)) setRefused(true);
      else setChosen(key);
    }
  }
  // The cell is found by its name: the Instrument's label, which a contract's key is not (K18).
  const linkedInstrumentLabel = model.instruments.find((i) => i.instrumentKey === linkedInstrument)?.instrument;
  const linkedCell = linkedInstrumentLabel && `${instrumentLabel(linkedInstrumentLabel, timeZone)} Mark, ${shortDate(reviewDate)}`;
  // The first earlier session with a gap, newest first as the grid pages them: where "the skipped sessions" lead.
  const firstGap = model.sessions.find(({ role }) => role === undefined)?.date;
  const gapCell = firstGap === undefined ? undefined : model.instruments.find(({ instrumentKey }) => model.cellAt(instrumentKey, firstGap) !== undefined && model.cellAt(instrumentKey, firstGap) !== NOT_HELD);
  const gapLabel = gapCell && firstGap && `${instrumentLabel(gapCell.instrument, timeZone)} Mark, ${shortDate(firstGap)}`;
  const skippedLabel = skipped ? gapLabel : undefined;
  // The button that adds the skipped sessions goes once pressed: the focus goes to the first of them.
  const focusAfterAdd = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!showEarlier || focusAfterAdd.current === undefined) return;
    const label = focusAfterAdd.current;
    focusAfterAdd.current = undefined;
    [...(section.current?.querySelectorAll<HTMLElement>('table input, table button') ?? [])].find((control) => control.getAttribute('aria-label') === label)?.focus();
  }, [showEarlier]);
  useEffect(() => {
    if (handledLink === 0) return;
    if (linkRefused) {
      focusCorrection();
      return;
    }
    const wanted = linkedCell ?? skippedLabel;
    const controls = [...(section.current?.querySelectorAll<HTMLElement>('table input, table button') ?? [])];
    // A link that names no Instrument goes to the first price to enter.
    (wanted === undefined ? controls.find((control) => control.tagName === 'INPUT') : controls.find((control) => control.getAttribute('aria-label') === wanted))?.focus();
  }, [handledLink, linkedCell, skippedLabel, linkRefused, showEarlier]);
  const standing = (key: ObservationKey, listed: Standing): Standing => heldStanding(heldReview, key) ?? listed;
  const saveButton = useRef<HTMLButtonElement>(null);
  // The walked Trades with a due settlement, from their card progress: a Mark only they need is said so in its editor (A112).
  const walkedTrades = heldReview.review.families.flatMap((family) => (family.family === 'Trades' ? family.trades : []));
  const settlementTrades = new Set(walkedTrades.filter((trade) => trade.progress.panels.some((p) => p.panel === 'Settlement' && !p.done)).map((trade) => trade.tradeId));
  const panel: Panel = { facade, writable, uid, draftOf: (key) => draftAt(drafts, key)?.value, hold, issues, notices, standing, onResult, onEntryDirty: entryDirty, focus, onMarkSaved, settlementTrades };
  const instrumentOf = (instrumentKey: string): Instrument => model.instruments.find((i) => i.instrumentKey === instrumentKey)!.instrument;
  if (marks.today.length === 0 && opened.length === 0) return null;
  // Each cell is one tab stop and the one editor sits under the grid, so Tab goes from the chosen cell into the editor's controls and on from
  // its last control to the next cell; Shift+Tab goes back from the editor's first control to its cell (P160).
  const chosenLabel = chosen && model.instruments.some((i) => i.instrumentKey === chosen.instrumentKey) ? `${instrumentLabel(instrumentOf(chosen.instrumentKey), timeZone)} Mark, ${shortDate(chosen.tradingDate)}` : undefined;
  const throughEditor = (event: KeyboardEvent<HTMLElement>) => {
    const editor = section.current?.querySelector<HTMLElement>('[data-cell-editor]');
    if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey || !editor || chosenLabel === undefined) return;
    const cells = [...(section.current?.querySelectorAll<HTMLElement>('table input, table button') ?? [])];
    const cell = cells.find((control) => control.getAttribute('aria-label') === chosenLabel);
    const controls = [...editor.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select')].filter((control) => !(control as HTMLButtonElement).disabled);
    const target = event.target as HTMLElement;
    const move = (to: HTMLElement | undefined) => {
      if (!to) return false;
      event.preventDefault();
      to.focus();
      return true;
    };
    const go = (to: HTMLElement | undefined) => {
      // A button cell chooses on press, not on focus: choose it here too, or Tab would come back to this editor and its last control to this cell.
      if (move(to) && to!.tagName === 'BUTTON' && !event.shiftKey && target !== cell) to!.click();
    };
    // The pager sits between the grid and the editor in the page. The editor is reached from its cell, so the pager is reached from the last
    // cell's editor, and leaves for whatever follows the editor (Save Marks); Shift+Tab from there returns to the pager's last button.
    const pager = [...(section.current?.querySelectorAll<HTMLElement>('[data-pager] button') ?? [])].filter((button) => !(button as HTMLButtonElement).disabled);
    const lastControl = controls[controls.length - 1];
    const tabbable = [...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')].filter((el) => !(el as HTMLButtonElement).disabled && el.getAttribute('tabindex') !== '-1');
    const afterEditor = lastControl && tabbable[tabbable.indexOf(lastControl) + 1];
    if (!event.shiftKey && target === cell) go(controls[0]);
    else if (!event.shiftKey && target === lastControl) {
      const nextCell = cells[cells.indexOf(cell as HTMLElement) + 1];
      if (nextCell) go(nextCell);
      else move(pager[0]);
    } else if (!event.shiftKey && pager.length > 0 && target === pager[pager.length - 1]) move(afterEditor || undefined);
    else if (event.shiftKey && target === controls[0]) go(cell);
    else if (event.shiftKey && pager.length > 0 && afterEditor && target === afterEditor) move(pager[pager.length - 1]);
  };
  // The chosen cell's editor, when the cell holds a Mark or can take one.
  const chosenCell = chosen && model.cellAt(chosen.instrumentKey, chosen.tradingDate);
  const todayRow: MarkRow | undefined = chosen && chosen.tradingDate === heldReview.review.reviewDate ? marks.today.find((row) => row.instrumentKey === chosen.instrumentKey) : undefined;
  // The Review Date's cell of an Instrument still to be priced is typed in the grid itself, with "Can't get a price" beside it: no editor.
  const inGrid = chosen !== undefined && chosen.tradingDate === reviewDate && chosenCell !== undefined && chosenCell !== NOT_HELD && chosenCell.resolution.kind === 'Missing';
  // A shared Instrument names the Trades that hold it, by their summary line (A153, decision 67).
  const heldBy = todayRow?.trades ?? [];
  return (
    <section className="marks-step" aria-labelledby={`${uid}-marks`} ref={section} onKeyDown={throughEditor}>
      <h2 id={`${uid}-marks`}>Marks for {shortDate(reviewDate)}</h2>
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
        reviewDate={reviewDate}
        writable={writable}
        showEarlier={showEarlier}
        draftOf={panel.draftOf}
        noteOf={(instrumentKey) => {
          const row = marks.today.find((r) => r.instrumentKey === instrumentKey);
          return row?.task === 'Manual' && row.trades.every((id) => settlementTrades.has(id)) ? SETTLEMENT_ONLY_NOTE : undefined;
        }}
        onPrice={(key, price) => hold(key, { kind: 'Price', price })}
        onNoPrice={(key, reason) => hold(key, { kind: 'CantGetPrice', reason })}
        onUndo={(key) => hold(key, undefined)}
        fieldOf={(key) => {
          const id = rowId(key.instrumentKey, key.tradingDate);
          return { id: fieldIds(uid, id).price, issues: issues[id] ?? [] };
        }}
        chosen={chosen}
        onChoose={choose}
        onLastEnter={() => saveButton.current?.focus()}
        pagingHeld={dirtyIds.size > 0}
        onPage={(visible) => {
          // An editor whose cell is not on the shown page closes; a draft in it stays (P160).
          if (chosen !== undefined && !visible.includes(chosen.tradingDate)) setChosen(undefined);
        }}
      />
      {!showEarlier && model.sessions.some(({ role }) => role === undefined) && (
        <p>
          <button type="button" className="pill secondary" onClick={() => {
              focusAfterAdd.current = gapLabel;
              setShowEarlier(true);
            }}>
            Add the skipped sessions
          </button>
        </p>
      )}
      {opened.length > 0 && (showEarlier || !model.sessions.some(({ role }) => role === undefined)) && <p>Earlier sessions don't block the Review.</p>}
      {walkedTrades.some((trade) => trade.expiresOnReviewDate) && <p>Expired worth nothing: enter 0.</p>}
      {inGrid && <p className="hint">{ZERO_MARK_NOTE}</p>}
      {refused && dirtyIds.size > 0 && <p role="status">Save or cancel the correction to choose another cell.</p>}
      {chosen && chosenCell && chosenCell !== NOT_HELD && !inGrid && (
        <div data-cell-editor>
          <CellEditor key={rowId(chosen.instrumentKey, chosen.tradingDate)} panel={panel} instrumentKey={chosen.instrumentKey} instrument={instrumentOf(chosen.instrumentKey)} tradingDate={chosen.tradingDate} listed={chosenCell} withdraw={todayRow !== undefined}>
            {todayRow?.task === 'Manual' && todayRow.trades.every((id) => settlementTrades.has(id)) && <p>{SETTLEMENT_ONLY_NOTE}</p>}
            {heldBy.length > 1 && (
              <p>
                held by{' '}
                {heldBy.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ', '}
                    <Link to={`/trades/${id}`}>{tradeLine(id)}</Link>
                  </span>
                ))}
              </p>
            )}
          </CellEditor>
        </div>
      )}
      {failure && <SaveFailure drafts={markDrafts} onRefresh={onRefresh} />}
      {writable && (
        <p>
          <button type="button" ref={saveButton} className="pill primary" disabled={count === 0 || saving} onClick={() => void markDrafts.save()}>
            Save Marks ({count})
          </button>
          <button type="button" className="pill secondary" disabled={count === 0} onClick={markDrafts.discard}>
            Discard
          </button>
        </p>
      )}
      {writable && tooMany && <p role="status">{tooManyWords(tooMany)}</p>}
    </section>
  );
}
