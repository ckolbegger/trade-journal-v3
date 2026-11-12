// npm run fixtures:freeze -- --schema <n>: builds the schema-<n> Workspace fixture through the
// facade only and writes its raw dump and expected views (D1 T1.31). A committed fixture is never
// regenerated, so an existing one is refused. Schema 2 (D2 T2.19) adds three Open Trades to D1's
// content. Schema 3 (D4 T4.29) adds Marks, an acknowledgment, and Daily Trade Review Actions for the
// Review Date of Monday 2026-10-19, 17:00 America/New_York. Schema 4 (D5 T5.20) adds four Debts at that instant.
// Schema 5 (D6 T6.23) adds Sells and closes as of the following Tuesday 17:00: T-A after X1, T-S with its
// shortfall, a Trade closed Monday with a completed Close Review and one closed Tuesday with a deferred one.
// Schema 6 (D7 T7.27) adds the single-leg option Trades as of Friday 2026-11-20 17:00 America/New_York: O-C
// through X1 (Settlement Due), O-S expired with a deferred Close Review, O-P closed by Q1, and a Planned
// Long Call with Exercise Intent Authorized. Schema 7 (D7S T7S.13, A204) adds O-S2 (Cash-Secured Put on MNO, 45 Put expiring
// 2026-12-18, two Stops and two Targets of both kinds) after S1', with Friday 11-20 Marks of MNO 44.60 and the put 3.65.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import type { ExpirationMember } from '../src/coordinators/trade-workflows/index.ts';
import type { ConfirmPlanResult, PositionChangeMember, ReflectionDisposition } from '../src/app/types.ts';
import { SCHEMA_VERSION } from '../src/persistence/schema.ts';
import { dumpDatabases, FIXTURES_DIR, GENERATOR_VERSION, launchOn, viewsOf, type WorkspaceDump } from './fixtures/workspace-fixture.ts';

// Schemas 1 and 2 were frozen at Friday 17:00 America/New_York; schema 3 is frozen at the following
// Monday 17:00 (EDT, so 21:00Z), a session date inside the session-policy calendar's coverage, after
// which that Monday is the latest completed session and so the Review Date.
// Schema 5 is frozen at Tuesday 17:00 (21:00Z); the D5 content is built for the Monday Review Date.
const MONDAY_AS_OF = '2026-10-19T21:00:00Z';
// Schema 6 is frozen at the expiration Friday 17:00 (EST, so 22:00Z), an hour after the 16:00 close.
const AS_OF = '2026-11-20T22:00:00Z';
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
const strategy = strategies.items.find((r) => r.kind === 'Strategy' && r.productKey === 'strategy.long-stock')!;

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
const deferred: ReflectionDisposition = { kind: 'Defer' };
// Schema 4 (D5 T5.20) adds four Debts, as of Monday 17:00. The Expected Mark Date is Monday, so the
// session before it closed Friday 16:00: a Debt anchored at or before then is Due. One anchored after the
// Monday 16:00 close is not yet due (Trade Detail reads it as due in the Review after next).
const referenceChanges = [
  { economicTime: '2026-10-12T14:00:00Z', quantity: '60', price: '50.10' },
  { economicTime: '2026-10-12T15:00:00Z', quantity: '40', price: '50.30' },
  { economicTime: '2026-10-12T18:00:00Z', quantity: '20', price: '51.00' },
  // CSCO: an Outstanding Debt that is Due.
  { economicTime: '2026-10-14T15:00:00Z', quantity: '10', price: '51.20' },
  // CSCO: an Outstanding Debt not yet due (Position Change at Monday 16:05, after the 16:00 close).
  { economicTime: '2026-10-19T20:05:00Z', quantity: '10', price: '51.50' },
];
const openTrades = [
  { symbol: 'CSCO', reflections: [complete('as-planned', 'calm', 4), complete('as-planned', 'calm', 4), decline('Added into strength; reflecting later.'), deferred, deferred] },
  // KO's third Position Change is deferred, then answered in the Review (Source Daily Review).
  { symbol: 'KO', reflections: [complete('as-planned', 'eager', 3), decline(), deferred] },
  // PFE's Position Change is deferred, then declined on Trade Detail (Source Trade Detail).
  { symbol: 'PFE', reflections: [decline('Entered between meetings.'), deferred] },
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
const review = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_AS_OF });
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

