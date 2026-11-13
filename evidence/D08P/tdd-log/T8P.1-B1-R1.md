# T8P.1-B1-R1 TDD log (hand-written: the case is a shell test, which tdd.sh cannot run)

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.1-B1-R1 | it should let only one of two callers that find the same expired takeover guard go on to take the lock | red | `bash <scratch>/red/red.sh` (script of `7b7621f6` plus two scratch pause points beside the existing TJ_BROWSER_LOCK_PAUSE one: after the guard's age is read, and after the PID re-check under the guard; an expired guard and a dead holder staged; caller A removes the expired guard and takes a live one, B then removes A's live guard and takes its own, both pass the PID check) | exit 1 | `log: b-start a-start`; `FAIL: both callers ran at once` |
| T8P.1-B1-R1 | same, now as the general property (one at a time, also after a `kill -9`'d holder; the other waits, then runs; no guard exists to stage) | green | `.claude/scripts/with-browser-lock.test.sh` (new kernel-lock script) | exit 0 | `PASS: one caller at a time, also after a killed holder` |

Notes: the existing TJ_BROWSER_LOCK_PAUSE hook alone cannot stage the interleaving (it pauses only before the guard's mkdir), hence the two scratch pause points in the red copy; the hook is gone from the new script. The new test file also covers exit-code pass-through (7), SIGTERM (143, then the lock is free) and reentrancy.
