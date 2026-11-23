import type {
  MarketAcknowledgmentRecord,
  MarketMarkRecord,
  MarketMetaRecord,
  PersistenceSeam,
} from '../persistence/idb';
import type { Clock } from '../shared/clock';
import {
  abs,
  cmp,
  div,
  ExactNumber,
  fromDecimalString,
  fromInteger,
  isPositive,
  mul,
  sub,
  toDecimalString,
  toMoneyString,
  tryFromDecimalString,
  type Rational,
} from '../shared/exact-number';
import type { RuntimeNotWritableResult } from '../shared/result';
import {
  getCompletedSessionsBetween,
  isUsTradingDay,
  SESSION_POLICY_REVISION,
} from './session-calendar';

export type MarketDataSaveCommand =
  | {
      readonly kind: 'SaveManualMark';
      readonly symbol: string;
      readonly sessionDate: string;
      readonly price: string;
      readonly intent: 'Initial' | 'Override' | 'Correction';
      readonly reason?: string;
    }
  | {
      readonly kind: 'AssertUnavailable';
      readonly symbol: string;
      readonly sessionDate: string;
      readonly reason?: string;
    }
  | {
      readonly kind: 'WithdrawAcknowledgment';
      readonly symbol: string;
      readonly sessionDate: string;
    };

export type MarketDataSaveResult =
  | {
      readonly status: 'Saved';
      readonly snapshotId: number;
      readonly symbol: string;
      readonly sessionDate: string;
      readonly mark?: MarketMarkRecord;
      readonly acknowledgment?: MarketAcknowledgmentRecord;
    }
  | {
      readonly status: 'Rejected';
      readonly message: string;
    }
  | RuntimeNotWritableResult;

export interface SymbolMarkFrame {
  readonly symbol: string;
  readonly expectedSessionDate: string;
  readonly todayMark: MarketMarkRecord | null;
  readonly todayAcknowledgment: MarketAcknowledgmentRecord | null;
  readonly priorMark: MarketMarkRecord | null;
}

export interface MarketSeriesRow {
  readonly sessionDate: string;
  readonly mark: MarketMarkRecord | null;
  readonly unavailableAcknowledged: boolean;
}

export type MarkSanityCheck =
  | { readonly status: 'Ok'; readonly price: Rational }
  | { readonly status: 'Error'; readonly message: string }
  | {
      readonly status: 'ConfirmDecimalSlip';
      readonly enteredDisplay: string;
      readonly suggestedDisplay: string;
      readonly suggestedRaw: string;
      readonly message: string;
    }
  | {
      readonly status: 'ConfirmOutlier';
      readonly pctMoveDisplay: string;
      readonly message: string;
    };

export interface MarketData {
  save(command: MarketDataSaveCommand): Promise<MarketDataSaveResult>;
  resolveFrames(request: {
    readonly symbols: readonly string[];
    readonly expectedSessionDate: string;
  }): Promise<{
    readonly snapshotId: number;
    readonly bySymbol: Record<string, SymbolMarkFrame>;
  }>;
  readSeries(request: {
    readonly symbol: string;
    readonly fromDate: string;
    readonly toDate: string;
  }): Promise<{
    readonly snapshotId: number;
    readonly rows: readonly MarketSeriesRow[];
  }>;
  inspectObservations(request: {
    readonly symbol: string;
    readonly sessionDate: string;
  }): Promise<{
    readonly marks: readonly MarketMarkRecord[];
    readonly acknowledgments: readonly MarketAcknowledgmentRecord[];
  }>;
}

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

function isValidYmd(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d;
}

function genId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Pure OV-03 stock typo & outlier sanity check for the Marks grid:
 * - Rejects <= $0.00 for stocks
 * - Detects ~10x decimal slips (e.g. typing 440 when prior was $44.00 -> "$44.00 or $440.00?")
 * - Flags > 5% stock moves for explicit confirmation
 */
