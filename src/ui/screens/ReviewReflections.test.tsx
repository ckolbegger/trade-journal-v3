// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { closeReviewDefinition, reflectionDefinition6 } from '../../../tests/support/position-change-form-facade.ts';
import type { OwedReflection } from '../../app/types.ts';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { session, view } from '../cockpit/replay/view-doubles.props.ts';
import { RuntimeContext } from '../runtime.tsx';
import { ReviewReflections } from './ReviewReflections.tsx';

afterEach(cleanup);

const owed = (over: Partial<OwedReflection> = {}): OwedReflection => ({
  debtId: 'd-1',
  entryType: 'Position Change Reflection',
  definition: reflectionDefinition6,
  economicTime: '2026-10-12T20:45:00Z',
  executions: [],
  classification: 'Due',
  saveBinding: { debtId: 'd-1', debtRevision: 'd-1-rev-1', definitionRevision: 'def-pcr-3' },
  ...over,
});

function renderReflections(reflection: OwedReflection) {
  render(
    <RuntimeContext.Provider value={{ writable: true, timeZone: 'America/New_York', report: () => undefined }}>
      <ReviewReflections facade={facadeDouble()} reviewDate="2026-10-13" reflections={[reflection]} onReview={() => undefined} onNoneRemaining={() => undefined} onEntryDirty={() => undefined} onForm={() => undefined} />
    </RuntimeContext.Provider>,
  );
}

describe('the workflow prompts on the Review card (T95.42)', () => {
  it('should show Why did you leave the Plan, required, on Review card owed reflection whose Debt requires it', async () => {
    const user = userEvent.setup();
    renderReflections(owed({ requires: ['PlanDepartureReason'] }));
    const reflections = screen.getByRole('region', { name: 'Reflections' });
    await user.click(within(reflections).getByRole('button', { name: /^Reflect on/ }));
    const reason = within(reflections).getByLabelText('Why did you leave the Plan?');
    expect(reason.getAttribute('aria-required')).toBe('true');
  });
});

// T95.60: declining a Close Review (W153). The Close Review is owed on a closed Trade whose card carries its replay.
const closeReview = (): OwedReflection =>
  owed({
    debtId: 'd-cr',
    entryType: 'Close Review',
    entryTypeKey: 'entry-type.close-review',
    definition: closeReviewDefinition,
    saveBinding: { debtId: 'd-cr', debtRevision: 'd-cr-rev-1', definitionRevision: 'def-cr-2' },
  });
const WALK_DAYS = ['2026-11-02', '2026-11-03'].map((date) => session({ date, pnl: 100, held: 4 }));
const walkReplay = () => ({ ...view(WALK_DAYS), keyMoments: [{ date: '2026-11-02', kinds: ['Entry'] }, { date: '2026-11-03', kinds: ['End'] }] }) as never;
const declined = { kind: 'DebtResolved', debt: { debtId: 'd-cr', status: 'Settled', revision: 'd-cr-rev-2' }, decline: { id: 'decl-1', authoredTime: '2026-10-13T21:05:00Z' }, review: {} } as never;

function renderCloseReview(options: { readonly walked?: boolean; readonly onClosed?: (outcome: 'saved' | 'declined') => void; readonly onEntryDirty?: (id: string, dirty: boolean) => void } = {}) {
  const facade = facadeDouble();
  vi.mocked(facade.DailyReview.save).mockResolvedValue(declined);
  const walk = options.walked === false ? undefined : { replay: walkReplay(), underlying: 'BREN', onClosed: options.onClosed ?? (() => undefined) };
  render(
    <RuntimeContext.Provider value={{ writable: true, timeZone: 'America/New_York', report: () => undefined }}>
      <MemoryRouter>
        <ReviewReflections facade={facade} reviewDate="2026-10-13" reflections={[closeReview()]} onReview={() => undefined} onNoneRemaining={() => undefined} onEntryDirty={options.onEntryDirty ?? (() => undefined)} onForm={() => undefined} {...(walk && { walk })} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
  return { facade, user: userEvent.setup(), reflections: () => screen.getByRole('region', { name: 'Reflections' }) };
}

describe('declining any owed reflection on the Review card (T95.60, W153)', () => {
  // A press is one click on a button, counted from the card's own button; typing is not counted.
  async function pressesToResolve(how: 'answer' | 'decline') {
    const facade = facadeDouble();
    vi.mocked(facade.DailyReview.save).mockResolvedValue(declined);
    render(
      <RuntimeContext.Provider value={{ writable: true, timeZone: 'America/New_York', report: () => undefined }}>
        <ReviewReflections facade={facade} reviewDate="2026-10-13" reflections={[owed()]} onReview={() => undefined} onNoneRemaining={() => undefined} onEntryDirty={() => undefined} onForm={() => undefined} />
      </RuntimeContext.Provider>,
    );
    const user = userEvent.setup();
    let presses = 0;
    while (vi.mocked(facade.DailyReview.save).mock.calls.length === 0 && presses < 6) {
      const next =
        screen.queryByRole('button', { name: how === 'answer' ? 'Answer' : 'Decline the reflection' }) ??
        (how === 'decline' ? screen.queryByRole('button', { name: 'Decline…' }) : null) ??
        screen.getByRole('button', { name: /^Reflect on/ });
      await user.click(next);
      presses += 1;
    }
    cleanup();
    return presses;
  }

  it('should take more presses to decline any owed reflection than to answer it', async () => {
    expect(await pressesToResolve('decline')).toBeGreaterThan(await pressesToResolve('answer'));
  });
});

describe('the Close Review decline link while the shell is read only (T95.60, W153)', () => {
  it('should offer no Decline link while the shell is read only', () => {
    render(
      <RuntimeContext.Provider value={{ writable: false, timeZone: 'America/New_York', report: () => undefined }}>
        <MemoryRouter>
          <ReviewReflections facade={facadeDouble()} reviewDate="2026-10-13" reflections={[closeReview()]} onReview={() => undefined} onNoneRemaining={() => undefined} onEntryDirty={() => undefined} onForm={() => undefined} />
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Write the Close Review' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Decline…' })).toBeNull();
  });
});

