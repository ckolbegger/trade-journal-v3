import { expectNoSidewaysScroll } from '../d7p/support.ts';
import { actionEntriesOf, actionFormOf, enterMark, expect, pressSave, probe, reachPanel, reloadReview, openReview, test, workspaceOf } from '../d4/support.ts';
import { atBothWidths, openAbcDef } from './support.ts';

const storedActions = async (page: Parameters<typeof probe>[0]) => actionEntriesOf(workspaceOf(await probe(page))!).length;

test.use({ actionTimeout: 15_000 });

test.describe('B95.6 The Action form on the Review (AC-REV-007, AC-REV-003)', () => {
  test('should preselect Hold inside the lines, ask no reason, and show the saved Hold as one line with Change', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openAbcDef(profile, copySetup);
    await openReview(page);
    // A Mark of $29.00 puts ABC inside its Stop at $28.00 and its Target at $36.00.
    await enterMark(page, 'ABC', 'Mon Oct 12', '29.00');
    const form = await actionFormOf(page, 'ABC');
    await atBothWidths(page, async (width) => {
      await expect(form.getByText('Inside its lines. The Plan says hold.', { exact: true }), `the Plan's call at ${width}`).toBeVisible();
      await expect(form.getByRole('radio', { name: 'Hold', exact: true }), `Hold chosen at ${width}`).toBeChecked();
      for (const other of ['Exit', 'Roll', 'Adjust']) await expect(form.getByRole('radio', { name: other, exact: true })).not.toBeChecked();
      await expect(form.getByText('Keep it as it is.', { exact: true })).toBeVisible();
      await expect(form.getByText('Nothing is chosen for you here.', { exact: true })).toHaveCount(0);
      await expect(form.getByLabel('Why? (optional)')).toBeVisible();
      await expect(form.getByRole('button', { name: 'Save Hold', exact: true })).toBeVisible();
      await expectNoSidewaysScroll(page, `Action form at ${width} px`);
    });
    // Opening the form and leaving it records nothing.
    expect(await storedActions(page), 'no Action before Save').toBe(0);
    await pressSave(form);
    const saved = (await reachPanel(page, 'ABC', 'Action')).getByRole('region', { name: 'Saved Action' });
    await expect(saved).toBeVisible();
    await atBothWidths(page, async (width) => {
      await expect(saved.getByText('Mon Oct 12: Hold', { exact: true }), `the saved line at ${width}`).toBeVisible();
      await expect(saved.getByRole('button', { name: 'Change', exact: true })).toBeVisible();
      await expect(saved.getByText('Not done until it is recorded')).toHaveCount(0);
    });
    expect(await storedActions(page), 'one Action saved').toBe(1);
    await context.close();
  });

  test('should preselect nothing past the Stop, refuse a save with no Action or no reason in words, and let an Exit save with none', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openAbcDef(profile, copySetup);
    await openReview(page);
    // A Mark of $27.50 is past ABC's Stop at $28.00: the Plan says out.
    await enterMark(page, 'ABC', 'Mon Oct 12', '27.50');
    const form = await actionFormOf(page, 'ABC');
    await atBothWidths(page, async (width) => {
      await expect(form.getByText('Past your Stop (ABC at or below $28.00). The Plan says out.', { exact: true }), `the Plan's call at ${width}`).toBeVisible();
      await expect(form.getByText('Nothing is chosen for you here.', { exact: true })).toBeVisible();
      for (const choice of ['Hold', 'Exit', 'Roll', 'Adjust']) await expect(form.getByRole('radio', { name: choice, exact: true })).not.toBeChecked();
    });
    // Nothing chosen: refused in words, nothing sent.
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await atBothWidths(page, async (width) => {
      await expect(form.getByText('Choose an Action.', { exact: true }), `the refusal at ${width}`).toBeVisible();
    });
    expect(await storedActions(page), 'nothing saved with no Action').toBe(0);
    // Hold leaves the Plan here, so it is owed a reason.
    await form.getByRole('radio', { name: 'Hold', exact: true }).check();
    await atBothWidths(page, async (width) => {
      await expect(form.getByText('Holding leaves the Plan. Have a new Stop? Choose Adjust.', { exact: true }), `what Hold means at ${width}`).toBeVisible();
      await expect(form.getByLabel('Why? (required)')).toBeVisible();
    });
    await form.getByRole('button', { name: 'Save Hold', exact: true }).click();
    await atBothWidths(page, async (width) => {
      await expect(form.getByText('Say why.', { exact: true }), `the reason refusal at ${width}`).toBeVisible();
    });
    expect(await storedActions(page), 'nothing saved with no reason').toBe(0);
    // The Plan's own exit needs no reason.
    await form.getByRole('radio', { name: 'Exit', exact: true }).check();
    await atBothWidths(page, async (width) => {
      await expect(form.getByText("The Plan's exit: sell all 100 shares at the Stop. No reason needed. Record the sale once it is done.", { exact: true }), `what Exit means at ${width}`).toBeVisible();
      await expect(form.getByLabel('Why? (optional)')).toBeVisible();
    });
    await pressSave(form);
    const saved = (await reachPanel(page, 'ABC', 'Action')).getByRole('region', { name: 'Saved Action' });
    await expect(saved).toBeVisible();
    await atBothWidths(page, async (width) => {
      await expect(saved.getByText('Mon Oct 12: Exit', { exact: true }), `the saved line at ${width}`).toBeVisible();
      await expect(saved.getByText("Not done until it is recorded. Tomorrow's Review will ask.", { exact: true })).toBeVisible();
      await expect(saved.getByRole('button', { name: 'Record the sale', exact: true })).toBeVisible();
    });
    expect(await storedActions(page), 'the Exit saved with no reason').toBe(1);
    await context.close();
  });

  test('should keep what you decided against and the Note behind Add more, and empty the form on Discard back to the preselection', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openAbcDef(profile, copySetup);
    await openReview(page);
    await enterMark(page, 'ABC', 'Mon Oct 12', '29.00');
    const form = await actionFormOf(page, 'ABC');
    const decided = form.getByLabel('Anything you considered doing and decided against?');
    const note = form.getByLabel('Note', { exact: true });
    await expect(decided).toBeHidden();
    await form.getByText('Add more: what you decided against, a note', { exact: true }).click();
    await expect(decided).toBeVisible();
    await expect(note).toBeVisible();
    // Roll is owed a reason; Discard empties everything and goes back to Hold.
    await form.getByRole('radio', { name: 'Roll', exact: true }).check();
    await expect(form.getByText('Close this one and open a later one. Record the roll once it is done.', { exact: true })).toBeVisible();
    await expect(form.getByLabel('Why? (required)')).toBeVisible();
    await form.getByRole('button', { name: 'Save Roll', exact: true }).click();
    await expect(form.getByText('Say why.', { exact: true })).toBeVisible();
    await form.getByLabel('Why? (required)').fill('Moving it out.');
    await decided.fill('Selling now.');
    await note.fill('A note.');
    await form.getByRole('group', { name: 'Conviction now (optional)' }).getByRole('button', { name: '4', exact: true }).click();
    await form.getByRole('button', { name: 'Discard', exact: true }).click();
    await atBothWidths(page, async (width) => {
      await expect(form.getByRole('radio', { name: 'Hold', exact: true }), `Hold back at ${width}`).toBeChecked();
      await expect(form.getByLabel('Why? (optional)')).toHaveValue('');
      await expect(decided).toHaveValue('');
      await expect(note).toHaveValue('');
      await expect(form.getByRole('group', { name: 'Conviction now (optional)' }).getByRole('button', { pressed: true })).toHaveCount(0);
      await expect(form.getByText('Say why.', { exact: true })).toHaveCount(0);
      await expect(form.getByRole('button', { name: 'Discard', exact: true })).toBeDisabled();
    });
    expect(await storedActions(page), 'Discard records nothing').toBe(0);
    await context.close();
  });

  test('should store nothing of a half-typed reason, and show the form empty again after a reload (AC-JOUR-001)', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openAbcDef(profile, copySetup);
    await openReview(page);
    await enterMark(page, 'ABC', 'Mon Oct 12', '29.00');
    const form = await actionFormOf(page, 'ABC');
    await form.getByRole('radio', { name: 'Roll', exact: true }).check();
    await form.getByLabel('Why? (required)').fill('A half-typed thought');
    await form.getByRole('group', { name: 'Conviction now (optional)' }).getByRole('button', { name: '3', exact: true }).click();
    await reloadReview(page);
    const again = await actionFormOf(page, 'ABC');
    await atBothWidths(page, async (width) => {
      await expect(again.getByRole('radio', { name: 'Hold', exact: true }), `Hold preselected again at ${width}`).toBeChecked();
      await expect(again.getByLabel('Why? (optional)')).toHaveValue('');
      await expect(again.getByRole('group', { name: 'Conviction now (optional)' }).getByRole('button', { pressed: true })).toHaveCount(0);
    });
    const everything = JSON.stringify(await probe(page));
    expect(everything, 'the typed reason is in no database').not.toContain('A half-typed thought');
    expect(await storedActions(page), 'no Action stored').toBe(0);
    const browserStorage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(browserStorage, 'the typed reason is in no browser storage').not.toContain('A half-typed thought');
    await context.close();
  });
});
