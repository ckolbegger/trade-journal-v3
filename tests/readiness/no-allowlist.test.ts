import { afterEach, describe, expect, it, vi } from "vitest";
import { establishReadiness } from "../../src/readiness";
import { passingPorts } from "./support";

function setUserAgent(userAgent: string): void {
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent },
    configurable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Runtime Readiness gate decides Writable from four functional checks and reports every failure", () => {
  it("should decide from functional results only: the same failing check with a user-agent claiming a supported browser yields Unsupported, and an all-passing run with an unrecognised user-agent yields Writable", async () => {
    setUserAgent("Mozilla/5.0 (Macintosh) Chrome/156.0.0.0 Safari/537.36");
    const claimedSupportedButFailing = await establishReadiness(
      passingPorts({ capacity: async () => ({ freeBytes: 1 }) }),
    );

    setUserAgent("SomeOtherBrowser/1.0 (Unknown OS)");
    const unrecognisedButPassing = await establishReadiness(passingPorts());

    expect(claimedSupportedButFailing.outcome).toBe("Unsupported");
    expect(unrecognisedButPassing.outcome).toBe("Writable");
  });
});
