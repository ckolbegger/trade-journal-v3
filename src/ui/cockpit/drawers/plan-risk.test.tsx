// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { openDetailAt, openDetailOf, openDetailUncovered, PC1, PC2, PC3, pc3Excess } from '../../../../tests/support/open-detail-fixtures.ts';
import { ocExcess, optionOpenDetail } from '../../../../tests/support/option-detail-fixtures.ts';
import { OC_CONTRACT, OC_PC1, OC_PC2, OC_X1 } from '../../../../tests/support/option-trade-fixtures.ts';
import { plannedDetail } from '../../../../tests/support/views-fixtures.ts';
import { Rational } from '../../../domain/values/index.ts';
import { OC_PC3, rowsOf, THURSDAY, tuesday, useFixedClock } from '../../screens/trade-detail/test-support.ts';
import { PlanRiskDrawer } from './plan-risk.tsx';

afterEach(cleanup);

const termsIn = (region: HTMLElement) => within(region).queryAllByText(/.*/, { selector: 'dt' }).map((term) => term.textContent);
const valueOf = (region: HTMLElement, term: string) => within(region).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;

describe('Plan and Risk drawer and footer (P96)', () => {
  it('should show the Plan, the Plan Baseline with 1R and the original reward once, and Entry Quality, with no Summary duplicate on the page', () => {
    const { container } = render(<PlanRiskDrawer view={openDetailOf([PC1, PC2])} timeZone="America/New_York" />);
    const plan = screen.getByRole('region', { name: 'Plan' });
    expect(termsIn(plan)).toEqual(['Leg', 'Intended entry', 'Stop', 'Target', 'Plan time', 'Account']);
    expect(valueOf(plan, 'Stop')).toBe('$47.50');
    const baseline = screen.getByRole('region', { name: 'Plan Baseline' });
    expect(termsIn(baseline)).toEqual(['1R (original risk)', 'Original reward', 'Reward : risk']);
    expect(valueOf(baseline, '1R (original risk)')).toBe('$250.00');
    expect(valueOf(baseline, 'Original reward')).toBe('$600.00');
    const quality = screen.getByRole('region', { name: 'Entry Quality' });
    expect(valueOf(quality, 'Average entry')).toBe('$50.18');
    // Each Plan figure once, and none of the Summary card's own figures (Net cost, Quantity, Opening fees, a bare 1R). The Entry status is one
    // now, in Entry Quality (T8P.31, revision 96).
    const terms = Array.from(container.querySelectorAll('dt')).map((term) => term.textContent);
    for (const once of ['Intended entry', 'Stop', 'Target', '1R (original risk)', 'Original reward']) expect(terms.filter((term) => term === once)).toHaveLength(1);
    for (const summaryOnly of ['Net cost', 'Quantity', 'Opening fees', '1R']) expect(terms).not.toContain(summaryOnly);
    expect(screen.queryByRole('region', { name: 'Summary', hidden: true })).toBeNull();
  });

  it('should show the entry as not entered on a Planned Detail', () => {
    render(<PlanRiskDrawer view={plannedDetail} timeZone="America/New_York" />);
    // The existing Entry Quality words with nothing entered (P96); a Planned Detail has no Average entry or Actual initial risk to show.
    const quality = screen.getByRole('region', { name: 'Entry Quality' });
    expect(within(quality).getByText('Entry not yet resolved: 0 of 100 entered')).toBeTruthy();
    expect(termsIn(quality)).toEqual([]);
    expect(valueOf(screen.getByRole('region', { name: 'Plan Baseline' }), '1R (original risk)')).toBe('$250.00');
  });
});

