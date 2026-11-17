/* eslint-disable */
// Checks trade-list.html at three widths, in both orders, with the meter on and off; takes screenshots.
// Run: node prototypes/replay/checks/list-check.js. Screenshots go to .cache/replay-checks, which git ignores.
const root = require('path').resolve(__dirname, '../../..');
const { chromium } = require(root + '/node_modules/playwright');
const out = root + '/.cache/replay-checks/shots3';
require('fs').mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const problems = [];
  for (const width of [1280, 375, 320]) {
    const page = await browser.newPage({ viewport: { width, height: width < 500 ? 667 : 900 }, deviceScaleFactor: 2 });
    page.on('pageerror', (e) => problems.push(`${width} pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`${width} console: ${m.text()}`); });
    await page.goto('file://' + root + '/prototypes/replay/trade-list.html');
    for (const order of ['activity', 'attention']) for (const show of ['on', 'off']) {
      await page.check(`input[name="order"][value="${order}"]`, { force: true });
      await page.check(`input[name="show"][value="${show}"]`, { force: true });
      const r = await page.evaluate(() => {
        const reg = document.querySelector('.table-scroll');
        const vis = [...document.querySelectorAll('.meter')].filter((m) => m.getBoundingClientRect().width > 0);
        return {
          over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          inner: reg.scrollWidth - reg.clientWidth,
          meters: vis.length,
          minW: Math.min(...vis.map((m) => m.getBoundingClientRect().width)),
          bad: /NaN|undefined|Infinity|null/.test(document.querySelector('.content').innerText) || [...document.querySelectorAll('.meter [style]')].some((e) => /NaN|undefined/.test(e.getAttribute('style'))),
          order: [...document.querySelectorAll('#rows tr')].map((tr) => tr.dataset.und).join(' '),
        };
      });
      const id = `${width} ${order} meter-${show}`;
      console.log(`${id}: page overflow ${r.over}px, table scrolls inside by ${r.inner}px, ${r.meters} meters shown${r.meters ? `, narrowest ${Math.round(r.minW)}px` : ''}\n   ${r.order}`);
      if (r.over > 0) problems.push(`${id}: sideways page scroll ${r.over}px`);
      if (r.bad) problems.push(`${id}: NaN/undefined/null on the page`);
      if (show === 'on' && r.meters !== 12) problems.push(`${id}: ${r.meters} meters visible, expected 12`);
      if (show === 'off' && r.meters !== 0) problems.push(`${id}: meters visible with the meter off`);
      await page.locator('.content').screenshot({ path: `${out}/${width}-${order}-${show}.png` });
    }
    if (width === 1280) {
      await page.check('input[name="show"][value="on"]', { force: true });
      const b = await page.evaluate(() => { const r = document.querySelector('tr[data-und="GALT"] td.pnl .meter').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await page.mouse.move(b.x, b.y);
      const tipText = await page.evaluate(() => (document.getElementById('tip').hidden ? '' : document.getElementById('tip').innerText));
      console.log('hover on GALT: ' + tipText.replace(/\n/g, ' | '));
      if (!/Banked/.test(tipText)) problems.push('hover tip missing');
      await page.screenshot({ path: `${out}/1280-hover.png` });
      console.log('aria-label of DALE: ' + (await page.getAttribute('tr[data-und="DALE"] td.pnl .meter', 'aria-label')));
      // Keyboard: the order radios work with arrows.
      await page.focus('input[name="order"]:checked');
      await page.keyboard.press('ArrowLeft');
      console.log('keyboard: order is now ' + (await page.evaluate(() => state.order)));
    }
    await page.close();
  }
  await browser.close();
  console.log(problems.length ? problems.join('\n') + `\n${problems.length} problems` : 'no problems');
})();
