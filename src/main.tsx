import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router';
import { createApplication } from './app/compose.ts';
import { createPostRestore } from './app/post-restore.ts';
import { createWebLocksLifecycleLock } from './persistence/index.ts';
import { randomIds, systemClock } from './app/system.ts';
import { browserDownload, browserExportPort, browserFileSelection, browserHost } from './delivery/browser-host.ts';
import { CAPACITY_REQUIREMENT } from './delivery/capacity.ts';
import { RELEASE_ID } from './delivery/release-identity.ts';
import { AppShell, type Screens } from './ui/AppShell.tsx';
import { useRuntime } from './ui/runtime.tsx';
import type { WorkspaceReplaced } from './app/types.ts';
import type { BackupFacade } from './ui/backup/facade.ts';
import { BackupView } from './ui/backup/BackupView.tsx';
import { AboutView } from './ui/screens/AboutView.tsx';
import { AccountsView } from './ui/screens/AccountsView.tsx';
import { PlanForm } from './ui/screens/PlanForm.tsx';
import { ExpirationForm } from './ui/screens/ExpirationForm.tsx';
import { PositionChangeForm } from './ui/screens/PositionChangeForm.tsx';
import { ReviewView } from './ui/screens/ReviewView.tsx';
import { TradeDetail } from './ui/screens/TradeDetail.tsx';
import { TradeList } from './ui/screens/TradeList.tsx';
import { createReleaseUpdateController } from './ui/update/controller.ts';
import { UpdateNotice } from './ui/update/UpdateNotice.tsx';
import './ui/app.css';
import './ui/cockpit/styles/legacy-detail.css';
import './ui/cockpit/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
root.dataset.release = RELEASE_ID;

