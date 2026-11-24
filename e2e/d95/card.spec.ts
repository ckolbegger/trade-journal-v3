import type { Locator } from '@playwright/test';
import { expectNoSidewaysScroll, setWidth } from '../d7p/support.ts';
import { actionFormOf, backToTrade, createTrades, detail, enterMark, expect, fillRows, FOUR_TRADES, MONDAY_1700, onboardedAt, openReview, reachCard, saveAction, setClock, tradeCard, test } from '../d4/support.ts';
import { openCardFixture } from '../d5r/support.ts';
import { openStandardReview } from '../d9ar/support.ts';
import { atBothWidths } from './support.ts';

const boxOf = async (locator: Locator) => (await locator.boundingBox())!;

test.describe('B95.4 The card', () => {
  test('should wrap a long unbroken Thesis inside the Plan box at 375 wide with no sideways scroll', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    const long = 'Unbroken'.repeat(14);
    await createTrades(page, [{ ...FOUR_TRADES[1]!, plan: { ...FOUR_TRADES[1]!.plan, thesis: long } }]);
    await openReview(page);
    const plan = page.getByRole('region', { name: 'Plan' });
    await setWidth(page, 375);
    await expect(plan.getByText(long, { exact: true })).toBeVisible();
    await expectNoSidewaysScroll(page, 'Review card Plan box with a long Thesis at 375 px');
    await context.close();
  });

  test('should wrap Entry, Stop and Target to two lines at 375 wide and keep every value', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    // ABC: 100 shares at $30.00, a Stop at $28.00 and a Target at $36.00. Its card is the one open on load.
    await createTrades(page, [FOUR_TRADES[1]!]);
    await openReview(page);
    const plan = page.getByRole('region', { name: 'Plan' });
    await expect(plan).toBeVisible();
    const values = { Entry: '100 shares at $30.00', Stop: 'ABC at or below $28.00', Target: 'ABC at or above $36.00', Risk: '$200.00 (1R)', Reward: '$600.00' };
    const row = (term: string) => plan.locator('dl > div').filter({ has: page.getByText(term, { exact: true }) });

    for (const width of [1280, 375]) {
      await setWidth(page, width);
      // The same values at both widths, each whole inside the viewport.
      for (const [term, text] of Object.entries(values)) {
        const value = row(term).locator('dd strong');
        await expect(value, `${term} at ${width}`).toHaveText(text);
        const box = await boxOf(value);
        expect(box.x + box.width, `${term} inside ${width} px`).toBeLessThanOrEqual(width);
      }
    }
    // At 375 the label sits over its value for Entry, Stop and Target.
    for (const term of ['Entry', 'Stop', 'Target']) {
      const [label, value] = [await boxOf(row(term).locator('dt')), await boxOf(row(term).locator('dd'))];
      expect(value.y, `${term}: the value on a second line`).toBeGreaterThanOrEqual(label.y + label.height - 1);
    }
    await expectNoSidewaysScroll(page, 'Review card Plan box at 375 px');
    await context.close();
  });

  test('should draw the Now box with its labels, arrows and captions whole inside the viewport at 1280, 375 and 320 wide', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    // ABC: 100 shares at $30.00, a Stop at $28.00 and a Target at $36.00; a Mark of $29.00 puts it inside its lines, at -$101.00 with the fee.
    await createTrades(page, [FOUR_TRADES[1]!]);
    await openReview(page);
    await enterMark(page, 'ABC', 'Mon Oct 12', '29.00');
    const now = page.getByRole('region', { name: 'Now · Mon Oct 12' });
    await expect(now).toBeVisible();
    await expect(now.locator('.now-marks')).toContainText('ABC $29.00');

    for (const width of [1280, 375, 320]) {
      await setWidth(page, width);
      const drawing = now.locator('.now-draw').getByRole('img');
      await expect(drawing, `the drawing at ${width}`).toHaveAccessibleName(/^P&L −\$101\.00, \d+% of the way to the Stop\./);
      // A red arrow to the Stop, running left, and a green one to the Target, running right, each captioned.
      await expect(now.locator('[data-arrow="stop"]')).toHaveAttribute('data-direction', 'left');
      await expect(now.locator('[data-arrow="target"]')).toHaveAttribute('data-direction', 'right');
      // The full sentence is each caption's name at every width; the words shown are the longest form that fits (T95.18).
      await expect(now.getByRole('note', { name: /^−\$1\.00 to Stop \(lose another −\$\d[\d,.]*\)$/ })).toHaveAttribute('data-caption', 'stop');
      await expect(now.getByRole('note', { name: /^\+\$7\.00 to Target \(gain \$\d[\d,.]*\)$/ })).toHaveAttribute('data-caption', 'target');
      await expect(now.locator('[data-caption="stop"]')).toHaveText(/^−\$1\.00( to Stop \(lose another −\$\d[\d,.]*| \((another )?−\$\d[\d,.]*)\)$/);
      await expect(now.locator('[data-caption="target"]')).toHaveText(/^\+\$7\.00( to Target \(gain \$\d[\d,.]*| \((gain \$|\+\$)\d[\d,.]*)\)$/);
      const [stopCaption, targetCaption] = [await boxOf(now.locator('[data-caption="stop"]')), await boxOf(now.locator('[data-caption="target"]'))];
      const apart = stopCaption.x + stopCaption.width <= targetCaption.x + 0.5 || targetCaption.x + targetCaption.width <= stopCaption.x + 0.5 || stopCaption.y + stopCaption.height <= targetCaption.y + 0.5;
      expect(apart, `the two captions do not overlap at ${width}`).toBe(true);
      // Every piece of the drawing is whole inside the viewport, and the two labels do not run into each other.
      for (const piece of ['.now-label[data-line="stop"]', '.now-label[data-line="target"]', '[data-caption="stop"]', '[data-caption="target"]', '.now-draw .meter']) {
        const box = await boxOf(now.locator(piece));
        expect(box.x, `${piece} left edge at ${width}`).toBeGreaterThanOrEqual(-0.5);
        expect(box.x + box.width, `${piece} right edge at ${width}`).toBeLessThanOrEqual(width + 0.5);
      }
      const [stop, target] = [await boxOf(now.locator('.now-label[data-line="stop"]')), await boxOf(now.locator('.now-label[data-line="target"]'))];
      expect(stop.x + stop.width, `the Stop and Target labels apart at ${width}`).toBeLessThanOrEqual(target.x);
      await expectNoSidewaysScroll(page, `Review card Now box at ${width} px`);    }
    await context.close();
  });

  test('should keep the Stop and Target labels apart when the two lines sit close on the meter at 1280 and 375 wide', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    // ABC: 100 shares at $30.00, a Stop at $28.00 and a Target at $36.00. Selling 90 at $40.00 banks about $900, so the results at the Stop and at
    // the Target are both about $900 above break-even and the meter's track (which always holds $0) puts them within a tenth of its length.
    await createTrades(page, [FOUR_TRADES[1]!]);
    await backToTrade(page, 'ABC');
    await detail.recordExitLink(page).click();
    await expect(page.getByRole('heading', { name: 'Record exit', level: 1 })).toBeVisible();
    await fillRows(page, [{ quantity: '90', price: '40.00', fee: '1.00', time: '2026-10-12T11:00' }]);
    await page.getByRole('region', { name: 'Reflection on this exit' }).getByLabel('Reflect later').check();
    await page.getByRole('button', { name: 'Save exit' }).click();
    await expect(page.getByRole('heading', { name: 'Exit recorded', level: 1 })).toBeVisible();
    await openReview(page);
    await enterMark(page, 'ABC', 'Mon Oct 12', '33.00');
    const now = page.getByRole('region', { name: 'Now · Mon Oct 12' });
    await expect(now.locator('.now-label[data-line="target"]')).toBeVisible();
    for (const width of [1280, 375]) {
      await setWidth(page, width);
      const [stop, target] = [await boxOf(now.locator('.now-label[data-line="stop"]')), await boxOf(now.locator('.now-label[data-line="target"]'))];
      const apart = stop.x + stop.width <= target.x || target.x + target.width <= stop.x || stop.y + stop.height <= target.y || target.y + target.height <= stop.y;
      expect(apart, `the Stop label ${JSON.stringify(stop)} and the Target label ${JSON.stringify(target)} apart at ${width}`).toBe(true);
      for (const box of [stop, target]) {
        expect(box.x, `a label's left edge at ${width}`).toBeGreaterThanOrEqual(-0.5);
        expect(box.x + box.width, `a label's right edge at ${width}`).toBeLessThanOrEqual(width + 0.5);
      }
    }
    await context.close();
  });

  // BREN (a long call) is past its Target, AXIO (stock) and DALE (a short put) are past their Stops; each is Marked to Mon Nov 16.
  const PAST = [
    { symbol: 'BREN', label: 'Target reached', stop: /^−\$3\.36 to Stop \(lose −\$672\.00\)$/, target: /^\$0\.16 past Target \(\+\$32\.00 so far\)$/ },
    { symbol: 'AXIO', label: 'Stop breached', stop: /^\$3\.00 past Stop \(−\$300\.00 so far\)$/, target: /^\+\$12\.00 to Target \(gain \$1,200\.00\)$/ },
    { symbol: 'DALE', label: 'Stop breached', stop: /^\$0\.80 past Stop \(−\$552\.00 so far\)$/, target: /^−\$4\.22 to Target \(gain \$2,532\.00\)$/ },
  ] as const;

  test('should show the Plan box and the Now box of a long option past its Target, a stock and a short option past their Stops, with the figures Trade Detail gives', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, trades } = await openStandardReview(profile, copySetup);
    const seen: Record<string, { risk: string; reward: string; worst: string; maxReward: string }> = {};
    for (const { symbol, label, stop, target } of PAST) {
      const trade = trades.find((t) => t.symbol === symbol)!;
      await reachCard(page, trade);
      const card = tradeCard(page, trade);
      const plan = card.getByRole('region', { name: 'Plan' });
      const now = card.getByRole('region', { name: 'Now · Mon Nov 16' });
      const figure = (box: typeof card, term: string) => box.locator('dl > div').filter({ has: page.getByText(term, { exact: true }) }).locator('dd');
      await atBothWidths(page, async (width) => {
        await expect(card, `${symbol}'s band at ${width}`).toContainText(label);
        await expect(plan.locator('dt')).toContainText(['Entry', 'Stop', 'Target', 'Risk', 'Reward']);
        await expect(now.getByRole('note').first()).toHaveAccessibleName(stop);
        await expect(now.getByRole('note').nth(1)).toHaveAccessibleName(target);
        await expect(now.locator('.now-draw').getByRole('img')).toHaveAccessibleName(/^P&L [−+]?\$[\d,.]+, past the (Stop|Target) by \$[\d,.]+\./);
        await expectNoSidewaysScroll(page, `Review card ${symbol} at ${width} px`);
      });
      seen[symbol] = {
        risk: (await figure(plan, 'Risk').innerText()).replace(/ \(1R\)$/, ''),
        reward: await figure(plan, 'Reward').innerText(),
        worst: (await figure(now, 'Worst case').innerText()).replace(' more', ''),
        maxReward: (await figure(now, 'Max reward').innerText()).replace(' more', ''),
      };
    }
    // The same figures on Trade Detail's Plan and Risk (AC-CALC-003).
    for (const [symbol, figures] of Object.entries(seen)) {
      await page.goto(`/trades/${trades.find((t) => t.symbol === symbol)!.tradeId}`);
      await page.getByRole('tab', { name: 'Plan and Risk' }).click();
      const panel = page.getByRole('tabpanel');
      await expect(panel, `${symbol}'s 1R`).toContainText(new RegExp(`1R \\(original risk\\)\\s*${figures.risk.replace(/[$.]/g, '\\$&')}`));
      await expect(panel).toContainText(new RegExp(`Original reward\\s*${figures.reward.replace(/[$.]/g, '\\$&')}`));
      await expect(panel).toContainText(`Worst case: ${figures.worst}`);
      if (figures.maxReward !== 'No cap') await expect(panel).toContainText(`Max reward: ${figures.maxReward}`);
    }
    await context.close();
  });

  // T95.26-B2 (critic-1 defect 2, W90): the "−" must not part from "$2,016.00" at a line end.
  test('should keep every signed figure in the Now box whole on one line at 320 wide', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, trades } = await openStandardReview(profile, copySetup);
    const trade = trades.find((t) => t.symbol === 'DALE')!;
    await reachCard(page, trade);
    const now = tradeCard(page, trade).getByRole('region', { name: 'Now · Mon Nov 16' });
    await setWidth(page, 320);
    await expect(now.locator('dl > div').filter({ has: page.getByText('Expiration', { exact: true }) }).locator('dd')).toContainText('then: −$2,016.00');
    // Every signed money figure in the Now box: its own line box, so the sign stays with its number.
    const broken = await now.evaluate((box) => {
      const out: string[] = [];
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = (n as Text).data;
        for (const m of text.matchAll(/[−+]\$[\d,]+(\.\d+)?/g)) {
          const range = document.createRange();
          range.setStart(n, m.index);
          range.setEnd(n, m.index + m[0].length);
          const rects = [...range.getClientRects()].filter((r) => r.width > 0);
          if (rects.length && Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top)) > 1.6 * parseFloat(getComputedStyle(n.parentElement!).fontSize)) out.push(m[0]);
        }
      }
      return out;
    });
    expect(broken, 'signed figures broken across lines at 320').toEqual([]);
    await context.close();
  });

  test("should say the figures wait for today's Marks and offer no Action until the Mark is in, at 1280 and 375 wide", async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, ...trades } = await openCardFixture(profile, copySetup);
    await openReview(page);
    const abc = trades['T-B'];
    await reachCard(page, abc);
    const card = tradeCard(page, abc);
    await atBothWidths(page, async (width) => {
      await expect(card.getByText("Figures wait for today's Marks.", { exact: false }), `the figures wait at ${width}`).toBeVisible();
      await expect(card.getByText("No Action until today's Mark is in.")).toBeVisible();
      await expect(card.getByRole('link', { name: 'Enter it' })).toBeVisible();
      await expect(card.getByRole('radio', { name: 'Hold', exact: true })).toBeHidden();
      await expectNoSidewaysScroll(page, `Review card before its Marks at ${width} px`);
    });
    // With the Mark saved, the same card offers the Action.
    await enterMark(page, abc, 'Mon Oct 12', '29.00');
    await expect((await actionFormOf(page, abc)).getByRole('radio', { name: 'Hold', exact: true })).toBeVisible();
    await expect(card.getByText("Figures wait for today's Marks.", { exact: false })).toHaveCount(0);
    await context.close();
  });

  test('should list the last four decisions and fold the older three behind "3 earlier decisions" at 375 wide', async ({ profile }) => {
    test.setTimeout(420_000);
    const { context, page } = await onboardedAt(profile, MONDAY_1700);
    await createTrades(page, [FOUR_TRADES[1]!]);
    // ABC (Stop 28, Target 36) is held on Mon, Tue, Thu and Fri, the last two past its Stop.
    const days = [
      ['2026-10-12T21:00:00Z', 'Mon Oct 12', '29.00', 'Up today.'],
      ['2026-10-13T21:00:00Z', 'Tue Oct 13', '29.50', 'One more day.'],
      ['2026-10-15T21:00:00Z', 'Thu Oct 15', '27.50', 'It may turn.'],
      ['2026-10-16T21:00:00Z', 'Fri Oct 16', '27.40', 'Still waiting.'],
    ] as const;
    for (const [instant, date, price, reason] of days) {
      await setClock(context, page, instant);
      await openReview(page);
      await enterMark(page, 'ABC', date, price);
      await reachCard(page, 'ABC');
      await saveAction(page, 'Hold', reason, 'ABC');
    }
    await setClock(context, page, '2026-10-19T21:00:00Z');
    await openReview(page);
    await enterMark(page, 'ABC', 'Mon Oct 19', '27.60');
    const form = await actionFormOf(page, 'ABC');
    await expect(form).toBeVisible();
    const decisions = tradeCard(page, 'ABC').getByRole('region', { name: 'Your last decisions' });
    const items = decisions.getByRole('listitem');

    await setWidth(page, 1280);
    await expect(items).toHaveCount(4);
    await expect(items.first()).toHaveText(/^Fri Oct 16 · Hold · [−+]\$[\d,.]+“Still waiting\.”$/);
    await expect(items.last()).toHaveText(/^Mon Oct 12 · Hold · −\$101\.00“Up today\.”$/);
    await expect(decisions).toContainText('Held past the Stop 2 sessions running.');
    await expect(decisions.getByText('3 earlier decisions')).toHaveCount(0);

    // At 375 the newest shows and the other three fold.
    await setWidth(page, 375);
    const more = decisions.locator('details');
    await expect(decisions.getByText('3 earlier decisions')).toBeVisible();
    await expect(more).not.toHaveJSProperty('open', true);
    await expect(decisions.getByText('Fri Oct 16')).toBeVisible();
    await expect(decisions.getByText('Thu Oct 15')).toBeHidden();
    await more.getByText('3 earlier decisions').click();
    await expect(more.getByRole('listitem')).toHaveCount(3);
    await expect(decisions.getByText('Mon Oct 12')).toBeVisible();
    await expectNoSidewaysScroll(page, 'Review card, last decisions at 375 px');
    await context.close();
  });
});
