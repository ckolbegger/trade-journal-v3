// @vitest-environment jsdom
import { act, cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DailyTradeReview, MeterReading } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { payoffFixtures } from '../../../tests/support/payoff-fixtures.ts';
import { optionOpenDetail } from '../../../tests/support/option-detail-fixtures.ts';
import { OS2_S1 } from '../../../tests/support/option-trade-fixtures.ts';
import { Meter } from '../cockpit/meter/meter.tsx';
import { meterProps } from '../cockpit/meter/meter.props.ts';
import { NowBox } from './NowBox.tsx';

afterEach(cleanup);

type Evaluation = NonNullable<DailyTradeReview['evaluation']>;

const rational = (n: bigint, d = 1n) => Rational.of(n, d);
const value = (n: bigint, d = 1n) => ({ kind: 'Value' as const, value: rational(n, d) });
const symbol = { kind: 'Stock' as const, symbol: 'AXIO' };
const planBaseline = { kind: 'Value' as const, value: { originalPlannedRisk: rational(600n), originalPlannedReward: rational(174n), rewardRiskRatio: rational(29n, 100n), oneR: rational(600n) } };

const CROSSED = { Stop: 'Breached', Target: 'Reached' } as const;
const condition = (role: 'Stop' | 'Target', boundary: string, trigger: { distance: Rational; beyond: Rational | null }) => ({
  id: `${role.toLowerCase()}-1`,
  role,
  kind: 'UnderlyingPrice',
  boundary,
  result: { kind: 'Value', value: { status: trigger.beyond ? CROSSED[role] : 'Active', trigger } },
});

// AXIO, 200 shares at $50.00 with the Stop at $47.00 and the Target at $55.40: inside the lines at $45.10, the result -$980.00 is 66% of the way to the Stop.
function evaluation(over: Record<string, unknown> = {}): Evaluation {
  return {
    kind: 'Evaluated',
    valuationDate: '2026-11-16',
    observation: { instrument: symbol, tradingDate: '2026-11-16', mark: { revisionId: 'r1', revisionNumber: 1, price: '45.10' } },
    conditions: [
      condition('Stop', '47.00', { distance: rational(480n, 100n), beyond: null }),
      condition('Target', '54.50', { distance: rational(270n, 100n), beyond: null }),
    ],
    currentMarkedPnl: value(-980n),
    currentMarkedPnlInPlanR: value(-49n, 30n),
    ongoingRiskToStop: value(1314n),
    ongoingRiskToStopInPlanR: value(167n, 50n),
    worstCaseOngoingRisk: value(4510n),
    worstCaseOngoingRiskInPlanR: value(752n, 100n),
    incrementalRewardToTarget: value(1080n),
    incrementalRewardToTargetInPlanR: value(9n, 5n),
    maximumIncrementalReward: { kind: 'Unbounded', direction: 'Above' },
    rewardRiskNow: value(51n, 100n),
    realizedToDate: value(0n),
    remainingOpenPnl: value(-980n),
    expirationValueAtUnderlyingClose: { kind: 'NotApplicable', reason: 'NoOptionExpirationAnchor' },
    settlement: [],
    planBaseline,
    standing: { kind: 'Value', value: { zone: 'Between' } },
    ...over,
  } as unknown as Evaluation;
}

// The meter's reading of an evaluation, as the Review's coordinator reads it: the rails at the Stop and the Target, the result now and where it stands.
const readingOf = (e: Evaluation): MeterReading => {
  const { standing, currentMarkedPnl: pnl, outcomes } = e;
  if (standing?.kind !== 'Value' || pnl.kind !== 'Value' || !outcomes) throw new Error('expected a standing, a P&L and outcomes');
  return { stop: outcomes.atStop, target: outcomes.atTarget, banked: e.realizedToDate, now: { kind: 'Value', value: { pnl: pnl.value, zone: standing.value.zone, ...(standing.value.pastBy && { pastBy: standing.value.pastBy }) } } };
};

const meter = (over: Partial<MeterReading> = {}): MeterReading => ({
  stop: value(-2294n),
  target: value(100n),
  banked: value(0n),
  now: { kind: 'Value', value: { pnl: rational(-980n), zone: 'Between', share: { fraction: rational(2n, 3n), percent: rational(42n), toward: 'Stop' } } },
  previous: { tradingDate: '2026-11-13', pnl: rational(-930n), direction: 'Down' },
  ...over,
});

