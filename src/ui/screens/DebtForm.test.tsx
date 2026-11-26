// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reflectionDefinition, reflectionDefinition6 } from '../../../tests/support/position-change-form-facade.ts';
import type { EntryDefinitionRecord, ReflectionSaveBinding } from '../../app/types.ts';
import { RuntimeContext } from '../runtime.tsx';
import { DebtForm, type DebtSubmitResult } from './DebtForm.tsx';

afterEach(cleanup);

const MODE = 'prompt.position-change-reflection.decision-mode';
const CONFIDENCE = 'prompt.position-change-reflection.decision-confidence';
const NOTE = 'prompt.position-change-reflection.note';
const LESSON = 'prompt.position-change-reflection.lesson';
const REACTIVE = 'option.position-change-reflection.decision-mode.reactive';

// A snapshot revision that is not the current one: Reactive relabelled, a required Lesson prompt first.
const snapshot: EntryDefinitionRecord = {
  ...reflectionDefinition,
  id: 'def-pcr-2',
  revisionNumber: 2,
  prompts: [
    { id: LESSON, kind: 'Text', text: 'Lesson', required: true },
    ...reflectionDefinition.prompts.map((p) =>
      'options' in p ? { ...p, options: p.options.map((o) => (o.id === REACTIVE ? { ...o, label: 'Impulsive' } : o)) } : p,
    ),
  ],
};

const binding: ReflectionSaveBinding = { debtId: 'debt-1', debtRevision: 'debt-rev-1', definitionRevision: 'def-pcr-2' };

const debt = {
  debtId: 'debt-1',
  status: 'Settled',
  revision: 'debt-rev-2',
} as never;

function renderForm(
  submit: (request: never) => Promise<DebtSubmitResult> = () => Promise.resolve({ kind: 'Resolved', debt }),
  options: { definition?: EntryDefinitionRecord; requires?: readonly ('PlanDepartureReason' | 'ExpirationReason')[]; declineOnly?: boolean; writable?: boolean; onDirtyChange?: (dirty: boolean) => void; onCancel?: () => void; onResolved?: (r: never) => void } = {},
) {
  const adapter = vi.fn(submit);
  render(
    <RuntimeContext.Provider value={{ writable: options.writable ?? true, report: () => undefined }}>
      <DebtForm
        definition={options.definition ?? snapshot}
        requires={options.requires}
        declineOnly={options.declineOnly}
        binding={binding}
        submit={adapter as never}
        onDirtyChange={options.onDirtyChange}
        onCancel={options.onCancel}
        onResolved={options.onResolved as never}
      />
    </RuntimeContext.Provider>,
  );
  return adapter;
}

