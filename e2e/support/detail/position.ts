// Trade Detail reads of drawer lane D2 (Position): Position, Open Lots, Open P&L, Realized to date, Lot Matches, Fee reconciliation,
// Executions and Settlement. Each read goes through the current layout, scoped to its card. Callers open the Position drawer first.
import type { Locator, Page } from '@playwright/test';
import { detailRoot, figureIn, regionOf, roleOf, valueIn } from './scope.ts';

export const position = (page: Page): Locator => regionOf(page, 'Position');
export const positionValue = (page: Page): Locator => valueIn(position(page), 'Position');
export const openLotsRegion = (page: Page): Locator => regionOf(page, 'Open Lots');
export const openLots = (page: Page): Locator => position(page).getByRole('table', { name: 'Open Lots' });
export const lotMatches = (page: Page): Locator => regionOf(page, 'Lot Matches').getByRole('table', { name: 'Lot Matches' });
export const lotMatchesHeading = (page: Page): Locator => roleOf(detailRoot(page), 'heading', { name: 'Lot Matches' });
export const feeReconciliationHeading = (page: Page): Locator => detailRoot(page).getByRole('heading', { name: 'Fee reconciliation' });
export const executions = (page: Page, count: number): Locator => regionOf(page, `Executions (${count})`);
export const executionRows = (page: Page, count: number): Locator => executions(page, count).locator('ul.executions > li');

// The Position card's figures (T8P.17). Callers open the Position drawer first.
export const positionOpenPnl = (page: Page): Locator => valueIn(position(page), 'Open P&L');
export const positionOpenPnlFigure = (page: Page): Locator => figureIn(position(page), 'Open P&L');
export const positionRealizedToDate = (page: Page): Locator => valueIn(position(page), 'Realized to date');

