// npm run fixtures:freeze -- --schema <n>: builds the schema-<n> Workspace fixture through the
// facade only and writes its raw dump and expected views (D1 T1.31). A committed fixture is never
// regenerated, so an existing one is refused.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import { dumpDatabases, FIXTURES_DIR, GENERATOR_VERSION, launchOn, viewsOf, type WorkspaceDump } from './fixtures/workspace-fixture.ts';

const AS_OF = '2026-10-16T21:00:00Z';

const flag = process.argv.indexOf('--schema');
const schema = Number(process.argv[flag + 1]);
if (flag < 0 || schema !== SCHEMA_VERSION) {
  console.error(`fixtures:freeze: --schema must be the current schema version, ${SCHEMA_VERSION}`);
  process.exit(1);
}
const dir = path.join(FIXTURES_DIR, `workspace-v${schema}`);
if (existsSync(dir)) {
  console.error(`fixtures:freeze: ${dir} exists; committed fixtures are never regenerated`);
  process.exit(1);
}

const factory = new IDBFactory();
const app = await launchOn(factory, AS_OF);
const opened = await app.Workspace.initialize({ timeZone: 'America/New_York' });
if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);

async function saved<T extends { kind: string }>(result: Promise<T>): Promise<Extract<T, { kind: 'Saved' }>> {
  const value = await result;
  if (value.kind !== 'Saved') throw new Error(`save: ${value.kind}`);
  return value as Extract<T, { kind: 'Saved' }>;
}
const fidelity = await saved(app.ReferenceCatalog.save({ kind: 'CreateInstitution', label: 'Fidelity' }));
const schwab = await saved(app.ReferenceCatalog.save({ kind: 'CreateInstitution', label: 'Charles Schwab' }));
const accounts = [
  await saved(app.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: fidelity.record.id, label: 'Roth IRA' })),
  await saved(app.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: fidelity.record.id, label: 'Individual' })),
  await saved(app.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: schwab.record.id, label: 'Brokerage' })),
];
const strategies = await app.ReferenceCatalog.query({ family: 'Strategy' });
const definition = await app.Journal.getDefinitions({ latestFor: 'entry-type.plan-reflection' });
if (strategies.kind !== 'Page' || definition.kind !== 'Found') throw new Error('seed missing');
const strategy = strategies.items[0]!;

const plans = [
  { symbol: 'AAPL', quantity: '50', entry: '228.40', stop: '221.00', target: '245.00', at: '2026-10-12T14:00:00Z', conviction: 4, emotion: 'calm' },
  { symbol: 'MSFT', quantity: '30', entry: '415.10', stop: '402.50', target: '440.00', at: '2026-10-13T15:30:00Z', conviction: 3, emotion: 'eager' },
  { symbol: 'NVDA', quantity: '120', entry: '131.25', stop: '124.80', target: '149.90', at: '2026-10-14T13:45:00Z', conviction: 5, emotion: 'anxious' },
  { symbol: 'COST', quantity: '10', entry: '905.00', stop: '880.00', target: '960.00', at: '2026-10-15T16:10:00Z', conviction: 2, emotion: 'calm' },
  { symbol: 'BRK.B', quantity: '25', entry: '462.75', stop: '451.00', target: '489.50', at: '2026-10-16T19:20:00Z', conviction: 4, emotion: 'relieved' },
];
for (const [i, plan] of plans.entries()) {
  const account = accounts[i % accounts.length]!.record;
  const result = await app.TradeWorkflows.confirmPlan({
    accountId: account.id,
    accountRevision: account.recordRevision,
    strategyId: strategy.id,
    strategyRevision: strategy.recordRevision,
    economicTime: plan.at,
    plan: {
      underlying: plan.symbol,
      legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: plan.symbol }, quantity: plan.quantity, intendedEntry: plan.entry }],
      stops: [{ kind: 'UnderlyingPrice', price: plan.stop }],
      targets: [{ kind: 'UnderlyingPrice', price: plan.target }],
    },
    reflection: {
      definitionId: definition.definition.id,
      answers: {
        'prompt.plan-reflection.thesis': { kind: 'Text', text: `${plan.symbol}: base breakout on rising volume.` },
        'prompt.plan-reflection.invalidation': { kind: 'Text', text: `A daily close below ${plan.stop}.` },
        'prompt.plan-reflection.conviction': { kind: 'Scale', value: plan.conviction },
        'prompt.plan-reflection.primary-emotion': { kind: 'Option', optionId: `option.plan-reflection.primary-emotion.${plan.emotion}` },
      },
    },
  });
  if (result.kind !== 'Confirmed') throw new Error(`confirmPlan ${plan.symbol}: ${result.kind}`);
}

const dump: WorkspaceDump = { schemaVersion: SCHEMA_VERSION, generatorVersion: GENERATOR_VERSION, asOf: AS_OF, databases: await dumpDatabases(factory) };
const views = await viewsOf(app);
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, 'dump.json'), `${JSON.stringify(dump, null, 2)}\n`);
await writeFile(path.join(dir, 'expected-views.json'), `${JSON.stringify(views, null, 2)}\n`);
console.log(`fixtures:freeze OK: ${dir} (schema ${SCHEMA_VERSION}, ${plans.length} Plans, ${accounts.length} Accounts)`);
