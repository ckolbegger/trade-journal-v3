// npm run verify:releases: v1, v2, d1 and d2 each pass verify:release with distinct identities,
// v2-corrupt fails on exactly the altered asset (D1 T1.26), and d1 is a schema 1 release while
// d2 is a schema 2 release (D2 T2.17).
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { OfflineReleaseInventory } from '../src/delivery/inventory.ts';
import { corruptedAsset, RELEASES_DIR } from './build-releases.ts';
import { INVENTORY_FILE } from './release.ts';
import { verifyRelease } from './verify-release.ts';

const problems: string[] = [];
const identityOf = async (name: string) =>
  (JSON.parse(await readFile(path.join(RELEASES_DIR, name, INVENTORY_FILE), 'utf8')) as OfflineReleaseInventory).releaseId;

// The schema version a release reports: the version its bundle writes to the Workspace's schema
// meta record (`{key: 'schema', schemaVersion: N}`). Exactly one such record must appear.
async function schemaVersionOf(name: string): Promise<number | string> {
  const assets = path.join(RELEASES_DIR, name, 'assets');
  const found = new Set<number>();
  for (const file of (await readdir(assets)).filter((f) => f.endsWith('.js'))) {
    const text = await readFile(path.join(assets, file), 'utf8');
    for (const m of text.matchAll(/key:`schema`,schemaVersion:(\d+)/g)) found.add(Number(m[1]));
  }
  return found.size === 1 ? [...found][0]! : `no single schema record (found ${JSON.stringify([...found])})`;
}

const verified = ['v1', 'v2', 'd1', 'd2'];
for (const name of verified) {
  for (const p of await verifyRelease(path.join(RELEASES_DIR, name))) problems.push(`${name}: ${p}`);
}
const ids = Object.fromEntries(await Promise.all(verified.map(async (n) => [n, await identityOf(n)] as const)));
if (new Set(Object.values(ids)).size !== verified.length) problems.push(`releases share an identity: ${JSON.stringify(ids)}`);

const schemas = { d1: await schemaVersionOf('d1'), d2: await schemaVersionOf('d2') };
if (schemas.d1 !== 1) problems.push(`d1: reports schema ${schemas.d1}, expected 1`);
if (schemas.d2 !== 2) problems.push(`d2: reports schema ${schemas.d2}, expected 2`);

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
console.log(
  `verify:releases OK: v1 ${ids.v1}, v2 ${ids.v2}, v2-corrupt fails only on ${altered}, ` +
    `d1 ${ids.d1} schema ${schemas.d1}, d2 ${ids.d2} schema ${schemas.d2}`,
);