export function checkStockMarkSanity(
  rawInput: string,
  referencePrice: Rational | null,
): MarkSanityCheck {
  const price = tryFromDecimalString(rawInput);
  if (!price) {
    return { status: 'Error', message: 'Enter a valid price (e.g., 145.50).' };
  }
  if (!isPositive(price)) {
    return { status: 'Error', message: 'Stock Mark must be greater than $0.00.' };
  }

  if (referencePrice && isPositive(referencePrice)) {
    const ratio = div(price, referencePrice);
    // Check ~10x upward decimal slip (ratio between 7x and 13x)
    if (cmp(ratio, fromInteger(7)) >= 0 && cmp(ratio, fromInteger(13)) <= 0) {
      const divided = div(price, fromInteger(10));
      return {
        status: 'ConfirmDecimalSlip',
        enteredDisplay: toMoneyString(price),
        suggestedDisplay: toMoneyString(divided),
        suggestedRaw: toDecimalString(divided, 2),
        message: `${toMoneyString(divided)} or ${toMoneyString(price)}?`,
      };
    }
    // Check ~10x downward decimal slip (ratio between 1/13 and 1/7)
    const invRatio = div(referencePrice, price);
    if (cmp(invRatio, fromInteger(7)) >= 0 && cmp(invRatio, fromInteger(13)) <= 0) {
      const multiplied = mul(price, fromInteger(10));
      return {
        status: 'ConfirmDecimalSlip',
        enteredDisplay: toMoneyString(price),
        suggestedDisplay: toMoneyString(multiplied),
        suggestedRaw: toDecimalString(multiplied, 2),
        message: `${toMoneyString(multiplied)} or ${toMoneyString(price)}?`,
      };
    }

    const pctMove = div(abs(sub(price, referencePrice)), referencePrice);
    const fivePercent = fromDecimalString('0.05');
    if (cmp(pctMove, fivePercent) > 0) {
      const pctNum = toDecimalString(div(abs(sub(price, referencePrice)), div(referencePrice, fromInteger(100))), 1);
      return {
        status: 'ConfirmOutlier',
        pctMoveDisplay: `${pctNum}%`,
        message: `${pctNum}% move from ${toMoneyString(referencePrice)} — confirm?`,
      };
    }
  }

  return { status: 'Ok', price };
}

