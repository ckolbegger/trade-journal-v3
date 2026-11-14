// @vitest-environment jsdom
// The Journal session cards through their adapter (`drawers/journal.props`): a TradeReplayView's slice and the Detail's view become finished
// display values (A216). Only an adapter or its test may import a view's types, so every view and replay is built here.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import { incoherentDetailOf, openDetailOf, pc1Reflection, pc2Decline, PC1, PC2 } from '../../../tests/support/open-detail-fixtures.ts';
import { reflectionDefinition } from '../../../tests/support/position-change-form-facade.ts';
import { plannedDetail } from '../../../tests/support/views-fixtures.ts';
import type { TradeDetailDebt } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { termValue } from '../screens/trade-detail/test-support.ts';
import { JournalCards, journalTabCount } from './journal-cards.tsx';

afterEach(cleanup);

const ZONE = 'America/New_York';
const view = openDetailOf([PC1, PC2]);

// A session's Marks and Trade P&L, as the replay holds them; the slice carries nothing else the cards read.
const stock = { kind: 'Stock', symbol: 'XYZ' } as const;
const dollars = (n: bigint) => ({ kind: 'Value', value: Rational.of(n) }) as const;
const markOf = (price: string) => ({ instrument: stock, resolution: { kind: 'Available', mark: { price } } }) as const;
const session = (date: string, pnl: bigint, price: string, change: { since: string; dollars: bigint } | null, journal: readonly unknown[] = []) => ({
  date,
  tradePnl: dollars(pnl),
  change: change && { since: change.since, dollars: Rational.of(change.dollars) },
  positions: [{ instrument: stock, quantity: Rational.of(100n) }],
  marks: [markOf(price)],
  journal,
});
const owedDebt = (id: string, positionChangeId: string, momentTime: string): TradeDetailDebt => ({
  kind: 'Debt',
  id,
  entryType: 'Position Change Reflection',
  entryTypeKey: 'entry-type.position-change-reflection',
  source: 'Position Change',
  anchor: { kind: 'Trade', tradeId: 'trade-1' },
  momentTime,
  positionChangeId,
  definitionId: 'def-pcr-1',
  dueAnchor: '2026-11-10T21:00:00Z',
  revision: `${id}-rev-1`,
  dueStatus: 'Due',
});
const withoutMarks =(date: string, journal: readonly unknown[] = []) => ({
  date,
  tradePnl: { kind: 'Unavailable', reason: 'MarkMissing', instrument: stock, date },
  change: null,
  positions: [{ instrument: stock, quantity: Rational.of(100n) }],
  marks: [{ instrument: stock, resolution: { kind: 'Missing' } }],
  journal,
});
// A Closed Trade's final session: sold in full that day, so nothing was held at the close and no Mark was due.
const flatFinal = (date: string, pnl: bigint, change: { since: string; dollars: bigint } | null) => ({
  ...session(date, pnl, '0', change),
  positions: [{ instrument: stock, quantity: Rational.of(0n) }],
  marks: [{ instrument: stock, resolution: { kind: 'Missing' } }],
});
const replayOf =(sessions: readonly unknown[], extra: Record<string, unknown> = {}) => ({ sessions, plan: [], pending: null, ...extra });
// A card is named by its heading; an item inside it has its own.
const headingOf = (card: HTMLElement): string | null => document.getElementById(card.getAttribute('aria-labelledby')!)!.textContent;

// A day long after every session, so no card reads "Today" or "Yesterday" unless a case sets the day.
const show = (replay: unknown, extra: Record<string, unknown> = {}) => render(<JournalCards {...({ view, timeZone: ZONE, today: '2026-11-30', replay, ...extra } as object)} />);

