// npm run lint:deps [root]: dependency direction (dependency-cruiser) plus purity and
// no-identity rules (ESLint) over <root>/src. Default root is the repository.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { ESLint } from 'eslint';

const root = path.resolve(process.argv[2] ?? '.');
const src = path.relative(process.cwd(), path.join(root, 'src')) || 'src';
let failed = false;

try {
  execFileSync('npx', ['depcruise', src, '--config', '.dependency-cruiser.js', '--output-type', 'err'], {
    stdio: 'inherit',
  });
} catch {
  failed = true;
}

const eslint = new ESLint({ overrideConfigFile: 'eslint.deps.config.js', ignore: false });
const results = await eslint.lintFiles([`${src}/**/*.{ts,tsx}`]);
for (const result of results) {
  for (const m of result.messages) {
    failed = true;
    console.error(`${path.relative(process.cwd(), result.filePath)}:${m.line}:${m.column} ${m.message}`);
  }
}

if (failed) process.exit(1);
console.log(`lint:deps OK (${src})`);
