// Times index range reads on the partial bench profile, then on a fresh copy of the same Trade documents.
import { chromium } from '/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/node_modules/playwright/index.mjs';

const profile = process.argv[2];
const origin = 'http://localhost:5181';
const context = await chromium.launchPersistentContext(profile, { headless: true });
await context.route(`${origin}/**`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>probe</title>' }));
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(`${origin}/probe`);
page.on('console', (m) => console.log(m.text()));

const result = await page.evaluate(async () => {
  const req = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const open = (name, version, upgrade) => new Promise((ok, no) => {
    const r = version ? indexedDB.open(name, version) : indexedDB.open(name);
    r.onupgradeneeded = () => upgrade?.(r.result, r.transaction);
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  const dbs = await indexedDB.databases();
  let source;
  for (const { name } of dbs) {
    const db = await open(name);
    if (db.objectStoreNames.contains('trades')) { source = db; break; }
    db.close();
  }
  const queries = {
    'byLifecycleActivity Open (all)': ['byLifecycleActivity', IDBKeyRange.bound(['Open'], ['Open', []]), undefined],
    'byLifecycleActivity Open (101)': ['byLifecycleActivity', IDBKeyRange.bound(['Open'], ['Open', []]), 101],
    'byLifecycle Open (all)': ['byLifecycle', IDBKeyRange.bound(['Open'], ['Open', []]), undefined],
    'byLifecycle Planned (all)': ['byLifecycle', IDBKeyRange.bound(['Planned'], ['Planned', []]), undefined],
    'byLifecycleTerminal Closed (51)': ['byLifecycleTerminal', IDBKeyRange.bound(['Closed'], ['Closed', []]), 51],
  };
  const time = async (db) => {
    const out = {};
    for (const [label, [index, range, count]] of Object.entries(queries)) {
      const ms = []; let rows = 0;
      for (let i = 0; i < 7; i++) {
        const t0 = performance.now();
        const tx = db.transaction(['trades'], 'readonly');
        const got = await req(tx.objectStore('trades').index(index).getAll(range, count));
        ms.push(performance.now() - t0); rows = got.length;
      }
      ms.sort((a, b) => a - b);
      out[label] = { rows, medianMs: +ms[3].toFixed(1), minMs: +ms[0].toFixed(1) };
    }
    return out;
  };
  const before = await time(source);
  const docs = await req(source.transaction(['trades'], 'readonly').objectStore('trades').getAll());
  const keyPath = source.transaction(['trades'], 'readonly').objectStore('trades').keyPath;
  source.close();
  const fresh = await open('probe-fresh', 1, (db) => {
    const s = db.createObjectStore('trades', { keyPath });
    s.createIndex('byLifecycle', ['lifecycle', 'planTime', 'tradeId']);
    s.createIndex('byLifecycleActivity', ['lifecycle', 'activityDesc', 'tradeId']);
    s.createIndex('byLifecycleTerminal', ['lifecycle', 'terminalDesc', 'tradeId']);
  });
  await new Promise((ok, no) => {
    const tx = fresh.transaction(['trades'], 'readwrite');
    for (const d of docs) tx.objectStore('trades').put(d);
    tx.oncomplete = ok; tx.onerror = () => no(tx.error);
  });
  const after = await time(fresh);
  fresh.close();
  return { tradeDocs: docs.length, keyPath, original: before, freshCopy: after };
});
console.log(JSON.stringify(result, null, 2));
await context.close();
