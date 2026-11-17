// @vitest-environment jsdom
// The Today drawer through its public seam: `TodayDrawer` takes the Detail view, the zone and an optional replay, and `today.props` adapts them
// (A216: only this file and the adapter may import the view types). The replay is a double built here, since `replayTrade` arrives in T8P.22.
import { cleanup, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { execution, openDetailAt, PC1, PC2, positionChange } from '../../../../tests/support/open-detail-fixtures.ts';
import { optionClosedDetail, optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_CONTRACT, OC_PC1, OC_PC2, OC_X1, ocChange, OS_CONTRACT, OS_ES, OS_S1, OS2_S1 } from '../../../../tests/support/option-trade-fixtures.ts';import type { OpenTradeDetail } from '../../../app/types.ts';
import type { Instrument } from '../../../domain/instrument/index.ts';
import { parseDecimal, Rational } from '../../../domain/values/index.ts';
import { THURSDAY, tuesday } from '../../screens/trade-detail/test-support.ts';
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
const thursday = (): OpenTradeDetail => ({
  ...optionOpenDetail('O-S2', [OS2_S1], { tradingDate: '2026-10-15', closeInstant: '2026-10-15T20:00:00Z', contractMark: '3.20', underlyingMark: '43.00' }),
  openAverage: rational('1.25'),
});

// Wed Oct 14 and Thu Oct 15 with Marks: the put at $3.10 then $3.20, MNO at 42.50 then 43.00.
const wednesdayAndThursday = (): TodayReplay =>
  replayOf([
    session('2026-10-14', [mark(MNO, '42.50'), mark(PUT, '3.10')]),
    session('2026-10-15', [mark(MNO, '43.00', { since: '2026-10-14', amount: '0.50' }), mark(PUT, '3.20', { since: '2026-10-14', amount: '0.10' })]),
  ]);

const parts = (track: HTMLElement, selector: string) => [...track.querySelectorAll<HTMLElement>(selector)];
// Where a zone ends, in percent of the track: its left edge plus its width.
const edge = (zone: HTMLElement) => Math.round(Number.parseFloat(zone.style.left) + Number.parseFloat(zone.style.width));

// In a router, since a missing Mark's line links to the Review (T8P.31, revision 96).
const drawer = (view: OpenTradeDetail, replay?: TodayReplay) =>
  render(createElement(MemoryRouter, null, createElement(TodayDrawer, { view, timeZone: ZONE, ...(replay && { replay }) })));

describe('Today drawer (W8)', () => {
  // The Marks table's cases are in "Today drawer: the Marks table (W29)", below; each Mark's provenance is Price History's (T8R.4).
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
    // The table stands with a dash in every cell (W29); the view names no column dates here, so its headings carry none (A232).
    expect([...screen.getByRole('table').querySelectorAll('tbody td')].map((cell) => cell.textContent)).toEqual(['—', '—', '—', '—', '—', '—']);
    expect(screen.queryByRole('region', { name: /^At the .* Marks$/, hidden: true })).toBeNull();
    // The tracks still show where the Stop and the Target sit, with no "now".
    expect(screen.getByRole('heading', { name: 'Where the price sits' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /^XYZ: Stop \$.*, Target \$[\d.,]+$/ })).toBeTruthy();
    cleanup();

    // Without the field nothing is inferred from the waiting figures.
    drawer(unmarked, replayOf([]));
    expect(screen.queryByText(/No Marks yet/)).toBeNull();
  });
});

