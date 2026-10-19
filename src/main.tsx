import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { createApplication } from './app/compose.ts';
import { randomIds, systemClock } from './app/system.ts';
import { browserHost } from './delivery/browser-host.ts';
import { CAPACITY_REQUIREMENT } from './delivery/capacity.ts';
import { RELEASE_ID } from './delivery/release-identity.ts';
import { AppShell, type Screens } from './ui/AppShell.tsx';
import { useRuntime } from './ui/runtime.tsx';
import { AboutView } from './ui/screens/AboutView.tsx';
import { AccountsView } from './ui/screens/AccountsView.tsx';
import { PlanForm } from './ui/screens/PlanForm.tsx';
import { TradeDetail } from './ui/screens/TradeDetail.tsx';
import { TradeList } from './ui/screens/TradeList.tsx';
import { createReleaseUpdateController } from './ui/update/controller.ts';
import { UpdateNotice } from './ui/update/UpdateNotice.tsx';
import './ui/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
root.dataset.release = RELEASE_ID;

async function start(container: HTMLElement) {
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

  const app = await createApplication({
    indexedDB: window.indexedDB,
    host: browserHost(),
    clock: systemClock,
    ids: randomIds,
    releaseId: RELEASE_ID,
    capacityRequirement: CAPACITY_REQUIREMENT,
  });
  const facade = {
    Workspace: app.Workspace,
    ReferenceCatalog: app.ReferenceCatalog,
    Journal: app.Journal,
    TradeWorkflows: app.TradeWorkflows,
    TradeViewsAndReporting: app.TradeViewsAndReporting,
    capabilities: app.capabilities,
  };
  const useZone = () => useRuntime().timeZone ?? 'UTC';
  const now = () => systemClock.now();
  const setUnsaved = (unsaved: boolean) => updates.setUnsaved(unsaved);
  const screens: Screens = {
    trades: function Trades() {
      return <TradeList facade={facade} timeZone={useZone()} />;
    },
    'trade-detail': function Detail() {
      return <TradeDetail facade={facade} timeZone={useZone()} />;
    },
    'new-plan': function NewPlan() {
      return <PlanForm facade={facade} timeZone={useZone()} now={now} onDirtyChange={setUnsaved} />;
    },
    accounts: () => <AccountsView facade={facade} />,
    about: () => <AboutView facade={facade} updates={updates} />,
    start: () => null,
  };
  createRoot(container).render(
    <StrictMode>
      <BrowserRouter>
        <AppShell facade={facade} screens={screens} notices={<UpdateNotice controller={updates} />} />
      </BrowserRouter>
    </StrictMode>,
  );
}

void start(root);
