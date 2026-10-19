// npm run build:releases: the synthetic releases the update cases and critic C1.8 serve (D1 T1.26).
// v1 and v2 differ only by their build label; v2-corrupt is v2 with one asset altered after the
// build and its inventory left unchanged.
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';
import type { OfflineReleaseInventory } from '../src/delivery/inventory.ts';
import { INVENTORY_FILE } from './release.ts';

export const RELEASES_DIR = path.resolve('dist-releases');
export const RELEASES = ['v1', 'v2', 'v2-corrupt'] as const;
export type ReleaseName = (typeof RELEASES)[number];

// The asset v2-corrupt alters: the stylesheet, so the altered release still parses as a page.
export async function corruptedAsset(dir: string): Promise<string> {
  const inventory = JSON.parse(await readFile(path.join(dir, INVENTORY_FILE), 'utf8')) as OfflineReleaseInventory;
  const asset = inventory.assets.find((a) => a.path.endsWith('.css'));
  if (!asset) throw new Error(`No stylesheet in ${dir}`);
  return asset.path;
}

async function buildLabelled(label: 'v1' | 'v2') {
  process.env.TJ_BUILD_LABEL = label;
  await build({ logLevel: 'warn', build: { outDir: path.join(RELEASES_DIR, label), emptyOutDir: true } });
}

if (import.meta.main) {
  await rm(RELEASES_DIR, { recursive: true, force: true });
  await buildLabelled('v1');
  await buildLabelled('v2');
  const corrupt = path.join(RELEASES_DIR, 'v2-corrupt');
  await cp(path.join(RELEASES_DIR, 'v2'), corrupt, { recursive: true });
  const altered = await corruptedAsset(corrupt);
  const file = path.join(corrupt, altered.slice(1));
  const bytes = new Uint8Array(await readFile(file));
  // Flip one bit of the last byte: same size, different digest.
  bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
  await writeFile(file, bytes);
  console.log(`build:releases OK: ${RELEASES.join(', ')} in ${RELEASES_DIR}; v2-corrupt alters ${altered}`);
}
