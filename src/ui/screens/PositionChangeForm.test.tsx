// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { incoherentDetailOf, openDetailOf, PC1 } from '../../../tests/support/open-detail-fixtures.ts';
import { plannedDetail, positionChangeFormFacade, reflectionDefinition } from '../../../tests/support/position-change-form-facade.ts';
import type { UiFacade } from '../../app/compose.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { PositionChangeForm } from './PositionChangeForm.tsx';

afterEach(cleanup);

function renderForm(
  facade: UiFacade = positionChangeFormFacade(),
  onDirtyChange: (dirty: boolean) => void = () => undefined,
  report: (result: { readonly kind: string }) => void = () => undefined,
) {
  render(
    <RuntimeContext.Provider value={{ writable: true, report }}>
      <MemoryRouter initialEntries={['/trades/trade-1/record-entry']}>
        <Routes>
          <Route
            path="/trades/:tradeId/record-entry"
            element={
              <PositionChangeForm facade={facade} timeZone="America/New_York" now={() => '2026-10-12T14:05:00Z'} onDirtyChange={onDirtyChange} />
            }
          />
          <Route path="/trades/:tradeId" element={<p>Trade Detail route</p>} />
        </Routes>
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
  return facade;
}

const row = (n: number) => screen.getByRole('group', { name: `Execution ${n}` });

describe('rendering', () => {
  it('should show the Plans symbol, Buy, and the Planned Leg read-only, one Execution row with Economic Time defaulting to now, and Add and Remove row controls up to 20 rows', async () => {
    renderForm();
    const terms = await screen.findByRole('region', { name: 'Entry' });
    expect(within(terms).getByText('XYZ')).toBeTruthy();
    expect(within(terms).getByText('Buy')).toBeTruthy();
    expect(within(terms).getByText('Long 100 shares of XYZ')).toBeTruthy();
    expect(within(terms).queryAllByRole('textbox')).toEqual([]);

    expect(screen.getAllByRole('group', { name: /^Execution \d+$/ })).toHaveLength(1);
    expect(within(row(1)).getByLabelText<HTMLInputElement>('Quantity').value).toBe('');
    expect(within(row(1)).getByLabelText<HTMLInputElement>('Price').value).toBe('');
    expect(within(row(1)).getByLabelText<HTMLInputElement>('Fee').value).toBe('');
    const time = within(row(1)).getByLabelText<HTMLInputElement>('Economic Time');
    expect(time.type).toBe('datetime-local');
    expect(time.value).toBe('2026-10-12T10:05');
    // The only row cannot be removed.
    expect(screen.queryByRole('button', { name: 'Remove Execution 1' })).toBeNull();

    const user = userEvent.setup();
    const add = screen.getByRole('button', { name: 'Add Execution' });
    await user.click(add);
    expect(screen.getAllByRole('group', { name: /^Execution \d+$/ })).toHaveLength(2);
    expect(within(row(2)).getByLabelText<HTMLInputElement>('Economic Time').value).toBe('2026-10-12T10:05');
    await user.type(within(row(1)).getByLabelText('Quantity'), '30');
    await user.click(screen.getByRole('button', { name: 'Remove Execution 1' }));
    expect(screen.getAllByRole('group', { name: /^Execution \d+$/ })).toHaveLength(1);
    expect(within(row(1)).getByLabelText<HTMLInputElement>('Quantity').value).toBe('');

    for (let i = 1; i < 20; i += 1) await user.click(add);
    expect(screen.getAllByRole('group', { name: /^Execution \d+$/ })).toHaveLength(20);
    expect((add as HTMLButtonElement).disabled).toBe(true);
  });

  it('should render the Position Change Reflection from the loaded definition revision, with Decision mode and Primary emotion as radio groups in labelled fieldsets and Decision confidence as a 1–5 radio group', async () => {
    const facade = renderForm();
    const mode = await screen.findByRole('radiogroup', { name: 'Decision mode' });
    expect(facade.Journal.getDefinitions).toHaveBeenCalledWith({ latestFor: 'entry-type.position-change-reflection' });
    expect(mode.tagName).toBe('FIELDSET');
    const labels = (group: HTMLElement) => within(group).getAllByRole('radio').map((r) => (r.closest('label') as HTMLElement).textContent);
    expect(labels(mode)).toEqual(['As Planned', 'Deliberate Adjustment', 'Reactive', 'Externally Imposed']);
    const emotion = screen.getByRole('radiogroup', { name: 'Primary emotion' });
    expect(emotion.tagName).toBe('FIELDSET');
    expect(labels(emotion)).toEqual(['Calm', 'Eager', 'Anxious', 'FOMO', 'Revenge', 'Relieved', 'Frustrated', 'Other']);
    const confidence = screen.getByRole('radiogroup', { name: 'Decision confidence' });
    expect(within(confidence).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['1', '2', '3', '4', '5']);
    expect(screen.getByLabelText('Note').tagName).toBe('TEXTAREA');
  });

  it('should offer Decline to reflect with an optional reason as the explicit alternative to completing the form', async () => {
    renderForm();
    const decline = await screen.findByRole('checkbox', { name: 'Decline to reflect' });
    // Nothing is chosen for the trader: the form starts as a reflection to complete.
    expect((decline as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByLabelText('Reason for declining (optional)')).toBeNull();
    const user = userEvent.setup();
    await user.click(within(screen.getByRole('radiogroup', { name: 'Decision mode' })).getByLabelText('Reactive'));
    await user.click(decline);
    expect(screen.getByLabelText('Reason for declining (optional)').tagName).toBe('TEXTAREA');
    expect(screen.queryByRole('radiogroup', { name: 'Decision mode' })).toBeNull();
    // Choosing to complete after all brings back what was already answered.
    await user.click(decline);
    expect(screen.queryByLabelText('Reason for declining (optional)')).toBeNull();
    const reactive = within(screen.getByRole('radiogroup', { name: 'Decision mode' })).getByLabelText<HTMLInputElement>('Reactive');
    expect(reactive.checked).toBe(true);
  });
});

// Fills Execution rows (quantity, price, fee, Workspace-local time), adding rows as needed.
async function fillRows(user: ReturnType<typeof userEvent.setup>, values: readonly (readonly [string, string, string, string])[]) {
  await screen.findByRole('group', { name: 'Execution 1' });
  for (const [index, [quantity, price, fee, time]] of values.entries()) {
    if (index > 0) await user.click(screen.getByRole('button', { name: 'Add Execution' }));
    const group = row(index + 1);
    for (const [label, value] of [['Quantity', quantity], ['Price', price], ['Fee', fee]] as const) {
      if (value !== '') await user.type(within(group).getByLabelText(label), value);
    }
    await user.clear(within(group).getByLabelText('Economic Time'));
    await user.type(within(group).getByLabelText('Economic Time'), time);
  }
}

async function completeReflection(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(screen.getByRole('radiogroup', { name: 'Decision mode' })).getByLabelText('As Planned'));
  await user.click(within(screen.getByRole('radiogroup', { name: 'Primary emotion' })).getByLabelText('Calm'));
  await user.click(within(screen.getByRole('radiogroup', { name: 'Decision confidence' })).getByLabelText('4'));
  await user.type(screen.getByLabelText('Note'), 'Filled at the open.');
}

const member = (quantity: string, price: string, fee: string, economicTime: string) => ({
  kind: 'Execution',
  tradeId: 'trade-1',
  action: 'Buy',
  instrument: { kind: 'Stock', symbol: 'XYZ' },
  intent: { kind: 'ServesPlannedLeg', plannedLegId: 'leg-1' },
  quantity,
  price,
  fee,
  economicTime,
});

const rejected = { kind: 'Rejected', issues: [], binding: { databaseName: 'tj-ws-1', contentRevision: 7 } };

// The result the receipt cases save: a Recorded Position Change with Entry Quality, a Deviation and repairs.
function recordedResult() {
  const r = (numerator: bigint, denominator = 1n) => Rational.of(numerator, denominator);
  const value = <T,>(v: T) => ({ kind: 'Value', value: v }) as const;
  const execution = (factId: string, economicTime: string, quantity: string, price: string, recordedSequence: number) => ({
    factId,
    economicTime,
    recordedSequence,
    action: 'Buy',
    instrument: { kind: 'Stock', symbol: 'XYZ' },
    quantity,
    price,
    fee: '1.00',
    intent: { kind: 'ServesPlannedLeg', plannedLegId: 'leg-1' },
  });
  const pc = (factId: string, economicTime: string, recordedSequence: number, executions: unknown[]) => ({ factId, economicTime, recordedSequence, executions });
  const quality = value({
    averageEntry: value(r(25090n, 500n)),
    windowQuantity: value(r(100n)),
    windowFees: value(r(2n)),
    actualInitialRisk: value(r(270n)),
    actualInitialReward: value(r(580n)),
    riskInPlanR: value(r(27n, 25n)),
    slippage: value(r(18n)),
    sizeRatio: value(r(1n)),
    plannedRewardRisk: value(r(12n, 5n)),
    actualRewardRisk: value(r(58n, 27n)),
    flags: [],
  });
  const fingerprint = { tradeId: 'trade-1', plannedLegId: 'leg-1', positionChangeId: 'pc-3' };
  return {
    kind: 'Recorded',
    receipt: {
      tradeId: 'trade-1',
      factRevision: 4,
      binding: { databaseName: 'tj-ws-1', contentRevision: 12 },
      createdFactIds: ['pc-3', 'ex-3'],
      lifecycleTransitions: [],
      reflection: { kind: 'Decline', id: 'decline-1' },
      deviationReconciliation: [
        {
          action: 'Create',
          occurrenceId: 'dev-1',
          version: { fingerprint, type: 'EntrySize', form: 'Excess', quantityAbovePlan: '20', causingPositionChangeId: 'pc-3', economicTime: '2026-10-12T18:00:00Z', status: 'Active' },
        },
      ],
      entryChanges: [
        { kind: 'EntryResolutionMoved', from: 'pc-2', to: 'pc-1' },
        { kind: 'EntryQualityChanged', from: quality, to: quality },
      ],
      repairs: [
        { kind: 'LifecycleDisagreement', stored: 'Planned', expected: 'Open' },
        { kind: 'DeviationMissing', fingerprint, expected: {} },
      ],
    },
    postCommit: {
      trade: {
        tradeId: 'trade-1',
        factRevision: 4,
        storedLifecycle: 'Open',
        plan: {},
        positionChanges: [
          pc('pc-1', '2026-10-12T14:00:00Z', 1, [execution('ex-1', '2026-10-12T14:00:00Z', '60', '50.10', 2)]),
          pc('pc-2', '2026-10-12T15:00:00Z', 3, [execution('ex-2', '2026-10-12T15:00:00Z', '40', '50.30', 4)]),
          pc('pc-3', '2026-10-12T18:00:00Z', 5, [execution('ex-3', '2026-10-12T18:00:00Z', '20', '51.00', 6)]),
        ],
      },
      derivation: { kind: 'Derived', entryResolution: { kind: 'Resolved', positionChangeId: 'pc-1' }, entryQuality: quality },
      reflection: { kind: 'Decline', decline: { id: 'decline-1', reason: 'Nothing new to add.' } },
    },
    affected: [],
  } as never;
}

describe('submission', () => {
  it('should submit one Position Change with every row, the expected FactRevision, the rendered definition revision, stable Prompt and Option identities, and the chosen disposition', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(rejected as never);
    const user = userEvent.setup();
    await fillRows(user, [
      ['30', '50.00', '0.50', '2026-10-12T10:00'],
      ['30', '50.20', '0.50', '2026-10-12T10:01'],
    ]);
    await completeReflection(user);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    const members = [member('30', '50.00', '0.50', '2026-10-12T14:00:00Z'), member('30', '50.20', '0.50', '2026-10-12T14:01:00Z')];
    expect(facade.TradeWorkflows.recordPositionChange).toHaveBeenCalledTimes(1);
    expect(facade.TradeWorkflows.recordPositionChange).toHaveBeenLastCalledWith({
      originTradeId: 'trade-1',
      trades: [{ tradeId: 'trade-1', expectedFactRevision: 1 }],
      members,
      reflection: {
        kind: 'Complete',
        form: {
          definitionId: 'def-pcr-1',
          answers: {
            'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
            'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
            'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
            'prompt.position-change-reflection.note': { kind: 'Text', text: 'Filled at the open.' },
          },
        },
      },
    });

    // Declining instead submits the decline, naming the definition revision shown, with its reason.
    await user.click(screen.getByRole('checkbox', { name: 'Decline to reflect' }));
    await user.type(screen.getByLabelText('Reason for declining (optional)'), 'Nothing new to add.');
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(facade.TradeWorkflows.recordPositionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ members, reflection: { kind: 'Decline', definitionId: 'def-pcr-1', reason: 'Nothing new to add.' } }),
    );
    // An empty reason is no reason at all.
    await user.clear(screen.getByLabelText('Reason for declining (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(facade.TradeWorkflows.recordPositionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ reflection: { kind: 'Decline', definitionId: 'def-pcr-1' } }),
    );
  });

  it('should show every issue beside its field or row, list them in a summary, and move focus to the summary', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({
      ...rejected,
      issues: [
        { source: 'TradeWorkflows', member: 0, field: 'economicTime', code: 'EconomicTimeBeforePlan' },
        { source: 'TradeWorkflows', member: 1, field: 'quantity', code: 'NotPositive' },
        { source: 'TradeWorkflows', member: 1, field: 'fee', code: 'Required' },
        { source: 'Journal', field: 'prompt.position-change-reflection.decision-mode', code: 'RequiredAnswerMissing' },
        { source: 'Journal', code: 'ReasonTooLong' },
      ],
    } as never);
    const user = userEvent.setup();
    await fillRows(user, [
      ['30', '50.00', '0.50', '2026-10-12T08:00'],
      ['0', '50.20', '', '2026-10-12T10:01'],
    ]);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    const summary = await screen.findByRole('region', { name: 'This entry can’t be saved yet' });
    expect(within(summary).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Execution 1: the Economic Time cannot be before the Plan time.',
      'Execution 2: enter a quantity greater than zero, with at most 6 decimal places.',
      'Execution 2: enter the fee, or 0 if there was none.',
      'Answer “Decision mode”.',
      'Keep the reason for declining to 500 characters or fewer.',
    ]);
    expect(document.activeElement).toBe(summary);
    const description = (element: HTMLElement) => document.getElementById(element.getAttribute('aria-describedby') ?? '')?.textContent;
    expect(description(within(row(1)).getByLabelText('Economic Time'))).toMatch(/before the Plan time/);
    expect(description(within(row(2)).getByLabelText('Quantity'))).toMatch(/quantity greater than zero/);
    expect(description(within(row(2)).getByLabelText('Fee'))).toMatch(/enter the fee/);
    expect(within(row(1)).getByLabelText('Quantity').getAttribute('aria-invalid')).toBeNull();
    expect(description(screen.getByRole('radiogroup', { name: 'Decision mode' }))).toMatch(/Answer/);

    // A time that is not a valid Workspace-local time is reported without a call.
    await user.clear(within(row(1)).getByLabelText('Economic Time'));
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(within(summary).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Execution 1: enter a date and time.']);
    expect(facade.TradeWorkflows.recordPositionChange).toHaveBeenCalledTimes(1);
  });

  it('should render the saved Position Change, Entry Quality when resolved, any new Entry Size Deviation, and any repairs from the returned state alone, without a read call', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(recordedResult());
    const user = userEvent.setup();
    await fillRows(user, [['20', '51.00', '1.00', '2026-10-12T14:00']]);
    await completeReflection(user);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));

    const receipt = await screen.findByRole('region', { name: 'Entry recorded' });
    const saved = within(receipt).getByRole('region', { name: 'Position Change at 2026-10-12 14:00' });
    expect(within(saved).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Buy 20 XYZ @ $51.00, fee $1.00']);
    const entryQuality = within(receipt).getByRole('region', { name: 'Entry Quality' });
    expect(within(entryQuality).getAllByRole('definition').map((dd) => dd.textContent)).toEqual([
      '$50.18',
      '$270.00 (1.08R)',
      '$580.00',
      '2.15 (planned 2.4)',
      '$18.00',
    ]);
    expect(within(receipt).getByText('Entry Size Deviation: 20 shares above plan, caused by this Position Change.')).toBeTruthy();
    expect(within(receipt).getByText('This entry moved the Entry Resolution Point to the Position Change at 2026-10-12 10:00.')).toBeTruthy();
    expect(within(receipt).getByText('This entry changed Entry Quality.')).toBeTruthy();
    const repairs = within(receipt).getByRole('region', { name: 'Repaired while saving' });
    expect(within(repairs).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'The stored lifecycle was Planned; the recorded facts show Open.',
      'A missing Entry Size Deviation was recorded.',
    ]);
    expect(within(receipt).getByText('Reflection declined: Nothing new to add.')).toBeTruthy();
    expect(within(receipt).getByRole('link', { name: 'Back to the Trade' }).getAttribute('href')).toBe('/trades/trade-1');
    // Only the load read the Trade; the receipt came from the result alone.
    expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenCalledTimes(1);
    expect(facade.Journal.query).not.toHaveBeenCalled();
  });

  it('should show Conflict with the entered values kept and an explanation that the Trade changed', async () => {
    const report = vi.fn();
    const facade = renderForm(positionChangeFormFacade(), () => undefined, report);
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({ kind: 'Conflict', changed: ['trade:trade-1'] } as never);
    const user = userEvent.setup();
    await fillRows(user, [['40', '50.30', '1.00', '2026-10-12T11:00']]);
    await completeReflection(user);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    const conflict = await screen.findByRole('region', { name: 'This Trade changed after you opened this form' });
    expect(within(conflict).getByText(/Nothing was saved/)).toBeTruthy();
    expect(document.activeElement).toBe(conflict);
    expect(within(row(1)).getByLabelText<HTMLInputElement>('Quantity').value).toBe('40');
    expect(within(row(1)).getByLabelText<HTMLInputElement>('Price').value).toBe('50.30');
    expect(within(screen.getByRole('radiogroup', { name: 'Decision mode' })).getByLabelText<HTMLInputElement>('As Planned').checked).toBe(true);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Note').value).toBe('Filled at the open.');

    // A refusal to write is reported to the shell, which explains it; the values stay on screen.
    const refusal = { kind: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', failedChecks: [], workspaceStatus: 'RecoveryOnly', safeActions: [] };
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(refusal as never);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(refusal));
    expect(within(row(1)).getByLabelText<HTMLInputElement>('Quantity').value).toBe('40');
  });

  it('should replace the entry form history entry with the Trade Detail URL once saved, keeping the receipt in place, and keep the URL after Conflict', async () => {
    const facade = positionChangeFormFacade();
    window.history.pushState(null, '', '/trades/trade-1/record-entry');
    const length = window.history.length;
    render(
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
        <BrowserRouter>
          <Routes>
            <Route
              path="/trades/:tradeId/record-entry"
              element={
                <PositionChangeForm facade={facade} timeZone="America/New_York" now={() => '2026-10-12T14:05:00Z'} onDirtyChange={() => undefined} />
              }
            />
            <Route path="/trades/:tradeId" element={<p>Trade Detail route</p>} />
          </Routes>
        </BrowserRouter>
      </RuntimeContext.Provider>,
    );
    const user = userEvent.setup();
    await fillRows(user, [['60', '50.10', '1.00', '2026-10-12T10:00']]);
    await completeReflection(user);

    // A Conflict keeps the form, its values and its URL.
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({ kind: 'Conflict', changed: ['trade:trade-1'] } as never);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    await screen.findByRole('region', { name: 'This Trade changed after you opened this form' });
    expect(window.location.pathname).toBe('/trades/trade-1/record-entry');
    expect(within(row(1)).getByLabelText<HTMLInputElement>('Quantity').value).toBe('60');

    const execution = {
      factId: 'ex-1',
      economicTime: '2026-10-12T14:00:00Z',
      recordedSequence: 2,
      action: 'Buy',
      instrument: { kind: 'Stock', symbol: 'XYZ' },
      quantity: '60',
      price: '50.10',
      fee: '1.00',
    };
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({
      kind: 'Recorded',
      receipt: { tradeId: 'trade-1', createdFactIds: ['pc-1', 'ex-1'], deviationReconciliation: [], entryChanges: [], repairs: [] },
      postCommit: {
        trade: { positionChanges: [{ factId: 'pc-1', economicTime: '2026-10-12T14:00:00Z', recordedSequence: 1, executions: [execution] }] },
        derivation: { entryQuality: { kind: 'NotApplicable' } },
        reflection: { kind: 'Entry' },
      },
      affected: [],
    } as never);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    // The receipt replaces the form in place; the history entry now names the Trade, so a reload shows it.
    expect(await screen.findByRole('region', { name: 'Entry recorded' })).toBeTruthy();
    expect(window.location.pathname).toBe('/trades/trade-1');
    expect(window.history.length).toBe(length);
    expect(screen.queryByText('Trade Detail route')).toBeNull();
  });

  it('should make no call when cancelled or left, and register as unsaved while any value differs from its initial value', async () => {
    const dirty = vi.fn();
    const facade = renderForm(positionChangeFormFacade(), dirty);
    const user = userEvent.setup();
    const quantity = await within(await screen.findByRole('group', { name: 'Execution 1' })).findByLabelText('Quantity');
    expect(dirty).not.toHaveBeenCalledWith(true);
    await user.type(quantity, '6');
    expect(dirty).toHaveBeenLastCalledWith(true);
    await user.clear(quantity);
    expect(dirty).toHaveBeenLastCalledWith(false);
    await user.click(screen.getByRole('button', { name: 'Add Execution' }));
    expect(dirty).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Remove Execution 2' }));
    expect(dirty).toHaveBeenLastCalledWith(false);
    await user.click(screen.getByRole('checkbox', { name: 'Decline to reflect' }));
    expect(dirty).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('checkbox', { name: 'Decline to reflect' }));
    expect(dirty).toHaveBeenLastCalledWith(false);
    await user.click(within(screen.getByRole('radiogroup', { name: 'Primary emotion' })).getByLabelText('Calm'));
    expect(dirty).toHaveBeenLastCalledWith(true);

    // Cancelling leaves for the Trade, records nothing, and releases the update hold.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Trade Detail route')).toBeTruthy();
    expect(dirty).toHaveBeenLastCalledWith(false);
    expect(facade.TradeWorkflows.recordPositionChange).not.toHaveBeenCalled();
    expect(facade.TradeWorkflows.confirmPlan).not.toHaveBeenCalled();
  });
});

