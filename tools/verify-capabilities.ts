// npm run verify:capabilities: the Installed Capability Manifest equals the facade's operations,
// no route requires an absent capability, and every installed operation is reachable (T1.18).
import { IDBFactory } from 'fake-indexeddb';
import { createApplication, facadeOperations } from '../src/app/compose.ts';
import { ROUTES } from '../src/app/routes.ts';
import { fixedClock } from '../src/domain/time/index.ts';
import { createInProcessLifecycleLock } from '../src/persistence/index.ts';
import { nodeTestHost } from '../tests/support/node-test-host.ts';
import { TEST_CAPACITY } from '../tests/support/stack.ts';
import { sequentialIds } from '../tests/support/workspace.ts';

// fake-indexeddb's classes as globals, as the Node test setup provides them.
await import('../tests/setup/idb-globals.ts');

const factory = new IDBFactory();
const testHost = await nodeTestHost(factory);
const app = await createApplication({
  indexedDB: factory,
  host: testHost.host,
  clock: fixedClock('2026-10-12T14:05:00Z'),
  ids: sequentialIds(),
  releaseId: testHost.releaseId,
  capacityRequirement: TEST_CAPACITY,
  locks: createInProcessLifecycleLock(),
});

const problems: string[] = [];
const manifest = Object.keys(app.capabilities.operations).sort();
const facade = facadeOperations(app);
for (const op of manifest) if (!facade.includes(op)) problems.push(`manifest declares ${op}, which the facade does not expose`);
for (const op of facade) if (!manifest.includes(op)) problems.push(`facade exposes ${op}, which the manifest does not declare`);
for (const route of ROUTES) {
  for (const op of route.requires) {
    if (!manifest.includes(op)) problems.push(`route ${route.id} requires absent capability ${op}`);
  }
}
const reachable = new Set<string>(ROUTES.flatMap((r) => r.requires));
for (const op of manifest) if (!reachable.has(op)) problems.push(`installed ${op} is not reachable from any route`);

if (problems.length > 0) {
  for (const p of problems) console.error(`FAIL ${p}`);
  process.exit(1);
}
console.log(`verify:capabilities OK: ${manifest.length} operations, ${ROUTES.length} routes, release ${app.capabilities.releaseId}`);
