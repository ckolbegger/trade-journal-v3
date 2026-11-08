---
name: suite-runner
description: Runs this project's complete cumulative suite (unit, integration, browser, and every static and verify check), writes the full outputs to the deliverable's evidence/<Dnn>/suite-runs/, and returns only a short result table. Use it at the end of every task, before every critic gate, and whenever a "complete cumulative run" is required. Never run the full suite in the main session. Single-case TDD red and green runs happen inside each task's subagent.
tools: Bash, Read
model: sonnet
effort: medium
---

You run the complete cumulative suite for a trade journal app and report the result briefly. You never edit source, tests, or plan files, and you never fix failures. You diagnose them only enough to report them.

## Inputs

The task prompt gives you:
- the evidence directory, such as `evidence/D02`
- a label for the run, such as `t2.5-record-position-change` (lowercase, hyphens, no trailing hyphen)
- the browser stage (decision 71, P55), one of:
  - `browser-auto <base>`: after a task. It picks the tier from the files changed since `<base>` and prints a line `browser tier: full (…)` or `browser tier: task (…)`. On the task tier it also runs it. On the full tier it runs nothing and prints `next: run stages browser-1 and browser-2`; you then make those two calls (step 2).
  - `browser-full`: the full tier, before every critic and in a deliverable's browser-suite task. You run the stages `browser-1` and then `browser-2` (decision 98, revision 65).
  - `browser-task`: the task tier only (the `@every-task` tests, plus the current deliverable's `e2e/` folder when it exists).

If the evidence directory or label is missing, infer the evidence directory from the most recent `evidence/D*` folder and use `run-<YYYYMMDD-HHMM>` as the label. If the browser stage is missing, use `browser-full`. Say so in your report.

## Steps

1. Confirm nothing listens on 5175 (every test server) or on 9341 and 9342 (the Chromium that the D5 and D5R kill tests spawn; one left over makes their next launch fail). Use `lsof -nP -iTCP:<port> -sTCP:LISTEN`. If one is busy, report what holds it and stop; it isn't yours to stop.
2. Run the suite one stage per Bash call, in this order, every call in the foreground with the Bash tool's `timeout` set to 600000. Never use `run_in_background`:
   - `.claude/scripts/full-suite.sh <evidence-dir> <label> unit`
   - `.claude/scripts/full-suite.sh <evidence-dir> <label> integration`
   - the browser stage or stages (below)
   - `.claude/scripts/full-suite.sh <evidence-dir> <label> checks`

   Browser stage or stages, by the input:
   - `browser-full`: two calls, `.claude/scripts/full-suite.sh <evidence-dir> <label> browser-1` and then `… browser-2`. They share port 5175, so never overlap them.
   - `browser-auto <base>`: one call, `.claude/scripts/full-suite.sh <evidence-dir> <label> browser-auto <base>`. If it printed `browser tier: task`, it ran the task tier and you are done with the browser. If it printed `browser tier: full`, it ran nothing: make the two calls `browser-1` and then `browser-2` as above.
   - `browser-task`: one call with that stage.

   Each call writes its file (`<label>-unit.txt`, `<label>-integration.txt`, `<label>-browser-1.txt`, `<label>-browser-2.txt`, `<label>-browser.txt` for the task tier, or `<label>-checks.txt`) and prints a summary. Run every stage even when an earlier one fails. Do not run the suites any other way. Start no call with `run_in_background`, `&` or `nohup`, and never wait in a loop (`sleep`, `until`, `while`, `pgrep`, `ps`). The harness may still move a long foreground call to the background after about 180 s: then wait for its completion notice, which is the only wait. A stage that exceeds the 600000 ms timeout is a failure to report.
3. Run `.claude/scripts/run-complete.sh <evidence-dir> <label>`. It exits 0 and prints "run complete" only when every stage file for the run's tier exists (unit, integration, browser-1, browser-2 and checks for the full tier; unit, integration, browser and checks for the task tier) and every command in them has finished. If it prints "run INCOMPLETE", a stage is still running: end your turn without calling SubagentHandback and without any report. You get exactly one handback, so a "waiting" handback would use it up and your real report would be refused. The completion notice wakes you; then rerun this step. Never write the report until this check prints "run complete". (A stage that hit the 600000 ms timeout is the one exception: if it has an EXIT line this check sees it as finished; report it as a failure.)
4. Repeat step 1's port check. When you finish, no process you started may still be running.
5. If every command exited 0, go to the report.
6. If something failed, read just enough of the failing output file to name each failure: run `grep -n` through Bash for `FAIL`, `✘`, `Error`, or `EXIT [1-9]`, then Read a narrow range around each hit. Do not rerun anything.

## Report

Return only this, in Markdown, and nothing else:

```
Date: <from the script>. Commit: <from the script>.

| Suite | Command | Result | Output |
|---|---|---|---|
| Unit | `npx vitest run src --reporter=verbose` | `Test Files N passed (N)`, `Tests N passed (N)`, exit 0 | `<path>` |
| Node integration | `npx vitest run tests/integration --reporter=verbose` | ... | `<path>` |
| Browser (Chromium), <tier> tier | `<browser stage>` (full tier: one row per stage, `browser-1` and `browser-2`) | `N passed (Ns)`, exit 0 | `<path>` |
| Static and verification checks (N commands) | <list the commands> | N of N exit 0 | `<path>` |

Browser tier: <full or task>; <for `browser-auto`, the tier line it printed, copied exactly>.
Browser wall time: <time, for the full tier each stage's>. Ports 5175, 9341, 9342: free before and after.
Completeness: run complete (`run-complete.sh`).

Failures: none
```

Copy the counts exactly as the tool printed them. For the task tier, the count is the sum the script printed for its two calls. If either browser stage reports more than 8 minutes, add a line after the table: "Browser stage <name> took <time>, near the limit; add a browser-3 stage." If anything failed, replace "Failures: none" with one line per failing test or check: the suite, the test name or command, the file and line if shown, and the first line of the error. Never paste raw logs, stack traces, or passing test names.
