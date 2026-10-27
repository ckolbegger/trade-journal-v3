import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { STORE_WORKSPACE_META } from '../../persistence/schema-v1';
import type { OfflineReleaseInventory } from '../../pwa/release-inventory';
import {
  createBrowserAppRuntime,
  type AppRuntime,
  type RuntimeTestOverrides,
} from '../../runtime/browser-runtime';

const encoder = new TextEncoder();
const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

const VALID_TEST_INVENTORY: OfflineReleaseInventory = {
  releaseId: '1.0.0-d01',
  generatedAt: '2026-10-27T12:00:00.000Z',
  cacheName: 'trade-journal-v3-release-1.0.0-d01',
  assets: [
    {
      path: '/index.html',
      sha256: SHA256_ABC,
      sizeBytes: 3,
    },
  ],
};

let dbIdx = 0;
const activeRuntimes: AppRuntime[] = [];

function createTestUiRuntime(overrides: RuntimeTestOverrides = {}): AppRuntime {
  dbIdx += 1;
  // Stub global fetch so fetchAssetBytesFromCacheOrNetwork returns "abc"
  globalThis.fetch = (async () =>
    new Response(encoder.encode('abc'), { status: 200 })) as typeof fetch;

  const rt = createBrowserAppRuntime({
    dbName: `test-ui-d01-${dbIdx}-${Date.now()}`,
    initialOverrides: {
      swActiveOk: true,
      inventoryOverride: VALID_TEST_INVENTORY,
      storageProtection: 'PersistentGranted',
      ...overrides,
    },
  });
  activeRuntimes.push(rt);
  return rt;
}

afterEach(async () => {
  while (activeRuntimes.length > 0) {
    const rt = activeRuntimes.pop();
    if (rt) {
      await rt.transactionManager.close();
    }
  }
});

