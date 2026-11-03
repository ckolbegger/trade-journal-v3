// Does a read-write cursor over IDBKeyRange.only(oldKey) delete the one stale index entry Chromium leaves behind?
// Builds the same churn in several databases and compares the Open-range read.
import { chromium } from '/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/node_modules/playwright/index.mjs';

const origin = 'http://probe.invalid';
const context = await chromium.launchPersistentContext(process.argv[2], { headless: true });
await context.route(`${origin}/**`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>probe</title>' }));
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(`${origin}/`);
page.on('console', (m) => console.log(m.text()));

const result = await page.evaluate(async (N) => {
  const req = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const done = (tx) => new Promise((ok, no) => { tx.oncomplete = ok; tx.onerror = () => no(tx.error); tx.onabort = () => no(tx.error); });
  const open = (name) => new Promise((ok, no) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('trades', { keyPath: 'tradeId' }).createIndex('byLifecycleActivity', ['lifecycle', 'activityDesc', 'tradeId']);
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  const pad = (n) => String(n).padStart(9, '0');
  const desc = (t) => pad(999999999 - t);            // later activity sorts first, like activityDesc
  const OPEN = IDBKeyRange.bound(['Open'], ['Open', []]);

  async function sweepKey(db, key, txIn) {
    const tx = txIn ?? db.transaction(['trades'], 'readwrite');
    let seen = 0;
    await new Promise((ok, no) => {
      const c = tx.objectStore('trades').index('byLifecycleActivity').openCursor(IDBKeyRange.only(key));
      c.onsuccess = () => { if (c.result) { seen++; c.result.continue(); } else ok(); };
      c.onerror = () => no(c.error);
    });
    if (!txIn) await done(tx);
    return seen;
  }
  async function readOpen(db) {
    const ms = [];
    let rows = 0;
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      rows = (await req(db.transaction(['trades'], 'readonly').objectStore('trades').index('byLifecycleActivity').getAll(OPEN))).length;
      ms.push(performance.now() - t0);
    }
    ms.sort((a, b) => a - b);
    return { rows, medianMs: +ms[3].toFixed(1) };
  }

  // mode: 'none' | 'after' (separate rw tx after each commit) | 'same' (cursor inside the write tx)
  async function build(name, mode) {
    const db = await open(name);
    const live = 100;
    // 100 Trades that stay Open
    { const tx = db.transaction(['trades'], 'readwrite'); for (let i = 0; i < live; i++) tx.objectStore('trades').put({ tradeId: `L${pad(i)}`, lifecycle: 'Open', activityDesc: desc(5e8 + i) }); await done(tx); }
    let sweepMs = 0, sweeps = 0, staleSeen = 0;
    const oldKeys = [];
    // N Trades: open, one later entry (activity move), then close: two stale 'Open' keys each
    for (let i = 0; i < N; i++) {
      const id = `T${pad(i)}`;
      const steps = [
        { prev: null, next: { tradeId: id, lifecycle: 'Open', activityDesc: desc(2 * i) } },
        { prev: ['Open', desc(2 * i), id], next: { tradeId: id, lifecycle: 'Open', activityDesc: desc(2 * i + 1) } },
        { prev: ['Open', desc(2 * i + 1), id], next: { tradeId: id, lifecycle: 'Closed', activityDesc: desc(2 * i + 1) } },
      ];
      for (const { prev, next } of steps) {
        const tx = db.transaction(['trades'], 'readwrite');
        tx.objectStore('trades').put(next);
        if (prev && mode === 'same') { const t0 = performance.now(); staleSeen += await sweepKey(db, prev, tx); sweepMs += performance.now() - t0; sweeps++; }
        await done(tx);
        if (prev && mode === 'after') { const t0 = performance.now(); staleSeen += await sweepKey(db, prev); sweepMs += performance.now() - t0; sweeps++; }
        if (prev) oldKeys.push(prev);
      }
    }
    const out = { mode, churn: N, openRead: await readOpen(db), sweeps, staleSeenByCursor: staleSeen, meanSweepMs: sweeps ? +(sweepMs / sweeps).toFixed(2) : 0 };
    if (mode === 'none') {
      // Backlog: targeted sweep of every known old key afterwards, then a full-range rw pass for comparison
      const t0 = performance.now();
      for (const key of oldKeys) await sweepKey(db, key);
      out.backlogTargetedMs = Math.round(performance.now() - t0);
      out.openReadAfterBacklogTargeted = await readOpen(db);
    }
    db.close();
    return out;
  }

  const fresh = await (async () => {
    const db = await open('fresh');
    const tx = db.transaction(['trades'], 'readwrite');
    for (let i = 0; i < 100; i++) tx.objectStore('trades').put({ tradeId: `L${pad(i)}`, lifecycle: 'Open', activityDesc: desc(5e8 + i) });
    for (let i = 0; i < N; i++) tx.objectStore('trades').put({ tradeId: `T${pad(i)}`, lifecycle: 'Closed', activityDesc: desc(2 * i + 1) });
    await done(tx);
    const r = await readOpen(db); db.close(); return r;
  })();
  console.log('fresh done');
  const none = await build('churn-none', 'none'); console.log('none done');
  const after = await build('churn-after', 'after'); console.log('after done');
  const same = await build('churn-same', 'same'); console.log('same done');
  return { freshOpenRead: fresh, none, after, same };
}, Number(process.argv[3] ?? 10000));
console.log(JSON.stringify(result, null, 2));
await context.close();
