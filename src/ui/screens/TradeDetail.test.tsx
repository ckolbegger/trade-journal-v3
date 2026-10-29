// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import {
  execution,
  incoherentDetailOf,
  openDetailAt,
  openDetailOf,
  openDetailUncovered,
  PC1,
  PC2,
  pc1Reflection,
  pc2Decline,
  PC3,
  pc3Excess,
  positionChange,
} from '../../../tests/support/open-detail-fixtures.ts';
import { plannedDetail } from '../../../tests/support/views-fixtures.ts';
import type { UiFacade } from '../../app/compose.ts';
import type { NarrativeItem, TradeDetailView } from '../../app/types.ts';
import { Rational } from '../../domain/values/index.ts';
import { RuntimeContext } from '../runtime.tsx';
import { TradeDetail } from './TradeDetail.tsx';

afterEach(cleanup);

function renderDetail(facade: UiFacade, path = '/trades/trade-1') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Trade Detail', () => {
  it('should render the Detail summary Trade text through the shared at-price component so the at sign stays with its price', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: plannedDetail, binding: {} } as never);
    renderDetail(facade);
    const card = await screen.findByRole('region', { name: 'Summary' });
    const text = card.querySelector('.summary-text')!;
    expect(text.textContent).toBe('Long 100 shares @ $50.00');
    expect(text.querySelector('.nowrap')?.textContent).toBe('@ $50.00');
  });

  it('should show the Plan, Planned Leg, Stop, Target, Plan Baseline, 1R, the "Planned" lifecycle as text (not only colour), and the Plan Reflection with its snapshot prompt labels', async () => {
    const facade = facadeDouble();
    vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: plannedDetail, binding: {} } as never);
    renderDetail(facade);
    expect(await screen.findByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
    expect(screen.getByText('Planned', { selector: '.badge' })).toBeTruthy();
    const plan = screen.getByRole('region', { name: 'Plan' });
    const value = (term: string) => within(plan).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(value('Leg')).toBe('Long 100 shares of XYZ');
    expect(value('Intended entry')).toBe('$50.00');
    expect(value('Stop')).toBe('$47.50');
    expect(value('Target')).toBe('$56.00');
    expect(value('Plan time')).toBe('2026-10-12 09:30');
    expect(value('Account')).toBe('Fidelity — Roth IRA');
    const baseline = screen.getByRole('region', { name: 'Plan Baseline' });
    const figure = (term: string) => within(baseline).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(figure('1R (original risk)')).toBe('$250.00');
    expect(figure('Original reward')).toBe('$600.00');
    expect(figure('Reward : risk')).toBe('2.4');
    const reflection = screen.getByRole('region', { name: 'Plan Reflection' });
    expect(within(reflection).getByText('Why this trade, why now?')).toBeTruthy();
    expect(within(reflection).getByText('Breakout above the 50-day.')).toBeTruthy();
    expect(within(reflection).getByText('Calm')).toBeTruthy();
  });

  it('should render NotFound and Error states distinctly', async () => {
    const missing = facadeDouble();
    vi.mocked(missing.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'NotFound' });
    renderDetail(missing);
    expect(await screen.findByRole('heading', { name: 'Trade not found' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    cleanup();

    const failing = facadeDouble();
    vi.mocked(failing.TradeViewsAndReporting.getTradeDetail)
      .mockResolvedValueOnce({ kind: 'ChangedDuringAssembly' })
      .mockResolvedValueOnce({ kind: 'Ready', view: plannedDetail, binding: {} } as never);
    renderDetail(failing);
    expect(await screen.findByText(/couldn’t load this trade/i)).toBeTruthy();
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(await screen.findByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
  });
});

function renderView(view: TradeDetailView, writable = true) {
  const facade = facadeDouble();
  vi.mocked(facade.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view, binding: {} } as never);
  render(
    <RuntimeContext.Provider value={{ writable, report: () => undefined }}>
      <MemoryRouter initialEntries={['/trades/trade-1']}>
        <Routes>
          <Route path="/trades/:tradeId" element={<TradeDetail facade={facade} timeZone="America/New_York" />} />
        </Routes>
      </MemoryRouter>
    </RuntimeContext.Provider>,
  );
}

// The text of the definition following a term, within one region.
const termValue = (region: HTMLElement, term: string) => within(region).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
const rowsOf = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    );

