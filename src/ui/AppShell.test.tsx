// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble, readyStatus, writableReadiness } from '../../tests/support/facade-double.ts';
import type { UiFacade } from '../app/compose.ts';
import { AppShell, type Screens } from './AppShell.tsx';
import { useRuntime } from './runtime.tsx';

// Minimal stand-ins for the real screens, so the shell is tested on its own.
function AccountsStub() {
  const { writable } = useRuntime();
  return <section>{writable ? <button type="button">Add Account</button> : <p>Accounts (read only)</p>}</section>;
}
const screens: Screens = {
  trades: () => <p>Trades screen</p>,
  'trade-detail': () => <p>Trade detail</p>,
  'new-plan': () => <p>New Plan form</p>,
  accounts: AccountsStub,
  about: () => <p>About screen</p>,
  start: () => <p>Get started</p>,
};

afterEach(cleanup);

// A form that submits through the facade and reports the result to the shell.
function formScreen(facade: UiFacade) {
  return function PlanFormStub() {
    const runtime = useRuntime();
    const [underlying, setUnderlying] = useState('');
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void facade.TradeWorkflows.confirmPlan({} as never).then((result) => runtime.report(result));
        }}
      >
        <label>
          Underlying
          <input value={underlying} onChange={(e) => setUnderlying(e.target.value)} />
        </label>
        <button type="submit" disabled={!runtime.writable}>
          Confirm Plan
        </button>
      </form>
    );
  };
}

function renderShell(facade = facadeDouble(), path = '/', overrides: Partial<Screens> = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell facade={facade} screens={{ ...screens, ...overrides }} />
    </MemoryRouter>,
  );
}

