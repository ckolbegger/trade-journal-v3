import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assetDigest,
  releaseIdentityOf,
  replaceBytes,
  type InventoryAsset,
  type OfflineReleaseInventory,
} from '../src/delivery/inventory.ts';
import { RELEASE_ID_PLACEHOLDER } from '../src/delivery/release-identity.ts';

export const SERVICE_WORKER_FILE = 'sw.js';
export const INVENTORY_FILE = 'inventory.json';

export async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

// Files covered by the inventory: everything except the service worker and the inventory itself.
export function isInventoried(relative: string): boolean {
  return relative !== SERVICE_WORKER_FILE && relative !== INVENTORY_FILE;
}

// Computes the inventory from the placeholder-bearing build output (masking the placeholder
// exactly as the identity is masked later), then substitutes the release identity for the
// placeholder in every file, including the service worker.
export async function finalizeRelease(dir: string): Promise<OfflineReleaseInventory> {
  const files = await listFiles(dir);
  const digests = new Map<string, string>();
  for (const relative of files.filter(isInventoried)) {
    const bytes = new Uint8Array(await readFile(path.join(dir, relative)));
    digests.set(relative, await assetDigest(bytes, RELEASE_ID_PLACEHOLDER));
  }
  const releaseId = await releaseIdentityOf(
    [...digests].map(([relative, digest]) => ({ path: `/${relative}`, digest, size: 0 })),
  );
  const assets: InventoryAsset[] = [];
  for (const relative of files) {
    const file = path.join(dir, relative);
    const bytes = new Uint8Array(await readFile(file));
    const replaced = replaceBytes(bytes, RELEASE_ID_PLACEHOLDER, releaseId);
    if (replaced !== bytes) await writeFile(file, replaced);
    const digest = digests.get(relative);
    if (digest) assets.push({ path: `/${relative}`, digest, size: replaced.length });
  }
  const inventory: OfflineReleaseInventory = { releaseId, assets };
  await writeFile(path.join(dir, INVENTORY_FILE), `${JSON.stringify(inventory, null, 2)}\n`);
  return inventory;
}
