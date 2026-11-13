# T8P.2-B1 TDD log (hand-written: the case is a shell test, which tdd.sh cannot run)

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.2-B1 | it should list each it.each case's title template, and every other it form (it.skip, it.only, it.todo), once per occurrence | red | `.claude/scripts/it-titles.test.sh` against the T8P.2 script (single-line `it(` with a quoted title only) | exit 1 | `FAIL: titles differ.` expected 11 titles; got 7 (no it.each, no it.todo, no title on the line after `it(`; it.skip and it.only listed bare) |
| T8P.2-B1 | it should list each it.each case's title template, and every other it form (it.skip, it.only, it.todo), once per occurrence | green | `.claude/scripts/it-titles.test.sh` against the whole-file perl scanner | exit 0 | `it-titles.test: all passed` |
| T8P.2-B1 | real tree check | note | `it-titles.sh` at `cf690cb2` (via `git archive cf690cb2 src`) and at HEAD | exit 0 | both 1515 titles, diff empty; the T8P.2 script gave 1513 at HEAD, and the fixed one adds exactly the 2 `it.each` titles (PlanForm.test.tsx:353, ReviewCards.test.tsx:774, the latter with a multi-line table) and drops none |
