// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { ReplayDrawer } from '../drawers/replay.tsx';
import type { ReplayView } from './replay.props.ts';
import { BREN, session, usd, view, type Session } from './view-doubles.props.ts';

afterEach(cleanup);

// T95.57: the Replay's session as the trader's own day (A317): the fills, the Action and its reason, the Action row, the key moments.
// The view is finished; the drawer draws it through the adapter.
const buy = { id: 'pc-1', kind: 'Execution', effect: 'Opened', fills: [{ instrument: BREN, action: 'Buy', quantity: usd(4), price: usd(1.61) }] } as const;
const sell = { id: 'pc-2', kind: 'Execution', effect: 'Reduced', fills: [{ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4) }] } as const;
const day = (date: string, extra: Partial<Session> = {}, held = 4): Session => ({ ...session({ date, pnl: 100, held }), ...extra });

const DATES = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
const openView = (sessions: readonly Session[], extra: Partial<ReplayView> = {}): ReplayView => ({ ...view(sessions), pending: { date: '2026-11-06', journal: [] }, ...extra });

function show(replay: ReplayView, initialSession?: string) {
  render(
    <MemoryRouter>
      <ReplayDrawer replay={replay} {...(initialSession && { initialSession })} />
    </MemoryRouter>,
  );
}
const thatDay = () => screen.getByRole('region', { name: 'What you did that day' });
// What the section says, as one text: figures are wrapped in their own spans (C9AR.2), so a sentence is read from the section, not from one element.
const said = () => thatDay().textContent ?? '';

const MOMENTS = [
  { date: DATES[0]!, kinds: ['Entry'] },
  { date: DATES[2]!, kinds: ['Stop', 'Sale'] },
  { date: DATES[3]!, kinds: ['Now'] },
] as const;
const momentView = () => openView(DATES.map((date) => day(date)), { keyMoments: MOMENTS as unknown as ReplayView['keyMoments'] });

