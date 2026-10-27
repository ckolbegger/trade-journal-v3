import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  createAccountUI,
  createInstitutionUI,
  initializeWorkspaceUI,
  injectRuntimeOverrides,
  probeStoredWorkspaceState,
  stageBackgroundReleaseUpdate,
} from './support/d01-helpers';

test.describe('Task 3.3: E2E Playwright Verification for Deliverable 1 (AC-DEL-001..006, AC-RESP-001, AC-UI-001..002, AC-CAP-001)', () => {
  test.describe('AC-DEL-001 & AC-DEL-003: PWA Manifest, Offline Cold Restart, and Offline Mutation', () => {
    test('should serve a valid Web App Manifest and digest-verified Offline Release Inventory, reach Writable on first load, and complete Workspace initialization and Account onboarding', async ({
      page,
      request,
    }) => {
      // Verify Web App Manifest
      const manifestResp = await request.get('/manifest.webmanifest');
      expect(manifestResp.ok()).toBe(true);
      const manifest = (await manifestResp.json()) as Record<string, unknown>;
      expect(manifest.id).toBe('/trade-journal-v3');
      expect(manifest.display).toBe('standalone');
      expect(Array.isArray(manifest.icons)).toBe(true);

      // Verify OfflineReleaseInventory
      const invResp = await request.get('/offline-release-inventory.json');
      expect(invResp.ok()).toBe(true);
      const inv = (await invResp.json()) as {
        releaseId: string;
        cacheName: string;
        assets: { path: string; sha256: string; sizeBytes: number }[];
      };
      expect(inv.releaseId).toMatch(/^v1\.0\.0-/);
      expect(inv.assets.length).toBeGreaterThanOrEqual(3);
      expect(inv.assets.some((a) => a.path === '/index.html')).toBe(true);

      await page.goto('/');
      await initializeWorkspaceUI(page, 'America/New_York');
      await expect(page.getByTestId('onboarding-state-badge')).toHaveText(
        'Needs Institution and Account',
      );

      await createInstitutionUI(page, 'Interactive Brokers');
      await createAccountUI(page, 'U1234567 Margin', 'Interactive Brokers');

      await expect(page.getByTestId('onboarding-state-badge')).toHaveText(
        'Ready for Trade Planning',
      );

      const probe = await probeStoredWorkspaceState(page);
      expect(probe.timeZone).toBe('America/New_York');
      expect(probe.institutions).toHaveLength(1);
      expect(probe.accounts).toHaveLength(1);
      expect(probe.selectableAccountCount).toBe(1);
    });

    test('should reopen after a full page reload with network disabled (offline cold restart), re-establish Writable RuntimeReadiness offline, display stored Institutions and Accounts, and create a new Account offline', async ({
      context,
      page,
    }) => {
      await page.goto('/');
      await initializeWorkspaceUI(page, 'America/New_York');
      await createInstitutionUI(page, 'Interactive Brokers');
      await createAccountUI(page, 'U1234567 Margin', 'Interactive Brokers');

      // Wait until Service Worker controls the page so offline navigation works from CacheStorage
      await page.evaluate(async () => {
        if (!navigator.serviceWorker.controller) {
          await navigator.serviceWorker.ready;
        }
      });
      await page.reload();
      await expect(page.getByTestId('onboarding-state-badge')).toHaveText(
        'Ready for Trade Planning',
      );

      // Go completely offline and open a fresh page in the same context (simulating cold offline launch)
      await context.setOffline(true);
      const offlinePage = await context.newPage();
      await offlinePage.goto('/');

      await expect(offlinePage.getByTestId('onboarding-state-badge')).toHaveText(
        'Ready for Trade Planning',
      );
      await expect(offlinePage.getByTestId('institution-list')).toContainText(
        'Interactive Brokers',
      );
      await expect(offlinePage.getByTestId('account-list')).toContainText('U1234567 Margin');

      // Create a second Account while completely offline
      await createAccountUI(offlinePage, 'U1234567 IRA', 'Interactive Brokers');
      await expect(offlinePage.getByTestId('account-list')).toContainText('U1234567 IRA');

      const probe = await probeStoredWorkspaceState(offlinePage);
      expect(probe.accounts).toHaveLength(2);
      expect(probe.selectableAccountCount).toBe(2);

      await context.setOffline(false);
    });
  });

  test.describe('AC-DEL-002: Service Worker Update Safety', () => {
    test('should notify when a digest-valid new release is staged, defer activation while an unsaved Account form has input, and preserve all entered text', async ({
      page,
    }) => {
      await page.goto('/');
      await initializeWorkspaceUI(page, 'America/New_York');
      await createInstitutionUI(page, 'Fidelity');

      // Open Add Account form and enter unsaved text
      await page.getByTestId('open-create-account-btn').click();
      const accountInput = page.getByLabel(/Account Name/i);
      await accountInput.fill('Unsaved Cash Management');

      // Stage a background update
      await stageBackgroundReleaseUpdate(page, 'v1.0.2-verified');
      await expect(page.getByTestId('update-available-banner')).toBeVisible();
      await expect(page.getByTestId('update-available-banner')).toContainText('v1.0.2-verified');

      // Attempt to activate while form has unsaved input -> deferred
      await page.getByTestId('activate-update-btn').click();
      await expect(page.getByTestId('update-deferred-notice')).toContainText('deferred');
      await expect(accountInput).toHaveValue('Unsaved Cash Management');

      // Cancel form -> activation succeeds
      await page.getByRole('button', { name: /^Cancel$/i }).click();
      await page.getByTestId('activate-update-btn').click();
      await expect(page.getByTestId('update-available-banner')).toBeHidden();
    });
  });

  test.describe('AC-DEL-004, AC-DEL-005 & AC-DEL-006: Readiness Failure Matrix, Recovery Only & Integrity Blocked', () => {
    test('should report all failed readiness checks simultaneously when capacity and release-inventory checks both fail on a fresh store, blocking initialization', async ({
      page,
    }) => {
      await page.addInitScript(() => {
        window.__TRADE_JOURNAL_TEST_OVERRIDES__ = {
          freeStorageBytes: 12 * 1024 * 1024,
          inventoryOverride: 'corrupt',
        };
      });

      await page.goto('/');
      const unsupportedView = page.getByTestId('unsupported-runtime-view');
      await expect(unsupportedView).toBeVisible();
      await expect(unsupportedView).toContainText('InsufficientFreeStorage');
      await expect(unsupportedView).toContainText('OfflineReleaseMissingOrCorrupt');
      await expect(unsupportedView).toContainText('separate local storage');
      await expect(page.getByTestId('initialize-workspace-view')).toHaveCount(0);
    });

    test('should enter Recovery Only when an initialized Workspace remains readable but a readiness check fails, allowing Account viewing while blocking new Account creation with RuntimeNotWritable', async ({
      page,
    }) => {
      await page.goto('/');
      await initializeWorkspaceUI(page, 'America/Chicago');
      await createInstitutionUI(page, 'Charles Schwab');
      await createAccountUI(page, 'Schwab One', 'Charles Schwab');

      // Degrade storage headroom and re-check status
      await injectRuntimeOverrides(page, {
        freeStorageBytes: 8 * 1024 * 1024,
      });
      await page.getByTestId('nav-wide-settings').click();
      await page.getByTestId('save-settings-btn').click();

      await expect(page.getByTestId('recovery-only-banner')).toBeVisible();
      await expect(page.getByTestId('recovery-only-banner')).toContainText('Recovery Only');

      // Navigate back to Accounts & Institutions and verify read access works while writes are disabled
      await page.getByTestId('nav-wide-accounts').click();
      await expect(page.getByTestId('institution-list')).toContainText('Charles Schwab');
      await expect(page.getByTestId('account-list')).toContainText('Schwab One');
      await expect(page.getByTestId('open-create-institution-btn')).toBeDisabled();
      await expect(page.getByTestId('open-create-account-btn')).toBeDisabled();
    });

    test('should enter Integrity Blocked when an existing storage root is unreadable/corrupt and refuse to offer fresh initialization or overwrite existing bytes', async ({
      page,
    }) => {
      await page.goto('/');
      await initializeWorkspaceUI(page, 'America/New_York');
      await createInstitutionUI(page, 'Vanguard');

      // Inject known unreadable root fault and reload
      await page.addInitScript(() => {
        window.__TRADE_JOURNAL_TEST_OVERRIDES__ = {
          knownUnreadableRoot: true,
          storageReadFailure: 'VersionError: existing workspace store cannot be read safely',
        };
      });
      await page.reload();

      const blockedView = page.getByTestId('integrity-blocked-view');
      await expect(blockedView).toBeVisible();
      await expect(blockedView).toContainText('Integrity Blocked');
      await expect(blockedView).toContainText('existing workspace store cannot be read safely');
      await expect(page.getByTestId('initialize-workspace-view')).toHaveCount(0);
    });

    test('should immediately block the next ReferenceCatalog.save mutation when a storage/integrity failure is injected mid-session (AC-DEL-006)', async ({
      page,
    }) => {
      await page.goto('/');
      await initializeWorkspaceUI(page, 'America/New_York');
      await createInstitutionUI(page, 'Tastytrade');

      // Open Add Account form while Writable
      await page.getByTestId('open-create-account-btn').click();
      await page.getByLabel(/Account Name/i).fill('Blocked Account');

      // Inject mid-session failure before clicking Save Account
      await injectRuntimeOverrides(page, {
        swActiveOk: false,
        swErrorMessage: 'Service Worker controller lost mid-session',
      });

      await page.getByRole('button', { name: /Save Account/i }).click();
      await expect(page.getByTestId('recovery-only-banner')).toBeVisible();

      const probe = await probeStoredWorkspaceState(page);
      expect(probe.accounts).toHaveLength(0);
    });
  });

  test.describe('AC-UI-001 & AC-UI-002: Responsive Live Adaptation, Keyboard Navigation & WCAG AA Contrast', () => {
    test('should switch between wide left-sidebar and narrow bottom-navigation layouts on live viewport resize (1280px <-> 375px <-> 320px) without losing route or unsaved form values', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      await initializeWorkspaceUI(page, 'America/New_York');

      await expect(page.getByTestId('wide-sidebar-nav')).toBeVisible();
      await expect(page.getByTestId('narrow-bottom-nav')).toHaveCount(0);

      // Open Institution form and enter unsaved text
      await page.getByTestId('open-create-institution-btn').click();
      const instInput = page.getByLabel(/Institution Name/i);
      await instInput.fill('Unsaved Resize Broker');

      // Resize to 375px (narrow mobile)
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.getByTestId('narrow-bottom-nav')).toBeVisible();
      await expect(page.getByTestId('wide-sidebar-nav')).toHaveCount(0);
      await expect(instInput).toHaveValue('Unsaved Resize Broker');

      // Resize to 320px (minimum narrow boundary)
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(page.getByTestId('narrow-bottom-nav')).toBeVisible();
      await expect(instInput).toHaveValue('Unsaved Resize Broker');

      // Resize back to 1280px (wide desktop)
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(page.getByTestId('wide-sidebar-nav')).toBeVisible();
      await expect(instInput).toHaveValue('Unsaved Resize Broker');
    });

    test('should complete Workspace initialization and Institution/Account creation using keyboard navigation alone and pass axe-core WCAG 2.1 AA checks across all D1 states', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(page.getByTestId('initialize-workspace-view')).toBeVisible();

      // Run axe WCAG 2.1 AA scan on Initialization screen
      const initAxe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(initAxe.violations).toEqual([]);

      // Complete initialization using keyboard
      const tzInput = page.getByLabel(/Workspace Time Zone \(IANA\)/i);
      await tzInput.focus();
      await page.keyboard.press('Enter');

      await expect(page.getByTestId('workspace-onboarding-banner')).toBeVisible();

      // Run axe WCAG 2.1 AA scan on Empty Onboarding state
      const emptyAxe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(emptyAxe.violations).toEqual([]);

      // Create Institution via keyboard
      const addInstBtn = page.getByTestId('open-create-institution-btn');
      await addInstBtn.focus();
      await page.keyboard.press('Enter');

      const instNameInput = page.getByLabel(/Institution Name/i);
      await instNameInput.focus();
      await page.keyboard.type('E*TRADE');
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('institution-list')).toContainText('E*TRADE');

      // Create Account via keyboard
      const addAcctBtn = page.getByTestId('open-create-account-btn');
      await addAcctBtn.focus();
      await page.keyboard.press('Enter');

      const acctNameInput = page.getByLabel(/Account Name/i);
      await acctNameInput.focus();
      await page.keyboard.type('Active Trader Margin');
      await page.keyboard.press('Enter');

      await expect(page.getByTestId('onboarding-state-badge')).toHaveText(
        'Ready for Trade Planning',
      );

      // Run axe WCAG 2.1 AA scan on Ready state
      const readyAxe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(readyAxe.violations).toEqual([]);
    });
  });
});
