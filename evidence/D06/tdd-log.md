# D6 TDD log

Each row is one `it should` case run alone (`-t` filter), so counts read "1 passed, N skipped". Complete cumulative suite runs are recorded in `structural.md` with full outputs in `suite-runs/`.

Every `it should` case from D6's breakdown, section 4, run red and then green, one at a time (kickoff prompt; breakdown, section 10). Each row is one run: the task, the case, the phase, the exact command, the exit code with the test summary, and an excerpt of the failure for red runs. A red row is valid only when it fails because the planned behavior is absent or incorrect; a red run that passes or fails for another reason is fixed and rerun, never skipped. `tdd.sh` runs Vitest only, so Playwright reds and greens are logged by hand.

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
