import { test as base, expect } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export const test = base.extend<{ profilePath: string }>({
  profilePath: async ({ browserName }, use) => { await use(await mkdtemp(join(tmpdir(), `trade-journal-d1-${browserName}-`))); },
  context: async ({ playwright, browserName, profilePath, baseURL }, use) => {
    const context = await playwright[browserName].launchPersistentContext(profilePath, { headless: true, baseURL, viewport: { width: 1440, height: 900 } });
    await use(context);
    await context.close();
  },
});
export { expect };
