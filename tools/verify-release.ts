// npm run verify:release [dir]: checks a built release folder (default dist/) against D1 T1.3.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assetDigest,
  RELEASE_ID_TOKEN,
  releaseIdentityOf,
  type OfflineReleaseInventory,
} from '../src/delivery/inventory.ts';
import { INVENTORY_FILE, isInventoried, listFiles, SERVICE_WORKER_FILE } from './release.ts';

export async function verifyRelease(dir: string): Promise<string[]> {
  const problems: string[] = [];
  const files = await listFiles(dir);

  const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.webmanifest'), 'utf8')) as {
    id?: string;
    name?: string;
    short_name?: string;
    start_url?: string;
    scope?: string;
    display?: string;
    icons?: { src: string; sizes: string }[];
  };
  for (const field of ['id', 'name', 'short_name', 'start_url', 'scope'] as const) {
    if (!manifest[field]) problems.push(`manifest: missing ${field}`);
  }
  if (manifest.display !== 'browser') problems.push(`manifest: display is ${manifest.display}, not "browser"`);
  for (const size of ['192x192', '512x512']) {
    const icon = manifest.icons?.find((i) => i.sizes === size);
    if (!icon) problems.push(`manifest: no ${size} icon`);
    else if (!files.includes(icon.src.replace(/^\//, ''))) problems.push(`manifest: icon ${icon.src} not built`);
  }

  const inventory = JSON.parse(await readFile(path.join(dir, INVENTORY_FILE), 'utf8')) as OfflineReleaseInventory;
  const listed = new Set(inventory.assets.map((a) => a.path));
  const expected = files.filter(isInventoried).map((f) => `/${f}`);
  for (const p of expected) if (!listed.has(p)) problems.push(`inventory: ${p} not listed`);
  for (const p of listed) if (!expected.includes(p)) problems.push(`inventory: ${p} listed but not built`);

  for (const asset of inventory.assets) {
    const relative = asset.path.slice(1);
    if (!files.includes(relative)) continue;
    const bytes = new Uint8Array(await readFile(path.join(dir, relative)));
    if ((await assetDigest(bytes, inventory.releaseId)) !== asset.digest) problems.push(`digest mismatch: ${asset.path}`);
    if (bytes.length !== asset.size) problems.push(`size mismatch: ${asset.path}`);
  }

  if ((await releaseIdentityOf(inventory.assets)) !== inventory.releaseId) {
    problems.push('release identity is not the hash of the sorted digest list');
  }

  const sw = await readFile(path.join(dir, SERVICE_WORKER_FILE), 'utf8');
  if (!sw.includes(inventory.releaseId)) problems.push('sw.js does not embed the release identity');
  const html = await readFile(path.join(dir, 'index.html'), 'utf8');
  const entry = /<script type="module" crossorigin src="\/([^"]+)"/.exec(html)?.[1];
  if (!entry) problems.push('index.html has no module entry script');
  else if (!(await readFile(path.join(dir, entry), 'utf8')).includes(inventory.releaseId)) {
    problems.push(`app bundle ${entry} does not embed the release identity`);
  }
  for (const f of files) {
    if ((await readFile(path.join(dir, f), 'latin1')).includes(RELEASE_ID_TOKEN)) {
      problems.push(`unreplaced release-identity token in ${f}`);
    }
  }
  return problems;
}

if (import.meta.main) {
  const dir = path.resolve(process.argv[2] ?? 'dist');
  const problems = await verifyRelease(dir);
  if (problems.length > 0) {
    for (const p of problems) console.error(`FAIL ${p}`);
    process.exit(1);
  }
  const inventory = JSON.parse(await readFile(path.join(dir, INVENTORY_FILE), 'utf8')) as OfflineReleaseInventory;
  console.log(`OK ${dir}: release ${inventory.releaseId}, ${inventory.assets.length} assets`);
}
