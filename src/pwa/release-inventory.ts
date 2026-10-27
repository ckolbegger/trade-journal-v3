export interface ReleaseInventoryAssetEntry {
  readonly path: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export interface OfflineReleaseInventory {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly cacheName: string;
  readonly assets: readonly ReleaseInventoryAssetEntry[];
}

export interface WebAppManifestValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export type ReleaseInventoryVerificationResult =
  | {
      readonly valid: true;
      readonly releaseId: string;
      readonly cacheName: string;
      readonly verifiedAssetCount: number;
    }
  | {
      readonly valid: false;
      readonly reason: 'MalformedInventory' | 'MissingAssets' | 'DigestMismatch' | 'MissingAndMismatch';
      readonly missingAssets: readonly string[];
      readonly digestMismatches: readonly {
        readonly path: string;
        readonly expectedSha256: string;
        readonly actualSha256: string;
      }[];
      readonly message: string;
    };

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const FORBIDDEN_TRADER_DATA_KEYS = new Set([
  'workspace',
  'accounts',
  'institutions',
  'trades',
  'journal',
  'credentials',
  'apiKey',
  'secret',
]);

export function verifyWebAppManifest(raw: unknown): WebAppManifestValidationResult {
  const issues: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, issues: ['Web App Manifest must be a JSON object.'] };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || obj.id.trim().length === 0) {
    issues.push('Manifest must declare a non-empty stable id.');
  }
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    issues.push('Manifest must declare a non-empty name.');
  }
  if (typeof obj.short_name !== 'string' || obj.short_name.trim().length === 0) {
    issues.push('Manifest must declare a non-empty short_name.');
  }
  if (typeof obj.start_url !== 'string' || !obj.start_url.startsWith('/')) {
    issues.push('Manifest must declare a valid root-relative start_url.');
  }
  if (typeof obj.scope !== 'string' || !obj.scope.startsWith('/')) {
    issues.push('Manifest must declare a valid navigation scope.');
  }
  if (obj.display !== 'standalone') {
    issues.push('Manifest must request standalone display mode.');
  }
  if (!Array.isArray(obj.icons) || obj.icons.length === 0) {
    issues.push('Manifest must include at least one application icon.');
  }
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_TRADER_DATA_KEYS.has(key)) {
      issues.push(`Manifest must not contain trader data or workspace field "${key}".`);
    }
  }
  return {
    valid: issues.length === 0,
    issues,
  };
}

export function isOfflineReleaseInventory(raw: unknown): raw is OfflineReleaseInventory {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.releaseId !== 'string' || obj.releaseId.trim().length === 0) return false;
  if (typeof obj.cacheName !== 'string' || obj.cacheName.trim().length === 0) return false;
  if (!Array.isArray(obj.assets) || obj.assets.length === 0) return false;
  for (const item of obj.assets) {
    if (!item || typeof item !== 'object') return false;
    const entry = item as Record<string, unknown>;
    if (typeof entry.path !== 'string' || !entry.path.startsWith('/')) return false;
    if (typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(entry.sha256)) return false;
    if (typeof entry.sizeBytes !== 'number' || entry.sizeBytes < 0) return false;
  }
  return true;
}

export async function verifyOfflineReleaseInventory(
  rawInventory: unknown,
  readAssetBytes: (path: string) => Promise<Uint8Array | null>,
): Promise<ReleaseInventoryVerificationResult> {
  if (!isOfflineReleaseInventory(rawInventory)) {
    return {
      valid: false,
      reason: 'MalformedInventory',
      missingAssets: [],
      digestMismatches: [],
      message: 'Offline Release Inventory is missing, empty, or structurally invalid.',
    };
  }

  const missingAssets: string[] = [];
  const digestMismatches: {
    readonly path: string;
    readonly expectedSha256: string;
    readonly actualSha256: string;
  }[] = [];

  for (const asset of rawInventory.assets) {
    const bytes = await readAssetBytes(asset.path);
    if (bytes === null) {
      missingAssets.push(asset.path);
      continue;
    }
    const actualSha256 = await computeSha256Hex(bytes);
    if (actualSha256.toLowerCase() !== asset.sha256.toLowerCase()) {
      digestMismatches.push({
        path: asset.path,
        expectedSha256: asset.sha256.toLowerCase(),
        actualSha256: actualSha256.toLowerCase(),
      });
    }
  }

  if (missingAssets.length > 0 || digestMismatches.length > 0) {
    const reason =
      missingAssets.length > 0 && digestMismatches.length > 0
        ? 'MissingAndMismatch'
        : missingAssets.length > 0
          ? 'MissingAssets'
          : 'DigestMismatch';
    const parts: string[] = [];
    if (missingAssets.length > 0) {
      parts.push(`Missing assets: ${missingAssets.join(', ')}`);
    }
    if (digestMismatches.length > 0) {
      parts.push(`Digest mismatch for: ${digestMismatches.map((m) => m.path).join(', ')}`);
    }
    return {
      valid: false,
      reason,
      missingAssets,
      digestMismatches,
      message: parts.join('; '),
    };
  }

  return {
    valid: true,
    releaseId: rawInventory.releaseId,
    cacheName: rawInventory.cacheName,
    verifiedAssetCount: rawInventory.assets.length,
  };
}
