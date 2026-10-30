// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reflectionDefinition } from '../../../tests/support/position-change-form-facade.ts';
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
  options: { writable?: boolean; onDirtyChange?: (dirty: boolean) => void; onCancel?: () => void; onResolved?: (r: never) => void } = {},
) {
  const adapter = vi.fn(submit);
  render(
    <RuntimeContext.Provider value={{ writable: options.writable ?? true, report: () => undefined }}>
      <DebtForm
        definition={snapshot}
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
    await user.type(screen.getByLabelText('Reason for declining (optional)'), 'Too long for the form.');
    await user.click(screen.getByRole('button', { name: 'Decline' }));

    expect(adapter).toHaveBeenLastCalledWith({ binding, resolution: { kind: 'Decline', reason: 'Too long for the form.' } });
    const reason = screen.getByLabelText('Reason for declining (optional)');
    expect(reason.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(reason.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Keep the reason for declining to 500 characters or fewer.',
    );

    // The reason is optional: a blank one is not sent.
    await user.clear(reason);
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    expect(adapter).toHaveBeenLastCalledWith({ binding, resolution: { kind: 'Decline' } });
    expect(await screen.findByRole('region', { name: 'Saved reflection' })).toBeTruthy();
    expect(screen.getByText('Declined to reflect.')).toBeTruthy();
  });
});

describe('one submission at a time', () => {
  it('should disable Answer and Decline while a submission is pending and make no second call', async () => {
    let finish: (result: DebtSubmitResult) => void = () => undefined;
    const adapter = renderForm(() => new Promise<DebtSubmitResult>((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Answer' }));

    expect(screen.getByRole('button', { name: 'Answer' }).matches(':disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Decline' }).matches(':disabled')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(adapter).toHaveBeenCalledTimes(1);

    // Once the call settles without resolving, the trader may submit again.
    await act(() => {
      finish({ kind: 'Conflict' });
      return Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Answer' }).matches(':disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Decline' }).matches(':disabled')).toBe(false);
  });
});

describe('adapter failure', () => {
  it('should show an error and keep the entered values when the submit adapter throws', async () => {
    const adapter = renderForm(() => Promise.reject(new Error('offline')));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Lesson'), 'Wait for the close.');
    await user.type(screen.getByLabelText('Reason for declining (optional)'), 'No time.');
    await user.click(screen.getByRole('button', { name: 'Answer' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This reflection could not be saved');
    expect(alert.textContent).toContain('Nothing was saved');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Lesson').value).toBe('Wait for the close.');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Reason for declining (optional)').value).toBe('No time.');
    expect(screen.queryByRole('region', { name: 'Saved reflection' })).toBeNull();
    // The trader may try again.
    expect(screen.getByRole('button', { name: 'Answer' }).matches(':disabled')).toBe(false);
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});

describe('conflict and leaving', () => {
  it('should show Conflict with the current outcome displayed and the entered values kept', async () => {
    renderForm(() => Promise.resolve({ kind: 'Conflict', currentOutcome: { kind: 'Decline', id: 'decline-9' } }));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Lesson'), 'Wait for the close.');
    await user.click(within(screen.getByRole('radiogroup', { name: 'Decision mode' })).getByLabelText('Impulsive'));
    await user.type(screen.getByLabelText('Reason for declining (optional)'), 'No time.');
    await user.click(screen.getByRole('button', { name: 'Answer' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This reflection changed after you opened it');
    expect(alert.textContent).toContain('Current outcome: declined');
    expect(document.activeElement).toBe(alert);
    // Nothing was saved and the values stay.
    expect(screen.getByLabelText<HTMLTextAreaElement>('Lesson').value).toBe('Wait for the close.');
    expect(screen.getByLabelText<HTMLInputElement>('Impulsive').checked).toBe(true);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Reason for declining (optional)').value).toBe('No time.');
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
    await user.type(screen.getByLabelText('Reason for declining (optional)'), 'x');
    expect(second).toHaveBeenLastCalledWith(true);
    cleanup();

    // Read only: the values can be read, but nothing offers to save them.
    renderForm(undefined, { writable: false, onCancel });
    for (const name of ['Answer', 'Decline']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.getByLabelText('Lesson').matches(':disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });
});
