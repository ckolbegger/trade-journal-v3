// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DailyTradeReview } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { payoffFixtures } from '../../../tests/support/payoff-fixtures.ts';
import { CardFigures } from './CardFigures.tsx';

afterEach(cleanup);

type Evaluation = NonNullable<DailyTradeReview['evaluation']>;

const value = (n: bigint, d = 1n) => ({ kind: 'Value' as const, value: Rational.of(n, d) });
const symbol = { kind: 'Stock' as const, symbol: 'XYZ' };
const missing = (name: string, date: string) => ({ kind: 'Unavailable' as const, reason: 'MarkMissing', instrument: { kind: 'Stock' as const, symbol: name }, date });
const planBaseline = { kind: 'Value' as const, value: { originalPlannedRisk: Rational.of(250n), originalPlannedReward: Rational.of(600n), rewardRiskRatio: Rational.of(12n, 5n), oneR: Rational.of(250n) } };

// T-A at XYZ 52.00: P&L +$180.00, risk to stop $450.00, worst case $5,200.00, reward to target $400.00.
function evaluation(over: Record<string, unknown> = {}): Evaluation {
  return {
    kind: 'Evaluated',
    conditions: [],
    valuationDate: '2026-10-12',
    observation: { instrument: symbol, tradingDate: '2026-10-12', mark: { revisionId: 'r1', revisionNumber: 1, price: '52.00' } },
    currentMarkedPnl: value(180n),
    currentMarkedPnlInPlanR: value(18n, 25n),
    ongoingRiskToStop: value(450n),
    ongoingRiskToStopInPlanR: value(9n, 5n),
    worstCaseOngoingRisk: value(5200n),
    worstCaseOngoingRiskInPlanR: value(104n, 5n),
    incrementalRewardToTarget: value(400n),
    incrementalRewardToTargetInPlanR: value(8n, 5n),
    rewardRiskNow: value(40n, 45n),
    planBaseline,
    atEntry: { label: 'AtEntry', quantity: Rational.of(100n), averageEntry: Rational.of(50n), riskFromEntry: Rational.of(500n), rewardFromEntry: Rational.of(300n) },
    ...over,
  } as unknown as Evaluation;
}
function trade(over: Partial<DailyTradeReview> = {}): DailyTradeReview {
  return { tradeId: 't1', underlying: 'XYZ', evaluation: evaluation(), ...over } as unknown as DailyTradeReview;
}
const figure = (scope: HTMLElement, term: string) => within(scope).getAllByText(term)[0]?.nextElementSibling?.textContent;

