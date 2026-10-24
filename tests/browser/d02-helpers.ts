import type { Page } from '@playwright/test';
export async function fillOpening(page: Page, disposition: 'Complete' | 'Defer' | 'Decline' = 'Complete') {
  await page.getByRole('button', { name: 'Record initial Position Change' }).click();
  await page.getByLabel('Execution 1 quantity (shares)').fill('40'); await page.getByLabel('Execution 1 price (USD)').fill('49'); await page.getByLabel('Execution 1 fee (USD)').fill('1');
  await page.getByRole('button', { name: 'Add Execution' }).click();
  await page.getByLabel('Execution 2 quantity (shares)').fill('60'); await page.getByLabel('Execution 2 price (USD)').fill('51'); await page.getByLabel('Execution 2 fee (USD)').fill('2');
  if (disposition === 'Complete') { await page.getByLabel('Complete reflection now').check(); await page.getByLabel('As Planned', { exact: true }).check(); await page.getByLabel('Calm', { exact: true }).check(); await page.getByLabel('Decision confidence').selectOption('4'); }
  if (disposition === 'Decline') await page.getByLabel('Decline reflection', { exact: true }).check();
}
export async function authority(page: Page) {
  return page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open('trade-journal-v3'); request.onerror = () => reject(request.error ?? new Error('Native authority read failed'));
    request.onsuccess = () => { const db = request.result; const tx = db.transaction(['roots', 'versions', 'lifecycle']); const roots = tx.objectStore('roots').getAll(); const versions = tx.objectStore('versions').getAll(); const lifecycle = tx.objectStore('lifecycle').getAll(); tx.oncomplete = () => { resolve({ roots: roots.result, versions: versions.result, lifecycle: lifecycle.result }); db.close(); }; };
  }));
}
