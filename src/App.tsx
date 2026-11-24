import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserAppRuntime, type AppRuntime } from './app/create-app-runtime';
import type { RuntimeReadinessSnapshot } from './runtime/readiness';
import type { SwUpdateHandle } from './runtime/sw-client';
import type { TradeReplayViewResult } from './trade-views/trade-views';
import { AboutView } from './ui/about/AboutView';
import { AccountsView } from './ui/accounts/AccountsView';
import { ReplayOverlay } from './ui/replay/ReplayOverlay';
import rpStyles from './ui/replay/Replay.module.css';
import { useModalDialog } from './ui/replay/useModalDialog';
import { DailyReviewView } from './ui/review/DailyReviewView';
import { AppShell, type NavTab } from './ui/shell/AppShell';
import styles from './ui/shell/AppShell.module.css';
import { OnboardingScreen } from './ui/shell/OnboardingScreen';
import { ReadinessScreen } from './ui/shell/ReadinessScreen';
import { NewPlanView } from './ui/trades/NewPlanView';
import { TradeDetailCockpit, type CockpitDrawer } from './ui/trades/TradeDetailCockpit';
import { TradesView } from './ui/trades/TradesView';
import type { WorkspaceStatusResult, WorkspaceStatusSnapshot } from './workspace/workspace';

type AppScreenState =
  | { readonly kind: 'Loading' }
  | {
      readonly kind: 'Unsupported';
      readonly readiness: RuntimeReadinessSnapshot | null;
      readonly reason?: string;
    }
  | {
      readonly kind: 'IntegrityBlocked';
      readonly readiness: RuntimeReadinessSnapshot | null;
      readonly reason: string;
    }
  | { readonly kind: 'InitializationRequired'; readonly readiness: RuntimeReadinessSnapshot }
  | {
      readonly kind: 'Ready';
      readonly workspaceStatus: WorkspaceStatusSnapshot;
      readonly recoveryOnly: boolean;
    };

type ReplayModalState =
  | { readonly kind: 'Loading' }
  | { readonly kind: 'Loaded'; readonly result: TradeReplayViewResult }
  | { readonly kind: 'Error'; readonly message: string };

function renderReplayStatusContent(replayState: ReplayModalState | null) {
  if (!replayState || replayState.kind === 'Loading') {
    return 'Loading Trade Replay…';
  }
  switch (replayState.kind) {
    case 'Error':
      return (
        <div className={styles.alertError} role="alert" style={{ marginBottom: 0 }}>
          {replayState.message}
        </div>
      );
    case 'Loaded': {
      const res = replayState.result;
      switch (res.status) {
        case 'NotApplicable':
          return (
            <p style={{ margin: 0 }}>
              {res.reason === 'NotEnteredAsOf'
                ? 'This Trade had not entered yet by the requested session.'
                : 'Replay is not available before an opening execution is recorded.'}
            </p>
          );
        case 'IntegrityBlocked':
          return (
            <div className={styles.alertError} role="alert" style={{ marginBottom: 0 }}>
              <strong>Facts can&apos;t be replayed:</strong> {res.reason}
            </div>
          );
        case 'NotFound':
          return (
            <div className={styles.alertError} role="alert" style={{ marginBottom: 0 }}>
              Trade not found.
            </div>
          );
        case 'Ready':
          return null;
      }
    }
  }
}

