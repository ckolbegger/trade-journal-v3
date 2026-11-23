import type { Page } from '@playwright/test';
import { atEverySession, AXIO, BREN, brokenFiguresInDialog, build, closeOf, copyStandardTrade, CORV, DALE_HOLD, detailReplayButton, expect, firstPage, launchTouchAt, replay, setViewport, test, type Fixture } from './support.ts';

test.use({ actionTimeout: 15_000 });

// D9AR-retro-1: a sweep over every session of the replay, on BREN, AXIO, DALE-hold and CORV, so a new region or session is covered without anyone listing it.
// Figures (T9AR.24-B1, -B2, -B12): at 375 and 320 (touch), at every session, no text in the whole dialog outside a .card-figure holds a figure mark (STRAY), and every .card-figure is one line box.

const WIDTHS = [375, 320] as const;
const fixtures: readonly [string, Fixture][] = [['BREN', BREN], ['AXIO', AXIO], ['DALE_HOLD', DALE_HOLD], ['CORV', CORV]];

async function sweepFigures(page: Page, where: string): Promise<string[]> {
  const scope = replay(page);
  const hits: string[] = [];
  const count = await atEverySession(page, scope, async (at) => {
    for (const broken of await brokenFiguresInDialog(scope)) hits.push(`${where}, ${at}: ${broken}`);
  });
  expect(count, `${where}: sessions swept`).toBeGreaterThan(1);
  return hits;
}

test.describe('D9AR-retro-1 Figure sweep over every session of the replay', () => {
  for (const [name, fixture] of fixtures) {
    test(`should find no broken or unmarked figure anywhere in the replay at any session, ${name}`, async ({ profile, copySetup }) => {
      test.setTimeout(900_000);
      let tradeUrl: string;
      if (fixture === CORV) {
        const built = await build(profile, fixture, closeOf('2026-11-16'), 10);
        tradeUrl = built.page.url();
        await built.context.close();
      } else tradeUrl = `/trades/${(await copyStandardTrade(copySetup, fixture)).tradeId}`;
      const context = await launchTouchAt(profile, closeOf('2026-11-16'), 375);
      const page = await firstPage(context);
      await page.goto(tradeUrl);
      const broken: string[] = [];
      for (const width of WIDTHS) {
        await setViewport(page, width, 667);
        if ((await replay(page).count()) === 0) await detailReplayButton(page).tap();
        await replay(page).waitFor();
        broken.push(...(await sweepFigures(page, `${name} at ${width}`)));
      }
      await context.close();
      expect(broken, 'figures broken or unmarked').toEqual([]);
    });
  }
});
