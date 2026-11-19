import { describe, expect, it } from 'vitest';
import { instrumentKey } from '../../../domain/instrument/index.ts';
import type { Rational } from '../../../domain/values/index.ts';
import { replayProps } from './replay.props.ts';
import { sessionWords } from './session-words.props.ts';
import {
  AXIO, BREN, BREN_STOCK, brenMon1102, brenThu1112, brenWed1111, condition, DALE, frac, fullView, markOf, Plot, PLAN, rowsOfGroup, session, usd, value, view, withMarks, type Figures,
} from './view-doubles.props.ts';

// The adapter's own cases are split by what they test (A286): the session's words in session-words.props.test.ts, the stake sentence in
// stake-words.props.test.ts, the readout in readout.props.test.ts and the plot in plot.props.test.ts. What stays here tests the assembly,
// or the assembly and a part together. The doubles are in view-doubles.props.ts.

// F2: each session follows its own condition status (T9.4), not the dollars' zone alone: a crossed Underlying price changes the words.
describe('replay.props: the words follow the condition status (T9.14-F2)', () => {
  // A condition read at the session's Mark: crossed with the distance past its price, or still active.
  const reading = (role: 'Stop' | 'Target', boundary: string, status: 'Active' | 'Breached' | 'Reached', beyond: Rational | null): Figures['conditions'][number] => ({
    ...condition(role, 'UnderlyingPrice', boundary),
    result: {
      kind: 'Value',
      value: { status, distance: { dollars: usd(0), planR: usd(0) }, overrun: null, trigger: { distance: usd(0), beyond } },
    } as unknown as Figures['conditions'][number]['result'],
  });
  const daleFri1113 = session({
    date: '2026-11-13',
    instrument: DALE,
    held: -3,
    pnl: -900,
    pnlR: frac(-900, 1536),
    standing: value({ zone: 'Between', share: frac(900, 1536) }),
    figures: { conditions: [reading('Stop', '54.00', 'Breached', frac(30, 100))] },
  });
  const daleMon1116 = session({
    date: '2026-11-16',
    instrument: DALE,
    held: -3,
    pnl: -500,
    pnlR: frac(-500, 1536),
    standing: value({ zone: 'Between', share: frac(500, 1536) }),
    figures: { conditions: [reading('Stop', '54.00', 'Active', null)] },
  });

  it('should read past the Stop on a session where the Underlying has crossed the Stop though the Trade P&L has not', () => {
    const words = sessionWords(view([daleFri1113]), 0);
    expect(words.howItIsGoing).toBe('Stop breached: DALE $0.30 past $54.00.');
    expect(words.headline).toEqual({ figure: '−$900.00 · −0.59R', tone: 'Loss' });
    const stake = replayProps(view([daleFri1113]), { Plot: () => null }).sessions[0]!.readout.find((g) => g.title === 'At stake from here, whole Position');
    expect(stake?.rows.find((r) => r.label === 'Reward to risk')).toBeUndefined();
    // The dollars past the line as well: W37's words stand.
    const both = session({ ...{ date: '2026-11-13', instrument: DALE, held: -3, pnl: -1700 }, standing: value({ zone: 'PastStop', pastBy: { dollars: usd(180), r: frac(3, 10), crossed: true } }), figures: { conditions: [reading('Stop', '54.00', 'Breached', frac(30, 100))] } });
    expect(sessionWords(view([both]), 0).howItIsGoing).toBe('Past the Stop by $180.00 (0.30R).');
  });

  it('should go back to Behind on a later session where the condition is no longer crossed', () => {
    const v = view([daleFri1113, daleMon1116]);
    expect(sessionWords(v, 0).howItIsGoing).toBe('Stop breached: DALE $0.30 past $54.00.');
    expect(sessionWords(v, 1).howItIsGoing).toBe('Behind: 33% of the way to the Stop.');
    const stake = replayProps(v, { Plot: () => null }).sessions[1]!.readout.find((g) => g.title === 'At stake from here, whole Position');
    expect(stake?.rows.find((r) => r.label === 'Reward to risk')?.value.text).not.toBe('Stop breached');
    // Dollars past the planned amount alone, the price short of its trigger: the planned-amount words.
    const dollarsOnly = session({
      date: '2026-11-17',
      instrument: DALE,
      held: -3,
      pnl: -1272,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(9), r: frac(9, 1536), crossed: false } }),
      figures: { conditions: [reading('Stop', '54.00', 'Active', null)] },
    });
    expect(sessionWords(view([dollarsOnly]), 0).howItIsGoing).toBe("Past the Stop's planned amount by $9.00, though DALE is still above $54.00.");
  });

  it('should read Target reached on a session where the Target condition is reached though the Trade P&L is short of it', () => {
    const brenTarget = session({
      date: '2026-11-16',
      pnl: 700,
      pnlR: frac(700, 324),
      standing: value({ zone: 'Between', share: frac(700, 956) }),
      figures: { conditions: [reading('Target', '104.00', 'Reached', frac(1, 2))] },
    });
    expect(sessionWords(view([brenTarget]), 0).howItIsGoing).toBe('Target reached.');
    const stake = replayProps(view([brenTarget]), { Plot: () => null }).sessions[0]!.readout.find((g) => g.title === 'At stake from here, whole Position');
    expect(stake?.rows.find((r) => r.label === 'Reward to risk')).toBeUndefined();
  });

  it('should leave out the readout ratio when the Stop is crossed though the dollars are past the Target', () => {
    const crossedPastTarget = session({
      date: '2026-11-16',
      pnl: 1138,
      standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(182), r: frac(182, 324), crossed: true } }),
      figures: { conditions: [reading('Stop', '54.00', 'Breached', frac(30, 100))] },
    });
    const v = view([crossedPastTarget]);
    const headline = sessionWords(v, 0).howItIsGoing;
    const stake = replayProps(v, { Plot: () => null }).sessions[0]!.readout.find((g) => g.title === 'At stake from here, whole Position');
    expect(headline).toBe('Stop breached: BREN $0.30 past $54.00.');
    expect(stake?.rows.find((r) => r.label === 'Reward to risk')).toBeUndefined();
  });

  it('should read Target reached when the Target is crossed though the dollars are past the Stop planned amount', () => {
    const targetPastStopAmount = session({
      date: '2026-11-16',
      pnl: -1272,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(9), r: frac(9, 1536), crossed: false } }),
      figures: { conditions: [reading('Target', '104.00', 'Reached', frac(1, 2))] },
    });
    const v = view([targetPastStopAmount]);
    const stake = replayProps(v, { Plot: () => null }).sessions[0]!.readout.find((g) => g.title === 'At stake from here, whole Position');
    expect(sessionWords(v, 0).howItIsGoing).toBe('Target reached.');
    expect(stake?.rows.find((r) => r.label === 'Reward to risk')).toBeUndefined();
  });
});

