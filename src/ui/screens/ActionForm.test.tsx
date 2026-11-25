// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { closedExitResult, partialExitResult } from '../../../tests/support/exit-result-fixtures.ts';
import { exitFormFacade } from '../../../tests/support/position-change-form-facade.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { DailyTradeReview } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { resetDrafts } from './action-draft.ts';
import { ActionForm, type ActionFormProps } from './ActionForm.tsx';

afterEach(cleanup);
beforeEach(resetDrafts);

type Replay = NonNullable<DailyTradeReview['replay']>;
type PlanCall = NonNullable<DailyTradeReview['planCall']>;

const binding: ActionFormProps['binding'] = {
  reviewDate: '2026-11-16',
  tradeId: 't1',
  factRevision: 2,
  marketDataSnapshotId: 'mds1:1:abc',
  obligationKey: { entryType: 'DailyTradeReview', trade: 't1', reviewDate: '2026-11-16' },
  definitionRevision: 'def1',
  databaseName: 'tj-ws-1',
};

// The Plan as the replay carries it: 200 shares of AXIO, a Stop at $47.00 and a Target at $56.00.
const stockReplay = {
  sessions: [],
  planColumn: {
    terms: {
      legs: [{ instrument: { kind: 'Stock', symbol: 'AXIO' }, side: 'Long', quantity: Rational.of(200n), entryPrice: Rational.of(50n) }],
      conditions: [
        { role: 'Stop', priceOf: 'Underlying', price: Rational.of(47n), pnlIfHit: Rational.of(-600n) },
        { role: 'Target', priceOf: 'Underlying', price: Rational.of(56n), pnlIfHit: Rational.of(1200n) },
      ],
    },
  },
} as unknown as Replay;
// A long call, 4 contracts, a Target at $4.00.
const callReplay = {
  sessions: [],
  planColumn: {
    terms: {
      legs: [{ instrument: { kind: 'Option', symbol: 'AXIO', right: 'Call', strike: '50', expiration: '2026-12-18' }, side: 'Long', quantity: Rational.of(4n), entryPrice: Rational.of(2n) }],
      conditions: [{ role: 'Target', priceOf: 'Option', price: Rational.of(4n), pnlIfHit: Rational.of(800n) }],
    },
  },
} as unknown as Replay;

const out = (role: 'Stop' | 'Target', n = 1): PlanCall => ({ call: 'Out', condition: { id: `${role.toLowerCase()}-${n}`, role, boundary: '47.00' } });
const hold: PlanCall = { call: 'Hold' };

function mount(over: Partial<ActionFormProps> = {}, facade: UiFacade = facadeDouble(), strict = false) {
  const props: ActionFormProps = {
    facade,
    form: { kind: 'New', viewState: {} },
    binding,
    onSaved: () => undefined,
    onRefresh: () => Promise.resolve(true),
    onDirtyChange: () => undefined,
    ...over,
  };
  const tree = (p: ActionFormProps) => {
    const form = (
      <RuntimeContext.Provider value={{ writable: true, timeZone: 'America/New_York', report: () => undefined }}>
        <MemoryRouter>
          <ActionForm {...p} />
        </MemoryRouter>
      </RuntimeContext.Provider>
    );
    return strict ? <StrictMode>{form}</StrictMode> : form;
  };
  const { rerender } = render(tree(props));
  return { facade, user: userEvent.setup(), form: screen.queryByRole('form', { name: 'Action' })!, again: (next: Partial<ActionFormProps>) => rerender(tree({ ...props, ...next })) };
}

describe('What is chosen on opening', () => {
  const chosen = (form: HTMLElement) => within(form).queryAllByRole('radio').filter((r) => (r as HTMLInputElement).checked).map((r) => (r as HTMLInputElement).value);

  it('should show Hold chosen when the view returns it, and nothing chosen with the words otherwise', () => {
    mount({ form: { kind: 'New', viewState: { selectedAction: 'Hold' } }, planCall: hold, replay: stockReplay });
    expect(chosen(screen.getByRole('form', { name: 'Action' }))).toEqual(['Hold']);
    expect(screen.queryByText('Nothing is chosen for you here.')).toBeNull();
    cleanup();
    mount({ form: { kind: 'New', viewState: {} }, planCall: out('Stop'), replay: stockReplay });
    expect(chosen(screen.getByRole('form', { name: 'Action' }))).toEqual([]);
    expect(screen.getByText('Nothing is chosen for you here.')).toBeTruthy();
  });
});

