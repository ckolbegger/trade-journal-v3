// npm run build:releases: the releases the update cases and critic flows serve.
// D1 T1.26: v1 and v2 differ only by their build label; v2-corrupt is v2 with one asset altered
// after the build and its inventory left unchanged.
// D2 T2.17: d1 is the previous release, built from the tag claude-opus-5.5-d1 (A34); d2 is the
// current source. Both carry a build label like v1 and v2.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import type { OfflineReleaseInventory } from '../src/delivery/inventory.ts';
import { INVENTORY_FILE } from './release.ts';

export const RELEASES_DIR = path.resolve('dist-releases');
export const RELEASES = ['v1', 'v2', 'v2-corrupt', 'd1', 'd2'] as const;
export type ReleaseName = (typeof RELEASES)[number];

// A34: the previous release's tag. Git tags are shared by every worktree, so the tag is
// implementation-specific.
export const PREVIOUS_RELEASE_TAG = 'claude-opus-5.5-d1';

// The asset v2-corrupt alters: the stylesheet, so the altered release still parses as a page.
export async function corruptedAsset(dir: string): Promise<string> {
  const inventory = JSON.parse(await readFile(path.join(dir, INVENTORY_FILE), 'utf8')) as OfflineReleaseInventory;
  const asset = inventory.assets.find((a) => a.path.endsWith('.css'));
  if (!asset) throw new Error(`No stylesheet in ${dir}`);
  return asset.path;
}

async function buildLabelled(label: 'v1' | 'v2' | 'd2') {
  process.env.TJ_BUILD_LABEL = label;
  await build({ logLevel: 'warn', build: { outDir: path.join(RELEASES_DIR, label), emptyOutDir: true } });
}

// Exports the tag with git archive into a scratch folder under the OS temp directory (never a
// checkout or worktree), installs its own locked dependencies, and builds it with its own
// toolchain. The folder is keyed by the tag's commit and reused once a build has completed there.
async function buildPreviousRelease(): Promise<string> {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const commit = git('rev-parse', `${PREVIOUS_RELEASE_TAG}^{commit}`);
  const scratch = path.join(tmpdir(), `tj-release-d1-${commit.slice(0, 12)}`);
  const done = path.join(scratch, '.tj-release-built');
  const cached = await readFile(done, 'utf8').catch(() => '');
  if (cached.trim() === commit) {
    console.log(`build:releases: d1 reused from ${scratch} (${PREVIOUS_RELEASE_TAG} at ${commit})`);
    return path.join(scratch, 'dist');
  }
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });
  const archive = `${scratch}.tar`;
  git('archive', '--format=tar', `--output=${archive}`, PREVIOUS_RELEASE_TAG);
  execFileSync('tar', ['-xf', archive, '-C', scratch]);
  await rm(archive);
  // Vite's in-process builds above set NODE_ENV=production, which would make npm ci skip the
  // dev dependencies the build needs, so the child runs without it.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_ENV'));
  const run = (args: string[], extra: NodeJS.ProcessEnv = {}) =>
    execFileSync('npm', args, { cwd: scratch, env: { ...env, ...extra }, stdio: ['ignore', 'ignore', 'inherit'] });
  run(['ci', '--no-audit', '--no-fund']);
  // D1's vite config requires DEV_PORT (normally from .env.local, which is not committed); the
  // build output does not depend on it.
  run(['run', 'build'], { DEV_PORT: '5175', TJ_BUILD_LABEL: 'd1' });
  await stat(path.join(scratch, 'dist', INVENTORY_FILE));
  await writeFile(done, `${commit}\n`);
  console.log(`build:releases: d1 built in ${scratch} (${PREVIOUS_RELEASE_TAG} at ${commit})`);
  return path.join(scratch, 'dist');
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
  await cp(await buildPreviousRelease(), path.join(RELEASES_DIR, 'd1'), { recursive: true });
  await buildLabelled('d2');
  console.log(`build:releases OK: ${RELEASES.join(', ')} in ${RELEASES_DIR}; v2-corrupt alters ${altered}`);
}
