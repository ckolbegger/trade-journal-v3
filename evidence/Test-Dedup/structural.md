# Test dedup structural record

## TD.1 — Replay chart key and Plan block (BD5, BD9)

Spec counts (cases run) before and after, `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d9ar/chart.spec.ts e2e/d9ar/readout.spec.ts e2e/d9ar/sweep.spec.ts`:

| File | Before | After |
|---|---|---|
| e2e/d9ar/chart.spec.ts | 16 | 15 |
| e2e/d9ar/readout.spec.ts | 19 | 16 |
| e2e/d9ar/sweep.spec.ts | 4 | 4 |
| Total | 39 passed | 35 passed |

Removed cases:
- e2e/d9ar/chart.spec.ts, "should name the shaded No Mark column in the key on R-CORV-D" (BD5). Its checks live in "should shade the session with no Mark on R-CORV-D, join nothing across it and flag the Target reached". Moved: the key contains "No Mark" on Wed 11-11, then one session back (ArrowLeft) on Tue 11-10. The one shaded column count was already in the kept case. Its comment about W66 went with it.
- e2e/d9ar/readout.spec.ts, "should keep every figure in the Plan block on one line, sign with its number, at 375 and 320" (BD9; loop of 3: BREN, AXIO, CORV). Its checks live in e2e/d9ar/sweep.spec.ts "should find no broken or unmarked figure anywhere in the replay at any session" (unchanged); nothing moved. Removed with it: the loop's `places` data, `brokenPlanFigures` and the describe block "T9AR.24-B12 Figures in the Plan block". No import became unused (STRAY and the others are still used by the B2 helper and cases).

Cases kept: none (both confirmed after reading kept and dropped cases in full).

Mutation checks of the moved key checks: see evidence/Test-Dedup/tdd-log.md, TD.1.

References (rule 10): rg of both titles found living text only in the plan itself. History, left as written: evidence/D09AR/tdd-log/T9AR.23.md:18 (chart case), evidence/D09AR/tdd-log/T9AR.24-B12.md:7 and evidence/D09AR/structural.md:990 (Plan block case; sweep:24 now holds it, kept case "should find no broken or unmarked figure anywhere in the replay at any session"). plan/acceptance-matrix.md, plan/spec-map.md and plan/bug-tasks.md: no reference, nothing re-pointed.

## TD.2 — Journal paging and Settlement Due Today (BD14, BD17)

Spec counts (cases run) before and after, `.claude/scripts/with-browser-lock.sh npm run test:e2e:specs -- e2e/d8p/history.spec.ts e2e/d8p/states.spec.ts e2e/d8r/history.spec.ts e2e/d8r/states.spec.ts`:

| File | Before | After |
|---|---|---|
| e2e/d8p/history.spec.ts | 3 | 2 |
| e2e/d8p/states.spec.ts | 3 | 3 |
| e2e/d8r/history.spec.ts | 1 | 1 |
| e2e/d8r/states.spec.ts | 4 | 3 |
| Total | 11 passed | 9 passed |

Removed cases:
- e2e/d8p/history.spec.ts:135, "should keep keyboard focus on a paging button when paging to either end of the Journal" (BD14). Its checks live in e2e/d8r/history.spec.ts "should show each Mark cell with its provenance ... paged by keyboard with focus kept on a paging button" (last step, same keys and same assertions; same buildOc3 Trade at Thursday 18:00). Nothing moved. The comment in d8r/history.spec.ts that said the case was also in d8p now says it was removed as a duplicate.
- e2e/d8r/states.spec.ts:35, "should show Today on O-S2X Settlement Due with "Expired Fri Nov 20", then Closed by expiration with "Expired Fri Nov 20" as its column and the "Closed" stamp" (BD17). Its checks live in e2e/d8p/states.spec.ts "should show a Settlement Due Detail with Today selected and Settlement Due in the P&L card, then the expired put Closed via expiration with its Result rows". Confirm-first held: both build the same Trade (OS plan, 2 short MNO puts at 1.25, fee 1.30, entered Mon Oct 12 10:00, expiring Fri Nov 20), view it Mon Nov 23 17:00 as Settlement Due, then record the expiration. Moved into the kept case: "Where the prices sit" absent while Settlement Due; "Expired" appears once in Today; "Closed" absent while Settlement Due; the Closed stamp is in the accessibility tree (ariaSnapshot) and has no aria-hidden ancestor; MNO Mark Today cell empty after Closed; Put Mark Change cell "—" in both states. Imports ALL_DRAWERS, buildOs2x and recordExpiration became unused in d8r/states.spec.ts and were removed; expectClosedStamp stays (the K1 case uses it).
- Not moved, because the kept case already holds an equal check: the six-drawer list (kept case asserts the same list with a regex for the Journal owed count), the three Marks headings, the "Expired Fri Nov 20" accessible name and "Expired" text on Put Mark, Yesterday's "Expired" cell, the Closed lifecycle badge. Not moved, no counterpart in the kept case and not in the plan's list: the row labels ["MNO Mark", "Put Mark"] and the Yesterday cell's accessible name after Closed.

Cases kept: none (both confirmed after reading kept and dropped cases in full).

Mutation checks of the moved checks: see evidence/Test-Dedup/tdd-log.md, TD.2.

References (rule 10): rg of both titles and of the spec paths found living text only in the plan itself (and unrelated line mentions of d8p/history.spec.ts and d8r/states.spec.ts that do not name the removed cases). Nothing re-pointed in plan/acceptance-matrix.md, plan/spec-map.md or plan/bug-tasks.md. History, left as written: suite-run outputs naming d8p/history:135 (evidence/D95/suite-runs/t95.13-slip-questions-browser-*).
