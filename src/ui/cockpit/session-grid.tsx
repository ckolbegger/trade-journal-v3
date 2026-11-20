import { useEffect, useId, useRef, useState } from 'react';
import { Badge } from '../Badge.tsx';
import type { GridCell, SessionGridFrame, SessionGridProps } from './session-grid.types.ts';

// W71: the tag under the Review Date's and the previous session's headers.
const ROLE_TAG = { 'review-date': 'Review Date', previous: 'Previous' } as const;

// P161: under 40rem of width the grid turns.
const TURN_BELOW_REM = 40;

// The session grid's frame (P159): every session as a column, newest on the left, one row per label. The scroll region keeps the row labels pinned.
export function SessionGrid({ label, tableClass, rowLabels, columns, chosen, layout, onPressCell }: SessionGridProps & SessionGridFrame) {
  const uid = useId();
  // The card's width decides the turn (P161). A container query cannot transpose a table, so the grid measures its own region.
  const region = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (layout !== 'auto' || !region.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      if (entry) setNarrow(entry.contentRect.width < TURN_BELOW_REM * rem);
    });
    observer.observe(region.current);
    return () => observer.disconnect();
  }, [layout]);
  const turned = layout === 'turned' || (layout === 'auto' && narrow);
  // A cell that can be chosen is a button that reports its id and shows as pressed while it is the chosen one (P160).
  const pressProps = (id: string | undefined) =>
    id === undefined ? {} : { 'aria-pressed': id === chosen, onClick: () => onPressCell?.(id) };
  const cellView = (cell: GridCell | null, key: string) => {
    if (cell && 'input' in cell) {
      return (
        <td key={key}>
          <input type="text" inputMode="decimal" className="session-grid-control" aria-label={cell.label} value={cell.input.value} onChange={(event) => cell.input.onChange(event.target.value)} />
        </td>
      );
    }
    if (cell && 'notHeld' in cell) {
      return (
        <td key={key}>
          <span role="img" aria-label="Not held">—</span>
        </td>
      );
    }
    if (cell?.unsaved) {
      const typedIn = `${uid}-typed-${key}`;
      return (
        <td key={key}>
          <button type="button" className="session-grid-control session-grid-draft" aria-label={cell.label} aria-describedby={typedIn} {...pressProps(cell.id)}>
            {cell.text}
            <small>Unsaved</small>
          </button>
          <span id={typedIn} hidden>{`Typed in ${cell.unsaved.typedIn}`}</span>
        </td>
      );
    }
    const value = (
      <>
        {cell ? cell.text : <span role="img" aria-label="No Mark">—</span>}
        {cell?.corrected && (
          // The cell's accessible name already says "Corrected: <reason>", so the visible marker stays out of the accessibility tree.
          <span className="price-history-corrected" aria-hidden="true">
            <Badge tone="info">Corrected</Badge>
          </span>
        )}
      </>
    );
    const pressable = cell?.id !== undefined;
    return (
      <td key={key} className={cell?.tone} title={cell?.provenance} aria-label={pressable ? undefined : cell?.label}>
        {pressable ? (
          <button type="button" className="session-grid-control session-grid-press" aria-label={cell.label} {...pressProps(cell.id)}>
            {value}
          </button>
        ) : (
          value
        )}
      </td>
    );
  };
  const sessionHead = (column: SessionGridProps['columns'][number]) => (
    <>
      <span>{column.weekday}</span>
      <span>{column.date}</span>
      {column.role && <em>{ROLE_TAG[column.role]}</em>}
    </>
  );
  // Turned (P161): the same cells and names, sessions down the side and one column per label.
  const turnedTable = (
    <table className={tableClass} data-layout="turned">
      <thead>
        <tr>
          <th scope="col">Session</th>
          {rowLabels.map((rowLabel) => (
            <th key={rowLabel} scope="col">{rowLabel}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {columns.map((column, index) => (
          <tr key={`${column.weekday}-${column.date}`}>
            <th scope="row" data-session={column.session}>{sessionHead(column)}</th>
            {rowLabels.map((rowLabel, row) => cellView(column.cells[row] ?? null, `${row}-${index}`))}
          </tr>
        ))}
      </tbody>
    </table>
  );
  const wideTable = (
    <table className={tableClass}>
      <thead>
        <tr>
          <th scope="col">Session</th>
          {columns.map((column) => (
            <th key={`${column.weekday}-${column.date}`} scope="col" data-session={column.session}>
              {sessionHead(column)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rowLabels.map((label, row) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            {columns.map((column, index) => cellView(column.cells[row] ?? null, `${row}-${index}`))}
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div ref={region} className="table-scroll" role="region" aria-label={label} tabIndex={0}>
    {turned ? turnedTable : wideTable}
    </div>
  );
}
