import { useCallback, useEffect, useState } from "react";
import type { CatalogQueryResult } from "../catalog/save";
import { validateInstitutionName } from "../onboarding";
import type { ApplicationRuntime } from "../workspace/runtime";

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly result: Extract<CatalogQueryResult, { outcome: "Page" }> }
  | { readonly kind: "error"; readonly detail: string };

export function Institutions({
  runtime,
  onChanged,
  readOnly = false,
}: {
  runtime: ApplicationRuntime;
  onChanged: () => void;
  readOnly?: boolean;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const result = await runtime.streamInstitutions();
      if (result.outcome !== "Page") {
        setState({ kind: "error", detail: "the Catalog snapshot could not be read" });
        return;
      }
      setState({ kind: "ready", result });
    } catch (error) {
      setState({ kind: "error", detail: error instanceof Error ? error.message : String(error) });
    }
  }, [runtime]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (state.kind !== "ready") return;
    const problem = validateInstitutionName(label);
    if (problem !== undefined) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await runtime.addInstitution(label.trim(), state.result.snapshotRevision);
      if (result.outcome === "Saved") {
        setLabel("");
        await load();
        onChanged();
      } else if (result.outcome === "Conflict") {
        setMessage("This Catalog changed while you were editing; review it and try again.");
        await load();
      } else if (result.outcome === "Rejected") {
        setMessage(result.reason);
      } else {
        setMessage("The journal is not writable right now.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="institutions-title" className="card">
      <h3 id="institutions-title">Brokerage institutions</h3>

      {state.kind === "loading" && (
        <p role="status" aria-live="polite">
          Loading institutions…
        </p>
      )}

      {state.kind === "error" && (
        <div role="alert" className="error">
          <p>The institutions could not be loaded.</p>
          <p className="muted">{state.detail}</p>
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {state.kind === "ready" && state.result.records.length === 0 && (
        <p role="status" aria-live="polite" className="muted">
          No institutions yet. Add the brokerage you trade with to begin.
        </p>
      )}

      {state.kind === "ready" && state.result.records.length > 0 && (
        <ul aria-label="Institutions" className="record-list">
          {state.result.records.map((record) => (
            <li key={record.id} data-record-id={record.id}>
              <span>{record.label}</span>
              <span>
                {Array.isArray(record.history) && record.history.length > 1 && (
                  <span className="muted">
                    formerly {(record.history[0] as { label?: string }).label}
                  </span>
                )}
                {record.retired === true && <span className="badge">Archived</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {state.kind === "ready" && !readOnly && (
        <form onSubmit={(event) => void submit(event)} className="inline-form">
          <label htmlFor="institution-name">Institution name</label>
          <input
            id="institution-name"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            disabled={busy}
            autoComplete="organization"
          />
          <button type="submit" disabled={busy}>
            Add institution
          </button>
        </form>
      )}

      {message !== undefined && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
    </section>
  );
}
