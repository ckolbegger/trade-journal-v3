import { describe, expect, it } from 'vitest';
import { replayProps } from './replay.props.ts';
import { AXIO, BREN, brenMon1102, brenWed1111, BREN_STOCK, condition, frac, fullView, markOf, Plot, PLAN, session, usd, value, view, withMarks } from './view-doubles.props.ts';

describe('replay.props: what the plot draws of a session (W39 to W41, W44)', () => {
  const sale = { id: 'x2', kind: 'Execution', effect: 'Reduced', fills: [{ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4) }] } as const;
  const buy = { id: 'x1', kind: 'Execution', effect: 'Opened', fills: [{ instrument: BREN, action: 'Buy', quantity: usd(4), price: usd(1.68) }] } as const;
  const expiry = { id: 'x3', kind: 'Expiration', effect: 'Closed', fills: [{ instrument: BREN, action: 'Expire', quantity: usd(2) }] } as const;

  it('should tag a losing Worst case with its finished figure and the extremes’ weight, and tag none where there is no loss', () => {
    const at = (worst: number, extremes?: 'Main' | 'Remote') =>
      session({ date: '2026-11-09', pnl: -720, outcomes: { atStop: value(usd(-1263)), atTarget: value(usd(-273)), atWorstCase: value(usd(worst)) }, ...(extremes && { figures: { extremes } }) });
    const tags = (spec: ReturnType<typeof at>) => replayProps(fullView([spec], PLAN), { Plot }).sessions[0]!.plot.worstCaseTag;
    expect(tags(at(-33936, 'Remote'))).toEqual({ label: 'Worst case −$33,936 ↓', weight: 'Remote' });
    expect(tags(at(-33936, 'Main'))).toEqual({ label: 'Worst case −$33,936 ↓', weight: 'Main' });
    // A screen shown no weight treats it as Main; a Worst case that is no loss has no tag to draw.
    expect(tags(at(-33936))?.weight).toBe('Main');
    expect(tags(at(156))).toBeUndefined();
  });

  it('should give the plot each session Marks, result, banked and Stop and Target as numbers beside their finished labels', () => {
    const wed = { ...brenWed1111, realizedPnl: usd(478), markers: [sale] };
    const props = replayProps(fullView([wed], PLAN), { Plot });
    expect(props.sessions[0]!.plot).toEqual({
      keyEntries: [
        { kind: 'Mark', label: 'Mark' },
        { kind: 'TradePnl', label: 'Open profit' },
        { kind: 'Banked', label: 'Realized', tone: 'gain' },
        { kind: 'BreakEven', label: 'Break-even' },
        { kind: 'Stop', label: 'At Stop' },
        { kind: 'Target', label: 'At Target' },
        { kind: 'Strike', label: 'Strike' },
        { kind: 'Execution', label: 'Execution' },
      ],
      slot: 0,
      dateLabel: 'Wed Nov 11',
      underlyingMark: 101.8,
      underlyingLabel: '$101.80',
      tradePnl: 520,
      banked: 478,
      bankedLabel: 'Realized +$478',
      resultAtStop: { value: -324, label: 'Stop −$324' },
      resultAtTarget: { value: 956, label: 'Target +$956' },
      worstCase: null,
      maxReward: null,
      stake: { riskLabel: 'Current Risk $352', riskShortLabel: 'Risk $352', rewardLabel: 'Remaining Reward $928', rewardShortLabel: 'Reward $928' },
      markers: [{ id: 'x2', kind: 'Execution', effect: 'Reduced', label: 'Sold 2 at $4.00', shortLabel: 'Sold 2', isEntry: false }],
    });
  });

  it('should list No Mark in the key for a session whose result is missing though the Underlying has a Mark (W66)', () => {
    const noResult = withMarks(session({ date: '2026-11-16', pnl: null }), [markOf(BREN_STOCK, '100.20')]);
    const labels = (spec: ReturnType<typeof session>) => replayProps(fullView([spec], PLAN), { Plot }).sessions[0]!.plot.keyEntries!.map((e) => e.label);
    expect(labels(noResult)).toContain('No Mark');
    expect(labels(withMarks(session({ date: '2026-11-16', pnl: 10 }), [markOf(BREN_STOCK, '100.20')]))).not.toContain('No Mark');
  });

  // T9AR.24-B8 (critic-1 defect 8; W66): the key lists only what is drawn. W66 has no entry for the Expired marker, so a session with only an Expiration lists no "Execution".
  it('should list no Execution in the key for a session whose only marker is the Expiration', () => {
    const labels = (markers: (typeof sale | typeof expiry)[]) =>
      replayProps(fullView([{ ...brenWed1111, markers }], PLAN), { Plot }).sessions[0]!.plot.keyEntries!.map((e) => e.label);
    expect(labels([expiry])).not.toContain('Execution');
    expect(labels([sale])).toContain('Execution');
  });

  it('should label the Worst case and the Max reward, what is past a line, a realized loss and each marker, and draw a session without a Mark as a break', () => {
    const past = withMarks(
      {
        ...session({
          date: '2026-11-13',
          held: 2,
          pnl: 1138,
          standing: value({ zone: 'PastTarget', pastBy: { dollars: usd(182), r: frac(182, 324), crossed: true } }),
          figures: { ongoingRiskToStop: value(usd(672)), incrementalRewardToTarget: value(usd(0)) },
          outcomes: { atStop: value(usd(316)), atTarget: value(usd(956)), atWorstCase: value(usd(156)), atMaxReward: value(usd(564)) },
        }),
        markers: [buy, expiry],
      },
      [markOf(BREN_STOCK, '104.60')],
    );
    const loss = withMarks({ ...session({ date: '2026-11-16', pnl: null, realized: -495 }) }, [markOf(BREN_STOCK, '100.20')]);
    const [one, two] = replayProps(fullView([past, loss], PLAN), { Plot }).sessions.map((s) => s.plot);
    expect(one).toMatchObject({
      slot: 0,
      worstCase: { value: 156, label: 'Worst case +$156' },
      maxReward: { value: 564, label: 'Max reward +$564' },
      past: { line: 'Target', label: '$182 past the Target' },
      // Nothing more to reach: only the Current Risk is tagged.
      stake: { riskLabel: 'Current Risk $672', riskShortLabel: 'Risk $672' },
    });
    expect(one!.markers).toEqual([
      { id: 'x1', kind: 'Execution', effect: 'Opened', label: 'Bought 4 at $1.68', shortLabel: 'Bought 4', isEntry: true },
      { id: 'x3', kind: 'Expiration', effect: 'Closed', label: 'Expired', isEntry: false },
    ]);
    expect(two).toMatchObject({ slot: 1, underlyingMark: 100.2, tradePnl: null, banked: -495, bankedLabel: 'Realized −$495', resultAtStop: null, resultAtTarget: null });
    expect(two).not.toHaveProperty('stake');
  });

  // T9.19-B3: each session's own Worst case and Max reward, so the chart can step them where the Position changes.
  it('should give the plot each session its own Worst case, a loss before the sale and a gain from it', () => {
    const at = (date: string, worst: number, max: number) =>
      withMarks(session({ date, held: 4, pnl: 100, outcomes: { atStop: value(usd(-324)), atTarget: value(usd(956)), atWorstCase: value(usd(worst)), atMaxReward: value(usd(max)) } }), [markOf(BREN_STOCK, '100.20')]);
    const plots = replayProps(fullView([at('2026-11-02', -644, 564), at('2026-11-11', -644, 564), at('2026-11-12', 156, 564)], PLAN), { Plot }).sessions.map((s) => s.plot);
    expect(plots.map((p) => p.worstCase)).toEqual([
      { value: -644, label: 'Worst case −$644' },
      { value: -644, label: 'Worst case −$644' },
      { value: 156, label: 'Worst case +$156' },
    ]);
    expect(plots.map((p) => p.maxReward?.value)).toEqual([564, 564, 564]);
  });

  it('should keep the reward tag after a Stop breach', () => {
    const pastStop = session({
      date: '2026-11-09',
      instrument: AXIO,
      held: 100,
      pnl: -920,
      standing: value({ zone: 'PastStop', pastBy: { dollars: usd(180), r: frac(3, 10), crossed: true } }),
      figures: { ongoingRiskToStop: value(usd(0)), incrementalRewardToTarget: value(usd(1080)) },
    });
    const plot = replayProps(view([pastStop]), { Plot }).sessions[0]!.plot;
    expect(plot.stake).toEqual({ rewardLabel: 'Remaining Reward $1,080', rewardShortLabel: 'Reward $1,080' });
  });

  it('should place each session in its own weekday slot, leaving a holiday blank', () => {
    // Wed 11-25, then Fri 11-27 (Thanksgiving Thu 11-26 has no session), then Mon 11-30.
    const days = ['2026-11-25', '2026-11-27', '2026-11-30'].map((date) => withMarks(session({ date, pnl: 10 }), [markOf(BREN_STOCK, '100.00')]));
    const props = replayProps(fullView(days, PLAN), { Plot });
    expect(props.sessions.map((s) => s.plot.slot)).toEqual([0, 2, 3]);
    expect(props.sessions.map((s) => s.plot.slot)).not.toContain(1);
  });
});

