// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closedDetailOf } from '../../../../tests/support/closed-detail-fixtures.ts';
import { facadeDouble } from '../../../../tests/support/facade-double.ts';
import { openDetailOf, openDetailUncovered, PC1, PC2, pc1Reflection, pc2Decline, PC3, X1, X2 } from '../../../../tests/support/open-detail-fixtures.ts';
import { reflectionDefinition } from '../../../../tests/support/position-change-form-facade.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
import type { DueClassification, NarrativeItem, TradeDetailDebt } from '../../../app/types.ts';
import { RuntimeContext } from '../../runtime.tsx';
import { TradeDetail } from '../TradeDetail.tsx';
import { openDrawer, renderView, termValue } from './test-support.ts';

afterEach(cleanup);

describe('badge meanings', () => {
  it('should give Reflection declined the warning tone', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2, PC3], { journal: [pc2Decline] }));
    await openDrawer(user, 'Journal');
    expect(
      (await within(await screen.findByRole('region', { name: /^Journal/ })).findByText('Reflection declined')).getAttribute('data-tone'),
    ).toBe('warning');
  });
});

describe('Journal entries', () => {
  const planEntry: NarrativeItem = { kind: 'Entry', ...plannedDetail.journal[0] };

  async function journalItems(journal: NarrativeItem[]) {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2], { journal }));
    await openDrawer(user, 'Journal');
    const region = await screen.findByRole('region', { name: /^Journal/ });
    return { region, items: within(region).getAllByRole('listitem') };
  }

  it('should show each Entry as its own item with the Entry Type as a badge, the Anchor, the Source labelled as Source, and the moment time', async () => {
    const { items } = await journalItems([pc1Reflection]);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(within(item).getByText('Position Change Reflection', { selector: '.badge' })).toBeTruthy();
    expect(termValue(item, 'Anchor')).toBe('Trade XYZ');
    expect(termValue(item, 'Source')).toBe('Position Change');
    expect(termValue(item, 'Moment')).toBe('2026-10-12 10:00');
    expect(termValue(item, 'Decision mode')).toBe('Planned');
  });

  it('should show the authored time as well when it differs from the moment time', async () => {
    const same = { ...pc1Reflection, authoredTime: pc1Reflection.momentTime } as NarrativeItem;
    const { items } = await journalItems([planEntry, same]);
    const [differs, equal] = items as [HTMLElement, HTMLElement];
    expect(termValue(differs, 'Authored')).toBe('2026-10-12 10:05');
    expect(within(equal).queryByText('Authored', { selector: 'dt' })).toBeNull();
  });

  it('should not show the authored time when it reads the same as the moment time', async () => {
    const moment = new Date(pc1Reflection.momentTime);
    const seconds = { ...pc1Reflection, authoredTime: new Date(moment.getTime() + 30_000).toISOString() } as NarrativeItem;
    const { items } = await journalItems([seconds]);
    expect(within(items[0]!).queryByText('Authored', { selector: 'dt' })).toBeNull();
  });

  it('should show a decline with the warning badge Reflection declined, its reason or No reason given, its Anchor and Source', async () => {
    const noReason = { ...pc2Decline, id: 'd-2', reason: undefined } as NarrativeItem;
    const { items } = await journalItems([pc2Decline, noReason]);
    const [withReason, without] = items as [HTMLElement, HTMLElement];
    expect(within(withReason).getByText('Reflection declined').getAttribute('data-tone')).toBe('warning');
    expect(termValue(withReason, 'Reason')).toBe('Same plan, second fill.');
    expect(termValue(without, 'Reason')).toBe('No reason given');
    for (const item of [withReason, without]) {
      expect(termValue(item, 'Anchor')).toBe('Trade XYZ');
      expect(termValue(item, 'Source')).toBe('Position Change');
    }
  });

  it('should label the region with the number of items', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2], { journal: [planEntry, pc1Reflection, pc2Decline] }));
    await openDrawer(user, 'Journal');
    expect(await screen.findByRole('region', { name: 'Journal (3)' })).toBeTruthy();
  });
});

