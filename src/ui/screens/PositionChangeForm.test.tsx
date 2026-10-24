// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { positionChangeFormFacade } from '../../../tests/support/position-change-form-facade.ts';
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
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({
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
    } as never);
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
