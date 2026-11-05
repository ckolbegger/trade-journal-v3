# D7 prefactor structural verifications

Each entry records a structural task's exact verification (D7 prefactor breakdown, section 4), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md). Each task's `ocr-review` findings and bug tasks are recorded under the task's heading, with the raw outputs in `ocr/`.

## Start of the D7 prefactor

Location checks (prefactor handoff, section 1) on 2026-11-04:
- worktree `/Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5`, branch `claude-opus-5.5`: matched.
- `git status -sb`: `## claude-opus-5.5...origin/claude-opus-5.5 [ahead 2]`, clean except the untracked `.claude/settings.json`.
- `git log --oneline claude-opus-5.5-pre-d7p..HEAD`: empty. `HEAD` is `89e545b`.
- tags `claude-opus-5.5-plan-r42`, `claude-opus-5.5-d6`, `claude-opus-5.5-pre-d7p`: present. `claude-opus-5.5-d6` is `e10d55a225d19d70c5cb5923d6f45e0cb93b5a1b`.
- `git diff claude-opus-5.5-d6 -- src e2e tests tools`: empty.
- `DEV_PORT=5175`; Node v26.12.0.
- `npm ci`: exit 0. `npx vitest run src`: `Test Files 94 passed (94)`, `Tests 1188 passed (1188)`. `npx vitest run tests/integration`: `Test Files 76 passed (76)`, `Tests 154 passed (154)`.

Spec reading (decision 45, A181, scoped): `specs/glossary.md` "Market observations and valuation" (S251); ADR 0007 (S085); `specs/design/trade-analysis.md` "Shared values", `derive`, `evaluate` (S164, S166, S167); `specs/design/daily-review.md` "Date, eligibility, and ordering", `open`, "Completion and resumption" (S090, S091, S096); `specs/design/trade-views-and-reporting.md` `browseTrades`, `getTradeDetail` (S188, S189); `specs/design/ui-contract.md` "Trade and Journal presentation", "Numbers, availability, and graphs" (S211, S212); `specs/design/overview.md` "Calculation availability" (S137); acceptance rows AC-CALC-002, AC-LIFE-003, AC-REV-002, AC-REV-006, AC-UI-001, AC-UI-002, AC-RESP-001 (S051, S016, S039, S043, S074, S075, S011). No other spec section has been needed yet.
