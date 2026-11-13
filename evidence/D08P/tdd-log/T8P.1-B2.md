# T8P.1-B2 TDD log (hand-written: the case is a shell test, which tdd.sh cannot run)

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.1-B2 | it should end every descendant of the command before releasing the lock when the wrapper receives SIGTERM | red | `bash .claude/scripts/with-browser-lock.test.sh` (new case against the script of `9345c4df`; the command is `sh -c 'sleep 60 & echo $! >file; wait'`, the wrapper is TERMed, a second caller then checks the grandchild with `kill -0`) | exit 1 | `FAIL: a grandchild of the command outlived the wrapper's SIGTERM and the lock was released` |
| T8P.1-B2 | same | green | `bash .claude/scripts/with-browser-lock.test.sh` (command in its own process group; TERM sent to the group; after the child is reaped the wrapper waits up to 5 s for the group to empty, then KILLs it, before exiting and releasing the lock); run 3 times | exit 0 each | `PASS: one caller at a time, also after a killed holder` |

Notes: all existing cases in the file stay green (waiting message, exit 7, SIGKILLed holder, SIGTERM gives 143 and frees the lock, reentrancy). `npm --version` and `npm run --silent typecheck --help` through the wrapper exit 0. Nothing listened on 5175, 9341 or 9342 before or after.
