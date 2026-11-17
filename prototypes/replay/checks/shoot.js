/* eslint-disable */
// Opens the prototype from its file, walks every trade, series, view and slider position, and reports problems.
// Run: node prototypes/replay/checks/shoot.js (round 1's page). Screenshots go to .cache/replay-checks, which git ignores.
const root = require('path').resolve(__dirname, '../../..');
const { chromium } = require(root + '/node_modules/playwright');
const out = root + '/.cache/replay-checks/shots';
require('fs').mkdirSync(out, { recursive: true });
const shots = (process.argv[2] || '').split(',').filter(Boolean); // e.g. "1280:call:bull:balance:8"

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  for (const width of [1280, 375, 320]) {
    const page = await browser.newPage({ viewport: { width, height: width < 500 ? 700 : 900 }, deviceScaleFactor: width < 500 && shots.length ? 2 : 1 });
    page.on('pageerror', (e) => problems.push(`${width} pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`${width} console: ${m.text()}`); });
    await page.goto('file://' + root + '/prototypes/replay/index.html');
    const set = async (trade, series, view, cur) => {
      await page.evaluate(([a, b, c, d]) => { Object.assign(state, { trade: a, series: b, view: c, cur: d }); render(); }, [trade, series, view, cur]);
    };
    if (!shots.length) {
      for (const trade of ['stock', 'call', 'put', 'shortput', 'callspread', 'putspread']) {
        for (const series of ['bull', 'bear']) {
          for (const view of ['balance', 'corridor', 'why', 'shares', 'falling', 'map']) {
            for (let cur = 0; cur < 15; cur += 1) {
              await set(trade, series, view, cur);
              const r = await page.evaluate(() => ({
                over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                bad: [...document.querySelectorAll('#plots svg *')].filter((e) => [...e.attributes].some((a) => /NaN|undefined|Infinity/.test(a.value))).length,
                text: /NaN|undefined|Infinity|null/.test(document.getElementById('stage').innerText + document.getElementById('headline').innerText),
              }));
              if (r.over > 0) problems.push(`${width} ${trade} ${series} ${view} ${cur}: sideways scroll ${r.over}px`);
              if (r.bad) problems.push(`${width} ${trade} ${series} ${view} ${cur}: ${r.bad} svg attributes with NaN/undefined/Infinity`);
              if (r.text) problems.push(`${width} ${trade} ${series} ${view} ${cur}: NaN/undefined/null in text`);
            }
          }
        }
      }
    }
    for (const s of shots) {
      const [w, trade, series, view, cur] = s.split(':');
      if (+w !== width) continue;
      await set(trade, series, view, +cur);
      if (width < 500) {
        await page.locator('#plots').screenshot({ path: `${out}/${s.replace(/:/g, '-')}.png` });
        await page.evaluate(() => window.scrollTo(0, 600));
        await page.screenshot({ path: `${out}/${s.replace(/:/g, '-')}-top.png` });
      } else await page.screenshot({ path: `${out}/${s.replace(/:/g, '-')}.png`, fullPage: true });
    }
    await page.close();
  }
  await browser.close();
  console.log(problems.length ? [...new Set(problems)].slice(0, 60).join('\n') + `\n${problems.length} problems` : 'no problems');
})();
