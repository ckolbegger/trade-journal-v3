import {
  panelOf, markEditorOf, markInputOf, expectMarkUnsaved, actionFormOf, cardHeader, cardItem, completion, createRoutineTrades, createTrades, enterMark, expect, expectAccessible, FRIDAY, MONDAY, MONDAY_1700, onboardedAt, openReview, panelHeader, LAUNCH, remainsOf, meterOf, nowDrawingOf, collapseOpenCard, status, tabTo, test, tradeCard, saveMarksButton, expectMarksSaved, marksStepOf, openCardFixture, type TradeRef,
} from './support.ts';

const INTENT = /^Why\?/;

test.describe('B5R.11 Responsive and accessible', () => {
  test('should keep drafts and the open panel through 390 px and back, put the meter on its own row at narrow width, report no WCAG 2.1 AA violations, say band, status and Unsaved in text, and complete a card by keyboard with visible focus', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, 'T-A': tA, 'T-B': tB, 'T-C': tC, 'T-E': tE, 'T-F': tF } = await openCardFixture(profile, copySetup);
    await openReview(page);
    // T-A's Review Date Mark is saved first: no Action is offered until it is (W95).
    await enterMark(page, tA, MONDAY, '52.00');
    // The open card draws no meter: T-A's card is collapsed to read its meter, before any draft, and opened again.
    await collapseOpenCard(page);
    await expect(meterOf(page, tA)).toHaveAttribute('role', 'img');
    await cardHeader(page, tA).click();
    await expect(cardHeader(page, tA)).toHaveAttribute('aria-expanded', 'true');

    // Wide: the meter sits beside the header, in the same row.
    const rowOf = async (trade: TradeRef) => {
      const head = (await cardItem(page, trade).locator('.review-card-head').boundingBox())!;
      const button = (await cardHeader(page, trade).boundingBox())!;
      const meter = (await meterOf(page, trade).boundingBox())!;
      return { head, button, meter };
    };
    const wide = await rowOf(tB);
    expect(wide.meter.x).toBeGreaterThanOrEqual(wide.button.x + wide.button.width - 1);
    expect(wide.meter.y).toBeLessThan(wide.button.y + wide.button.height);

    // Half-fill drafts at 1280 px: a price (T-C's) and a half-written "Can't get a price" in the Marks panel, an Exit and a half-written Intent in the Action panel.
    await (await markInputOf(page, tC, MONDAY)).fill('41.00');
    const friday = await markEditorOf(page, tA, FRIDAY);
    await friday.getByRole('button', { name: "Can't get a price" }).click();
    await friday.getByLabel('Reason (required)').fill('No quo');
    // The label, status and Unsaved are words.
    await expect(cardItem(page, tC)).toContainText('Marks needed');
    await expect(remainsOf(page, tA)).toHaveText('To do: Reflection, Action');
    await expect(status(page)).toContainText('Incomplete');
    await expect(friday.getByText('Unsaved')).toBeVisible();
    // T-C's draft is held in the grid's cell, tagged Unsaved, and counted by Save Marks beside Friday's.
    await expect(await markInputOf(page, tC, MONDAY)).toHaveValue('41.00');
    await expectMarkUnsaved(page, tC, MONDAY);
    await expect(saveMarksButton(page)).toHaveText('Save Marks (2)');
    const action = await actionFormOf(page, tA);
    await action.getByRole('radio', { name: 'Exit', exact: true }).check();
    await action.getByLabel(INTENT).fill('Half written');

    // Axe on the card list, then on the open card with each panel open, with the drafts held; the meters are in every state.
    for (const trade of [tB, tC, tE, tF]) await expect(meterOf(page, trade)).toHaveAttribute('role', 'img');
    // T-A's card is open, with its drafts held: its drawing in the "Now" box is its meter.
    await expect(nowDrawingOf(page, tA)).toHaveAttribute('role', 'img');
    for (const panel of ['Marks', 'Reflections', 'Action'] as const) {
      await panelOf(page, tA, panel);
      await expectAccessible(page, `T-A's card with the ${panel} panel open, drafts held`);
    }
    await expectAccessible(page, 'Card list, drafts held');

    // Resize to 390 px: the meter moves to its own full-width row; the open panel and the drafts stay.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(panelHeader(page, tA, 'Action')).toHaveAttribute('aria-expanded', 'true');
    await expect(async () => {
      const narrow = await rowOf(tB);
      expect(narrow.meter.y).toBeGreaterThanOrEqual(narrow.button.y + narrow.button.height - 1);
      expect(narrow.meter.width).toBeGreaterThanOrEqual(narrow.head.width - 2);
    }).toPass({ timeout: 5000 });
    await expectAccessible(page, 'Card list and open card, narrow');
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(panelHeader(page, tA, 'Action')).toHaveAttribute('aria-expanded', 'true');
    await expect(async () => {
      const back = await rowOf(tB);
      expect(back.meter.x).toBeGreaterThanOrEqual(back.button.x + back.button.width - 1);
    }).toPass({ timeout: 5000 });
    await expect((await actionFormOf(page, tA)).getByRole('radio', { name: 'Exit', exact: true })).toBeChecked();
    await expect((await actionFormOf(page, tA)).getByLabel(INTENT)).toHaveValue('Half written');
    await expect(await markInputOf(page, tC, MONDAY)).toHaveValue('41.00');
    await expect((await markEditorOf(page, tA, FRIDAY)).getByLabel('Reason (required)')).toHaveValue('No quo');

    // Put the drafts away (mouse), then complete T-B's card with the keyboard only.
    await marksStepOf(page).getByRole('button', { name: 'Discard' }).click();
    const form = await actionFormOf(page, tA);
    await form.getByRole('radio', { name: 'Hold', exact: true }).check();
    await form.getByLabel(INTENT).fill('');
    // T-A's Mark is in, so its card sorts below T-B's: the Tab starts above the Marks step.
    await page.getByRole('button', { name: 'Enter the Marks' }).focus();
    await tabTo(page, cardHeader(page, tB));
    await page.keyboard.press('Enter');
    await expect(cardHeader(page, tB)).toHaveAttribute('aria-expanded', 'true', LAUNCH);
    await expect(cardHeader(page, tB)).toBeFocused();
    // Keyboard and focus steps assert navigation itself (section 6.4, rule 4): raw locators, no reaches.
    const abc = tradeCard(page, 'ABC');
    const price = marksStepOf(page).getByRole('textbox', { name: `ABC Mark, ${MONDAY}`, exact: true });
    await tabTo(page, price);
    await page.keyboard.type('27.50');
    // Enter would go on to the next Instrument's price: Save Marks is reached by Tab here.
    await tabTo(page, saveMarksButton(page));
    await page.keyboard.press('Enter');
    await expectMarksSaved(page);
    // The Marks are the page's, so T-B's card was on its Action panel all along.
    await expect(panelHeader(page, tB, 'Action')).toHaveAttribute('aria-expanded', 'true');
    const save = abc.getByRole('form', { name: 'Action' }).getByRole('button', { name: 'Save' });
    await expect(save).toBeEnabled();
    await expect(abc.getByRole('radio', { name: 'Hold', exact: true })).toBeChecked();
    await tabTo(page, save);
    await page.keyboard.press('Enter');
    await expect(remainsOf(page, tB)).toHaveText('Done · Hold');
    await expect(completion(page)).toHaveText('Incomplete');
    // A Done card, a pinned meter and a grey one are in the list: the page is still accessible.
    await expectAccessible(page, 'Card list with a Done card and a pinned meter');
    await context.close();
  });

  test('should keep the meter beside the header while the card\'s header is at least 40rem wide, with T-A\'s header text on at most two lines, and put it on its own full-width row below the text when narrower: beside at 1280, 960 and 760 px, below at 700 and 390 px', async ({ profile, copySetup }) => {
    test.setTimeout(120_000);
    const { context, page, 'T-A': tA } = await openCardFixture(profile, copySetup);
    await openReview(page);
    // The open card draws no meter: T-A's card is collapsed, and its header is measured so.
    await collapseOpenCard(page);

    // T-A's header: the head row (the card's header width), the visible text pieces' line boxes, and the meter.
    const measure = async () => {
      const head = (await cardItem(page, tA).locator('.review-card-head').boundingBox())!;
      const meter = (await meterOf(page, tA).boundingBox())!;
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
      return { head, meter, lines };
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
        const { head, meter, lines } = await measure();
        const at = `at ${width} px`;
        if (beside) {
          expect(head.width, `header width ${at}`).toBeGreaterThanOrEqual(640);
          expect(meter.x, `meter left of the text ${at}`).toBeGreaterThanOrEqual(lines.right - 1);
          expect(meter.y, `meter top above the text's bottom ${at}`).toBeLessThan(lines.bottom);
          expect(meter.y + meter.height, `meter bottom below the text's top ${at}`).toBeGreaterThan(lines.top);
          expect(lines.count, `lines of header text ${at}`).toBeLessThanOrEqual(2);
        } else {
          expect(head.width, `header width ${at}`).toBeLessThan(640);
          expect(meter.y, `meter below the text ${at}`).toBeGreaterThanOrEqual(lines.bottom - 1);
          // The card meter is at most 22rem wide (meter.css), so on a wide stacked row it fills that, not the whole row.
          expect(meter.width, `meter width ${at}`).toBeGreaterThanOrEqual(Math.min(head.width, 22 * 16) - 2);
        }
      }, `meter placement at ${width} px`).toPass({ timeout: 5000 });
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
    await expect(list).toBeVisible(LAUNCH);

    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 640 });
      await expect(list).toBeVisible();
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
      await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible();
      await nav.getByRole('link', { name: 'Trades' }).click({ timeout: 5000 });
      await expect(list).toBeVisible();
    }
    await context.close();
  });
});
