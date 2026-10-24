import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { build } from 'vite';
const revision = 'f36c52df0fdc101498067aaed1f5ffdc46185438';
const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', revision, 'src', 'public/capabilities.json'], { encoding: 'utf8' }).trim().split('\n');
for (const path of paths) {
  const target = `.cache/d1-source/${path}`;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, execFileSync('git', ['show', `${revision}:${path}`]));
}
writeFileSync('.cache/d1-source/entry.ts', `export { Store, Runtime } from './src/infrastructure/storage';
export { Workspace } from './src/application/workspace';
export { ReferenceCatalog } from './src/domain/reference-catalog';
export { TradeWorkflows } from './src/application/trade-workflows';
export { TradeRecord } from './src/domain/trade-record';
export { Journal } from './src/domain/journal';
`);
await build({ configFile: false, build: { lib: { entry: '.cache/d1-source/entry.ts', formats: ['es'], fileName: () => 'd1-fixture.mjs' }, outDir: '.cache/d1-fixture', emptyOutDir: true, rolldownOptions: { external: ['dexie', 'decimal.js', '@js-temporal/polyfill'] } } });
