# D08R provenance

Exact versions used by each evidence run. These are provenance, never a support allowlist.

| Run | Date | Node.js | npm | Operating system | Browser engines |
|---|---|---|---|---|---|
| D08R location checks (`npm ci && npx vitest run src`: 181 files, 1927 tests; `npx vitest run tests/integration`: 118 files, 258 tests; all passed) | 2026-11-17 | v26.12.0 (Homebrew) | 11.20.0 | macOS 26.6.2 (25G83), arm64 | none used (Playwright 1.63.0 installed) |

The location check's `npx vitest run src` covers `src/` only, so its counts are lower than the complete run's unit stage (`--project unit`: 189 files and 2027 tests at `T8.19-F1`), which also takes in the tooling tests.
