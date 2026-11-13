import { useNavigate } from 'react-router';
import { plural } from '../../format.ts';
import type { ShellProps } from '../placeholder.ts';
import { priceHistoryProps, replayOf } from './price-history.props.ts';
import type { PriceHistoryProps } from './price-history.types.ts';

// The Review route (`review` in src/app/routes.ts); the link's href and the navigation use it together.
const REVIEW_PATH = '/review';

// W9, P99: every session in one table, newest on the left, with no paging.
export function PriceHistoryTable({ rowLabels, columns, missingCount, onOpenReview }: PriceHistoryProps) {
  if (columns.length === 0) return <p>No sessions yet: the first ends once the Trade's first session ends.</p>;
  return (
    <>
    <div className="table-scroll" role="region" aria-label="Price History" tabIndex={0}>
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
    </div>
    {missingCount > 0 && (
      <p className="price-history-gaps">
        {plural(missingCount, 'session', 'sessions')} without Marks.{' '}
        <a
          href={REVIEW_PATH}
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
  return replay ? <PriceHistoryTable {...priceHistoryProps(replay, () => void navigate(REVIEW_PATH))} /> : null;
}