function trade(over: Partial<DailyTradeReview> = {}): DailyTradeReview {
  return { tradeId: 't1', underlying: 'AXIO', evaluation: evaluation(), replay: { meter: meter(), sessions: [], instruments: [symbol] }, settlement: [], saveBinding: { reviewDate: '2026-11-16' }, ...over } as unknown as DailyTradeReview;
}

const call = { kind: 'Option' as const, symbol: 'AXIO', root: 'AXIO', expiration: '2026-11-20', right: 'Call' as const, strike: '50', multiplier: 100 };
const markOf = (instrument: unknown, price: string, change?: bigint) => ({
  instrument,
  resolution: { kind: 'Available', mark: { revisionId: 'r1', revisionNumber: 1, price, source: 'Manual', savedAt: '2026-11-16T21:00:00Z' } },
  change: change === undefined ? null : { since: '2026-11-13', dollars: rational(change, 100n) },
});
const replayOf = (marks: readonly unknown[], over: Record<string, unknown> = {}) => ({ meter: meter(), instruments: marks.map((m) => (m as { instrument: unknown }).instrument), sessions: [{ date: '2026-11-16', marks }], ...over });

// The fixture keeps the walked Trade's reading on its replay stub; the card's own read carries none, so the box is handed it beside the card.
const Box = ({ trade: card }: { trade: DailyTradeReview }) => <NowBox trade={card} meter={(card.replay as { meter?: MeterReading } | undefined)?.meter} />;

