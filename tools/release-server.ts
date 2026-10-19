// The release harness server (D1 A15): serves one built release folder at a time on one origin,
// with Cloudflare-Pages-like caching headers, so switching release looks to the browser like a
// deploy. Used only by tests and the critic.
// npm run serve:releases: press 1 (v1), 2 (v2), 3 (v2-corrupt) to switch; q to quit.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { RELEASES, RELEASES_DIR, type ReleaseName } from './build-releases.ts';

export const HARNESS_PORT = 5175;

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

// Cloudflare Pages revalidates everything by default; A15 makes sw.js and inventory.json no-cache
// and the content-hashed assets immutable.
function cacheControl(pathname: string): string {
  if (pathname === '/sw.js' || pathname === '/inventory.json') return 'no-cache';
  if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  return 'public, max-age=0, must-revalidate';
}

async function fileAt(dir: string, pathname: string): Promise<string | undefined> {
  const file = path.join(dir, path.normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, ''));
  if (!file.startsWith(dir + path.sep)) return undefined;
  const info = await stat(file).catch(() => undefined);
  return info?.isFile() ? file : undefined;
}

export interface ReleaseServer {
  readonly url: string;
  current(): ReleaseName;
  use(release: ReleaseName): void;
  close(): Promise<void>;
}

export async function startReleaseServer(
  options: { release?: ReleaseName; port?: number; root?: string } = {},
): Promise<ReleaseServer> {
  const root = options.root ?? RELEASES_DIR;
  let release: ReleaseName = options.release ?? 'v1';
  const server = createServer((request, response) => {
    void (async () => {
      const dir = path.join(root, release);
      const pathname = new URL(request.url ?? '/', 'http://harness').pathname;
      // Single-page fallback: a path with no file is served the release's index document.
      const file = (await fileAt(dir, pathname === '/' ? '/index.html' : pathname)) ?? path.join(dir, 'index.html');
      const served = file === path.join(dir, 'index.html') ? '/index.html' : pathname;
      const body = await readFile(file);
      const etag = `"${createHash('sha256').update(body).digest('hex').slice(0, 32)}"`;
      const headers = {
        'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': cacheControl(served),
        ETag: etag,
        'X-Content-Type-Options': 'nosniff',
      };
      if (request.headers['if-none-match'] === etag) {
        response.writeHead(304, headers).end();
        return;
      }
      response.writeHead(200, headers).end(request.method === 'HEAD' ? undefined : body);
    })().catch(() => response.writeHead(500).end());
  });
  const port = options.port ?? HARNESS_PORT;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    url: `http://localhost:${port}`,
    current: () => release,
    use: (next) => {
      release = next;
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

if (import.meta.main) {
  const harness = await startReleaseServer();
  const show = () => console.log(`Serving ${harness.current()} at ${harness.url}  (1 v1, 2 v2, 3 v2-corrupt, q quit)`);
  show();
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.on('data', (key) => {
    const pressed = key.toString();
    const index = Number(pressed) - 1;
    const chosen = RELEASES[index];
    if (chosen) {
      harness.use(chosen);
      show();
    } else if (pressed === 'q' || pressed === '\u0003') {
      void harness.close().then(() => process.exit(0));
    }
  });
}