// Schema 4 (D5 T5.20): KO's deferred reflection is answered in the Review (Source Daily Review), and
// PFE's is declined on Trade Detail (Source Trade Detail). CSCO's two stay Outstanding.
const koForm = await actionForm('KO');
const owed = koForm.reflections[0];
if (koForm.reflections.length !== 1 || !owed) throw new Error(`KO owes ${koForm.reflections.length} reflections, not 1`);
const answered = await app.DailyReview.save({
  kind: 'ResolveReviewDebt',
  reviewDate: REVIEW_DATE,
  binding: owed.saveBinding,
  resolution: {
    kind: 'Answer',
    answers: {
      'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
      'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
      'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 3 },
    },
  },
});
if (answered.kind !== 'DebtResolved') throw new Error(`ResolveReviewDebt KO: ${answered.kind}`);
const outstanding = await app.Journal.query({ scope: 'OutstandingDebt' });
if (!('debts' in outstanding)) throw new Error(`Journal.query OutstandingDebt: ${outstanding.kind}`);
const pfeTrade =reviewed.find((t) => t.underlying === 'PFE');
const pfeDebt = outstanding.debts.find((d) => d.anchor.tradeId === pfeTrade?.tradeId);
if (!pfeDebt) throw new Error('PFE owes no Debt');
const declined = await app.Journal.save({ intention: 'ResolveDebt', debtId: pfeDebt.debtId, expectedDebtRevision: pfeDebt.revision, resolution: { kind: 'Decline', reason: 'Nothing worth adding to the Journal.' } });
if (declined.kind !== 'Saved') throw new Error(`ResolveDebt PFE: ${declined.kind}`);

// Schema 5 (D6 T6.23): the plan's reference Trades (breakdown, section 4) and two closes.
//  - T-A (XYZ): PC1 Monday 10-12 10:00 60 @ 50.10, PC2 11:00 40 @ 50.30, each fee 1.00; X1 Tuesday 10-13 10:00,
//    Sell 30 @ 52.00, fee 0.60. Still Open with Position 70 and one derived Lot Match.
//  - T-S (QRS): PC1 60 @ 50.10, then XS (the same Tuesday Sell of 30), cutting the entry window short: one
//    Entry Size shortfall of 40.
//  - GIS: bought 100, sold all 100 on Monday 10-19, Close Reason Target Reached, Close Review completed.
//  - SYY: bought 100, sold all 100 on Tuesday 10-20, Close Reason Stop Triggered, Close Review deferred.
const closeReasons = await app.ReferenceCatalog.query({ family: 'CloseReason' });
const closeReviewDefinition = await app.Journal.getDefinitions({ latestFor: 'entry-type.close-review' });
if (closeReasons.kind !== 'Page' || closeReviewDefinition.kind !== 'Found') throw new Error('Close Reason or Close Review seed missing');
const closeReasonId = (label: string) => {
  const found = closeReasons.items.find((r) => r.label === label);
  if (!found) throw new Error(`no Close Reason ${label}`);
  return found.id;
};
const planDefinitionId = definition.definition.id;
const closeReviewComplete: ReflectionDisposition = {
  kind: 'Complete',
  form: {
    definitionId: closeReviewDefinition.definition.id,
    answers: {
      'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' },
      'prompt.close-review.what-worked': { kind: 'Text', text: 'Waited for the base to hold, then sold into the target.' },
      'prompt.close-review.key-lesson': { kind: 'Text', text: 'The plan was sound; keep sizing the same.' },
    },
  },
};

