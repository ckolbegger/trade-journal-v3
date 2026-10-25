import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { workspaceFixture } from '../fixtures';
import { App } from '../../src/presentation/App';
import { TradeViewsAndReporting } from '../../src/application/trade-views-and-reporting';
import { Journal } from '../../src/domain/journal';
afterEach(cleanup);
async function draftFixture() {
  const f = await workspaceFixture();
  const confirmed = await f.workflows.confirmPlan({ ...f.command, plan: { ...f.command.plan, quantity: '10' } });
  if (confirmed.status !== 'Confirmed') throw new Error(confirmed.status);
  const user = userEvent.setup();
  render(<App services={{ workspace: f.workspace, catalog: f.catalog, workflows: f.workflows, views: new TradeViewsAndReporting(f.store), journal: new Journal(f.store, f.runtime) }} />);
  await user.click(await screen.findByRole('button', { name: /XYZ · Planned/ }));
  await user.click(await screen.findByRole('button', { name: 'Record initial Position Change' }));
  await user.type(screen.getByLabelText('Execution 1 quantity (shares)'), '10');
  await user.type(screen.getByLabelText('Execution 1 price (USD)'), '50');
  await user.click(screen.getByRole('button', { name: /Add (Execution|another execution)/ }));
  return { ...f, user, confirmed };
}
it('labels retained rows and removal as unsaved while authoritative Trade stays Planned', async () => {
  const f = await draftFixture();
  expect(screen.getAllByText(/Execution \d · Buy XYZ · Unsaved/)).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Remove draft row 2' })).toBeTruthy();
  expect(await new TradeViewsAndReporting(f.store).getTradeDetail(f.confirmed.trade.tradeId)).toMatchObject({ status: 'Ready', trade: { lifecycle: 'Planned' } });
  cleanup(); f.store.close();
});
it('identifies blank Execution 2 fields and Nothing saved with all authority unchanged', async () => {
  const f = await draftFixture();
  const before = { roots: await f.store.roots.toArray(), versions: await f.store.versions.toArray(), lifecycle: await f.store.lifecycle.toArray() };
  await f.user.click(screen.getByRole('button', { name: /Save (initial Position Change|opening entry)/ }));
  expect(await screen.findByText('Nothing saved — Execution 2 needs a quantity and price')).toBeTruthy();
  expect(screen.getByLabelText('Execution 2 quantity (shares)').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByLabelText('Execution 2 price (USD)').getAttribute('aria-invalid')).toBe('true');
  expect({ roots: await f.store.roots.toArray(), versions: await f.store.versions.toArray(), lifecycle: await f.store.lifecycle.toArray() }).toEqual(before);
  cleanup(); f.store.close();
});
it('returns to Detail with draft continuation and restores identical rejected input and form errors', async () => {
  const f = await draftFixture();
  await f.user.click(screen.getByRole('button', { name: /Save (initial Position Change|opening entry)/ }));
  await screen.findByText('Nothing saved — Execution 2 needs a quantity and price');
  await f.user.click(screen.getByRole('button', { name: 'Close opening entry' }));
  await f.user.click(screen.getByRole('button', { name: 'Trades' }));
  await f.user.click(await screen.findByRole('button', { name: /XYZ · Planned/ }));
  expect(await screen.findByText('Unsaved entry draft')).toBeTruthy();
  expect(screen.queryByText('Nothing saved — Execution 2 needs a quantity and price')).toBeNull();
  await f.user.click(screen.getByRole('button', { name: 'Continue unsaved entry' }));
  expect(screen.getByLabelText<HTMLInputElement>('Execution 1 quantity (shares)').value).toBe('10');
  expect(screen.getByLabelText<HTMLInputElement>('Execution 2 quantity (shares)').value).toBe('');
  expect(screen.getByText('Nothing saved — Execution 2 needs a quantity and price')).toBeTruthy();
  cleanup(); f.store.close();
});
it('opens one named contextual dialog and Close retains its draft with one active navigation destination', async () => {
  const f = await draftFixture();
  expect(screen.getByRole('dialog', { name: 'Opening entry' }).getAttribute('aria-modal')).toBe('true');
  await f.user.click(screen.getByRole('button', { name: 'Close opening entry' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'Continue unsaved entry' })).toBeTruthy();
  expect(document.querySelectorAll('nav [aria-current="page"]')).toHaveLength(1);
  await f.user.click(screen.getByRole('button', { name: 'Continue unsaved entry' }));
  expect(screen.getByLabelText<HTMLInputElement>('Execution 1 quantity (shares)').value).toBe('10');
  cleanup(); f.store.close();
});
it('shows recorded Executions and saved count only after the complete opening commits', async () => {
  const f = await draftFixture();
  await f.user.click(screen.getByRole('button', { name: 'Remove draft row 2' }));
  await f.user.click(screen.getByRole('button', { name: /Save (initial Position Change|opening entry)/ }));
  expect(await screen.findByRole('heading', { name: 'XYZ · Open' })).toBeTruthy();
  expect(screen.getByText('Opening entry saved · 1 Executions')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Recorded Executions' })).toBeTruthy();
  expect(screen.queryByText('Unsaved entry draft')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Continue unsaved entry' })).toBeNull();
  cleanup(); f.store.close();
});
it('links row-specific blank errors to stable inputs and focuses a surviving row after removal', async () => {
  const f = await draftFixture();
  await f.user.click(screen.getByRole('button', { name: /Save (initial Position Change|opening entry)/ }));
  await screen.findByText('Nothing saved — Execution 2 needs a quantity and price');
  await f.user.click(screen.getByRole('button', { name: 'Go to Execution 2 quantity' }));
  expect(document.activeElement).toBe(screen.getByLabelText('Execution 2 quantity (shares)'));
  expect(screen.getByLabelText('Execution 1 quantity (shares)').getAttribute('aria-invalid')).not.toBe('true');
  await f.user.click(screen.getByRole('button', { name: 'Remove draft row 1' }));
  expect(document.activeElement).toBe(screen.getByLabelText('Execution 1 quantity (shares)'));
  expect(screen.getByLabelText('Execution 1 quantity (shares)').getAttribute('aria-invalid')).toBe('true');
  cleanup(); f.store.close();
});
it('freezes conflicting editing and dismissal while Saving and only then shows committed Open state', async () => {
  const f = await draftFixture();
  await f.user.click(screen.getByRole('button', { name: 'Remove draft row 2' }));
  const check = f.runtime.host.check.bind(f.runtime.host);
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.runtime.host.check = async () => { await gate; return check(f.store); };
  try {
    await f.user.click(screen.getByRole('button', { name: /Save (initial Position Change|opening entry)/ }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Saving…' }).disabled).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Execution 1 quantity (shares)').matches(':disabled')).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Close opening entry' }).disabled).toBe(true);
    const dialog = screen.getByRole('dialog', { name: 'Opening entry' });
    expect(document.activeElement).toBe(dialog);
    expect(dialog.tabIndex).toBe(0);
    await f.user.tab(); expect(document.activeElement).toBe(dialog);
    await f.user.tab({ shift: true }); expect(document.activeElement).toBe(dialog);
    expect(screen.queryByRole('heading', { name: 'XYZ · Open' })).toBeNull();
  } finally { release(); }
  expect(await screen.findByRole('heading', { name: 'XYZ · Open' })).toBeTruthy();
  cleanup(); f.store.close();
});
it('moves Plan stages without writing facts or losing the chosen instrument and reflection', async () => {
  const f = await workspaceFixture(); const user = userEvent.setup();
  render(<App services={{ workspace: f.workspace, catalog: f.catalog, workflows: f.workflows, views: new TradeViewsAndReporting(f.store), journal: new Journal(f.store, f.runtime) }} />);
  await user.click(await screen.findByRole('button', { name: 'New Plan' }));
  await user.type(screen.getByLabelText('Stock symbol'), 'XYZ');
  expect(screen.queryByLabelText('Quantity (shares)')).toBeNull();
  const before = await f.store.versions.toArray();
  await user.click(screen.getByRole('button', { name: 'Next: Plan and reflection' }));
  await user.type(screen.getByLabelText('Why this trade, why now?'), 'Retained thesis');
  await user.click(screen.getByRole('button', { name: 'Back to instrument' }));
  expect(screen.getByLabelText<HTMLInputElement>('Stock symbol').value).toBe('XYZ');
  await user.click(screen.getByRole('button', { name: 'Next: Plan and reflection' }));
  expect(screen.getByLabelText<HTMLTextAreaElement>('Why this trade, why now?').value).toBe('Retained thesis');
  expect(await f.store.versions.toArray()).toEqual(before);
  cleanup(); f.store.close();
});
it('retains owed answers and rejected form errors across Close and resume from Journal Debt', async () => {
  const f = await workspaceFixture(); const saved = await f.workflows.confirmPlan(f.command);
  if (saved.status !== 'Confirmed') throw new Error(saved.status);
  const root = await f.store.roots.get('active'); if (!root) throw new Error('Missing Workspace');
  await f.workflows.recordPositionChange({ kind: 'InitialStockEntry', generation: root.generation, expectedWorkspaceRevision: root.revision, expectedCatalogRevision: root.catalogRevision, tradeId: saved.trade.tradeId, expectedTradeRevision: saved.trade.revision, plannedLegId: saved.trade.plannedLegId, definitionRevision: 'position-change-reflection-v1', economicTime: '2026-10-18T20:00:00Z', executions: [{ instrument: { kind: 'Stock', symbol: 'XYZ', currency: 'USD' }, action: 'Buy', quantity: '100', price: '50', fee: '0', economicTime: '2026-10-18T20:00:00Z', plannedLegId: saved.trade.plannedLegId }], reflection: { kind: 'Defer' } });
  const user = userEvent.setup();
  render(<App services={{ workspace: f.workspace, catalog: f.catalog, workflows: f.workflows, views: new TradeViewsAndReporting(f.store), journal: new Journal(f.store, f.runtime) }} />);
  await user.click(await screen.findByRole('button', { name: 'Journal Debt' }));
  await user.click(await screen.findByRole('button', { name: 'Answer reflection' }));
  await user.type(screen.getByLabelText('Note (optional)'), 'Retained answer');
  await user.click(screen.getByRole('button', { name: 'Save Debt outcome' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Close answer journal debt' }));
  await user.click(screen.getByRole('button', { name: 'Answer reflection' }));
  expect(screen.getByLabelText<HTMLTextAreaElement>('Note (optional)').value).toBe('Retained answer');
  expect(screen.getByRole('alert').textContent).toContain('Nothing saved');
  cleanup(); f.store.close();
});
it('opens saved Trade Journal in a contextual panel with original source and moment', async () => {
  const f = await draftFixture();
  await f.user.click(screen.getByRole('button', { name: 'Cancel' }));
  await f.user.click(screen.getByRole('button', { name: 'View Trade Journal' }));
  expect(screen.getByRole('dialog', { name: 'Trade Journal' }).textContent).toContain('Plan Confirmation');
  expect(screen.getByRole('dialog', { name: 'Trade Journal' }).textContent).toContain('Moment:');
  await f.user.click(screen.getByRole('button', { name: 'Close trade journal' }));
  expect(screen.getByRole('heading', { name: 'XYZ · Planned' })).toBeTruthy();
  cleanup(); f.store.close();
});
it('freezes owed answers and Cancel during the atomic Debt Save', async () => {
  const { openingFixture } = await import('../d02-fixtures'); const f = await openingFixture();
  await f.workflows.recordPositionChange({ ...f.command, reflection: { kind: 'Defer' } });
  const user = userEvent.setup();
  render(<App services={{ workspace: f.workspace, catalog: f.catalog, workflows: f.workflows, views: new TradeViewsAndReporting(f.store), journal: new Journal(f.store, f.runtime) }} />);
  await user.click(await screen.findByRole('button', { name: 'Journal Debt' }));
  await user.click(await screen.findByRole('button', { name: 'Answer reflection' }));
  await user.click(screen.getByLabelText('Decline owed reflection'));
  const check = f.runtime.host.check.bind(f.runtime.host); let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.runtime.host.check = async store => { await gate; return check(store); };
  try {
    await user.click(screen.getByRole('button', { name: 'Save Debt outcome' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Saving…' }).disabled).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Decline reason (optional)').matches(':disabled')).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Answer Journal Debt' }));
  } finally { release(); }
  await screen.findByRole('heading', { name: 'Journal Debt settled' });
  cleanup(); f.store.close();
});
it('returns from a newly confirmed Plan to a current bounded Planned list', async () => {
  const f = await workspaceFixture(); const user = userEvent.setup();
  render(<App services={{ workspace: f.workspace, catalog: f.catalog, workflows: f.workflows, views: new TradeViewsAndReporting(f.store), journal: new Journal(f.store, f.runtime) }} />);
  await user.click(await screen.findByRole('button', { name: 'New Plan' }));
  await user.click(screen.getByRole('button', { name: 'Next: Plan and reflection' }));
  for (const [label, value] of [['Stock symbol', 'XYZ'], ['Quantity (shares)', '10'], ['Intended entry (USD)', '50'], ['Stop (underlying price, USD)', '45'], ['Target (underlying price, USD)', '60'], ['Why this trade, why now?', 'Synthetic thesis'], ['What would invalidate the thesis?', 'Synthetic invalidation']]) await user.type(screen.getByLabelText(label), value);
  await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
  await screen.findByRole('heading', { name: 'XYZ · Planned' });
  await user.click(screen.getByRole('button', { name: /Back to Trades/ }));
  expect(await screen.findByRole('button', { name: /XYZ · Planned/ })).toBeTruthy();
  cleanup(); f.store.close();
});
it('shows a saved explicit decline in Trade Journal without creating an Entry or writing on open', async () => {
  const { openingFixture } = await import('../d02-fixtures'); const f = await openingFixture();
  const saved = await f.workflows.recordPositionChange({ ...f.command, reflection: { kind: 'Decline', reason: 'No reflection to add' } });
  expect(saved.status).toBe('Recorded');
  const before = { roots: await f.store.roots.toArray(), versions: await f.store.versions.toArray(), lifecycle: await f.store.lifecycle.toArray() };
  const user = userEvent.setup();
  render(<App services={{ workspace: f.workspace, catalog: f.catalog, workflows: f.workflows, views: new TradeViewsAndReporting(f.store), journal: new Journal(f.store, f.runtime) }} />);
  await user.click(await screen.findByRole('button', { name: 'Open' }));
  await user.click(await screen.findByRole('button', { name: /XYZ · Open/ }));
  await user.click(await screen.findByRole('button', { name: 'View Trade Journal' }));
  const journal = screen.getByRole('dialog', { name: 'Trade Journal' });
  expect(journal.textContent).toContain('Position Change Reflection · Explicit decline');
  expect(journal.textContent).toContain('Declined');
  expect(journal.textContent).toContain('No reflection to add');
  expect(journal.textContent).toContain('Source Position Change');
  expect({ roots: await f.store.roots.toArray(), versions: await f.store.versions.toArray(), lifecycle: await f.store.lifecycle.toArray() }).toEqual(before);
  cleanup(); f.store.close();
});
it('keeps the latest lifecycle list when an older Planned read finishes after Open', async () => {
  const { openingFixture } = await import('../d02-fixtures'); const f = await openingFixture();
  expect((await f.workflows.recordPositionChange(f.command)).status).toBe('Recorded');
  expect((await f.workflows.confirmPlan(f.planCommand)).status).toBe('Confirmed');
  const views = new TradeViewsAndReporting(f.store); const user = userEvent.setup();
  render(<App services={{ workspace: f.workspace, catalog: f.catalog, workflows: f.workflows, views, journal: new Journal(f.store, f.runtime) }} />);
  await screen.findByRole('button', { name: /XYZ · Planned/ });
  const read = views.browseTrades.bind(views); let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let delayed: ReturnType<typeof read> | undefined;
  views.browseTrades = request => {
    if (request?.lifecycle === 'Planned') { delayed = gate.then(() => read(request)); return delayed; }
    return read(request);
  };
  try {
    await user.click(screen.getByRole('button', { name: 'Trades' }));
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('button', { name: /XYZ · Open/ });
    await act(async () => { release(); await delayed; });
    expect(screen.getByRole('button', { name: 'Open' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: /XYZ · Planned/ })).toBeNull();
    expect(screen.getByRole('button', { name: /XYZ · Open/ })).toBeTruthy();
  } finally { release(); }
  cleanup(); f.store.close();
});
