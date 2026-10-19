import { FixedClock, SystemClock, isInstant, type Clock, type Instant } from "../platform/clock";
import { createBrowserHostPort, type HostPort } from "../platform/host";

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
    /** Set by the browser harness to expose the host port for its verification. */
    __TRADE_JOURNAL_HARNESS__?: boolean;
    __TRADE_JOURNAL_HOST__?: HostPort;
  }
}

export interface ApplicationContext {
  readonly applicationName: string;
  readonly clock: Clock;
  readonly openingInstant: Instant;
  readonly host: HostPort;
}

/** The browser-harness seam: a documented init-script injection, not a stored setting. */
export function readHarnessInstant(): Instant | undefined {
  const injected = (globalThis as unknown as Window).__TRADE_JOURNAL_CLOCK__;
  return typeof injected === "string" && isInstant(injected) ? injected : undefined;
}

export function harnessEnabled(): boolean {
  return (globalThis as unknown as Window).__TRADE_JOURNAL_HARNESS__ === true;
}

export function createApplicationContext(
  options: { clock?: Clock; fixedInstant?: Instant; host?: HostPort } = {},
): ApplicationContext {
  const clock =
    options.clock ??
    (options.fixedInstant !== undefined ? new FixedClock(options.fixedInstant) : new SystemClock());
  return {
    applicationName: "Trade Journal",
    clock,
    openingInstant: clock.now(),
    host: options.host ?? createBrowserHostPort(),
  };
}