describe('A preselection that arrives after the form opened', () => {
  const chosen = () => screen.queryAllByRole('radio').filter((r) => (r as HTMLInputElement).checked).map((r) => (r as HTMLInputElement).value);

  it('should follow the view to Hold when the Marks arrive, until the trader has chosen', async () => {
    const { again, user } = mount({ marksToGo: 1 });
    again({ marksToGo: 0, planCall: hold, form: { kind: 'New', viewState: { selectedAction: 'Hold' } } });
    expect(chosen()).toEqual(['Hold']);
    await user.click(screen.getByRole('radio', { name: 'Exit' }));
    again({ marksToGo: 0, planCall: out('Stop'), form: { kind: 'New', viewState: {} } });
    expect(chosen()).toEqual(['Exit']);
  });

  it('should keep an explicit Hold when the trader chose Exit and then Hold and the preselection then becomes empty', async () => {
    const { again, user } = mount({ planCall: hold, form: { kind: 'New', viewState: { selectedAction: 'Hold' } } });
    await user.click(screen.getByRole('radio', { name: 'Exit' }));
    await user.click(screen.getByRole('radio', { name: 'Hold' }));
    again({ planCall: out('Stop'), form: { kind: 'New', viewState: {} } });
    expect(chosen()).toEqual(['Hold']);
  });

  it('should keep Hold when the trader clicks the already checked Hold and the preselection then becomes empty', async () => {
    const { again, user } = mount({ planCall: hold, form: { kind: 'New', viewState: { selectedAction: 'Hold' } } });
    await user.click(screen.getByRole('radio', { name: 'Hold' }));
    again({ planCall: out('Stop'), form: { kind: 'New', viewState: {} } });
    expect(chosen()).toEqual(['Hold']);
  });
});

