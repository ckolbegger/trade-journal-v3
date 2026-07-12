import type { Entry } from '@/books/journal/types'

// An entry's prompts-as-answered, exactly as snapshotted at write time (ADR
// 0007). Pure display — every surface that shows a written entry (timeline
// roots and addenda, Trade detail) renders this same shape; promptClass
// carries each page's own prompt typography.

export function AnsweredPrompts({
  answered,
  promptClass,
}: {
  answered: Entry['answered']
  promptClass: string
}) {
  return (
    <dl className="space-y-2">
      {answered.map((a, i) => (
        <div key={i}>
          <dt className={promptClass}>{a.prompt.text}</dt>
          <dd className="mt-0.5 text-sm text-slate-800">
            {a.answer ? String(a.answer.value) : '—'}
          </dd>
        </div>
      ))}
    </dl>
  )
}
