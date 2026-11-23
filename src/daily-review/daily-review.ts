import {
  buildDailyTradeReviewDefinition,
  DAILY_REVIEW_ACTION_OPTIONS,
  DAILY_TRADE_REVIEW_TYPE_ID,
  validatePositionChangeReflectionInput,
  type DailyReviewAction,
  type DecisionMode,
  type PrimaryEmotion,
} from '../journal/journal';
import {
  formatSessionDateShort,
  getCompletedSessionsBetween,
  getExchangeDateForInstant,
  getLatestCompletedSessionDate,
  getNextTradingDate,
  isUsTradingDay,
} from '../market-data/session-calendar';
import type {
  DeviationRecord,
  ExecutionRecord,
  JournalDebtRecord,
  JournalDeclineRecord,
  JournalEntryRecord,
  MarketMarkRecord,
  PersistenceSeam,
  PlanVersionFactRecord,
  TradeRecordRow,
} from '../persistence/idb';
import type { Clock } from '../shared/clock';
import {
  add,
  div,
  ExactNumber,
  fromInteger,
  isPositive,
  mul,
  sub,
  toDecimalString,
  toMoneyString,
  type Rational,
} from '../shared/exact-number';
import type { RuntimeNotWritableResult } from '../shared/result';
import { deriveLongStockPosition, type DerivedLongStockState } from '../trade-analysis/derive';
import {
  evaluateLongStockTrade,
  type AvailableLongStockEvaluation,
  type LongStockEvaluation,
} from '../trade-analysis/evaluate';
import {
  diffStopDisciplineDeviationRecords,
  extractDailyReviewActions,
} from '../trade-analysis/replay';

export type DailyReviewCompletionState =
  | 'Incomplete'
  | 'Complete'
  | 'CompleteWithUnavailableMarks';

export type TradeStanding =
  | { readonly kind: 'PastStop'; readonly overrunR: number }
  | { readonly kind: 'AtTarget'; readonly overrunR: number }
  | { readonly kind: 'Inside'; readonly towards: 'Stop' | 'Target'; readonly pct: number }
  | { readonly kind: 'Unmarked' };

export interface DailyReviewExpectedSnapshot {
  readonly reviewDate: string;
  readonly marketSnapshotId: number;
  readonly tradeFactRevisions: Readonly<Record<string, number>>;
  readonly actionEntryIds: Readonly<Record<string, string | null>>;
  readonly outstandingDebtIds: readonly string[];
}

export interface DailyReviewMarkRow {
  readonly symbol: string;
  readonly openTradeCount: number;
  readonly priorSessionDate: string | null;
  readonly priorMarkDisplay: string | null;
  readonly referencePrice: Rational | null;
  readonly todayMarkDisplay: string | null;
  readonly todayMarkRaw: string;
  readonly todayUnavailableAcknowledged: boolean;
  readonly skippedMarksByDate: Readonly<Record<string, string>>;
}

export interface DailyReviewPastDecision {
  readonly reviewDate: string;
  readonly reviewDateShort: string;
  readonly action: string;
  readonly reason: string | null;
  readonly conviction: number | null;
}

export interface DailyReviewPlanCheck {
  readonly exitFollowsPlan: boolean;
  readonly reasonIfLeaving: string | null;
}

export interface StaleExitDecision {
  readonly priorReviewDate: string;
  readonly priorReviewDateShort: string;
  readonly priorAction: DailyReviewAction;
  readonly priorReason: string | null;
  readonly soldSinceDisplay: string | null;
}

export interface DailyReviewTradeItem {
  readonly tradeId: string;
  readonly symbol: string;
  readonly strategyLabel: string;
  readonly accountLabel: string;
  readonly institutionLabel: string;
  readonly openSharesDisplay: string;
  readonly plannedQuantityDisplay: string;
  readonly intendedEntryDisplay: string;
  readonly stopPriceDisplay: string;
  readonly targetPriceDisplay: string;
  readonly oneRDisplay: string;
  readonly plannedRewardDisplay: string;
  readonly thesis: string;
  readonly invalidation: string;
  readonly derived: DerivedLongStockState;
  readonly evaluation: LongStockEvaluation;
  readonly standing: TradeStanding;
  readonly isResolvedForToday: boolean;
  readonly strict: boolean;
  readonly planCheck: DailyReviewPlanCheck;
  readonly staleExit: StaleExitDecision | null;
  readonly stopDisciplineDeviations: readonly DeviationRecord[];
  readonly todayAction: {
    readonly entryId: string;
    readonly action: DailyReviewAction;
    readonly reason: string | null;
    readonly conviction: number | null;
    readonly consideredAgainst: string | null;
    readonly note: string | null;
    readonly recordedAt: string;
  } | null;
  readonly pastDecisions: readonly DailyReviewPastDecision[];
  readonly holdPastStopStreak: number;
  readonly holdPastTargetStreak: number;
  readonly stopPrice: Rational;
  readonly targetPrice: Rational;
  readonly oneR: Rational;
}

export interface DailyReviewDebtItem {
  readonly debt: JournalDebtRecord;
  readonly symbol: string;
  readonly strategyLabel: string;
  readonly summary: string;
}

export interface DailyReviewDaySummary {
  readonly dayPnlChangeDisplay: string | null;
  readonly dayPnlChangePositive: boolean | null;
  readonly totalOpenPnlDisplay: string | null;
  readonly totalOpenPnlPositive: boolean | null;
  readonly pastStopSymbols: readonly string[];
  readonly atTargetSymbols: readonly string[];
  readonly chosenHoldSymbols: readonly string[];
  readonly chosenExitSymbols: readonly string[];
  readonly tomorrowItems: readonly string[];
  readonly nextSessionDateShort: string;
}

export interface DailyReviewAfterCutoffTrade {
  readonly tradeId: string;
  readonly symbol: string;
  readonly entrySessionDate: string;
  readonly entrySessionDateShort: string;
}

export interface DailyReviewViewModel {
  readonly reviewDate: string;
  readonly reviewDateShort: string;
  readonly completionState: DailyReviewCompletionState;
  readonly expectedSnapshot: DailyReviewExpectedSnapshot;
  readonly marks: readonly DailyReviewMarkRow[];
  readonly skippedSessions: readonly { readonly date: string; readonly short: string }[];
  readonly dueDebt: readonly DailyReviewDebtItem[];
  readonly trades: readonly DailyReviewTradeItem[];
  readonly openedAfterCutoffTrades: readonly DailyReviewAfterCutoffTrade[];
  readonly daySummary: DailyReviewDaySummary;
}