describe('declining a Close Review on the Review card (T95.60, W153)', () => {
  it('should offer Decline as a link, apart from Write the Close Review', () => {
    const { reflections } = renderCloseReview();
    const write = within(reflections()).getByRole('button', { name: 'Write the Close Review' });
    const decline = within(reflections()).getByRole('button', { name: 'Decline…' });
    expect(decline).not.toBe(write);
    expect(decline.classList.contains('link-button')).toBe(true);
    expect(write.classList.contains('link-button')).toBe(false);
  });

  it('should ask to confirm, with an optional reason, before declining', async () => {
    const { facade, user, reflections } = renderCloseReview();
    await user.click(within(reflections()).getByRole('button', { name: 'Decline…' }));
    expect(within(reflections()).getByText('Decline this Close Review? The Journal will show it as declined.')).toBeTruthy();
    // Asking sends nothing.
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
    await user.type(within(reflections()).getByLabelText('Why? (optional)'), 'Not worth writing.');
    await user.click(within(reflections()).getByRole('button', { name: 'Decline the Close Review' }));
    expect(facade.DailyReview.save).toHaveBeenCalledTimes(1);
    expect(facade.DailyReview.save).toHaveBeenCalledWith({
      kind: 'ResolveReviewDebt',
      reviewDate: '2026-10-13',
      binding: { debtId: 'd-cr', debtRevision: 'd-cr-rev-1', definitionRevision: 'def-cr-2' },
      resolution: { kind: 'Decline', reason: 'Not worth writing.' },
    });
    expect(await within(reflections()).findByRole('region', { name: 'Saved reflection' })).toBeTruthy();
  });

  it('should not hold the Review for a reason typed in the ask, since Save it would decline', async () => {
    const onEntryDirty = vi.fn();
    const { user, reflections } = renderCloseReview({ onEntryDirty });
    await user.click(within(reflections()).getByRole('button', { name: 'Decline…' }));
    await user.type(within(reflections()).getByLabelText('Why? (optional)'), 'Not worth writing.');
    expect(onEntryDirty).not.toHaveBeenCalledWith('debt:d-cr', true);
  });

  it('should keep the Debt on Keep it', async () => {
    const { facade, user, reflections } = renderCloseReview();
    await user.click(within(reflections()).getByRole('button', { name: 'Decline…' }));
    await user.type(within(reflections()).getByLabelText('Why? (optional)'), 'Not worth writing.');
    await user.click(within(reflections()).getByRole('button', { name: 'Keep it' }));
    expect(facade.DailyReview.save).not.toHaveBeenCalled();
    expect(within(reflections()).queryByText('Decline this Close Review? The Journal will show it as declined.')).toBeNull();
    expect(within(reflections()).queryByRole('region', { name: 'Saved reflection' })).toBeNull();
    // Still owed: it can be written, or declined again, and the reason typed was dropped.
    expect(within(reflections()).getByRole('button', { name: 'Write the Close Review' })).toBeTruthy();
    await user.click(within(reflections()).getByRole('button', { name: 'Decline…' }));
    expect(within(reflections()).getByLabelText<HTMLTextAreaElement>('Why? (optional)').value).toBe('');
  });
});