describe('journal prose', () => {
  async function journalItem() {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2], { journal: [pc1Reflection] }));
    await openDrawer(user, 'Journal');
    const region = await screen.findByRole('region', { name: /^Journal/ });
    return within(region).getAllByRole('listitem')[0]!;
  }

  it('should show each prompt question above its answer, not beside it', async () => {
    const item = await journalItem();
    const question = within(item).getByText('Primary emotion', { selector: 'dt' });
    expect(question.closest('dl')?.classList.contains('answers')).toBe(true);
    expect(question.nextElementSibling?.textContent).toBe('Calm');
  });

  it('should keep Anchor, Source, Moment and Authored as a label/value list', async () => {
    const item = await journalItem();
    const anchor = within(item).getByText('Anchor', { selector: 'dt' }).closest('dl')!;
    expect(anchor.classList.contains('answers')).toBe(false);
    for (const term of ['Source', 'Moment', 'Authored']) {
      expect(within(anchor).getByText(term, { selector: 'dt' })).toBeTruthy();
    }
    expect(within(anchor).queryByText('Primary emotion')).toBeNull();
  });
});

describe('Actions', () => {
  const action = (id: string, reviewDate: string, label: string, intent: string | undefined, edited = false): NarrativeItem => ({
    kind: 'Entry',
    id,
    entryType: 'Daily Trade Review',
    entryTypeKey: 'entry-type.daily-trade-review',
    source: 'Daily Review',
    anchor: { kind: 'Trade', tradeId: 'trade-1' },
    momentTime: `${reviewDate}T21:00:00Z`,
    authoredTime: `${reviewDate}T21:05:00Z`,
    reviewDate,
    ...(edited && { edited: true as const }),
    responses: [
      { prompt: 'Action', answer: { kind: 'Option', label } },
      { prompt: 'Intent', answer: intent === undefined ? { kind: 'Unanswered' } : { kind: 'Text', text: intent } },
    ],
  });

  it('should list Daily Trade Review Actions in the narrative with Review Date, Action, Intent, and an Edited indicator', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2], { journal: [action('a-1', '2026-10-12', 'Hold', undefined), action('a-2', '2026-10-13', 'Exit', 'Take the gain.', true)] }));
    await openDrawer(user, 'Journal');
    const journal = await screen.findByRole('region', { name: 'Journal (2)' });
    const [hold, exit] = within(journal).getAllByRole('listitem');
    expect(termValue(hold!, 'Review Date')).toBe('Mon Oct 12');
    expect(termValue(hold!, 'Action')).toBe('Hold');
    expect(termValue(hold!, 'Intent')).toBe('Not answered');
    expect(within(hold!).queryByText('Edited')).toBeNull();
    expect(termValue(exit!, 'Review Date')).toBe('Tue Oct 13');
    expect(termValue(exit!, 'Action')).toBe('Exit');
    expect(termValue(exit!, 'Intent')).toBe('Take the gain.');
    expect(within(exit!).getByText('Edited', { selector: '.badge' })).toBeTruthy();
  });
});

