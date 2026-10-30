// The five-Trade Review fixture (breakdown D4, section 4), built through the real module APIs:
// plans are confirmed and fills recorded by the Trade Workflows, Marks saved by Market Data, and
// Actions saved by the Journal. All fills are Long Stock on Monday 2026-10-12 at 10:00, fee 1.00.
import { IDBFactory } from 'fake-indexeddb';
import { createDailyReview } from '../../src/coordinators/daily-review/index.ts';
import type { PositionChangeMember } from '../../src/coordinators/trade-workflows/index.ts';
import { nyseSessionPolicy } from '../../src/domain/session-policy/index.ts';
import type { TradeAnalysisRecord } from '../../src/domain/trade-analysis/index.ts';
import { D3_JOURNAL_MANIFEST, type ReflectionDisposition } from '../../src/modules/journal/index.ts';
import { createMarketData, type MarketDataSaveResult } from '../../src/modules/market-data/index.ts';
import { beginSemanticTransaction } from '../../src/persistence/index.ts';
import { onboardedStack } from './onboarded.ts';
import { sequentialIds } from './workspace.ts';

// Monday 2026-10-12 17:00 America/New_York; the session closed at 16:00 (20:00Z).
export const MONDAY_1700 = '2026-10-12T21:00:00Z';
export const MONDAY_1615 = '2026-10-12T20:15:00Z';
export const MONDAY_CUTOFF = '2026-10-12T20:00:00Z';
export const REVIEW_DATE = '2026-10-12';
const PLAN_TIME = '2026-10-12T13:00:00Z';
export const TEN_AM = '2026-10-12T14:00:00Z';
export const ELEVEN_AM = '2026-10-12T15:00:00Z';

export interface PlanSpec {
  readonly symbol: string;
  readonly shares: string;
  readonly entry: string;
  readonly stop: string;
  readonly target: string;
  // Defaults to Monday 09:00 New York.
  readonly planTime?: string;
}