describe('readiness gate presentation', () => {
  it('should show startup verification with no navigation and no mutating control while readiness is pending', () => {
    const facade = facadeDouble();
    vi.mocked(facade.Workspace.getStatus).mockReturnValue(new Promise(() => undefined));
    renderShell(facade);
    expect(screen.getByRole('status').textContent).toMatch(/checking that this browser can safely store your journal/i);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.queryAllByRole('link')).toEqual([]);
  });

  it('should render Unsupported naming every failed check in plain language, with Retry and a recommendation to try another browser, and no initialization control', async () => {
    const facade = facadeDouble({
      status: {
        kind: 'Unsupported',
        observedAt: '2026-10-12T14:05:00Z',
        installedCapabilities: facadeDouble().capabilities,
        readiness: writableReadiness,
        protection: 'BestEffort',
        failedChecks: [
          { check: 'capacity', reason: 'InsufficientQuota' },
          { check: 'control', reason: 'NoController' },
        ],
      },
    });
    renderShell(facade);
    const heading = await screen.findByRole('heading', { name: /can.t safely store your journal/i });
    expect(heading).toBeTruthy();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      expect.stringMatching(/not enough storage space/i) as string,
      expect.stringMatching(/offline component is not in control/i) as string,
    ]);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByText(/try another browser/i)).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('should render Recovery Only with one clear reason, the failed checks, read-only navigation (Trades, Accounts, About), no New Plan or Add Account control, and the separate-storage explanation (A13)', async () => {
    const facade = facadeDouble({
      status: {
        kind: 'RecoveryOnly',
        observedAt: '2026-10-12T14:05:00Z',
        installedCapabilities: facadeDouble().capabilities,
        readiness: writableReadiness,
        protection: 'BestEffort',
        failedChecks: [{ check: 'inventory', reason: 'InventoryMissing' }],
        binding: { databaseName: 'tj-ws-1', contentRevision: 3 },
        timeZone: 'America/New_York',
      },
    });
    renderShell(facade, '/accounts');
    expect(await screen.findByRole('heading', { name: /read only: this browser can.t save right now/i })).toBeTruthy();
    expect(screen.getByText(/offline copy is missing or damaged/i)).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)).toEqual(['Trades', 'Accounts', 'About']);
    expect(screen.queryByRole('button', { name: 'Add Account' })).toBeNull();
    expect(screen.getByText('Accounts (read only)')).toBeTruthy();
    expect(
      screen.getByText(
        /another browser has its own separate storage and would start an empty journal\. moving a journal between browsers needs a verified backup and restore, which this release does not offer yet\./i,
      ),
    ).toBeTruthy();
  });

  it('should render Integrity Blocked with a warning that journal data may exist, Retry as the only action, and no initialization or data navigation', async () => {
    const facade = facadeDouble({
      status: {
        kind: 'IntegrityBlocked',
        observedAt: '2026-10-12T14:05:00Z',
        installedCapabilities: facadeDouble().capabilities,
        readiness: writableReadiness,
        protection: 'BestEffort',
        failedChecks: [{ check: 'diagnostic', reason: 'ExistingRootUnreadable' }],
        root: 'PossibleRoot',
      },
    });
    renderShell(facade);
    expect(await screen.findByRole('heading', { name: /your journal data may already exist here/i })).toBeTruthy();
    expect(screen.getByText(/nothing will be created, imported, or overwritten/i)).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Retry']);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByText('Trades screen')).toBeNull();
  });

  it('should switch to Recovery Only when a mutation returns RuntimeNotWritable, keeping the open form\'s entered values on screen', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue({
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'inventory', reason: 'InventoryInvalid' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [],
    });
    renderShell(facade, '/plans/new', { 'new-plan': formScreen(facade) });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Underlying'), 'XYZ');
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(await screen.findByRole('heading', { name: /read only: this browser can.t save right now/i })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Underlying').value).toBe('XYZ');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Confirm Plan' }).disabled).toBe(true);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)).toEqual(['Trades', 'Accounts', 'About']);
  });

  it('should show "Updated in another tab: reload when ready", keeping the open form\'s entered values on screen, when the session is superseded by a version change', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue({
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'control', reason: 'SessionSuperseded' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [],
    });
    renderShell(facade, '/plans/new', { 'new-plan': formScreen(facade) });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Underlying'), 'ABC');
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(await screen.findByRole('heading', { name: 'Updated in another tab: reload when ready' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Underlying').value).toBe('ABC');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });
});

describe('storage-protection warning', () => {
  it('should keep a warning that the browser may clear data visible while protection is BestEffort or Unavailable, with every control enabled', async () => {
    for (const protection of ['BestEffort', 'Unavailable']) {
      const facade = facadeDouble({ status: readyStatus({ protection }) });
      renderShell(facade, '/plans/new', { 'new-plan': formScreen(facade) });
      expect(await screen.findByText(/this browser may clear your journal data/i)).toBeTruthy();
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Confirm Plan' }).disabled).toBe(false);
      cleanup();
    }
    renderShell(facadeDouble({ status: readyStatus({ protection: 'Protected' }) }));
    await screen.findByText('Trades screen');
    expect(screen.queryByText(/this browser may clear your journal data/i)).toBeNull();
  });

  it('should keep the warning and the durability action visible on the first-run and onboarding screens too', async () => {
    const firstRun = readyStatus({ kind: 'InitializationRequired', protection: 'BestEffort' });
    for (const status of [firstRun, readyStatus({ protection: 'BestEffort', onboarding: 'NeedsInstitutionAndAccount' })]) {
      renderShell(facadeDouble({ status }));
      expect(await screen.findByText(/this browser may clear your journal data/i), String(status.kind)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Ask the browser to keep data' })).toBeTruthy();
      cleanup();
    }
  });

  it('should offer "Ask the browser to keep data" only when the host supports storage.persist, and show the honest result after it is pressed', async () => {
    const facade = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    vi.mocked(facade.Workspace.requestDurability).mockResolvedValue({
      kind: 'NotImproved',
      currentProtection: { kind: 'BestEffort', reason: 'HostDeclined' },
    });
    renderShell(facade);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ask the browser to keep data' }));
    expect(await screen.findByText(/the browser declined/i)).toBeTruthy();
    expect(screen.getByText(/this browser may clear your journal data/i)).toBeTruthy();
    cleanup();

    const improved = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    vi.mocked(improved.Workspace.requestDurability).mockResolvedValue({ kind: 'Improved', currentProtection: 'Protected' });
    renderShell(improved);
    await user.click(await screen.findByRole('button', { name: 'Ask the browser to keep data' }));
    expect(await screen.findByText(/the browser will now keep your journal data/i)).toBeTruthy();
    expect(screen.queryByText(/this browser may clear your journal data/i)).toBeNull();
    cleanup();

    renderShell(facadeDouble({ status: readyStatus({ protection: 'Unavailable' }) }));
    await screen.findByText(/this browser may clear your journal data/i);
    expect(screen.queryByRole('button', { name: 'Ask the browser to keep data' })).toBeNull();
  });
});

describe('responsive navigation', () => {
  function resizeTo(width: number) {
    act(() => {
      window.innerWidth = width;
      window.dispatchEvent(new Event('resize'));
    });
  }

  it('should render bottom navigation below 960 px and a left sidebar at or above it', async () => {
    window.innerWidth = 959;
    renderShell();
    expect((await screen.findByRole('navigation', { name: 'Primary' })).dataset['placement']).toBe('bottom');
    cleanup();
    window.innerWidth = 960;
    renderShell();
    expect((await screen.findByRole('navigation', { name: 'Primary' })).dataset['placement']).toBe('sidebar');
  });

  it('should switch layout on a live resize without remounting the active route or losing entered form values', async () => {
    window.innerWidth = 1280;
    const facade = facadeDouble();
    let mounts = 0;
    const Form = formScreen(facade);
    const Counted = () => {
      useState(() => mounts++);
      return <Form />;
    };
    renderShell(facade, '/plans/new', { 'new-plan': Counted });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Underlying'), 'MSFT');
    resizeTo(390);
    expect(screen.getByRole('navigation', { name: 'Primary' }).dataset['placement']).toBe('bottom');
    resizeTo(1280);
    expect(screen.getByRole('navigation', { name: 'Primary' }).dataset['placement']).toBe('sidebar');
    expect(screen.getByLabelText<HTMLInputElement>('Underlying').value).toBe('MSFT');
    expect(mounts).toBe(1);
  });

  it('should list only destinations whose capabilities are in the Installed Capability Manifest', async () => {
    const facade = facadeDouble();
    const withoutConfirm = Object.fromEntries(
      Object.entries(facade.capabilities.operations).filter(([op]) => op !== 'TradeWorkflows.confirmPlan'),
    );
    const limited = { ...facade, capabilities: { ...facade.capabilities, operations: withoutConfirm } };
    renderShell(limited);
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)).toEqual(['Trades', 'Accounts', 'About']);
  });
});
