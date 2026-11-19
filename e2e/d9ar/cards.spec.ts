import type { Locator, Page } from '@playwright/test';
import { REPLAY_SESSION_DATES } from '../../src/domain/trade-analysis/reference-trade.ts';
import { AXIO, BREN, build, cardRows, closeOf, CORV, expect, label, openDrawer, replay, seek, sessionCard, sessionCards, sliderValue, test } from './support.ts';

test.use({ actionTimeout: 15_000 });

// B9AR.4 (plan section 7.2, AC-CALC-003, AC-UI-002): the Plan block of W62 above the cards, one card per revealed session newest first, the slider's card current and on the shown page, a card's
// heading moving the slider, every figure the charts draw in the readout and on the slider's card, W63's words on the sale sessions and W64's on R-CORV-D and R-AXIO-D.
const PLAN = (scope: Locator): Locator => scope.locator('section.replay-plan');
const planRows = (scope: Locator): Promise<string[]> => PLAN(scope).locator('li').allTextContents();
const headings = (scope: Locator): Promise<string[]> => sessionCards(scope).locator('h4 button').allTextContents();
const dateAt = (index: number): string => label(REPLAY_SESSION_DATES[index]!);

// The price-line labels each trade's price chart draws: a share trade its Stop and Target, an option trade its Strike.
const AXIO_LINES = ['Stop', 'Target'] as const;
const OPTION_LINES = ['Strike'] as const;

// The figures the charts draw for the slider's session, as numbers: the Stop and Target results, the stake tags, the Worst case, what is banked and how far past a line.
const FIGURE = /[−+]?\$[\d,]+(?:\.\d+)?/g;
const numberOf = (text: string): number => Number(text.replace('−', '-').replace(/[$,+]/g, ''));
const figuresIn = (text: string): number[] => (text.match(FIGURE) ?? []).map(numberOf);

// The row a drawn P&L label's figure is on, in the readout and on the slider's card alike (the readout's table and the card write the same row label and figure, the Past line "at Stop"/"at Target" too).
// Each rule gives the row's label as a pattern; the figures are those after it up to the next word.
type RowRule = { cls: RegExp; row: (text: string) => RegExp };
const ROW_RULES: RowRule[] = [
  { cls: /\bresult-label stop\b|\bstake-tag risk\b/, row: () => /at Stop/gi },
  { cls: /\bresult-label target\b|\bstake-tag reward\b/, row: () => /at Target/gi },
  { cls: /\bworst-case-(tag|label)\b/, row: () => /at Worst case/gi },
  { cls: /\bbanked-label\b/, row: (text) => new RegExp(`${text.split(' ')[0]}`, 'gi') }, // "Realized" or "Banked"
  { cls: /\bpast-label\b/, row: (text) => new RegExp(`Past the ${/Stop|Target/.exec(text)![0]} by`, 'gi') },
];
// The figures that follow each match of `row` in `text`, up to the next word (the R multiples and "P&L if hit" are skipped).
function figuresAfter(text: string, row: RegExp): number[] {
  const flat = text.replace(/\s+/g, ' ');
  return [...flat.matchAll(row)].flatMap((m) => {
    const rest = flat.slice(m.index + m[0].length).replace(/P&L if hit/g, '').replace(/\d[\d,.]*R\b/g, '');
    return figuresIn(rest.split(/[A-Za-z]/)[0]!);
  });
}

// B9AR.4: each figure the charts draw is on the surface and the row the plan names. A P&L chart label is on its row in the readout AND on the slider's card (both are checked, each by row label and figure);
// the price chart's Mark is on the "<symbol> Mark" row of both; its Stop, Target and Strike lines are the figure of the same-named row of the Plan block. `lines` are the price-line labels this trade draws.
async function expectChartFigures(page: Page, scope: Locator, where: string, lines: readonly string[]): Promise<void> {
  const textsOf = (selector: string): Promise<{ cls: string; text: string }[]> => scope.locator(selector).evaluateAll((texts) => texts.map((t) => ({ cls: t.getAttribute('class') ?? '', text: t.textContent ?? '' })));
  const pnl = await textsOf('svg.pnl-chart text');
  const strip = await textsOf('svg.price-strip text');
  const readout = await scope.locator('.replay-readout').innerText();
  const card = await sessionCards(scope).first().innerText();
  let compared = 0;
  const drawn = pnl.filter((t) => ROW_RULES.some((r) => r.cls.test(t.cls)));
  expect(drawn.length, `${where}: the P&L chart draws labelled figures`).toBeGreaterThan(0);
  for (const { cls, text } of drawn) {
    const rule = ROW_RULES.find((r) => r.cls.test(cls))!;
    const figures = figuresIn(text);
    expect(figures.length, `${where}: the P&L chart's "${text}" has a figure`).toBeGreaterThan(0);
    for (const [surface, shown] of [['readout', readout], ['slider’s card', card]] as const) {
      for (const figure of figures) {
        compared += 1;
        expect(figuresAfter(shown, rule.row(text)), `${where}: the chart's "${text}" is on its row in the ${surface}`).toContain(figure);
      }
    }
  }
  expect(compared, `${where}: at least one P&L figure was compared`).toBeGreaterThan(0);
  // The price chart's Mark is on the Mark row of the readout and of the slider's card.
  const symbol = strip.find((t) => /\bplot-title\b/.test(t.cls))!.text.split(' ')[0]!;
  const mark = strip.find((t) => /\bmark-label\b/.test(t.cls));
  expect(mark, `${where}: the price chart draws its Mark`).toBeDefined();
  for (const [surface, shown] of [['readout', readout], ['slider’s card', card]] as const) {
    expect(figuresAfter(shown, new RegExp(`${symbol} Mark`, 'g')), `${where}: the price chart's Mark "${mark!.text}" is on the ${symbol} Mark row of the ${surface}`).toContain(figuresIn(mark!.text)[0]);
  }
  // Its price lines are the Plan's: the row of the Plan block that starts with the line's name.
  const plan = await planRows(scope);
  const lineLabels = strip.filter((t) => /\bprice-line-label\b/.test(t.cls)).map((t) => t.text);
  for (const name of lines) expect(lineLabels.some((t) => t.startsWith(`${name} $`)), `${where}: the price chart draws its ${name} line`).toBe(true);
  for (const text of lineLabels) {
    const row = plan.find((r) => r.startsWith(`${text.split(' ')[0]}`));
    expect(row, `${where}: the Plan block has the row of the price chart's "${text}"`).toBeDefined();
    expect(figuresIn(row!)[0], `${where}: the price chart's "${text}" is the figure of the Plan block's "${row}"`).toBe(figuresIn(text)[0]);
  }
  await page.screenshot({ path: `evidence/D09AR/screenshots/B9AR.4-${where.replace(/[^\w]+/g, '-')}.png` });
}

