import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

export interface ReleaseInventoryAsset {
  readonly path: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export interface OfflineReleaseInventoryPayload {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly cacheName: string;
  readonly assets: readonly ReleaseInventoryAsset[];
}

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function walkFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (stat.isFile()) {
      results.push(full);
    }
  }
  return results;
}

export function buildServiceWorkerSource(inventory: OfflineReleaseInventoryPayload): string {
  const serializedInventory = JSON.stringify(inventory, null, 2);
  return `// Trade Journal V3 — Versioned Service Worker (${inventory.releaseId})
const OFFLINE_RELEASE_INVENTORY = ${serializedInventory};
const CACHE_NAME = OFFLINE_RELEASE_INVENTORY.cacheName;

async function sha256HexFromBuffer(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function stageAndVerifyReleaseAssets() {
  const cache = await caches.open(CACHE_NAME);
  for (const entry of OFFLINE_RELEASE_INVENTORY.assets) {
    const response = await fetch(entry.path, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to fetch release asset: ' + entry.path);
    }
    const contentType = response.headers.get('Content-Type') || '';
    const headers = contentType ? { 'Content-Type': contentType } : undefined;
    const buffer = await response.arrayBuffer();
    const computedDigest = await sha256HexFromBuffer(buffer);
    if (computedDigest !== entry.sha256) {
      throw new Error('Digest mismatch for asset ' + entry.path + ': expected ' + entry.sha256 + ', got ' + computedDigest);
    }
    await cache.put(entry.path, new Response(buffer.slice(0), { headers }));
    if (entry.path === '/index.html') {
      await cache.put('/', new Response(buffer.slice(0), { headers }));
    }
  }
  const inventoryResponse = new Response(JSON.stringify(OFFLINE_RELEASE_INVENTORY), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  await cache.put('/offline-release-inventory.json', inventoryResponse);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await stageAndVerifyReleaseAssets();
      // Only claim immediately on fresh install when no existing SW controls clients.
      // Updates wait for explicit ACTIVATE_STAGED_RELEASE from the client (AC-DEL-002).
      if (!self.registration.active) {
        await self.skipWaiting();
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      for (const key of keys) {
        if (key.startsWith('trade-journal-v3-release-') && key !== CACHE_NAME) {
          await caches.delete(key);
        }
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'ACTIVATE_STAGED_RELEASE') {
    self.skipWaiting();
  } else if (data.type === 'GET_RELEASE_INFO' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({
      releaseId: OFFLINE_RELEASE_INVENTORY.releaseId,
      cacheName: CACHE_NAME,
      assetCount: OFFLINE_RELEASE_INVENTORY.assets.length,
    });
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      if (url.pathname === '/offline-release-inventory.json') {
        const cachedInv = await cache.match('/offline-release-inventory.json');
        if (cachedInv) return cachedInv;
        return new Response(JSON.stringify(OFFLINE_RELEASE_INVENTORY), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      const cached = await cache.match(url.pathname);
      if (cached) {
        return cached;
      }

      try {
        const networkResponse = await fetch(request);
        return networkResponse;
      } catch (err) {
        if (request.mode === 'navigate') {
          const fallback = (await cache.match('/index.html')) || (await cache.match('/'));
          if (fallback) return fallback;
        }
        throw err;
      }
    })()
  );
});
`;
}

export function tradeJournalPwaPlugin(): Plugin {
  let rootDir = process.cwd();
  let outDir = 'dist';

  function buildDevInventory(): OfflineReleaseInventoryPayload {
    const publicFiles = [
      { diskPath: join(rootDir, 'public', 'manifest.webmanifest'), urlPath: '/manifest.webmanifest' },
      { diskPath: join(rootDir, 'public', 'icons', 'icon-192.svg'), urlPath: '/icons/icon-192.svg' },
      { diskPath: join(rootDir, 'public', 'icons', 'icon-512.svg'), urlPath: '/icons/icon-512.svg' },
    ];
    const assets: ReleaseInventoryAsset[] = publicFiles.map((f) => {
      const buf = readFileSync(f.diskPath);
      return {
        path: f.urlPath,
        sha256: sha256Hex(buf),
        sizeBytes: buf.byteLength,
      };
    });
    const combinedHash = sha256Hex(
      Buffer.from(assets.map((a) => `${a.path}:${a.sha256}`).join('|'), 'utf8'),
    ).slice(0, 12);
    const releaseId = `v1.0.0-dev-${combinedHash}`;
    return {
      releaseId,
      generatedAt: '2026-10-27T00:00:00.000Z',
      cacheName: `trade-journal-v3-release-${releaseId}`,
      assets,
    };
  }

  return {
    name: 'trade-journal-pwa-inventory',
    configResolved(config) {
      rootDir = config.root;
      outDir = config.build.outDir;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/offline-release-inventory.json') {
          const inv = buildDevInventory();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(inv, null, 2));
          return;
        }
        if (url === '/sw.js') {
          const inv = buildDevInventory();
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Service-Worker-Allowed', '/');
          res.end(buildServiceWorkerSource(inv));
          return;
        }
        next();
      });
    },
    writeBundle() {
      const absOut = join(rootDir, outDir);
      const files = walkFiles(absOut).filter((f) => {
        const rel = relative(absOut, f).split(sep).join(posix.sep);
        return rel !== 'sw.js' && rel !== 'offline-release-inventory.json';
      });

      const assets: ReleaseInventoryAsset[] = files
        .map((f) => {
          const rel = '/' + relative(absOut, f).split(sep).join(posix.sep);
          const buf = readFileSync(f);
          return {
            path: rel,
            sha256: sha256Hex(buf),
            sizeBytes: buf.byteLength,
          };
        })
        .sort((a, b) => a.path.localeCompare(b.path));

      const releaseDigest = sha256Hex(
        Buffer.from(assets.map((a) => `${a.path}:${a.sha256}`).join('|'), 'utf8'),
      ).slice(0, 12);
      const releaseId = `v1.0.0-${releaseDigest}`;
      const inventory: OfflineReleaseInventoryPayload = {
        releaseId,
        generatedAt: '2026-10-27T00:00:00.000Z',
        cacheName: `trade-journal-v3-release-${releaseId}`,
        assets,
      };

      writeFileSync(
        join(absOut, 'offline-release-inventory.json'),
        JSON.stringify(inventory, null, 2),
        'utf8',
      );
      writeFileSync(join(absOut, 'sw.js'), buildServiceWorkerSource(inventory), 'utf8');
    },
  };
}
