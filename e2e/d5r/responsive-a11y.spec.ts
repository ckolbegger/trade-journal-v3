import {
  actionFormOf, cardHeader, cardItem, completion, createCardFixture, createRoutineTrades, createTrades, expect, expectAccessible, FRIDAY, markRow, MONDAY, MONDAY_1700, onboardedAt, openReview, panelHeader, reachPanel, READY, remainsOf, sliderOf, status, tabTo,
  test, tradeCard, type TradeRef,
} from './support.ts';

const INTENT = /^Why are you taking this action\?/;

test.describe('B5R.11 Responsive and accessible', () => {
  test('should keep drafts and the open panel through 390 px and back, put the slider on its own row at narrow width, report no WCAG 2.1 AA violations, say band, status and Unsaved in text, and complete a card by keyboard with visible focus', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const { 'T-A': tA, 'T-B': tB, 'T-C': tC, 'T-E': tE, 'T-F': tF } = await createCardFixture(page);
    await openReview(page);

    // Wide: the slider sits beside the header, in the same row.
    const rowOf = async (trade: TradeRef) => {
      const head = (await cardItem(page, trade).locator('.review-card-head').boundingBox())!;
      const button = (await cardHeader(page, trade).boundingBox())!;
      const slider = (await sliderOf(page, trade).boundingBox())!;
      return { head, button, slider };
    };
    const wide = await rowOf(tB);
    expect(wide.slider.x).toBeGreaterThanOrEqual(wide.button.x + wide.button.width - 1);
    expect(wide.slider.y).toBeLessThan(wide.button.y + wide.button.height);

    // Half-fill drafts at 1280 px: a price and a half-written "Can't get a price" in the Marks panel, an Exit and a half-written Intent in the Action panel.
    const monday = await markRow(page, tA, MONDAY);
    await monday.getByLabel('Price').fill('52.00');
    const friday = await markRow(page, tA, FRIDAY);
    await friday.getByRole('button', { name: "Can't get a price" }).click();
    await friday.getByLabel('Reason (required)').fill('No quo');
    // Band, status and Unsaved are words.
    await expect(cardItem(page, tA)).toContainText('Evidence limited');
    await expect(remainsOf(page, tA)).toHaveText('1 Mark · 1 reflection due · Action');
    await expect(status(page)).toContainText('Incomplete');
    await expect(monday.getByText('Unsaved')).toBeVisible();
    await expect(friday.getByText('Unsaved')).toBeVisible();
    await expect(panelHeader(page, tA, 'Marks')).toContainText('1 needed');
    const action = await actionFormOf(page, tA);
    await action.getByRole('radio', { name: 'Exit', exact: true }).check();
    await action.getByLabel(INTENT).fill('Half written');

    // Axe on the card list, then on the open card with each panel open, with the drafts held; the sliders are in every state.
    for (const trade of [tA, tB, tC, tE, tF]) await expect(sliderOf(page, trade)).toHaveAttribute('role', 'img');
    for (const panel of ['Marks', 'Reflections', 'Action'] as const) {
      await reachPanel(page, tA, panel);
      await expectAccessible(page, `T-A's card with the ${panel} panel open, drafts held`);
    }
    await expectAccessible(page, 'Card list, drafts held');

    // Resize to 390 px: the slider moves to its own full-width row; the open panel and the drafts stay.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(panelHeader(page, tA, 'Action')).toHaveAttribute('aria-expanded', 'true');
    await expect(async () => {
      const narrow = await rowOf(tB);
      expect(narrow.slider.y).toBeGreaterThanOrEqual(narrow.button.y + narrow.button.height - 1);
      expect(narrow.slider.width).toBeGreaterThanOrEqual(narrow.head.width - 2);
    }).toPass({ timeout: 5000 });
    await expectAccessible(page, 'Card list and open card, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(panelHeader(page, tA, 'Action')).toHaveAttribute('aria-expanded', 'true');
    await expect(async () => {
      const back = await rowOf(tB);
      expect(back.slider.x).toBeGreaterThanOrEqual(back.button.x + back.button.width - 1);
    }).toPass({ timeout: 5000 });
    await expect((await actionFormOf(page, tA)).getByRole('radio', { name: 'Exit', exact: true })).toBeChecked();
    await expect((await actionFormOf(page, tA)).getByLabel(INTENT)).toHaveValue('Half written');
    await expect((await markRow(page, tA, MONDAY)).getByLabel('Price')).toHaveValue('52.00');
    await expect((await markRow(page, tA, FRIDAY)).getByLabel('Reason (required)')).toHaveValue('No quo');

    // Put the drafts away (mouse), then complete T-B's card with the keyboard only.
    await tradeCard(page, 'XYZ').getByRole('button', { name: 'Discard' }).click();
    const form = await actionFormOf(page, tA);
    await form.getByRole('radio', { name: 'Hold', exact: true }).check();
    await form.getByLabel(INTENT).fill('');
    await cardHeader(page, tA).focus();
    await tabTo(page, cardHeader(page, tB));
    await page.keyboard.press('Enter');
    await expect(cardHeader(page, tB)).toHaveAttribute('aria-expanded', 'true', READY);
    await expect(cardHeader(page, tB)).toBeFocused();
    // Keyboard and focus steps assert navigation itself (section 6.4, rule 4): raw locators, no reaches.
    const abc = tradeCard(page, 'ABC');
    const price = abc.getByRole('region', { name: `ABC Mark, ${MONDAY}`, exact: true }).getByLabel('Price');
    await tabTo(page, price);
    await page.keyboard.type('27.50');
    await page.keyboard.press('Enter');
    await expect(abc.getByRole('button', { name: /^Save Marks/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(panelHeader(page, tB, 'Action')).toHaveAttribute('aria-expanded', 'true', READY);
    const save = abc.getByRole('form', { name: 'Action' }).getByRole('button', { name: 'Save' });
    await expect(save).toBeEnabled(READY);
    await expect(abc.getByRole('radio', { name: 'Hold', exact: true })).toBeChecked();
    await tabTo(page, save);
    await page.keyboard.press('Enter');
    await expect(remainsOf(page, tB)).toHaveText('Done · Action saved', READY);
    await expect(completion(page)).toHaveText('Incomplete');
    // A Done card, a pinned slider and a grey one are in the list: the page is still accessible.
    await expectAccessible(page, 'Card list with a Done card and a pinned slider');
    await context.close();
  });

  test('should keep the slider beside the header while the card\'s header is at least 40rem wide, with T-A\'s header text on at most two lines, and put it on its own full-width row below the text when narrower: beside at 1280, 960 and 760 px, below at 700 and 390 px', async ({ profile }) => {
    test.setTimeout(120_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const { 'T-A': tA } = await createCardFixture(page);
    await openReview(page);

    // T-A's header: the head row (the card's header width), the visible text pieces' line boxes, and the slider.
    const measure = async () => {
      const head = (await cardItem(page, tA).locator('.review-card-head').boundingBox())!;
      const slider = (await sliderOf(page, tA).boundingBox())!;
      const lines = await cardHeader(page, tA).evaluate((button) => {
        const tops: number[] = [];
        let top = Infinity;
        let bottom = 0;
        let right = 0;
        for (const span of Array.from(button.querySelectorAll('span'))) {
          for (const rect of Array.from(span.getClientRects())) {
            if (rect.width <= 1 || rect.height <= 1) continue; // the visually hidden "Review" word
            if (!tops.some((top) => Math.abs(top - rect.top) < 4)) tops.push(rect.top);
            top = Math.min(top, rect.top);
            bottom = Math.max(bottom, rect.bottom);
            right = Math.max(right, rect.right);
          }
        }
        return { count: tops.length, top, bottom, right };
      });
      return { head, slider, lines };
    };

    const cases: ReadonlyArray<{ width: number; height: number; beside: boolean }> = [
      { width: 1280, height: 900, beside: true },
      { width: 960, height: 900, beside: true },
      { width: 760, height: 900, beside: true },
      { width: 700, height: 900, beside: false },
      { width: 390, height: 844, beside: false },
    ];
    for (const { width, height, beside } of cases) {
      await page.setViewportSize({ width, height });
      await expect(async () => {
        const { head, slider, lines } = await measure();
        const at = `at ${width} px`;
        if (beside) {
          expect(head.width, `header width ${at}`).toBeGreaterThanOrEqual(640);
          expect(slider.x, `slider left of the text ${at}`).toBeGreaterThanOrEqual(lines.right - 1);
          expect(slider.y, `slider top above the text's bottom ${at}`).toBeLessThan(lines.bottom);
          expect(slider.y + slider.height, `slider bottom below the text's top ${at}`).toBeGreaterThan(lines.top);
          expect(lines.count, `lines of header text ${at}`).toBeLessThanOrEqual(2);
        } else {
          expect(head.width, `header width ${at}`).toBeLessThan(640);
          expect(slider.y, `slider below the text ${at}`).toBeGreaterThanOrEqual(lines.bottom - 1);
          expect(slider.width, `slider width ${at}`).toBeGreaterThanOrEqual(head.width - 2);
        }
      }, `slider placement at ${width} px`).toPass({ timeout: 5000 });
    }
    await context.close();
  });

  test('should keep the bottom navigation above the Open list\'s sticky cells at 375 and 320 px, so its Review and Trades links take the click', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page);
    await createRoutineTrades(page, 8);
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await nav.getByRole('link', { name: 'Trades' }).click();
    const list = page.getByRole('table', { name: 'Open Trades' });
    await expect(list).toBeVisible(READY);

    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 640 });
      await expect(list).toBeVisible(READY);
      const at = `at ${width} px`;
      // Scroll the page until a row's pinned Underlying cell sits behind the Trades link, near the top of the bottom navigation.
      const cells = list.locator('tbody td:first-child');
      const row = (await cells.count()) - 3;
      await cells.nth(row).scrollIntoViewIfNeeded();
      const navBox = (await nav.boundingBox())!;
      const cellBox = (await cells.nth(row).boundingBox())!;
      await page.evaluate((by) => window.scrollBy(0, by), cellBox.y - navBox.y - 10);

      // What is painted topmost at each link's centre is the link or something inside it, never a table cell.
      for (const name of ['Review', 'Trades']) {
        const target = nav.getByRole('link', { name });
        const box = (await target.boundingBox())!;
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const stack = await page.evaluate(([px, py]) => document.elementsFromPoint(px!, py!).map((el) => el.tagName), [x, y]);
        expect(stack, `a table cell is under the ${name} link ${at}`).toContain('TD');
        const top = await target.evaluate((el, [px, py]) => {
          const hit = document.elementFromPoint(px!, py!);
          return hit !== null && el.contains(hit) ? 'link' : (hit?.tagName ?? 'nothing');
        }, [x, y]);
        expect(top, `topmost element at the ${name} link's centre ${at}`).toBe('link');
      }

      // A real click on Review, without force, reaches the Review.
      await nav.getByRole('link', { name: 'Review' }).click({ timeout: 5000 });
      await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible(READY);
      await nav.getByRole('link', { name: 'Trades' }).click({ timeout: 5000 });
      await expect(list).toBeVisible(READY);
    }
    await context.close();
  });
});
