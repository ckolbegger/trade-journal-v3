// Test doubles for the service-worker handlers: an in-memory CacheStorage and a fetch that
// serves a fixed set of release files. The real browser behaviour is proven in the browser suite.
import { RELEASE_ID_PLACEHOLDER } from '../delivery/release-identity.ts';
import {
  assetDigest,
  releaseIdentityOf,
  replaceBytes,
  type InventoryAsset,
  type OfflineReleaseInventory,
} from '../delivery/inventory.ts';

export const ORIGIN = 'http://localhost:5175';

export class MemoryCache {
  readonly entries = new Map<string, Response>();

  constructor(private readonly log: string[], private readonly name: string) {}

  match(request: RequestInfo | URL): Promise<Response | undefined> {
    const response = this.entries.get(urlOf(request));
    return Promise.resolve(response?.clone());
  }

  put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.log.push(`put ${this.name} ${new URL(urlOf(request)).pathname}`);
    this.entries.set(urlOf(request), response);
    return Promise.resolve();
  }

  keys(): Promise<Request[]> {
    return Promise.resolve([...this.entries.keys()].map((url) => new Request(url)));
  }
}

export class MemoryCacheStorage {
  readonly caches = new Map<string, MemoryCache>();

  constructor(private readonly log: string[] = []) {}

  open(name: string): Promise<MemoryCache> {
    this.log.push(`open ${name}`);
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new MemoryCache(this.log, name);
      this.caches.set(name, cache);
    }
    return Promise.resolve(cache);
  }

  has(name: string): Promise<boolean> {
    return Promise.resolve(this.caches.has(name));
  }

  delete(name: string): Promise<boolean> {
    this.log.push(`delete ${name}`);
    return Promise.resolve(this.caches.delete(name));
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.caches.keys()]);
  }
}

function urlOf(request: RequestInfo | URL): string {
  if (typeof request === 'string') return new URL(request, ORIGIN).href;
  if (request instanceof URL) return request.href;
  return request.url;
}

export interface FakeRelease {
  readonly releaseId: string;
  readonly inventory: OfflineReleaseInventory;
  readonly files: Map<string, Uint8Array>;
}

const encoder = new TextEncoder();

// Builds a release the way the build does: digests over placeholder-bearing bytes, then substitution.
export async function fakeRelease(label: string): Promise<FakeRelease> {
  const sources: Record<string, string> = {
    '/index.html': `<!doctype html><title>${label}</title><script src="/assets/app.js"></script>`,
    '/assets/app.js': `const release = "${RELEASE_ID_PLACEHOLDER}"; // ${label}`,
    '/manifest.webmanifest': '{"name":"Trade Journal"}',
  };
  const assets: InventoryAsset[] = [];
  for (const [path, text] of Object.entries(sources)) {
    const bytes = encoder.encode(text);
    assets.push({ path, digest: await assetDigest(bytes, RELEASE_ID_PLACEHOLDER), size: 0 });
  }
  const releaseId = await releaseIdentityOf(assets);
  const files = new Map<string, Uint8Array>();
  for (const [path, text] of Object.entries(sources)) {
    files.set(path, replaceBytes(encoder.encode(text), RELEASE_ID_PLACEHOLDER, releaseId));
  }
  const inventory: OfflineReleaseInventory = {
    releaseId,
    assets: assets.map((a) => ({ ...a, size: files.get(a.path)?.length ?? 0 })),
  };
  files.set('/inventory.json', encoder.encode(JSON.stringify(inventory)));
  return { releaseId, inventory, files };
}

export function fakeFetch(release: FakeRelease, log: string[]) {
  const calls: { url: string; cache: RequestCache | undefined }[] = [];
  const fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    calls.push({ url, cache: init?.cache });
    log.push(`fetch ${new URL(url).pathname}`);
    const body = release.files.get(new URL(url).pathname);
    return Promise.resolve(body ? new Response(body.slice()) : new Response('not found', { status: 404 }));
  };
  return { fetch, calls };
}
