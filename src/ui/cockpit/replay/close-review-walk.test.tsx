// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeReviewDefinition } from '../../../../tests/support/position-change-form-facade.ts';
import { RuntimeContext } from '../../runtime.tsx';
import type { DebtFormProps, DebtResolved, DebtSubmitResult } from '../../screens/DebtForm.tsx';
import { CloseReviewWalk } from './close-review-walk.tsx';
import type { ReplayView } from './replay.props.ts';
import { session, view, type Session } from './view-doubles.props.ts';

afterEach(cleanup);

// T95.59: the Close Review walk (A319, W148, W152). Opens on the first key moment, locks the questions until every moment has been seen.
const DATES = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
const day = (date: string): Session => session({ date, pnl: 100, held: 4 });
const MOMENTS = [
  { date: DATES[0]!, kinds: ['Entry'] },
  { date: DATES[2]!, kinds: ['Low'] },
  { date: DATES[3]!, kinds: ['Stop', 'Sale'] },
  { date: DATES[4]!, kinds: ['End'] },
] as const;
const replay = (): ReplayView => ({ ...view(DATES.map(day)), keyMoments: MOMENTS });

const binding: DebtFormProps['binding'] = { debtId: 'debt-cr', debtRevision: 'debt-cr-rev-1', definitionRevision: 'def-cr-2' };
const debt = { debtId: 'debt-cr', status: 'Settled', revision: 'debt-cr-rev-2' } as never;
const resolved: DebtSubmitResult = { kind: 'Resolved', debt };
// The earlier form (before manifest 6): the key lesson is not required.
const earlierDefinition = { ...closeReviewDefinition, id: 'def-cr-1', revisionNumber: 1, prompts: closeReviewDefinition.prompts.map((p) => (p.id === 'prompt.close-review.key-lesson' ? { ...p, required: false } : p)) };

function open(options: { submit?: (request: never) => Promise<DebtSubmitResult>; definition?: typeof closeReviewDefinition; onResolved?: (r: DebtResolved) => void; onClose?: () => void; onDirtyChange?: (dirty: boolean) => void } = {}) {
  const submit = vi.fn(options.submit ?? (() => Promise.resolve(resolved)));
  const onResolved = options.onResolved ?? vi.fn();
  const onClose = options.onClose ?? vi.fn();
  render(
    <MemoryRouter>
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
        <CloseReviewWalk replay={replay()} underlying="BREN" definition={options.definition ?? closeReviewDefinition} binding={binding} submit={submit as never} onResolved={onResolved as never} onClose={onClose} {...(options.onDirtyChange && { onDirtyChange: options.onDirtyChange })} />
      </RuntimeContext.Provider>
    </MemoryRouter>,
  );
  return { submit, onResolved, onClose };
}
const form = () => screen.getByRole('form', { name: 'Close Review' });
const slider = () => screen.getByRole('slider', { name: 'Session' });