describe('Today drawer (W8): gaps and crowding (T8P.16-B)', () => {
  it('should show a change only against the compared session when an Instrument had no Mark then', () => {
    // Both Instruments marked Tuesday, only MNO on Wednesday, both on Thursday: the put's change on Thursday is since Tuesday.
    drawer(
      { ...thursday(), marksColumns: { today: { date: '2026-10-15', next: false }, yesterday: '2026-10-14' } },
      replayOf([
        session('2026-10-13', [mark(MNO, '42.00'), mark(PUT, '3.00')]),
        session('2026-10-14', [mark(MNO, '42.50'), mark(PUT, undefined)]),
        session('2026-10-15', [mark(MNO, '43.00', { since: '2026-10-14', amount: '0.50' }), mark(PUT, '3.20', { since: '2026-10-13', amount: '0.20' })]),
      ]),
    );
    const table = screen.getByRole('table', { name: 'Marks' });
    const [mnoRow, putRow] = within(table).getAllByRole('row').slice(1);
    expect(within(mnoRow!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['43.00', '42.50', '+0.50']);
    expect(within(putRow!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['$3.20', '—', '—']);
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
    drawer({ ...optionOpenDetail('O-S2', [OS2_S1], { tradingDate: '2026-10-15', closeInstant: '2026-10-15T20:00:00Z', contractMark: '1.25', underlyingMark: '43.00' }), openAverage: rational('1.25') });
    const track = screen.getByRole('img', { name: /^Option price:/ });
    const lane = (kind: string) => track.querySelector<HTMLElement>(`.mk[data-kind="${kind}"] .lab`)!.dataset['lane'];
    expect(track.querySelector<HTMLElement>('.mk[data-kind="entry"]')!.style.left).toBe(track.querySelector<HTMLElement>('.mk[data-kind="now"]')!.style.left);
    expect(lane('entry')).toBeTruthy();
    expect(lane('now')).toBeTruthy();
    expect(lane('entry')).not.toBe(lane('now'));
  });
});

// Figures the retired Valuation section and conditions table gave, moved here with their expected values (T8P.27, revision 86).
// O-C3 (XYZ's Long Call): the replay's Instruments are the Underlying then the contract, and the view names the table's column dates (A232).
describe('Today drawer: the Marks table (W29)', () => {
  const XYZ: Instrument = { kind: 'Stock', symbol: 'XYZ' };
  const CALL = OC_CONTRACT;
  const openAt = (tradingDate: string, closeInstant: string, contractMark?: string, underlyingMark?: string): OpenTradeDetail =>
    optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], { tradingDate, closeInstant, ...(contractMark && { contractMark }), ...(underlyingMark && { underlyingMark }) });
  const withColumns = (view: OpenTradeDetail, date: string, yesterday: string, next = false): OpenTradeDetail => ({ ...view, marksColumns: { today: { date, next }, yesterday } });
  // One session of both Instruments' Marks; `since` is the session each change is against.
  const sessionOf = (date: string, xyz: string | undefined, call: string | undefined, since?: string): ReplaySession =>
    session(date, [
      mark(XYZ, xyz, since && xyz ? { since, amount: '0.50' } : undefined),
      mark(CALL, call, since && call ? { since, amount: '0.20' } : undefined),
    ]);
  const replayOfOc = (sessions: readonly ReplaySession[]): TodayReplay => ({ instruments: [XYZ, CALL], sessions });
  const tableCells = () => {
    const table = screen.getByRole('table');
    return {
      headings: within(table).getAllByRole('columnheader').map((cell) => cell.textContent),
      rows: within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => [within(row).getByRole('rowheader').textContent, ...within(row).getAllByRole('cell').map((cell) => cell.textContent)]),
    };
  };

  it("should show Today, Thu Oct 15 and Yesterday, Wed Oct 14 and Change with each Instrument's Mark and change at Thu 18:00", () => {
    drawer(
      withColumns(openAt('2026-10-15', '2026-10-15T20:00:00Z', '3.10', '52.30'), '2026-10-15', '2026-10-14'),
      replayOfOc([sessionOf('2026-10-14', '51.80', '2.90'), sessionOf('2026-10-15', '52.30', '3.10', '2026-10-14')]),
    );
    expect(tableCells()).toEqual({
      headings: ['Today, Thu Oct 15', 'Yesterday, Wed Oct 14', 'Change'],
      rows: [
        ['XYZ Mark', '52.30', '51.80', '+0.50'],
        ['Call Mark', '$3.10', '$2.90', '+$0.20'],
      ],
    });
  });

  it("should show a dash in every Today cell and in Change while the session hasn't ended, at Fri 12:00", () => {
    drawer(
      withColumns(openAt('2026-10-16', '2026-10-16T20:00:00Z'), '2026-10-16', '2026-10-15'),
      replayOfOc([sessionOf('2026-10-14', '51.80', '2.90'), sessionOf('2026-10-15', '52.30', '3.10', '2026-10-14')]),
    );
    expect(tableCells()).toEqual({
      headings: ['Today, Fri Oct 16', 'Yesterday, Thu Oct 15', 'Change'],
      rows: [
        ['XYZ Mark', '—', '52.30', '—'],
        ['Call Mark', '—', '$3.10', '—'],
      ],
    });
  });

  it('should show Next session, Mon Oct 19 and Friday as Yesterday on a Saturday', () => {
    drawer(
      withColumns(openAt('2026-10-16', '2026-10-16T20:00:00Z', '3.40', '53.00'), '2026-10-19', '2026-10-16', true),
      replayOfOc([sessionOf('2026-10-15', '52.30', '3.10'), sessionOf('2026-10-16', '53.00', '3.40', '2026-10-15')]),
    );
    expect(tableCells()).toEqual({
      headings: ['Next session, Mon Oct 19', 'Yesterday, Fri Oct 16', 'Change'],
      rows: [
        ['XYZ Mark', '—', '53.00', '—'],
        ['Call Mark', '—', '$3.40', '—'],
      ],
    });
  });

  it("should show a dash for Yesterday when that session had no Marks, never an earlier session's", () => {
    // Tuesday had Marks, Wednesday had none, Thursday's change is against Tuesday: Wednesday's column and Thursday's Change read a dash.
    drawer(
      withColumns(openAt('2026-10-15', '2026-10-15T20:00:00Z', '3.10', '52.30'), '2026-10-15', '2026-10-14'),
      replayOfOc([sessionOf('2026-10-13', '51.00', '2.80'), sessionOf('2026-10-14', undefined, undefined), sessionOf('2026-10-15', '52.30', '3.10', '2026-10-13')]),
    );
    expect(tableCells().rows).toEqual([
      ['XYZ Mark', '52.30', '—', '—'],
      ['Call Mark', '$3.10', '—', '—'],
    ]);
    expect(document.body.textContent).not.toContain('51.00');
    expect(document.body.textContent).not.toMatch(/has no Marks, so/);
  });

  it('should show dashes in both columns beside the No Marks yet note before the first Marks', () => {
    const unmarked = withColumns(openAt('2026-10-12', '2026-10-12T20:00:00Z'), '2026-10-12', '2026-10-09');
    drawer({ ...unmarked, current: { ...unmarked.current, firstMarksDue: '2026-10-12' } }, replayOfOc([]));
    expect(screen.getByText(/^No Marks yet\./)).toBeTruthy();
    expect(tableCells()).toEqual({
      headings: ['Today, Mon Oct 12', 'Yesterday, Fri Oct 9', 'Change'],
      rows: [
        ['XYZ Mark', '—', '—', '—'],
        ['Call Mark', '—', '—', '—'],
      ],
    });
  });

  it('should show the Stale context and an acknowledgment under the table only when they apply', () => {
    const stale = { tradingDate: '2026-10-14', price: '51.80', revisionId: 'm-0', revisionNumber: 1, closeInstant: '2026-10-14T20:00:00Z' };
    const acknowledgment = { versionId: 'ack-1', kind: 'Asserted', observedAt: '2026-10-15T21:00:00Z', savedAt: '2026-10-15T21:30:00Z' };
    const replay = replayOfOc([sessionOf('2026-10-14', '51.80', '2.90')]);
    const resolved = (resolution: unknown) => {
      const view = withColumns(openAt('2026-10-15', '2026-10-15T20:00:00Z', '3.10', '52.30'), '2026-10-15', '2026-10-14');
      return { ...view, current: { ...view.current, markResolution: resolution } } as OpenTradeDetail;
    };
    const underTable = (text: string) => {
      const note = screen.getByText(text);
      expect(screen.getByRole('table').compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    };
    const view = withColumns(openAt('2026-10-15', '2026-10-15T20:00:00Z'), '2026-10-15', '2026-10-14');
    drawer({ ...view, current: { ...view.current, evaluation: { ...view.current.evaluation, staleContext: stale } } }, replay);
    underTable('Stale context: $51.80 from Wed Oct 14 close (stale, not used in any current figure)');
    cleanup();

    drawer(resolved({ kind: 'AcknowledgedUnavailable', acknowledgment }), replay);
    underTable('Mark acknowledged unavailable for XYZ Nov 20 $55 Call on Thu Oct 15: your acknowledgment, not a price');
    cleanup();

    drawer(resolved({ kind: 'Available', mark: { source: 'Manual', revisionId: 'm', revisionNumber: 1, price: '3.10', savedAt: '2026-10-15T20:30:00Z' } }), replay);
    expect(document.body.textContent).not.toMatch(/Stale context|acknowledged unavailable/);
  });

  it('should not show Expected Mark Date, Source, Saved or a Mark-missing link (gone)', () => {
    const view = withColumns(openAt('2026-10-15', '2026-10-15T20:00:00Z', '3.10', '52.30'), '2026-10-15', '2026-10-14');
    const missing = { ...view, current: { ...view.current, markResolution: { kind: 'Missing' } } } as OpenTradeDetail;
    drawer(missing, replayOfOc([sessionOf('2026-10-14', '51.80', '2.90'), sessionOf('2026-10-15', '52.30', '3.10', '2026-10-14')]));
    for (const term of ['Expected Mark Date', 'Source', 'Saved', 'Mark', 'Underlying Mark']) expect(screen.queryByText(term, { selector: 'dt' }), term).toBeNull();
    expect(document.body.textContent).not.toMatch(/Expected Mark Date|Manual|Saved/);
    expect(screen.queryByRole('link', { hidden: true })).toBeNull();
    expect(screen.queryByText(/Mark missing for/)).toBeNull();
    expect(document.querySelector('.current-marks')).toBeNull();
  });
});