describe('replay.props: the frame, the slider and the session cards (W42, W65)', () => {
  it('should give the frame its fixed words, one slider step per session, and the cards the Mark rows for the Underlying and the contract', () => {
    const tue = session({ date: '2026-11-03', pnl: -12, pnlR: frac(-12, 324), standing: value({ zone: 'Between', share: frac(12, 324) }) });
    const props = replayProps(fullView([brenMon1102, tue]), { Plot, initialSession: '2026-11-02' });
    expect(props).toMatchObject({ tradeKey: 'T-1', initialSession: '2026-11-02', sliderLabel: 'Session', previousLabel: 'Previous session', nextLabel: 'Next session', cardsWords: { title: 'Session by session', newerLabel: 'Newer sessions', earlierLabel: 'Earlier sessions' }, Plot });
    expect(props.sessions.map((s) => s.card.rows.slice(0, 2).map((r) => r.label))).toEqual([['BREN Mark', 'Call Mark'], ['BREN Mark', 'Call Mark']]);
    expect(props.sessions.map((s) => [s.date, s.dateLabel, s.sliderValue])).toEqual([
      ['2026-11-02', 'Mon Nov 2', 'Mon Nov 2 · 1 of 2'],
      ['2026-11-03', 'Tue Nov 3', 'Tue Nov 3 · 2 of 2'],
    ]);
    // The headline, how it is going and the stake are the words of `sessionWords`.
    expect(props.sessions[0]).toMatchObject({ ...sessionWords(fullView([brenMon1102, tue]), 0), isFinal: false });
    // A stock Trade has the one Mark row.
    const axio = session({ date: '2026-11-06', instrument: AXIO, held: 200, pnl: -380 });
    expect(replayProps({ ...view([axio]), instruments: [AXIO] }, { Plot }).sessions[0]!.card.rows.slice(0, 2).map((r) => r.label)).toEqual(['AXIO Mark', 'Trade P&L']);
  });
});

