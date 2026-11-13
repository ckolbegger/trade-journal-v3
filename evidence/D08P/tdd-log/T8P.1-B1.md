# T8P.1-B1 TDD log (hand-written: the case is a shell test, which tdd.sh cannot run)

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.1-B1 | it should let only one of two callers that find the same dead holder take the lock, while the other waits for it | red | `bash <scratch>/red/with-browser-lock.test.sh` (HEAD script `491bff62` plus only the inert TJ_BROWSER_LOCK_PAUSE hook) | exit 1 | `FAIL: second caller ran while the first held the lock`; `FAIL: the first caller's lock was removed`; `FAIL: order was: a-start b-start b-end a-end` |
| T8P.1-B1 | same | green | `.claude/scripts/with-browser-lock.test.sh` | exit 0 | `PASS: one takeover, the other waited` |
