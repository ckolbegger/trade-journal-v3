import {
  marksPanelOf, BREN, BREN_SOLD_OUT, build, buildPlanned, cardRows, closeOf, CORV, DALE, detail, detailReplayButton, expect, going, headline, MON_1123_1700, noMarkDash, openDetailAt, openDrawer, positionGroup,
  LAUNCH, readoutPnl, readoutR, readoutValue, recordExpiration, replay, seek, sessionCard, sessionCards, sliderValue, SCREENSHOTS, stake, test, saveMarksButton,
} from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9AR.6 (plan section 7.2, AC-CALC-004, AC-MARK-004, AC-UI-002): how a replay ends and a session with no Mark. K-sale ends on "Final result" with the header W53 gives it; R-DALE-U's Settlement Due
// and then its Expiration recorded (an Expiration is worded "Expiration, Fri Nov 20" with "Expired", B9AR.3's Position-group words); a Planned Trade has no Replay button; R-CORV-D at Tue 11-10 says "No Mark"
// once with "Add the Mark" and a dash in each cell that needs it; and, from the full reading, Tue 11-10's put Mark acknowledged as unavailable is worded as the acknowledgment, not as a missing Mark.
test.describe('B9AR.6 How a replay ends, and a session with no Mark', () => {
  test('should end K-sale on a Final result with its header, cards to the final session and nothing at stake', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await build(profile, BREN_SOLD_OUT, closeOf('2026-11-13'), 9);
    await expect(detail.lifecycleBadge(page)).toHaveText('Long Call, Closed');
    await openDrawer(page, 'Replay');
    const scope = replay(page);
    await expect(scope.getByRole('heading', { level: 2 })).toHaveText('BREN · Final result +$1,138.00');
    await expect(sliderValue(scope)).toHaveText('Fri Nov 13 · 10 of 10');
    await expect(headline(scope)).toHaveText('+$1,138.00');
    await expect(going(scope)).toHaveText('Final result: sold out Fri Nov 13.');
    await expect(scope.locator('.replay-readout-group h3')).toHaveText(['Final result', 'Marks', 'Position']);
    await expect(stake(scope)).toHaveText('Nothing is at risk and nothing is left to gain. +$478.00 of the result was banked before the end.');
    // Nothing at stake: no stake grid, no stake rows on the final card, and no odds.
    await expect(scope.locator('.replay-stake-grid')).toHaveCount(0);
    await expect(scope.locator('.replay-readout [data-row="At Stop"], .replay-readout [data-row="At Target"], .replay-readout [data-row="Reward to risk"]')).toHaveCount(0);
    await expect(sessionCards(scope)).toHaveCount(10);
    const last = await sessionCard(scope, 'Fri Nov 13');
    await expect(last).toHaveAttribute('aria-current', 'true');
    await expect(cardRows(last)).toHaveText(['BREN Mark$104.60', 'Call Mark$4.91', 'Trade P&L+$1,138.00', 'Realized+$1,138.00', 'EventsSold 2 at $4.91, $0.91 above the Target']);
    await page.screenshot({ path: `${SCREENSHOTS}/B9AR.6-k-sale-final-result.png` });
    await context.close();
  });

  test('should end R-DALE-U with no Mark while Settlement Due, then with a Final result and an Expiration, not an Execution, once it is recorded', async ({ profile }) => {
    test.setTimeout(480_000);
    const built = await build(profile, DALE, closeOf('2026-11-19'), 13, 0);
    await built.context.close();
    const { context, page } = await openDetailAt(profile, MON_1123_1700, built.trade);
    await expect(detail.settlementDueHeading(page)).toBeVisible();
    await openDrawer(page, 'Replay');
    let scope = replay(page);
    await expect(sliderValue(scope)).toHaveText('Fri Nov 20 · 15 of 15');
    await expect(headline(scope)).toHaveText('No Mark for the put on Fri Nov 20.');
    await expect(scope).not.toContainText('Final result');
    await expect(scope.getByRole('heading', { level: 2 })).not.toContainText('Final result');
    await expect(scope.locator('.replay-readout-group h3')).toHaveText(['How it is going', 'At stake from here, whole Position', 'Marks', 'Position']);
    await expect(sessionCards(scope)).toHaveCount(15);
    await page.screenshot({ path: `${SCREENSHOTS}/B9AR.6-dale-settlement-due.png` });
    await scope.getByRole('button', { name: 'Close' }).click();
    await detail.recordExpirationLink(page).click();
    await recordExpiration(page);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(detail.heading(page, 'DALE')).toBeVisible();
    await openDrawer(page, 'Replay');
    scope = replay(page);
    await expect(sliderValue(scope)).toHaveText('Fri Nov 20 · 15 of 15');
    await expect(scope.getByRole('heading', { level: 2 })).toHaveText('DALE · Final result +$564.00');
    await expect(headline(scope)).toHaveText('+$564.00');
    await expect(going(scope)).toHaveText('Final result: the put expired Fri Nov 20.');
    await expect(scope.locator('.replay-readout-group h3')).toHaveText(['Final result', 'Marks', 'Position']);
    await expect(sessionCards(scope)).toHaveCount(15);
    // An Expiration is a Position Change, never an Execution: "Expiration, Fri Nov 20" with "Expired", in the Position group and on the card.
    const position = positionGroup(scope);
    await expect(position.locator('[data-row="Expiration, Fri Nov 20"]')).toHaveText('Expiration, Fri Nov 20Expired');
    await expect(position).not.toContainText('Execution');
    await expect(cardRows(await sessionCard(scope, 'Fri Nov 20')).last()).toHaveText('EventsExpired');
    await page.screenshot({ path: `${SCREENSHOTS}/B9AR.6-dale-expired.png` });
    await context.close();
  });

  test('should show no Replay button on a Planned Trade', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await buildPlanned(profile, BREN, closeOf('2026-11-02'));
    await expect(detailReplayButton(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Replay', exact: true })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: /^Replay, / })).toHaveCount(0);
    await context.close();
  });

  test('should say No Mark once on Tue 11-10 with Add the Mark and a dash where the Mark is needed, then word an acknowledged Mark as the acknowledgment', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page, trade } = await build(profile, CORV, closeOf('2026-11-11'), 7);
    await openDrawer(page, 'Replay');
    let scope = replay(page);
    await seek(page, scope, 'ArrowLeft');
    await expect(sliderValue(scope)).toHaveText('Tue Nov 10 · 7 of 8');
    await expect(headline(scope)).toHaveText('No Mark for the put on Tue Nov 10.');
    // Said once, at normal size (not the figure's large type), and with nothing computed under it.
    expect((await scope.innerText()).match(/No Mark for/g) ?? [], 'No Mark for … is said once in the whole overlay').toHaveLength(1);
    await expect(scope.locator('.replay-figure')).toHaveCount(0);
    await expect(going(scope)).toHaveCount(0);
    await expect(stake(scope)).toHaveCount(0);
    // A dash named "No Mark" in each cell that needs the Mark.
    for (const [row, cell] of [['Put Mark', readoutValue], ['At Stop', readoutValue], ['At Stop', readoutR], ['At Target', readoutValue], ['At Target', readoutR], ['At Worst case', readoutValue]] as const) {
      await expect(noMarkDash(cell(scope, row)), `${row}`).toBeVisible();
    }
    // Where the Trade would end at the Stop needs no Mark, so it stands.
    await expect(readoutPnl(scope, 'At Stop')).toHaveText('−$318.00');
    await page.screenshot({ path: `${SCREENSHOTS}/B9AR.6-corv-no-mark.png` });
    // "Add the Mark" opens the Review's Marks row for the put.
    await scope.getByRole('link', { name: 'Add the Mark' }).click();
    await expect(page).toHaveURL(/\/review\?.*trade=/);
    const cellName = 'CORV Nov 20 $80 Put Mark, Tue Nov 10';
    await expect(page.getByRole('textbox', { name: cellName, exact: true })).toBeVisible();
    // Choosing the cell opens its editor.
    await page.getByRole('textbox', { name: cellName, exact: true }).click();
    const row = page.getByRole('region', { name: cellName, exact: true });
    await expect(row).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/B9AR.6-corv-add-the-mark.png` });
    // Acknowledge it as unavailable, then back to the replay on Tue 11-10.
    await row.getByRole('button', { name: "Can't get a price" }).click();
    await row.getByLabel('Reason (required)').fill('No quote available.');
    await (await marksPanelOf(page, trade)).getByRole('button', { name: /^Save Marks/ }).click();
    // Saving moves the card on to another panel (A157), so the saved row is read again from the Marks panel.
    await expect(saveMarksButton(page)).toHaveText('Save Marks (0)');
    await marksPanelOf(page, trade);
    await expect(row).toContainText('Acknowledged Unavailable');
    await page.goto(`/trades/${trade.tradeId}`);
    await expect(detail.heading(page, 'CORV')).toBeVisible(LAUNCH);
    await openDrawer(page, 'Replay');
    scope = replay(page);
    await seek(page, scope, 'ArrowLeft');
    await expect(sliderValue(scope)).toHaveText('Tue Nov 10 · 7 of 8');
    // The top line is the acknowledgment's own words, no longer "No Mark for …"; it is not a price.
    await expect(headline(scope)).toContainText(/acknowledged unavailable/i);
    await expect(headline(scope)).toContainText('Tue Nov 10');
    await expect(headline(scope)).not.toContainText('No Mark for');
    await expect(scope).not.toContainText('No Mark for');
    await expect(scope.locator('.replay-figure')).toHaveCount(0);
    // The dash stays, and no figure takes its place.
    for (const [name, cell] of [['Put Mark', readoutValue], ['At Stop', readoutValue], ['At Target', readoutValue]] as const) await expect(noMarkDash(cell(scope, name)), name).toBeVisible();
    await expect(readoutValue(scope, 'Trade P&L')).not.toContainText(/[−+]\$\d|\dR/);
    const tuesday = await sessionCard(scope, 'Tue Nov 10');
    await expect(cardRows(tuesday).filter({ hasText: /^(Put Mark|Trade P&L)/ })).toHaveText(['Put Mark—', 'Trade P&L—']);
    // "Add the Mark" still shows: an acknowledged key stays open to a later Mark.
    await expect(scope.getByRole('link', { name: 'Add the Mark' })).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/B9AR.6-corv-acknowledged.png` });
    await context.close();
  });
});
