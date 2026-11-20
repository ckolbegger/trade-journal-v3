// D9's test Trades (breakdown, section 5) entered through the real facade (createApplication on fake-indexeddb): the Plan, each Position
// Change of the series' record and a Mark per session, all with the device clock at `now`. Facade operations only.
import type { Application } from '../../src/app/compose.ts';
import { instrumentKey, type Instrument } from '../../src/domain/instrument/index.ts';
import { REPLAY_SESSION_DATES, type ReplayTestSeries } from '../../src/domain/trade-analysis/reference-trade.ts';
import type { ExpirationMember, PositionChangeMember } from '../../src/coordinators/trade-workflows/index.ts';
import { planCommand } from '../integration/d1/support.ts';
import { closeReviewDisposition, complete, device, loaded, onboarded, restart, saveMark, strategyOf, type Device } from '../integration/d7s/support.ts';

export interface SeriesOptions {
  // Marks are saved for the sessions REPLAY_SESSION_DATES[0..marksThrough].
  readonly marksThrough: number;
  // The last Position Change closes the Trade (a sale names a Close Reason; an Expiration reviews the close alone).
  readonly closes?: boolean;
  readonly without?: (positionChangeId: string) => boolean;
  readonly extraMarks?: readonly { readonly instrument: Instrument; readonly date: string; readonly price: string }[];
  // A held-Instrument Mark to leave unsaved, by session date.
  readonly skipHeldOn?: readonly string[];
}

export interface SeriesApp {
  readonly d: Device;
  readonly app: Application;
  readonly tradeId: string;
}

async function firstCloseReasonId(app: Application): Promise<string> {
  const page = await app.ReferenceCatalog.query({ family: 'CloseReason' });
  if (page.kind !== 'Page' || page.items.length === 0) throw new Error('no Close Reasons');
  return page.items[0]!.id;
}

// One series entered into a Workspace that is already onboarded; the caller restarts the app when every series is in.
async function addSeries(app: Application, series: ReplayTestSeries, strategyKey: string, options: SeriesOptions): Promise<string> {
  const { plan } = series.record;
  const leg = plan.legs[0]!;
  const base = await planCommand(app, { underlying: plan.underlying, economicTime: plan.economicTime });
  const strategy = await strategyOf(app, strategyKey);
  const confirmed = await app.TradeWorkflows.confirmPlan({
    ...base,
    strategyId: strategy.id,
    strategyRevision: strategy.recordRevision,
    plan: {
      underlying: plan.underlying,
      legs: [{ side: leg.side, instrument: leg.instrument, quantity: leg.quantity, intendedEntry: leg.intendedEntry }],
      stops: [{ kind: plan.stops[0]!.kind, price: plan.stops[0]!.price }],
      targets: [{ kind: plan.targets[0]!.kind, price: plan.targets[0]!.price }],
      ...(leg.side === 'Long' && leg.instrument.kind === 'Option' && { exerciseIntent: 'NotAuthorized' as const }),
    },
  });
  if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan: ${JSON.stringify(confirmed)}`);
  const tradeId = confirmed.receipt.tradeId;

  const changes = series.record.positionChanges.filter((pc) => !options.without?.(pc.factId));
  for (const [i, pc] of changes.entries()) {
    const { factRevision, leg: planned } = await loaded(app, tradeId);
    const members: (PositionChangeMember | ExpirationMember)[] = [
      ...pc.executions.map((e): PositionChangeMember => ({ kind: 'Execution', tradeId, action: e.action, instrument: e.instrument, intent: { kind: 'ServesPlannedLeg', plannedLegId: planned.factId }, quantity: e.quantity.replace('-', ''), price: e.price, fee: e.fee, economicTime: e.economicTime })),
      ...(pc.settlements ?? []).map((s): ExpirationMember => ({ kind: 'Expiration', tradeId, instrument: s.instrument, quantity: s.quantity, economicTime: s.economicTime })),
    ];
    const closing = options.closes === true && i === changes.length - 1;
    const expiring = members.some((m) => m.kind === 'Expiration');
    const result = await app.TradeWorkflows.recordPositionChange({
      originTradeId: tradeId,
      trades: [{ tradeId, expectedFactRevision: factRevision }],
      members,
      reflection: await complete(app),
      ...(closing && { ...(!expiring && { closeReasonId: await firstCloseReasonId(app) }), closeReview: await closeReviewDisposition(app, 'Complete') }),
    });
    if (result.kind !== 'Recorded') throw new Error(`recordPositionChange: ${JSON.stringify(result)}`);
  }

  const underlying: Instrument = { kind: 'Stock', symbol: plan.underlying };
  for (const [i, date] of REPLAY_SESSION_DATES.slice(0, options.marksThrough + 1).entries()) {
    const stock = series.underlying[i];
    const held = series.held[i];
    if (stock !== null && stock !== undefined) await saveMark(app, instrumentKey(underlying), date, stock);
    // A stock Trade's held Instrument is its Underlying, whose Mark is saved once.
    if (held !== null && held !== undefined && leg.instrument.kind === 'Option' && !(options.skipHeldOn ?? []).includes(date)) await saveMark(app, instrumentKey(leg.instrument), date, held);
  }
  for (const { instrument, date, price } of options.extraMarks ?? []) await saveMark(app, instrumentKey(instrument), date, price);
  return tradeId;
}

export async function seriesApp(series: ReplayTestSeries, strategyKey: string, now: string, options: SeriesOptions): Promise<SeriesApp> {
  const d = await device(undefined, now);
  const entered = await onboarded(d);
  const tradeId = await addSeries(entered, series, strategyKey, options);
  // A fresh launch, so no read is warmed by the writes.
  return { d, app: await restart(entered, d), tradeId };
}

export interface SeriesBook {
  readonly d: Device;
  readonly app: Application;
  // Each series' Trade, in the order the series were given.
  readonly tradeIds: readonly string[];
}

// Several series entered into one Workspace, then one fresh launch.
export async function seriesBook(now: string, entries: readonly (readonly [ReplayTestSeries, string, SeriesOptions])[]): Promise<SeriesBook> {
  const d = await device(undefined, now);
  const entered = await onboarded(d);
  const tradeIds: string[] = [];
  for (const [series, strategyKey, options] of entries) tradeIds.push(await addSeries(entered, series, strategyKey, options));
  return { d, app: await restart(entered, d), tradeIds };
}

// The Detail's binding, then the replay with it, as the cockpit asks.
export async function replayView(app: Application, tradeId: string) {
  const detail = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  if (detail.kind !== 'Ready') throw new Error(`getTradeDetail: ${detail.kind}`);
  const result = await app.TradeViewsAndReporting.replayTrade({ tradeId, binding: detail.binding });
  return { detail, result };
}

export async function readyReplay(app: Application, tradeId: string) {
  const { result } = await replayView(app, tradeId);
  if (result.kind !== 'Ready' || !('sessions' in result.view)) throw new Error(`replayTrade: ${JSON.stringify(result).slice(0, 200)}`);
  return result.view;
}
