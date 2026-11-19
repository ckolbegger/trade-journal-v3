// The paging a carousel of cards shares (A277): ‹ "Newer sessions" and › "Earlier sessions", for the Journal's cards and the replay's.
import { useRef } from 'react';
import { flushSync } from 'react-dom';

export interface CardPagerProps {
  // The page shown (from 0, newest) and how many pages there are.
  readonly page: number;
  readonly pages: number;
  readonly onPage: (page: number) => void;
  readonly newerLabel?: string;
  readonly earlierLabel?: string;
}

// A disabled button can't hold focus, so paging to either end hands focus to the other paging button (tech debt item 24). The page is
// rendered first (flushSync), because the other button may itself be disabled until then.
export function CardPager({ page, pages, onPage, newerLabel = 'Newer sessions', earlierLabel = 'Earlier sessions' }: CardPagerProps) {
  const newerButton = useRef<HTMLButtonElement>(null);
  const earlierButton = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        type="button"
        className="pill secondary"
        aria-label={newerLabel}
        disabled={page === 0}
        ref={newerButton}
        onClick={() => {
          flushSync(() => onPage(page - 1));
          if (page - 1 === 0) earlierButton.current?.focus();
        }}
      >
        ‹
      </button>
      <button
        type="button"
        className="pill secondary"
        aria-label={earlierLabel}
        disabled={page >= pages - 1}
        ref={earlierButton}
        onClick={() => {
          flushSync(() => onPage(page + 1));
          if (page + 1 >= pages - 1) newerButton.current?.focus();
        }}
      >
        ›
      </button>
    </>
  );
}
