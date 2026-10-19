import { describe, expect, it } from "vitest";
import { resolveSessionDate } from "../../src/calendar";

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
