import type { Locator, Page } from '@playwright/test';
import { debtsOf, entriesWithSettledDebt } from '../d5/support.ts';
import { cardHeader, closeReasonGroup, closingSection, dayLine, debtFormOf, enterMark, expect, fillRows, openExitForm, openReview, probe, reachPanel, reflectionsOf, saveAction, sell, setClock, test, TUESDAY_1700, workspaceOf } from '../d6/support.ts';
import { expectNoSidewaysScroll } from '../d7p/support.ts';
import { atBothWidths, openAbcDef } from './support.ts';

type Where = 'Review' | 'Detail';

// The sale form of the Trade, from its Review card (after a saved Exit) or from its Trade Detail.
async function openSale(page: Page, where: Where, symbol: string, ids: Record<string, string>): Promise<Locator> {
  if (where === 'Review') {
    const panel = await reachPanel(page, symbol, 'Action');
    await panel.getByRole('button', { name: 'Record the sale', exact: true }).click();
  } else {
    await page.goto(`/trades/${ids[symbol]}`);
    await openExitForm(page);
  }
  const form = page.locator('form.plan-form');
  await expect(form.getByRole('group', { name: 'Execution 1' })).toBeVisible();
  return form;
}

// The Debts whose latest version is still Outstanding.
const owedOf = (workspace: NonNullable<ReturnType<typeof workspaceOf>>) => debtsOf(workspace).filter((d) => (d.versions as readonly { status: string }[]).at(-1)?.status === 'Outstanding');

// The stores a sale writes: its Trade, the Journal entries, declines, obligations and debts. Read together, so a write to any of them shows.
const WRITTEN_STORES = ['trades', 'journalEntries', 'journalDeclines', 'journalObligations', 'journalDebts'] as const;
async function writtenStores(page: Page): Promise<string> {
  const workspace = workspaceOf(await probe(page))!;
  return JSON.stringify(WRITTEN_STORES.map((name) => {
    const rows = workspace.stores[name];
    if (rows === undefined) throw new Error(`the workspace has no ${name} store`);
    return rows;
  }));
}

const SAY_WHY = 'Say why you left the Plan, or choose “Say why later”.';

const planBox = (page: Page): Locator => page.getByRole('region', { name: 'Against the Plan' });

test.use({ actionTimeout: 15_000 });