async function start(container: HTMLElement) {
  // Only the bench build (D2 T2.20) installs the dataset generator; production builds drop this branch.
  if (import.meta.env.MODE === 'bench') (await import('./app/bench-generator.ts')).installBenchGenerator();
  const registration = await navigator.serviceWorker.register('/sw.js');
  const updates = createReleaseUpdateController({
    registration,
    container: navigator.serviceWorker,
    channel: new BroadcastChannel('tj-updates'),
    reload: () => window.location.reload(),
  });
  window.addEventListener('pagehide', () => updates.dispose());
  // A newer release installs and verifies itself, then waits: watch it reach that state.
  registration.addEventListener('updatefound', () => {
    registration.installing?.addEventListener('statechange', () => {
      if (registration.waiting) registration.dispatchEvent(new Event('updatefound'));
    });
  });

  // Only the faults build (T1.27, T2.16) reaches the fault hooks; production builds drop this branch.
  const faults = import.meta.env.MODE === 'faults' ? await import('./delivery/faults.ts') : undefined;
  const host = faults ? faults.faultyHost(browserHost()) : browserHost();
  const clock = faults ? faults.pinnedClock(window.location.search, systemClock) : systemClock;
  const app = await createApplication({
    indexedDB: window.indexedDB,
    host,
    clock,
    ids: randomIds,
    releaseId: RELEASE_ID,
    capacityRequirement: CAPACITY_REQUIREMENT,
    locks: createWebLocksLifecycleLock(navigator.locks),
    migrationHooks: faults?.migrationFaults(),
    restoreHooks: faults?.restoreFaults(),
    exportPort: faults ? faults.faultyExportPort(browserExportPort(), window.indexedDB) : browserExportPort(),
    download: browserDownload(),
    fileSelection: browserFileSelection(),
  });
  const facade = {
    Workspace: app.Workspace,
    ReferenceCatalog: app.ReferenceCatalog,
    Journal: app.Journal,
    TradeWorkflows: app.TradeWorkflows,
    TradeViewsAndReporting: app.TradeViewsAndReporting,
    MarketData: app.MarketData,
    DailyReview: app.DailyReview,
    capabilities: app.capabilities,
  };
  const selectFile = browserFileSelection();
  // A Restore this tab applies broadcasts WorkspaceReplaced to every channel of that name, this tab's own
  // included, and this tab already shows its own Restore complete: it must not report itself replaced.
  // After a Restore the shell's launch status is out of date (first run most of all, since RestoreFlow has
  // no completion callback), so the shell is rebuilt when the trader leaves the Restore complete summary.
  const postRestore = createPostRestore();
  const backup: BackupFacade = {
    exportBackup: (request) => app.Workspace.exportBackup(request),
    confirmBackup: (request) => app.Workspace.confirmBackup(request),
    prepareRestore: (request) => app.Workspace.prepareRestore(request),
    applyPreparedRestore: (request) => postRestore.apply(() => app.Workspace.applyPreparedRestore(request)),
  };
  // Another tab's Restore (D8 A136): the channel also carries the update notice's messages, which have no `kind`.
  const replacedChannel = new BroadcastChannel('tj-updates');
  // A foreign replacement is terminal for this tab, so postRestore remembers it and tells whoever is subscribed
  // now, or subscribes later (a shell remounted after a rebuild, or after a route change).
  replacedChannel.addEventListener('message', (event: MessageEvent<unknown>) => {
    const message = event.data as Partial<WorkspaceReplaced> | null;
    if (message?.kind !== 'WorkspaceReplaced' || typeof message.databaseName !== 'string') return;
    postRestore.hearReplacement(message.databaseName);
  });
  const onWorkspaceReplaced = (listener: (message: WorkspaceReplaced) => void) =>
    postRestore.subscribeReplaced((databaseName) => listener({ kind: 'WorkspaceReplaced', databaseName }));
  const useZone = () => useRuntime().timeZone ?? 'UTC';
  const now = () => clock.now();
  const setUnsaved = (unsaved: boolean) => updates.setUnsaved(unsaved);
  const screens: Screens = {
    trades: function Trades() {
      return <TradeList facade={facade} />;
    },
    'trade-detail': function Detail() {
      return <TradeDetail facade={facade} timeZone={useZone()} onDirtyChange={setUnsaved} />;
    },
    'record-entry': function RecordEntry() {
      return <PositionChangeForm facade={facade} timeZone={useZone()} now={now} onDirtyChange={setUnsaved} />;
    },
    'record-expiration': function RecordExpiration() {
      return <ExpirationForm facade={facade} timeZone={useZone()} onDirtyChange={setUnsaved} />;
    },
    'new-plan': function NewPlan() {
      return <PlanForm facade={facade} timeZone={useZone()} now={now} onDirtyChange={setUnsaved} />;
    },
    review: function Review() {
      return <ReviewView facade={facade} now={now} onDirtyChange={setUnsaved} />;
    },
    accounts: () => <AccountsView facade={facade} />,
    about: () => <AboutView facade={facade} updates={updates} />,
    backup: function BackupPage() {
      const { writable, timeZone } = useRuntime();
      // Recovery Only (and any other state that cannot save) replaces Restore with the failed checks (A144).
      // The Restore complete summary stays up, with the shell already Recovery Only, until the trader leaves it.
      const readiness = writable || postRestore.summaryShowing() ? ({ kind: 'Writable' } as const) : ({ kind: 'RecoveryOnly', failedChecks: app.session.current().failures } as const);
      return <BackupView facade={backup} selectFile={selectFile} readiness={readiness} timeZone={timeZone ?? 'UTC'} />;
    },
    start: () => null,
  };
  function Shell() {
    const [generation, setGeneration] = useState(0);
    const { pathname } = useLocation();
    useEffect(() => postRestore.observePath(pathname, () => setGeneration((n) => n + 1)), [pathname]);
    return (
      <AppShell
        key={generation}
        facade={facade}
        screens={screens}
        notices={<UpdateNotice controller={updates} />}
        backup={backup}
        selectFile={selectFile}
        onWorkspaceReplaced={onWorkspaceReplaced}
      />
    );
  }
  createRoot(container).render(
    <StrictMode>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </StrictMode>,
  );
}

void start(root);