describe('Replay: Key moments (T95.57, W148)', () => {
  it('should list the key moments in a drop-down and move to the one chosen', async () => {
    const user = userEvent.setup();
    show(momentView(), DATES[3]);
    const moments = screen.getByRole('combobox', { name: 'Key moments' });
    expect(within(moments).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose a moment', '1. Entry · Mon Nov 2', '2. Stop + Sale · Wed Nov 4', '3. Now · Thu Nov 5']);
    // On a moment the drop-down names it.
    expect(moments).toHaveProperty('value', DATES[3]);
    await user.selectOptions(moments, '2. Stop + Sale · Wed Nov 4');
    expect(screen.getByRole('slider', { name: 'Session' }).getAttribute('aria-valuetext')).toMatch(/^Wed Nov 4 · 3 of 4/);
    expect(moments).toHaveProperty('value', DATES[2]);
    // Another moment, earlier than the slider's: it moves back.
    await user.selectOptions(moments, '1. Entry · Mon Nov 2');
    expect(screen.getByRole('slider', { name: 'Session' }).getAttribute('aria-valuetext')).toMatch(/^Mon Nov 2 · 1 of 4/);
  });
});

describe('Replay: away from a key moment (T95.57, W148)', () => {
  it('should say No key moment this session. away from one', () => {
    show(momentView(), DATES[1]);
    expect(screen.getByText('No key moment this session.')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Key moments' })).toHaveProperty('value', '');
    cleanup();
    show(momentView(), DATES[2]);
    expect(screen.queryByText('No key moment this session.')).toBeNull();
    cleanup();
    // A view that lists no moments has no drop-down and nothing to say about them.
    show(openView(DATES.map((date) => day(date))), DATES[1]);
    expect(screen.queryByRole('combobox', { name: 'Key moments' })).toBeNull();
    expect(screen.queryByText('No key moment this session.')).toBeNull();
  });
});

describe('Replay: the Action row (T95.57, W149)', () => {
  it('should mark each session Action in a row under the chart, with its key', () => {
    const sessions = [day(DATES[0]!, { action: { action: 'Hold', intent: 'Wait.' } }), day(DATES[1]!), day(DATES[2]!, { action: { action: 'Exit' } }), day(DATES[3]!)];
    show(openView(sessions), DATES[3]);
    const row = within(screen.getByRole('list', { name: 'Action by session' }));
    expect(row.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['HMon Nov 2: Hold', '–Tue Nov 3: No Review', 'EWed Nov 4: Exit']);
    expect(screen.getByText('H Hold · E Exit · R Roll · A Adjust · – no Review')).toBeTruthy();
    cleanup();
    // P118: a session after the slider's is not in the page, so neither is its Action.
    show(openView(sessions), DATES[1]);
    expect(within(screen.getByRole('list', { name: 'Action by session' })).getAllByRole('listitem').map((li) => li.textContent?.[0])).toEqual(['H', '–']);
  });
});

// T95.57-B1: the chart puts a session by its weekday slot, so a holiday leaves one slot blank (A256); the Action row follows the same columns (the Plan's column first).
describe('Replay: the Action row after a holiday gap (T95.57-B1)', () => {
  const GAP = ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06'];
  const columns = () => within(screen.getByRole('list', { name: 'Action by session' })).getAllByRole('listitem').map((li) => [li.textContent?.[0], li.style.gridColumn]);
  const gapView = () => openView(GAP.map((date) => day(date, { action: { action: 'Hold' } })));

  it('should place each session Action mark in its session slot column after a holiday gap', () => {
    show(gapView(), GAP[3]);
    expect(columns()).toEqual([['H', '2'], ['H', '3'], ['H', '5'], ['H', '6']]);
  });

  it('should leave the holiday column empty', () => {
    show(gapView(), GAP[3]);
    expect(columns().map(([, column]) => column)).not.toContain('4');
  });
});

describe('Replay: What you did that day (T95.57, W147)', () => {
  // Added beyond the planned cases (advisor review): a contract due for settlement owes no Action (A315), so its last session is no missed Review.
  it('should not call the last session of a contract due for settlement a missed Review', () => {
    const due = { ...openView([day(DATES[0]!, { markers: [buy] }), day(DATES[1]!)]), pending: null };
    show(due, DATES[1]);
    expect(said()).not.toContain('No Review this session.');
    expect(screen.queryByRole('list', { name: 'Action by session' })?.textContent).not.toContain('Tue Nov 3: No Review');
    cleanup();
    // The session before it still owed one.
    show({ ...due, sessions: [day(DATES[0]!), day(DATES[1]!), day(DATES[2]!)] }, DATES[1]);
    expect(said()).toContain('No Review this session.');
  });

  // Added beyond the planned cases: W147's other two sentences.
  it('should say Nothing recorded. on a session with no fill and no Review owed', () => {
    show(openView([day(DATES[0]!, { markers: [buy] }), day(DATES[1]!, {}, 0), day(DATES[2]!)]), DATES[1]);
    expect(said()).toContain('Nothing recorded.');
  });

  it('should say Expired and what was chosen on a session whose Action is a Settle Later', () => {
    const settle = (held: number) => openView([day(DATES[0]!, { markers: [buy] }), day(DATES[1]!, { action: { action: 'Settle Later' } }, held)]);
    show(settle(4), DATES[1]);
    expect(said()).toContain('Expired. You chose Exercised: record later.');
    cleanup();
    show(settle(-4), DATES[1]);
    expect(said()).toContain('Expired. You chose Assigned: record later.');
    expect(said()).not.toContain('Settle Later');
  });

  it('should say no reason given, No Review this session. or Action: not chosen yet. as the case is', () => {
    const sessions = [day(DATES[0]!, { action: { action: 'Hold' } }), day(DATES[1]!), day(DATES[2]!, { markers: [sell] }, 0), day(DATES[3]!)];
    const open = openView(sessions);
    show(open, DATES[0]);
    expect(said()).toContain('Action: Hold · no reason given');
    cleanup();
    // A session that held a Position and has no Action owed a Review.
    show(open, DATES[1]);
    expect(said()).toContain('No Review this session.');
    cleanup();
    // A session that sold the Position out owed none.
    show(open, DATES[2]);
    expect(said()).not.toContain('No Review this session.');
    cleanup();
    // The newest session of an Open Trade: its Review is still to come.
    show(open, DATES[3]);
    expect(said()).toContain('Action: not chosen yet.');
    cleanup();
    // The same newest session with nothing to come (a contract due for settlement owes no Action, A315): no Review missed, none to come.
    show({ ...open, pending: null }, DATES[3]);
    expect(said()).not.toContain('No Review this session.');
    expect(said()).not.toContain('not chosen yet');
  });

  it('should show What you did that day with the fills, the Action and its reason', () => {
    show(openView([day(DATES[0]!, { markers: [buy], action: { action: 'Hold', intent: 'Oversold. Bounce due.' } }), day(DATES[1]!)]), DATES[0]);
    const that = thatDay();
    expect(within(that).getByRole('heading', { name: 'What you did that day' })).toBeTruthy();
    expect(said()).toContain('Bought 4 at $1.61.');
    expect(said()).toContain('Action: Hold · “Oversold. Bounce due.”');
  });
});
