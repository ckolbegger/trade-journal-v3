// npm run fixtures:freeze -- --schema <n>: builds the schema-<n> Workspace fixture through the
// facade only and writes its raw dump and expected views (D1 T1.31). A committed fixture is never
// regenerated, so an existing one is refused. Schema 2 (D2 T2.19) adds three Open Trades to D1's
// content. Schema 3 (D4 T4.29) adds Marks, an acknowledgment, and Daily Trade Review Actions for the
// Review Date of Monday 2026-10-19, 17:00 America/New_York.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import type { ConfirmPlanResult, PositionChangeMember, ReflectionDisposition } from '../src/app/types.ts';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import { dumpDatabases, FIXTURES_DIR, GENERATOR_VERSION, launchOn, viewsOf, type WorkspaceDump } from './fixtures/workspace-fixture.ts';

// Schemas 1 and 2 were frozen at Friday 17:00 America/New_York; schema 3 is frozen at the following
// Monday 17:00 (EDT, so 21:00Z), a session date inside the session-policy calendar's coverage, after
// which that Monday is the latest completed session and so the Review Date.
const AS_OF = '2026-10-19T21:00:00Z';
const REVIEW_DATE = '2026-10-19';

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

// D2's reference Trade (breakdown, section 4): 100 shares, intended entry 50.00, Stop 47.50,
// Target 56.00, confirmed 2026-10-12 09:00 America/New_York; PC1 60 @ 50.10 at 10:00, PC2 40 @ 50.30
// at 11:00, PC3 20 @ 51.00 at 14:00, each with a 1.00 fee. Each Open Trade records a prefix of them:
// PC1 only (Entering), PC1–PC2 (Resolved, Filled As Planned), and PC1–PC3 (Resolved, one Entry Size
// occurrence of 20 shares caused by PC3), with Complete and Decline reflections mixed.
const pcDefinition = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
if (pcDefinition.kind !== 'Found') throw new Error('Position Change Reflection definition missing');
const complete = (mode: string, emotion: string, confidence: number): ReflectionDisposition => ({
  kind: 'Complete',
  form: {
    definitionId: pcDefinition.definition.id,
    answers: {
      'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: `option.position-change-reflection.decision-mode.${mode}` },
      'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: `option.position-change-reflection.primary-emotion.${emotion}` },
      'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: confidence },
    },
  },
});
const decline = (reason?: string): ReflectionDisposition =>
  reason === undefined ? { kind: 'Decline', definitionId: pcDefinition.definition.id } : { kind: 'Decline', definitionId: pcDefinition.definition.id, reason };
