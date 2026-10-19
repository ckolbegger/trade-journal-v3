// Offline Release Inventory: one release identity plus every asset and its SHA-256 digest.
//
// The release identity is embedded in the app bundle and the service worker, so an asset's
// digest is taken with that identity replaced by the build-time token. This keeps the
// identity equal to the hash of the sorted digest list without a circular dependency.

export interface InventoryAsset {
  readonly path: string;
  readonly digest: string;
  readonly size: number;
}

export interface OfflineReleaseInventory {
  readonly releaseId: string;
  readonly assets: readonly InventoryAsset[];
}

// "@@TJ_RELEASE_ID@@", built from character codes so the build's substitution of the
// token never rewrites this copy.
export const RELEASE_ID_TOKEN = String.fromCharCode(
  64, 64, 84, 74, 95, 82, 69, 76, 69, 65, 83, 69, 95, 73, 68, 64, 64,
);

const encoder = new TextEncoder();

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function replaceBytes(bytes: Uint8Array, from: string, to: string): Uint8Array {
  const needle = encoder.encode(from);
  const replacement = encoder.encode(to);
  const parts: Uint8Array[] = [];
  let start = 0;
  let i = 0;
  while (i <= bytes.length - needle.length) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      parts.push(bytes.subarray(start, i), replacement);
      i += needle.length;
      start = i;
    } else {
      i++;
    }
  }
  if (parts.length === 0) return bytes;
  parts.push(bytes.subarray(start));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function assetDigest(bytes: Uint8Array, releaseId: string): Promise<string> {
  return sha256Hex(replaceBytes(bytes, releaseId, RELEASE_ID_TOKEN));
}

export function releaseIdentityOf(assets: readonly InventoryAsset[]): Promise<string> {
  const lines = [...assets]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((a) => `${a.path} ${a.digest}\n`)
    .join('');
  return sha256Hex(lines);
}
