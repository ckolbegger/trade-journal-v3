import {
  useCallback,
  useEffect,
  useRef,
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
import type {
  BackupSafeAction,
  ExportBackupResult,
  FileSelectionPort,
  MigrationBlocked,
  WorkspaceReplaced,
} from "../app/types.ts";
import type { BackupFacade } from "./backup/facade.ts";
import type {
  ReadinessFailure,
  RuntimeNotWritable,
} from "../delivery/runtime-not-writable.ts";
import { isRouteInstalled, ROUTES, type RouteDefinition } from "../app/routes.ts";
import { toWorkspaceLocal } from "../domain/time/index.ts";
import { explainFailure, explainMigrationIssue } from "./readiness-copy.ts";
import {
  AboutIcon,
  AccountsIcon,
  NewPlanIcon,
  ReviewIcon,
  TradesIcon,
} from "./icons.tsx";
import { RuntimeContext, type Durability } from "./runtime.tsx";
import { PageTitle } from "./PageTitle.tsx";
import { StorageProtectionCard } from "./StorageProtectionCard.tsx";
import { FirstRun } from "./screens/FirstRun.tsx";
import { OnboardingAccount } from "./screens/OnboardingAccount.tsx";

type Status = Awaited<ReturnType<UiFacade["Workspace"]["getStatus"]>>;

export type RouteId = (typeof ROUTES)[number]["id"];
// The Backup page is optional until the release that serves backup is composed (D8 T8.11): without
// its screen the shell offers no Backup destination.
export type Screens = Readonly<Record<Exclude<RouteId, "backup">, ComponentType>> & {
  readonly backup?: ComponentType;
};

export interface AppShellProps {
  readonly facade: UiFacade;
  readonly screens: Screens;
  // Shown above every screen, such as the update notice.
  readonly notices?: ReactNode;
  // Retrying re-launches the app, which re-establishes Runtime Readiness.
  readonly onRetry?: () => void;
  // The backup operations and file selection (D8): Download a copy and Verify on the blocked views.
  // Absent until the release that serves backup is composed (T8.11).
  readonly backup?: BackupFacade;
  readonly selectFile?: FileSelectionPort;
  // Subscribes to the notice another tab broadcasts after a Restore activates (D8 A136, over the
  // channel D1 A5 uses); returns the unsubscribe. T8.11 wires the BroadcastChannel to it.
  readonly onWorkspaceReplaced?: (listener: (message: WorkspaceReplaced) => void) => () => void;
}

// Wide layout from this viewport width (D1 A7).
export const WIDE_LAYOUT_MIN_WIDTH = 960;

// A143 (replacing D1 A13): Recovery Only explains why another browser is no way out, and what is.
const SEPARATE_STORAGE =
  "Another browser has its own separate storage and would start an empty journal. To move this journal, download a backup here and verify it, then restore it in a browser that can save safely.";

// The copy before backup existed (D1 A13), kept for a release that composes no Backup page.
const SEPARATE_STORAGE_NO_BACKUP =
  "Another browser has its own separate storage and would start an empty journal. Moving a journal between browsers needs a verified backup and Restore, which this release does not offer yet.";

// P32: a copy made while this release can't confirm it never claims a backup.
const UNCONFIRMED_COPY = "This release can't confirm the copy until your journal has been updated.";

// The Backup page's words (A141, approved 2026-11-14), defined here until T8.11 unifies them with
// the page's own.
const NOT_COMPLETED = {
  ReadFailed: "The backup could not be made. Your journal couldn't be read. Nothing was changed.",
  OfferFailed: "The backup could not be made. Your browser didn't accept the download. Nothing was changed.",
  IntegrityBlocked:
    "The backup could not be made. Your journal has a problem that blocks a normal backup. Nothing was changed.",
  Conflict:
    "The backup could not be made. Your journal changed while the backup was being made. Nothing was changed.",
} as const;
const NOT_VERIFIED = {
  Unreadable: "This file couldn't be read. Choose the file you just downloaded.",
  IncompleteOrCorrupt: "This file is incomplete or damaged, so it isn't a usable backup.",
  DifferentArtifact: "This is a different backup from the one you just downloaded.",
} as const;

type DownloadedBackup = Extract<ExportBackupResult, { kind: "Downloaded" }>;

// Download a copy and Verify on a blocked view (D8 P32). The Downloaded result lives only in this
// view's state and is what Verify checks the saved file against (A141).
function BlockedBackupActions({
  backup,
  selectFile,
  actions,
}: {
  readonly backup: BackupFacade;
  readonly selectFile: FileSelectionPort;
  readonly actions: readonly BackupSafeAction[];
}) {
  const [downloaded, setDownloaded] = useState<DownloadedBackup | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  // The last verification completed: the Downloaded line gives way to "Backup complete".
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const canDownload = actions.includes("DownloadCopy");
  const canVerify = actions.includes("VerifyBackup");
  if (!canDownload && !canVerify) return null;

  const download = () => {
    setBusy(true);
    setMessage(undefined);
    void backup
      .exportBackup({})
      .then((result) => {
        if (result.kind === "Downloaded") {
          setDownloaded(result);
          setVerified(false);
        } else
          setMessage(
            result.kind === "NotCompleted" ? NOT_COMPLETED[result.reason] : NOT_COMPLETED.Conflict,
          );
      })
      .catch(() => setMessage(NOT_COMPLETED.ReadFailed))
      .finally(() => setBusy(false));
  };
  const verify = () => {
    if (!downloaded) return;
    setBusy(true);
    void selectFile
      .choose()
      .then(async (chosen) => {
        if (chosen.kind !== "Chosen") return;
        const result = await backup.confirmBackup({
          file: chosen.file,
          expectedBinding: downloaded.sourceBinding,
          expectedFullDigest: downloaded.fullDigest,
        });
        setVerified(result.kind === "Completed");
        setMessage(result.kind === "Completed" ? "Backup complete" : NOT_VERIFIED[result.reason]);
      })
      .catch(() => {
        setVerified(false);
        setMessage(NOT_VERIFIED.Unreadable);
      })
      .finally(() => setBusy(false));
  };

  return (
    <section aria-label="Backup">
      {downloaded && !verified && (
        <p role="status">
          Downloaded, not verified yet. This app can't see where your browser saved the file.{" "}
          <span>{downloaded.fileName}</span>
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {canDownload && (
        <button type="button" className="pill secondary" disabled={busy} onClick={download}>
          Download a copy
        </button>
      )}
      {canVerify && (
        <button type="button" className="pill secondary" disabled={busy || !downloaded} onClick={verify}>
          Verify
        </button>
      )}
    </section>
  );
}

// Follows the live viewport width; only the navigation's placement changes, never the tree
// that holds the routed screen, so a resize keeps every entered value.
export function useWide(): boolean {
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

// The Backup icon follows icons.tsx's conventions (one 24px grid, decorative, stroke follows the text).
const BackupIcon = () => (
  <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 4v11M8 11l4 4 4-4" />
    <path d="M4 19h16" />
  </svg>
);

const NAV_ICONS: Partial<Record<RouteId, ComponentType>> = {
  trades: TradesIcon,
  review: ReviewIcon,
  "new-plan": NewPlanIcon,
  accounts: AccountsIcon,
  backup: BackupIcon,
  about: AboutIcon,
};

// The primary-navigation destination a location belongs to: a Trade's own pages sit under Trades.
function navigationOwner(pathname: string): RouteId | undefined {
  const route = ROUTES.find((candidate) =>
    matchPath({ path: candidate.path, end: true }, pathname),
  );
  return route?.id === "trade-detail" || route?.id === "record-entry" || route?.id === "record-expiration"
    ? "trades"
    : route?.id;
}

// The application shell: nothing is offered until Runtime Readiness has been established.
// The route filter drops the write route when not Writable, so the fallback takes its path from ROUTES.
const ABOUT_PATH = ROUTES.find((route) => route.id === "about")!.path;
const RECORD_ENTRY_PATH = ROUTES.find(
  (route) => route.id === "record-entry",
)!.path;

// A direct link to the entry form while this browser can't save: say so instead of a blank view.
function RecordEntryUnavailable() {
  const { tradeId } = useParams();
  return (
    <section className="card">
      <PageTitle>Record entry isn't available</PageTitle>
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
  backup,
  selectFile,
  onWorkspaceReplaced,
}: AppShellProps) {
  const [status, setStatus] = useState<Status | undefined>();
  // Another tab restored a backup over this journal: this tab can't save any more (A136).
  const [replaced, setReplaced] = useState(false);
  const wide = useWide();
  // A refusal from a mutation during the session, which overrides the launch status.
  const [refusal, setRefusal] = useState<RuntimeNotWritable | undefined>();
  // Where the refusal arrived, so the form open there keeps its values (see `routes` below).
  const { pathname } = useLocation();
  const [refusedAt, setRefusedAt] = useState<string | undefined>();
  // A replaced journal keeps the open form too, like a refusal does.
  useEffect(
    () =>
      onWorkspaceReplaced?.(() => {
        setReplaced(true);
        setRefusedAt((at) => at ?? pathname);
      }),
    [onWorkspaceReplaced, pathname],
  );
  // The outcome of the trader's one durability request, shared by every screen that shows the card.
  const [durability, setDurability] = useState<Durability | undefined>();
  // At most one request at a time: the ref guards calls in the same tick, the state disables the buttons.
  const requestPending = useRef(false);
  const [requesting, setRequesting] = useState(false);
  // The last request was rejected: the card says so and the button works again.
  const [requestFailed, setRequestFailed] = useState(false);
  const requestDurability = useCallback(() => {
    if (requestPending.current) return;
    requestPending.current = true;
    setRequesting(true);
    setRequestFailed(false);
    void facade.Workspace
      .requestDurability()
      .then(setDurability, () => setRequestFailed(true))
      .finally(() => {
        requestPending.current = false;
        setRequesting(false);
      });
  }, [facade]);
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
        // A failed conversion too, since the status now names the backup actions it offers (P32).
        else void facade.Workspace.getStatus().then(setStatus);
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
    void facade.Workspace.getStatus().then(async (next) => {
      if (!current) return;
      // An existing Writable Workspace gets any seed this release adds (idempotent), before the first screen reads it.
      if (next.kind === "Ready" && next.readiness.outcome === "Writable") {
        try {
          const opened = await facade.Workspace.initialize({});
          if (!current) return;
          // Not Opened (another tab took the Workspace meanwhile): show what it now reports, not the stale read.
          if (opened.kind === "Opened") setStatus(opened.status);
          else {
            const reread = await facade.Workspace.getStatus();
            if (current) setStatus(reread);
          }
        } catch {
          if (!current) return;
          const reread = await facade.Workspace.getStatus();
          if (current) setStatus(reread);
        }
        return;
      }
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
  // Only the blocked and failed statuses offer backup actions; a Ready status has none (T8.10).
  const backupActions: readonly BackupSafeAction[] =
    ("backupActions" in status ? status.backupActions : undefined) ?? [];
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
        {backup && selectFile && (
          <BlockedBackupActions backup={backup} selectFile={selectFile} actions={backupActions} />
        )}
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
        {backup && selectFile && (
          <>
            {backupActions.includes("DownloadCopy") && <p>{UNCONFIRMED_COPY}</p>}
            <BlockedBackupActions backup={backup} selectFile={selectFile} actions={backupActions} />
          </>
        )}
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

  if (status.kind === "InitializationRequired") {
    return (
      <>
        {/* About is not reachable before a Workspace exists, so the full card stays here. */}
        <StorageProtectionCard
          protection={status.protection}
          durability={durability}
          onRequest={requestDurability}
          requesting={requesting}
          failed={requestFailed}
        />
        <FirstRun
          facade={facade}
          onOpened={setStatus}
          restore={
            backup && selectFile && status.readiness.outcome === "Writable"
              ? { facade: backup, selectFile }
              : undefined
          }
        />
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
        <StorageProtectionCard
          protection={status.protection}
          durability={durability}
          onRequest={requestDurability}
          requesting={requesting}
          failed={requestFailed}
        />
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
  const writable = launchedWritable && !refusal && !replaced;
  const failedChecks: readonly ReadinessFailure[] =
    refusal?.failedChecks ??
    (status.kind === "RecoveryOnly" ? status.failedChecks : []);
  // Routes stay those of the launch, so an open form keeps its values when writing stops.
  // Only destinations whose capabilities are all installed are reachable (AC-CAP-001).
  const routes = ROUTES.filter(
    (route) =>
      isRouteInstalled(route, facade.capabilities.operations) &&
      (route.id !== "backup" || screens.backup !== undefined) &&
      (launchedWritable || route.readOnly),
  );
  const navigation = routes.filter(
    (route) =>
      route.navigation &&
      (writable || route.readOnly) &&
      (wide || (route as RouteDefinition).wideNavigationOnly !== true),
  );
  const superseded = failedChecks.some(
    (failure) => failure.reason === "SessionSuperseded",
  );
  const aboutRoute = routes.find((route) => route.id === "about");
  const storageKept = durability !== undefined && durability.kind !== "NotImproved";
  const showStorageIcon =
    status.protection !== "Protected" && !storageKept && aboutRoute !== undefined;
  // Outside the session policy's coverage no session can be resolved (P8): today is the Workspace-zone date.
  const { coverage } = facade.capabilities.sessionPolicy;
  const today =
    "timeZone" in status
      ? toWorkspaceLocal(status.observedAt, status.timeZone).slice(0, 10)
      : undefined;
  const showCalendarIcon =
    today !== undefined &&
    (today < coverage.first || today > coverage.last) &&
    aboutRoute !== undefined;
  const report = (result: { readonly kind: string }) => {
    if (result.kind === "RuntimeNotWritable") {
      setRefusal(result as RuntimeNotWritable);
      setRefusedAt((at) => at ?? pathname);
    }
    // A Restore whose readiness rerun failed leaves the journal Recovery Only: the summary on screen says so at once.
    const restored = result as { readonly status?: { readonly kind: string; readonly failedChecks?: readonly ReadinessFailure[] } };
    if (result.kind === "Restored" && restored.status?.kind === "RecoveryOnly") {
      setRefusal({ kind: "RuntimeNotWritable", runtimeReadiness: "RecoveryOnly", failedChecks: restored.status.failedChecks ?? [], workspaceStatus: "RecoveryOnly", safeActions: [] });
      setRefusedAt((at) => at ?? pathname);
    }
  };

  return (
    <RuntimeContext.Provider
      value={{
        writable,
        report,
        durability,
        requestDurability,
        requestingDurability: requesting,
        durabilityRequestFailed: requestFailed,
        storageIconTo: showStorageIcon ? ABOUT_PATH : undefined,
        calendarIconTo: showCalendarIcon ? ABOUT_PATH : undefined,
        backupTo: routes.find((route) => route.id === "backup")?.path,
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
        {replaced && (
          <section className="banner warning" role="status">
            <p>
              This journal was replaced by a Restore in another tab. Reload to
              continue.
            </p>
            <button type="button" className="pill primary" onClick={onRetry}>
              Reload
            </button>
          </section>
        )}
        {!writable && !superseded && !replaced && (
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
            <p>
              {routes.some((route) => route.id === "backup")
                ? SEPARATE_STORAGE
                : SEPARATE_STORAGE_NO_BACKUP}
            </p>
          </section>
        )}
        <main className="content">
          <Routes>
            {routes.map((route) => {
              const Screen = screens[route.id]!;
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
