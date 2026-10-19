import { describe, expect, it, vi } from 'vitest';
import { handleActivate, handleInstall, handleMessage, serveRequest, stageRelease, type ServiceWorkerEnv } from './index.ts';
import { fakeFetch, fakeRelease, MemoryCacheStorage, ORIGIN, type FakeRelease } from './test-doubles.ts';

function env(release: FakeRelease, overrides: Partial<ServiceWorkerEnv> = {}) {
  const log: string[] = [];
  const caches = new MemoryCacheStorage(log);
  const network = fakeFetch(release, log);
  const skipWaiting = vi.fn(() => Promise.resolve());
  const claimClients = vi.fn(() => Promise.resolve());
  const value: ServiceWorkerEnv = {
    releaseId: release.releaseId,
    origin: ORIGIN,
    caches: caches as unknown as CacheStorage,
    fetch: network.fetch,
    skipWaiting,
    claimClients,
    ...overrides,
  };
  return { env: value, log, caches, calls: network.calls, skipWaiting, claimClients };
}

describe('release staging', () => {
  it('should fetch every inventory asset with cache "reload", verify each SHA-256 digest, and write the release cache only after all match', async () => {
    const release = await fakeRelease('v1');
    const t = env(release);
    await stageRelease(t.env);

    const assetPaths = release.inventory.assets.map((a) => a.path).sort();
    const fetched = t.calls.map((c) => new URL(c.url).pathname);
    expect(fetched.filter((p) => p !== '/inventory.json').sort()).toEqual(assetPaths);
    expect(t.calls.every((c) => c.cache === 'reload')).toBe(true);

    const cache = t.caches.caches.get(`tj-release-${release.releaseId}`);
    const cached = [...(cache?.entries.keys() ?? [])].map((u) => new URL(u).pathname).sort();
    expect(cached).toEqual([...assetPaths, '/inventory.json'].sort());
    const firstCacheWrite = t.log.findIndex((e) => e.startsWith('open') || e.startsWith('put'));
    const lastFetch = t.log.findLastIndex((e) => e.startsWith('fetch'));
    expect(firstCacheWrite).toBeGreaterThan(lastFetch);
  });

  it('should fail installation and leave no release cache when any asset is missing or its digest differs', async () => {
    const corrupt = await fakeRelease('v1');
    corrupt.files.set('/assets/app.js', new TextEncoder().encode('tampered'));
    const t1 = env(corrupt);
    await expect(stageRelease(t1.env)).rejects.toThrow(/digest/i);
    expect(await t1.caches.keys()).toEqual([]);

    const missing = await fakeRelease('v1');
    missing.files.delete('/manifest.webmanifest');
    const t2 = env(missing);
    await expect(stageRelease(t2.env)).rejects.toThrow(/missing/i);
    expect(await t2.caches.keys()).toEqual([]);
  });

  it('should fail installation when the embedded release identity does not equal the hash of the inventory\'s digest list', async () => {
    const v1 = await fakeRelease('v1');
    const v2 = await fakeRelease('v2');
    // A worker embedding v1's identity that is served v2's (internally consistent) files.
    const t = env(v2, { releaseId: v1.releaseId });
    await expect(stageRelease(t.env)).rejects.toThrow(/release identity/i);
    expect(await t.caches.keys()).toEqual([]);
  });
});

