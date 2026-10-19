// npm run verify:no-fault-hooks [dir]: the production build (default dist/) contains neither the
// fault-hook marker nor `__tjFaults` (D1 T1.27).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { FAULT_HOOK_MARKER } from '../src/delivery/faults.ts';
import { listFiles } from './release.ts';

const dir = path.resolve(process.argv[2] ?? 'dist');
const found: string[] = [];
for (const file of await listFiles(dir)) {
  const text = await readFile(path.join(dir, file), 'latin1');
  for (const needle of [FAULT_HOOK_MARKER, '__tjFaults']) if (text.includes(needle)) found.push(`${file}: ${needle}`);
}
if (found.length > 0) {
  for (const f of found) console.error(`FAIL fault hook in production build: ${f}`);
  process.exit(1);
}
console.log(`verify:no-fault-hooks OK: ${dir} has no fault hooks`);
