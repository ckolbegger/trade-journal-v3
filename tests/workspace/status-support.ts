import { installedCapabilities } from "../../src/capability/manifest";
import { FixedClock } from "../../src/platform/clock";
import { establishReadiness } from "../../src/readiness";
import type { StatusPorts, WorkspaceRead, WorkspaceSnapshotBinding } from "../../src/workspace/status";
import { passingPorts } from "../readiness/support";

export const statusClock = new FixedClock("2026-10-19T20:30:00.000Z");

export const fullBinding: WorkspaceSnapshotBinding = {
  revision: 7,
  factRevision: 3,
  observationRevision: 2,
  journalRevision: 4,
  referenceRevision: 5,
};

export const workspaceRead: WorkspaceRead = {
  outcome: "Workspace",
  value: {
    timeZone: "America/New_York",
    timeZoneRevision: 2,
    onboarding: "Needs Institution and Account",
    seedVersions: { journal: "journal-seed-v1", catalog: "catalog-seed-v1" },
  },
  binding: fullBinding,
};

export async function statusPorts(overrides: Partial<StatusPorts> = {}): Promise<StatusPorts> {
  const readiness = await establishReadiness(passingPorts());
  return {
    readiness: async () => readiness,
    root: async () => "readable",
    readWorkspace: async () => workspaceRead,
    clock: statusClock,
    capabilityManifest: installedCapabilities("release-1"),
    protection: async () => ({ kind: "Protected" }),
    ...overrides,
  };
}
