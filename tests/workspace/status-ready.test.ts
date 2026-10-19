import { describe, expect, it } from "vitest";
import { getStatus } from "../../src/workspace/status";
import { statusPorts } from "./status-support";

describe("Workspace.getStatus reports one honest lifecycle status from readiness, root state and installed capability", () => {
  it("should return Ready with the full-content Workspace binding, time-zone setting and revision, immutable Installed Capability Manifest, onboarding state, readiness evidence, protection state, schema versions and latest receipt when readiness is Writable", async () => {
    const status = await getStatus(
      await statusPorts({ latestReceipt: async () => ({ seed: "journal-seed-v1" }) }),
    );

    expect(status).toMatchObject({
      outcome: "Ready",
      evaluatedAt: "2026-10-19T20:30:00.000Z",
      binding: {
        revision: 7,
        factRevision: 3,
        observationRevision: 2,
        journalRevision: 4,
        referenceRevision: 5,
      },
      timeZone: "America/New_York",
      timeZoneRevision: 2,
      onboarding: "Needs Institution and Account",
      capabilityManifest: {
        releaseId: "release-1",
        installSupport: "not-claimed",
        feeApplication: "not-installed",
      },
      readiness: { outcome: "Writable" },
      protection: { kind: "Protected" },
      schemaVersion: 1,
      latestReceipt: { seed: "journal-seed-v1" },
    });
    expect(status.safetyActions).toEqual([]);
  });

  it("should accept the current observation instant from the injected Clock and return identical status for identical inputs", async () => {
    const ports = await statusPorts();

    expect(await getStatus(ports)).toEqual(await getStatus(ports));
  });
});
