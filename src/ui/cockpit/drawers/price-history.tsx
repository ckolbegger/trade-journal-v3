import { useNavigate } from 'react-router';
import { ROUTES } from '../../../app/routes.ts';
import { acknowledgedUnavailableStatusLabel } from '../../calculation-words.ts';
import { plural } from '../../format.ts';
import { Badge } from '../../Badge.tsx';
import type { ShellProps } from '../placeholder.ts';
import { priceHistoryProps, type ReplaySource } from './price-history.props.ts';
import type { PriceHistoryProps } from './price-history.types.ts';

// The Review route (`review` in src/app/routes.ts); the link's href and the navigation use it together.
const REVIEW_PATH = ROUTES.find((route) => route.id === 'review')!.path;

// W9, P99: every session in one table, newest on the left, with no paging.
export function PriceHistoryTable({ rowLabels, columns, missingCount, acknowledgedCount, onOpenReview }: PriceHistoryProps) {
  if (columns.length === 0) return <p>No sessions yet: the first ends once the Trade's first session ends.</p>;
  return (
    <>
    <div className="table-scroll" role="region" aria-label="Price History" tabIndex={0}>
    <table className="price-history">
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
            {columns.map((column) => {
              const cell = column.cells[row];
              return (
                <td key={`${column.weekday}-${column.date}`} className={cell?.tone} title={cell?.provenance} aria-label={cell?.label}>
                  {cell ? cell.text : <span role="img" aria-label="No Mark">—</span>}
                  {cell?.corrected && (
                    // The cell's accessible name already says "Corrected: <reason>", so the visible marker stays out of the accessibility tree.
                    <span className="price-history-corrected" aria-hidden="true">
                      <Badge tone="info">Corrected</Badge>
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
    {(missingCount > 0 || acknowledgedCount > 0) && (
      <p className="price-history-gaps">
        {missingCount > 0 && `${plural(missingCount, 'session', 'sessions')} without Marks. `}
        {acknowledgedCount > 0 && `${plural(acknowledgedCount, 'session', 'sessions')} ${acknowledgedUnavailableStatusLabel().toLowerCase()}.${missingCount > 0 ? ' ' : ''}`}
        {missingCount > 0 && (
          <a
            href={REVIEW_PATH}
            onClick={(event) => {
              event.preventDefault();
              onOpenReview();
            }}
          >
            Enter Marks in the Review
          </a>
        )}
      </p>
    )}
    </>
  );
}

// The Price History drawer. Without a replay it renders nothing.
export function PriceHistory({ replay, timeZone }: ShellProps & { readonly replay?: ReplaySource }) {
  const navigate = useNavigate();
  return replay && timeZone ? <PriceHistoryTable {...priceHistoryProps(replay, () => void navigate(REVIEW_PATH), timeZone)} /> : null;
}