describe('answering', () => {
  it('should render the snapshot definition it is given, with that revision prompt wording, order, and option labels', () => {
    renderForm();
    const lesson = screen.getByLabelText('Lesson');
    const mode = screen.getByRole('radiogroup', { name: 'Decision mode' });
    // Lesson comes first in the snapshot's order.
    expect(lesson.compareDocumentPosition(mode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(mode).getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual([
      'As Planned',
      'Deliberate Adjustment',
      'Impulsive',
      'Externally Imposed',
    ]);
  });

  it('should submit Answer with the Debt identity, expected Debt revision, snapshot revision, and stable Prompt and Option identities, and render the saved Entry from the result without a read call', async () => {
    const entry = {
      id: 'entry-1',
      responses: [
        { promptId: LESSON, value: { kind: 'Text', text: 'Wait for the close.' } },
        { promptId: MODE, value: { kind: 'Option', optionId: REACTIVE } },
        { promptId: CONFIDENCE, value: { kind: 'Scale', value: 4 } },
        { promptId: NOTE, value: { kind: 'Unanswered' } },
      ],
    };
    const resolved = { kind: 'Resolved', entry, debt } as unknown as DebtSubmitResult;
    const onResolved = vi.fn();
    const adapter = renderForm(() => Promise.resolve(resolved), { onResolved });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Lesson'), 'Wait for the close.');
    await user.click(within(screen.getByRole('radiogroup', { name: 'Decision mode' })).getByLabelText('Impulsive'));
    await user.click(within(screen.getByRole('radiogroup', { name: 'Decision confidence' })).getByLabelText('4'));
    await user.click(screen.getByRole('button', { name: 'Answer' }));

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledWith({
      binding,
      resolution: {
        kind: 'Answer',
        answers: {
          [LESSON]: { kind: 'Text', text: 'Wait for the close.' },
          [MODE]: { kind: 'Option', optionId: REACTIVE },
          [CONFIDENCE]: { kind: 'Scale', value: 4 },
        },
      },
    });
    // The saved Entry renders from the result alone; the form's only dependency is the adapter.
    const saved = await screen.findByRole('region', { name: 'Saved reflection' });
    expect(within(saved).getByText('Wait for the close.')).toBeTruthy();
    expect(within(saved).getByText('Impulsive')).toBeTruthy();
    expect(within(saved).getByText('4')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
    expect(onResolved).toHaveBeenCalledWith(resolved);
  });

  it('should show RequiredAnswerMissing beside each field and move focus to the first', async () => {
    renderForm(() =>
      Promise.resolve({
        kind: 'Rejected',
        issues: [
          { promptId: MODE, code: 'RequiredAnswerMissing' },
          { promptId: LESSON, code: 'RequiredAnswerMissing' },
        ],
      }),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Answer' }));

    const lesson = await screen.findByLabelText('Lesson');
    expect(lesson.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(lesson.getAttribute('aria-describedby')!)?.textContent).toBe('Answer “Lesson”.');
    const mode = screen.getByRole('radiogroup', { name: 'Decision mode' });
    expect(within(mode).getByText('Answer “Decision mode”.')).toBeTruthy();
    // Focus goes to the first field in the form's order, not the first issue reported.
    expect(document.activeElement).toBe(lesson);
  });
});

describe('declining', () => {
  it('should submit Decline with an optional reason, showing ReasonTooLong beside the field', async () => {
    const adapter = renderForm((request: { resolution: { reason?: string } }) =>
      Promise.resolve(
        request.resolution.reason === undefined
          ? { kind: 'Resolved', decline: { id: 'decline-1' }, debt }
          : { kind: 'Rejected', issues: [{ code: 'ReasonTooLong' }] },
      ) as never,
    );
    const user = userEvent.setup();
    // Answers typed before declining are not submitted with the Decline.
    await user.type(screen.getByLabelText('Lesson'), 'ignored');
    await user.click(screen.getByRole('button', { name: 'Decline…' }));
    await user.type(screen.getByLabelText('Why? (optional)'), 'Too long for the form.');
    await user.click(screen.getByRole('button', { name: 'Decline the reflection' }));

    expect(adapter).toHaveBeenLastCalledWith({ binding, resolution: { kind: 'Decline', reason: 'Too long for the form.' } });
    const reason = screen.getByLabelText('Why? (optional)');
    expect(reason.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(reason.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Keep the reason for declining to 500 characters or fewer.',
    );

    // The reason is optional: a blank one is not sent.
    await user.clear(reason);
    await user.click(screen.getByRole('button', { name: 'Decline the reflection' }));
    expect(adapter).toHaveBeenLastCalledWith({ binding, resolution: { kind: 'Decline' } });
    expect(await screen.findByRole('region', { name: 'Saved reflection' })).toBeTruthy();
    expect(screen.getByText('Declined to reflect.')).toBeTruthy();
  });

  it('should move focus to the reason field when Decline is rejected with ReasonTooLong', async () => {
    renderForm(() => Promise.resolve({ kind: 'Rejected', issues: [{ code: 'ReasonTooLong' }] }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Decline…' }));
    await user.type(screen.getByLabelText('Why? (optional)'), 'Too long for the form.');
    await user.click(screen.getByRole('button', { name: 'Decline the reflection' }));

    await screen.findByText('Keep the reason for declining to 500 characters or fewer.');
    expect(document.activeElement).toBe(screen.getByLabelText('Why? (optional)'));
  });
});

describe('one submission at a time', () => {
  it('should disable Answer and Decline while a submission is pending and make no second call', async () => {
    let finish: (result: DebtSubmitResult) => void = () => undefined;
    const adapter = renderForm(() => new Promise<DebtSubmitResult>((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Answer' }));

    expect(screen.getByRole('button', { name: 'Answer' }).matches(':disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Decline…' }).matches(':disabled')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Decline…' }));
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(adapter).toHaveBeenCalledTimes(1);

    // Once the call settles without resolving, the trader may submit again.
    await act(() => {
      finish({ kind: 'Conflict' });
      return Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Answer' }).matches(':disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Decline…' }).matches(':disabled')).toBe(false);
  });

  it('should disable Cancel while a reflection save is pending', async () => {
    let finish: (result: DebtSubmitResult) => void = () => undefined;
    const onCancel = vi.fn();
    renderForm(() => new Promise<DebtSubmitResult>((resolve) => (finish = resolve)), { onCancel });
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Cancel' }).matches(':disabled')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Answer' }));

    expect(screen.getByRole('button', { name: 'Cancel' }).matches(':disabled')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).not.toHaveBeenCalled();

    await act(() => {
      finish({ kind: 'Conflict' });
      return Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Cancel' }).matches(':disabled')).toBe(false);
  });
});

describe('adapter failure', () => {
  it('should show an error and keep the entered values when the submit adapter throws', async () => {
    const adapter = renderForm(() => Promise.reject(new Error('offline')));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Lesson'), 'Wait for the close.');
    await user.click(screen.getByRole('button', { name: 'Decline…' }));
    await user.type(screen.getByLabelText('Why? (optional)'), 'No time.');
    await user.click(screen.getByRole('button', { name: 'Answer' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This reflection could not be saved');
    expect(alert.textContent).toContain('Nothing was saved');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Lesson').value).toBe('Wait for the close.');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Why? (optional)').value).toBe('No time.');
    expect(screen.queryByRole('region', { name: 'Saved reflection' })).toBeNull();
    // The trader may try again.
    expect(screen.getByRole('button', { name: 'Answer' }).matches(':disabled')).toBe(false);
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});

describe('not found', () => {
  it('should show that the reflection no longer exists and offer no Answer or Decline when the result is NotFound', async () => {
    renderForm(() => Promise.resolve({ kind: 'NotFound' }));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Lesson'), 'Wait for the close.');
    await user.click(screen.getByRole('button', { name: 'Answer' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This reflection no longer exists');
    expect(alert.textContent).toContain('Nothing was saved');
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Decline…' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Saved reflection' })).toBeNull();
  });
});

describe('form-level rejection', () => {
  it('should show a Rejected issue that names no prompt as a form-level error', async () => {
    renderForm(() => Promise.resolve({ kind: 'Rejected', issues: [{ code: 'DefinitionRevisionMismatch' }] }));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Lesson'), 'Wait for the close.');
    await user.click(screen.getByRole('button', { name: 'Answer' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This reflection could not be saved. Reopen it and try again.');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Lesson').value).toBe('Wait for the close.');
    expect(screen.queryByRole('region', { name: 'Saved reflection' })).toBeNull();
  });
});

describe('conflict and leaving', () => {
  it('should show Conflict with the current outcome displayed and the entered values kept', async () => {
    renderForm(() => Promise.resolve({ kind: 'Conflict', currentOutcome: { kind: 'Decline', id: 'decline-9' } }));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Lesson'), 'Wait for the close.');
    await user.click(within(screen.getByRole('radiogroup', { name: 'Decision mode' })).getByLabelText('Impulsive'));
    await user.click(screen.getByRole('button', { name: 'Decline…' }));
    await user.type(screen.getByLabelText('Why? (optional)'), 'No time.');
    await user.click(screen.getByRole('button', { name: 'Answer' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This reflection changed after you opened it');
    expect(alert.textContent).toContain('Current outcome: declined');
    expect(document.activeElement).toBe(alert);
    // Nothing was saved and the values stay.
    expect(screen.getByLabelText<HTMLTextAreaElement>('Lesson').value).toBe('Wait for the close.');
    expect(screen.getByLabelText<HTMLInputElement>('Impulsive').checked).toBe(true);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Why? (optional)').value).toBe('No time.');
    expect(screen.queryByRole('region', { name: 'Saved reflection' })).toBeNull();
  });

  it('should make no call when cancelled or left, register as unsaved once a value is entered, and offer its actions only while Writable', async () => {
    const onDirtyChange = vi.fn();
    const onCancel = vi.fn();
    const adapter = renderForm(undefined, { onDirtyChange, onCancel });
    const user = userEvent.setup();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await user.type(screen.getByLabelText('Lesson'), 'x');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    cleanup();
    // Leaving abandons the values, so the form no longer holds an update back.
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(adapter).not.toHaveBeenCalled();

    // A reason alone is a value too.
    const second = vi.fn();
    renderForm(undefined, { onDirtyChange: second });
    await user.click(screen.getByRole('button', { name: 'Decline…' }));
    await user.type(screen.getByLabelText('Why? (optional)'), 'x');
    expect(second).toHaveBeenLastCalledWith(true);
    cleanup();

    // Read only: the values can be read, but nothing offers to save them.
    renderForm(undefined, { writable: false, onCancel });
    for (const name of ['Answer', 'Decline…']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.getByLabelText('Lesson').matches(':disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });
});

// T95.42: a reflection owed for a sale that left the Plan names the Plan Departure Reason as required (U14, A322).
const DEPARTURE = 'prompt.position-change-reflection.plan-departure';
const EXPIRATION = 'prompt.position-change-reflection.expiration-reason';
const owedUnder6 = reflectionDefinition6 as unknown as EntryDefinitionRecord;

describe('the workflow prompts (T95.42)', () => {
  it('should leave them out of an owed reflection form whose Debt requires neither', () => {
    renderForm(undefined, { definition: owedUnder6 });
    expect(screen.getByRole('radiogroup', { name: 'Decision mode' })).toBeTruthy();
    expect(screen.queryByLabelText('Why did you leave the Plan?')).toBeNull();
    expect(screen.queryByLabelText('Why did it expire worthless?')).toBeNull();
  });

  it('should show Why did you leave the Plan, required, on an owed reflection whose Debt requires it', () => {
    renderForm(undefined, { definition: owedUnder6, requires: ['PlanDepartureReason'] });
    const reason = screen.getByLabelText('Why did you leave the Plan?');
    expect(reason.getAttribute('aria-required')).toBe('true');
    expect(screen.queryByLabelText('Why did it expire worthless?')).toBeNull();
  });
});

describe('answering the reason owed (T95.42)', () => {
  // What the Journal does with a Debt that requires the Plan Departure Reason: an Answer without it is refused.
  const journal = (request: { readonly resolution: { readonly kind: string; readonly answers?: Record<string, { readonly kind: string; readonly text?: string }> } }): Promise<DebtSubmitResult> =>
    Promise.resolve(
      request.resolution.kind === 'Answer' && request.resolution.answers?.[DEPARTURE]?.text === undefined
        ? { kind: 'Rejected', issues: [{ promptId: DEPARTURE, code: 'RequiredAnswerMissing' }] }
        : { kind: 'Resolved', debt },
    );

  it('should refuse to answer that reflection without it', async () => {
    const adapter = renderForm(journal, { definition: owedUnder6, requires: ['PlanDepartureReason'] });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(adapter).toHaveBeenCalledTimes(1);
    const reason = screen.getByLabelText('Why did you leave the Plan?');
    expect(reason.getAttribute('aria-invalid')).toBe('true');
    expect(await screen.findByText('Answer “Why did you leave the Plan?”.')).toBeTruthy();
    expect(document.activeElement).toBe(reason);
    expect(screen.queryByRole('region', { name: 'Saved reflection' })).toBeNull();
    // With the reason typed, the Answer goes through.
    await user.type(reason, 'Needed the cash.');
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(await screen.findByRole('region', { name: 'Saved reflection' })).toBeTruthy();
  });

  it('should still let it be declined, with one more press than answering', async () => {
    const adapter = renderForm(journal, { definition: owedUnder6, requires: ['PlanDepartureReason'] });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Decline…' }));
    // The first press only asks; nothing is sent.
    expect(adapter).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Decline the reflection' }));
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledWith({ binding, resolution: { kind: 'Decline' } });
    expect(await screen.findByRole('region', { name: 'Saved reflection' })).toBeTruthy();
  });

  it('should ask before declining an owed reflection that requires nothing, as it does for one that does', async () => {
    const adapter = renderForm(journal, { definition: owedUnder6 });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Decline…' }));
    expect(adapter).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Decline the reflection' }));
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});

describe('declining takes more presses than answering (T95.60, W153)', () => {
  // A press is one click on a button; typing is not counted. Both are counted from the open form, which is what the Review card and Trade Detail show.
  async function pressesToResolve(how: 'answer' | 'decline', definition: EntryDefinitionRecord, requires?: readonly ('PlanDepartureReason' | 'ExpirationReason')[]) {
    const adapter = renderForm(() => Promise.resolve({ kind: 'Resolved', debt }), { definition, requires });
    const user = userEvent.setup();
    let presses = 0;
    while (adapter.mock.calls.length === 0 && presses < 5) {
      const next = how === 'answer' ? screen.getByRole('button', { name: 'Answer' }) : (screen.queryByRole('button', { name: 'Decline the reflection' }) ?? screen.getByRole('button', { name: 'Decline…' }));
      await user.click(next);
      presses += 1;
    }
    cleanup();
    return presses;
  }

  it('should take more presses to decline any owed reflection than to answer it', async () => {
    for (const [definition, requires] of [[snapshot, undefined], [owedUnder6, ['PlanDepartureReason']], [owedUnder6, undefined]] as const) {
      expect(await pressesToResolve('decline', definition, requires)).toBeGreaterThan(await pressesToResolve('answer', definition, requires));
    }
  });
});

describe('leaving the decline ask that cannot save (T95.60, W153)', () => {
  it('should leave the ask on Keep it after the reflection no longer exists', async () => {
    const onCancel = vi.fn();
    renderForm(() => Promise.resolve({ kind: 'NotFound' }), { declineOnly: true, onCancel });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Decline the reflection' }));
    expect((await screen.findByRole('alert')).textContent).toContain('This reflection no longer exists');
    expect(screen.queryByRole('button', { name: 'Decline the reflection' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should leave the ask on Keep it when the shell is read only, with nothing to confirm', async () => {
    const onCancel = vi.fn();
    const adapter = renderForm(undefined, { declineOnly: true, writable: false, onCancel });
    const user = userEvent.setup();
    expect(screen.queryByRole('button', { name: 'Decline the reflection' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(adapter).not.toHaveBeenCalled();
  });
});

describe('the other prompts of the revision (T95.42)', () => {
  it('should still render every other prompt of the new revision', () => {
    renderForm(undefined, { definition: owedUnder6, requires: ['PlanDepartureReason'] });
    const others = owedUnder6.prompts.filter((p) => p.id !== EXPIRATION);
    // The revision keeps its three earlier choices and its note beside the one reason the Debt requires.
    expect(others.length).toBeGreaterThan(3);
    for (const prompt of others) expect(screen.getAllByText(prompt.text).length, prompt.text).toBeGreaterThan(0);
    expect(screen.queryByText('Why did it expire worthless?')).toBeNull();
  });
});

describe('the saved reflection (T95.42)', () => {
  const answered = (responses: readonly unknown[]) => () => Promise.resolve({ kind: 'Resolved', entry: { id: 'entry-1', responses }, debt } as unknown as DebtSubmitResult);

  it('should show a saved Plan Departure Reason where the reflection is read', async () => {
    renderForm(answered([{ promptId: DEPARTURE, value: { kind: 'Text', text: 'Needed the cash.' } }, { promptId: EXPIRATION, value: { kind: 'Unanswered' } }]), { definition: owedUnder6, requires: ['PlanDepartureReason'] });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Why did you leave the Plan?'), 'Needed the cash.');
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    const saved = await screen.findByRole('region', { name: 'Saved reflection' });
    expect(within(saved).getByText('Why did you leave the Plan?').nextElementSibling?.textContent).toBe('Needed the cash.');
    // The question no workflow asked of this reflection is not listed as unanswered.
    expect(within(saved).queryByText('Why did it expire worthless?')).toBeNull();
  });

  it('should leave the workflow prompts out of the saved view of a reflection that never asked them', async () => {
    renderForm(answered([]), { definition: owedUnder6 });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    const saved = await screen.findByRole('region', { name: 'Saved reflection' });
    expect(within(saved).queryByText('Why did you leave the Plan?')).toBeNull();
    expect(within(saved).queryByText('Why did it expire worthless?')).toBeNull();
    expect(within(saved).getByText('Decision mode')).toBeTruthy();
  });
});
