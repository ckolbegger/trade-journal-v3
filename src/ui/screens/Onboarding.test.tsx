// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble, readyStatus } from '../../../tests/support/facade-double.ts';
import { AppShell, type Screens } from '../AppShell.tsx';

afterEach(cleanup);

const screens: Screens = {
  trades: () => (
    <section>
      <p>No Planned Trades yet.</p>
      <a href="/plans/new">New Plan</a>
    </section>
  ),
  'trade-detail': () => null,
  'new-plan': () => null,
  accounts: () => null,
  about: () => null,
  start: () => null,
};

function renderShell(facade = facadeDouble({ status: readyStatus({ onboarding: 'NeedsInstitutionAndAccount' }) })) {
  render(
    <MemoryRouter>
      <AppShell facade={facade} screens={screens} />
    </MemoryRouter>,
  );
  return facade;
}

describe('Institution and Account onboarding', () => {
  it('should require an Institution and Account when onboarding is NeedsInstitutionAndAccount and show no New Plan action', async () => {
    renderShell();
    expect(await screen.findByRole('heading', { name: 'Add your brokerage account' })).toBeTruthy();
    expect(screen.getByLabelText('Institution')).toBeTruthy();
    expect(screen.getByLabelText('Account')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'New Plan' })).toBeNull();
    expect(screen.queryByText('No Planned Trades yet.')).toBeNull();
  });

  it('should create the Institution then the Account and, from the returned onboarding state alone, show the Trades empty state with a New Plan action', async () => {
    const facade = facadeDouble({ status: readyStatus({ onboarding: 'NeedsInstitutionAndAccount' }) });
    const institution = { id: 'inst-1', kind: 'Institution', label: 'Fidelity', normalizedLabel: 'fidelity', active: true, origin: 'Trader', recordRevision: 1 };
    const account = { id: 'acct-1', kind: 'Account', institutionId: 'inst-1', label: 'Roth IRA', normalizedLabel: 'roth ira', active: true, origin: 'Trader', recordRevision: 1 };
    vi.mocked(facade.ReferenceCatalog.save)
      .mockResolvedValueOnce({ kind: 'Saved', record: institution, snapshot: { catalogRevision: 2 }, selectableAccountCount: 0 } as never)
      .mockResolvedValueOnce({ kind: 'Saved', record: account, snapshot: { catalogRevision: 3 }, selectableAccountCount: 1 } as never);
    renderShell(facade);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Institution'), 'Fidelity');
    await user.type(screen.getByLabelText('Account'), 'Roth IRA');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText('No Planned Trades yet.')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'New Plan' }).length).toBeGreaterThan(0);
    expect(vi.mocked(facade.ReferenceCatalog.save).mock.calls).toEqual([
      [{ kind: 'CreateInstitution', label: 'Fidelity' }],
      [{ kind: 'CreateAccount', institutionId: 'inst-1', label: 'Roth IRA' }],
    ]);
    expect(facade.Workspace.getStatus).toHaveBeenCalledTimes(1);
  });

  it('should show each typed issue (LabelRequired, LabelNotDistinguishable) next to its field and move focus to the first one', async () => {
    const facade = facadeDouble({ status: readyStatus({ onboarding: 'NeedsInstitutionAndAccount' }) });
    const institution = { id: 'inst-1', kind: 'Institution', label: 'Fidelity', normalizedLabel: 'fidelity', active: true, origin: 'Trader', recordRevision: 1 };
    vi.mocked(facade.ReferenceCatalog.save)
      .mockResolvedValueOnce({ kind: 'Rejected', issues: [{ field: 'label', code: 'LabelRequired' }] })
      .mockResolvedValueOnce({ kind: 'Saved', record: institution, snapshot: { catalogRevision: 2 }, selectableAccountCount: 0 } as never)
      .mockResolvedValueOnce({ kind: 'Rejected', issues: [{ field: 'label', code: 'LabelNotDistinguishable' }] });
    renderShell(facade);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Save and continue' }));
    const institutionField = screen.getByLabelText('Institution');
    const required = await screen.findByText(/enter a name for the institution/i);
    expect(institutionField.getAttribute('aria-describedby')).toBe(required.id);
    expect(document.activeElement).toBe(institutionField);

    await user.type(institutionField, 'Fidelity');
    await user.type(screen.getByLabelText('Account'), 'Roth IRA');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    const accountField = screen.getByLabelText('Account');
    const duplicate = await screen.findByText(/already has an account with this name/i);
    expect(accountField.getAttribute('aria-describedby')).toBe(duplicate.id);
    expect(document.activeElement).toBe(accountField);
  });

  it('should reuse an Institution an earlier attempt saved without an Account, instead of creating it again', async () => {
    const facade = facadeDouble({ status: readyStatus({ onboarding: 'NeedsInstitutionAndAccount' }) });
    const institution = { id: 'inst-1', kind: 'Institution', label: 'Fidelity', normalizedLabel: 'fidelity', active: true, origin: 'Trader', recordRevision: 1 };
    const account = { id: 'acct-1', kind: 'Account', institutionId: 'inst-1', label: 'Roth IRA', normalizedLabel: 'roth ira', active: true, origin: 'Trader', recordRevision: 1 };
    vi.mocked(facade.ReferenceCatalog.query).mockImplementation((request) =>
      Promise.resolve({ kind: 'Page', items: request.family === 'Institution' ? [institution] : [], snapshot: { catalogRevision: 2 } } as never),
    );
    vi.mocked(facade.ReferenceCatalog.save).mockResolvedValueOnce({ kind: 'Saved', record: account, snapshot: { catalogRevision: 3 }, selectableAccountCount: 1 } as never);
    renderShell(facade);
    const user = userEvent.setup();
    expect(await screen.findByDisplayValue('Fidelity')).toBe(screen.getByLabelText('Institution'));
    await user.type(screen.getByLabelText('Account'), 'Roth IRA');
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText('No Planned Trades yet.')).toBeTruthy();
    expect(vi.mocked(facade.ReferenceCatalog.save).mock.calls).toEqual([[{ kind: 'CreateAccount', institutionId: 'inst-1', label: 'Roth IRA' }]]);
  });
});
