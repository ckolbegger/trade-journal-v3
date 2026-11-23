export interface Clock {
  now(): Date;
  nowIso(): string;
}

export const systemClock: Clock = {
  now: () => new Date(),
  nowIso: () => new Date().toISOString(),
};

export function createFixedClock(isoTimestamp: string): Clock {
  const currentMs = Date.parse(isoTimestamp);
  if (Number.isNaN(currentMs)) {
    throw new Error(`Invalid ISO timestamp for fixed clock: ${isoTimestamp}`);
  }
  return {
    now: () => new Date(currentMs),
    nowIso: () => new Date(currentMs).toISOString(),
  };
}

export function createManualClock(initialIso: string): Clock & { advanceMs(ms: number): void; setIso(iso: string): void } {
  let currentMs = Date.parse(initialIso);
  if (Number.isNaN(currentMs)) {
    throw new Error(`Invalid ISO timestamp for manual clock: ${initialIso}`);
  }
  return {
    now: () => new Date(currentMs),
    nowIso: () => new Date(currentMs).toISOString(),
    advanceMs: (ms: number) => {
      if (!Number.isFinite(ms)) {
        throw new Error(`Invalid advanceMs delta: ${ms}`);
      }
      currentMs += ms;
    },
    setIso: (iso: string) => {
      const parsed = Date.parse(iso);
      if (Number.isNaN(parsed)) {
        throw new Error(`Invalid ISO timestamp: ${iso}`);
      }
      currentMs = parsed;
    },
  };
}
