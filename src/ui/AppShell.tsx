import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Link,
  matchPath,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router";
import type { UiFacade } from "../app/compose.ts";
import type { MigrationBlocked } from "../app/types.ts";
import type {
  ReadinessFailure,
  RuntimeNotWritable,
} from "../delivery/runtime-not-writable.ts";
import { isRouteInstalled, ROUTES } from "../app/routes.ts";
import { explainFailure, explainMigrationIssue } from "./readiness-copy.ts";
import { AboutIcon, AccountsIcon, NewPlanIcon, TradesIcon } from "./icons.tsx";
import { RuntimeContext } from "./runtime.tsx";
import { FirstRun } from "./screens/FirstRun.tsx";
import { OnboardingAccount } from "./screens/OnboardingAccount.tsx";

type Status = Awaited<ReturnType<UiFacade["Workspace"]["getStatus"]>>;

export type RouteId = (typeof ROUTES)[number]["id"];
export type Screens = Readonly<Record<RouteId, ComponentType>>;

export interface AppShellProps {
  readonly facade: UiFacade;
  readonly screens: Screens;
  // Shown above every screen, such as the update notice.
  readonly notices?: ReactNode;
  // Retrying re-launches the app, which re-establishes Runtime Readiness.
  readonly onRetry?: () => void;
}

// Wide layout from this viewport width (D1 A7).
export const WIDE_LAYOUT_MIN_WIDTH = 960;

// A13: until backup exists (D8), Recovery Only explains why another browser is no way out.
const SEPARATE_STORAGE =
  "Another browser has its own separate storage and would start an empty journal. Moving a journal between browsers needs a verified backup and Restore, which this release does not offer yet.";

