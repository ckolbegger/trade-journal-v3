// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Link, MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble, readyStatus, writableReadiness } from '../../tests/support/facade-double.ts';
import type { UiFacade } from '../app/compose.ts';
import { AppShell, type Screens } from './AppShell.tsx';
import { PageTitle } from './PageTitle.tsx';
import { AboutView } from './screens/AboutView.tsx';
import { createReleaseUpdateController } from './update/controller.ts';
import { ChannelNetwork, FakeContainer, FakeRegistration } from './update/doubles.ts';
import { useRuntime } from './runtime.tsx';

// Minimal stand-ins for the real screens, so the shell is tested on its own. The ones the storage icon
// is checked on carry a PageTitle, as the real screens do, since the icon sits on the title's row (T2.60-B4).
function AccountsStub() {
  const { writable } = useRuntime();
  return <section>{writable ? <button type="button">Add Account</button> : <p>Accounts (read only)</p>}</section>;
}
const screens: Screens = {
  trades: () => <><PageTitle>Trades</PageTitle><p>Trades screen</p></>,
  'trade-detail': () => <><PageTitle>XYZ</PageTitle><p>Trade detail</p></>,
  review: () => <p>Review screen</p>,
  'record-entry': () => <p>Record entry form</p>,
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
        <PageTitle>New Plan</PageTitle>
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

  it('should render Recovery Only with one clear reason, the failed checks, read-only navigation (Trades, Review, Accounts, About), no New Plan or Add Account control, and the separate-storage explanation (A13)', async () => {
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
    expect(Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)).toEqual(['Trades', 'Review', 'Accounts', 'About']);
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
    expect(Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)).toEqual(['Trades', 'Review', 'Accounts', 'About']);
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

describe('storage warning', () => {
  const ICON = { name: 'Storage not protected: see About' };
  const aboutScreen = (facade: UiFacade): Partial<Screens> => ({
    about: () => <AboutView facade={facade} updates={createReleaseUpdateController({ registration: new FakeRegistration(), container: new FakeContainer(), channel: new ChannelNetwork().open(), reload: () => undefined })} />,
  });

  it('should show a warning icon linking to About, named Storage not protected: see About, and no storage card, on Trades, a Detail and New Plan while protection is not Protected', async () => {
    for (const protection of ['BestEffort', 'Unavailable']) {
      for (const path of ['/', '/trades/t1', '/plans/new']) {
        const facade = facadeDouble({ status: readyStatus({ protection }) });
        renderShell(facade, path, { 'new-plan': formScreen(facade) });
        const icon = await screen.findByRole('link', ICON);
        expect(icon.getAttribute('href'), path).toBe('/about');
        expect(screen.queryByRole('region', { name: 'Storage protection' }), path).toBeNull();
        expect(screen.queryByText(/this browser may clear your journal data/i), path).toBeNull();
        expect(screen.queryByRole('button', { name: 'Ask the browser to keep data' }), path).toBeNull();
        cleanup();
      }
    }
  });

  it('should show the full storage card on About, with the explanation and Ask the browser to keep data when protection is Best Effort', async () => {
    const facade = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    renderShell(facade, '/about', aboutScreen(facade));
    const card = await screen.findByRole('region', { name: 'Storage protection' });
    expect(within(card).getByText(/this browser may clear your journal data/i)).toBeTruthy();
    expect(within(card).getByRole<HTMLButtonElement>('button', { name: 'Ask the browser to keep data' }).disabled).toBe(false);
    cleanup();

    const unavailable = facadeDouble({ status: readyStatus({ protection: 'Unavailable' }) });
    renderShell(unavailable, '/about', aboutScreen(unavailable));
    await screen.findByRole('region', { name: 'Storage protection' });
    expect(screen.queryByRole('button', { name: 'Ask the browser to keep data' })).toBeNull();
  });

  it('should show the request result on About and remove the icon once the browser agrees to keep data', async () => {
    const declined = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    vi.mocked(declined.Workspace.requestDurability).mockResolvedValue({
      kind: 'NotImproved',
      currentProtection: { kind: 'BestEffort', reason: 'HostDeclined' },
    });
    renderShell(declined, '/about', aboutScreen(declined));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ask the browser to keep data' }));
    expect(await screen.findByText(/the browser declined/i)).toBeTruthy();
    expect(screen.getByText(/this browser may clear your journal data/i)).toBeTruthy();
    expect(screen.getByRole('link', ICON)).toBeTruthy();
    cleanup();

    const improved = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    vi.mocked(improved.Workspace.requestDurability).mockResolvedValue({ kind: 'Improved', currentProtection: 'Protected' });
    renderShell(improved, '/about', aboutScreen(improved));
    expect(await screen.findByRole('link', ICON)).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Ask the browser to keep data' }));
    expect(await screen.findByText(/the browser will now keep your journal data/i)).toBeTruthy();
    expect(screen.queryByRole('link', ICON)).toBeNull();
    expect(screen.queryByText(/this browser may clear your journal data/i)).toBeNull();
  });

  it('should not recommend a backup in the storage card on About, since no backup exists before D8', async () => {
    const facade = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    renderShell(facade, '/about', aboutScreen(facade));
    const card = await screen.findByRole('region', { name: 'Storage protection' });
    expect(within(card).queryByText(/back up/i)).toBeNull();
  });

  it('should keep the decline notice and no ask button after leaving About and returning', async () => {
    const facade = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    vi.mocked(facade.Workspace.requestDurability).mockResolvedValue({
      kind: 'NotImproved',
      currentProtection: { kind: 'BestEffort', reason: 'HostDeclined' },
    });
    const Nav = () => (
      <nav>
        <Link to="/">Go to Trades</Link>
        <Link to="/about">Go to About</Link>
      </nav>
    );
    const About = aboutScreen(facade)['about']!;
    renderShell(facade, '/about', { about: () => <><Nav /><About /></> });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ask the browser to keep data' }));
    expect(await screen.findByText(/the browser declined/i)).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'Go to Trades' }));
    await screen.findByText('Trades screen');
    await user.click(screen.getByRole('link', { name: 'Storage not protected: see About' }));
    expect(await screen.findByText(/the browser declined/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ask the browser to keep data' })).toBeNull();
  });

  it('should show no warning icon on the first shell screen after a successful request during first run', async () => {
    const facade = facadeDouble({ status: readyStatus({ kind: 'InitializationRequired', protection: 'BestEffort' }) });
    vi.mocked(facade.Workspace.requestDurability).mockResolvedValue({ kind: 'Improved', currentProtection: 'Protected' });
    vi.mocked(facade.Workspace.initialize).mockResolvedValue({ kind: 'Opened', status: readyStatus({ protection: 'BestEffort' }) } as never);
    renderShell(facade);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ask the browser to keep data' }));
    await screen.findByText(/the browser will now keep your journal data/i);
    await user.click(screen.getByRole('button', { name: 'Start my journal' }));
    await screen.findByText('Trades screen');
    expect(screen.queryByRole('link', ICON)).toBeNull();
  });

  it('should show the Storage protection row as Protected on About after a successful request in the same visit', async () => {
    const facade = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    vi.mocked(facade.Workspace.requestDurability).mockResolvedValue({ kind: 'Improved', currentProtection: 'Protected' });
    renderShell(facade, '/about', aboutScreen(facade));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ask the browser to keep data' }));
    await screen.findByText(/the browser will now keep your journal data/i);
    const term = screen.getByText('Storage protection', { selector: 'dt' });
    expect(term.nextElementSibling?.textContent).toBe('Protected');
  });

  type Durable = Awaited<ReturnType<UiFacade['Workspace']['requestDurability']>>;
  function pendingRequest(facade: UiFacade) {
    const resolvers: Array<(value: Durable) => void> = [];
    vi.mocked(facade.Workspace.requestDurability).mockImplementation(
      () => new Promise<Durable>((resolve) => resolvers.push(resolve)),
    );
    return resolvers;
  }

  it('should call the facade once when the ask button is clicked twice before the request resolves', async () => {
    const facade = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    const resolvers = pendingRequest(facade);
    renderShell(facade, '/about', aboutScreen(facade));
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Ask the browser to keep data' });
    await user.click(button);
    await user.click(button);
    expect(facade.Workspace.requestDurability).toHaveBeenCalledTimes(1);
    await act(() => Promise.resolve(resolvers[0]!({ kind: 'Improved', currentProtection: 'Protected' })));
  });

  it('should disable the ask button while the request is pending', async () => {
    const facade = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    const resolvers = pendingRequest(facade);
    renderShell(facade, '/about', aboutScreen(facade));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ask the browser to keep data' }));
    // aria-disabled, not the disabled attribute: a disabled button drops keyboard focus (B3).
    expect(screen.getByRole('button', { name: 'Ask the browser to keep data' }).getAttribute('aria-disabled')).toBe('true');
    await act(() => Promise.resolve(resolvers[0]!({ kind: 'NotImproved', currentProtection: { kind: 'BestEffort', reason: 'HostDeclined' } })));
    expect(await screen.findByText(/the browser declined/i)).toBeTruthy();
  });

  it('should keep focus on the ask button while pending and call the facade once for a second press', async () => {
    const facade = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    const resolvers = pendingRequest(facade);
    renderShell(facade, '/about', aboutScreen(facade));
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Ask the browser to keep data' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await user.keyboard('{Enter}');
    expect(facade.Workspace.requestDurability).toHaveBeenCalledTimes(1);
    await act(() => Promise.resolve(resolvers[0]!({ kind: 'Improved', currentProtection: 'Protected' })));
  });

  it('should move focus to the result status when the request resolves', async () => {
    const facade = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    const resolvers = pendingRequest(facade);
    renderShell(facade, '/about', aboutScreen(facade));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ask the browser to keep data' }));
    await act(() => Promise.resolve(resolvers[0]!({ kind: 'NotImproved', currentProtection: { kind: 'BestEffort', reason: 'HostDeclined' } })));
    const status = await screen.findByText(/the browser declined/i);
    expect(status.getAttribute('role')).toBe('status');
    expect(document.activeElement).toBe(status);
    cleanup();
    const granted = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    const grantedResolvers = pendingRequest(granted);
    renderShell(granted, '/about', aboutScreen(granted));
    await user.click(await screen.findByRole('button', { name: 'Ask the browser to keep data' }));
    await act(() => Promise.resolve(grantedResolvers[0]!({ kind: 'Improved', currentProtection: 'Protected' })));
    const kept = await screen.findByText(/will now keep your journal data/i);
    expect(document.activeElement).toBe(kept);
  });

  it('should catch a rejected request, show a retry status and make the button usable again', async () => {
    const unhandled: unknown[] = [];
    const listener = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', listener);
    try {
      const facade = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
      vi.mocked(facade.Workspace.requestDurability).mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ kind: 'Improved', currentProtection: 'Protected' });
      renderShell(facade, '/about', aboutScreen(facade));
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'Ask the browser to keep data' }));
      const status = await screen.findByText("The browser didn't answer. You can try again.");
      expect(status.getAttribute('role')).toBe('status');
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
      const button = screen.getByRole('button', { name: 'Ask the browser to keep data' });
      expect(button.getAttribute('aria-disabled')).not.toBe('true');
      expect(screen.getByRole('region', { name: 'Storage protection' })).toBeTruthy();
      await user.click(button);
      expect(facade.Workspace.requestDurability).toHaveBeenCalledTimes(2);
    } finally {
      process.off('unhandledRejection', listener);
    }
  });

  it('should ignore a second request while one is pending so a later NotImproved cannot overwrite a granted result', async () => {
    const facade = facadeDouble({ status: readyStatus({ protection: 'BestEffort' }) });
    const resolvers = pendingRequest(facade);
    const Twice = () => {
      const { requestDurability } = useRuntime();
      return <button type="button" onClick={() => { requestDurability?.(); requestDurability?.(); }}>Ask twice</button>;
    };
    renderShell(facade, '/about', { about: () => <Twice /> });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ask twice' }));
    expect(facade.Workspace.requestDurability).toHaveBeenCalledTimes(1);
    await act(() => Promise.resolve(resolvers[0]!({ kind: 'Improved', currentProtection: 'Protected' })));
    expect(screen.queryByRole('link', ICON)).toBeNull();
  });

  it('should show neither icon nor card when protection is Protected', async () => {
    const facade = facadeDouble({ status: readyStatus({ protection: 'Protected' }) });
    renderShell(facade, '/about', aboutScreen(facade));
    await screen.findByRole('heading', { name: 'About' });
    expect(screen.queryByRole('link', ICON)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Storage protection' })).toBeNull();
    cleanup();
    renderShell(facadeDouble({ status: readyStatus({ protection: 'Protected' }) }));
    await screen.findByText('Trades screen');
    expect(screen.queryByRole('link', ICON)).toBeNull();
  });

  it('should keep the full card and the durability action on the first-run and onboarding screens, where About is not reachable', async () => {
    const firstRun = readyStatus({ kind: 'InitializationRequired', protection: 'BestEffort' });
    for (const status of [firstRun, readyStatus({ protection: 'BestEffort', onboarding: 'NeedsInstitutionAndAccount' })]) {
      renderShell(facadeDouble({ status }));
      expect(await screen.findByText(/this browser may clear your journal data/i), String(status.kind)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Ask the browser to keep data' })).toBeTruthy();
      expect(screen.queryByRole('link', ICON)).toBeNull();
      cleanup();
    }
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
    expect(Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)).toEqual(['Trades', 'Review', 'Accounts', 'About']);
  });
});

