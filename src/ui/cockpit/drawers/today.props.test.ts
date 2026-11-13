// @vitest-environment jsdom
// The Today drawer through its public seam: `TodayDrawer` takes the Detail view, the zone and an optional replay, and `today.props` adapts them
// (A216: only this file and the adapter may import the view types). The replay is a double built here, since `replayTrade` arrives in T8P.22.
import { cleanup, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { execution, openDetailAt, PC1, positionChange } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OS2_S1 } from '../../../../tests/support/option-trade-fixtures.ts';
import type { OpenTradeDetail } from '../../../app/types.ts';
import type { Instrument } from '../../../domain/instrument/index.ts';
import { parseDecimal, Rational } from '../../../domain/values/index.ts';
import type { TodayReplay } from './today.props.ts';
import { TodayDrawer } from './today.tsx';

afterEach(cleanup);

// The replay as the drawer reads it: the double has the fields of `TradeReplayView` that `TodayReplay` names, and no others.
type ReplayMark = TodayReplay['sessions'][number]['marks'][number];
type ReplaySession = TodayReplay['sessions'][number];

const ZONE = 'America/New_York';
const PUT: Instrument = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-12-18', strike: '45', right: 'Put', multiplier: 100 };
const MNO: Instrument = { kind: 'Stock', symbol: 'MNO' };

const rational = (text: string): Rational => {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`bad decimal ${text}`);
  return parsed.value;
};

// A replayed Mark: its price (or a gap), and the change since the Instrument's previous Mark.
const mark = (instrument: Instrument, price: string | undefined, change?: { since: string; amount: string }, correctionReason?: string): ReplayMark => ({
  instrument,
  resolution:
    price === undefined
      ? { kind: 'Missing' }
      : { kind: 'Available', mark: { price, source: 'Manual', savedAt: '2026-10-15T20:30:00Z', ...(correctionReason && { correctionReason }) } },
  change: change ? { since: change.since, dollars: rational(change.amount) } : null,
});

const session = (date: string, marks: readonly ReplayMark[]): ReplaySession => ({ date, marks });

const replayOf = (sessions: readonly ReplaySession[]): TodayReplay => ({ instruments: [MNO, PUT], sessions });

// O-S2 (MNO's Cash-Secured Put) valued at the Thu Oct 15 Marks: put $3.20, MNO 43.00.
const thursday = (): OpenTradeDetail =>
  optionOpenDetail('O-S2', [OS2_S1], { tradingDate: '2026-10-15', closeInstant: '2026-10-15T20:00:00Z', contractMark: '3.20', underlyingMark: '43.00' });

// Wed Oct 14 and Thu Oct 15 with Marks: the put at $3.10 then $3.20, MNO at 42.50 then 43.00.
const wednesdayAndThursday = (): TodayReplay =>
  replayOf([
    session('2026-10-14', [mark(MNO, '42.50'), mark(PUT, '3.10')]),
    session('2026-10-15', [mark(MNO, '43.00', { since: '2026-10-14', amount: '0.50' }), mark(PUT, '3.20', { since: '2026-10-14', amount: '0.10' })]),
  ]);

// The text of the definition following a term, within one element.
const termValue = (scope: HTMLElement, term: string) => within(scope).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;

const parts = (track: HTMLElement, selector: string) => [...track.querySelectorAll<HTMLElement>(selector)];
// Where a zone ends, in percent of the track: its left edge plus its width.
const edge = (zone: HTMLElement) => Math.round(Number.parseFloat(zone.style.left) + Number.parseFloat(zone.style.width));

const drawer = (view: OpenTradeDetail, replay?: TodayReplay) => render(createElement(TodayDrawer, { view, timeZone: ZONE, ...(replay && { replay }) }));

