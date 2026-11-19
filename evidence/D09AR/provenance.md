# D09AR provenance

Exact versions used by each evidence run. These are provenance, never a support allowlist.

| Run | Date | Node.js | npm | Operating system | Browser engines |
|---|---|---|---|---|---|
| D09AR location checks (`npm ci && npx vitest run src`: 189 files, 2187 tests; `npx vitest run tests/integration`: 130 files, 280 tests; all passed), on `1cc612ea` | 2026-11-18 | v26.12.0 | 11.20.0 | macOS 26.6.2 (25G83), arm64 | none used |

The location check's `npx vitest run src` covers `src/` only, so its count is lower than the handoff's figure from stage A's gate run (`--project unit`: 198 files, 2,289 tests), which also takes in the tooling tests. The integration count equals the gate run's.

Session start: 2026-11-18, about 22:50 EST (the location checks finished at about 23:15).