// Figures the retired Summary card and Risk and reward section gave, moved here with their expected values (T8P.27, revision 86).
describe('Plan and Risk drawer: figures moved from the retired Summary card and Risk and reward section (T8P.27)', () => {
  useFixedClock();

  it('should show the Stop and Target of an Open Detail, the Intended entry as a number on a Planned one, and no Actual initial risk or Average entry while the entry is pending', () => {
    render(<PlanRiskDrawer view={openDetailOf([PC1, PC2, PC3])} timeZone="America/New_York" />);
    const plan = screen.getByRole('region', { name: 'Plan' });
    expect(valueOf(plan, 'Stop')).toBe('$47.50');
    expect(valueOf(plan, 'Target')).toBe('$56.00');
    cleanup();

    render(<PlanRiskDrawer view={plannedDetail} timeZone="America/New_York" />);
    expect(within(screen.getByRole('region', { name: 'Plan' })).getByText('$50.00', { selector: 'dd' }).className).toContain('number');
    cleanup();

    const { container } = render(<PlanRiskDrawer view={openDetailOf([PC1])} timeZone="America/New_York" />);
    const quality = screen.getByRole('region', { name: 'Entry Quality' });
    expect(within(quality).getByText('Entry not yet resolved: 60 of 100 entered')).toBeTruthy();
    const terms = Array.from(container.querySelectorAll('dt')).map((term) => term.textContent);
    expect(terms).not.toContain('Average entry');
    expect(terms).not.toContain('Actual initial risk');
  });

  it('should show the contract, the Leg and the Exercise Intent of an option Trade Plan', () => {
    render(<PlanRiskDrawer view={optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY)} timeZone="America/New_York" />);
    const plan = screen.getByRole('region', { name: 'Plan' });
    expect(valueOf(plan, 'Contract')).toBe('XYZ Nov 20 $55 Call');
    expect(valueOf(plan, 'Leg')).toBe('Long 2 contracts of XYZ Nov 20 $55 Call');
    expect(valueOf(plan, 'Exercise Intent')).toBe('Not authorized in advance');
  });

  it('should show a NotApplicable Slippage as Not applicable followed by its words, never a raw code', () => {
    const base = openDetailUncovered([PC1, PC2], '2031-01-02');
    const quality = base.entryQuality.kind === 'Value' ? base.entryQuality.value : undefined;
    const view = { ...base, entryQuality: { kind: 'Value', value: { ...quality, slippage: { kind: 'NotApplicable', reason: 'EntryNotResolved' } } } } as unknown as ComponentProps<typeof PlanRiskDrawer>['view'];
    render(<PlanRiskDrawer view={view} timeZone="America/New_York" />);
    expect(valueOf(screen.getByRole('region', { name: 'Entry Quality' }), 'Slippage')).toBe('Not applicable: entry not resolved yet');
  });
});