export type DailyReviewSaveCommand =
  | {
      readonly kind: 'SaveTradeAction';
      readonly tradeId: string;
      readonly reviewDate: string;
      readonly action: DailyReviewAction;
      readonly reason?: string;
      readonly conviction?: number;
      readonly consideredAgainst?: string;
      readonly note?: string;
      readonly expectedSnapshot: DailyReviewExpectedSnapshot;
    }
  | {
      readonly kind: 'ResolveReviewDebt';
      readonly debtId: string;
      readonly reviewDate: string;
      readonly mode: 'Complete';
      readonly decisionMode: DecisionMode;
      readonly primaryEmotion: PrimaryEmotion;
      readonly confidence: number;
      readonly note?: string;
      readonly expectedSnapshot: DailyReviewExpectedSnapshot;
    }
  | {
      readonly kind: 'ResolveReviewDebt';
      readonly debtId: string;
      readonly reviewDate: string;
      readonly mode: 'Decline';
      readonly declineReason?: string;
      readonly expectedSnapshot: DailyReviewExpectedSnapshot;
    };

export type DailyReviewSaveResult =
  | { readonly status: 'Saved'; readonly recordId: string }
  | { readonly status: 'ReviewChanged'; readonly reason: string }
  | { readonly status: 'Conflict'; readonly reason: string }
  | { readonly status: 'Rejected'; readonly message: string }
  | RuntimeNotWritableResult;

export interface DailyReview {
  open(reviewDate?: string): Promise<DailyReviewViewModel>;
  getTrade(tradeId: string, reviewDate?: string): Promise<DailyReviewTradeItem | null>;
  getDebt(debtId: string): Promise<DailyReviewDebtItem | null>;
  save(command: DailyReviewSaveCommand): Promise<DailyReviewSaveResult>;
}

function genId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatShares(raw: { num: string; den: string }): string {
  const rat = ExactNumber.fromJSON(raw);
  return rat.den === 1n ? rat.num.toString() : toDecimalString(rat, 4).replace(/\.?0+$/, '');
}

function formatMarkRaw(price: Rational): string {
  const s = toDecimalString(price, 6);
  const dot = s.indexOf('.');
  if (dot === -1) return `${s}.00`;
  const trimmed = s.replace(/0+$/, '');
  const decLen = trimmed.length - dot - 1;
  return decLen < 2 ? `${trimmed}${'0'.repeat(2 - decLen)}` : trimmed;
}

function toFloat(r: Rational): number {
  return Number(toDecimalString(r, 4));
}

function computeStanding(evalObj: AvailableLongStockEvaluation | null): TradeStanding {
  if (!evalObj) {
    return { kind: 'Unmarked' };
  }
  if (evalObj.stopCondition.status === 'Breached') {
    const overR = evalObj.stopCondition.overrunDollars
      ? Math.abs(toFloat(evalObj.stopCondition.impactR))
      : 0;
    return { kind: 'PastStop', overrunR: overR };
  }
  if (evalObj.targetCondition.status === 'Reached') {
    const overR = Math.abs(toFloat(evalObj.targetCondition.impactR));
    return { kind: 'AtTarget', overrunR: overR };
  }

  const pnl = evalObj.openPnl;
  if (pnl.num < 0n) {
    // Moving toward Stop: progress = |openPnl| / (|openPnl| + |stopImpact|)
    const distToStop = mul(evalObj.stopCondition.impactDollars, fromInteger(-1));
    const total = add(mul(pnl, fromInteger(-1)), distToStop);
    const pct = isPositive(total)
      ? Math.max(0, Math.min(99, Math.round(toFloat(div(mul(pnl, fromInteger(-1)), total)) * 100)))
      : 0;
    return { kind: 'Inside', towards: 'Stop', pct };
  }

  const distToTarget = evalObj.targetCondition.impactDollars;
  const total = add(pnl, distToTarget);
  const pct = isPositive(total)
    ? Math.max(0, Math.min(99, Math.round(toFloat(div(pnl, total)) * 100)))
    : 0;
  return { kind: 'Inside', towards: 'Target', pct };
}

function rankKey(item: {
  readonly standing: TradeStanding;
  readonly staleExit: StaleExitDecision | null;
  readonly hasTodayAction?: boolean;
}): readonly [number, number] {
  if (item.staleExit && !item.hasTodayAction) {
    return [-1, 0];
  }
  switch (item.standing.kind) {
    case 'PastStop':
      return [0, -item.standing.overrunR];
    case 'AtTarget':
      return [1, -item.standing.overrunR];
    case 'Inside':
      return item.standing.towards === 'Stop'
        ? [2, -item.standing.pct]
        : [3, item.standing.pct];
    case 'Unmarked':
      return [4, 0];
  }
}

function computeExitPlanCheck(params: {
  readonly standing: TradeStanding;
  readonly holdPastStopStreak: number;
  readonly holdPastTargetStreak: number;
}): DailyReviewPlanCheck {
  const { standing, holdPastStopStreak, holdPastTargetStreak } = params;
  if (standing.kind === 'PastStop') {
    if (holdPastStopStreak > 0) {
      return {
        exitFollowsPlan: false,
        reasonIfLeaving: `You held past the Stop for ${holdPastStopStreak} prior ${holdPastStopStreak === 1 ? 'session' : 'sessions'}; exiting now leaves the Plan.`,
      };
    }
    return { exitFollowsPlan: true, reasonIfLeaving: null };
  }
  if (standing.kind === 'AtTarget') {
    if (holdPastTargetStreak > 0) {
      return {
        exitFollowsPlan: false,
        reasonIfLeaving: `You held past the Target for ${holdPastTargetStreak} prior ${holdPastTargetStreak === 1 ? 'session' : 'sessions'}; exiting now leaves the Plan.`,
      };
    }
    return { exitFollowsPlan: true, reasonIfLeaving: null };
  }
  return {
    exitFollowsPlan: false,
    reasonIfLeaving: 'Neither the Stop nor the Target is reached; exiting now leaves the Plan.',
  };
}

