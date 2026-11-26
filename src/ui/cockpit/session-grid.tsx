import { Badge } from '../Badge.tsx';
import type { GridCell, SessionGridFrame, SessionGridProps } from './session-grid.types.ts';

// The session grid's frame (P159): every session as a column, newest on the left, one row per label. The scroll region keeps the row labels pinned.
export function SessionGrid({ label, tableClass, rowLabels, columns }: SessionGridProps & SessionGridFrame) {
  const cellView = (cell: GridCell | null, key: string) => (
    <td key={key} className={cell?.tone} title={cell?.provenance} aria-label={cell?.label}>
      {cell ? cell.text : <span role="img" aria-label="No Mark">—</span>}
      {cell?.corrected && (
        // The cell's accessible name already says "Corrected: <reason>", so the visible marker stays out of the accessibility tree.
        <span className="price-history-corrected" aria-hidden="true">
          <Badge tone="info">Corrected</Badge>
        </span>
      )}
    </td>
  );
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className={tableClass}>
        <thead>
          <tr>
            <th scope="col">Session</th>
            {columns.map((column) => (
              <th key={`${column.weekday}-${column.date}`} scope="col" data-session={column.session}>
                <span>{column.weekday}</span>
                <span>{column.date}</span>
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
    </div>
  );
}
