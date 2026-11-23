import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserAppRuntime, type AppRuntime } from './app/create-app-runtime';
import type { RuntimeReadinessSnapshot } from './runtime/readiness';
import type { SwUpdateHandle } from './runtime/sw-client';
import { AboutView } from './ui/about/AboutView';
import { AccountsView } from './ui/accounts/AccountsView';
import { AppShell, type NavTab } from './ui/shell/AppShell';
import { OnboardingScreen } from './ui/shell/OnboardingScreen';
import { ReadinessScreen } from './ui/shell/ReadinessScreen';
import type { WorkspaceStatusResult, WorkspaceStatusSnapshot } from './workspace/workspace';

type AppScreenState =
  | { readonly kind: 'Loading' }
  | { readonly kind: 'Unsupported'; readonly readiness: RuntimeReadinessSnapshot | null; readonly reason?: string }
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
  const [stagedUpdate, setStagedUpdate] = useState<SwUpdateHandle | null>(null);
  const [accountsDirty, setAccountsDirty] = useState(false);
  const [aboutDirty, setAboutDirty] = useState(false);
  const [durabilityBusy, setDurabilityBusy] = useState(false);

  const hasUnsavedChanges = accountsDirty || aboutDirty;

  const bootOrRefresh = useCallback(async () => {
    const seq = ++bootSeqRef.current;
    setScreen({ kind: 'Loading' });
    try {
      await runtime.registerServiceWorker((handle) => {
        setStagedUpdate(handle);
      });
      await runtime.workspace.initialize({});
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

  // Re-evaluates Runtime Readiness in place without unmounting AppShell / losing unsaved drafts
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
    <AppShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      workspaceStatus={screen.workspaceStatus}
      recoveryOnly={screen.recoveryOnly}
      hasUnsavedChanges={hasUnsavedChanges}
      stagedUpdate={stagedUpdate}
      onRequestDurability={() => {
        void handleRequestDurability();
      }}
      durabilityBusy={durabilityBusy}
    >
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
  );
}