function computeHoldStreaks(params: {
  readonly priorDtrs: readonly JournalEntryRecord[];
  readonly symMarks: readonly MarketMarkRecord[];
  readonly stopPrice: Rational;
  readonly targetPrice: Rational;
}): { holdPastStopStreak: number; holdPastTargetStreak: number } {
  const { priorDtrs, symMarks, stopPrice, targetPrice } = params;
  let holdPastStopStreak = 0;
  let holdPastTargetStreak = 0;
  for (const e of priorDtrs) {
    const d = extractDailyReviewDate(e);
    if (!d || e.responses.action !== 'Hold') break;
    const m = symMarks.find((mk) => mk.sessionDate === d);
    if (!m) break;
    const p = ExactNumber.fromJSON(m.price);
    if (sub(p, stopPrice).num <= 0n) {
      holdPastStopStreak += 1;
    } else {
      break;
    }
  }
  for (const e of priorDtrs) {
    const d = extractDailyReviewDate(e);
    if (!d || e.responses.action !== 'Hold') break;
    const m = symMarks.find((mk) => mk.sessionDate === d);
    if (!m) break;
    const p = ExactNumber.fromJSON(m.price);
    if (sub(p, targetPrice).num >= 0n) {
      holdPastTargetStreak += 1;
    } else {
      break;
    }
  }
  return { holdPastStopStreak, holdPastTargetStreak };
}

function obligationKeyFor(tradeId: string, reviewDate: string): string {
  return `daily_review:${tradeId}:${reviewDate}`;
}

function extractDailyReviewDate(entry: JournalEntryRecord): string | null {
  if (entry.origin.kind === 'DailyReview') {
    return entry.origin.reviewDate;
  }
  return null;
}

