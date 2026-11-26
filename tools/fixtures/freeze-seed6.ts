// The seed-6 Workspace fixture (D9.5 T95.63, P174): the frozen workspace-v7 (never touched) opened by this release, which delivers
// Journal manifest 6's revisions, plus what the redesign adds, all recorded through the facade: an Action of each kind, a Settle Later,
// sales with and without a Plan Departure Reason, a part sale, an in-the-money expiration with its reason, and a Close Review owed
// under each revision and one answered under the new one. The identities minted here carry their own prefix so none repeats the dump's.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ExpirationMember } from '../../src/coordinators/trade-workflows/index.ts';
import type { ConfirmPlanResult, PositionChangeMember, ReflectionDisposition } from '../../src/app/types.ts';
import { SCHEMA_VERSION } from '../../src/persistence/schema.ts';
import { sequentialIds } from '../../tests/support/workspace.ts';
import { dumpDatabases, FIXTURES_DIR, GENERATOR_VERSION, launchOn, loadDump, viewsOf, type WorkspaceDump } from './workspace-fixture.ts';
import { workspaceFixtureName } from '../fixture-schemas.ts';

// Friday 2026-11-20 17:00 America/New_York (EST): the instant workspace-v7 was frozen at, and the Review Date the new content is for.
const AS_OF = '2026-11-20T22:00:00Z';
const REVIEW_DATE = '2026-11-20';
const PLAN_DEPARTURE = 'prompt.position-change-reflection.plan-departure';
const EXPIRATION_REASON = 'prompt.position-change-reflection.expiration-reason';

