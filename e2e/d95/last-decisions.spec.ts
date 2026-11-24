import { setWidth } from '../d7p/support.ts';
import { expect, reachCard, saveAction, test } from '../d4/support.ts';
import { answerSlipQuestions, cardItem, closeOf, DALE_HOLD, expectMarksSaved, label, LAUNCH, openReview, openStandardReview, reachPanel, setClock, type TradeRef } from '../d9ar/support.ts';

// T95.26-B4 (critic-2 defect 2, W90): "Your last decisions" must keep the "−" with its figure at 320 wide, as the Now box does (T95.26-B2).
test.describe('B95.4 Your last decisions', () => {
  test('should keep every signed figure in Your last decisions whole on one line at 320 wide', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, trades } = await openStandardReview(profile, copySetup);
    const ofSymbol = (symbol: string) => trades.find((t: TradeRef) => t.symbol === symbol)!;
    // Hold AXIO and DALE on Mon Nov 16, both past their Stops.
    for (const symbol of ['AXIO', 'DALE']) await saveAction(page, 'Hold', undefined, ofSymbol(symbol));
    await setClock(context, page, closeOf('2026-11-17'));
    await setWidth(page, 320);
    await openReview(page);
    const tuesday = label('2026-11-17');
    const marks: Record<string, readonly (readonly [string, string])[]> = { AXIO: [['AXIO', '48.00']], DALE: [['DALE', '55.00'], [DALE_HOLD.contract!, '2.50']] };
    for (const symbol of ['AXIO', 'DALE']) {
      const panel = await reachPanel(page, ofSymbol(symbol), 'Marks');
      for (const [name, price] of marks[symbol]!) await panel.getByRole('textbox', { name: `${name} Mark, ${tuesday}`, exact: true }).fill(price);
      await answerSlipQuestions(page);
      await panel.getByRole('button', { name: `Save Marks (${marks[symbol]!.length})`, exact: true }).click();
      await expectMarksSaved(page, LAUNCH);
    }
    for (const [symbol, figure] of [['AXIO', '−$1,040.00'], ['DALE', '−$2,088.00']] as const) {
      await reachCard(page, ofSymbol(symbol));
      const decisions = cardItem(page, ofSymbol(symbol)).getByRole('region', { name: 'Your last decisions' });
      await expect(decisions, `${symbol}'s last decision`).toContainText(`Mon Nov 16 · Hold · ${figure}`);
      // Every signed money figure in the section: its own line box, so the sign stays with its number.
      const broken = await decisions.evaluate((box) => {
        const out: string[] = [];
        const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          for (const m of (n as Text).data.matchAll(/[−+]\$[\d,]+(\.\d+)?/g)) {
            const range = document.createRange();
            range.setStart(n, m.index);
            range.setEnd(n, m.index + m[0].length);
            const rects = [...range.getClientRects()].filter((r) => r.width > 0);
            if (rects.length && Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top)) > 1.6 * parseFloat(getComputedStyle(n.parentElement!).fontSize)) out.push(m[0]);
          }
        }
        return out;
      });
      expect(broken, `${symbol}: signed figures broken across lines at 320`).toEqual([]);
    }
    await context.close();
  });
});