describe('Debt on Trade Detail (A69, P17)', () => {
  const owedDebt = (id: string, positionChangeId: string, momentTime: string, dueStatus?: DueClassification): TradeDetailDebt => ({
    kind: 'Debt',
    id,
    entryType: 'Position Change Reflection',
    entryTypeKey: 'entry-type.position-change-reflection',
    source: 'Position Change',
    anchor: { kind: 'Trade', tradeId: 'trade-1' },
    momentTime,
    positionChangeId,
    definitionId: 'def-pcr-1',
    dueAnchor: '2026-10-13T20:00:00Z',
    revision: `${id}-rev-1`,
    ...(dueStatus && { dueStatus }),
  });

  it('should show each Outstanding Debt as "Reflection owed" beside its Position Change, with "Due" or "Due in the next Review" as text, and Reflect now and Decline actions only while Writable', async () => {
    const journal = [
      owedDebt('debt-1', 'pc-1', '2026-10-12T14:00:00Z', 'Due'),
      owedDebt('debt-2', 'pc-2', '2026-10-12T15:00:00Z', 'DueInNextReview'),
      owedDebt('debt-3', 'pc-3', '2026-10-12T16:00:00Z', 'DueInReviewAfterNext'),
    ];
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2], { journal }));
    await openDrawer(user, 'Journal');
    const region = await screen.findByRole('region', { name: 'Journal (3)' });
    const items = within(region).getAllByRole('listitem');
    expect(items.map((item) => within(item).getByText('Reflection owed').tagName)).toEqual(['SPAN', 'SPAN', 'SPAN']);
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Position Change at 2026-10-12 10:00'),
      expect.stringContaining('Position Change at 2026-10-12 11:00'),
      expect.stringContaining('Position Change at 2026-10-12 12:00'),
    ]);
    expect(termValue(items[0]!, 'Due')).toBe('Due');
    expect(termValue(items[1]!, 'Due')).toBe('Due in the next Review');
    expect(termValue(items[2]!, 'Due')).toBe('Due in the Review after next');
    for (const item of items) {
      expect(within(item).getByRole('button', { name: 'Reflect now' })).toBeTruthy();
      expect(within(item).getByRole('button', { name: 'Decline' })).toBeTruthy();
    }
    cleanup();

    renderView(openDetailOf([PC1, PC2], { journal }), false);
    await openDrawer(user, 'Journal');
    const readOnly = await screen.findByRole('region', { name: 'Journal (3)' });
    expect(within(readOnly).getAllByText('Reflection owed')).toHaveLength(3);
    expect(within(readOnly).queryByRole('button', { hidden: true })).toBeNull();
  });

  it('should show a settled reflection once, marked "Deferred, answered" with its time, and a declined one once, marked "Declined later"', async () => {
    const settled = { dueAnchor: '2026-10-13T20:00:00Z' };
    const answered: NarrativeItem = { ...pc1Reflection, id: 'e-9', authoredTime: '2026-10-12T16:30:00Z', answeredLater: { debtId: 'debt-1', ...settled } } as NarrativeItem;
    const declined: NarrativeItem = {
      ...pc2Decline,
      id: 'd-9',
      authoredTime: '2026-10-12T17:15:00Z',
      declinedLater: { debtId: 'debt-2', ...settled },
    } as NarrativeItem;
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2], { journal: [answered, declined] }));
    await openDrawer(user, 'Journal');
    const region = await screen.findByRole('region', { name: 'Journal (2)' });
    const [first, second] = within(region).getAllByRole('listitem') as [HTMLElement, HTMLElement];
    expect(within(first).getByText('Deferred, answered', { selector: '.badge' })).toBeTruthy();
    expect(termValue(first, 'Answered')).toBe('2026-10-12 12:30');
    expect(termValue(first, 'Source')).toBe('Position Change');
    expect(termValue(first, 'Decision mode')).toBe('Planned');
    expect(within(second).getByText('Declined later', { selector: '.badge' })).toBeTruthy();
    expect(within(second).queryByText('Reflection declined')).toBeNull();
    expect(termValue(second, 'Declined')).toBe('2026-10-12 13:15');
    expect(termValue(second, 'Reason')).toBe('Same plan, second fill.');
    expect(within(region).queryByText('Reflection owed')).toBeNull();
  });

  it('should open DebtForm with the Debt snapshot definition loaded through getDefinitions by exact revision, and render the result after Save without reading the Trade again', async () => {
    const MODE = 'prompt.position-change-reflection.decision-mode';
    const EMOTION = 'prompt.position-change-reflection.primary-emotion';
    const CONFIDENCE = 'prompt.position-change-reflection.decision-confidence';
    const REACTIVE = 'option.position-change-reflection.decision-mode.reactive';
    // The Debt's snapshot revision is not the current one: Reactive reads "Impulsive" in it.
    const snapshot = {
      ...reflectionDefinition,
      prompts: reflectionDefinition.prompts.map((p) => ('options' in p ? { ...p, options: p.options.map((o) => (o.id === REACTIVE ? { ...o, label: 'Impulsive' } : o)) } : p)),
    };
    const debt = owedDebt('debt-1', 'pc-1', '2026-10-12T14:00:00Z', 'Due');
    const entry = {
      id: 'entry-9',
      responses: [
        { promptId: MODE, value: { kind: 'Option', optionId: REACTIVE } },
        { promptId: EMOTION, value: { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' } },
        { promptId: CONFIDENCE, value: { kind: 'Scale', value: 4 } },
        { promptId: 'prompt.position-change-reflection.note', value: { kind: 'Unanswered' } },
      ],
    };
    const settled = { kind: 'Debt', status: 'Settled', debtId: 'debt-1', revision: 'debt-1-rev-2' };
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: openDetailOf([PC1, PC2], { journal: [debt] }), binding: {} } as never);
    vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition: snapshot } as never);
    vi.mocked(facade.Journal.save).mockResolvedValue({
      kind: 'Saved',
      entry,
      debt: settled,
      currentOutcome: { kind: 'Entry', id: 'entry-9' },
      snapshot: { journalRevision: 5 },
    } as never);
    const report = vi.fn();
    render(
      <RuntimeContext.Provider value={{ writable: true, report }}>
        <MemoryRouter initialEntries={['/trades/trade-1']}>
          <Routes>
            <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    const user = userEvent.setup();
    await openDrawer(user, 'Journal');
    await user.click(await within(await screen.findByRole('tabpanel', { name: 'Journal' })).findByRole('button', { name: 'Reflect now' }));

    const form = await screen.findByRole('form', { name: 'Reflection' });
    expect(facade.Journal.getDefinitions).toHaveBeenCalledWith({ revision: 'def-pcr-1' });
    await user.click(within(within(form).getByRole('radiogroup', { name: 'Decision mode' })).getByLabelText('Impulsive'));
    await user.click(within(within(form).getByRole('radiogroup', { name: 'Primary emotion' })).getByLabelText('Calm'));
    await user.click(within(within(form).getByRole('radiogroup', { name: 'Decision confidence' })).getByLabelText('4'));
    await user.click(within(form).getByRole('button', { name: 'Answer' }));

    expect(facade.Journal.save).toHaveBeenCalledWith({
      intention: 'ResolveDebt',
      debtId: 'debt-1',
      expectedDebtRevision: 'debt-1-rev-1',
      resolution: {
        kind: 'Answer',
        form: {
          definitionId: 'def-pcr-1',
          answers: {
            [MODE]: { kind: 'Option', optionId: REACTIVE },
            [EMOTION]: { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
            [CONFIDENCE]: { kind: 'Scale', value: 4 },
          },
        },
      },
    });
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'Saved' }));
    const saved = await screen.findByRole('region', { name: 'Saved reflection' });
    expect(within(saved).getByText('Impulsive')).toBeTruthy();
    expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenCalledTimes(1);
  });

  it('should relabel a reflection resolved on Trade Detail as "Deferred, answered" or "Declined later" with its time, without "Reflection owed" or a due status', async () => {
    const cases = [
      { label: 'Deferred, answered', term: 'Answered', time: '2026-10-13 09:05', button: 'Answer', saved: { entry: { id: 'entry-9', authoredTime: '2026-10-13T13:05:00Z', responses: [] } } },
      { label: 'Declined later', term: 'Declined', time: '2026-10-13 09:10', button: 'Decline', saved: { decline: { id: 'decl-1', authoredTime: '2026-10-13T13:10:00Z' } } },
    ];
    for (const { label, term, time, button, saved } of cases) {
      const facade = facadeDouble();
      vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: openDetailOf([PC1, PC2], { journal: [owedDebt('debt-1', 'pc-1', '2026-10-12T14:00:00Z', 'Due')] }), binding: {} } as never);
      vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition: reflectionDefinition } as never);
      vi.mocked(facade.Journal.save).mockResolvedValue({ kind: 'Saved', ...saved, debt: { debtId: 'debt-1' }, currentOutcome: { kind: 'Entry', id: 'x' }, snapshot: { journalRevision: 5 } } as never);
      render(
        <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
          <MemoryRouter initialEntries={['/trades/trade-1']}>
            <Routes>
              <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
            </Routes>
          </MemoryRouter>
        </RuntimeContext.Provider>,
      );
      const user = userEvent.setup();
      await openDrawer(user, 'Journal');
      await user.click(await within(await screen.findByRole('tabpanel', { name: 'Journal' })).findByRole('button', { name: 'Reflect now' }));
      const form = await screen.findByRole('form', { name: 'Reflection' });
      if (button === 'Answer') {
        await user.click(within(within(form).getByRole('radiogroup', { name: 'Decision mode' })).getAllByRole('radio')[0] as HTMLElement);
        await user.click(within(within(form).getByRole('radiogroup', { name: 'Primary emotion' })).getAllByRole('radio')[0] as HTMLElement);
        await user.click(within(within(form).getByRole('radiogroup', { name: 'Decision confidence' })).getAllByRole('radio')[0] as HTMLElement);
      }
      await user.click(within(form).getByRole('button', { name: button }));
      const item = (await screen.findByRole('region', { name: 'Saved reflection' })).closest('li') as HTMLElement;
      expect(within(item).getByText(label, { selector: '.badge' })).toBeTruthy();
      expect(termValue(item, term)).toBe(time);
      expect(within(item).queryByText('Reflection owed')).toBeNull();
      expect(within(item).queryByText('Due', { selector: 'dt' })).toBeNull();
      expect(facade.TradeViewsAndReporting.getTradeDetail).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it('should show an unclassified Outstanding Debt as "Reflection owed" with no due text, with Reflect now and Decline still offered while Writable', async () => {
    const journal = [owedDebt('debt-1', 'pc-1', '2026-10-12T14:00:00Z')];
    const user = userEvent.setup();
    renderView(openDetailUncovered([PC1, PC2], '2026-10-12', { journal }));
    await openDrawer(user, 'Journal');
    const region = await screen.findByRole('region', { name: 'Journal (1)' });
    const item = within(region).getByRole('listitem');
    expect(within(item).getByText('Reflection owed')).toBeTruthy();
    expect(item.textContent).toContain('Position Change at 2026-10-12 10:00');
    expect(within(item).queryByText('Due', { exact: false })).toBeNull();
    expect(within(item).queryByText('Due', { selector: 'dt' })).toBeNull();
    expect(within(item).getByRole('button', { name: 'Reflect now' })).toBeTruthy();
    expect(within(item).getByRole('button', { name: 'Decline' })).toBeTruthy();
    cleanup();

    renderView(openDetailUncovered([PC1, PC2], '2026-10-12', { journal }), false);
    await openDrawer(user, 'Journal');
    const readOnly = await screen.findByRole('region', { name: 'Journal (1)' });
    expect(within(readOnly).getByText('Reflection owed')).toBeTruthy();
    expect(within(readOnly).queryByRole('button', { hidden: true })).toBeNull();
  });

  it('should keep one Debt form open at a time, disabling the other Debts actions until it is cancelled or resolved', async () => {
    const journal = [owedDebt('debt-1', 'pc-1', '2026-10-12T14:00:00Z', 'Due'), owedDebt('debt-2', 'pc-2', '2026-10-12T15:00:00Z', 'DueInNextReview')];
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: openDetailOf([PC1, PC2], { journal }), binding: {} } as never);
    vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition: reflectionDefinition } as never);
    vi.mocked(facade.Journal.save).mockResolvedValue({ kind: 'Saved', decline: { id: 'decl-1' }, debt: { debtId: 'debt-1' }, currentOutcome: { kind: 'Decline', id: 'decl-1' }, snapshot: { journalRevision: 5 } } as never);
    render(
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
        <MemoryRouter initialEntries={['/trades/trade-1']}>
          <Routes>
            <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    const user = userEvent.setup();
    await openDrawer(user, 'Journal');
    const [first, second] = within(await screen.findByRole('region', { name: 'Journal (2)' })).getAllByRole('listitem') as [HTMLElement, HTMLElement];
    await user.click(within(first).getByRole('button', { name: 'Reflect now' }));
    await within(first).findByRole('form', { name: 'Reflection' });
    expect(within(second).getByRole('button', { name: 'Reflect now' }).hasAttribute('disabled')).toBe(true);
    expect(within(second).getByRole('button', { name: 'Decline' }).hasAttribute('disabled')).toBe(true);

    await user.click(within(first).getByRole('button', { name: 'Cancel' }));
    expect(within(first).queryByRole('form', { hidden: true })).toBeNull();
    expect(within(first).getByRole('button', { name: 'Reflect now' })).toBeTruthy();
    expect(within(second).getByRole('button', { name: 'Reflect now' }).hasAttribute('disabled')).toBe(false);

    await user.click(within(first).getByRole('button', { name: 'Reflect now' }));
    await user.click(await within(first).findByRole('button', { name: 'Decline' }));
    await within(first).findByRole('region', { name: 'Saved reflection' });
    expect(within(second).getByRole('button', { name: 'Reflect now' }).hasAttribute('disabled')).toBe(false);
  });

  it('should show that the reflection could not be opened, and re-enable the other reflections, when its definition cannot be loaded', async () => {
    const journal = [owedDebt('debt-1', 'pc-1', '2026-10-12T14:00:00Z', 'Due'), owedDebt('debt-2', 'pc-2', '2026-10-12T15:00:00Z', 'DueInNextReview')];
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: openDetailOf([PC1, PC2], { journal }), binding: {} } as never);
    render(
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
        <MemoryRouter initialEntries={['/trades/trade-1']}>
          <Routes>
            <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    const user = userEvent.setup();
    await openDrawer(user, 'Journal');
    const [first, second] = within(await screen.findByRole('region', { name: 'Journal (2)' })).getAllByRole('listitem') as [HTMLElement, HTMLElement];
    for (const failure of [() => Promise.reject(new Error('storage')), () => Promise.resolve({ kind: 'NotFound' })]) {
      vi.mocked(facade.Journal.getDefinitions).mockImplementation(failure as never);
      await user.click(within(first).getByRole('button', { name: 'Reflect now' }));
      expect((await within(first).findByRole('alert')).textContent).toContain('This reflection could not be opened.');
      expect(within(first).queryByRole('form', { hidden: true })).toBeNull();
      expect(within(second).getByRole('button', { name: 'Reflect now' }).hasAttribute('disabled')).toBe(false);
      expect(within(second).getByRole('button', { name: 'Decline' }).hasAttribute('disabled')).toBe(false);
    }
  });

  it('should register an unsaved reflection on Trade Detail with the update guard and clear it after a save or cancel', async () => {
    const journal = [owedDebt('debt-1', 'pc-1', '2026-10-12T14:00:00Z', 'Due')];
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: openDetailOf([PC1, PC2], { journal }), binding: {} } as never);
    vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition: reflectionDefinition } as never);
    vi.mocked(facade.Journal.save).mockResolvedValue({ kind: 'Saved', decline: { id: 'decl-1' }, debt: { debtId: 'debt-1' }, currentOutcome: { kind: 'Decline', id: 'decl-1' }, snapshot: { journalRevision: 5 } } as never);
    const onDirtyChange = vi.fn();
    render(
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
        <MemoryRouter initialEntries={['/trades/trade-1']}>
          <Routes>
            <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" onDirtyChange={onDirtyChange} />} />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    const user = userEvent.setup();
    await openDrawer(user, 'Journal');
    const answerMode = async () => {
      const form = await screen.findByRole('form', { name: 'Reflection' });
      await user.click(within(within(form).getByRole('radiogroup', { name: 'Decision mode' })).getByLabelText('Reactive'));
      return form;
    };

    await user.click(await within(await screen.findByRole('tabpanel', { name: 'Journal' })).findByRole('button', { name: 'Reflect now' }));
    const form = await answerMode();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    onDirtyChange.mockClear();
    await user.click(within(screen.getByRole('tabpanel', { name: 'Journal' })).getByRole('button', { name: 'Reflect now' }));
    await answerMode();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    await screen.findByRole('region', { name: 'Saved reflection' });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('should move focus to the saved reflection after a Debt is resolved', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({
      kind: 'Ready',
      view: openDetailOf([PC1, PC2], { journal: [owedDebt('debt-1', 'pc-1', '2026-10-12T14:00:00Z', 'Due')] }),
      binding: {},
    } as never);
    vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition: reflectionDefinition } as never);
    vi.mocked(facade.Journal.save).mockResolvedValue({ kind: 'Saved', decline: { id: 'decl-1' }, debt: { debtId: 'debt-1' }, currentOutcome: { kind: 'Decline', id: 'decl-1' }, snapshot: { journalRevision: 5 } } as never);
    render(
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
        <MemoryRouter initialEntries={['/trades/trade-1']}>
          <Routes>
            <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    const user = userEvent.setup();
    await openDrawer(user, 'Journal');
    await user.click(await within(await screen.findByRole('tabpanel', { name: 'Journal' })).findByRole('button', { name: 'Reflect now' }));
    await user.click(await screen.findByRole('button', { name: 'Decline' }));

    const saved = await screen.findByRole('region', { name: 'Saved reflection' });
    expect(saved.parentElement?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('should report RuntimeNotWritable to the shell and keep the form when a Decline is refused', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({
      kind: 'Ready',
      view: openDetailOf([PC1, PC2], { journal: [owedDebt('debt-1', 'pc-1', '2026-10-12T14:00:00Z', 'Due')] }),
      binding: {},
    } as never);
    vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition: reflectionDefinition } as never);
    vi.mocked(facade.Journal.save).mockResolvedValue({ kind: 'RuntimeNotWritable' } as never);
    const report = vi.fn();
    render(
      <RuntimeContext.Provider value={{ writable: true, report }}>
        <MemoryRouter initialEntries={['/trades/trade-1']}>
          <Routes>
            <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
          </Routes>
        </MemoryRouter>
      </RuntimeContext.Provider>,
    );
    const user = userEvent.setup();
    await openDrawer(user, 'Journal');
    await user.click(await screen.findByRole('button', { name: 'Decline' }));
    const form = await screen.findByRole('form', { name: 'Reflection' });
    await user.type(within(form).getByLabelText('Reason for declining (optional)'), 'No time.');
    await user.click(within(form).getByRole('button', { name: 'Decline' }));

    expect(facade.Journal.save).toHaveBeenCalledWith({
      intention: 'ResolveDebt',
      debtId: 'debt-1',
      expectedDebtRevision: 'debt-1-rev-1',
      resolution: { kind: 'Decline', reason: 'No time.' },
    });
    expect(report).toHaveBeenLastCalledWith({ kind: 'RuntimeNotWritable' });
    expect(screen.getByRole('form', { name: 'Reflection' })).toBeTruthy();
  });
});