// The Settlement Due and Closed tables (T8R.7): O-S2X is MNO's 20 Nov 45 Put (the fixture O-S), K1 and K2 are Trades sold out or expired.
describe('Today drawer: Settlement Due and Closed (W25, W26, W30)', () => {
  const NOV_PUT = OS_CONTRACT;
  const MNO_STOCK: Instrument = { kind: 'Stock', symbol: 'MNO' };
  const XYZ_STOCK: Instrument = { kind: 'Stock', symbol: 'XYZ' };
  const columns = { today: { date: '2026-11-23', next: false }, yesterday: '2026-11-20' };
  const point = (tradingDate: string, price: string) => ({ kind: 'Available' as const, tradingDate, closeInstant: `${tradingDate}T21:00:00Z`, price, revisionNumber: 1, source: 'Manual' as const, savedAt: `${tradingDate}T21:30:00Z` });
  const tableCells = () => {
    const table = screen.getByRole('table');
    return {
      headings: within(table).getAllByRole('columnheader').map((cell) => cell.textContent),
      rows: within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => [within(row).getByRole('rowheader').textContent, ...within(row).getAllByRole('cell').map((cell) => cell.textContent)]),
    };
  };
  // O-S2X on Mon Nov 23: the put expired on Fri Nov 20. The Underlying's Marks are the Detail's own (A234); the replay ends at the expiration session.
  const settlementDue = (): { view: OpenTradeDetail; replay: TodayReplay } => {
    const base = optionOpenDetail('O-S', [OS_S1], { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', contractMark: '0.80', underlyingMark: '52.00' });
    const view: OpenTradeDetail = {
      ...base,
      marksColumns: columns,
      settlementUnderlying: { today: point('2026-11-23', '51.00'), yesterday: point('2026-11-20', '52.00'), change: { since: '2026-11-20', dollars: rational('-1.00') } },
    };
    const replay: TodayReplay = { instruments: [MNO_STOCK, NOV_PUT], sessions: [session('2026-11-19', [mark(NOV_PUT, '0.70')]), session('2026-11-20', [mark(NOV_PUT, '0.80', { since: '2026-11-19', amount: '0.10' })])] };
    return { view, replay };
  };

  it("should show the Underlying's Marks for Today and Yesterday on a Settlement Due Trade, and no price tracks", () => {
    const { view, replay } = settlementDue();
    drawer(view, replay);
    expect(tableCells()).toEqual({
      headings: ['Today, Mon Nov 23', 'Yesterday, Fri Nov 20', 'Change'],
      rows: [
        ['MNO Mark', '51.00', '52.00', '−1.00'],
        ['Put Mark', 'Expired', '$0.80', '—'],
      ],
    });
    expect(document.querySelector('.tracks, .price-track')).toBeNull();
    expect(screen.queryByRole('heading', { name: /Where the prices? sits?/ })).toBeNull();
    expect(document.querySelector('.current-marks')).toBeNull();
  });

  it('should show Expired for the option on a session after its expiration, named Expired Fri Nov 20', () => {
    const { view, replay } = settlementDue();
    drawer(view, replay);
    const expired = screen.getByRole('cell', { name: 'Expired Fri Nov 20' });
    expect(expired.textContent).toBe('Expired');
    // Friday is the expiration session itself, so its cell is a Mark; only Today's is Expired.
    expect(screen.getAllByText('Expired')).toHaveLength(1);
  });

  // K1 (sold out by Fri Nov 13 at $12.40) and the replay to that session; the Underlying's Mark at it is 55.00.
  const closedBySale = (): { view: OpenTradeDetail; replay: TodayReplay } => {
    const sold = ocChange('pc-k1', '2026-11-13T15:00:00Z', 5, 'Sell', '2', '12.40', '0.65');
    const view = { ...optionClosedDetail('O-C', [OC_PC1, OC_PC2, sold]), marksColumns: columns, exitSessionDate: '2026-11-13' };
    const replay: TodayReplay = { instruments: [XYZ_STOCK, OC_CONTRACT], sessions: [session('2026-11-12', [mark(XYZ_STOCK, '54.00'), mark(OC_CONTRACT, '12.00')]), session('2026-11-13', [mark(XYZ_STOCK, '55.00'), mark(OC_CONTRACT, '12.30')])] };
    return { view, replay };
  };

  it("should show a Closed by sale Trade's final exit price under Exit Fri Nov 13, and the Underlying's Mark at that session", () => {
    const { view, replay } = closedBySale();
    drawer(view, replay);
    expect(tableCells().headings).toEqual(['Today, Mon Nov 23', 'Exit Fri Nov 13', 'Change']);
    expect(tableCells().rows.map(([label, , exit]) => [label, exit])).toEqual([
      ['XYZ Mark', '55.00'],
      ['Call Mark', '$12.40'],
    ]);
  });

  // T8R.7-B1 (decision P1): the column is dated by the exit session, which the Detail names, not by the replay's last session.
  it('should head a Closed Trade sold before the close Exit with the exit session date and show the Underlying cell as a dash', () => {
    const sold = ocChange('pc-k1', '2026-11-20T16:00:00Z', 5, 'Sell', '2', '12.40', '0.65');
    const view = { ...optionClosedDetail('O-C', [OC_PC1, OC_PC2, sold]), marksColumns: columns, exitSessionDate: '2026-11-20' };
    // The replay's newest session is Thu Nov 19; Fri Nov 20, the exit session, has not closed.
    const replay: TodayReplay = { instruments: [XYZ_STOCK, OC_CONTRACT], sessions: [session('2026-11-18', [mark(XYZ_STOCK, '54.00')]), session('2026-11-19', [mark(XYZ_STOCK, '55.00')])] };
    drawer(view, replay);
    expect(tableCells().headings).toEqual(['Today, Mon Nov 23', 'Exit Fri Nov 20', 'Change']);
    expect(tableCells().rows.map(([label, , exit]) => [label, exit])).toEqual([
      ['XYZ Mark', '—'],
      ['Call Mark', '$12.40'],
    ]);
  });

  it("should show the Underlying Mark at the exit session once that session has closed", () => {
    const sold = ocChange('pc-k1', '2026-11-13T15:00:00Z', 5, 'Sell', '2', '12.40', '0.65');
    const view = { ...optionClosedDetail('O-C', [OC_PC1, OC_PC2, sold]), marksColumns: columns, exitSessionDate: '2026-11-13' };
    // The replay runs past the exit session; the cell is the exit session's Mark, not the newest one's.
    const replay: TodayReplay = { instruments: [XYZ_STOCK, OC_CONTRACT], sessions: [session('2026-11-12', [mark(XYZ_STOCK, '54.00')]), session('2026-11-13', [mark(XYZ_STOCK, '55.00')]), session('2026-11-16', [mark(XYZ_STOCK, '56.00')])] };
    drawer(view, replay);
    expect(tableCells().headings).toEqual(['Today, Mon Nov 23', 'Exit Fri Nov 13', 'Change']);
    expect(tableCells().rows[0]!.slice(0, 3)).toEqual(['XYZ Mark', '', '55.00']);
  });

  it("should show Expired for the option and the Underlying's expiration Mark under Expired Fri Nov 20", () => {
    const view = { ...optionClosedDetail('O-S', [OS_S1, OS_ES]), marksColumns: columns, exitSessionDate: '2026-11-20' };
    const replay: TodayReplay = { instruments: [MNO_STOCK, NOV_PUT], sessions: [session('2026-11-19', [mark(MNO_STOCK, '51.50')]), session('2026-11-20', [mark(MNO_STOCK, '52.00')])] };
    drawer(view, replay);
    expect(tableCells().headings).toEqual(['Today, Mon Nov 23', 'Expired Fri Nov 20', 'Change']);
    expect(tableCells().rows.map(([label, , exit]) => [label, exit])).toEqual([
      ['MNO Mark', '52.00'],
      ['Put Mark', 'Expired'],
    ]);
    expect(screen.getByRole('cell', { name: 'Expired Fri Nov 20' })).toBeTruthy();
  });

  it('should leave the Today column empty and Change as a dash on a Closed Trade, with the Closed stamp', () => {
    const { view, replay } = closedBySale();
    drawer(view, replay);
    for (const row of tableCells().rows) {
      expect(row[1]).toBe('');
      expect(row[3]).toBe('—');
    }
    // The stamp is real text for the accessibility tree, and the drawer is greyed.
    const stamp = screen.getByText('Closed');
    expect(stamp.closest('[aria-hidden="true"]')).toBeNull();
    expect(stamp.closest('.closed-today')).not.toBeNull();
  });
});

describe('Price track: open lots', () => {
  // O-C3+ at Fri 10-16: one contract left at $2.00 (Mon), one bought Fri 11:00 at $3.30. Trade Views gives the open lots' average, $2.65 (A236).
  const buy = ocChange('pc-1', '2026-10-12T14:00:00Z', 1, 'Buy', '2', '2.00', '1.30');
  const sell = ocChange('pc-2', '2026-10-14T15:00:00Z', 3, 'Sell', '1', '3.00', '0.65');
  const lateBuy = ocChange('pc-3', '2026-10-16T15:00:00Z', 5, 'Buy', '1', '3.30', '0.65');
  const FRIDAY = { tradingDate: '2026-10-16', closeInstant: '2026-10-16T20:00:00Z', contractMark: '3.50', underlyingMark: '53.00' };
  const oc3Plus = (): OpenTradeDetail => ({ ...optionOpenDetail('O-C', [buy, sell, lateBuy], FRIDAY), openAverage: rational('2.65') });
  const optionTrack = () => screen.getByRole('img', { name: /^Option price: / });
  const left = (element: HTMLElement | undefined) => Number.parseFloat(element!.style.left);

  it("should place the entry dot at the open lots' average, $2.65, not the first entry's $2.00", () => {
    drawer(oc3Plus());
    const track = optionTrack();
    const entry = left(parts(track, '.mk[data-kind="entry"]')[0]);
    const [first, second] = parts(track, '.tick');
    // Equal lots: $2.65 is half way between the two ticks, and the first entry's $2.00 is the first tick.
    expect(entry).toBeCloseTo((left(first) + left(second)) / 2, 1);
    expect(entry).toBeGreaterThan(left(first));
  });

  it('should place one tick per open lot at its price, named "$3.30 · Fri Oct 16"', () => {
    drawer(oc3Plus());
    const ticks = parts(optionTrack(), '.tick');
    expect(ticks.map((tick) => tick.getAttribute('aria-label'))).toEqual(['$2.00 · Mon Oct 12', '$3.30 · Fri Oct 16']);
    expect(ticks.map((tick) => tick.title)).toEqual(['$2.00 · Mon Oct 12', '$3.30 · Fri Oct 16']);
    expect(left(ticks[0])).toBeLessThan(left(ticks[1]));
  });

  it('should not tick a lot that was sold', () => {
    // O-C: Mon Buy 1 @ 2.10, Mon Buy 1 @ 1.90, Tue Sell 1 @ 3.00. The first lot is sold, so only the $1.90 lot is open.
    drawer({ ...optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY), openAverage: rational('1.90') });
    expect(parts(optionTrack(), '.tick').map((tick) => tick.getAttribute('aria-label'))).toEqual(['$1.90 · Mon Oct 12']);
  });
});