// A222: an Unavailable per-condition figure says why at the figure length, where the figure lives, never a bare "—" (T8P.23-B8).
describe('Plan and Risk drawer: unavailable condition figures (A222, T8P.23-B8)', () => {
  useFixedClock();

  it('should word a missing Mark in Risk to stop and Reward to target at the figure length, with no bare dash left', () => {
    const view = openDetailAt([PC1, PC2], tuesday({ kind: 'Missing' }));
    expect(view.current.evaluation.conditions.every((c) => c.result.kind === 'Unavailable')).toBe(true);
    render(<PlanRiskDrawer view={view} timeZone="America/New_York" />);
    // T8R.10: the Conditions table's figure cells (Distance, Risk or reward) carry the reason, each at the figure length.
    const figures = rowsOf(within(screen.getByRole('region', { name: 'Conditions' })).getByRole('table')).flatMap((cells) => cells.slice(1, 3));
    expect(figures).toEqual(Array(4).fill('Mark missing: XYZ, Tue Oct 13'));
    expect(figures.some((figure) => figure?.includes('—'))).toBe(false);
  });

  it('should word Risk to stop and Reward to target as Settlement Due on the expiration day, with no Mark missing text', () => {
    // On 20 Nov the contract has no Mark yet is due for settlement: its conditions are not measured, as on the Monday after (W6).
    const friday = { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', underlyingMark: '52.00' };
    const view = optionOpenDetail('O-C', [OC_PC1, OC_PC2], friday);
    expect(view.settlement.length).toBeGreaterThan(0);
    const { container } = render(<PlanRiskDrawer view={view} timeZone="America/New_York" />);
    const figures = rowsOf(within(screen.getByRole('region', { name: 'Conditions' })).getByRole('table')).flatMap((cells) => cells.slice(1, 3));
    expect(figures).toEqual(Array(4).fill('Settlement Due: XYZ Nov 20 $55 Call'));
    expect(container.textContent).not.toContain('Mark missing');
    // W6: beneath the rows, the sentence stands in for Worst case and Max reward.
    expect(within(screen.getByRole('region', { name: 'Conditions' })).getByText('The contract expired, so its conditions are no longer measured.')).toBeTruthy();
  });
});

// D8R, T8R.10: the Conditions group (W31, W32). O-C3 at Thu 10-15 18:00 is a view double: an O-C Detail whose Plan and conditions are O-C3's
// (Stop the option at or below 1.00, Target XYZ at or above 60.00; the call at 3.20, XYZ at 57.90, 1 of 2 contracts held, 1R $200), since
// the fixture builders know no O-C3 and the domain's `trigger` (A230, T8R.18) is not filled yet.
type OpenView = ReturnType<typeof optionOpenDetail>;
type Condition = OpenView['current']['evaluation']['conditions'][number];
type Reading = Extract<Condition['result'], { kind: 'Value' }>['value'];

const R = (cents: bigint) => Rational.of(cents, 100n);
const measure = (dollars: bigint, planR: bigint) => ({ dollars: R(dollars), planR: R(planR) });
const evidence = { instrument: OC_CONTRACT, date: '2026-10-15', mark: { source: 'Manual', revisionId: 'm-1', revisionNumber: 1, price: '3.20', savedAt: '2026-10-15T22:00:00Z' } } as const;

const stop = (reading: Partial<Reading> = {}): Condition => ({
  id: 'stop-1',
  role: 'Stop',
  kind: 'StructureValue',
  boundary: '1.00',
  result: { kind: 'Value', value: { status: 'Active', distance: measure(22000n, 110n), overrun: null, evidence, trigger: { distance: R(220n), beyond: null }, ...reading } },
});
const target = (reading: Partial<Reading> = {}): Condition => ({
  id: 'target-1',
  role: 'Target',
  kind: 'UnderlyingPrice',
  boundary: '60.00',
  result: { kind: 'Value', value: { status: 'Active', distance: measure(18000n, 90n), overrun: null, evidence, trigger: { distance: R(210n), beyond: null }, underlying: { distance: R(210n), beyond: null }, ...reading } },
});

function oc3(conditions: readonly Condition[], extra: Partial<OpenView['current']> = {}): OpenView {
  const view = optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], THURSDAY);
  const stopBasis = [{ ...view.baseline.stopBasis[0]!, valueAtExpiration: R(0n) }];
  const targetBasis = [{ ...view.baseline.targetBasis[0]!, valueAtExpiration: R(500n) }];
  return {
    ...view,
    plan: { ...view.plan, stops: [{ factId: 'stop-1', kind: 'StructureValue', price: '1.00' }], targets: [{ factId: 'target-1', kind: 'UnderlyingPrice', price: '60.00' }] },
    baseline: { ...view.baseline, stopBasis, targetBasis },
    current: { ...view.current, evaluation: { ...view.current.evaluation, conditions }, ...extra },
  };
}

