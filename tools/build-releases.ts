// npm run build:releases: the releases the update cases and critic flows serve.
// D1 T1.26: v1 and v2 differ only by their build label; v2-corrupt is v2 with one asset altered
// after the build and its inventory left unchanged.
// D2 T2.17: d1 is built from the tag claude-opus-5.5-d1 (A34). D4 T4.27: d2 is likewise built from
// the tag claude-opus-5.5-d2 (A50). D5 T5.18: d4 is built from the tag claude-opus-5.5-d4 (A72) and
// d5 is the current source; d5 carries a build label like v1.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import type { OfflineReleaseInventory } from '../src/delivery/inventory.ts';
import { INVENTORY_FILE } from './release.ts';

export const RELEASES_DIR = path.resolve('dist-releases');
export const RELEASES = ['v1', 'v2', 'v2-corrupt', 'd1', 'd2', 'd4', 'd5'] as const;
export type ReleaseName = (typeof RELEASES)[number];

// A34, A50: the tags the previous releases are built from. Git tags are shared by every worktree,
// so the tags are implementation-specific. D1_RELEASE_TAG builds d1; PREVIOUS_RELEASE_TAG, the
// release immediately before the current source, builds d2 (A50) and d4 (D5 A72).
export const D1_RELEASE_TAG = 'claude-opus-5.5-d1';
export const D2_RELEASE_TAG = 'claude-opus-5.5-d2';
export const PREVIOUS_RELEASE_TAG = 'claude-opus-5.5-d4';
const TAGGED_RELEASES = { d1: D1_RELEASE_TAG, d2: D2_RELEASE_TAG, d4: PREVIOUS_RELEASE_TAG } as const;

// The asset v2-corrupt alters: the stylesheet, so the altered release still parses as a page.
export async function corruptedAsset(dir: string): Promise<string> {
  const inventory = JSON.parse(await readFile(path.join(dir, INVENTORY_FILE), 'utf8')) as OfflineReleaseInventory;
  const asset = inventory.assets.find((a) => a.path.endsWith('.css'));
  if (!asset) throw new Error(`No stylesheet in ${dir}`);
  return asset.path;
}

async function buildLabelled(label: 'v1' | 'v2' | 'd5') {
  process.env.TJ_BUILD_LABEL = label;
  await build({ logLevel: 'warn', build: { outDir: path.join(RELEASES_DIR, label), emptyOutDir: true } });
}

// Exports the tag with git archive into a scratch folder under the OS temp directory (never a
// checkout or worktree), installs its own locked dependencies, and builds it with its own
// toolchain. The folder is keyed by the tag's commit and reused once a build has completed there.
async function buildTaggedRelease(name: keyof typeof TAGGED_RELEASES): Promise<string> {
  const tag = TAGGED_RELEASES[name];
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const commit = git('rev-parse', `${tag}^{commit}`);
  const scratch = path.join(tmpdir(), `tj-release-${name}-${commit.slice(0, 12)}`);
  const done = path.join(scratch, '.tj-release-built');
  const cached = await readFile(done, 'utf8').catch(() => '');
  if (cached.trim() === commit) {
    console.log(`build:releases: ${name} reused from ${scratch} (${tag} at ${commit})`);
    return path.join(scratch, 'dist');
  }
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });
  const archive = `${scratch}.tar`;
  git('archive', '--format=tar', `--output=${archive}`, tag);
  execFileSync('tar', ['-xf', archive, '-C', scratch]);
  await rm(archive);
  // Vite's in-process builds above set NODE_ENV=production, which would make npm ci skip the
  // dev dependencies the build needs, so the child runs without it.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_ENV'));
  const run = (args: string[], extra: NodeJS.ProcessEnv = {}) =>
    execFileSync('npm', args, { cwd: scratch, env: { ...env, ...extra }, stdio: ['ignore', 'ignore', 'inherit'] });
  run(['ci', '--no-audit', '--no-fund']);
  // A tagged release's vite config requires DEV_PORT (normally from .env.local, which is not committed); the
  // build output does not depend on it.
  run(['run', 'build'], { DEV_PORT: '5175', TJ_BUILD_LABEL: name });
  await stat(path.join(scratch, 'dist', INVENTORY_FILE));
  await writeFile(done, `${commit}\n`);
  console.log(`build:releases: ${name} built in ${scratch} (${tag} at ${commit})`);
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
  await cp(await buildTaggedRelease('d1'), path.join(RELEASES_DIR, 'd1'), { recursive: true });
  await cp(await buildTaggedRelease('d2'), path.join(RELEASES_DIR, 'd2'), { recursive: true });
  await cp(await buildTaggedRelease('d4'), path.join(RELEASES_DIR, 'd4'), { recursive: true });
  await buildLabelled('d5');
  console.log(`build:releases OK: ${RELEASES.join(', ')} in ${RELEASES_DIR}; v2-corrupt alters ${altered}`);
}
