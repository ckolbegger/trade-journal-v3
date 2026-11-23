import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

export interface ReleaseInventoryAsset {
  url: string;
  sha256: string;
  size: number;
}

export interface ReleaseInventory {
  schemaVersion: 1;
  releaseId: string;
  assets: ReleaseInventoryAsset[];
}

function collectFiles(currentDir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(currentDir)) {
    const fullPath = join(currentDir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (stat.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

export function buildReleaseInventory(distDir: string): ReleaseInventory {
  const files = collectFiles(distDir)
    .map((absPath) => ({
      absPath,
      relPath: relative(distDir, absPath).split('\\').join('/'),
    }))
    .filter(({ relPath }) => relPath !== 'sw.js' && relPath !== 'release-inventory.json')
    .sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));

  const assets: ReleaseInventoryAsset[] = files.map(({ absPath, relPath }) => {
    const bytes = readFileSync(absPath);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    return {
      url: `/${relPath}`,
      sha256,
      size: bytes.byteLength,
    };
  });

  const releaseHash = createHash('sha256');
  for (const asset of assets) {
    releaseHash.update(`${asset.url}:${asset.sha256}\n`);
  }

  // Include sw.js digest in releaseId so SW-only changes produce a new releaseId
  const swPath = join(distDir, 'sw.js');
  if (existsSync(swPath)) {
    const swDigest = createHash('sha256').update(readFileSync(swPath)).digest('hex');
    releaseHash.update(`/sw.js:${swDigest}\n`);
  }

  return {
    schemaVersion: 1,
    releaseId: `rel-${releaseHash.digest('hex').slice(0, 16)}`,
    assets,
  };
}

export function emitReleaseInventoryAndStampSw(outDir: string): ReleaseInventory {
  const inventory = buildReleaseInventory(outDir);
  writeFileSync(
    join(outDir, 'release-inventory.json'),
    `${JSON.stringify(inventory, null, 2)}\n`,
    'utf8',
  );

  // Stamp releaseId into sw.js so every asset or SW change produces byte-different sw.js
  // and triggers the browser's native Service Worker update lifecycle cleanly.
  const swPath = join(outDir, 'sw.js');
  if (existsSync(swPath)) {
    const swSource = readFileSync(swPath, 'utf8').replace(/\n?\/\/ releaseId: [^\n]+\n?$/, '');
    writeFileSync(swPath, `${swSource}\n// releaseId: ${inventory.releaseId}\n`, 'utf8');
  }

  return inventory;
}

export function releaseInventoryPlugin(): Plugin {
  let resolvedOutDir = 'dist';
  return {
    name: 'trade-journal-release-inventory',
    apply: 'build',
    configResolved(config) {
      resolvedOutDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      emitReleaseInventoryAndStampSw(resolvedOutDir);
    },
  };
}
