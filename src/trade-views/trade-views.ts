import { DAILY_TRADE_REVIEW_TYPE_ID } from '../journal/journal';
import {
  formatSessionDateShort,
  getCompletedSessionsBetween,
  getExchangeDateForInstant,
  getLatestCompletedSessionDate,
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
  TradeLifecycleState,
  TradeRecordRow,
} from '../persistence/idb';
import type { Clock } from '../shared/clock';
import {
  add,
  cmp,
  ExactNumber,
  mul,
  sub,
  toDecimalString,
  toMoneyString,
  type Rational,
} from '../shared/exact-number';
import { deriveLongStockPosition, type DerivedLongStockState } from '../trade-analysis/derive';
import { evaluateLongStockTrade, type LongStockEvaluation } from '../trade-analysis/evaluate';
import {
  assembleLongStockReplayInput,
  extractReplayReviewActions,
  replayLongStockTrade,
  type LongStockReplayModel,
} from '../trade-analysis/replay';

export interface TradeBrowseItem {
  readonly id: string;
  readonly symbol: string;
  readonly lifecycleState: TradeLifecycleState;
  readonly strategyLabel: string;
  readonly accountLabel: string;
  readonly institutionLabel: string;
  readonly plannedQuantityDisplay: string;
  readonly openSharesDisplay: string;
  readonly intendedEntryDisplay: string;
  readonly oneRDisplay: string;
  readonly plannedRewardDisplay: string;
  readonly plannedRRDisplay: string;
  readonly evaluation: LongStockEvaluation | null;
  readonly realizedPnlDisplay: string | null;
  readonly realizedRDisplay: string | null;
  readonly closeReasonLabel: string | null;
  readonly createdAt: string;
}

export interface PriceHistoryRow {
  readonly sessionDate: string;
  readonly sessionDateShort: string;
  readonly markDisplay: string | null;
  readonly unavailableAcknowledged: boolean;
  readonly tradePnlDisplay: string | null;
  readonly tradePnlPositive: boolean | null;
}

export interface PlanVsActualSummary {
  readonly plannedEntrySummary: string;
  readonly actualEntrySummary: string;
  readonly stopFirstReachedShort: string | null;
  readonly targetFirstReachedShort: string | null;
  readonly exitSummary: string;
  readonly plannedResultSummary: string;
  readonly actualResultSummary: string;
  readonly actualResultPositive: boolean;
}

export interface TradeDetailCockpitViewModel {
  readonly trade: TradeRecordRow;
  readonly strategyLabel: string;
  readonly accountLabel: string;
  readonly institutionLabel: string;
  readonly closeReasonLabel: string | null;
  readonly closedAtShort: string | null;
  readonly plannedQuantityDisplay: string;
  readonly intendedEntryDisplay: string;
  readonly stopPriceDisplay: string;
  readonly targetPriceDisplay: string;
  readonly expectedSessionDate: string;
  readonly expectedSessionDateShort: string;
  readonly planFact: PlanVersionFactRecord;
  readonly executions: readonly ExecutionRecord[];
  readonly derived: DerivedLongStockState;
  readonly evaluation: LongStockEvaluation | null;
  readonly stopDisciplineDeviations: readonly DeviationRecord[];
  readonly planVsActual: PlanVsActualSummary | null;
  readonly priceHistory: readonly PriceHistoryRow[];
  readonly journalEntries: readonly JournalEntryRecord[];
  readonly journalDebt: readonly JournalDebtRecord[];
  readonly journalDeclines: readonly JournalDeclineRecord[];
}

export interface ReviewMarkSymbolRow {
  readonly symbol: string;
  readonly openTradeCount: number;
  readonly priorSessionDate: string | null;
  readonly priorMarkDisplay: string | null;
  readonly referencePrice: Rational | null;
  readonly todayMarkDisplay: string | null;
  readonly todayMarkRaw: string;
  readonly todayUnavailableAcknowledged: boolean;
}

export interface ReviewMarksViewModel {
  readonly sessionDate: string;
  readonly sessionDateShort: string;
  readonly snapshotId: number;
  readonly rows: readonly ReviewMarkSymbolRow[];
  readonly openTrades: readonly TradeBrowseItem[];
}

export interface TradeReplayView {
  readonly trade: TradeRecordRow;
  readonly strategyLabel: string;
  readonly accountLabel: string;
  readonly institutionLabel: string;
  readonly closeReasonLabel: string | null;
  readonly closedAtShort: string | null;
  readonly terminalDisposition: string | null;
  readonly expectedSessionDate: string;
  readonly expectedSessionDateShort: string;
  readonly replay: LongStockReplayModel;
}