// Each figure has one home (P116): At entry and the dated card are Plan and Risk's Since the last Marks group and the rail's dated line, and a
// condition's value at expiration and distance are Plan and Risk's Conditions rows (T8R.10, T8R.12, T8R.13, T8R.14).
describe('Today drawer: one place for each figure', () => {
  // 40 shares bought Monday 17:00 New York, after Monday's Marks: the dated card and At entry both had content.
  const afterMarks = positionChange('pc-9', 3, [execution('ex-9', '2026-10-12T21:00:00Z', 4, '40', '50.30', '1.00')]);
  const monday = { instrumentKey: 'XYZ', tradingDate: '2026-10-12', closeInstant: '2026-10-12T20:00:00Z', previousCloseInstant: '2026-10-09T20:00:00Z', resolution: { kind: 'Available', mark: { revisionId: 'm-1', revisionNumber: 1, price: '51.20', source: 'Manual', savedAt: '2026-10-12T21:30:00Z' } } } as const;

  it('should not show the At entry card (gone)', () => {
    drawer(openDetailAt([PC1, afterMarks], monday));
    expect(screen.queryByRole('region', { name: 'At entry', hidden: true })).toBeNull();
    expect(screen.queryByText('Risk from entry')).toBeNull();
    expect(screen.queryByText('Reward from entry')).toBeNull();
  });

  it('should not show the At the Thu Oct 15 Marks card (gone)', () => {
    // The Mark for Friday is missing, so the Detail carries the line dated at the last Marks: Thursday's.
    const missing = openDetailAt([PC1, PC2], tuesday({ kind: 'Missing', stale: { tradingDate: '2026-10-15', price: '51.20', revisionId: 'm-0', revisionNumber: 1, closeInstant: '2026-10-15T20:00:00Z' } }));
    const { datedLine } = missing.current;
    if (!datedLine) throw new Error('fixture needs a dated line');
    drawer({ ...missing, current: { ...missing.current, datedLine: { ...datedLine, tradingDate: '2026-10-15' } } });
    expect(screen.queryByRole('region', { name: /^At the .* Marks$/, hidden: true })).toBeNull();
    expect(screen.queryByText('Current Marked Trade P&L')).toBeNull();
    expect(screen.queryByText('Incurred fees')).toBeNull();
  });

  it("should not show a condition's value at expiration or distance on the Underlying under its track (gone)", () => {
    drawer(thursday(), wednesdayAndThursday());
    expect(screen.queryByRole('list', { name: 'Conditions', hidden: true })).toBeNull();
    expect(screen.queryByText('Value at expiration')).toBeNull();
    expect(screen.queryByText('Distance on MNO')).toBeNull();
    // The tracks themselves stay.
    expect(screen.getByRole('img', { name: /^MNO:/ })).toBeTruthy();
  });
});