describe('the Close Review walk (T95.59)', () => {
  it('should open the Replay on the first key moment with the Close Review questions beside it, locked', () => {
    open();
    expect(slider().getAttribute('aria-valuetext')).toMatch(/^Mon Nov 2 · 1 of 5/);
    expect(screen.getByRole('combobox', { name: 'Key moments' })).toHaveProperty('value', DATES[0]);
    expect(within(form()).getByText('See the 4 key moments first, then answer.')).toBeTruthy();
    expect(screen.getByText('1 of 4 seen')).toBeTruthy();
    const controls = [...within(form()).getAllByRole('radio'), ...within(form()).getAllByRole('textbox'), within(form()).getByRole('button', { name: 'Save the Close Review' })];
    expect(controls).toHaveLength(4 + 2 + 1);
    expect(controls.every((control) => (control as HTMLInputElement).disabled)).toBe(true);
  });

  it('should count a moment as seen when its session is shown by the drop-down, Next moment, the slider or the step buttons', async () => {
    const user = userEvent.setup();
    open();
    // The drop-down.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Key moments' }), '3. Stop + Sale · Thu Nov 5');
    expect(screen.getByText('2 of 4 seen')).toBeTruthy();
    // The step buttons: Wed Nov 4 is a moment, Tue Nov 3 is not (it is passed on the way).
    await user.click(screen.getByRole('button', { name: 'Previous session' }));
    expect(screen.getByText('3 of 4 seen')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Previous session' }));
    expect(screen.getByText('3 of 4 seen')).toBeTruthy();
    // Next moment goes to the first moment not yet seen: Fri Nov 6.
    await user.click(screen.getByRole('button', { name: 'Next moment' }));
    expect(slider().getAttribute('aria-valuetext')).toMatch(/^Fri Nov 6 · 5 of 5/);
    expect(screen.getByText('All 4 seen. Now write.')).toBeTruthy();
    cleanup();
    // The slider's keys.
    open();
    slider().focus();
    await user.keyboard('{End}');
    expect(screen.getByText('2 of 4 seen')).toBeTruthy();
  });

  it('should unlock the questions when every moment has been seen', async () => {
    const user = userEvent.setup();
    open();
    const select = screen.getByRole('combobox', { name: 'Key moments' });
    await user.selectOptions(select, '2. Low · Wed Nov 4');
    await user.selectOptions(select, '3. Stop + Sale · Thu Nov 5');
    // Three of four: still locked.
    expect(within(form()).getByText('See the 4 key moments first, then answer.')).toBeTruthy();
    expect(within(form()).getByRole('button', { name: 'Save the Close Review' })).toHaveProperty('disabled', true);
    await user.selectOptions(select, '4. End · Fri Nov 6');
    expect(within(form()).queryByText('See the 4 key moments first, then answer.')).toBeNull();
    const controls = [...within(form()).getAllByRole('radio'), ...within(form()).getAllByRole('textbox'), within(form()).getByRole('button', { name: 'Save the Close Review' })];
    expect(controls.every((control) => !(control as HTMLInputElement).disabled)).toBe(true);
  });
});

// Opens the walk and shows every moment, so the questions are unlocked.
async function openUnlocked(options: Parameters<typeof open>[0] = {}) {
  const user = userEvent.setup();
  const opened = open(options);
  const select = screen.getByRole('combobox', { name: 'Key moments' });
  for (const label of ['2. Low · Wed Nov 4', '3. Stop + Sale · Thu Nov 5', '4. End · Fri Nov 6']) await user.selectOptions(select, label);
  return { user, ...opened };
}
const AGAIN = 'Would you take this Trade again under similar conditions?';

describe('the Close Review walk: what it requires (T95.59, W152)', () => {
  it('should require Would you take it again and the key lesson, and leave What worked optional', async () => {
    const { user, submit } = await openUnlocked();
    const save = within(form()).getByRole('button', { name: 'Save the Close Review' });
    await user.click(save);
    expect(submit).not.toHaveBeenCalled();
    expect(within(within(form()).getByRole('radiogroup', { name: AGAIN })).getByText('Choose one.')).toBeTruthy();
    expect(within(form()).getByText('Write the lesson.')).toBeTruthy();
    expect(within(form()).getByLabelText('What worked, and what did not?').getAttribute('aria-invalid')).toBeNull();
    expect(within(form()).getAllByText(/^(Choose one|Write the lesson)\.$/)).toHaveLength(2);
    // One answer given: only the other is still asked for.
    await user.click(within(form()).getByLabelText('Yes, as planned'));
    await user.click(save);
    expect(submit).not.toHaveBeenCalled();
    expect(within(form()).queryByText('Choose one.')).toBeNull();
    expect(within(form()).getByText('Write the lesson.')).toBeTruthy();
  });
});

describe('the Close Review walk: a Close Review owed under the earlier form (T95.59, A320)', () => {
  it('should leave the key lesson optional for a Close Review owed under the earlier form', async () => {
    const { user, submit } = await openUnlocked({ definition: earlierDefinition });
    await user.click(within(form()).getByRole('button', { name: 'Save the Close Review' }));
    expect(within(form()).getByText('Choose one.')).toBeTruthy();
    expect(within(form()).queryByText('Write the lesson.')).toBeNull();
    await user.click(within(form()).getByLabelText('Yes, as planned'));
    await user.click(within(form()).getByRole('button', { name: 'Save the Close Review' }));
    expect(submit).toHaveBeenCalledWith({ binding, resolution: { kind: 'Answer', answers: { 'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' } } } });
  });
});

