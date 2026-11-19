import { describe, expect, it } from 'vitest';
import type { TradeReplayView } from '../../../app/types.ts';
import { Rational } from '../../../domain/values/index.ts';
import { replayProps } from './replay.props.ts';
import { AXIO, BREN, brenMon1102, condition, DALE, DALE_PLAN, daleWed1111, frac, fullView, PLAN, Plot, rowsOfGroup, session, usd, view } from './view-doubles.props.ts';

// T9AR.18, decisions 2 and 5: the Plan block holds the Plan's own terms, the one place for the Stop and Target prices (P148). The adapter
// selects and formats the view's `terms`, `odds` and `againstPlan`; it works out nothing (ADR 0001).
type Terms = NonNullable<NonNullable<TradeReplayView['planColumn']>['terms']>;

// R-BREN-U: 4 long calls at $1.61, a Stop at $0.80 and a Target at $4.00 on the option's own price.
const BREN_TERMS: Terms = {
  legs: [{ instrument: BREN, side: 'Long', quantity: Rational.of(4n), entryPrice: frac(161, 100) }],
  conditions: [
    { role: 'Stop', priceOf: 'Option', price: frac(80, 100), pnlIfHit: usd(-324) },
    { role: 'Target', priceOf: 'Option', price: usd(4), pnlIfHit: usd(956) },
  ],
};

// R-DALE-D: 6 short puts at $0.94, a Stop on DALE at $54.00 and a Target on the put at $0.20.
const DALE_TERMS: Terms = {
  legs: [{ instrument: DALE, side: 'Short', quantity: Rational.of(6n), entryPrice: frac(94, 100) }],
  conditions: [
    { role: 'Stop', priceOf: 'Underlying', price: usd(54), pnlIfHit: usd(-1536) },
    { role: 'Target', priceOf: 'Option', price: frac(20, 100), pnlIfHit: usd(444) },
  ],
};

const planOf = (sessionView: TradeReplayView) => replayProps(sessionView, { Plot }).plan;
// R-AXIO-D's Plan column, without odds.
const PLAN_AXIO = { atStop: usd(-600), atTarget: usd(1200), rewardRisk: frac(2, 1) };

describe('Replay: the Plan block (decisions 2 and 5)', () => {
  it('should show The Plan as one block above the cards with its entry, Stop, Target and Reward to risk', () => {
    const plan = planOf(fullView([brenMon1102], { ...PLAN, terms: BREN_TERMS }));
    expect(plan?.title).toBe('The Plan');
    // The option's strike is a row of its own (defect 1b); the four rows of W62 stand in order around it.
    expect(plan?.rows.filter((row) => !row.startsWith('Strike'))).toEqual([
      'Entry: 4 contracts at $1.61',
      'Stop: call at or below $0.80 · P&L if hit −$324.00',
      'Target: call at or above $4.00 · P&L if hit +$956.00',
      'Reward to risk: 2.95 to 1 · 25% : 75%',
    ]);
  });

  it('should name what each price is a price of', () => {
    const plan = planOf(view([daleWed1111], { ...DALE_PLAN, terms: DALE_TERMS }));
    expect(plan?.rows.filter((row) => !row.startsWith('Strike'))).toEqual([
      'Entry: short 6 contracts at $0.94',
      'Stop: DALE at or below $54.00 · P&L if hit −$1,536.00',
      'Target: put at or below $0.20 · P&L if hit +$444.00',
      'Reward to risk: 0.29 to 1 · 78% : 22%',
    ]);
  });

  it('should take The Plan out of the readout and the Stop and Target rows off the cards, the block being their one place', () => {
    const withLines = { ...brenMon1102, figures: { ...brenMon1102.figures!, conditions: [condition('Stop', 'StructureValue', '0.80'), condition('Target', 'StructureValue', '4.00')] } };
    const props = replayProps(fullView([withLines], { ...PLAN, terms: BREN_TERMS }), { Plot });
    expect(props.sessions[0]!.readout.map((group) => group.title)).not.toContain('The Plan');
    expect(props.sessions[0]!.card.rows.map((row) => row.label)).not.toContain('Stop');
    expect(props.sessions[0]!.card.rows.map((row) => row.label)).not.toContain('Target');
    expect(props.plan?.rows.join('\n')).toContain('Stop: call at or below $0.80');
  });

  it('should give every Stop and Target its own row when the Plan has two of a role, each with its own P&L if hit', () => {
    // O-S2: a short put on MNO with a Stop on the Underlying and another on the put's own price.
    const mno = { kind: 'Option', symbol: 'MNO', root: 'MNO', expiration: '2026-11-20', strike: '45', right: 'Put', multiplier: 100 } as const;
    const terms: Terms = {
      legs: [{ instrument: mno, side: 'Short', quantity: Rational.of(2n), entryPrice: usd(2) }],
      conditions: [
        { role: 'Stop', priceOf: 'Underlying', price: usd(41), pnlIfHit: usd(-560) },
        { role: 'Stop', priceOf: 'Option', price: frac(360, 100), pnlIfHit: usd(-480) },
        { role: 'Target', priceOf: 'Option', price: frac(50, 100), pnlIfHit: usd(300) },
      ],
    };
    const plan = planOf({ ...view([session({ date: '2026-11-02', instrument: mno, held: -2, pnl: 0 })], { atStop: usd(-560), atTarget: usd(300), rewardRisk: frac(300, 560), terms }), instruments: [mno] });
    expect(plan?.rows.filter((row) => row.startsWith('Stop'))).toEqual(['Stop: MNO at or below $41.00 · P&L if hit −$560.00', 'Stop: put at or above $3.60 · P&L if hit −$480.00']);
    expect(plan?.rows.filter((row) => row.startsWith('Target'))).toEqual(['Target: put at or below $0.50 · P&L if hit +$300.00']);
  });
});

