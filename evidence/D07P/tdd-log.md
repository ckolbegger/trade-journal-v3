# D7 prefactor TDD log

Each row is one `it should` case run alone (`-t` filter), so counts read "1 passed, N skipped". Complete cumulative suite runs are recorded in `structural.md` with full outputs in `suite-runs/`.

Every `it should` case from the D7 prefactor breakdown, section 3, run red and then green, one at a time (kickoff prompt; breakdown, section 3). Each row is one run: the task, the case, the phase, the exact command, the exit code with the test summary, and an excerpt of the failure for red runs. A red row is valid only when it fails because the planned behavior is absent or incorrect; a red run that passes or fails for another reason is fixed and rerun, never skipped. `tdd.sh` runs Vitest only, so Playwright reds and greens are logged by hand.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T7P.2 | should give a stock key as its symbol | red | `npx vitest run src/domain/instrument/instrument.test.ts -t "should give a stock key as its symbol"` | exit 1; Tests  no tests | Error: Cannot find module './index' imported from /Users/ckolbegger/src/trade-journal-v3/worktrees/claude-opus-5.5/src/domain/instrument/instrument.test.ts  |
| T7P.2 | should give a stock key as its symbol | green | `npx vitest run src/domain/instrument/instrument.test.ts -t "should give a stock key as its symbol"` | exit 0; Tests  1 passed, 1 skipped (2) |  |
| T7P.2 | should read a stock key back as the same Instrument | red | `npx vitest run src/domain/instrument/instrument.test.ts -t "should read a stock key back as the same Instrument"` | exit 1; Tests  1 failed, 1 skipped (2) | AssertionError: expected { kind: 'Stock', symbol: '' } to deeply equal { kind: 'Stock', symbol: 'XYZ' }  |
| T7P.2 | should read a stock key back as the same Instrument | green | `npx vitest run src/domain/instrument/instrument.test.ts -t "should read a stock key back as the same Instrument"` | exit 0; Tests  1 passed, 1 skipped (2) |  |
| T7P.2 | all | refactor | n/a | none | No refactor: module is 10 lines; calculation-result now imports Instrument type-only |
