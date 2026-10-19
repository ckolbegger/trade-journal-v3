// Emits the versioned worker from the template and the built inventory. The cache name embeds the
// immutable release identity, so two releases can never share a cache.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const SW_TEMPLATE = "src/delivery/sw-template.js";
export const SW_FILE = "sw.js";

export function buildServiceWorker(distDirectory, inventory) {
  const template = readFileSync(SW_TEMPLATE, "utf8");
  const source = template
    .replaceAll("__RELEASE_ID__", inventory.releaseId)
    .replaceAll("__CACHE_NAME__", `trade-journal-release-${inventory.releaseId}`)
    .replaceAll("__INVENTORY_JSON__", JSON.stringify(inventory));
  writeFileSync(join(distDirectory, SW_FILE), source);
  return source;
}
