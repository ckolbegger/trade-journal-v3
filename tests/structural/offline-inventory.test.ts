import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

const dist = 'dist'

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(path))
    else out.push(path)
  }
  return out
}

describe('Offline Release Inventory (S2 structural)', () => {
  it('should list every built asset exactly once with a matching sha256 digest', async () => {
    const inventory = JSON.parse(await readFile(join(dist, 'offline-inventory.json'), 'utf8')) as {
      version: number
      release: string
      entries: { url: string; digest: string }[]
    }
    expect(inventory.version).toBe(1)
    expect(inventory.entries.length).toBeGreaterThan(0)
    const urls = inventory.entries.map(e => e.url)
    expect(new Set(urls).size).toBe(urls.length)
    const listed = new Set(urls)
    const built = (await walk(dist))
      .map(f => '/' + relative(dist, f).replaceAll('\\', '/'))
      .filter(u => u !== '/sw.js' && u !== '/offline-inventory.json')
    expect(listed).toEqual(new Set(built))
    for (const entry of inventory.entries) {
      const bytes = await readFile(join(dist, entry.url.slice(1)))
      expect(entry.digest).toBe('sha256-' + createHash('sha256').update(bytes).digest('hex'))
    }
  })

  it('should generate a service worker that precaches exactly the inventory set', async () => {
    const inventory = JSON.parse(await readFile(join(dist, 'offline-inventory.json'), 'utf8')) as {
      release: string
      entries: { url: string }[]
    }
    const sw = await readFile(join(dist, 'sw.js'), 'utf8')
    expect(sw).toContain(inventory.release)
    for (const entry of inventory.entries) expect(sw).toContain(entry.url)
  })
})
