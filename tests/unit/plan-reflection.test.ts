import { describe, expect, it } from 'vitest'
import { PLAN_REFLECTION_DEFINITION, preparePlanReflection } from '../../src/domain/plan-reflection'

describe('Plan Reflection preparation', () => {
  it('should return the exact initial definition with Thesis/Invalidation semantic roles', () => {
    const d = PLAN_REFLECTION_DEFINITION
    expect(d.type).toBe('Plan Reflection')
    expect(d.prompts.map(p => p.role)).toContain('Thesis')
    expect(d.prompts.map(p => p.role)).toContain('Invalidation')
    expect(d.prompts.find(p => p.role === 'Thesis')?.required).toBe(true)
  })

  it('should require Thesis and Invalidation and accept optional Conviction and Primary emotion', () => {
    const result = preparePlanReflection(
      { thesis: 'Why now', invalidation: 'Close below 50d' },
      'D1',
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.snapshot.answers.Thesis).toBe('Why now')
  })

  it('should snapshot the exact definition revision shown for the Entry', () => {
    const result = preparePlanReflection({ thesis: 'T', invalidation: 'I' }, 'D1')
    if (result.ok) expect(result.value.snapshot.definitionRevision).toBe('D1')
  })

  it('should reject a missing required answer with typed issues and no prepared effect', () => {
    const result = preparePlanReflection({ thesis: 'T', invalidation: '' }, 'D1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues).toContain('Invalidation')
  })
})
