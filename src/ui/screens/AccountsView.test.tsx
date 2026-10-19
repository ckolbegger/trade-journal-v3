// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { RuntimeContext } from '../runtime.tsx';
import { AccountsView } from './AccountsView.tsx';

afterEach(cleanup);

const institutions = [
  { id: 'i-1', kind: 'Institution', label: 'Fidelity' },
  { id: 'i-2', kind: 'Institution', label: 'Schwab' },
];
const accounts = [
  { id: 'a-1', kind: 'Account', institutionId: 'i-1', label: 'Roth IRA' },
  { id: 'a-2', kind: 'Account', institutionId: 'i-2', label: 'Individual' },
  { id: 'a-3', kind: 'Account', institutionId: 'i-1', label: 'Taxable' },
];

function renderAccounts(writable: boolean) {
  const facade = facadeDouble();
  vi.mocked(facade.ReferenceCatalog.query).mockImplementation((request) =>
    Promise.resolve({
      kind: 'Page',
      items: (request.family === 'Institution' ? institutions : accounts) as never,
      snapshot: { catalogRevision: 4 },
    }),
  );
  render(
    <RuntimeContext.Provider value={{ writable, report: () => undefined }}>
      <AccountsView facade={facade} />
    </RuntimeContext.Provider>,
  );
}

describe('Accounts page', () => {
  it('should list Institutions with their Accounts and offer Add Institution and Add Account only while Writable', async () => {
    renderAccounts(true);
    const fidelity = await screen.findByRole('region', { name: 'Fidelity' });
    expect(within(fidelity).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Roth IRA', 'Taxable']);
    expect(within(screen.getByRole('region', { name: 'Schwab' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Individual',
    ]);
    expect(screen.getByRole('button', { name: 'Add Institution' })).toBeTruthy();
    expect(within(fidelity).getByRole('button', { name: 'Add Account' })).toBeTruthy();
    cleanup();

    renderAccounts(false);
    await screen.findByRole('region', { name: 'Fidelity' });
    expect(screen.queryByRole('button', { name: 'Add Institution' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Account' })).toBeNull();
  });
});