describe('What the chosen Action means for the Plan', () => {
  it('should say under the choices what the chosen Action means for the Plan', async () => {
    const { user, form } = mount({ planCall: out('Stop'), replay: stockReplay });
    const radio = (name: string) => within(form).getByRole('radio', { name });
    await user.click(radio('Hold'));
    expect(within(form).getByText('Holding leaves the Plan. Have a new Stop? Choose Adjust.')).toBeTruthy();
    await user.click(radio('Exit'));
    const exit = within(form).getByText("The Plan's exit: sell all 200 shares at the Stop. No reason needed. Record the sale once it is done.");
    expect(within(form).getByRole('group', { name: 'Action' }).compareDocumentPosition(exit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(radio('Roll'));
    expect(within(form).getByText('Close this one and open a later one. Record the roll once it is done.')).toBeTruthy();
    await user.click(radio('Adjust'));
    expect(within(form).getByText('Move the Stop or Target, or change size. Record the change once it is done.')).toBeTruthy();
  });

  it('should say Keep it as it is for a Hold inside its lines and that an Exit leaves the Plan', async () => {
    const { user, form } = mount({ planCall: hold, replay: stockReplay, form: { kind: 'New', viewState: { selectedAction: 'Hold' } } });
    expect(within(form).getByText('Keep it as it is.')).toBeTruthy();
    await user.click(within(form).getByRole('radio', { name: 'Exit' }));
    expect(within(form).getByText('Exiting now leaves the Plan.')).toBeTruthy();
  });
});

describe('Why is required exactly as the rule says', () => {
  const labelFor = async (call: PlanCall | undefined, action: string) => {
    const { user, form } = mount({ planCall: call, replay: stockReplay });
    await user.click(within(form).getByRole('radio', { name: action }));
    const label = within(form).getByRole('textbox', { name: /^Why\?/ }).closest('label')?.textContent;
    cleanup();
    return label;
  };

  it('should ask Why and mark it required as the rule says for the Action chosen', async () => {
    expect(await labelFor(out('Stop'), 'Hold')).toBe('Why? (required)');
    expect(await labelFor(out('Stop'), 'Exit')).toBe('Why? (optional)');
    expect(await labelFor(hold, 'Hold')).toBe('Why? (optional)');
    expect(await labelFor(hold, 'Exit')).toBe('Why? (required)');
    expect(await labelFor({ call: 'Unknown' }, 'Hold')).toBe('Why? (optional)');
    expect(await labelFor({ call: 'Unknown' }, 'Exit')).toBe('Why? (required)');
    expect(await labelFor(undefined, 'Exit')).toBe('Why? (required)');
    expect(await labelFor(out('Target'), 'Roll')).toBe('Why? (required)');
    expect(await labelFor(hold, 'Adjust')).toBe('Why? (required)');
  });
});

describe('Refusing a save in words', () => {
  it('should refuse a save with no Action chosen or a required reason missing, in words, and send nothing', async () => {
    const { user, form, facade } = mount({ planCall: out('Stop'), replay: stockReplay });
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(within(form).getByText('Choose an Action.')).toBeTruthy();
    await user.click(within(form).getByRole('radio', { name: 'Hold' }));
    await user.click(within(form).getByRole('button', { name: /^Save/ }));
    expect(within(form).getByText('Say why.')).toBeTruthy();
    expect(vi.mocked(facade.DailyReview.save)).not.toHaveBeenCalled();
  });
});

describe('A refusal goes when the choice changes', () => {
  it('should clear Say why when the chosen Action no longer needs a reason', async () => {
    const { user, form } = mount({ planCall: out('Stop'), replay: stockReplay });
    await user.click(within(form).getByRole('radio', { name: 'Hold' }));
    await user.click(within(form).getByRole('button', { name: /^Save/ }));
    expect(within(form).getByText('Say why.')).toBeTruthy();
    await user.click(within(form).getByRole('radio', { name: 'Exit' }));
    expect(within(form).queryByText('Say why.')).toBeNull();
  });

  it('should clear Choose an Action once an Action is chosen', async () => {
    const { user, form } = mount({ planCall: out('Stop'), replay: stockReplay });
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(within(form).getByText('Choose an Action.')).toBeTruthy();
    await user.click(within(form).getByRole('radio', { name: 'Exit' }));
    expect(within(form).queryByText('Choose an Action.')).toBeNull();
  });
});

describe('A save refused for want of a reason', () => {
  it('should show the same words when the save comes back IntentRequired', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Rejected', issues: [{ code: 'IntentRequired' }] } as never);
    const { user, form } = mount({ planCall: hold, replay: stockReplay, form: { kind: 'New', viewState: { selectedAction: 'Hold' } } }, facade);
    await user.click(within(form).getByRole('button', { name: /^Save/ }));
    expect(vi.mocked(facade.DailyReview.save)).toHaveBeenCalledTimes(1);
    expect(await within(form).findByText('Say why.')).toBeTruthy();
    expect(within(form).queryByText(/could not be saved/)).toBeNull();
  });
});

describe('The Save button', () => {
  it('should name the Save button for the Action chosen', async () => {
    const { user, form } = mount({ planCall: out('Stop'), replay: stockReplay });
    expect(within(form).getByRole('button', { name: 'Save' })).toBeTruthy();
    for (const action of ['Hold', 'Exit', 'Roll', 'Adjust']) {
      await user.click(within(form).getByRole('radio', { name: action }));
      expect(within(form).getByRole('button', { name: `Save ${action}` })).toBeTruthy();
    }
  });
});

describe('Conviction', () => {
  it('should offer Conviction as five buttons, optional', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.DailyReview.save).mockResolvedValue({ kind: 'Rejected', issues: [] } as never);
    const { user, form } = mount({ planCall: hold, replay: stockReplay, form: { kind: 'New', viewState: { selectedAction: 'Hold' } } }, facade);
    const group = within(form).getByRole('group', { name: 'Conviction now (optional)' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['1', '2', '3', '4', '5']);
    expect(within(form).getByText('1 low · 5 high')).toBeTruthy();
    await user.click(buttons[3]!);
    expect(buttons[3]!.getAttribute('aria-pressed')).toBe('true');
    await user.click(buttons[1]!);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false', 'false']);
    await user.click(within(form).getByRole('button', { name: 'Save Hold' }));
    expect(vi.mocked(facade.DailyReview.save).mock.calls[0]![0]).toMatchObject({ action: 'Hold', conviction: 2 });
    await user.click(buttons[1]!);
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('false');
    await user.click(within(form).getByRole('button', { name: 'Save Hold' }));
    expect(vi.mocked(facade.DailyReview.save).mock.calls[1]![0]).not.toHaveProperty('conviction');
  });
});