describe('Closed Trade Detail owed Debts (T6.19-B1)', () => {
  const owed = (id: string, entryType: string, entryTypeKey: string, source: string, momentTime: string, positionChangeId: string): TradeDetailDebt => ({
    kind: 'Debt',
    id,
    entryType,
    entryTypeKey,
    source,
    anchor: { kind: 'Trade', tradeId: 'trade-1' },
    momentTime,
    positionChangeId,
    definitionId: `def-${id}`,
    dueAnchor: '2026-10-14T20:00:00Z',
    revision: `${id}-rev-1`,
    dueStatus: 'DueInNextReview',
  });

  it('should tell a deferred Close Review from a deferred Position Change Reflection by naming each Entry Type on its owed item', async () => {
    const journal = [
      owed('debt-pcr', 'Position Change Reflection', 'entry-type.position-change-reflection', 'Position Change', '2026-10-13T18:00:00Z', 'pc-x2'),
      owed('debt-close', 'Close Review', 'entry-type.close-review', 'Trade close', '2026-10-13T18:00:00Z', 'pc-x2'),
    ];
    const user = userEvent.setup();
    renderView(closedDetailOf([PC1, PC2, X1, X2], { closeReason: { id: 'cr-1', label: 'Target reached' }, journal }), true);
    await openDrawer(user, 'Journal');
    const region = await screen.findByRole('region', { name: 'Journal (2)' });
    const [reflection, closeReview] = within(region).getAllByRole('listitem') as [HTMLElement, HTMLElement];
    expect(within(reflection).getByText('Position Change Reflection', { selector: '.badge' })).toBeTruthy();
    expect(within(reflection).queryByText('Close Review')).toBeNull();
    expect(within(closeReview).getByText('Close Review', { selector: '.badge' })).toBeTruthy();
    expect(within(closeReview).queryByText('Position Change Reflection')).toBeNull();
    // Both still read as owed, beside the moment they belong to.
    for (const item of [reflection, closeReview]) {
      expect(within(item).getByText('Reflection owed')).toBeTruthy();
      expect(item.textContent).toContain('Position Change at 2026-10-13 14:00');
    }
  });
});
