import type { Locator, Page } from '@playwright/test';
import { actionEntriesOf, actionFormOf, cardHeader, enterMark, expect, markCell, openReview, probe, reachCard, test, workspaceOf } from '../d4/support.ts';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import { atBothWidths, openAbcDef } from './support.ts';

const storedActions = async (page: Page) => actionEntriesOf(workspaceOf(await probe(page))!);
const refusalOf = (page: Page): Locator => page.getByRole('status').filter({ hasText: /note isn't saved\./ });

// ABC holds an Action form with a Roll and a reason typed; DEF's header is then pressed.
async function pressDefOverUnsavedAbc(page: Page): Promise<Locator> {
  await openReview(page);
  await enterMark(page, 'ABC', 'Mon Oct 12', '29.00');
  const form = await actionFormOf(page, 'ABC');
  await form.getByRole('radio', { name: 'Roll', exact: true }).check();
  await form.getByLabel('Why? (required)').fill('Moving it out.');
  await cardHeader(page, 'DEF').click();
  await expect(refusalOf(page)).toBeVisible();
  return form;
}

test.use({ actionTimeout: 15_000 });

test.describe('B95.7 The refusal on the Trade pressed (AC-REV-001)', () => {
  test('should name the Trade whose form is unsaved, offer its three choices with Save it focused, and keep the Trade pressed shut', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openAbcDef(profile, copySetup);
    await pressDefOverUnsavedAbc(page);
    const refusal = refusalOf(page);
    await atBothWidths(page, async (width) => {
      await expect(refusal.getByText("ABC's note isn't saved.", { exact: true }), `the Trade named at ${width}`).toBeVisible();
      await expect(refusal.getByRole('button')).toHaveText(['Save it', 'Discard it', 'Back to ABC']);
      await expect(refusal.getByRole('button', { name: 'Save it', exact: true })).toBeFocused();
      await expect(cardHeader(page, 'DEF'), `the Trade pressed stays shut at ${width}`).toHaveAttribute('aria-expanded', 'false');
      await expect(cardHeader(page, 'ABC')).toHaveAttribute('aria-expanded', 'true');
      await expectNoSidewaysScroll(page, `the refusal at ${width} px`);
    });
    expect(await storedActions(page), 'the refusal saves nothing').toHaveLength(0);
    await context.close();
  });

  test('should return to the unsaved form with its values on Back to ABC', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openAbcDef(profile, copySetup);
    const form = await pressDefOverUnsavedAbc(page);
    await refusalOf(page).getByRole('button', { name: 'Back to ABC', exact: true }).click();
    await expect(refusalOf(page)).toHaveCount(0);
    await expect(form.locator(':focus'), 'focus back in the form').toHaveCount(1);
    await atBothWidths(page, async (width) => {
      await expect(form.getByRole('radio', { name: 'Roll', exact: true }), `the choice kept at ${width}`).toBeChecked();
      await expect(form.getByLabel('Why? (required)')).toHaveValue('Moving it out.');
      await expect(cardHeader(page, 'DEF')).toHaveAttribute('aria-expanded', 'false');
    });
    expect(await storedActions(page)).toHaveLength(0);
    await context.close();
  });

  test('should save the form on Save it and then open the Trade pressed', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openAbcDef(profile, copySetup);
    await pressDefOverUnsavedAbc(page);
    await refusalOf(page).getByRole('button', { name: 'Save it', exact: true }).click();
    await expect(cardHeader(page, 'DEF')).toHaveAttribute('aria-expanded', 'true');
    await atBothWidths(page, async (width) => {
      await expect(refusalOf(page), `the refusal gone at ${width}`).toHaveCount(0);
      await expect(cardHeader(page, 'DEF')).toHaveAttribute('aria-expanded', 'true');
      await expect(cardHeader(page, 'ABC')).toHaveAttribute('aria-expanded', 'false');
    });
    const saved = await storedActions(page);
    expect(saved, "ABC's Roll saved once").toHaveLength(1);
    expect(JSON.stringify(saved)).toContain('Moving it out.');
    await context.close();
  });

  test('should show the form own refusal, and stay on it, when Save it cannot save', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openAbcDef(profile, copySetup);
    const form = await pressDefOverUnsavedAbc(page);
    // The reason is emptied, so Roll has none and cannot be saved.
    await refusalOf(page).getByRole('button', { name: 'Back to ABC', exact: true }).click();
    await form.getByLabel('Why? (required)').fill('');
    await form.getByLabel('Conviction now (optional)').getByRole('button', { name: '2', exact: true }).click();
    await cardHeader(page, 'DEF').click();
    await refusalOf(page).getByRole('button', { name: 'Save it', exact: true }).click();
    await atBothWidths(page, async (width) => {
      await expect(form.getByText('Say why.', { exact: true }), `the form own refusal at ${width}`).toBeVisible();
      await expect(cardHeader(page, 'ABC')).toHaveAttribute('aria-expanded', 'true');
      await expect(cardHeader(page, 'DEF')).toHaveAttribute('aria-expanded', 'false');
    });
    expect(await storedActions(page)).toHaveLength(0);
    await context.close();
  });

  test('should save the form on Save it and open the Trade pressed, with the choice pressed at 375 wide', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openAbcDef(profile, copySetup);
    await pressDefOverUnsavedAbc(page);
    await setWidth(page, 375);
    await refusalOf(page).getByRole('button', { name: 'Save it', exact: true }).click();
    await expect(cardHeader(page, 'DEF'), 'DEF opens at 375').toHaveAttribute('aria-expanded', 'true');
    await expect(refusalOf(page)).toHaveCount(0);
    expect(await storedActions(page), "ABC's Roll saved once").toHaveLength(1);
    await context.close();
  });

  test('should let the form go on Discard it at 375 wide and open the Trade pressed', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openAbcDef(profile, copySetup);
    await pressDefOverUnsavedAbc(page);
    await setWidth(page, 375);
    await refusalOf(page).getByRole('button', { name: 'Discard it', exact: true }).click();
    await expect(cardHeader(page, 'DEF'), 'DEF opens at 375').toHaveAttribute('aria-expanded', 'true');
    await expect(refusalOf(page)).toHaveCount(0);
    expect(await storedActions(page), 'Discard it saves nothing').toHaveLength(0);
    await context.close();
  });

  test('should let the form go on Discard it and open the Trade pressed', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openAbcDef(profile, copySetup);
    await pressDefOverUnsavedAbc(page);
    await refusalOf(page).getByRole('button', { name: 'Discard it', exact: true }).click();
    await expect(cardHeader(page, 'DEF')).toHaveAttribute('aria-expanded', 'true');
    await atBothWidths(page, async (width) => {
      await expect(refusalOf(page), `the refusal gone at ${width}`).toHaveCount(0);
      await expect(cardHeader(page, 'ABC')).toHaveAttribute('aria-expanded', 'false');
    });
    // ABC's form starts again from its preselection.
    await reachCard(page, 'ABC');
    const again = await actionFormOf(page, 'ABC');
    await expect(again.getByRole('radio', { name: 'Hold', exact: true })).toBeChecked();
    await expect(again.getByLabel('Why? (optional)')).toHaveValue('');
    expect(await storedActions(page), 'Discard it saves nothing').toHaveLength(0);
    await context.close();
  });

  test('should not refuse when only the Marks step holds typed Marks', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page } = await openAbcDef(profile, copySetup);
    await openReview(page);
    await reachCard(page, 'ABC');
    // A Mark typed and not saved sits in the page's Marks step, which no card owns.
    await (await markCell(page, 'DEF', 'Mon Oct 12')).fill('39.00');
    await cardHeader(page, 'DEF').click();
    await atBothWidths(page, async (width) => {
      await expect(cardHeader(page, 'DEF'), `DEF opens at ${width}`).toHaveAttribute('aria-expanded', 'true');
      await expect(refusalOf(page)).toHaveCount(0);
    });
    await context.close();
  });
});