export async function freezeSeed6(dir: string): Promise<void> {
  const base = JSON.parse(await readFile(path.join(FIXTURES_DIR, workspaceFixtureName(SCHEMA_VERSION), 'dump.json'), 'utf8')) as WorkspaceDump;
  if (base.asOf !== AS_OF) throw new Error(`workspace-v7 was frozen at ${base.asOf}, not ${AS_OF}`);
  const factory = await loadDump(base);
  const app = await launchOn(factory, AS_OF, sequentialIds('fx6'));
  const opened = await app.Workspace.initialize({});
  if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
  console.log(`fixtures:freeze seed 6: Journal seed ${JSON.stringify(opened.receipt.seeds.journal)}`);

  async function saved<T extends { kind: string }>(result: Promise<T>): Promise<Extract<T, { kind: 'Saved' }>> {
    const value = await result;
    if (value.kind !== 'Saved') throw new Error(`save: ${JSON.stringify(value)}`);
    return value as Extract<T, { kind: 'Saved' }>;
  }
  const accounts = await app.ReferenceCatalog.query({ family: 'Account' });
  const strategies = await app.ReferenceCatalog.query({ family: 'Strategy' });
  const closeReasons = await app.ReferenceCatalog.query({ family: 'CloseReason' });
  const planForm = await app.Journal.getDefinitions({ latestFor: 'entry-type.plan-reflection' });
  const changeForm = await app.Journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  const closeForm = await app.Journal.getDefinitions({ latestFor: 'entry-type.close-review' });
  if (accounts.kind !== 'Page' || strategies.kind !== 'Page' || closeReasons.kind !== 'Page') throw new Error('catalog missing');
  if (planForm.kind !== 'Found' || changeForm.kind !== 'Found' || closeForm.kind !== 'Found') throw new Error('journal forms missing');
  const planFormId = planForm.definition.id;
  const changeFormId = changeForm.definition.id;
  const found = accounts.items.find((r) => r.kind === 'Account');
  if (!found) throw new Error('no Account');
  const account = found;
  const strategyOf = (productKey: string) => {
    const found = strategies.items.find((r) => r.kind === 'Strategy' && r.productKey === productKey);
    if (!found) throw new Error(`no Strategy ${productKey}`);
    return found;
  };
  const closeReasonId = (label: string) => {
    const found = closeReasons.items.find((r) => r.label === label);
    if (!found) throw new Error(`no Close Reason ${label}`);
    return found.id;
  };

  // Today's Position Change Reflection: the three earlier answers, with the Plan Departure Reason or the Expiration Reason when given.
  const reflection = (extra: Record<string, string> = {}): ReflectionDisposition => ({
    kind: 'Complete',
    form: {
      definitionId: changeFormId,
      answers: {
        'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
        'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
        'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
        ...Object.fromEntries(Object.entries(extra).map(([id, text]) => [id, { kind: 'Text' as const, text }])),
      },
    },
  });
  const markSaved = async (instrumentKey: string, price: string) =>
    saved(app.MarketData.save({ intention: 'RecordInitialManualMark', instrumentKey, tradingDate: REVIEW_DATE, expectedResolutionRevision: 'None', price }));

  interface Step {
    readonly member: 'Buy' | 'Sell' | 'Expiration';
    readonly quantity: string;
    readonly price?: string;
    readonly economicTime: string;
    readonly reflection: ReflectionDisposition;
    // The Close Reason of a sale that closes the Position, and whether its Close Review is put off with it (an Expiration has no reason).
    readonly close?: string;
    readonly closeReview?: true;
  }
  async function trade(options: {
    readonly strategyKey: string;
    readonly instrument: PositionChangeMember['instrument'];
    readonly side: 'Long' | 'Short';
    readonly quantity: string;
    readonly intendedEntry: string;
    readonly stop: string;
    readonly target: string;
    readonly planTime: string;
    readonly steps: readonly Step[];
  }): Promise<string> {
    const chosen = strategyOf(options.strategyKey);
    const underlying = options.instrument.kind === 'Stock' ? options.instrument.symbol : options.instrument.symbol;
    const confirmed: ConfirmPlanResult = await app.TradeWorkflows.confirmPlan({
      accountId: account.id,
      accountRevision: account.recordRevision,
      strategyId: chosen.id,
      strategyRevision: chosen.recordRevision,
      economicTime: options.planTime,
      plan: {
        underlying,
        legs: [{ side: options.side, instrument: options.instrument, quantity: options.quantity, intendedEntry: options.intendedEntry }],
        stops: [{ kind: 'UnderlyingPrice', price: options.stop }],
        targets: [{ kind: 'UnderlyingPrice', price: options.target }],
      },
      reflection: {
        definitionId: planFormId,
        answers: {
          'prompt.plan-reflection.thesis': { kind: 'Text', text: `${underlying}: the setup is worth the risk.` },
          'prompt.plan-reflection.invalidation': { kind: 'Text', text: `A close through ${options.stop}.` },
        },
      },
    });
    if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan ${underlying}: ${JSON.stringify(confirmed)}`);
    const planned = confirmed.postCommit.trade;
    let factRevision = planned.factRevision;
    for (const [n, step] of options.steps.entries()) {
      const member: PositionChangeMember | ExpirationMember =
        step.member === 'Expiration'
          ? { kind: 'Expiration', tradeId: planned.tradeId, instrument: options.instrument, quantity: step.quantity, economicTime: step.economicTime }
          : {
              kind: 'Execution',
              tradeId: planned.tradeId,
              action: step.member,
              instrument: options.instrument,
              intent: { kind: 'ServesPlannedLeg', plannedLegId: planned.plan.legs[0]!.factId },
              quantity: step.quantity,
              price: step.price!,
              fee: '1.00',
              economicTime: step.economicTime,
            };
      const recorded = await app.TradeWorkflows.recordPositionChange({
        originTradeId: planned.tradeId,
        trades: [{ tradeId: planned.tradeId, expectedFactRevision: factRevision }],
        members: [member],
        reflection: step.reflection,
        ...(step.close !== undefined && { closeReasonId: closeReasonId(step.close) }),
        ...((step.close !== undefined || step.closeReview) && { closeReview: { kind: 'Defer' as const } }),
      });
      if (recorded.kind !== 'Recorded') throw new Error(`recordPositionChange ${underlying} step ${n + 1}: ${JSON.stringify(recorded)}`);
      factRevision = recorded.receipt.factRevision;
    }
    return planned.tradeId;
  }

  const stock = (symbol: string) => ({ kind: 'Stock', symbol }) as const;
  const PLAN_TIME = '2026-11-16T14:00:00Z';
  const BOUGHT = '2026-11-16T15:00:00Z';
  const SOLD = '2026-11-20T15:00:00Z';
  const longStock = (symbol: string, steps: readonly Step[]) =>
    trade({ strategyKey: 'strategy.long-stock', instrument: stock(symbol), side: 'Long', quantity: '100', intendedEntry: '50.00', stop: '47.50', target: '56.00', planTime: PLAN_TIME, steps });
  const buy100: Step = { member: 'Buy', quantity: '100', price: '50.00', economicTime: BOUGHT, reflection: reflection() };


  // Part B and C content: closing sales and the Close Reviews they owe under today's form.
  // PDR: the whole Position sold inside its Stop and Target, so it leaves the Plan Exit and names its Plan Departure Reason.
  await markSaved('PDR', '51.00');
  await longStock('PDR', [buy100, { member: 'Sell', quantity: '100', price: '51.00', economicTime: SOLD, reflection: reflection({ [PLAN_DEPARTURE]: 'Needed the cash for another setup.' }), close: 'Time-Based Exit' }]);
  // PRT: a part sale that leaves the Plan Exit, with its Plan Departure Reason; 60 shares stay Open.
  await markSaved('PRT', '51.00');
  await longStock('PRT', [buy100, { member: 'Sell', quantity: '40', price: '51.00', economicTime: SOLD, reflection: reflection({ [PLAN_DEPARTURE]: 'Trimmed ahead of the weekend.' }) }]);
  // CLA: sold at its Target, so it follows the Plan Exit and needs no reason; its Close Review is answered below under today's form.
  const cla = await longStock('CLA', [buy100, { member: 'Sell', quantity: '100', price: '56.10', economicTime: SOLD, reflection: reflection(), close: 'Target Reached' }]);
  // DEF: a short put that expired in the money at Friday's Mark, so its completed reflection holds the Expiration Reason.
  await markSaved('DEF', '28.00');
  const put = { kind: 'Option', symbol: 'DEF', root: 'DEF', expiration: '2026-11-20', right: 'Put', strike: '30', multiplier: 100 } as const;
  await trade({
    strategyKey: 'strategy.cash-secured-put',
    instrument: put,
    side: 'Short',
    quantity: '-1',
    intendedEntry: '1.00',
    stop: '25.00',
    target: '35.00',
    planTime: PLAN_TIME,
    steps: [
      { member: 'Sell', quantity: '1', price: '1.05', economicTime: BOUGHT, reflection: reflection() },
      { member: 'Expiration', quantity: '1', economicTime: '2026-11-20T21:00:00Z', reflection: reflection({ [EXPIRATION_REASON]: 'Closed through the strike on a gap down; let it go to settlement.' }), closeReview: true },
    ],
  });

  // CLA's Close Review, answered through today's form: its key lesson is required.
  const owedClose = (await app.Journal.query({ scope: 'OutstandingDebt' }));
  if (!('debts' in owedClose)) throw new Error('debts');
  const claDebt = owedClose.debts.find((d) => d.entryTypeKey === 'entry-type.close-review' && d.anchor.tradeId === cla);
  if (!claDebt) throw new Error('CLA owes no Close Review');
  if (claDebt.definitionId !== closeForm.definition.id) throw new Error(`CLA's Close Review is owed under ${claDebt.definitionId}, not ${closeForm.definition.id}`);
  await saved(
    app.Journal.save({
      intention: 'ResolveDebt',
      debtId: claDebt.debtId,
      expectedDebtRevision: claDebt.revision,
      resolution: {
        kind: 'Answer',
        form: {
          definitionId: claDebt.definitionId,
          answers: {
            'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' },
            'prompt.close-review.what-worked': { kind: 'Text', text: 'Waited for the base, then sold into the Target.' },
            'prompt.close-review.key-lesson': { kind: 'Text', text: 'A Target that holds is worth selling into.' },
          },
        },
      },
    }),
  );

  // Friday's Review: every open Trade's Review Date Mark, then an Action of each kind and a Settle Later.
  // Stock Stops 47.50 and Targets 56.00 give the Plan Call each Action is saved against.
  for (const [symbol, price] of [['CSCO', '52.00'], ['KO', '51.00'], ['PFE', '52.00'], ['XYZ', '46.00'], ['QRS', '51.00']] as const) await markSaved(symbol, price);
  const review = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: AS_OF });
  if (review.kind !== 'Ready' || review.reviewDate !== REVIEW_DATE) throw new Error(`DailyReview.open: ${review.kind}`);
  const reviewed = review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
  let binding = review.binding;
  // XYZ names two Trades: the stock position and the call that is Settlement Due.
  async function card(underlying: string, settlementDue = false) {
    const item = reviewed.find((t) => t.underlying === underlying && (t.band === 'SettlementDue') === settlementDue);
    if (!item) throw new Error(`${underlying} is not in the Review`);
    const form = await app.DailyReview.getTrade({ reviewDate: REVIEW_DATE, tradeId: item.tradeId, binding });
    if (form.kind !== 'Ready') throw new Error(`getTrade ${underlying}: ${JSON.stringify(form)}`);
    return form.trade;
  }
  async function act(underlying: string, request: { action: 'Hold' | 'Exit' | 'Roll' | 'Adjust'; intent?: string } | 'SettleLater') {
    const trade = await card(underlying, request === 'SettleLater');
    const result = await app.DailyReview.save(
      request === 'SettleLater' ? { kind: 'SettleLater', binding: trade.saveBinding } : { kind: 'SaveTradeAction', binding: trade.saveBinding, ...request },
    );
    if (result.kind !== 'Saved') throw new Error(`DailyReview.save ${underlying}: ${JSON.stringify(result)}`);
    if (result.review.kind === 'Ready') binding = result.review.binding;
  }
  await act('CSCO', { action: 'Hold' });
  await act('KO', { action: 'Hold', intent: 'Still above 49; let the Target work.' });
  await act('XYZ', { action: 'Exit' });
  await act('PFE', { action: 'Exit', intent: 'Sell at tomorrow open; the base is not holding.' });
  await act('QRS', { action: 'Roll', intent: 'Move the position into the next base at a higher Stop.' });
  await act('MNO', { action: 'Adjust', intent: 'Widen the Stop to give the put room.' });
  await act('XYZ', 'SettleLater');

  const dump: WorkspaceDump = { schemaVersion: SCHEMA_VERSION, generatorVersion: GENERATOR_VERSION, asOf: AS_OF, databases: await dumpDatabases(factory) };
  const views = await viewsOf(app, SCHEMA_VERSION, AS_OF);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'dump.json'), `${JSON.stringify(dump, null, 2)}\n`);
  await writeFile(path.join(dir, 'expected-views.json'), `${JSON.stringify(views, null, 2)}\n`);
  console.log(`fixtures:freeze OK: ${dir} (schema ${SCHEMA_VERSION}, seeded at Journal manifest 6)`);
}
