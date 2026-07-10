import { describe, it, expect } from 'vitest'
import { ESLint } from 'eslint'
import type { Linter } from 'eslint'

const eslint = new ESLint()

async function lint(code: string, filePath: string): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages
}

function hasBoundaryError(messages: Linter.LintMessage[]): boolean {
  return messages.some((m) => m.ruleId === 'no-restricted-imports' && m.severity === 2)
}

describe('module boundaries', () => {
  it('fails lint when a ui file imports from src/storage', async () => {
    const messages = await lint(
      `import { binding } from '@/storage/binding'\nexport const b = binding\n`,
      'src/ui/__fixture__.tsx',
    )
    expect(hasBoundaryError(messages)).toBe(true)
  })

  it('fails lint when trademath imports from src/books', async () => {
    const messages = await lint(
      `import { book } from '@/books/tradebook'\nexport const b = book\n`,
      'src/domain/trademath/__fixture__.ts',
    )
    expect(hasBoundaryError(messages)).toBe(true)
  })

  it('passes lint on the scaffold as committed', async () => {
    const results = await eslint.lintFiles([
      'src/**/*.{ts,tsx}',
      'tests/**/*.ts',
      'eslint.config.js',
      'vite.config.ts',
      'playwright.config.ts',
    ])
    const errorCount = results.reduce((n, r) => n + r.errorCount, 0)
    const errors = results.flatMap((r) =>
      r.messages
        .filter((m) => m.severity === 2)
        .map((m) => `${r.filePath}:${m.line} ${m.ruleId}: ${m.message}`),
    )
    expect(errors).toEqual([])
    expect(errorCount).toBe(0)
  })
})
