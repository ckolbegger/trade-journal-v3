// Honest validation of the build-generated Offline Release Inventory.
// Nothing is trusted from the manifest alone: every recorded asset digest is
// recomputed from bytes delivered by the host.
export type InventoryEntry = { url: string; digest: string }
export type OfflineInventory = { version: number; release: string; entries: InventoryEntry[] }
export type Digest = (bytes: Uint8Array) => Promise<string>

export const browserDigest: Digest = async bytes => {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return 'sha256-' + Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function inventoryRelease(entries: InventoryEntry[], digest: Digest = browserDigest): Promise<string> {
  const text = entries.map(e => `${e.url}:${e.digest}`).join('\n')
  return digest(new TextEncoder().encode(text))
}

export async function verifyOfflineInventory(
  inventory: OfflineInventory,
  loadBytes: (url: string) => Promise<Uint8Array>,
  digest: Digest = browserDigest,
): Promise<boolean> {
  if (!inventory || inventory.version !== 1) return false
  const entries = inventory.entries
  if (!Array.isArray(entries) || entries.length === 0) return false
  if (!entries.every(e =>
    typeof e.url === 'string' && e.url.startsWith('/') &&
    typeof e.digest === 'string' && /^sha256-[0-9a-f]{64}$/.test(e.digest))) return false
  if (await inventoryRelease(entries, digest) !== inventory.release) return false
  for (const entry of entries) {
    if (await digest(await loadBytes(entry.url)) !== entry.digest) return false
  }
  return true
}