export function createMarketData(options: {
  readonly persistence: PersistenceSeam;
  readonly clock: Clock;
}): MarketData {
  const { persistence, clock } = options;

  return {
    async save(command: MarketDataSaveCommand): Promise<MarketDataSaveResult> {
      const symbol = normalizeSymbol(command.symbol);
      if (!symbol) {
        return { status: 'Rejected', message: 'Symbol is required.' };
      }
      if (!isValidYmd(command.sessionDate)) {
        return { status: 'Rejected', message: 'Session date must be a valid YYYY-MM-DD date.' };
      }
      if (!isUsTradingDay(command.sessionDate)) {
        return {
          status: 'Rejected',
          message: `${command.sessionDate} is not a U.S. equity trading session.`,
        };
      }

      const txResult = await persistence.runWriteTransaction(
        ['market_meta', 'market_marks', 'market_acknowledgments'],
        async (tx): Promise<Exclude<MarketDataSaveResult, RuntimeNotWritableResult>> => {
          const now = clock.nowIso();
          const [meta, existingMarks, existingAcks] = await Promise.all([
            tx.get('market_meta', 'singleton'),
            tx.getAllByIndex('market_marks', 'by_symbol_date', [symbol, command.sessionDate]),
            tx.getAllByIndex('market_acknowledgments', 'by_symbol_date', [
              symbol,
              command.sessionDate,
            ]),
          ]);

          const nextSnapshotId = (meta?.snapshotId ?? 0) + 1;
          const nextMeta: MarketMetaRecord = {
            key: 'singleton',
            snapshotId: nextSnapshotId,
            sessionPolicyRevision: SESSION_POLICY_REVISION,
            updatedAt: now,
          };

          if (command.kind === 'SaveManualMark') {
            const parsedPrice = tryFromDecimalString(command.price);
            if (!parsedPrice) {
              return {
                status: 'Rejected',
                message: 'Enter a valid price (e.g., 145.50).',
              };
            }
            if (!isPositive(parsedPrice)) {
              return {
                status: 'Rejected',
                message: 'Stock Mark price must be greater than $0.00.',
              };
            }

            const maxRev = existingMarks.reduce((m, r) => Math.max(m, r.revision), 0);
            for (const oldMark of existingMarks) {
              if (oldMark.effective) {
                tx.put('market_marks', { ...oldMark, effective: false });
              }
            }

            // Supersede any active Unavailable acknowledgment while preserving history
            for (const oldAck of existingAcks) {
              if (oldAck.status === 'Active') {
                tx.put('market_acknowledgments', { ...oldAck, status: 'Superseded' });
              }
            }

            const newMark: MarketMarkRecord = {
              id: genId('mrk'),
              symbol,
              sessionDate: command.sessionDate,
              price: ExactNumber.toJSON(parsedPrice),
              source: 'Manual',
              intent: command.intent,
              reason: command.reason?.trim() || undefined,
              revision: maxRev + 1,
              effective: true,
              recordedAt: now,
            };

            tx.put('market_marks', newMark);
            tx.put('market_meta', nextMeta);

            return {
              status: 'Saved',
              snapshotId: nextSnapshotId,
              symbol,
              sessionDate: command.sessionDate,
              mark: newMark,
            };
          }

          if (command.kind === 'AssertUnavailable') {
            if (existingMarks.some((m) => m.effective)) {
              return {
                status: 'Rejected',
                message:
                  'A Mark already exists for this session; correct it instead of marking unavailable.',
              };
            }
            for (const oldAck of existingAcks) {
              if (oldAck.status === 'Active') {
                tx.put('market_acknowledgments', { ...oldAck, status: 'Superseded' });
              }
            }
            const ack: MarketAcknowledgmentRecord = {
              id: genId('ack'),
              symbol,
              sessionDate: command.sessionDate,
              status: 'Active',
              reason: command.reason?.trim() || undefined,
              recordedAt: now,
            };
            tx.put('market_acknowledgments', ack);
            tx.put('market_meta', nextMeta);

            return {
              status: 'Saved',
              snapshotId: nextSnapshotId,
              symbol,
              sessionDate: command.sessionDate,
              acknowledgment: ack,
            };
          }

          // WithdrawAcknowledgment
          let updatedAck: MarketAcknowledgmentRecord | undefined;
          for (const oldAck of existingAcks) {
            if (oldAck.status === 'Active') {
              updatedAck = { ...oldAck, status: 'Withdrawn' };
              tx.put('market_acknowledgments', updatedAck);
            }
          }
          if (!updatedAck) {
            return {
              status: 'Rejected',
              message: 'No active unavailable acknowledgment to withdraw for this session.',
            };
          }
          tx.put('market_meta', nextMeta);

          return {
            status: 'Saved',
            snapshotId: nextSnapshotId,
            symbol,
            sessionDate: command.sessionDate,
            acknowledgment: updatedAck,
          };
        },
      );

      if (txResult.status === 'RuntimeNotWritable') {
        return txResult;
      }
      return txResult.value;
    },

    async resolveFrames({ symbols, expectedSessionDate }) {
      const uniqueSymbols = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
      return persistence.runReadTransaction(
        ['market_meta', 'market_marks', 'market_acknowledgments'],
        async (tx) => {
          const meta = await tx.get('market_meta', 'singleton');
          const perSymbol = await Promise.all(
            uniqueSymbols.map(async (sym) => {
              const [marks, acks] = await Promise.all([
                tx.getAllByIndex('market_marks', 'by_symbol', sym),
                tx.getAllByIndex('market_acknowledgments', 'by_symbol_date', [
                  sym,
                  expectedSessionDate,
                ]),
              ]);
              return { sym, marks, acks };
            }),
          );

          const bySymbol: Record<string, SymbolMarkFrame> = {};
          for (const { sym, marks, acks } of perSymbol) {
            const symMarks = marks.filter((m) => m.effective);
            const todayMark =
              symMarks.find((m) => m.sessionDate === expectedSessionDate) ?? null;

            const priorMarks = symMarks
              .filter((m) => m.sessionDate < expectedSessionDate)
              .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
            const priorMark = priorMarks[0] ?? null;

            const todayAcknowledgment = acks.find((a) => a.status === 'Active') ?? null;

            bySymbol[sym] = {
              symbol: sym,
              expectedSessionDate,
              todayMark,
              todayAcknowledgment,
              priorMark,
            };
          }

          return {
            snapshotId: meta?.snapshotId ?? 0,
            bySymbol,
          };
        },
      );
    },

    async readSeries({ symbol, fromDate, toDate }) {
      const sym = normalizeSymbol(symbol);
      const sessions = getCompletedSessionsBetween(fromDate, toDate);
      return persistence.runReadTransaction(
        ['market_meta', 'market_marks', 'market_acknowledgments'],
        async (tx) => {
          const [meta, symMarks, symAcks] = await Promise.all([
            tx.get('market_meta', 'singleton'),
            tx.getAllByIndex('market_marks', 'by_symbol', sym),
            tx.getAllByIndex('market_acknowledgments', 'by_symbol', sym),
          ]);

          const markByDate = new Map(
            symMarks.filter((m) => m.effective).map((m) => [m.sessionDate, m]),
          );
          const ackDates = new Set(
            symAcks.filter((a) => a.status === 'Active').map((a) => a.sessionDate),
          );

          const rows: MarketSeriesRow[] = sessions.map((sessionDate) => ({
            sessionDate,
            mark: markByDate.get(sessionDate) ?? null,
            unavailableAcknowledged: ackDates.has(sessionDate),
          }));

          return {
            snapshotId: meta?.snapshotId ?? 0,
            rows,
          };
        },
      );
    },

    async inspectObservations({ symbol, sessionDate }) {
      const sym = normalizeSymbol(symbol);
      return persistence.runReadTransaction(['market_marks', 'market_acknowledgments'], async (tx) => {
        const [marks, acknowledgments] = await Promise.all([
          tx.getAllByIndex('market_marks', 'by_symbol_date', [sym, sessionDate]),
          tx.getAllByIndex('market_acknowledgments', 'by_symbol_date', [sym, sessionDate]),
        ]);
        return {
          marks: [...marks].sort((a, b) => a.revision - b.revision),
          acknowledgments: [...acknowledgments].sort((a, b) =>
            a.recordedAt.localeCompare(b.recordedAt),
          ),
        };
      });
    },
  };
}
