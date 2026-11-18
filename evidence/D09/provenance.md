# D09 provenance

Exact versions used by each evidence run. These are provenance, never a support allowlist.

| Run | Date | Node.js | npm | Operating system | Browser engines |
|---|---|---|---|---|---|
| D09 stage A location checks (`npm ci && npx vitest run src`: 183 files, 2010 tests; `npx vitest run tests/integration`: 123 files, 269 tests; all passed) | 2026-11-17 | v26.12.0 (Homebrew) | 11.20.0 | macOS 26.6.2 (25G83), arm64 | none used (Playwright 1.63.0 installed) |

The location check's `npx vitest run src` covers `src/` only, so its count is lower than D8R's `gate-full1` unit stage (`--project unit`, 2111 tests), which also takes in the tooling tests.

At the location checks, port 5175 had a listener (PID 82846, `node`) that this session had not started. The user said it was safe to stop; the session stopped it, and the port check then passed.