describe('replay.props: the plot titles, anchors and time axis (W39, W40, A256)', () => {
  it('should title the charts, name the Plan anchors, and run an option Trade axis to its expiration day', () => {
    const wed = { ...brenWed1111, figures: { ...brenWed1111.figures!, conditions: [condition('Stop', 'UnderlyingPrice', '96.00'), condition('Target', 'UnderlyingPrice', '104.00')] } };
    const mon = withMarks(session({ date: '2026-11-09', pnl: 28 }), [markOf(BREN_STOCK, '97.20'), markOf(BREN, '1.61')]);
    const { plotBase } = replayProps(fullView([mon, wed], PLAN), { Plot });
    expect(plotBase).toEqual({
      priceTitle: 'BREN price · one Mark per session',
      priceShortTitle: 'BREN price',
      pnlTitle: 'Trade P&L',
      accessibleName: 'BREN Marks and Trade P&L by session',
      describedBy: 'replay-cards-T-1',
      anchors: {
        priceLines: [
          { kind: 'Strike', price: 100, label: 'Strike $100' },
          { kind: 'Stop', price: 96, label: 'Stop $96.00' },
          { kind: 'Target', price: 104, label: 'Target $104.00' },
        ],
        planAtStop: { value: -324, label: 'Stop −$324' },
        planAtTarget: { value: 956, label: 'Target +$956' },
      },
      // Mon Nov 9 to Fri Nov 20: ten trading days, the later ones left blank until the slider reaches them.
      axis: { slots: 10, startLabel: 'Mon Nov 9', endLabels: ['Expires Fri Nov 20', 'Expires Nov 20', 'Exp Nov 20'] },
    });
  });

  it('should show a one-line key under the charts naming each thing drawn so far and nothing else: the entries each session names', () => {
    const sale = { id: 'x2', kind: 'Execution', effect: 'Reduced', fills: [{ instrument: BREN, action: 'Sell', quantity: usd(2), price: usd(4) }] } as const;
    const wed = { ...brenWed1111, realizedPnl: usd(478), markers: [sale] };
    const mon = brenMon1102;
    const props = replayProps(fullView([mon, wed], PLAN), { Plot });
    // Quiet Mon 11-02: no Realized and no Execution. Wed 11-11 has both; each entry is named on the session where it first appears.
    expect(props.sessions[0]!.plot.keyEntries!.map((e) => e.label)).not.toContain('Realized');
    expect(props.sessions[1]!.plot.keyEntries).toEqual(
      expect.arrayContaining([
        { kind: 'Mark', label: 'Mark' },
        { kind: 'TradePnl', label: 'Open profit' },
        { kind: 'Banked', label: 'Realized', tone: 'gain' },
        { kind: 'BreakEven', label: 'Break-even' },
        { kind: 'Stop', label: 'At Stop' },
        { kind: 'Target', label: 'At Target' },
        { kind: 'Strike', label: 'Strike' },
        { kind: 'Execution', label: 'Execution' },
      ]),
    );
  });

  it('should label the time axis with the first session date at the left and Expires Fri Nov 20 at the right on an option: the props', () => {
    const wed = { ...brenWed1111, figures: { ...brenWed1111.figures!, conditions: [] } };
    const mon = withMarks(session({ date: '2026-11-09', pnl: 28 }), [markOf(BREN_STOCK, '97.20'), markOf(BREN, '1.61')]);
    expect(replayProps(fullView([mon, wed], PLAN), { Plot }).plotBase.axis).toEqual({ slots: 10, startLabel: 'Mon Nov 9', endLabels: ['Expires Fri Nov 20', 'Expires Nov 20', 'Exp Nov 20'] });
  });

  it('should supply the option end label as three finished forms, longest first', () => {
    const wed = { ...brenWed1111, figures: { ...brenWed1111.figures!, conditions: [] } };
    const mon = withMarks(session({ date: '2026-11-09', pnl: 28 }), [markOf(BREN_STOCK, '97.20'), markOf(BREN, '1.61')]);
    expect(replayProps(fullView([mon, wed], PLAN), { Plot }).plotBase.axis.endLabels).toEqual(['Expires Fri Nov 20', 'Expires Nov 20', 'Exp Nov 20']);
  });

  it('should supply no end label forms on a stock Trade', () => {
    const sessions = ['2026-11-02', '2026-11-03'].map((date) => session({ date, instrument: AXIO, held: 200, pnl: 10 }));
    const axis = replayProps({ ...view(sessions), instruments: [AXIO] }, { Plot }).plotBase.axis;
    expect('endLabels' in axis).toBe(false);
  });

  it('should show nothing at the right end of a stock Trade time axis at any session', () => {
    // R-AXIO-U: twelve sessions, the last on Tue Nov 17; at 1 of 12 that date must not be named anywhere.
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17'];
    const sessions = days.map((date) => session({ date, instrument: AXIO, held: 200, pnl: 10 }));
    const props = replayProps({ ...view(sessions), instruments: [AXIO] }, { Plot });
    expect(props.plotBase.axis).toEqual({ slots: 12, startLabel: 'Mon Nov 2' });
    expect(JSON.stringify([props.plotBase, props.sessions[0]!.plot])).not.toContain('Tue Nov 17');
    expect(props.sessions.at(-1)!.plot.dateLabel).toBe('Tue Nov 17');
  });

  it('should title the P&L chart Trade P&L at every width', () => {
    const { plotBase } = replayProps(fullView([brenMon1102], PLAN), { Plot });
    expect(plotBase.pnlTitle).toBe('Trade P&L');
  });

  it('should end a stock Trade axis on its last session, and anchor it at the price it was bought at', () => {
    const buy = { id: 'x1', kind: 'Execution', effect: 'Opened', fills: [{ instrument: AXIO, action: 'Buy', quantity: usd(200), price: usd(48) }] } as const;
    const fri = { ...session({ date: '2026-11-06', instrument: AXIO, held: 200, pnl: -380 }), markers: [buy] };
    const mon = session({ date: '2026-11-09', instrument: AXIO, held: 200, pnl: -920 });
    const { plotBase } = replayProps({ ...view([fri, mon]), instruments: [AXIO] }, { Plot });
    expect(plotBase.anchors.entryPrice).toBe(48);
    expect(plotBase.axis).toEqual({ slots: 2, startLabel: 'Fri Nov 6' });
    expect(plotBase.priceTitle).toBe('AXIO price · one Mark per session');
  });
});