describe('Record entry route for an incoherent Trade', () => {
  it('should show the same explanation and a link back to the Trade instead of the form, and make no recordPositionChange call', async () => {
    const facade = positionChangeFormFacade();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({
      kind: 'Ready',
      view: incoherentDetailOf([PC1], [{ factId: 'ex-1', reason: 'UnknownPlannedLeg' }]),
      binding: { databaseName: 'tj-ws-1', contentRevision: 7 },
    } as never);
    renderForm(facade);
    expect(await screen.findByText('New entries cannot be recorded for this Trade until its records agree.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the Trade' }).getAttribute('href')).toBe('/trades/trade-1');
    expect(screen.queryByRole('group', { name: 'Execution 1' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save entry' })).toBeNull();
    expect(facade.TradeWorkflows.recordPositionChange).not.toHaveBeenCalled();
  });
});

describe('Record entry load states', () => {
  it('should show Not Found, with a link to Trades, when getTradeDetail returns NotFound', async () => {
    const facade = positionChangeFormFacade();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'NotFound' } as never);
    renderForm(facade);
    expect(await screen.findByRole('heading', { level: 1, name: 'Trade not found' })).toBeTruthy();
    expect(screen.getByText('No Trade with this identity exists in this journal.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Trades' }).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save entry' })).toBeNull();
  });

  it('should show an Error state with Retry when getTradeDetail returns Error or rejects', async () => {
    for (const fail of [
      (facade: UiFacade) => vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Error' } as never),
      (facade: UiFacade) => vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockRejectedValue(new Error('store unavailable')),
    ]) {
      const facade = positionChangeFormFacade();
      fail(facade);
      renderForm(facade);
      expect(await screen.findByText('We couldn’t load this entry form. Nothing was changed.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Trade not found' })).toBeNull();
      cleanup();
    }
  });

  it('should show the Error state with Retry when the reflection definition cannot be loaded', async () => {
    for (const fail of [
      (facade: UiFacade) => vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'NotFound' } as never),
      (facade: UiFacade) => vi.mocked(facade.Journal.getDefinitions).mockRejectedValue(new Error('store unavailable')),
    ]) {
      const facade = positionChangeFormFacade();
      fail(facade);
      renderForm(facade);
      expect(await screen.findByText('We couldn’t load this entry form. Nothing was changed.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Save entry' })).toBeNull();
      cleanup();
    }
  });

  it('should load the form when Retry succeeds, without a page reload', async () => {
    const facade = positionChangeFormFacade();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockRejectedValueOnce(new Error('store unavailable'));
    vi.mocked(facade.Journal.getDefinitions).mockResolvedValueOnce({ kind: 'NotFound' } as never);
    renderForm(facade);
    const retry = await screen.findByRole('button', { name: 'Retry' });
    await userEvent.setup().click(retry);
    expect(await screen.findByRole('group', { name: 'Execution 1' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Decision mode' })).toBeTruthy();
    expect(screen.queryByText('We couldn’t load this entry form. Nothing was changed.')).toBeNull();
    expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenCalledTimes(2);
    expect(facade.Journal.getDefinitions).toHaveBeenCalledTimes(2);
  });
});

// A promise the test settles by hand, to control when each load attempt finishes.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const ERROR_TEXT = 'We couldn’t load this entry form. Nothing was changed.';

describe('Record entry load attempts', () => {
  it('should keep the form loaded by Retry when the first attempts definition load fails afterwards', async () => {
    const facade = positionChangeFormFacade();
    const firstDefinition = deferred<never>();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockRejectedValueOnce(new Error('store unavailable'));
    vi.mocked(facade.Journal.getDefinitions).mockReturnValueOnce(firstDefinition.promise);
    renderForm(facade);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('group', { name: 'Execution 1' })).toBeTruthy();

    firstDefinition.reject(new Error('store unavailable'));
    await act(async () => {
      await firstDefinition.promise.catch(() => undefined);
    });
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
    expect(screen.getByRole('group', { name: 'Execution 1' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Decision mode' })).toBeTruthy();
  });
  it('should ignore a late successful result from a superseded attempt, so the form shows the Retry attempts Trade and definition', async () => {
    const facade = positionChangeFormFacade();
    const user = userEvent.setup();
    // Attempt 1: the Trade fails at once; its definition arrives late. Attempt 2: the definition
    // fails at once; its Trade arrives late. Attempt 3 loads a newer Trade and definition revision.
    const lateDefinition = deferred<unknown>();
    const lateTrade = deferred<unknown>();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail)
      .mockRejectedValueOnce(new Error('store unavailable'))
      .mockReturnValueOnce(lateTrade.promise as never);
    vi.mocked(facade.Journal.getDefinitions)
      .mockReturnValueOnce(lateDefinition.promise as never)
      .mockRejectedValueOnce(new Error('store unavailable'));
    renderForm(facade);
    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(ERROR_TEXT)).toBeTruthy();

    const leg = plannedDetail.plan.legs[0]!;
    const newerTrade = {
      ...plannedDetail,
      factRevision: 2,
      plan: { ...plannedDetail.plan, underlying: 'ABC', legs: [{ ...leg, instrument: { kind: 'Stock', symbol: 'ABC' } }] },
    };
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({
      kind: 'Ready',
      view: newerTrade,
      binding: { databaseName: 'tj-ws-1', contentRevision: 8 },
    } as never);
    vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({
      kind: 'Found',
      definition: { ...reflectionDefinition, id: 'def-pcr-2', revisionNumber: 2 },
    } as never);
    // The second Retry starts attempt 3.
    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    const terms = await screen.findByRole('region', { name: 'Entry' });
    expect(within(terms).getByText('Long 100 shares of ABC')).toBeTruthy();

    lateDefinition.resolve({ kind: 'Found', definition: reflectionDefinition });
    lateTrade.resolve({ kind: 'Ready', view: plannedDetail, binding: { databaseName: 'tj-ws-1', contentRevision: 7 } });
    await act(async () => {
      await Promise.all([lateDefinition.promise, lateTrade.promise]);
    });
    expect(within(screen.getByRole('region', { name: 'Entry' })).getByText('Long 100 shares of ABC')).toBeTruthy();
    expect(screen.queryByText('Long 100 shares of XYZ')).toBeNull();

    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(rejected as never);
    await user.click(screen.getByRole('checkbox', { name: 'Decline to reflect' }));
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(facade.TradeWorkflows.recordPositionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        trades: [{ tradeId: 'trade-1', expectedFactRevision: 2 }],
        reflection: { kind: 'Decline', definitionId: 'def-pcr-2' },
      }),
    );
  });
});