// The slider's session is `index`: one card per revealed session newest first, none for a later one, the slider's the current card and on the shown page.
async function expectCardsAt(page: Page, scope: Locator, index: number, total: number, where: string, lines: readonly string[]): Promise<void> {
  await expect(sliderValue(scope)).toHaveText(`${dateAt(index)} · ${index + 1} of ${total}`);
  const expected = REPLAY_SESSION_DATES.slice(0, index + 1).map(label).reverse();
  await expect(sessionCards(scope)).toHaveCount(index + 1);
  expect(await headings(scope), `${where}: one card per revealed session, newest first`).toEqual(expected);
  for (let later = index + 1; later < total; later += 1) await expect(scope.getByRole('button', { name: dateAt(later), exact: true }), `${where}: no card for ${dateAt(later)}`).toHaveCount(0);
  const current = sessionCards(scope).first();
  await expect(current).toHaveAttribute('aria-current', 'true');
  await expect(sessionCards(scope).locator('xpath=self::*[@aria-current]')).toHaveCount(1);
  await expect(current, `${where}: the slider's card is on the shown page`).toBeVisible();
  await expect(current.getByRole('button', { name: dateAt(index), exact: true })).toBeVisible();
  await expectChartFigures(page, scope, where, lines);
}

const openReplay = async (page: Page): Promise<Locator> => {
  await openDrawer(page, 'Replay');
  return replay(page);
};