describe('the "Now" box (T95.17)', () => {
  it('should head the box Now with the Review Date, or At the Fri Nov 13 Marks before the Review Date Marks are saved', () => {
    const { container } = render(<Box trade={trade()} />);
    expect(within(container).getByRole('heading', { name: 'Now · Mon Nov 16' })).toBeTruthy();
    cleanup();

    const gone = { kind: 'Unavailable', reason: 'MarkMissing', instrument: symbol, date: '2026-11-16' };
    const waiting = trade({
      evaluation: evaluation({ currentMarkedPnl: gone, observation: { instrument: symbol, tradingDate: '2026-11-16', mark: null } }),
      datedLastClose: { tradingDate: '2026-11-13', evaluation: evaluation({ valuationDate: '2026-11-13' }), meter: meter() },
    });
    const dated = render(<Box trade={waiting} />);
    expect(within(dated.container).getByRole('heading', { name: 'At the Fri Nov 13 Marks' })).toBeTruthy();
    expect(within(dated.container).queryByRole('heading', { name: /^Now/ })).toBeNull();
  });

  it('should show the Marks line: each Instrument Mark and its change', () => {
    const stock = render(<Box trade={trade({ replay: replayOf([markOf(symbol, '45.10', -50n)]) as never })} />);
    expect(stock.container.querySelector('.now-marks')?.textContent).toBe('AXIO $45.10 −$0.50');
    cleanup();

    const both = render(<Box trade={trade({ replay: replayOf([markOf(call, '1.20', 5n), markOf(symbol, '53.20', 120n)]) as never })} />);
    expect(both.container.querySelector('.now-marks')?.textContent).toBe('Call $1.20 +$0.05 · AXIO $53.20 +$1.20');
    cleanup();

    const none = { instrument: symbol, resolution: { kind: 'Missing' }, change: null };
    const gap = render(<Box trade={trade({ replay: replayOf([none]) as never })} />);
    expect(gap.container.querySelector('.now-marks')?.textContent).toBe('AXIO No Mark');
  });

  it('should draw the bar with the Stop and Target figures above it and no $0 label', () => {
    const { container } = render(<Box trade={trade()} />);

    const drawing = container.querySelector('[data-testid="now-drawing"]')!;
    expect(drawing).toBeTruthy();
    const bar = within(drawing as HTMLElement).getByRole('img');
    const stop = within(drawing as HTMLElement).getByText('Stop −$2,294.00');
    const target = within(drawing as HTMLElement).getByText('Target +$100.00');
    // Above the bar, each at the bar's own mark for it.
    expect(stop.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(target.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(stop.style.left).toBe(bar.querySelector<HTMLElement>('[data-testid="meter-stop"]')!.style.left);
    expect(target.style.left).toBe(bar.querySelector<HTMLElement>('[data-testid="meter-target"]')!.style.left);
    // Break-even is a tick on the bar and says nothing.
    expect(drawing.textContent).not.toMatch(/\$0(\.00)?(?!\d)/);
    expect(bar.querySelector('[data-testid="meter-even"]')).toBeTruthy();
  });

  it('should check again whether the labels overlap when their text widens with the same positions', () => {
    // A label's box is as wide as its text, at its own left offset: a short Stop label clears the Target's, a wider one reaches it.
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      // The label stands at its percent of a 1000px bar and is shifted back by that share of its own width, as the drawing styles it.
      const share = Number.parseFloat((this as HTMLElement).style.left || '0') / 100;
      const width = (this.textContent ?? '').length * 30;
      const left = share * 1000 - share * width;
      return { left, right: left + width, top: 0, bottom: 10, width, height: 10, x: left, y: 0, toJSON: () => ({}) };
    });
    try {
      const narrow = trade({ replay: replayOf([], { meter: meter() }) as never });
      const { container, rerender } = render(<Box trade={narrow} />);
      const targetRow = () => container.querySelector<HTMLElement>('.now-label[data-line="target"]')!.dataset['row'];
      const stopLeft = () => container.querySelector<HTMLElement>('.now-label[data-line="stop"]')!.style.left;
      const was = stopLeft();
      expect(targetRow()).toBe('1');

      // Every figure a million times larger: the same places on the bar, much wider words.
      const wide = meter({
        stop: value(-2294000000n),
        target: value(100000000n),
        now: { kind: 'Value', value: { pnl: rational(-980000000n), zone: 'Between', share: { fraction: rational(2n, 3n), percent: rational(42n), toward: 'Stop' } } },
      });
      rerender(<Box trade={trade({ replay: replayOf([], { meter: wide }) as never })} />);
      expect(stopLeft()).toBe(was);
      expect(container.querySelector('.now-label[data-line="stop"]')!.textContent.length).toBeGreaterThan(20);
      expect(container.querySelector('[data-testid="meter-pointer"]')).toBeTruthy();
      expect(targetRow()).toBe('2');
    } finally {
      rect.mockRestore();
    }
  });

  it('should draw a red arrow from now to the Stop and a green arrow to the Target, each with its caption', () => {
    const { container } = render(<Box trade={trade()} />);

    const arrow = (line: string) => container.querySelector<HTMLElement>(`[data-arrow="${line}"]`);
    expect(arrow('stop')?.dataset).toMatchObject({ tone: 'loss', direction: 'left', row: '1' });
    expect(arrow('target')?.dataset).toMatchObject({ tone: 'profit', direction: 'right', row: '1' });
    const caption = (line: string) => container.querySelector<HTMLElement>(`[data-caption="${line}"]`);
    expect(caption('stop')?.textContent).toBe('−$4.80 to Stop (lose another −$1,314.00)');
    expect(caption('target')?.textContent).toBe('+$2.70 to Target (gain $1,080.00)');
    expect(caption('stop')?.dataset['tone']).toBe('loss');
    expect(caption('target')?.dataset['tone']).toBe('profit');
  });

  it('should run both arrows the same way on two rows once a line is passed, and caption the line passed in bold', () => {
    const stopPassed = trade({
      evaluation: evaluation({
        currentMarkedPnl: value(-2594n),
        ongoingRiskToStop: value(0n),
        incrementalRewardToTarget: value(2694n),
        standing: { kind: 'Value', value: { zone: 'PastStop', pastBy: { dollars: rational(300n), r: rational(1n, 2n), crossed: true } } },
        conditions: [condition('Stop', '47.00', { distance: rational(0n), beyond: rational(300n, 100n) }), condition('Target', '54.50', { distance: rational(780n, 100n), beyond: null })],
      }),
      replay: replayOf([], { meter: meter({ now: { kind: 'Value', value: { pnl: rational(-2594n), zone: 'PastStop', pastBy: { dollars: rational(300n) } as never } } }) }) as never,
    });
    const first = render(<Box trade={stopPassed} />);

    const arrow = (root: HTMLElement, line: string) => root.querySelector<HTMLElement>(`[data-arrow="${line}"]`);
    expect(arrow(first.container, 'stop')?.dataset).toMatchObject({ direction: 'right', row: '1' });
    expect(arrow(first.container, 'target')?.dataset).toMatchObject({ direction: 'right', row: '2' });
    const caption = (root: HTMLElement, line: string) => root.querySelector<HTMLElement>(`[data-caption="${line}"]`);
    expect(caption(first.container, 'stop')?.textContent).toBe('$3.00 past Stop (−$300.00 so far)');
    expect(caption(first.container, 'stop')?.querySelector('b')).toBeTruthy();
    expect(caption(first.container, 'target')?.querySelector('b')).toBeNull();
    cleanup();

    const targetPassed = trade({
      evaluation: evaluation({
        currentMarkedPnl: value(132n),
        incrementalRewardToTarget: value(0n),
        ongoingRiskToStop: value(2426n),
        standing: { kind: 'Value', value: { zone: 'PastTarget', pastBy: { dollars: rational(32n), r: rational(1n, 20n), crossed: true } } },
        conditions: [condition('Stop', '47.00', { distance: rational(1213n, 100n), beyond: null }), condition('Target', '54.50', { distance: rational(0n), beyond: rational(16n, 100n) })],
      }),
      replay: replayOf([], { meter: meter({ now: { kind: 'Value', value: { pnl: rational(132n), zone: 'PastTarget', pastBy: { dollars: rational(32n) } as never } } }) }) as never,
    });
    const second = render(<Box trade={targetPassed} />);

    expect(arrow(second.container, 'target')?.dataset).toMatchObject({ direction: 'left', row: '1' });
    expect(arrow(second.container, 'stop')?.dataset).toMatchObject({ direction: 'left', row: '2' });
    expect(caption(second.container, 'target')?.textContent).toBe('$0.16 past Target (+$32.00 so far)');
    expect(caption(second.container, 'target')?.querySelector('b')).toBeTruthy();
    expect(caption(second.container, 'stop')?.querySelector('b')).toBeNull();
  });

  it('should say another only while the Trade is losing', () => {
    const caption = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-caption="stop"]')?.textContent;
    const losing = render(<Box trade={trade()} />);
    expect(caption(losing.container)).toBe('−$4.80 to Stop (lose another −$1,314.00)');
    cleanup();

    const ahead = render(<Box trade={trade({ evaluation: evaluation({ currentMarkedPnl: value(500n), ongoingRiskToStop: value(2794n) }) })} />);
    expect(caption(ahead.container)).toBe('−$4.80 to Stop (lose −$2,794.00)');
  });

  it('should show Worst case and Max reward, with No limit and No cap', () => {
    const row = (root: HTMLElement, term: string) => within(root).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    const stock = render(<Box trade={trade()} />);
    expect(row(stock.container, 'Worst case')).toBe('$4,510.00 more · 7.52R');
    expect(row(stock.container, 'Max reward')).toBe('No cap');
    cleanup();

    const short = render(
      <Box
        trade={trade({
          evaluation: evaluation({ worstCaseOngoingRisk: { kind: 'Unbounded', direction: 'Above' }, worstCaseOngoingRiskInPlanR: { kind: 'Unbounded', direction: 'Above' }, maximumIncrementalReward: value(22140n), maximumIncrementalRewardInPlanR: value(3690n, 100n) }),
        })}
      />,
    );
    expect(row(short.container, 'Worst case')).toBe('No limit');
    expect(row(short.container, 'Max reward')).toBe('$22,140.00 more');
    cleanup();

    // A figure the Mark cannot give says why, never 0.
    const gone = { kind: 'Unavailable', reason: 'MarkMissing', instrument: symbol, date: '2026-11-16' };
    const waiting = render(<Box trade={trade({ evaluation: evaluation({ worstCaseOngoingRisk: gone, worstCaseOngoingRiskInPlanR: gone }) })} />);
    expect(row(waiting.container, 'Worst case')).toBe('Mark missing: AXIO, Mon Nov 16');
  });

  it('should show Reward to risk with the Plan ratio only inside the lines, and no odds', () => {
    const odds = { kind: 'Value', value: { targetFirst: rational(8n, 100n), stopFirst: rational(92n, 100n), percent: { targetFirst: rational(8n), stopFirst: rational(92n) } } };
    const inside = render(<Box trade={trade({ evaluation: evaluation({ rewardRiskOdds: odds, planOdds: odds }) })} />);
    expect(within(inside.container).getByText('Reward to risk', { selector: 'dt' }).nextElementSibling?.textContent).toBe('0.51 to 1 · Plan 0.29 to 1');
    expect(inside.container.textContent).not.toMatch(/%|odds/i);
    cleanup();

    const past = render(<Box trade={trade({ evaluation: evaluation({ standing: { kind: 'Value', value: { zone: 'PastStop', pastBy: { dollars: rational(300n), r: rational(1n, 2n), crossed: true } } } }) })} />);
    expect(past.container.textContent).not.toContain('Reward to risk');
  });

  it('should show Realized, open only after a sale', () => {
    const sold = render(<Box trade={trade({ evaluation: evaluation({ realizedToDate: value(-440n), remainingOpenPnl: value(-490n) }) })} />);
    expect(within(sold.container).getByText('Realized, open', { selector: 'dt' }).nextElementSibling?.textContent).toBe('−$440.00 · −$490.00');
    cleanup();

    const held = render(<Box trade={trade()} />);
    expect(within(held.container).queryByText('Realized, open', { selector: 'dt' })).toBeNull();
  });

  it('should show Realized, open after a sale that nets to zero', () => {
    const reduced = { id: 'p2', kind: 'Execution', effect: 'Reduced', fills: [] };
    const breakEven = trade({ evaluation: evaluation({ realizedToDate: value(0n), remainingOpenPnl: value(-490n) }), replay: replayOf([], { sessions: [{ date: '2026-11-16', marks: [], markers: [reduced] }] }) as never });
    const { container } = render(<Box trade={breakEven} />);
    expect(within(container).getByText('Realized, open', { selector: 'dt' }).nextElementSibling?.textContent).toBe('$0.00 · −$490.00');
  });

  it('should show the Expiration row for an option', () => {
    const atClose = { kind: 'Value', value: { underlyingPrice: rational(5320n, 100n), value: rational(-2016n) } };
    const row = (root: HTMLElement) => within(root).queryByText('Expiration', { selector: 'dt' })?.nextElementSibling?.textContent;
    const open = render(<Box trade={trade({ underlying: 'DALE', expiration: { date: '2026-11-20', sessionsLeft: 4 }, evaluation: evaluation({ expirationValueAtUnderlyingClose: atClose }) })} />);
    expect(row(open.container)).toBe('Fri Nov 20 · 4 sessions · with DALE at $53.20 then: −$2,016.00');
    cleanup();

    const last = render(<Box trade={trade({ underlying: 'DALE', expiration: { date: '2026-11-20', sessionsLeft: 1 }, evaluation: evaluation({ expirationValueAtUnderlyingClose: atClose }) })} />);
    expect(row(last.container)).toBe('Fri Nov 20 · 1 session · with DALE at $53.20 then: −$2,016.00');
    cleanup();

    const expired = render(<Box trade={trade({ underlying: 'DALE', expiration: { date: '2026-11-20' }, settlement: [{ tradeId: 't1' }] as never, evaluation: evaluation({ expirationValueAtUnderlyingClose: atClose }) })} />);
    expect(row(expired.container)).toBe('Fri Nov 20 · expired');
    cleanup();

    // The figure the Underlying Mark cannot give says why, never 0.
    const gone = { kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'DALE' }, date: '2026-11-19' };
    const waiting = render(<Box trade={trade({ underlying: 'DALE', expiration: { date: '2026-11-20', sessionsLeft: 4 }, evaluation: evaluation({ expirationValueAtUnderlyingClose: gone }) })} />);
    expect(row(waiting.container)).toBe('Fri Nov 20 · 4 sessions · with DALE then: Mark missing: DALE, Thu Nov 19');
    cleanup();

    const stock = render(<Box trade={trade()} />);
    expect(row(stock.container)).toBeUndefined();
  });

  it('should show the key in words', () => {
    const { container } = render(<Box trade={trade()} />);
    expect([...container.querySelectorAll('.now-key li')].map((item) => item.textContent)).toEqual(['Realized', 'open', 'past the line', 'session before', 'now', 'Stop', 'Target']);
  });

  it('should hold only an option expiration figures behind More figures', () => {
    const option = render(<Box trade={trade({ payoff: payoffFixtures.osPayoffs() })} />);
    const fold = option.container.querySelector('details');
    expect(fold?.querySelector('summary')?.textContent).toBe('More figures');
    expect(fold?.hasAttribute('open')).toBe(false);
    expect(fold?.textContent).toMatch(/At expiration: breakeven .* · max profit .* · max loss /);
    cleanup();

    const stock = render(<Box trade={trade()} />);
    expect(stock.container.querySelector('details')).toBeNull();
  });

  it('should give the drawing the shared meter sentence as its accessible name', () => {
    const reading = meter({ banked: value(-440n) });
    const alone = render(<Meter {...meterProps(reading, 'card', undefined)!} />);
    const sentence = alone.container.querySelector('[role="img"]')!.getAttribute('aria-label');
    expect(sentence).toMatch(/^P&L .* Realized −\$440\.00\. Stop −\$2,294\.00, Target \+\$100\.00\./);
    cleanup();

    const { container } = render(<Box trade={trade({ replay: replayOf([], { meter: reading }) as never })} />);
    const drawing = container.querySelector<HTMLElement>('[data-testid="now-drawing"]')!;
    const images = within(drawing).getAllByRole('img');
    expect(images).toHaveLength(1);
    expect(images[0]!.getAttribute('aria-label')).toBe(sentence);
    expect(within(drawing).getByRole('img', { name: sentence! }).getAttribute('title')).toBe(sentence);
  });

  it('should keep the renamed figures canonical term as hover text', () => {
    const { container } = render(<Box trade={trade()} />);
    expect(within(container).getByText('Worst case', { selector: 'dt' }).getAttribute('title')).toBe('Worst-Case Ongoing Risk');
    expect(within(container).getByText('Max reward', { selector: 'dt' }).getAttribute('title')).toBe('Maximum Incremental Reward');
  });

  it('should give the extremes the Plan weight', () => {
    const weight = (root: HTMLElement) => ['Worst case', 'Max reward'].map((term) => within(root).getByText(term, { selector: 'dt' }).parentElement?.getAttribute('data-weight'));
    const remote = render(<Box trade={trade({ evaluation: evaluation({ extremes: 'Remote' }) })} />);
    expect(weight(remote.container)).toEqual(['Remote', 'Remote']);
    cleanup();

    const main = render(<Box trade={trade({ evaluation: evaluation({ extremes: 'Main' }) })} />);
    expect(weight(main.container)).toEqual(['Main', 'Main']);
  });

  it('should word a Reward to risk the Mark cannot give, never as 0', () => {
    const gone = { kind: 'Unavailable', reason: 'MarkMissing', instrument: symbol, date: '2026-11-16' };
    const ratio = (root: HTMLElement) => within(root).getByText('Reward to risk', { selector: 'dt' }).nextElementSibling?.textContent;
    const waiting = render(<Box trade={trade({ evaluation: evaluation({ rewardRiskNow: gone }) })} />);
    expect(ratio(waiting.container)).toBe('Mark missing: AXIO, Mon Nov 16 · Plan 0.29 to 1');
    cleanup();

    const none = render(<Box trade={trade({ evaluation: evaluation({ rewardRiskNow: { kind: 'NotApplicable', reason: 'EntryAtOrBeyondStop' } }) })} />);
    expect(ratio(none.container)).toBe('Not applicable: entry at or beyond the Stop · Plan 0.29 to 1');
  });

  it('should caption the line a short put has crossed and sign the move to the other by the side its line is on', () => {
    // O-S2 on Wednesday 10-14 (MNO 43.20, the put 3.70): a Cash-Secured Put whose Stop on the option price at or above 3.60 is Breached.
    const detail = optionOpenDetail('O-S2', [OS2_S1], { tradingDate: '2026-10-14', closeInstant: '2026-10-14T20:00:00Z', contractMark: '3.70', underlyingMark: '43.20' });
    const { evaluation: evaluated } = detail.current;
    const { container } = render(<Box trade={trade({ underlying: 'MNO', summary: detail.summary!, evaluation: evaluated, replay: replayOf([], { meter: readingOf(evaluated) }) as never })} />);

    const caption = (line: string) => container.querySelector<HTMLElement>(`[data-caption="${line}"]`);
    expect(caption('stop')?.textContent).toBe('$0.10 past Stop (−$20.00 so far)');
    expect(caption('stop')?.querySelector('b')).toBeTruthy();
    expect(caption('target')?.textContent).toMatch(/^\+\$1\.30 to Target \(gain \$/);
  });

  it('should keep the move to a line while only its dollar amount is passed', () => {
    // B7: the Stop's planned amount is passed, but the Underlying has not reached its trigger.
    const amountOnly = trade({
      evaluation: evaluation({
        currentMarkedPnl: value(-2594n),
        ongoingRiskToStop: value(0n),
        standing: { kind: 'Value', value: { zone: 'PastStop', pastBy: { dollars: rational(300n), r: rational(1n, 2n), crossed: false } } },
        conditions: [condition('Stop', '47.00', { distance: rational(110n, 100n), beyond: null }), condition('Target', '54.50', { distance: rational(780n, 100n), beyond: null })],
      }),
      replay: replayOf([], { meter: meter({ now: { kind: 'Value', value: { pnl: rational(-2594n), zone: 'PastStop', pastBy: { dollars: rational(300n) } as never } } }) }) as never,
    });
    const { container } = render(<Box trade={amountOnly} />);

    const stop = container.querySelector<HTMLElement>('[data-caption="stop"]');
    expect(stop?.textContent).toBe('−$1.10 to Stop (−$300.00 so far)');
    expect(stop?.querySelector('b')).toBeNull();
  });

  it('should read every figure from the dated close while the Review Date Marks are not saved', () => {
    const gone = { kind: 'Unavailable', reason: 'MarkMissing', instrument: symbol, date: '2026-11-16' };
    const waiting = trade({
      evaluation: evaluation({ currentMarkedPnl: gone, worstCaseOngoingRisk: gone, worstCaseOngoingRiskInPlanR: gone, observation: { instrument: symbol, tradingDate: '2026-11-16', mark: null } }),
      datedLastClose: { tradingDate: '2026-11-13', evaluation: evaluation({ valuationDate: '2026-11-13', worstCaseOngoingRisk: value(4000n), worstCaseOngoingRiskInPlanR: value(20n, 3n), ongoingRiskToStop: value(1100n) }), meter: meter() },
      replay: replayOf([], { sessions: [{ date: '2026-11-13', marks: [markOf(symbol, '47.00', -90n)] }, { date: '2026-11-16', marks: [{ instrument: symbol, resolution: { kind: 'Missing' }, change: null }] }] }) as never,
    });
    const { container } = render(<Box trade={waiting} />);

    expect(within(container).getByText('Worst case', { selector: 'dt' }).nextElementSibling?.textContent).toBe('$4,000.00 more · 6.67R');
    expect(container.querySelector('.now-marks')?.textContent).toBe('AXIO $47.00 −$0.90');
    expect(container.querySelector('[data-caption="stop"]')?.textContent).toBe('−$4.80 to Stop (lose another −$1,100.00)');
  });

  it('should caption a line its condition has crossed while the result is still inside the lines, and show no ratio', () => {
    // O-S2 on Wednesday 10-14 with MNO at 40.00 and the put at 1.00: MNO is below the Stop's 41.00 though the result has not passed the Stop's amount.
    const detail = optionOpenDetail('O-S2', [OS2_S1], { tradingDate: '2026-10-14', closeInstant: '2026-10-14T20:00:00Z', contractMark: '1.00', underlyingMark: '40.00' });
    const { evaluation: evaluated } = detail.current;
    const { container } = render(<Box trade={trade({ underlying: 'MNO', summary: detail.summary!, evaluation: evaluated, replay: replayOf([], { meter: readingOf(evaluated) }) as never })} />);

    const stop = container.querySelector<HTMLElement>('[data-caption="stop"]');
    expect(stop?.textContent).toBe('$1.00 past Stop');
    expect(stop?.querySelector('b')).toBeTruthy();
    expect(within(container).queryByText('Reward to risk', { selector: 'dt' })).toBeNull();
  });

  it('should still say what a line is worth when the Mark gives no price distance to it', () => {
    const inside = render(<Box trade={trade({ evaluation: evaluation({ conditions: [] }) })} />);
    expect(inside.container.querySelector('[data-caption="stop"]')?.textContent).toBe('To Stop (lose another −$1,314.00)');
    expect(inside.container.querySelector('[data-caption="target"]')?.textContent).toBe('To Target (gain $1,080.00)');
    cleanup();

    const passed = render(
      <Box
        trade={trade({
          evaluation: evaluation({ conditions: [], currentMarkedPnl: value(-2594n), standing: { kind: 'Value', value: { zone: 'PastStop', pastBy: { dollars: rational(300n), r: rational(1n, 2n), crossed: true } } } }),
          replay: replayOf([], { meter: meter({ now: { kind: 'Value', value: { pnl: rational(-2594n), zone: 'PastStop', pastBy: { dollars: rational(300n) } as never } } }) }) as never,
        })}
      />,
    );
    expect(passed.container.querySelector('[data-caption="stop"]')?.textContent).toBe('Past Stop (−$300.00 so far)');
  });
});

