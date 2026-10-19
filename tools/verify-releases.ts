// npm run verify:releases: v1 and v2 each pass verify:release with distinct identities, and
// v2-corrupt fails on exactly the altered asset (D1 T1.26).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { OfflineReleaseInventory } from '../src/delivery/inventory.ts';
import { corruptedAsset, RELEASES_DIR } from './build-releases.ts';
import { INVENTORY_FILE } from './release.ts';
import { verifyRelease } from './verify-release.ts';

const problems: string[] = [];
const identityOf = async (name: string) =>
  (JSON.parse(await readFile(path.join(RELEASES_DIR, name, INVENTORY_FILE), 'utf8')) as OfflineReleaseInventory).releaseId;

for (const name of ['v1', 'v2']) {
  for (const p of await verifyRelease(path.join(RELEASES_DIR, name))) problems.push(`${name}: ${p}`);
}
const [v1, v2] = [await identityOf('v1'), await identityOf('v2')];
if (v1 === v2) problems.push('v1 and v2 share a release identity');

const corrupt = path.join(RELEASES_DIR, 'v2-corrupt');
const altered = await corruptedAsset(corrupt);
const found = await verifyRelease(corrupt);
const expected = [`digest mismatch: ${altered}`];
if (JSON.stringify(found) !== JSON.stringify(expected)) {
  problems.push(`v2-corrupt: expected exactly ${JSON.stringify(expected)}, got ${JSON.stringify(found)}`);
}

if (problems.length > 0) {
  for (const p of problems) console.error(`FAIL ${p}`);
  process.exit(1);
}
console.log(`verify:releases OK: v1 ${v1}, v2 ${v2}, v2-corrupt fails only on ${altered}`);
