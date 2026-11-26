import type { Locator, Page } from '@playwright/test';
import { tabTo } from '../d2/support.ts';
import { actionEntriesOf, completion, expect, marksStepOf, observationsOf, probe, status, test, workspaceOf } from '../d4/support.ts';
import { setWidth } from '../d7p/support.ts';
import { openAbcDef, WIDTHS } from './support.ts';

test.use({ actionTimeout: 15_000 });

const header = (page: Page, symbol: string): Locator => page.getByRole('button', { name: new RegExp(`^Review ${symbol}\\b`) });
const focusedHeader = (page: Page): Locator => page.getByRole('button', { name: /^Review (ABC|DEF)\b/ }).and(page.locator(':focus'));

test.describe('B95.15 A routine day with the keyboard alone (story 9, AC-UI-002)', () => {
  for (const width of WIDTHS) {
    test(`should take a whole day, Marks and an Action for each Trade, with focus on the next thing after each save, and give focus back on Escape at ${width}`, async ({ profile, copySetup }) => {
      test.setTimeout(240_000);
      const { context, page } = await openAbcDef(profile, copySetup);
      await setWidth(page, width);
      // Nothing below clicks or fills: every step is a key.
      const reviewLink = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Review' });
      await expect(reviewLink).toBeVisible();
      await expect(page.getByRole('list', { name: 'Open Trades' }).or(page.getByRole('table')).first()).toBeVisible();
      await tabTo(page, reviewLink);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible();

      // The Marks: type a price, Enter to the next, Enter to Save Marks, Enter to save.
      const step = marksStepOf(page);
      const input = (symbol: string): Locator => step.getByRole('textbox', { name: `${symbol} Mark, Mon Oct 12`, exact: true });
      const abcFirst = (await input('ABC').boundingBox())!.y < (await input('DEF').boundingBox())!.y;
      const [first, second] = abcFirst ? ['ABC', 'DEF'] : ['DEF', 'ABC'];
      const price = (symbol: string): string => (symbol === 'ABC' ? '29.50' : '40.50');
      await tabTo(page, input(first));
      await page.keyboard.type(price(first));
      await page.keyboard.press('Enter');
      await expect(input(second), 'Enter goes to the next price').toBeFocused();
      await page.keyboard.type(price(second));
      await page.keyboard.press('Enter');
      await expect(step.getByRole('button', { name: 'Save Marks (2)' }), 'Enter on the last price goes to Save Marks').toBeFocused();
      await page.keyboard.press('Enter');
      await expect(step.getByRole('button', { name: /^(Save Marks \(0\)|Edit)$/ })).toBeVisible();
      await expect(focusedHeader(page), 'after Save Marks, focus is on the first Trade').toHaveCount(1);

      // An Action for each Trade: open its card, reach Hold, save it; focus goes to the next Trade that needs one.
      const done: string[] = [];
      for (let round = 0; round < 2; round++) {
        const focused = focusedHeader(page);
        const name = (await focused.textContent())!.match(/^Review (ABC|DEF)/)![1]!;
        if ((await focused.getAttribute('aria-expanded')) !== 'true') await page.keyboard.press('Enter');
        await expect(header(page, name)).toHaveAttribute('aria-expanded', 'true');
        // The card loads its Trade when it opens; keys are pressed once its Action panel is drawn.
        await expect(page.getByRole('button', { name: /^Action Hold, Exit, Roll or Adjust/ })).toBeVisible();
        await expect(header(page, name), 'focus stays on the header that was opened').toBeFocused();
        await tabTo(page, page.getByRole('radio', { name: 'Hold', exact: true }));
        await page.keyboard.press('Space');
        await expect(page.getByRole('radio', { name: 'Hold', exact: true }), `Hold chosen for ${name}`).toBeChecked();
        await tabTo(page, page.getByRole('button', { name: 'Save Hold', exact: true }));
        await page.keyboard.press('Enter');
        done.push(name);
        // The Review has read itself again once the saved Trade's header says Done; focus is then where it will stay.
        await expect(header(page, name)).toContainText('Done · Hold');
        if (round === 0) {
          const other = name === 'ABC' ? 'DEF' : 'ABC';
          await expect(header(page, other), `after ${name}'s Action, focus is on ${other}'s header`).toBeFocused();
        }
      }
      // Nothing is left: focus is on the day.
      await expect(completion(page)).toHaveText('Complete');
      await expect(status(page), 'after the last Action, focus is on The day').toBeFocused();
      expect([...done].sort(), 'one Action for each Trade').toEqual(['ABC', 'DEF']);

      // Escape gives focus back.
      await tabTo(page, header(page, 'ABC'));
      await page.keyboard.press('Enter');
      await expect(header(page, 'ABC')).toHaveAttribute('aria-expanded', 'true');
      const replayButton = page.getByRole('listitem').filter({ has: header(page, 'ABC') }).getByRole('button', { name: 'Replay', exact: true });
      await expect(replayButton).toBeVisible();
      await expect(header(page, 'ABC'), 'focus stays on the header that was opened').toBeFocused();
      await tabTo(page, replayButton);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog', { name: /^Replay, / })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: /^Replay, / })).toHaveCount(0);
      await expect(replayButton, 'Escape returns focus to the Replay button').toBeFocused();

      // Stored: the two Marks and the two Holds.
      const workspace = workspaceOf(await probe(page))!;
      expect(observationsOf(workspace), 'two Marks').toHaveLength(2);
      expect(actionEntriesOf(workspace), 'two Actions').toHaveLength(2);
      await context.close();
    });
  }
});
