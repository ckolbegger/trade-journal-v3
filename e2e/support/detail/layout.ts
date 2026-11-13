// Layout reads of the page and the Detail for the browser suites: the left edges of the page's heading, tab list and first card.
import type { Page } from '@playwright/test';

// The left edge of the main heading, the tab list and the first card, for the alignment checks.
export function leftEdges(page: Page, cardSelector = 'main .card, main .table-scroll'): Promise<Record<string, number>> {
  return page.evaluate((cardSel) => {
    const left = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().left;
    const found: Record<string, number | undefined> = {
      h1: left('main h1'),
      // The tab list of the page, never the Detail's own (its tabs choose a drawer; they are not a page edge).
      tablist: left('[role="tablist"]:not(.trade-detail [role="tablist"])'),
      card: left(cardSel),
    };
    return Object.fromEntries(Object.entries(found).filter(([, x]) => x !== undefined)) as Record<string, number>;
  }, cardSelector);
}
