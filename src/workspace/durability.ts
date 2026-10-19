import type { DurabilityRequest, StorageProtection } from "../platform/host";
import type { ReadinessResult } from "../readiness";

export interface DurabilityPorts {
  readonly protection: () => Promise<StorageProtection>;
  readonly requestDurability: () => Promise<DurabilityRequest>;
  /** The current readiness, so the result can prove it was left unchanged. */
  readonly readiness: () => Promise<ReadinessResult>;
}

export type WorkspaceDurabilityResult =
  | { readonly outcome: "Improved"; readonly currentProtection: StorageProtection }
  | { readonly outcome: "AlreadyProtected"; readonly currentProtection: StorageProtection }
  | {
      readonly outcome: "NotImproved";
      readonly currentProtection: StorageProtection;
      readonly readiness: ReadinessResult;
    };

async function currentProtection(ports: DurabilityPorts): Promise<StorageProtection> {
  const protection = await ports.protection();
  return protection.kind === "NotExposed"
    ? { kind: "Unavailable", reason: "The host does not expose storage protection." }
    : protection;
}

/**
 * One explicit trader gesture asking the host for stronger local persistence. Protection is advisory:
 * a denied request neither fabricates success nor changes Runtime Readiness, and never disables a
 * control. It deletes, exports and mutates nothing.
 */
export async function requestDurability(
  ports: DurabilityPorts,
): Promise<WorkspaceDurabilityResult> {
  const before = await currentProtection(ports);
  if (before.kind === "Protected") {
    return { outcome: "AlreadyProtected", currentProtection: before };
  }

  let request: DurabilityRequest;
  try {
    request = await ports.requestDurability();
  } catch (error) {
    const current = await currentProtection(ports);
    return {
      outcome: "NotImproved",
      currentProtection:
        current.kind === "Protected"
          ? { kind: "Unavailable", reason: error instanceof Error ? error.message : String(error) }
          : current,
      readiness: await ports.readiness(),
    };
  }

  if (request.kind === "Granted") {
    const after = await currentProtection(ports);
    return after.kind === "Protected"
      ? { outcome: "Improved", currentProtection: after }
      : { outcome: "NotImproved", currentProtection: after, readiness: await ports.readiness() };
  }

  if (request.kind === "NotExposed") {
    return {
      outcome: "NotImproved",
      currentProtection: { kind: "Unavailable", reason: "The host does not expose the durability request." },
      readiness: await ports.readiness(),
    };
  }

  const after = await currentProtection(ports);
  return { outcome: "NotImproved", currentProtection: after, readiness: await ports.readiness() };
}