describe('figures (A158)', () => {
  it('should show Current P&L, Risk to stop, Worst case, and Reward to target, each in dollars and R, then Reward : risk now 0.89 and planned 2.4, then At entry, for T-A at XYZ 52.00', () => {
    const { container: root } = render(<CardFigures trade={trade()} />);
    expect(figure(root, 'Trade P&L')).toBe('+$180.00 · +0.72R');
    expect(figure(root, 'Current Risk · At Stop')).toBe('$450.00 · 1.80R');
    expect(figure(root, 'Current Risk · At Worst case')).toBe('$5,200.00 · 20.80R');
    expect(figure(root, 'Remaining Reward · At Target')).toBe('$400.00 · 1.60R');
    expect(figure(root, 'Reward to risk')).toBe('0.89 to 1 (Plan 2.40 to 1)');
    const terms = [...root.querySelectorAll('dt')].map((dt) => dt.textContent);
    expect(terms).toEqual(['Trade P&L', 'Current Risk · At Stop', 'Current Risk · At Worst case', 'Remaining Reward · At Target', 'Reward to risk', 'Risk to stop', 'Reward to target']);
    expect(within(root).getByRole('group', { name: 'At entry' })).toBeTruthy();
  });

  it('should show each figure that is not a Value in words, never as 0: T-C Mark missing: DEF, Oct 12, T-B Reward : risk Not applicable', () => {
    const gone = missing('DEF', '2026-10-12');
    const { container: root } = render(<CardFigures trade={trade({ evaluation: evaluation({ currentMarkedPnl: gone, currentMarkedPnlInPlanR: gone, ongoingRiskToStop: gone, ongoingRiskToStopInPlanR: gone, worstCaseOngoingRisk: gone, worstCaseOngoingRiskInPlanR: gone, incrementalRewardToTarget: gone, incrementalRewardToTargetInPlanR: gone, rewardRiskNow: gone, atEntry: null }) })} />);
    for (const term of ['Trade P&L', 'Current Risk · At Stop', 'Current Risk · At Worst case', 'Remaining Reward · At Target']) expect(figure(root, term)).toBe('Mark missing: DEF, Mon Oct 12');
    expect(figure(root, 'Reward to risk')).toBe('Mark missing: DEF, Mon Oct 12 (Plan 2.40 to 1)');
    expect(root.textContent).not.toMatch(/\$0\.00|(^|\s)0(\s|$)/);
    cleanup();

    const b = render(<CardFigures trade={trade({ evaluation: evaluation({ rewardRiskNow: { kind: 'NotApplicable', reason: 'EntryAtOrBeyondStop' } }) })} />);
    expect(figure(b.container,'Reward to risk')).toBe('Not applicable: entry at or beyond the Stop (Plan 2.40 to 1)');
  });

  it('should keep the dated last-close group beside the figures when the Review-date Mark is missing', () => {
    const gone = missing('XYZ', '2026-10-12');
    const dated = evaluation({ currentMarkedPnl: value(-50n), currentMarkedPnlInPlanR: value(-1n, 5n) });
    const { container: root } = render(<CardFigures trade={trade({ evaluation: evaluation({ currentMarkedPnl: gone, currentMarkedPnlInPlanR: gone, observation: { instrument: symbol, tradingDate: '2026-10-12', mark: null } }), datedLastClose: { tradingDate: '2026-10-09', evaluation: dated } })} />);
    expect(figure(root, 'Trade P&L')).toBe('Mark missing: XYZ, Mon Oct 12');
    const group = within(root).getByRole('group', { name: 'Fri Oct 9 close' });
    expect(figure(group, 'Trade P&L')).toBe('−$50.00 · −0.20R');
    expect(figure(group, 'Current Risk · At Stop')).toBe('$450.00 · 1.80R');
  });
});

describe('value at expiration at the Underlying latest close (A122)', () => {
  const termIn = (root: HTMLElement, term: string) => within(root).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
  const withPayoff = (atClose: unknown) => trade({ payoff: payoffFixtures.osPayoffs(), evaluation: evaluation({ expirationValueAtUnderlyingClose: atClose }) });

  it('should show If XYZ is at 57.50 at expiration beside the payoff summary and apart from the Mark-to-Market figures', () => {
    const atClose = { kind: 'Value', value: { underlyingPrice: Rational.of(115n, 2n), value: Rational.of(14805n, 100n) } };
    const { container: root } = render(<CardFigures trade={withPayoff(atClose)} />);
    const line = within(root).getByText('If XYZ is at 57.50 at expiration: +$148.05');
    expect(line.closest('dl')).toBeNull();
    expect(line.previousElementSibling?.textContent).toMatch(/^At expiration: /);
  });

  it('should word the figure as Trade Detail does when the Underlying Mark is missing or the contract is past its expiration date', () => {
    const missingMark = { kind: 'Unavailable', reason: 'MarkMissing', instrument: symbol, date: '2026-11-19' };
    const first = render(<CardFigures trade={withPayoff(missingMark)} />);
    expect(termIn(first.container, "Value at expiration at XYZ's latest Mark")).toBe('Mark missing: XYZ, Thu Nov 19');
    cleanup();
    const due = { kind: 'Unavailable', reason: 'SettlementDue', instrument: { kind: 'Option', underlying: 'XYZ', expiration: '2026-11-20', strike: '55', right: 'Call' } };
    const second = render(<CardFigures trade={withPayoff(due)} />);
    expect(termIn(second.container, "Value at expiration at XYZ's latest Mark")).toMatch(/^Settlement Due: /);
  });

  it('should show no such line on a stock Trade', () => {
    const { container: root } = render(<CardFigures trade={trade({ evaluation: evaluation({ expirationValueAtUnderlyingClose: { kind: 'NotApplicable', reason: 'NoOptionExpirationAnchor' } }) })} />);
    expect(root.textContent).not.toMatch(/at expiration/);
    expect(root.textContent).not.toMatch(/latest Mark/);
  });
});