export type TradeReplayViewResult =
  | { readonly status: 'Ready'; readonly view: TradeReplayView }
  | { readonly status: 'NotFound'; readonly tradeId: string }
  | {
      readonly status: 'NotApplicable';
      readonly tradeId: string;
      readonly reason: 'UnenteredTrade' | 'NotEnteredAsOf';
    }
  | {
      readonly status: 'IntegrityBlocked';
      readonly tradeId: string;
      readonly reason: string;
    };

export interface TradeViewsAndReporting {
  browseTrades(filter?: {
    readonly lifecycleState?: TradeLifecycleState;
  }): Promise<{ readonly items: readonly TradeBrowseItem[] }>;
  getTradeDetail(tradeId: string): Promise<TradeDetailCockpitViewModel | null>;
  getReviewMarksView(sessionDate?: string): Promise<ReviewMarksViewModel>;
  replayTrade(
    tradeId: string,
    options?: { readonly asOfSessionDate?: string },
  ): Promise<TradeReplayViewResult>;
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

function groupEffectiveMarksBySymbol(
  allMarks: readonly MarketMarkRecord[],
): Map<string, MarketMarkRecord[]> {
  const map = new Map<string, MarketMarkRecord[]>();
  for (const m of allMarks) {
    if (!m.effective) continue;
    const list = map.get(m.symbol) ?? [];
    list.push(m);
    map.set(m.symbol, list);
  }
  return map;
}

function resolveSymbolFrame(
  symbol: string,
  expectedSessionDate: string,
  marksBySymbol: ReadonlyMap<string, readonly MarketMarkRecord[]>,
  ackSet: ReadonlySet<string>,
) {
  const symMarks = marksBySymbol.get(symbol) ?? [];
  const todayMark = symMarks.find((m) => m.sessionDate === expectedSessionDate) ?? null;
  const priorMarks = symMarks
    .filter((m) => m.sessionDate < expectedSessionDate)
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  const priorMark = priorMarks[0] ?? null;
  return {
    todayMark,
    priorMark,
    todayUnavailableAcknowledged: ackSet.has(`${symbol}::${expectedSessionDate}`),
  };
}

export function createTradeViews(options: {
  readonly persistence: PersistenceSeam;
  readonly clock?: Clock;
}): TradeViewsAndReporting {
  const { persistence } = options;
  const getNow = () => (options.clock ? options.clock.now() : new Date());

  return {
    async browseTrades(filter = {}) {
      const expectedSessionDate = getLatestCompletedSessionDate(getNow());
      return persistence.runReadTransaction(
        [
          'trades',
          'executions',
          'catalog_institutions',
          'catalog_accounts',
          'catalog_strategies',
          'catalog_close_reasons',
          'proj_trade_analysis_input',
          'market_marks',
          'market_acknowledgments',
        ],
        async (tx) => {
          const [
            trades,
            executions,
            institutions,
            accounts,
            strategies,
            closeReasons,
            projections,
            allMarks,
            allAcks,
          ] = await Promise.all([
            tx.getAll('trades'),
            tx.getAll('executions'),
            tx.getAll('catalog_institutions'),
            tx.getAll('catalog_accounts'),
            tx.getAll('catalog_strategies'),
            tx.getAll('catalog_close_reasons'),
            tx.getAll('proj_trade_analysis_input'),
            tx.getAll('market_marks'),
            tx.getAll('market_acknowledgments'),
          ]);

          const instMap = new Map(institutions.map((i) => [i.id, i.currentLabel]));
          const acctMap = new Map(accounts.map((a) => [a.id, a.currentLabel]));
          const stratMap = new Map(strategies.map((s) => [s.id, s.currentLabel]));
          const closeReasonMap = new Map(closeReasons.map((c) => [c.id, c.currentLabel]));
          const projMap = new Map(projections.map((p) => [p.tradeId, p]));
          const ackSet = new Set(
            allAcks
              .filter((a) => a.status === 'Active')
              .map((a) => `${a.symbol}::${a.sessionDate}`),
          );

          const marksBySymbol = groupEffectiveMarksBySymbol(allMarks);

          const execsByTrade = new Map<string, ExecutionRecord[]>();
          for (const ex of executions) {
            const list = execsByTrade.get(ex.tradeId) ?? [];
            list.push(ex);
            execsByTrade.set(ex.tradeId, list);
          }

          const items: TradeBrowseItem[] = trades
            .filter((t) => !filter.lifecycleState || t.lifecycleState === filter.lifecycleState)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((t) => {
              let evaluation: LongStockEvaluation | null = null;
              let realizedPnlDisplay: string | null = null;
              let realizedRDisplay: string | null = null;

              if (t.lifecycleState === 'Open' || t.lifecycleState === 'Closed') {
                const tradeExecs = [...(execsByTrade.get(t.id) ?? [])].sort((a, b) => {
                  const byTime = a.economicTime.localeCompare(b.economicTime);
                  return byTime !== 0 ? byTime : a.recordedSequence - b.recordedSequence;
                });
                const derived = deriveLongStockPosition({
                  storedLifecycleState: t.lifecycleState,
                  plan: {
                    plannedQuantity: t.plannedQuantity,
                    intendedEntryPrice: t.intendedEntryPrice,
                    stopPrice: t.stopPrice,
                    targetPrice: t.targetPrice,
                  },
                  originalPlannedRisk: t.baseline.originalPlannedRisk,
                  executions: tradeExecs,
                });
                if (t.lifecycleState === 'Closed' || derived.lotMatches.length > 0) {
                  realizedPnlDisplay = derived.realizedPnlDisplay;
                  realizedRDisplay = derived.realizedRDisplay;
                }
                if (t.lifecycleState === 'Open') {
                  const entrySessionDate =
                    tradeExecs.length > 0
                      ? getExchangeDateForInstant(new Date(tradeExecs[0]!.economicTime))
                      : undefined;
                  const frame = resolveSymbolFrame(
                    t.symbol,
                    expectedSessionDate,
                    marksBySymbol,
                    ackSet,
                  );
                  evaluation = evaluateLongStockTrade({
                    derived,
                    plan: { stopPrice: t.stopPrice, targetPrice: t.targetPrice },
                    originalPlannedRisk: t.baseline.originalPlannedRisk,
                    expectedSessionDate,
                    entrySessionDate,
                    todayMark: frame.todayMark
                      ? { sessionDate: frame.todayMark.sessionDate, price: frame.todayMark.price }
                      : null,
                    priorMark: frame.priorMark
                      ? { sessionDate: frame.priorMark.sessionDate, price: frame.priorMark.price }
                      : null,
                    todayUnavailableAcknowledged: frame.todayUnavailableAcknowledged,
                  });
                }
              }

              return {
                id: t.id,
                symbol: t.symbol,
                lifecycleState: t.lifecycleState,
                strategyLabel: stratMap.get(t.strategyId) ?? 'Unknown Strategy',
                accountLabel: acctMap.get(t.accountId) ?? 'Unknown Account',
                institutionLabel: instMap.get(t.institutionId) ?? 'Unknown Institution',
                plannedQuantityDisplay: formatShares(t.plannedQuantity),
                openSharesDisplay: projMap.get(t.id)?.openSharesDisplay ?? '0',
                intendedEntryDisplay: toMoneyString(ExactNumber.fromJSON(t.intendedEntryPrice)),
                oneRDisplay: t.baseline.originalPlannedRiskDisplay,
                plannedRewardDisplay: t.baseline.originalPlannedRewardDisplay,
                plannedRRDisplay: t.baseline.plannedRewardToRiskDisplay,
                evaluation,
                realizedPnlDisplay,
                realizedRDisplay,
                closeReasonLabel: t.closeReasonId
                  ? (closeReasonMap.get(t.closeReasonId) ?? 'Unknown Close Reason')
                  : null,
                createdAt: t.createdAt,
              };
            });

          return { items };
        },
      );
    },

    async getTradeDetail(tradeId: string): Promise<TradeDetailCockpitViewModel | null> {
      const expectedSessionDate = getLatestCompletedSessionDate(getNow());
      return persistence.runReadTransaction(
        [
          'trades',
          'trade_facts',
          'executions',
          'deviations',
          'journal_entries',
          'journal_debt',
          'journal_declines',
          'catalog_institutions',
          'catalog_accounts',
          'catalog_strategies',
          'catalog_close_reasons',
          'market_marks',
          'market_acknowledgments',
        ],
        async (tx) => {
          const trade = await tx.get('trades', tradeId);
          if (!trade) {
            return null;
          }

          const [
            facts,
            executions,
            deviations,
            entries,
            debt,
            declines,
            institution,
            account,
            strategy,
            closeReason,
            symMarks,
            symAcks,
          ] = await Promise.all([
            tx.getAllByIndex('trade_facts', 'by_trade', tradeId),
            tx.getAllByIndex('executions', 'by_trade', tradeId),
            tx.getAllByIndex('deviations', 'by_trade', tradeId),
            tx.getAllByIndex('journal_entries', 'by_trade', tradeId),
            tx.getAllByIndex('journal_debt', 'by_trade', tradeId),
            tx.getAllByIndex('journal_declines', 'by_trade', tradeId),
            tx.get('catalog_institutions', trade.institutionId),
            tx.get('catalog_accounts', trade.accountId),
            tx.get('catalog_strategies', trade.strategyId),
            trade.closeReasonId ? tx.get('catalog_close_reasons', trade.closeReasonId) : undefined,
            tx.getAllByIndex('market_marks', 'by_symbol', trade.symbol),
            tx.getAllByIndex('market_acknowledgments', 'by_symbol', trade.symbol),
          ]);

          const tradeFacts = [...facts].sort((a, b) => a.recordedSequence - b.recordedSequence);
          const planFact = tradeFacts.find((f) => f.kind === 'PlanVersion');
          if (!planFact) {
            return null;
          }

          const sortedExecs = [...executions].sort((a, b) => {
            const byTime = a.economicTime.localeCompare(b.economicTime);
            return byTime !== 0 ? byTime : a.recordedSequence - b.recordedSequence;
          });

          const derived = deriveLongStockPosition({
            storedLifecycleState: trade.lifecycleState,
            plan: {
              plannedQuantity: trade.plannedQuantity,
              intendedEntryPrice: trade.intendedEntryPrice,
              stopPrice: trade.stopPrice,
              targetPrice: trade.targetPrice,
            },
            originalPlannedRisk: trade.baseline.originalPlannedRisk,
            executions: sortedExecs,
          });

          const ackSet = new Set(
            symAcks
              .filter((a) => a.status === 'Active')
              .map((a) => `${a.symbol}::${a.sessionDate}`),
          );
          const marksBySymbol = groupEffectiveMarksBySymbol(symMarks);
          const frame = resolveSymbolFrame(trade.symbol, expectedSessionDate, marksBySymbol, ackSet);
          const entrySessionDate =
            sortedExecs.length > 0
              ? getExchangeDateForInstant(new Date(sortedExecs[0]!.economicTime))
              : undefined;

          const evaluation =
            trade.lifecycleState === 'Open'
              ? evaluateLongStockTrade({
                  derived,
                  plan: { stopPrice: trade.stopPrice, targetPrice: trade.targetPrice },
                  originalPlannedRisk: trade.baseline.originalPlannedRisk,
                  expectedSessionDate,
                  entrySessionDate,
                  todayMark: frame.todayMark
                    ? { sessionDate: frame.todayMark.sessionDate, price: frame.todayMark.price }
                    : null,
                  priorMark: frame.priorMark
                    ? { sessionDate: frame.priorMark.sessionDate, price: frame.priorMark.price }
                    : null,
                  todayUnavailableAcknowledged: frame.todayUnavailableAcknowledged,
                })
              : null;

          // Build read-only Price History completed-session grid preserving explicit gaps,
          // stopping at closure date for Closed trades and computing Open+Realized or final Realized P&L.
          const priceHistory: PriceHistoryRow[] = [];
          const closedSessionDate =
            trade.lifecycleState === 'Closed' && trade.closedAt
              ? getExchangeDateForInstant(new Date(trade.closedAt))
              : null;
          const historyEndDate =
            closedSessionDate && closedSessionDate < expectedSessionDate
              ? closedSessionDate
              : expectedSessionDate;
          if (sortedExecs.length > 0) {
            const firstExecDate = entrySessionDate!;
            const effectiveMarks = new Map(
              symMarks.filter((m) => m.effective).map((m) => [m.sessionDate, m]),
            );
            const fromDate = firstExecDate <= historyEndDate ? firstExecDate : historyEndDate;
            const sessions = getCompletedSessionsBetween(fromDate, historyEndDate).reverse();
            for (const sessionDate of sessions) {
              const mrk = effectiveMarks.get(sessionDate);
              if (mrk) {
                const execsAsOfSession = sortedExecs.filter(
                  (ex) => getExchangeDateForInstant(new Date(ex.economicTime)) <= sessionDate,
                );
                const derivedAsOf = deriveLongStockPosition({
                  storedLifecycleState: trade.lifecycleState,
                  plan: {
                    plannedQuantity: trade.plannedQuantity,
                    intendedEntryPrice: trade.intendedEntryPrice,
                    stopPrice: trade.stopPrice,
                    targetPrice: trade.targetPrice,
                  },
                  originalPlannedRisk: trade.baseline.originalPlannedRisk,
                  executions: execsAsOfSession,
                });
                const price = ExactNumber.fromJSON(mrk.price);
                if (derivedAsOf.averageEntryPrice && derivedAsOf.openShares.num > 0n) {
                  const openPnl = sub(
                    mul(sub(price, derivedAsOf.averageEntryPrice), derivedAsOf.openShares),
                    derivedAsOf.feeReconciliation.openingFeesUnconsumed,
                  );
                  const pnl = add(derivedAsOf.realizedPnl, openPnl);
                  priceHistory.push({
                    sessionDate,
                    sessionDateShort: formatSessionDateShort(sessionDate),
                    markDisplay: toMoneyString(price),
                    unavailableAcknowledged: false,
                    tradePnlDisplay: toMoneyString(pnl, true),
                    tradePnlPositive: pnl.num >= 0n,
                  });
                } else if (derivedAsOf.lotMatches.length > 0) {
                  priceHistory.push({
                    sessionDate,
                    sessionDateShort: formatSessionDateShort(sessionDate),
                    markDisplay: toMoneyString(price),
                    unavailableAcknowledged: false,
                    tradePnlDisplay: derivedAsOf.realizedPnlDisplay,
                    tradePnlPositive: derivedAsOf.realizedPnl.num >= 0n,
                  });
                } else {
                  priceHistory.push({
                    sessionDate,
                    sessionDateShort: formatSessionDateShort(sessionDate),
                    markDisplay: toMoneyString(price),
                    unavailableAcknowledged: false,
                    tradePnlDisplay: null,
                    tradePnlPositive: null,
                  });
                }
              } else {
                priceHistory.push({
                  sessionDate,
                  sessionDateShort: formatSessionDateShort(sessionDate),
                  markDisplay: null,
                  unavailableAcknowledged: ackSet.has(`${trade.symbol}::${sessionDate}`),
                  tradePnlDisplay: null,
                  tradePnlPositive: null,
                });
              }
            }
          }

          const stopPriceRat = ExactNumber.fromJSON(trade.stopPrice);
          const targetPriceRat = ExactNumber.fromJSON(trade.targetPrice);
          const stopDisciplineDeviations = deviations
            .filter((d) => d.kind === 'StopDiscipline' && !d.voided)
            .sort((a, b) => (a.startSessionDate ?? '').localeCompare(b.startSessionDate ?? ''));

          let planVsActual: PlanVsActualSummary | null = null;
          if (trade.lifecycleState === 'Closed') {
            const buyExecs = sortedExecs.filter((e) => e.side === 'Buy');
            const sellExecs = sortedExecs.filter((e) => e.side === 'Sell');
            const effectiveSortedMarks = symMarks
              .filter(
                (m) =>
                  m.effective &&
                  (!entrySessionDate || m.sessionDate >= entrySessionDate) &&
                  (!closedSessionDate || m.sessionDate <= closedSessionDate),
              )
              .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
            const firstStopSession =
              effectiveSortedMarks.find(
                (m) => cmp(ExactNumber.fromJSON(m.price), stopPriceRat) <= 0,
              )?.sessionDate ?? null;
            const firstTargetSession =
              effectiveSortedMarks.find(
                (m) => cmp(ExactNumber.fromJSON(m.price), targetPriceRat) >= 0,
              )?.sessionDate ?? null;

            const plannedEntrySummary = `${formatShares(trade.plannedQuantity)} shares at ${toMoneyString(ExactNumber.fromJSON(trade.intendedEntryPrice))}`;
            const actualEntrySummary =
              buyExecs.length === 1 && derived.entryQuality
                ? `Bought ${formatShares(buyExecs[0]!.quantity)} at ${toMoneyString(derived.entryQuality.averageEntryPrice)} (${formatSessionDateShort(getExchangeDateForInstant(new Date(buyExecs[0]!.economicTime)))})`
                : `${buyExecs.length} fills, avg ${derived.entryQuality?.averageEntryPriceDisplay ?? '—'}`;
            const exitSummary = sellExecs
              .map(
                (e) =>
                  `Sold ${formatShares(e.quantity)} at ${toMoneyString(ExactNumber.fromJSON(e.fillPrice))} (${formatSessionDateShort(getExchangeDateForInstant(new Date(e.economicTime)))})`,
              )
              .join('; ');

            planVsActual = {
              plannedEntrySummary,
              actualEntrySummary,
              stopFirstReachedShort: firstStopSession
                ? formatSessionDateShort(firstStopSession)
                : null,
              targetFirstReachedShort: firstTargetSession
                ? formatSessionDateShort(firstTargetSession)
                : null,
              exitSummary: exitSummary || (trade.terminalDisposition ?? 'Closed'),
              plannedResultSummary: `+${trade.baseline.originalPlannedRewardDisplay} · +${trade.baseline.plannedRewardToRiskDisplay}`,
              actualResultSummary: `${derived.realizedPnlDisplay}${derived.realizedRDisplay ? ` · ${derived.realizedRDisplay}` : ''}`,
              actualResultPositive: derived.realizedPnl.num >= 0n,
            };
          }

          return {
            trade,
            strategyLabel: strategy?.currentLabel ?? 'Unknown Strategy',
            accountLabel: account?.currentLabel ?? 'Unknown Account',
            institutionLabel: institution?.currentLabel ?? 'Unknown Institution',
            closeReasonLabel: closeReason?.currentLabel ?? null,
            closedAtShort: trade.closedAt
              ? formatSessionDateShort(getExchangeDateForInstant(new Date(trade.closedAt)))
              : null,
            plannedQuantityDisplay: formatShares(trade.plannedQuantity),
            intendedEntryDisplay: toMoneyString(ExactNumber.fromJSON(trade.intendedEntryPrice)),
            stopPriceDisplay: toMoneyString(stopPriceRat),
            targetPriceDisplay: toMoneyString(targetPriceRat),
            expectedSessionDate,
            expectedSessionDateShort: formatSessionDateShort(expectedSessionDate),
            planFact,
            executions: sortedExecs,
            derived,
            evaluation,
            stopDisciplineDeviations,
            planVsActual,
            priceHistory,
            journalEntries: [...entries].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
            journalDebt: [...debt].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
            journalDeclines: [...declines].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
          };
        },
      );
    },

    async getReviewMarksView(sessionDateOverride?: string): Promise<ReviewMarksViewModel> {
      const sessionDate = sessionDateOverride ?? getLatestCompletedSessionDate(getNow());

      return persistence.runReadTransaction(
        [
          'trades',
          'executions',
          'catalog_institutions',
          'catalog_accounts',
          'catalog_strategies',
          'proj_trade_analysis_input',
          'market_meta',
          'market_marks',
          'market_acknowledgments',
        ],
        async (tx) => {
          const [
            trades,
            executions,
            institutions,
            accounts,
            strategies,
            projections,
            meta,
            allMarks,
            allAcks,
          ] = await Promise.all([
            tx.getAll('trades'),
            tx.getAll('executions'),
            tx.getAll('catalog_institutions'),
            tx.getAll('catalog_accounts'),
            tx.getAll('catalog_strategies'),
            tx.getAll('proj_trade_analysis_input'),
            tx.get('market_meta', 'singleton'),
            tx.getAll('market_marks'),
            tx.getAll('market_acknowledgments'),
          ]);

          const instMap = new Map(institutions.map((i) => [i.id, i.currentLabel]));
          const acctMap = new Map(accounts.map((a) => [a.id, a.currentLabel]));
          const stratMap = new Map(strategies.map((s) => [s.id, s.currentLabel]));
          const projMap = new Map(projections.map((p) => [p.tradeId, p]));
          const marksBySymbol = groupEffectiveMarksBySymbol(allMarks);
          const ackSet = new Set(
            allAcks
              .filter((a) => a.status === 'Active')
              .map((a) => `${a.symbol}::${a.sessionDate}`),
          );

          const execsByTrade = new Map<string, ExecutionRecord[]>();
          for (const ex of executions) {
            const list = execsByTrade.get(ex.tradeId) ?? [];
            list.push(ex);
            execsByTrade.set(ex.tradeId, list);
          }

          const openRecords = trades
            .filter((t) => t.lifecycleState === 'Open')
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

          const symbolMap = new Map<string, { count: number; fallbackEntry: Rational }>();
          const openTrades: TradeBrowseItem[] = openRecords.map((t) => {
            const tradeExecs = [...(execsByTrade.get(t.id) ?? [])].sort((a, b) => {
              const byTime = a.economicTime.localeCompare(b.economicTime);
              return byTime !== 0 ? byTime : a.recordedSequence - b.recordedSequence;
            });
            const derived = deriveLongStockPosition({
              storedLifecycleState: t.lifecycleState,
              plan: {
                plannedQuantity: t.plannedQuantity,
                intendedEntryPrice: t.intendedEntryPrice,
                stopPrice: t.stopPrice,
                targetPrice: t.targetPrice,
              },
              originalPlannedRisk: t.baseline.originalPlannedRisk,
              executions: tradeExecs,
            });
            const entrySessionDate =
              tradeExecs.length > 0
                ? getExchangeDateForInstant(new Date(tradeExecs[0]!.economicTime))
                : undefined;
            const frame = resolveSymbolFrame(t.symbol, sessionDate, marksBySymbol, ackSet);
            const evaluation = evaluateLongStockTrade({
              derived,
              plan: { stopPrice: t.stopPrice, targetPrice: t.targetPrice },
              originalPlannedRisk: t.baseline.originalPlannedRisk,
              expectedSessionDate: sessionDate,
              entrySessionDate,
              todayMark: frame.todayMark
                ? { sessionDate: frame.todayMark.sessionDate, price: frame.todayMark.price }
                : null,
              priorMark: frame.priorMark
                ? { sessionDate: frame.priorMark.sessionDate, price: frame.priorMark.price }
                : null,
              todayUnavailableAcknowledged: frame.todayUnavailableAcknowledged,
            });

            const existing = symbolMap.get(t.symbol);
            if (existing) {
              existing.count += 1;
            } else {
              symbolMap.set(t.symbol, {
                count: 1,
                fallbackEntry:
                  derived.averageEntryPrice ?? ExactNumber.fromJSON(t.intendedEntryPrice),
              });
            }

            return {
              id: t.id,
              symbol: t.symbol,
              lifecycleState: t.lifecycleState,
              strategyLabel: stratMap.get(t.strategyId) ?? 'Unknown Strategy',
              accountLabel: acctMap.get(t.accountId) ?? 'Unknown Account',
              institutionLabel: instMap.get(t.institutionId) ?? 'Unknown Institution',
              plannedQuantityDisplay: formatShares(t.plannedQuantity),
              openSharesDisplay: projMap.get(t.id)?.openSharesDisplay ?? '0',
              intendedEntryDisplay: toMoneyString(ExactNumber.fromJSON(t.intendedEntryPrice)),
              oneRDisplay: t.baseline.originalPlannedRiskDisplay,
              plannedRewardDisplay: t.baseline.originalPlannedRewardDisplay,
              plannedRRDisplay: t.baseline.plannedRewardToRiskDisplay,
              realizedPnlDisplay:
                derived.lotMatches.length > 0 ? derived.realizedPnlDisplay : null,
              realizedRDisplay:
                derived.lotMatches.length > 0 ? derived.realizedRDisplay : null,
              closeReasonLabel: null,
              evaluation,
              createdAt: t.createdAt,
            };
          });

          const rows: ReviewMarkSymbolRow[] = [...symbolMap.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([symbol, info]) => {
              const frame = resolveSymbolFrame(symbol, sessionDate, marksBySymbol, ackSet);
              const priorPrice = frame.priorMark ? ExactNumber.fromJSON(frame.priorMark.price) : null;
              const todayPrice = frame.todayMark ? ExactNumber.fromJSON(frame.todayMark.price) : null;
              return {
                symbol,
                openTradeCount: info.count,
                priorSessionDate: frame.priorMark?.sessionDate ?? null,
                priorMarkDisplay: priorPrice ? toMoneyString(priorPrice) : null,
                referencePrice: priorPrice ?? info.fallbackEntry,
                todayMarkDisplay: todayPrice ? toMoneyString(todayPrice) : null,
                todayMarkRaw: todayPrice ? formatMarkRaw(todayPrice) : '',
                todayUnavailableAcknowledged: frame.todayUnavailableAcknowledged,
              };
            });

          return {
            sessionDate,
            sessionDateShort: formatSessionDateShort(sessionDate),
            snapshotId: meta?.snapshotId ?? 0,
            rows,
            openTrades,
          };
        },
      );
    },

    async replayTrade(
      tradeId: string,
      options?: { readonly asOfSessionDate?: string },
    ): Promise<TradeReplayViewResult> {
      const rawAsOf = options?.asOfSessionDate ?? null;
      if (rawAsOf !== null && !/^\d{4}-\d{2}-\d{2}$/.test(rawAsOf)) {
        throw new Error(`Invalid asOfSessionDate: ${rawAsOf}`);
      }
      const latestCompleted = getLatestCompletedSessionDate(getNow());
      const asOfDate =
        rawAsOf !== null && rawAsOf > latestCompleted ? latestCompleted : rawAsOf;
      const expectedSessionDate = asOfDate ?? latestCompleted;

      return persistence.runReadTransaction(
        [
          'trades',
          'trade_facts',
          'executions',
          'journal_entries',
          'catalog_institutions',
          'catalog_accounts',
          'catalog_strategies',
          'catalog_close_reasons',
          'market_marks',
          'market_acknowledgments',
        ],
        async (tx) => {
          const trade = await tx.get('trades', tradeId);
          if (!trade) {
            return { status: 'NotFound', tradeId };
          }

          const [
            facts,
            executions,
            entries,
            institution,
            account,
            strategy,
            closeReason,
            symMarks,
            symAcks,
          ] = await Promise.all([
            tx.getAllByIndex('trade_facts', 'by_trade', tradeId),
            tx.getAllByIndex('executions', 'by_trade', tradeId),
            tx.getAllByIndex('journal_entries', 'by_trade', tradeId),
            tx.get('catalog_institutions', trade.institutionId),
            tx.get('catalog_accounts', trade.accountId),
            tx.get('catalog_strategies', trade.strategyId),
            trade.closeReasonId
              ? tx.get('catalog_close_reasons', trade.closeReasonId)
              : undefined,
            tx.getAllByIndex('market_marks', 'by_symbol', trade.symbol),
            tx.getAllByIndex('market_acknowledgments', 'by_symbol', trade.symbol),
          ]);

          const hasPlanVersion = facts.some((f) => f.kind === 'PlanVersion');
          if (!hasPlanVersion) {
            return {
              status: 'IntegrityBlocked',
              tradeId,
              reason: 'Missing initial PlanVersion fact.',
            };
          }

          const sortedExecs = [...executions].sort((a, b) => {
            const byTime = a.economicTime.localeCompare(b.economicTime);
            return byTime !== 0 ? byTime : a.recordedSequence - b.recordedSequence;
          });

          if (sortedExecs.length === 0) {
            return { status: 'NotApplicable', tradeId, reason: 'UnenteredTrade' };
          }

          const derived = deriveLongStockPosition({
            storedLifecycleState: trade.lifecycleState,
            plan: {
              plannedQuantity: trade.plannedQuantity,
              intendedEntryPrice: trade.intendedEntryPrice,
              stopPrice: trade.stopPrice,
              targetPrice: trade.targetPrice,
            },
            originalPlannedRisk: trade.baseline.originalPlannedRisk,
            executions: sortedExecs,
          });
          if (derived.integrityDisagreement) {
            return {
              status: 'IntegrityBlocked',
              tradeId,
              reason: `Stored lifecycle (${trade.lifecycleState}) disagrees with derived position (${derived.derivedLifecycleState}).`,
            };
          }

          const replayExecs = asOfDate
            ? sortedExecs.filter(
                (ex) => getExchangeDateForInstant(new Date(ex.economicTime)) <= asOfDate,
              )
            : sortedExecs;
          if (replayExecs.length === 0) {
            return { status: 'NotApplicable', tradeId, reason: 'NotEnteredAsOf' };
          }

          const firstExecDate = getExchangeDateForInstant(
            new Date(replayExecs[0]!.economicTime),
          );
          const rawClosedSessionDate =
            trade.lifecycleState === 'Closed'
              ? getExchangeDateForInstant(
                  new Date(
                    trade.closedAt ?? sortedExecs[sortedExecs.length - 1]!.economicTime,
                  ),
                )
              : null;

          const closedSessionDate =
            rawClosedSessionDate !== null &&
            (asOfDate === null || rawClosedSessionDate <= asOfDate)
              ? rawClosedSessionDate
              : null;

          let endSessionDate: string;
          if (closedSessionDate !== null) {
            endSessionDate = closedSessionDate;
          } else if (expectedSessionDate >= firstExecDate) {
            endSessionDate = expectedSessionDate;
          } else {
            endSessionDate = firstExecDate;
          }

          const isUnfinishedToday =
            asOfDate === null &&
            closedSessionDate === null &&
            endSessionDate > expectedSessionDate;

          const sessions = getCompletedSessionsBetween(firstExecDate, endSessionDate);
          const replayInput = assembleLongStockReplayInput({
            tradeId: trade.id,
            symbol: trade.symbol,
            plan: {
              plannedQuantity: trade.plannedQuantity,
              intendedEntryPrice: trade.intendedEntryPrice,
              stopPrice: trade.stopPrice,
              targetPrice: trade.targetPrice,
            },
            originalPlannedRisk: trade.baseline.originalPlannedRisk,
            originalPlannedReward: trade.baseline.originalPlannedReward,
            sortedExecutions: replayExecs,
            sessions,
            cutoffDate: endSessionDate,
            ...(isUnfinishedToday ? { inProgressSessionDate: endSessionDate } : {}),
            effectiveMarks: symMarks
              .filter((m) => m.effective)
              .map((m) => ({ sessionDate: m.sessionDate, price: m.price })),
            acknowledgedUnavailableDates: symAcks
              .filter((a) => a.status === 'Active')
              .map((a) => a.sessionDate),
            reviewActions: extractReplayReviewActions(entries, DAILY_TRADE_REVIEW_TYPE_ID),
          });
          const replay = replayLongStockTrade(replayInput);

          const isClosedAsOf = closedSessionDate !== null;
          return {
            status: 'Ready',
            view: {
              trade,
              strategyLabel: strategy?.currentLabel ?? 'Long Stock',
              accountLabel: account?.currentLabel ?? 'Account',
              institutionLabel: institution?.currentLabel ?? 'Institution',
              closeReasonLabel: isClosedAsOf ? (closeReason?.currentLabel ?? null) : null,
              closedAtShort: closedSessionDate
                ? formatSessionDateShort(closedSessionDate)
                : null,
              terminalDisposition: isClosedAsOf
                ? (trade.terminalDisposition ?? derived.terminalDisposition ?? 'Closed')
                : null,
              expectedSessionDate,
              expectedSessionDateShort: formatSessionDateShort(expectedSessionDate),
              replay,
            },
          };
        },
      );
    },
  };
}
