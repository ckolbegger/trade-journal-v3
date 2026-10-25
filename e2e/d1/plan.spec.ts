import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { BASE_URL, confirmPlan, expect, firstPage, onboardedPage, PLANNED, probe, READY, test, workspaceOf, ZONE } from './support.ts';

test.describe('B1.2 onboarding and first Plan', () => {
  test('should show the Plan, 1R, and reflection after relaunch, with one Trade, one Entry, and Planned in the index', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    await confirmPlan(page);
    await context.close();

    const relaunched = await profile.launch();
    const again = await firstPage(relaunched);
    await again.goto(PLANNED);
    const row = again.getByRole('row', { name: /XYZ/ });
    await expect(row).toBeVisible(READY);
    await expect(row).toContainText('$250.00');
    await row.getByRole('link', { name: 'XYZ' }).click();
    // Wait for the Detail: the list's own tab is also named Planned and its row also carries the 1R figure.
    await expect(again.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible();
    await expect(again.getByText('Planned', { exact: true })).toBeVisible();
    await expect(again.getByRole('region', { name: 'Plan Baseline' }).getByText('$250.00')).toBeVisible();
    await expect(again.getByText('Breakout above the 50-day on volume.')).toBeVisible();

    const workspace = workspaceOf(await probe(again))!;
    expect(workspace.stores['trades']).toHaveLength(1);
    expect(workspace.stores['journalEntries']).toHaveLength(1);
    const tradeId = (workspace.stores['trades']![0] as { tradeId: string }).tradeId;
    expect(workspace.indexes['trades.byLifecycle']).toEqual([tradeId]);
    await relaunched.close();
  });
});

test.describe('B1.3 kill after commit', () => {
  test('should keep the complete Plan, with its Entry, after the browser process is killed once the confirmation renders', async ({ server, profile }) => {
    void server;
    const killed = await spawnedBrowser(profile.dir, 9333);
    try {
      const page = await onboardedPage(killed.context);
      await confirmPlan(page);
    } finally {
      await killed.kill();
    }

    // Relaunched with the same binary and features, so it reads the same storage backend.
    const relaunched = await spawnedBrowser(profile.dir, 9334);
    try {
      const page = await firstPage(relaunched.context);
      await page.goto(`${BASE_URL}${PLANNED}`);
      await page.getByRole('row', { name: /XYZ/ }).getByRole('link', { name: 'XYZ' }).click(READY);
      await expect(page.getByText('Breakout above the 50-day on volume.')).toBeVisible();
      const workspace = workspaceOf(await probe(page))!;
      const trades = workspace.stores['trades'] as { tradeId: string }[];
      const entries = workspace.stores['journalEntries'] as { anchor: { tradeId: string } }[];
      expect(trades).toHaveLength(1);
      expect(entries.map((e) => e.anchor.tradeId)).toEqual([trades[0]!.tradeId]);
    } finally {
      await relaunched.kill();
    }
  });
});

// A Chromium process this test owns (default features, new headless mode), so it can be killed
// outright rather than closed.
async function spawnedBrowser(dir: string, port: number) {
  const child = spawn(
    chromium.executablePath(),
    ['--headless=new', `--user-data-dir=${path.resolve(dir)}`, `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
    { stdio: 'ignore', env: { ...process.env, TZ: ZONE } },
  );
  let browser;
  for (let attempt = 0; !browser && attempt < 50; attempt++) {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => undefined);
    if (!browser) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!browser) throw new Error('could not connect to the browser');
  return {
    context: browser.contexts()[0]!,
    kill: async () => {
      child.kill('SIGKILL');
      if (child.exitCode === null) await new Promise((resolve) => child.once('exit', resolve));
    },
  };
}
