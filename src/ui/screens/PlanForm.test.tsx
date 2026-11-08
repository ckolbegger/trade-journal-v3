// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { payoffFixtures } from '../../../tests/support/payoff-fixtures.ts';
import { planFormFacade } from '../../../tests/support/plan-form-facade.ts';
import type { UiFacade } from '../../app/compose.ts';
import { Rational } from '../../domain/values/index.ts';
import { money } from '../format.ts';
import { RuntimeContext } from '../runtime.tsx';
import { handedOverConfirmed } from './confirmed-handoff.ts';
import { PlanForm } from './PlanForm.tsx';
import { TradeDetail } from './TradeDetail.tsx';

afterEach(cleanup);

// Stands in for Trade Detail: shows what the form handed over, and keeps the navigation state it arrived with.
let navigationState: unknown;
function DetailFromState() {
  const state: unknown = useLocation().state;
  useEffect(() => {
    navigationState = state;
  });
  const confirmed = handedOverConfirmed(useParams().tradeId ?? '');
  return (
    <>
      <p>
        Detail {confirmed?.tradeId} for {confirmed?.labels.account}: {confirmed?.plan.thesis}
      </p>
      {confirmed?.baseline.oneR && <p>1R {money(confirmed.baseline.oneR)}</p>}
    </>
  );
}