describe('Plan and Risk: Conditions (W31)', () => {
  useFixedClock();

  it('should list each condition with its trigger, its distance away and its Risk to stop in dollars and R', () => {
    render(<PlanRiskDrawer view={oc3([stop(), target()])} timeZone="America/New_York" />);
    const conditions = screen.getByRole('region', { name: 'Conditions' });
    expect(rowsOf(within(conditions).getByRole('table')).map((cells) => cells.slice(0, 3))).toEqual([
      ['Option at or below $1.00', '$2.20 away', 'Risk to stop $220.00 · 1.10R'],
      ['XYZ at or above 60.00', '2.10 away', 'Reward to target $180.00 · 0.90R'],
    ]);
  });

  it('should show an Underlying condition value at expiration in its row', () => {
    render(<PlanRiskDrawer view={oc3([stop(), target()])} timeZone="America/New_York" />);
    const conditions = screen.getByRole('region', { name: 'Conditions' });
    expect(within(conditions).getAllByRole('columnheader').map((head) => head.textContent)).toEqual(['Condition', 'Distance', 'Risk or reward', 'Value at expiration']);
    // Only the Underlying condition has one: the option-price Stop is measured in the option's own price.
    expect(rowsOf(within(conditions).getByRole('table')).map((cells) => cells[3])).toEqual(['', '$5.00']);
  });

  it('should show a breached Stop as Breached with its price past and its Risk to stop past', () => {
    // O-S2's Wednesday style breach, on this double: the call at 0.50, so the Stop at 1.00 is crossed by $0.50 and the Trade is $60.00 (0.24R) past it.
    const breached = stop({ status: 'Breached', distance: measure(0n, 0n), overrun: measure(6000n, 24n), trigger: { distance: R(0n), beyond: R(50n) } });
    render(<PlanRiskDrawer view={oc3([breached, target()])} timeZone="America/New_York" />);
    const [stopRow] = rowsOf(within(screen.getByRole('region', { name: 'Conditions' })).getByRole('table'));
    expect(stopRow?.slice(1, 3)).toEqual(['Breached · $0.50 past', 'Risk to stop $60.00 · 0.24R past']);
  });

  it('should show Worst case, Max reward and the short notes under the rows', () => {
    const view = oc3([stop(), target()]);
    const { evaluation } = view.current;
    const withFigures = { ...view, current: { ...view.current, evaluation: { ...evaluation, worstCaseOngoingRisk: { kind: 'Value', value: R(32000n) }, worstCaseOngoingRiskInPlanR: { kind: 'Value', value: R(160n) } } } } as OpenView;
    render(<PlanRiskDrawer view={withFigures} timeZone="America/New_York" />);
    const conditions = screen.getByRole('region', { name: 'Conditions' });
    const notes = within(conditions).getByRole('list', { name: 'Worst case and Max reward' });
    expect(within(notes).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Worst case: $320.00 · 1.60R if the call expires worthless', 'Max reward: Unbounded above']);
    // They sit beneath the rows.
    expect(within(conditions).getByRole('table').compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should show the last Marks figures with their date when todays Mark is missing', () => {
    // Fri 10-16: the call has no Mark, so every current condition is Unavailable; the Thu Oct 15 Marks' conditions stand in the dated line.
    const missing = (c: Condition): Condition => ({ ...c, result: { kind: 'Unavailable', reason: 'MarkMissing', instrument: OC_CONTRACT, date: '2026-10-16' } });
    const live = oc3([stop(), target()]);
    const view = oc3([missing(stop()), missing(target())], { datedLine: { tradingDate: '2026-10-15', evaluation: live.current.evaluation } });
    render(<PlanRiskDrawer view={view} timeZone="America/New_York" />);
    const conditions = screen.getByRole('region', { name: 'Conditions' });
    expect(rowsOf(within(conditions).getByRole('table')).map((cells) => cells.slice(1, 3))).toEqual([
      ['$2.20 away · Thu Oct 15 Marks', 'Risk to stop $220.00 · 1.10R'],
      ['2.10 away · Thu Oct 15 Marks', 'Reward to target $180.00 · 0.90R'],
    ]);
    // Worst case and Max reward are the dated Marks' too, and say so.
    const notes = within(within(conditions).getByRole('list', { name: 'Worst case and Max reward' })).getAllByRole('listitem');
    for (const note of notes) expect(note.textContent).toMatch(/ · Thu Oct 15 Marks$/);
  });

  it('should show the expired note and no dated figures on a Settlement Due Trade whose current Mark is missing', () => {
    // On 20 Nov the contract is due for settlement with no Mark; a dated line from stale Marks must not stand in (W6).
    const friday = { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', underlyingMark: '52.00' };
    const base = optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], friday);
    expect(base.settlement.length).toBeGreaterThan(0);
    const missing = (c: Condition): Condition => ({ ...c, result: { kind: 'Unavailable', reason: 'MarkMissing', instrument: OC_CONTRACT, date: '2026-11-20' } });
    const live = oc3([stop(), target()]);
    const view = { ...base, current: { ...base.current, evaluation: { ...base.current.evaluation, conditions: [missing(stop()), missing(target())] }, datedLine: { tradingDate: '2026-10-15', evaluation: live.current.evaluation } } };
    render(<PlanRiskDrawer view={view} timeZone="America/New_York" />);
    const conditions = screen.getByRole('region', { name: 'Conditions' });
    expect(rowsOf(within(conditions).getByRole('table')).flatMap((cells) => cells.slice(1, 3))).toEqual(Array(4).fill('Settlement Due: XYZ Nov 20 $55 Call'));
    expect(within(conditions).getByText('The contract expired, so its conditions are no longer measured.')).toBeTruthy();
    expect(conditions.textContent).not.toContain('Marks');
  });

  it('should show the Settlement Due reason in every Conditions cell on the expiration evening, as the note and the rail do', () => {
    // Fri 11-20 after 4:00 pm with the day's Marks saved: every condition carries a reading, yet the contract is due for settlement (W6).
    const friday = { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', underlyingMark: '52.00' };
    const base = optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], friday);
    expect(base.settlement.length).toBeGreaterThan(0);
    const view = { ...base, current: { ...base.current, evaluation: { ...base.current.evaluation, conditions: [stop(), target()] } } };
    render(<PlanRiskDrawer view={view} timeZone="America/New_York" />);
    const conditions = screen.getByRole('region', { name: 'Conditions' });
    expect(rowsOf(within(conditions).getByRole('table')).flatMap((cells) => cells.slice(1, 3))).toEqual(Array(4).fill('Settlement Due: XYZ Nov 20 $55 Call'));
    expect(within(conditions).getByText('The contract expired, so its conditions are no longer measured.')).toBeTruthy();
  });
});

