/// <reference lib="webworker" />

import {
  isValidOfflineReleaseInventory,
  sha256Hex,
  verifyOfflineInventory,
  type OfflineReleaseInventory,
} from '../runtime/inventory';

declare const self: ServiceWorkerGlobalScope;

const CACHE_PREFIX = 'tjv3-release-';
const META_CACHE_NAME = 'tjv3-release-meta';
const META_ACTIVE_KEY = '/__meta__/active-release';
const META_STAGED_KEY = '/__meta__/staged-release';
const INVENTORY_URL = '/release-inventory.json';

let activeReleaseId: string | null = null;
let stagedReleaseId: string | null = null;

async function readMetaReleaseId(key: string): Promise<string | null> {
  const metaCache = await caches.open(META_CACHE_NAME);
  const res = await metaCache.match(key);
  if (!res) {
    return null;
  }
  const text = (await res.text()).trim();
  return text.length > 0 ? text : null;
}

async function writeMetaReleaseId(key: string, releaseId: string): Promise<void> {
  const metaCache = await caches.open(META_CACHE_NAME);
  await metaCache.put(
    key,
    new Response(releaseId, { headers: { 'content-type': 'text/plain; charset=utf-8' } }),
  );
}

async function fetchAndVerifyInventoryForInstall(): Promise<{
  inventory: OfflineReleaseInventory;
  rawInventoryText: string;
  assetResponses: Map<string, { bytes: Uint8Array; contentType: string }>;
}> {
  const invRes = await fetch(INVENTORY_URL, { cache: 'no-store' });
  if (!invRes.ok) {
    throw new Error(`Failed to fetch release inventory: HTTP ${invRes.status}`);
  }
  const rawInventoryText = await invRes.text();
  const parsed: unknown = JSON.parse(rawInventoryText);
  if (!isValidOfflineReleaseInventory(parsed)) {
    throw new Error('Release inventory failed schema validation.');
  }

  const entries = await Promise.all(
    parsed.assets.map(async (asset) => {
      const res = await fetch(asset.url, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Failed to fetch release asset ${asset.url}: HTTP ${res.status}`);
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength !== asset.size) {
        throw new Error(`Size mismatch while staging ${asset.url}`);
      }
      const actualDigest = await sha256Hex(buf);
      if (actualDigest !== asset.sha256) {
        throw new Error(`SHA-256 digest mismatch while staging ${asset.url}`);
      }
      return [
        asset.url,
        {
          bytes: buf,
          contentType: res.headers.get('content-type') || 'application/octet-stream',
        },
      ] as const;
    }),
  );

  return {
    inventory: parsed,
    rawInventoryText,
    assetResponses: new Map(entries),
  };
}

async function resolveActiveReleaseId(): Promise<string | null> {
  if (activeReleaseId) {
    return activeReleaseId;
  }
  const persisted = await readMetaReleaseId(META_ACTIVE_KEY);
  if (persisted) {
    activeReleaseId = persisted;
    return persisted;
  }
  return null;
}

async function verifyCachedInventoryOffline() {
  const releaseId = await resolveActiveReleaseId();
  if (!releaseId) {
    return { valid: false as const, reason: 'No active offline release inventory found.' };
  }
  const cache = await caches.open(`${CACHE_PREFIX}${releaseId}`);
  const invResponse = await cache.match(INVENTORY_URL);
  if (!invResponse) {
    return { valid: false as const, reason: 'Cached release-inventory.json is missing.' };
  }
  let parsed: unknown;
  try {
    parsed = await invResponse.json();
  } catch {
    return { valid: false as const, reason: 'Cached release-inventory.json is unreadable.' };
  }
  if (!isValidOfflineReleaseInventory(parsed)) {
    return { valid: false as const, reason: 'Cached release-inventory.json is invalid.' };
  }

  return verifyOfflineInventory(parsed, async (url) => {
    const match = await cache.match(url);
    if (!match) {
      return null;
    }
    return new Uint8Array(await match.arrayBuffer());
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const { inventory, rawInventoryText, assetResponses } =
        await fetchAndVerifyInventoryForInstall();
      const cacheName = `${CACHE_PREFIX}${inventory.releaseId}`;
      const cache = await caches.open(cacheName);

      await cache.put(
        INVENTORY_URL,
        new Response(rawInventoryText, {
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }),
      );

      for (const [url, { bytes, contentType }] of assetResponses.entries()) {
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        await cache.put(
          url,
          new Response(copy.buffer, {
            headers: { 'content-type': contentType },
          }),
        );
      }

      stagedReleaseId = inventory.releaseId;
      await writeMetaReleaseId(META_STAGED_KEY, inventory.releaseId);

      // Only activate immediately on very first install when no active worker exists.
      // Updates must remain waiting until the UI explicitly sends ACTIVATE_UPDATE at a safe boundary.
      if (!self.registration.active) {
        await self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const promoted =
        stagedReleaseId ??
        (await readMetaReleaseId(META_STAGED_KEY)) ??
        (await readMetaReleaseId(META_ACTIVE_KEY));

      if (promoted) {
        activeReleaseId = promoted;
        await writeMetaReleaseId(META_ACTIVE_KEY, promoted);
      }

      const activeCacheName = promoted ? `${CACHE_PREFIX}${promoted}` : null;
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== META_CACHE_NAME && k !== activeCacheName)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  // Never serve release-inventory.json or sw.js from cache during network fetches
  if (url.pathname === INVENTORY_URL || url.pathname === '/sw.js') {
    return;
  }

  event.respondWith(
    (async () => {
      const releaseId = await resolveActiveReleaseId();
      if (releaseId) {
        const cache = await caches.open(`${CACHE_PREFIX}${releaseId}`);
        const exact = await cache.match(request);
        if (exact) {
          return exact;
        }
        if (request.mode === 'navigate' || url.pathname === '/') {
          const indexFallback = await cache.match('/index.html');
          if (indexFallback) {
            return indexFallback;
          }
        }
      }
      try {
        return await fetch(request);
      } catch {
        return new Response('Offline resource unavailable.', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  const port = event.ports[0];
  const data = event.data as { type?: string } | undefined;
  if (!data?.type) {
    return;
  }

  if (data.type === 'ACTIVATE_UPDATE') {
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (data.type === 'GET_STATUS' && port) {
    event.waitUntil(
      (async () => {
        const releaseId = await resolveActiveReleaseId();
        port.postMessage(
          releaseId
            ? { controlled: true, releaseId }
            : { controlled: false, reason: 'Active service worker has no activated release metadata.' },
        );
      })(),
    );
    return;
  }

  if (data.type === 'VERIFY_INVENTORY' && port) {
    event.waitUntil(
      (async () => {
        const result = await verifyCachedInventoryOffline();
        port.postMessage(result);
      })(),
    );
  }
});
