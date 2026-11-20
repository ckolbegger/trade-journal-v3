# D09 provenance

Exact versions used by each evidence run. These are provenance, never a support allowlist.

| Run | Date | Node.js | npm | Operating system | Browser engines |
|---|---|---|---|---|---|
| D09 stage A location checks (`npm ci && npx vitest run src`: 183 files, 2010 tests; `npx vitest run tests/integration`: 123 files, 269 tests; all passed) | 2026-11-17 | v26.12.0 (Homebrew) | 11.20.0 | macOS 26.6.2 (25G83), arm64 | none used (Playwright 1.63.0 installed) |
| D09 stage B location checks (`npm ci && npx vitest run src`: 203 files, 2382 tests; `npx vitest run tests/integration`: 135 files, 286 tests; all passed) | 2026-11-19 | v26.12.0 (Homebrew) | 11.20.0 | macOS 26.6.2 / 25G83 / arm64 | none used |
| D09 stage C location checks (`npm ci && npx vitest run --project unit`: 220 files, 2552 tests; `npx vitest run tests/integration`: 136 files, 292 tests; all passed) | 2026-11-20 | v26.12.0 | 11.20.0 | macOS 26.6.2 / 25G83 / arm64 | none used |

Stage C: the unit count is above the handoff's 218 files and 2,544 tests because T9.28-D1, T9.28-D2 and the stage B retro's tool fix (`5d81822b`) landed after stage B's last full run. The same commits, with the retro's `c2675634` and `c4fa8012`, are the only code changes since `claude-opus-5.5-d9b`, so the handoff's "empty diff" check was read as matching (each is a user decision or an approved retro item).

The location check's `npx vitest run src` covers `src/` only, so its count is lower than D8R's `gate-full1` unit stage (`--project unit`, 2111 tests), which also takes in the tooling tests.

At the location checks, port 5175 had a listener (PID 82846, `node`) that this session had not started. The user said it was safe to stop; the session stopped it, and the port check then passed.