type Fill = NonNullable<NonNullable<TradeReplayView['sessions'][number]['markers']>[number]['fills'][number]>;
const marker = (fill: Fill, kind: 'Execution' | 'Expiration' = 'Execution') => ({ id: 'x1', kind, effect: 'Reduced' as const, fills: [fill] });

describe('Replay: each Execution against the Plan (decision 2)', () => {
  it('should read a sale below the Stop with its distance in the readout Position group and in the card Events', () => {
    const sale = marker({ instrument: AXIO, action: 'Sell', quantity: usd(100), price: frac(4560, 100), againstPlan: { line: 'Stop', side: 'Below', distance: frac(140, 100) } });
    const props = replayProps(view([{ ...session({ date: '2026-11-09', instrument: AXIO, held: 100, pnl: -920 }), markers: [sale] }]), { Plot });
    expect(rowsOfGroup(props, 0, 'Position')['Execution, Mon Nov 9']).toBe('Sold 100 at $45.60, $1.40 below the Stop');
    expect(props.sessions[0]!.card.events).toEqual(['Sold 100 at $45.60, $1.40 below the Stop']);
  });
});

describe('Replay: each Execution against the Plan, at a line and at the entry', () => {
  it('should read a sale at the Target and a purchase above the Plan entry', () => {
    const sale = marker({ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4), againstPlan: { line: 'Target', side: 'At', distance: usd(0) } });
    const buy = marker({ instrument: AXIO, action: 'Buy', quantity: usd(100), price: frac(5140, 100), againstPlan: { line: 'Entry', side: 'Above', distance: frac(140, 100) } });
    const thu = replayProps(view([{ ...session({ date: '2026-11-12', held: 2, pnl: 982 }), markers: [sale] }]), { Plot });
    expect(rowsOfGroup(thu, 0, 'Position')['Execution, Thu Nov 12']).toBe('Sold 2 at $4.00, at the Target');
    const fri = replayProps(view([{ ...session({ date: '2026-11-06', instrument: AXIO, held: 100, pnl: 0 }), markers: [buy] }]), { Plot });
    expect(fri.sessions[0]!.card.events).toEqual(["Bought 100 at $51.40, $1.40 above the Plan's entry"]);
  });
});

type Crossings = NonNullable<TradeReplayView['sessions'][number]['crossings']>;
type CrossingDate = { date: string; afterGap: boolean };
const NONE = { conditions: [] };
// A271: a session's crossings from the dates the view gives.
const crossed = (parts: { stop?: { first?: CrossingDate; since?: CrossingDate }; target?: { first?: CrossingDate; since?: CrossingDate } }): Crossings => ({ stop: { ...NONE, ...parts.stop }, target: { ...NONE, ...parts.target } });
const on = (date: string, afterGap = false): CrossingDate => ({ date, afterGap });
const withCrossings = (date: string, crossings: Crossings) => ({ ...session({ date, instrument: DALE, held: -3, pnl: 100 }), crossings });
const crossingWordsOf = (props: ReturnType<typeof replayProps>) => props.sessions.map((s) => s.crossingWords);