describe('Add more', () => {
  it('should keep what you decided against and Note behind Add more', async () => {
    const { user, form } = mount({ planCall: hold, replay: stockReplay, form: { kind: 'New', viewState: { selectedAction: 'Hold' } } });
    const fold = within(form).getByText('Add more: what you decided against, a note').closest('details')!;
    expect(fold.open).toBe(false);
    expect(within(fold).getByLabelText('Anything you considered doing and decided against?')).toBeTruthy();
    expect(within(fold).getByLabelText('Note')).toBeTruthy();
    expect(within(fold).queryByLabelText(/^Why\?/)).toBeNull();
    await user.click(within(form).getByText('Add more: what you decided against, a note'));
    expect(fold.open).toBe(true);
  });

  it('should open the fold by itself when it holds a value', async () => {
    mount({
      planCall: hold,
      replay: stockReplay,
      form: { kind: 'Saved', action: { action: 'Hold', responses: [{ prompt: 'Action', answer: { kind: 'Option', label: 'Hold' } }, { prompt: 'Note', answer: { kind: 'Text', text: 'Earnings Thursday.' } }] } as never },
    });
    await userEvent.setup().click(within(screen.getByRole('region', { name: 'Saved Action' })).getByRole('button', { name: 'Change' }));
    const open = within(screen.getByRole('form', { name: 'Action' })).getByText('Add more: what you decided against, a note').closest('details')!;
    expect(open.open).toBe(true);
  });
});

