// npm run verify:no-fault-hooks [dir]: the production build (default dist/) contains neither the
// fault-hook marker, `__tjFaults`, nor any migration fault name (D1 T1.27, D2 T2.16), nor the
// bench build's generator marker or `__tjBench` (D2 T2.20), nor the clock-pin marker or `__tjClockPin` (D4 T4.26).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { BENCH_GENERATOR_MARKER } from '../src/app/bench.ts';
import { CLOCK_PIN_MARKER, FAULT_HOOK_MARKER, MIGRATION_FAULTS } from '../src/delivery/faults.ts';
import { listFiles } from './release.ts';

const dir = path.resolve(process.argv[2] ?? 'dist');
const found: string[] = [];
for (const file of await listFiles(dir)) {
  const text = await readFile(path.join(dir, file), 'latin1');
  for (const needle of [FAULT_HOOK_MARKER, '__tjFaults', ...MIGRATION_FAULTS, BENCH_GENERATOR_MARKER, '__tjBench', CLOCK_PIN_MARKER, '__tjClockPin']) if (text.includes(needle)) found.push(`${file}: ${needle}`);
}
if (found.length > 0) {
  for (const f of found) console.error(`FAIL fault hook in production build: ${f}`);
  process.exit(1);
}
console.log(`verify:no-fault-hooks OK: ${dir} has no fault or bench hooks`);
