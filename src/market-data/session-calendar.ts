export const SESSION_POLICY_REVISION = 'nyse-2025-2027-v1' as const;
const EXCHANGE_TIME_ZONE = 'America/New_York';

/**
 * Deterministic NYSE full-day holidays (2025–2027).
 * Regular close: 16:00 ET. Early close: 13:00 ET.
 */
const NYSE_HOLIDAYS = new Set<string>([
  // 2025
  '2025-01-01', // New Year's Day
  '2025-01-09', // National Day of Mourning (Jimmy Carter)
  '2025-01-20', // MLK Day
  '2025-02-17', // Presidents' Day
  '2025-04-18', // Good Friday
  '2025-05-26', // Memorial Day
  '2025-06-19', // Juneteenth
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
  // 2026
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Day
  '2026-02-16', // Presidents' Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
  // 2027
  '2027-01-01', // New Year's Day
  '2027-01-18', // MLK Day
  '2027-02-15', // Presidents' Day
  '2027-03-26', // Good Friday
  '2027-05-31', // Memorial Day
  '2027-06-18', // Juneteenth (observed)
  '2027-07-05', // Independence Day (observed)
  '2027-09-06', // Labor Day
  '2027-11-25', // Thanksgiving
  '2027-12-24', // Christmas (observed)
]);

const NYSE_EARLY_CLOSES = new Set<string>([
  '2025-07-03',
  '2025-11-28',
  '2025-12-24',
  '2026-11-27',
  '2026-12-24',
  '2027-11-26',
]);

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseYmd(ymd: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) {
    throw new Error(`Invalid YYYY-MM-DD session date: "${ymd}"`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function addDaysYmd(ymd: string, deltaDays: number): string {
  const { year, month, day } = parseYmd(ymd);
  const dt = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function getDayOfWeekUtc(ymd: string): number {
  const { year, month, day } = parseYmd(ymd);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isUsTradingDay(ymd: string): boolean {
  const dow = getDayOfWeekUtc(ymd);
  if (dow === 0 || dow === 6) return false;
  return !NYSE_HOLIDAYS.has(ymd);
}

export function getSessionCloseMinutesEt(ymd: string): number {
  return NYSE_EARLY_CLOSES.has(ymd) ? 13 * 60 : 16 * 60;
}

export function getPreviousTradingDate(ymd: string): string {
  let cursor = addDaysYmd(ymd, -1);
  for (let i = 0; i < 14; i += 1) {
    if (isUsTradingDay(cursor)) {
      return cursor;
    }
    cursor = addDaysYmd(cursor, -1);
  }
  throw new Error(`Unable to find previous trading day before ${ymd}`);
}

export function getExchangeDateAndMinutesEt(instant: Date): { ymd: string; minutesEt: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: EXCHANGE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const rawHour = Number(get('hour'));
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(get('minute'));
  return {
    ymd: `${year}-${month}-${day}`,
    minutesEt: hour * 60 + minute,
  };
}

/**
 * Returns the latest completed U.S. trading session date (YYYY-MM-DD).
 * During Tuesday open hours (before 16:00 ET), returns Monday — so Monday's close
 * is normal Available evidence rather than Stale.
 */
export function getLatestCompletedSessionDate(instant: Date): string {
  const { ymd, minutesEt } = getExchangeDateAndMinutesEt(instant);
  if (isUsTradingDay(ymd) && minutesEt >= getSessionCloseMinutesEt(ymd)) {
    return ymd;
  }
  return getPreviousTradingDate(ymd);
}

export function getExchangeDateForInstant(instant: Date): string {
  return getExchangeDateAndMinutesEt(instant).ymd;
}

export function getCompletedSessionsBetween(fromYmd: string, toYmd: string): string[] {
  if (fromYmd > toYmd) {
    return [];
  }
  const sessions: string[] = [];
  let cursor = fromYmd;
  let guard = 0;
  while (cursor <= toYmd && guard < 2000) {
    if (isUsTradingDay(cursor)) {
      sessions.push(cursor);
    }
    cursor = addDaysYmd(cursor, 1);
    guard += 1;
  }
  return sessions;
}

export function getNextTradingDate(ymd: string): string {
  let cursor = addDaysYmd(ymd, 1);
  for (let i = 0; i < 14; i += 1) {
    if (isUsTradingDay(cursor)) {
      return cursor;
    }
    cursor = addDaysYmd(cursor, 1);
  }
  return cursor;
}

export function formatSessionDateShort(ymd: string): string {
  const { year, month, day } = parseYmd(ymd);
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return dt.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Returns the exact UTC instant for US exchange regular/early close on YYYY-MM-DD in America/New_York.
 */
export function getSessionCloseInstant(ymd: string): Date {
  const { year, month, day } = parseYmd(ymd);
  const closeMinutes = getSessionCloseMinutesEt(ymd);
  const probe = new Date(Date.UTC(year, month - 1, day, 20, 0, 0));
  const etAt20Utc = getExchangeDateAndMinutesEt(probe);
  const deltaMinutes = closeMinutes - etAt20Utc.minutesEt;
  return new Date(probe.getTime() + deltaMinutes * 60_000);
}

/**
 * Resolves an execution economicTime ISO string from a UI date picker value:
 * uses clock.nowIso() when matching today's exchange date, or the exchange close
 * (clamped after minSameDayIso + 1s and never exceeding clock.now()) when backdated.
 */
export function resolveExecutionEconomicIso(
  executionDate: string,
  now: Date,
  minSameDayIso?: string | null,
): string {
  const todayYmd = getExchangeDateForInstant(now);
  if (executionDate === todayYmd) {
    return now.toISOString();
  }
  let targetMs = getSessionCloseInstant(executionDate).getTime();
  if (minSameDayIso) {
    const minMs = Date.parse(minSameDayIso);
    if (!Number.isNaN(minMs) && getExchangeDateForInstant(new Date(minMs)) === executionDate && targetMs <= minMs) {
      targetMs = minMs + 1000;
    }
  }
  if (targetMs > now.getTime()) {
    targetMs = now.getTime();
  }
  return new Date(targetMs).toISOString();
}