describe('Discard', () => {
  it('should empty the form on Discard and return to the view preselection', async () => {
    const { user, form } = mount({ planCall: hold, replay: stockReplay, form: { kind: 'New', viewState: { selectedAction: 'Hold' } } });
    await user.click(within(form).getByRole('radio', { name: 'Exit' }));
    await user.type(within(form).getByRole('textbox', { name: /^Why\?/ }), 'Took the gain.');
    await user.click(within(within(form).getByRole('group', { name: 'Conviction now (optional)' })).getByRole('button', { name: '3' }));
    await user.type(within(form).getByLabelText('Note'), 'Late.');
    await user.click(within(form).getByRole('button', { name: 'Discard' }));
    expect(within(form).getByRole('radio', { name: 'Hold' })).toHaveProperty('checked', true);
    expect(within(form).getByRole('radio', { name: 'Exit' })).toHaveProperty('checked', false);
    expect(within(form).getByRole('textbox', { name: /^Why\?/ })).toHaveProperty('value', '');
    expect(within(form).getByLabelText('Note')).toHaveProperty('value', '');
    expect(within(form).queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });

  it('should return a form with nothing preselected to nothing chosen', async () => {
    const { user, form } = mount({ planCall: out('Stop'), replay: stockReplay });
    await user.click(within(form).getByRole('radio', { name: 'Roll' }));
    await user.click(within(form).getByRole('button', { name: 'Discard' }));
    expect(within(form).queryAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(0);
    expect(within(form).getByText('Nothing is chosen for you here.')).toBeTruthy();
  });
});

describe('The saved Action', () => {
  const saved = (action: string, reason?: string) =>
    ({ kind: 'Saved', action: { action, responses: [{ prompt: 'Action', answer: { kind: 'Option', label: action } }, ...(reason === undefined ? [] : [{ prompt: 'Why?', answer: { kind: 'Text', text: reason } }])] } }) as never;

  it('should show the saved Action as one line with its reason and Change', () => {
    mount({ form: saved('Hold', 'Waiting for 45 to sell.') });
    const region = screen.getByRole('region', { name: 'Saved Action' });
    expect(within(region).getByText('Mon Nov 16: Hold · “Waiting for 45 to sell.”')).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Change' })).toBeTruthy();
    expect(within(region).queryByText(/Saved Action:/)).toBeNull();
    cleanup();
    mount({ form: saved('Hold') });
    expect(within(screen.getByRole('region', { name: 'Saved Action' })).getByText('Mon Nov 16: Hold')).toBeTruthy();
  });

  it('should say on a saved Exit that it is not done until it is recorded', () => {
    mount({ form: saved('Exit', 'Taking the gain.') });
    expect(within(screen.getByRole('region', { name: 'Saved Action' })).getByText("Not done until it is recorded. Tomorrow's Review will ask.")).toBeTruthy();
    cleanup();
    mount({ form: saved('Hold') });
    expect(screen.queryByText(/Not done until it is recorded/)).toBeNull();
  });
});

describe('The sale from the saved Exit (T95.40)', () => {
  const savedExit = { kind: 'Saved', action: { action: 'Exit', responses: [{ prompt: 'Action', answer: { kind: 'Option', label: 'Exit' } }] } } as never;
  const planExitOf = (quantity: string) => ({ positions: [{ instrument: { kind: 'Stock', symbol: 'AXIO' }, quantity, conditions: [] }], heldPast: [] }) as never;

  it('should offer Record the sale on a saved Exit, and Record the buy-back for a short Position', () => {
    mount({ form: savedExit, planExit: planExitOf('200') });
    const region = screen.getByRole('region', { name: 'Saved Action' });
    expect(within(region).getByRole('button', { name: 'Record the sale' })).toBeTruthy();
    expect(within(region).queryByRole('button', { name: 'Record the buy-back' })).toBeNull();
    cleanup();
    mount({ form: savedExit, planExit: planExitOf('-4') });
    expect(within(screen.getByRole('region', { name: 'Saved Action' })).getByRole('button', { name: 'Record the buy-back' })).toBeTruthy();
    cleanup();
    mount({ form: { kind: 'Saved', action: { action: 'Hold', responses: [] } } as never, planExit: planExitOf('200') });
    expect(screen.queryByRole('button', { name: 'Record the sale' })).toBeNull();
  });
});

describe('The sale form in the card (T95.40)', () => {
  const savedExit = { kind: 'Saved', action: { action: 'Exit', responses: [{ prompt: 'Action', answer: { kind: 'Option', label: 'Exit' } }] } } as never;
  const planExit = { positions: [{ instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', conditions: [] }], heldPast: [] } as never;
  async function openSale(over: Partial<ActionFormProps> = {}) {
    const facade = exitFormFacade();
    const mounted = mount({ form: savedExit, planExit, now: () => '2026-10-13T14:05:00Z', ...over }, facade);
    await mounted.user.click(screen.getByRole('button', { name: 'Record the sale' }));
    return { ...mounted, facade };
  }

  it('should show the Trade exit form in the card with Back to the Review in place of Back to the Trade', async () => {
    await openSale();
    expect(await screen.findByRole('group', { name: 'Execution 1' })).toBeTruthy();
    expect(screen.getByText('Back to the Review')).toBeTruthy();
    expect(screen.queryByText('Back to the Trade')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save exit' })).toBeTruthy();
  });
});

describe('The receipt in the card (T95.40)', () => {
  const savedExit = { kind: 'Saved', action: { action: 'Exit', responses: [{ prompt: 'Action', answer: { kind: 'Option', label: 'Exit' } }] } } as never;
  const planExit = { positions: [{ instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', conditions: [] }], heldPast: [] } as never;
  async function sell(result: unknown, quantity: string, over: Partial<ActionFormProps> = {}) {
    const facade = exitFormFacade();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(result as never);
    const mounted = mount({ form: savedExit, planExit, now: () => '2026-10-13T14:05:00Z', ...over }, facade);
    await mounted.user.click(screen.getByRole('button', { name: 'Record the sale' }));
    const row = await screen.findByRole('group', { name: 'Execution 1' });
    for (const [label, value] of [['Quantity', quantity], ['Price', '52.00'], ['Fee', '0.60']] as const) {
      await mounted.user.clear(within(row).getByLabelText(label));
      await mounted.user.type(within(row).getByLabelText(label), value);
    }
    await mounted.user.click(screen.getByRole('button', { name: 'Save exit' }));
    return { ...mounted, facade };
  }

  it('should show the receipt in the card after the sale and refresh the card figures', async () => {
    const onRefresh = vi.fn(() => Promise.resolve(true));
    await sell(partialExitResult(), '30', { onRefresh });
    expect(await screen.findByRole('heading', { level: 3, name: 'Exit recorded' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Lot Matches' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to the Review' })).toBeTruthy();
    expect(screen.queryByText('Back to the Trade')).toBeNull();
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
  });
});

describe('The reason owed on the receipt (T95.40, W155)', () => {
  const savedExit = { kind: 'Saved', action: { action: 'Exit', responses: [] } } as never;
  const planExit = { positions: [{ instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', conditions: [] }], heldPast: [] } as never;
  const withDebt = (requires?: string[]) => {
    const result = partialExitResult();
    return { ...result, postCommit: { ...result.postCommit, reflection: { kind: 'Debt', debt: { debtId: 'debt-1', ...(requires && { requires }) } } } };
  };
  async function sellAndSayLater(result: unknown) {
    const facade = exitFormFacade();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(result as never);
    const mounted = mount({ form: savedExit, planExit, now: () => '2026-10-13T14:05:00Z' }, facade);
    await mounted.user.click(screen.getByRole('button', { name: 'Record the sale' }));
    const row = await screen.findByRole('group', { name: 'Execution 1' });
    for (const [label, value] of [['Quantity', '30'], ['Price', '52.00'], ['Fee', '0.60']] as const) {
      await mounted.user.clear(within(row).getByLabelText(label));
      await mounted.user.type(within(row).getByLabelText(label), value);
    }
    await mounted.user.click(screen.getByRole('button', { name: 'Save exit' }));
  }

  it('should say on the receipt that the reason is owed at the next Review after Say why later', async () => {
    await sellAndSayLater(withDebt(['PlanDepartureReason']));
    expect(await screen.findByText('Recorded. Why you left the Plan is owed at the next Review.')).toBeTruthy();
  });

  it('should say nothing of a reason on the receipt when the reflection owed names none', async () => {
    await sellAndSayLater(withDebt());
    await screen.findByRole('heading', { level: 3, name: 'Exit recorded' });
    expect(screen.queryByText(/Why you left the Plan/)).toBeNull();
  });
});

describe('The saved Exit stays as it was saved (T95.40)', () => {
  const savedExit = { kind: 'Saved', action: { action: 'Exit', responses: [{ prompt: 'Action', answer: { kind: 'Option', label: 'Exit' } }, { prompt: 'Why?', answer: { kind: 'Text', text: 'Taking the gain.' } }] } } as never;
  const planExit = { positions: [{ instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', conditions: [] }], heldPast: [] } as never;

  it('should keep the saved Exit as saved after the sale, saving no Action', async () => {
    const facade = exitFormFacade();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(partialExitResult() as never);
    const { user } = mount({ form: savedExit, planExit, now: () => '2026-10-13T14:05:00Z' }, facade);
    await user.click(screen.getByRole('button', { name: 'Record the sale' }));
    const row = await screen.findByRole('group', { name: 'Execution 1' });
    for (const [label, value] of [['Quantity', '30'], ['Price', '52.00'], ['Fee', '0.60']] as const) {
      await user.clear(within(row).getByLabelText(label));
      await user.type(within(row).getByLabelText(label), value);
    }
    await user.click(screen.getByRole('button', { name: 'Save exit' }));
    await user.click(await screen.findByRole('button', { name: 'Back to the Review' }));

    const region = screen.getByRole('region', { name: 'Saved Action' });
    expect(within(region).getByText('Mon Nov 16: Exit · “Taking the gain.”')).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Change' })).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Action' })).toBeNull();
    expect(vi.mocked(facade.DailyReview.save)).not.toHaveBeenCalled();
  });
});

describe('A closing sale in the card (T95.40, W135)', () => {
  const savedExit = { kind: 'Saved', action: { action: 'Exit', responses: [] } } as never;
  const planExit = { positions: [{ instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', conditions: [] }], heldPast: [] } as never;
  const closing = closedExitResult({ reflection: { kind: 'Debt', debt: { debtId: 'debt-1' } }, closeReview: { kind: 'Debt', debt: { debtId: 'debt-2' } } });
  async function sellAll(over: Partial<ActionFormProps>) {
    const facade = exitFormFacade();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(closing as never);
    const mounted = mount({ form: savedExit, planExit, now: () => '2026-10-13T14:05:00Z', ...over }, facade);
    await mounted.user.click(screen.getByRole('button', { name: 'Record the sale' }));
    const row = await screen.findByRole('group', { name: 'Execution 1' });
    for (const [label, value] of [['Quantity', '100'], ['Price', '53.00'], ['Fee', '1.00']] as const) {
      await mounted.user.clear(within(row).getByLabelText(label));
      await mounted.user.type(within(row).getByLabelText(label), value);
    }
    await mounted.user.click(screen.getByRole('button', { name: 'Save exit' }));
    return mounted;
  }

  it('should say the Trade is closed with its Close Review due in the next Review, and read the card again only once the receipt is dismissed', async () => {
    const onRefresh = vi.fn(() => Promise.resolve(true));
    const { user } = await sellAll({ onRefresh });
    expect(await screen.findByText('Recorded. XYZ is closed. Its Close Review is due in the next Review.')).toBeTruthy();
    expect(onRefresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Back to the Review' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('A sale whose card read fails (T95.40-B1)', () => {
  const savedExit = { kind: 'Saved', action: { action: 'Exit', responses: [] } } as never;
  const planExit = { positions: [{ instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', conditions: [] }], heldPast: [] } as never;
  async function sell(result: unknown, quantity: string, over: Partial<ActionFormProps>) {
    const facade = exitFormFacade();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(result as never);
    const mounted = mount({ form: savedExit, planExit, now: () => '2026-10-13T14:05:00Z', ...over }, facade);
    await mounted.user.click(screen.getByRole('button', { name: 'Record the sale' }));
    const row = await screen.findByRole('group', { name: 'Execution 1' });
    for (const [label, value] of [['Quantity', quantity], ['Price', '53.00'], ['Fee', '1.00']] as const) {
      await mounted.user.clear(within(row).getByLabelText(label));
      await mounted.user.type(within(row).getByLabelText(label), value);
    }
    await mounted.user.click(screen.getByRole('button', { name: 'Save exit' }));
    return mounted;
  }

  it('should read the Review again when the card is left after a closing sale whose read on dismissal failed', async () => {
    const onRefresh = vi.fn(() => Promise.resolve(false));
    const onLeftSold = vi.fn();
    const closing = closedExitResult({ reflection: { kind: 'Debt', debt: { debtId: 'debt-1' } }, closeReview: { kind: 'Debt', debt: { debtId: 'debt-2' } } });
    const { user } = await sell(closing, '100', { onRefresh, onLeftSold });
    await user.click(await screen.findByRole('button', { name: 'Back to the Review' }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    cleanup();
    expect(onLeftSold).toHaveBeenCalledTimes(1);
  });

  it('should read the card again on dismissal after a partial sale whose read failed', async () => {
    const onRefresh = vi.fn(() => Promise.resolve(false));
    const { user } = await sell(partialExitResult(), '30', { onRefresh });
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole('button', { name: 'Back to the Review' }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(2));
  });
});

describe('A sale whose card read is still pending (T95.40-B2)', () => {
  const savedExit = { kind: 'Saved', action: { action: 'Exit', responses: [] } } as never;
  const planExit = { positions: [{ instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', conditions: [] }], heldPast: [] } as never;
  // A read that stays open until the test settles it.
  function deferredRead() {
    let settle: (ok: boolean) => void = () => undefined;
    const first = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    const onRefresh = vi.fn().mockReturnValueOnce(first).mockResolvedValue(true);
    return { onRefresh, settle: (ok: boolean) => settle(ok) };
  }
  async function sell(result: unknown, quantity: string, over: Partial<ActionFormProps>) {
    const facade = exitFormFacade();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(result as never);
    const mounted = mount({ form: savedExit, planExit, now: () => '2026-10-13T14:05:00Z', ...over }, facade);
    await mounted.user.click(screen.getByRole('button', { name: 'Record the sale' }));
    const row = await screen.findByRole('group', { name: 'Execution 1' });
    for (const [label, value] of [['Quantity', quantity], ['Price', '53.00'], ['Fee', '1.00']] as const) {
      await mounted.user.clear(within(row).getByLabelText(label));
      await mounted.user.type(within(row).getByLabelText(label), value);
    }
    await mounted.user.click(screen.getByRole('button', { name: 'Save exit' }));
    return mounted;
  }
  const closing = () => closedExitResult({ reflection: { kind: 'Debt', debt: { debtId: 'debt-1' } }, closeReview: { kind: 'Debt', debt: { debtId: 'debt-2' } } });

  it('should read again when the receipt is dismissed while the read is pending and the read then fails', async () => {
    const { onRefresh, settle } = deferredRead();
    const { user } = await sell(partialExitResult(), '30', { onRefresh });
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole('button', { name: 'Back to the Review' }));
    settle(false);
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(2));
  });

  it('should hand the read to the Review when the card is left while the read is pending and the read then fails', async () => {
    const { onRefresh, settle } = deferredRead();
    const onLeftSold = vi.fn();
    const { user } = await sell(closing(), '100', { onRefresh, onLeftSold });
    await user.click(await screen.findByRole('button', { name: 'Back to the Review' }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    cleanup();
    settle(false);
    await waitFor(() => expect(onLeftSold).toHaveBeenCalledTimes(1));
  });

  it('should read exactly once when the receipt is dismissed while the read is pending and the read then succeeds', async () => {
    const { onRefresh, settle } = deferredRead();
    const onLeftSold = vi.fn();
    const { user } = await sell(partialExitResult(), '30', { onRefresh, onLeftSold });
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole('button', { name: 'Back to the Review' }));
    settle(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    cleanup();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onLeftSold).not.toHaveBeenCalled();
  });

  it('should read exactly once when the card is left while the read is pending and the read then succeeds', async () => {
    const { onRefresh, settle } = deferredRead();
    const onLeftSold = vi.fn();
    const { user } = await sell(closing(), '100', { onRefresh, onLeftSold });
    await user.click(await screen.findByRole('button', { name: 'Back to the Review' }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    cleanup();
    settle(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onLeftSold).not.toHaveBeenCalled();
  });
});

describe('A sale whose card read fails under StrictMode (T95.40-B3)', () => {
  it('should retry in the card and not hand the read to the Review when the read fails after the receipt is dismissed', async () => {
    const savedExit = { kind: 'Saved', action: { action: 'Exit', responses: [] } } as never;
    const planExit = { positions: [{ instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', conditions: [] }], heldPast: [] } as never;
    let settle: (ok: boolean) => void = () => undefined;
    const first = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    const onRefresh = vi.fn().mockReturnValueOnce(first).mockResolvedValue(true);
    const onLeftSold = vi.fn();
    const facade = exitFormFacade();
    vi.mocked(facade.TradeWorkflows.recordPositionChange).mockResolvedValue(partialExitResult() as never);
    const { user } = mount({ form: savedExit, planExit, now: () => '2026-10-13T14:05:00Z', onRefresh, onLeftSold }, facade, true);
    await user.click(screen.getByRole('button', { name: 'Record the sale' }));
    const row = await screen.findByRole('group', { name: 'Execution 1' });
    for (const [label, value] of [['Quantity', '30'], ['Price', '53.00'], ['Fee', '1.00']] as const) {
      await user.clear(within(row).getByLabelText(label));
      await user.type(within(row).getByLabelText(label), value);
    }
    await user.click(screen.getByRole('button', { name: 'Save exit' }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole('button', { name: 'Back to the Review' }));
    settle(false);
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(2));
    expect(onLeftSold).not.toHaveBeenCalled();
  });
});

describe('A day with no price', () => {
  it('should say which figures the choice rests on when today has no price', () => {
    mount({ planCall: hold, replay: stockReplay, decidingOn: '2026-11-13' });
    expect(screen.getByText('No price today: deciding on the Fri Nov 13 figures.')).toBeTruthy();
    cleanup();
    mount({ planCall: hold, replay: stockReplay });
    expect(screen.queryByText(/No price today/)).toBeNull();
  });
});

describe('The Plan call above the choices', () => {
  it('should state the Plan call and its condition above the choices', () => {
    mount({ planCall: out('Stop'), replay: stockReplay });
    const form = screen.getByRole('form', { name: 'Action' });
    const line = within(form).getByText('Past your Stop (AXIO at or below $47.00). The Plan says out.');
    const choices = within(form).getByRole('group', { name: 'Action' });
    expect(line.compareDocumentPosition(choices) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should say At your Target for a Target with the contract named, and Inside its lines for a Hold', () => {
    mount({ planCall: out('Target'), replay: callReplay });
    expect(screen.getByText('At your Target (Call at or above $4.00). The Plan says out.')).toBeTruthy();
    cleanup();
    mount({ planCall: hold, replay: stockReplay });
    expect(screen.getByText('Inside its lines. The Plan says hold.')).toBeTruthy();
  });
});
