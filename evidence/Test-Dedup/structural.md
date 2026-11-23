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
