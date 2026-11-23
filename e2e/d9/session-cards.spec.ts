import { BREN, expect, openDrawer, replay, seek, sessionCard, sessionCards, setViewport, test } from './support.ts';
import { openStandardDetail } from '../d9ar/support.ts';

test.use({ actionTimeout: 15_000 });

// T9AR.17-B4: the cards helper finds a card on whichever page holds it, older or newer than the page showing.
test.describe('T9AR.17 session cards, looked up across pages', () => {
  test('should find a newer card after an older one when the cards span pages', async ({ profile, copySetup }) => {
    test.setTimeout(240_000);
    const { context, page } = await openStandardDetail(profile, copySetup, BREN);
    await openDrawer(page, 'Replay');
    const scope = replay(page);
    await seek(page, scope, 'ArrowLeft', 2);
    // A phone's width holds one card a page, so Mon Nov 2 and Wed Nov 11 are on different pages.
    await setViewport(page, 375, 900);
    await expect(sessionCards(scope).filter({ visible: true })).toHaveCount(1);
    const oldest = await sessionCard(scope, 'Mon Nov 2');
    await expect(oldest).toBeVisible();
    const newer = await sessionCard(scope, 'Wed Nov 11');
    await expect(newer).toBeVisible();
    await expect(oldest).toBeHidden();
    await context.close();
  });
});
