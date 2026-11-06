// Shared support for the D7 prefactor browser layout spec (plan section 6.3): D6's steps and helpers (which re-export
// D5R's, D5's and D4's), the stored-record edit that makes a Trade's facts unreplayable (A187), and the checks that a worded
// reason is shown in full at a narrow width.
import { chromium, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { BASE_URL, expect, firstPage } from '../d6/support.ts';

export * from '../d6/support.ts';

export const WIDTHS = [320, 375] as const;

// Edits raw stored records of the profile's current Workspace while the application is not running (D2 section 6.0, the way
// `writeIntegrityFixture` does): the Underlying's Sell Executions, in time order, take the given quantities, so each one that is
// more than the shares open is an ExceedsOpenQuantity finding. The edit is written before the case launches the app (A187).
export async function writeSellQuantities(dir: string, underlying: string, quantities: readonly string[]): Promise<void> {
  const context = await chromium.launchPersistentContext(path.resolve(dir), { channel: 'chromium', serviceWorkers: 'block' });
  try {
    const page = await firstPage(context);
    await page.route(`${BASE_URL}/__fixture`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>fixture</title>' }));
    await page.goto(`${BASE_URL}/__fixture`);
    await page.evaluate(
      async (change: { underlying: string; quantities: readonly string[] }) => {
        const request = <T>(r: IDBRequest<T>) =>
          new Promise<T>((resolve, reject) => {
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error ?? new Error('fixture failed'));
          });
        const root = await request(indexedDB.open('tj-root'));
        const pointer = (await request(root.transaction('pointer').objectStore('pointer').get('current'))) as { databaseName: string };
        root.close();
        const db = await request(indexedDB.open(pointer.databaseName));
        const tx = db.transaction('trades', 'readwrite');
        const store = tx.objectStore('trades');
        const trades = (await request(store.getAll())) as {
          underlying: string;
          facts: { kind: string; versions: { value: { action: string; quantity: string; economicTime: string } }[] }[];
        }[];
        const trade = trades.find((t) => t.underlying === change.underlying);
        if (!trade) throw new Error(`no stored Trade for ${change.underlying}`);
        const sells = trade.facts.filter((f) => f.kind === 'Execution' && f.versions.at(-1)!.value.action === 'Sell');
        sells.sort((a, b) => a.versions.at(-1)!.value.economicTime.localeCompare(b.versions.at(-1)!.value.economicTime));
        if (sells.length !== change.quantities.length) throw new Error(`expected ${change.quantities.length} Sell Executions, found ${sells.length}`);
        sells.forEach((fact, index) => {
          for (const version of fact.versions) version.value.quantity = change.quantities[index]!;
        });
        await request(store.put(trade));
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error('fixture failed'));
        });
        db.close();
      },
      { underlying, quantities },
    );
  } finally {
    await context.close();
  }
}

// Resizes the viewport and waits for the new layout to be drawn (two frames), so that no measure reads the old one.
export async function setWidth(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 800 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

// The page has no sideways scroll.
export async function expectNoSidewaysScroll(page: Page, where: string): Promise<void> {
  // Polled for a moment: a reflow still under way is not an overflow, while a real one stays.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const client = document.documentElement.clientWidth;
          const scroll = document.documentElement.scrollWidth;
          if (scroll <= client) return 'no sideways scroll';
          // Named for the failure message: the elements that reach past the right edge.
          const past = [...document.body.querySelectorAll('*')]
            .filter((e) => e.getBoundingClientRect().right > client + 1)
            .slice(0, 6)
            .map((e) => `${e.tagName.toLowerCase()}.${e.className} ${Math.round(e.getBoundingClientRect().right)}`);
          return `page scrollWidth ${scroll} is more than clientWidth ${client}; past the edge: ${past.join('; ')}`;
        }),
      { message: where, timeout: 3000 },
    )
    .toBe('no sideways scroll');
}

// The element's text is the module's words, and it is shown in full: its scrollWidth is at most its clientWidth, and it lies
// inside every ancestor that clips or scrolls sideways (a table's own scroll region may scroll, but must not hide a reason).
export async function expectShownInFull(locator: Locator, expected: string, where: string): Promise<void> {
  await expect(locator, where).toBeVisible();
  const shown = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    let hidden = false;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const overflowX = getComputedStyle(parent).overflowX;
      if (overflowX === 'visible') continue;
      const box = parent.getBoundingClientRect();
      const left = box.left + parent.clientLeft;
      if (rect.left < left - 1 || rect.right > left + parent.clientWidth + 1) hidden = true;
    }
    return { text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, hidden };
  });
  expect(shown.text, `${where}: text`).toBe(expected);
  expect(shown.scrollWidth, `${where}: scrollWidth`).toBeLessThanOrEqual(shown.clientWidth);
  expect(shown.hidden, `${where}: inside the clipping ancestors`).toBe(false);
}

// The badge lies inside its cell.
export async function expectInsideCell(badge: Locator, where: string): Promise<void> {
  await expect(badge, where).toBeVisible();
  const inside = await badge.evaluate((element) => {
    const cell = element.closest('td,th');
    if (!cell) return false;
    const a = element.getBoundingClientRect();
    const b = cell.getBoundingClientRect();
    return a.left >= b.left - 1 && a.right <= b.right + 1 && cell.scrollWidth <= cell.clientWidth;
  });
  expect(inside, `${where}: badge inside its cell`).toBe(true);
}
