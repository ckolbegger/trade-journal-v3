import { actionEntriesOf, actionFormOf, checkForUpdate, confirmReference, defineSetup, detail, enterMark, expect, launchAt, MONDAY_1700, onboardedAt, openReview, openTradeFromOpenList, pressSave, probe, reloadFromNotice, test, workspaceOf, type ProbedDatabase } from '../d4/support.ts';
import { answerDebt, AT_10, debtsOf, deferEntry, entriesWithSettledDebt, fillDebtAnswers } from '../d5/support.ts';
import { atBothWidths } from './support.ts';

test.use({ actionTimeout: 15_000 });

// A Workspace made on the D9 release (the d9r2 build): onboarded, one Trade XYZ with 100 shares at 50.00 and its entry reflection put off, so a Position Change Reflection is owed.
const D9_OWED = defineSetup('d95-d9-owed-reflection', async (profile) => {
  const { context, page } = await onboardedAt(profile, MONDAY_1700);
  await confirmReference(page);
  await deferEntry(page, [AT_10]);
  return { context, made: undefined };
});

interface StoredDefinition {
  readonly id: string;
  readonly entryTypeKey: string;
  readonly revisionNumber: number;
}
interface StoredVersion {
  readonly definitionId?: string;
}
// The stored form a record names, read as the Entry Type and revision number it is: ids are compared by what they name, never by label.
const formNamed = (workspace: ProbedDatabase, id: string | undefined): { entryTypeKey: string; revisionNumber: number } | undefined => {
  const found = (workspace.stores['journalDefinitions'] as StoredDefinition[]).find((d) => d.id === id);
  return found && { entryTypeKey: found.entryTypeKey, revisionNumber: found.revisionNumber };
};
const lastVersionOf = (entry: { versions?: readonly unknown[] }): StoredVersion => (entry.versions as StoredVersion[]).at(-1)!;

test.describe('B95.10 A Workspace made by the D9 release opens in this one (AC-JOUR-007)', () => {
  test('should keep the form of a reflection owed on an open Trade and save a new Action under the new form', async ({ server, profile, copySetup }) => {
    test.setTimeout(300_000);
    server.use('dist-releases/d9r2');
    await copySetup(D9_OWED);
    const context = await launchAt(profile, MONDAY_1700);
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('/');
    const old = workspaceOf(await probe(page))!;
    const owedBefore = debtsOf(old) as unknown as { definitionId: string }[];
    expect(owedBefore, 'one reflection owed on the D9 release').toHaveLength(1);
    const owedForm = owedBefore[0]!.definitionId;
    expect(formNamed(old, owedForm)).toEqual({ entryTypeKey: 'entry-type.position-change-reflection', revisionNumber: 1 });

    server.use('dist-releases/current');
    expect(await checkForUpdate(page)).toEqual({ waiting: 'installed' });
    await reloadFromNotice(page);
    await expect(page.getByRole('table', { name: 'Open Trades' }).getByRole('link', { name: 'XYZ', exact: true })).toBeVisible({ timeout: 10_000 });

    // The launch added revision 2 of the three forms and left the owed reflection naming revision 1.
    const upgraded = workspaceOf(await probe(page))!;
    expect(formNamed(upgraded, (debtsOf(upgraded) as unknown as { definitionId: string }[])[0]!.definitionId), 'the owed reflection keeps its form').toEqual({ entryTypeKey: 'entry-type.position-change-reflection', revisionNumber: 1 });
    expect((debtsOf(upgraded) as unknown as { definitionId: string }[])[0]!.definitionId).toBe(owedForm);

    // On Trade Detail the owed reflection is still the old form, with no Plan Departure Reason field, at both widths.
    await openTradeFromOpenList(page, 'XYZ');
    await atBothWidths(page, async (width) => {
      await expect(detail.reflectionOwed(page), `the owed reflection at ${width}`).toBeVisible();
    });
    await detail.reflectNowButton(page).click();
    await expect(detail.debtForm(page).getByLabel('Why did you leave the Plan?'), 'no field of the new form').toHaveCount(0);
    await atBothWidths(page, async (width) => {
      await expect(detail.debtForm(page), `the form at ${width}`).toBeVisible();
    });
    await fillDebtAnswers(page);
    await answerDebt(page, undefined);
    const answered = workspaceOf(await probe(page))!;
    const settling = entriesWithSettledDebt(answered) as unknown as { versions: StoredVersion[] }[];
    expect(settling, 'the answer is stored').toHaveLength(1);
    expect(lastVersionOf(settling[0]!).definitionId, 'the answer is saved under the form it was owed').toBe(owedForm);

    // A new Action from the Review is saved under revision 2 of Daily Trade Review.
    await openReview(page);
    await enterMark(page, 'XYZ', 'Mon Oct 12', '52.00');
    const form = await actionFormOf(page, 'XYZ');
    await atBothWidths(page, async (width) => {
      await expect(form.getByRole('radio', { name: 'Hold', exact: true }), `Hold offered at ${width}`).toBeChecked();
    });
    await pressSave(form);
    const saved = actionEntriesOf(workspaceOf(await probe(page))!);
    expect(saved, 'one Action saved').toHaveLength(1);
    const actionForm = lastVersionOf(saved[0]!).definitionId;
    expect(formNamed(workspaceOf(await probe(page))!, actionForm)).toEqual({ entryTypeKey: 'entry-type.daily-trade-review', revisionNumber: 2 });
    await context.close();
  });
});
