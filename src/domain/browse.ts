import type { Institution } from './types'

export function browseFamily(items: Institution[], pageSize = 50): Institution[] {
  const sorted = [...items].sort((a, b) => a.label.localeCompare(b.label))
  const all: Institution[] = []
  for (let i = 0; i < sorted.length; i += pageSize) all.push(...sorted.slice(i, i + pageSize))
  return all
}

export function resolveRetained(item: Institution): { currentLabel: string; historicalLabels: string[] } {
  return {
    currentLabel: item.label,
    historicalLabels: item.history.map(h => h.label),
  }
}