describe('primary navigation', () => {
  const links = (nav: HTMLElement) => Array.from(nav.querySelectorAll('a'));

  it('should mark the link of the current route, and only that link, with aria-current page in both the sidebar and the bottom bar', async () => {
    for (const width of [1280, 390]) {
      window.innerWidth = width;
      renderShell(facadeDouble(), '/accounts');
      const nav = await screen.findByRole('navigation', { name: 'Primary' });
      expect(links(nav).map((a) => [a.textContent, a.getAttribute('aria-current')])).toEqual([
        ['Trades', null],
        ['Review', null],
        ['New Plan', null],
        ['Accounts', 'page'],
        ['About', null],
      ]);
      cleanup();
    }
  });

  it('should mark Trades as current on a Trade Detail and on Record entry', async () => {
    for (const path of ['/trades/t1', '/trades/t1/record-entry']) {
      renderShell(facadeDouble(), path);
      const nav = await screen.findByRole('navigation', { name: 'Primary' });
      expect(links(nav).filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent)).toEqual(['Trades']);
      cleanup();
    }
  });

  it('should show the product name Trade Journal at the top of the wide sidebar, outside the link list', async () => {
    window.innerWidth = 1280;
    renderShell();
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    const name = screen.getByText('Trade Journal');
    expect(nav.contains(name)).toBe(true);
    expect(name.closest('a')).toBeNull();
    expect(nav.firstElementChild).toBe(name);
    cleanup();
    window.innerWidth = 390;
    renderShell();
    await screen.findByRole('navigation', { name: 'Primary' });
    expect(screen.queryByText('Trade Journal')).toBeNull();
  });

  it('should render an icon beside every label with aria-hidden, leaving every link accessible name unchanged', async () => {
    renderShell();
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    for (const link of links(nav)) {
      const icon = link.querySelector('svg');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    }
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(['Trades', 'Review', 'New Plan', 'Accounts', 'About']);
    expect(screen.getByRole('link', { name: 'New Plan' })).toBeTruthy();
  });
});

