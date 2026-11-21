import { useId, useState } from 'react';
import type { ObservationKey } from '../../app/types.ts';
import type { Instrument } from '../../domain/instrument/index.ts';
import { SessionGrid } from '../cockpit/session-grid.tsx';
import type { SessionGridProps } from '../cockpit/session-grid.types.ts';
import { acknowledgedUnavailableStatusLabel, instrumentLabel } from '../calculation-words.ts';
import { decimalMoney, decimalUnderlyingPrice, shortDate } from '../format.ts';
import { useRuntime } from '../runtime.tsx';
import { CANT_GET_A_PRICE, NOT_HELD, type GridModel } from './marks-grid.ts';
import type { DraftValue } from './review-drafts.ts';

// "<symbol> Mark", "Call Mark" or "Put Mark", as Price History headed its rows (W9).
const rowLabel = (instrument: Instrument): string => (instrument.kind === 'Stock' ? `${instrument.symbol} Mark` : `${instrument.right} Mark`);

// Earlier sessions show 20 to a page; the Review Date and previous columns stay on every page (A296).
const SESSIONS_PER_PAGE = 20;


export interface MarksGridProps {
  readonly model: GridModel;
  readonly writable: boolean;
  // What was entered for a key, or nothing.
  readonly draftOf: (key: ObservationKey) => DraftValue | undefined;
  // The name of the Trade a key's draft was typed in, when that is not this grid's Trade: the cell shows it as Unsaved text (A293).
  readonly typedIn: (key: ObservationKey) => string | undefined;
  readonly onPrice: (key: ObservationKey, price: string) => void;
  // The key's price input: its element id, and whether a refused save said something about it.
  readonly fieldOf: (key: ObservationKey) => { readonly id: string; readonly invalid: boolean };
  // The chosen cell (P160): pressing a cell, or focusing its input, chooses it.
  readonly chosen?: ObservationKey;
  readonly onChoose: (key: ObservationKey) => void;
  // Enter in the last price on the page moves on to Save Marks.
  readonly onLastEnter: () => void;
  // Paging waits while a correction is in progress (A296, W80).
  readonly pagingHeld: boolean;
}

type Cell = SessionGridProps['columns'][number]['cells'][number];

const idOf = (key: ObservationKey): string => `${key.instrumentKey}:${key.tradingDate}`;

// The Review's Marks grid (P158): the shared session grid with the Review's cells. Rows are the Trade's Instruments, columns its sessions.
export function MarksGrid({ model, writable, draftOf, typedIn, onPrice, fieldOf, chosen, onChoose, onLastEnter, pagingHeld }: MarksGridProps) {
  const { timeZone } = useRuntime();
  const [page, setPage] = useState(0);
  const holdId = useId();
  // The prices on the page in Enter order: down a session's column, then the next session's (A295).
  const inputs: string[] = [];
  const enterFrom = (label: string, from: HTMLInputElement) => {
    const next = inputs[inputs.indexOf(label) + 1];
    const field = next === undefined ? undefined : [...(from.closest('table')?.querySelectorAll('input') ?? [])].find((input) => input.getAttribute('aria-label') === next);
    if (field) field.focus();
    else onLastEnter();
  };
  const fixed = model.sessions.filter(({ role }) => role !== undefined);
  const earlier = model.sessions.filter(({ role }) => role === undefined);
  // A cell chosen on another page (a refused save's key) brings its page up.
  const [shownFor, setShownFor] = useState<ObservationKey>();
  if (chosen !== shownFor) {
    setShownFor(chosen);
    const at = chosen === undefined ? -1 : earlier.findIndex(({ date }) => date === chosen.tradingDate);
    if (at >= 0) setPage(Math.floor(at / SESSIONS_PER_PAGE));
  }
  const first = page * SESSIONS_PER_PAGE;
  const shown = earlier.slice(first, first + SESSIONS_PER_PAGE);
  const optionTrade = model.instruments.some(({ instrument }) => instrument.kind === 'Option');
  const keys = new Map<string, ObservationKey>();
  const columns: SessionGridProps['columns'] = [...fixed, ...shown].map(({ date, role }) => {
    const [weekday = '', ...rest] = shortDate(date).split(' ');
    const cells = model.instruments.map(({ instrumentKey, instrument }): Cell => {
      const key = { instrumentKey, tradingDate: date };
      const label = `${instrumentLabel(instrument, timeZone)} Mark, ${shortDate(date)}`;
      const state = model.cellAt(instrumentKey, date);
      if (state === undefined) return null;
      if (state === NOT_HELD) return { notHeld: true };
      const id = idOf(key);
      keys.set(id, key);
      const draft = draftOf(key);
      const elsewhere = typedIn(key);
      if (draft !== undefined && elsewhere !== undefined && writable) return { text: draft.kind === 'Price' ? draft.price : CANT_GET_A_PRICE, label, id, unsaved: { typedIn: elsewhere } };
      if (state.resolution.kind === 'Missing' && !writable) return { text: 'Missing', label, id };
      if (state.resolution.kind === 'Missing') {
        if (draft?.kind === 'CantGetPrice') return { text: CANT_GET_A_PRICE, label, id };
        inputs.push(label);
        const field = fieldOf(key);
        return {
          label,
          input: { value: draft?.kind === 'Price' ? draft.price : '', onChange: (price) => onPrice(key, price), onEnter: (input) => enterFrom(label, input), onFocus: () => onChoose(key), id: field.id, invalid: field.invalid },
        };
      }
      if (state.resolution.kind === 'AcknowledgedUnavailable') return { text: acknowledgedUnavailableStatusLabel(), label, id };
      const { price } = state.resolution.mark;
      return { text: instrument.kind === 'Stock' && optionTrade ? decimalUnderlyingPrice(price) : decimalMoney(price), label, id, ...(state.resolution.mark.correctionReason !== undefined && { corrected: true as const }) };
    });
    return { session: date, weekday, date: rest.join(' '), ...(role && { role }), cells };
  });
  const paging = { disabled: pagingHeld, 'aria-describedby': pagingHeld ? holdId : undefined };
  return (
    <div>
      <SessionGrid
        label="Marks by session"
        tableClass="price-history"
        rowLabels={model.instruments.map(({ instrument }) => rowLabel(instrument))}
        columns={columns}
        layout="auto"
        chosen={chosen && idOf(chosen)}
        onPressCell={(id) => {
          const key = keys.get(id);
          if (key) onChoose(key);
        }}
      />
      {earlier.length > SESSIONS_PER_PAGE && (
        <p>
          Sessions {first + 1} to {first + shown.length} of {earlier.length}
          {pagingHeld && <span id={holdId}> Save or cancel the correction to change pages.</span>}
          {page > 0 && (
            <button type="button" className="pill secondary" {...paging} onClick={() => setPage(page - 1)}>
              Previous page
            </button>
          )}
          {first + SESSIONS_PER_PAGE < earlier.length && (
            <button type="button" className="pill secondary" {...paging} onClick={() => setPage(page + 1)}>
              Next page
            </button>
          )}
        </p>
      )}
    </div>
  );
}
