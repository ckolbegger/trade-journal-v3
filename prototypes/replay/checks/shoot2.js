/* eslint-disable */
// Opens round-2.html from its file, walks every trade, series, view and slider position, and reports problems.
// With an argument such as "1280:call:bull:corridor:14,375:call:bull:ribbon:9" it takes screenshots of the hero card instead.
// Run: node prototypes/replay/checks/shoot2.js. Screenshots go to .cache/replay-checks, which git ignores.
const root = require('path').resolve(__dirname, '../../..');
const { chromium } = require(root + '/node_modules/playwright');
const out = root + '/.cache/replay-checks/shots2';
require('fs').mkdirSync(out, { recursive: true });
const shots = (process.argv[2] || '').split(',').filter(Boolean);
const TR = ['stock', 'call', 'put', 'shortput', 'callspread', 'putspread'];
const VW = ['corridor', 'balance', 'shares', 'ribbon', 'gauge', 'inset'];

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  const fit = {};
  for (const width of [1280, 375, 320]) {
    const height = width < 500 ? 667 : 800;
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: shots.length ? 2 : 1 });
    page.on('pageerror', (e) => problems.push(`${width} pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`${width} console: ${m.text()}`); });
    await page.goto('file://' + root + '/prototypes/replay/round-2.html');
    const set = async (trade, series, view, cur) => {
      await page.evaluate(([a, b, c, d]) => { Object.assign(state, { trade: a, series: b, view: c, cur: d, pop: null }); render(); }, [trade, series, view, cur]);
    };
    if (!shots.length) {
      for (const trade of TR) for (const series of ['bull', 'bear']) for (const view of VW) for (let cur = 0; cur < 15; cur += 1) {
        await set(trade, series, view, cur);
        const r = await page.evaluate(() => {
          const hero = document.getElementById('hero').getBoundingClientRect();
          const plots = document.getElementById('plots').getBoundingClientRect();
          return {
            over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            bad: [...document.querySelectorAll('#hero svg *')].filter((e) => [...e.attributes].some((a) => /NaN|undefined|Infinity/.test(a.value))).length,
            text: /NaN|undefined|Infinity|null/.test(document.getElementById('stage').innerText),
            need: document.getElementById('ctl').getBoundingClientRect().height + (plots.bottom - hero.top),
            svgOut: [...document.querySelectorAll('#plots svg text')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > window.innerWidth + 0.5 || b.left < -0.5); }).length,
          };
        });
        const id = `${width} ${trade} ${series} ${view} ${cur}`;
        if (r.over > 0) problems.push(`${id}: sideways scroll ${r.over}px`);
        if (r.bad) problems.push(`${id}: ${r.bad} svg attributes with NaN/undefined/Infinity`);
        if (r.text) problems.push(`${id}: NaN/undefined/null in text`);
        if (r.svgOut) problems.push(`${id}: ${r.svgOut} chart labels outside the window`);
        const key = `${width} ${view}`;
        fit[key] = Math.max(fit[key] || 0, Math.round(r.need));
      }
    }
    for (const s of shots) {
      const [w, trade, series, view, cur, what] = s.split(':');
      if (+w !== width) continue;
      await set(trade, series, view, +cur);
      const name = `${out}/${s.replace(/:/g, '-')}.png`;
      if (what === 'page') {
        // As the trader would have it: the hero card scrolled up to just under the sticky bar.
        await page.evaluate(() => window.scrollTo(0, document.getElementById('hero').getBoundingClientRect().top + window.scrollY - document.getElementById('ctl').getBoundingClientRect().height - 4));
        await page.screenshot({ path: name });
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      else await page.locator('#hero').screenshot({ path: name });
    }
    await page.close();
  }
  await browser.close();
  if (!shots.length) {
    console.log('Height needed to see the sticky bar, the status and every chart at once (window: 800 at 1280, 667 on the phones):');
    Object.entries(fit).forEach(([k, v]) => console.log(`  ${k}: ${v}px${v > (k.startsWith('1280') ? 800 : 667) ? '  TOO TALL' : ''}`));
  }
  console.log(problems.length ? [...new Set(problems)].slice(0, 60).join('\n') + `\n${problems.length} problems` : 'no problems');
})();
