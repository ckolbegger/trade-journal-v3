// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeReviewDefinition, closeReasonRecords, exitFormFacade, positionChangeFormFacade, reflectionDefinition6 } from '../../../tests/support/position-change-form-facade.ts';
import { openDetailOf, PC1, PC2 } from '../../../tests/support/open-detail-fixtures.ts';
import type { UiFacade } from '../../app/compose.ts';
import { RuntimeContext } from '../runtime.tsx';
import { PositionChangeForm } from './PositionChangeForm.tsx';

afterEach(cleanup);

// The Plan Exit facts the view returns for the reference Trade: 100 shares of XYZ, a Stop at 47.50 and a Target at 56, neither reached.
const xyz = { kind: 'Stock', symbol: 'XYZ' } as const;
const stop = (status: 'Active' | 'Breached' = 'Active') => ({ id: 'stop-1', role: 'Stop', boundary: '47.5', status, pricedInTradedInstrument: true }) as const;
const target = (status: 'Active' | 'Reached' = 'Active') => ({ id: 'target-1', role: 'Target', boundary: '56', status, pricedInTradedInstrument: true }) as const;
const planExitOf = (conditions: readonly unknown[], extra: Record<string, unknown> = {}) => ({ positions: [{ instrument: xyz, quantity: '100', conditions }], heldPast: [], ...extra });
const detailWith = (planExit: unknown) => ({ ...openDetailOf([PC1, PC2]), planExit });

