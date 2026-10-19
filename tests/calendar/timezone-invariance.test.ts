import { describe, expect, it } from "vitest";
import { resolveSessionDate } from "../../src/calendar";

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
