// A deterministic static server whose served release can be switched between test runs by writing
// the active release letter to artifacts/sw-test/active.txt. It exists so the update, staging-failure
// and two-release proofs can deploy a second release to the same origin.
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.DEV_PORT ?? 5177);
const pointer = join(root, "artifacts/sw-test/active.txt");
const releases = {
  a: join(root, "dist"),
  b: join(root, "artifacts/sw-test/release-b"),
  c: join(root, "artifacts/sw-test/release-c"),
};

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

createServer((request, response) => {
  const active = existsSync(pointer) ? readFileSync(pointer, "utf8").trim() : "a";
  const directory = releases[active] ?? releases.a;
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = normalize(join(directory, relative));
  if (!file.startsWith(directory) || !existsSync(file)) {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
    return;
  }
  response.writeHead(200, {
    "content-type": types[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  response.end(readFileSync(file));
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`sw-test-server: http://127.0.0.1:${port}\n`);
});
