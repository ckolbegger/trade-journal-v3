// The paging a carousel of cards shares (A277): ‹ "Newer sessions" and › "Earlier sessions", for the Journal's cards and the replay's.
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';

export interface CardPagerProps {
  // The page shown (from 0, newest) and how many pages there are.
  readonly page: number;
  readonly pages: number;
  readonly onPage: (page: number) => void;
  readonly newerLabel?: string;
  readonly earlierLabel?: string;
}

// How many cards of `cardWidth` fit side by side in the carousel's own width, followed through a resize as the plot finds its width; at least
// one, and one until the box has a layout.
export function useCardsPerPage(box: RefObject<HTMLElement | null>, cardWidth: number, gap: number): number {
  const [measured, setMeasured] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setMeasured(el.clientWidth);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    // The observer reports between layout and paint: drawn at once (flushSync), the resized carousel is never painted at the old width.
    const watch = new ResizeObserver(() => flushSync(read));
    watch.observe(el);
    return () => watch.disconnect();
  }, [box]);
  return Math.max(1, Math.floor((measured + gap) / (cardWidth + gap)));
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