// Follows the live viewport width; only the navigation's placement changes, never the tree
// that holds the routed screen, so a resize keeps every entered value.
function useWide(): boolean {
  const [wide, setWide] = useState(
    () => window.innerWidth >= WIDE_LAYOUT_MIN_WIDTH,
  );
  useEffect(() => {
    const update = () => setWide(window.innerWidth >= WIDE_LAYOUT_MIN_WIDTH);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return wide;
}

const NAV_ICONS: Partial<Record<RouteId, ComponentType>> = {
  trades: TradesIcon,
  "new-plan": NewPlanIcon,
  accounts: AccountsIcon,
  about: AboutIcon,
};

// The primary-navigation destination a location belongs to: a Trade's own pages sit under Trades.
function navigationOwner(pathname: string): RouteId | undefined {
  const route = ROUTES.find((candidate) =>
    matchPath({ path: candidate.path, end: true }, pathname),
  );
  return route?.id === "trade-detail" || route?.id === "record-entry"
    ? "trades"
    : route?.id;
}

// The application shell: nothing is offered until Runtime Readiness has been established.
// The route filter drops the write route when not Writable, so the fallback takes its path from ROUTES.
const RECORD_ENTRY_PATH = ROUTES.find(
  (route) => route.id === "record-entry",
)!.path;

// A direct link to the entry form while this browser can't save: say so instead of a blank view.
function RecordEntryUnavailable() {
  const { tradeId } = useParams();
  return (
    <section className="card">
      <h1>Record entry isn't available</h1>
      <p>This browser can't save right now, so an entry can't be recorded.</p>
      <Link to={`/trades/${tradeId}`}>Back to the Trade</Link>
    </section>
  );
}

export function AppShell({
  facade,
  screens,
  notices,
  onRetry = () => window.location.reload(),
}: AppShellProps) {
  const [status, setStatus] = useState<Status | undefined>();
  const wide = useWide();
  // A refusal from a mutation during the session, which overrides the launch status.
  const [refusal, setRefusal] = useState<RuntimeNotWritable | undefined>();
  // Where the refusal arrived, so the form open there keeps its values (see `routes` below).
  const { pathname } = useLocation();
  const [refusedAt, setRefusedAt] = useState<string | undefined>();
  // The honest outcome of the trader's explicit durability request, if any.
  const [durability, setDurability] = useState<
    Awaited<ReturnType<UiFacade["Workspace"]["requestDurability"]>> | undefined
  >();
  // While initialize converts an older stored schema (D2 A31).
  const [migrating, setMigrating] = useState(false);
  // The last conversion attempt's failure: the old data is unchanged and nothing is Ready.
  const [blocked, setBlocked] = useState<
    Pick<MigrationBlocked, "stage" | "issues"> | undefined
  >();

  // Retry is calling initialize again, which reruns the migration.
  const migrate = useCallback(() => {
    setMigrating(true);
    void facade.Workspace.initialize({}).then(
      (result) => {
        setMigrating(false);
        setBlocked(result.kind === "MigrationBlocked" ? result : undefined);
        if (result.kind === "Opened") setStatus(result.status);
        // Any other outcome (readiness changed meanwhile): show what the Workspace now reports.
        else if (result.kind !== "MigrationBlocked")
          void facade.Workspace.getStatus().then(setStatus);
      },
      // An unexpected failure: show what the Workspace now reports, never the updating message.
      () => {
        setMigrating(false);
        void facade.Workspace.getStatus().then(setStatus);
      },
    );
  }, [facade]);

  useEffect(() => {
    let current = true;
    void facade.Workspace.getStatus().then((next) => {
      if (!current) return;
      setStatus(next);
      // An older schema under Writable readiness: this launch migrates it (D2 P6).
      if (
        next.kind === "IntegrityBlocked" &&
        next.reason === "AwaitingMigration" &&
        next.readiness.outcome === "Writable"
      ) {
        migrate();
      }
    });
    return () => {
      current = false;
    };
  }, [facade, migrate]);

  // The open form is exempt only while the trader stays on the path where the refusal arrived.
  if (refusedAt !== undefined && pathname !== refusedAt)
    setRefusedAt(undefined);

  if (!status) {
    return (
      <main className="startup">
        <p role="status">
          Checking that this browser can safely store your journal…
        </p>
      </main>
    );
  }
  if (migrating) {
    return (
      <main className="startup">
        <p role="status">Updating your journal to this release…</p>
      </main>
    );
  }
  const failedMigration =
    blocked ?? (status.kind === "MigrationBlocked" ? status : undefined);
  if (failedMigration) {
    return (
      <main className="gate">
        <h1>Your journal could not be converted to this release</h1>
        <p>
          {failedMigration.stage === "Activate"
            ? "The conversion could not finish, so the converted copy was discarded:"
            : "Checking the converted copy found these problems, so it was discarded:"}
        </p>
        <ul>
          {failedMigration.issues.map((issue, index) => (
            <li key={index}>{explainMigrationIssue(issue)}</li>
          ))}
        </ul>
        <p>Your data is unchanged.</p>
        <button type="button" className="pill primary" onClick={migrate}>
          Retry
        </button>
      </main>
    );
  }
  if (status.kind === "Unsupported") {
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

  // An older journal this release converts only under Writable readiness (D2 P6): never empty.
  if (
    status.kind === "IntegrityBlocked" &&
    status.reason === "AwaitingMigration"
  ) {
    return (
      <main className="gate">
        <h1>This release must convert your journal before you can use it</h1>
        <p>
          Your journal was saved by an earlier release. This release converts
          your journal once this browser passes its safety checks, and these
          checks failed:
        </p>
        <ul>
          {status.failedChecks.map((failure) => (
            <li key={failure.check}>{explainFailure(failure)}</li>
          ))}
        </ul>
        <p>Your journal data is unchanged. Retry once the problem is fixed.</p>
        <button type="button" className="pill primary" onClick={onRetry}>
          Retry
        </button>
      </main>
    );
  }
  if (status.kind === "IntegrityBlocked") {
    return (
      <main className="gate">
        <h1>Your journal data may already exist here, but it can't be read</h1>
        <p>
          Existing journal storage in this browser could not be read or checked
          safely. To protect it, nothing will be created, imported, or
          overwritten. Retry once the problem is fixed.
        </p>
        <button type="button" className="pill primary" onClick={onRetry}>
          Retry
        </button>
      </main>
    );
  }

  // Shown wherever data can be saved, first run and onboarding included (ADR 0009).
  const protectionWarning = (
    <>
      {durability && durability.kind !== "NotImproved" && (
        <p className="banner notice" role="status">
          The browser will now keep your journal data unless you clear it.
        </p>
      )}
      {status.protection !== "Protected" &&
        (!durability || durability.kind === "NotImproved") && (
          <section
            className="banner warning durability"
            aria-label="Storage protection"
          >
            <div className="banner-text">
              <p>
                This browser may clear your journal data, for example when the
                device is low on space. It has not promised to keep it.
              </p>
              {durability?.kind === "NotImproved" && (
                <p role="status">
                  {durability.currentProtection.kind === "BestEffort"
                    ? "The browser declined to promise it will keep your data. You can keep using the journal."
                    : "This browser offers no way to ask it to keep data."}
                </p>
              )}
            </div>
            {status.protection === "BestEffort" && !durability && (
              <button
                type="button"
                className="pill secondary"
                onClick={() =>
                  void facade.Workspace.requestDurability().then(setDurability)
                }
              >
                Ask the browser to keep data
              </button>
            )}
          </section>
        )}
    </>
  );

  if (status.kind === "InitializationRequired") {
    return (
      <>
        {protectionWarning}
        <FirstRun facade={facade} onOpened={setStatus} />
      </>
    );
  }

  // A selectable Account comes first: nothing else is offered until onboarding completes.
  if (
    status.kind === "Ready" &&
    status.onboarding === "NeedsInstitutionAndAccount"
  ) {
    return (
      <>
        {protectionWarning}
        <OnboardingAccount
          facade={facade}
          onReady={() =>
            setStatus({ ...status, onboarding: "ReadyForTradePlanning" })
          }
        />
      </>
    );
  }

  const launchedWritable = status.kind === "Ready";
  const writable = launchedWritable && !refusal;
  const failedChecks: readonly ReadinessFailure[] =
    refusal?.failedChecks ??
    (status.kind === "RecoveryOnly" ? status.failedChecks : []);
  // Routes stay those of the launch, so an open form keeps its values when writing stops.
  // Only destinations whose capabilities are all installed are reachable (AC-CAP-001).
  const routes = ROUTES.filter(
    (route) =>
      isRouteInstalled(route, facade.capabilities.operations) &&
      (launchedWritable || route.readOnly),
  );
  const navigation = routes.filter(
    (route) => route.navigation && (writable || route.readOnly),
  );
  const superseded = failedChecks.some(
    (failure) => failure.reason === "SessionSuperseded",
  );
  const report = (result: { readonly kind: string }) => {
    if (result.kind === "RuntimeNotWritable") {
      setRefusal(result as RuntimeNotWritable);
      setRefusedAt((at) => at ?? pathname);
    }
  };

  return (
    <RuntimeContext.Provider
      value={{
        writable,
        report,
        timeZone: "timeZone" in status ? status.timeZone : undefined,
      }}
    >
      <div className="shell" data-layout={wide ? "wide" : "narrow"}>
        {notices}
        {superseded && (
          <section
            className="banner warning"
            aria-labelledby="superseded-heading"
          >
            <h2 id="superseded-heading">
              Updated in another tab: reload when ready
            </h2>
            <p>
              This tab can't save any more. What you entered stays on screen
              until you reload.
            </p>
            <button type="button" className="pill primary" onClick={onRetry}>
              Reload
            </button>
          </section>
        )}
        {!writable && !superseded && (
          <section
            className="banner warning"
            aria-labelledby="recovery-heading"
          >
            <h2 id="recovery-heading">
              Read only: this browser can't save right now
            </h2>
            <p>
              Your journal is readable, but nothing can be saved here until
              these problems are fixed:
            </p>
            <ul>
              {failedChecks.map((failure) => (
                <li key={failure.check}>{explainFailure(failure)}</li>
              ))}
            </ul>
            <p>{SEPARATE_STORAGE}</p>
          </section>
        )}
        {protectionWarning}
        <main className="content">
          <Routes>
            {routes.map((route) => {
              const Screen = screens[route.id];
              // The entry form stays only where it was open when writing stopped; reaching it afterwards,
              // or by a direct link while not Writable, shows why it is unavailable.
              const element =
                route.id === "record-entry" &&
                !writable &&
                pathname !== refusedAt ? (
                  <RecordEntryUnavailable />
                ) : (
                  <Screen />
                );
              return (
                <Route key={route.id} path={route.path} element={element} />
              );
            })}
            {!launchedWritable && (
              <Route
                path={RECORD_ENTRY_PATH}
                element={<RecordEntryUnavailable />}
              />
            )}
          </Routes>
        </main>
        <nav
          aria-label="Primary"
          className="nav"
          data-placement={wide ? "sidebar" : "bottom"}
        >
          {wide && <span className="wordmark">Trade Journal</span>}
          {navigation.map((route) => {
            const NavIcon = NAV_ICONS[route.id];
            return (
              <Link
                key={route.id}
                to={route.path}
                aria-current={
                  navigationOwner(pathname) === route.id ? "page" : undefined
                }
              >
                {NavIcon && <NavIcon />}
                {route.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </RuntimeContext.Provider>
  );
}
