# T8P.1-B4 TDD log (hand-written: the case is a shell test, which tdd.sh cannot run)

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.1-B4 | it should take the source root from the innermost .claude/worktrees/ component of the lane's path | red | `bash <scratch>/lane-setup.test.sh` (the new `--print-source-root` mode with the original `${1%%/.claude/worktrees/*}` derivation) | exit 1 | `FAIL: nested path: expected /x/.claude/worktrees/outer, got exit 0: /x` |
| T8P.1-B4 | it should take the source root from the innermost .claude/worktrees/ component of the lane's path | green | `.claude/scripts/lane-setup.test.sh` (derivation `${1%/.claude/worktrees/*}`) | exit 0 | `lane-setup.test: all passed` (nested, plain and outside-path checks) |
