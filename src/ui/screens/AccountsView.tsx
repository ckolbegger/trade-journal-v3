import { useEffect, useState, type FormEvent } from 'react';
import type { UiFacade } from '../../app/compose.ts';
import { PageTitle } from '../PageTitle.tsx';
import { useRuntime } from '../runtime.tsx';

interface Row {
  readonly id: string;
  readonly label: string;
  readonly institutionId?: string;
}

export interface AccountsViewProps {
  readonly facade: UiFacade;
}

// Institutions with their Accounts. Adding is offered only while the session is Writable.
export function AccountsView({ facade }: AccountsViewProps) {
  const { writable, report } = useRuntime();
  const [institutions, setInstitutions] = useState<readonly Row[] | undefined>();
  const [accounts, setAccounts] = useState<readonly Row[]>([]);
  const [adding, setAdding] = useState<'institution' | { institutionId: string } | undefined>();
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    void Promise.all([
      facade.ReferenceCatalog.query({ family: 'Institution', pageSize: 500 }),
      facade.ReferenceCatalog.query({ family: 'Account', pageSize: 500 }),
    ]).then(([i, a]) => {
      setInstitutions(i.kind === 'Page' ? i.items : []);
      setAccounts(a.kind === 'Page' ? a.items : []);
    });
  }, [facade]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!adding) return;
    const result =
      adding === 'institution'
        ? await facade.ReferenceCatalog.save({ kind: 'CreateInstitution', label })
        : await facade.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: adding.institutionId, label });
    report(result);
    if (result.kind === 'Rejected') {
      setError(result.issues.some((i) => i.code === 'LabelRequired') ? 'Enter a name.' : 'This name is already in use here.');
      return;
    }
    if (result.kind !== 'Saved') return;
    // The save result carries the complete record, so no list read follows.
    const record = result.record as Row;
    if (adding === 'institution') setInstitutions((rows) => [...(rows ?? []), record]);
    else setAccounts((rows) => [...rows, record]);
    setAdding(undefined);
    setLabel('');
    setError(undefined);
  };

  const addForm = (name: string) => (
    <form onSubmit={(event) => void save(event)} noValidate>
      <label>
        {name}
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-invalid={error !== undefined}
          aria-describedby={error ? 'add-error' : undefined}
          autoFocus
        />
      </label>
      {error && (
        <p id="add-error" className="field-error">
          {error}
        </p>
      )}
      <button type="submit" className="pill primary">
        Save
      </button>
      <button type="button" className="pill secondary" onClick={() => setAdding(undefined)}>
        Cancel
      </button>
    </form>
  );

  if (!institutions) return <p role="status">Loading Accounts…</p>;

  return (
    <section className="accounts">
      <PageTitle>Accounts</PageTitle>
      {institutions.map((institution) => (
        <section key={institution.id} className="card" aria-labelledby={`institution-${institution.id}`}>
          <h2 id={`institution-${institution.id}`}>{institution.label}</h2>
          <ul className="rows">
            {accounts
              .filter((account) => account.institutionId === institution.id)
              .map((account) => (
                <li key={account.id}>{account.label}</li>
              ))}
          </ul>
          {writable &&
            (typeof adding === 'object' && adding.institutionId === institution.id ? (
              addForm('Account name')
            ) : (
              <button type="button" className="pill secondary" onClick={() => setAdding({ institutionId: institution.id })}>
                Add Account
              </button>
            ))}
        </section>
      ))}
      {writable &&
        (adding === 'institution' ? (
          addForm('Institution name')
        ) : (
          <button type="button" className="pill secondary" onClick={() => setAdding('institution')}>
            Add Institution
          </button>
        ))}
    </section>
  );
}