describe('offline serving', () => {
  async function staged(label: string) {
    const release = await fakeRelease(label);
    const t = env(release);
    await stageRelease(t.env);
    t.calls.length = 0;
    return { release, ...t };
  }

  it('should answer a navigation request with the release\'s cached index document without calling fetch', async () => {
    const { release, env: e, calls } = await staged('v1');
    const response = await serveRequest(e, { url: `${ORIGIN}/trades/123`, mode: 'navigate', method: 'GET' });
    expect(await response.text()).toBe(new TextDecoder().decode(release.files.get('/index.html')));
    expect(calls).toEqual([]);
  });

  it('should answer an inventory asset only from its own release cache, never another release\'s', async () => {
    const { release, env: e, calls, caches } = await staged('v1');
    const other = await fakeRelease('v2');
    const otherCache = await caches.open(`tj-release-${other.releaseId}`);
    await otherCache.put(`${ORIGIN}/assets/app.js`, new Response(other.files.get('/assets/app.js')?.slice()));

    const response = await serveRequest(e, { url: `${ORIGIN}/assets/app.js`, mode: 'cors', method: 'GET' });
    expect(await response.text()).toBe(new TextDecoder().decode(release.files.get('/assets/app.js')));
    expect(calls).toEqual([]);
  });

  it('should not cache any response outside the inventory', async () => {
    const { env: e, caches, calls } = await staged('v1');
    const cache = caches.caches.get(`tj-release-${e.releaseId}`);
    const before = [...(cache?.entries.keys() ?? [])];
    const response = await serveRequest(e, { url: `${ORIGIN}/not-in-inventory.txt`, mode: 'cors', method: 'GET' });
    expect(response.status).toBe(404);
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(['/not-in-inventory.txt']);
    expect([...(cache?.entries.keys() ?? [])]).toEqual(before);
    expect(await caches.keys()).toEqual([`tj-release-${e.releaseId}`]);

    // Serving before any release is staged must not create cache state either.
    const unstaged = env(await fakeRelease('v1'));
    await serveRequest(unstaged.env, { url: `${ORIGIN}/assets/app.js`, mode: 'cors', method: 'GET' });
    expect(await unstaged.caches.keys()).toEqual([]);
  });
});

describe('activation', () => {
  it('should not call skipWaiting at install while an earlier release cache exists', async () => {
    const t = env(await fakeRelease('v2'));
    await t.caches.open('tj-release-earlier');
    await handleInstall(t.env);
    expect(t.skipWaiting).not.toHaveBeenCalled();
    expect(await t.caches.has(`tj-release-${t.env.releaseId}`)).toBe(true);
  });

  it('should claim uncontrolled clients at first activation when no earlier release cache exists', async () => {
    const first = env(await fakeRelease('v1'));
    await handleInstall(first.env);
    await handleActivate(first.env);
    expect(first.claimClients).toHaveBeenCalledTimes(1);

    const update = env(await fakeRelease('v2'));
    await update.caches.open('tj-release-earlier');
    await handleInstall(update.env);
    await handleActivate(update.env);
    expect(update.claimClients).not.toHaveBeenCalled();
  });

  it('should call skipWaiting only after receiving an ApplyUpdate message', async () => {
    const t = env(await fakeRelease('v2'));
    await t.caches.open('tj-release-earlier');
    await handleInstall(t.env);
    const reply = vi.fn();
    await handleMessage(t.env, { type: 'Unrelated' }, reply);
    expect(t.skipWaiting).not.toHaveBeenCalled();
    await handleMessage(t.env, { type: 'ApplyUpdate' }, reply);
    expect(t.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('should delete earlier release caches only during its own activation', async () => {
    const t = env(await fakeRelease('v2'));
    await t.caches.open('tj-release-earlier');
    await t.caches.open('unrelated-cache');
    await handleInstall(t.env);
    expect((await t.caches.keys()).sort()).toEqual(['tj-release-earlier', `tj-release-${t.env.releaseId}`, 'unrelated-cache'].sort());
    await handleActivate(t.env);
    expect((await t.caches.keys()).sort()).toEqual([`tj-release-${t.env.releaseId}`, 'unrelated-cache'].sort());
  });

  it('should reply to a ReleaseIdentity message with its release identity', async () => {
    const t = env(await fakeRelease('v1'));
    const reply = vi.fn();
    await handleMessage(t.env, { type: 'ReleaseIdentity' }, reply);
    expect(reply).toHaveBeenCalledWith({ type: 'ReleaseIdentity', releaseId: t.env.releaseId });
  });
});
