import { createHostPort, type HostPort } from "../../src/platform/host";
import {
  listDigestOf,
  releaseIdOf,
  sha256Hex,
  type InventoryEntry,
} from "../../src/release/inventory";

export const INVENTORY_URL = "/release-inventory.json";

function bufferOf(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export interface InventoryFixture {
  readonly host: HostPort;
  readonly entries: InventoryEntry[];
  readonly releaseId: string;
  readonly listDigest: string;
  readonly bytes: Map<string, Uint8Array>;
}

export async function inventoryFixture(
  contents: Readonly<Record<string, string>>,
): Promise<InventoryFixture> {
  const entries: InventoryEntry[] = [];
  const bytes = new Map<string, Uint8Array>();
  for (const [url, text] of Object.entries(contents)) {
    const encoded = new TextEncoder().encode(text);
    bytes.set(url, encoded);
    entries.push({ url, sha256: await sha256Hex(encoded) });
  }
  const listDigest = await listDigestOf(entries);
  const releaseId = await releaseIdOf(listDigest);
  const inventory = { releaseId, listDigest, exclusions: ["sw.js"], entries };
  bytes.set(INVENTORY_URL, new TextEncoder().encode(JSON.stringify(inventory)));

  const host = createHostPort({
    cacheStorage: {
      match: async (url: string) => {
        const found = bytes.get(url);
        return found === undefined
          ? undefined
          : { arrayBuffer: async () => bufferOf(found) };
      },
    },
  });

  return { host, entries, releaseId, listDigest, bytes };
}

export function replaceBytes(fixture: InventoryFixture, url: string, text: string): void {
  fixture.bytes.set(url, new TextEncoder().encode(text));
}

export function removeBytes(fixture: InventoryFixture, url: string): void {
  fixture.bytes.delete(url);
}
