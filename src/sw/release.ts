import { assetDigest, releaseIdentityOf, type OfflineReleaseInventory } from '../delivery/inventory.ts';

// Everything the handlers need from the service-worker global scope, injected for testing.
export interface ServiceWorkerEnv {
  readonly releaseId: string;
  readonly origin: string;
  readonly caches: CacheStorage;
  readonly fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  readonly skipWaiting: () => Promise<void>;
  readonly claimClients: () => Promise<void>;
}

export const RELEASE_CACHE_PREFIX = 'tj-release-';
export const INVENTORY_PATH = '/inventory.json';

export function releaseCacheName(releaseId: string): string {
  return `${RELEASE_CACHE_PREFIX}${releaseId}`;
}

// Fetches the whole release, then writes its cache only once every file has been received.
export async function stageRelease(env: ServiceWorkerEnv): Promise<void> {
  const url = (path: string) => new URL(path, env.origin).href;
  const inventoryResponse = await env.fetch(url(INVENTORY_PATH), { cache: 'reload' });
  const inventoryBytes = new Uint8Array(await inventoryResponse.arrayBuffer());
  const inventory = JSON.parse(new TextDecoder().decode(inventoryBytes)) as OfflineReleaseInventory;
  if ((await releaseIdentityOf(inventory.assets)) !== env.releaseId || inventory.releaseId !== env.releaseId) {
    throw new Error('Inventory does not match this worker\'s release identity');
  }
  // Each file keeps the headers it was served with; a module script needs its Content-Type.
  const files = new Map<string, { bytes: Uint8Array; headers: Headers }>([[INVENTORY_PATH, { bytes: inventoryBytes, headers: inventoryResponse.headers }]]);
  for (const asset of inventory.assets) {
    const response = await env.fetch(url(asset.path), { cache: 'reload' });
    if (!response.ok) throw new Error(`Release asset missing: ${asset.path} (${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if ((await assetDigest(bytes, env.releaseId)) !== asset.digest) {
      throw new Error(`Release asset digest differs: ${asset.path}`);
    }
    files.set(asset.path, { bytes, headers: response.headers });
  }
  const cache = await env.caches.open(releaseCacheName(env.releaseId));
  for (const [path, { bytes, headers }] of files) {
    await cache.put(url(path), new Response(bytes.slice(), { headers }));
  }
}

export interface ServedRequest {
  readonly url: string;
  readonly mode: RequestMode;
  readonly method: string;
}

// Navigations get the release's own index document and inventory assets come from the
// release's own cache, so the app starts offline and never mixes two releases' files.
export async function serveRequest(env: ServiceWorkerEnv, request: ServedRequest): Promise<Response> {
  const name = releaseCacheName(env.releaseId);
  // `open` would create an empty release cache; serving never creates cache state.
  if (await env.caches.has(name)) {
    const cache = await env.caches.open(name);
    const target = request.mode === 'navigate' ? new URL('/index.html', env.origin).href : request.url;
    const cached = await cache.match(target);
    if (cached) return cached;
  }
  return env.fetch(request.url);
}

// Install only stages and verifies. It never calls skipWaiting, so a new release waits while an
// earlier one is active; it takes control only after an ApplyUpdate message.
export function handleInstall(env: ServiceWorkerEnv): Promise<void> {
  return stageRelease(env);
}

export async function handleActivate(env: ServiceWorkerEnv): Promise<void> {
  const own = releaseCacheName(env.releaseId);
  const earlier = (await env.caches.keys()).filter((name) => name.startsWith(RELEASE_CACHE_PREFIX) && name !== own);
  // The very first release takes control of the page that installed it; an update instead
  // inherits its clients from the release it replaces.
  if (earlier.length === 0) await env.claimClients();
  for (const name of earlier) await env.caches.delete(name);
}

export type WorkerMessage = { readonly type: 'ApplyUpdate' } | { readonly type: 'ReleaseIdentity' } | { readonly type: string };

export async function handleMessage(
  env: ServiceWorkerEnv,
  message: WorkerMessage,
  reply: (answer: unknown) => void,
): Promise<void> {
  // Sent by the page only once no form is unsaved (D1 A5).
  if (message.type === 'ApplyUpdate') await env.skipWaiting();
  // The page's service-worker control check compares this with its own release identity.
  if (message.type === 'ReleaseIdentity') reply({ type: 'ReleaseIdentity', releaseId: env.releaseId });
}
