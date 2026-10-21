import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { releaseId } from './release.ts';
async function files(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]));
  return nested.flat().sort();
}
const output = process.env.D1_BUILD_DIR ?? 'dist';
const paths = (await files(output)).filter(path => !path.endsWith('/offline-inventory.json'));
const assets = await Promise.all(paths.map(async path => {
  const bytes = await readFile(path);
  return { url: `/${path.slice(output.length + 1)}`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}));
const worker = await readFile(join(output, 'sw.js'), 'utf8');
const literal = worker.match(/\[(?:\{[^{}]*"url"[^{}]*\},?)+\]/)?.[0];
if (!literal) throw new Error('Missing embedded precache manifest');
const entries = JSON.parse(literal);
const expected = new Map();
for (const entry of entries) expected.set(`/${entry.url.replace(/^\//, '')}`, entry.revision?.length === 64 ? entry.revision : expected.get(`/${entry.url.replace(/^\//, '')}`) ?? null);
for (const asset of assets.filter(asset => asset.url !== '/sw.js')) {
  if (!expected.has(asset.url) || expected.get(asset.url) !== asset.sha256) throw new Error(`Precache omission or incorrect SHA-256: ${asset.url}`);
}
if (expected.size !== assets.length - 1) throw new Error('Precache inventory has unexpected assets');
if (!assets.some(asset => asset.url === '/sw.js') || !assets.some(asset => asset.url === '/index.html')) throw new Error('Incomplete release');
await writeFile(join(output, 'offline-inventory.json'), JSON.stringify({ version: 1, releaseId, assets }));
console.log(`Inventoried ${assets.length} emitted assets with SHA-256 digests`);
