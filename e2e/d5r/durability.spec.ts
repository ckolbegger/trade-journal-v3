import {
  BASE_URL, createCardFixture, enterMark, expect, firstPage, launchAt, markRow, MONDAY, MONDAY_1700, observationsOf, onboardedAt, onboardedPage, openReview, pinClock, probe, reachCard, READY, spawnedBrowser, test, workspaceOf,
  type TradeRef,
} from './support.ts';

const NOT_WRITABLE = { name: /Read only/ };
const READ_ONLY = "Read only: this browser can't save right now";

test.describe('B5R.9 Kill after Save Marks', () => {
  test('should keep the Marks after the browser is killed once the rows render from the result, and show the card with them saved', async ({ profile }) => {
    test.setTimeout(240_000);
    const killed = await spawnedBrowser(profile.dir, 9341);
    // The Trade's id comes from the app in the first launch; it is stored data, so the relaunch reaches the same card with it.
    let tA!: TradeRef;
    try {
      await pinClock(killed.context, MONDAY_1700);
      const page = await onboardedPage(killed.context);
      ({ 'T-A': tA } = await createCardFixture(page));
      await openReview(page);
      await enterMark(page, tA, MONDAY, '52.00');
      // The rows render from the result; the browser is killed right after.
      await expect(await markRow(page, tA, MONDAY)).toContainText('Manual');
    } finally {
      await killed.kill();
    }

    const relaunched = await spawnedBrowser(profile.dir, 9342);
    try {
      await pinClock(relaunched.context, MONDAY_1700);
      const page = await firstPage(relaunched.context);
      await page.goto(`${BASE_URL}/`);
      await openReview(page);
      const row = await markRow(page, tA, MONDAY);
      await expect(row).toContainText('Manual');
      await expect(row).toContainText('52');
      const observations = observationsOf(workspaceOf(await probe(page))!);
      expect(observations).toHaveLength(1);
      expect(observations[0]!.instrumentKey).toBe('XYZ');
      expect(observations[0]!.marks.map((m) => Number(m.price))).toEqual([52]);
    } finally {
      await relaunched.kill();
    }
  });
});

test.describe('B5R.10 Offline and Recovery Only (faults build)', () => {
  test('should save Marks offline after a full stop and keep them across another offline restart (AC-DEL-001)', async ({ server, profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const { 'T-A': tA } = await createCardFixture(page);
    await openReview(page);
    await context.close();
    // Network disabled: offline emulation plus no server for the origin at all.
    await server.close();

    const offline = await launchAt(profile, MONDAY_1700, { offline: true });
    const first = await firstPage(offline);
    await first.goto('/');
    await openReview(first);
    await expect(first.getByRole('region', NOT_WRITABLE)).toHaveCount(0);
    await enterMark(first, tA, MONDAY, '52.00');
    await expect(await markRow(first, tA, MONDAY)).toContainText('Manual');
    await offline.close();

    // Another offline restart: the Mark survives and the card shows it saved.
    const again = await launchAt(profile, MONDAY_1700, { offline: true });
    const reopened = await firstPage(again);
    await reopened.goto('/');
    await openReview(reopened);
    await expect(reopened.getByRole('region', NOT_WRITABLE)).toHaveCount(0);
    await expect(await markRow(reopened, tA, MONDAY)).toContainText('Manual');
    const observations = observationsOf(workspaceOf(await probe(reopened))!);
    expect(observations.map((o) => `${o.instrumentKey} ${Number(o.marks[0]!.price)}`)).toEqual(['XYZ 52']);
    await again.close();
  });

  test('should open every card read only in Recovery Only, with no inputs or Save buttons, and leave the probe unchanged', async ({ server, profile }) => {
    test.setTimeout(240_000);
    server.use('dist-faults');
    const { context: setup, page: first } = await onboardedAt(profile, MONDAY_1700);
    const trades = await createCardFixture(first);
    await openReview(first);
    await enterMark(first, trades['T-A'], MONDAY, '52.00');
    const before = await probe(first);
    await setup.close();

    const context = await launchAt(profile, MONDAY_1700);
    const page = await firstPage(context);
    await page.goto('/?faults=control');
    await expect(page.getByRole('region', { name: READ_ONLY })).toBeVisible(READY);

    await openReview(page);
    for (const trade of [trades['T-A'], trades['T-F'], trades['T-B'], trades['T-C'], trades['T-E']]) {
      const card = await reachCard(page, trade);
      await expect(card).toBeVisible();
      // Every panel stays mounted, so these counts cover the Marks, Reflections and Action panels alike.
      await expect(card.locator('input, textarea')).toHaveCount(0);
      await expect(card.getByRole('button', { name: /^Save/ })).toHaveCount(0);
      await expect(card.getByRole('button', { name: 'Discard' })).toHaveCount(0);
      await expect(card.getByRole('button', { name: 'Answer', exact: true })).toHaveCount(0);
      await expect(card.getByRole('button', { name: 'Decline', exact: true })).toHaveCount(0);
    }
    // The saved Mark is shown, and the Missing rows are shown as such, in a read-only card.
    await expect(await markRow(page, trades['T-A'], MONDAY)).toContainText('Manual');
    await expect(await markRow(page, trades['T-C'], MONDAY)).toContainText('Missing');

    expect(await probe(page)).toEqual(before);
    await context.close();
  });
});