describe('Open Trade Detail', () => {
  it('should show Last activity in the Position card as a labelled local time', async () => {
    renderView(openDetailOf([PC1, PC2]));
    const position = await screen.findByRole('region', { name: 'Position' });
    expect(termValue(position, 'Last activity')).toBe('2026-10-12 11:00');
  });

  it('should show lifecycle Open as text, Position, an Open Lots table, and Executions as rows in Fact Order', async () => {
    renderView(openDetailOf([PC1, PC2]));
    expect(await screen.findByRole('heading', { name: 'XYZ', level: 1 })).toBeTruthy();
    expect(screen.getByText('Open', { selector: '.badge' })).toBeTruthy();

    const position = screen.getByRole('region', { name: 'Position' });
    expect(termValue(position, 'Position')).toBe('100 shares of XYZ');
    expect(termValue(position, 'Opening fees')).toBe('$2.00');
    const lots = within(position).getByRole('table', { name: 'Open Lots' });
    expect(rowsOf(lots)).toEqual([
      ['2026-10-12 10:00', '60', '$50.10', '$1.00'],
      ['2026-10-12 11:00', '40', '$50.30', '$1.00'],
    ]);
    // Numbers are right-aligned in tabular numerals.
    expect(within(lots).getAllByText('$50.10')[0]!.className).toContain('number');

    const executions = screen.getByRole('region', { name: 'Executions (2)' });
    expect(
      within(executions)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-labelledby')!.split(' ').map((id) => document.getElementById(id)!.textContent).join(' ')),
    ).toEqual(['Buy 60 XYZ @ $50.10 2026-10-12 10:00 details', 'Buy 40 XYZ @ $50.30 2026-10-12 11:00 details']);
    expect(screen.queryByRole('region', { name: 'Position Changes' })).toBeNull();
  });

  it('should show Entry Quality figures with units once resolved, and Entry not yet resolved: 60 of 100 entered before', async () => {
    renderView(openDetailOf([PC1]));
    const pending = await screen.findByRole('region', {
      name: 'Entry Quality',
    });
    expect(within(pending).getByText('Entry not yet resolved: 60 of 100 entered')).toBeTruthy();
    expect(within(pending).queryByText('Average entry')).toBeNull();
    cleanup();

    renderView(openDetailOf([PC1, PC2]));
    const quality = await screen.findByRole('region', {
      name: 'Entry Quality',
    });
    expect(termValue(quality, 'Resolved at')).toBe('Position Change at 2026-10-12 11:00');
    expect(termValue(quality, 'Average entry')).toBe('$50.18');
    expect(termValue(quality, 'Actual initial risk')).toBe('$270.00 1.08R');
    expect(termValue(quality, 'Actual initial reward')).toBe('$580.00');
    expect(termValue(quality, 'Reward : risk')).toBe('2.15 planned 2.4');
    expect(termValue(quality, 'Slippage')).toBe('$18.00');
    expect(termValue(quality, 'Size')).toBe('1× planned quantity');
    expect(within(quality).getByText('$50.18').className).toContain('number');
    cleanup();

    // An entry at or below the Stop: the actual ratio is Not applicable, never a number.
    const belowStop = positionChange('pc-9', 1, [execution('ex-9', '2026-10-12T14:00:00Z', 2, '100', '47.00', '1.00')]);
    renderView(openDetailOf([belowStop]));
    const flagged = await screen.findByRole('region', {
      name: 'Entry Quality',
    });
    expect(termValue(flagged, 'Reward : risk')).toBe('Not applicable: entry at or beyond the Stop planned 2.4');
  });

  it('should show Planned-Leg Fulfillment and each Entry Size Deviation with its quantity and causing Position Change', async () => {
    renderView(openDetailOf([PC1]));
    const partial = await screen.findByRole('region', {
      name: 'Planned-Leg Fulfillment',
    });
    expect(termValue(partial, 'Long 100 shares of XYZ')).toBe('Partially filled');
    expect(within(screen.getByRole('region', { name: 'Deviations' })).getByText('No Deviations recorded.')).toBeTruthy();
    cleanup();

    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [pc3Excess] }));
    const fulfillment = await screen.findByRole('region', {
      name: 'Planned-Leg Fulfillment',
    });
    expect(termValue(fulfillment, 'Long 100 shares of XYZ')).toBe('Filled with Deviation');
    const deviations = screen.getByRole('region', { name: 'Deviations' });
    expect(
      within(deviations)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Entry Size (Excess): 20 shares above plan, caused by the Position Change at 2026-10-12 14:00.']);
  });

  it('should show Position Change Reflections with snapshot labels and declines as Reflection declined with the reason', async () => {
    const planReflection = {
      kind: 'Entry' as const,
      ...plannedDetail.journal[0],
    };
    renderView(
      openDetailOf([PC1, PC2], {
        journal: [planReflection, pc1Reflection, pc2Decline],
      }),
    );
    const journal = await screen.findByRole('region', { name: 'Journal (3)' });
    const items = within(journal).getAllByRole('listitem');
    expect(items.map((item) => within(item).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Plan Reflection',
      'Position Change Reflection',
      'Position Change Reflection',
    ]);

    const [, entry, decline] = items as [HTMLElement, HTMLElement, HTMLElement];
    expect(termValue(entry, 'Moment')).toBe('2026-10-12 10:00');
    expect(termValue(entry, 'Decision mode')).toBe('Planned');
    expect(termValue(entry, 'Primary emotion')).toBe('Calm');
    expect(termValue(entry, 'Decision confidence')).toBe('4');
    expect(termValue(entry, 'Note')).toBe('Not answered');

    expect(termValue(decline, 'Moment')).toBe('2026-10-12 11:00');
    expect(within(decline).getByText('Reflection declined')).toBeTruthy();
    expect(termValue(decline, 'Reason')).toBe('Same plan, second fill.');
    // The narrative is the Journal section's alone: no separate Plan Reflection region.
    expect(screen.queryByRole('region', { name: 'Plan Reflection' })).toBeNull();
  });

  it('should show an integrity panel listing stored versus expected values when agreement fails', async () => {
    renderView(openDetailOf([PC1, PC2]));
    await screen.findByRole('region', { name: 'Position' });
    expect(screen.queryByRole('region', { name: 'Records disagree' })).toBeNull();
    cleanup();

    renderView(openDetailOf([PC1, PC2, PC3], { storedLifecycle: 'Planned' }));
    const panel = await screen.findByRole('region', {
      name: 'Records disagree',
    });
    // The stored lifecycle stays shown as stored; the disagreement is a separate concept.
    expect(screen.getByText('Planned', { selector: '.badge' })).toBeTruthy();
    expect(rowsOf(within(panel).getByRole('table', { name: 'Stored versus expected' }))).toEqual([
      ['Lifecycle', 'Planned', 'Open'],
      ['Entry Size Deviation, Position Change at 2026-10-12 14:00', 'None', '20 shares'],
    ]);
    expect(within(panel).getByText('Viewing this Trade does not change its records.')).toBeTruthy();
    cleanup();

    const understated = {
      ...pc3Excess,
      versions: [{ ...pc3Excess.versions[0]!, quantityAbovePlan: '15' }],
    };
    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [understated] }));
    const quantities = await screen.findByRole('region', {
      name: 'Records disagree',
    });
    expect(
      rowsOf(
        within(quantities).getByRole('table', {
          name: 'Stored versus expected',
        }),
      ),
    ).toEqual([['Entry Size Deviation, Position Change at 2026-10-12 14:00', '15 shares', '20 shares']]);
  });

  it('should show the Records disagree region naming each fact that cannot be replayed, with the Plan, recorded Position Changes and Journal but no derived figures, when the facts are incoherent', async () => {
    renderView(
      incoherentDetailOf(
        [PC1, PC2],
        [
          { factId: 'ex-2', reason: 'UnknownPlannedLeg' },
          { factId: 'ex-1', reason: 'NonpositiveQuantity' },
        ],
        [pc1Reflection, pc2Decline],
      ),
    );
    const panel = await screen.findByRole('region', { name: 'Records disagree' });
    expect(rowsOf(within(panel).getByRole('table', { name: 'Facts that cannot be replayed' }))).toEqual([
      ['Execution at 2026-10-12 11:00', 'Names a Planned Leg that is not in the Plan'],
      ['Execution at 2026-10-12 10:00', 'Quantity is not positive'],
    ]);
    expect(within(panel).getByText('Viewing this Trade does not change its records.')).toBeTruthy();
    expect(within(panel).getByText(/position, entry, and fulfillment figures are unavailable/i)).toBeTruthy();
    expect(screen.getByText('Open', { selector: '.badge' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Plan' })).toBeTruthy();
    const executions = screen.getByRole('region', { name: 'Executions (2)' });
    expect(
      within(executions)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-labelledby')!.split(' ').map((id) => document.getElementById(id)!.textContent).join(' ')),
    ).toEqual(['Buy 60 XYZ @ $50.10 2026-10-12 10:00 details', 'Buy 40 XYZ @ $50.30 2026-10-12 11:00 details']);
    expect(within(screen.getByRole('region', { name: /^Journal/ })).getByText('Reflection declined')).toBeTruthy();
    // The narrative is the Journal section's alone, as in the Open form.
    expect(screen.queryByRole('region', { name: 'Position Change Reflection' })).toBeNull();
    for (const derived of ['Plan Baseline', 'Position', 'Entry Quality', 'Planned-Leg Fulfillment', 'Deviations']) {
      expect(screen.queryByRole('region', { name: derived })).toBeNull();
    }
  });

  it('should offer Record entry only while Writable', async () => {
    for (const view of [openDetailOf([PC1]), plannedDetail] as TradeDetailView[]) {
      renderView(view, true);
      const link = await screen.findByRole('link', { name: 'Record entry' });
      expect(link.getAttribute('href')).toBe('/trades/trade-1/record-entry');
      cleanup();

      renderView(view, false);
      await screen.findByRole('heading', { name: 'XYZ', level: 1 });
      expect(screen.queryByRole('link', { name: 'Record entry' })).toBeNull();
      cleanup();
    }
  });
});

describe('incoherent Trade Detail', () => {
  const incoherent = () => incoherentDetailOf([PC1], [{ factId: 'ex-1', reason: 'UnknownPlannedLeg' }]);

  it('should not offer Record entry on an IncoherentTradeDetail, while a coherent Open or Planned Detail still offers it', async () => {
    renderView(incoherent(), true);
    await screen.findByRole('region', { name: 'Records disagree' });
    expect(screen.queryByRole('link', { name: 'Record entry' })).toBeNull();
    cleanup();

    for (const view of [openDetailOf([PC1]), plannedDetail] as TradeDetailView[]) {
      renderView(view, true);
      expect((await screen.findByRole('link', { name: 'Record entry' })).getAttribute('href')).toBe('/trades/trade-1/record-entry');
      cleanup();
    }
  });

  it('should explain beside the Records disagree panel that new entries cannot be recorded until the records agree', async () => {
    renderView(incoherent(), true);
    const panel = await screen.findByRole('region', { name: 'Records disagree' });
    expect(within(panel).getByText('New entries cannot be recorded for this Trade until its records agree.')).toBeTruthy();
  });
});

describe('badge meanings', () => {
  it('should give Reflection declined the warning tone', async () => {
    renderView(openDetailOf([PC1, PC2, PC3], { journal: [pc2Decline] }));
    expect(
      (await within(await screen.findByRole('region', { name: /^Journal/ })).findByText('Reflection declined')).getAttribute('data-tone'),
    ).toBe('warning');
  });

  it('should give the lifecycle badge the info tone', async () => {
    renderView(openDetailOf([PC1, PC2]));
    expect((await screen.findByText('Open', { selector: '.badge' })).getAttribute('data-tone')).toBe('info');
  });
});

describe('back to the list', () => {
  it('should show a Back to Trades link above the h1 that opens the Trades tab of the Trades stored lifecycle', async () => {
    const open = facadeDouble();
    vi.mocked(open.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: openDetailOf([PC1]), binding: {} } as never);
    renderDetail(open);
    const h1 = await screen.findByRole('heading', { level: 1 });
    const link = screen.getByRole('link', { name: 'Back to Trades' });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    cleanup();

    const planned = facadeDouble();
    vi.mocked(planned.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'Ready', view: plannedDetail, binding: {} } as never);
    renderDetail(planned);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: 'Back to Trades' }).getAttribute('href')).toBe('/?lifecycle=Planned');
  });

  it('should show the link on Loading, Not Found, and Error states as well', async () => {
    const loading = facadeDouble();
    vi.mocked(loading.TradeViewsAndReporting.getTradeDetail).mockReturnValue(new Promise(() => {}));
    renderDetail(loading);
    expect(screen.getByRole('link', { name: 'Back to Trades' }).getAttribute('href')).toBe('/');
    cleanup();

    const missing = facadeDouble();
    vi.mocked(missing.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'NotFound' });
    renderDetail(missing);
    await screen.findByRole('heading', { name: 'Trade not found' });
    expect(screen.getByRole('link', { name: 'Back to Trades' }).getAttribute('href')).toBe('/');
    cleanup();

    const failing = facadeDouble();
    vi.mocked(failing.TradeViewsAndReporting.getTradeDetail).mockResolvedValue({ kind: 'ChangedDuringAssembly' });
    renderDetail(failing);
    await screen.findByText(/couldn’t load this trade/i);
    expect(screen.getByRole('link', { name: 'Back to Trades' }).getAttribute('href')).toBe('/');
  });
});

