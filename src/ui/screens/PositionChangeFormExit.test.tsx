// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closedExitResult, earlierDatedExitResult, partialExitResult } from '../../../tests/support/exit-result-fixtures.ts';
import { exitFormFacade, plannedDetail } from '../../../tests/support/position-change-form-facade.ts';
import type { UiFacade } from '../../app/compose.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { PositionChangeForm } from './PositionChangeForm.tsx';

afterEach(cleanup);

// The exit form is the entry form's route with the Sell action (D6 A93).
function renderExitForm(facade: UiFacade = exitFormFacade(), now: () => string = () => '2026-10-13T14:05:00Z') {
  render(
    <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
      <MemoryRouter initialEntries={['/trades/trade-1/record-entry?action=Sell']}>
        <Routes>
          <Route
            path="/trades/:tradeId/record-entry"
            element={<PositionChangeForm facade={facade} timeZone="America/New_York" now={now} onDirtyChange={() => undefined} />}
          />
          <Route path="/trades/:tradeId" element={<p>Trade Detail route</p>} />
        </Routes>
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
  return facade;
}

describe('rendering (A93)', () => {
  it('should render Record exit with Sell, the symbol, and the Planned Leg read-only, Execution rows, and Reflection on this exit with Reflect now selected', async () => {
    renderExitForm();
    expect(await screen.findByRole('heading', { level: 1, name: 'Record exit' })).toBeTruthy();
    const terms = screen.getByRole('region', { name: 'Exit' });
    expect(within(terms).getByText('XYZ')).toBeTruthy();
    expect(within(terms).getByText('Sell')).toBeTruthy();
    expect(within(terms).getByText('Long 100 shares of XYZ')).toBeTruthy();
    expect(within(terms).queryAllByRole('textbox')).toEqual([]);

    const row = screen.getByRole('group', { name: 'Execution 1' });
    for (const label of ['Quantity', 'Price', 'Fee', 'Economic Time']) expect(within(row).getByLabelText(label)).toBeTruthy();
    expect(within(row).getByLabelText<HTMLInputElement>('Economic Time').value).toBe('2026-10-13T10:05');

    const reflection = screen.getByRole('region', { name: 'Reflection on this exit' });
    expect(within(reflection).getByRole('radio', { name: 'Reflect now' })).toHaveProperty('checked', true);
    expect(within(reflection).getByRole('radio', { name: 'Reflect later' })).toHaveProperty('checked', false);
    expect(screen.getByRole('button', { name: 'Save exit' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Record entry' })).toBeNull();
  });

  it('should show Closing the Trade, with Close Reason as a radio group of the selectable reasons and Close Review with its own disposition group with Reflect now selected, once the entered quantities total the open quantity, and hide it otherwise', async () => {
    const facade = renderExitForm();
    const user = userEvent.setup();
    const closing = () => screen.queryByRole('region', { name: 'Closing the Trade' });
    const row = (n: number) => screen.getByRole('group', { name: `Execution ${n}` });
    const enter = async (n: number, value: string) => {
      await user.clear(within(row(n)).getByLabelText('Quantity'));
      await user.type(within(row(n)).getByLabelText('Quantity'), value);
    };
    await screen.findByRole('group', { name: 'Execution 1' });
    expect(facade.ReferenceCatalog.query).toHaveBeenCalledWith(expect.objectContaining({ family: 'CloseReason' }));
    expect(facade.Journal.getDefinitions).toHaveBeenCalledWith({ latestFor: 'entry-type.close-review' });
    // Nothing is entered, then less than the 100 shares open.
    expect(closing()).toBeNull();
    await enter(1, '60');
    expect(closing()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add Execution' }));
    await enter(2, '39');
    expect(closing()).toBeNull();
    // 60 and 40 total the open quantity.
    await enter(2, '40');
    const section = within(closing()!);
    const labels = (group: HTMLElement) => within(group).getAllByRole('radio').map((r) => (r.closest('label') as HTMLElement).textContent);
    const reason = section.getByRole('radiogroup', { name: 'Close Reason' });
    expect(labels(reason)).toEqual(['Target Reached', 'Stop Triggered', 'Thesis Invalidated', 'Time-Based Exit']);
    expect(within(reason).getAllByRole<HTMLInputElement>('radio').map((r) => r.checked)).toEqual([false, false, false, false]);
    const review = section.getByRole('radiogroup', { name: 'Close Review' });
    expect(labels(review)).toEqual(['Reflect now', 'Reflect later', 'Decline to reflect']);
    expect(within(review).getByRole('radio', { name: 'Reflect now' })).toHaveProperty('checked', true);
    expect(section.getByRole('radiogroup', { name: 'Would you take this Trade again under similar conditions?' })).toBeTruthy();
    // The Close Review's disposition is its own: the exit's reflection keeps Reflect now.
    await user.click(within(review).getByRole('radio', { name: 'Reflect later' }));
    expect(section.queryByRole('radiogroup', { name: 'Would you take this Trade again under similar conditions?' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Reflection on this exit' })).getByRole('radio', { name: 'Reflect now' })).toHaveProperty('checked', true);
    // More than the open quantity does not close it either.
    await enter(2, '41');
    expect(closing()).toBeNull();
  });
});

describe('a Trade with nothing to exit', () => {
  // Not in the breakdown: the exit link is Detail's to offer (T6.19), but the route can be opened by hand.
  it('should offer no exit form for a Trade with no open Position', async () => {
    renderExitForm(exitFormFacade(plannedDetail));
    expect(await screen.findByRole('heading', { level: 1, name: 'Record exit' })).toBeTruthy();
    expect(screen.getByText('This Trade has no open Position to exit.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the Trade' }).getAttribute('href')).toBe('/trades/trade-1');
    expect(screen.queryByRole('group', { name: 'Execution 1' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save exit' })).toBeNull();
  });
});

const rejected = { kind: 'Rejected', issues: [], binding: { databaseName: 'tj-ws-1', contentRevision: 7 } };
const rowOf = (n: number) => screen.getByRole('group', { name: `Execution ${n}` });

// Types the quantity, price, and fee of one Execution row; the time keeps its default (now).
async function fillRow(user: ReturnType<typeof userEvent.setup>, n: number, quantity: string, price = '52.00', fee = '0.60') {
  for (const [label, value] of [['Quantity', quantity], ['Price', price], ['Fee', fee]] as const) {
    await user.clear(within(rowOf(n)).getByLabelText(label));
    await user.type(within(rowOf(n)).getByLabelText(label), value);
  }
}

const sell = (quantity: string) => ({
  kind: 'Execution',
  tradeId: 'trade-1',
  action: 'Sell',
  instrument: { kind: 'Stock', symbol: 'XYZ' },
  intent: { kind: 'ServesPlannedLeg', plannedLegId: 'leg-1' },
  quantity,
  price: '52.00',
  fee: '0.60',
  economicTime: '2026-10-13T14:05:00Z',
});

describe('submission', () => {
  it('should submit the Close Reason identity and the Close Review disposition only while the section is shown', async () => {
    const facade = renderExitForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(rejected as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    const save = () => user.click(screen.getByRole('button', { name: 'Save exit' }));
    const lastCommand = () => vi.mocked(facade.TradeWorkflows.recordPositionChange).mock.lastCall![0] as unknown as Record<string, unknown>;
    await user.click(within(screen.getByRole('region', { name: 'Reflection on this exit' })).getByRole('radio', { name: 'Reflect later' }));

    // A partial exit: no section, so neither is submitted.
    await fillRow(user, 1, '60');
    await save();
    expect(facade.TradeWorkflows.recordPositionChange).toHaveBeenCalledTimes(1);
    expect(lastCommand()).toEqual({
      originTradeId: 'trade-1',
      trades: [{ tradeId: 'trade-1', expectedFactRevision: 3 }],
      members: [sell('60')],
      reflection: { kind: 'Defer' },
    });
    expect(lastCommand()).not.toHaveProperty('closeReasonId');
    expect(lastCommand()).not.toHaveProperty('closeReview');

    // The full quantity shows the section: the chosen reason and the completed Close Review go with it.
    await fillRow(user, 1, '100');
    const closing = () => within(screen.getByRole('region', { name: 'Closing the Trade' }));
    await user.click(closing().getByRole('radio', { name: 'Stop Triggered' }));
    await user.click(closing().getByRole('radio', { name: 'Yes, as planned' }));
    await user.type(closing().getByLabelText('What is the key lesson?'), 'Sold into strength.');
    await save();
    expect(lastCommand()).toEqual({
      originTradeId: 'trade-1',
      trades: [{ tradeId: 'trade-1', expectedFactRevision: 3 }],
      members: [sell('100')],
      reflection: { kind: 'Defer' },
      closeReasonId: 'cr-2',
      closeReview: {
        kind: 'Complete',
        form: {
          definitionId: 'def-cr-1',
          answers: {
            'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' },
            'prompt.close-review.key-lesson': { kind: 'Text', text: 'Sold into strength.' },
          },
        },
      },
    });

    // Each disposition submits for the Close Review alone, whatever the exit's reflection is.
    await user.click(closing().getByRole('radio', { name: 'Reflect later' }));
    await save();
    expect(lastCommand()).toEqual(expect.objectContaining({ reflection: { kind: 'Defer' }, closeReasonId: 'cr-2', closeReview: { kind: 'Defer' } }));
    await user.click(closing().getByRole('radio', { name: 'Decline to reflect' }));
    await user.type(closing().getByLabelText('Reason for declining the Close Review (optional)'), 'Nothing to add.');
    await save();
    expect(lastCommand()).toEqual(
      expect.objectContaining({ reflection: { kind: 'Defer' }, closeReview: { kind: 'Decline', definitionId: 'def-cr-1', reason: 'Nothing to add.' } }),
    );

    // Back to a partial exit, the section goes and so do its values, which the form keeps.
    await fillRow(user, 1, '60');
    expect(screen.queryByRole('region', { name: 'Closing the Trade' })).toBeNull();
    await save();
    expect(lastCommand()).not.toHaveProperty('closeReasonId');
    expect(lastCommand()).not.toHaveProperty('closeReview');
    await fillRow(user, 1, '100');
    expect(closing().getByRole('radio', { name: 'Stop Triggered' })).toHaveProperty('checked', true);
  });

  it('should on CloseReasonRequired show the section with the issue, keeping every entered value', async () => {
    const facade = renderExitForm();
    const required = [
      { source: 'TradeWorkflows', field: 'closeReasonId', code: 'CloseReasonRequired' },
      { source: 'TradeWorkflows', field: 'closeReview', code: 'CloseReviewDispositionRequired' },
    ];
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({ ...rejected, issues: required } as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    // 60 of the 100 shares: the form shows no section, though the workflow finds the exit terminal.
    await fillRow(user, 1, '60', '52.25', '0.75');
    const exitReflection = within(screen.getByRole('region', { name: 'Reflection on this exit' }));
    await user.click(exitReflection.getByRole('radio', { name: 'Reactive' }));
    await user.type(exitReflection.getByLabelText('Note'), 'Sold into the spike.');
    expect(screen.queryByRole('region', { name: 'Closing the Trade' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save exit' }));

    const summary = await screen.findByRole('region', { name: 'This exit can’t be saved yet' });
    expect(within(summary).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Choose a Close Reason.', 'Choose how to meet the Close Review.']);
    const closing = within(screen.getByRole('region', { name: 'Closing the Trade' }));
    const reasons = closing.getByRole('radiogroup', { name: 'Close Reason' });
    expect(reasons.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(reasons.getAttribute('aria-describedby')!)!.textContent).toBe('Choose a Close Reason.');
    expect(closing.getByRole('radio', { name: 'Reflect now' })).toHaveProperty('checked', true);

    // Every entered value is kept.
    expect(within(rowOf(1)).getByLabelText<HTMLInputElement>('Quantity').value).toBe('60');
    expect(within(rowOf(1)).getByLabelText<HTMLInputElement>('Price').value).toBe('52.25');
    expect(within(rowOf(1)).getByLabelText<HTMLInputElement>('Fee').value).toBe('0.75');
    expect(within(rowOf(1)).getByLabelText<HTMLInputElement>('Economic Time').value).toBe('2026-10-13T10:05');
    expect(exitReflection.getByRole('radio', { name: 'Reactive' })).toHaveProperty('checked', true);
    expect(exitReflection.getByLabelText<HTMLTextAreaElement>('Note').value).toBe('Sold into the spike.');

    // Choosing a reason clears its issue, and the next Save submits the section.
    await user.click(closing.getByRole('radio', { name: 'Target Reached' }));
    expect(within(summary).queryByText('Choose a Close Reason.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save exit' }));
    const closeReview: unknown = expect.objectContaining({ kind: 'Complete' });
    expect(vi.mocked(facade.TradeWorkflows.recordPositionChange).mock.lastCall![0]).toEqual(
      expect.objectContaining({ members: [{ ...sell('60'), price: '52.25', fee: '0.75' }], closeReasonId: 'cr-1', closeReview }),
    );

    // Only a member issue comes back while the section is shown: the section and its values stay.
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({
      ...rejected,
      issues: [{ source: 'TradeWorkflows', member: 0, field: 'fee', code: 'Negative' }],
    } as never);
    await user.click(screen.getByRole('button', { name: 'Save exit' }));
    expect((await screen.findAllByText(/Execution 1:/)).length).toBeGreaterThan(0);
    expect(closing.getByRole('radio', { name: 'Target Reached' })).toHaveProperty('checked', true);
  });

  // T6.17-B1, item 2 (ocr, Doubtful): the workflow's verdict is about the quantities it was given.
  it('should hide a section the workflow required once the quantities no longer total the open quantity, submit nothing for it, and keep its values', async () => {
    const facade = renderExitForm();
    const required = [
      { source: 'TradeWorkflows', field: 'closeReasonId', code: 'CloseReasonRequired' },
      { source: 'TradeWorkflows', field: 'closeReview', code: 'CloseReviewDispositionRequired' },
    ];
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({ ...rejected, issues: required } as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    const lastCommand = () => vi.mocked(facade.TradeWorkflows.recordPositionChange).mock.lastCall![0] as unknown as Record<string, unknown>;
    const closing = () => screen.queryByRole('region', { name: 'Closing the Trade' });
    // 60 of the 100 shares: the workflow finds the exit terminal and the section shows.
    await fillRow(user, 1, '60');
    await user.click(screen.getByRole('button', { name: 'Save exit' }));
    await user.click(within(await screen.findByRole('region', { name: 'Closing the Trade' })).getByRole('radio', { name: 'Stop Triggered' }));
    await user.click(within(closing()!).getByRole('radio', { name: 'Reflect later' }));

    // Fewer shares than before: the verdict about 60 no longer applies, so the section goes.
    await user.clear(within(rowOf(1)).getByLabelText('Quantity'));
    await user.type(within(rowOf(1)).getByLabelText('Quantity'), '50');
    expect(closing()).toBeNull();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(rejected as never);
    await user.click(screen.getByRole('button', { name: 'Save exit' }));
    expect(lastCommand()).toHaveProperty('members', [sell('50')]);
    expect(lastCommand()).not.toHaveProperty('closeReasonId');
    expect(lastCommand()).not.toHaveProperty('closeReview');

    // Back to the quantity the workflow judged: the section returns with the values kept.
    await user.clear(within(rowOf(1)).getByLabelText('Quantity'));
    await user.type(within(rowOf(1)).getByLabelText('Quantity'), '60');
    expect(within(closing()!).getByRole('radio', { name: 'Stop Triggered' })).toHaveProperty('checked', true);
    expect(within(closing()!).getByRole('radio', { name: 'Reflect later' })).toHaveProperty('checked', true);
  });

  // T6.17-B1, item 3 (ocr, Valid minor): the Close Review group is tied to its issue like the Close Reason group.
  it('should tie the Close Review issue to its group and clear it once the disposition changes', async () => {
    const facade = renderExitForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({
      ...rejected,
      issues: [{ source: 'TradeWorkflows', field: 'closeReview', code: 'CloseReviewDispositionRequired' }],
    } as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '100');
    await user.click(screen.getByRole('button', { name: 'Save exit' }));

    expect(await screen.findByRole('region', { name: 'This exit can’t be saved yet' })).toBeTruthy();
    const closing = within(screen.getByRole('region', { name: 'Closing the Trade' }));
    const review = closing.getByRole('radiogroup', { name: 'Close Review' });
    expect(review.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(review.getAttribute('aria-describedby')!)!.textContent).toBe('Choose how to meet the Close Review.');
    // The Close Reason group has no issue, and the exit's reflection group keeps its own markup.
    expect(closing.getByRole('radiogroup', { name: 'Close Reason' }).getAttribute('aria-describedby')).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Reflection' }).getAttribute('aria-describedby')).toBeNull();

    // Choosing a disposition answers the issue: the summary and the message go.
    await user.click(closing.getByRole('radio', { name: 'Reflect later' }));
    expect(screen.queryByRole('region', { name: 'This exit can’t be saved yet' })).toBeNull();
    expect(closing.queryByText('Choose how to meet the Close Review.')).toBeNull();
    expect(closing.getByRole('radiogroup', { name: 'Close Review' }).getAttribute('aria-describedby')).toBeNull();
  });

  it('should render the saved exit from the result alone: Lot Matches, realized P&L, lifecycle Closed, Terminal Disposition, Close Reason, and both reflection outcomes', async () => {
    const facade = renderExitForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(closedExitResult() as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '100');
    await user.click(screen.getByRole('button', { name: 'Save exit' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Exit recorded' })).toBeTruthy();
    // Nothing is read again: Trade Detail was read once, to open the form.
    expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenCalledTimes(1);
    const change = screen.getByRole('region', { name: /^Position Change at / });
    expect(within(change).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Sell 50 XYZ @ $53.00, fee $1.00', 'Sell 20 XYZ @ $53.00, fee $0.40']);

    const matches = within(screen.getByRole('region', { name: 'Lot Matches' }));
    const cells = matches.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
    expect(cells).toEqual([
      ['$50.10 on 2026-10-12 10:00', '$52.00 on 2026-10-13 10:00', '30', '+$55.90'],
      ['$50.10 on 2026-10-12 10:00', '$53.00 on 2026-10-13 14:00', '30', '+$85.90'],
      ['$50.30 on 2026-10-12 11:00', '$53.00 on 2026-10-13 14:00', '20', '+$53.10'],
      ['$50.30 on 2026-10-12 11:00', '$53.00 on 2026-10-13 14:00', '20', '+$53.10'],
    ]);

    const result = screen.getByRole('region', { name: 'Result' });
    const fields = Object.fromEntries(within(result).getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling!.textContent]));
    expect(fields).toEqual({
      Lifecycle: 'Closed',
      'Realized P&L': '+$248.00',
      'Realized R': '+0.99R',
      'Terminal Disposition': 'Closed via sale of 100 shares',
      'Close Reason': 'Target Reached',
    });
    // Both obligations: the exit's reflection was saved, the Close Review declined with its reason.
    expect(within(result).getByText('Reflection saved.')).toBeTruthy();
    expect(within(result).getByText('Close Review declined: Nothing to add.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the Trade' }).getAttribute('href')).toBe('/trades/trade-1');
  });

  // T6.17-B1, item 1 (P23, C6.6): I6.8's 60-share example.
  it('should disclose the Lot Matches an earlier-dated exit changed, with the realized P&L before and after', async () => {
    const facade = renderExitForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(earlierDatedExitResult() as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '60');
    await user.click(screen.getByRole('button', { name: 'Save exit' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Exit recorded' })).toBeTruthy();
    const changed = within(screen.getByRole('region', { name: 'Changed Lot Matches' }));
    const cells = changed.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
    expect(cells).toEqual([
      ['Superseded', '$50.10 on 2026-10-12 10:00', '$52.00 on 2026-10-13 10:00', '30', '—'],
      ['Created', '$50.10 on 2026-10-12 10:00', '$51.50 on 2026-10-13 09:45', '—', '60'],
      ['Created', '$50.30 on 2026-10-12 11:00', '$52.00 on 2026-10-13 10:00', '—', '30'],
    ]);
    const figures = Object.fromEntries(changed.getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling!.textContent]));
    expect(figures).toEqual({ 'Realized to date before': '+$55.90', 'Realized to date after': '+$131.85' });
    // The Lot Matches table above still lists the matches the Trade now has.
    expect(within(screen.getByRole('region', { name: 'Lot Matches' })).getAllByRole('row')).toHaveLength(3);
  });

  // T6.17-B1, item 1: a plain exit's own Created matches are not a disclosure.
  it('should not disclose changed Lot Matches for an exit that only created its own', async () => {
    const facade = renderExitForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(partialExitResult() as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '30');
    await user.click(screen.getByRole('button', { name: 'Save exit' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Exit recorded' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Lot Matches' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Changed Lot Matches' })).toBeNull();
  });

  // Not in the breakdown: a partial exit keeps the Trade Open, asks for no Close Reason, and shows no closing fields.
  it('should render a partial exit as Open with its realized to date, its one Lot Match, and its deferred reflection owed', async () => {
    const facade = renderExitForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(partialExitResult() as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '30');
    await user.click(screen.getByRole('button', { name: 'Save exit' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Exit recorded' })).toBeTruthy();
    const result_ = screen.getByRole('region', { name: 'Result' });
    const fields = Object.fromEntries(within(result_).getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling!.textContent]));
    expect(fields).toEqual({ Lifecycle: 'Open', 'Realized to date': '+$55.90' });
    expect(within(screen.getByRole('region', { name: 'Lot Matches' })).getAllByRole('row')).toHaveLength(2);
    expect(within(result_).getByText('Reflection owed')).toBeTruthy();
    expect(within(result_).queryByText(/Close Review/)).toBeNull();
  });

  // Not in the breakdown: the position-path issues of P22 (B6.4) reach the exit form too.
  it('should name the quantity open beside a row that sells more than is open, and explain the other position path issues', async () => {
    const facade = renderExitForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue({
      ...rejected,
      issues: [
        { source: 'TradeAnalysis', member: 0, field: 'quantity', code: 'ExceedsOpenQuantity', available: Rational.of(100n) },
        { source: 'TradeAnalysis', member: 1, field: 'quantity', code: 'FlatBeforeLaterFacts' },
        { source: 'TradeAnalysis', factId: 'ex-x1', code: 'ExceedsOpenQuantity', available: Rational.of(10n) },
        { source: 'TradeWorkflows', code: 'TradeClosed' },
      ],
    } as never);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Execution 1' });
    await fillRow(user, 1, '101');
    await user.click(screen.getByRole('button', { name: 'Add Execution' }));
    await fillRow(user, 2, '1');
    await user.click(screen.getByRole('button', { name: 'Save exit' }));

    const summary = within(await screen.findByRole('region', { name: 'This exit can’t be saved yet' }));
    expect(summary.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Execution 1: Only 100 shares are open.',
      'Execution 2: this exit would leave the Position flat before a later recorded change.',
      'This exit would leave a later recorded exit without enough shares open.',
      'This Trade is closed. New exposure needs a new Plan.',
    ]);
    const quantity = within(rowOf(1)).getByLabelText('Quantity');
    expect(document.getElementById(quantity.getAttribute('aria-describedby')!)!.textContent).toBe('Execution 1: Only 100 shares are open.');
  });
});

// The exit form as the Review's card hosts it (A94): the Trade is given, and leaving is the host's.
function renderHosted(facade: UiFacade = exitFormFacade(), onLeave: () => void = () => undefined) {
  render(
    <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
      <MemoryRouter>
        <PositionChangeForm
          facade={facade}
          timeZone="America/New_York"
          now={() => '2026-10-13T14:05:00Z'}
          onDirtyChange={() => undefined}
          host={{ tradeId: 'trade-1', titleLevel: 5, onLeave, afterRecorded: <p>After the exit</p> }}
        />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
  return facade;
}

describe('a hosted exit form that cannot be shown (T6.20-B1)', () => {
  it('should offer Close, which leaves, while the hosted exit form loads and when it fails to load', async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();
    // Loading: the Trade is not read yet.
    const loading = exitFormFacade();
    vi.mocked(loading.TradeViewsAndReporting.getTradeDetail).mockReturnValue(new Promise(() => undefined));
    renderHosted(loading, onLeave);
    expect(await screen.findByText('Loading the exit form…')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
    cleanup();

    // Failed: Retry stays, and Close sits beside it.
    const failing = exitFormFacade();
    vi.mocked(failing.TradeViewsAndReporting.getTradeDetail).mockRejectedValue(new Error('read failed'));
    renderHosted(failing, onLeave);
    expect(await screen.findByText('We couldn’t load this exit form. Nothing was changed.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onLeave).toHaveBeenCalledTimes(2);
  });
});

// T6.20-B1: the form's sections sit one level below its title, wherever the title is. The 100 shares open show Closing the
// Trade; the form's levels are read, the exit is saved, and the receipt's levels are read.
async function expectLevels(title: number, section: number) {
  const user = userEvent.setup();
  await screen.findByRole('group', { name: 'Execution 1' });
  await fillRow(user, 1, '100');
  expect(screen.getByRole('heading', { level: title, name: 'Record exit' })).toBeTruthy();
  for (const name of ['Exit', 'Reflection on this exit', 'Closing the Trade']) expect(screen.getByRole('heading', { level: section, name })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Save exit' }));
  expect(await screen.findByRole('heading', { level: title, name: 'Exit recorded' })).toBeTruthy();
  for (const name of [/^Position Change at /, 'Lot Matches', 'Result']) expect(screen.getByRole('heading', { level: section, name })).toBeTruthy();
}

// A receipt that discloses changed matches names them at the section level too.
async function expectChangedMatchesLevel(section: number) {
  const user = userEvent.setup();
  await screen.findByRole('group', { name: 'Execution 1' });
  await fillRow(user, 1, '60');
  await user.click(screen.getByRole('button', { name: 'Save exit' }));
  expect(await screen.findByRole('heading', { level: section, name: 'Changed Lot Matches' })).toBeTruthy();
}

describe('heading levels (T6.20-B1)', () => {
  it('should keep the routed exit form and receipt at h1 with their sections at h2', async () => {
    const facade = renderExitForm();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(closedExitResult() as never);
    await expectLevels(1, 2);
    cleanup();

    const earlier = renderExitForm();
    vi.mocked(earlier.TradeWorkflows.recordPositionChange).mockResolvedValue(earlierDatedExitResult() as never);
    await expectChangedMatchesLevel(2);
  });

  it('should show a hosted exit form and receipt with their title at h5 and their sections one level below it at h6', async () => {
    const facade = renderHosted();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(closedExitResult() as never);
    await expectLevels(5, 6);
    cleanup();

    const earlier = renderHosted();
    vi.mocked(earlier.TradeWorkflows.recordPositionChange).mockResolvedValue(earlierDatedExitResult() as never);
    await expectChangedMatchesLevel(6);
  });
});
