import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const revision = 'f36c52df0fdc101498067aaed1f5ffdc46185438';
const source = resolve('.cache/d1-release-source');
const output = resolve('.cache/d1-release');
const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', revision], { encoding: 'utf8' }).trim().split('\n').filter(path => /^(src\/|worker\/|tools\/|public\/)/.test(path) || ['package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'playwright.config.ts', 'playwright.benchmark.config.ts', 'vitest.config.ts'].includes(path));
for (const path of paths) { const target = `${source}/${path}`; mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, execFileSync('git', ['show', `${revision}:${path}`])); }
if (!existsSync(`${source}/node_modules`)) symlinkSync(resolve('node_modules'), `${source}/node_modules`, 'dir');
// Only the documented public port; never copy a user or sibling environment file.
writeFileSync(`${source}/.env.local`, 'DEV_PORT=5174\n');
const env = { ...process.env, D1_BUILD_DIR: output };
execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build'], { cwd: source, env, stdio: 'inherit' });
execFileSync(process.execPath, ['tools/inventory.mjs'], { cwd: source, env, stdio: 'inherit' });
execFileSync(process.execPath, ['tools/build-browser-generator.mjs'], { cwd: source, env, stdio: 'inherit' });
console.log(`Historical D1 production release: ${output}; source ${revision}`);
