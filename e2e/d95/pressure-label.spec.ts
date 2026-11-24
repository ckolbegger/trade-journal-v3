import { expect, test } from '../d4/support.ts';
import { answerSlipQuestions, BREN, closeOf, DALE_HOLD, expectMarksSaved, label, LAUNCH, openReview, reachPanel, setClock, cardItem, openStandardReview, type TradeRef } from '../d9ar/support.ts';

// T95.26-B3 (critic-2): the label's percent is the Pressure share of the open Lots, the figure the card's own line shows,
// and not the meter's P&L share, which counts the realized P&L of a partial sale too.
test.describe('B95.4 The pressure label', () => {
  test('should word the header pill with the same share as the line under the symbol on a Trade with a partial sale', async ({ profile, copySetup }) => {
    test.setTimeout(300_000);
    const { context, page, trades } = await openStandardReview(profile, copySetup);
    await setClock(context, page, closeOf('2026-11-17'));
    await openReview(page);
    const tuesday = label('2026-11-17');
    const marks: Record<string, readonly (readonly [string, string])[]> = {
      AXIO: [['AXIO', '48.00']],
      BREN: [['BREN', '105.00'], [BREN.contract!, '3.00']],
      DALE: [['DALE', '55.00'], [DALE_HOLD.contract!, '2.50']],
    };
    for (const symbol of ['AXIO', 'BREN', 'DALE']) {
      const trade = trades.find((t: TradeRef) => t.symbol === symbol)!;
      const panel = await reachPanel(page, trade, 'Marks');
      for (const [name, price] of marks[symbol]!) await panel.getByRole('textbox', { name: `${name} Mark, ${tuesday}`, exact: true }).fill(price);
      await answerSlipQuestions(page);
      await panel.getByRole('button', { name: `Save Marks (${marks[symbol]!.length})`, exact: true }).click();
      await expectMarksSaved(page, LAUNCH);
    }
    // AXIO (100 shares left at $50.00, Stop $47.00, Mark $48.00) has used 200 of 300; BREN is 58% of the way to its Target, DALE 61% to its Stop.
    const expected = { AXIO: { pill: '67% to Stop', line: '67% of the way from entry to the Stop' }, BREN: { pill: '58% to Target', line: '58% of the way from entry to the Target' }, DALE: { pill: '61% to Stop', line: '61% of the way from entry to the Stop' } } as const;
    for (const [symbol, words] of Object.entries(expected)) {
      const trade = trades.find((t: TradeRef) => t.symbol === symbol)!;
      const item = cardItem(page, trade);
      await expect(item, `${symbol}'s pill`).toContainText(words.pill);
      await expect(item.getByLabel(words.line, { exact: true }).or(item.getByText(words.line, { exact: true })).first(), `${symbol}'s line`).toBeVisible();
      await expect(item, `${symbol} says one share`).not.toContainText(/\b(86|79)%/);
    }
    await context.close();
  });
});