function renderForm(
  facade: UiFacade = planFormFacade(),
  onDirtyChange: (dirty: boolean) => void = () => undefined,
  report: (result: { readonly kind: string }) => void = () => undefined,
  now: () => string = () => '2026-10-12T14:05:00Z',
) {
  render(
    <RuntimeContext.Provider value={{ writable: true, report }}>
      <MemoryRouter initialEntries={['/plans/new']}>
        <Routes>
          <Route
            path="/plans/new"
            element={<PlanForm facade={facade} timeZone="America/New_York" now={now} onDirtyChange={onDirtyChange} />}
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

  it('should preselect Long Stock by product key when option Strategies are installed and sort first', async () => {
    const base = planFormFacade();
    const query = vi.mocked(base.ReferenceCatalog.query).getMockImplementation()!;
    const facade = {
      ...base,
      capabilities: { ...base.capabilities, strategies: ['strategy.cash-secured-put', 'strategy.long-stock'] },
    } as unknown as UiFacade;
    vi.mocked(facade.ReferenceCatalog.query).mockImplementation(async (request) => {
      const page = await query(request);
      if (request.family !== 'Strategy' || page.kind !== 'Page') return page;
      const csp = { id: 'strat-csp', kind: 'Strategy', label: 'Cash-Secured Put', productKey: 'strategy.cash-secured-put', recordRevision: 1 };
      return { ...page, items: [csp, ...page.items] as never };
    });
    renderForm(facade);
    const strategy = await screen.findByLabelText<HTMLSelectElement>('Strategy');
    await vi.waitFor(() => expect(strategy.options.length).toBe(2));
    expect(strategy.options[0]!.textContent).toBe('Cash-Secured Put');
    expect(strategy.selectedOptions[0]!.textContent).toBe('Long Stock');
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

// `planTime` null leaves the Plan time as the form defaulted it.
async function fillPlan(planTime: string | null = '2026-10-09T15:30') {
  const user = userEvent.setup();
  await user.selectOptions(await screen.findByLabelText('Account'), 'acct-2');
  await user.type(screen.getByLabelText('Symbol'), 'xyz');
  await user.type(screen.getByLabelText('Quantity'), '100');
  await user.type(screen.getByLabelText('Intended entry'), '50.00');
  await user.type(screen.getByLabelText('Stop'), '47.50');
  await user.type(screen.getByLabelText('Target'), '56.00');
  if (planTime !== null) {
    await user.clear(screen.getByLabelText('Plan time'));
    if (planTime !== '') await user.type(screen.getByLabelText('Plan time'), planTime);
  }
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

describe('New Plan issues', () => {
  const analysis = (code: string) => ({ source: 'TradeAnalysis', code });
  const rejection = (issues: readonly object[]) =>
    ({ kind: 'Rejected', binding: { databaseName: 'tj-ws-1', contentRevision: 4 }, issues }) as never;
  const described = (element: HTMLElement) => document.getElementById(element.getAttribute('aria-describedby') ?? '')?.textContent;

  it('should remove a field issue and its summary line once that field is edited to a valid value, without submitting, but keep a server issue until the next submit', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue(
      rejection([analysis('MissingStop'), { source: 'ReferenceCatalog', field: 'accountId', code: 'AccountNotSelectable' }]),
    );
    const user = await fillPlan();
    await user.clear(screen.getByLabelText('Stop'));
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    const summary = await screen.findByRole('region', { name: 'This Plan can’t be confirmed yet' });
    expect(within(summary).getAllByRole('listitem')).toHaveLength(2);
    const stop = screen.getByLabelText('Stop');
    expect(described(stop)).toMatch(/enter a stop/i);

    // An edit that is still not a price leaves the issue.
    await user.type(stop, 'x');
    expect(described(stop)).toMatch(/enter a stop/i);
    await user.clear(stop);
    await user.type(stop, '47.50');
    expect(stop.getAttribute('aria-describedby')).toBeNull();
    expect(stop.getAttribute('aria-invalid')).toBeNull();
    expect(within(summary).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Choose an available Account and Strategy.']);
    expect(facade.TradeWorkflows.confirmPlan).toHaveBeenCalledTimes(1);

    // The server's issue about the Account is not re-checked by the form: it waits for the next submit.
    await user.selectOptions(screen.getByLabelText('Account'), 'acct-1');
    expect(within(summary).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Choose an available Account and Strategy.']);
  });

  it('should keep the summary, with the remaining issues, while any issue remains, and remove it when none remain', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue(
      rejection([analysis('MissingStop'), analysis('MissingTarget'), { source: 'Journal', field: 'prompt.plan-reflection.thesis', code: 'RequiredAnswerMissing' }]),
    );
    const user = await fillPlan();
    await user.clear(screen.getByLabelText('Stop'));
    await user.clear(screen.getByLabelText('Target'));
    await user.clear(screen.getByLabelText('Why this trade, why now?'));
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    const summary = await screen.findByRole('region', { name: 'This Plan can’t be confirmed yet' });
    const lines = () => within(summary).queryAllByRole('listitem').map((li) => li.textContent);
    expect(lines()).toEqual(['Enter a Stop.', 'Enter a Target.', 'Answer “Why this trade, why now?”.']);

    await user.type(screen.getByLabelText('Stop'), '47.50');
    expect(lines()).toEqual(['Enter a Target.', 'Answer “Why this trade, why now?”.']);
    await user.type(screen.getByLabelText('Target'), '56.00');
    expect(lines()).toEqual(['Answer “Why this trade, why now?”.']);
    await user.type(screen.getByLabelText('Why this trade, why now?'), 'B');
    expect(screen.queryByRole('region', { name: 'This Plan can’t be confirmed yet' })).toBeNull();
    expect(screen.getByLabelText('Why this trade, why now?').getAttribute('aria-describedby')).toBeNull();
  });

  it('should not move focus when an issue clears', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue(rejection([analysis('MissingStop'), analysis('MissingTarget')]));
    const user = await fillPlan();
    await user.clear(screen.getByLabelText('Stop'));
    await user.clear(screen.getByLabelText('Target'));
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    const summary = await screen.findByRole('region', { name: 'This Plan can’t be confirmed yet' });
    expect(document.activeElement).toBe(summary);

    const stop = screen.getByLabelText('Stop');
    await user.type(stop, '47.50');
    expect(document.activeElement).toBe(stop);
    await user.click(screen.getByLabelText('Symbol'));
    await user.type(screen.getByLabelText('Target'), '56.00');
    expect(document.activeElement).toBe(screen.getByLabelText('Target'));
  });

  it.each([['Stop'], ['Target']])('should attach the price issue to a blank %s, not to the valid Intended entry', async (blank) => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue(rejection([analysis('InvalidPrice')]));
    const user = await fillPlan();
    await user.clear(screen.getByLabelText(blank));
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    await screen.findByRole('region', { name: 'This Plan can’t be confirmed yet' });
    const field = screen.getByLabelText(blank);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(described(field)).toMatch(/price greater than zero/i);
    for (const other of ['Intended entry', 'Stop', 'Target'].filter((name) => name !== blank)) {
      expect(screen.getByLabelText(other).getAttribute('aria-invalid')).toBeNull();
      expect(screen.getByLabelText(other).getAttribute('aria-describedby')).toBeNull();
    }
    // One summary line for the one failing field.
    expect(within(screen.getByRole('region', { name: 'This Plan can’t be confirmed yet' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('should attach the price issue to every price that fails, and clear each as its own price becomes valid', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue(rejection([analysis('InvalidPrice')]));
    const user = await fillPlan();
    await user.clear(screen.getByLabelText('Stop'));
    await user.clear(screen.getByLabelText('Target'));
    await user.type(screen.getByLabelText('Target'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    await screen.findByRole('region', { name: 'This Plan can’t be confirmed yet' });
    const [entry, stop, target] = ['Intended entry', 'Stop', 'Target'].map((name) => screen.getByLabelText(name));
    expect(entry!.getAttribute('aria-invalid')).toBeNull();
    expect(described(stop!)).toMatch(/Stop price greater than zero/);
    expect(described(target!)).toMatch(/Target price greater than zero/);

    // The Stop alone is corrected: its issue goes, the Target's stays with the summary.
    await user.type(stop!, '47.50');
    expect(stop!.getAttribute('aria-describedby')).toBeNull();
    expect(stop!.getAttribute('aria-invalid')).toBeNull();
    expect(described(target!)).toMatch(/Target price greater than zero/);
    expect(within(screen.getByRole('region', { name: 'This Plan can’t be confirmed yet' })).getAllByRole('listitem')).toHaveLength(1);
    await user.clear(target!);
    await user.type(target!, '56.00');
    expect(target!.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('region', { name: 'This Plan can’t be confirmed yet' })).toBeNull();
  });

  it('should clear a MissingInstrument issue only when the symbol matches the symbol rule', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue(rejection([analysis('MissingInstrument')]));
    const user = await fillPlan();
    await user.clear(screen.getByLabelText('Symbol'));
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    await screen.findByRole('region', { name: 'This Plan can’t be confirmed yet' });
    const symbol = screen.getByLabelText('Symbol');
    await user.type(symbol, '1X');
    expect(described(symbol)).toMatch(/stock symbol/i);
    await user.clear(symbol);
    await user.type(symbol, 'brk.b');
    expect(symbol.getAttribute('aria-describedby')).toBeNull();
  });

  it('should keep a required Prompt issue while a Text answer is only whitespace', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue(
      rejection([{ source: 'Journal', field: 'prompt.plan-reflection.thesis', code: 'RequiredAnswerMissing' }]),
    );
    const user = await fillPlan();
    await user.clear(screen.getByLabelText('Why this trade, why now?'));
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    await screen.findByRole('region', { name: 'This Plan can’t be confirmed yet' });
    await user.type(screen.getByLabelText('Why this trade, why now?'), '   ');
    expect(screen.getByRole('region', { name: 'This Plan can’t be confirmed yet' })).toBeTruthy();
    await user.type(screen.getByLabelText('Why this trade, why now?'), 'B');
    expect(screen.queryByRole('region', { name: 'This Plan can’t be confirmed yet' })).toBeNull();
  });

  it('should compare the Stop and entry as exact decimals, not floating point numbers', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue(rejection([analysis('NoPositiveRisk')]));
    const user = await fillPlan();
    for (const [label, value] of [['Intended entry', '10000000000.000002'], ['Stop', '10000000000.000003']] as const) {
      await user.clear(screen.getByLabelText(label));
      await user.type(screen.getByLabelText(label), value);
    }
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    await screen.findByRole('region', { name: 'This Plan can’t be confirmed yet' });
    const stop = screen.getByLabelText('Stop');
    await user.clear(stop);
    await user.type(stop, '10000000000.000001');
    expect(stop.getAttribute('aria-describedby')).toBeNull();
    await user.clear(stop);
    await user.type(stop, '10000000000.000002');
    expect(described(stop)).toMatch(/below the intended entry/i);
  });
});

// 2026-11-01 01:00 to 02:00 America/New_York happens twice (clocks fall back at 02:00 EDT).
describe('Plan time during a fall-back hour', () => {
  const described = (element: HTMLElement) => document.getElementById(element.getAttribute('aria-describedby') ?? '')?.textContent;
  const summaryLines = async () =>
    within(await screen.findByRole('region', { name: 'This Plan can’t be confirmed yet' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);

  // The form at a fixed clock; a Plan that reaches the Workspace is refused, so nothing navigates.
  const renderAt = (instant: string) => {
    const facade = renderForm(planFormFacade(), undefined, undefined, () => instant);
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue({ kind: 'Rejected', issues: [], binding: {} } as never);
    return facade;
  };

  it('should confirm the Plan at the exact default instant when its Plan time is left unedited during a fall-back hour', async () => {
    const facade = renderAt('2026-11-01T05:26:00Z');
    expect((await screen.findByLabelText<HTMLInputElement>('Plan time')).value).toBe('2026-11-01T01:26');
    const user = await fillPlan(null);
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(facade.TradeWorkflows.confirmPlan).toHaveBeenCalledTimes(1);
    expect(vi.mocked(facade.TradeWorkflows.confirmPlan).mock.calls[0]![0].economicTime).toBe('2026-11-01T05:26:00Z');
  });

  it('should confirm the Plan at the second occurrence when the default instant is in the repeated hour', async () => {
    const facade = renderAt('2026-11-01T06:26:30Z');
    const user = await fillPlan(null);
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(vi.mocked(facade.TradeWorkflows.confirmPlan).mock.calls[0]![0].economicTime).toBe('2026-11-01T06:26:00Z');
  });

  it('should show why and write nothing when an edited Plan time occurs twice at a fall-back', async () => {
    const facade = renderAt('2026-11-01T05:26:00Z');
    const user = await fillPlan('2026-11-01T01:30');
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(await summaryLines()).toEqual(['The Plan time occurs twice because clocks fall back; enter an earlier or later time.']);
    const planTime = screen.getByLabelText('Plan time');
    expect(planTime.getAttribute('aria-invalid')).toBe('true');
    expect(described(planTime)).toMatch(/occurs twice because clocks fall back/);
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'This Plan can’t be confirmed yet' }));
    expect(facade.TradeWorkflows.confirmPlan).not.toHaveBeenCalled();
  });

  it('should show why and write nothing when an edited Plan time does not exist because clocks spring forward', async () => {
    const facade = renderAt('2026-11-01T05:26:00Z');
    const user = await fillPlan('2026-03-08T02:30');
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(await summaryLines()).toEqual(['The Plan time does not exist because clocks spring forward; enter an earlier or later time.']);
    expect(described(screen.getByLabelText('Plan time'))).toMatch(/does not exist because clocks spring forward/);
    expect(facade.TradeWorkflows.confirmPlan).not.toHaveBeenCalled();
  });

  it('should show why and write nothing when the Plan time is cleared', async () => {
    const facade = renderAt('2026-11-01T05:26:00Z');
    const user = await fillPlan('');
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(await summaryLines()).toEqual(['The Plan time is not a valid date and time; enter one.']);
    expect(described(screen.getByLabelText('Plan time'))).toMatch(/not a valid date and time/);
    expect(facade.TradeWorkflows.confirmPlan).not.toHaveBeenCalled();
  });

  it('should resolve a Plan time retyped to the default text as typed, not as the default instant', async () => {
    const facade = renderAt('2026-11-01T05:26:00Z');
    const user = await fillPlan('2026-11-01T01:26');
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(await summaryLines()).toHaveLength(1);
    expect(facade.TradeWorkflows.confirmPlan).not.toHaveBeenCalled();
  });

  it('should clear the Plan time message once the Plan time resolves to one instant, then submit it', async () => {
    const facade = renderAt('2026-11-01T05:26:00Z');
    const user = await fillPlan('2026-11-01T01:30');
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    await summaryLines();
    const planTime = screen.getByLabelText('Plan time');
    await user.clear(planTime);
    await user.type(planTime, '2026-11-01T03:30');
    expect(planTime.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('region', { name: 'This Plan can’t be confirmed yet' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(vi.mocked(facade.TradeWorkflows.confirmPlan).mock.calls[0]![0].economicTime).toBe('2026-11-01T08:30:00Z');
  });
});

// A facade whose Catalog also holds the option Strategies, each with its role shape, in decision 85's
// order (Cash-Secured Put first), with every option Strategy installed.
function optionFacade(): UiFacade {
  const base = planFormFacade();
  const query = vi.mocked(base.ReferenceCatalog.query).getMockImplementation()!;
  const strategies = [
    { id: 'strat-csp', label: 'Cash-Secured Put', productKey: 'strategy.cash-secured-put', roles: [{ side: 'Short', instrument: 'Put', ratio: 1 }] },
    { id: 'strat-lc', label: 'Long Call', productKey: 'strategy.long-call', roles: [{ side: 'Long', instrument: 'Call', ratio: 1 }] },
    { id: 'strat-lp', label: 'Long Put', productKey: 'strategy.long-put', roles: [{ side: 'Long', instrument: 'Put', ratio: 1 }] },
  ].map((s) => ({ kind: 'Strategy', recordRevision: 3, ...s, shape: { roles: s.roles } }));
  const facade = {
    ...base,
    capabilities: { ...base.capabilities, strategies: [...strategies.map((s) => s.productKey), 'strategy.long-stock'] },
  } as unknown as UiFacade;
  vi.mocked(facade.ReferenceCatalog.query).mockImplementation(async (request) => {
    const page = await query(request);
    if (request.family !== 'Strategy' || page.kind !== 'Page') return page;
    return { ...page, items: [...strategies, ...page.items] as never };
  });
  return facade;
}

async function chooseStrategy(label: string) {
  const user = userEvent.setup();
  const strategy = await screen.findByLabelText<HTMLSelectElement>('Strategy');
  await vi.waitFor(() => expect(strategy.options.length).toBe(4));
  await user.selectOptions(strategy, label);
  return user;
}

describe('option Strategies (A116)', () => {
  it('should offer Long Stock, Long Call, Long Put, and Cash-Secured Put, and for Long Call show Underlying, expiration date, strike, the right Call read-only, contracts, entry price with its cash amount, the Stop and Target as Underlying triggers with the note, and the exercise checkbox unchecked', async () => {
    renderForm(optionFacade());
    const user = await chooseStrategy('Long Call');
    const strategy = screen.getByLabelText<HTMLSelectElement>('Strategy');
    expect(Array.from(strategy.options).map((o) => o.textContent).sort()).toEqual(['Cash-Secured Put', 'Long Call', 'Long Put', 'Long Stock']);
    expect(screen.getByRole('heading', { name: 'Contract' })).toBeTruthy();
    expect(screen.getByLabelText('Underlying')).toBeTruthy();
    expect(screen.getByLabelText('Expiration date')).toBeTruthy();
    expect(screen.getByLabelText('Strike')).toBeTruthy();
    const type = screen.getByLabelText<HTMLInputElement>('Type');
    expect(type.value).toBe('Call');
    expect(type.readOnly).toBe(true);
    await user.type(screen.getByLabelText('Contracts'), '2');
    await user.type(screen.getByLabelText('Intended entry price (per share)'), '2.00');
    expect(screen.getByText('= $400.00 for 2 contracts')).toBeTruthy();
    expect(screen.getByLabelText('Stop (Underlying at or below)')).toBeTruthy();
    expect(screen.getByLabelText('Target (Underlying at or above)')).toBeTruthy();
    await user.type(screen.getByLabelText('Underlying'), 'xyz');
    expect(screen.getByLabelText('Stop (XYZ at or below)')).toBeTruthy();
    expect(screen.getByLabelText('Target (XYZ at or above)')).toBeTruthy();
    expect(screen.getByText("Risk and reward are measured by the option's value at expiration at these prices")).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('I plan to exercise this option if it is in the money').checked).toBe(false);
    expect(screen.queryByLabelText('Symbol')).toBeNull();
  });

  it('should hide the exercise checkbox for Cash-Secured Put, word its entry as a credit, and note that cash coverage is not checked', async () => {
    renderForm(optionFacade());
    const user = await chooseStrategy('Cash-Secured Put');
    expect(screen.queryByLabelText('I plan to exercise this option if it is in the money')).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Type').value).toBe('Put');
    await user.type(screen.getByLabelText('Contracts'), '2');
    await user.type(screen.getByLabelText('Intended entry price (per share)'), '1.20');
    expect(screen.getByText('= $240.00 credit for 2 contracts')).toBeTruthy();
    await user.type(screen.getByLabelText('Underlying'), 'mno');
    expect(screen.getByLabelText('Stop (MNO at or below)')).toBeTruthy();
    expect(screen.getByLabelText('Target (MNO at or above)')).toBeTruthy();
    expect(screen.getByText("The app doesn't check that you have the cash to buy the shares if you're assigned.")).toBeTruthy();
  });

  it('should reverse the trigger directions for Long Put and show no cash-coverage note or credit', async () => {
    renderForm(optionFacade());
    const user = await chooseStrategy('Long Put');
    await user.type(screen.getByLabelText('Underlying'), 'abc');
    await user.type(screen.getByLabelText('Contracts'), '1');
    await user.type(screen.getByLabelText('Intended entry price (per share)'), '1.50');
    expect(screen.getByLabelText('Stop (ABC at or above)')).toBeTruthy();
    expect(screen.getByLabelText('Target (ABC at or below)')).toBeTruthy();
    expect(screen.getByText('= $150.00 for 1 contract')).toBeTruthy();
    expect(screen.queryByText(/cash to buy the shares/)).toBeNull();
    expect(screen.getByLabelText('I plan to exercise this option if it is in the money')).toBeTruthy();
  });

  // The error text beside a labelled field.
  const errorOf = (label: string) => document.getElementById(screen.getByLabelText(label).getAttribute('aria-describedby') ?? '')?.textContent;

  async function submitRejected(strategy: string, issues: readonly unknown[]) {
    const facade = renderForm(optionFacade());
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue({ kind: 'Rejected', issues, binding: {} } as never);
    const user = await chooseStrategy(strategy);
    await user.type(screen.getByLabelText('Underlying'), 'abc');
    await user.type(screen.getByLabelText('Contracts'), '1');
    await user.type(screen.getByLabelText('Intended entry price (per share)'), '1.50');
    await user.type(screen.getByLabelText(/^Stop/), '40');
    await user.type(screen.getByLabelText(/^Target/), '60');
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    await screen.findByRole('region', { name: 'This Plan can’t be confirmed yet' });
  }

  it('should show StopTargetOrder and TargetNotBeyondEntry, with its breakeven, beside the trigger fields, in the direction of the Strategy', async () => {
    const at = (code: string, breakeven: number) => ({ source: 'TradeAnalysis', code, details: { breakeven: Rational.of(BigInt(breakeven * 100), 100n) } });
    await submitRejected('Long Put', [at('NoPositiveRisk', 48.5), at('TargetNotBeyondEntry', 48.5), { source: 'TradeAnalysis', code: 'StopTargetOrder' }]);
    expect(errorOf('Stop (ABC at or above)')).toBe(
      'The Stop must be above the breakeven, 48.50, so the Plan has a positive risk. The Stop must be above the Target.',
    );
    expect(errorOf('Target (ABC at or below)')).toBe('The Target must be below the breakeven, 48.50.');
    cleanup();
    await submitRejected('Long Call', [at('NoPositiveRisk', 57), at('TargetNotBeyondEntry', 57), { source: 'TradeAnalysis', code: 'StopTargetOrder' }]);
    expect(errorOf('Stop (ABC at or below)')).toBe(
      'The Stop must be below the breakeven, 57.00, so the Plan has a positive risk. The Stop must be below the Target.',
    );
    expect(errorOf('Target (ABC at or above)')).toBe('The Target must be above the breakeven, 57.00.');
    cleanup();
    await submitRejected('Cash-Secured Put', [at('NoPositiveRisk', 43.8)]);
    expect(errorOf('Stop (ABC at or below)')).toBe('The Stop must be below the breakeven, 43.80, so the Plan has a positive risk.');
  });

  it('should hand the confirmed option Plan, with its 1R from the result, to Trade Detail without a read call', async () => {
    const facade = renderForm(optionFacade());
    const trade = {
      tradeId: 'trade-7',
      factRevision: 1,
      storedLifecycle: 'Planned',
      plan: {
        economicTime: '2026-10-12T13:00:00Z',
        underlying: 'XYZ',
        thesis: 'Earnings run-up.',
        invalidation: 'A close below 48.',
        legs: [
          {
            factId: 'f-2',
            side: 'Long',
            instrument: { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', right: 'Call', strike: '55', multiplier: 100 },
            quantity: '2',
            intendedEntry: '2',
          },
        ],
        stops: [{ factId: 'f-3', kind: 'UnderlyingPrice', price: '48' }],
        targets: [{ factId: 'f-4', kind: 'UnderlyingPrice', price: '60' }],
        exerciseIntent: 'NotAuthorized',
      },
      positionChanges: [],
    };
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue({
      kind: 'Confirmed',
      receipt: { tradeId: 'trade-7', factRevision: 1, binding: { databaseName: 'tj-ws-1', contentRevision: 9 }, createdFactIds: [], lifecycleTransitions: [], entryId: 'e-1' },
      postCommit: {
        trade,
        derivation: { tradeId: 'trade-7', factRevision: 1, expectedLifecycle: 'Planned', agreement: { kind: 'Agrees' }, positions: [], baseline: { oneR: Rational.of(400n) } },
        entry: {
          id: 'e-1',
          entryTypeKey: 'entry-type.plan-reflection',
          sourceKey: 'source.plan-confirmation',
          anchor: { kind: 'Trade', tradeId: 'trade-7' },
          origin: { kind: 'Plan', factId: 'f-1' },
          momentTime: '2026-10-12T13:00:00Z',
          authoredTime: '2026-10-12T14:05:00Z',
          definitionId: 'def-1',
          responses: [],
        },
      },
      affected: [],
    } as never);
    const user = await chooseStrategy('Long Call');
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(await screen.findByText('1R $400.00')).toBeTruthy();
    expect(screen.getByText('Detail trade-7 for Roth IRA: Earnings run-up.')).toBeTruthy();
    // The browser structured-clones history state, so it holds no class instance (T7.31-F1).
    expect(structuredClone(navigationState)).toStrictEqual(navigationState);
    expect(facade.TradeViewsAndReporting.getTradeDetail).not.toHaveBeenCalled();
  });

  it('should keep an option breakeven issue after the Stop is edited, since only the domain can judge it against the breakeven', async () => {
    await submitRejected('Long Call', [{ source: 'TradeAnalysis', code: 'NoPositiveRisk', details: { breakeven: Rational.of(57n) } }]);
    const stop = screen.getByLabelText('Stop (ABC at or below)');
    const user = userEvent.setup();
    await user.clear(stop);
    await user.type(stop, '1');
    expect(errorOf('Stop (ABC at or below)')).toBe('The Stop must be below the breakeven, 57.00, so the Plan has a positive risk.');
  });

  it('should keep ContractQuantityNotWhole beside Contracts while the count stays fractional, and clear it once the count is whole', async () => {
    await submitRejected('Long Call', [{ source: 'TradeAnalysis', code: 'ContractQuantityNotWhole' }]);
    const contracts = screen.getByLabelText('Contracts');
    const user = userEvent.setup();
    await user.clear(contracts);
    await user.paste('2.5');
    expect(errorOf('Contracts')).toBe('Enter a whole number of contracts.');
    await user.clear(contracts);
    await user.paste('2.6');
    expect(errorOf('Contracts')).toBe('Enter a whole number of contracts.');
    await user.clear(contracts);
    await user.paste('3');
    expect(contracts.getAttribute('aria-describedby')).toBeNull();
  });

  it('should submit NotAuthorized when the checkbox is unchecked, and only the selected Strategy fields, keeping values from another Strategy in view state', async () => {
    const facade = renderForm(optionFacade());
    const confirm = vi.mocked(facade.TradeWorkflows.confirmPlan);
    confirm.mockResolvedValue({ kind: 'Rejected', issues: [], binding: {} } as never);
    const user = await chooseStrategy('Long Call');
    await user.type(screen.getByLabelText('Underlying'), 'xyz');
    await user.type(screen.getByLabelText('Expiration date'), '2026-11-20');
    await user.type(screen.getByLabelText('Strike'), '55');
    await user.type(screen.getByLabelText('Contracts'), '2');
    await user.type(screen.getByLabelText('Intended entry price (per share)'), '2.00');
    await user.type(screen.getByLabelText('Stop (XYZ at or below)'), '48.00');
    await user.type(screen.getByLabelText('Target (XYZ at or above)'), '60.00');
    await user.type(screen.getByLabelText('Why this trade, why now?'), 'Earnings run-up.');
    await user.type(screen.getByLabelText('What would invalidate the thesis?'), 'A close below 48.');
    await user.click(within(screen.getByRole('radiogroup', { name: 'Conviction' })).getByLabelText('4'));
    await user.click(within(screen.getByRole('radiogroup', { name: 'Primary emotion' })).getByLabelText('Calm'));
    const contract = {
      side: 'Long',
      instrument: { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', right: 'Call', strike: '55', multiplier: 100 },
      quantity: '2',
      intendedEntry: '2.00',
    };
    const plan = (exerciseIntent: string) => ({
      underlying: 'XYZ',
      legs: [contract],
      stops: [{ kind: 'UnderlyingPrice', price: '48.00' }],
      targets: [{ kind: 'UnderlyingPrice', price: '60.00' }],
      exerciseIntent,
    });
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(confirm.mock.calls[0]![0]).toMatchObject({ strategyId: 'strat-lc', strategyRevision: 3, plan: plan('NotAuthorized') });
    await user.click(screen.getByLabelText('I plan to exercise this option if it is in the money'));
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(confirm.mock.calls[1]![0]).toMatchObject({ plan: plan('Authorized') });
    // Switching to Long Stock hides the option fields and submits none of them, but keeps their values.
    await user.selectOptions(screen.getByLabelText('Strategy'), 'Long Stock');
    expect(screen.queryByLabelText('Strike')).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Symbol').value).toBe('xyz');
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(confirm.mock.calls[2]![0].plan).toEqual({
      underlying: 'XYZ',
      legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '2', intendedEntry: '2.00' }],
      stops: [{ kind: 'UnderlyingPrice', price: '48.00' }],
      targets: [{ kind: 'UnderlyingPrice', price: '60.00' }],
    });
    await user.selectOptions(screen.getByLabelText('Strategy'), 'Long Call');
    expect(screen.getByLabelText<HTMLInputElement>('Strike').value).toBe('55');
    expect(screen.getByLabelText<HTMLInputElement>('Expiration date').value).toBe('2026-11-20');
    expect(screen.getByLabelText<HTMLInputElement>('I plan to exercise this option if it is in the money').checked).toBe(true);
    // A Cash-Secured Put is a short leg with a negative contract count and no Exercise Intent.
    await user.selectOptions(screen.getByLabelText('Strategy'), 'Cash-Secured Put');
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    const [put] = confirm.mock.calls[3]![0].plan.legs;
    expect(put).toMatchObject({ side: 'Short', instrument: { kind: 'Option', right: 'Put' }, quantity: '-2' });
    expect('exerciseIntent' in confirm.mock.calls[3]![0].plan).toBe(false);
  });
});

describe('option Plan receipt (A116)', () => {
  it('should render the confirmed option Plan Planned payoff from the result with PayoffView, beside its 1R', async () => {
    const facade = optionFacade();
    render(
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
        <MemoryRouter initialEntries={['/plans/new']}>
          <Routes>
            <Route path="/plans/new" element={<PlanForm facade={facade} timeZone="America/New_York" now={() => '2026-10-12T14:05:00Z'} onDirtyChange={() => undefined} />} />
            <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    const trade = {
      tradeId: 'trade-7',
      factRevision: 1,
      storedLifecycle: 'Planned',
      plan: {
        economicTime: '2026-10-12T13:00:00Z',
        underlying: 'XYZ',
        thesis: 'Earnings run-up.',
        invalidation: 'A close below 48.',
        legs: [
          {
            factId: 'f-2',
            side: 'Long',
            instrument: { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', right: 'Call', strike: '55', multiplier: 100 },
            quantity: '2',
            intendedEntry: '2.00',
          },
        ],
        stops: [{ factId: 'f-3', kind: 'UnderlyingPrice', price: '48' }],
        targets: [{ factId: 'f-4', kind: 'UnderlyingPrice', price: '60' }],
        exerciseIntent: 'NotAuthorized',
      },
      positionChanges: [],
    };
    vi.mocked(facade.TradeWorkflows.confirmPlan).mockResolvedValue({
      kind: 'Confirmed',
      receipt: { tradeId: 'trade-7', factRevision: 1, binding: { databaseName: 'tj-ws-1', contentRevision: 9 }, createdFactIds: [], lifecycleTransitions: [], entryId: 'e-1' },
      postCommit: {
        trade,
        derivation: {
          tradeId: 'trade-7',
          factRevision: 1,
          expectedLifecycle: 'Planned',
          agreement: { kind: 'Agrees' },
          positions: [],
          baseline: { oneR: Rational.of(400n), originalPlannedReward: Rational.of(800n), rewardRiskRatio: Rational.of(2n) },
        },
        entry: {
          id: 'e-1',
          entryTypeKey: 'entry-type.plan-reflection',
          sourceKey: 'source.plan-confirmation',
          anchor: { kind: 'Trade', tradeId: 'trade-7' },
          origin: { kind: 'Plan', factId: 'f-1' },
          momentTime: '2026-10-12T13:00:00Z',
          authoredTime: '2026-10-12T14:05:00Z',
          definitionId: 'def-1',
          responses: [],
        },
        payoff: payoffFixtures.ocPayoffs(),
      },
      affected: [],
    } as never);
    const user = await chooseStrategy('Long Call');
    await user.click(screen.getByRole('button', { name: 'Confirm Plan' }));
    expect(await screen.findByText('1R')).toBeTruthy();
    const chart = await screen.findByRole('img', { name: 'Planned payoff at expiration by XYZ price' });
    expect(screen.getByRole('heading', { name: 'Planned Expiration Payoff' })).toBeTruthy();
    const table = document.getElementById(chart.getAttribute('aria-labelledby') ?? '')!.closest('table') as HTMLElement;
    expect(within(table).getByText('Breakeven 57.00')).toBeTruthy();
    expect(facade.TradeViewsAndReporting.getTradeDetail).not.toHaveBeenCalled();
  });
});
