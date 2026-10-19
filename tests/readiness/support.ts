import { MATURE_WORKLOAD, deriveMinimum } from "../../src/capacity";
import type { ReadinessPorts } from "../../src/readiness";

export const RELEASE_ID = "release-1";

export function passingPorts(overrides: Partial<ReadinessPorts> = {}): ReadinessPorts {
  const minimum = deriveMinimum(MATURE_WORKLOAD).bytes;
  const ports: ReadinessPorts = {
    protection: async () => ({ kind: "Protected" }),
    diagnostic: async () => ({ outcome: "Passed" }),
    capacity: async () => ({ freeBytes: minimum }),
    workerControl: async () => ({
      kind: "Controlled",
      scriptURL: "http://127.0.0.1:5177/sw.js",
      releaseId: RELEASE_ID,
    }),
    inventory: async (expectedReleaseId) => ({
      outcome: "Complete",
      releaseId: expectedReleaseId ?? RELEASE_ID,
      listDigest: "a".repeat(64),
      verifiedEntries: 3,
      evidence: {
        inventoryUrl: "/release-inventory.json",
        releaseId: expectedReleaseId ?? RELEASE_ID,
        listDigest: "a".repeat(64),
        entries: 3,
      },
    }),
  };
  return { ...ports, ...overrides };
}
