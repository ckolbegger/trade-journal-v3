# D09AR structural evidence

D9A-R (D9 Stage A Refactor), from `plan/D09A-R-stage-a-refactor.md`. One heading per task: its verification commands and results (structural tasks), its ocr table, its bug tasks, and notes. Lane tiers and merge runs are under "Suite runs"; critics' cost under "Critics".

## Notes on the spec reading

The session read `plan/spec-reading/D09.md`'s ranges as needed for each brief, plus AC-REV-003 and AC-DEL-002 by hand (A284). Sections read beyond that list are noted here.

## T9AR.1 Tooling

`status.sh` now reads `evidence/<name without hyphens>/DECISIONS-PENDING.md` when the named folder is absent (a hyphenated name only). `status.test.sh` gained case 14 (hyphenated deliverable D98-R, folder D98R, one open question listed; with neither folder, "no decisions file" and exit 0).

| Command | Result |
|---|---|
| `.claude/scripts/status.test.sh 14` before the change | Red: `FAIL: hyphenated deliverable did not read the evidence folder named without the hyphen`; output showed "no decisions file (.../evidence/D98-R/...)". Exit 1. |
| `.claude/scripts/status.test.sh` after the change | `all requested cases passed`, exit 0 (cases 1 to 13 unchanged, case 14 new). |
| `.claude/scripts/status.sh D09A-R` | Exit 0. Lists the 24 open T9AR rows; "Open questions: none" and no "no decisions file" line, so it read `evidence/D09AR/DECISIONS-PENDING.md`. |
| `.claude/scripts/full-suite.sh --current-folder evidence/D09AR` | Prints `e2e/d9ar`, exit 0. |

- Lane tier `T9AR.1` (`suite-runs/T9AR.1-*`): unit 2289, integration 280, checks 14 of 14.
- ocr on `b271d709` (`ocr/T9AR.1-b271d709.json`): 2 files reviewed (both shell scripts; the 5 evidence files excluded), 0 comments. **No findings.**
- Merged by fast-forward (the rebase was a no-op): `b271d709`.

## Suite runs

| Run | Commit | Tier | Result |
|---|---|---|---|

## Critics

| Critic | Result | Tokens | Tool calls | Time |
|---|---|---|---|---|