describe('Plan and Risk: Since the last Marks (W23)', () => {
  useFixedClock();
  const headings = () => screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
  const atEntry = { label: 'AtEntry', quantity: Rational.of(1n), averageEntry: Rational.of(330n, 100n), riskFromEntry: R(11000n), rewardFromEntry: R(9000n), riskFromEntryInPlanR: R(55n), rewardFromEntryInPlanR: R(45n) } as const;
  // O-C3+: the second contract was bought Fri 10-16 at $3.30, after the Thu 10-15 Marks.
  const oc3Plus = (extra: Partial<OpenView['current']> = {}): OpenView => {
    const view = oc3([stop(), target()]);
    return { ...view, current: { ...view.current, evaluation: { ...view.current.evaluation, atEntry }, ...extra } };
  };

  it('should show New lots 1 contract, Average price of new lots $3.30, Risk from that price and Reward from that price', () => {
    render(<PlanRiskDrawer view={oc3Plus()} timeZone="America/New_York" />);
    const group = screen.getByRole('region', { name: 'Since the last Marks' });
    expect(termsIn(group)).toEqual(['New lots', 'Average price of new lots', 'Risk from that price', 'Reward from that price']);
    expect(valueOf(group, 'New lots')).toBe('1 contract');
    expect(valueOf(group, 'Average price of new lots')).toBe('$3.30');
    expect(valueOf(group, 'Risk from that price')).toBe('$110.00 · 0.55R');
    expect(valueOf(group, 'Reward from that price')).toBe('$90.00 · 0.45R');
    // Before Conditions (browser row B8R.4: W23, then W31 and W32).
    expect(headings().slice(headings().indexOf('Since the last Marks'), headings().indexOf('Since the last Marks') + 2)).toEqual(['Since the last Marks', 'Conditions']);
  });

  it('should not show the group before the first Marks, when Entry Quality covers the entry', () => {
    // Before any Marks every lot is "after the last Marks", so Trade Views' firstMarksDue names the session whose close brings the first.
    render(<PlanRiskDrawer view={oc3Plus({ firstMarksDue: '2026-10-15' })} timeZone="America/New_York" />);
    expect(screen.queryByRole('region', { name: 'Since the last Marks' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Entry Quality' })).toBeTruthy();
  });

  it('should not show Since the last Marks when no Marks exist and the first-Marks session has passed', () => {
    // O-S2X at Fri 11-20 12:00 with nothing saved: every lot is at entry, but no Marks exist for any lot to be newer than.
    render(<PlanRiskDrawer view={oc3Plus({ noLotsAfterMarks: true })} timeZone="America/New_York" />);
    expect(screen.queryByRole('region', { name: 'Since the last Marks' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Entry Quality' })).toBeTruthy();
  });

  it('should not show Since the last Marks on a Settlement Due Trade whose lots predate its last Marks', () => {
    // O-S2X at Mon 11-23 18:00: the Fri 11-20 Marks came after the lots, and the contract is due for settlement.
    const base = oc3([stop(), target()]);
    const due = optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_X1], { tradingDate: '2026-11-20', closeInstant: '2026-11-20T21:00:00Z', underlyingMark: '52.00' }).settlement;
    const view = { ...base, settlement: due, current: { ...base.current, evaluation: { ...base.current.evaluation, atEntry }, noLotsAfterMarks: true } } as unknown as OpenView;
    render(<PlanRiskDrawer view={view} timeZone="America/New_York" />);
    expect(screen.queryByRole('region', { name: 'Since the last Marks' })).toBeNull();
  });
});

describe('Plan and Risk: Fulfillment and Deviations', () => {
  const zone = 'America/New_York';
  const superseded = { ...pc3Excess, versions: [{ ...pc3Excess.versions[0]!, status: 'Superseded' as const, reason: 'NoLongerExpected' as const }] } as unknown as typeof pc3Excess;
  const headings = () => screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

  it('should show Planned-Leg Fulfillment and Deviations as the drawers last two groups', () => {
    render(<PlanRiskDrawer view={openDetailOf([PC1, PC2, PC3], { recordedDeviations: [pc3Excess] })} timeZone={zone} />);
    expect(headings().slice(-2)).toEqual(['Planned-Leg Fulfillment', 'Deviations']);
    const fulfillment = screen.getByRole('region', { name: 'Planned-Leg Fulfillment' });
    expect(valueOf(fulfillment, 'Long 100 shares of XYZ')).toBe('Filled with Deviation');
    const deviations = screen.getByRole('region', { name: 'Deviations' });
    expect(within(deviations).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Entry Size (Excess): 20 shares above plan, caused by the Position Change at 2026-10-12 14:00.',
    ]);
    cleanup();
    // An option Trade says contracts.
    render(<PlanRiskDrawer view={optionOpenDetail('O-C', [OC_PC1, OC_PC2, OC_PC3], THURSDAY, { recordedDeviations: [ocExcess] })} timeZone={zone} />);
    expect(within(screen.getByRole('region', { name: 'Deviations' })).getByText('Entry Size (Excess): 1 contract above plan, caused by the Position Change at 2026-10-12 12:00.')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Planned-Leg Fulfillment' })).getByText('Long 2 contracts of XYZ Nov 20 $55 Call', { selector: 'dt' })).toBeTruthy();
  });

  it('should not show Deviations when there are none', () => {
    render(<PlanRiskDrawer view={openDetailOf([PC1])} timeZone={zone} />);
    expect(screen.queryByRole('region', { name: 'Deviations' })).toBeNull();
    expect(screen.queryByText('No Deviations recorded.')).toBeNull();
    // Fulfillment is then the last group.
    expect(headings().slice(-1)).toEqual(['Planned-Leg Fulfillment']);
    expect(valueOf(screen.getByRole('region', { name: 'Planned-Leg Fulfillment' }), 'Long 100 shares of XYZ')).toBe('Partially filled');
  });

  it('should list a superseded Deviation struck through', () => {
    render(<PlanRiskDrawer view={openDetailOf([PC1, PC2, PC3], { recordedDeviations: [superseded] })} timeZone={zone} />);
    const item = within(screen.getByRole('region', { name: 'Deviations' })).getByRole('listitem');
    expect(item.querySelector('del')?.textContent).toContain('Entry Size (Excess): 20 shares above plan');
    expect(item.querySelector('.visually-hidden')?.textContent).toBe('Superseded');
  });
});
