import { useNavigate } from 'react-router';
import { ROUTES } from '../../../app/routes.ts';
import { acknowledgedUnavailableStatusLabel } from '../../calculation-words.ts';
import { plural } from '../../format.ts';
import { SessionGrid } from '../session-grid.tsx';
import type { ShellProps } from '../placeholder.ts';
import { priceHistoryProps, type ReplaySource } from './price-history.props.ts';
import type { PriceHistoryProps } from './price-history.types.ts';

// The Review route (`review` in src/app/routes.ts); the link's href and the navigation use it together.
const REVIEW_PATH = ROUTES.find((route) => route.id === 'review')!.path;

// W9, P99: every session in one table, newest on the left, with no paging. The table is the shared session grid (P159).
export function PriceHistoryTable({ rowLabels, columns, missingCount, acknowledgedCount, onOpenReview }: PriceHistoryProps) {
  if (columns.length === 0) return <p>No sessions yet: the first ends once the Trade's first session ends.</p>;
  return (
    <>
    <SessionGrid label="Price History" tableClass="price-history" rowLabels={rowLabels} columns={columns} />
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
