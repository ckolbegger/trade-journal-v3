// Build-time Offline Release Inventory. The identity is content-derived: the inventory lists every
// asset this release must have cached to start offline, each with its own digest, and the release
// identity is the digest of that list. Artifacts that embed the identity are excluded and are cached
// separately by the versioned worker.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export const RELEASE_INVENTORY_FILE = "release-inventory.json";
export const INVENTORY_EXCLUSIONS = ["sw.js", RELEASE_INVENTORY_FILE];

function listFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function buildInventory(distDirectory) {
  const files = listFiles(distDirectory)
    .map((path) => relative(distDirectory, path).split("\\").join("/"))
    .sort();
  const entries = files
    .filter((url) => !INVENTORY_EXCLUSIONS.includes(url))
    .map((url) => ({ url, sha256: sha256File(join(distDirectory, url)) }));
  const listDigest = createHash("sha256")
    .update(JSON.stringify(entries.map((entry) => [entry.url, entry.sha256])))
    .digest("hex");
  const releaseId = createHash("sha256").update(`trade-journal-v1\n${listDigest}`).digest("hex");
  return {
    releaseId,
    listDigest,
    exclusions: [...INVENTORY_EXCLUSIONS],
    entries,
  };
}

export function writeReleaseInventory(distDirectory) {
  const inventory = buildInventory(distDirectory);
  writeFileSync(
    join(distDirectory, RELEASE_INVENTORY_FILE),
    `${JSON.stringify(inventory, null, 2)}\n`,
  );
  return inventory;
}
