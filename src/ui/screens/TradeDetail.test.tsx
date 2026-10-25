// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facadeDouble } from '../../../tests/support/facade-double.ts';
import {
  execution,
  incoherentDetailOf,
  openDetailOf,
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
import type { TradeDetailView } from '../../app/types.ts';
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
  it('should show lifecycle Open as text, Position, an Open Lots table, and Position Changes with their Executions in Fact Order', async () => {
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

    const changes = screen.getByRole('region', { name: 'Position Changes' });
    expect(
      within(changes)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Position Change at 2026-10-12 10:00', 'Position Change at 2026-10-12 11:00']);
    const executions = within(changes).getAllByRole('table', {
      name: 'Executions',
    });
    expect(executions.map(rowsOf)).toEqual([
      [['2026-10-12 10:00', 'Buy', 'XYZ', '60', '$50.10', '$1.00']],
      [['2026-10-12 11:00', 'Buy', 'XYZ', '40', '$50.30', '$1.00']],
    ]);
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
    expect(termValue(quality, 'Actual initial risk')).toBe('$270.00 (1.08R)');
    expect(termValue(quality, 'Actual initial reward')).toBe('$580.00');
    expect(termValue(quality, 'Reward : risk')).toBe('2.15 (planned 2.4)');
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
    expect(termValue(flagged, 'Reward : risk')).toBe('Not applicable: entry at or beyond the Stop (planned 2.4)');
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
    ).toEqual(['Entry Size (Excess): 20 shares above plan, caused by the Position Change at 2026-10-12 14:00. Active']);
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
    const journal = await screen.findByRole('region', { name: 'Journal' });
    const items = within(journal).getAllByRole('listitem');
    expect(items.map((item) => within(item).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Plan Reflection',
      'Position Change Reflection',
      'Position Change Reflection',
    ]);

    const [, entry, decline] = items as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(entry).getByText('Position Change at 2026-10-12 10:00')).toBeTruthy();
    expect(termValue(entry, 'Decision mode')).toBe('Planned');
    expect(termValue(entry, 'Primary emotion')).toBe('Calm');
    expect(termValue(entry, 'Decision confidence')).toBe('4');
    expect(termValue(entry, 'Note')).toBe('Not answered');

    expect(within(decline).getByText('Position Change at 2026-10-12 11:00')).toBeTruthy();
    expect(within(decline).getByText('Reflection declined')).toBeTruthy();
    expect(within(decline).getByText('Reason: Same plan, second fill.')).toBeTruthy();
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
    const changes = screen.getByRole('region', { name: 'Position Changes' });
    expect(within(changes).getAllByRole('table', { name: 'Executions' }).map(rowsOf)).toEqual([
      [['2026-10-12 10:00', 'Buy', 'XYZ', '60', '$50.10', '$1.00']],
      [['2026-10-12 11:00', 'Buy', 'XYZ', '40', '$50.30', '$1.00']],
    ]);
    expect(within(screen.getByRole('region', { name: 'Journal' })).getByText('Reflection declined')).toBeTruthy();
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
  it('should give an Active Deviation and Reflection declined the warning tone', async () => {
    renderView(openDetailOf([PC1, PC2, PC3], { recordedDeviations: [pc3Excess], journal: [pc2Decline] }));
    const deviations = await screen.findByRole('region', { name: 'Deviations' });
    expect(within(deviations).getByText('Active').getAttribute('data-tone')).toBe('warning');
    expect(within(screen.getByRole('region', { name: 'Journal' })).getByText('Reflection declined').getAttribute('data-tone')).toBe('warning');
  });

  it('should give the lifecycle badge the info tone', async () => {
    renderView(openDetailOf([PC1, PC2]));
    expect((await screen.findByText('Open', { selector: '.badge' })).getAttribute('data-tone')).toBe('info');
  });
});
