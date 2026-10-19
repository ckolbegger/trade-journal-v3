import { useCallback, useEffect, useState } from "react";
import type { ApplicationRuntime, ApplicationStart } from "../workspace/runtime";
import type { ReadinessCheckId } from "../results";
import type { WorkspaceStatus } from "../workspace/status";
import { Accounts } from "./Accounts";
import { Institutions } from "./Institutions";
import { ProtectionWarning } from "./ProtectionWarning";
import { PlanForm } from "./PlanForm";
import { TradeView } from "./TradeView";

const CHECK_LABELS: Record<ReadinessCheckId, string> = {
  "diagnostic-transaction": "Authoritative storage",
  capacity: "Storage capacity",
  "service-worker-control": "Application release worker",
  "offline-release-inventory": "Offline release inventory",
};

type Phase =
  | { readonly kind: "loading" }
  | { readonly kind: "failed"; readonly detail: string }
  | { readonly kind: "started"; readonly start: ApplicationStart };

type Destination = "startup" | "onboarding" | "plan" | "trades";

export function App({
  runtime,
  applicationName,
  openingInstant,
}: {
  runtime: ApplicationRuntime;
  applicationName: string;
  openingInstant: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [destination, setDestination] = useState<Destination>("startup");
  const [selectedTradeId, setSelectedTradeId] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    try {
      setPhase({ kind: "started", start: await runtime.start() });
    } catch (error) {
      setPhase({
        kind: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }, [runtime]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="app-shell" data-build-variant={__BUILD_VARIANT__}>
      <header className="app-shell__header">
        <p className="app-shell__eyebrow">Device-local journal</p>
        <h1>{applicationName}</h1>
        <p className="app-shell__instant">
          Opening instant: <time dateTime={openingInstant}>{openingInstant}</time>
        </p>
      </header>

      {phase.kind === "loading" && <StartupVerification />}
      {phase.kind === "failed" && <StartupFailure detail={phase.detail} onRetry={() => void load()} />}
      {phase.kind === "started" && (
        <Started
          start={phase.start}
          runtime={runtime}
          destination={destination}
          setDestination={setDestination}
          selectedTradeId={selectedTradeId}
          setSelectedTradeId={setSelectedTradeId}
          onRefresh={() => void load()}
        />
      )}
    </main>
  );
}

function StartupVerification() {
  return (
    <section className="card" aria-labelledby="verifying-title" aria-busy="true">
      <h2 id="verifying-title">Verifying this browser</h2>
      <p role="status" aria-live="polite">
        Checking authoritative storage, capacity, service-worker control and the offline release.
      </p>
      <p className="muted">Journal data is not touched until every check passes.</p>
    </section>
  );
}

function StartupFailure({ detail, onRetry }: { detail: string; onRetry: () => void }) {
  return (
    <section className="card" role="alert" aria-labelledby="failed-title">
      <h2 id="failed-title">The journal could not start</h2>
      <p>{detail}</p>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </section>
  );
}

function Started({
  start,
  runtime,
  destination,
  setDestination,
  selectedTradeId,
  setSelectedTradeId,
  onRefresh,
}: {
  start: ApplicationStart;
  runtime: ApplicationRuntime;
  destination: Destination;
  setDestination: (destination: Destination) => void;
  selectedTradeId: string | undefined;
  setSelectedTradeId: (tradeId: string | undefined) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="stack">
      {start.status.outcome === "InitializationRequired" && (
        <SetupView runtime={runtime} onInitialized={onRefresh} />
      )}
      {start.status.outcome === "Ready" && (
        <ReadyShell
          status={start.status}
          runtime={runtime}
          destination={destination}
          setDestination={setDestination}
          selectedTradeId={selectedTradeId}
          setSelectedTradeId={setSelectedTradeId}
          onRefresh={onRefresh}
        />
      )}
      {start.status.outcome === "RecoveryOnly" && (
        <RecoveryOnlyView status={start.status} runtime={runtime} onRetry={onRefresh} />
      )}
      {start.status.outcome === "Unsupported" && (
        <UnsupportedView status={start.status} onRetry={onRefresh} />
      )}
      {start.status.outcome === "IntegrityBlocked" && (
        <IntegrityBlockedView status={start.status} onRetry={onRefresh} />
      )}
    </div>
  );
}

function FailedChecks({ status }: { status: WorkspaceStatus }) {
  return (
    <ul aria-label="Failed readiness checks">
      {status.readiness.failedChecks.map((failure) => (
        <li key={failure.check} data-check={failure.check}>
          <strong>{CHECK_LABELS[failure.check]}</strong>: {failure.detail}
        </li>
      ))}
    </ul>
  );
}

function SetupView({
  runtime,
  onInitialized,
}: {
  runtime: ApplicationRuntime;
  onInitialized: () => void;
}) {
  const [timeZone, setTimeZone] = useState("");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function create(): Promise<void> {
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await runtime.initialize(timeZone);
      if (result.outcome === "Opened") {
        onInitialized();
      } else if (result.outcome === "TimeZoneSelectionRequired") {
        setMessage("Choose the time zone for this journal.");
      } else if (result.outcome === "MigrationBlocked") {
        setMessage(`The journal's stored version could not be migrated: ${result.evidence.detail}`);
      } else if (result.outcome === "IntegrityBlocked") {
        setMessage(`Existing storage cannot be validated: ${result.detail}`);
      } else {
        setMessage(
          `This browser is not safe to write here (${result.payload.runtimeReadiness}).`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="setup-title">
      <h2 id="setup-title">Create this journal</h2>
      <p>
        This journal lives only in this browser profile. Choose the time zone its Workspace should use
        for future session dates.
      </p>
      <label htmlFor="time-zone">Time zone</label>
      <select
        id="time-zone"
        value={timeZone}
        onChange={(event) => setTimeZone(event.target.value)}
        disabled={busy}
      >
        <option value="">Choose a time zone</option>
        <option value="America/New_York">New York</option>
        <option value="America/Chicago">Chicago</option>
        <option value="America/Denver">Denver</option>
        <option value="America/Los_Angeles">Los Angeles</option>
        <option value="UTC">UTC</option>
      </select>
      <button type="button" disabled={busy || timeZone === ""} onClick={() => void create()}>
        Create this journal
      </button>
      {message !== undefined && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
    </section>
  );
}

function ReadyShell({
  status,
  runtime,
  destination,
  setDestination,
  selectedTradeId,
  setSelectedTradeId,
  onRefresh,
}: {
  status: WorkspaceStatus;
  runtime: ApplicationRuntime;
  destination: Destination;
  setDestination: (destination: Destination) => void;
  selectedTradeId: string | undefined;
  setSelectedTradeId: (tradeId: string | undefined) => void;
  onRefresh: () => void;
}) {
  return (
    <>
      <nav aria-label="Primary" className="nav">
        <button
          type="button"
          data-destination="startup"
          aria-current={destination === "startup" ? "page" : undefined}
          onClick={() => setDestination("startup")}
        >
          Status
        </button>
        <button
          type="button"
          data-destination="onboarding"
          aria-current={destination === "onboarding" ? "page" : undefined}
          onClick={() => setDestination("onboarding")}
        >
          Set up
        </button>
        <button
          type="button"
          data-destination="plan"
          aria-current={destination === "plan" ? "page" : undefined}
          onClick={() => setDestination("plan")}
        >
          Plan
        </button>
        <button
          type="button"
          data-destination="trades"
          aria-current={destination === "trades" ? "page" : undefined}
          onClick={() => setDestination("trades")}
        >
          Trades
        </button>
      </nav>

      {status.readiness.notProtectedWarning && (
        <ProtectionWarning
          protection={status.protection}
          request={() => runtime.requestDurability()}
        />
      )}

      <div hidden={destination !== "startup"}>
        <StatusPanel status={status} />
      </div>
      <div hidden={destination !== "onboarding"}>
        <section className="card" aria-labelledby="onboarding-title">
          <h2 id="onboarding-title">Set up your brokerage</h2>
          <p role="status">Onboarding: {status.onboarding}</p>
          <Institutions runtime={runtime} onChanged={onRefresh} />
          <Accounts runtime={runtime} onChanged={onRefresh} />
        </section>
      </div>
      <div hidden={destination !== "plan"}>
        {status.onboarding === "Ready for Trade Planning" ? (
          <PlanForm
            runtime={runtime}
            onSaved={(tradeId) => {
              if (tradeId === "") return;
              setSelectedTradeId(tradeId);
              setDestination("trades");
            }}
          />
        ) : (
          <section className="card" aria-labelledby="plan-blocked">
            <h2 id="plan-blocked">Set up an Account first</h2>
            <p>
              A Plan needs one Account you trade and the Strategy it belongs to. Open{" "}
              <strong>Set up</strong> to add an Institution and an Account.
            </p>
          </section>
        )}
      </div>
      <div hidden={destination !== "trades"}>
        <TradeView
          runtime={runtime}
          active={destination === "trades"}
          selectedTradeId={selectedTradeId}
          onSelect={(tradeId) => setSelectedTradeId(tradeId)}
        />
      </div>
    </>
  );
}

function StatusPanel({ status }: { status: WorkspaceStatus }) {
  return (
    <section className="card" aria-labelledby="status-title">
      <h2 id="status-title">Status</h2>
      <p role="status">Ready to write.</p>
      <dl className="facts">
        <dt>Time zone</dt>
        <dd>{status.timeZone ?? "Not set"}</dd>
        <dt>Onboarding</dt>
        <dd>{status.onboarding ?? "Unknown"}</dd>
        <dt>Storage protection</dt>
        <dd>{status.protection.kind}</dd>
        <dt>Schema version</dt>
        <dd>{status.schemaVersion}</dd>
        <dt>Installed capabilities</dt>
        <dd>{status.capabilityManifest.operations.length} operations</dd>
        <dt>Release</dt>
        <dd>{status.capabilityManifest.releaseId}</dd>
      </dl>
      <h3>Readiness evidence</h3>
      <ul aria-label="Readiness checks">
        {status.readiness.checks.map((check) => (
          <li key={check.check} data-check={check.check} data-outcome={check.outcome}>
            {CHECK_LABELS[check.check]}: {check.outcome}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecoveryOnlyView({
  status,
  runtime,
  onRetry,
}: {
  status: WorkspaceStatus;
  runtime: ApplicationRuntime;
  onRetry: () => void;
}) {
  const reason =
    status.readiness.failedChecks[0]?.detail ?? "a write-safety check did not pass";
  return (
    <>
      <section className="card" role="status" aria-labelledby="recovery-title">
        <h2 id="recovery-title">Read-only recovery</h2>
        <p>
          Writes and Restore are disabled: {reason}.
        </p>
        <p>You can still read this Workspace and its history.</p>
        <p className="muted">
          Another browser or browser profile has separate storage; this Workspace will not appear
          there.
        </p>
        <button type="button" onClick={onRetry}>
          Retry checks
        </button>
      </section>
      <section className="card" aria-labelledby="recovery-history-title">
        <h3 id="recovery-history-title">Readable history</h3>
        <Institutions runtime={runtime} onChanged={onRetry} readOnly />
      </section>
    </>
  );
}

function UnsupportedView({ status, onRetry }: { status: WorkspaceStatus; onRetry: () => void }) {
  return (
    <section className="card" role="alert" aria-labelledby="unsupported-title">
      <h2 id="unsupported-title">This browser cannot safely save journal data</h2>
      <p>Every failed readiness check is named below.</p>
      <FailedChecks status={status} />
      <button type="button" onClick={onRetry}>
        Retry checks
      </button>
      <p className="muted">
        Try another browser: another browser has separate storage, so it starts a separate Workspace.
      </p>
    </section>
  );
}

function IntegrityBlockedView({
  status,
  onRetry,
}: {
  status: WorkspaceStatus;
  onRetry: () => void;
}) {
  return (
    <section className="card" role="alert" aria-labelledby="integrity-title">
      <h2 id="integrity-title">Storage integrity is blocked</h2>
      <p>Runtime Readiness: {status.readiness.outcome}.</p>
      <p>
        Existing data may already be in this storage. This journal will not initialize over it, and
        will not treat the storage as empty.
      </p>
      <FailedChecks status={status} />
      <button type="button" onClick={onRetry}>
        Retry checks
      </button>
      <p className="muted">Follow recovery guidance before using this browser for journal data.</p>
    </section>
  );
}
