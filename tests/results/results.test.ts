import { describe, expect, it } from "vitest";
import { decodeRuntimeNotWritable, encodeRuntimeNotWritable } from "../../src/results/codec";
import { runtimeNotWritable, isRuntimeNotWritable, ResultConventionError, MUTATION_OUTCOMES, assertNever, type CalculationAvailability, type MutationResult } from "../../src/results";

describe("the shared RuntimeNotWritable branch and result conventions behave identically at every construction site", () => {
  it("should round-trip the payload through the persistence codec with workspaceStatus and safeActions preserved exactly", () => {
      const payload = runtimeNotWritable({
        runtimeReadiness: "RecoveryOnly",
        failedChecks: [
          { check: "offline-release-inventory", detail: "/app.js is missing" },
          { check: "capacity", detail: "shortfall 10" },
        ],
        safeActions: [
          { id: "export-backup", explanation: "Export a backup of this Workspace." },
          { id: "retry", explanation: "Retry the readiness check." },
        ],
      });

      const record = encodeRuntimeNotWritable(payload);
      const decoded = decodeRuntimeNotWritable(JSON.parse(JSON.stringify(record)) as typeof record);

      expect(record.workspaceStatus).toBe("RecoveryOnly");
      expect(decoded).toEqual(payload);
      expect(decoded.workspaceStatus).toBe("RecoveryOnly");
      expect(decoded.safeActions).toEqual([
        { id: "retry", explanation: "Retry the readiness check." },
        { id: "export-backup", explanation: "Export a backup of this Workspace." },
      ]);
    });
});

describe("the shared RuntimeNotWritable branch and result conventions behave identically at every construction site", () => {
  it("should answer the isRuntimeNotWritable discriminator positively for the safety branch and negatively for a typed trader rejection, so no caller can classify an operational failure as trader behaviour", () => {
      const safety = runtimeNotWritable({
        runtimeReadiness: "Unsupported",
        failedChecks: [{ check: "diagnostic-transaction", detail: "the store did not open" }],
      });
      const traderRejection = { outcome: "Rejected", reason: "An Institution name is required." };

      expect(isRuntimeNotWritable(safety)).toBe(true);
      expect(isRuntimeNotWritable(traderRejection)).toBe(false);
      expect(isRuntimeNotWritable(null)).toBe(false);
      expect(isRuntimeNotWritable("RuntimeNotWritable")).toBe(false);
    });
});

describe("the shared RuntimeNotWritable branch and result conventions behave identically at every construction site", () => {
  it("should reject construction with an empty failed-check list with a typed programming error, so a non-writable result without a reason is not representable", () => {
      expect(() =>
        runtimeNotWritable({ runtimeReadiness: "Unsupported", failedChecks: [] }),
      ).toThrow(ResultConventionError);

      let caught: unknown;
      try {
        runtimeNotWritable({ runtimeReadiness: "Unsupported", failedChecks: [] });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ResultConventionError);
      expect((caught as ResultConventionError).kind).toBe(
        "RuntimeNotWritableRequiresFailedCheck",
      );
    });
});

describe("the shared RuntimeNotWritable branch and result conventions behave identically at every construction site", () => {
  it("should carry workspaceStatus IntegrityBlocked and never None when the constructor is told that a known or possible existing root could not be read", () => {
      const payload = runtimeNotWritable({
        runtimeReadiness: "Unsupported",
        failedChecks: [{ check: "diagnostic-transaction", detail: "the existing root cannot be read" }],
        workspaceStatus: "None",
        existingRootUnreadable: true,
        safeActions: [
          { id: "recovery-guidance", explanation: "Do not initialize over this storage." },
        ],
      });

      expect(payload.workspaceStatus).toBe("IntegrityBlocked");
      expect(payload.runtimeReadiness).toBe("Unsupported");
    });
});

