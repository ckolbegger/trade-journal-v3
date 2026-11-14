// Trade Detail reads of rail lane R2: Conditions (Risk to stop, Reward to target, the Conditions table, Worst case, Max reward) and Needs
// you (the Settlement Due panel, Record expiration, the owed reflections). Each read goes through the current layout, scoped to its card.
import type { Locator, Page } from '@playwright/test';
import { detailRoot, figureIn, journalRegion, regionOf, roleOf, valueIn } from './scope.ts';

// Conditions. Each condition's Risk to stop or Reward to target is a Plan and Risk card (T8P.31), one line per condition in Plan order: open that
// drawer first. Worst case and Max reward are the rail's Conditions card's.
const planRiskPanel = (page: Page): Locator => detailRoot(page).locator('#drawer-panel-plan-and-risk');
export const riskToStop = (page: Page): Locator => valueIn(planRiskPanel(page), 'Risk to stop');
export const rewardToTarget = (page: Page): Locator => valueIn(planRiskPanel(page), 'Reward to target');
export const riskFigure = (page: Page, term: string): Locator =>
  term === 'Worst case' || term === 'Max reward' ? conditionsSummary(page).locator('li', { hasText: `${term}:` }).locator('.number') : figureIn(planRiskPanel(page), term);

// The rail's Conditions card (W5, W6): one block per condition in Plan order, then Worst case and Max reward, or the note that stands in for them.
export const conditionsCard = (page: Page): Locator => regionOf(page, 'Conditions');
export const conditionBlocks = (page: Page): Locator => conditionsCard(page).getByRole('list', { name: 'Conditions', exact: true }).getByRole('listitem');
// The block of the condition whose row 2 reads `text` ("MNO at or below 41.00").
export const conditionBlock = (page: Page, text: string): Locator => conditionBlocks(page).filter({ has: page.getByText(text, { exact: true }) });
export const conditionsSummary = (page: Page): Locator => conditionsCard(page).getByRole('list', { name: 'Worst case and Max reward' });

// Needs you (W7): the rail's card, which holds the Settlement Due panel, the alerts and the owed reflections' headings.
export const needsYouCard = (page: Page): Locator => regionOf(page, 'Needs you');

// Needs you: the Settlement Due panel.
export const settlementDuePanel = (page: Page): Locator => regionOf(page, /^Settlement Due/);
export const settlementDueHeading = (page: Page): Locator => roleOf(settlementDuePanel(page), 'heading', { name: /^Settlement Due/ });
export const settlementDueValue = (page: Page, term: string): Locator => valueIn(settlementDuePanel(page), term);
export const recordExpirationLink = (page: Page): Locator => roleOf(settlementDuePanel(page), 'link', { name: 'Record expiration' });

// Needs you: the owed reflections, listed in the rail's card (W7). Reflect now there selects the Journal drawer and opens the form on its card.
export const reflectionOwed = (page: Page): Locator => needsYouCard(page).getByText('Reflection owed');
export const closeReviewOwed = (page: Page): Locator => roleOf(needsYouCard(page), 'heading', { name: /^Close Review/, level: 3 });
export const closeReviewOwedHeading = (page: Page): Locator => needsYouCard(page).getByRole('heading', { name: 'Close Review Reflection owed', level: 3 });
export const dueNote = (page: Page, text: string, exact = false): Locator => needsYouCard(page).getByText(text, { exact });
export const reflectNowButton = (page: Page): Locator => roleOf(needsYouCard(page), 'button', { name: 'Reflect now' });

// The Journal card's own items, which hold the forms. `includeHidden` so an absence read holds while another drawer is selected.
export const reflectionOwedExact = (page: Page): Locator => journalRegion(page).getByText('Reflection owed', { exact: true });
export const journalReflectNowButton = (page: Page): Locator => detailRoot(page).locator('#drawer-panel-journal').getByRole('button', { name: 'Reflect now', includeHidden: true });
export const declineButton = (page: Page): Locator => roleOf(journalRegion(page), 'button', { name: 'Decline', exact: true });
export const answerButton = (page: Page): Locator => roleOf(journalRegion(page), 'button', { name: 'Answer', exact: true });
export const debtForm = (page: Page): Locator => roleOf(journalRegion(page), 'form', { name: 'Reflection' });
export const savedReflection = (page: Page): Locator => roleOf(journalRegion(page), 'region', { name: 'Saved reflection' });
// An owed Debt item for the Position Change at a local time.
export const owedItem = (page: Page, when: string): Locator =>
  journalRegion(page).locator('li', { has: roleOf(page, 'heading', { level: 3 }), hasText: `Position Change at ${when}` }).last();
