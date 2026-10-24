import {
  confirmReference,
  SECOND_PLAN,
  expect,
  firstPage,
  onboardedPage,
  openPlanned,
  PC1,
  probe,
  READY,
  recordEntry,
  test,
  writeIntegrityFixture,
} from './support.ts';

test.describe('B2.13 integrity surfaced', () => {
  test('should show the integrity panel in Detail and the badge in the list for an Open Trade stored as Planned, writing nothing after viewing', async ({
    server,
    profile,
  }) => {
    void server;
    const setup = await profile.launch();
    const page = await onboardedPage(setup);
    await confirmReference(page);
    await recordEntry(page, PC1);
    await setup.close();
    // Raw stored records are edited before launch, never during a run (D2 section 6.0).
    await writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'XYZ', lifecycle: 'Planned' });

    const context = await profile.launch();
    const app = await firstPage(context);
    await app.goto('/');
    await expect(app.getByRole('tablist', { name: 'Trades by lifecycle' })).toBeVisible(READY);
    const before = await probe(app);

    // The stored lifecycle files the Trade under Planned; its row carries the disagreement badge.
    await expect(app.getByText('No open trades. Recording an entry on a Planned Trade opens it.')).toBeVisible();
    await openPlanned(app);
    const row = app.getByRole('row', { name: /XYZ/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Records disagree');

    await row.getByRole('link', { name: 'XYZ' }).click();
    await expect(app.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible();
    const panel = app.getByRole('region', { name: 'Records disagree' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('table', { name: 'Stored versus expected' }).getByRole('row', { name: /Lifecycle/ })).toHaveText(
      /Lifecycle\s*Planned\s*Open/,
    );
    expect(await probe(app)).toEqual(before);
    await context.close();
  });
});

test.describe('Planned list row for an incoherent Trade', () => {
  test('should show the row with Records disagree and Not available in each derived cell, linking to its Detail', async ({ server, profile }) => {
    void server;
    const setup = await profile.launch();
    const page = await onboardedPage(setup);
    await confirmReference(page, SECOND_PLAN);
    await confirmReference(page);
    await recordEntry(page, PC1);
    await setup.close();
    // Raw stored records are edited before launch: the Open Trade is filed under Planned and its facts cannot be replayed.
    await writeIntegrityFixture(profile.dir, { kind: 'StoredLifecycle', underlying: 'XYZ', lifecycle: 'Planned' });
    await writeIntegrityFixture(profile.dir, { kind: 'UnknownPlannedLeg', underlying: 'XYZ' });

    const context = await profile.launch();
    const app = await firstPage(context);
    await app.goto('/');
    await expect(app.getByRole('tablist', { name: 'Trades by lifecycle' })).toBeVisible(READY);
    const before = await probe(app);
    await expect(app.getByText('No open trades. Recording an entry on a Planned Trade opens it.')).toBeVisible();
    await openPlanned(app);
    const table = app.getByRole('table', { name: 'Planned Trades' });
    const row = table.getByRole('row', { name: /XYZ/ });
    await expect(row.getByRole('cell')).toHaveText([/XYZ/, /.+/, /.+/, /.+/, 'Not available', 'Not available', 'Not available', /Records disagree/]);
    // The agreeing Planned Trade keeps its figures.
    await expect(table.getByRole('row', { name: /ABC/ })).not.toContainText('Not available');

    await row.getByRole('link', { name: 'XYZ' }).click();
    await expect(app.getByRole('heading', { name: 'XYZ', level: 1 })).toBeVisible();
    await expect(app.getByRole('region', { name: 'Records disagree' })).toBeVisible();
    expect(await probe(app)).toEqual(before);
    await context.close();
  });
});
