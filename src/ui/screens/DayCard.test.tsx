// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarkRow, OpenDailyReviewResult, ReviewCompletion, WalkedTrade } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { cardProgress, reflectionsOwedProgress } from '../../../tests/support/card-progress.ts';
import { DayCard } from './DayCard.tsx';

afterEach(cleanup);

type Ready = Extract<OpenDailyReviewResult, { kind: 'Ready' }>;
type DaySummary = NonNullable<Ready['day']>;

const binding = { workspace: { databaseName: 'tj-ws-1', contentRevision: 3 }, catalogRevision: 1, journalRevision: 1, marketDataSnapshotId: 'mds1:1:abc', factRevisions: {}, outstandingDebts: {} };
const walked = (tradeId: string, underlying: string, over: Partial<WalkedTrade> = {}): WalkedTrade => ({
  tradeId,
  underlying,
  lastActivity: '2026-11-16T14:00:00Z',
  band: 'Routine',
  reasons: [{ code: 'NoPressure' }],
  basis: { kind: 'Value', value: { side: 'None', share: Rational.of(0n, 1n) } },
  progress: cardProgress(),
  ...over,
});
const day = (over: Partial<DaySummary> = {}): DaySummary => ({
  trades: 4,
  toGo: { marks: 7, actions: 4, expirations: 0, closeReviews: 0, reflections: 0 },
  change: { kind: 'Unavailable' },
  missed: [],
  lines: [],
  ...over,
});
const missingRow = (instrumentKey: string, trades: readonly string[]): MarkRow => ({ instrumentKey, instrument: { kind: 'Stock', symbol: instrumentKey }, tradingDate: '2026-11-16', trades, resolution: { kind: 'Missing' }, resolutionRevision: 'None', task: 'Manual' });
const gapOf = (instrumentKey: string, tradeId: string): Extract<Ready['families'][number], { family: 'Marks' }>['earlier'][number] => ({ instrumentKey, instrument: { kind: 'Stock', symbol: instrumentKey }, trades: [{ tradeId, from: '2026-11-13' }], missing: ['2026-11-18'], acknowledged: [], revisions: {}, acknowledgments: {}, blocking: false });
function review(over: { day?: DaySummary; trades?: readonly WalkedTrade[]; completion?: ReviewCompletion; today?: readonly MarkRow[]; owed?: Ready['owed']; earlier?: Extract<Ready['families'][number], { family: 'Marks' }>['earlier'] } = {}): Ready {
  return {
    kind: 'Ready',
    reviewDate: '2026-11-16',
    cutoff: '2026-11-16T21:00:00Z',
    families: [
      { family: 'Marks', earlierMarks: [], today: over.today ?? [], earlier: over.earlier ?? [] },
      { family: 'Trades', trades: over.trades ?? [walked('t1', 'AXIO'), walked('t2', 'DALE'), walked('t3', 'CORV'), walked('t4', 'BREN')] },
    ],
    owed: over.owed ?? [],
    completion: over.completion ?? { kind: 'Incomplete', reasons: [] },
    day: over.day ?? day(),
    binding,
  };
}
function renderCard(ready: Ready, openCard = vi.fn()) {
  render(
    <RuntimeContext.Provider value={{ writable: true, report: () => undefined }}>
      <MemoryRouter>
        <DayCard review={ready} name={(id) => id} openCard={openCard} />
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
  return openCard;
}

const stepItems = () => within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');
const steps = () => stepItems().map((item) => item.textContent);
const inHand = () => stepItems().filter((item) => item.getAttribute('aria-current') === 'step').map((item) => item.textContent);

describe('the day card', () => {
  it('should show the three steps, marking the one in hand and each one done', () => {
    renderCard(review());
    expect(steps()).toEqual(['1 Marks', '2 Trades', '3 The day']);
    expect(inHand()).toEqual(['1 Marks']);
    cleanup();

    renderCard(review({ day: day({ toGo: { marks: 0, actions: 2, expirations: 0, closeReviews: 0, reflections: 0 } }) }));
    expect(steps()).toEqual(['1 Marks done', '2 Trades', '3 The day']);
    expect(inHand()).toEqual(['2 Trades']);
    cleanup();

    renderCard(review({ completion: { kind: 'Complete' }, day: day({ toGo: { marks: 0, actions: 0, expirations: 0, closeReviews: 0, reflections: 0 } }) }));
    expect(steps()).toEqual(['1 Marks done', '2 Trades done', '3 The day done']);
    expect(inHand()).toEqual([]);
  });

  it('should show one button for the next thing: Enter the Marks, then Next: AXIO', () => {
    const lines: DaySummary['lines'] = [
      { tradeId: 't1', marks: 0, closeReview: false, needs: ['Action'] },
      { tradeId: 't2', marks: 0, closeReview: false, needs: ['Action'] },
    ];
    renderCard(review({ day: day({ lines: [{ ...lines[0]!, marks: 2, needs: ['Marks', 'Action'] }, lines[1]!] }) }));
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Enter the Marks']);
    cleanup();

    renderCard(review({ day: day({ toGo: { marks: 0, actions: 2, expirations: 0, closeReviews: 0, reflections: 0 }, lines }) }));
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Next: AXIO']);
    cleanup();

    const closed = review({ day: day({ toGo: { marks: 0, actions: 0, expirations: 0, closeReviews: 1, reflections: 0 }, lines: [{ tradeId: 't4', marks: 0, closeReview: true, needs: ['Reflection'] }] }) });
    renderCard(closed);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(["Next: BREN's Close Review"]);
    cleanup();

    renderCard(review({ completion: { kind: 'Complete' }, day: day({ toGo: { marks: 0, actions: 0, expirations: 0, closeReviews: 0, reflections: 0 }, lines: [{ tradeId: 't1', marks: 0, closeReview: false, needs: [] }] }) }));
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('should open the Marks step on the first missing Mark, or the named Trade, when the button is pressed', async () => {
    const user = userEvent.setup();
    const lines: DaySummary['lines'] = [
      { tradeId: 't1', marks: 1, closeReview: false, needs: ['Marks', 'Action'] },
      { tradeId: 't2', marks: 0, closeReview: false, needs: ['Action'] },
    ];
    const openCard = renderCard(review({ today: [missingRow('AXIO', ['t1'])], day: day({ lines }) }));
    await user.click(screen.getByRole('button', { name: 'Enter the Marks' }));
    expect(openCard).toHaveBeenCalledExactlyOnceWith('t1', 'Marks', 'AXIO');
    cleanup();

    const next = renderCard(review({ day: day({ toGo: { marks: 0, actions: 1, expirations: 0, closeReviews: 0, reflections: 0 }, lines: [lines[1]!] }) }));
    await user.click(screen.getByRole('button', { name: 'Next: DALE' }));
    expect(next).toHaveBeenCalledExactlyOnceWith('t2', 'Action', undefined);
  });

  it('should list each Trade with its label and what it still needs, as a link that opens its card', async () => {
    const user = userEvent.setup();
    const lines: DaySummary['lines'] = [
      { tradeId: 't1', marks: 2, closeReview: false, needs: ['Marks', 'Action'] },
      { tradeId: 't2', marks: 0, closeReview: false, needs: ['Settlement'] },
      { tradeId: 't3', marks: 0, closeReview: false, needs: [] },
      { tradeId: 't9', marks: 0, closeReview: true, needs: ['Reflection'] },
    ];
    const closed: Ready['owed'] = [{ tradeId: 't9', underlying: 'EARL', lifecycle: 'Closed', owed: [], progress: reflectionsOwedProgress(1) }];
    const trades = [walked('t1', 'AXIO', { band: 'StopReached' }), walked('t2', 'DALE'), walked('t3', 'CORV', { band: 'TargetReached' })];
    const openCard = renderCard(review({ trades, owed: closed, today: [missingRow('AXIO', ['t1'])], day: day({ lines }) }));

    const items = within(screen.getByRole('list', { name: 'Trade lines' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['AXIO Past Stop To do: 2 Marks, Action', 'DALE To do: Settle', 'CORV At Target Done', 'EARL Closed To do: Close Review']);
    expect(within(items[0]!).getByRole('link', { name: 'AXIO' }).getAttribute('href')).toBe('/review?trade=t1&instrument=AXIO');
    expect(within(items[1]!).getByRole('link', { name: 'DALE' }).getAttribute('href')).toBe('/review?trade=t2&panel=Settlement');
    await user.click(within(items[3]!).getByRole('link', { name: 'EARL' }));
    expect(openCard).toHaveBeenCalledExactlyOnceWith('t9', 'Reflections', undefined);
  });

  it('should describe each day line link by its labels own reasons without adding them to the line text', () => {
    const lines: DaySummary['lines'] = [
      { tradeId: 't1', marks: 0, closeReview: false, needs: ['Action'] },
      { tradeId: 't2', marks: 0, closeReview: false, needs: [] },
    ];
    const trades = [walked('t1', 'AXIO', { band: 'StopReached', reasons: [{ code: 'StopBreached', conditionId: 'c1', overrun: Rational.of(1n, 1n) }] }), walked('t2', 'DALE')];
    renderCard(review({ trades, day: day({ lines }) }));

    const items = within(screen.getByRole('list', { name: 'Trade lines' })).getAllByRole('listitem');
    // A link's description comes from its own aria-describedby, in elements outside the line.
    const described = (link: HTMLElement) => (link.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean).map((id) => document.getElementById(id)?.textContent).join(' ');
    expect(described(within(items[0]!).getByRole('link', { name: 'AXIO' }))).toBe('Stop breached');
    expect(described(within(items[1]!).getByRole('link', { name: 'DALE' }))).toBe('');
    expect(items.map((item) => item.textContent)).toEqual(['AXIO Past Stop To do: Action', 'DALE Done']);
  });

  it('should show Day so far once the Marks are saved', () => {
    renderCard(review({ day: day({ toGo: { marks: 0, actions: 4, expirations: 0, closeReviews: 0, reflections: 0 }, change: { kind: 'Value', dollars: Rational.of(-74n, 1n) } }) }));
    expect(screen.getByText('Day so far: −$74.00')).toBeTruthy();
    cleanup();

    renderCard(review({ day: day({ toGo: { marks: 0, actions: 4, expirations: 0, closeReviews: 0, reflections: 0 }, change: { kind: 'Value', dollars: Rational.of(1250n, 1n) } }) }));
    expect(screen.getByText('Day so far: +$1,250.00')).toBeTruthy();
    cleanup();

    // Until the Marks are in, the change cannot be worked out and nothing is shown.
    renderCard(review());
    expect(screen.queryByText(/Day so far/)).toBeNull();
  });

  it('should name the sessions with no Review and offer to add their Marks', async () => {
    const user = userEvent.setup();
    const missed = day({ missed: ['2026-11-18', '2026-11-19'] });
    const openCard = renderCard(review({ day: missed, earlier: [gapOf('DALE', 't2')] }));

    expect(screen.getByText(/^No Review for/).closest('p')?.textContent).toBe('No Review for Wed Nov 18, Thu Nov 19. Their Marks are optional. Add them');
    await user.click(screen.getByRole('button', { name: 'Add them' }));
    expect(openCard).toHaveBeenCalledExactlyOnceWith('t2', 'Marks', 'DALE');
    cleanup();

    // Nothing to add where no Instrument has a gap, and nothing said where no session was skipped.
    renderCard(review({ day: missed }));
    expect(screen.queryByRole('button', { name: 'Add them' })).toBeNull();
    cleanup();
    renderCard(review());
    expect(screen.queryByText(/No Review for/)).toBeNull();
  });

  it('should head the page with the Review Date and the counts still to go', () => {
    renderCard(review());

    expect(screen.getByText('Mon Nov 16')).toBeTruthy();
    expect(screen.getByText('4 Trades · 7 Marks and 4 Actions to go')).toBeTruthy();
    // Each count that is still to go, in the order the card works through them.
    cleanup();
    renderCard(review({ day: day({ trades: 2, toGo: { marks: 4, actions: 0, expirations: 2, closeReviews: 0, reflections: 0 } }) }));
    expect(screen.getByText('2 Trades · 4 Marks and 2 expirations to settle to go')).toBeTruthy();
    cleanup();
    renderCard(review({ day: day({ trades: 3, toGo: { marks: 0, actions: 0, expirations: 0, closeReviews: 1, reflections: 0 } }) }));
    expect(screen.getByText('3 Trades · 1 Close Review to go')).toBeTruthy();
  });
});
