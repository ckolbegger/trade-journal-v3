import { useNavigate } from 'react-router';
import { plural } from '../../format.ts';
import type { ShellProps } from '../placeholder.ts';
import { priceHistoryProps, replayOf } from './price-history.props.ts';
import type { PriceHistoryProps } from './price-history.types.ts';

// W9, P99: every session in one table, newest on the left, with no paging.
export function PriceHistoryTable({ rowLabels, columns, missingCount, onOpenReview }: PriceHistoryProps) {
  if (columns.length === 0) return <p>No sessions yet: the first ends once the Trade's first session ends.</p>;
  return (
    <>
    <table className="price-history">
      <thead>
        <tr>
          <th scope="col">Session</th>
          {columns.map((column) => (
            <th key={`${column.weekday}-${column.date}`} scope="col">
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
            {columns.map((column) => {
              const cell = column.cells[row];
              return (
                <td key={`${column.weekday}-${column.date}`} className={cell?.tone}>
                  {cell ? cell.text : <span role="img" aria-label="No Mark">—</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
    {missingCount > 0 && (
      <p className="price-history-gaps">
        {plural(missingCount, 'session', 'sessions')} without Marks.{' '}
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onOpenReview();
          }}
        >
          Enter Marks in the Review
        </a>
      </p>
    )}
    </>
  );
}

// The Price History drawer. Without a replay (the Detail reads one from T8P.22) it renders nothing.
export function PriceHistory({ view }: ShellProps) {
  const navigate = useNavigate();
  const replay = replayOf(view);
  return replay ? <PriceHistoryTable {...priceHistoryProps(replay, () => void navigate('/'))} /> : null;
}