export async function reviewStack(now = MONDAY_1700) {
  const factory = new IDBFactory();
  const stack = await onboardedStack(factory, now);
  const seeded = await stack.journal.seedDefaults(D3_JOURNAL_MANIFEST);
  if (seeded.kind !== 'Seeded') throw new Error(`Daily Trade Review seed failed: ${seeded.kind}`);
  const marketData = createMarketData({ persistence: stack.persistence, ids: sequentialIds('md'), clock: stack.clock, sessionPolicy: nyseSessionPolicy });
  const dailyReview = createDailyReview({ ...stack, marketData });
  const positionChangeDefinition = await stack.journal.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
  if (positionChangeDefinition.kind !== 'Found') throw new Error('no Position Change Reflection definition');
  const reflection: ReflectionDisposition = {
    kind: 'Complete',
    form: {
      definitionId: positionChangeDefinition.definition.id,
      answers: {
        'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
        'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
        'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
      },
    },
  };

  const confirm = async (plan: PlanSpec): Promise<TradeAnalysisRecord> => {
    const confirmed = await stack.tradeWorkflows.confirmPlan({
      accountId: stack.account.id,
      accountRevision: stack.account.recordRevision,
      strategyId: stack.strategy.id,
      strategyRevision: stack.strategy.recordRevision,
      economicTime: plan.planTime ?? PLAN_TIME,
      plan: {
        underlying: plan.symbol,
        legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: plan.symbol }, quantity: plan.shares, intendedEntry: plan.entry }],
        stops: [{ kind: 'UnderlyingPrice', price: plan.stop }],
        targets: [{ kind: 'UnderlyingPrice', price: plan.target }],
      },
      reflection: {
        definitionId: stack.definition.id,
        answers: {
          'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Breakout above the 50-day on volume.' },
          'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'A close back below the stop.' },
        },
      },
    });
    if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${confirmed.kind}`);
    return confirmed.postCommit.trade;
  };

  // One Position Change holding an Execution per fill, at the Trade's current FactRevision.
  // `disposition` defaults to the completed reflection; a Debt fixture passes Defer.
  const fillTogether = async (trade: TradeAnalysisRecord, fills: readonly { economicTime: string; quantity: string; price: string }[], disposition: ReflectionDisposition = reflection): Promise<void> => {
    const current = await stack.tradeRecord.getRecord({ tradeId: trade.tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    const members: PositionChangeMember[] = fills.map(({ economicTime, quantity, price }) => ({
      kind: 'Execution',
      tradeId: trade.tradeId,
      action: 'Buy',
      instrument: { kind: 'Stock', symbol: trade.plan.underlying },
      intent: { kind: 'ServesPlannedLeg', plannedLegId: trade.plan.legs[0]!.factId },
      quantity,
      price,
      fee: '1.00',
      economicTime,
    }));
    const result = await stack.tradeWorkflows.recordPositionChange({
      originTradeId: trade.tradeId,
      trades: [{ tradeId: trade.tradeId, expectedFactRevision: current.factRevision }],
      members,
      reflection: disposition,
    });
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${result.kind}`);
  };

  // One single-Execution Position Change.
  const fill = (trade: TradeAnalysisRecord, economicTime: string, quantity: string, price: string, disposition?: ReflectionDisposition): Promise<void> =>
    fillTogether(trade, [{ economicTime, quantity, price }], disposition);

  const saveMark = async (instrumentKey: string, price: string, tradingDate = REVIEW_DATE): Promise<MarketDataSaveResult> => {
    const saved = await marketData.save({ intention: 'RecordInitialManualMark', instrumentKey, tradingDate, price, expectedResolutionRevision: 'None' });
    if (saved.kind !== 'Saved') throw new Error(`expected Saved, got ${saved.kind}`);
    return saved;
  };

  const acknowledge = async (instrumentKey: string, tradingDate = REVIEW_DATE): Promise<void> => {
    const saved = await marketData.save({ intention: 'AssertUnavailable', instrumentKey, tradingDate, reason: 'No quote available.', expectedResolutionRevision: 'None' });
    if (saved.kind !== 'Saved') throw new Error(`expected Saved, got ${saved.kind}`);
  };

  // A Daily Trade Review Action saved through the Journal (the Review's own save is T4.16).
  const saveAction = async (tradeId: string, action: 'Hold' | 'Exit' | 'Roll' | 'Adjust' = 'Hold', reviewDate = REVIEW_DATE): Promise<void> => {
    const definition = await stack.journal.getDefinitions({ latestFor: 'entry-type.daily-trade-review' });
    if (definition.kind !== 'Found') throw new Error('no Daily Trade Review definition');
    const prepared = await stack.journal.prepareEffects({
      obligation: 'DailyTradeReview',
      disposition: {
        kind: 'Complete',
        form: {
          definitionId: definition.definition.id,
          answers: {
            'prompt.daily-trade-review.action': { kind: 'Option', optionId: `option.daily-trade-review.action.${action.toLowerCase()}` },
            ...(action === 'Hold' ? {} : { 'prompt.daily-trade-review.intent': { kind: 'Text', text: 'Because the plan changed.' } }),
          },
        },
      },
      anchor: { kind: 'Trade', ref: tradeId },
      origin: { kind: 'DailyReview', ref: tradeId, reviewDate },
      momentTime: MONDAY_CUTOFF,
    });
    if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${JSON.stringify(prepared)}`);
    const tx = beginSemanticTransaction();
    stack.journal.applyPreparedEffects(tx, prepared, {});
    const committed = await stack.persistence.commit(tx.close());
    if (committed.kind !== 'Committed') throw new Error(`expected Committed, got ${committed.kind}`);
  };

  return { ...stack, factory, marketData, dailyReview, confirm, fill, fillTogether, saveMark, acknowledge, saveAction };
}

export type ReviewStack = Awaited<ReturnType<typeof reviewStack>>;

export interface FiveTrades {
  readonly a: string;
  readonly b: string;
  readonly c: string;
  readonly d: string;
  readonly e: string;
}

// The five Trades with their Monday Marks (none for DEF); without T-D it has four Trades.
export async function fiveTradeFixture(stack: ReviewStack, options: { readonly withoutD?: boolean; readonly withoutMarks?: boolean } = {}): Promise<FiveTrades> {
  const a = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
  await stack.fill(a, TEN_AM, '60', '50.10');
  await stack.fill(a, ELEVEN_AM, '40', '50.30');
  const b = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
  await stack.fill(b, TEN_AM, '100', '30.00');
  const c = await stack.confirm({ symbol: 'DEF', shares: '100', entry: '40.00', stop: '38.00', target: '46.00' });
  await stack.fill(c, TEN_AM, '100', '40.00');
  const e = await stack.confirm({ symbol: 'JKL', shares: '100', entry: '20.00', stop: '19.00', target: '30.00' });
  await stack.fill(e, TEN_AM, '100', '20.00');
  // Monday's Marks cannot be saved before the session completes at 16:30.
  const mark = options.withoutMarks ? () => Promise.resolve() : async (symbol: string, price: string) => void (await stack.saveMark(symbol, price));
  await mark('XYZ', '52.00');
  await mark('ABC', '27.50');
  await mark('JKL', '21.00');
  if (options.withoutD) return { a: a.tradeId, b: b.tradeId, c: c.tradeId, d: '', e: e.tradeId };
  const d = await stack.confirm({ symbol: 'GHI', shares: '100', entry: '60.00', stop: '57.00', target: '70.00' });
  await stack.fill(d, TEN_AM, '120', '60.00');
  await mark('GHI', '61.00');
  await removeRecordedDeviations(stack, d.tradeId);
  return { a: a.tradeId, b: b.tradeId, c: c.tradeId, d: d.tradeId, e: e.tradeId };
}

// The integrity fixture writer: edits the stored Trade document directly, as the earlier
// deliverables' integrity cases do.
export async function rawEditTrade(stack: ReviewStack, tradeId: string, edit: (trade: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
  const root = await openRaw(stack.factory, 'tj-root');
  const pointer = await new Promise<{ databaseName: string }>((resolve) => {
    const get = root.transaction('pointer').objectStore('pointer').get('current');
    get.onsuccess = () => resolve(get.result as { databaseName: string });
  });
  root.close();
  const db = await openRaw(stack.factory, pointer.databaseName);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('trades', 'readwrite');
    const store = tx.objectStore('trades');
    const get = store.get(tradeId);
    get.onsuccess = () => store.put(edit(get.result as Record<string, unknown>));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('update failed'));
  });
  db.close();
}

// Its recorded Entry Size occurrence is gone while the facts still imply it.
const removeRecordedDeviations = (stack: ReviewStack, tradeId: string) => rawEditTrade(stack, tradeId, (trade) => ({ ...trade, deviations: [] }));

// Its first Execution names a Planned Leg that does not exist, so its facts cannot be replayed.
type Fact = { factId: string; kind: string; versions: { value: Record<string, unknown> }[] };
export const breakFirstExecution = (stack: ReviewStack, tradeId: string) =>
  rawEditTrade(stack, tradeId, (trade) => {
    const facts = trade['facts'] as Fact[];
    const execution = facts.find((f) => f.kind === 'Execution');
    return {
      ...trade,
      facts: facts.map((fact) =>
        fact === execution
          ? { ...fact, versions: fact.versions.map((v) => ({ ...v, value: { ...v.value, intent: { kind: 'ServesPlannedLeg', plannedLegId: 'leg-unknown' } } })) }
          : fact,
      ),
    };
  });

function openRaw(factory: IDBFactory, database: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = factory.open(database);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
  });
}