describe('summary card', () => {
  const summaryOf = () => screen.findByRole('region', { name: 'Summary' });

  it('should lead the summary card with the Trade Summary text and on an Open Detail with Net cost', async () => {
    renderView(plannedDetail);
    const planned = await summaryOf();
    expect(planned.querySelector('.summary-text')?.textContent).toBe('Long 100 shares @ $50.00');
    expect(within(planned).queryByText('Net cost')).toBeNull();
    cleanup();

    renderView(openDetailOf([PC1]));
    const open = await summaryOf();
    expect(open.querySelector('.summary-text')?.textContent).toBe('Long 60 shares @ $50.10');
    expect(termValue(open, 'Net cost')).toBe('$3,007.00');
  });

  it('should open a Planned Detail with a summary of Intended entry, Stop, and Target, each with its text label, plus 1R and Reward : risk', async () => {
    renderView(plannedDetail);
    const card = await summaryOf();
    expect(termValue(card, 'Intended entry')).toBe('$50.00');
    expect(termValue(card, 'Stop')).toBe('$47.50');
    expect(termValue(card, 'Target')).toBe('$56.00');
    expect(termValue(card, '1R')).toBe('$250.00');
    expect(termValue(card, 'Reward : risk')).toBe('2.4');
    expect(within(card).getByText('$50.00', { selector: 'dd' }).className).toContain('number');
  });

  it('should open an Open Detail with the Position quantity against plan, the entry status, opening fees, Stop, and Target', async () => {
    renderView(openDetailOf([PC1, PC2, PC3]));
    const card = await summaryOf();
    expect(termValue(card, 'Quantity')).toBe('120 of 100 shares');
    expect(termValue(card, 'Entry')).toBe('Resolved');
    expect(termValue(card, 'Opening fees')).toBe('$3.00');
    expect(termValue(card, 'Stop')).toBe('$47.50');
    expect(termValue(card, 'Target')).toBe('$56.00');
    expect(within(card).queryByText('Intended entry')).toBeNull();
    cleanup();

    renderView(openDetailOf([PC1]));
    expect(termValue(await summaryOf(), 'Entry')).toBe('Entering');
  });

  it('should add the Average entry and Actual initial risk to the Open summary once the entry is resolved, and say Entry not yet resolved before', async () => {
    renderView(openDetailOf([PC1, PC2]));
    const resolved = await summaryOf();
    expect(termValue(resolved, 'Average entry')).toBe('$50.18');
    expect(termValue(resolved, 'Actual initial risk')).toBe('$270.00');
    expect(within(resolved).queryByText('Entry not yet resolved')).toBeNull();
    cleanup();

    renderView(openDetailOf([PC1]));
    const pending = await summaryOf();
    expect(within(pending).getByText('Entry not yet resolved')).toBeTruthy();
    expect(within(pending).queryByText('Average entry')).toBeNull();
    expect(within(pending).queryByText('Actual initial risk')).toBeNull();
  });

  it('should show an active-Deviation badge in the Open summary when a recorded Deviation is Active', async () => {
    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [pc3Excess] }));
    const card = await summaryOf();
    expect(within(card).getByText('Deviation active').getAttribute('data-tone')).toBe('warning');
    cleanup();

    renderView(openDetailOf([PC1, PC2]));
    expect(within(await summaryOf()).queryByText('Deviation active')).toBeNull();
  });

  it('should show no summary figures on an incoherent Detail, leaving the Records disagree panel first', async () => {
    renderView(incoherentDetailOf([PC1, PC2], [{ factId: 'ex-1', reason: 'NonpositiveQuantity' }]));
    const panel = await screen.findByRole('region', { name: 'Records disagree' });
    expect(screen.queryByRole('region', { name: 'Summary' })).toBeNull();
    const regions = screen.getAllByRole('region').filter((r) => r.getAttribute('aria-label') === null || r.tagName === 'SECTION');
    expect(regions[0]).toBe(panel);
  });
});

