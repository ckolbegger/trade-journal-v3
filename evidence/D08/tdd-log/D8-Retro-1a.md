# D8-Retro-1a tdd log

Rows are hand-written (tdd.sh runs vitest only). Command: `.claude/scripts/status.test.sh <case>`. Red runs used a stub `status.sh` that exits 0 and prints nothing, so each red is an assertion failure, not a missing file. Cases were all written and run red against the stub, then one implementation was written; no case passed on first run.

| case | test | red | green |
|---|---|---|---|
| 1 | it should print no open rows and no open questions for D08 | FAIL: D08 did not report nothing open (exit 0) | status.test.sh: all requested cases passed |
| 2 | one open row with its wave, lane and status, and one unanswered question | FAIL: open row missing its wave, lane or status | passed |
| 3 | counts the F and B tasks in an open row's Commits cell | FAIL: F/B counts wrong (want F 2, B 3) | passed |
| 4 | attributes a `**Qn answer` line to Qn in another question's section | FAIL: Qn answer not attributed by label | passed |
| 5 (extra) | a missing breakdown is named and exits non-zero | FAIL: missing breakdown not reported: 0 | passed |

refactor: none needed; the script is one awk pass per table and per decisions file.

## B1

Command: `.claude/scripts/status.test.sh 6`.

| case | test | red | green |
|---|---|---|---|
| 6 | it should pick the file that holds the Progress table, skipping every handoff file, when several plan files exist | FAIL: breakdown holding the Progress table not picked among handoff files (exit 1): status.sh: no Progress table in .../plan/D99-implementing-handoff.md | status.test.sh: all requested cases passed (cases 1 to 6) |

refactor: none needed; the fix is two lines in the plan-file loop.

## B2

Command: `.claude/scripts/status.test.sh 7`.

| case | test | red | green |
|---|---|---|---|
| 7 | it should stop reading rows at the next heading after the Progress table | FAIL: rows under a later heading were listed as open tasks (T9.90 and T9.91 printed, 3 open task(s)) | status.test.sh: all requested cases passed (cases 1 to 7) |

refactor: none needed; the fix is a Progress-section flag in the awk (`inprog`), cleared by any other heading.
