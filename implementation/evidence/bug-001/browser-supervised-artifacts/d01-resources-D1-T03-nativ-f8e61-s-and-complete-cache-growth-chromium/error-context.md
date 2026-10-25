# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: d01-resources.spec.ts >> D1-T03 native resource receipt accounts for stored bytes and complete cache growth
- Location: tests/browser/d01-resources.spec.ts:3:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5174/
Call log:
  - navigating to "http://localhost:5174/", waiting until "load"

```

# Test source

```ts
  1  | import type { Page } from '@playwright/test';
  2  | import { expect } from './fixtures';
  3  | export async function requireWritable(page: Page) {
> 4  |   await page.goto('/');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5174/
  5  |   await expect(page.getByLabel('Workspace time zone')).toBeVisible();
  6  | }
  7  | export async function onboard(page: Page) {
  8  |   await requireWritable(page);
  9  |   await page.getByLabel('Workspace time zone').fill('America/New_York');
  10 |   await page.getByRole('button', { name: 'Create Workspace' }).click();
  11 |   await page.getByLabel('Institution name').fill('Fidelity');
  12 |   await page.getByRole('button', { name: 'Add Institution' }).click();
  13 |   await page.getByLabel('New Account name').fill('Taxable');
  14 |   await page.getByRole('button', { name: 'Add Account' }).click();
  15 |   await expect(page.getByText('Account saved. You can now confirm a Plan.')).toBeVisible();
  16 | }
  17 | export async function fillPlan(page: Page) {
  18 |   await page.getByRole('button', { name: 'New Plan' }).click();
  19 |   const next = page.getByRole('button', { name: 'Next: Plan and reflection' });
  20 |   if (await next.isVisible()) await next.click();
  21 |   for (const [label, value] of [['Stock symbol', 'XYZ'], ['Quantity (shares)', '100'], ['Intended entry (USD)', '50'], ['Stop (underlying price, USD)', '45'], ['Target (underlying price, USD)', '60'], ['Why this trade, why now?', 'Improving earnings'], ['What would invalidate the thesis?', 'Thesis fails']]) await page.getByLabel(label).fill(value);
  22 | }
  23 | export async function confirmPlan(page: Page) {
  24 |   await fillPlan(page);
  25 |   await page.getByRole('button', { name: 'Confirm Plan' }).click();
  26 |   await expect(page.getByRole('heading', { name: 'XYZ · Planned' })).toBeVisible();
  27 | }
  28 | 
```