// PC4 holds two Executions at one Economic Time, so the Detail has four Executions in all.
const PC4 = positionChange('pc-4', 7, [
  execution('ex-4', '2026-10-12T19:00:00Z', 8, '10', '52.00', '0.50'),
  execution('ex-5', '2026-10-12T19:00:00Z', 9, '5', '52.10', '0.25'),
]);

describe('Executions', () => {
  it('should label the region Executions with its count of Executions and list them in Fact Order', async () => {
    renderView(openDetailOf([PC1, PC2, PC4]));
    const section = await screen.findByRole('region', { name: 'Executions (4)' });
    const rows = within(section).getAllByRole('listitem');
    expect(rows.map((row) => /Buy (\d+)/.exec(row.textContent ?? '')?.[1])).toEqual(['60', '40', '10', '5']);
  });

  it('should name each Execution row button exactly as its visible text followed by details', async () => {
    renderView(openDetailOf([PC1, PC2, PC4]));
    const section = await screen.findByRole('region', { name: 'Executions (4)' });
    expect(within(section).getByRole('button', { name: 'Buy 60 XYZ @ $50.10 2026-10-12 10:00 details' })).toBeTruthy();
    expect(within(section).getByRole('button', { name: 'Buy 40 XYZ @ $50.30 2026-10-12 11:00 details' })).toBeTruthy();
  });

  it('should show each Execution collapsed as one row with action, quantity, symbol, price, and Economic Time with no fee, with no Executions table and no Position Change headings', async () => {
    renderView(openDetailOf([PC1, PC2, PC4]));
    const section = await screen.findByRole('region', { name: 'Executions (4)' });
    const rows = within(section).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('.execution-summary')?.textContent)).toEqual([
      'Buy 60 XYZ @ $50.10 2026-10-12 10:00',
      'Buy 40 XYZ @ $50.30 2026-10-12 11:00',
      'Buy 10 XYZ @ $52.00 2026-10-12 15:00',
      'Buy 5 XYZ @ $52.10 2026-10-12 15:00',
    ]);
    // The fee is in the expanded details only.
    expect(within(section).queryByText(/fee|\$1\.00|\$0\.50/i)).toBeNull();
    expect(screen.queryByRole('table', { name: 'Executions' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: /^Position Change at/ })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Position Changes' })).toBeNull();
  });

  it('should give each row a disclosure button named for its Execution, collapsed by default with aria-expanded false', async () => {
    renderView(openDetailOf([PC1, PC2, PC4]));
    const section = await screen.findByRole('region', { name: 'Executions (4)' });
    const buttons = within(section).getAllByRole('button');
    // Label in Name: the accessible name begins with the row's visible text.
    const visible = buttons.map((b) => b.querySelector('.execution-summary')!.textContent);
    expect(visible.map((v) => v.slice(0, 10))).toEqual(['Buy 60 XYZ', 'Buy 40 XYZ', 'Buy 10 XYZ', 'Buy 5 XYZ ']);
    for (const text of visible) expect(within(section).getByRole('button', { name: `${text} details` })).toBeTruthy();
    expect(buttons.every((b) => !b.hasAttribute('aria-label'))).toBe(true);
    for (const button of buttons) {
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(button.getAttribute('aria-controls')).toBeTruthy();
      expect(button.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    }
    expect(new Set(buttons.map((b) => b.getAttribute('aria-controls'))).size).toBe(4);
  });

  it('should show the Instrument, Economic Time, fee, and the Position Change with its Execution count when the row is expanded, and hide them again when it is collapsed', async () => {
    renderView(openDetailOf([PC1, PC2, PC4]));
    await screen.findByRole('region', { name: 'Executions (4)' });
    const toggle = screen.getByRole('button', { name: /^Buy 10 XYZ @ .* 15:00 details$/ });
    expect(screen.queryByText('Instrument', { selector: 'dt' })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const details = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(termValue(details, 'Instrument')).toBe('XYZ');
    expect(termValue(details, 'Economic Time')).toBe('2026-10-12 15:00');
    expect(termValue(details, 'Fee')).toBe('$0.50');
    expect(termValue(details, 'Position Change')).toBe('2026-10-12 15:00 · 2 Executions');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toBeNull();
    // A Position Change with one Execution says so in the singular.
    fireEvent.click(screen.getByRole('button', { name: /^Buy 60 XYZ @ .* 10:00 details$/ }));
    expect(termValue(screen.getByRole('region', { name: 'Executions (4)' }), 'Position Change')).toBe('2026-10-12 10:00 · 1 Execution');
  });

  it("should show the Position Change Reflection's answers in the expanded row of an Execution whose Position Change has one", async () => {
    renderView(openDetailOf([PC1, PC2, PC4], { journal: [pc1Reflection] }));
    await screen.findByRole('region', { name: 'Executions (4)' });
    const toggle = screen.getByRole('button', { name: /^Buy 60 XYZ @ .* 10:00 details$/ });
    fireEvent.click(toggle);
    const details = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(within(details).getByText('Position Change Reflection')).toBeTruthy();
    expect(termValue(details, 'Decision mode')).toBe('Planned');
    expect(termValue(details, 'Primary emotion')).toBe('Calm');
    expect(termValue(details, 'Decision confidence')).toBe('4');
    expect(termValue(details, 'Note')).toBe('Not answered');
  });

  it('should show Reflection declined with the reason, or No reflection, when the Position Change has a decline or no reflection', async () => {
    renderView(openDetailOf([PC1, PC2, PC4], { journal: [pc1Reflection, pc2Decline] }));
    await screen.findByRole('region', { name: 'Executions (4)' });
    const open = (name: RegExp) => {
      const toggle = screen.getByRole('button', { name });
      fireEvent.click(toggle);
      return document.getElementById(toggle.getAttribute('aria-controls')!)!;
    };
    const declined = open(/^Buy 40 XYZ @ .* 11:00 details$/);
    expect(within(declined).getByText('Reflection declined')).toBeTruthy();
    expect(within(declined).getByText('Reason: Same plan, second fill.')).toBeTruthy();
    expect(within(declined).queryByText('No reflection')).toBeNull();
    const none = open(/^Buy 10 XYZ @ .* 15:00 details$/);
    expect(within(none).getByText('No reflection')).toBeTruthy();
    expect(within(none).queryByText('Reflection declined')).toBeNull();
  });

  it('should mark the Executions of a Position Change with several Executions as one group and show the shared reflection in each ones expanded row', async () => {
    const pc4Reflection = { ...pc1Reflection, id: 'e-4', positionChangeId: 'pc-4', momentTime: '2026-10-12T19:00:00Z' };
    renderView(openDetailOf([PC1, PC2, PC4], { journal: [pc1Reflection, pc4Reflection] }));
    const section = await screen.findByRole('region', { name: 'Executions (4)' });
    const rows = within(section).getAllByRole('listitem');
    expect(rows.map((row) => within(row).queryByText(/^Same Position Change/)?.textContent ?? null)).toEqual([
      null,
      null,
      'Same Position Change · 1 of 2',
      'Same Position Change · 2 of 2',
    ]);
    expect(rows[2]!.getAttribute('data-group')).toBe('pc-4');
    expect(rows[3]!.getAttribute('data-group')).toBe('pc-4');
    for (const row of rows.slice(2)) {
      fireEvent.click(within(row).getByRole('button'));
      expect(termValue(row, 'Decision mode')).toBe('Planned');
    }
  });

  it('should toggle with Enter and Space and keep focus on the button', async () => {
    const user = userEvent.setup();
    renderView(openDetailOf([PC1, PC2, PC4]));
    await screen.findByRole('region', { name: 'Executions (4)' });
    const toggle = screen.getByRole('button', { name: /^Buy 60 XYZ @ .* 10:00 details$/ });
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(toggle);
    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Enter}');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Journal entries', () => {
  const planEntry: NarrativeItem = { kind: 'Entry', ...plannedDetail.journal[0] };

  async function journalItems(journal: NarrativeItem[]) {
    renderView(openDetailOf([PC1, PC2], { journal }));
    const region = await screen.findByRole('region', { name: /^Journal/ });
    return { region, items: within(region).getAllByRole('listitem') };
  }

  it('should show each Entry as its own item with the Entry Type as a badge, the Anchor, the Source labelled as Source, and the moment time', async () => {
    const { items } = await journalItems([pc1Reflection]);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(within(item).getByText('Position Change Reflection', { selector: '.badge' })).toBeTruthy();
    expect(termValue(item, 'Anchor')).toBe('Trade XYZ');
    expect(termValue(item, 'Source')).toBe('Position Change');
    expect(termValue(item, 'Moment')).toBe('2026-10-12 10:00');
    expect(termValue(item, 'Decision mode')).toBe('Planned');
  });

  it('should show the authored time as well when it differs from the moment time', async () => {
    const same = { ...pc1Reflection, authoredTime: pc1Reflection.momentTime } as NarrativeItem;
    const { items } = await journalItems([planEntry, same]);
    const [differs, equal] = items as [HTMLElement, HTMLElement];
    expect(termValue(differs, 'Authored')).toBe('2026-10-12 10:05');
    expect(within(equal).queryByText('Authored', { selector: 'dt' })).toBeNull();
  });

  it('should not show the authored time when it reads the same as the moment time', async () => {
    const moment = new Date(pc1Reflection.momentTime);
    const seconds = { ...pc1Reflection, authoredTime: new Date(moment.getTime() + 30_000).toISOString() } as NarrativeItem;
    const { items } = await journalItems([seconds]);
    expect(within(items[0]!).queryByText('Authored', { selector: 'dt' })).toBeNull();
  });

  it('should show a decline with the warning badge Reflection declined, its reason or No reason given, its Anchor and Source', async () => {
    const noReason = { ...pc2Decline, id: 'd-2', reason: undefined } as NarrativeItem;
    const { items } = await journalItems([pc2Decline, noReason]);
    const [withReason, without] = items as [HTMLElement, HTMLElement];
    expect(within(withReason).getByText('Reflection declined').getAttribute('data-tone')).toBe('warning');
    expect(termValue(withReason, 'Reason')).toBe('Same plan, second fill.');
    expect(termValue(without, 'Reason')).toBe('No reason given');
    for (const item of [withReason, without]) {
      expect(termValue(item, 'Anchor')).toBe('Trade XYZ');
      expect(termValue(item, 'Source')).toBe('Position Change');
    }
  });

  it('should label the region with the number of items', async () => {
    renderView(openDetailOf([PC1, PC2], { journal: [planEntry, pc1Reflection, pc2Decline] }));
    expect(await screen.findByRole('region', { name: 'Journal (3)' })).toBeTruthy();
  });
});

describe('R lines', () => {
  async function detailEntryQuality() {
    renderView(openDetailOf([PC1, PC2]));
    return screen.findByRole('region', { name: 'Entry Quality' });
  }
  const valueOf = (region: HTMLElement, term: string) => within(region).getByText(term, { selector: 'dt' }).nextElementSibling as HTMLElement;

  it('should put the R multiple on its own line below Actual initial risk on the receipt and in Entry Quality', async () => {
    const value = valueOf(await detailEntryQuality(), 'Actual initial risk');
    const [amount, second] = Array.from(value.children) as HTMLElement[];
    expect(amount!.textContent).toBe('$270.00');
    expect(second!.textContent).toBe('1.08R');
    expect(second!.className).toContain('second-line');
    expect(value.textContent).not.toMatch(/[()]/);
  });

  it('should put planned 2.4 on its own line below the Reward : risk value on the receipt and in Entry Quality', async () => {
    const value = valueOf(await detailEntryQuality(), 'Reward : risk');
    const [amount, second] = Array.from(value.children) as HTMLElement[];
    expect(amount!.textContent).toBe('2.15');
    expect(second!.textContent).toBe('planned 2.4');
    expect(second!.className).toContain('second-line');
    expect(value.textContent).not.toMatch(/[()]/);
  });

  it('should keep the amount and its second line in one value cell, read in order', async () => {
    const quality = await detailEntryQuality();
    expect(valueOf(quality, 'Actual initial risk').textContent).toBe('$270.00 1.08R');
    expect(valueOf(quality, 'Reward : risk').textContent).toBe('2.15 planned 2.4');
  });
});

describe('fulfillment row', () => {
  it('should show Planned-Leg Fulfillment as a label/value row with the leg as label and the result as value', async () => {
    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [pc3Excess] }));
    const fulfillment = await screen.findByRole('region', { name: 'Planned-Leg Fulfillment' });
    const label = within(fulfillment).getByText('Long 100 shares of XYZ', { selector: 'dt' });
    expect(label.closest('dl')?.classList.contains('figure-grid')).toBe(true);
    expect(label.nextElementSibling?.textContent).toBe('Filled with Deviation');
  });
});

