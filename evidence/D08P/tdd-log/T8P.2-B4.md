# T8P.2-B4 TDD log (hand-written: the case is a shell test, which tdd.sh cannot run)

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.2-B4 | it should pass the it.only fixture with CI set | red | `CI=1 bash .claude/scripts/it-titles.test.sh b1` (scratch config without allowOnly) | exit 1 | `FAIL: b1: exit 1` (collection fails on it.only because allowOnly defaults to false under CI) |
| T8P.2-B4 | it should pass the it.only fixture with CI set | green | `CI=1 bash .claude/scripts/it-titles.test.sh b1`, then the whole test with `CI=1` and with `env -u CI` (scratch config sets allowOnly: true) | exit 0 (all three) | `it-titles.test: all passed` |
