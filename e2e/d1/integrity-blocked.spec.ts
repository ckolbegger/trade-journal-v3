import { BASE_URL, expect, firstPage, onboardedPage, probe, READY, test } from './support.ts';

const BLOCKED = "Your journal data may already exist here, but it can't be read";

test.describe('B1.8 Integrity Blocked', () => {
  test('should block a root at version 99 created before launch, offering only Retry and leaving the root untouched', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await firstPage(context);
    // A blank page on the app's origin, so the fixture is written before the app ever runs.
    await page.route(`${BASE_URL}/__fixture`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>fixture</title>' }));
    await page.goto('/__fixture');
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('tj-root', 99);
          open.onupgradeneeded = () => open.result.createObjectStore('future', { keyPath: 'id' }).put({ id: 'kept', note: 'from a newer release' });
          open.onsuccess = () => {
            open.result.close();
            resolve();
          };
          open.onerror = () => reject(open.error ?? new Error('fixture failed'));
        }),
    );
    await page.unroute(`${BASE_URL}/__fixture`);
    const before = await probe(page);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: BLOCKED })).toBeVisible(READY);
    await expect(page.getByRole('button')).toHaveText(['Retry']);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    const after = await probe(page);
    expect(after).toEqual(before);
    expect(after['tj-root']?.version).toBe(99);
    await context.close();
  });

  test('should block a pointer whose Workspace database was deleted, keeping the pointer and creating no new Workspace', async ({ server, profile }) => {
    void server;
    const context = await profile.launch();
    const page = await onboardedPage(context);
    const pointer = (await probe(page))['tj-root']!.stores['pointer'];
    const name = (pointer as { databaseName: string }[])[0]!.databaseName;
    await page.evaluate(
      (database) =>
        new Promise<void>((resolve, reject) => {
          const deletion = indexedDB.deleteDatabase(database);
          deletion.onsuccess = () => resolve();
          deletion.onerror = () => reject(deletion.error ?? new Error('delete failed'));
        }),
      name,
    );

    await page.reload();
    await expect(page.getByRole('heading', { name: BLOCKED })).toBeVisible(READY);
    await expect(page.getByRole('button')).toHaveText(['Retry']);
    const after = await probe(page);
    expect(after['tj-root']!.stores['pointer']).toEqual(pointer);
    expect(Object.keys(after).filter((n) => n.startsWith('tj-ws-'))).toEqual([]);
    await context.close();
  });
});
