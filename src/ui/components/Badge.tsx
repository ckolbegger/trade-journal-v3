import type { HTMLAttributes } from 'react'

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