describe('replay.props: Session by session (W65)', () => {
  it('should give each session a card of finished rows, its events, and No Mark in the rows of a session without a Mark', () => {
    const sale = { id: 'x2', kind: 'Execution', effect: 'Reduced', fills: [{ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4) }] } as const;
    const wed = {
      ...brenWed1111,
      realizedPnl: usd(478),
      markers: [sale],
      figures: { ...brenWed1111.figures!, conditions: [condition('Stop', 'UnderlyingPrice', '96.00'), condition('Target', 'UnderlyingPrice', '104.00')] },
    };
    const none = withMarks(session({ date: '2026-11-12', pnl: null }), [markOf(BREN_STOCK, '100.20'), markOf(BREN)]);
    const props = replayProps(fullView([wed, none]), { Plot });
    const said = (s: (typeof props.sessions)[number]) => s.card.rows.map((r) => [r.label, r.value.text, r.r?.text, r.pnl?.text]);
    expect(props.sessions.map((s) => [s.card.heading, s.card.events])).toEqual([['Wed Nov 11', ['Sold 2 at $4.00']], ['Thu Nov 12', []]]);
    expect(said(props.sessions[0]!)).toEqual([
      ['BREN Mark', '$101.80', undefined, undefined],
      ['Call Mark', '$3.20', undefined, undefined],
      ['Trade P&L', '+$520.00 · 1.60R', undefined, undefined],
      ['Banked', '+$478.00', undefined, undefined],
      ['Held', '4 contracts', undefined, undefined],
      ['At Stop', '$352.00', '1.09R', '−$324.00'],
      ['At Worst case', '$644.00', '1.99R', 'Not applicable: no open position'],
      ['At Target', '$928.00', '2.86R', '+$956.00'],
      ['At Max reward', 'No cap above', undefined, undefined],
      ['Reward to risk', '2.64 to 1 · about 28% : 72%', undefined, undefined],
      ['Stop', '96.00', undefined, undefined],
      ['Target', '104.00', undefined, undefined],
    ]);
    // No Mark: the dash in each row that needs the Mark, never a value of another session; the Trade P&L is no sentence.
    const noMark = { kind: 'Unavailable', text: 'No Mark' };
    expect(props.sessions[1]!.card.rows.filter((r) => r.label === 'Call Mark' || r.label === 'Trade P&L').map((r) => r.value)).toEqual([noMark, noMark]);
  });
});

describe('replay.props: the hover and the marker flag', () => {
  it('should give the hover the date, the Marks, each Execution and the Trade P&L, and say whether a Position Change falls in the session', () => {
    const sale = { id: 'x2', kind: 'Execution', effect: 'Reduced', fills: [{ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4) }] } as const;
    const none = withMarks(session({ date: '2026-11-12', pnl: null }), [markOf(BREN_STOCK, '100.20'), markOf(BREN)]);
    const props = replayProps(fullView([{ ...brenWed1111, markers: [sale] }, none], PLAN), { Plot });
    expect(props.sessions.map((s) => s.hover)).toEqual([
      ['Wed Nov 11', 'BREN Mark: $101.80', 'Call Mark: $3.20', 'Sold 2 at $4.00', 'Trade P&L: +$520.00 · 1.60R'],
      ['Thu Nov 12', 'BREN Mark: $100.20', 'Call Mark: No Mark', 'Trade P&L: No Mark'],
    ]);
    expect(props.sessions.map((s) => s.hasMarker)).toEqual([true, false]);
  });
});

