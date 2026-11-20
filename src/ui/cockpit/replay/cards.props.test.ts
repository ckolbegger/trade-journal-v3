import { describe, expect, it } from 'vitest';
import { figureParts } from './cards.props.ts';
import { replayProps } from './replay.props.ts';
import type { SessionCardRow } from './replay.types.ts';
import { BREN, BREN_STOCK, brenThu1112, brenWed1111, condition, fullView, markOf, NOT_APPLICABLE, Plot, PLAN, usd, value, withMarks } from './view-doubles.props.ts';

// The session cards' contents (A277, W65): each card selects what the readout already built for the session, so the two never drift apart.
// The cards' own drawing is session-cards.test.tsx's, the frame's wiring frame.test.tsx's.

const sale = { id: 'x2', kind: 'Execution', effect: 'Reduced', fills: [{ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4) }] } as const;
const lines = [condition('Stop', 'UnderlyingPrice', '96.00'), condition('Target', 'UnderlyingPrice', '104.00')];

// R-BREN-U on Thu 11-12 as the trader sees it: 2 of the 4 contracts sold at $4.00, the Target passed by $26, the Stop and Target set.
const thu1112 = withMarks(
  { ...brenThu1112, markers: [sale], figures: { ...brenThu1112.figures!, openPnl: value(usd(504)), conditions: lines } },
  [markOf(BREN_STOCK, '103.60'), markOf(BREN, '4.13')],
);
const wed1111 = { ...brenWed1111, figures: { ...brenWed1111.figures!, conditions: lines } };

// A row as the card draws it: "$672.00 · 2.07R · P&L if hit +$316.00".
const said = (row: SessionCardRow) => [row.label, [row.value.text, ...(row.r ? [row.r.text] : []), ...(row.pnl ? [`P&L if hit ${row.pnl.text}`] : [])].join(' · ')];

describe('Replay: session cards, figures as unbreakable parts (T9AR.24-B1)', () => {
  it('should split a card text into words and figures, each signed amount, R multiple, odds and percentage pair one figure part with its sign', () => {
    expect(figureParts('Past the Stop by $180.00 (0.30R) · at Stop −$740.00')).toEqual([
      { text: 'Past the Stop by ' },
      { text: '$180.00', figure: true },
      { text: ' (' },
      { text: '0.30R', figure: true },
      { text: ') · at Stop ' },
      { text: '−$740.00', figure: true },
    ]);
    expect(figureParts('11.69 to 1 · about 8% : 92%')).toEqual([{ text: '11.69 to 1', figure: true }, { text: ' · about ' }, { text: '8% : 92%', figure: true }]);
    expect(figureParts('$31,848.00 · +20.73R · P&L if hit +$1,200.00').filter((p) => p.figure).map((p) => p.text)).toEqual(['$31,848.00', '+20.73R', '+$1,200.00']);
    expect(figureParts('Sold 100 at $45.60').map((p) => p.text).join('')).toBe('Sold 100 at $45.60');
    expect(figureParts('No Mark')).toEqual([{ text: 'No Mark' }]);
  });
});

describe('Replay: session cards, edge odds as unbreakable parts (T9AR.24-B1-B1)', () => {
  it('should keep each edge odds pair, under 1% : over 99% and over 99% : under 1%, as one figure part', () => {
    expect(figureParts('11.69 to 1 · under 1% : over 99%')).toEqual([{ text: '11.69 to 1', figure: true }, { text: ' · ' }, { text: 'under 1% : over 99%', figure: true }]);
    expect(figureParts('0.29 to 1 · over 99% : under 1% (Plan 0.29 to 1 · 78% : 22%)').filter((p) => p.figure).map((p) => p.text)).toEqual(['0.29 to 1', 'over 99% : under 1%', '0.29 to 1', '78% : 22%']);
  });
});

describe('Replay: session cards, empty parts', () => {
  it('should leave out the R and the P&L if hit of a stake row that has none, never carry an empty part onto the card', () => {
    // The worst case has no amount and no ending on this session: the readout's R and ending cells are empty there.
    const bare = { ...wed1111, figures: { ...wed1111.figures, worstCaseOngoingRisk: NOT_APPLICABLE, worstCaseOngoingRiskInPlanR: NOT_APPLICABLE } };
    const rows = replayProps(fullView([bare], PLAN), { Plot }).sessions[0]!.card.rows;
    const worst = rows.find((r) => r.label === 'At Worst case')!;
    expect(worst).not.toHaveProperty('r');
    expect(rows.filter((r) => r.r?.text === '' || r.pnl?.text === '')).toEqual([]);
  });
});

describe('Replay: session cards (decision 5)', () => {
  it('should hold every per-session figure on a card, top to bottom: the Marks, Trade P&L, Realized, Open, Held, the stake rows with their R and endings, Reward to risk and Events, with no Stop and Target price (the Plan block holds them)', () => {
    const props = replayProps(fullView([wed1111, thu1112], PLAN), { Plot });
    const thu = props.sessions[1]!.card;
    expect(thu.heading).toBe('Thu Nov 12');
    expect(thu.rows.map(said)).toEqual([
      ['BREN Mark', '$103.60'],
      ['Call Mark', '$4.13'],
      ['Trade P&L', '+$982.00'],
      ['Realized', '+$478.00'],
      ['Open', '+$504.00'],
      ['Held', '2 contracts'],
      ['At Stop', '$672.00 · 2.07R · P&L if hit +$316.00'],
      ['At Worst case', '$832.00 · 2.57R · P&L if hit +$156.00'],
      ['At Max reward', 'No cap above'],
    ]);
    // Past the Target: its one row stands above the stake rows, and the Events close the card.
    expect(thu.pastLine).toEqual({ text: 'Past the Target by $26.00 (0.08R) · at Target +$956.00', term: 'Target Overrun' });
    expect(thu.events).toEqual(['Sold 2 at $4.00']);
    // Reward to risk follows the stake rows.
    const wed = props.sessions[0]!.card;
    expect(wed.rows.map((r) => r.label)).toEqual(['BREN Mark', 'Call Mark', 'Trade P&L', 'Held', 'At Stop', 'At Worst case', 'At Target', 'At Max reward', 'Reward to risk']);
    expect(said(wed.rows.find((r) => r.label === 'Reward to risk')!)).toEqual(['Reward to risk', '2.64 to 1 · about 28% : 72%']);
  });
});