const odds = (target: bigint, stop: bigint) => ({ kind: 'Value' as const, value: { targetFirst: Rational.of(target, 100n), stopFirst: Rational.of(stop, 100n), percent: { targetFirst: Rational.of(target), stopFirst: Rational.of(stop) } } });

describe("Review card: the summary in the replay's words (decision 7)", () => {
  it('should name the figures Current Risk At Stop, Current Risk At Worst case and Remaining Reward At Target, with their amounts as before, in the Review-date group and the dated group alike', () => {
    const dated = evaluation({ currentMarkedPnl: value(-50n), currentMarkedPnlInPlanR: value(-1n, 5n) });
    const { container: root } = render(<CardFigures trade={trade({ datedLastClose: { tradingDate: '2026-10-09', evaluation: dated } })} />);
    for (const scope of [root, within(root).getByRole('group', { name: 'Fri Oct 9 close' })]) {
      expect(figure(scope, 'Current Risk · At Stop')).toBe('$450.00 · 1.80R');
      expect(figure(scope, 'Current Risk · At Worst case')).toBe('$5,200.00 · 20.80R');
      expect(figure(scope, 'Remaining Reward · At Target')).toBe('$400.00 · 1.60R');
    }
    expect(root.textContent).not.toMatch(/Ongoing Risk to Stop|Worst-Case Ongoing Risk|Incremental Reward to Target/);
  });

  it('should read Reward to risk in one row, 0.89 to 1 with the odds and the Plan beside it for T-A, with no separate planned row', () => {
    const { container: root } = render(<CardFigures trade={trade({ evaluation: evaluation({ rewardRiskOdds: odds(53n, 47n), planOdds: odds(29n, 71n) }) })} />);
    expect(figure(root, 'Reward to risk')).toBe('0.89 to 1 · about 53% : 47% (Plan 2.40 to 1 · 29% : 71%)');
    expect(within(root).getByRole('img').getAttribute('aria-label')).toBe('about 53% chance of the Target first, 47% of the Stop first');
    expect(root.textContent).not.toMatch(/Reward : risk/);
    expect([...root.querySelectorAll('dt')].map((dt) => dt.textContent).filter((term) => /^Reward (to|:) risk/.test(term ?? ''))).toEqual(['Reward to risk']);
  });

  it('should use the replay wording past a line: Past the Target by 32.00 and Past the Stop by 300.00 in place of the row, never 0.00, and no Reward to risk row', () => {
    const past = (zone: 'PastStop' | 'PastTarget', dollars: bigint, r: Rational, over: Record<string, unknown>) =>
      evaluation({ rewardRiskOdds: odds(53n, 47n), standing: { kind: 'Value', value: { zone, pastBy: { dollars: Rational.of(dollars), r, crossed: true } } }, ...over });
    const target = render(<CardFigures trade={trade({ evaluation: past('PastTarget', 32n, Rational.of(1n, 10n), { incrementalRewardToTarget: value(0n), incrementalRewardToTargetInPlanR: value(0n) }) })} />);
    expect(figure(target.container, 'Remaining Reward')).toBe('Past the Target by $32.00 (0.10R)');
    expect(target.container.textContent).not.toMatch(/Remaining Reward · At Target|Reward to risk/);
    expect(target.container.textContent).not.toContain('$0.00');
    expect(figure(target.container, 'Current Risk · At Stop')).toBe('$450.00 · 1.80R');
    cleanup();
    const stop = render(<CardFigures trade={trade({ evaluation: past('PastStop', 300n, Rational.of(1n, 2n), { ongoingRiskToStop: value(0n), ongoingRiskToStopInPlanR: value(0n) }) })} />);
    expect(figure(stop.container, 'Current Risk')).toBe('Past the Stop by $300.00 (0.50R)');
    expect(stop.container.textContent).not.toMatch(/Current Risk · At Stop|Reward to risk/);
    expect(stop.container.textContent).not.toContain('$0.00');
    expect(figure(stop.container, 'Remaining Reward · At Target')).toBe('$400.00 · 1.60R');
  });

  it('should name the marked result Trade P&L, in the Review-date group and the dated group alike', () => {
    const { container: root } = render(<CardFigures trade={trade({ datedLastClose: { tradingDate: '2026-10-09', evaluation: evaluation({ currentMarkedPnl: value(-50n), currentMarkedPnlInPlanR: value(-1n, 5n) }) } })} />);
    expect(figure(root, 'Trade P&L')).toBe('+$180.00 · +0.72R');
    expect(figure(within(root).getByRole('group', { name: 'Fri Oct 9 close' }), 'Trade P&L')).toBe('−$50.00 · −0.20R');
    expect(root.textContent).not.toContain('Current Marked Trade P&L');
  });

  it('should keep each renamed figure canonical term as accessible text, with nothing added to see', () => {
    const { container: root } = render(<CardFigures trade={trade()} />);
    for (const [label, term] of [['Current Risk · At Stop', 'Ongoing Risk to Stop'], ['Current Risk · At Worst case', 'Worst-Case Ongoing Risk'], ['Remaining Reward · At Target', 'Incremental Reward to Target']] as const) {
      const dt = within(root).getByText(label, { selector: 'dt' });
      expect(dt.getAttribute('title')).toBe(term);
      expect(within(root).getByRole('term', { description: term }).textContent).toBe(label);
    }
    expect(root.textContent).not.toMatch(/Ongoing Risk to Stop|Worst-Case Ongoing Risk|Incremental Reward to Target/);
    cleanup();
    // The row past a line carries Stop Overrun or Target Overrun the same way.
    const pastBy = (zone: string) => ({ kind: 'Value', value: { zone, pastBy: { dollars: Rational.of(32n), r: Rational.of(1n, 10n), crossed: true } } });
    const target = render(<CardFigures trade={trade({ evaluation: evaluation({ standing: pastBy('PastTarget') }) })} />);
    expect(within(target.container).getByRole('term', { description: 'Target Overrun' }).textContent).toBe('Remaining Reward');
    cleanup();
    const stop = render(<CardFigures trade={trade({ evaluation: evaluation({ standing: pastBy('PastStop') }) })} />);
    expect(within(stop.container).getByRole('term', { description: 'Stop Overrun' }).textContent).toBe('Current Risk');
  });

  it("should give At Worst case the extremes' weight", () => {
    const rowOfTerm = (scope: HTMLElement, term: string) => within(scope).getAllByText(term, { selector: 'dt' })[0]?.parentElement;
    const remote = render(<CardFigures trade={trade({ evaluation: evaluation({ extremes: 'Remote' }) })} />);
    const worst = rowOfTerm(remote.container, 'Current Risk · At Worst case');
    expect(worst?.getAttribute('data-weight')).toBe('Remote');
    expect(worst?.style.color).toBe('var(--muted)');
    expect(rowOfTerm(remote.container, 'Current Risk · At Stop')?.getAttribute('data-weight')).toBeNull();
    expect(rowOfTerm(remote.container, 'Remaining Reward · At Target')?.getAttribute('data-weight')).toBeNull();
    cleanup();
    for (const over of [{ extremes: 'Main' }, {}]) {
      const main = render(<CardFigures trade={trade({ evaluation: evaluation(over) })} />);
      const row = rowOfTerm(main.container, 'Current Risk · At Worst case');
      expect(row?.getAttribute('data-weight')).toBe('Main');
      expect(row?.style.color).toBe('');
      cleanup();
    }
  });
});
