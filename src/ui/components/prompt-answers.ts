import type { Prompt, PromptAnswer } from '@/books/journal/types'

// The entry-form's working state: an answer-in-progress per prompt id, collected
// into the PromptAnswers a Journal write or settle takes. Unanswered prompts are
// simply absent — an entry may be written with some prompts left blank.

export type PromptValues = Record<string, string | number>

export function collectAnswers(prompts: Prompt[], values: PromptValues): PromptAnswer[] {
  const answers: PromptAnswer[] = []
  for (const prompt of prompts) {
    const value = values[prompt.id]
    if (value === undefined || value === '') continue
    answers.push({ promptId: prompt.id, value })
  }
  return answers
}
