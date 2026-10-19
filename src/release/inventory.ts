import type { HostPort } from "../platform/host";

export interface InventoryEntry {
  readonly url: string;
  readonly sha256: string;
}

export interface ReleaseInventory {
  readonly releaseId: string;
  readonly listDigest: string;
  readonly exclusions: readonly string[];
  readonly entries: readonly InventoryEntry[];
}

export type InventoryFailure =
  | { readonly kind: "Unreadable"; readonly detail: string }
  | {
      readonly kind: "ReleaseMismatch";
      readonly detail: string;
      readonly runningReleaseId: string;
      readonly inventoryReleaseId: string;
    }
  | { readonly kind: "Missing"; readonly assetUrl: string }
  | {
      readonly kind: "Corrupt";
      readonly assetUrl: string;
      readonly recorded: string;
      readonly observed: string;
    };

export interface InventoryEvidence {
  readonly inventoryUrl: string;
  readonly releaseId: string;
  readonly listDigest: string;
  readonly entries: number;
}

export type InventoryValidation =
  | {
      readonly outcome: "Complete";
      readonly releaseId: string;
      readonly listDigest: string;
      readonly verifiedEntries: number;
      readonly evidence: InventoryEvidence;
    }
  | {
      readonly outcome: "Incomplete";
      readonly failures: readonly InventoryFailure[];
      readonly releaseId?: string;
      readonly listDigest?: string;
    };

export interface InventoryValidationRequest {
  readonly inventoryUrl?: string;
  /** The release identity the running application believes it is. */
  readonly expectedReleaseId?: string;
}

const DEFAULT_INVENTORY_URL = "/release-inventory.json";
const DIGEST = /^[0-9a-f]{64}$/;

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The same canonical list digest the build writes, recomputed from the inventory's own entries. */
export async function listDigestOf(entries: readonly InventoryEntry[]): Promise<string> {
  return sha256Hex(
    new TextEncoder().encode(JSON.stringify(entries.map((entry) => [entry.url, entry.sha256]))),
  );
}

export async function releaseIdOf(listDigest: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(`trade-journal-v1\n${listDigest}`));
}

function isEntry(value: unknown): value is InventoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as { url?: unknown; sha256?: unknown };
  return typeof entry.url === "string" && typeof entry.sha256 === "string" && DIGEST.test(entry.sha256);
}

function parseInventory(text: string): ReleaseInventory | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const candidate = parsed as {
    releaseId?: unknown;
    listDigest?: unknown;
    exclusions?: unknown;
    entries?: unknown;
  };
  if (
    typeof candidate.releaseId !== "string" ||
    typeof candidate.listDigest !== "string" ||
    !Array.isArray(candidate.entries) ||
    !candidate.entries.every(isEntry)
  ) {
    return undefined;
  }
  return {
    releaseId: candidate.releaseId,
    listDigest: candidate.listDigest,
    exclusions: Array.isArray(candidate.exclusions)
      ? candidate.exclusions.filter((value): value is string => typeof value === "string")
      : [],
    entries: candidate.entries,
  };
}

/**
 * Validate, with no network, that the running release's Offline Release Inventory is complete and
 * digest-valid. Every failing entry is reported, not just the first.
 */
export async function validateReleaseInventory(
  host: HostPort,
  request: InventoryValidationRequest = {},
): Promise<InventoryValidation> {
  const inventoryUrl = request.inventoryUrl ?? DEFAULT_INVENTORY_URL;
  const failures: InventoryFailure[] = [];

  const artifact = await host.cachedAsset(inventoryUrl);
  if (artifact.kind !== "Present") {
    return {
      outcome: "Incomplete",
      failures: [
        {
          kind: "Unreadable",
          detail:
            artifact.kind === "Missing"
              ? `the inventory artifact ${inventoryUrl} is not cached`
              : artifact.kind === "Unavailable"
                ? `the inventory artifact could not be read: ${artifact.reason}`
                : "the host does not expose the release cache",
        },
      ],
    };
  }

  const inventory = parseInventory(new TextDecoder().decode(artifact.bytes));
  if (inventory === undefined) {
    return {
      outcome: "Incomplete",
      failures: [{ kind: "Unreadable", detail: `${inventoryUrl} is not a valid Offline Release Inventory` }],
    };
  }

  const entries = [...inventory.entries];
  const listDigest = await listDigestOf(entries);
  if (listDigest !== inventory.listDigest) {
    failures.push({
      kind: "Unreadable",
      detail: "the inventory list digest does not match its own entries",
    });
  }
  const releaseId = await releaseIdOf(inventory.listDigest);
  if (releaseId !== inventory.releaseId) {
    failures.push({
      kind: "Unreadable",
      detail: "the inventory release identity does not match its list digest",
    });
  }
  if (
    request.expectedReleaseId !== undefined &&
    request.expectedReleaseId !== "" &&
    request.expectedReleaseId !== inventory.releaseId
  ) {
    failures.push({
      kind: "ReleaseMismatch",
      detail: "the running release identity differs from the inventory's release identity",
      runningReleaseId: request.expectedReleaseId,
      inventoryReleaseId: inventory.releaseId,
    });
  }

  let verifiedEntries = 0;
  for (const entry of entries) {
    const cached = await host.cachedAsset(entry.url);
    if (cached.kind === "Missing") {
      failures.push({ kind: "Missing", assetUrl: entry.url });
      continue;
    }
    if (cached.kind !== "Present") {
      failures.push({
        kind: "Unreadable",
        detail:
          cached.kind === "Unavailable"
            ? `the cached asset ${entry.url} could not be read: ${cached.reason}`
            : "the host does not expose the release cache",
      });
      continue;
    }
    const observed = await sha256Hex(cached.bytes);
    if (observed !== entry.sha256) {
      failures.push({ kind: "Corrupt", assetUrl: entry.url, recorded: entry.sha256, observed });
      continue;
    }
    verifiedEntries += 1;
  }

  if (failures.length > 0) {
    return {
      outcome: "Incomplete",
      failures,
      releaseId: inventory.releaseId,
      listDigest: inventory.listDigest,
    };
  }

  return {
    outcome: "Complete",
    releaseId: inventory.releaseId,
    listDigest: inventory.listDigest,
    verifiedEntries,
    evidence: {
      inventoryUrl,
      releaseId: inventory.releaseId,
      listDigest: inventory.listDigest,
      entries: entries.length,
    },
  };
}
