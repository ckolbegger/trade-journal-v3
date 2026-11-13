# T8P.1-B9 TDD log (hand-written: the case is a shell test, which tdd.sh cannot run)

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.1-B9 | it should KILL a command that ignores TERM once the grace period has passed, and then release the lock | red | `bash .claude/scripts/with-browser-lock.test.sh` (new case against the script of `460f3775`; `TJ_BROWSER_LOCK_GRACE=1` wrapper runs `sh -c 'trap "" TERM; ...loop'`, the wrapper is TERMed, the test waits up to 10 s) | exit 1 | `FAIL: wrapper did not exit after SIGTERM to a command that ignores it` |
| T8P.1-B9 | same | green | `bash .claude/scripts/with-browser-lock.test.sh` (the wrapper polls `waitpid` with WNOHANG, the grace period starts at the signal, and the group is KILLed when it ends; `TJ_BROWSER_LOCK_GRACE` overrides the 5 s, inert unless set); run 3 times | exit 0 each | `PASS: one caller at a time, also after a killed holder` |

Notes: all existing cases stay green (waiting message, exit 7, SIGKILLed holder, SIGTERM gives 143 and frees the lock, grandchild ended, reentrancy). Nothing listened on 5175, 9341 or 9342 before or after.