describe('journal prose', () => {
  async function journalItem() {
    renderView(openDetailOf([PC1, PC2], { journal: [pc1Reflection] }));
    const region = await screen.findByRole('region', { name: /^Journal/ });
    return within(region).getAllByRole('listitem')[0]!;
  }

  it('should show each prompt question above its answer, not beside it', async () => {
    const item = await journalItem();
    const question = within(item).getByText('Primary emotion', { selector: 'dt' });
    expect(question.closest('dl')?.classList.contains('answers')).toBe(true);
    expect(question.nextElementSibling?.textContent).toBe('Calm');
  });

  it('should keep Anchor, Source, Moment and Authored as a label/value list', async () => {
    const item = await journalItem();
    const anchor = within(item).getByText('Anchor', { selector: 'dt' }).closest('dl')!;
    expect(anchor.classList.contains('answers')).toBe(false);
    for (const term of ['Source', 'Moment', 'Authored']) {
      expect(within(anchor).getByText(term, { selector: 'dt' })).toBeTruthy();
    }
    expect(within(anchor).queryByText('Primary emotion')).toBeNull();
  });
});

describe('deviations', () => {
  const superseded = {
    ...pc3Excess,
    versions: [{ ...pc3Excess.versions[0]!, status: 'Superseded' as const, reason: 'NoLongerExpected' as const }],
  } as unknown as typeof pc3Excess;
  const deviationItem = async (recorded: typeof pc3Excess) => {
    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [recorded] }));
    const region = await screen.findByRole('region', { name: 'Deviations' });
    return within(region).getByRole('listitem');
  };

  it('should show an Active Deviation as plain text with no status badge', async () => {
    const item = await deviationItem(pc3Excess);
    expect(item.textContent).toBe('Entry Size (Excess): 20 shares above plan, caused by the Position Change at 2026-10-12 14:00.');
    expect(item.querySelector('.badge, del')).toBeNull();
  });

  it('should strike through a Superseded Deviation and name it Superseded for assistive technology', async () => {
    const item = await deviationItem(superseded);
    const struck = item.querySelector('del')!;
    expect(struck.textContent).toContain('Entry Size (Excess): 20 shares above plan');
    expect(item.querySelector('.badge')).toBeNull();
    const hidden = item.querySelector('.visually-hidden')!;
    expect(hidden.textContent).toBe('Superseded');
    expect(hidden.compareDocumentPosition(struck) & Node.DOCUMENT_POSITION_FOLLOWING || struck.contains(hidden)).toBeTruthy();
  });

  it('should keep the summary card Deviation active badge while a Deviation is Active', async () => {
    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [pc3Excess] }));
    const card = await screen.findByRole('region', { name: 'Summary' });
    expect(within(card).getByText('Deviation active').getAttribute('data-tone')).toBe('warning');
  });
});

