import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type BrowserContext, type BrowserType, type Page } from '@playwright/test';
import { startProbeServer, type ProbeServer } from './probe-server';

// D1 T1.2: every browser capability the D1 design depends on, in one engine.
// Any false value stops work for a discussion before T1.8.

const PORT = 5175;
const ORIGIN = `http://localhost:${PORT}`;

async function openControlled(context: BrowserContext): Promise<Page> {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 15_000,
  });
  return page;
}

function idbPut(page: Page, value: string): Promise<void> {
  return page.evaluate(async (v) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('probe', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('open failed'));
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite', { durability: 'strict' });
      tx.objectStore('kv').put(v, 'k');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('aborted'));
    });
    db.close();
  }, value);
}

function idbGet(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('probe', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('open failed'));
    });
    const value = await new Promise<unknown>((resolve, reject) => {
      const req = db.transaction('kv', 'readonly').objectStore('kv').get('k');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('get failed'));
    });
    db.close();
    return value;
  });
}

function sigkillBrowser(profileDir: string): number {
  const pids = execFileSync('pgrep', ['-f', profileDir], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map(Number);
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // The process already exited with its parent.
    }
  }
  return pids.length;
}

function osDescription(): string {
  if (process.platform === 'darwin') {
    const name = execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim();
    const build = execFileSync('sw_vers', ['-buildVersion'], { encoding: 'utf8' }).trim();
    return `macOS ${name} (${build}), ${os.arch()}`;
  }
  return `${os.type()} ${os.release()}, ${os.arch()}`;
}

async function engineVersion(browserType: BrowserType): Promise<string> {
  const browser = await browserType.launch();
  const version = browser.version();
  await browser.close();
  return version;
}

test('engine capabilities for D1', async ({ playwright, browserName }, testInfo) => {
  const browserType = playwright[browserName];
  test.setTimeout(180_000);
  const profileDir = testInfo.outputPath('profile');
  const results: Record<string, boolean> = {};
  const details: Record<string, unknown> = {};
  let server: ProbeServer | undefined = await startProbeServer(PORT);
  const launch = (offline = false) => browserType.launchPersistentContext(profileDir, { offline });

  try {
    let context = await launch();
    let page = await openControlled(context);

    const inPage = await page.evaluate(async () => {
      const r: Record<string, boolean> = {};
      const d: Record<string, unknown> = {};
      const attempt = async (name: string, check: () => Promise<boolean>) => {
        try {
          r[name] = await check();
        } catch (error) {
          r[name] = false;
          d[name] = String(error);
        }
      };
      await attempt('isSecureContext', () => Promise.resolve(window.isSecureContext));
      await attempt('serviceWorkerRegistrationAndControl', async () => {
        const registration = await navigator.serviceWorker.getRegistration('/');
        return registration?.active != null && navigator.serviceWorker.controller !== null;
      });
      await attempt('cacheStorage', async () => {
        const cache = await caches.open('capability-check');
        await cache.put('/capability-check', new Response('ok'));
        const text = await (await cache.match('/capability-check'))?.text();
        await caches.delete('capability-check');
        return text === 'ok';
      });
      await attempt('storageEstimate', async () => {
        const estimate = await navigator.storage.estimate();
        d.storageEstimate = estimate;
        return typeof estimate.quota === 'number' && typeof estimate.usage === 'number';
      });
      await attempt('storagePersisted', async () => {
        const persisted = await navigator.storage.persisted();
        d.storagePersisted = persisted;
        return typeof persisted === 'boolean';
      });
      await attempt('broadcastChannel', async () => {
        const sender = new BroadcastChannel('capability-check');
        const receiver = new BroadcastChannel('capability-check');
        const received = new Promise<boolean>((resolve) => {
          receiver.onmessage = (event) => resolve(event.data === 'ping');
          setTimeout(() => resolve(false), 2_000);
        });
        sender.postMessage('ping');
        const ok = await received;
        sender.close();
        receiver.close();
        return ok;
      });
      await attempt('cryptoSubtle', async () => {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc'));
        const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
        return hex === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
      });
      return { r, d };
    });
    Object.assign(results, inPage.r);
    Object.assign(details, inPage.d);

    // IndexedDB, with a strict-durability write read back.
    await idbPut(page, 'first');
    results.indexedDB = (await idbGet(page)) === 'first';

    // Persistent context: stop, restart, and find data and service-worker control intact.
    await idbPut(page, 'before-restart');
    await context.close();
    context = await launch();
    page = await openControlled(context);
    results.persistentContextRestart = (await idbGet(page)) === 'before-restart';

    // Offline relaunch: server stopped and the network disabled.
    await context.close();
    await server.close();
    server = undefined;
    context = await launch(true);
    page = await openControlled(context);
    results.offlineRelaunch =
      (await page.title()) === 'Engine capability probe' && (await idbGet(page)) === 'before-restart';
    await context.close();

    // SIGKILL of the browser process after a committed write, then relaunch.
    server = await startProbeServer(PORT);
    context = await launch();
    page = await openControlled(context);
    await idbPut(page, 'before-kill');
    details.killedProcesses = sigkillBrowser(profileDir);
    await context.close().catch(() => undefined);
    context = await launch();
    page = await openControlled(context);
    results.sigkillOfBrowserProcess =
      (details.killedProcesses as number) > 0 && (await idbGet(page)) === 'before-kill';
    await context.close();
  } finally {
    await server?.close();
  }

  const record = {
    engine: browserName,
    engineVersion: await engineVersion(browserType),
    os: osDescription(),
    node: process.version,
    origin: ORIGIN,
    capabilities: results,
    details,
  };
  const evidenceDir = path.join(process.cwd(), 'evidence', 'D01');
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    path.join(evidenceDir, `engine-capabilities-${browserName}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
  );

  expect(results).toEqual({
    isSecureContext: true,
    serviceWorkerRegistrationAndControl: true,
    cacheStorage: true,
    indexedDB: true,
    storageEstimate: true,
    storagePersisted: true,
    broadcastChannel: true,
    cryptoSubtle: true,
    persistentContextRestart: true,
    offlineRelaunch: true,
    sigkillOfBrowserProcess: true,
  });
});
