# D7S TDD log

Each row is one `it should` case run alone (`-t` filter), so counts read "1 passed, N skipped". Complete cumulative suite runs are recorded in `structural.md` with full outputs in `suite-runs/`.

Every `it should` case from the D7S breakdown, section 4, run red and then green, one at a time (kickoff prompt; breakdown, section 4). Each row is one run: the task, the case, the phase, the exact command, the exit code with the test summary, and an excerpt of the failure for red runs. A red row is valid only when it fails because the planned behavior is absent or incorrect; a red run that passes or fails for another reason is fixed and rerun, never skipped. A first-run pass carries its mutation check (an assertion failure or runtime exception, never a compile error) and is listed in the handoff's open questions. `tdd.sh` runs Vitest only, so Playwright reds and greens are logged by hand.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T7S.1 | should open a schema-6 database holding an option Trade at schema 7 | red | `npx vitest run src/persistence/schema-v7.test.ts -t "should open a schema-6 database holding an option Trade at schema 7"` | exit 1; Tests  1 failed (1) | AssertionError: expected { kind: 'KnownWorkspace', …(3) } to deeply equal { kind: 'OlderSchema', …(2) }  |
| T7S.1 | should open a schema-6 database holding an option Trade at schema 7 | green | `npx vitest run src/persistence/schema-v7.test.ts -t "should open a schema-6 database holding an option Trade at schema 7"` | exit 0; Tests  1 passed (1) |  |
| T7S.1 | (all) | refactor | `npx vitest run src tests/integration` | exit 0; 223 files, 1684 passed | note: no refactor needed (v6-to-v7.ts mirrors v5-to-v6.ts, three lines). No test names rephrased beyond dropping punctuation; no assertion added beyond the planned wording except the store-name list and the v1 chain meta schema 7. Existing tests moved to version 7 with names unchanged. |
