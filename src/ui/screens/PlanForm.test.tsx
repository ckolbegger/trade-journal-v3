// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planFormFacade } from '../../../tests/support/plan-form-facade.ts';
import type { UiFacade } from '../../app/compose.ts';
import { RuntimeContext } from '../runtime.tsx';
import { PlanForm } from './PlanForm.tsx';

afterEach(cleanup);

// Stands in for Trade Detail: shows what the form handed over in navigation state.
function DetailFromState() {
  const state = useLocation().state as { confirmed?: { tradeId: string; labels: { account: string }; plan: { thesis: string } } } | null;
  return (
    <p>
      Detail {state?.confirmed?.tradeId} for {state?.confirmed?.labels.account}: {state?.confirmed?.plan.thesis}
    </p>
  );
}

function renderForm(
  facade: UiFacade = planFormFacade(),
  onDirtyChange: (dirty: boolean) => void = () => undefined,
  report: (result: { readonly kind: string }) => void = () => undefined,
) {
  render(
    <RuntimeContext.Provider value={{ writable: true, report }}>
      <MemoryRouter initialEntries={['/plans/new']}>
        <Routes>
          <Route
            path="/plans/new"
            element={<PlanForm facade={facade} timeZone="America/New_York" now={() => '2026-10-12T14:05:00Z'} onDirtyChange={onDirtyChange} />}
          />
          <Route path="/trades/:tradeId" element={<DetailFromState />} />
          <Route path="/" element={<p>Trades route</p>} />
        </Routes>
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
  return facade;
}

describe('rendering', () => {
  it('should offer only selectable Accounts and the Long Stock Strategy', async () => {
    renderForm();
    const account = await screen.findByLabelText<HTMLSelectElement>('Account');
    expect(Array.from(account.options).map((o) => o.textContent)).toEqual(['Fidelity — Roth IRA', 'Fidelity — Taxable']);
    const strategy = screen.getByLabelText<HTMLSelectElement>('Strategy');
    expect(Array.from(strategy.options).map((o) => o.textContent)).toEqual(['Long Stock']);
  });

  it('should render Plan Reflection prompts from the loaded definition revision, with Primary emotion as a radio group inside a labelled fieldset and Conviction as a 1–5 radio group', async () => {
    renderForm();
    expect(await screen.findByLabelText('Why this trade, why now?')).toBeTruthy();
    expect(screen.getByLabelText('What would invalidate the thesis?')).toBeTruthy();
    const conviction = screen.getByRole('radiogroup', { name: 'Conviction' });
    expect(within(conviction).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['1', '2', '3', '4', '5']);
    const emotion = screen.getByRole('radiogroup', { name: 'Primary emotion' });
    expect(emotion.tagName).toBe('FIELDSET');
    expect(within(emotion).getAllByRole('radio').map((r) => (r.closest('label') as HTMLElement).textContent)).toEqual([
      'Calm',
      'Eager',
      'Anxious',
      'FOMO',
      'Revenge',
      'Relieved',
      'Frustrated',
      'Other',
    ]);
  });

  it('should default Plan time to now in the Workspace zone', async () => {
    renderForm();
    const planTime = await screen.findByLabelText<HTMLInputElement>('Plan time');
    expect(planTime.type).toBe('datetime-local');
    expect(planTime.value).toBe('2026-10-12T10:05');
  });
});

async function fillPlan() {
  const user = userEvent.setup();
  await user.selectOptions(await screen.findByLabelText('Account'), 'acct-2');
  await user.type(screen.getByLabelText('Symbol'), 'xyz');
  await user.type(screen.getByLabelText('Quantity'), '100');
  await user.type(screen.getByLabelText('Intended entry'), '50.00');
  await user.type(screen.getByLabelText('Stop'), '47.50');
  await user.type(screen.getByLabelText('Target'), '56.00');
  await user.clear(screen.getByLabelText('Plan time'));
  await user.type(screen.getByLabelText('Plan time'), '2026-10-09T15:30');
  await user.type(screen.getByLabelText('Why this trade, why now?'), 'Breakout above the 50-day.');
  await user.type(screen.getByLabelText('What would invalidate the thesis?'), 'A close below 48.');
  await user.click(within(screen.getByRole('radiogroup', { name: 'Conviction' })).getByLabelText('4'));
  await user.click(within(screen.getByRole('radiogroup', { name: 'Primary emotion' })).getByLabelText('Calm'));
  return user;
}

describe('submission', () => {
  it('should submit stable Prompt and Option identities, the rendered definition revision, record revisions of the chosen references, and the entered Economic Time', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue({ kind: 'Rejected', issues: [], binding: {} } as never);
    const user = await fillPlan();
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(facade.TradeWorkflows.confirmPlan).toHaveBeenCalledWith({
      accountId: 'acct-2',
      accountRevision: 2,
      strategyId: 'strat-ls',
      strategyRevision: 1,
      economicTime: '2026-10-09T19:30:00Z',
      plan: {
        underlying: 'XYZ',
        legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50.00' }],
        stops: [{ kind: 'UnderlyingPrice', price: '47.50' }],
        targets: [{ kind: 'UnderlyingPrice', price: '56.00' }],
      },
      reflection: {
        definitionId: 'def-1',
        answers: {
          'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Breakout above the 50-day.' },
          'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close below 48.' },
          'prompt.plan-reflection.conviction': { kind: 'Scale', value: 4 },
          'prompt.plan-reflection.primary-emotion': { kind: 'Option', optionId: 'option.plan-reflection.primary-emotion.calm' },
        },
      },
    });
  });

  it('should show every rejection issue beside its field, list them in a summary, and move focus to the summary', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue({
      kind: 'Rejected',
      binding: { databaseName: 'tj-ws-1', contentRevision: 4 },
      issues: [
        { source: 'TradeAnalysis', code: 'NoPositiveRisk' },
        { source: 'Journal', field: 'prompt.plan-reflection.thesis', code: 'RequiredAnswerMissing' },
      ],
    });
    const user = await fillPlan();
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    const summary = await screen.findByRole('region', { name: 'This Plan can’t be confirmed yet' });
    expect(within(summary).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'The Stop must be below the intended entry, so the Plan has a positive risk.',
      'Answer “Why this trade, why now?”.',
    ]);
    expect(document.activeElement).toBe(summary);
    const stop = screen.getByLabelText('Stop');
    expect(document.getElementById(stop.getAttribute('aria-describedby') ?? '')?.textContent).toMatch(/stop must be below/i);
    const thesis = screen.getByLabelText('Why this trade, why now?');
    expect(document.getElementById(thesis.getAttribute('aria-describedby') ?? '')?.textContent).toMatch(/answer/i);
  });

  it('should render the confirmed Plan from the returned post-commit state, without a read call, and navigate to its Trade Detail', async () => {
    const facade = renderForm();
    const trade = {
      tradeId: 'trade-9',
      factRevision: 1,
      storedLifecycle: 'Planned',
      plan: {
        economicTime: '2026-10-09T19:30:00Z',
        underlying: 'XYZ',
        thesis: 'Breakout above the 50-day.',
        invalidation: 'A close below 48.',
        legs: [{ factId: 'f-2', side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50' }],
        stops: [{ factId: 'f-3', kind: 'UnderlyingPrice', price: '47.5' }],
        targets: [{ factId: 'f-4', kind: 'UnderlyingPrice', price: '56' }],
      },
      positionChanges: [],
    };
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue({
      kind: 'Confirmed',
      receipt: { tradeId: 'trade-9', factRevision: 1, binding: { databaseName: 'tj-ws-1', contentRevision: 9 }, createdFactIds: [], lifecycleTransitions: [], entryId: 'e-1' },
      postCommit: {
        trade,
        derivation: { tradeId: 'trade-9', factRevision: 1, expectedLifecycle: 'Planned', agreement: { kind: 'Agrees' }, positions: [], baseline: {} },
        entry: {
          id: 'e-1',
          entryTypeKey: 'entry-type.plan-reflection',
          sourceKey: 'source.plan-confirmation',
          anchor: { kind: 'Trade', tradeId: 'trade-9' },
          origin: { kind: 'Plan', factId: 'f-1' },
          momentTime: '2026-10-09T19:30:00Z',
          authoredTime: '2026-10-12T14:05:00Z',
          definitionId: 'def-1',
          responses: [],
        },
      },
      affected: [],
    } as never);
    const user = await fillPlan();
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(await screen.findByText('Detail trade-9 for Taxable: Breakout above the 50-day.')).toBeTruthy();
    expect(facade.TradeViewsAndReporting.getTradeDetail).not.toHaveBeenCalled();
  });

  it('should report a RuntimeNotWritable result to the shell and keep every entered value on screen', async () => {
    const report = vi.fn();
    const facade = renderForm(planFormFacade(), () => undefined, report);
    const refusal = {
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'inventory', reason: 'InventoryMissing' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [],
    };
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue(refusal as never);
    const user = await fillPlan();
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(refusal));
    expect(screen.getByLabelText<HTMLInputElement>('Symbol').value).toBe('xyz');
    expect(screen.queryByText('Trades route')).toBeNull();
  });

  it('should make no call when the form is cancelled or left', async () => {
    const facade = renderForm();
    const user = await fillPlan();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Trades route')).toBeTruthy();
    expect(facade.TradeWorkflows.confirmPlan).not.toHaveBeenCalled();
    expect(facade.ReferenceCatalog.save).not.toHaveBeenCalled();
    expect(facade.Workspace.initialize).not.toHaveBeenCalled();
  });

  it('should register as unsaved while any value differs from its initial value', async () => {
    const dirty = vi.fn();
    renderForm(planFormFacade(), dirty);
    const user = userEvent.setup();
    const symbol = await screen.findByLabelText('Symbol');
    expect(dirty).not.toHaveBeenCalledWith(true);
    await user.type(symbol, 'X');
    expect(dirty).toHaveBeenLastCalledWith(true);
    await user.clear(symbol);
    expect(dirty).toHaveBeenLastCalledWith(false);
    await user.click(within(screen.getByRole('radiogroup', { name: 'Primary emotion' })).getByLabelText('Calm'));
    expect(dirty).toHaveBeenLastCalledWith(true);
  });
});
