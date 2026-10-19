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

import type { Clock } from "../../src/platform/clock";
import type { StorageProtection } from "../../src/platform/host";

export interface PortState {
  diagnosticFails: boolean;
  capacityFails: boolean;
  workerFails: boolean;
  inventoryFails: boolean;
  protection: StorageProtection;
}

export function mutablePorts(): {
  ports: ReadinessPorts;
  state: PortState;
  calls: { diagnostic: number };
} {
  const minimum = deriveMinimum(MATURE_WORKLOAD).bytes;
  const state: PortState = {
    diagnosticFails: false,
    capacityFails: false,
    workerFails: false,
    inventoryFails: false,
    protection: { kind: "Protected" },
  };
  const calls = { diagnostic: 0 };
  const ports: ReadinessPorts = {
    protection: async () => state.protection,
    diagnostic: async () => {
      calls.diagnostic += 1;
      return state.diagnosticFails
        ? { outcome: "Failed", detail: "the store failed" }
        : { outcome: "Passed" };
    },
    capacity: async () => (state.capacityFails ? { freeBytes: 1 } : { freeBytes: minimum }),
    workerControl: async () =>
      state.workerFails
        ? { kind: "NotControlled", reason: "No service worker controls this page." }
        : { kind: "Controlled", scriptURL: "/sw.js", releaseId: RELEASE_ID },
    inventory: async (expectedReleaseId) =>
      state.inventoryFails
        ? { outcome: "Incomplete", failures: [{ kind: "Missing", assetUrl: "/assets/app.js" }] }
        : {
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
          },
  };
  return { ports, state, calls };
}

export function steppingClock(instants: readonly string[]): Clock {
  let index = 0;
  return {
    source: "test-clock",
    now: () => instants[Math.min(index++, instants.length - 1)] ?? "2026-10-19T20:00:00.000Z",
  };
}
