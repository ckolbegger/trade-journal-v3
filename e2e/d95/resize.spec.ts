import { actionEntriesOf, actionFormOf, expect, marksStepOf, observationsOf, openReview, probe, reachCard, saveMarksButton, test, workspaceOf, answerSlipQuestions, cardHeader } from '../d4/support.ts';
import { setWidth } from '../d7p/support.ts';
import { openAbcDef } from './support.ts';

test.use({ actionTimeout: 15_000 });

// Each order crosses the 960 px breakpoint both ways.
const ORDERS = [[1280, 375, 1280], [375, 1280, 375]] as const;

test.describe('B95.17 Resizing keeps what is typed (AC-UI-001)', () => {
  for (const [start, middle, end] of ORDERS) {
    test(`should keep typed Marks, the open card and a half-typed Action when the window goes ${start} to ${middle} to ${end}`, async ({ profile, copySetup }) => {
      test.setTimeout(240_000);
      const { context, page } = await openAbcDef(profile, copySetup);
      await setWidth(page, start);
      await openReview(page);
      const step = marksStepOf(page);
      const mark = (symbol: string) => step.getByRole('textbox', { name: `${symbol} Mark, Mon Oct 12`, exact: true });

      // A Mark typed and not saved, and DEF's card open.
      await mark('ABC').fill('29.00');
      await reachCard(page, 'DEF');
      for (const width of [middle, end]) {
        await setWidth(page, width);
        await expect(mark('ABC'), `the typed Mark at ${width}`).toHaveValue('29.00');
        await expect(mark('DEF'), `DEF's empty price at ${width}`).toHaveValue('');
        await expect(cardHeader(page, 'DEF'), `DEF's card stays open at ${width}`).toHaveAttribute('aria-expanded', 'true');
        await expect(cardHeader(page, 'ABC'), `ABC's card stays shut at ${width}`).toHaveAttribute('aria-expanded', 'false');
      }
      expect(observationsOf(workspaceOf(await probe(page))!), 'the typed Mark is not stored').toHaveLength(0);

      // Both Marks saved at the width the window ended on; then an Action half typed.
      await mark('DEF').fill('40.50');
      await answerSlipQuestions(page);
      await saveMarksButton(page).click();
      await expect(step.getByRole('button', { name: /^(Save Marks \(0\)|Edit)$/ })).toBeVisible();
      expect(observationsOf(workspaceOf(await probe(page))!), 'two Marks stored').toHaveLength(2);
      const form = await actionFormOf(page, 'ABC');
      await form.getByRole('radio', { name: 'Roll', exact: true }).check();
      await form.getByLabel('Why? (required)').fill('Moving it out.');
      for (const width of [middle, end]) {
        await setWidth(page, width);
        await expect(form.getByRole('radio', { name: 'Roll', exact: true }), `Roll stays chosen at ${width}`).toBeChecked();
        await expect(form.getByLabel('Why? (required)'), `the half-typed reason at ${width}`).toHaveValue('Moving it out.');
        await expect(cardHeader(page, 'ABC'), `ABC's card stays open at ${width}`).toHaveAttribute('aria-expanded', 'true');
      }
      expect(actionEntriesOf(workspaceOf(await probe(page))!), 'the half-typed Action is not stored').toHaveLength(0);
      await context.close();
    });
  }
});
