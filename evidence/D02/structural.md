# D2 structural verifications

Each entry records a structural task's exact verification (D2 breakdown, section 5), and each task ends with a complete cumulative suite run delegated to the `suite-runner` subagent, with full outputs in `suite-runs/`. Versions are in [provenance.md](provenance.md).

## Cumulative run after T2.1

Run 2026-10-19 15:18 EDT on commit `335e62d` (the only uncommitted files were this run's own outputs).

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files 25 passed (25)`, `Tests 218 passed (218)`, exit 0 | `suite-runs/t2.1-replay-positions-lots-unit.txt` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | `Test Files 6 passed (6)`, `Tests 19 passed (19)`, exit 0 | `suite-runs/t2.1-replay-positions-lots-integration.txt` |
| Browser (Chromium) | `npm run test:e2e` | `27 passed (41.5s)`, exit 0 | `suite-runs/t2.1-replay-positions-lots-browser.txt` |
| Static and verification checks (11 commands) | `npm run typecheck`, `npx tsc6 --noEmit`, `npm run lint`, `npm run lint:deps`, `npm run build`, `npm run verify:release`, `npm run verify:capabilities`, `npm run verify:releases`, `npm run verify:no-fault-hooks`, `npm run verify:capacity`, `npm run verify:fixtures` | 11 of 11 exit 0 | `suite-runs/t2.1-replay-positions-lots-checks.txt` |

Failures: none.
