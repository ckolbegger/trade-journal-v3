# D8 Backup and Restore: final report

Branch `claude-opus-5.5`, tag `claude-opus-5.5-d8` on the commit that adds this report. Plan r102 (frozen). Detail for everything below is in `structural.md`, `DECISIONS-PENDING.md`, `tdd-log/`, `ocr/`, `suite-runs/`, `critic-1.md`, `critic-2.md` and `bench.md`.

## Result

D8 is complete. Every task is Done (T8.16 withdrawn by decision 76), every task and bug task has an ocr review with no open findings, and the critic gate T8.22 closed on critic-2 (PASS, two low defects, both fixed) plus the gate-closing full run.

| Run | Unit | Integration | Browser | Checks |
|---|---|---|---|---|
| Gate-closing full tier (`gate`, code `d1ce099f`) | 189 files, 2025 tests | 118 files, 258 tests | browser-1 126 (5.3 m), browser-2 120 (7.8 m) | 14 of 14 |
| Acceptance commands (`acceptance-commands.txt`) | 16 commands checked, 0 failed; 1 procedure row (AC-DEL-003) | | | |

Benchmark (T8.19, `bench.md`, run alone on port 4175): Restore of the target dataset (25,000 Trades, 108,054 Marks) prepares in 90.5 s and applies in 5.9 s with no repairs; restored usage 206.5 MB (0.264 of the projection, limit 1.10); second-Restore peak 439 MB (0.481 × M, limit below 3); D7 budgets met on the restored profile (cold p95 145 ms of 2,500, warm p95 62 ms of 1,500); every correctness comparison equal; one export 21.9 s, one verification 12.2 s (recorded, not gated).

## Critic gate

| Critic | Result | Defects | Cost |
|---|---|---|---|
| critic-1 | FAIL | B1 preview "made" time in the browser's zone (high); B2 About missing backup ranges (high); B3 first-run form left on screen (moderate); B4 preview scrolls sideways at 375/320 px (moderate); B5 internal Entry Type keys shown (moderate); B6 confirm-step controls apart from their labels (moderate) | 183,880 tokens, 95 tool calls, 12 m 28 s |
| critic-2 | PASS | B7 counts table splits words at 375/320 px (low; caused by the B4 fix); B8 "1 (1 versions)" (low) | 140,826 tokens, 63 tool calls, 8 m 22 s |