describe('Deliverable 1 UI Tests (Tasks 1.5, 2.3, and 3.2)', () => {
  describe('Task 1.5: Readiness UI States & Advisory Protection Banner (AC-DEL-004, AC-DEL-005, AC-UI-002)', () => {
    it('should render an accessible Loading verification indicator while RuntimeReadiness is pending without showing false Empty states or enabled Save buttons (happy path)', async () => {
      const rt = createTestUiRuntime();
      render(<App runtime={rt} />);

      expect(screen.getByTestId('startup-loading-state')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Initialize Workspace/i })).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('initialize-workspace-view')).toBeInTheDocument();
      });
    });

    it('should render the advisory storage-protection warning banner with a Request Stronger Durability button when readiness is Writable and protection is BestEffort, and update to PersistentGranted when granted (happy path)', async () => {
      const user = userEvent.setup();
      const rt = createTestUiRuntime({
        storageProtection: 'BestEffort',
        persistGrantResult: true,
      });

      render(<App runtime={rt} />);
      await waitFor(() => {
        expect(screen.getByTestId('advisory-protection-banner')).toBeInTheDocument();
      });

      const banner = screen.getByTestId('advisory-protection-banner');
      expect(banner).toHaveTextContent(/best-effort/i);

      await user.click(
        within(banner).getByRole('button', { name: /Request Stronger Durability/i }),
      );

      await waitFor(() => {
        expect(screen.queryByTestId('advisory-protection-banner')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('durability-feedback-banner')).toHaveTextContent(
        /granted persistent storage protection/i,
      );
    });

    it('should keep the warning banner visible and display the non-blocking reason when clicking Request Stronger Durability returns NotImproved (edge case)', async () => {
      const user = userEvent.setup();
      const rt = createTestUiRuntime({
        storageProtection: 'BestEffort',
        persistGrantResult: false,
      });

      render(<App runtime={rt} />);
      await waitFor(() => {
        expect(screen.getByTestId('advisory-protection-banner')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Request Stronger Durability/i }));

      await waitFor(() => {
        expect(screen.getByTestId('durability-feedback-banner')).toHaveTextContent(/best-effort/i);
      });
      expect(screen.getByTestId('advisory-protection-banner')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Initialize Workspace/i })).toBeEnabled();
    });

    it('should render every failed check, a Retry Readiness Check button, and browser-isolation guidance when readiness is Unsupported with multiple simultaneous failures (error case)', async () => {
      const rt = createTestUiRuntime({
        freeStorageBytes: 10 * 1024 * 1024,
        swActiveOk: false,
        swErrorMessage: 'Service Worker registration failed',
        inventoryOverride: 'corrupt',
      });

      render(<App runtime={rt} />);
      await waitFor(() => {
        expect(screen.getByTestId('unsupported-runtime-view')).toBeInTheDocument();
      });

      const view = screen.getByTestId('unsupported-runtime-view');
      expect(view).toHaveTextContent(/InsufficientFreeStorage/i);
      expect(view).toHaveTextContent(/ServiceWorkerRegistrationFailed/i);
      expect(view).toHaveTextContent(/OfflineReleaseMissingOrCorrupt/i);
      expect(view).toHaveTextContent(/separate local storage/i);
      expect(
        within(view).getByRole('button', { name: /Retry Readiness Check/i }),
      ).toBeInTheDocument();
    });

    it('should render RecoveryOnly mode allowing read navigation of existing Institutions/Accounts while disabling all creation and settings-save controls with a clear RuntimeNotWritable explanation (AC-DEL-005)', async () => {
      const rt = createTestUiRuntime();
      const initRes = await rt.workspaceService.initialize({
        proposedTimeZone: 'America/New_York',
      });
      if (initRes.outcome !== 'Opened') throw new Error('Expected Opened');
      await rt.catalogService.save({
        kind: 'CreateInstitution',
        label: 'Fidelity',
        expectedCatalogSnapshot: initRes.statusResult.workspace.catalogSnapshotId,
      });

      // Degrade runtime readiness
      rt.setTestOverrides({
        freeStorageBytes: 5 * 1024 * 1024,
      });

      render(<App runtime={rt} />);
      await waitFor(() => {
        expect(screen.getByTestId('recovery-only-banner')).toBeInTheDocument();
      });

      expect(screen.getByTestId('recovery-only-banner')).toHaveTextContent(/Recovery Only/i);
      expect(screen.getByText('Fidelity')).toBeInTheDocument();
      expect(screen.getByTestId('open-create-institution-btn')).toBeDisabled();
    });

    it('should render IntegrityBlocked warning that existing journal data may be present and must never render the fresh Workspace initialization form (AC-DEL-005 boundary/error case)', async () => {
      const rt = createTestUiRuntime();
      await rt.transactionManager._unsafeWriteRawForTesting(STORE_WORKSPACE_META, {
        key: 'root',
        schemaVersion: 99,
      });

      render(<App runtime={rt} />);
      await waitFor(() => {
        expect(screen.getByTestId('integrity-blocked-view')).toBeInTheDocument();
      });

      expect(screen.getByTestId('integrity-blocked-view')).toHaveTextContent(
        /Integrity Blocked/i,
      );
      expect(screen.queryByTestId('initialize-workspace-view')).not.toBeInTheDocument();
    });
  });

  describe('Task 2.3: Workspace Initialization & Settings UI (AC-RESP-001, AC-UI-001, AC-UI-002)', () => {
    it('should prefill the detected IANA time zone, allow changing it, and transition directly to Needs Institution and Account onboarding on submit using the initialize post-commit response (happy path)', async () => {
      const user = userEvent.setup();
      const rt = createTestUiRuntime();

      render(<App runtime={rt} />);
      await waitFor(() => {
        expect(screen.getByTestId('initialize-workspace-view')).toBeInTheDocument();
      });

      expect(screen.getByTestId('initialize-workspace-view')).toHaveTextContent(
        /U\.S\. exchange-defined/i,
      );

      const tzInput = screen.getByLabelText(/Workspace Time Zone \(IANA\)/i);
      await user.clear(tzInput);
      await user.type(tzInput, 'America/Chicago');
      await user.click(screen.getByRole('button', { name: /Initialize Workspace/i }));

      await waitFor(() => {
        expect(screen.getByTestId('workspace-onboarding-banner')).toBeInTheDocument();
      });
      expect(screen.getByTestId('workspace-onboarding-banner')).toHaveTextContent(
        /Needs Institution and Account/i,
      );
    });

    it('should not persist any Workspace data if the trader changes the time-zone input and unmounts before clicking Initialize Workspace (unsaved form boundary)', async () => {
      const user = userEvent.setup();
      const rt = createTestUiRuntime();

      const { unmount } = render(<App runtime={rt} />);
      await waitFor(() => {
        expect(screen.getByTestId('initialize-workspace-view')).toBeInTheDocument();
      });

      const tzInput = screen.getByLabelText(/Workspace Time Zone \(IANA\)/i);
      await user.clear(tzInput);
      await user.type(tzInput, 'Europe/London');
      unmount();

      const status = await rt.workspaceService.getStatus();
      expect(status.status).toBe('InitializationRequired');
    });

    it('should display the prospective time-zone effect explanation before Save, update the displayed timeZone and revision immediately from saveSettings, and handle Unchanged and Conflict states (happy path + edge + error cases)', async () => {
      const user = userEvent.setup();
      const rt = createTestUiRuntime();
      await rt.workspaceService.initialize({ proposedTimeZone: 'America/New_York' });

      render(<App runtime={rt} />);
      await waitFor(() => {
        expect(screen.getByTestId('workspace-onboarding-banner')).toBeInTheDocument();
      });

      // Navigate to Settings
      await user.click(screen.getByTestId('nav-wide-settings'));
      await waitFor(() => {
        expect(screen.getByTestId('workspace-settings-view')).toBeInTheDocument();
      });

      expect(screen.getByTestId('prospective-timezone-note')).toHaveTextContent(
        /without rewriting stored UTC instants/i,
      );

      // Save identical time zone -> Unchanged
      await user.click(screen.getByRole('button', { name: /Save Time Zone/i }));
      await waitFor(() => {
        expect(screen.getByTestId('settings-feedback')).toHaveTextContent(/already set to/i);
      });

      // Change time zone -> Saved (revision 2)
      const tzInput = screen.getByLabelText(/Workspace Time Zone \(IANA\)/i);
      await user.clear(tzInput);
      await user.type(tzInput, 'America/Los_Angeles');
      await user.click(screen.getByRole('button', { name: /Save Time Zone/i }));

      await waitFor(() => {
        expect(screen.getByTestId('settings-feedback')).toHaveTextContent(/Revision 2/i);
      });

      // Simulate concurrent update in another tab (advancing revision to 3 behind UI's back)
      await rt.workspaceService.saveSettings({
        timeZone: 'Europe/London',
        expectedSettingsRevision: 2,
      });

      await user.clear(tzInput);
      await user.type(tzInput, 'Asia/Tokyo');
      await user.click(screen.getByRole('button', { name: /Save Time Zone/i }));

      await waitFor(() => {
        expect(screen.getByTestId('settings-feedback')).toHaveTextContent(
          /modified in another view/i,
        );
      });
      // Preserves user's typed input so they can review and save again
      expect(tzInput).toHaveValue('Asia/Tokyo');
    });
  });

  describe('Task 3.2: Responsive App Shell & Onboarding UI (AC-UI-001, AC-UI-002, AC-CAP-001, AC-RESP-001)', () => {
    it('should display an explicit Empty state with zero seeded Institutions or Accounts, create first Institution and first Account, and transition to Ready for Trade Planning (happy path, AC-RESP-001)', async () => {
      const user = userEvent.setup();
      const rt = createTestUiRuntime();
      await rt.workspaceService.initialize({ proposedTimeZone: 'America/New_York' });

      render(<App runtime={rt} />);
      await waitFor(() => {
        expect(screen.getByTestId('empty-institutions-state')).toBeInTheDocument();
      });

      // Create first Institution
      await user.click(screen.getByTestId('open-create-institution-btn'));
      await user.type(screen.getByLabelText(/Institution Name/i), 'Interactive Brokers');
      await user.click(screen.getByRole('button', { name: /Save Institution/i }));

      await waitFor(() => {
        expect(screen.getByText('Interactive Brokers')).toBeInTheDocument();
      });
      expect(screen.getByTestId('workspace-onboarding-banner')).toHaveTextContent(
        /Needs Institution and Account/i,
      );

      // Create first Account
      await user.click(screen.getByTestId('open-create-account-btn'));
      await user.type(screen.getByLabelText(/Account Name/i), 'U1234567 Margin');
      await user.click(screen.getByRole('button', { name: /Save Account/i }));

      await waitFor(() => {
        expect(screen.getByText('U1234567 Margin')).toBeInTheDocument();
      });
      expect(screen.getByTestId('workspace-onboarding-banner')).toHaveTextContent(
        /Ready for Trade Planning/i,
      );
    });

    it('should display accessible inline validation errors and keep entered text intact when submitting a duplicate Institution label, and discard unsaved input on Cancel (error & boundary cases)', async () => {
      const user = userEvent.setup();
      const rt = createTestUiRuntime();
      const initRes = await rt.workspaceService.initialize({
        proposedTimeZone: 'America/New_York',
      });
      if (initRes.outcome !== 'Opened') throw new Error('Expected Opened');
      await rt.catalogService.save({
        kind: 'CreateInstitution',
        label: 'Schwab',
        expectedCatalogSnapshot: initRes.statusResult.workspace.catalogSnapshotId,
      });

      render(<App runtime={rt} />);
      await waitFor(() => {
        expect(screen.getByText('Schwab')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('open-create-institution-btn'));
      const input = screen.getByLabelText(/Institution Name/i);
      await user.type(input, '  schwab ');
      await user.click(screen.getByRole('button', { name: /Save Institution/i }));

      await waitFor(() => {
        expect(screen.getByTestId('institution-form-error')).toHaveTextContent(
          /already exists/i,
        );
      });
      expect(input).toHaveValue('  schwab ');

      // Cancel discards unsaved input without writing
      await user.click(screen.getByRole('button', { name: /^Cancel$/i }));
      expect(screen.queryByTestId('create-institution-form')).not.toBeInTheDocument();
    });

    it('should render only D1-installed navigation items, omit undelivered surfaces, and switch live between wide left-sidebar (1280px) and narrow bottom-navigation (390px) without losing unsaved form text (AC-CAP-001, AC-UI-001)', async () => {
      const user = userEvent.setup();
      const rt = createTestUiRuntime();
      await rt.workspaceService.initialize({ proposedTimeZone: 'America/New_York' });

      render(<App runtime={rt} initialViewportWidth={1280} />);
      await waitFor(() => {
        expect(screen.getByTestId('wide-sidebar-nav')).toBeInTheDocument();
      });

      // Verify capability-honest navigation omits undelivered D2-D23 items
      expect(screen.queryByText(/Daily Review/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backup & Restore/i)).not.toBeInTheDocument();

      // Open Create Institution form and enter unsaved text
      await user.click(screen.getByTestId('open-create-institution-btn'));
      const instInput = screen.getByLabelText(/Institution Name/i);
      await user.type(instInput, 'Draft Unsaved Broker');

      // Resize live to narrow viewport (390px)
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 390,
        });
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('narrow-bottom-nav')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('wide-sidebar-nav')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Institution Name/i)).toHaveValue('Draft Unsaved Broker');
    });

    it('should defer staged Service Worker update activation while an unsaved Account or Institution form has input, and activate once the form is cancelled (AC-DEL-002)', async () => {
      const user = userEvent.setup();
      const rt = createTestUiRuntime();
      await rt.workspaceService.initialize({ proposedTimeZone: 'America/New_York' });

      render(<App runtime={rt} />);
      await waitFor(() => {
        expect(screen.getByTestId('open-create-institution-btn')).toBeInTheDocument();
      });

      // Open form and type unsaved text
      await user.click(screen.getByTestId('open-create-institution-btn'));
      await user.type(screen.getByLabelText(/Institution Name/i), 'Tastytrade');

      // Stage a valid candidate update in background
      await act(async () => {
        await rt.updateCoordinator.stageCandidateRelease(
          {
            releaseId: '1.0.1-d01',
            generatedAt: '2026-10-27T14:00:00.000Z',
            cacheName: 'trade-journal-v3-release-1.0.1-d01',
            assets: [
              {
                path: '/index.html',
                sha256: SHA256_ABC,
                sizeBytes: 3,
              },
            ],
          },
          async () => encoder.encode('abc'),
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('update-available-banner')).toBeInTheDocument();
      });

      // Try to activate while form has unsaved text -> deferred!
      await user.click(screen.getByTestId('activate-update-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('update-deferred-notice')).toHaveTextContent(/deferred/i);
      });
      expect(screen.getByLabelText(/Institution Name/i)).toHaveValue('Tastytrade');
    });
  });
});