interface Step {
  readonly action: 'Buy' | 'Sell';
  readonly quantity: string;
  readonly price: string;
  readonly fee: string;
  readonly economicTime: string;
  readonly reflection: ReflectionDisposition;
  readonly close?: { readonly reason: string; readonly review: ReflectionDisposition };
}
async function closableTrade(symbol: string, accountIndex: number, planTime: string, steps: readonly Step[]) {
  const account = accounts[accountIndex % accounts.length]!.record;
  const confirmed: ConfirmPlanResult = await app.TradeWorkflows.confirmPlan({
    accountId: account.id,
    accountRevision: account.recordRevision,
    strategyId: strategy.id,
    strategyRevision: strategy.recordRevision,
    economicTime: planTime,
    plan: {
      underlying: symbol,
      legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol }, quantity: '100', intendedEntry: '50.00' }],
      stops: [{ kind: 'UnderlyingPrice', price: '47.50' }],
      targets: [{ kind: 'UnderlyingPrice', price: '56.00' }],
    },
    reflection: {
      definitionId: planDefinitionId,
      answers: {
        'prompt.plan-reflection.thesis': { kind: 'Text', text: `${symbol}: reclaiming 50 after a higher low.` },
        'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A daily close below 47.50.' },
      },
    },
  });
  if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan ${symbol}: ${confirmed.kind}`);
  const trade = confirmed.postCommit.trade;
  let factRevision = trade.factRevision;
  for (const [n, step] of steps.entries()) {
    const recorded = await app.TradeWorkflows.recordPositionChange({
      originTradeId: trade.tradeId,
      trades: [{ tradeId: trade.tradeId, expectedFactRevision: factRevision }],
      members: [
        {
          kind: 'Execution',
          tradeId: trade.tradeId,
          action: step.action,
          instrument: { kind: 'Stock', symbol },
          intent: { kind: 'ServesPlannedLeg', plannedLegId: trade.plan.legs[0]!.factId },
          quantity: step.quantity,
          price: step.price,
          fee: step.fee,
          economicTime: step.economicTime,
        },
      ],
      reflection: step.reflection,
      ...(step.close && { closeReasonId: closeReasonId(step.close.reason), closeReview: step.close.review }),
    });
    if (recorded.kind !== 'Recorded') throw new Error(`recordPositionChange ${symbol} step ${n + 1}: ${recorded.kind}`);
    factRevision = recorded.receipt.factRevision;
  }
}
const x1 = (reflection: ReflectionDisposition): Step => ({ action: 'Sell', quantity: '30', price: '52.00', fee: '0.60', economicTime: '2026-10-13T14:00:00Z', reflection });
await closableTrade('XYZ', 0, '2026-10-12T13:00:00Z', [
  { action: 'Buy', quantity: '60', price: '50.10', fee: '1.00', economicTime: '2026-10-12T14:00:00Z', reflection: complete('as-planned', 'calm', 4) },
  { action: 'Buy', quantity: '40', price: '50.30', fee: '1.00', economicTime: '2026-10-12T15:00:00Z', reflection: decline('Filled the rest as planned.') },
  x1(complete('as-planned', 'calm', 4)),
]);
await closableTrade('QRS', 1, '2026-10-12T13:00:00Z', [
  { action: 'Buy', quantity: '60', price: '50.10', fee: '1.00', economicTime: '2026-10-12T14:00:00Z', reflection: complete('as-planned', 'eager', 3) },
  x1(decline('Cut the position early.')),
]);
await closableTrade('GIS', 2, '2026-10-15T13:00:00Z', [
  { action: 'Buy', quantity: '100', price: '50.20', fee: '1.00', economicTime: '2026-10-15T14:00:00Z', reflection: decline('Single fill.') },
  { action: 'Sell', quantity: '100', price: '56.10', fee: '1.00', economicTime: '2026-10-19T15:00:00Z', reflection: decline('Target reached.'), close: { reason: 'Target Reached', review: closeReviewComplete } },
]);
await closableTrade('SYY', 0, '2026-10-16T13:00:00Z', [
  { action: 'Buy', quantity: '100', price: '49.80', fee: '1.00', economicTime: '2026-10-16T14:00:00Z', reflection: decline('Single fill.') },
  { action: 'Sell', quantity: '100', price: '47.40', fee: '1.00', economicTime: '2026-10-20T15:00:00Z', reflection: decline('Stopped out.'), close: { reason: 'Stop Triggered', review: { kind: 'Defer' } } },
]);

// Schema 6 (D7 T7.27): the option reference Trades (breakdown, section 4), every contract expiring Friday 11-20.
//  - O-C (XYZ 55 Call, Long Call): Plan 2 at 2.00, Exercise Intent NotAuthorized; PC1 Monday 10:00 Buy 1 @ 2.10 and PC2 11:00
//    Buy 1 @ 1.90 (fee 0.65 each), X1 Tuesday 10:00 Sell 1 @ 3.00. One contract stays Open: Settlement Due at the 16:00 close.
//  - O-S (MNO 45 Put, Cash-Secured Put): Plan -2 at 1.20; S1 Monday 10:00 Sell 2 @ 1.25, fee 1.30; Expiration of both contracts at
//    Friday 16:00, Close Review deferred.
//  - O-P (ABC 50 Put, Long Put): Plan 1 at 1.50, Exercise Intent Authorized; P1 Monday 10:00 Buy 1 @ 1.50; Q1 Friday 11:00 Sell 1 @ 2.20,
//    fee 0.65 each; Close Reason Target Reached, Close Review completed.
//  - A Planned Long Call on JKL (60 Call), 1 contract at 2.00, Exercise Intent Authorized: the plan names no such contract, so these are
//    this fixture's own figures.
const optionStrategy = (productKey: string) => {
  const found = strategies.items.find((r) => r.kind === 'Strategy' && r.productKey === productKey);
  if (!found) throw new Error(`no Strategy ${productKey}`);
  return found;
};
const optionContract = (symbol: string, right: 'Call' | 'Put', strike: string, expiration = '2026-11-20') =>
  ({ kind: 'Option', symbol, root: symbol, expiration, right, strike, multiplier: 100 }) as const;
interface OptionStep {
  readonly member: 'Execution' | 'Expiration';
  readonly action?: 'Buy' | 'Sell';
  readonly quantity: string;
  readonly price?: string;
  readonly fee?: string;
  readonly economicTime: string;
  readonly reflection: ReflectionDisposition;
  readonly close?: { readonly reason?: string; readonly review: ReflectionDisposition };
}
async function optionTrade(options: {
  readonly strategyKey: string;
  readonly accountIndex: number;
  readonly instrument: ReturnType<typeof optionContract>;
  readonly side: 'Long' | 'Short';
  readonly quantity: string;
  readonly intendedEntry: string;
  readonly stop: string;
  readonly target: string;
  readonly stops?: readonly { readonly kind: 'UnderlyingPrice' | 'StructureValue'; readonly price: string }[];
  readonly targets?: readonly { readonly kind: 'UnderlyingPrice' | 'StructureValue'; readonly price: string }[];
  readonly exerciseIntent?: 'Authorized' | 'NotAuthorized';
  readonly planTime: string;
  readonly steps: readonly OptionStep[];
}) {
  const account = accounts[options.accountIndex % accounts.length]!.record;
  const chosen = optionStrategy(options.strategyKey);
  const symbol = options.instrument.symbol;
  const confirmed: ConfirmPlanResult = await app.TradeWorkflows.confirmPlan({
    accountId: account.id,
    accountRevision: account.recordRevision,
    strategyId: chosen.id,
    strategyRevision: chosen.recordRevision,
    economicTime: options.planTime,
    plan: {
      underlying: symbol,
      legs: [{ side: options.side, instrument: options.instrument, quantity: options.quantity, intendedEntry: options.intendedEntry }],
      stops: options.stops ?? [{ kind: 'UnderlyingPrice', price: options.stop }],
      targets: options.targets ?? [{ kind: 'UnderlyingPrice', price: options.target }],
      ...(options.exerciseIntent && { exerciseIntent: options.exerciseIntent }),
    },
    reflection: {
      definitionId: planDefinitionId,
      answers: {
        'prompt.plan-reflection.thesis': { kind: 'Text', text: `${symbol}: the premium is worth the risk.` },
        'prompt.plan-reflection.invalidation': { kind: 'Text', text: `A close through ${options.stop}.` },
      },
    },
  });
  if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan ${symbol} option: ${confirmed.kind}`);
  const trade = confirmed.postCommit.trade;
  let factRevision = trade.factRevision;
  for (const [n, step] of options.steps.entries()) {
    const member: PositionChangeMember | ExpirationMember =
      step.member === 'Expiration'
        ? { kind: 'Expiration', tradeId: trade.tradeId, instrument: options.instrument, quantity: step.quantity, economicTime: step.economicTime }
        : {
            kind: 'Execution',
            tradeId: trade.tradeId,
            action: step.action!,
            instrument: options.instrument,
            intent: { kind: 'ServesPlannedLeg', plannedLegId: trade.plan.legs[0]!.factId },
            quantity: step.quantity,
            price: step.price!,
            fee: step.fee!,
            economicTime: step.economicTime,
          };
    const recorded = await app.TradeWorkflows.recordPositionChange({
      originTradeId: trade.tradeId,
      trades: [{ tradeId: trade.tradeId, expectedFactRevision: factRevision }],
      members: [member],
      reflection: step.reflection,
      ...(step.close && { ...(step.close.reason !== undefined && { closeReasonId: closeReasonId(step.close.reason) }), closeReview: step.close.review }),
    });
    if (recorded.kind !== 'Recorded') throw new Error(`recordPositionChange ${symbol} option step ${n + 1}: ${recorded.kind}`);
    factRevision = recorded.receipt.factRevision;
  }
}
const optionBuy = (quantity: string, price: string, economicTime: string, reflection: ReflectionDisposition): OptionStep => ({ member: 'Execution', action: 'Buy', quantity, price, fee: '0.65', economicTime, reflection });
await optionTrade({
  strategyKey: 'strategy.long-call',
  accountIndex: 0,
  instrument: optionContract('XYZ', 'Call', '55'),
  side: 'Long',
  quantity: '2',
  intendedEntry: '2.00',
  stop: '48.00',
  target: '60.00',
  exerciseIntent: 'NotAuthorized',
  planTime: '2026-10-12T13:00:00Z',
  steps: [
    optionBuy('1', '2.10', '2026-10-12T14:00:00Z', complete('as-planned', 'calm', 4)),
    optionBuy('1', '1.90', '2026-10-12T15:00:00Z', decline('Filled the second contract.')),
    { member: 'Execution', action: 'Sell', quantity: '1', price: '3.00', fee: '0.65', economicTime: '2026-10-13T14:00:00Z', reflection: complete('as-planned', 'eager', 3) },
  ],
});
await optionTrade({
  strategyKey: 'strategy.cash-secured-put',
  accountIndex: 1,
  instrument: optionContract('MNO', 'Put', '45'),
  side: 'Short',
  quantity: '-2',
  intendedEntry: '1.20',
  stop: '42.00',
  target: '50.00',
  planTime: '2026-10-12T13:00:00Z',
  steps: [
    { member: 'Execution', action: 'Sell', quantity: '2', price: '1.25', fee: '1.30', economicTime: '2026-10-12T14:00:00Z', reflection: complete('as-planned', 'calm', 4) },
    { member: 'Expiration', quantity: '2', economicTime: '2026-11-20T21:00:00Z', reflection: decline('Expired worthless.'), close: { review: { kind: 'Defer' } } },
  ],
});
await optionTrade({
  strategyKey: 'strategy.long-put',
  accountIndex: 2,
  instrument: optionContract('ABC', 'Put', '50'),
  side: 'Long',
  quantity: '1',
  intendedEntry: '1.50',
  stop: '55.00',
  target: '45.00',
  exerciseIntent: 'Authorized',
  planTime: '2026-10-12T13:00:00Z',
  steps: [
    optionBuy('1', '1.50', '2026-10-12T14:00:00Z', decline('Single fill.')),
    { member: 'Execution', action: 'Sell', quantity: '1', price: '2.20', fee: '0.65', economicTime: '2026-11-20T16:00:00Z', reflection: decline('Took the gain.'), close: { reason: 'Target Reached', review: closeReviewComplete } },
  ],
});
await optionTrade({
  strategyKey: 'strategy.long-call',
  accountIndex: 0,
  instrument: optionContract('JKL', 'Call', '60'),
  side: 'Long',
  quantity: '1',
  intendedEntry: '2.00',
  stop: '55.00',
  target: '70.00',
  exerciseIntent: 'Authorized',
  planTime: '2026-11-19T14:00:00Z',
  steps: [],
});

