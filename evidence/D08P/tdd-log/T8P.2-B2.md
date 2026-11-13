# T8P.2-B2 TDD log (hand-written: the case is a shell test, which tdd.sh cannot run)

| Task | Case | Phase | Command | Outcome | Failure excerpt |
|---|---|---|---|---|---|
| T8P.2-B2 | it should list an it.each case whose table holds a regex literal or a comment with brackets or quotes | red | `IT_TITLES=<pre-fix script from HEAD> .claude/scripts/it-titles.test.sh b2` (scratch tree: `it.each([/\(/, /["'`[]/])` and a table with `// ) ' " [` and `/* ] ( " */` comments) | exit 1 | `FAIL: b2: titles differ.` expected 4 lines (2 regex, 2 comment cases), got none |
| T8P.2-B2 | it should list an it.each case whose table holds a regex literal or a comment with brackets or quotes | green | `.claude/scripts/it-titles.test.sh b2` against the Vitest-collection script (Node API `createVitest().collect()`, no source parsing) | exit 0 | `it-titles.test: all passed` |
| T8P.2-B2 | design note | note | `vitest list --json` drops skipped and todo cases (its formatter skips state "skipped"), so the script uses the same collection through the Node API | n/a | the decision's stop condition names a listing that cannot show skip or todo; the API shows both, so no fallback to patterns |
| T8P.2-B2 | real tree check | note | `it-titles.sh` on `git archive cf690cb2` and on `git archive HEAD` (node_modules linked), and on the worktree | exit 0 | 1519 lines each, diff empty (about 3 s per run); no skip or todo cases in src |
