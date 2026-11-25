import { resolveExpectedMarkDate } from './calendar'

export type TaskFamily = { kind: 'Marks' | 'Debt' | 'Settlement' | 'Trades'; items: string[] }

export function resolveReviewDate(now: Date): string {
  return resolveExpectedMarkDate(now)
}

export function orderTaskFamilies(input: {
  missingMarks: string[]
  dueDebt: string[]
  settlementDue: string[]
  trades: string[]
}): TaskFamily[] {
  return [
    { kind: 'Marks' as const, items: input.missingMarks },
    { kind: 'Debt' as const, items: input.dueDebt },
    { kind: 'Settlement' as const, items: input.settlementDue },
    { kind: 'Trades' as const, items: input.trades },
  ].filter(f => f.items.length > 0)
}