// T9.19-B4 (PD4): what is at stake from here is separate from where the Trade would end.
describe('replay.props: the readout separates what is at stake from where the Trade ends (T9.19-B4)', () => {
  it('should tag what is at stake Current Risk and Remaining Reward, with Risk and Reward as the phone forms', () => {
    const props = replayProps(fullView([brenMon1102], PLAN), { Plot });
    expect(props.sessions[0]!.plot.stake).toEqual({ riskLabel: 'Current Risk $352', riskShortLabel: 'Risk $352', rewardLabel: 'Remaining Reward $928', rewardShortLabel: 'Reward $928' });
  });
});

describe('Corridor: a first crossing (decision 2)', () => {
  const none = { conditions: [] };
  const crossings = (stop?: string, target?: string) => ({
    stop: { ...none, ...(stop && { first: { date: stop, afterGap: false }, since: { date: stop, afterGap: false } }) },
    target: { ...none, ...(target && { first: { date: target, afterGap: false }, since: { date: target, afterGap: false } }) },
  });
  const day = (date: string, c: ReturnType<typeof crossings>) => ({ ...withMarks(session({ date, pnl: 100 }), [markOf(BREN_STOCK, '100.20')]), crossings: c });

  it('should flag a line at the session its condition was first crossed, labelled "Target reached" (R-CORV-D Fri 11-06) or "Stop breached" (R-AXIO-D Mon 11-09), and keep the flag on later sessions', () => {
    // R-CORV-D: the Target first reached on Fri 11-06 and still crossed on Mon 11-09; the flag is on the session of the first crossing only,
    // and the plot, given every revealed session, keeps it on screen. Not crossed yet: no flag.
    const target = replayProps(fullView([day('2026-11-05', crossings()), day('2026-11-06', crossings(undefined, '2026-11-06')), day('2026-11-09', crossings(undefined, '2026-11-06'))], PLAN), { Plot }).sessions.map((s) => s.plot);
    expect(target.map((p) => p.firstCrossing)).toEqual([undefined, [{ line: 'Target', label: 'Target reached' }], undefined]);
    expect(target.map((p) => p.keyEntries?.some((e) => e.kind === 'FirstCrossing' && e.label === 'Target reached'))).toEqual([false, true, false]);
    // R-AXIO-D: the Stop breached on Mon 11-09.
    const stop = replayProps(fullView([day('2026-11-09', crossings('2026-11-09'))], PLAN), { Plot }).sessions[0]!.plot;
    expect(stop.firstCrossing).toEqual([{ line: 'Stop', label: 'Stop breached' }]);
  });

  it('should flag both the Stop and the Target on a session where both were first crossed, and name both in the key', () => {
    const both = replayProps(fullView([day('2026-11-09', crossings('2026-11-09', '2026-11-09'))], PLAN), { Plot }).sessions[0]!.plot;
    expect(both.firstCrossing).toEqual([
      { line: 'Stop', label: 'Stop breached' },
      { line: 'Target', label: 'Target reached' },
    ]);
    expect(both.keyEntries?.filter((e) => e.kind === 'FirstCrossing').map((e) => e.label)).toEqual(['Stop breached', 'Target reached']);
  });
});
