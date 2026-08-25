import type { HTMLAttributes } from 'react'
import type { Anchor } from '@/books/journal/types'

// Small rounded status pill. Tone per status (ADR-agnostic display only):
// planned = amber, open = green, closed = gray.
const TONES: Record<string, string> = {
  planned: 'bg-amber-100 text-amber-800',
  open: 'bg-green-100 text-green-800',
  closed: 'bg-slate-100 text-slate-600',
}

export function StatusBadge({
  status,
  className = '',
  ...rest
}: { status: string } & HTMLAttributes<HTMLSpanElement>) {
  const tone = TONES[status] ?? TONES.closed
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tone} ${className}`}
      {...rest}
    >
      {status}
    </span>
  )
}

// Journal timeline type badges — one tone per Anchor.kind (never Entry Type,
// which is trader-editable from Slice 13 and cannot carry a fixed palette).
// 'entry' (addenda) never reaches a timeline row, so it has no tone here.
// Ratios computed against WCAG AA (4.5:1 normal text): PLAN 7.15:1,
// REVIEW 8.18:1, MARKET 6.37:1, CLOSE 6.80:1.
const ENTRY_TONES: Record<Exclude<Anchor['kind'], 'entry'>, string> = {
  plan: 'bg-blue-100 text-blue-800',
  review: 'bg-stone-200 text-stone-700',
  standalone: 'bg-amber-100 text-amber-800',
  close: 'bg-red-100 text-red-800',
}

const ENTRY_LABELS: Record<Exclude<Anchor['kind'], 'entry'>, string> = {
  plan: 'PLAN',
  review: 'REVIEW',
  standalone: 'MARKET',
  close: 'CLOSE',
}

export function EntryBadge({
  kind,
  className = '',
  ...rest
}: { kind: Exclude<Anchor['kind'], 'entry'> } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ENTRY_TONES[kind]} ${className}`}
      {...rest}
    >
      {ENTRY_LABELS[kind]}
    </span>
  )
}
