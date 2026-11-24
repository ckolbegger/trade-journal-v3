import { instrumentKey, type Instrument } from '../../src/domain/instrument/index.ts';
import { REPLAY_SESSION_DATES, type ReplayTestSeries } from '../../src/domain/trade-analysis/reference-trade.ts';
import { D6_JOURNAL_MANIFEST, type ReflectionDisposition } from '../../src/modules/journal/index.ts';
import { D7_CATALOG_MANIFEST, type StrategyRecord } from '../../src/modules/reference-catalog/index.ts';
import type { ExpirationMember, PositionChangeMember } from '../../src/coordinators/trade-workflows/index.ts';
import { createTradeViews } from '../../src/coordinators/trade-views/index.ts';
import { reviewStack } from './review-fixture.ts';

// D9's test Trades (breakdown, section 5) recorded through the real stack: the Plan and each Position Change of the series' record,
// and a Mark per session for the Underlying and the held contract, up to `marksThrough` (an index into REPLAY_SESSION_DATES).
export async function seriesStack(series: ReplayTestSeries, strategyKey: string, now: string, options: { readonly marksThrough: number; readonly closes?: boolean; readonly without?: (pcId: string) => boolean; readonly extraMarks?: readonly { readonly instrument: Instrument; readonly date: string; readonly price: string }[] }) {
  const stack = await reviewStack(now);
  await stack.catalog.seedDefaults(D7_CATALOG_MANIFEST);
  await stack.journal.seedDefaults(D6_JOURNAL_MANIFEST);
  const strategies = await stack.catalog.query({ family: 'Strategy' });
  const strategy = strategies.kind === 'Page' ? strategies.items.find((s): s is StrategyRecord => s.kind === 'Strategy' && s.productKey === strategyKey) : undefined;
  if (!strategy) throw new Error(`no ${strategyKey}`);
  const closeReview = await stack.journal.getDefinitions({ latestFor: 'entry-type.close-review' });
  if (closeReview.kind !== 'Found') throw new Error('no Close Review definition');
  const closeReviewForm: ReflectionDisposition = {
    kind: 'Complete',
    form: { definitionId: closeReview.definition.id, answers: { 'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' }, 'prompt.close-review.key-lesson': { kind: 'Text', text: 'Size down into earnings.' } } },
  };
  const reasons = await stack.catalog.query({ family: 'CloseReason' });
  if (reasons.kind !== 'Page') throw new Error('no Close Reasons');
  const { plan } = series.record;
  const leg = plan.legs[0]!;
  const confirmed = await stack.tradeWorkflows.confirmPlan({
    accountId: stack.account.id,
    accountRevision: stack.account.recordRevision,
    strategyId: strategy.id,
    strategyRevision: strategy.recordRevision,
    economicTime: plan.economicTime,
    plan: {
      underlying: plan.underlying,
      legs: [{ side: leg.side, instrument: leg.instrument, quantity: leg.quantity, intendedEntry: leg.intendedEntry }],
      stops: [{ kind: plan.stops[0]!.kind, price: plan.stops[0]!.price }],
      targets: [{ kind: plan.targets[0]!.kind, price: plan.targets[0]!.price }],
      ...(leg.side === 'Long' && leg.instrument.kind !== 'Stock' && { exerciseIntent: 'NotAuthorized' }),
    },
    reflection: {
      definitionId: stack.definition.id,
      answers: { 'prompt.plan-reflection.thesis': { kind: 'Text', text: series.id }, 'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'The Stop.' } },
    },
  });
  if (confirmed.kind !== 'Confirmed') throw new Error(`expected Confirmed, got ${JSON.stringify(confirmed)}`);
  const tradeId = confirmed.postCommit.trade.tradeId;
  const legId = confirmed.postCommit.trade.plan.legs[0]!.factId;

  const changes = series.record.positionChanges.filter((pc) => !options.without?.(pc.factId));
  for (const [i, pc] of changes.entries()) {
    const current = await stack.tradeRecord.getRecord({ tradeId, projection: 'AnalysisInput' });
    if (current.kind !== 'Found') throw new Error('no Trade');
    const members: (PositionChangeMember | ExpirationMember)[] = [
      ...pc.executions.map((e): PositionChangeMember => ({ kind: 'Execution', tradeId, action: e.action, instrument: e.instrument, intent: { kind: 'ServesPlannedLeg', plannedLegId: legId }, quantity: e.quantity.replace('-', ''), price: e.price, fee: e.fee, economicTime: e.economicTime })),
      ...(pc.settlements ?? []).map((s): ExpirationMember => ({ kind: 'Expiration', tradeId, instrument: s.instrument, quantity: s.quantity, economicTime: s.economicTime })),
    ];
    // A sale that closes the Trade names a Close Reason and reviews it; an Expiration closes it with the review alone.
    const closing = options.closes === true && i === changes.length - 1;
    const expiring = members.some((m) => m.kind === 'Expiration');
    const result = await stack.tradeWorkflows.recordPositionChange({
      originTradeId: tradeId,
      trades: [{ tradeId, expectedFactRevision: current.factRevision }],
      members,
      reflection: stack.reflection,
      ...(closing && { ...(!expiring && { closeReasonId: reasons.items[0]!.id }), closeReview: closeReviewForm }),
    });
    if (result.kind !== 'Recorded') throw new Error(`expected Recorded, got ${JSON.stringify(result)}`);
  }
  const held = leg.instrument;
  const underlying: Instrument = { kind: 'Stock', symbol: plan.underlying };
  for (const [i, date] of REPLAY_SESSION_DATES.slice(0, options.marksThrough + 1).entries()) {
    const stock = series.underlying[i];
    const option = series.held[i];
    if (stock !== null && stock !== undefined) await stack.saveMark(instrumentKey(underlying), stock, date);
    if (option != null) await stack.saveMark(instrumentKey(held), option, date);
  }
  for (const { instrument, date, price } of options.extraMarks ?? []) await stack.saveMark(instrumentKey(instrument), price, date);

  const views = createTradeViews(stack);
  const replay = async () => {
    const detail = await views.getTradeDetail({ tradeId });
    if (detail.kind !== 'Ready') throw new Error(`expected Ready, got ${detail.kind}`);
    return views.replayTrade({ tradeId, binding: detail.binding });
  };
  return { stack, views, tradeId, replay };
}