const referenceChanges = [
  { economicTime: '2026-10-12T14:00:00Z', quantity: '60', price: '50.10' },
  { economicTime: '2026-10-12T15:00:00Z', quantity: '40', price: '50.30' },
  { economicTime: '2026-10-12T18:00:00Z', quantity: '20', price: '51.00' },
];
const openTrades = [
  { symbol: 'CSCO', reflections: [complete('as-planned', 'calm', 4), complete('as-planned', 'calm', 4), decline('Added into strength; reflecting later.')] },
  { symbol: 'KO', reflections: [complete('as-planned', 'eager', 3), decline()] },
  { symbol: 'PFE', reflections: [decline('Entered between meetings.')] },
];
for (const [i, open] of openTrades.entries()) {
  const account = accounts[i % accounts.length]!.record;
  const confirmed: ConfirmPlanResult = await app.TradeWorkflows.confirmPlan({
    accountId: account.id,
    accountRevision: account.recordRevision,
    strategyId: strategy.id,
    strategyRevision: strategy.recordRevision,
    economicTime: '2026-10-12T13:00:00Z',
    plan: {
      underlying: open.symbol,
      legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: open.symbol }, quantity: '100', intendedEntry: '50.00' }],
      stops: [{ kind: 'UnderlyingPrice', price: '47.50' }],
      targets: [{ kind: 'UnderlyingPrice', price: '56.00' }],
    },
    reflection: {
      definitionId: definition.definition.id,
      answers: {
        'prompt.plan-reflection.thesis': { kind: 'Text', text: `${open.symbol}: reclaiming 50 after a higher low.` },
        'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A daily close below 47.50.' },
      },
    },
  });
  if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan ${open.symbol}: ${confirmed.kind}`);
  const trade = confirmed.postCommit.trade;
  let factRevision = trade.factRevision;
  for (const [n, reflection] of open.reflections.entries()) {
    const change = referenceChanges[n]!;
    const member: PositionChangeMember = {
      kind: 'Execution',
      tradeId: trade.tradeId,
      action: 'Buy',
      instrument: { kind: 'Stock', symbol: open.symbol },
      intent: { kind: 'ServesPlannedLeg', plannedLegId: trade.plan.legs[0]!.factId },
      quantity: change.quantity,
      price: change.price,
      fee: '1.00',
      economicTime: change.economicTime,
    };
    const recorded = await app.TradeWorkflows.recordPositionChange({
      originTradeId: trade.tradeId,
      trades: [{ tradeId: trade.tradeId, expectedFactRevision: factRevision }],
      members: [member],
      reflection,
    });
    if (recorded.kind !== 'Recorded') throw new Error(`recordPositionChange ${open.symbol} PC${n + 1}: ${recorded.kind}`);
    factRevision = recorded.receipt.factRevision;
  }
}

// Schema 3 (D4 T4.29): Marks through the facade. CSCO has Marks for the 15th and the Review Date (the
// 16th is a skipped session, a gap), KO's Review-date Mark carries one Correction, and PFE's 16th is
// acknowledged as unavailable while its Review-date Mark is recorded.
async function markSaved(command: Parameters<typeof app.MarketData.save>[0]) {
  const result = await app.MarketData.save(command);
  if (result.kind !== 'Saved') throw new Error(`MarketData.save ${command.instrumentKey} ${command.tradingDate}: ${result.kind}`);
  return result;
}
const manualMark = (instrumentKey: string, tradingDate: string, price: string) =>
  markSaved({ intention: 'RecordInitialManualMark', instrumentKey, tradingDate, expectedResolutionRevision: 'None', price });
await manualMark('CSCO', '2026-10-15', '50.80');
await manualMark('CSCO', REVIEW_DATE, '51.60');
const koMark = await manualMark('KO', REVIEW_DATE, '49.40');
await markSaved({ intention: 'CorrectMark', instrumentKey: 'KO', tradingDate: REVIEW_DATE, expectedResolutionRevision: koMark.resolutionRevision, price: '49.50', reason: 'Keyed the wrong digit from the broker statement.' });
await manualMark('PFE', REVIEW_DATE, '47.90');
await markSaved({ intention: 'AssertUnavailable', instrumentKey: 'PFE', tradingDate: '2026-10-16', expectedResolutionRevision: 'None', reason: 'No quote available from my broker that day.' });

// Actions for the Review Date: CSCO Hold; KO Exit with an Intent, then edited once; PFE left without
// an Action, so the Review is Incomplete.
const review = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: AS_OF });
if (review.kind !== 'Ready' || review.reviewDate !== REVIEW_DATE) throw new Error(`DailyReview.open: ${review.kind}`);
let reviewBinding = review.binding;
const reviewed = review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
async function actionForm(underlying: string) {
  const item = reviewed.find((t) => t.underlying === underlying);
  if (!item) throw new Error(`${underlying} is not in the Review`);
  const form = await app.DailyReview.getTrade({ reviewDate: REVIEW_DATE, tradeId: item.tradeId, binding: reviewBinding });
  if (form.kind !== 'Ready') throw new Error(`DailyReview.getTrade ${underlying}: ${form.kind}`);
  return form.trade;
}
async function saveAction(underlying: string, action: 'Hold' | 'Exit', intent: string) {
  const trade = await actionForm(underlying);
  const result = await app.DailyReview.save({ kind: 'SaveTradeAction', binding: trade.saveBinding, action, intent });
  if (result.kind !== 'Saved') throw new Error(`DailyReview.save ${underlying}: ${result.kind}`);
  if (result.review.kind === 'Ready') reviewBinding = result.review.binding;
}
await saveAction('CSCO', 'Hold', 'Let the position work; the Stop at 47.50 still stands.');
await saveAction('KO', 'Exit', 'Sell at tomorrow open if it fails to hold 49.');
await saveAction('KO', 'Exit', 'Sell at tomorrow open if it fails to hold 49; take the loss on a close below 48.50.');

const dump: WorkspaceDump = { schemaVersion: SCHEMA_VERSION, generatorVersion: GENERATOR_VERSION, asOf: AS_OF, databases: await dumpDatabases(factory) };
const views = await viewsOf(app, SCHEMA_VERSION, AS_OF);
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, 'dump.json'), `${JSON.stringify(dump, null, 2)}\n`);
await writeFile(path.join(dir, 'expected-views.json'), `${JSON.stringify(views, null, 2)}\n`);
console.log(`fixtures:freeze OK: ${dir} (schema ${SCHEMA_VERSION}, ${plans.length} Planned and ${openTrades.length} Open Trades, ${accounts.length} Accounts)`);