const TUE_CLOSE = '2026-10-13T20:00:00Z';
const available = (price: string, extra: { correctionReason?: string } = {}) =>
  ({ kind: 'Available', mark: { revisionId: 'm-1', revisionNumber: extra.correctionReason ? 2 : 1, price, source: 'Manual', savedAt: '2026-10-13T21:30:00Z', ...extra } }) as const;
const tuesday = (resolution: Parameters<typeof openDetailAt>[1]['resolution']): Parameters<typeof openDetailAt>[1] => ({
  instrumentKey: 'XYZ',
  tradingDate: '2026-10-13',
  closeInstant: TUE_CLOSE,
  resolution,
});

describe('valuation', () => {
  it('should show the Expected Mark Date, the Mark price, source Manual, save time in the Workspace zone, and a Corrected badge with its reason when the effective revision is a Correction', async () => {
    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00', { correctionReason: 'Typo in the first save.' }))));
    const valuation = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(valuation, 'Expected Mark Date')).toBe('Tue Oct 13');
    expect(termValue(valuation, 'Mark')).toBe('$52.00');
    expect(termValue(valuation, 'Source')).toBe('Manual');
    expect(termValue(valuation, 'Saved')).toBe('2026-10-13 17:30');
    expect(within(valuation).getByText('Corrected', { selector: '.badge' })).toBeTruthy();
    expect(within(valuation).getByText('Typo in the first save.')).toBeTruthy();
    cleanup();

    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00'))));
    const plain = await screen.findByRole('region', { name: 'Valuation' });
    expect(within(plain).queryByText('Corrected')).toBeNull();
  });

  it('should show realized to date, open, Current Marked Trade P&L, and incurred fees as separate figures with units and signs', async () => {
    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00'))));
    const valuation = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(valuation, 'Realized to date')).toBe('$0.00');
    expect(termValue(valuation, 'Open P&L')).toBe('+$180.00');
    expect(termValue(valuation, 'Current Marked Trade P&L')).toBe('+$180.00 · +0.72R');
    expect(termValue(valuation, 'Incurred fees')).toBe('$2.00');
    cleanup();

    // A loss carries its minus; realized and fees keep their values when the Mark is missing.
    renderView(openDetailAt([PC1, PC2], tuesday(available('48.00'))));
    const loss = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(loss, 'Open P&L')).toBe('−$220.00');
    expect(termValue(loss, 'Current Marked Trade P&L')).toBe('−$220.00 · −0.88R');
    cleanup();

    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'Missing' })));
    const missing = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(missing, 'Realized to date')).toBe('$0.00');
    expect(termValue(missing, 'Incurred fees')).toBe('$2.00');
    expect(termValue(missing, 'Open P&L')).toBe('Mark missing: XYZ, Tue Oct 13');
    expect(termValue(missing, 'Current Marked Trade P&L')).toBe('Mark missing: XYZ, Tue Oct 13');
  });
  it('should show realized to date with a plus sign for a gain and a minus sign for a loss, in the current and the dated figures', async () => {
    const withRealized = (value: bigint) => {
      const detail = openDetailAt([PC1, PC2], tuesday({ kind: 'Missing', stale: monContext }));
      const realizedToDate = { kind: 'Value' as const, value: Rational.of(value) };
      const { datedLine } = detail.current;
      if (!datedLine) throw new Error('fixture needs a dated line');
      return { ...detail, current: { ...detail.current, evaluation: { ...detail.current.evaluation, realizedToDate }, datedLine: { ...datedLine, evaluation: { ...datedLine.evaluation, realizedToDate } } } };
    };
    renderView(withRealized(120n));
    const gain = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(gain, 'Realized to date')).toBe('+$120.00');
    expect(termValue(screen.getByRole('region', { name: 'At Mon Oct 12 close' }), 'Realized to date')).toBe('+$120.00');
    cleanup();

    renderView(withRealized(-75n));
    const loss = await screen.findByRole('region', { name: 'Valuation' });
    expect(termValue(loss, 'Realized to date')).toBe('−$75.00');
    expect(termValue(screen.getByRole('region', { name: 'At Mon Oct 12 close' }), 'Realized to date')).toBe('−$75.00');
  });
});

