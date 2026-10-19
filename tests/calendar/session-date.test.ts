import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSessionDate } from "../../src/calendar";

afterEach(() => {
  vi.useRealTimers();
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