export function createDailyReview(options: {
  readonly persistence: PersistenceSeam;
  readonly clock: Clock;
}): DailyReview {
  const { persistence, clock } = options;

  async function buildOpenView(reviewDateOverride?: string): Promise<DailyReviewViewModel> {
    const reviewDate = reviewDateOverride ?? getLatestCompletedSessionDate(clock.now());

    return persistence.runReadTransaction(
      [
        'trades',
        'trade_facts',
        'position_changes',
        'executions',
        'deviations',
        'catalog_institutions',
        'catalog_accounts',
        'catalog_strategies',
        'market_meta',
        'market_marks',
        'market_acknowledgments',
        'journal_entries',
        'journal_debt',
      ],
      async (tx) => {
        const [
          trades,
          tradeFacts,
          positionChanges,
          executions,
          deviations,
          institutions,
          accounts,
          strategies,
          marketMeta,
          allMarks,
          allAcks,
          allEntries,
          allDebt,
        ] = await Promise.all([
          tx.getAll('trades'),
          tx.getAll('trade_facts'),
          tx.getAll('position_changes'),
          tx.getAll('executions'),
          tx.getAll('deviations'),
          tx.getAll('catalog_institutions'),
          tx.getAll('catalog_accounts'),
          tx.getAll('catalog_strategies'),
          tx.get('market_meta', 'singleton'),
          tx.getAll('market_marks'),
          tx.getAll('market_acknowledgments'),
          tx.getAll('journal_entries'),
          tx.getAll('journal_debt'),
        ]);

        const devsByTrade = new Map<string, DeviationRecord[]>();
        for (const dev of deviations) {
          if (dev.voided || dev.kind !== 'StopDiscipline') continue;
          const list = devsByTrade.get(dev.tradeId) ?? [];
          list.push(dev);
          devsByTrade.set(dev.tradeId, list);
        }

        const pcEconomicTimeById = new Map(positionChanges.map((pc) => [pc.id, pc.economicTime]));

        const instMap = new Map(institutions.map((i) => [i.id, i.currentLabel]));
        const acctMap = new Map(accounts.map((a) => [a.id, a.currentLabel]));
        const stratMap = new Map(strategies.map((s) => [s.id, s.currentLabel]));
        const planFactByTrade = new Map<string, PlanVersionFactRecord>();
        for (const f of tradeFacts) {
          const prev = planFactByTrade.get(f.tradeId);
          if (!prev || f.recordedAt.localeCompare(prev.recordedAt) > 0) {
            planFactByTrade.set(f.tradeId, f);
          }
        }

        const execsByTrade = new Map<string, ExecutionRecord[]>();
        for (const ex of executions) {
          const list = execsByTrade.get(ex.tradeId) ?? [];
          list.push(ex);
          execsByTrade.set(ex.tradeId, list);
        }

        const marksBySymbol = new Map<string, MarketMarkRecord[]>();
        for (const m of allMarks) {
          if (!m.effective) continue;
          const list = marksBySymbol.get(m.symbol) ?? [];
          list.push(m);
          marksBySymbol.set(m.symbol, list);
        }

        const ackSet = new Set(
          allAcks
            .filter((a) => a.status === 'Active')
            .map((a) => `${a.symbol}::${a.sessionDate}`),
        );

        const dtrEntriesByTrade = new Map<string, JournalEntryRecord[]>();
        for (const e of allEntries) {
          if (e.entryTypeId !== DAILY_TRADE_REVIEW_TYPE_ID) continue;
          const list = dtrEntriesByTrade.get(e.tradeId) ?? [];
          list.push(e);
          dtrEntriesByTrade.set(e.tradeId, list);
        }

        // StateAtEconomicCutoff(Open): trades with earliest execution exchange date <= reviewDate
        // and derived openShares > 0 as of reviewDate.
        const openAtCutoff: {
          trade: TradeRecordRow;
          execsAsOf: ExecutionRecord[];
          derived: DerivedLongStockState;
          entrySessionDate: string;
        }[] = [];
        const openedAfterCutoffTrades: DailyReviewAfterCutoffTrade[] = [];

        for (const t of trades) {
          const sorted = [...(execsByTrade.get(t.id) ?? [])].sort((a, b) => {
            const byTime = a.economicTime.localeCompare(b.economicTime);
            return byTime !== 0 ? byTime : a.recordedSequence - b.recordedSequence;
          });
          const execsAsOf = sorted.filter(
            (ex) => getExchangeDateForInstant(new Date(ex.economicTime)) <= reviewDate,
          );
          if (execsAsOf.length === 0) {
            if (sorted.length > 0 && t.lifecycleState === 'Open') {
              const firstDate = getExchangeDateForInstant(new Date(sorted[0]!.economicTime));
              openedAfterCutoffTrades.push({
                tradeId: t.id,
                symbol: t.symbol,
                entrySessionDate: firstDate,
                entrySessionDateShort: formatSessionDateShort(firstDate),
              });
            }
            continue;
          }

          const derived = deriveLongStockPosition({
            storedLifecycleState: t.lifecycleState,
            plan: {
              plannedQuantity: t.plannedQuantity,
              intendedEntryPrice: t.intendedEntryPrice,
              stopPrice: t.stopPrice,
              targetPrice: t.targetPrice,
            },
            originalPlannedRisk: t.baseline.originalPlannedRisk,
            executions: execsAsOf,
          });
          if (!isPositive(derived.openShares)) continue;

          const entrySessionDate = getExchangeDateForInstant(new Date(execsAsOf[0]!.economicTime));
          openAtCutoff.push({ trade: t, execsAsOf, derived, entrySessionDate });
        }

        // Identify missed prior sessions (since earliest open entry, before reviewDate, with zero DTR entries)
        const reviewedDates = new Set<string>();
        for (const list of dtrEntriesByTrade.values()) {
          for (const e of list) {
            const d = extractDailyReviewDate(e);
            if (d && d < reviewDate) reviewedDates.add(d);
          }
        }
        let earliestEntry: string | null = null;
        for (const item of openAtCutoff) {
          if (!earliestEntry || item.entrySessionDate < earliestEntry) {
            earliestEntry = item.entrySessionDate;
          }
        }
        const skippedSessions: { date: string; short: string }[] = [];
        if (earliestEntry && earliestEntry < reviewDate) {
          const allPriorSessions = getCompletedSessionsBetween(earliestEntry, reviewDate).filter(
            (d) => d < reviewDate,
          );
          const unreviewed = allPriorSessions.filter((d) => !reviewedDates.has(d));
          for (const d of unreviewed.slice(-5)) {
            skippedSessions.push({ date: d, short: formatSessionDateShort(d) });
          }
        }

        // Build per-symbol Marks rows
        const symbolMap = new Map<string, { count: number; fallbackEntry: Rational }>();
        for (const { trade, derived } of openAtCutoff) {
          const existing = symbolMap.get(trade.symbol);
          if (existing) {
            existing.count += 1;
          } else {
            symbolMap.set(trade.symbol, {
              count: 1,
              fallbackEntry:
                derived.averageEntryPrice ?? ExactNumber.fromJSON(trade.intendedEntryPrice),
            });
          }
        }

        const marks: DailyReviewMarkRow[] = [...symbolMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([symbol, info]) => {
            const symMarks = marksBySymbol.get(symbol) ?? [];
            const todayMark = symMarks.find((m) => m.sessionDate === reviewDate) ?? null;
            const priorMark =
              symMarks
                .filter((m) => m.sessionDate < reviewDate)
                .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))[0] ?? null;
            const todayPrice = todayMark ? ExactNumber.fromJSON(todayMark.price) : null;
            const priorPrice = priorMark ? ExactNumber.fromJSON(priorMark.price) : null;
            const skippedMarksByDate: Record<string, string> = {};
            for (const sk of skippedSessions) {
              const skMark = symMarks.find((m) => m.sessionDate === sk.date);
              skippedMarksByDate[sk.date] = skMark
                ? formatMarkRaw(ExactNumber.fromJSON(skMark.price))
                : '';
            }
            return {
              symbol,
              openTradeCount: info.count,
              priorSessionDate: priorMark?.sessionDate ?? null,
              priorMarkDisplay: priorPrice ? toMoneyString(priorPrice) : null,
              referencePrice: priorPrice ?? info.fallbackEntry,
              todayMarkDisplay: todayPrice ? toMoneyString(todayPrice) : null,
              todayMarkRaw: todayPrice ? formatMarkRaw(todayPrice) : '',
              todayUnavailableAcknowledged: ackSet.has(`${symbol}::${reviewDate}`),
              skippedMarksByDate,
            };
          });

        // Build trade items & expectedSnapshot bindings
        const tradeFactRevisions: Record<string, number> = {};
        const actionEntryIds: Record<string, string | null> = {};

        const tradeItems: DailyReviewTradeItem[] = openAtCutoff.map(
          ({ trade, execsAsOf, derived, entrySessionDate }) => {
            tradeFactRevisions[trade.id] = trade.factRevision;
            const symMarks = marksBySymbol.get(trade.symbol) ?? [];
            const todayMark = symMarks.find((m) => m.sessionDate === reviewDate) ?? null;
            const priorMark =
              symMarks
                .filter((m) => m.sessionDate < reviewDate)
                .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))[0] ?? null;
            const todayUnavailableAcknowledged = ackSet.has(`${trade.symbol}::${reviewDate}`);
            const isResolvedForToday = todayMark !== null || todayUnavailableAcknowledged;

            const evaluation = evaluateLongStockTrade({
              derived,
              plan: { stopPrice: trade.stopPrice, targetPrice: trade.targetPrice },
              originalPlannedRisk: trade.baseline.originalPlannedRisk,
              expectedSessionDate: reviewDate,
              entrySessionDate,
              todayMark: todayMark
                ? { sessionDate: todayMark.sessionDate, price: todayMark.price }
                : null,
              priorMark: priorMark
                ? { sessionDate: priorMark.sessionDate, price: priorMark.price }
                : null,
              todayUnavailableAcknowledged,
            });

            const activeEval =
              evaluation.availability === 'Available'
                ? evaluation
                : (evaluation.priorContext?.evaluation ?? null);
            const standing = computeStanding(activeEval);

            const tradeDtrs = dtrEntriesByTrade.get(trade.id) ?? [];
            const todayEntry =
              tradeDtrs.find((e) => extractDailyReviewDate(e) === reviewDate) ?? null;
            actionEntryIds[trade.id] = todayEntry?.id ?? null;

            const priorDtrs = tradeDtrs
              .filter((e) => {
                const d = extractDailyReviewDate(e);
                return d !== null && d < reviewDate;
              })
              .sort((a, b) =>
                (extractDailyReviewDate(b) ?? '').localeCompare(extractDailyReviewDate(a) ?? ''),
              );

            const pastDecisions: DailyReviewPastDecision[] = priorDtrs.slice(0, 4).map((e) => {
              const d = extractDailyReviewDate(e) ?? '';
              return {
                reviewDate: d,
                reviewDateShort: formatSessionDateShort(d),
                action: String(e.responses.action ?? 'Hold'),
                reason:
                  typeof e.responses.reason === 'string' && e.responses.reason.trim()
                    ? e.responses.reason
                    : null,
                conviction:
                  typeof e.responses.conviction === 'number' ? e.responses.conviction : null,
              };
            });

            const stopP = ExactNumber.fromJSON(trade.stopPrice);
            const targetP = ExactNumber.fromJSON(trade.targetPrice);
            const { holdPastStopStreak, holdPastTargetStreak } = computeHoldStreaks({
              priorDtrs,
              symMarks,
              stopPrice: stopP,
              targetPrice: targetP,
            });
            const planCheck = computeExitPlanCheck({
              standing,
              holdPastStopStreak,
              holdPastTargetStreak,
            });

            // OV-05: Prior review Exit accountability (always populated for UI/save validation parity while Open)
            let staleExit: StaleExitDecision | null = null;
            const latestPrior = priorDtrs[0];
            if (latestPrior && latestPrior.responses.action === 'Exit') {
              const priorDate = extractDailyReviewDate(latestPrior)!;
              const soldAfter = execsAsOf.filter(
                (ex) =>
                  ex.side === 'Sell' &&
                  getExchangeDateForInstant(new Date(ex.economicTime)) > priorDate,
              );
              const soldAfterSum = soldAfter.reduce(
                (acc, ex) => add(acc, ExactNumber.fromJSON(ex.quantity)),
                fromInteger(0),
              );
              staleExit = {
                priorReviewDate: priorDate,
                priorReviewDateShort: formatSessionDateShort(priorDate),
                priorAction: 'Exit',
                priorReason:
                  typeof latestPrior.responses.reason === 'string' &&
                  latestPrior.responses.reason.trim()
                    ? latestPrior.responses.reason
                    : null,
                soldSinceDisplay: isPositive(soldAfterSum)
                  ? `Sold ${formatShares(ExactNumber.toJSON(soldAfterSum))} since.`
                  : null,
              };
            }

            const strict =
              staleExit !== null ||
              standing.kind === 'PastStop' ||
              standing.kind === 'AtTarget';

            const planFact = planFactByTrade.get(trade.id);
            const sortedStopDevs = [...(devsByTrade.get(trade.id) ?? [])]
              .filter((d) => !d.startSessionDate || d.startSessionDate <= reviewDate)
              .sort((a, b) =>
                (a.startSessionDate ?? '').localeCompare(b.startSessionDate ?? ''),
              );
            return {
              tradeId: trade.id,
              symbol: trade.symbol,
              strategyLabel: stratMap.get(trade.strategyId) ?? 'Long Stock',
              accountLabel: acctMap.get(trade.accountId) ?? 'Account',
              institutionLabel: instMap.get(trade.institutionId) ?? 'Institution',
              openSharesDisplay: formatShares(ExactNumber.toJSON(derived.openShares)),
              plannedQuantityDisplay: formatShares(trade.plannedQuantity),
              intendedEntryDisplay: toMoneyString(ExactNumber.fromJSON(trade.intendedEntryPrice)),
              stopPriceDisplay: toMoneyString(stopP),
              targetPriceDisplay: toMoneyString(targetP),
              oneRDisplay: trade.baseline.originalPlannedRiskDisplay,
              plannedRewardDisplay: trade.baseline.originalPlannedRewardDisplay,
              thesis: planFact?.thesis ?? '',
              invalidation: planFact?.invalidation ?? '',
              derived,
              evaluation,
              standing,
              isResolvedForToday,
              strict,
              planCheck,
              staleExit,
              stopDisciplineDeviations: sortedStopDevs,
              todayAction: todayEntry
                ? {
                    entryId: todayEntry.id,
                    action: (todayEntry.responses.action as DailyReviewAction) ?? 'Hold',
                    reason:
                      typeof todayEntry.responses.reason === 'string' &&
                      todayEntry.responses.reason.trim()
                        ? todayEntry.responses.reason
                        : null,
                    conviction:
                      typeof todayEntry.responses.conviction === 'number'
                        ? todayEntry.responses.conviction
                        : null,
                    consideredAgainst:
                      typeof todayEntry.responses.consideredAgainst === 'string' &&
                      todayEntry.responses.consideredAgainst.trim()
                        ? todayEntry.responses.consideredAgainst
                        : null,
                    note:
                      typeof todayEntry.responses.note === 'string' &&
                      todayEntry.responses.note.trim()
                        ? todayEntry.responses.note
                        : null,
                    recordedAt: todayEntry.recordedAt,
                  }
                : null,
              pastDecisions,
              holdPastStopStreak,
              holdPastTargetStreak,
              stopPrice: stopP,
              targetPrice: targetP,
              oneR: ExactNumber.fromJSON(trade.baseline.originalPlannedRisk),
            };
          },
        );

        // Attention-rank Trade items (Unanswered Stale Exit #1 -> Past Stop -> At Target -> Inside Stop -> Inside Target -> Unmarked)
        tradeItems.sort((a, b) => {
          const ra = rankKey({
            standing: a.standing,
            staleExit: a.staleExit,
            hasTodayAction: a.todayAction !== null,
          });
          const rb = rankKey({
            standing: b.standing,
            staleExit: b.staleExit,
            hasTodayAction: b.todayAction !== null,
          });
          if (ra[0] !== rb[0]) return ra[0] - rb[0];
          if (ra[1] !== rb[1]) return ra[1] - rb[1];
          return a.symbol.localeCompare(b.symbol);
        });

        // Due Journal Debt: Outstanding debt whose economic origin (or creation) is on or before reviewDate
        const tradeById = new Map(trades.map((t) => [t.id, t]));
        const dueDebt: DailyReviewDebtItem[] = allDebt
          .filter((d) => {
            if (d.status !== 'Outstanding') return false;
            const originIso = pcEconomicTimeById.get(d.origin.factId) ?? d.createdAt;
            return getExchangeDateForInstant(new Date(originIso)) <= reviewDate;
          })
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((debt) => {
            const tr = tradeById.get(debt.tradeId);
            const originIso = pcEconomicTimeById.get(debt.origin.factId) ?? debt.createdAt;
            return {
              debt,
              symbol: tr?.symbol ?? 'Trade',
              strategyLabel: tr ? (stratMap.get(tr.strategyId) ?? 'Long Stock') : 'Trade',
              summary: `Deferred Position Change Reflection (${formatSessionDateShort(getExchangeDateForInstant(new Date(originIso)))})`,
            };
          });

        // Derive completionState purely from saved facts (zero Review Session entity!)
        const allMarksResolved = marks.every(
          (m) => m.todayMarkDisplay !== null || m.todayUnavailableAcknowledged,
        );
        const allTradesActioned = tradeItems.every((t) => t.todayAction !== null);
        const anyUnavailable = marks.some((m) => m.todayUnavailableAcknowledged);

        let completionState: DailyReviewCompletionState = 'Incomplete';
        if (allMarksResolved && dueDebt.length === 0 && allTradesActioned) {
          completionState = anyUnavailable ? 'CompleteWithUnavailableMarks' : 'Complete';
        }

        // Day summary aggregates
        let dayChgTotal: Rational = fromInteger(0);
        let hasAnyDayChg = false;
        let openPnlTotal: Rational = fromInteger(0);
        let hasAnyOpenPnl = false;
        for (const t of tradeItems) {
          if (t.evaluation.availability === 'Available') {
            openPnlTotal = add(openPnlTotal, t.evaluation.openPnl);
            hasAnyOpenPnl = true;
            if (t.evaluation.dailyChange) {
              dayChgTotal = add(dayChgTotal, t.evaluation.dailyChange);
              hasAnyDayChg = true;
            }
          }
        }

        const pastStopSymbols = tradeItems
          .filter((t) => t.standing.kind === 'PastStop')
          .map((t) => t.symbol);
        const atTargetSymbols = tradeItems
          .filter((t) => t.standing.kind === 'AtTarget')
          .map((t) => t.symbol);
        const chosenHoldSymbols = tradeItems
          .filter((t) => t.todayAction?.action === 'Hold')
          .map((t) => t.symbol);
        const chosenExitSymbols = tradeItems
          .filter((t) => t.todayAction?.action === 'Exit')
          .map((t) => t.symbol);

        const tomorrowItems: string[] = [];
        for (const t of tradeItems) {
          if (t.todayAction?.action === 'Exit') {
            tomorrowItems.push(`Sell ${t.openSharesDisplay} ${t.symbol}, then record the sale.`);
          }
        }
        const heldPastStop = tradeItems
          .filter((t) => t.standing.kind === 'PastStop' && t.todayAction?.action === 'Hold')
          .map((t) => t.symbol);
        if (heldPastStop.length > 0) {
          tomorrowItems.push(
            `You held ${heldPastStop.join(', ')} past the Stop. Tomorrow's Review asks again.`,
          );
        }
        const heldPastTarget = tradeItems
          .filter((t) => t.standing.kind === 'AtTarget' && t.todayAction?.action === 'Hold')
          .map((t) => t.symbol);
        if (heldPastTarget.length > 0) {
          tomorrowItems.push(
            `You held ${heldPastTarget.join(', ')} past the Target, with no new line.`,
          );
        }
        if (tomorrowItems.length === 0) {
          tomorrowItems.push('Nothing waiting.');
        }

        const expectedSnapshot: DailyReviewExpectedSnapshot = {
          reviewDate,
          marketSnapshotId: marketMeta?.snapshotId ?? 0,
          tradeFactRevisions,
          actionEntryIds,
          outstandingDebtIds: dueDebt.map((d) => d.debt.id),
        };

        return {
          reviewDate,
          reviewDateShort: formatSessionDateShort(reviewDate),
          completionState,
          expectedSnapshot,
          marks,
          skippedSessions,
          dueDebt,
          trades: tradeItems,
          openedAfterCutoffTrades,
          daySummary: {
            dayPnlChangeDisplay: hasAnyDayChg ? toMoneyString(dayChgTotal, true) : null,
            dayPnlChangePositive: hasAnyDayChg ? dayChgTotal.num >= 0n : null,
            totalOpenPnlDisplay: hasAnyOpenPnl ? toMoneyString(openPnlTotal, true) : null,
            totalOpenPnlPositive: hasAnyOpenPnl ? openPnlTotal.num >= 0n : null,
            pastStopSymbols,
            atTargetSymbols,
            chosenHoldSymbols,
            chosenExitSymbols,
            tomorrowItems,
            nextSessionDateShort: formatSessionDateShort(getNextTradingDate(reviewDate)),
          },
        };
      },
    );
  }

  return {
    open(reviewDate?: string) {
      return buildOpenView(reviewDate);
    },

    async getTrade(tradeId: string, reviewDate?: string) {
      const view = await buildOpenView(reviewDate);
      return view.trades.find((t) => t.tradeId === tradeId) ?? null;
    },

    async getDebt(debtId: string) {
      const view = await buildOpenView();
      return view.dueDebt.find((d) => d.debt.id === debtId) ?? null;
    },

    async save(command: DailyReviewSaveCommand): Promise<DailyReviewSaveResult> {
      const txResult = await persistence.runWriteTransaction(
        [
          'trades',
          'position_changes',
          'executions',
          'deviations',
          'market_meta',
          'market_marks',
          'market_acknowledgments',
          'journal_definitions',
          'journal_entries',
          'journal_debt',
          'journal_declines',
        ],
        async (tx): Promise<Exclude<DailyReviewSaveResult, RuntimeNotWritableResult>> => {
          const now = clock.nowIso();

          if (command.kind === 'SaveTradeAction') {
            if (!DAILY_REVIEW_ACTION_OPTIONS.includes(command.action)) {
              return { status: 'Rejected', message: `Unsupported Review Action: ${String(command.action)}.` };
            }
            const latestCompleted = getLatestCompletedSessionDate(clock.now());
            if (!isUsTradingDay(command.reviewDate) || command.reviewDate > latestCompleted) {
              return {
                status: 'Rejected',
                message: `Review date ${command.reviewDate} is not a completed U.S. trading session.`,
              };
            }
            if (command.expectedSnapshot.reviewDate !== command.reviewDate) {
              return {
                status: 'ReviewChanged',
                reason: 'Review date changed since Review opened; reload before saving.',
              };
            }

            const [trade, executions, existingDevs, marketMeta, symMarks, symAcks, defs, tradeEntries] =
              await Promise.all([
                tx.get('trades', command.tradeId),
                tx.getAllByIndex('executions', 'by_trade', command.tradeId),
                tx.getAllByIndex('deviations', 'by_trade', command.tradeId),
                tx.get('market_meta', 'singleton'),
                tx.getAll('market_marks'),
                tx.getAll('market_acknowledgments'),
                tx.getAll('journal_definitions'),
                tx.getAllByIndex('journal_entries', 'by_trade', command.tradeId),
              ]);

            if (!trade) {
              return { status: 'Rejected', message: 'Trade not found.' };
            }

            // ExpectedSnapshot recheck (AC-REV-005): zero writes if Marks, Trade, or Action changed
            const currentMarketSnapshot = marketMeta?.snapshotId ?? 0;
            if (currentMarketSnapshot !== command.expectedSnapshot.marketSnapshotId) {
              return {
                status: 'ReviewChanged',
                reason: 'Marks changed since Review opened; reload before saving.',
              };
            }
            if (!(trade.id in command.expectedSnapshot.tradeFactRevisions)) {
              return {
                status: 'ReviewChanged',
                reason: 'Trade was not in the opened Review snapshot; reload before saving.',
              };
            }
            const expectedFactRev = command.expectedSnapshot.tradeFactRevisions[trade.id];
            if (trade.factRevision !== expectedFactRev) {
              return {
                status: 'ReviewChanged',
                reason: 'Trade facts changed since Review opened; reload before saving.',
              };
            }

            const obKey = obligationKeyFor(trade.id, command.reviewDate);
            const existingEntry =
              tradeEntries.find(
                (e) =>
                  e.obligationKey === obKey ||
                  (e.entryTypeId === DAILY_TRADE_REVIEW_TYPE_ID &&
                    extractDailyReviewDate(e) === command.reviewDate),
              ) ?? null;
            if (!(trade.id in command.expectedSnapshot.actionEntryIds)) {
              return {
                status: 'ReviewChanged',
                reason: 'Trade Action snapshot missing; reload before saving.',
              };
            }
            const expectedEntryId = command.expectedSnapshot.actionEntryIds[trade.id];
            if ((existingEntry?.id ?? null) !== expectedEntryId) {
              return {
                status: 'ReviewChanged',
                reason: 'Another Review decision was saved for this Trade; reload first.',
              };
            }

            // Marks-before-Action gate (OV-03)
            const marksForSym = symMarks.filter((m) => m.symbol === trade.symbol && m.effective);
            const todayMark =
              marksForSym.find((m) => m.sessionDate === command.reviewDate) ?? null;
            const priorMark =
              marksForSym
                .filter((m) => m.sessionDate < command.reviewDate)
                .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))[0] ?? null;
            const todayUnavailableAck = symAcks.some(
              (a) =>
                a.symbol === trade.symbol &&
                a.sessionDate === command.reviewDate &&
                a.status === 'Active',
            );

            if (!todayMark && !todayUnavailableAck) {
              return {
                status: 'Rejected',
                message: `Enter today's Mark (or mark unavailable) for ${trade.symbol} before saving an Action.`,
              };
            }

            // Recompute standing at cutoff to enforce OV-02 strict rule
            const execsAsOf = [...executions]
              .sort((a, b) => {
                const byTime = a.economicTime.localeCompare(b.economicTime);
                return byTime !== 0 ? byTime : a.recordedSequence - b.recordedSequence;
              })
              .filter(
                (ex) => getExchangeDateForInstant(new Date(ex.economicTime)) <= command.reviewDate,
              );
            if (execsAsOf.length === 0) {
              return { status: 'Rejected', message: 'Trade was not open on this Review date.' };
            }
            const derived = deriveLongStockPosition({
              storedLifecycleState: trade.lifecycleState,
              plan: {
                plannedQuantity: trade.plannedQuantity,
                intendedEntryPrice: trade.intendedEntryPrice,
                stopPrice: trade.stopPrice,
                targetPrice: trade.targetPrice,
              },
              executions: execsAsOf,
            });
            if (!isPositive(derived.openShares)) {
              return { status: 'Rejected', message: 'Trade has no open shares on this Review date.' };
            }
            const entrySessionDate = getExchangeDateForInstant(
              new Date(execsAsOf[0]!.economicTime),
            );
            const evalRes = evaluateLongStockTrade({
              derived,
              plan: { stopPrice: trade.stopPrice, targetPrice: trade.targetPrice },
              originalPlannedRisk: trade.baseline.originalPlannedRisk,
              expectedSessionDate: command.reviewDate,
              entrySessionDate,
              todayMark: todayMark
                ? { sessionDate: todayMark.sessionDate, price: todayMark.price }
                : null,
              priorMark: priorMark
                ? { sessionDate: priorMark.sessionDate, price: priorMark.price }
                : null,
              todayUnavailableAcknowledged: todayUnavailableAck,
            });
            const activeEval =
              evalRes.availability === 'Available'
                ? evalRes
                : (evalRes.priorContext?.evaluation ?? null);
            const standing = computeStanding(activeEval);

            const priorDtrs = tradeEntries
              .filter((e) => {
                if (e.entryTypeId !== DAILY_TRADE_REVIEW_TYPE_ID) return false;
                const d = extractDailyReviewDate(e);
                return d !== null && d < command.reviewDate;
              })
              .sort((a, b) =>
                (extractDailyReviewDate(b) ?? '').localeCompare(extractDailyReviewDate(a) ?? ''),
              );
            const { holdPastStopStreak, holdPastTargetStreak } = computeHoldStreaks({
              priorDtrs,
              symMarks: marksForSym,
              stopPrice: ExactNumber.fromJSON(trade.stopPrice),
              targetPrice: ExactNumber.fromJSON(trade.targetPrice),
            });
            const planCheck = computeExitPlanCheck({
              standing,
              holdPastStopStreak,
              holdPastTargetStreak,
            });
            const staleExit = priorDtrs[0]?.responses.action === 'Exit';

            const trimmedReason = command.reason?.trim() ?? '';
            const needsReason =
              staleExit ||
              (command.action === 'Hold'
                ? standing.kind === 'PastStop' || standing.kind === 'AtTarget'
                : !planCheck.exitFollowsPlan);
            if (needsReason && trimmedReason.length === 0) {
              return {
                status: 'Rejected',
                message:
                  command.action === 'Exit'
                    ? (planCheck.reasonIfLeaving ?? 'Say why you are leaving the Plan.')
                    : 'Say why you are holding past your Plan line.',
              };
            }

            if (
              command.conviction !== undefined &&
              (!Number.isInteger(command.conviction) ||
                command.conviction < 1 ||
                command.conviction > 5)
            ) {
              return {
                status: 'Rejected',
                message: 'Conviction must be an integer between 1 and 5.',
              };
            }

            const def =
              defs.find((d) => d.entryTypeId === DAILY_TRADE_REVIEW_TYPE_ID) ??
              buildDailyTradeReviewDefinition(now);

            const entryId = existingEntry?.id ?? genId('jrn');
            const entry: JournalEntryRecord = {
              id: entryId,
              entryTypeId: DAILY_TRADE_REVIEW_TYPE_ID,
              definitionId: def.id,
              definitionRevision: def.revision,
              definitionSnapshot: def,
              source: 'DailyReview',
              anchor: { kind: 'Trade', tradeId: trade.id },
              tradeId: trade.id,
              origin: { kind: 'DailyReview', reviewDate: command.reviewDate },
              obligationKey: obKey,
              responses: {
                action: command.action,
                reason: trimmedReason || undefined,
                conviction: command.conviction,
                consideredAgainst: command.consideredAgainst?.trim() || undefined,
                note: command.note?.trim() || undefined,
              },
              recordedAt: now,
            };

            tx.put('journal_entries', entry);

            // AC-REV-004: Atomic Stop-Discipline episode reconciliation against bound Marks & Actions
            const allDtrsAfterSave = extractDailyReviewActions(
              tradeEntries
                .filter((x) => x.entryTypeId === DAILY_TRADE_REVIEW_TYPE_ID && x.id !== entryId)
                .concat(entry),
              DAILY_TRADE_REVIEW_TYPE_ID,
            );

            const devWrites = diffStopDisciplineDeviationRecords({
              tradeId: trade.id,
              stopPrice: trade.stopPrice,
              executions,
              effectiveMarks: marksForSym.map((m) => ({
                sessionDate: m.sessionDate,
                price: m.price,
              })),
              reviewActions: allDtrsAfterSave,
              existingDeviations: existingDevs,
              nowIso: now,
              generateId: genId,
            });
            for (const devRec of devWrites) {
              tx.put('deviations', devRec);
            }

            return { status: 'Saved', recordId: entryId };
          }

          // ResolveReviewDebt
          if (
            command.expectedSnapshot.reviewDate !== command.reviewDate ||
            !command.expectedSnapshot.outstandingDebtIds.includes(command.debtId)
          ) {
            return {
              status: 'ReviewChanged',
              reason: 'Due reflections changed since Review opened; reload before saving.',
            };
          }
          const [debt, pc] = await Promise.all([
            tx.get('journal_debt', command.debtId),
            tx.getAll('position_changes'),
          ]);
          if (!debt) {
            return { status: 'Rejected', message: 'Journal Debt record not found.' };
          }
          if (debt.status !== 'Outstanding') {
            return {
              status: 'Conflict',
              reason: 'This deferred reflection has already been resolved.',
            };
          }
          const originPc = pc.find((p) => p.id === debt.origin.factId);
          const originIso = originPc?.economicTime ?? debt.createdAt;
          if (getExchangeDateForInstant(new Date(originIso)) > command.reviewDate) {
            return {
              status: 'Rejected',
              message: 'This deferred reflection is not due on the selected Review date.',
            };
          }

          if (command.mode === 'Decline') {
            const declineId = genId('dec');
            const decline: JournalDeclineRecord = {
              id: declineId,
              tradeId: debt.tradeId,
              entryTypeId: debt.entryTypeId,
              source: debt.source,
              origin: debt.origin,
              reason: command.declineReason?.trim() || undefined,
              recordedAt: now,
            };
            tx.put('journal_declines', decline);
            tx.put('journal_debt', { ...debt, status: 'Declined' });
            return { status: 'Saved', recordId: declineId };
          }

          // Complete debt against trigger-time prompt snapshot
          const check = validatePositionChangeReflectionInput(debt.definitionSnapshot, {
            definitionId: debt.definitionSnapshot.id,
            definitionRevision: debt.definitionSnapshot.revision,
            decisionMode: command.decisionMode,
            primaryEmotion: command.primaryEmotion,
            decisionConfidence: command.confidence,
            note: command.note,
          });
          if (!check.ok) {
            return {
              status: 'Rejected',
              message: check.errors.map((e) => e.message).join(' '),
            };
          }

          const entryId = genId('jrn');
          const entry: JournalEntryRecord = {
            id: entryId,
            entryTypeId: debt.entryTypeId,
            definitionId: debt.definitionSnapshot.id,
            definitionRevision: debt.definitionSnapshot.revision,
            definitionSnapshot: debt.definitionSnapshot,
            source: debt.source,
            anchor: { kind: 'Trade', tradeId: debt.tradeId },
            tradeId: debt.tradeId,
            origin: debt.origin,
            responses: {
              decisionMode: command.decisionMode,
              primaryEmotion: command.primaryEmotion,
              decisionConfidence: command.confidence,
              note: check.note,
            },
            recordedAt: now,
          };

          tx.put('journal_entries', entry);
          tx.put('journal_debt', { ...debt, status: 'Settled' });
          return { status: 'Saved', recordId: entryId };
        },
      );

      if (txResult.status === 'RuntimeNotWritable') {
        return txResult;
      }
      return txResult.value;
    },
  };
}
