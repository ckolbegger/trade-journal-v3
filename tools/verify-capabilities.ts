// npm run verify:capabilities: the Installed Capability Manifest equals the facade's operations,
// no route requires an absent capability, and every installed operation is reachable (T1.18).
// From D2 (T2.11): no route presents an absent variant, every installed variant of an operation
// a route qualifies by variant is presented by some route, the manifest names the schema version
// this release writes, and every declared Entry Type is seeded in a fresh Workspace.
// From D4 (T4.19): the manifest names the session-policy identity the release applies.
import { IDBFactory } from 'fake-indexeddb';
import { createApplication, facadeOperations } from '../src/app/compose.ts';
import { ROUTES, type RouteDefinition } from '../src/app/routes.ts';
import { nyseSessionPolicy } from '../src/domain/session-policy/index.ts';
import { fixedClock } from '../src/domain/time/index.ts';
import { createInProcessLifecycleLock, SCHEMA_VERSION } from '../src/persistence/index.ts';
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

const operations = app.capabilities.operations;
const routes: readonly RouteDefinition[] = ROUTES;
const presented = new Map<string, Set<string>>();
for (const route of routes) {
  for (const [op, variants] of Object.entries(route.variants ?? {})) {
    if (!route.requires.includes(op)) problems.push(`route ${route.id} presents variants of ${op} without requiring it`);
    for (const variant of variants) {
      if (!operations[op]?.includes(variant)) problems.push(`route ${route.id} presents absent variant ${op} (${variant})`);
      presented.set(op, (presented.get(op) ?? new Set()).add(variant));
    }
  }
}
for (const [op, variants] of presented) {
  for (const variant of operations[op] ?? []) {
    if (!variants.has(variant)) problems.push(`installed variant ${op} (${variant}) is not presented by any route`);
  }
}

if (app.capabilities.schemaVersion !== SCHEMA_VERSION) {
  problems.push(`manifest names schema version ${app.capabilities.schemaVersion}, but this release writes ${SCHEMA_VERSION}`);
}
if (JSON.stringify(app.capabilities.sessionPolicy) !== JSON.stringify(nyseSessionPolicy.identity)) {
  problems.push('manifest session-policy identity is not the identity of the policy this release applies');
}
const opened = await app.Workspace.initialize({ timeZone: 'America/New_York' });
if (opened.kind !== 'Opened') problems.push(`a fresh Workspace did not open: ${opened.kind}`);
for (const entryType of app.capabilities.entryTypes) {
  const found = await app.Journal.getDefinitions({ latestFor: entryType });
  if (found.kind !== 'Found') problems.push(`declared Entry Type ${entryType} has no seeded definition`);
}

if (problems.length > 0) {
  for (const p of problems) console.error(`FAIL ${p}`);
  process.exit(1);
}
console.log(
  `verify:capabilities OK: ${manifest.length} operations, ${presented.size} variant-qualified, ${ROUTES.length} routes, ${app.capabilities.entryTypes.length} Entry Types, schema ${app.capabilities.schemaVersion}, release ${app.capabilities.releaseId}`,
);
