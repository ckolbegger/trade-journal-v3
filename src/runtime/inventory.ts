export interface OfflineReleaseAsset {
  readonly url: string;
  readonly sha256: string;
  readonly size: number;
}

export interface OfflineReleaseInventory {
  readonly schemaVersion: 1;
  readonly releaseId: string;
  readonly assets: readonly OfflineReleaseAsset[];
}

export type InventoryVerificationResult =
  | { readonly valid: true; readonly releaseId: string; readonly assetCount: number }
  | { readonly valid: false; readonly reason: string };

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isValidOfflineReleaseInventory(raw: unknown): raw is OfflineReleaseInventory {
  if (typeof raw !== 'object' || raw === null) {
    return false;
  }
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== 1 || typeof obj.releaseId !== 'string' || obj.releaseId.length === 0) {
    return false;
  }
  if (!Array.isArray(obj.assets) || obj.assets.length === 0) {
    return false;
  }
  return obj.assets.every((item) => {
    if (typeof item !== 'object' || item === null) {
      return false;
    }
    const asset = item as Record<string, unknown>;
    return (
      typeof asset.url === 'string' &&
      asset.url.startsWith('/') &&
      !asset.url.startsWith('//') &&
      typeof asset.sha256 === 'string' &&
      /^[0-9a-f]{64}$/.test(asset.sha256) &&
      typeof asset.size === 'number' &&
      Number.isSafeInteger(asset.size) &&
      asset.size >= 0
    );
  });
}

export async function verifyOfflineInventory(
  inventory: OfflineReleaseInventory,
  readAssetBytes: (url: string) => Promise<Uint8Array | null>,
): Promise<InventoryVerificationResult> {
  if (!isValidOfflineReleaseInventory(inventory)) {
    return { valid: false, reason: 'Offline release inventory failed schema validation.' };
  }

  for (const asset of inventory.assets) {
    const bytes = await readAssetBytes(asset.url);
    if (!bytes) {
      return { valid: false, reason: `Missing cached offline asset: ${asset.url}` };
    }
    if (bytes.byteLength !== asset.size) {
      return {
        valid: false,
        reason: `Size mismatch for offline asset ${asset.url} (expected ${asset.size}, got ${bytes.byteLength})`,
      };
    }
    const actualHex = await sha256Hex(bytes);
    if (actualHex !== asset.sha256) {
      return {
        valid: false,
        reason: `Digest mismatch for offline asset ${asset.url}`,
      };
    }
  }

  return {
    valid: true,
    releaseId: inventory.releaseId,
    assetCount: inventory.assets.length,
  };
}