test.describe('B9AR.4 The Plan block and the cards', () => {
  test('should step R-AXIO-D from the first session to the last with one card each, then page the cards and press an earlier card', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await build(profile, AXIO, closeOf('2026-11-16'), 10);
    const scope = await openReplay(page);
    // W62: the Plan block, titled "The Plan", above the cards, and the same on every session.
    const planWords = [
      'Entry: 200 shares at $50.00',
      'Stop: AXIO at or below $47.00 · P&L if hit −$600.00',
      'Target: AXIO at or above $56.00 · P&L if hit +$1,200.00',
      'Reward to risk: 2.00 to 1 · 33% : 67%',
    ];
    await expect(PLAN(scope).getByRole('heading', { name: 'The Plan', level: 3 })).toBeVisible();
    expect(await planRows(scope)).toEqual(planWords);
    const planBox = (await PLAN(scope).boundingBox())!;
    const cardsBox = (await scope.locator('section.replay-cards').boundingBox())!;
    expect(planBox.y + planBox.height, 'the Plan block is above the cards').toBeLessThanOrEqual(cardsBox.y + 0.5);
    await seek(page, scope, 'Home');
    await expectCardsAt(page, scope, 0, 11, 'AXIO first session', AXIO_LINES);
    for (let index = 1; index <= 10; index += 1) {
      await page.keyboard.press('ArrowRight');
      await expectCardsAt(page, scope, index, 11, `AXIO session ${index + 1}`, AXIO_LINES);
      expect(await planRows(scope), `the Plan block at ${dateAt(index)}`).toEqual(planWords);
    }
    // W63 and W64 on the sale session: the Execution against the Plan, then "Stop first breached", and the sentence from that session on.
    const monday = await sessionCard(scope, 'Mon Nov 9');
    await expect(cardRows(monday).last()).toHaveText('EventsSold 100 at $45.60, $1.40 below the Stop; Stop first breached');
    await expect(scope.getByTestId('crossing')).toHaveText('Past the Stop since Mon Nov 9.');
    // Page the cards: the slider's card is on the first page; "Earlier sessions" moves on without moving the slider; "Newer sessions" comes back.
    const current = sessionCards(scope).first();
    const earlier = scope.getByRole('button', { name: 'Earlier sessions', exact: true });
    const newer = scope.getByRole('button', { name: 'Newer sessions', exact: true });
    // (Finding the card above turned the cards to its page: back to the first.)
    while (await newer.isEnabled()) await newer.click();
    await expect(newer).toBeDisabled();
    await expect(earlier).toBeEnabled();
    await earlier.click();
    await expect(current).toBeHidden();
    await expect(sliderValue(scope)).toHaveText('Mon Nov 16 · 11 of 11');
    await expect(newer).toBeEnabled();
    await newer.click();
    await expect(current).toBeVisible();
    // Press an earlier card's heading: the slider moves there, and the later cards go.
    const earlierCard = await sessionCard(scope, 'Mon Nov 9');
    await earlierCard.getByRole('button', { name: 'Mon Nov 9', exact: true }).click();
    await expectCardsAt(page, scope, 5, 11, 'AXIO after pressing Mon Nov 9', AXIO_LINES);
    await expect(scope.getByTestId('session-date')).toHaveText('Mon Nov 9');
    await expect(scope.getByTestId('crossing')).toHaveText('Past the Stop since Mon Nov 9.');
    // A card two pages back, with the cards at three to a page or fewer: pressing its heading moves the slider to that session.
    const first = await sessionCard(scope, 'Mon Nov 2');
    await first.getByRole('button', { name: 'Mon Nov 2', exact: true }).click();
    await expectCardsAt(page, scope, 0, 11, 'AXIO after pressing Mon Nov 2', AXIO_LINES);
    await context.close();
  });

  test('should show R-BREN-U’s Plan block and W63’s words on its entry and its sale', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await build(profile, BREN, closeOf('2026-11-16'), 10);
    const scope = await openReplay(page);
    expect(await planRows(scope)).toEqual([
      'Entry: 4 contracts at $1.61',
      'Strike $100',
      'Stop: call at or below $0.80 · P&L if hit −$324.00',
      'Target: call at or above $4.00 · P&L if hit +$956.00',
      'Reward to risk: 2.95 to 1 · 25% : 75%',
    ]);
    await expect(cardRows(await sessionCard(scope, 'Mon Nov 2')).last()).toHaveText("EventsBought 4 at $1.61, at the Plan's entry");
    await expect(cardRows(await sessionCard(scope, 'Thu Nov 12')).last()).toHaveText('EventsSold 2 at $4.00, at the Target; Target first reached');
    // Stepping to the first session and to the sale keeps every card and every drawn figure in step.
    await seek(page, scope, 'Home');
    await expectCardsAt(page, scope, 0, 11, 'BREN first session', OPTION_LINES);
    await seek(page, scope, 'ArrowRight', 8);
    await expectCardsAt(page, scope, 8, 11, 'BREN Thu 11-12', OPTION_LINES);
    await expect(scope.getByTestId('crossing')).toHaveText('Target first reached Thu Nov 12.');
    await context.close();
  });

  test('should show R-CORV-D’s first crossing on Fri 11-06, Mon 11-09 and Wed 11-11, and none before', async ({ profile }) => {
    test.setTimeout(300_000);
    const { context, page } = await build(profile, CORV, closeOf('2026-11-11'), 7);
    const scope = await openReplay(page);
    expect(await planRows(scope)).toEqual([
      'Entry: 3 contracts at $2.11',
      'Strike $80',
      'Stop: put at or below $1.05 · P&L if hit −$318.00',
      'Target: put at or above $5.00 · P&L if hit +$867.00',
      'Reward to risk: 2.73 to 1 · 27% : 73%',
    ]);
    await seek(page, scope, 'Home');
    for (const index of [0, 1, 2, 3]) {
      await expectCardsAt(page, scope, index, 8, `CORV ${dateAt(index)}`, OPTION_LINES);
      await expect(scope.getByTestId('crossing'), `${dateAt(index)}: nothing crossed yet`).toHaveCount(0);
      await page.keyboard.press('ArrowRight');
    }
    // Fri 11-06: the put reaches its Target. The card's Events say so; the sentence stays from that session on, also on Mon 11-09 when the put is back under its Target, and on Wed 11-11.
    for (const index of [4, 5, 6, 7]) {
      await expectCardsAt(page, scope, index, 8, `CORV ${dateAt(index)}`, OPTION_LINES);
      await expect(scope.getByTestId('crossing'), dateAt(index)).toHaveText('Target first reached Fri Nov 6.');
      if (index < 7) await page.keyboard.press('ArrowRight');
    }
    await expect(cardRows(await sessionCard(scope, 'Fri Nov 6')).last()).toHaveText('EventsTarget first reached');
    for (const date of ['Mon Nov 9', 'Tue Nov 10', 'Wed Nov 11']) await expect(await sessionCard(scope, date), `${date}'s card`).not.toContainText('first reached');
    await context.close();
  });
});
