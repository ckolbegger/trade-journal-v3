// npm run verify:fixtures: every committed Workspace fixture opens with the current release
// (Ready at the current schema; after a later schema change, through migration) and presents
// views equal to its committed snapshot (D1 T1.31).
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import { FIXTURES_DIR, launchOn, loadDump, viewsOf, type WorkspaceDump } from './fixtures/workspace-fixture.ts';

const problems: string[] = [];
const fixtures = (await readdir(FIXTURES_DIR)).filter((name) => name.startsWith('workspace-v')).sort();
if (fixtures.length === 0) problems.push(`no Workspace fixtures in ${FIXTURES_DIR}`);
for (const name of fixtures) {
  const dir = path.join(FIXTURES_DIR, name);
  const dump = JSON.parse(await readFile(path.join(dir, 'dump.json'), 'utf8')) as WorkspaceDump;
  const expected: unknown = JSON.parse(await readFile(path.join(dir, 'expected-views.json'), 'utf8'));
  if (dump.schemaVersion > SCHEMA_VERSION) {
    problems.push(`${name}: schema ${dump.schemaVersion} is newer than this release's ${SCHEMA_VERSION}`);
    continue;
  }
  const app = await launchOn(await loadDump(dump), dump.asOf);
  const status = await app.Workspace.getStatus();
  if (status.kind !== 'Ready') {
    problems.push(`${name}: getStatus is ${status.kind}, not Ready`);
    continue;
  }
  const views = await viewsOf(app);
  if (!isDeepStrictEqual(views, expected)) problems.push(`${name}: views differ from expected-views.json`);
}
if (problems.length > 0) {
  for (const p of problems) console.error(`FAIL ${p}`);
  process.exit(1);
}
console.log(`verify:fixtures OK: ${fixtures.join(', ')} open Ready at schema ${SCHEMA_VERSION} with views equal to their snapshots`);
