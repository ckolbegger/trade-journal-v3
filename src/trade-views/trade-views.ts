import {
  formatSessionDateShort,
  getCompletedSessionsBetween,
  getExchangeDateForInstant,
  getLatestCompletedSessionDate,
} from '../market-data/session-calendar';
import type {
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
  ExactNumber,
  mul,
  sub,
  toDecimalString,
  toMoneyString,
  type Rational,
} from '../shared/exact-number';
import { deriveLongStockPosition, type DerivedLongStockState } from '../trade-analysis/derive';
import { evaluateLongStockTrade, type LongStockEvaluation } from '../trade-analysis/evaluate';

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

export interface TradeDetailCockpitViewModel {
  readonly trade: TradeRecordRow;
  readonly strategyLabel: string;
  readonly accountLabel: string;
  readonly institutionLabel: string;
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

export interface TradeViewsAndReporting {
  browseTrades(filter?: {
    readonly lifecycleState?: TradeLifecycleState;
  }): Promise<{ readonly items: readonly TradeBrowseItem[] }>;
  getTradeDetail(tradeId: string): Promise<TradeDetailCockpitViewModel | null>;
  getReviewMarksView(sessionDate?: string): Promise<ReviewMarksViewModel>;
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
            projections,
            allMarks,
            allAcks,
          ] = await Promise.all([
            tx.getAll('trades'),
            tx.getAll('executions'),
            tx.getAll('catalog_institutions'),
            tx.getAll('catalog_accounts'),
            tx.getAll('catalog_strategies'),
            tx.getAll('proj_trade_analysis_input'),
            tx.getAll('market_marks'),
            tx.getAll('market_acknowledgments'),
          ]);

          const instMap = new Map(institutions.map((i) => [i.id, i.currentLabel]));
          const acctMap = new Map(accounts.map((a) => [a.id, a.currentLabel]));
          const stratMap = new Map(strategies.map((s) => [s.id, s.currentLabel]));
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
              if (t.lifecycleState === 'Open') {
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
                  executions: tradeExecs,
                });
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
          'journal_entries',
          'journal_debt',
          'journal_declines',
          'catalog_institutions',
          'catalog_accounts',
          'catalog_strategies',
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
            entries,
            debt,
            declines,
            institution,
            account,
            strategy,
            symMarks,
            symAcks,
          ] = await Promise.all([
            tx.getAllByIndex('trade_facts', 'by_trade', tradeId),
            tx.getAllByIndex('executions', 'by_trade', tradeId),
            tx.getAllByIndex('journal_entries', 'by_trade', tradeId),
            tx.getAllByIndex('journal_debt', 'by_trade', tradeId),
            tx.getAllByIndex('journal_declines', 'by_trade', tradeId),
            tx.get('catalog_institutions', trade.institutionId),
            tx.get('catalog_accounts', trade.accountId),
            tx.get('catalog_strategies', trade.strategyId),
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
          // evaluating each session against the position as-of that session date.
          const priceHistory: PriceHistoryRow[] = [];
          if (sortedExecs.length > 0) {
            const firstExecDate = entrySessionDate!;
            const effectiveMarks = new Map(
              symMarks.filter((m) => m.effective).map((m) => [m.sessionDate, m]),
            );
            const fromDate =
              firstExecDate <= expectedSessionDate ? firstExecDate : expectedSessionDate;
            const sessions = getCompletedSessionsBetween(fromDate, expectedSessionDate).reverse();
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
                  executions: execsAsOfSession,
                });
                const price = ExactNumber.fromJSON(mrk.price);
                if (derivedAsOf.averageEntryPrice && derivedAsOf.openShares.num > 0n) {
                  const pnl = sub(
                    mul(sub(price, derivedAsOf.averageEntryPrice), derivedAsOf.openShares),
                    derivedAsOf.totalOpeningFees,
                  );
                  priceHistory.push({
                    sessionDate,
                    sessionDateShort: formatSessionDateShort(sessionDate),
                    markDisplay: toMoneyString(price),
                    unavailableAcknowledged: false,
                    tradePnlDisplay: toMoneyString(pnl, true),
                    tradePnlPositive: pnl.num >= 0n,
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

          return {
            trade,
            strategyLabel: strategy?.currentLabel ?? 'Unknown Strategy',
            accountLabel: account?.currentLabel ?? 'Unknown Account',
            institutionLabel: institution?.currentLabel ?? 'Unknown Institution',
            plannedQuantityDisplay: formatShares(trade.plannedQuantity),
            intendedEntryDisplay: toMoneyString(ExactNumber.fromJSON(trade.intendedEntryPrice)),
            stopPriceDisplay: toMoneyString(ExactNumber.fromJSON(trade.stopPrice)),
            targetPriceDisplay: toMoneyString(ExactNumber.fromJSON(trade.targetPrice)),
            expectedSessionDate,
            expectedSessionDateShort: formatSessionDateShort(expectedSessionDate),
            planFact,
            executions: sortedExecs,
            derived,
            evaluation,
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
  };
}