// Schema 7 (D7S T7S.13, A204): O-S2, the Cash-Secured Put on MNO with both condition kinds (breakdown, section 4), contract expiring
// 2026-12-18 so it is not due at the as-of instant. Plan -2 at 1.20, confirmed Monday 10-12 09:00 with S-u MNO 41.00, S-o option 3.60,
// T-u MNO 44.50, T-o option 0.30; S1' Monday 10:00 Sell 2 @ 1.25, fee 1.30. Friday 11-20's Marks: MNO 44.60 and the put 3.65.
await optionTrade({
  strategyKey: 'strategy.cash-secured-put',
  accountIndex: 2,
  instrument: optionContract('MNO', 'Put', '45', '2026-12-18'),
  side: 'Short',
  quantity: '-2',
  intendedEntry: '1.20',
  stop: '41.00',
  target: '44.50',
  stops: [{ kind: 'UnderlyingPrice', price: '41.00' }, { kind: 'StructureValue', price: '3.60' }],
  targets: [{ kind: 'UnderlyingPrice', price: '44.50' }, { kind: 'StructureValue', price: '0.30' }],
  planTime: '2026-10-12T13:00:00Z',
  steps: [{ member: 'Execution', action: 'Sell', quantity: '2', price: '1.25', fee: '1.30', economicTime: '2026-10-12T14:00:00Z', reflection: complete('as-planned', 'calm', 4) }],
});
await manualMark('MNO', '2026-11-20', '44.60');
await manualMark('MNO261218P00045000', '2026-11-20', '3.65');

const dump: WorkspaceDump = { schemaVersion: SCHEMA_VERSION, generatorVersion: GENERATOR_VERSION, asOf: AS_OF, databases: await dumpDatabases(factory) };
const views = await viewsOf(app, SCHEMA_VERSION, AS_OF);
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, 'dump.json'), `${JSON.stringify(dump, null, 2)}\n`);
await writeFile(path.join(dir, 'expected-views.json'), `${JSON.stringify(views, null, 2)}\n`);
console.log(`fixtures:freeze OK: ${dir} (schema ${SCHEMA_VERSION}, ${plans.length} Planned and ${openTrades.length + 2} Open and 2 Closed stock Trades plus 5 option Trades, ${accounts.length} Accounts)`);
