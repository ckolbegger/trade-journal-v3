import { confirmBothKinds, expect, onboardedAt, recordOptionEntry, READY, test, TUESDAY_1030, valueOf, type BothKinds } from './support.ts';

test.use({ actionTimeout: 15_000 });

// BUG-3 (decision 109): Long Call NVDA 18 Dec 2026 150, 1 contract at 15.00. Stops: NVDA at or below 140.00 and the option at or below 7.50.
// Targets: NVDA at or above 200 and the option at or above 50.00.
const NVDA_CALL: BothKinds = {
  strategy: 'Long Call', underlying: 'NVDA', expiration: '2026-12-18', strike: '150', contracts: '1', entry: '15.00',
  stop: '140.00', target: '200.00', stopOption: '7.50', targetOption: '50.00', planTime: '2026-10-12T09:00',
};

test.describe('BUG-3 Entry beyond the option-price Stop', () => {
  test('should read Risk from entry $735.00 with 0.98R on Detail and Actual initial risk $735.00 on the summary card after recording 1 at 7.35, past the 7.50 option Stop', async ({ profile }) => {
    test.setTimeout(240_000);
    const { context, page } = await onboardedAt(profile, TUESDAY_1030);
    await confirmBothKinds(page, NVDA_CALL);
    await recordOptionEntry(page, [{ quantity: '1', price: '7.35', fee: '0', time: '2026-10-12T10:00' }]);
    await page.getByRole('link', { name: 'Back to the Trade' }).click();
    await expect(page.getByRole('heading', { name: 'NVDA', level: 1 })).toBeVisible(READY);
    await expect(valueOf(page, 'Risk from entry')).toHaveText('$735.00 · 0.98R');
    await expect(valueOf(page, 'Actual initial risk').first()).toHaveText('$735.00');
    await context.close();
  });
});
