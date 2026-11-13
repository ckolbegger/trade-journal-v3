# D08P TDD log

Each row is one `it should` case run alone (`-t` filter), so counts read "1 passed, N skipped". Complete cumulative suite runs and lane tiers are recorded in `structural.md`, with full outputs in `suite-runs/`.

Every `it should` case from the D08P breakdown, section 5, runs red and then green, one at a time (kickoff prompt; breakdown, section 5). Each row is one run: the task, the case, the phase, the exact command, the exit code with the test summary, and an excerpt of the failure for red runs. A red row is valid only when it fails because the planned behavior is absent or incorrect; a red run that passes or fails for another reason is fixed and rerun, never skipped. A first-run pass carries its mutation check (an assertion failure or runtime exception, never a compile error) and is listed in the handoff's open questions. `tdd.sh` runs Vitest only, so Playwright reds and greens are logged by hand.

**One log per task from T8P.1 on.** Since T8P.1 (`cac803c2`), `tdd.sh` writes one file per task, `evidence/D08P/tdd-log/<task>.md` (decision 111), so lanes never edit one file. Rows written before that move stay here. This file must still exist, since `tdd.sh` refuses to run without it and copies its column header into each task's file.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