describe('the Close Review walk: saving (T95.59, W152)', () => {
  it('should submit the Answer for the Debt with the Prompt and Option identities on Save the Close Review', async () => {
    const { user, submit, onResolved } = await openUnlocked();
    await user.click(within(form()).getByLabelText('Yes, with changes'));
    await user.type(within(form()).getByLabelText('What is the key lesson?'), 'Sell into strength.');
    await user.click(within(form()).getByRole('button', { name: 'Save the Close Review' }));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      binding,
      resolution: {
        kind: 'Answer',
        answers: {
          'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-with-changes' },
          'prompt.close-review.key-lesson': { kind: 'Text', text: 'Sell into strength.' },
        },
      },
    });
    expect(onResolved).toHaveBeenCalledWith(resolved);
  });

  it('should keep the answers and say nothing was saved when the save is not accepted', async () => {
    const { user, onResolved } = await openUnlocked({ submit: () => Promise.resolve({ kind: 'Conflict' }) });
    await user.click(within(form()).getByLabelText('No'));
    await user.type(within(form()).getByLabelText('What is the key lesson?'), 'Wait.');
    await user.click(within(form()).getByRole('button', { name: 'Save the Close Review' }));
    expect((await within(form()).findByRole('alert')).textContent).toBe('This reflection could not be saved. Nothing was saved. Your values are kept, so you can try again.');
    expect(onResolved).not.toHaveBeenCalled();
    expect(within(form()).getByLabelText('What is the key lesson?')).toHaveProperty('value', 'Wait.');
    expect(within(form()).getByLabelText('No')).toHaveProperty('checked', true);
  });
});

describe('the Close Review walk: while a save is pending (T95.59-B1)', () => {
  const holdSave = () => {
    let settle: (result: DebtSubmitResult) => void = () => undefined;
    const submit = () => new Promise<DebtSubmitResult>((resolve) => { settle = resolve; });
    return { submit, settle: (result: DebtSubmitResult) => settle(result) };
  };
  const fill = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(within(form()).getByLabelText('No'));
    await user.type(within(form()).getByLabelText('What is the key lesson?'), 'Wait.');
    await user.click(within(form()).getByRole('button', { name: 'Save the Close Review' }));
  };

  it('should not let the answers change while the save is pending', async () => {
    const held = holdSave();
    const { user } = await openUnlocked({ submit: held.submit });
    await fill(user);
    const controls = [...within(form()).getAllByRole('radio'), ...within(form()).getAllByRole('textbox')];
    expect(controls.every((control) => (control as HTMLInputElement).disabled)).toBe(true);
    held.settle(resolved);
  });

  it('should keep the answers editable again after a refused save', async () => {
    const held = holdSave();
    const { user } = await openUnlocked({ submit: held.submit });
    await fill(user);
    held.settle({ kind: 'Conflict' });
    await within(form()).findByRole('alert');
    const controls = [...within(form()).getAllByRole('radio'), ...within(form()).getAllByRole('textbox')];
    expect(controls.every((control) => !(control as HTMLInputElement).disabled)).toBe(true);
    await user.type(within(form()).getByLabelText('What is the key lesson?'), '!');
    expect(within(form()).getByLabelText('What is the key lesson?')).toHaveProperty('value', 'Wait.!');
  });
});

