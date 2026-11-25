// A Trade's Journal narrative is a read-only projection: one effective
// outcome per obligation, anchored to the Trade or any of its fills. It never
// creates a Journal fact and never duplicates an Entry across anchors.
export type NarrativeRow = {
  id: string
  kind?: string
  obligationKey?: string
  revision?: string
  status?: string
  source?: string
  reason?: string
  snapshot?: {
    answers?: Record<string, string>
    anchor?: Record<string, unknown>
    origin?: Record<string, unknown>
    source?: string
    definitionRevision?: string
  }
}

export type NarrativeItem = {
  id: string
  obligationKey: string
  kind: 'Entry' | 'JournalDecline'
  revision: string
  status: string
  source: string
  answers: Record<string, string>
  reason?: string
}

function anchored(row: NarrativeRow, tradeId: string, executionIds: string[]): boolean {
  const anchor = row.snapshot?.anchor
  const origin = row.snapshot?.origin
  if (anchor?.tradeId === tradeId) return true
  if (typeof anchor?.executionId === 'string' && executionIds.includes(anchor.executionId)) return true
  return origin?.tradeId === tradeId
}

export function buildTradeNarrative(
  rows: NarrativeRow[],
  tradeId: string,
  executionIds: string[],
): NarrativeItem[] {
  const items: NarrativeItem[] = []
  const byId = new Map<string, number>()

  for (const row of rows) {
    if (row.kind !== 'Entry' && row.kind !== 'JournalDecline') continue
    if (!anchored(row, tradeId, executionIds)) continue

    const item: NarrativeItem = {
      id: row.id,
      obligationKey: String(row.obligationKey ?? row.id),
      kind: row.kind,
      revision: row.revision ?? '1',
      status: row.status ?? 'Saved',
      source: row.source ?? row.snapshot?.source ?? 'Journal',
      answers: row.snapshot?.answers ?? {},
      ...(row.reason ? { reason: row.reason } : {}),
    }
    const existing = byId.get(row.id)
    if (existing === undefined) {
      byId.set(row.id, items.length)
      items.push(item)
      continue
    }
    if (Number(item.revision) > Number(items[existing].revision)) items[existing] = item
  }
  return items
}
