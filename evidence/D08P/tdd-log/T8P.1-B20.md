# T8P.1-B20 TDD log (hand-written: the case is a shell test, which tdd.sh cannot run)

Bug task from the ocr review of `d8a39865`: `full-suite.sh` never cleared `<label>-lane.txt`, so a later non-lane run under the same label that never reached its browser stage read as "run complete". The test drives the real `full-suite.sh` marker handling from a scratch git repo (`browser-auto` with a base whose diff touches `package.json` picks the full tier and runs nothing, so it is cheap).

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.1-B20 | it should report run INCOMPLETE for a task-tier run under a label that earlier held a lane-tier run, when the browser stage has not run | red | `bash .claude/scripts/run-complete.test.sh` (current `full-suite.sh`, case added) | exit 1 | `FAIL: a non-lane run under a label with an old lane marker, browser stage not run, was not reported INCOMPLETE: ... run complete` |
| T8P.1-B20 | same | green | `bash .claude/scripts/run-complete.test.sh` (non-lane stages `rm -f` the marker, only the lane stage writes it) | exit 0 | `PASS: run-complete.sh reads the lane tier only from its marker` |

Kept working: every earlier case of the test file (same run). The lane stage still ends with its marker: it writes it once at the start and runs unit, integration and checks internally with `stage == lane`, so nothing removes it.
