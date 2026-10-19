import { describe, expect, it, afterEach, vi } from "vitest";
import { resolveSessionDate } from "../../src/calendar";

afterEach(() => {
  vi.useRealTimers();
});

describe("after-close journaling belongs to the completed session", () => {
  it("should return the prior session's trading date when the instant falls after the close and before the next open, because after-close journaling belongs to the completed session", () => {
      const result = resolveSessionDate("2026-10-20T20:30:00.000Z");

      expect(result).toMatchObject({
        outcome: "Resolved",
        tradingDate: "2026-10-20",
        revision: "us-session-2026.1",
      });
    });

  it("should treat a revision-declared early-close half day as its own session boundary, so an instant after the half-day close resolves to that same date while an instant after a normal close on a full day resolves to it too", () => {
      expect(resolveSessionDate("2026-11-27T19:00:00.000Z")).toMatchObject({
        outcome: "Resolved",
        tradingDate: "2026-11-27",
        revision: "us-session-2026.1",
      });
      expect(resolveSessionDate("2026-10-20T20:30:00.000Z")).toMatchObject({
        outcome: "Resolved",
        tradingDate: "2026-10-20",
        revision: "us-session-2026.1",
      });
    });
});

describe("a revision never extrapolates beyond its declared validity", () => {
  it("should return a typed CalendarOutOfRange naming the revision and its covered interval when the instant falls outside the revision's declared validity, and must not extrapolate a date", () => {
      const result = resolveSessionDate("2030-06-03T14:00:00.000Z");

      expect(result).toEqual({
        outcome: "CalendarOutOfRange",
        revision: "us-session-2026.1",
        coveredInterval: {
          from: "2026-01-01T00:00:00.000Z",
          until: "2027-01-01T00:00:00.000Z",
        },
      });
    });
});

describe("U.S. session calendar resolves exactly one trading date per instant under a versioned revision", () => {
  it("should return an identical result for the same instant and revision across two calls with no intervening state change, proving the resolver is pure and does not read storage or the host clock", () => {
      const instant = "2026-10-20T14:00:00.000Z";

      const first = resolveSessionDate(instant);
      vi.useFakeTimers({ now: new Date("2027-03-01T00:00:00.000Z") });
      const second = resolveSessionDate(instant);

      expect(second).toEqual(first);
    });

  it("should return the completed session's U.S. Trading Date, together with the revision identity, when resolveSessionDate is called with an instant inside the regular trading session", () => {
      const result = resolveSessionDate("2026-10-20T14:00:00.000Z");

      expect(result).toMatchObject({
        outcome: "Resolved",
        tradingDate: "2026-10-19",
        revision: "us-session-2026.1",
      });
    });

  it("should skip the weekend and the observed Independence Day, Thanksgiving and Christmas closures declared by the revision, returning the previous trading date for an instant on a closed day", () => {
      const closedDays = [
        ["2026-10-17T16:00:00.000Z", "2026-10-16"],
        ["2026-07-03T16:00:00.000Z", "2026-07-02"],
        ["2026-11-26T16:00:00.000Z", "2026-11-25"],
        ["2026-12-25T16:00:00.000Z", "2026-12-24"],
      ];

      for (const [instant = "", expected = ""] of closedDays) {
        expect(resolveSessionDate(instant)).toMatchObject({
          outcome: "Resolved",
          tradingDate: expected,
          revision: "us-session-2026.1",
        });
      }
    });

  it("should expose the trading date and the revision identity as separate fields so a caller can store the date and later re-derive it under a newer revision", () => {
      const older = resolveSessionDate("2025-10-21T20:30:00.000Z", "us-session-2025.1");

      expect(older).toEqual({
        outcome: "Resolved",
        tradingDate: "2025-10-21",
        revision: "us-session-2025.1",
      });
    });
});

describe("the session calendar reads the exchange session, never the host locale", () => {
  it("should map one economic instant to the same trading date and revision when the process time zone is UTC and when it is Asia/Tokyo, proving the resolver uses the exchange session rather than the host locale", () => {
      const requested = process.env.TZ;
      if (requested === "UTC" || requested === "Asia/Tokyo") {
        expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(requested);
      }

      const result = resolveSessionDate("2026-10-20T19:30:00.000Z");

      expect(result).toMatchObject({
        outcome: "Resolved",
        tradingDate: "2026-10-19",
        revision: "us-session-2026.1",
      });
    });
});
