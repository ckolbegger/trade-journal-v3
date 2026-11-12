# D7S structural verifications

Each entry records a structural task's exact verification (D7S breakdown, section 5), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of D7S

Location checks (D7S handoff, section 1) on 2026-11-11:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5`, clean. Not "ahead 63": the user had pushed, and `HEAD`, `origin/claude-opus-5.5` and `claude-opus-5.5-pre-d7s` are all `ad11e458`.
- `git log --oneline claude-opus-5.5-pre-d7s..HEAD`: empty.
- tags `claude-opus-5.5-d7sp` (`27970527be8a04fba56f22676afe54a5c8b2af4a`), `claude-opus-5.5-plan-r78` (`0c679938d93a96c3d90d9fd62286376d232b1f38`), `claude-opus-5.5-plan-r79` (`d28fb44450aa3e320eec3c5a6ba3c7a1977c7519`) and `claude-opus-5.5-pre-d7s`: present.
- `git diff --stat claude-opus-5.5-d7sp claude-opus-5.5-pre-d7s -- src e2e tests tools package.json 'eslint*'`: empty.
- `git rev-parse --git-path hooks`: `.githooks`.
- `ocr llm test`: `✓ Connection test successful`.
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: `Test Files 125 passed (125)`, `Tests 1481 passed (1481)`. `npx vitest run tests/integration`: `Test Files 97 passed (97)`, `Tests 202 passed (202)`.

Spec reading (decision 45, A205): `plan/spec-reading/D07.md`. No other spec section has been needed yet.

## Critic cost

| Critic | Report | Flows | Result |
|---|---|---|---|

## T7S.1 Persistence: schema 7 and the `v6→v7` transform

Behavioral (1 case, red then green, in `tdd-log.md`). Commit `1627e865`. Red: the schema-6 database read as current (`expected { kind: 'KnownWorkspace', … } to deeply equal { kind: 'OlderSchema', … }`); green after `SCHEMA_VERSION` 7 and `src/persistence/migrations/v6-to-v7.ts`, which only drops private fields, like `v5-to-v6.ts` (A199). No first-run passes. Current-schema version literals moved from 6 to 7, test names unchanged, as T7.7 did (implementation-level decision, recorded in the brief): `src/persistence/candidate.test.ts`, `persistence.test.ts`, `schema-v3..v6.test.ts`, `src/coordinators/workspace/workspace.test.ts`, `migration.test.ts` (the newer-schema case now seeds 8), and `tests/integration/d2|d4|d5|d6|d7/seed.test.ts` and `migration.test.ts`. No fixture touched; `verify:fixtures` opens workspace-v1 to v6 Ready at schema 7 with views equal to their snapshots. `verify:capabilities` already reports schema 7. `verify:capacity` fails as expected until T7S.2 (decision 108).

**ocr review** (`ocr/T7S.1-1627e865.json`): No findings (3 files reviewed).

**Cumulative run `t7s-1`** (2026-11-12, on `6582ea5b`, which adds only plan documents to `1627e865`), outputs in `suite-runs/t7s-1-*.txt`, `run-complete.sh`: run complete.

| Suite | Result |
|---|---|
| Unit | 126 files; 1480 passed, 2 failed (below) |
| Node integration | 97 files, 202 passed |
| Browser (Chromium), full tier | `browser-1` 119 passed (5.0 min); `browser-2` 65 passed (4.2 min) |
| Checks | 13 of 14 exit 0; `verify:capacity` the expected failure ("basis measured at schema version 6, current is 7") |

Browser tier printed by `browser-auto ad11e458`: `browser tier: full (first matching path since ad11e458: src/persistence/migrations/index.ts)`. Ports 5175, 9341, 9342 free before and after.

Unit failures: `src/ui/screens/ReviewCards.test.tsx:670` and `:694` ("links (A161)": the focused row's region `contains(document.activeElement)`, expected true). Reproduced with targeted runs in the main session: `npx vitest run src/ui/screens/ReviewCards.test.tsx -t "links"` 11 passed, and the whole file 50 of 50. The cases read focus synchronously after `findByRole`, and the unit stage ran while T7S.1's ocr review was running, so this is read as a timing flake under load, not a T7S.1 defect (T7S.1 changed persistence only). Not fixed; listed in the handoff's open questions, and it becomes a fix task (failing test first, `waitFor` on focus) if it fails again.
