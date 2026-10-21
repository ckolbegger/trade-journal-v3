declare const __RELEASE_ID__: string;
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] };
interface Inventory { version: number; releaseId: string; assets: { url: string; bytes: number; sha256: string }[] }
const precacheEntries = self.__WB_MANIFEST;
const release = __RELEASE_ID__;
const cacheName = `trade-journal-release-${release}`;
const expected = new Map<string, string | null>();
for (const entry of precacheEntries) {
  const path = new URL(entry.url, self.location.origin).pathname;
  expected.set(path, entry.revision?.length === 64 ? entry.revision : expected.get(path) ?? null);
}
expected.set('/sw.js', null);
async function sha256(response: Response): Promise<string> {
  const bytes = await response.arrayBuffer();
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}
function complete(inventory: Inventory) {
  return inventory.version === 1 && inventory.releaseId === release && inventory.assets.length === expected.size && new Set(inventory.assets.map(asset => asset.url)).size === expected.size && inventory.assets.every(asset => expected.has(asset.url) && (!expected.get(asset.url) || expected.get(asset.url) === asset.sha256));
}
async function verify(cache: Cache) {
  const manifest = await cache.match('/offline-inventory.json');
  if (!manifest) return false;
  const inventory = await manifest.json() as Inventory;
  if (!complete(inventory)) return false;
  for (const asset of inventory.assets) {
    const response = await cache.match(asset.url);
    if (!response || (await response.clone().arrayBuffer()).byteLength !== asset.bytes || await sha256(response) !== asset.sha256) return false;
  }
  return true;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const beforeUsage = (await navigator.storage.estimate().catch((): StorageEstimate => ({}))).usage;
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch('/offline-inventory.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Inventory unavailable');
      const inventory = await response.clone().json() as Inventory;
      if (!complete(inventory)) throw new Error('Incomplete release inventory');
      for (const asset of inventory.assets) {
        const resource = await fetch(asset.url, { cache: 'no-store' });
        if (!resource.ok || (await resource.clone().arrayBuffer()).byteLength !== asset.bytes || await sha256(resource.clone()) !== asset.sha256) throw new Error(`Invalid release asset: ${asset.url}`);
        await cache.put(asset.url, resource);
      }
      await cache.put('/offline-inventory.json', response);
      if (!await verify(cache)) throw new Error('Release verification failed');
      const afterUsage = (await navigator.storage.estimate().catch((): StorageEstimate => ({}))).usage;
      const observedBytes = typeof beforeUsage === 'number' && typeof afterUsage === 'number' ? Math.max(0, afterUsage - beforeUsage) : 0;
      await cache.put('/__release-size', new Response(JSON.stringify({ release, observedBytes }), { headers: { 'Content-Type': 'application/json' } }));
    } catch (error) { await caches.delete(cacheName); throw error; }
  })());
});
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('message', event => {
  if (event.data === 'ACTIVATE_AT_SAFE_RELOAD') event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clients.length !== 1 || !event.source || !('id' in event.source) || clients[0]?.id !== event.source.id) {
      event.ports[0]?.postMessage('OtherClientsOpen'); return;
    }
    event.ports[0]?.postMessage('Activating');
    await self.skipWaiting();
  })());
  if (event.data === 'VERIFY_RELEASE') event.waitUntil((async () => {
    let verified = false;
    try { verified = await verify(await caches.open(cacheName)); } catch { /* Failed cache is never Writable. */ }
    event.ports[0]?.postMessage({ release, verified, assetCount: expected.size });
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    // Every cached response is a digest-verified, same-origin release asset.
    // Server negotiation headers must not hide those fixed bytes offline.
    const response = await cache.match(event.request, { ignoreVary: true });
    if (response) return response;
    if (event.request.mode === 'navigate') { const index = await cache.match('/index.html'); if (index) return index; }
    return fetch(event.request);
  })());
});
export {};