describe('replay.props: the readout of a session in flight (W43)', () => {
  it('should show the results at the Stop and the Target on a session without a Mark', () => {
    const none = withMarks(session({ date: '2026-11-10', pnl: null, outcomes: { atStop: value(usd(-324)), atTarget: value(usd(956)) } }), [markOf(BREN_STOCK, '100.20'), markOf(BREN)]);
    const props = replayProps(fullView([none], PLAN), { Plot });
    expect(props.sessions[0]!.readout.map((group) => group.title)).toEqual(['How it is going', 'At stake from here, whole Position', 'Marks', 'Position', 'The Plan']);
    expect(rowsOfGroup(props, 0, 'At stake from here, whole Position')).toEqual({ 'Reward to risk': 'No Mark' });
    // What the Trade would end at needs no Mark, so it stands beside the dash named "No Mark" in the grid's From here and R cells.
    const gridRows = props.sessions[0]!.readout.find((group) => group.title === 'At stake from here, whole Position')!.grid!.groups.flatMap((g) => g.rows);
    const noMark = { kind: 'Unavailable', text: 'No Mark' };
    expect(gridRows.find((r) => r.label === 'At Stop')).toMatchObject({ fromHere: noMark, r: noMark, pnlIfHit: { text: '−$324.00' } });
    expect(gridRows.find((r) => r.label === 'At Target')).toMatchObject({ fromHere: noMark, r: noMark, pnlIfHit: { text: '+$956.00' } });
    // The card holds the same rows: the dash where the Mark is needed, the results beside it.
    const card = props.sessions[0]!.card.rows;
    expect(card.find((r) => r.label === 'At Stop')).toMatchObject({ value: noMark, r: noMark, pnl: { text: '−$324.00' } });
    expect(card.find((r) => r.label === 'At Target')).toMatchObject({ value: noMark, r: noMark, pnl: { text: '+$956.00' } });
  });
});

describe('replay.props: the readout separates what is at stake from where the Trade ends (T9.19-B4)', () => {
  it('should give each stake row on the card its from-here amount and its P&L if hit, and match the Worst case P&L to the chart label', () => {
    const props = replayProps(fullView([brenThu1112], PLAN), { Plot });
    const row = (label: string) => props.sessions[0]!.card.rows.find((r) => r.label === label)!;
    expect(row('At Worst case').value.text).toBe('$832.00');
    expect(row('At Worst case').pnl?.text).toBe('+$156.00');
    expect(row('At Stop').pnl?.text).toBe('+$316.00');
    // The chart's label figure is the card's P&L if hit at the Worst case.
    expect(props.sessions[0]!.plot.worstCase!.label).toBe(`Worst case ${row('At Worst case').pnl!.text.replace(/\.00$/, '')}`);
  });
});

describe('replay.props: the link to add a missing Mark (A281, T9AR.16)', () => {
  const gap = session({ date: '2026-11-12', pnl: null });
  const acknowledged = { ...gap, tradePnl: { kind: 'Unavailable', reason: 'AcknowledgedUnavailable', instrument: BREN, date: '2026-11-12' } } as typeof gap;
  const open = (sessions: (typeof gap)[]) => ({ ...view(sessions), pending: { date: '2026-11-13', journal: [] } });

  it('should link a session with a missing or acknowledged Mark to the Review row of its Instrument on an Open Trade, and nowhere on a Trade that has ended', () => {
    const marked = replayProps(open([brenWed1111, gap]), { Plot }).sessions.map((s) => s.addMarkTo);
    expect(marked).toEqual([undefined, `/review?trade=T-1&instrument=${instrumentKey(BREN)}`]);
    expect(replayProps(open([acknowledged]), { Plot }).sessions[0]!.addMarkTo).toBe(`/review?trade=T-1&instrument=${instrumentKey(BREN)}`);
    const ended = replayProps(view([brenWed1111, gap]), { Plot }).sessions;
    expect(ended.every((s) => !('addMarkTo' in s))).toBe(true);
  });

  it('should link an option Trade to the Review row by the contract key the Marks rows use, not the listing symbol, R-CORV-D Tue 11-10', () => {
    const corv = session({ date: '2026-11-10', instrument: DALE, held: -3, pnl: null });
    const to = replayProps(open([corv]), { Plot }).sessions[0]!.addMarkTo;
    expect(to).toBe(`/review?trade=T-1&instrument=${encodeURIComponent(instrumentKey(DALE))}`);
    expect(to).not.toBe('/review?trade=T-1&instrument=DALE');
    // A stock's key is its symbol.
    const stockGap = session({ date: '2026-11-10', instrument: AXIO, held: 10, pnl: null });
    expect(replayProps(open([stockGap]), { Plot }).sessions[0]!.addMarkTo).toBe('/review?trade=T-1&instrument=AXIO');
  });
});
