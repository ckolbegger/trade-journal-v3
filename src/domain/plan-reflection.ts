import type { Result } from './types'

export type Prompt = { id: string; role: string; required: boolean; kind: string; options?: string[] }

export const PLAN_REFLECTION_DEFINITION = {
  type: 'Plan Reflection',
  revision: 'D1',
  prompts: [
    { id: 'thesis', role: 'Thesis', required: true, kind: 'Text' },
    { id: 'invalidation', role: 'Invalidation', required: true, kind: 'Text' },
    { id: 'conviction', role: 'Conviction', required: false, kind: 'Scale' },
    { id: 'emotion', role: 'PrimaryEmotion', required: false, kind: 'SingleSelect',
      options: ['Calm', 'Eager', 'Anxious', 'FOMO', 'Revenge', 'Relieved', 'Frustrated', 'Other'] },
  ] satisfies Prompt[],
}

export type ReflectionForm = { thesis: string; invalidation: string; conviction?: number; emotion?: string }
export type PreparedEntry = {
  snapshot: {
    definitionRevision: string
    answers: Record<string, string | number | undefined>
    source: string
  }
}

export function preparePlanReflection(
  form: ReflectionForm,
  definitionRevision: string,
): Result<PreparedEntry, { issues: string[] }> {
  const issues: string[] = []
  if (!form.thesis?.trim()) issues.push('Thesis')
  if (!form.invalidation?.trim()) issues.push('Invalidation')
  if (issues.length) return { ok: false, error: { issues } }

  return {
    ok: true,
    value: {
      snapshot: {
        definitionRevision,
        answers: {
          Thesis: form.thesis,
          Invalidation: form.invalidation,
          ...(form.conviction !== undefined ? { Conviction: form.conviction } : {}),
          ...(form.emotion ? { PrimaryEmotion: form.emotion } : {}),
        },
        source: 'Plan Confirmation',
      },
    },
  }
}