describe('Record entry Retry', () => {
  it('should show Loading, not the earlier attempts Trade, after Retry until both retried loads finish', async () => {
    const facade = positionChangeFormFacade();
    // Attempt 1 loads the Trade but not the definition. Attempt 2's definition arrives first.
    const retriedTrade = deferred<unknown>();
    vi.mocked(facade.Journal.getDefinitions).mockRejectedValueOnce(new Error('store unavailable'));
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail)
      .mockResolvedValueOnce({ kind: 'Ready', view: plannedDetail, binding: { databaseName: 'tj-ws-1', contentRevision: 7 } } as never)
      .mockReturnValueOnce(retriedTrade.promise as never);
    renderForm(facade);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Retry' }));
    await act(async () => {
      await vi.mocked(facade.Journal.getDefinitions).mock.results[1]!.value;
    });
    expect(screen.getByRole('status').textContent).toBe('Loading the entry form…');
    expect(screen.queryByRole('group', { name: 'Execution 1' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Entry' })).toBeNull();

    retriedTrade.resolve({ kind: 'Ready', view: plannedDetail, binding: { databaseName: 'tj-ws-1', contentRevision: 7 } });
    expect(await screen.findByRole('group', { name: 'Execution 1' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('should start from Loading with no carried-over failure when the route moves to another Trade', async () => {
    const facade = positionChangeFormFacade();
    // The app keeps one route element mounted across Trades (AppShell has no per-Trade key).
    const otherTrade = deferred<unknown>();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail)
      .mockRejectedValueOnce(new Error('store unavailable'))
      .mockReturnValueOnce(otherTrade.promise as never);
    render(
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
        <MemoryRouter initialEntries={['/trades/trade-1/record-entry']}>
          <Link to="/trades/trade-2/record-entry">Other Trade</Link>
          <Routes>
            <Route
              path="/trades/:tradeId/record-entry"
              element={
                <PositionChangeForm facade={facade} timeZone="America/New_York" now={() => '2026-10-12T14:05:00Z'} onDirtyChange={() => undefined} />
              }
            />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    expect(await screen.findByText(ERROR_TEXT)).toBeTruthy();

    await userEvent.setup().click(screen.getByRole('link', { name: 'Other Trade' }));
    expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenLastCalledWith({ tradeId: 'trade-2' });
    expect(screen.getByRole('status').textContent).toBe('Loading the entry form…');
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();

    otherTrade.resolve({ kind: 'Ready', view: { ...plannedDetail, tradeId: 'trade-2' }, binding: { databaseName: 'tj-ws-1', contentRevision: 7 } });
    expect(await screen.findByRole('group', { name: 'Execution 1' })).toBeTruthy();
  });
});

// The app keeps one route element mounted across Trades (AppShell has no per-Trade key), so the
// links move the same form between trade-1 and trade-2. The clock is read on every call.
function renderAcrossTrades(facade: UiFacade, clock: { now: string }, onDirtyChange: (dirty: boolean) => void = () => undefined) {
  render(
    <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
      <MemoryRouter initialEntries={['/trades/trade-1/record-entry']}>
        <Link to="/trades/trade-1/record-entry">First Trade</Link>
        <Link to="/trades/trade-2/record-entry">Other Trade</Link>
        <Routes>
          <Route
            path="/trades/:tradeId/record-entry"
            element={<PositionChangeForm facade={facade} timeZone="America/New_York" now={() => clock.now} onDirtyChange={onDirtyChange} />}
          />
        </Routes>
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

describe('Record entry on another Trade', () => {
  it('should start the other Trades form from its initial values: one Execution row with Economic Time now, no reflection answers, no decline or reason', async () => {
    const facade = positionChangeFormFacade();
    const clock = { now: '2026-10-12T14:05:00Z' };
    renderAcrossTrades(facade, clock);
    const user = userEvent.setup();
    await fillRows(user, [
      ['30', '50.00', '0.50', '2026-10-12T10:00'],
      ['30', '50.20', '0.50', '2026-10-12T10:01'],
    ]);
    await completeReflection(user);
    await user.click(screen.getByRole('checkbox', { name: 'Decline to reflect' }));
    await user.type(screen.getByLabelText('Reason for declining (optional)'), 'Rushed.');

    clock.now = '2026-10-12T15:30:00Z';
    await user.click(screen.getByRole('link', { name: 'Other Trade' }));
    expect(await screen.findByRole('group', { name: 'Execution 1' })).toBeTruthy();
    expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenLastCalledWith({ tradeId: 'trade-2' });
    expect(screen.getAllByRole('group', { name: /^Execution \d+$/ })).toHaveLength(1);
    for (const label of ['Quantity', 'Price', 'Fee']) expect(within(row(1)).getByLabelText<HTMLInputElement>(label).value).toBe('');
    expect(within(row(1)).getByLabelText<HTMLInputElement>('Economic Time').value).toBe('2026-10-12T11:30');
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Decline to reflect' }).checked).toBe(false);
    expect(screen.queryByLabelText('Reason for declining (optional)')).toBeNull();
    for (const name of ['Decision mode', 'Primary emotion', 'Decision confidence']) {
      expect(
        within(screen.getByRole('radiogroup', { name }))
          .getAllByRole<HTMLInputElement>('radio')
          .filter((r) => r.checked),
      ).toEqual([]);
    }
    expect(screen.getByLabelText<HTMLTextAreaElement>('Note').value).toBe('');
    // Declining afterwards starts with an empty reason too.
    await user.click(screen.getByRole('checkbox', { name: 'Decline to reflect' }));
    expect(screen.getByLabelText<HTMLTextAreaElement>('Reason for declining (optional)').value).toBe('');
  });

  it('should show no issues, conflict, or receipt carried over from the previous Trade', async () => {
    const facade = positionChangeFormFacade();
    renderAcrossTrades(facade, { now: '2026-10-12T14:05:00Z' });
    const user = userEvent.setup();
    const save = async () => user.click(await screen.findByRole('button', { name: 'Save entry' }));
    const move = async (name: string) => {
      await user.click(screen.getByRole('link', { name }));
      expect(await screen.findByRole('group', { name: 'Execution 1' })).toBeTruthy();
    };

    // Issues on trade-1 do not follow the form to trade-2.
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValueOnce({
      ...rejected,
      issues: [{ source: 'TradeWorkflows', member: 0, field: 'quantity', code: 'Required' }],
    } as never);
    await save();
    expect(await screen.findByRole('region', { name: 'This entry can’t be saved yet' })).toBeTruthy();
    await move('Other Trade');
    expect(screen.queryByRole('region', { name: 'This entry can’t be saved yet' })).toBeNull();

    // A Conflict on trade-2 does not follow the form back to trade-1.
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValueOnce({ kind: 'Conflict', changed: ['trade:trade-2'] } as never);
    await save();
    expect(await screen.findByRole('region', { name: 'This Trade changed after you opened this form' })).toBeTruthy();
    await move('First Trade');
    expect(screen.queryByRole('region', { name: 'This Trade changed after you opened this form' })).toBeNull();

    // A receipt for trade-1 gives way to trade-2's form.
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValueOnce({
      kind: 'Recorded',
      receipt: { tradeId: 'trade-1', createdFactIds: ['pc-1', 'ex-1'], deviationReconciliation: [], entryChanges: [], repairs: [] },
      postCommit: {
        trade: {
          positionChanges: [
            {
              factId: 'pc-1',
              economicTime: '2026-10-12T14:00:00Z',
              recordedSequence: 1,
              executions: [
                {
                  factId: 'ex-1',
                  economicTime: '2026-10-12T14:00:00Z',
                  recordedSequence: 2,
                  action: 'Buy',
                  instrument: { kind: 'Stock', symbol: 'XYZ' },
                  quantity: '60',
                  price: '50.10',
                  fee: '1.00',
                },
              ],
            },
          ],
        },
        derivation: { entryQuality: { kind: 'NotApplicable' } },
        reflection: { kind: 'Entry' },
      },
      affected: [],
    } as never);
    await save();
    expect(await screen.findByRole('region', { name: 'Entry recorded' })).toBeTruthy();
    await move('Other Trade');
    expect(screen.queryByRole('region', { name: 'Entry recorded' })).toBeNull();
    expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenLastCalledWith({ tradeId: 'trade-2' });
  });

  it('should report the form as not unsaved once it moves to the other Trade', async () => {
    const dirty = vi.fn();
    renderAcrossTrades(positionChangeFormFacade(), { now: '2026-10-12T14:05:00Z' }, dirty);
    const user = userEvent.setup();
    await user.type(await within(await screen.findByRole('group', { name: 'Execution 1' })).findByLabelText('Quantity'), '30');
    await user.click(screen.getByRole('checkbox', { name: 'Decline to reflect' }));
    expect(dirty).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole('link', { name: 'Other Trade' }));
    expect(await screen.findByRole('group', { name: 'Execution 1' })).toBeTruthy();
    expect(dirty).toHaveBeenLastCalledWith(false);
    // The other Trade's form registers as unsaved again once a value is entered there.
    await user.type(within(row(1)).getByLabelText('Price'), '50');
    expect(dirty).toHaveBeenLastCalledWith(true);
  });
});

describe('after a Conflict', () => {
  const conflict = { kind: 'Conflict', changed: ['trade:trade-1'] };
  const latest = { kind: 'Ready', view: openDetailOf([PC1]), binding: { databaseName: 'tj-ws-1', contentRevision: 8 } };

  async function conflicted(declineInstead = false) {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(conflict as never);
    const user = userEvent.setup();
    await fillRows(user, [
      ['40', '50.30', '1.00', '2026-10-12T11:00'],
      ['20', '50.40', '0.50', '2026-10-12T11:30'],
    ]);
    if (declineInstead) {
      await user.click(screen.getByLabelText('Decline to reflect'));
      await user.type(screen.getByLabelText('Reason for declining (optional)'), 'Nothing new.');
    } else await completeReflection(user);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    const message = await screen.findByRole('region', { name: 'This Trade changed after you opened this form' });
    return { facade, user, message };
  }

  it('should offer Load the latest Trade in the Conflict message, keeping every entered Execution row, answer, decline and reason', async () => {
    const { message } = await conflicted();
    expect(within(message).getByRole('button', { name: 'Load the latest Trade' })).toBeTruthy();
    expect(within(row(1)).getByLabelText<HTMLInputElement>('Quantity').value).toBe('40');
    expect(within(row(2)).getByLabelText<HTMLInputElement>('Fee').value).toBe('0.50');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Note').value).toBe('Filled at the open.');
    cleanup();
    const declined = await conflicted(true);
    expect(within(declined.message).getByRole('button', { name: 'Load the latest Trade' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Decline to reflect').checked).toBe(true);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Reason for declining (optional)').value).toBe('Nothing new.');
  });

  it('should reload the Detail when chosen, so the next save uses the new FactRevision and records exactly one Position Change', async () => {
    const { facade, user, message } = await conflicted();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue(latest as never);
    await user.click(within(message).getByRole('button', { name: 'Load the latest Trade' }));
    await vi.waitFor(() => expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenCalledTimes(2));
    // The form never went back to Loading: the values stay on screen throughout.
    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'This Trade changed after you opened this form' })).toBeNull());
    expect(within(row(1)).getByLabelText<HTMLInputElement>('Quantity').value).toBe('40');
    expect(facade.Journal.getDefinitions).toHaveBeenCalledTimes(1);

    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockClear();
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    await vi.waitFor(() => expect(facade.TradeWorkflows.recordPositionChange).toHaveBeenCalledTimes(1));
    expect(vi.mocked(facade.TradeWorkflows.recordPositionChange).mock.calls[0]![0].trades).toEqual([{ tradeId: 'trade-1', expectedFactRevision: 3 }]);
  });

  it('should show the reloaded Trades changed figures above the kept values before the trader saves again', async () => {
    const { facade, user, message } = await conflicted();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue(latest as never);
    await user.click(within(message).getByRole('button', { name: 'Load the latest Trade' }));
    const figures = await screen.findByRole('region', { name: 'Latest Trade' });
    expect(within(figures).getByText('60 shares of XYZ')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'This Trade changed after you opened this form' })).toBeNull();
    const first = row(1);
    expect(figures.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should keep the Conflict message and the values when the reload itself fails', async () => {
    const { facade, user, message } = await conflicted();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockRejectedValue(new Error('read failed'));
    await user.click(within(message).getByRole('button', { name: 'Load the latest Trade' }));
    expect(await screen.findByText(/couldn’t load the latest Trade/)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'This Trade changed after you opened this form' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load the latest Trade' })).toBeTruthy();
    expect(within(row(1)).getByLabelText<HTMLInputElement>('Quantity').value).toBe('40');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Note').value).toBe('Filled at the open.');
  });
});

describe('focus after navigation', () => {
  it('should move focus to the Record entry heading when the form finishes loading', async () => {
    renderForm();
    const heading = await screen.findByRole('heading', { level: 1, name: 'Record entry' });
    expect(document.activeElement).toBe(heading);
  });

  it('should move focus to the Entry recorded heading when the receipt replaces the form', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(recordedResult());
    const user = userEvent.setup();
    await fillRows(user, [['20', '51.00', '1.00', '2026-10-12T14:00']]);
    await completeReflection(user);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    const heading = await screen.findByRole('heading', { level: 1, name: 'Entry recorded' });
    expect(document.activeElement).toBe(heading);
  });

  it('should not move focus away from the summary after a rejected save', async () => {
    const facade = renderForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({
      ...rejected,
      issues: [{ source: 'TradeWorkflows', member: 0, field: 'quantity', code: 'NotPositive' }],
    } as never);
    const user = userEvent.setup();
    await fillRows(user, [['0', '51.00', '1.00', '2026-10-12T14:00']]);
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    const summary = await screen.findByRole('region', { name: 'This entry can’t be saved yet' });
    expect(document.activeElement).toBe(summary);
  });
});
