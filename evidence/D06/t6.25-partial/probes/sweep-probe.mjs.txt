import { chromium } from '/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/node_modules/playwright/index.mjs';
const origin = 'http://localhost:5181';
const context = await chromium.launchPersistentContext(process.argv[2], { headless: true });
await context.route(`${origin}/**`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>probe</title>' }));
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(`${origin}/probe`);
const result = await page.evaluate(async () => {
  const req = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  let db;
  for (const { name } of await indexedDB.databases()) {
    const d = await req(indexedDB.open(name));
    if (d.objectStoreNames.contains('trades')) { db = d; break; } d.close();
  }
  const range = IDBKeyRange.bound(['Open'], ['Open', []]);
  const t = async (mode, how) => {
    const t0 = performance.now();
    const tx = db.transaction(['trades'], mode);
    const index = tx.objectStore('trades').index('byLifecycleActivity');
    let n = 0;
    if (how === 'cursor') await new Promise((ok) => { const c = index.openCursor(range); c.onsuccess = () => { if (c.result) { n++; c.result.continue(); } else ok(); }; });
    else n = (await req(index.getAll(range))).length;
    await new Promise((ok) => { tx.oncomplete = ok; });
    return `${mode} ${how}: ${n} rows ${(performance.now() - t0).toFixed(1)} ms`;
  };
  return [await t('readonly', 'getAll'), await t('readonly', 'cursor'), await t('readwrite', 'getAll'), await t('readonly', 'getAll'), await t('readwrite', 'cursor'), await t('readonly', 'getAll'), await t('readonly', 'getAll')];
});
console.log(result.join('\n'));
await context.close();