describe('Today drawer (W8)', () => {
  it('should show "Marks: Thu Oct 15 against Wed Oct 14" with each Mark, its change and its provenance, Corrected with its reason', () => {
    drawer(
      thursday(),
      replayOf([
        session('2026-10-14', [mark(MNO, '42.50'), mark(PUT, '3.10')]),
        session('2026-10-15', [mark(MNO, '43.00', { since: '2026-10-14', amount: '0.50' }), mark(PUT, '3.20', { since: '2026-10-14', amount: '0.10' }, 'Typo in the first entry')]),
      ]),
    );
    expect(screen.getByRole('heading', { name: 'Marks: Thu Oct 15 against Wed Oct 14' })).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Marks: Thu Oct 15 against Wed Oct 14' });
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Wed Oct 14', 'Thu Oct 15', 'Change']);
    const [first, second] = within(table).getAllByRole('row').slice(1);
    expect(within(first!).getByRole('rowheader').textContent).toBe('MNO Mark');
    expect(within(first!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['42.50Manual · 2026-10-15 16:30', '43.00Manual · 2026-10-15 16:30', '+0.50']);
    expect(within(second!).getByRole('rowheader').textContent).toBe('Put Mark');
    expect(within(second!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['$3.10Manual · 2026-10-15 16:30', '$3.20Manual · 2026-10-15 16:30Corrected Typo in the first entry', '+$0.10']);
  });

  it('should compare with the latest earlier session with Marks, and name the session that had none', () => {
    drawer(
      thursday(),
      replayOf([
        session('2026-10-13', [mark(MNO, '42.00'), mark(PUT, '3.00')]),
        session('2026-10-14', [mark(MNO, undefined), mark(PUT, undefined)]),
        session('2026-10-15', [mark(MNO, '43.00', { since: '2026-10-13', amount: '1.00' }), mark(PUT, '3.20', { since: '2026-10-13', amount: '0.20' })]),
      ]),
    );
    const table = screen.getByRole('table', { name: 'Marks: Thu Oct 15 against Tue Oct 13' });
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Tue Oct 13', 'Thu Oct 15', 'Change']);
    expect(within(within(table).getAllByRole('row')[1]!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['42.00Manual · 2026-10-15 16:30', '43.00Manual · 2026-10-15 16:30', '+1.00']);
    expect(screen.getByText('Wed Oct 14 has no Marks, so Thu Oct 15 is compared with Tue Oct 13.')).toBeTruthy();
  });

  it("should place each price track's Stop and Target zones, entry, the earlier Mark and now, with an accessible name listing the prices", () => {
    drawer(thursday(), wednesdayAndThursday());
    expect(screen.getByRole('heading', { name: 'Where the prices sit' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Option price' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'MNO' })).toBeTruthy();

    // The Cash-Secured Put's option price: a Stop above 3.60 and a Target below 0.30.
    const option = screen.getByRole('img', { name: 'Option price: Stop $3.60, Target $0.30, now $3.20' });
    const [optionStop, optionTarget] = parts(option, '.zone');
    expect([optionStop!.dataset['role'], optionTarget!.dataset['role']]).toEqual(['Stop', 'Target']);
    expect(edge(optionStop!)).toBe(100);
    expect(Number.parseFloat(optionStop!.style.left)).toBeGreaterThan(0);
    expect(optionTarget!.style.left).toBe('0%');
    expect(edge(optionTarget!)).toBeLessThan(100);
    expect(parts(option, '.mk').map((marker) => [marker.dataset['kind'], marker.textContent])).toEqual([
      ['entry', 'entry'],
      ['earlier', 'Wed Oct 14'],
      ['now', 'now'],
    ]);
    const at = (kind: string) => Number.parseFloat(parts(option, '.mk').find((marker) => marker.dataset['kind'] === kind)!.style.left);
    expect(at('entry')).toBeLessThan(at('earlier'));
    expect(at('earlier')).toBeLessThan(at('now'));

    // MNO's Underlying price: a Stop at or below 41.00 and a Target at or above 44.50, with no entry on an Underlying.
    const underlying = screen.getByRole('img', { name: 'MNO: Stop 41.00, Target 44.50, now 43.00' });
    const [underlyingStop, underlyingTarget] = parts(underlying, '.zone');
    expect([underlyingStop!.dataset['role'], underlyingTarget!.dataset['role']]).toEqual(['Stop', 'Target']);
    expect(underlyingStop!.style.left).toBe('0%');
    expect(edge(underlyingStop!)).toBeLessThan(edge(underlyingTarget!));
    expect(edge(underlyingTarget!)).toBe(100);
    expect(Number.parseFloat(underlyingTarget!.style.left)).toBeGreaterThan(edge(underlyingStop!));
    expect(parts(underlying, '.mk').map((marker) => marker.dataset['kind'])).toEqual(['earlier', 'now']);
  });

  it('should show "No Marks yet." before any Marks', () => {
    // 40 shares bought Friday 4:30 pm New York, after Friday's close: the first Marks arrive with Monday's session, which Trade Views states
    // (revision 90). The opening is the opening Position Change's, so its date is not the session's.
    const afterClose = positionChange('pc-9', 3, [execution('ex-9', '2026-10-09T20:30:00Z', 4, '40', '50.30', '1.00')]);
    const friday = { instrumentKey: 'XYZ', tradingDate: '2026-10-09', closeInstant: '2026-10-09T20:00:00Z', previousCloseInstant: '2026-10-08T20:00:00Z', resolution: { kind: 'Missing' } } as const;
    const unmarked = openDetailAt([afterClose], friday);
    drawer({ ...unmarked, current: { ...unmarked.current, firstMarksDue: '2026-10-12' } }, replayOf([]));
    expect(screen.getByText('No Marks yet. This Trade opened Fri Oct 9 at 4:30 pm. Its first Marks, and every figure that needs them, are due once the Mon Oct 12 session ends.')).toBeTruthy();
    expect(screen.queryByRole('table', { hidden: true })).toBeNull();
    expect(screen.queryByRole('region', { name: /^At the .* Marks$/, hidden: true })).toBeNull();
    // The tracks still show where the Stop and the Target sit, with no "now".
    expect(screen.getByRole('heading', { name: 'Where the price sits' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /^XYZ: Stop \$.*, Target \$[\d.,]+$/ })).toBeTruthy();
    cleanup();

    // Without the field nothing is inferred from the waiting figures.
    drawer(unmarked, replayOf([]));
    expect(screen.queryByText(/No Marks yet/)).toBeNull();
  });

  it('should show "At the Mon Oct 12 Marks" and At entry in their existing figures', () => {
    // 40 shares bought Monday 17:00 New York, after Monday's Marks; the Mark for Tuesday is not yet in.
    const afterMarks = positionChange('pc-9', 3, [execution('ex-9', '2026-10-12T21:00:00Z', 4, '40', '50.30', '1.00')]);
    const monday = { instrumentKey: 'XYZ', tradingDate: '2026-10-12', closeInstant: '2026-10-12T20:00:00Z', previousCloseInstant: '2026-10-09T20:00:00Z', resolution: { kind: 'Available', mark: { revisionId: 'm-1', revisionNumber: 1, price: '51.20', source: 'Manual', savedAt: '2026-10-12T21:30:00Z' } } } as const;
    drawer(openDetailAt([PC1, afterMarks], monday));

    const dated = screen.getByRole('region', { name: 'At the Mon Oct 12 Marks' });
    expect(screen.queryByRole('region', { name: 'At Mon Oct 12 close', hidden: true })).toBeNull();
    expect(within(dated).getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Mark',
      'Realized to date',
      'Open P&L',
      'Current Marked Trade P&L',
      'Incurred fees',
      'Risk to stop',
      'Worst case',
      'Reward to target',
    ]);
    expect(termValue(dated, 'Mark')).toBe('$51.20');
    expect(termValue(dated, 'Current Marked Trade P&L')).toBe('+$65.00 · +0.26R');

    const atEntry = screen.getByRole('region', { name: 'At entry' });
    expect(within(atEntry).getAllByRole('term').map((term) => term.textContent)).toEqual(['Quantity', 'Average entry', 'Risk from entry', 'Reward from entry']);
    expect(termValue(atEntry, 'Quantity')).toBe('40 shares');
    expect(termValue(atEntry, 'Average entry')).toBe('$50.30');
    expect(termValue(atEntry, 'Risk from entry')).toBe('$112.00 · 0.45R');
    expect(termValue(atEntry, 'Reward from entry')).toBe('$228.00 · 0.91R');
  });

  it("should list each Underlying condition's value at expiration and distance on the Underlying under its track", () => {
    drawer(thursday(), wednesdayAndThursday());
    const lines = screen.getAllByRole('list', { name: 'Conditions' });
    expect(lines).toHaveLength(1);
    const [stop, target] = within(lines[0]!).getAllByRole('listitem');
    expect(within(stop!).getByText('Stop on MNO')).toBeTruthy();
    expect(termValue(stop!, 'Value at expiration')).toBe('$4.00');
    expect(termValue(stop!, 'Distance on MNO')).toBe('2.00');
    expect(within(target!).getByText('Target on MNO')).toBeTruthy();
    expect(termValue(target!, 'Value at expiration')).toBe('$0.50');
    expect(termValue(target!, 'Distance on MNO')).toBe('1.50');
    // The option-price track carries no such lines: its conditions are in the Conditions card.
    expect(within(screen.getByRole('img', { name: /^Option price:/ }).closest('.track-block') as HTMLElement).queryByRole('list', { hidden: true })).toBeNull();
  });
});

describe('Today drawer (W8): gaps and crowding (T8P.16-B)', () => {
  it('should show a change only against the compared session when an Instrument had no Mark then', () => {
    // Both Instruments marked Tuesday, only MNO on Wednesday, both on Thursday: the put's change on Thursday is since Tuesday.
    drawer(
      thursday(),
      replayOf([
        session('2026-10-13', [mark(MNO, '42.00'), mark(PUT, '3.00')]),
        session('2026-10-14', [mark(MNO, '42.50'), mark(PUT, undefined)]),
        session('2026-10-15', [mark(MNO, '43.00', { since: '2026-10-14', amount: '0.50' }), mark(PUT, '3.20', { since: '2026-10-13', amount: '0.20' })]),
      ]),
    );
    const table = screen.getByRole('table', { name: 'Marks: Thu Oct 15 against Wed Oct 14' });
    const [mnoRow, putRow] = within(table).getAllByRole('row').slice(1);
    expect(within(mnoRow!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['42.50Manual · 2026-10-15 16:30', '43.00Manual · 2026-10-15 16:30', '+0.50']);
    expect(within(putRow!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['—', '$3.20Manual · 2026-10-15 16:30', '—']);
    expect(screen.queryByText('+$0.20')).toBeNull();
  });

  it('should draw no Underlying track when nothing can be placed on it', () => {
    // An option Plan whose conditions are all option prices, with no Underlying Mark and no earlier session to take one from.
    const view = thursday();
    const current = { ...view.current, underlyingMark: undefined };
    delete current.underlyingMark;
    const optionPricesOnly = { ...view, current: { ...current, evaluation: { ...current.evaluation, conditions: current.evaluation.conditions.filter((c) => c.kind === 'StructureValue') } } };
    drawer(optionPricesOnly);
    expect(screen.getByRole('img', { name: 'Option price: Stop $3.60, Target $0.30, now $3.20' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'MNO', hidden: true })).toBeNull();
    expect(document.querySelectorAll('.track-block')).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/Infinity|NaN|MNO: /);
  });

  it('should keep the entry and now labels apart when the Mark is at the entry', () => {
    // The put's Mark is $1.25, the average entry of O-S2's Sell at 1.25: both markers sit at one place on the track.
    drawer(optionOpenDetail('O-S2', [OS2_S1], { tradingDate: '2026-10-15', closeInstant: '2026-10-15T20:00:00Z', contractMark: '1.25', underlyingMark: '43.00' }));
    const track = screen.getByRole('img', { name: /^Option price:/ });
    const lane = (kind: string) => track.querySelector<HTMLElement>(`.mk[data-kind="${kind}"] .lab`)!.dataset['lane'];
    expect(track.querySelector<HTMLElement>('.mk[data-kind="entry"]')!.style.left).toBe(track.querySelector<HTMLElement>('.mk[data-kind="now"]')!.style.left);
    expect(lane('entry')).toBeTruthy();
    expect(lane('now')).toBeTruthy();
    expect(lane('entry')).not.toBe(lane('now'));
  });
});
