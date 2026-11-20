# D09R2 provenance

Exact versions used by each evidence run. These are provenance, never a support allowlist.

| Run | Date | Node.js | npm | Operating system | Browser engines |
|---|---|---|---|---|---|
| D09R2 location checks (`npm ci && npx vitest run --project unit`: 224 files, 2592 tests; `npx vitest run tests/integration`: 137 files, 294 tests) | 2026-11-20 | v26.12.0 | 11.20.0 | macOS 26.6.2 / 25G83 / arm64 | none used |

At the location checks, unit had 2 failures, both in `tools/wording-rules.test.ts`, failing on every run: the D9 stage C retro commit `78a10e66` added the "price called a close" selectors to `eslint.wording.config.js` without updating that test (one dated literal now hit twice; the current-tree case ignored `eslint-suppressions.json` and reported the three recorded hits). The session stopped and asked; the user chose a tools-only fix before T9R2.1 (2026-11-20). Commit `ceefd574` (`chore(retro-D09C)`, `tools/wording-rules.test.ts` only) made the W34 case expect both rules' hits and the current-tree case allow close hits only up to each file's `no-restricted-syntax` suppression count, read from the JSON; a mutation check (an unsuppressed close hit, and a non-close wording hit, in `src/ui/Badge.tsx`, reverted) failed the case by assertion. After it: unit 224 files, 2592 tests, all passing; integration as above, all passing.
