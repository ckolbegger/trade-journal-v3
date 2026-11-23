import { useState, type ReactNode } from 'react';
import type { SwUpdateHandle } from '../../runtime/sw-client';
import type { WorkspaceStatusSnapshot } from '../../workspace/workspace';
import styles from './AppShell.module.css';

export type NavTab = 'accounts' | 'about';

interface AppShellProps {
  readonly activeTab: NavTab;
  readonly onSelectTab: (tab: NavTab) => void;
  readonly workspaceStatus: WorkspaceStatusSnapshot;
  readonly recoveryOnly: boolean;
  readonly hasUnsavedChanges: boolean;
  readonly stagedUpdate: SwUpdateHandle | null;
  readonly onRequestDurability: () => void;
  readonly durabilityBusy: boolean;
  readonly children: ReactNode;
}

export function AppShell({
  activeTab,
  onSelectTab,
  workspaceStatus,
  recoveryOnly,
  hasUnsavedChanges,
  stagedUpdate,
  onRequestDurability,
  durabilityBusy,
  children,
}: AppShellProps) {
  const [updateError, setUpdateError] = useState<string | null>(null);
  const { readiness } = workspaceStatus;
  const showProtectionWarning = readiness.showProtectionWarning;
  const canRequestPersist = readiness.storageProtection.state === 'BestEffort';

  const navItems: readonly { id: NavTab; label: string }[] = [
    { id: 'accounts', label: 'Accounts' },
    { id: 'about', label: 'About' },
  ];

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="Primary navigation">
        <div className={styles.brand}>
          <p className={styles.brandTitle}>Trade Journal V3</p>
          <span className={styles.brandMeta}>
            {workspaceStatus.onboardingState === 'ReadyForTradePlanning'
              ? 'Ready for Trade Planning'
              : 'Needs Institution & Account'}
          </span>
        </div>

        <nav aria-label="Workspace sections">
          <ul className={styles.navList}>
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`${styles.navButton} ${
                    activeTab === item.id ? styles.navButtonActive : ''
                  }`}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                  onClick={() => onSelectTab(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className={styles.mainColumn}>
        <div className={styles.banners}>
          {recoveryOnly && (
            <div className={`${styles.banner} ${styles.bannerDanger}`} role="alert">
              <div>
                <strong>Recovery Only:</strong> Runtime readiness checks failed for this session.
                Existing data remains readable, but writes are disabled until readiness is restored.
              </div>
            </div>
          )}

          {showProtectionWarning && (
            <div className={`${styles.banner} ${styles.bannerWarning}`} role="status">
              <div>
                <strong>Local storage is not protected ({readiness.storageProtection.state}):</strong>{' '}
                Your browser may clear local data under storage pressure. Keep regular backups.
              </div>
              {canRequestPersist && (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={durabilityBusy}
                  onClick={onRequestDurability}
                >
                  {durabilityBusy ? 'Requesting…' : 'Request Persistent Storage'}
                </button>
              )}
            </div>
          )}

          {stagedUpdate && (
            <div className={`${styles.banner} ${styles.bannerInfo}`} role="status">
              <div>
                <strong>Update available:</strong>{' '}
                {hasUnsavedChanges
                  ? 'A newer release is staged and ready, but activation is deferred while you have unsaved edits.'
                  : 'A newer verified release is ready to activate.'}
              </div>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={hasUnsavedChanges}
                onClick={() => {
                  setUpdateError(null);
                  void stagedUpdate.activateUpdate().catch((err: unknown) => {
                    setUpdateError(
                      err instanceof Error ? err.message : 'Unable to activate update.',
                    );
                  });
                }}
              >
                {hasUnsavedChanges ? 'Save or Discard Edits First' : 'Reload to Activate Update'}
              </button>
            </div>
          )}

          {updateError && (
            <div className={`${styles.banner} ${styles.bannerDanger}`} role="alert">
              {updateError}
            </div>
          )}
        </div>

        <main className={styles.content}>{children}</main>
      </div>

      <nav className={styles.bottomNav} aria-label="Mobile navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.navButton} ${activeTab === item.id ? styles.navButtonActive : ''}`}
            aria-current={activeTab === item.id ? 'page' : undefined}
            onClick={() => onSelectTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