describe('risk and reward', () => {
  it('should show Original risk, Risk to stop, Worst case, Reward to target, Max reward, and Original reward with dollars and R, rendering Unbounded as Unbounded and Unavailable with its reason, never as 0', async () => {
    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00'))));
    const risk = await screen.findByRole('region', { name: 'Risk and reward' });
    expect(termValue(risk, 'Original risk')).toBe('$250.00 · 1.00R');
    expect(termValue(risk, 'Risk to stop')).toBe('$450.00 · 1.80R');
    expect(termValue(risk, 'Worst case')).toBe('$5,200.00 · 20.80R');
    expect(termValue(risk, 'Reward to target')).toBe('$400.00 · 1.60R');
    expect(termValue(risk, 'Max reward')).toBe('Unbounded above');
    expect(termValue(risk, 'Original reward')).toBe('$600.00 · 2.40R');
    cleanup();

    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'Missing' })));
    const missing = await screen.findByRole('region', { name: 'Risk and reward' });
    for (const term of ['Risk to stop', 'Worst case', 'Reward to target']) expect(termValue(missing, term)).toBe('Mark missing: XYZ, Tue Oct 13');
    expect(termValue(missing, 'Max reward')).toBe('Unbounded above');
    expect(termValue(missing, 'Original risk')).toBe('$250.00 · 1.00R');
  });

  it('should show each condition with its boundary, status as text, distance, and Overrun when crossed', async () => {
    renderView(openDetailAt([PC1, PC2], tuesday(available('52.00'))));
    const conditions = await screen.findByRole('table', { name: 'Conditions' });
    expect(rowsOf(conditions)).toEqual([
      ['Stop', '$47.50', 'Active', '$450.00 · 1.80R', 'None'],
      ['Target', '$56.00', 'Active', '$400.00 · 1.60R', 'None'],
    ]);
    cleanup();

    renderView(openDetailAt([PC1, PC2], tuesday(available('57.00'))));
    expect(rowsOf(await screen.findByRole('table', { name: 'Conditions' }))[1]).toEqual(['Target', '$56.00', 'Reached', '$0.00 · 0.00R', '$100.00 · 0.40R']);
    cleanup();

    renderView(openDetailAt([PC1, PC2], tuesday(available('47.00'))));
    expect(rowsOf(await screen.findByRole('table', { name: 'Conditions' }))[0]).toEqual(['Stop', '$47.50', 'Breached', '$0.00 · 0.00R', '$50.00 · 0.20R']);
    cleanup();

    // Without a Mark the status says why, and no distance or Overrun is invented.
    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'Missing' })));
    expect(rowsOf(await screen.findByRole('table', { name: 'Conditions' }))[0]).toEqual(['Stop', '$47.50', 'Mark missing: XYZ, Tue Oct 13', '—', '—']);
  });
});

const MON_CLOSE = '2026-10-12T20:00:00Z';
const monContext = { tradingDate: '2026-10-12', price: '51.20', revisionId: 'm-0', revisionNumber: 1, closeInstant: MON_CLOSE };

