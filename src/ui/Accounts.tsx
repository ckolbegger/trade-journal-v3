import { useCallback, useEffect, useState } from "react";
import type { CatalogRecord } from "../catalog";
import type { ApplicationRuntime } from "../workspace/runtime";
import { validateAccountName } from "../onboarding";

export function Accounts({
  runtime,
  onChanged,
}: {
  runtime: ApplicationRuntime;
  onChanged: () => void;
}) {
  const [institutions, setInstitutions] = useState<readonly CatalogRecord[]>([]);
  const [accounts, setAccounts] = useState<readonly CatalogRecord[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  const load = useCallback(async () => {
    const [selectable, accountPage] = await Promise.all([
      runtime.streamSelectableInstitutions(),
      runtime.streamAccounts(),
    ]);
    if (selectable.outcome === "Page") {
      setInstitutions(selectable.records);
      setRevision(selectable.snapshotRevision);
      if (!selectable.records.some((record) => record.id === institutionId)) {
        setInstitutionId(selectable.records[0]?.id ?? "");
      }
    }
    if (accountPage.outcome === "Page") setAccounts(accountPage.records);
  }, [runtime, institutionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const problem = validateAccountName(label);
    if (problem !== undefined) {
      setMessage(problem);
      return;
    }
    if (institutionId === "") {
      setMessage("Choose the Institution this Account belongs to.");
      return;
    }
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await runtime.addAccount(institutionId, label.trim(), revision);
      if (result.outcome === "Saved") {
        setLabel("");
        await load();
        onChanged();
      } else if (result.outcome === "Conflict") {
        setMessage("This catalog changed while you were editing. Review it and try again.");
        await load();
      } else if (result.outcome === "Rejected") {
        setMessage(
          result.reason === "the parent Institution is archived"
            ? "The Institution is no longer selectable. Review it and choose again."
            : result.reason,
        );
        await load();
      } else {
        setMessage("The journal is not writable right now.");
      }
    } finally {
      setBusy(false);
    }
  }

  const institutionLabel = (id: string): string =>
    institutions.find((record) => record.id === id)?.label ?? id;

  return (
    <section aria-labelledby="accounts-title" className="card">
      <h3 id="accounts-title">Accounts</h3>

      {accounts.length === 0 ? (
        <p role="status" className="muted">
          No accounts yet. Choose the Institution and add the account you trade.
        </p>
      ) : (
        <ul aria-label="Accounts" className="record-list">
          {accounts.map((record) => (
            <li key={record.id} data-record-id={record.id}>
              <span>{record.label}</span>
              <span className="muted">at {institutionLabel(String(record.parentId))}</span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(event) => void submit(event)} className="inline-form">
        <div>
          <label htmlFor="account-institution">Institution</label>
          <select
            id="account-institution"
            value={institutionId}
            onChange={(event) => setInstitutionId(event.target.value)}
            disabled={busy || institutions.length === 0}
          >
            {institutions.length === 0 && <option value="">No selectable Institution</option>}
            {institutions.map((record) => (
              <option key={record.id} value={record.id}>
                {record.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="account-name">Account name</label>
          <input
            id="account-name"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </div>
        <button type="submit" disabled={busy}>
          Add account
        </button>
      </form>

      {message !== undefined && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
    </section>
  );
}
