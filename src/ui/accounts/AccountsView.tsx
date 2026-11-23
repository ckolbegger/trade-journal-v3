import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ReferenceCatalog } from '../../catalog/reference-catalog';
import type { AccountRecord, InstitutionRecord } from '../../persistence/idb';
import type { OnboardingState } from '../../workspace/workspace';
import styles from '../shell/AppShell.module.css';

interface AccountsViewProps {
  readonly catalog: ReferenceCatalog;
  readonly onboardingState: OnboardingState;
  readonly writable: boolean;
  readonly onCatalogChanged: () => Promise<void>;
  readonly onDirtyChange: (dirty: boolean) => void;
}

export function AccountsView({
  catalog,
  onboardingState,
  writable,
  onCatalogChanged,
  onDirtyChange,
}: AccountsViewProps) {
  const [institutions, setInstitutions] = useState<readonly InstitutionRecord[]>([]);
  const [accounts, setAccounts] = useState<readonly AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const [newInstLabel, setNewInstLabel] = useState('');
  const [accountDrafts, setAccountDrafts] = useState<Record<string, string>>({});
  const [editingInst, setEditingInst] = useState<{ id: string; label: string; revision: number } | null>(
    null,
  );
  const [editingAcct, setEditingAcct] = useState<{ id: string; label: string; revision: number } | null>(
    null,
  );
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCatalog = useCallback(
    async (isInitial = false) => {
      if (isInitial) {
        setLoading(true);
      }
      try {
        const [instRes, acctRes] = await Promise.all([
          catalog.query({ family: 'Institution', includeInactive: true }),
          catalog.query({ family: 'Account', includeInactive: true }),
        ]);
        if (instRes.family === 'Institution') {
          setInstitutions(instRes.items);
        }
        if (acctRes.family === 'Account') {
          setAccounts(acctRes.items);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load institutions and accounts.');
      } finally {
        if (isInitial) {
          setLoading(false);
        }
      }
    },
    [catalog],
  );

  useEffect(() => {
    void loadCatalog(true);
  }, [loadCatalog]);

  useEffect(() => {
    const hasDraftAccount = Object.values(accountDrafts).some((v) => v.trim().length > 0);
    const dirty =
      newInstLabel.trim().length > 0 ||
      hasDraftAccount ||
      editingInst !== null ||
      editingAcct !== null;
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [newInstLabel, accountDrafts, editingInst, editingAcct, onDirtyChange]);

  const handleCreateInstitution = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const res = await catalog.save({ kind: 'CreateInstitution', label: newInstLabel });
      if (res.status === 'Saved') {
        setNewInstLabel('');
        setNotice(`Added institution "${res.record.currentLabel}".`);
        await loadCatalog();
        await onCatalogChanged();
        return;
      }
      if (res.status === 'RuntimeNotWritable') {
        setError(`Write blocked: runtime is ${res.reason}.`);
        return;
      }
      if (res.status === 'Rejected' || res.status === 'Conflict') {
        setError(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create institution.');
    }
  };

  const handleRenameInstitution = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingInst) return;
    setError(null);
    setNotice(null);
    try {
      const res = await catalog.save({
        kind: 'RenameInstitution',
        id: editingInst.id,
        label: editingInst.label,
        expectedRevision: editingInst.revision,
      });
      if (res.status === 'Saved' || res.status === 'Unchanged') {
        setEditingInst(null);
        setNotice(`Updated institution "${res.record.currentLabel}".`);
        await loadCatalog();
        await onCatalogChanged();
        return;
      }
      if (res.status === 'RuntimeNotWritable') {
        setError(`Write blocked: runtime is ${res.reason}.`);
        return;
      }
      if (res.status === 'Conflict') {
        setEditingInst(null);
        await loadCatalog();
      }
      setError(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename institution.');
    }
  };

  const handleToggleInstitutionArchive = async (inst: InstitutionRecord) => {
    setError(null);
    setNotice(null);
    try {
      const res = await catalog.save({
        kind: inst.status === 'Active' ? 'ArchiveInstitution' : 'ReactivateInstitution',
        id: inst.id,
        expectedRevision: inst.revision,
      });
      if (res.status === 'Saved') {
        setNotice(
          `${res.record.status === 'Archived' ? 'Archived' : 'Reactivated'} institution "${res.record.currentLabel}".`,
        );
        await loadCatalog();
        await onCatalogChanged();
        return;
      }
      if (res.status === 'RuntimeNotWritable') {
        setError(`Write blocked: runtime is ${res.reason}.`);
        return;
      }
      if (res.status === 'Conflict') {
        await loadCatalog();
      }
      if (res.status === 'Rejected' || res.status === 'Conflict') {
        setError(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update institution status.');
    }
  };

  const handleCreateAccount = async (institutionId: string, e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const label = accountDrafts[institutionId] ?? '';
    try {
      const res = await catalog.save({ kind: 'CreateAccount', institutionId, label });
      if (res.status === 'Saved') {
        setAccountDrafts((prev) => ({ ...prev, [institutionId]: '' }));
        setNotice(`Added account "${res.record.currentLabel}".`);
        await loadCatalog();
        await onCatalogChanged();
        return;
      }
      if (res.status === 'RuntimeNotWritable') {
        setError(`Write blocked: runtime is ${res.reason}.`);
        return;
      }
      if (res.status === 'Rejected' || res.status === 'Conflict') {
        setError(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    }
  };

  const handleRenameAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingAcct) return;
    setError(null);
    setNotice(null);
    try {
      const res = await catalog.save({
        kind: 'RenameAccount',
        id: editingAcct.id,
        label: editingAcct.label,
        expectedRevision: editingAcct.revision,
      });
      if (res.status === 'Saved' || res.status === 'Unchanged') {
        setEditingAcct(null);
        setNotice(`Updated account "${res.record.currentLabel}".`);
        await loadCatalog();
        await onCatalogChanged();
        return;
      }
      if (res.status === 'RuntimeNotWritable') {
        setError(`Write blocked: runtime is ${res.reason}.`);
        return;
      }
      if (res.status === 'Conflict') {
        setEditingAcct(null);
        await loadCatalog();
      }
      setError(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename account.');
    }
  };

  const handleToggleAccountArchive = async (acct: AccountRecord) => {
    setError(null);
    setNotice(null);
    try {
      const res = await catalog.save({
        kind: acct.status === 'Active' ? 'ArchiveAccount' : 'ReactivateAccount',
        id: acct.id,
        expectedRevision: acct.revision,
      });
      if (res.status === 'Saved') {
        setNotice(
          `${res.record.status === 'Archived' ? 'Archived' : 'Reactivated'} account "${res.record.currentLabel}".`,
        );
        await loadCatalog();
        await onCatalogChanged();
        return;
      }
      if (res.status === 'RuntimeNotWritable') {
        setError(`Write blocked: runtime is ${res.reason}.`);
        return;
      }
      if (res.status === 'Conflict') {
        await loadCatalog();
      }
      if (res.status === 'Rejected' || res.status === 'Conflict') {
        setError(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account status.');
    }
  };

  const toggleHistory = (id: string) => {
    setExpandedHistoryIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const visibleInstitutions = showArchived
    ? institutions
    : institutions.filter((inst) => inst.status === 'Active');

  return (
    <section aria-labelledby="accounts-heading">
      <div className={styles.spaceBetween} style={{ marginBottom: 16 }}>
        <div>
          <h1 id="accounts-heading" style={{ margin: 0, fontSize: '1.45rem' }}>
            Institutions &amp; Accounts
          </h1>
          <p className={styles.muted} style={{ margin: '4px 0 0' }}>
            {onboardingState === 'ReadyForTradePlanning'
              ? 'Your Workspace has at least one active brokerage account and is ready for Trade Planning.'
              : 'Add at least one brokerage Institution and Account to prepare your Workspace for Trade Planning.'}
          </p>
        </div>
        <span
          className={`${styles.pill} ${
            onboardingState === 'ReadyForTradePlanning' ? styles.pillSuccess : styles.pillWarning
          }`}
        >
          {onboardingState === 'ReadyForTradePlanning'
            ? 'Ready for Trade Planning'
            : 'Needs Institution and Account'}
        </span>
      </div>

      {error && (
        <div className={styles.alertError} role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className={styles.alertSuccess} role="status">
          {notice}
        </div>
      )}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Add Institution</h2>
        <form onSubmit={handleCreateInstitution} className={styles.row}>
          <label className="sr-only" htmlFor="new-institution-name">
            Institution name
          </label>
          <input
            id="new-institution-name"
            className={styles.input}
            type="text"
            placeholder="e.g., Fidelity, Schwab, IBKR"
            value={newInstLabel}
            onChange={(e) => setNewInstLabel(e.target.value)}
            disabled={!writable}
          />
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={!writable || !newInstLabel.trim()}
          >
            Add Institution
          </button>
        </form>
      </div>

      <div className={styles.spaceBetween} style={{ marginBottom: 12 }}>
        <span className={styles.muted}>
          {institutions.length} institution{institutions.length === 1 ? '' : 's'}, {accounts.length}{' '}
          account{accounts.length === 1 ? '' : 's'}
        </span>
        <label className={styles.row} style={{ fontSize: '0.88rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {loading ? (
        <div className={styles.card} aria-busy="true">
          Loading institutions and accounts…
        </div>
      ) : visibleInstitutions.length === 0 ? (
        <div className={styles.card}>
          <p className={styles.muted} style={{ margin: 0 }}>
            {institutions.length === 0
              ? 'No institutions yet. Add your first brokerage institution above.'
              : 'All institutions are archived. Toggle "Show archived" to view or reactivate them.'}
          </p>
        </div>
      ) : (
        visibleInstitutions.map((inst) => {
          const instAccounts = accounts.filter(
            (a) => a.institutionId === inst.id && (showArchived || a.status === 'Active'),
          );
          const isEditingThisInst = editingInst?.id === inst.id;

          return (
            <article key={inst.id} className={styles.card} aria-label={inst.currentLabel}>
              <div className={styles.spaceBetween}>
                {isEditingThisInst ? (
                  <form onSubmit={handleRenameInstitution} className={styles.row}>
                    <label className="sr-only" htmlFor={`rename-inst-${inst.id}`}>
                      Rename institution
                    </label>
                    <input
                      id={`rename-inst-${inst.id}`}
                      className={styles.input}
                      value={editingInst.label}
                      disabled={!writable}
                      onChange={(e) =>
                        setEditingInst({ ...editingInst, label: e.target.value })
                      }
                    />
                    <button type="submit" className={styles.btnPrimary} disabled={!writable}>
                      Save
                    </button>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => setEditingInst(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className={styles.row}>
                    <h2 className={styles.cardTitle} style={{ margin: 0 }}>
                      {inst.currentLabel}
                    </h2>
                    <span
                      className={`${styles.pill} ${
                        inst.status === 'Active' ? styles.pillSuccess : styles.pillWarning
                      }`}
                    >
                      {inst.status}
                    </span>
                  </div>
                )}

                <div className={styles.row}>
                  {!isEditingThisInst && (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      disabled={!writable}
                      onClick={() =>
                        setEditingInst({
                          id: inst.id,
                          label: inst.currentLabel,
                          revision: inst.revision,
                        })
                      }
                    >
                      Rename
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    disabled={!writable}
                    onClick={() => {
                      void handleToggleInstitutionArchive(inst);
                    }}
                  >
                    {inst.status === 'Active' ? 'Archive' : 'Reactivate'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => toggleHistory(inst.id)}
                  >
                    {expandedHistoryIds[inst.id] ? 'Hide History' : 'History'}
                  </button>
                </div>
              </div>

              {expandedHistoryIds[inst.id] && (
                <ul className={styles.muted} style={{ marginTop: 10 }}>
                  {inst.history.map((h) => (
                    <li key={h.revision}>
                      Rev {h.revision}: {h.action} — &ldquo;{h.label}&rdquo; ({h.status})
                    </li>
                  ))}
                </ul>
              )}

              <div style={{ marginTop: 14 }}>
                {instAccounts.length === 0 ? (
                  <p className={styles.muted} style={{ margin: '0 0 10px' }}>
                    No {showArchived ? '' : 'active '}accounts under {inst.currentLabel}.
                  </p>
                ) : (
                  <table className={styles.table} aria-label={`${inst.currentLabel} accounts`}>
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instAccounts.map((acct) => {
                        const isEditingThisAcct = editingAcct?.id === acct.id;
                        return (
                          <tr key={acct.id}>
                            <td>
                              {isEditingThisAcct ? (
                                <form onSubmit={handleRenameAccount} className={styles.row}>
                                  <label className="sr-only" htmlFor={`rename-acct-${acct.id}`}>
                                    Rename account
                                  </label>
                                  <input
                                    id={`rename-acct-${acct.id}`}
                                    className={styles.input}
                                    value={editingAcct.label}
                                    disabled={!writable}
                                    onChange={(e) =>
                                      setEditingAcct({ ...editingAcct, label: e.target.value })
                                    }
                                  />
                                  <button type="submit" className={styles.btnPrimary} disabled={!writable}>
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    onClick={() => setEditingAcct(null)}
                                  >
                                    Cancel
                                  </button>
                                </form>
                              ) : (
                                <>
                                  <strong>{acct.currentLabel}</strong>
                                  {expandedHistoryIds[acct.id] && (
                                    <ul className={styles.muted} style={{ margin: '6px 0 0' }}>
                                      {acct.history.map((h) => (
                                        <li key={h.revision}>
                                          Rev {h.revision}: {h.action} — &ldquo;{h.label}&rdquo; (
                                          {h.status})
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </>
                              )}
                            </td>
                            <td>
                              <span
                                className={`${styles.pill} ${
                                  acct.status === 'Active' ? styles.pillSuccess : styles.pillWarning
                                }`}
                              >
                                {acct.status}
                              </span>
                            </td>
                            <td>
                              <div className={styles.row}>
                                {!isEditingThisAcct && (
                                  <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    disabled={!writable}
                                    onClick={() =>
                                      setEditingAcct({
                                        id: acct.id,
                                        label: acct.currentLabel,
                                        revision: acct.revision,
                                      })
                                    }
                                  >
                                    Rename
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={styles.btnSecondary}
                                  disabled={!writable}
                                  onClick={() => {
                                    void handleToggleAccountArchive(acct);
                                  }}
                                >
                                  {acct.status === 'Active' ? 'Archive' : 'Reactivate'}
                                </button>
                                <button
                                  type="button"
                                  className={styles.btnSecondary}
                                  onClick={() => toggleHistory(acct.id)}
                                >
                                  {expandedHistoryIds[acct.id] ? 'Hide History' : 'History'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {inst.status === 'Active' && (
                  <form
                    onSubmit={(e) => {
                      void handleCreateAccount(inst.id, e);
                    }}
                    className={styles.row}
                    style={{ marginTop: 12 }}
                  >
                    <label className="sr-only" htmlFor={`new-acct-${inst.id}`}>
                      Add account under {inst.currentLabel}
                    </label>
                    <input
                      id={`new-acct-${inst.id}`}
                      className={styles.input}
                      type="text"
                      placeholder={`Add account under ${inst.currentLabel}…`}
                      value={accountDrafts[inst.id] ?? ''}
                      onChange={(e) =>
                        setAccountDrafts((prev) => ({ ...prev, [inst.id]: e.target.value }))
                      }
                      disabled={!writable}
                    />
                    <button
                      type="submit"
                      className={styles.btnSecondary}
                      disabled={!writable || !(accountDrafts[inst.id] ?? '').trim()}
                    >
                      Add Account
                    </button>
                  </form>
                )}
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
