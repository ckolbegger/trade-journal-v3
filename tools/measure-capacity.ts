// npm run measure:capacity (D8 T8.19-F1, decision 114): measures the Workspace that bench:setup restored from the benchmark
// artifact, and writes only .cache/bench/capacity.json. It never writes the capacity basis or the growth baseline.
import { writeFile } from 'node:fs/promises';
import { BENCH_CAPACITY_FILE } from './bench/profile.ts';
import { measureRestored, reportRestored } from './bench/restored-capacity.ts';

const record = await measureRestored();
await writeFile(BENCH_CAPACITY_FILE, `${JSON.stringify(record, null, 2)}\n`);
reportRestored('measure:capacity', record);
process.exit(0);
