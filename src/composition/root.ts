import { FixedClock, SystemClock, isInstant, type Clock, type Instant } from "../platform/clock";

export {
  FixedClock,
  SystemClock,
  epochMilliseconds,
  instantFromEpochMilliseconds,
  isInstant,
} from "../platform/clock";
export type { Clock, Instant } from "../platform/clock";

declare global {
  interface Window {
    /** Set by the browser harness before application code runs; never by product code. */
    __TRADE_JOURNAL_CLOCK__?: string;
  }
}

export interface ApplicationContext {
  readonly applicationName: string;
  readonly clock: Clock;
  readonly openingInstant: Instant;
}

/** The browser-harness seam: a documented init-script injection, not a stored setting. */
export function readHarnessInstant(): Instant | undefined {
  const injected = (globalThis as unknown as Window).__TRADE_JOURNAL_CLOCK__;
  return typeof injected === "string" && isInstant(injected) ? injected : undefined;
}

export function createApplicationContext(
  options: { clock?: Clock; fixedInstant?: Instant } = {},
): ApplicationContext {
  const clock =
    options.clock ??
    (options.fixedInstant !== undefined ? new FixedClock(options.fixedInstant) : new SystemClock());
  return {
    applicationName: "Trade Journal",
    clock,
    openingInstant: clock.now(),
  };
}
