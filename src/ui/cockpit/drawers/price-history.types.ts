import type { SessionGridProps } from '../session-grid.types.ts';

// W9, P99. Finished display values only (A216). The table's rows and columns are the session grid's props.
export interface PriceHistoryProps extends SessionGridProps {
  // Sessions without Marks (Missing only), for "2 sessions without Marks." and the tab's count.
  readonly missingCount: number;
  // Sessions acknowledged unavailable with no Missing Mark, for "1 session acknowledged unavailable." (W81).
  readonly acknowledgedCount: number;
  readonly onOpenReview: () => void;
}
