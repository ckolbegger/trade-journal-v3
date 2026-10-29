# D5 TDD log

Each row is one `it should` case run alone (`-t` filter), so counts read "1 passed, N skipped". Complete cumulative suite runs are recorded in `structural.md` with full outputs in `suite-runs/`.

Every `it should` case from D5's breakdown, section 4, run red and then green, one at a time (kickoff prompt; breakdown, section 10). Each row is one run: the task, the case, the phase, the exact command, the exit code with Vitest's test summary, and an excerpt of the failure for red runs. A red row is valid only when it fails because the planned behavior is absent or incorrect; a red run that passes or fails for another reason is fixed and rerun, never skipped. Playwright reds and greens are logged by hand, because `tdd.sh` runs Vitest only.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T5.1 | should create a fresh Workspace at schema version 4 | red | `npx vitest run src/persistence/schema-v4.test.ts -t "should create a fresh Workspace at schema version 4"` | exit 1; Tests  1 failed, 2 skipped (3) | AssertionError: expected { kind: 'KnownWorkspace', …(3) } to deeply equal ObjectContaining{…}  |
| T5.1 | should create a fresh Workspace at schema version 4 | green | `npx vitest run src/persistence/schema-v4.test.ts -t "should create a fresh Workspace at schema version 4"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T5.1 | should copy every v3 store unchanged | red | `npx vitest run src/persistence/schema-v4.test.ts -t "should copy every v3 store unchanged"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T5.1 | should copy every v3 store unchanged | red | `npx vitest run src/persistence/schema-v4.test.ts -t "should copy every v3 store unchanged"` | exit 1; Tests  1 failed, 2 skipped (3) | Error: No migration from schema 3  |
| T5.1 | should copy every v3 store unchanged | green | `npx vitest run src/persistence/schema-v4.test.ts -t "should copy every v3 store unchanged"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T5.1 | should rebuild byOutstandingDue | red | `npx vitest run src/persistence/schema-v4.test.ts -t "should rebuild byOutstandingDue"` | exit 1; Tests  1 failed, 2 skipped (3) | AssertionError: expected { keyPath: [ …(2) ], …(2) } to deeply equal { keyPath: [ …(2) ], …(2) }  |
| T5.1 | should rebuild byOutstandingDue | green | `npx vitest run src/persistence/schema-v4.test.ts -t "should rebuild byOutstandingDue"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T5.1 | should rebuild byOutstandingDue | red | `npx vitest run src/persistence/schema-v4.test.ts -t "should rebuild byOutstandingDue"` | exit 1; Tests  1 failed, 2 skipped (3) | AssertionError: expected { 'pcr:debt-c': { …(2) } } to deeply equal { 'pcr:debt-a': { …(2) }, …(2) }  |
| T5.1 | should rebuild byOutstandingDue | green | `npx vitest run src/persistence/schema-v4.test.ts -t "should rebuild byOutstandingDue"` | exit 0; Tests  1 passed, 2 skipped (3) |  |
| T5.1 | v3 → v4 transform | note | (none) | n/a | Case 2's first run passed because the case 1 green step had already added the v3→v4 transform and chain step (production code written ahead). Corrected: the transform file and the chain entry were removed, the case was rerun to a genuine red (`No migration from schema 3`), and they were restored for green. Not a first-run pass. |
| T5.1 | rebuild | note | (none) | n/a | The obligation-derivation assertions (Outstanding Debt names the key, the Entry with settledDebtId names a settled key) are beyond the planned wording; added to the case and proven red before the rebuild change (outcomes held only the Entry). |
| T5.1 | all | refactor | `npx vitest run src/persistence/schema-v4.test.ts` | exit 0, 3 passed | No code change beyond a shared `isOutstanding` helper in `rebuild.ts` used by the Debt field and obligation passes. No test renaming. |