function ReplayStatusDialog({
  replayState,
  returnLabel,
  onClose,
}: {
  readonly replayState: ReplayModalState | null;
  readonly returnLabel: string;
  readonly onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useModalDialog({
    dialogRef,
    initialFocusRef: closeBtnRef,
    onClose,
  });

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className={rpStyles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Trade Replay status"
    >
      <header className={rpStyles.overlayHeader}>
        <span className={rpStyles.overlayTitle}>Replay</span>
        <button
          ref={closeBtnRef}
          type="button"
          className={styles.btnSecondary}
          onClick={onClose}
        >
          {returnLabel}
        </button>
      </header>
      <div className={rpStyles.overlayBody}>
        <section className={styles.card} aria-busy={!replayState || replayState.kind === 'Loading'}>
          {renderReplayStatusContent(replayState)}
        </section>
      </div>
    </div>
  );
}

function mapWorkspaceStatusToScreen(status: WorkspaceStatusResult): AppScreenState {
  switch (status.status) {
    case 'Ready':
      return { kind: 'Ready', workspaceStatus: status.workspaceStatus, recoveryOnly: false };
    case 'RecoveryOnly':
      return { kind: 'Ready', workspaceStatus: status.workspaceStatus, recoveryOnly: true };
    case 'InitializationRequired':
      return { kind: 'InitializationRequired', readiness: status.readiness };
    case 'IntegrityBlocked':
      return {
        kind: 'IntegrityBlocked',
        readiness: status.readiness,
        reason: status.reason,
      };
    case 'Unsupported':
      return { kind: 'Unsupported', readiness: status.readiness };
  }
}

export function App() {
  const runtimeRef = useRef<AppRuntime | null>(null);
  if (!runtimeRef.current) {
    runtimeRef.current = createBrowserAppRuntime();
  }
  const runtime = runtimeRef.current;

  const bootSeqRef = useRef(0);
  const [screen, setScreen] = useState<AppScreenState>({ kind: 'Loading' });
  const [activeTab, setActiveTab] = useState<NavTab>('accounts');
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [requestedCockpitDrawer, setRequestedCockpitDrawer] = useState<{
    readonly tradeId: string;
    readonly drawer: CockpitDrawer;
    readonly requestKey: number;
  } | null>(null);
  const [tradesRefreshKey, setTradesRefreshKey] = useState(0);
  const replaySeqRef = useRef(0);
  const drawerRequestSeqRef = useRef(0);
  const replayReturnFocusRef = useRef<HTMLElement | null>(null);
  const [replayTarget, setReplayTarget] = useState<{
    readonly tradeId: string;
    readonly returnLabel: 'Back to the Review' | 'Back to Trade';
  } | null>(null);
  const [replayState, setReplayState] = useState<ReplayModalState | null>(null);
  const [stagedUpdate, setStagedUpdate] = useState<SwUpdateHandle | null>(null);
  const [accountsDirty, setAccountsDirty] = useState(false);
  const [aboutDirty, setAboutDirty] = useState(false);
  const [planDirty, setPlanDirty] = useState(false);
  const [entryDirty, setEntryDirty] = useState(false);
  const [reviewDirty, setReviewDirty] = useState(false);
  const [durabilityBusy, setDurabilityBusy] = useState(false);

  const hasUnsavedChanges = accountsDirty || aboutDirty || planDirty || entryDirty || reviewDirty;

  const bootOrRefresh = useCallback(async () => {
    const seq = ++bootSeqRef.current;
    setScreen({ kind: 'Loading' });
    try {
      await runtime.registerServiceWorker((handle) => {
        setStagedUpdate(handle);
      });
      const initResult = await runtime.workspace.initialize({});
      if (seq !== bootSeqRef.current) {
        return;
      }
      if (initResult.status === 'MigrationBlocked') {
        setScreen({
          kind: 'IntegrityBlocked',
          readiness: initResult.readiness,
          reason: `Migration blocked: ${initResult.reason}`,
        });
        return;
      }
      const status = await runtime.workspace.getStatus();
      if (seq !== bootSeqRef.current) {
        return;
      }
      setScreen(mapWorkspaceStatusToScreen(status));
    } catch (error) {
      if (seq !== bootSeqRef.current) {
        return;
      }
      setScreen({
        kind: 'Unsupported',
        readiness: runtime.readiness.getCurrent(),
        reason: error instanceof Error ? error.message : 'Unexpected startup readiness failure.',
      });
    }
  }, [runtime]);

  useEffect(() => {
    void bootOrRefresh();
  }, [bootOrRefresh]);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await runtime.workspace.getStatus();
      setScreen(mapWorkspaceStatusToScreen(status));
    } catch (error) {
      setScreen({
        kind: 'Unsupported',
        readiness: runtime.readiness.getCurrent(),
        reason: error instanceof Error ? error.message : 'Unable to refresh workspace status.',
      });
    }
  }, [runtime]);

  const rerunReadinessInPlace = useCallback(async () => {
    try {
      await runtime.readiness.evaluate();
      const status = await runtime.workspace.getStatus();
      setScreen(mapWorkspaceStatusToScreen(status));
    } catch (error) {
      setScreen({
        kind: 'Unsupported',
        readiness: runtime.readiness.getCurrent(),
        reason: error instanceof Error ? error.message : 'Unable to re-run readiness checks.',
      });
    }
  }, [runtime]);

  const handleInitialize = async (timeZone: string): Promise<string | null> => {
    try {
      const result = await runtime.workspace.initialize({ proposedTimeZone: timeZone });
      if (result.status === 'Opened') {
        setScreen({
          kind: 'Ready',
          workspaceStatus: result.workspaceStatus,
          recoveryOnly: result.workspaceStatus.readiness.state !== 'Writable',
        });
        return null;
      }
      if (result.status === 'Rejected') {
        return result.message;
      }
      if (result.status === 'MigrationBlocked') {
        return `Migration blocked: ${result.reason}`;
      }
      if (result.status === 'RuntimeNotWritable') {
        await refreshStatus();
        return `Cannot initialize workspace: runtime is ${result.reason}.`;
      }
      return 'Please select a valid IANA time zone.';
    } catch (error) {
      return error instanceof Error ? error.message : 'Failed to initialize workspace.';
    }
  };

  const handleSaveTimeZone = async (
    timeZone: string,
  ): Promise<{ ok: boolean; message: string }> => {
    if (screen.kind !== 'Ready') {
      return { ok: false, message: 'Workspace is not ready.' };
    }
    try {
      const res = await runtime.workspace.saveSettings({
        timeZone,
        expectedSettingsRevision: screen.workspaceStatus.settingsRevision,
      });
      if (res.status === 'Saved') {
        setScreen({
          kind: 'Ready',
          workspaceStatus: res.workspaceStatus,
          recoveryOnly: res.workspaceStatus.readiness.state !== 'Writable',
        });
        return { ok: true, message: `Saved time zone "${res.workspaceStatus.timeZone}".` };
      }
      if (res.status === 'Unchanged') {
        setScreen({
          kind: 'Ready',
          workspaceStatus: res.workspaceStatus,
          recoveryOnly: res.workspaceStatus.readiness.state !== 'Writable',
        });
        return { ok: true, message: 'Time zone is already set to that value.' };
      }
      if (res.status === 'Conflict') {
        await refreshStatus();
        return {
          ok: false,
          message: 'Workspace settings changed in another operation; reloaded latest values.',
        };
      }
      if (res.status === 'Rejected') {
        return { ok: false, message: res.message };
      }
      await refreshStatus();
      return { ok: false, message: `Write blocked: runtime is ${res.reason}.` };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to save time zone.',
      };
    }
  };

  const handleRequestDurability = async (): Promise<{ ok: boolean; message: string }> => {
    setDurabilityBusy(true);
    try {
      const res = await runtime.workspace.requestDurability();
      await refreshStatus();
      if (res.status === 'Improved') {
        return { ok: true, message: 'Browser granted persistent storage (Protected).' };
      }
      if (res.status === 'AlreadyProtected') {
        return { ok: true, message: 'Local storage is already Protected.' };
      }
      return {
        ok: false,
        message: `Storage remains ${res.currentProtection.state}: ${res.currentProtection.reason}`,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to request persistent storage.',
      };
    } finally {
      setDurabilityBusy(false);
    }
  };

  const handleSelectTab = (tab: NavTab) => {
    setRequestedCockpitDrawer(null);
    setActiveTab(tab);
    if (tab === 'trades' || tab === 'review') {
      if (tab === 'trades') {
        setSelectedTradeId(null);
      }
      setTradesRefreshKey((k) => k + 1);
    }
  };

  const handlePlanConfirmed = (tradeId: string) => {
    setSelectedTradeId(tradeId);
    setTradesRefreshKey((k) => k + 1);
    setActiveTab('trades');
  };

  const openReplay = useCallback(
    (
      tradeId: string,
      returnLabel: 'Back to the Review' | 'Back to Trade',
      triggerEl?: HTMLElement | null,
      asOfSessionDate?: string,
    ) => {
      replayReturnFocusRef.current = triggerEl ?? null;
      const seq = ++replaySeqRef.current;
      setReplayTarget({ tradeId, returnLabel });
      setReplayState({ kind: 'Loading' });
      void runtime.views
        .replayTrade(tradeId, asOfSessionDate ? { asOfSessionDate } : undefined)
        .then((result) => {
          if (seq !== replaySeqRef.current) return;
          setReplayState({ kind: 'Loaded', result });
        })
        .catch((err) => {
          if (seq !== replaySeqRef.current) return;
          setReplayState({
            kind: 'Error',
            message: err instanceof Error ? err.message : 'Unable to load Trade Replay.',
          });
        });
    },
    [runtime],
  );

  const closeReplay = useCallback(() => {
    replaySeqRef.current += 1;
    const focusEl = replayReturnFocusRef.current;
    replayReturnFocusRef.current = null;
    setReplayTarget(null);
    setReplayState(null);
    if (focusEl) {
      requestAnimationFrame(() => {
        if (focusEl.isConnected) {
          focusEl.focus();
        }
      });
    }
  }, []);

  const handleOpenPriceHistoryFromReplay = useCallback(
    (tradeId: string) => {
      if (
        entryDirty &&
        selectedTradeId &&
        selectedTradeId !== tradeId &&
        typeof window !== 'undefined' &&
        !window.confirm(
          'You have unsaved position edits in Trade Detail. Switch to Price History and discard them?',
        )
      ) {
        return;
      }
      replaySeqRef.current += 1;
      replayReturnFocusRef.current = null;
      setReplayTarget(null);
      setReplayState(null);
      setSelectedTradeId(tradeId);
      const nextKey = ++drawerRequestSeqRef.current;
      setRequestedCockpitDrawer({
        tradeId,
        drawer: 'history',
        requestKey: nextKey,
      });
      setActiveTab('trades');
      setTradesRefreshKey((k) => k + 1);
    },
    [entryDirty, selectedTradeId],
  );

  if (screen.kind === 'Loading') {
    return <ReadinessScreen mode="Loading" readiness={null} onRetry={() => void bootOrRefresh()} />;
  }

  if (screen.kind === 'Unsupported') {
    return (
      <ReadinessScreen
        mode="Unsupported"
        readiness={screen.readiness}
        reason={screen.reason}
        onRetry={() => void bootOrRefresh()}
      />
    );
  }

  if (screen.kind === 'IntegrityBlocked') {
    return (
      <ReadinessScreen
        mode="IntegrityBlocked"
        readiness={screen.readiness}
        reason={screen.reason}
        onRetry={() => void bootOrRefresh()}
      />
    );
  }

  if (screen.kind === 'InitializationRequired') {
    return <OnboardingScreen onInitialize={handleInitialize} />;
  }

  return (
    <>
      <div inert={Boolean(replayTarget)}>
        <AppShell
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          workspaceStatus={screen.workspaceStatus}
          recoveryOnly={screen.recoveryOnly}
          hasUnsavedChanges={hasUnsavedChanges}
          stagedUpdate={stagedUpdate}
          onRequestDurability={() => {
            void handleRequestDurability();
          }}
          durabilityBusy={durabilityBusy}
        >
          <div hidden={activeTab !== 'trades'}>
            {selectedTradeId ? (
              <TradeDetailCockpit
                tradeId={selectedTradeId}
                views={runtime.views}
                catalog={runtime.catalog}
                journal={runtime.journal}
                workflows={runtime.workflows}
                clock={runtime.clock}
                writable={!screen.recoveryOnly}
                refreshKey={tradesRefreshKey}
                requestedDrawer={requestedCockpitDrawer}
                onDrawerRequestConsumed={(key) => {
                  setRequestedCockpitDrawer((cur) =>
                    cur && cur.requestKey === key ? null : cur,
                  );
                }}
                onBack={() => {
                  setRequestedCockpitDrawer(null);
                  setSelectedTradeId(null);
                  setTradesRefreshKey((k) => k + 1);
                }}
                onGoToReview={() => {
                  setActiveTab('review');
                  setTradesRefreshKey((k) => k + 1);
                }}
                onOpenReplay={(tradeId, triggerEl) =>
                  openReplay(tradeId, 'Back to Trade', triggerEl)
                }
                onTradeMutated={() => setTradesRefreshKey((k) => k + 1)}
                onDirtyChange={setEntryDirty}
              />
            ) : (
              <TradesView
                views={runtime.views}
                refreshKey={tradesRefreshKey}
                onSelectTrade={setSelectedTradeId}
                onNewPlan={() => setActiveTab('new-plan')}
              />
            )}
          </div>

          <div hidden={activeTab !== 'review'}>
            <DailyReviewView
              dailyReview={runtime.dailyReview}
              marketData={runtime.marketData}
              catalog={runtime.catalog}
              workflows={runtime.workflows}
              journal={runtime.journal}
              clock={runtime.clock}
              refreshKey={tradesRefreshKey}
              writable={!screen.recoveryOnly}
              onReviewMutated={() => setTradesRefreshKey((k) => k + 1)}
              onInspectTrade={(tradeId) => {
                setRequestedCockpitDrawer(null);
                setSelectedTradeId(tradeId);
                setActiveTab('trades');
              }}
              onOpenReplay={(tradeId, triggerEl, asOfSessionDate) =>
                openReplay(tradeId, 'Back to the Review', triggerEl, asOfSessionDate)
              }
              onDirtyChange={setReviewDirty}
            />
          </div>

          <div hidden={activeTab !== 'new-plan'}>
            <NewPlanView
              accountRefreshKey={screen.workspaceStatus.selectableAccountCount}
              catalog={runtime.catalog}
              journal={runtime.journal}
              workflows={runtime.workflows}
              clock={runtime.clock}
              writable={!screen.recoveryOnly}
              onPlanConfirmed={handlePlanConfirmed}
              onGoToAccounts={() => setActiveTab('accounts')}
              onDirtyChange={setPlanDirty}
            />
          </div>

          <div hidden={activeTab !== 'accounts'}>
            <AccountsView
              catalog={runtime.catalog}
              onboardingState={screen.workspaceStatus.onboardingState}
              writable={!screen.recoveryOnly}
              onCatalogChanged={refreshStatus}
              onDirtyChange={setAccountsDirty}
            />
          </div>

          <div hidden={activeTab !== 'about'}>
            <AboutView
              workspaceStatus={screen.workspaceStatus}
              writable={!screen.recoveryOnly}
              durabilityBusy={durabilityBusy}
              onSaveTimeZone={handleSaveTimeZone}
              onRequestDurability={handleRequestDurability}
              onRerunReadiness={rerunReadinessInPlace}
              onDirtyChange={setAboutDirty}
            />
          </div>
        </AppShell>
      </div>

      {replayTarget &&
        (replayState?.kind === 'Loaded' && replayState.result.status === 'Ready' ? (
          <ReplayOverlay
            view={replayState.result.view}
            returnLabel={replayTarget.returnLabel}
            onClose={closeReplay}
            onOpenPriceHistory={handleOpenPriceHistoryFromReplay}
          />
        ) : (
          <ReplayStatusDialog
            replayState={replayState}
            returnLabel={replayTarget.returnLabel}
            onClose={closeReplay}
          />
        ))}
    </>
  );
}