describe('Journal session cards (W10–W13, A214)', () => {
  it('should show one card per session, newest first, with its Trade P&L, change, Marks and items', () => {
    show(
      replayOf([
        session('2026-11-09', 10n, '52.30', null, [pc1Reflection]),
        session('2026-11-10', 100n, '53.20', { since: '2026-11-09', dollars: 90n }, [pc2Decline]),
        session('2026-11-11', -20n, '51.00', { since: '2026-11-10', dollars: -120n }),
      ]),
    );
    const cards = screen.getAllByRole('article');
    expect(cards.map(headingOf)).toEqual(['Wed Nov 11, final session', 'Tue Nov 10', 'Mon Nov 9']);
    const [wednesday, tuesday, monday] = cards as [HTMLElement, HTMLElement, HTMLElement];
    expect(wednesday.querySelector('.journal-card-title')?.textContent).toBe('−$20.00');
    expect(wednesday.querySelector('.journal-card-title')?.getAttribute('data-tone')).toBe('loss');
    expect(wednesday.querySelector('.journal-card-change')?.textContent).toBe('−$120.00 since Tue Nov 10');
    expect(termValue(wednesday, 'XYZ Mark')).toBe('$51.00');
    expect(tuesday.querySelector('.journal-card-title')?.textContent).toBe('$100.00');
    expect(tuesday.querySelector('.journal-card-title')?.getAttribute('data-tone')).toBe('gain');
    expect(tuesday.querySelector('.journal-card-change')?.textContent).toBe('+$90.00 since Mon Nov 9');
    expect(monday.querySelector('.journal-card-change')?.textContent).toBe('First Mark');
    expect(termValue(monday, 'XYZ Mark')).toBe('$52.30');
    // Each session's items, in their existing words.
    const [entry] = within(monday).getAllByRole('listitem');
    expect(within(entry!).getByText('Position Change Reflection', { selector: '.badge' })).toBeTruthy();
    expect(termValue(entry!, 'Moment')).toBe('2026-10-12 10:00');
    expect(termValue(entry!, 'Anchor')).toBe('Trade XYZ');
    const [declined] = within(tuesday).getAllByRole('listitem');
    expect(within(declined!).getByText('Reflection declined')).toBeTruthy();
    expect(termValue(declined!, 'Reason')).toBe('Same plan, second fill.');
    expect(within(wednesday).queryByRole('listitem', { hidden: true })).toBeNull();
  });

  it('should merge back-to-back sessions without Marks into one card', () => {
    show(
      replayOf([
        withoutMarks('2026-11-06'),
        session('2026-11-09', 10n, '52.30', null),
        withoutMarks('2026-11-10'),
        withoutMarks('2026-11-11', [pc2Decline]),
        withoutMarks('2026-11-12'),
        session('2026-11-13', 30n, '52.50', { since: '2026-11-09', dollars: 20n }),
      ]),
    );
    // The fourth card is on the next page, so it is hidden.
    const cards = screen.getAllByRole('article', { hidden: true });
    expect(cards.map(headingOf)).toEqual([
      'Fri Nov 13, final session',
      'Tue Nov 10 to Thu Nov 12 without Marks',
      'Mon Nov 9',
      'Fri Nov 6 without Marks',
    ]);
    // The merged card holds the items of the sessions it replaces, and no Trade P&L, change or Mark.
    const merged = cards[1]!;
    expect(within(merged).getAllByRole('listitem')).toHaveLength(1);
    expect(within(merged).getByText('Reflection declined')).toBeTruthy();
    expect(merged.querySelector('.journal-card-title, .journal-card-change, .journal-card-marks')).toBeNull();
  });

  // T8P.23-B11 (critic-2 defect 5, W10, A214).
  it('should head a Closed Trade final session flat at its close as the final session with its Trade P&L, not as without Marks', () => {
    show(replayOf([session('2026-10-12', 100n, '51.00', null), flatFinal('2026-10-13', 198n, { since: '2026-10-12', dollars: 98n })]));
    const cards = screen.getAllByRole('article', { hidden: true });
    expect(cards.map(headingOf)).toEqual(['Tue Oct 13, final session', 'Mon Oct 12']);
    const [final] = cards as [HTMLElement];
    expect(final.querySelector('.journal-card-title')?.textContent).toBe('$198.00');
    // No Mark, so no change line (T8P.26-B3).
    expect(final.querySelector('.journal-card-change')).toBeNull();
    expect(screen.queryByText(/without Marks/, { selector: 'h3' })).toBeNull();
    expect(final.textContent).not.toContain('without Marks');
    // Nothing was due, so the Mark row is no gap.
    expect(within(final).queryByRole('img', { name: 'No Mark', hidden: true })).toBeNull();
    // A real gap before the final session still merges on its own, and the final session stays apart from it.
    cleanup();
    show(replayOf([session('2026-10-12', 100n, '51.00', null), withoutMarks('2026-10-13'), flatFinal('2026-10-14', 198n, null)]));
    expect(screen.getAllByRole('article', { hidden: true }).map(headingOf)).toEqual(['Wed Oct 14, final session', 'Tue Oct 13 without Marks', 'Mon Oct 12']);
  });

  // T8P.26-B3 (critic-4 defect 3, W10, A211, A212; the user's reading of W10, 2026-11-14): "First Mark" names only a session that brought a Mark.
  it('should show a final session with no Mark and no earlier Mark with its Trade P&L and no change line', () => {
    show(replayOf([flatFinal('2026-10-12', 398n, null)]));
    const [final] = screen.getAllByRole('article', { hidden: true }) as [HTMLElement];
    expect(final.querySelector('.journal-card-title')?.textContent).toBe('$398.00');
    expect(final.querySelector('.journal-card-change')).toBeNull();
    expect(final.textContent).not.toContain('First Mark');
  });

  it('should show a final session with no Mark after an earlier marked session with no change line', () => {
    show(replayOf([session('2026-10-12', 100n, '51.00', null), flatFinal('2026-10-13', 198n, { since: '2026-10-12', dollars: 98n })]));
    const [final, earlier] = screen.getAllByRole('article', { hidden: true }) as [HTMLElement, HTMLElement];
    expect(final.querySelector('.journal-card-change')).toBeNull();
    expect(final.textContent).not.toMatch(/since|First Mark/);
    // The marked session keeps its words.
    expect(earlier.querySelector('.journal-card-change')?.textContent).toBe('First Mark');
  });

  it('should page by about one screen with ‹ and ›, and disable each at its end', async () => {
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10'];
    show(replayOf(days.map((date, at) => session(date, BigInt(at), '52.30', at === 0 ? null : { since: days[at - 1]!, dollars: 1n }))));
    expect(screen.getByRole('heading', { name: 'Sessions, newest first', level: 2 })).toBeTruthy();
    const newer = screen.getByRole('button', { name: 'Newer sessions' });
    const earlier = screen.getByRole('button', { name: 'Earlier sessions' });
    expect([newer.textContent, earlier.textContent]).toEqual(['‹', '›']);
    const shown = () => screen.getAllByRole('article').map(headingOf);
    // Every card stays in the page, so an open form survives paging; the others are only hidden.
    expect(screen.getAllByRole('article', { hidden: true })).toHaveLength(7);
    const user = userEvent.setup();

    expect(shown()).toEqual(['Tue Nov 10, final session', 'Mon Nov 9', 'Fri Nov 6']);
    expect(newer.hasAttribute('disabled')).toBe(true);
    expect(earlier.hasAttribute('disabled')).toBe(false);
    await user.click(earlier);
    expect(shown()).toEqual(['Thu Nov 5', 'Wed Nov 4', 'Tue Nov 3']);
    expect(newer.hasAttribute('disabled')).toBe(false);
    expect(earlier.hasAttribute('disabled')).toBe(false);
    await user.click(earlier);
    expect(shown()).toEqual(['Mon Nov 2']);
    expect(earlier.hasAttribute('disabled')).toBe(true);
    await user.click(newer);
    expect(shown()).toEqual(['Thu Nov 5', 'Wed Nov 4', 'Tue Nov 3']);
    expect(earlier.hasAttribute('disabled')).toBe(false);
  });

  it('should show the Plan card and the card of the session not yet ended', () => {
    const planned = { ...view, plan: { ...view.plan, planTime: '2026-11-05T18:40:00Z' } };
    const planReflection = { kind: 'Entry', ...plannedDetail.journal[0] };
    show(
      replayOf([session('2026-11-09', 10n, '52.30', null), session('2026-11-11', 100n, '53.20', { since: '2026-11-09', dollars: 90n })], {
        plan: [planReflection],
        pending: { date: '2026-11-12', journal: [pc1Reflection] },
      }),
      { view: planned, today: '2026-11-12' },
    );
    // The Plan card is the fourth, on the next page, so it is hidden.
    const cards = screen.getAllByRole('article', { hidden: true });
    expect(cards.map(headingOf)).toEqual(['Today, Thu Nov 12', 'Yesterday, Wed Nov 11', 'Mon Nov 9', 'Plan']);
    // The session not yet ended has no figures yet, only the items saved since the last session.
    const [pending, , , plan] = cards as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    expect(pending.querySelector('.journal-card-title')?.textContent).toBe('Session not ended yet');
    expect(within(pending).getByText('Its Marks are due once this session ends.')).toBeTruthy();
    expect(pending.querySelector('.journal-card-change, .journal-card-marks')).toBeNull();
    expect(within(pending).getAllByRole('listitem')).toHaveLength(1);
    expect(within(pending).getByText('Position Change Reflection', { selector: '.badge' })).toBeTruthy();
    // The Plan card: when the Plan was made, and its Journal items from before the first exposure.
    expect(plan.querySelector('.journal-card-when')?.textContent).toBe('Planned Thu Nov 5, 1:40 pm');
    expect(within(plan).getByText('Plan Reflection', { selector: '.badge' })).toBeTruthy();
    expect(plan.querySelector('.journal-card-change, .journal-card-marks')).toBeNull();
  });

  it('should show one list of every entry on an incoherent Detail', () => {
    const incoherent = incoherentDetailOf([PC1, PC2], [], [pc1Reflection, pc2Decline, owedDebt('debt-1', 'pc-1', '2026-10-12T16:00:00Z')]);
    show('Incoherent', { view: incoherent, facade: facadeDouble() });
    // One card, headed "Journal", with every entry newest first and no session.
    const cards = screen.getAllByRole('article', { hidden: true });
    expect(cards).toHaveLength(1);
    const [list] = cards as [HTMLElement];
    expect(list.hidden || list.closest('li')?.hidden).toBeFalsy();
    expect(headingOf(list)).toBe('Journal');
    expect(list.querySelector('.journal-card-when')?.textContent).toBe('Every entry, newest first');
    expect(within(list).getByText('Without a replay there are no sessions, so the entries are one list.')).toBeTruthy();
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('.badge')?.textContent)).toEqual(['Position Change Reflection', 'Position Change Reflection', 'Position Change Reflection']);
    expect(within(items[0]!).getByText('Reflection owed')).toBeTruthy();
    expect(within(items[1]!).getByText('Reflection declined')).toBeTruthy();
    expect(termValue(items[2]!, 'Moment')).toBe('2026-10-12 10:00');
    // No session list: no heading for it and no paging, anywhere in the document.
    expect(document.querySelector('.journal-cards-head')).toBeNull();
    expect(screen.queryAllByRole('button', { name: /sessions$/, hidden: true })).toHaveLength(0);
  });

  it("should word an option Trade's Marks as the option's price with a dollar sign and the Underlying's without one, and a gap as No Mark", () => {
    const call = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-12-18', strike: '55', right: 'Call', multiplier: 100 } as const;
    const marks = [
      { instrument: stock, resolution: { kind: 'Available', mark: { price: '57.40' } } },
      { instrument: call, resolution: { kind: 'Missing' } },
    ];
    show(replayOf([{ ...session('2026-11-09', 10n, '0', null), marks }]));
    const card = screen.getByRole('article');
    expect(termValue(card, 'XYZ Mark')).toBe('57.40');
    // The option's Mark is missing: a gap, named for a screen reader.
    expect(termValue(card, 'Call Mark')).toBe('—');
    expect(within(card).getByRole('img', { name: 'No Mark' }).textContent).toBe('—');
    show(replayOf([{ ...session('2026-11-10', 10n, '0', null), marks: [{ instrument: call, resolution: { kind: 'Available', mark: { price: '2.9' } } }] }]));
    expect(termValue(screen.getAllByRole('article')[1]!, 'Call Mark')).toBe('$2.90');
  });

  it('should give a session with some Marks and no Trade P&L its reason and no change line', () => {
    show(replayOf([{ ...withoutMarks('2026-11-09'), marks: [markOf('52.30'), { instrument: { kind: 'Stock', symbol: 'MNO' }, resolution: { kind: 'Missing' } }] }]));
    const card = screen.getByRole('article');
    expect(card.querySelector('.journal-card-title')?.textContent).toBe('Mark missing: XYZ, Mon Nov 9');
    expect(card.querySelector('.journal-card-change')).toBeNull();
    expect(termValue(card, 'XYZ Mark')).toBe('$52.30');
  });

  it('should keep a page of cards in view when the list shrinks or stops paging', async () => {
    const four = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((date) => session(date, 1n, '52.30', null));
    const input = (replay: unknown, extra: Record<string, unknown> = {}) => <JournalCards {...({ view, timeZone: ZONE, today: '2026-11-30', facade: facadeDouble(), replay, ...extra } as object)} />;
    const { rerender } = render(input(replayOf(four)));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Earlier sessions' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    // The list shrinks to one page: the page follows it, and the cards past it stay hidden.
    rerender(input(replayOf(four.slice(0, 3))));
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getAllByRole('article', { hidden: true })).toHaveLength(3);
    // The one list does not page: its card is in view.
    rerender(input('Incoherent', { view: incoherentDetailOf([PC1, PC2], [], [pc1Reflection]) }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getAllByRole('article', { hidden: true })).toHaveLength(1);
  });

  it("should keep each entry's saved status and its Answered or Declined time on its card", () => {
    const settled = { debtId: 'debt-1', dueAnchor: '2026-10-12T20:00:00Z' };
    const answered = { ...pc1Reflection, id: 'e-9', edited: true, answeredLater: settled, authoredTime: '2026-10-13T14:00:00Z' };
    const declined = { ...pc2Decline, id: 'd-9', declinedLater: settled, authoredTime: '2026-10-13T15:00:00Z' };
    show(replayOf([session('2026-11-09', 10n, '52.30', null, [answered, declined])]));
    const [entry, decline] = within(screen.getByRole('article')).getAllByRole('listitem') as [HTMLElement, HTMLElement];
    expect([...entry.querySelectorAll('h3 .badge')].map((badge) => badge.textContent)).toEqual(['Position Change Reflection', 'Edited', 'Deferred, answered']);
    expect(termValue(entry, 'Answered')).toBe('2026-10-13 10:00');
    expect(within(entry).queryByText('Authored', { selector: 'dt' })).toBeNull();
    expect(within(decline).getByText('Declined later', { selector: '.badge' })).toBeTruthy();
    expect(within(decline).queryByText('Reflection declined')).toBeNull();
    expect(termValue(decline, 'Declined')).toBe('2026-10-13 11:00');
    expect(termValue(decline, 'Reason')).toBe('Same plan, second fill.');
  });

  it('should need the Detail view beside a replay, as the input type says', () => {
    // @ts-expect-error a replay without the Detail's view would throw while the cards are built
    const withoutView = <JournalCards replay={{ sessions: [], plan: [], pending: null }} facade={facadeDouble()} />;
    expect(withoutView).toBeTruthy();
  });

  it('should count the reflections owed for the Journal tab, as "1 owed", and none when nothing is owed', () => {
    const owed = [owedDebt('debt-1', 'pc-1', '2026-10-12T14:00:00Z'), owedDebt('debt-2', 'pc-2', '2026-10-12T15:00:00Z')];
    expect(journalTabCount(openDetailOf([PC1, PC2], { journal: [pc1Reflection, owed[0]!] }))).toBe('1 owed');
    expect(journalTabCount(openDetailOf([PC1, PC2], { journal: owed }))).toBe('2 owed');
    expect(journalTabCount(openDetailOf([PC1, PC2], { journal: [pc1Reflection] }))).toBeUndefined();
  });

  it("should keep an owed reflection's Reflect now and Decline on its card, one form at a time", async () => {
    const facade = facadeDouble();
    vi.mocked(facade.Journal.getDefinitions).mockResolvedValue({ kind: 'Found', definition: reflectionDefinition } as never);
    render(
      <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
        <JournalCards {...({ view, timeZone: ZONE, facade, replay: replayOf([session('2026-11-09', 10n, '52.30', null, [owedDebt('debt-1', 'pc-1', '2026-11-09T15:00:00Z')]), session('2026-11-10', 100n, '53.20', { since: '2026-11-09', dollars: 90n }, [owedDebt('debt-2', 'pc-2', '2026-11-10T15:00:00Z')])]) } as object)} />
      </RuntimeContext.Provider>,
    );
    const user = userEvent.setup();
    const [tuesday, monday] = screen.getAllByRole('article') as [HTMLElement, HTMLElement];
    // The owed item keeps its words on its own card.
    expect(within(monday).getByText('Reflection owed')).toBeTruthy();
    expect(termValue(monday, 'Due')).toBe('Due');
    expect(within(monday).getByRole('button', { name: 'Reflect now' })).toBeTruthy();
    expect(within(monday).getByRole('button', { name: 'Decline' })).toBeTruthy();

    await user.click(within(tuesday).getByRole('button', { name: 'Reflect now' }));
    await within(tuesday).findByRole('form', { name: 'Reflection' });
    expect(facade.Journal.getDefinitions).toHaveBeenCalledWith({ revision: 'def-pcr-1' });
    expect(within(monday).getByRole('button', { name: 'Reflect now' }).hasAttribute('disabled')).toBe(true);
    expect(within(monday).getByRole('button', { name: 'Decline' }).hasAttribute('disabled')).toBe(true);

    await user.click(within(tuesday).getByRole('button', { name: 'Cancel' }));
    expect(within(tuesday).queryByRole('form', { hidden: true })).toBeNull();
    expect(within(monday).getByRole('button', { name: 'Reflect now' }).hasAttribute('disabled')).toBe(false);
  });
});