describe('migration startup states', () => {
  const base = { observedAt: '2026-10-12T14:05:00Z', installedCapabilities: facadeDouble().capabilities, protection: 'BestEffort' } as const;
  // An older stored schema seen with Writable readiness: this launch converts it (D2 P6).
  const awaitingMigration = { ...base, kind: 'IntegrityBlocked', readiness: writableReadiness, failedChecks: [], reason: 'AwaitingMigration' };

  it('should show Updating your journal to this release with no data or controls while initialize is migrating', async () => {
    const facade = facadeDouble({ status: awaitingMigration });
    vi.mocked(facade.Workspace.initialize).mockReturnValue(new Promise(() => undefined));
    renderShell(facade);
    expect((await screen.findByText(/updating your journal to this release/i)).getAttribute('role')).toBe('status');
    expect(facade.Workspace.initialize).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.queryAllByRole('link')).toEqual([]);
    expect(screen.queryByText('Trades screen')).toBeNull();
  });

  it('should render Migration Blocked with the reason, Your data is unchanged, and Retry, and no data navigation', async () => {
    const facade = facadeDouble({ status: awaitingMigration });
    vi.mocked(facade.Workspace.initialize)
      .mockResolvedValueOnce({
        kind: 'MigrationBlocked',
        stage: 'Validate',
        issues: [{ code: 'UnknownAccount', tradeId: 'trade-1', accountId: 'account-9' }],
        fromVersion: 1,
        toVersion: 2,
        unchangedData: { databaseName: 'tj-ws-1', contentRevision: 7, counts: { trades: 2 } },
        recoveryActions: [{ action: 'Retry', explanation: 'Retry the conversion.' }],
      })
      .mockResolvedValueOnce({ kind: 'Opened', status: readyStatus({ schemaVersion: 2 }) as never, receipt: {} as never });
    renderShell(facade);
    expect(await screen.findByRole('heading', { name: /your journal could not be converted to this release/i })).toBeTruthy();
    expect(screen.getByText(/a trade names an account that does not exist/i)).toBeTruthy();
    expect(screen.getByText('Your data is unchanged.')).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Retry']);
    expect(screen.queryAllByRole('link')).toEqual([]);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByText('Trades screen')).toBeNull();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Trades screen')).toBeTruthy();
    expect(facade.Workspace.initialize).toHaveBeenCalledTimes(2);
  });

  it('should render IntegrityBlocked AwaitingMigration explaining that this release must convert the journal once the browser passes its safety checks, with Retry', async () => {
    const failedChecks = [{ check: 'control', reason: 'NoController' }];
    const readiness = { ...writableReadiness, outcome: 'Unsupported', failures: failedChecks };
    const facade = facadeDouble({ status: { ...awaitingMigration, readiness, failedChecks } });
    renderShell(facade);
    expect(await screen.findByRole('heading', { name: /this release must convert your journal before you can use it/i })).toBeTruthy();
    expect(screen.getByText(/converts your journal once this browser passes its safety checks/i)).toBeTruthy();
    expect(screen.getByText(/your journal data is unchanged/i)).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringMatching(/offline component is not in control/i) as string]);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Retry']);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(facade.Workspace.initialize).not.toHaveBeenCalled();
  });

  it('should explain an aborted activation in Migration Blocked, saying the conversion could not finish and the data is unchanged', async () => {
    const facade = facadeDouble({ status: awaitingMigration });
    vi.mocked(facade.Workspace.initialize).mockResolvedValueOnce({
      kind: 'MigrationBlocked',
      stage: 'Activate',
      issues: [{ code: 'ActivationFailed' }],
      fromVersion: 1,
      toVersion: 2,
      unchangedData: { databaseName: 'tj-ws-1', contentRevision: 7, counts: { trades: 2 } },
      recoveryActions: [{ action: 'Retry', explanation: 'Retry the conversion.' }],
    });
    renderShell(facade);
    expect(await screen.findByRole('heading', { name: /your journal could not be converted to this release/i })).toBeTruthy();
    expect(screen.getByText(/the conversion could not finish, so the converted copy was discarded/i)).toBeTruthy();
    expect(screen.queryByText(/checking the converted copy found these problems/i)).toBeNull();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringMatching(/makes the converted copy your journal could not be saved/i) as string]);
    expect(screen.getByText('Your data is unchanged.')).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Retry']);
  });

  it('should re-read getStatus instead of staying on the updating message when initialize rejects during migration', async () => {
    const facade = facadeDouble({ status: awaitingMigration });
    vi.mocked(facade.Workspace.initialize).mockRejectedValueOnce(new Error('activation failed'));
    renderShell(facade);
    expect(await screen.findByRole('heading', { name: /this release must convert your journal before you can use it/i })).toBeTruthy();
    expect(screen.queryByText(/updating your journal to this release/i)).toBeNull();
    expect(facade.Workspace.getStatus).toHaveBeenCalledTimes(2);
    expect(facade.Workspace.initialize).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Retry']);
  });

  it('should show the D1 Updated in another tab message, keeping on-screen form values, when the session is superseded by a version change', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'control', reason: 'SessionSuperseded' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [],
    });
    // An entry form that records a Position Change through the facade and reports the result.
    function EntryFormStub() {
      const runtime = useRuntime();
      const [quantity, setQuantity] = useState('');
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void facade.TradeWorkflows.recordPositionChange({} as never).then((result) => runtime.report(result));
          }}
        >
          <label>
            Quantity
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <button type="submit">Save entry</button>
        </form>
      );
    }
    renderShell(facade, '/trades/trade-1/record-entry', { 'record-entry': EntryFormStub });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Quantity'), '60');
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(await screen.findByRole('heading', { name: 'Updated in another tab: reload when ready' })).toBeTruthy();
    expect(screen.getByText(/this tab can.t save any more/i)).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Quantity').value).toBe('60');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /read only: this browser can.t save right now/i })).toBeNull();
  });
});