describe('the "Now" box caption lengths (T95.18)', () => {
  // The drawing measures its captions at every length in hidden copies and the room its captions share; a width is ten pixels a character.
  let room = 10000;
  let rect: { mockRestore: () => void } | undefined;
  const watchers: (() => void)[] = [];
  const measure = () => {
    rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const el = this as HTMLElement;
      let width = 0;
      if (el.hasAttribute('data-measure')) width = (el.textContent ?? '').length * 10;
      else if (el.classList.contains('now-legs')) width = room;
      return { left: 0, right: width, top: 0, bottom: 10, width, height: 10, x: 0, y: 0, toJSON: () => ({}) };
    });
  };
  const caption = (root: HTMLElement, line: string) => root.querySelector<HTMLElement>(`[data-caption="${line}"]`)!;
  afterEach(() => {
    rect?.mockRestore();
    room = 10000;
    watchers.length = 0;
    vi.unstubAllGlobals();
  });

  it('should show the first shorter form on both captions when the full ones would overlap, and the shortest when those would (W84, W85)', () => {
    measure();
    // Full: 41 + 33 characters; first shorter: 27 + 23; shortest: 19 + 19.
    room = 800;
    const wide = render(<Box trade={trade()} />);
    expect(caption(wide.container, 'stop').textContent).toBe('−$4.80 to Stop (lose another −$1,314.00)');
    cleanup();

    room = 600;
    const middle = render(<Box trade={trade()} />);
    expect(caption(middle.container, 'stop').textContent).toBe('−$4.80 (another −$1,314.00)');
    expect(caption(middle.container, 'target').textContent).toBe('+$2.70 (gain $1,080.00)');
    cleanup();

    room = 400;
    const narrow = render(<Box trade={trade()} />);
    expect(caption(narrow.container, 'stop').textContent).toBe('−$4.80 (−$1,314.00)');
    expect(caption(narrow.container, 'target').textContent).toBe('+$2.70 (+$1,080.00)');
  });

  it('should keep the full sentence as each caption accessible name and title at every length', () => {
    measure();
    for (const width of [800, 600, 400]) {
      room = width;
      const { container } = render(<Box trade={trade()} />);
      const stop = within(container).getByRole('note', { name: '−$4.80 to Stop (lose another −$1,314.00)' });
      const target = within(container).getByRole('note', { name: '+$2.70 to Target (gain $1,080.00)' });
      expect(stop.getAttribute('title')).toBe('−$4.80 to Stop (lose another −$1,314.00)');
      expect(target.getAttribute('title')).toBe('+$2.70 to Target (gain $1,080.00)');
      cleanup();
    }
  });

  it('should not bold the shortest past-a-line caption (W86)', () => {
    measure();
    const passed = trade({
      evaluation: evaluation({
        currentMarkedPnl: value(-2594n),
        ongoingRiskToStop: value(0n),
        incrementalRewardToTarget: value(2694n),
        standing: { kind: 'Value', value: { zone: 'PastStop', pastBy: { dollars: rational(300n), r: rational(1n, 2n), crossed: true } } },
        conditions: [condition('Stop', '47.00', { distance: rational(0n), beyond: rational(300n, 100n) }), condition('Target', '54.50', { distance: rational(780n, 100n), beyond: null })],
      }),
      replay: replayOf([], { meter: meter({ now: { kind: 'Value', value: { pnl: rational(-2594n), zone: 'PastStop', pastBy: { dollars: rational(300n) } as never } } }) }) as never,
    });
    const full = render(<Box trade={passed} />);
    expect(caption(full.container, 'stop').textContent).toBe('$3.00 past Stop (−$300.00 so far)');
    expect(caption(full.container, 'stop').querySelector('b')).toBeTruthy();
    cleanup();

    room = 100;
    const shortest = render(<Box trade={passed} />);
    expect(caption(shortest.container, 'stop').textContent).toBe('$3.00 past (−$300.00)');
    expect(caption(shortest.container, 'stop').querySelector('b')).toBeNull();
  });

  it('should choose again when the box changes width', () => {
    measure();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          watchers.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    room = 800;
    const { container } = render(<Box trade={trade()} />);
    expect(caption(container, 'stop').textContent).toBe('−$4.80 to Stop (lose another −$1,314.00)');

    room = 400;
    act(() => watchers.forEach((tell) => tell()));
    expect(caption(container, 'stop').textContent).toBe('−$4.80 (−$1,314.00)');

    room = 800;
    act(() => watchers.forEach((tell) => tell()));
    expect(caption(container, 'stop').textContent).toBe('−$4.80 to Stop (lose another −$1,314.00)');
  });
});
