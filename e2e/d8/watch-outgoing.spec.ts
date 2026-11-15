import { expect, test } from '@playwright/test';
import { BASE_URL, watchOutgoing } from './support.ts';

// The outgoing-request recorder that B8.1 to B8.6 use to show an artifact never leaves the origin (AC-DEL-001). Both addresses are answered by the test
// itself, so no server needs to run.
test.describe('watchOutgoing', () => {
  test('should count a request to another port as leaving the origin and ignore one to the application origin', async ({ context }) => {
    await context.route(/^http:\/\/localhost:517\d+\//, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stub</title>' }));
    const outgoing = watchOutgoing(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/same-origin`);
    await page.goto(`${BASE_URL}0/other-port`);
    expect(outgoing.leaving()).toEqual([`${BASE_URL}0/other-port`]);
  });
});