describe('the Close Review walk: what is seen (T95.59, A319)', () => {
  it('should forget what was seen when the overlay closes, and send nothing about it', async () => {
    const submit = vi.fn(() => Promise.resolve(resolved));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    function Host() {
      const [shown, setShown] = useState(true);
      return (
        <MemoryRouter>
          <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
            <button type="button" onClick={() => setShown(true)}>
              Write the Close Review
            </button>
            {shown && <CloseReviewWalk replay={replay()} underlying="BREN" definition={closeReviewDefinition} binding={binding} submit={submit} onResolved={vi.fn()} onClose={() => setShown(false)} />}
          </RuntimeContext.Provider>
        </MemoryRouter>
      );
    }
    const user = userEvent.setup();
    render(<Host />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Key moments' }), '2. Low · Wed Nov 4');
    expect(screen.getByText('2 of 4 seen')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // The page behind is back, and opening the walk again starts from the first moment alone.
    await user.click(screen.getByRole('button', { name: 'Write the Close Review' }));
    expect(screen.getByText('1 of 4 seen')).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// Layout is not computed in jsdom, so this reads the walk's stylesheet and asserts the rules (the browser suite measures the real placement).
describe('the Close Review walk: layout (T95.59)', () => {
  const css = postcss.parse(readFileSync('src/ui/cockpit/styles/close-review-walk.css', 'utf8'));
  const decls = (atMedia: string | null, selector: string) => {
    const out: Record<string, string> = {};
    css.walkRules((rule) => {
      const parent = rule.parent;
      const media = parent && parent.type === 'atrule' && (parent as postcss.AtRule).name === 'media' ? (parent as postcss.AtRule).params : null;
      if (media !== atMedia || !rule.selectors.includes(selector)) return;
      rule.walkDecls((d) => {
        out[d.prop] = d.value;
      });
    });
    return out;
  };

  it('should put the questions under the chart at 375 wide, and beside it on a wide screen', () => {
    const walk = '.replay-overlay .close-review-walk';
    const wide = decls(null, walk);
    expect(wide.display).toBe('grid');
    expect(wide['grid-template-columns']?.split(/\s+(?![^(]*\))/).length).toBe(2);
    // The phone's breakpoint (the overlay's own): one column, and the replay comes first in the page, so the questions sit under it.
    expect(decls('(max-width: 860px)', walk)['grid-template-columns']).toBe('minmax(0, 1fr)');
    expect(readFileSync('src/ui/cockpit/index.css', 'utf8')).toContain("@import './styles/close-review-walk.css';");
  });
});

describe('the Close Review walk: leaving (T95.59)', () => {
  it('should ask before leaving with answers typed', async () => {
    // Nothing typed: Close leaves at once.
    const first = await openUnlocked();
    await first.user.click(screen.getByRole('button', { name: 'Close' }));
    expect(first.onClose).toHaveBeenCalledTimes(1);
    cleanup();

    const onDirtyChange = vi.fn();
    const { user, onClose, submit, onResolved } = await openUnlocked({ onDirtyChange });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await user.type(within(form()).getByLabelText('What is the key lesson?'), 'Sell into strength.');
    // The page is told a value is entered, so an update waits.
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("BREN's note isn't saved.")).toBeTruthy();
    // Back to the walk: the answers are still there.
    await user.click(screen.getByRole('button', { name: 'Back to BREN' }));
    expect(screen.queryByText("BREN's note isn't saved.")).toBeNull();
    expect(within(form()).getByLabelText('What is the key lesson?')).toHaveProperty('value', 'Sell into strength.');
    // Escape asks as well; Discard it leaves without saving.
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Discard it' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    expect(onResolved).not.toHaveBeenCalled();
  });

  it('should save from the ask when the answers are complete', async () => {
    const { user, submit, onResolved, onClose } = await openUnlocked();
    await user.click(within(form()).getByLabelText('Unsure'));
    await user.type(within(form()).getByLabelText('What is the key lesson?'), 'Wait.');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Save it' }));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(onResolved).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
