import { expect, type Page } from '@playwright/test';
import type { RuntimeTestOverrides } from '../../src/runtime/browser-runtime';

export interface StoredWorkspaceProbe {
  readonly inspectionKind: string;
  readonly timeZone: string | null;
  readonly settingsRevision: number | null;
  readonly snapshotBinding: string | null;
  readonly catalogSnapshotId: string | null;
  readonly institutions: readonly {
    readonly id: string;
    readonly label: string;
    readonly availability: string;
    readonly currentRevision: number;
  }[];
  readonly accounts: readonly {
    readonly id: string;
    readonly parentInstitutionId: string;
    readonly label: string;
    readonly availability: string;
    readonly currentRevision: number;
  }[];
  readonly selectableAccountCount: number;
}

/**
 * Sets runtime test overrides before or during a page session.
 */
export async function injectRuntimeOverrides(
  page: Page,
  overrides: RuntimeTestOverrides,
): Promise<void> {
  await page.evaluate((nextOverrides) => {
    window.__TRADE_JOURNAL_TEST_OVERRIDES__ = {
      ...(window.__TRADE_JOURNAL_TEST_OVERRIDES__ ?? {}),
      ...nextOverrides,
    };
    if (window.__TRADE_JOURNAL_RUNTIME__) {
      window.__TRADE_JOURNAL_RUNTIME__.setTestOverrides(nextOverrides);
    }
  }, overrides);
}

/**
 * Reads authoritative IndexedDB state via the runtime's TransactionManager inspection seam.
 * Used as a setup/evidence helper without mutating any records.
 */
export async function probeStoredWorkspaceState(page: Page): Promise<StoredWorkspaceProbe> {
  return page.evaluate(async () => {
    const rt = window.__TRADE_JOURNAL_RUNTIME__;
    if (!rt) {
      throw new Error('window.__TRADE_JOURNAL_RUNTIME__ is not available on page.');
    }
    const inspection = await rt.transactionManager.inspectStorageRoot();
    if (inspection.kind !== 'ExistingReadableWorkspace') {
      return {
        inspectionKind: inspection.kind,
        timeZone: null,
        settingsRevision: null,
        snapshotBinding: null,
        catalogSnapshotId: null,
        institutions: [],
        accounts: [],
        selectableAccountCount: 0,
      };
    }
    return {
      inspectionKind: inspection.kind,
      timeZone: inspection.meta.timeZone,
      settingsRevision: inspection.meta.settingsRevision,
      snapshotBinding: inspection.meta.snapshotBinding,
      catalogSnapshotId: inspection.meta.catalogSnapshotId,
      institutions: inspection.institutions.map((i) => ({
        id: i.id,
        label: i.label,
        availability: i.availability,
        currentRevision: i.currentRevision,
      })),
      accounts: inspection.accounts.map((a) => ({
        id: a.id,
        parentInstitutionId: a.parentInstitutionId,
        label: a.label,
        availability: a.availability,
        currentRevision: a.currentRevision,
      })),
      selectableAccountCount: inspection.selectableAccountCount,
    };
  });
}

/**
 * Setup helper to initialize a fresh workspace via the UI.
 */
export async function initializeWorkspaceUI(
  page: Page,
  timeZone = 'America/New_York',
): Promise<void> {
  await expect(page.getByTestId('initialize-workspace-view')).toBeVisible();
  const tzInput = page.getByLabel(/Workspace Time Zone \(IANA\)/i);
  await tzInput.fill(timeZone);
  await page.getByRole('button', { name: /Initialize Workspace/i }).click();
  await expect(page.getByTestId('workspace-onboarding-banner')).toBeVisible();
}

/**
 * Setup helper to create an Institution via the UI.
 */
export async function createInstitutionUI(page: Page, label: string): Promise<void> {
  await page.getByTestId('open-create-institution-btn').click();
  await page.getByLabel(/Institution Name/i).fill(label);
  await page.getByRole('button', { name: /Save Institution/i }).click();
  await expect(page.getByTestId('institution-list')).toContainText(label);
}

/**
 * Setup helper to create an Account via the UI.
 */
export async function createAccountUI(
  page: Page,
  accountLabel: string,
  institutionLabel?: string,
): Promise<void> {
  await page.getByTestId('open-create-account-btn').click();
  if (institutionLabel) {
    await page.getByLabel(/Parent Institution/i).selectOption({ label: institutionLabel });
  }
  await page.getByLabel(/Account Name/i).fill(accountLabel);
  await page.getByRole('button', { name: /Save Account/i }).click();
  await expect(page.getByTestId('account-list')).toContainText(accountLabel);
}

/**
 * Stages a digest-verified candidate release in the page's UpdateCoordinator.
 */
export async function stageBackgroundReleaseUpdate(
  page: Page,
  stagedReleaseId = 'v1.0.1-staged',
): Promise<void> {
  await page.evaluate(async (releaseId) => {
    const rt = window.__TRADE_JOURNAL_RUNTIME__;
    if (!rt) throw new Error('Missing runtime');
    const abcBytes = new TextEncoder().encode('abc');
    const sha256Abc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    await rt.updateCoordinator.stageCandidateRelease(
      {
        releaseId,
        generatedAt: '2026-10-27T15:00:00.000Z',
        cacheName: `trade-journal-v3-release-${releaseId}`,
        assets: [
          {
            path: '/index.html',
            sha256: sha256Abc,
            sizeBytes: 3,
          },
        ],
      },
      async () => abcBytes,
    );
  }, stagedReleaseId);
}