describe('write route while not Writable', () => {
  const recoveryStatus = {
    kind: 'RecoveryOnly',
    observedAt: '2026-10-12T14:05:00Z',
    installedCapabilities: facadeDouble().capabilities,
    readiness: writableReadiness,
    protection: 'BestEffort',
    failedChecks: [{ check: 'inventory', reason: 'InventoryMissing' }],
    binding: { databaseName: 'tj-ws-1', contentRevision: 3 },
    timeZone: 'America/New_York',
  };

  it("should show a heading Record entry isn't available, an explanation that this browser can't save right now, and a link to the Trade, for a direct record-entry link", async () => {
    renderShell(facadeDouble({ status: recoveryStatus }), '/trades/trade-1/record-entry');
    expect(await screen.findByRole('heading', { name: "Record entry isn't available" })).toBeTruthy();
    expect(screen.getByText("This browser can't save right now, so an entry can't be recorded.")).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the Trade' }).getAttribute('href')).toBe('/trades/trade-1');
    expect(screen.queryByText('Record entry form')).toBeNull();
  });

  it('should show the same view after a runtime refusal mid-session, without losing the read-only banner', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue({
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'inventory', reason: 'InventoryInvalid' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [],
    });
    function RefusingPlanStub() {
      const runtime = useRuntime();
      return (
        <section>
          <button type="button" onClick={() => void facade.TradeWorkflows.confirmPlan({} as never).then((result) => runtime.report(result))}>
            Confirm Plan
          </button>
          <Link to="/trades/trade-1/record-entry">Go to entry</Link>
        </section>
      );
    }
    renderShell(facade, '/plans/new', { 'new-plan': RefusingPlanStub });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Confirm Plan' }));
    await screen.findByRole('heading', { name: /read only: this browser can.t save right now/i });
    await user.click(screen.getByRole('link', { name: 'Go to entry' }));
    expect(await screen.findByRole('heading', { name: "Record entry isn't available" })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the Trade' }).getAttribute('href')).toBe('/trades/trade-1');
    expect(screen.getByRole('heading', { name: /read only: this browser can.t save right now/i })).toBeTruthy();
  });

  it("should show Record entry isn't available on returning to the entry form after leaving the page where the refusal arrived", async () => {
    const facade = facadeDouble();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue({
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'inventory', reason: 'InventoryInvalid' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [],
    });
    function RefusingEntryStub() {
      const runtime = useRuntime();
      return (
        <section>
          <button type="button" onClick={() => void facade.TradeWorkflows.confirmPlan({} as never).then((result) => runtime.report(result))}>
            Save entry
          </button>
          <Link to="/plans/new">Leave entry</Link>
        </section>
      );
    }
    function PlanStub() {
      return <Link to="/trades/trade-1/record-entry">Return to entry</Link>;
    }
    renderShell(facade, '/trades/trade-1/record-entry', { 'record-entry': RefusingEntryStub, 'new-plan': PlanStub });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Save entry' }));
    await screen.findByRole('heading', { name: /read only: this browser can.t save right now/i });
    expect(screen.getByRole('button', { name: 'Save entry' })).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'Leave entry' }));
    await user.click(await screen.findByRole('link', { name: 'Return to entry' }));
    expect(await screen.findByRole('heading', { name: "Record entry isn't available" })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /read only: this browser can.t save right now/i })).toBeTruthy();
  });
});
