// npm run measure:capacity [engine...]: measures storage per Trade with its Plan Reflection, and
// per Position Change, Execution, and Position Change Reflection outcome (D2 T2.18), and per Mark,
// acknowledgment, and Daily Trade Review Action (D4 T4.28), in each engine (default chromium; RC adds firefox and webkit) and rewrites the capacity basis
// with the largest projection (D1 T1.19, decision 18).
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from '@playwright/test';
import { createServer } from 'vite';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import { ALLOWANCES, BASIS_FILE, largestProjection, MEASURED, type EngineMeasurement } from './capacity/profile.ts';

const PLANS = 500;
const OPEN_TRADES = 200;
const ENGINES = { chromium, firefox, webkit } as const;

const requested = (process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['chromium']) as (keyof typeof ENGINES)[];
const previous = JSON.parse(await readFile(BASIS_FILE, 'utf8')) as { engines?: EngineMeasurement[] };
const engines = new Map((previous.engines ?? []).map((m) => [m.engine, m]));

const server = await createServer({ logLevel: 'warn', server: { port: 5179, strictPort: true } });
await server.listen();
try {
  for (const name of requested) {
    const browser = await ENGINES[name].launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:5179/tools/capacity/measure.html');
    await page.waitForFunction(() => typeof window.measureCapacity === 'function');
    const result = await page.evaluate(([plans, open]) => window.measureCapacity!(plans, open), [PLANS, OPEN_TRADES] as const);
    engines.set(name, { engine: name, version: browser.version(), ...result });
    console.log(`${name} ${browser.version()}: ${JSON.stringify(result)}`);
    await browser.close();
  }
} finally {
  await server.close();
}

const measurements = [...engines.values()];
const projection = largestProjection(measurements);
const basis = {
  schemaVersion: SCHEMA_VERSION,
  measuredAt: new Date().toISOString(),
  formula: 'requiredQuotaBytes = 3 × projectedWorkspaceBytes (M); M = measured kinds + allowances × overheadRatio, largest engine',
  profile: { measured: MEASURED, allowances: ALLOWANCES },
  engines: measurements,
  ...projection,
};
await writeFile(BASIS_FILE, `${JSON.stringify(basis, null, 2)}\n`);
console.log(`measure:capacity OK: M ${projection.projectedWorkspaceBytes} bytes, required quota ${projection.requiredQuotaBytes} bytes`);