Fix rounds at the gate: B6 had two ocr follow-ups (B6-B1 a layout test that could not fail; B6-B2 the decline checkbox's text was not its label, a regression from B6), and B8 had one (B8-B1, a style tidy-up).

## Fix rounds by task

Each task's ocr bug tasks (B) and follow-ups from decisions or suite failures (F), as recorded in the plan's Progress table: T8.1 B1 to B7; T8.23 B1; T8.6 F2, F12, B1 to B6 (B7, B8 dismissed); T8.3 B1 to B6, F1; T8.7 B1 to B5; T8.4 B1 to B10, F1, F2; T8.5 B1 to B9, F1, F2; T8.8 B1 to B10, F1 to F4, F1-B1; T8.9 F1, F1-B1, F1-B2, B2 to B14; T8.12 B1 to B6, F1; T8.13 B1 to B7, F1 to F3; T8.14 B1 to B6, F1, F2; T8.11 B1 to B8; T8.15 B1 to B4; T8.20 F1, F2, F1-B1, F3; T8.18 B2, F1, F2, F2-B1 to F2-B3 (B1 folded into T8.19); T8.21 B1, F1 to F3, F3-B1, F3-B1-B1; T8.19 B1, B2; T8.22 B1 to B8, B6-B1, B6-B2, B8-B1. T8.2, T8.10 and T8.17 needed none.

## TDD exceptions (flagged)

First-run passes, each with a mutation check recorded in its tdd-log: T8.1 (1 case), T8.3 (1), T8.7-B2, T8.12 (1), T8.11 (1), T8.13 (several, see `tdd-log/T8.13.md`), T8.14 (1 characterization case), T8.5-B3, T8.5-B4, T8.4-B9, T8.4-B10, T8.8-F2 (case 1), T8.9 (case 5's decline half, case 7), T8.20 and T8.21 (every case: suites written against an app already built), T8.20-F2, T8.20-F3, T8.21-F3, T8.21-F3-B1 (no-wait case), T8.18-F2-B1, T8.18-F2-B2, T8.11-B3/B4 (1 case) and T8.9-B2 (1 case).

TDD order slips (code before a valid red; the red was then taken by removing the fix): T8.8-B4, T8.8-B7, T8.8-B10, T8.9 case 6, T8.9-F1-B1/F1-B2 with T8.15-B1, T8.18-F2 (reds from stubs), T8.19 (report formatting written before its test, reverted for the red). Runtime-exception reds rather than assertions: T8.20-F1-B1 (migration) and T8.11-B5 to B7 (two of three reds).

## Decisions

All 29 questions are answered. **Q29** (answered after the tag): keep T8.19's projection formula, add a growth guard (restored usage within 50% of today's 206.5 MB baseline), and replace the `--restored` option with command names (`measure:capacity` safe, `measure:capacity:reset-baseline` the only command that rewrites stored figures, `verify:capacity:restored`). The code change, T8.19-F1, is not in the `claude-opus-5.5-d8` tag: at the user's choice it is the first item for plan revision 103.

**T8.19-F1 is done** (`fa06cb28`, plan revision 103, decision 114, which replaced Q29's first wording with `measure:capacity:reset-basis`, `measure:capacity:reset-baseline` and `bench:verify-capacity`). ocr: no findings. Its benchmark measurement: restored usage 0.264 × the projection (limit 1.10), second-Restore peak 0.485 × M (limit below 3), restored usage 1.000 × the baseline (limit 1.50). Complete run `T8.19-F1` passed (full browser tier; unit 2027, integration 258, browser 126 + 120, checks 14 of 14). Notes, not defects: `tools/capacity/profile.ts` line 190 and the comment at the top of `tools/capacity/measure-page.ts` still name `measure:capacity` where `measure:capacity:reset-basis` is meant.

Known limits by decision: Q12 (a throw after the switch in apply's last three steps is unguarded; the Restore screen's message covers it); Q16 (`UnsupportedDataCapability` is never produced; revisit before D10).

## Reviewer notes (not defects; for r103 or later work)

- The preview's "From a backup made" time is shown in the backup's zone (the restored journal's). A133 doesn't say which Workspace; showing the current journal's zone when they differ needs the coordinator to carry the instant.
- After a first-run choice of Restore, and on every preview, there is no Back or Cancel; reloading is the only way back.
- The decline acknowledgment stays ticked after switching to "Back up this journal first" and back.
- After a Restore, keyboard focus drops to the page body rather than the "Restore complete" heading.
- The other-tab warning waits up to 250 ms (a value chosen here, not in the plan) when no tab has answered.
- Go to Trades after a first-run Restore reloads the document (`reloadDocument`); a router-level fix in `main.tsx` is the alternative.
- T8.21-F2's `main.tsx` condition is proven only in the browser (B8.10); B8.10's record-expiration check is not mutation-proven.
- The benchmark's Settlement quantity comes from the generator's own count.
- Entry Type names live only in the Backup UI's map; other screens type them by hand, and About's Entry Types line still shows keys.
- An empty `candidates` record stays in the root after a preparation.
- Critic wording observations: "The checked backup is no longer available." for an apply-time recheck failure; "Backup complete" without a time in Migration Blocked; "Downloaded, not verified yet" where Verify is not offered (approved by Q2).

## Flaky tests

| Run | Test | Rerun |
|---|---|---|
| T8.12 lane tier | `tools/wording-rules.test.ts` "reports navigator.userAgent…" (5 s timeout under load) | passed alone |
| T8.14 lane tier | `PositionChangeForm.test.tsx` "focus after navigation" | passed twice alone |
| T8.3-B2 lane tier | `TradeList.test.tsx` "Open list › should render distinct Loading, Ready, Empty…" | file passed alone |
| T8.22-B1 browser specs | `e2e/d8/after-restore.spec.ts` "B8.10 Readiness after Restore" (30 s timeout) | passed alone |

## Tooling notes

- ocr's ChatGPT usage ran out at 05:43 EST with no reset time in the error; work paused until it came back at 08:04. The `ocr-review` subagent now retests every 10 minutes and reruns the review (`.claude/scripts/ocr-usage-wait.sh`).
- `lane-setup.sh` does not carry the git-ignored benchmark artifact `.cache/bench/`, and removing a lane worktree deletes it; T8.19 had to regenerate it (same digest, about 15 minutes).
- The suite-runner twice overlapped the browser and checks stages despite its brief, and once sent an early "placeholder" hand-back that used up its one report; results were read from the run files.
- `tdd.sh` runs vitest only, so browser-test reds and greens were logged by hand.
