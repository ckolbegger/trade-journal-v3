import http from 'node:http';

// A page that registers a service worker, and a worker that caches the page so it can
// reopen offline. Served as strings so the probe needs no build step.
const page = `<!doctype html>
<title>Engine capability probe</title>
<script>navigator.serviceWorker.register('/sw.js');</script>`;

const worker = `const CACHE = 'probe-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});`;

export interface ProbeServer {
  close(): Promise<void>;
}

export function startProbeServer(port: number): Promise<ProbeServer> {
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-cache' });
      res.end(page);
    } else if (req.url === '/sw.js') {
      res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-cache' });
      res.end(worker);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, 'localhost', () => {
      resolve({
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}