describe("the shared RuntimeNotWritable branch and result conventions behave identically at every construction site", () => {
  function describeAvailability(availability: CalculationAvailability<number>): string {
    switch (availability.outcome) {
      case "Value":
        return `value ${availability.value}`;
      case "Unbounded":
        return `unbounded ${availability.direction}`;
      case "Unavailable":
        return `unavailable ${availability.reason}`;
      case "NotApplicable":
        return `not applicable ${availability.reason}`;
      default:
        return assertNever(availability);
    }
  }

  it("should place exactly one cross-cutting RuntimeNotWritable member alongside the command-specific members of a result union, so no operation-specific label replaces it", () => {
      const accepted: MutationResult<{ readonly id: string }> = {
        outcome: "Accepted",
        value: { id: "institution-1" },
      };
      const rejected: MutationResult<{ readonly id: string }> = {
        outcome: "Rejected",
        reason: "An Institution name is required.",
      };
      const conflict: MutationResult<{ readonly id: string }> = {
        outcome: "Conflict",
        current: { id: "institution-2" },
      };
      const safety = runtimeNotWritable({
        runtimeReadiness: "Unsupported",
        failedChecks: [{ check: "capacity", detail: "insufficient" }],
      });

      const results: MutationResult<{ readonly id: string }>[] = [
        accepted,
        rejected,
        conflict,
        safety,
      ];

      expect(results.filter(isRuntimeNotWritable)).toHaveLength(1);
      expect(MUTATION_OUTCOMES.filter((outcome) => outcome === "RuntimeNotWritable")).toHaveLength(1);
      expect(describeAvailability({ outcome: "Value", value: 42 })).toBe("value 42");
      expect(describeAvailability({ outcome: "Unbounded", direction: "above", explanation: "" })).toBe(
        "unbounded above",
      );
      expect(
        describeAvailability({ outcome: "Unavailable", reason: "no mark", details: {} }),
      ).toBe("unavailable no mark");
      expect(
        describeAvailability({ outcome: "NotApplicable", reason: "flat", details: {} }),
      ).toBe("not applicable flat");
    });
});

describe("the shared RuntimeNotWritable branch and result conventions behave identically at every construction site", () => {
  it("should construct a RuntimeNotWritable carrying runtimeReadiness Unsupported, every supplied failed check, workspaceStatus None and the ordered safe actions when the caller supplies them", () => {
      const failedChecks = [
        { check: "capacity" as const, detail: "free capacity 1 byte, minimum 2" },
        { check: "service-worker-control" as const, detail: "no worker controls the page" },
        { check: "offline-release-inventory" as const, detail: "asset /app.js is missing" },
      ];
      const safeActions = [
        { id: "retry" as const, explanation: "Retry the readiness check." },
        { id: "try-another-browser" as const, explanation: "Try another browser." },
      ];

      const payload = runtimeNotWritable({
        runtimeReadiness: "Unsupported",
        failedChecks,
        safeActions,
      });

      expect(payload.runtimeReadiness).toBe("Unsupported");
      expect(payload.failedChecks).toEqual(failedChecks);
      expect(payload.workspaceStatus).toBe("None");
      expect(payload.safeActions).toEqual(safeActions);
    });

  it("should carry runtimeReadiness RecoveryOnly together with readable Workspace status and backup safe actions when an existing Workspace remains readable", () => {
      const payload = runtimeNotWritable({
        runtimeReadiness: "RecoveryOnly",
        failedChecks: [
          { check: "offline-release-inventory", detail: "asset /app.js is corrupt" },
        ],
        safeActions: [
          { id: "retry", explanation: "Retry the readiness check." },
          { id: "export-backup", explanation: "Export a backup of this Workspace." },
        ],
      });

      expect(payload.runtimeReadiness).toBe("RecoveryOnly");
      expect(payload.workspaceStatus).toBe("RecoveryOnly");
      expect(payload.safeActions).toEqual([
        { id: "retry", explanation: "Retry the readiness check." },
        { id: "export-backup", explanation: "Export a backup of this Workspace." },
      ]);
    });

  it("should return the safe actions in a stable documented order for identical inputs across two constructions, so the UI cannot render them differently between the two boundaries", () => {
      const safeActions = [
        { id: "try-another-browser" as const, explanation: "Try another browser." },
        { id: "retry" as const, explanation: "Retry the readiness check." },
        { id: "export-backup" as const, explanation: "Export a backup." },
        { id: "recovery-guidance" as const, explanation: "Follow recovery guidance." },
        { id: "request-durability" as const, explanation: "Request stronger storage." },
      ];
      const input = {
        runtimeReadiness: "Unsupported" as const,
        failedChecks: [{ check: "capacity" as const, detail: "insufficient" }],
      };

      const first = runtimeNotWritable({ ...input, safeActions });
      const second = runtimeNotWritable({ ...input, safeActions: [...safeActions].reverse() });

      expect(first.safeActions.map((action) => action.id)).toEqual([
        "retry",
        "request-durability",
        "export-backup",
        "try-another-browser",
        "recovery-guidance",
      ]);
      expect(second.safeActions).toEqual(first.safeActions);
    });
});
