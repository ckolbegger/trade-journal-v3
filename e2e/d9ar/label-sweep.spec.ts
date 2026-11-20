import { mkdirSync, writeFileSync } from 'node:fs';
import { atEverySession, AXIO, BREN, build, closeOf, CORV, DALE_HOLD, detailReplayButton, firstPage, labelsDrawnOver, launchTouchAt, replay, setViewport, test } from './support.ts';

// Run it when changing chart label placement: `npm run report:labels` (it runs only with LABEL_SWEEP=1, so browser stage 3 never pays for it).
// A report, not a check: it never fails on an overlap. At every session of the replay, on BREN, AXIO, DALE-hold and CORV, at 1280 and 320, it lists each chart label drawn over a line, a marker, a hatch, a flag or another label,
// one line each (fixture, width, session, chart, label, what is drawn over it) in test-results/label-sweep.txt. The cursor's own labels and the lines through the cursor's own dot are left out (see labelsDrawnOver).
test.skip(process.env.LABEL_SWEEP !== '1', 'on demand: LABEL_SWEEP=1 (npm run report:labels)');
test.use({ actionTimeout: 15_000 });
test.describe.configure({ mode: 'serial' });

const WIDTHS = [1280, 320] as const;
const fixtures = [['BREN', BREN], ['AXIO', AXIO], ['DALE_HOLD', DALE_HOLD], ['CORV', CORV]] as const;
const lines: string[] = [];

test.afterAll(() => {
  if (process.env.LABEL_SWEEP !== '1') return;
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/label-sweep.txt', `${lines.join('\n')}\n`);
  console.log(`label sweep: ${lines.length} overlaps, written to test-results/label-sweep.txt`);
});

for (const [name, fixture] of fixtures) {
  test(`D9AR-retro-1 should list every chart label drawn over something, at every session, ${name}`, async ({ profile }) => {
    test.setTimeout(900_000);
    const built = await build(profile, fixture, closeOf('2026-11-16'), 10);
    const tradeUrl = built.page.url();
    await built.context.close();
    const context = await launchTouchAt(profile, closeOf('2026-11-16'), 375);
    const page = await firstPage(context);
    await page.goto(tradeUrl);
    for (const width of WIDTHS) {
      await setViewport(page, width, width === 1280 ? 900 : 667);
      if ((await replay(page).count()) === 0) await detailReplayButton(page).tap();
      await replay(page).waitFor();
      const scope = replay(page);
      await atEverySession(page, scope, async (at) => {
        for (const o of await labelsDrawnOver(scope)) lines.push(`${name}\t${width}\t${at}\t${o.chart}\t${o.label}\t${o.text}\tdrawn over by ${o.over}`);
      });
    }
    await context.close();
  });
}
