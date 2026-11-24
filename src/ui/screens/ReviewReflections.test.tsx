// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { reflectionDefinition6 } from '../../../tests/support/position-change-form-facade.ts';
import type { OwedReflection } from '../../app/types.ts';
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