// The exit form on manifest 6's reflection (the Plan Departure Reason asked by the form itself).
function renderExitForm(planExit: unknown = planExitOf([stop(), target()])): UiFacade {
  const facade = exitFormFacade(detailWith(planExit));
  vi.mocked(facade.Journal.getDefinitions).mockImplementation((request) =>
    Promise.resolve({ kind: 'Found', definition: ('latestFor' in request && request.latestFor === 'entry-type.close-review' ? closeReviewDefinition : reflectionDefinition6) as never }),
  );
  render(
    <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
      <MemoryRouter initialEntries={['/trades/trade-1/record-entry?action=Sell']}>
        <Routes>
          <Route path="/trades/:tradeId/record-entry" element={<PositionChangeForm facade={facade} timeZone="America/New_York" now={() => '2026-10-13T14:05:00Z'} onDirtyChange={() => undefined} />} />
          <Route path="/trades/:tradeId" element={<p>Trade Detail route</p>} />
        </Routes>
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
  return facade;
}

const rowOf = (n: number) => screen.getByRole('group', { name: `Execution ${n}` });
async function fillRow(user: ReturnType<typeof userEvent.setup>, n: number, quantity: string, price = '52.00', fee = '0.60') {
  for (const [label, value] of [['Quantity', quantity], ['Price', price], ['Fee', fee]] as const) {
    await user.clear(within(rowOf(n)).getByLabelText(label));
    await user.type(within(rowOf(n)).getByLabelText(label), value);
  }
}
const againstThePlan = () => screen.getByRole('region', { name: 'Against the Plan' });

const rejected = { kind: 'Rejected', issues: [], binding: { databaseName: 'tj-ws-1', contentRevision: 7 } };
const lastCommand = (facade: UiFacade) => vi.mocked(facade.TradeWorkflows.recordPositionChange).mock.lastCall![0] as unknown as Record<string, unknown>;

describe('the Plan check on the exit form (T95.39)', () => {
  it('should keep the three choices on a buy', async () => {
    const facade = positionChangeFormFacade();
    vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition: reflectionDefinition6 } as never);
    render(
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
        <MemoryRouter initialEntries={['/trades/trade-1/record-entry']}>
          <Routes>
            <Route path="/trades/:tradeId/record-entry" element={<PositionChangeForm facade={facade} timeZone="America/New_York" now={() => '2026-10-13T14:05:00Z'} onDirtyChange={() => undefined} />} />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    const reflection = within(await screen.findByRole('region', { name: 'Position Change Reflection' }));
    expect(within(reflection.getByRole('radiogroup', { name: 'Reflection' })).getAllByRole('radio').map((r) => (r.closest('label') as HTMLElement).textContent)).toEqual(['Reflect now', 'Reflect later', 'Decline to reflect']);
    expect(screen.queryByRole('button', { name: 'Add more' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Against the Plan' })).toBeNull();
  });

  it('should show the workflow refusal when it comes back', async () => {
    const facade = renderExitForm();
    // The save measured the sale differently (a backdated sale, say): it wants the reason the form did not ask for.
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({
      ...rejected,
      issues: [{ source: 'TradeWorkflows', field: 'prompt.position-change-reflection.plan-departure', code: 'PlanDepartureReasonRequired' }],
    } as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '100', '47.00');
    expect(screen.queryByLabelText('Why did you leave the Plan?')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save exit' }));
    const question = await screen.findByLabelText('Why did you leave the Plan?');
    expect(screen.getAllByText('Say why you left the Plan, or choose “Say why later”.').length).toBeGreaterThan(0);
    expect(question.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('button', { name: 'Say why later' })).toBeTruthy();
  });

  it('should drop the question and let Save send once an edit makes the sale follow the Plan after a refusal', async () => {
    const facade = renderExitForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(rejected as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '60', '52.00');
    await user.click(screen.getByRole('button', { name: 'Save exit' }));
    expect(screen.getAllByText('Say why you left the Plan, or choose “Say why later”.').length).toBeGreaterThan(0);
    expect(vi.mocked(facade.TradeWorkflows.recordPositionChange)).not.toHaveBeenCalled();
    await fillRow(user, 1, '100', '47.00');
    expect(screen.queryByLabelText('Why did you leave the Plan?')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save exit' }));
    expect(vi.mocked(facade.TradeWorkflows.recordPositionChange)).toHaveBeenCalledTimes(1);
  });

  it('should send a completed reflection when the reason is given or none is owed, and Defer for the Close Review on a closing sale', async () => {
    const facade = renderExitForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(rejected as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    const save = () => user.click(screen.getByRole('button', { name: 'Save exit' }));
    // Following the Plan, and closing: nothing is owed, so the reflection is completed with no answers.
    await fillRow(user, 1, '100', '47.00');
    await user.click(within(screen.getByRole('radiogroup', { name: 'Close Reason' })).getAllByRole('radio')[0]!);
    await save();
    expect(lastCommand(facade)).toMatchObject({ reflection: { kind: 'Complete', form: { definitionId: 'def-pcr-3', answers: {} } }, closeReasonId: 'cr-1', closeReview: { kind: 'Defer' } });
    // Leaving the Plan, with the reason given, on a part sale: no Close Review.
    await fillRow(user, 1, '60', '52.00');
    await user.type(screen.getByLabelText('Why did you leave the Plan?'), 'Taking some off.');
    await save();
    const command = lastCommand(facade);
    expect(command.reflection).toEqual({ kind: 'Complete', form: { definitionId: 'def-pcr-3', answers: { 'prompt.position-change-reflection.plan-departure': { kind: 'Text', text: 'Taking some off.' } } } });
    expect(command).not.toHaveProperty('closeReview');
  });


  it('should ask the Close Reason on a closing sale with nothing preselected, and offer no Close Review choice', async () => {
    renderExitForm();
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '100', '47.00');
    const closing = within(screen.getByRole('region', { name: 'Closing the Trade' }));
    const reasons = closing.getByRole('radiogroup', { name: 'Close Reason' });
    expect(within(reasons).getAllByRole<HTMLInputElement>('radio').map((r) => r.checked)).toEqual(closeReasonRecords.map(() => false));
    expect(closing.queryByRole('radiogroup', { name: 'Close Review' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Reflect later' })).toBeNull();
  });


  it('should keep the three earlier reflection prompts behind Add more', async () => {
    renderExitForm();
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    const earlier = ['Decision mode', 'Primary emotion', 'Decision confidence'];
    for (const name of earlier) expect(screen.queryByRole('radiogroup', { name })).toBeNull();
    const more = screen.getByRole('button', { name: 'Add more' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    await user.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    for (const name of earlier) expect(screen.getByRole('radiogroup', { name })).toBeTruthy();
  });


  it('should offer no Reflect now, Reflect later or Decline to reflect for a sale', async () => {
    renderExitForm();
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '60', '52.00');
    for (const name of ['Reflect now', 'Reflect later', 'Decline to reflect']) expect(screen.queryByRole('radio', { name })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Reflection' })).toBeNull();
  });


  it('should refuse a save with the question empty unless Say why later was chosen, and say so in words', async () => {
    const facade = renderExitForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(rejected as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '60', '52.00');
    await user.click(screen.getByRole('button', { name: 'Save exit' }));
    expect(facade.TradeWorkflows.recordPositionChange).not.toHaveBeenCalled();
    const question = screen.getByLabelText('Why did you leave the Plan?');
    expect(screen.getAllByText('Say why you left the Plan, or choose “Say why later”.').length).toBeGreaterThan(0);
    expect(question.getAttribute('aria-invalid')).toBe('true');
    // Typing the answer clears the refusal.
    await user.type(question, 'Taking part off.');
    expect(screen.queryByText('Say why you left the Plan, or choose “Say why later”.')).toBeNull();
  });


  it('should save the sale at once on Say why later, sending the reflection put off', async () => {
    const facade = renderExitForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(rejected as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '60', '52.00');
    await user.type(screen.getByLabelText('Why did you leave the Plan?'), 'typed but put off');
    await user.click(screen.getByRole('button', { name: 'Say why later' }));
    expect(facade.TradeWorkflows.recordPositionChange).toHaveBeenCalledTimes(1);
    expect(lastCommand(facade).reflection).toEqual({ kind: 'Defer' });
  });


  it('should show the Exit saved reason and ask nothing when it carries', async () => {
    renderExitForm(planExitOf([stop(), target()], { exit: { reviewDate: '2026-11-16', reason: 'The thesis broke.' } }));
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '100', '52.00');
    expect(againstThePlan().textContent).toContain('Your reason, Mon Nov 16: "The thesis broke." Nothing more to ask.');
    expect(screen.queryByLabelText('Why did you leave the Plan?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Say why later' })).toBeNull();
    // A part sale always asks, whatever the Exit says.
    await fillRow(user, 1, '60', '52.00');
    expect(againstThePlan().textContent).not.toContain('Your reason');
    expect(screen.getByLabelText('Why did you leave the Plan?')).toBeTruthy();
  });


  it('should ask Why only part for a part sale', async () => {
    renderExitForm(planExitOf([stop('Breached'), target()]));
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '60', '52.00');
    expect(screen.getByLabelText('Why only part?')).toBeTruthy();
    expect(screen.queryByLabelText('Why did you leave the Plan?')).toBeNull();
  });


  it('should ask Why did you leave the Plan once when the sale leaves it, with Say why later beside it', async () => {
    renderExitForm();
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    expect(screen.queryByLabelText('Why did you leave the Plan?')).toBeNull();
    await fillRow(user, 1, '60', '52.00');
    // Two reasons (before a line, and part only) still make one question.
    const question = screen.getByLabelText('Why did you leave the Plan?');
    expect(screen.getAllByLabelText('Why did you leave the Plan?')).toHaveLength(1);
    const asked = within(question.closest('.field') as HTMLElement);
    expect(asked.getByRole('button', { name: 'Say why later' })).toBeTruthy();
  });


  it('should say Leaves the Plan with each reason, changing as the quantity or price is typed', async () => {
    renderExitForm();
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '100', '52.00');
    expect(againstThePlan().textContent).toContain('Leaves the Plan:');
    expect(within(againstThePlan()).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Neither the Stop nor the Target is reached.']);
    await fillRow(user, 1, '60', '52.00');
    expect(within(againstThePlan()).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Neither the Stop nor the Target is reached.', "The Plan's exit is all 100 shares. This sells 60."]);
    await fillRow(user, 1, '100', '47.00');
    expect(againstThePlan().textContent).not.toContain('Leaves the Plan:');
    cleanup();
    // The Stop was reached Monday Nov 9 and held past on five Review Dates.
    renderExitForm(planExitOf([stop('Breached'), target()], { heldPast: [{ conditionId: 'stop-1', line: 'Stop', since: '2026-11-09', sessions: 5 }] }));
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '100', '52.00');
    expect(within(againstThePlan()).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['The Stop was reached Mon Nov 9. You held 5 sessions past it.']);
  });


  it('should say Follows the Plan and ask nothing when the typed sale follows it', async () => {
    renderExitForm();
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '100', '47.00');
    expect(againstThePlan().textContent).toContain('Follows the Plan: all 100 shares, at the Stop. Nothing more to ask.');
    expect(screen.queryByLabelText('Why did you leave the Plan?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Say why later' })).toBeNull();
  });

  it('should state the Plan exit under Against the Plan', async () => {
    renderExitForm();
    await screen.findByRole('group', { name: 'Execution 1' });
    expect(againstThePlan().textContent).toContain("The Plan's exit: all 100 shares at the Stop (XYZ at or below $47.50) or the Target (XYZ at or above $56.00).");
  });
});
