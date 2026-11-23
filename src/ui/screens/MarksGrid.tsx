import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ObservationKey } from '../../app/types.ts';
import { markChange } from '../../domain/mark-slip/index.ts';
import { fieldIssues } from './form-issues.tsx';
import { acknowledgedUnavailableStatusLabel, instrumentLabel } from '../calculation-words.ts';
import { signed } from '../figures.ts';
import { decimalMoney, decimalUnderlyingPrice, money, shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { CANT_GET_A_PRICE, NO_PRICE, NOT_HELD, type GridModel } from './marks-grid.ts';
import type { FieldIssue } from './plan-issues.ts';
import type { DraftValue } from './review-drafts.ts';

// Earlier sessions show 20 to a page; the Review Date and previous columns stay on every page (A296).
const SESSIONS_PER_PAGE = 20;

// W113: the field's placeholder and the buttons around it.
const WHY_NO_PRICE = 'Why no price? Halted, no quote…';
// Market Data refuses a longer reason.
const MAX_REASON = 500;

export interface MarksGridProps {
  readonly model: GridModel;
  readonly reviewDate: string;
  readonly writable: boolean;
  // The skipped sessions, as optional columns, only on request (T95.12 case 5).
  readonly showEarlier: boolean;
  // What was entered for a key, or nothing.
  readonly draftOf: (key: ObservationKey) => DraftValue | undefined;
  readonly onPrice: (key: ObservationKey, price: string) => void;
  // A line beside an Instrument's Review Date price, such as "Needed only while settlement is due".
  readonly noteOf?: (instrumentKey: string) => string | undefined;
  // "Can't get a price" with its reason, and taking it back.
  readonly onNoPrice: (key: ObservationKey, reason: string) => void;
  readonly onUndo: (key: ObservationKey) => void;
  // The key's price input: its element id, and what a refused save said about it.
  // The reason's field id too, for a refused save to focus.
  readonly fieldOf: (key: ObservationKey) => { readonly id: string; readonly reasonId: string; readonly issues: readonly FieldIssue[] };
  // The chosen cell (P160): pressing a cell, or focusing its input, chooses it.
  readonly chosen?: ObservationKey;
  readonly onChoose: (key: ObservationKey) => void;
  // Enter in the last price on the page moves on to Save Marks.
  readonly onLastEnter: () => void;
  // Paging waits while a correction is in progress (A296, W80).
  readonly pagingHeld: boolean;
  // Paging shows these sessions (the Review Date, the previous one and the page's earlier ones).
  readonly onPage: (visible: readonly string[]) => void;
}

const idOf = (key: ObservationKey): string => `${key.instrumentKey}:${key.tradingDate}`;

// The Marks step's grid: one row per Instrument on the page, the previous session's Mark, the Review Date's price and the change from the
// previous Mark. The skipped sessions are optional columns, added on request.
export function MarksGrid({ model, reviewDate, writable, showEarlier, draftOf, noteOf, onPrice, onNoPrice, onUndo, fieldOf, chosen, onChoose, onLastEnter, pagingHeld, onPage }: MarksGridProps) {
  const { timeZone } = useRuntime();
  const [page, setPage] = useState(0);
  const holdId = useId();
  // A page button that goes when pressed (the last page's Next, the first page's Previous) hands focus to the other one.
  const previousButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const pressed = useRef<'previous' | 'next' | undefined>(undefined);
  useEffect(() => {
    if (pressed.current === 'next' && !nextButton.current) previousButton.current?.focus();
    if (pressed.current === 'previous' && !previousButton.current) nextButton.current?.focus();
    pressed.current = undefined;
  }, [page]);
  // The "Why no price?" field is open for one cell at a time; what is typed in it is the cell's draft, as a typed price is.
  const [asking, setAsking] = useState<{ readonly id: string; readonly refused?: true }>();
  const reasonField = useRef<HTMLInputElement | null>(null);
  // The field takes the focus as it opens.
  const reasonRef = useCallback((field: HTMLInputElement | null) => {
    reasonField.current = field;
    field?.focus();
  }, []);
  const undone = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (undone.current === undefined) return;
    document.getElementById(undone.current)?.focus();
    undone.current = undefined;
  });
  const previous = model.sessions.find(({ role }) => role === 'previous')?.date;
  const earlier = model.sessions.filter(({ role }) => role === undefined);
  // A cell chosen on another page (a refused save's key) brings its page up.
  const [shownFor, setShownFor] = useState<ObservationKey>();
  if (chosen !== shownFor) {
    setShownFor(chosen);
    const at = chosen === undefined ? -1 : earlier.findIndex(({ date }) => date === chosen.tradingDate);
    if (at >= 0) setPage(Math.floor(at / SESSIONS_PER_PAGE));
  }
  // A refused save of a "Can't get a price" opens its reason field again, with the words beside it.
  const refusedNoPrice = JSON.stringify(
    model.instruments.flatMap(({ instrumentKey }) => {
      const key = { instrumentKey, tradingDate: reviewDate };
      return draftOf(key)?.kind === 'CantGetPrice' && fieldOf(key).issues.length > 0 ? [idOf(key)] : [];
    }),
  );
  const [refusedSeen, setRefusedSeen] = useState('[]');
  if (refusedNoPrice !== refusedSeen) {
    setRefusedSeen(refusedNoPrice);
    const [id] = JSON.parse(refusedNoPrice) as string[];
    if (id !== undefined) setAsking({ id });
  }
  const first = page * SESSIONS_PER_PAGE;
  const shown = showEarlier ? earlier.slice(first, first + SESSIONS_PER_PAGE) : [];
  // Columns run oldest to newest, the Review Date last; the prices in Enter order run down a session's column, newest session first (A295).
  const dates = [...shown.map(({ date }) => date), ...(previous === undefined ? [] : [previous])].sort();
  const enterOrder = [reviewDate, ...[...dates].reverse()];
  const inputs: string[] = [];
  const keys = new Map<string, ObservationKey>();
  const cellFor = (instrumentKey: string, date: string) => {
    const instrument = model.instruments.find((i) => i.instrumentKey === instrumentKey)!.instrument;
    const key = { instrumentKey, tradingDate: date };
    const label = `${instrumentLabel(instrument, timeZone)} Mark, ${shortDate(date)}`;
    const state = model.cellAt(instrumentKey, date);
    if (state === undefined) return { kind: 'empty' as const };
    if (state === NOT_HELD) return { kind: 'notHeld' as const };
    const id = idOf(key);
    keys.set(id, key);
    const draft = draftOf(key);
    if (state.resolution.kind === 'Missing' && !writable) return { kind: 'text' as const, text: 'Missing', label, id };
    if (state.resolution.kind === 'Missing') {
      // The price cell stays an input while its reason is being asked.
      if (draft?.kind === 'CantGetPrice' && asking?.id !== id) return { kind: 'text' as const, text: NO_PRICE, label, id };
      const field = fieldOf(key);
      return { kind: 'input' as const, label, value: draft?.kind === 'Price' ? draft.price : '', field, key };
    }
    if (state.resolution.kind === 'AcknowledgedUnavailable') return { kind: 'text' as const, text: acknowledgedUnavailableStatusLabel(), label, id };
    const { price } = state.resolution.mark;
    const optionTrade = model.instruments.some((i) => i.instrument.kind === 'Option');
    return { kind: 'text' as const, text: instrument.kind === 'Stock' && optionTrade ? decimalUnderlyingPrice(price) : decimalMoney(price), label, id, corrected: state.resolution.mark.correctionReason !== undefined };
  };
  const goTo = (to: number) => {
    setPage(to);
    onPage([reviewDate, ...(previous === undefined ? [] : [previous]), ...earlier.slice(to * SESSIONS_PER_PAGE, (to + 1) * SESSIONS_PER_PAGE).map(({ date }) => date)]);
  };
  const enterFrom = (label: string, from: HTMLInputElement) => {
    const next = inputs[inputs.indexOf(label) + 1];
    const field = next === undefined ? undefined : [...(from.closest('table')?.querySelectorAll('input') ?? [])].find((input) => input.getAttribute('aria-label') === next);
    if (field) field.focus();
    else onLastEnter();
  };
  // Cells in Enter order first, so the inputs are known in that order; then each row is drawn from them.
  const cells = new Map(enterOrder.flatMap((date) => model.instruments.map(({ instrumentKey }) => [`${instrumentKey}|${date}`, cellFor(instrumentKey, date)] as const)));
  for (const date of enterOrder) for (const { instrumentKey } of model.instruments) {
    const cell = cells.get(`${instrumentKey}|${date}`)!;
    if (cell.kind === 'input') inputs.push(cell.label);
  }
  const view = (cell: ReturnType<typeof cellFor>, instrumentKey: string, date: string) => {
    if (cell.kind === 'empty') return <span role="img" aria-label="No Mark">—</span>;
    if (cell.kind === 'notHeld') return <span role="img" aria-label="Not held">—</span>;
    if (cell.kind === 'input') {
      const invalid = cell.field.issues.some((issue) => issue.field === cell.field.id);
      return (
        <input type="text" inputMode="decimal" className="session-grid-control" id={cell.field.id} aria-label={cell.label} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${cell.field.id}-error` : undefined} value={cell.value} onFocus={() => onChoose(cell.key)} onChange={(event) => onPrice(cell.key, event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            enterFrom(cell.label, event.currentTarget);
          }}
        />
      );
    }
    const id = idOf({ instrumentKey, tradingDate: date });
    return (
      <button type="button" className="session-grid-control session-grid-press" aria-label={cell.label} aria-pressed={chosen !== undefined && idOf(chosen) === id} onClick={() => onChoose(keys.get(id)!)}>
        {cell.text}
        {cell.corrected && <span className="price-history-corrected" aria-hidden="true"> Corrected</span>}
      </button>
    );
  };
  const paging = { disabled: pagingHeld, 'aria-describedby': pagingHeld ? holdId : undefined };
  return (
    <div>
      <div className="marks-step-scroll" role="region" aria-label="Marks by session" tabIndex={0}>
        <table className="marks-step-table">
          <thead>
            <tr>
              <th scope="col">Instrument</th>
              {dates.map((date) => (
                <th key={date} scope="col" data-session={date}>
                  {shortDate(date)}
                  {date !== previous && <span> · optional</span>}
                </th>
              ))}
              <th scope="col" data-session={reviewDate}>{shortDate(reviewDate)}</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {model.instruments.map(({ instrumentKey, instrument }) => {
              const today = cells.get(`${instrumentKey}|${reviewDate}`)!;
              const todayKey = { instrumentKey, tradingDate: reviewDate };
              const todayId = idOf(todayKey);
              const draft = draftOf(todayKey);
              const lastPrice = previous === undefined ? undefined : model.cellAt(instrumentKey, previous);
              const last = lastPrice && lastPrice !== NOT_HELD && lastPrice.resolution.kind === 'Available' ? lastPrice.resolution.mark.price : undefined;
              const saved = model.cellAt(instrumentKey, reviewDate);
              const savedPrice = saved && saved !== NOT_HELD && saved.resolution.kind === 'Available' ? saved.resolution.mark.price : undefined;
              const entry = draft?.kind === 'Price' ? draft.price : savedPrice;
              // CASE1-NO-CHANGE
              const change = entry === undefined || last === undefined ? undefined : markChange({ entry, previous: last });
              const issues = today.kind === 'input' ? today.field.issues.filter((issue) => issue.field === today.field.id) : [];
              const reasonId = fieldOf(todayKey).reasonId;
              // A refused "Can't get a price" has no price cell to show it in: its words sit in the row.
              const noPriceIssues = draft?.kind === 'CantGetPrice' && today.kind !== 'input' ? fieldOf(todayKey).issues : [];
              const asked = writable && asking?.id === todayId;
              const { fieldError } = fieldIssues(issues);
              return (
                <tr key={instrumentKey}>
                  <th scope="row">{instrumentLabel(instrument, timeZone)}</th>
                  {dates.map((date) => (
                    <td key={date} className={date === previous ? 'marks-step-previous' : 'marks-step-optional'} data-label={shortDate(date)}>
                      {view(cells.get(`${instrumentKey}|${date}`)!, instrumentKey, date)}
                    </td>
                  ))}
                  <td className="marks-step-today">{view(today, instrumentKey, reviewDate)}</td>
                  <td className="marks-step-change">
                    {change && (
                      <span>
                        {signed(money)(change.dollars)}
                        {change.percent !== undefined && ` (${change.percent}%)`}
                      </span>
                    )}
                    {issues.length > 0 && fieldError(today.kind === 'input' ? today.field.id : '')}
                    {/* An issue about the Mark as a whole (a date after the contract expired) has no field to sit beside. */}
                    {today.kind === 'input' && today.field.issues.filter((issue) => issue.field !== today.field.id).map((issue) => <p key={issue.field} className="field-error">{issue.message}</p>)}
                    {today.kind === 'input' && noteOf?.(instrumentKey) && <small>{noteOf(instrumentKey)}</small>}
                    {noPriceIssues.map((issue) => <p key={issue.field + issue.message} className="field-error">{issue.message}</p>)}
                    {writable && draft?.kind === 'CantGetPrice' && !asked && (
                      <>
                        <span>{draft.reason}</span>{' '}
                        <button type="button" className="link-button" onClick={() => {
                          undone.current = fieldOf(todayKey).id;
                          onUndo(todayKey);
                        }}>
                          Undo
                        </button>
                      </>
                    )}
                    {writable && today.kind === 'input' && !asked && draft === undefined && (
                      <button type="button" className="link-button" aria-label={`${CANT_GET_A_PRICE}, ${instrumentLabel(instrument, timeZone)}`} onClick={() => setAsking({ id: todayId })}>
                        {CANT_GET_A_PRICE}
                      </button>
                    )}
                    {asked && asking && (
                      <>
                        <input ref={reasonRef} id={reasonId} type="text" maxLength={MAX_REASON} placeholder={WHY_NO_PRICE} aria-label={`Why no price, ${instrumentLabel(instrument, timeZone)}`} aria-invalid={fieldOf(todayKey).issues.length > 0 || undefined} value={draft?.kind === 'CantGetPrice' ? draft.reason : ''} onChange={(event) => (event.target.value === '' ? onUndo(todayKey) : onNoPrice(todayKey, event.target.value))} />{' '}
                        <button type="button" className="pill secondary" onClick={() => {
                            if (draft?.kind !== 'CantGetPrice' || draft.reason.trim() === '') {
                              setAsking({ ...asking, refused: true });
                              reasonField.current?.focus();
                              return;
                            }
                            setAsking(undefined);
                          }}>
                          No price
                        </button>{' '}
                        <button type="button" className="link-button" onClick={() => {
                            onUndo(todayKey);
                            setAsking(undefined);
                          }}>
                          Cancel
                        </button>
                        {asking.refused && <p className="field-error">Enter why you can't get a price.</p>}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showEarlier && earlier.length > SESSIONS_PER_PAGE && (
        <p data-pager>
          Sessions {first + 1} to {first + shown.length} of {earlier.length}
          {pagingHeld && <span id={holdId}> Save or cancel the correction to change pages.</span>}
          {page > 0 && (
            <button type="button" ref={previousButton} className="pill secondary" {...paging} onClick={() => {
                pressed.current = 'previous';
                goTo(page - 1);
              }}>
              Previous page
            </button>
          )}
          {first + SESSIONS_PER_PAGE < earlier.length && (
            <button type="button" ref={nextButton} className="pill secondary" {...paging} onClick={() => {
                pressed.current = 'next';
                goTo(page + 1);
              }}>
              Next page
            </button>
          )}
        </p>
      )}
    </div>
  );
}