describe('missing or later evidence (P12, P13)', () => {
  it('should show Mark missing for XYZ on Tue Oct 13, the Stale context labelled stale, an At Mon Oct 12 close section with its own figures, and a link to the Review Marks family', async () => {
    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'Missing', stale: monContext })));
    const valuation = await screen.findByRole('region', { name: 'Valuation' });
    const link = within(valuation).getByRole('link', { name: 'Mark missing for XYZ on Tue Oct 13' });
    expect(link.getAttribute('href')).toBe('/review?instrument=XYZ');
    expect(within(valuation).getByText('Stale context: $51.20 from Mon Oct 12 close (stale, not used in any current figure)')).toBeTruthy();
    expect(termValue(valuation, 'Current Marked Trade P&L')).toBe('Mark missing: XYZ, Tue Oct 13');

    const dated = screen.getByRole('region', { name: 'At Mon Oct 12 close' });
    expect(termValue(dated, 'Mark')).toBe('$51.20');
    expect(termValue(dated, 'Open P&L')).toBe('+$100.00');
    expect(termValue(dated, 'Current Marked Trade P&L')).toBe('+$100.00 · +0.40R');
    expect(termValue(dated, 'Risk to stop')).toBe('$370.00 · 1.48R');
    expect(termValue(dated, 'Reward to target')).toBe('$480.00 · 1.92R');
  });

  it('should word every Mark-dependent figure Not available outside calendar coverage while realized and fees keep their values', async () => {
    renderView(openDetailUncovered([PC1, PC2], '2031-01-02'));
    const valuation = await screen.findByRole('region', { name: 'Valuation' });
    expect(within(valuation).queryByText('Expected Mark Date')).toBeNull();
    expect(termValue(valuation, 'Realized to date')).toBe('$0.00');
    expect(termValue(valuation, 'Incurred fees')).toBe('$2.00');
    expect(termValue(valuation, 'Current Marked Trade P&L')).toBe('Not available');
    expect(within(valuation).queryByText(/Mark missing/)).toBeNull();
    const risk = screen.getByRole('region', { name: 'Risk and reward' });
    expect(termValue(risk, 'Risk to stop')).toBe('Not available');
    expect(termValue(risk, 'Max reward')).toBe('Unbounded above');
  });

  it('should show an acknowledged unavailable Mark as the trader acknowledgment it is, not a link and not a price', async () => {
    const acknowledgment = { versionId: 'ack-1', kind: 'Asserted', observedAt: '2026-10-13T21:00:00Z', savedAt: '2026-10-13T21:30:00Z' };
    renderView(openDetailAt([PC1, PC2], tuesday({ kind: 'AcknowledgedUnavailable', acknowledgment, stale: monContext } as never)));
    const valuation = await screen.findByRole('region', { name: 'Valuation' });
    expect(within(valuation).getByText('Acknowledged unavailable for XYZ on Tue Oct 13: your acknowledgment, not a price')).toBeTruthy();
    expect(within(valuation).queryByRole('link')).toBeNull();
    expect(within(valuation).queryByText(/Mark missing for/)).toBeNull();
    expect(termValue(valuation, 'Current Marked Trade P&L')).toBe('Acknowledged unavailable: XYZ, Tue Oct 13');
    expect(within(valuation).getByText(/^Stale context: \$51\.20/)).toBeTruthy();
  });

  it('should show an At entry section for shares bought after the dated close, with risk and reward labelled from entry and no P&L', async () => {
    const afterClose = positionChange('pc-9', 3, [execution('ex-9', '2026-10-12T21:00:00Z', 4, '40', '50.30', '1.00')]);
    const monday = { instrumentKey: 'XYZ', tradingDate: '2026-10-12', closeInstant: MON_CLOSE, resolution: available('51.20') } as const;
    renderView(openDetailAt([PC1, afterClose], monday));
    const entry = await screen.findByRole('region', { name: 'At entry' });
    expect(termValue(entry, 'Quantity')).toBe('40 shares');
    expect(termValue(entry, 'Average entry')).toBe('$50.30');
    expect(termValue(entry, 'Risk from entry')).toBe('$112.00 · 0.45R');
    expect(termValue(entry, 'Reward from entry')).toBe('$228.00 · 0.91R');
    expect(within(entry).queryByText(/P&L/)).toBeNull();
    // The earlier close keeps its own line, and the current P&L waits for the next close.
    expect(termValue(screen.getByRole('region', { name: 'At Mon Oct 12 close' }), 'Current Marked Trade P&L')).toBe('+$65.00 · +0.26R');
    expect(termValue(screen.getByRole('region', { name: 'Valuation' }), 'Current Marked Trade P&L')).toBe('Awaiting the next close');
  });
});

describe('Actions', () => {
  const action = (id: string, reviewDate: string, label: string, intent: string | undefined, edited = false): NarrativeItem => ({
    kind: 'Entry',
    id,
    entryType: 'Daily Trade Review',
    source: 'Daily Review',
    anchor: { kind: 'Trade', tradeId: 'trade-1' },
    momentTime: `${reviewDate}T21:00:00Z`,
    authoredTime: `${reviewDate}T21:05:00Z`,
    reviewDate,
    ...(edited && { edited: true as const }),
    responses: [
      { prompt: 'Action', answer: { kind: 'Option', label } },
      { prompt: 'Intent', answer: intent === undefined ? { kind: 'Unanswered' } : { kind: 'Text', text: intent } },
    ],
  });

  it('should list Daily Trade Review Actions in the narrative with Review Date, Action, Intent, and an Edited indicator', async () => {
    renderView(openDetailOf([PC1, PC2], { journal: [action('a-1', '2026-10-12', 'Hold', undefined), action('a-2', '2026-10-13', 'Exit', 'Take the gain.', true)] }));
    const journal = await screen.findByRole('region', { name: 'Journal (2)' });
    const [hold, exit] = within(journal).getAllByRole('listitem');
    expect(termValue(hold!, 'Review Date')).toBe('Mon Oct 12');
    expect(termValue(hold!, 'Action')).toBe('Hold');
    expect(termValue(hold!, 'Intent')).toBe('Not answered');
    expect(within(hold!).queryByText('Edited')).toBeNull();
    expect(termValue(exit!, 'Review Date')).toBe('Tue Oct 13');
    expect(termValue(exit!, 'Action')).toBe('Exit');
    expect(termValue(exit!, 'Intent')).toBe('Take the gain.');
    expect(within(exit!).getByText('Edited', { selector: '.badge' })).toBeTruthy();
  });
});
