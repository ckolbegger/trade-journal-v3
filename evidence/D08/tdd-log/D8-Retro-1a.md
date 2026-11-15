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

## B3

Command: `.claude/scripts/status.test.sh 8`.

| case | test | red | green |
|---|---|---|---|
| 8 | it should count F and B tasks written with the task prefix the same as bare ones, each distinct ID once | FAIL: task-prefixed IDs not counted (want F 1, B 2): T9.2 printed "F 0, B 0" | status.test.sh: all requested cases passed (cases 1 to 8) |

note: the first draft of the case passed by accident (two rows in one fixture, glob matched the second row's line); the test was split into one fixture per row before the red above.

refactor: none needed; the fix is an optional `T<n>.<n>-` prefix in the ID regex (the existing prefix-stripping already drops it).

## B4

Command: `.claude/scripts/status.test.sh 9`.

| case | test | red | green |
|---|---|---|---|
| 9 | it should count a bare Answer line only inside its own question's section, while a Qn answer line still answers Qn by label | FAIL: a bare Answer under a non-question heading answered Q1 (Q1 missing, "0 open question(s)") | status.test.sh: all requested cases passed (cases 1 to 9) |

note: one fixture per scenario (bare Answer under `## Summary`; `**Q1 answer` under `## Summary`). The second scenario passes with and without the fix by design, as a guard that the label rule is unchanged.

refactor: none needed; the fix is one awk rule that clears the current question at any heading other than `## Qn.`.

## B5

Command: `.claude/scripts/status.test.sh 10`.

| case | test | red | green |
|---|---|---|---|
| 10 | it should exit non-zero, naming the file, when the decisions file exists but cannot be read | FAIL: unreadable decisions file not reported (exit 0): awk "can't open file", then "0 open question(s)" and "nothing open" | status.test.sh: all requested cases passed (cases 1 to 10) |

note: the fixture is `chmod 000` in the scratch directory and restored right after the run; the case prints a SKIP line when run as root. A second fixture (no decisions file) checks "no decisions file" still exits 0.

refactor: none needed; the fix checks the awk's status and exits 1 naming the file.

## B6

Command: `.claude/scripts/status.test.sh 6`. Test fix only; no production change.

| case | test | mutation red | green |
|---|---|---|---|
| 6 | it should pick the breakdown holding the Progress table among handoff files and an earlier non-handoff file with no Progress heading | with the Progress check in `status.sh` replaced by `false && ...`: FAIL "no Progress table in .../D99-alpha-notes.md" (exit 1) | restored: status.test.sh: all requested cases passed (cases 1 to 10) |

note: the fixture gains `D99-alpha-notes.md` (no Progress heading), which sorts before the breakdown.
