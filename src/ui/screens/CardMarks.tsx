import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { UiFacade } from '../../app/compose.ts';
import type { MarkResolution, MarkRow, ObservationKey } from '../../app/types.ts';
import type { Instrument } from '../../domain/instrument/index.ts';
import { instrumentLabel } from '../calculation-words.ts';
import { shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { fieldIssues } from './form-issues.tsx';
import { earlierMarksOf, instrumentOf as heldInstrument, standing as heldStanding, type CardMarkRows, type Held, type HeldResult, type Standing } from './held-review.ts';
import { CANT_GET_A_PRICE, gridModel, NOT_HELD } from './marks-grid.ts';
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

// A typed price, or "Can't get a price" with its reason, is a draft the Review holds until Save Marks (A153, P156).
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
  // The Review's Mark drafts and its one Save Marks (P156, P157).
  readonly markDrafts: MarkDrafts;
  // A Trade's name in a sentence, "XYZ (Long 100 shares @ $50.18)" (A150): the cell that shows a draft typed in another Trade says which.
  readonly tradeName: (tradeId: string) => string;
  // The Marks are saved but the figures were not read under them (A157).
  readonly outOfDate: boolean;
  // Reads the Review and the card again; false when that could not be done.
  readonly onRefresh: () => Promise<boolean>;
  // A link to an Instrument's Mark (A161): its Review Date cell's editor opens and takes focus.
  readonly link?: { readonly count: number; readonly instrument?: string };
}

// The Marks panel of an open card (A153, P158): the Trade's Marks grid. A typed price or a "Can't get a price" is a draft until
// Save Marks; the chosen cell's editor keeps the per-key Correct and Withdraw of a Mark.
export function CardMarks({ facade, tradeId, marks, held: heldReview, onResult, tradeLine, tradeName, onEntryDirty, onMarkSaved, markDrafts, outOfDate, onRefresh, link }: CardMarksProps) {
  const uid = useId();
  const { writable, timeZone } = useRuntime();
  // The earlier sessions as the card opened: a session filled meanwhile stays a column, with its saved Mark, until the card is closed.
  const [opened] = useState(marks.earlier);
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
  // The drafts are the Review's: a draft typed here is typed in this card's Trade. An empty price is no draft.
  const { drafts, count, rejections, notices, failure, tooMany, saving, reveal } = markDrafts;
  const holdDraft = markDrafts.hold;
  const hold = useCallback((key: ObservationKey, value: DraftValue | undefined) => holdDraft(key, value, tradeId), [holdDraft, tradeId]);
  // What a refused save said about each key, worded under this card's field ids.
  const issues: Readonly<Record<string, readonly FieldIssue[]>> = Object.fromEntries(
    Object.entries(rejections).flatMap(([id, rejection]) => {
      const key = drafts[id]?.key;
      if (key === undefined) return [];
      const described = describeMarkIssues(rejection.issues, `${uid}-${id}`, heldInstrument(heldReview, key.instrumentKey)).map((issue) => (rejection.draft === 'CantGetPrice' && issue.code === 'ReasonRequired' ? { ...issue, message: "Enter why you can't get a price." } : issue));
      return [[id, described]];
    }),
  );
  // A refused save takes focus to its first issue; a draft moved here takes focus in its input.
  const [focusField, setFocusField] = useState<{ readonly field: string }>();
  useEffect(() => {
    if (focusField) document.getElementById(focusField.field)?.focus();
  }, [focusField]);
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
    // A draft typed in another Trade moves its input here, and the input takes the focus (A293).
    const draft = draftAt(drafts, key);
    if (draft !== undefined && draft.tradeId !== tradeId) {
      markDrafts.move(key, tradeId);
      setFocusField({ field: fieldIds(uid, rowId(key.instrumentKey, key.tradingDate))[draft.value.kind === 'Price' ? 'price' : 'reason'] });
    }
    setChosen(key);
  };
  // A refused save, or a Conflict, shows its first key's cell here when the key is in this grid (A294).
  const [handledReveal, setHandledReveal] = useState(reveal?.count ?? 0);
  if (reveal !== undefined && reveal.count !== handledReveal) {
    setHandledReveal(reveal.count);
    setChosen(reveal.key);
    const field = issues[rowId(reveal.key.instrumentKey, reveal.key.tradingDate)]?.[0]?.field;
    if (reveal.focus && field !== undefined) setFocusField({ field });
  }
  const reviewDate = heldReview.review.reviewDate;
  const model = gridModel({ reviewDate, tradeId, today: marks.today, earlier: opened, earlierMarks: earlierMarksOf(heldReview, tradeId), standing: (key) => heldStanding(heldReview, key) });
  // A link names the Instrument: its Review Date cell is chosen, and its editor's first control takes focus.
  const { count: linked, instrument: linkedInstrument } = link ?? { count: 0 };
  const [handledLink, setHandledLink] = useState(0);
  // A link is refused as a press is, and the correction keeps the focus.
  const [linkRefused, setLinkRefused] = useState(false);
  if (linked !== handledLink) {
    setHandledLink(linked);
    const key = linkedInstrument === undefined ? undefined : { instrumentKey: linkedInstrument, tradingDate: reviewDate };
    setLinkRefused(key !== undefined && correctionHolds(key));
    if (key !== undefined) {
      if (correctionHolds(key)) setRefused(true);
      else setChosen(key);
    }
  }
  // The cell is found by its name: the Instrument's label, which a contract's key is not (K18).
  const linkedInstrumentLabel = model.instruments.find((i) => i.instrumentKey === linkedInstrument)?.instrument;
  const linkedCell = linkedInstrumentLabel && `${instrumentLabel(linkedInstrumentLabel, timeZone)} Mark, ${shortDate(reviewDate)}`;
  useEffect(() => {
    if (handledLink === 0 || linkedCell === undefined) return;
    if (linkRefused) {
      focusCorrection();
      return;
    }
    [...(section.current?.querySelectorAll<HTMLElement>('table input, table button') ?? [])].find((control) => control.getAttribute('aria-label') === linkedCell)?.focus();
  }, [handledLink, linkedCell, linkRefused]);
  const standing = (key: ObservationKey, listed: Standing): Standing => heldStanding(heldReview, key) ?? listed;
  const saveButton = useRef<HTMLButtonElement>(null);
  // The walked Trades with a due settlement, from their card progress: a Mark only they need is said so in its editor (A112).
  const walkedTrades = heldReview.review.families.flatMap((family) => (family.family === 'Trades' ? family.trades : []));
  const settlementTrades = new Set(walkedTrades.filter((trade) => trade.progress.panels.some((p) => p.panel === 'Settlement' && !p.done)).map((trade) => trade.tradeId));
  const panel: Panel = { facade, writable, uid, draftOf: (key) => draftAt(drafts, key)?.value, hold, issues, notices, standing, onResult, onEntryDirty: entryDirty, onMarkSaved, settlementTrades };
  const instrumentOf = (instrumentKey: string): Instrument => model.instruments.find((i) => i.instrumentKey === instrumentKey)!.instrument;
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
        typedIn={(key) => {
          const draft = draftAt(drafts, key);
          return draft !== undefined && draft.tradeId !== tradeId ? tradeName(draft.tradeId) : undefined;
        }}
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
            <button type="button" className="pill secondary" onClick={() => void onRefresh().then((ok) => markDrafts.setFailure(ok ? undefined : 'changed'))}>
              Refresh
            </button>
          )}
        </div>
      )}
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
