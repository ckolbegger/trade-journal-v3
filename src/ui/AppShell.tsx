import { useEffect, useState, type ComponentType } from 'react';
import { Link, Route, Routes } from 'react-router';
import type { UiFacade } from '../app/compose.ts';
import type { ReadinessFailure, RuntimeNotWritable } from '../delivery/runtime-not-writable.ts';
import { ROUTES } from '../app/routes.ts';
import { explainFailure } from './readiness-copy.ts';
import { RuntimeContext } from './runtime.tsx';
import { FirstRun } from './screens/FirstRun.tsx';
import { OnboardingAccount } from './screens/OnboardingAccount.tsx';

type Status = Awaited<ReturnType<UiFacade['Workspace']['getStatus']>>;

export type RouteId = (typeof ROUTES)[number]['id'];
export type Screens = Readonly<Record<RouteId, ComponentType>>;

export interface AppShellProps {
  readonly facade: UiFacade;
  readonly screens: Screens;
  // Retrying re-launches the app, which re-establishes Runtime Readiness.
  readonly onRetry?: () => void;
}

// Wide layout from this viewport width (D1 A7).
export const WIDE_LAYOUT_MIN_WIDTH = 960;

// A13: until backup exists (D8), Recovery Only explains why another browser is no way out.
const SEPARATE_STORAGE =
  'Another browser has its own separate storage and would start an empty journal. Moving a journal between browsers needs a verified backup and Restore, which this release does not offer yet.';

// Follows the live viewport width; only the navigation's placement changes, never the tree
// that holds the routed screen, so a resize keeps every entered value.
function useWide(): boolean {
  const [wide, setWide] = useState(() => window.innerWidth >= WIDE_LAYOUT_MIN_WIDTH);
  useEffect(() => {
    const update = () => setWide(window.innerWidth >= WIDE_LAYOUT_MIN_WIDTH);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return wide;
}

// The application shell: nothing is offered until Runtime Readiness has been established.
export function AppShell({ facade, screens, onRetry = () => window.location.reload() }: AppShellProps) {
  const [status, setStatus] = useState<Status | undefined>();
  const wide = useWide();
  // A refusal from a mutation during the session, which overrides the launch status.
  const [refusal, setRefusal] = useState<RuntimeNotWritable | undefined>();
  // The honest outcome of the trader's explicit durability request, if any.
  const [durability, setDurability] = useState<Awaited<ReturnType<UiFacade['Workspace']['requestDurability']>> | undefined>();

  useEffect(() => {
    let current = true;
    void facade.Workspace.getStatus().then((next) => {
      if (current) setStatus(next);
    });
    return () => {
      current = false;
    };
  }, [facade]);

  if (!status) {
    return (
      <main className="startup">
        <p role="status">Checking that this browser can safely store your journal…</p>
      </main>
    );
  }
  if (status.kind === 'Unsupported') {
    return (
      <main className="gate">
        <h1>This browser can't safely store your journal</h1>
        <p>The app will not risk new journal data here. These checks failed:</p>
        <ul>
          {status.failedChecks.map((failure) => (
            <li key={failure.check}>{explainFailure(failure)}</li>
          ))}
        </ul>
        <p>You can retry once the problem is fixed, or try another browser.</p>
        <button type="button" className="pill primary" onClick={onRetry}>
          Retry
        </button>
      </main>
    );
  }

  if (status.kind === 'IntegrityBlocked') {
    return (
      <main className="gate">
        <h1>Your journal data may already exist here, but it can't be read</h1>
        <p>
          Existing journal storage in this browser could not be read or checked safely. To protect it, nothing will be
          created, imported, or overwritten. Retry once the problem is fixed.
        </p>
        <button type="button" className="pill primary" onClick={onRetry}>
          Retry
        </button>
      </main>
    );
  }

  if (status.kind === 'InitializationRequired') return <FirstRun facade={facade} onOpened={setStatus} />;

  // A selectable Account comes first: nothing else is offered until onboarding completes.
  if (status.kind === 'Ready' && status.onboarding === 'NeedsInstitutionAndAccount') {
    return <OnboardingAccount facade={facade} onReady={() => setStatus({ ...status, onboarding: 'ReadyForTradePlanning' })} />;
  }

  const launchedWritable = status.kind === 'Ready';
  const writable = launchedWritable && !refusal;
  const failedChecks: readonly ReadinessFailure[] = refusal?.failedChecks ?? (status.kind === 'RecoveryOnly' ? status.failedChecks : []);
  // Routes stay those of the launch, so an open form keeps its values when writing stops.
  // Only destinations whose capabilities are all installed are reachable (AC-CAP-001).
  const installed = new Set(Object.keys(facade.capabilities.operations));
  const routes = ROUTES.filter((route) => route.requires.every((op) => installed.has(op)) && (launchedWritable || route.readOnly));
  const navigation = routes.filter((route) => route.navigation && (writable || route.readOnly));
  const superseded = failedChecks.some((failure) => failure.reason === 'SessionSuperseded');
  const report = (result: { readonly kind: string }) => {
    if (result.kind === 'RuntimeNotWritable') setRefusal(result as RuntimeNotWritable);
  };

  return (
    <RuntimeContext.Provider value={{ writable, report }}>
      <div className="shell" data-layout={wide ? 'wide' : 'narrow'}>
        {superseded && (
          <section className="banner warning" aria-labelledby="superseded-heading">
            <h2 id="superseded-heading">Updated in another tab: reload when ready</h2>
            <p>This tab can't save any more. What you entered stays on screen until you reload.</p>
            <button type="button" className="pill primary" onClick={onRetry}>
              Reload
            </button>
          </section>
        )}
        {!writable && !superseded && (
          <section className="banner warning" aria-labelledby="recovery-heading">
            <h2 id="recovery-heading">Read only: this browser can't save right now</h2>
            <p>Your journal is readable, but nothing can be saved here until these problems are fixed:</p>
            <ul>
              {failedChecks.map((failure) => (
                <li key={failure.check}>{explainFailure(failure)}</li>
              ))}
            </ul>
            <p>{SEPARATE_STORAGE}</p>
          </section>
        )}
        {durability && durability.kind !== 'NotImproved' && (
          <p className="banner notice" role="status">
            The browser will now keep your journal data unless you clear it.
          </p>
        )}
        {status.protection !== 'Protected' && (!durability || durability.kind === 'NotImproved') && (
          <section className="banner notice" aria-label="Storage protection">
            <p>
              This browser may clear your journal data, for example when the device is low on space. It has not
              promised to keep it.
            </p>
            {durability?.kind === 'NotImproved' && (
              <p role="status">
                {durability.currentProtection.kind === 'BestEffort'
                  ? 'The browser declined to promise it will keep your data. You can keep using the journal.'
                  : 'This browser offers no way to ask it to keep data.'}
              </p>
            )}
            {status.protection === 'BestEffort' && !durability && (
              <button type="button" className="pill secondary" onClick={() => void facade.Workspace.requestDurability().then(setDurability)}>
                Ask the browser to keep data
              </button>
            )}
          </section>
        )}
        <main className="content">
          <Routes>
            {routes.map((route) => {
              const Screen = screens[route.id];
              return <Route key={route.id} path={route.path} element={<Screen />} />;
            })}
          </Routes>
        </main>
        <nav aria-label="Primary" className="nav" data-placement={wide ? 'sidebar' : 'bottom'}>
          {navigation.map((route) => (
            <Link key={route.id} to={route.path}>
              {route.label}
            </Link>
          ))}
        </nav>
      </div>
    </RuntimeContext.Provider>
  );
}
