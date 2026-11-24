import { describe, expect, it } from 'vitest'
import { inventoryRelease, verifyOfflineInventory, type Digest, type OfflineInventory } from '../../src/domain/offline-inventory'

const digest: Digest = async bytes =>
  'sha256-' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').padEnd(64, '0').slice(0, 64)
const bytes = (value: string) => new TextEncoder().encode(value)
const loader = async (url: string) => (url === '/a' ? bytes('A') : bytes('B'))

async function inventory(entries: { url: string; digest: string }[], release?: string): Promise<OfflineInventory> {
  return { version: 1, release: release ?? await inventoryRelease(entries, digest), entries }
}

describe('offline release inventory validation', () => {
  it('should accept an inventory whose release and every asset digest match', async () => {
    const entries = [
      { url: '/a', digest: await digest(bytes('A')) },
      { url: '/b', digest: await digest(bytes('B')) },
    ]
    expect(await verifyOfflineInventory(await inventory(entries), loader, digest)).toBe(true)
  })

  it('should reject an inventory whose release is inconsistent with its entries', async () => {
    const entries = [{ url: '/a', digest: await digest(bytes('A')) }]
    expect(await verifyOfflineInventory(await inventory(entries, 'sha256-wrong'), loader, digest)).toBe(false)
  })

  it('should reject an inventory whose asset bytes do not match a recorded digest', async () => {
    const entries = [{ url: '/a', digest: await digest(bytes('B')) }]
    expect(await verifyOfflineInventory(await inventory(entries), loader, digest)).toBe(false)
  })

  it('should reject a malformed or unsupported inventory', async () => {
    const entries = [{ url: 'relative', digest: 'md5-not-a-digest' }]
    expect(await verifyOfflineInventory(await inventory(entries), loader, digest)).toBe(false)
    expect(await verifyOfflineInventory({ ...await inventory([]), version: 2 }, loader, digest)).toBe(false)
  })
})
