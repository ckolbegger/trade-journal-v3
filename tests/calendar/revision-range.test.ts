import { describe, expect, it } from "vitest";
import { resolveSessionDate } from "../../src/calendar";

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