test.describe('B95.8 The sale measured against the Plan Exit (AC-REV-008, AC-POS-004)', () => {
  for (const where of ['Review', 'Detail'] as const) {
    test(`should say the whole sale at the Stop follows the Plan, ask nothing, and ask the Close Reason of a closing sale, from ${where === 'Review' ? 'the Review' : 'Trade Detail'}`, async ({ profile, copySetup }) => {
      test.setTimeout(90_000);
      const { context, page, ids } = await openAbcDef(profile, copySetup);
      if (where === 'Review') {
        await openReview(page);
        // A Mark of $27.50 is past ABC's Stop at $28.00; the Plan says out, and an Exit is saved.
        await enterMark(page, 'ABC', 'Mon Oct 12', '27.50');
        await saveAction(page, 'Exit', undefined, 'ABC');
      }
      const form = await openSale(page, where, 'ABC', ids);
      await fillRows(page, [sell('100', '27.60', '1.00', '2026-10-12T11:00')]);
      await atBothWidths(page, async (width) => {
        await expect(planBox(page).getByText('Against the Plan', { exact: true }), `the measure at ${width}`).toBeVisible();
        await expect(planBox(page).getByText("The Plan's exit: all 100 shares at the Stop (ABC at or below $28.00) or the Target (ABC at or above $36.00).", { exact: true })).toBeVisible();
        await expect(planBox(page).getByText('Follows the Plan: all 100 shares, at the Stop. Nothing more to ask.', { exact: true })).toBeVisible();
        await expect(page.getByLabel(/^Why (did you leave the Plan|only part)\?$/), `no question at ${width}`).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Say why later' })).toHaveCount(0);
        // A sale gives no reflection choices; a closing sale asks its Close Reason, with nothing chosen and no Close Review choice.
        await expect(form.getByLabel('Reflect now')).toHaveCount(0);
        await expect(closingSection(page)).toBeVisible();
        await expect(closeReasonGroup(page).getByRole('radio', { checked: true })).toHaveCount(0);
        await expect(page.getByRole('radiogroup', { name: 'Close Review' })).toHaveCount(0);
        await expectNoSidewaysScroll(page, `the sale form at ${width} px`);
      });
      // Saved with no Close Reason it is refused and nothing is written.
      const before = await writtenStores(page);
      await form.getByRole('button', { name: 'Save exit' }).click();
      await expect(closingSection(page).locator('.field-error, [role="alert"]').first()).toBeVisible();
      expect(await writtenStores(page), 'a refused sale writes nothing').toBe(before);
      await closeReasonGroup(page).getByRole('radio', { name: 'Stop Triggered', exact: true }).check();
      await form.getByRole('button', { name: 'Save exit' }).click();
      const receipt = page.getByText('Recorded. ABC is closed. Its Close Review is due in the next Review.', { exact: true });
      await expect(receipt).toBeVisible();
      expect(await writtenStores(page), 'the snapshot sees the saved sale').not.toBe(before);
      await atBothWidths(page, async (width) => {
        await expect(receipt, `the receipt at ${width}`).toBeVisible();
        await expect(page.getByText('Why you left the Plan is owed')).toHaveCount(0);
      });
      // One Close Review owed and no reflection Debt; the Close Review is never blocking.
      const workspace = workspaceOf(await probe(page))!;
      const debts = debtsOf(workspace);
      expect(debts, 'one Close Review Debt and nothing else').toHaveLength(1);
      expect(JSON.stringify(debts[0])).toContain('close-review');
      expect(entriesWithSettledDebt(workspace), 'no reflection settled with a Debt').toHaveLength(0);
      // Back in the Review the closed Trade is listed under "Closed · Close Review".
      if (where === 'Review') await page.getByRole('button', { name: 'Back to the Review' }).click();
      else await openReview(page);
      await atBothWidths(page, async (width) => {
        await expect(page.getByRole('heading', { name: 'Closed · Close Review', level: 2 }), `the group at ${width}`).toBeVisible();
        await expect(cardHeader(page, 'ABC')).toContainText('Close Review · next Review');
      });
      await context.close();
    });
  }

  for (const where of ['Review', 'Detail'] as const) {
    test(`should ask Why only part? of a sale of part of the Position at the Stop, and record it with the answer, from ${where === 'Review' ? 'the Review' : 'Trade Detail'}`, async ({ profile, copySetup }) => {
      test.setTimeout(90_000);
      const { context, page, ids } = await openAbcDef(profile, copySetup);
      if (where === 'Review') {
        await openReview(page);
        await enterMark(page, 'ABC', 'Mon Oct 12', '27.50');
        await saveAction(page, 'Exit', undefined, 'ABC');
      }
      const form = await openSale(page, where, 'ABC', ids);
      await fillRows(page, [sell('40', '27.60', '1.00', '2026-10-12T11:00')]);
      await atBothWidths(page, async (width) => {
        await expect(planBox(page).getByText('Leaves the Plan:', { exact: true }), `the measure at ${width}`).toBeVisible();
        await expect(planBox(page).getByText("The Plan's exit is all 100 shares. This sells 40.", { exact: true })).toBeVisible();
        await expect(page.getByLabel('Why only part?'), `the question at ${width}`).toBeVisible();
        await expect(page.getByRole('button', { name: 'Say why later' })).toBeVisible();
        await expect(form.getByLabel('Reflect now')).toHaveCount(0);
        await expect(closingSection(page)).toHaveCount(0);
      });
      // Left empty, the save is refused in words and writes nothing.
      const before = await writtenStores(page);
      await form.getByRole('button', { name: 'Save exit' }).click();
      await expect(page.getByText(SAY_WHY, { exact: true }).first(), 'the refusal in words').toBeVisible();
      expect(await writtenStores(page), 'a refused sale writes nothing').toBe(before);
      await page.getByLabel('Why only part?').fill('Trimming the position.');
      await form.getByRole('button', { name: 'Save exit' }).click();
      await expect(page.getByText('Recorded.', { exact: false }).first().or(page.getByRole('heading', { name: 'Exit recorded' }))).toBeVisible();
      expect(await writtenStores(page), 'the snapshot sees the saved sale').not.toBe(before);
      await atBothWidths(page, async (width) => {
        await expect(page.getByText('Why you left the Plan is owed'), `nothing owed at ${width}`).toHaveCount(0);
      });
      expect(debtsOf(workspaceOf(await probe(page))!), 'the answered reason leaves no Debt').toHaveLength(0);
      await context.close();
    });
  }

  test('should carry the Exit reason of a whole sale before the lines and ask nothing more', async ({ profile, copySetup }) => {
    test.setTimeout(90_000);
    const { context, page, ids } = await openAbcDef(profile, copySetup);
    await openReview(page);
    await enterMark(page, 'ABC', 'Mon Oct 12', '29.00');
    await saveAction(page, 'Exit', 'Taking the gain.', 'ABC');
    const form = await openSale(page, 'Review', 'ABC', ids);
    await fillRows(page, [sell('100', '29.50', '1.00', '2026-10-12T11:00')]);
    await atBothWidths(page, async (width) => {
      await expect(planBox(page).getByText('Neither the Stop nor the Target is reached.', { exact: true }), `the reason at ${width}`).toBeVisible();
      await expect(planBox(page).getByText('Your reason, Mon Oct 12: "Taking the gain." Nothing more to ask.', { exact: true })).toBeVisible();
      await expect(page.getByLabel(/^Why (did you leave the Plan|only part)\?$/)).toHaveCount(0);
    });
    await closeReasonGroup(page).getByRole('radio', { name: 'Time-Based Exit', exact: true }).check();
    await form.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByText('Recorded. ABC is closed. Its Close Review is due in the next Review.', { exact: true })).toBeVisible();
    expect(debtsOf(workspaceOf(await probe(page))!), 'only the Close Review is owed').toHaveLength(1);
    await context.close();
  });

  test('should save a sale at once on Say why later and ask for the reason in the next Review', async ({ profile, copySetup }) => {
    test.setTimeout(120_000);
    const { context, page, ids } = await openAbcDef(profile, copySetup);
    await openReview(page);
    await enterMark(page, 'ABC', 'Mon Oct 12', '27.50');
    await saveAction(page, 'Exit', undefined, 'ABC');
    await openSale(page, 'Review', 'ABC', ids);
    await fillRows(page, [sell('40', '27.60', '1.00', '2026-10-12T11:00')]);
    await page.getByRole('button', { name: 'Say why later' }).click();
    const receipt = page.getByText('Recorded. Why you left the Plan is owed at the next Review.', { exact: true });
    await expect(receipt).toBeVisible();
    await atBothWidths(page, async (width) => {
      await expect(receipt, `the receipt at ${width}`).toBeVisible();
    });
    const debts = debtsOf(workspaceOf(await probe(page))!);
    expect(debts, 'one reflection owed').toHaveLength(1);
    expect(JSON.stringify(debts[0])).toContain('PlanDepartureReason');
    // The next Review asks for it.
    await setClock(context, page, TUESDAY_1700, '/review');
    await expect(page.getByRole('heading', { name: 'Review', level: 1 })).toBeVisible();
    await atBothWidths(page, async (width) => {
      await expect(dayLine(page, 'ABC'), `the Trade's line at ${width}`).toContainText(/To do: .*Say why/);
      await expect(cardHeader(page, 'ABC')).toContainText('Say why');
    });
    const reflections = await reflectionsOf(page, 'ABC');
    await reflections.getByRole('button', { name: /^Reflect on / }).click();
    const debt = await debtFormOf(page, 'ABC');
    await atBothWidths(page, async (width) => {
      await expect(debt.getByLabel(/^Why did you leave the Plan\?/), `the question at ${width}`).toBeVisible();
      await expect(debt.getByLabel(/^Why did you leave the Plan\?/)).toHaveAttribute('aria-required', 'true');
    });
    // Without the reason it cannot be answered, and nothing is written.
    await debt.getByRole('radiogroup', { name: 'Decision mode' }).getByLabel('As Planned').check();
    await debt.getByRole('radiogroup', { name: 'Primary emotion' }).getByLabel('Calm').check();
    await debt.getByRole('radiogroup', { name: 'Decision confidence' }).getByLabel('4').check();
    await debt.getByRole('button', { name: 'Answer', exact: true }).click();
    await expect(debt.getByText('Answer “Why did you leave the Plan?”.', { exact: true }), 'the refusal in words').toBeVisible();
    expect(owedOf(workspaceOf(await probe(page))!), 'still owed').toHaveLength(1);
    await debt.getByLabel(/^Why did you leave the Plan\?/).fill('Trimming the position.');
    await debt.getByRole('button', { name: 'Answer', exact: true }).click();
    await expect(debt).toBeHidden();
    expect(owedOf(workspaceOf(await probe(page))!), 'answered, so nothing owed').toHaveLength(0);
    await context.close();
  });
});
