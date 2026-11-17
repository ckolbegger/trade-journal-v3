/* eslint-disable */
// Keyboard, hover and chip checks for round-2.html. Run: node prototypes/replay/checks/interact2.js
// Screenshots go to .cache/replay-checks, which git ignores.
const root = require('path').resolve(__dirname, '../../..');
const { chromium } = require(root + '/node_modules/playwright');
const out = root + '/.cache/replay-checks/shots2';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + root + '/prototypes/replay/round-2.html');
  const st = () => page.evaluate(() => ({ ...state }));
  const ok = (name, pass) => console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}`);

  ok('opens on the last session', (await st()).cur === 14);
  await page.focus('#slider');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  ok('slider: ArrowLeft twice moves two sessions back', (await st()).cur === 12);
  await page.keyboard.press('Home');
  ok('slider: Home goes to the first session', (await st()).cur === 0);
  const vt = await page.getAttribute('#slider', 'aria-valuetext');
  ok('slider announces the result first: ' + vt.slice(0, 70), /Trade P&L/.test(vt));
  await page.keyboard.press('End');

  await page.focus('#series [aria-checked="true"]');
  await page.keyboard.press('ArrowRight');
  ok('series radios: ArrowRight selects Bearish', (await st()).series === 'bear');
  ok('focus follows to the Bearish radio', await page.evaluate(() => document.activeElement.dataset.series === 'bear'));
  await page.keyboard.press('ArrowLeft');

  await page.focus('#tabs [aria-selected="true"]');
  for (const want of ['balance', 'shares', 'ribbon', 'gauge', 'inset', 'corridor']) {
    await page.keyboard.press('ArrowRight');
    ok(`tabs: ArrowRight reaches ${want}`, (await st()).view === want);
  }
  await page.focus('#trades [aria-checked="true"]');
  await page.keyboard.press('ArrowRight');
  ok('trade radios: ArrowRight selects the next trade', (await st()).trade === 'put');
  await page.keyboard.press('ArrowLeft');

  // Chip: keyboard opens and Escape closes; focus stays on the chip.
  await page.focus('button.chip[data-pop="iv"]');
  ok('chip pop-up shows on focus', await page.evaluate(() => getComputedStyle(document.getElementById('pop-iv')).display === 'block'));
  await page.keyboard.press('Enter');
  ok('chip: Enter marks it expanded', (await page.getAttribute('button.chip[data-pop="iv"]', 'aria-expanded')) === 'true');
  await page.evaluate(() => { state.cur = 9; render(); });
  await page.locator('#hero').screenshot({ path: out + '/chip-iv.png' });
  await page.focus('button.chip[data-pop="iv"]');
  await page.keyboard.press('Escape');
  ok('chip: Escape closes it', (await page.getAttribute('button.chip[data-pop="iv"]', 'aria-expanded')) === 'false');

  // Hover: a revealed session shows its figures; a later one says it is not revealed; a click moves the slider.
  await page.evaluate(() => { state.view = 'corridor'; state.cur = 9; render(); document.activeElement.blur(); window.scrollTo(0, 260); });
  const box = async (i) => page.evaluate((n) => { const r = document.querySelectorAll('#plots svg')[1].querySelector(`[data-i="${n}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, i);
  let b = await box(6);
  await page.mouse.move(b.x, b.y);
  const tipText = await page.evaluate(() => (document.getElementById('tip').hidden ? '' : document.getElementById('tip').innerText));
  ok('hover on a revealed session: ' + tipText.replace(/\n/g, ' | ').slice(0, 200), /Trade P&L/.test(tipText) && /Why the call moved/.test(tipText));
  await page.screenshot({ path: out + '/hover.png' });
  b = await box(12);
  await page.mouse.move(b.x, b.y);
  ok('hover on a later session says it is not revealed', /Not yet revealed/.test(await page.evaluate(() => document.getElementById('tip').innerText)));
  await page.mouse.click(b.x, b.y);
  ok('click on a session moves the slider there', (await st()).cur === 12);

  // Nothing from a later session is in the page before it is revealed.
  await page.evaluate(() => { Object.assign(state, { trade: 'call', series: 'bull', view: 'corridor', cur: 5 }); render(); });
  const leak = await page.evaluate(() => /106\.50|1,456|Sold 2/.test(document.getElementById('hero').innerText + document.getElementById('readout').innerText + document.getElementById('table').innerText));
  ok('at session 6 nothing from later sessions is in the card, the readout or the table', !leak);
  console.log(errors.length ? 'page errors: ' + errors.join('; ') : 'no page errors');
  await browser.close();
})();
