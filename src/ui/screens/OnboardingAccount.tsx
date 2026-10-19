import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { UiFacade } from '../../app/compose.ts';

export interface OnboardingAccountProps {
  readonly facade: UiFacade;
  // Called from the save result alone: Trade planning needs one selectable Account.
  readonly onReady: () => void;
}

type Field = 'institution' | 'account';

const MESSAGES: Record<Field, Record<string, string>> = {
  institution: {
    LabelRequired: 'Enter a name for the Institution.',
    LabelNotDistinguishable: 'You already have an Institution with this name.',
  },
  account: {
    LabelRequired: 'Enter a name for the Account.',
    LabelNotDistinguishable: 'This Institution already has an Account with this name.',
  },
};

export function OnboardingAccount({ facade, onReady }: OnboardingAccountProps) {
  const [institution, setInstitution] = useState('');
  const [account, setAccount] = useState('');
  // Kept once created, so a retry after an Account issue never creates the Institution twice.
  const [institutionId, setInstitutionId] = useState<string | undefined>();
  const [issue, setIssue] = useState<{ field: Field; message: string } | undefined>();
  const institutionRef = useRef<HTMLInputElement>(null);
  const accountRef = useRef<HTMLInputElement>(null);
  const refs = { institution: institutionRef, account: accountRef };

  // Focus moves to the field whose issue was just reported.
  useEffect(() => {
    if (issue) (issue.field === 'institution' ? institutionRef : accountRef).current?.focus();
  }, [issue]);

  const report = (field: Field, codes: readonly string[]) =>
    setIssue({ field, message: codes.map((code) => MESSAGES[field][code] ?? 'Check this field.').join(' ') });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIssue(undefined);
    let parent = institutionId;
    if (!parent) {
      const created = await facade.ReferenceCatalog.save({ kind: 'CreateInstitution', label: institution });
      if (created.kind === 'Rejected') return report('institution', created.issues.map((i) => i.code));
      if (created.kind !== 'Saved') return;
      parent = created.record.id;
      setInstitutionId(parent);
    }
    const saved = await facade.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: parent, label: account });
    if (saved.kind === 'Rejected') return report('account', saved.issues.map((i) => i.code));
    if (saved.kind === 'Saved' && saved.selectableAccountCount > 0) onReady();
  };

  const field = (name: Field, label: string, value: string, set: (value: string) => void) => {
    const error = issue?.field === name ? issue.message : undefined;
    return (
      <>
        <label>
          {label}
          <input
            ref={refs[name]}
            value={value}
            onChange={(e) => set(e.target.value)}
            aria-invalid={error !== undefined}
            aria-describedby={error ? `${name}-error` : undefined}
          />
        </label>
        {error && (
          <p id={`${name}-error`} className="field-error">
            {error}
          </p>
        )}
      </>
    );
  };

  return (
    <main className="content onboarding">
      <h1>Add your brokerage account</h1>
      <p>Every Trade belongs to one Account at one Institution.</p>
      <form onSubmit={(event) => void submit(event)} noValidate>
        {field('institution', 'Institution', institution, setInstitution)}
        {field('account', 'Account', account, setAccount)}
        <button type="submit" className="pill primary">
          Save and continue
        </button>
      </form>
    </main>
  );
}