describe('Replay: a condition first crossing (decision 2)', () => {
  it('should say Target first reached Fri Nov 6 from Fri Nov 6 on, Mon Nov 9 included where the put is under its Target again', () => {
    const props = replayProps(
      view([
        withCrossings('2026-11-05', crossed({})),
        withCrossings('2026-11-06', crossed({ target: { first: on('2026-11-06'), since: on('2026-11-06') } })),
        withCrossings('2026-11-09', crossed({ target: { first: on('2026-11-06') } })),
      ]),
      { Plot },
    );
    expect(crossingWordsOf(props)).toEqual([undefined, 'Target first reached Fri Nov 6.', 'Target first reached Fri Nov 6.']);
  });
});

describe('Replay: a Stop run and a Stop crossed earlier (decision 2)', () => {
  it('should say Past the Stop since Mon Nov 9 on each session of the run, and Stop first breached Mon Nov 9 once the Stop is no longer crossed', () => {
    const run = { first: on('2026-11-09'), since: on('2026-11-09') };
    const props = replayProps(
      view([
        withCrossings('2026-11-09', crossed({ stop: run })),
        withCrossings('2026-11-10', crossed({ stop: { ...run, first: on('2026-11-09') } })),
        withCrossings('2026-11-11', crossed({ stop: { first: on('2026-11-09') } })),
      ]),
      { Plot },
    );
    expect(crossingWordsOf(props)).toEqual(['Past the Stop since Mon Nov 9.', 'Past the Stop since Mon Nov 9.', 'Stop first breached Mon Nov 9.']);
  });
});

describe('Replay: a crossing first seen after a session with no Mark (decision 2)', () => {
  it('should say first seen after a session with no Mark, never an earlier date', () => {
    const props = replayProps(
      view([
        withCrossings('2026-11-06', crossed({ target: { first: on('2026-11-06', true), since: on('2026-11-06', true) } })),
        withCrossings('2026-11-09', crossed({ stop: { first: on('2026-11-09', true), since: on('2026-11-09', true) } })),
        withCrossings('2026-11-10', crossed({ stop: { first: on('2026-11-09', true) } })),
      ]),
      { Plot },
    );
    expect(crossingWordsOf(props)).toEqual(['Target reached, first seen Fri Nov 6.', 'Past the Stop, first seen Mon Nov 9.', 'Stop breached, first seen Mon Nov 9.']);
  });
});

describe('Replay: a first crossing in the card Events (decision 2)', () => {
  it('should list Target first reached and Stop first breached in the Events of the card of the session it happened in only', () => {
    const props = replayProps(
      view([
        withCrossings('2026-11-05', crossed({})),
        withCrossings('2026-11-06', crossed({ target: { first: on('2026-11-06'), since: on('2026-11-06') } })),
        withCrossings('2026-11-09', crossed({ stop: { first: on('2026-11-09'), since: on('2026-11-09') }, target: { first: on('2026-11-06') } })),
      ]),
      { Plot },
    );
    expect(props.sessions.map((s) => s.card.events)).toEqual([[], ['Target first reached'], ['Stop first breached']]);
  });
});

describe('The Plan beside what happened: carried from the Stage A gate (critic-2, section 1.8)', () => {
  it('should show an option strike in The Plan block in W40 words, so every chart figure is also off the chart', () => {
    expect(planOf(fullView([brenMon1102], { ...PLAN, terms: BREN_TERMS }))?.rows).toContain('Strike $100');
    expect(planOf({ ...view([daleWed1111], { ...DALE_PLAN, terms: DALE_TERMS }), instruments: [DALE] })?.rows).toContain('Strike $57.50');
    // A stock has no strike.
    const stockTerms: Terms = { legs: [{ instrument: AXIO, side: 'Long', quantity: Rational.of(200n), entryPrice: usd(50) }], conditions: [] };
    expect(planOf({ ...view([session({ date: '2026-11-02', instrument: AXIO, held: 200, pnl: 0 })], { ...PLAN_AXIO, terms: stockTerms }), instruments: [AXIO] })?.rows.some((row) => row.startsWith('Strike'))).toBe(false);
  });
});

describe('An Expiration in the readout Position group (critic-2, section 1.8, defect 4)', () => {
  it('should name an Expiration Expiration, Fri Nov 20 with Expired in the readout Position group, never Execution', () => {
    const expiry = marker({ instrument: DALE, action: 'Expire', quantity: usd(3) }, 'Expiration');
    const props = replayProps(view([{ ...session({ date: '2026-11-20', instrument: DALE, held: 0, pnl: 444 }), markers: [expiry] }]), { Plot });
    expect(rowsOfGroup(props, 0, 'Position')).toEqual({ 'Expiration, Fri Nov 20': 'Expired' });
  });
});

