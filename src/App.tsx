import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  COMMON_IANA_TIME_ZONES,
  type ReadyWorkspaceSummary,
  type WorkspaceStatusResult,
} from './domain/workspace/workspace-service';
import type {
  StoredAccountRecord,
  StoredInstitutionRecord,
} from './persistence/schema-v1';
import type { UpdateCoordinatorState } from './pwa/update-coordinator';
import type { AppRuntime } from './runtime/browser-runtime';
import type { RuntimeReadinessReport } from './domain/workspace/runtime-readiness';

export type D01NavRoute = 'overview' | 'accounts' | 'settings';

export interface AppProps {
  readonly runtime: AppRuntime;
  readonly initialViewportWidth?: number;
}

export function App({ runtime, initialViewportWidth }: AppProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [statusResult, setStatusResult] = useState<WorkspaceStatusResult | null>(null);
  const [institutions, setInstitutions] = useState<readonly StoredInstitutionRecord[]>([]);
  const [accounts, setAccounts] = useState<readonly StoredAccountRecord[]>([]);
  const [activeRoute, setActiveRoute] = useState<D01NavRoute>('overview');

  // Viewport width for live responsive layout adaptation (<768px narrow bottom nav vs >=768px wide left sidebar)
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (initialViewportWidth !== undefined) return initialViewportWidth;
    return typeof window !== 'undefined' ? window.innerWidth : 1280;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isNarrowLayout = viewportWidth < 768;

  // Service worker update coordinator state
  const [updateState, setUpdateState] = useState<UpdateCoordinatorState>(() =>
    runtime.updateCoordinator.getState(),
  );

  useEffect(() => {
    return runtime.updateCoordinator.subscribe((next) => {
      setUpdateState(next);
    });
  }, [runtime]);

  // First-run time-zone initialization form state
  const [initTimeZoneInput, setInitTimeZoneInput] = useState<string>('');
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Advisory durability banner feedback
  const [durabilityFeedback, setDurabilityFeedback] = useState<{
    readonly kind: 'success' | 'info';
    readonly message: string;
  } | null>(null);

  // Settings form state (preserved across live viewport resizes)
  const [settingsTimeZoneInput, setSettingsTimeZoneInput] = useState<string>('');
  const [settingsFeedback, setSettingsFeedback] = useState<{
    readonly kind: 'saved' | 'unchanged' | 'conflict' | 'error';
    readonly message: string;
  } | null>(null);

  // Institution & Account creation form states (preserved across live viewport resizes)
  const [showCreateInstitutionForm, setShowCreateInstitutionForm] = useState(false);
  const [newInstitutionLabel, setNewInstitutionLabel] = useState('');
  const [institutionFormError, setInstitutionFormError] = useState<string | null>(null);

  const [showCreateAccountForm, setShowCreateAccountForm] = useState(false);
  const [selectedParentInstitutionId, setSelectedParentInstitutionId] = useState('');
  const [newAccountLabel, setNewAccountLabel] = useState('');
  const [accountFormError, setAccountFormError] = useState<string | null>(null);

  // Track unsaved form state for Service Worker update deferral (AC-DEL-002)
  const hasUnsavedInput = useMemo(() => {
    if (showCreateInstitutionForm && newInstitutionLabel.trim().length > 0) return true;
    if (showCreateAccountForm && newAccountLabel.trim().length > 0) return true;
    if (
      statusResult &&
      (statusResult.status === 'Ready' || statusResult.status === 'RecoveryOnly') &&
      settingsTimeZoneInput.trim() !== '' &&
      settingsTimeZoneInput !== statusResult.workspace.timeZone
    ) {
      return true;
    }
    return false;
  }, [
    showCreateInstitutionForm,
    newInstitutionLabel,
    showCreateAccountForm,
    newAccountLabel,
    statusResult,
    settingsTimeZoneInput,
  ]);

  useEffect(() => {
    runtime.setHasUnsavedFormState(hasUnsavedInput);
  }, [runtime, hasUnsavedInput]);

  const loadStartupStatus = useCallback(async () => {
    setLoading(true);
    const res = await runtime.workspaceService.getStatus();
    setStatusResult(res);

    if (res.status === 'InitializationRequired') {
      setInitTimeZoneInput((prev) => (prev.length > 0 ? prev : res.suggestedTimeZone));
      setInstitutions([]);
      setAccounts([]);
    } else if (res.status === 'Ready' || res.status === 'RecoveryOnly') {
      setSettingsTimeZoneInput((prev) => (prev.length > 0 ? prev : res.workspace.timeZone));
      if (res.readinessReport.inspection.kind === 'ExistingReadableWorkspace') {
        const sortedInst = [...res.readinessReport.inspection.institutions].sort((a, b) =>
          a.normalizedLabel.localeCompare(b.normalizedLabel),
        );
        const sortedAcct = [...res.readinessReport.inspection.accounts].sort((a, b) =>
          a.normalizedLabel.localeCompare(b.normalizedLabel),
        );
        setInstitutions(sortedInst);
        setAccounts(sortedAcct);
        if (sortedInst.length > 0) {
          setSelectedParentInstitutionId((prev) => prev || sortedInst[0]!.id);
        }
      }
    }
    setLoading(false);
  }, [runtime]);

  useEffect(() => {
    void loadStartupStatus();
  }, [loadStartupStatus]);

  const handleRequestDurability = async () => {
    const res = await runtime.workspaceService.requestDurability();
    setDurabilityFeedback({
      kind: res.outcome === 'Improved' ? 'success' : 'info',
      message: res.message,
    });
    // Refresh status so storageProtection badge updates
    const updated = await runtime.workspaceService.getStatus();
    setStatusResult(updated);
  };

  const handleInitializeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInitError(null);
    setIsInitializing(true);
    try {
      const res = await runtime.workspaceService.initialize({
        proposedTimeZone: initTimeZoneInput,
      });
      if (res.outcome === 'Opened') {
        // AC-RESP-001: Update directly from post-commit response without follow-up getStatus()
        setStatusResult(res.statusResult);
        setSettingsTimeZoneInput(res.statusResult.workspace.timeZone);
        setInstitutions([]);
        setAccounts([]);
        setActiveRoute('overview');
        return;
      }
      if (res.outcome === 'InvalidTimeZone' || res.outcome === 'TimeZoneSelectionRequired') {
        setInitError(res.message);
        return;
      }
      if (res.outcome === 'RuntimeNotWritable') {
        setStatusResult({
          status: 'Unsupported',
          readinessReport: res.readinessReport,
          capabilityManifest: res.readinessReport.inspection.kind === 'FreshEmptyRoot'
            ? (statusResult && 'capabilityManifest' in statusResult
                ? statusResult.capabilityManifest
                : (await runtime.workspaceService.getStatus() as Extract<WorkspaceStatusResult, { status: 'Unsupported' }>).capabilityManifest)
            : (await runtime.workspaceService.getStatus() as Extract<WorkspaceStatusResult, { status: 'Unsupported' }>).capabilityManifest,
        });
        return;
      }
      if (res.outcome === 'IntegrityBlocked') {
        const refreshed = await runtime.workspaceService.getStatus();
        setStatusResult(refreshed);
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const handleCreateInstitutionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInstitutionFormError(null);
    if (!statusResult || (statusResult.status !== 'Ready' && statusResult.status !== 'RecoveryOnly')) {
      return;
    }

    const res = await runtime.catalogService.save({
      kind: 'CreateInstitution',
      label: newInstitutionLabel,
      expectedCatalogSnapshot: statusResult.workspace.catalogSnapshotId,
    });

    if (res.outcome === 'Saved' && res.createdKind === 'Institution') {
      // AC-RESP-001: Update directly from post-commit response without follow-up query/getStatus
      setInstitutions(res.institutions);
      setAccounts(res.accounts);
      setStatusResult({
        status: 'Ready',
        readinessReport: statusResult.readinessReport,
        workspace: res.workspaceSummary,
      });
      setSelectedParentInstitutionId(res.institution.id);
      setNewInstitutionLabel('');
      setShowCreateInstitutionForm(false);
      return;
    }

    if (res.outcome === 'Rejected' || res.outcome === 'Conflict') {
      setInstitutionFormError(res.message);
      return;
    }

    if (res.outcome === 'RuntimeNotWritable') {
      setInstitutionFormError(res.message);
      setStatusResult({
        status: 'RecoveryOnly',
        readinessReport: res.readinessReport,
        workspace: statusResult.workspace,
      });
    }
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountFormError(null);
    if (!statusResult || (statusResult.status !== 'Ready' && statusResult.status !== 'RecoveryOnly')) {
      return;
    }

    const parentId = selectedParentInstitutionId || (institutions[0]?.id ?? '');
    const res = await runtime.catalogService.save({
      kind: 'CreateAccount',
      parentInstitutionId: parentId,
      label: newAccountLabel,
      expectedCatalogSnapshot: statusResult.workspace.catalogSnapshotId,
    });

    if (res.outcome === 'Saved' && res.createdKind === 'Account') {
      // AC-RESP-001: Update directly from post-commit response without follow-up query/getStatus
      setInstitutions(res.institutions);
      setAccounts(res.accounts);
      setStatusResult({
        status: 'Ready',
        readinessReport: statusResult.readinessReport,
        workspace: res.workspaceSummary,
      });
      setNewAccountLabel('');
      setShowCreateAccountForm(false);
      return;
    }

    if (res.outcome === 'Rejected' || res.outcome === 'Conflict') {
      setAccountFormError(res.message);
      return;
    }

    if (res.outcome === 'RuntimeNotWritable') {
      setAccountFormError(res.message);
      setStatusResult({
        status: 'RecoveryOnly',
        readinessReport: res.readinessReport,
        workspace: statusResult.workspace,
      });
    }
  };

  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsFeedback(null);
    if (!statusResult || (statusResult.status !== 'Ready' && statusResult.status !== 'RecoveryOnly')) {
      return;
    }

    const res = await runtime.workspaceService.saveSettings({
      timeZone: settingsTimeZoneInput,
      expectedSettingsRevision: statusResult.workspace.settingsRevision,
    });

    if (res.outcome === 'Saved') {
      setStatusResult(res.statusResult);
      setSettingsTimeZoneInput(res.statusResult.workspace.timeZone);
      setSettingsFeedback({
        kind: 'saved',
        message: `Workspace time zone saved (${res.statusResult.workspace.timeZone}, Revision ${res.statusResult.workspace.settingsRevision}).`,
      });
      return;
    }

    if (res.outcome === 'Unchanged') {
      setStatusResult(res.statusResult);
      setSettingsFeedback({
        kind: 'unchanged',
        message: `Time zone is already set to ${res.statusResult.workspace.timeZone} (Revision ${res.statusResult.workspace.settingsRevision}). No changes were written.`,
      });
      return;
    }

    if (res.outcome === 'Conflict') {
      setStatusResult(res.currentStatus);
      setSettingsFeedback({
        kind: 'conflict',
        message: res.message,
      });
      return;
    }

    if (res.outcome === 'InvalidTimeZone') {
      setSettingsFeedback({
        kind: 'error',
        message: res.message,
      });
      return;
    }

    if (res.outcome === 'RuntimeNotWritable') {
      setStatusResult({
        status: 'RecoveryOnly',
        readinessReport: res.readinessReport,
        workspace: statusResult.workspace,
      });
      setSettingsFeedback({
        kind: 'error',
        message: res.message,
      });
    }
  };

  // Loading state (AC-UI-002)
  if (loading || !statusResult) {
    return (
      <div
        className="min-h-screen bg-[#FAF7F2] text-[#141413] flex items-center justify-center p-6"
        data-testid="startup-loading-state"
      >
        <div
          role="status"
          aria-live="polite"
          className="max-w-md w-full bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[#57534E] mb-2">
            Startup Verification
          </p>
          <h1 className="text-lg font-semibold text-[#141413] mb-2">
            Verifying Local Runtime &amp; Storage Integrity…
          </h1>
          <p className="text-sm text-[#57534E]">
            Checking IndexedDB transactions, storage headroom, Service Worker control, and offline
            release digests before enabling workspace actions.
          </p>
        </div>
      </div>
    );
  }

  const readinessReport: RuntimeReadinessReport = statusResult.readinessReport;

  // Integrity Blocked screen (AC-DEL-005)
  if (statusResult.status === 'IntegrityBlocked') {
    return (
      <main
        className="min-h-screen bg-[#FAF7F2] text-[#141413] p-6 flex items-center justify-center"
        data-testid="integrity-blocked-view"
      >
        <section
          aria-labelledby="integrity-blocked-heading"
          className="max-w-xl w-full bg-white border-2 border-[#B91C1C] rounded-2xl p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
              Integrity Blocked
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#57534E]">
              Data Protection Guard
            </span>
          </div>
          <h1 id="integrity-blocked-heading" className="text-xl font-bold text-[#141413] mb-2">
            Existing Local Journal Storage Cannot Be Verified Safely
          </h1>
          <p className="text-sm text-[#44403C] mb-4" data-testid="integrity-blocked-reason">
            {statusResult.reason}
          </p>
          <div className="bg-[#FAF7F2] border border-[#E5E0D8] rounded-xl p-4 mb-5 text-sm text-[#44403C] space-y-2">
            <p className="font-semibold text-[#141413]">
              Why fresh initialization is disabled:
            </p>
            <p>
              Local journal data may already exist on this origin. Trade Journal V3 never silently
              overwrites or resets an unreadable, partially migrated, or newer-version storage root.
            </p>
            <p>
              Note: Opening this app in another browser on the same device accesses a separate
              browser-isolated storage space and will not read or repair data stored in this
              browser.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadStartupStatus()}
            className="inline-flex items-center justify-center rounded-full bg-[#141413] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#292524]"
          >
            Retry Storage Inspection
          </button>
        </section>
      </main>
    );
  }

  // Unsupported First-Run Runtime screen (AC-DEL-004)
  if (statusResult.status === 'Unsupported') {
    return (
      <main
        className="min-h-screen bg-[#FAF7F2] text-[#141413] p-6 flex items-center justify-center"
        data-testid="unsupported-runtime-view"
      >
        <section
          aria-labelledby="unsupported-runtime-heading"
          className="max-w-xl w-full bg-white border-2 border-[#B91C1C] rounded-2xl p-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
              Runtime Unsupported
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#57534E]">
              Write Gate Active
            </span>
          </div>
          <h1 id="unsupported-runtime-heading" className="text-xl font-bold text-[#141413] mb-2">
            Local Runtime Prerequisites Are Not Met
          </h1>
          <p className="text-sm text-[#44403C] mb-4">
            {readinessReport.summaryMessage}
          </p>

          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#57534E] mb-2">
            Runtime Readiness Checks ({readinessReport.failureCodes.length} Failed)
          </h2>
          <ul className="space-y-2 mb-5" data-testid="unsupported-check-list">
            {readinessReport.checks.map((check) => (
              <li
                key={check.checkId}
                data-testid={`readiness-check-${check.checkId}`}
                className={`p-3 rounded-xl border text-sm ${
                  check.passed
                    ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                    : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>{check.checkId}</span>
                  <span>{check.passed ? 'PASS' : `FAIL (${check.failureCode})`}</span>
                </div>
                <p className="mt-1 text-xs">{check.message}</p>
              </li>
            ))}
          </ul>

          <div className="bg-[#FAF7F2] border border-[#E5E0D8] rounded-xl p-4 mb-5 text-xs text-[#44403C]">
            <strong>Browser Storage Isolation Notice:</strong> Trying another modern browser is
            recommended if this browser restricts IndexedDB, Service Workers, or storage quota. Each
            browser maintains separate local storage on your device.
          </div>

          <button
            type="button"
            onClick={() => void loadStartupStatus()}
            className="inline-flex items-center justify-center rounded-full bg-[#141413] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#292524]"
          >
            Retry Readiness Check
          </button>
        </section>
      </main>
    );
  }

  // Advisory Storage Protection Banner (shown when protection is BestEffort or Unavailable)
  const renderAdvisoryProtectionBanner = () => {
    if (readinessReport.storageProtection === 'PersistentGranted') {
      return durabilityFeedback ? (
        <div
          role="status"
          data-testid="durability-feedback-banner"
          className="mb-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] px-4 py-3 text-xs text-[#166534]"
        >
          {durabilityFeedback.message}
        </div>
      ) : null;
    }

    return (
      <div
        role="region"
        aria-label="Storage Durability Advisory"
        data-testid="advisory-protection-banner"
        className="mb-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] px-4 py-3 text-xs text-[#78350F] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <p className="font-semibold text-[#78350F]">
            Advisory: Local Storage Protection is {readinessReport.storageProtection}
          </p>
          <p className="mt-0.5 text-[#78350F]">
            {readinessReport.readiness === 'Writable'
              ? 'Your workspace is Writable, but the browser may clear best-effort site data under heavy storage pressure. Request stronger durability or create regular backups.'
              : 'Local storage is currently under best-effort browser eviction policy. Request stronger durability or create regular backups.'}
          </p>
          {durabilityFeedback && (
            <p className="mt-1 font-medium" data-testid="durability-feedback-banner">
              {durabilityFeedback.message}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleRequestDurability()}
          className="shrink-0 inline-flex items-center justify-center rounded-full bg-[#141413] px-4 py-2 text-xs font-semibold text-white hover:bg-[#292524]"
        >
          Request Stronger Durability
        </button>
      </div>
    );
  };

  // Service Worker Update Notification Banner (AC-DEL-002)
  const renderUpdateBanner = () => {
    if (updateState.status !== 'UpdateAvailable') return null;
    return (
      <div
        role="region"
        aria-label="Application Update Available"
        data-testid="update-available-banner"
        className="mb-4 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] px-4 py-3 text-xs text-[#1E3A8A] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <p className="font-semibold">
            Update Staged &amp; Verified ({updateState.stagedReleaseId})
          </p>
          <p className="mt-0.5">
            Release {updateState.activeReleaseId} remains active for this session. Reload when ready
            to switch to the verified release.
          </p>
          {updateState.deferredReason && (
            <p
              className="mt-1 font-semibold text-[#9A3412]"
              data-testid="update-deferred-notice"
            >
              {updateState.deferredReason}
            </p>
          )}
        </div>
        <button
          type="button"
          data-testid="activate-update-btn"
          onClick={() => void runtime.updateCoordinator.requestSafeActivation()}
          className="shrink-0 inline-flex items-center justify-center rounded-full bg-[#141413] px-4 py-2 text-xs font-semibold text-white hover:bg-[#292524]"
        >
          Reload to Activate Update
        </button>
      </div>
    );
  };

  // First-Run Workspace Initialization View (Task 2.3)
  if (statusResult.status === 'InitializationRequired') {
    return (
      <main
        className="min-h-screen bg-[#FAF7F2] text-[#141413] p-4 sm:p-8 flex items-center justify-center"
        data-testid="initialize-workspace-view"
      >
        <div className="max-w-xl w-full">
          {renderUpdateBanner()}
          {renderAdvisoryProtectionBanner()}

          <section
            aria-labelledby="init-workspace-heading"
            className="bg-white border border-[#E5E0D8] rounded-2xl p-6 sm:p-8 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#57534E]">
                Deliverable 1 · First-Run Setup
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                Runtime Writable
              </span>
            </div>

            <h1 id="init-workspace-heading" className="text-2xl font-bold text-[#141413] mb-2">
              Initialize Your Local Trade Journal Workspace
            </h1>
            <p className="text-sm text-[#44403C] mb-5">
              Choose the rules-based IANA time zone for your workspace. Market session dates remain
              U.S. exchange-defined (Eastern Time), while your workspace time zone governs local
              View Moments, Daily Review calendar dates, and named Report Period boundaries.
            </p>

            <form onSubmit={(e) => void handleInitializeSubmit(e)} noValidate>
              <div className="mb-4">
                <label
                  htmlFor="init-timezone-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5"
                >
                  Workspace Time Zone (IANA)
                </label>
                <input
                  id="init-timezone-input"
                  name="proposedTimeZone"
                  type="text"
                  list="iana-timezone-options"
                  value={initTimeZoneInput}
                  onChange={(e) => {
                    setInitTimeZoneInput(e.target.value);
                    setInitError(null);
                  }}
                  aria-describedby="init-timezone-help"
                  aria-invalid={initError ? 'true' : 'false'}
                  className="w-full rounded-xl border border-[#D6D0C4] bg-white px-3.5 py-2.5 text-sm text-[#141413] focus:border-[#141413] focus:outline-none"
                />
                <datalist id="iana-timezone-options">
                  {COMMON_IANA_TIME_ZONES.map((tz) => (
                    <option key={tz} value={tz} />
                  ))}
                </datalist>
                <p id="init-timezone-help" className="mt-1.5 text-xs text-[#57534E]">
                  Examples: <code>America/New_York</code>, <code>America/Chicago</code>,{' '}
                  <code>America/Los_Angeles</code>, <code>Europe/London</code>, <code>UTC</code>.
                </p>
              </div>

              {initError && (
                <div
                  role="alert"
                  data-testid="init-timezone-error"
                  className="mb-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] p-3 text-xs font-medium text-[#991B1B]"
                >
                  {initError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isInitializing}
                  className="inline-flex items-center justify-center rounded-full bg-[#141413] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#292524] disabled:opacity-50"
                >
                  {isInitializing ? 'Initializing…' : 'Initialize Workspace'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    );
  }

  // Ready or RecoveryOnly Workspace App Shell (Tasks 2.3 & 3.2)
  const workspace: ReadyWorkspaceSummary = statusResult.workspace;
  const isWritable = statusResult.status === 'Ready';
  const isReadyForPlanning = workspace.onboardingState === 'ReadyForTradePlanning';

  const navItems: readonly { readonly id: D01NavRoute; readonly label: string }[] = [
    { id: 'overview', label: 'Overview & Onboarding' },
    { id: 'accounts', label: 'Accounts & Institutions' },
    { id: 'settings', label: 'Workspace Settings' },
  ];

  const renderRecoveryOnlyBanner = () => {
    if (statusResult.status !== 'RecoveryOnly') return null;
    return (
      <div
        role="alert"
        data-testid="recovery-only-banner"
        className="mb-4 rounded-xl bg-[#FEF2F2] border-2 border-[#B91C1C] p-4 text-xs text-[#991B1B]"
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-bold uppercase tracking-wider">
            Recovery Only Mode (RuntimeNotWritable)
          </span>
          <button
            type="button"
            onClick={() => void loadStartupStatus()}
            className="rounded-full bg-[#991B1B] px-3 py-1 text-xs font-semibold text-white hover:bg-[#7F1D1D]"
          >
            Re-Verify Runtime
          </button>
        </div>
        <p className="mb-1">
          {readinessReport.summaryMessage} All existing Institutions, Accounts, and Workspace
          settings remain readable, but mutating actions are disabled (`RuntimeNotWritable`).
        </p>
        <p>
          Failed checks: <strong>{readinessReport.failureCodes.join(', ')}</strong>. Note: Opening
          another browser on this device accesses separate browser-isolated storage and will not see
          this workspace directly.
        </p>
      </div>
    );
  };

  const renderOnboardingAndCatalogSection = () => (
    <div className="space-y-6" data-testid="onboarding-catalog-view">
      {/* Workspace Onboarding Status Banner */}
      <section
        aria-labelledby="onboarding-status-heading"
        data-testid="workspace-onboarding-banner"
        className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#57534E]">
            Workspace Onboarding Status
          </span>
          <span
            data-testid="onboarding-state-badge"
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
              isReadyForPlanning
                ? 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]'
                : 'bg-[#FFFBEB] text-[#78350F] border-[#FDE68A]'
            }`}
          >
            {isReadyForPlanning ? 'Ready for Trade Planning' : 'Needs Institution and Account'}
          </span>
        </div>

        <h1 id="onboarding-status-heading" className="text-xl font-bold text-[#141413] mb-2">
          {isReadyForPlanning
            ? 'Workspace Ready for Trade Planning'
            : 'Complete First Institution & Brokerage Account Onboarding'}
        </h1>
        <p className="text-sm text-[#44403C] mb-4">
          {isReadyForPlanning
            ? 'Your workspace has at least one selectable brokerage Account under a selectable Institution. Your Reference Catalog is ready for Trade creation.'
            : 'No fictional brokerage data is ever seeded. Add your first Institution and create at least one brokerage Account under it to unlock Trade planning.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E5E0D8]">
          <div className="bg-[#FAF7F2] rounded-xl p-3">
            <span className="block text-xs uppercase tracking-wider text-[#57534E]">
              Time Zone
            </span>
            <span
              className="mt-1 block text-sm font-semibold text-[#141413]"
              data-testid="summary-timezone"
            >
              {workspace.timeZone}
            </span>
          </div>
          <div className="bg-[#FAF7F2] rounded-xl p-3">
            <span className="block text-xs uppercase tracking-wider text-[#57534E]">
              Institutions
            </span>
            <span
              className="mt-1 block text-sm font-semibold text-[#141413] tabular-nums text-right sm:text-left"
              data-testid="summary-institution-count"
            >
              {institutions.length}
            </span>
          </div>
          <div className="bg-[#FAF7F2] rounded-xl p-3">
            <span className="block text-xs uppercase tracking-wider text-[#57534E]">
              Selectable Accounts
            </span>
            <span
              className="mt-1 block text-sm font-semibold text-[#141413] tabular-nums text-right sm:text-left"
              data-testid="summary-account-count"
            >
              {workspace.selectableAccountCount}
            </span>
          </div>
        </div>
      </section>

      {/* Institutions Card */}
      <section
        aria-labelledby="institutions-heading"
        className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#57534E]">
              Step 1 · Brokerage Institutions
            </span>
            <h2 id="institutions-heading" className="text-lg font-bold text-[#141413]">
              Institutions ({institutions.length})
            </h2>
          </div>
          {!showCreateInstitutionForm && (
            <button
              type="button"
              data-testid="open-create-institution-btn"
              disabled={!isWritable}
              onClick={() => {
                setShowCreateInstitutionForm(true);
                setInstitutionFormError(null);
              }}
              className="inline-flex items-center justify-center rounded-full bg-[#141413] px-4 py-2 text-xs font-semibold text-white hover:bg-[#292524] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Add Institution
            </button>
          )}
        </div>

        {showCreateInstitutionForm && (
          <form
            onSubmit={(e) => void handleCreateInstitutionSubmit(e)}
            data-testid="create-institution-form"
            className="mb-5 bg-[#FAF7F2] border border-[#E5E0D8] rounded-xl p-4"
            noValidate
          >
            <div className="mb-3">
              <label
                htmlFor="institution-name-input"
                className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1"
              >
                Institution Name
              </label>
              <input
                id="institution-name-input"
                type="text"
                value={newInstitutionLabel}
                onChange={(e) => {
                  setNewInstitutionLabel(e.target.value);
                  setInstitutionFormError(null);
                }}
                placeholder="e.g., Interactive Brokers, Fidelity, Schwab"
                aria-invalid={institutionFormError ? 'true' : 'false'}
                className="w-full rounded-xl border border-[#D6D0C4] bg-white px-3.5 py-2 text-sm text-[#141413] focus:border-[#141413] focus:outline-none"
              />
            </div>

            {institutionFormError && (
              <div
                role="alert"
                data-testid="institution-form-error"
                className="mb-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] p-2.5 text-xs font-medium text-[#991B1B]"
              >
                {institutionFormError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateInstitutionForm(false);
                  setNewInstitutionLabel('');
                  setInstitutionFormError(null);
                }}
                className="inline-flex items-center justify-center rounded-full border border-[#D6D0C4] bg-white px-4 py-2 text-xs font-semibold text-[#141413] hover:bg-[#F5F2EB]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isWritable}
                className="inline-flex items-center justify-center rounded-full bg-[#141413] px-4 py-2 text-xs font-semibold text-white hover:bg-[#292524] disabled:opacity-40"
              >
                Save Institution
              </button>
            </div>
          </form>
        )}

        {institutions.length === 0 ? (
          <div
            data-testid="empty-institutions-state"
            className="rounded-xl border border-dashed border-[#D6D0C4] bg-[#FAF7F2] p-5 text-center"
          >
            <p className="text-sm font-semibold text-[#141413]">No Institutions Recorded Yet</p>
            <p className="mt-1 text-xs text-[#57534E]">
              Add your first brokerage Institution to organize your trading Accounts.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E5E0D8]" data-testid="institution-list">
            {institutions.map((inst) => (
              <li
                key={inst.id}
                data-testid={`institution-row-${inst.id}`}
                className="py-3 flex items-center justify-between gap-2"
              >
                <div>
                  <span className="text-sm font-semibold text-[#141413]">{inst.label}</span>
                  <span className="ml-2 text-xs text-[#57534E] tabular-nums">
                    Rev {inst.currentRevision}
                  </span>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                  {inst.availability}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Accounts Card */}
      <section
        aria-labelledby="accounts-heading"
        className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#57534E]">
              Step 2 · Trading Accounts
            </span>
            <h2 id="accounts-heading" className="text-lg font-bold text-[#141413]">
              Accounts ({accounts.length})
            </h2>
          </div>
          {!showCreateAccountForm && (
            <button
              type="button"
              data-testid="open-create-account-btn"
              disabled={!isWritable || institutions.length === 0}
              onClick={() => {
                setShowCreateAccountForm(true);
                setAccountFormError(null);
                if (!selectedParentInstitutionId && institutions[0]) {
                  setSelectedParentInstitutionId(institutions[0].id);
                }
              }}
              className="inline-flex items-center justify-center rounded-full bg-[#141413] px-4 py-2 text-xs font-semibold text-white hover:bg-[#292524] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Add Account
            </button>
          )}
        </div>

        {showCreateAccountForm && (
          <form
            onSubmit={(e) => void handleCreateAccountSubmit(e)}
            data-testid="create-account-form"
            className="mb-5 bg-[#FAF7F2] border border-[#E5E0D8] rounded-xl p-4"
            noValidate
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label
                  htmlFor="account-parent-institution-select"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1"
                >
                  Parent Institution
                </label>
                <select
                  id="account-parent-institution-select"
                  value={selectedParentInstitutionId || (institutions[0]?.id ?? '')}
                  onChange={(e) => {
                    setSelectedParentInstitutionId(e.target.value);
                    setAccountFormError(null);
                  }}
                  className="w-full rounded-xl border border-[#D6D0C4] bg-white px-3.5 py-2 text-sm text-[#141413] focus:border-[#141413] focus:outline-none"
                >
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="account-name-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1"
                >
                  Account Name
                </label>
                <input
                  id="account-name-input"
                  type="text"
                  value={newAccountLabel}
                  onChange={(e) => {
                    setNewAccountLabel(e.target.value);
                    setAccountFormError(null);
                  }}
                  placeholder="e.g., U1234567 Margin, Roth IRA"
                  aria-invalid={accountFormError ? 'true' : 'false'}
                  className="w-full rounded-xl border border-[#D6D0C4] bg-white px-3.5 py-2 text-sm text-[#141413] focus:border-[#141413] focus:outline-none"
                />
              </div>
            </div>

            {accountFormError && (
              <div
                role="alert"
                data-testid="account-form-error"
                className="mb-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] p-2.5 text-xs font-medium text-[#991B1B]"
              >
                {accountFormError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateAccountForm(false);
                  setNewAccountLabel('');
                  setAccountFormError(null);
                }}
                className="inline-flex items-center justify-center rounded-full border border-[#D6D0C4] bg-white px-4 py-2 text-xs font-semibold text-[#141413] hover:bg-[#F5F2EB]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isWritable}
                className="inline-flex items-center justify-center rounded-full bg-[#141413] px-4 py-2 text-xs font-semibold text-white hover:bg-[#292524] disabled:opacity-40"
              >
                Save Account
              </button>
            </div>
          </form>
        )}

        {accounts.length === 0 ? (
          <div
            data-testid="empty-accounts-state"
            className="rounded-xl border border-dashed border-[#D6D0C4] bg-[#FAF7F2] p-5 text-center"
          >
            <p className="text-sm font-semibold text-[#141413]">No Trading Accounts Recorded Yet</p>
            <p className="mt-1 text-xs text-[#57534E]">
              {institutions.length === 0
                ? 'Create an Institution above first, then add your first brokerage Account under it.'
                : 'Add a brokerage Account under an existing Institution to complete onboarding.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E5E0D8]" data-testid="account-list">
            {accounts.map((acct) => {
              const parent = institutions.find((i) => i.id === acct.parentInstitutionId);
              return (
                <li
                  key={acct.id}
                  data-testid={`account-row-${acct.id}`}
                  className="py-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="text-sm font-semibold text-[#141413]">{acct.label}</span>
                    <span className="ml-2 text-xs text-[#57534E]">
                      ({parent ? parent.label : acct.parentInstitutionId})
                    </span>
                    <span className="ml-2 text-xs text-[#57534E] tabular-nums">
                      Rev {acct.currentRevision}
                    </span>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]">
                    {acct.availability}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );

  const renderSettingsSection = () => (
    <div className="space-y-6" data-testid="workspace-settings-view">
      <section
        aria-labelledby="settings-heading"
        className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#57534E]">
            Workspace Settings
          </span>
          <span
            className="text-xs font-semibold text-[#57534E] tabular-nums"
            data-testid="settings-revision-badge"
          >
            Settings Revision {workspace.settingsRevision}
          </span>
        </div>

        <h1 id="settings-heading" className="text-xl font-bold text-[#141413] mb-2">
          Rules-Based Time Zone &amp; Runtime Durability
        </h1>
        <p
          className="text-sm text-[#44403C] mb-4"
          data-testid="prospective-timezone-note"
        >
          Changing the workspace time zone updates how local View Moments, Daily Review calendar
          selection, and named Report Period boundaries resolve going forward without rewriting
          stored UTC instants or historical records. U.S. exchange session dates remain
          exchange-defined.
        </p>

        <form onSubmit={(e) => void handleSaveSettingsSubmit(e)} noValidate>
          <div className="mb-4">
            <label
              htmlFor="settings-timezone-input"
              className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5"
            >
              Workspace Time Zone (IANA)
            </label>
            <input
              id="settings-timezone-input"
              type="text"
              list="settings-iana-timezone-options"
              value={settingsTimeZoneInput}
              disabled={!isWritable}
              onChange={(e) => {
                setSettingsTimeZoneInput(e.target.value);
                setSettingsFeedback(null);
              }}
              className="w-full rounded-xl border border-[#D6D0C4] bg-white px-3.5 py-2.5 text-sm text-[#141413] focus:border-[#141413] focus:outline-none disabled:bg-[#F5F2EB]"
            />
            <datalist id="settings-iana-timezone-options">
              {COMMON_IANA_TIME_ZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </div>

          {settingsFeedback && (
            <div
              role={settingsFeedback.kind === 'error' || settingsFeedback.kind === 'conflict' ? 'alert' : 'status'}
              data-testid="settings-feedback"
              className={`mb-4 rounded-xl p-3 text-xs font-medium border ${
                settingsFeedback.kind === 'saved'
                  ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                  : settingsFeedback.kind === 'unchanged'
                    ? 'bg-[#FAF7F2] border-[#D6D0C4] text-[#44403C]'
                    : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
              }`}
            >
              {settingsFeedback.message}
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={!isWritable}
              data-testid="save-settings-btn"
              className="inline-flex items-center justify-center rounded-full bg-[#141413] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#292524] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save Time Zone
            </button>
          </div>
        </form>
      </section>

      <section
        aria-labelledby="runtime-diagnostics-heading"
        className="bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-sm"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-[#57534E]">
          Installed Capability Manifest &amp; Diagnostics
        </span>
        <h2 id="runtime-diagnostics-heading" className="text-lg font-bold text-[#141413] mt-1 mb-3">
          Release {workspace.capabilityManifest.releaseVersion} (Schema v{workspace.schemaVersion})
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-[#FAF7F2] rounded-xl p-3">
            <dt className="text-[#57534E] uppercase tracking-wider">Runtime Readiness</dt>
            <dd className="mt-1 font-semibold text-[#141413]" data-testid="diag-readiness">
              {readinessReport.readiness}
            </dd>
          </div>
          <div className="bg-[#FAF7F2] rounded-xl p-3">
            <dt className="text-[#57534E] uppercase tracking-wider">Storage Protection</dt>
            <dd className="mt-1 font-semibold text-[#141413]" data-testid="diag-protection">
              {readinessReport.storageProtection}
            </dd>
          </div>
          <div className="bg-[#FAF7F2] rounded-xl p-3">
            <dt className="text-[#57534E] uppercase tracking-wider">Snapshot Binding</dt>
            <dd className="mt-1 font-mono text-[#141413] truncate" data-testid="diag-snapshot">
              {workspace.snapshotBinding}
            </dd>
          </div>
          <div className="bg-[#FAF7F2] rounded-xl p-3">
            <dt className="text-[#57534E] uppercase tracking-wider">Catalog Snapshot</dt>
            <dd className="mt-1 font-mono text-[#141413] truncate" data-testid="diag-cat-snapshot">
              {workspace.catalogSnapshotId}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-[#FAF7F2] text-[#141413] flex flex-col md:flex-row"
      data-testid="app-shell"
      data-layout-mode={isNarrowLayout ? 'narrow' : 'wide'}
    >
      {/* Wide Left Sidebar Navigation (>= 768px) */}
      {!isNarrowLayout && (
        <aside
          aria-label="Primary Sidebar Navigation"
          data-testid="wide-sidebar-nav"
          className="w-64 shrink-0 bg-white border-r border-[#E5E0D8] p-5 flex flex-col justify-between"
        >
          <div>
            <div className="mb-6">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#57534E]">
                Trade Journal V3
              </span>
              <p className="text-base font-bold text-[#141413] mt-0.5">Local Workspace</p>
            </div>

            <nav aria-label="Workspace Sections" className="space-y-1.5">
              {navItems.map((item) => {
                const active = activeRoute === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`nav-wide-${item.id}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setActiveRoute(item.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-[#141413] text-white'
                        : 'text-[#44403C] hover:bg-[#FAF7F2] hover:text-[#141413]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-[#E5E0D8] text-xs text-[#57534E]">
            <div>Time Zone: {workspace.timeZone}</div>
            <div className="mt-0.5 tabular-nums">
              Accounts: {workspace.selectableAccountCount}
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Container */}
      <main className="flex-1 p-4 sm:p-8 pb-24 md:pb-8 max-w-4xl w-full mx-auto">
        {renderUpdateBanner()}
        {renderRecoveryOnlyBanner()}
        {renderAdvisoryProtectionBanner()}

        {activeRoute === 'settings'
          ? renderSettingsSection()
          : renderOnboardingAndCatalogSection()}
      </main>

      {/* Narrow Bottom Navigation Bar (< 768px) */}
      {isNarrowLayout && (
        <nav
          aria-label="Mobile Bottom Navigation"
          data-testid="narrow-bottom-nav"
          className="fixed bottom-0 inset-x-0 bg-white border-t border-[#E5E0D8] px-2 py-2 flex items-center justify-around z-20"
        >
          {navItems.map((item) => {
            const active = activeRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`nav-narrow-${item.id}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setActiveRoute(item.id)}
                className={`px-3 py-2 rounded-full text-xs font-semibold ${
                  active ? 'bg-[#141413] text-white' : 'text-[#44403C]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
